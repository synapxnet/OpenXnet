"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationProviderService,
  ApplicationStore,
  LocalUiGateway,
  registerApplicationProvidersIpc,
} = require("../build-ts/desktop");

/** Electron smoke 使用的内存凭据存储；只在当前进程保存密钥，不写磁盘。 */
class SmokeProviderCredentialStore {
  constructor() {
    /** 保存当前密钥副本；无外部副作用。 */
    this.credentials = {};
  }

  /** 报告 smoke 安全存储可用；无输入，固定返回 true。 */
  isAvailable() {
    return true;
  }

  /** 读取凭据副本；无输入，返回深拷贝且不暴露内部引用。 */
  read() {
    return structuredClone(this.credentials);
  }

  /** 替换凭据；输入键值映射，无返回，仅修改当前测试进程状态。 */
  write(credentials) {
    this.credentials = structuredClone(credentials);
  }

  /** 清空凭据；无输入和返回，仅修改当前测试进程状态。 */
  clear() {
    this.credentials = {};
  }
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

/** 创建受控 OpenAI-compatible Provider；输入请求记录数组，返回回环 Server。 */
function createProviderServer(requests) {
  return http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString("utf8");
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization || "",
      body,
    });
    let payload;
    if (request.method === "GET" && request.url === "/v1/models") {
      payload = { data: [{ id: "embedding-electron" }] };
    } else if (request.method === "POST" && request.url === "/v1/embeddings") {
      assert.deepEqual(JSON.parse(body), { model: "embedding-electron", input: "test" });
      payload = { data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] };
    } else {
      response.writeHead(404).end();
      return;
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": encoded.length });
    response.end(encoded);
  });
}

/** 在真实 preload 中保存、验证并探测 Provider；输入窗口和 Origin，返回公开无密钥结果。 */
async function exerciseRenderer(window, providerOrigin) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const saved = await runtime.saveApplicationProviders({ providers: [{
        id: 'provider-electron',
        vendor: 'OpenAI',
        url: ${JSON.stringify(`${providerOrigin}/v1`)},
        modelId: 'embedding-electron',
        models: ['embedding-electron'],
        name: 'Electron Provider',
        managedBy: '',
        source: 'electron-smoke',
        disabled: false,
        apiKeyConfigured: true,
        apiKey: 'provider-electron-secret',
      }] });
      const validation = await runtime.validateApplicationProvider({
        providerId: 'provider-electron',
        vendor: 'OpenAI',
        url: ${JSON.stringify(`${providerOrigin}/v1`)},
        modelId: 'embedding-electron',
      });
      const probe = await runtime.probeApplicationProviderEmbedding({ providerId: 'provider-electron' });
      return { saved, validation, probe };
    })()
  `, true);
}

/** 运行真实 Electron Provider smoke；无输入，输出 JSON；IPC、凭据隔离或 legacy 激活异常时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-runtime-smoke-"));
  const staticRoot = path.join(root, "ui");
  const requests = [];
  const providerServer = createProviderServer(requests);
  let providerStarted = false;
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  let service = null;
  let backendActivations = 0;
  try {
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Provider smoke</body></html>", "utf8");
    const providerOrigin = await listenLoopbackServer(providerServer);
    providerStarted = true;
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；若被调用则累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Provider smoke must not activate the legacy backend.");
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
    const store = new ApplicationStore({ databasePath: path.join(root, "desktop-core.db") });
    service = new ApplicationProviderService({
      store,
      credentials: new SmokeProviderCredentialStore(),
    });
    cleanupIpc = registerApplicationProvidersIpc({
      ipcMain,
      providers: service,
      /** 授权 smoke 页面；输入 IPC 事件，无返回；发送者不是当前窗口时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Provider smoke IPC sender is not authorized.");
      },
    });
    await window.loadURL(origin);
    const result = await exerciseRenderer(window, providerOrigin);
    const serialized = JSON.stringify(result);
    assert.equal(result.saved.providers[0].apiKeyConfigured, true);
    assert.equal(result.validation.status, "ready");
    assert.equal(result.validation.matchedModel, true);
    assert.deepEqual(result.probe, {
      providerId: "provider-electron",
      modelId: "embedding-electron",
      dimensions: 4,
    });
    assert.equal(serialized.includes("provider-electron-secret"), false);
    assert.equal(requests.length, 2);
    assert.ok(requests.every((request) => request.authorization === "Bearer provider-electron-secret"));
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({ ok: true, requests: requests.length, dimensions: result.probe.dimensions, secretExposed: false, backendActivations })}\n`);
  } finally {
    cleanupIpc?.();
    service?.close();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    if (providerStarted) await closeLoopbackServer(providerServer);
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
