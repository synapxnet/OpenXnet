"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationModelAssetRuntimeService,
  LocalUiGateway,
  registerApplicationModelAssetIpc,
} = require("../build-ts/desktop");

/** 计算测试字节 SHA-256；输入 Buffer，返回十六进制哈希，无外部副作用。 */
function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 启动回环 Server；输入 Server，返回 Origin；绑定失败时拒绝且不访问外网。 */
function listenLoopbackServer(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

/** 关闭回环 Server；输入 Server，返回完成 Promise；关闭失败时拒绝。 */
function closeLoopbackServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/** 创建四个小文件测试版本；输入 Origin 和内容，返回完整固定清单，不访问网络。 */
function createCatalog(origin, contents) {
  /** 创建单个测试版本；输入 kind/source/版本和文件名，返回声明，不写磁盘。 */
  function release(kind, source, version, names) {
    return {
      kind,
      source,
      version,
      modelName: kind === "sherpa" ? "sherpa-electron" : "minilm-electron",
      files: names.map((name) => {
        const key = `${kind}:${source}:${name}`;
        const bytes = contents[key];
        return { name, url: `${origin}/${kind}/${source}/${name}`, size: bytes.length, sha256: hash(bytes) };
      }),
    };
  }
  return [
    release("sherpa", "modelscope", "a".repeat(40), ["model.onnx", "tokens.txt"]),
    release("sherpa", "huggingface", "b".repeat(40), ["model.onnx", "tokens.txt"]),
    release("minilm", "modelscope", "c".repeat(40), ["model.onnx", "tokenizer.json"]),
    release("minilm", "huggingface", "d".repeat(40), ["model.onnx", "tokenizer.json"]),
  ];
}

/** 在真实 preload 中执行模型安装生命周期；输入窗口，返回公开结果；任一 IPC 失败时拒绝。 */
async function exerciseRenderer(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const progress = [];
      const unsubscribe = runtime.onApplicationModelAssetProgress((event) => progress.push(event));
      try {
        const before = await runtime.getApplicationModelAssetStatus({ kind: 'sherpa' });
        const installed = await runtime.downloadApplicationModelAsset({ kind: 'sherpa', source: 'modelscope' });
        const after = await runtime.getApplicationModelAssetStatus({ kind: 'sherpa' });
        const removed = await runtime.removeApplicationModelAsset({ kind: 'sherpa' });
        return { before, installed, after, removed, progress };
      } finally {
        unsubscribe();
      }
    })()
  `, true);
}

/** 运行真实 Electron Model Asset smoke；无输入，输出 JSON；下载、进度、租约或 legacy 激活断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-model-asset-smoke-"));
  const staticRoot = path.join(root, "ui");
  const contents = {
    "sherpa:modelscope:model.onnx": Buffer.from("electron-sherpa-modelscope-model", "utf8"),
    "sherpa:modelscope:tokens.txt": Buffer.from("electron-sherpa-modelscope-tokens", "utf8"),
    "sherpa:huggingface:model.onnx": Buffer.from("electron-sherpa-huggingface-model", "utf8"),
    "sherpa:huggingface:tokens.txt": Buffer.from("electron-sherpa-huggingface-tokens", "utf8"),
    "minilm:modelscope:model.onnx": Buffer.from("electron-minilm-modelscope-model", "utf8"),
    "minilm:modelscope:tokenizer.json": Buffer.from("electron-minilm-modelscope-tokenizer", "utf8"),
    "minilm:huggingface:model.onnx": Buffer.from("electron-minilm-huggingface-model", "utf8"),
    "minilm:huggingface:tokenizer.json": Buffer.from("electron-minilm-huggingface-tokenizer", "utf8"),
  };
  const downloadRequests = [];
  const downloadServer = http.createServer((request, response) => {
    const key = String(request.url || "").slice(1).replaceAll("/", ":");
    const bytes = contents[key];
    assert.ok(bytes, `Unexpected model request ${request.url}`);
    downloadRequests.push(request.url);
    response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": bytes.length });
    response.end(bytes);
  });
  let downloadStarted = false;
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  let backendActivations = 0;
  const mutations = [];
  try {
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Model Asset smoke</body></html>", "utf8");
    const downloadOrigin = await listenLoopbackServer(downloadServer);
    downloadStarted = true;
    const runtime = new ApplicationModelAssetRuntimeService({
      modelRoots: { sherpa: path.join(root, "asr"), minilm: path.join(root, "ebd") },
      prepareMutation: async (kind) => { mutations.push(kind); },
      allowInsecureLoopback: true,
      catalog: createCatalog(downloadOrigin, contents),
    });
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；若被调用则累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Model Asset smoke must not activate the legacy backend.");
      },
    });
    const origin = await gateway.start();
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    cleanupIpc = registerApplicationModelAssetIpc({
      ipcMain,
      runtime,
      /** 授权 smoke 页面；输入 IPC 事件，无返回；发送者不是当前窗口时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Model Asset smoke IPC sender is not authorized.");
      },
      getWebContents: () => window && !window.isDestroyed() ? [window.webContents] : [],
    });
    await window.loadURL(origin);
    const result = await exerciseRenderer(window);
    assert.equal(result.before.state, "not-installed");
    assert.equal(result.installed.state, "installed");
    assert.equal(result.after.state, "installed");
    assert.equal(result.removed.state, "not-installed");
    assert.equal(downloadRequests.length, 2);
    assert.deepEqual(mutations, ["sherpa", "sherpa"]);
    assert.ok(result.progress.some((event) => event.phase === "downloading"));
    assert.equal(result.progress.at(-1).phase, "completed");
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({ ok: true, requests: downloadRequests.length, progress: result.progress.length, mutations, backendActivations })}\n`);
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    if (downloadStarted) await closeLoopbackServer(downloadServer);
    rmSync(root, { recursive: true, force: true });
  }
}

/** 等待 Electron 就绪并运行 smoke；无输入和返回；失败时打印堆栈并以非零状态退出。 */
async function main() {
  try {
    await app.whenReady();
    await runSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
