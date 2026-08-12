"use strict";

const assert = require("node:assert/strict");
const {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");

const {
  LocalUiGateway,
  bootstrapApplicationArtifacts,
  registerApplicationArtifactsIpc,
} = require("../build-ts/desktop");

/**
 * 通过 Chromium 调试协议给隐藏页面的文件框注入真实本机文件；输入 WebContents、选择器和路径，无返回，协议或元素失败时抛错。
 */
async function selectNativeFile(webContents, selector, filePath) {
  webContents.debugger.attach("1.3");
  try {
    await webContents.debugger.sendCommand("DOM.enable");
    const document = await webContents.debugger.sendCommand("DOM.getDocument", { depth: 1 });
    const target = await webContents.debugger.sendCommand("DOM.querySelector", {
      nodeId: document.root.nodeId,
      selector,
    });
    assert.ok(target.nodeId, `Missing smoke file input: ${selector}`);
    await webContents.debugger.sendCommand("DOM.setFileInputFiles", {
      nodeId: target.nodeId,
      files: [filePath],
    });
  } finally {
    webContents.debugger.detach();
  }
}

/**
 * 在真实 contextIsolation/preload 环境执行 Artifact 导入；输入隐藏窗口，返回本机 File 与生成 File 的 typed 写入结果，API 缺失或导入失败时抛错。
 */
async function importRendererFiles(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const input = document.querySelector('#native-file');
      const nativeResult = await window.openxnetDesktop.importSelectedArtifacts(
        Array.from(input.files || []),
      );
      const generated = new File(
        [new TextEncoder().encode('generated artifact smoke')],
        'generated-note.txt',
        { type: 'text/plain' },
      );
      const generatedResult = await window.openxnetDesktop.importSelectedArtifacts([generated]);
      const sticker = new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
        'sticker.png',
        { type: 'image/png' },
      );
      const stickerResult = await window.openxnetDesktop.importSelectedArtifacts([sticker]);
      return { nativeResult, generatedResult, stickerResult };
    })()
  `, true);
}

/**
 * 运行真实 Electron Artifact smoke；无输入，成功时输出 JSON，任一边界、内容或按需启动断言失败时抛错并以非零状态退出。
 */
async function runApplicationArtifactSmoke() {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "openxnet-artifact-smoke-"));
  const staticRoot = path.join(temporaryRoot, "ui");
  const userDataDirectory = path.join(temporaryRoot, "user-data");
  const artifactRoot = path.join(userDataDirectory, "uploaded_files");
  const nativePath = path.join(temporaryRoot, "原生资料.txt");
  const nativeContent = "native artifact smoke / 中文";
  let window = null;
  let gateway = null;
  let artifacts = null;
  let cleanupIpc = null;
  let backendActivations = 0;
  try {
    writeFileSync(nativePath, nativeContent, "utf8");
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(
      path.join(staticRoot, "index.html"),
      "<!doctype html><html><body><input id=\"native-file\" type=\"file\"></body></html>",
      "utf8",
    );
    artifacts = bootstrapApplicationArtifacts({ userDataDirectory });
    gateway = new LocalUiGateway({
      staticRoot,
      artifactRoot,
      getBackendOrigin: () => null,
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Artifact smoke must not activate the legacy backend.");
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
    cleanupIpc = registerApplicationArtifactsIpc({
      ipcMain,
      artifacts,
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) {
          throw new Error("Artifact smoke IPC sender is not authorized.");
        }
      },
      authorizeImportPath: () => {
        throw new Error("Artifact smoke did not grant a Main dialog path.");
      },
    });
    await window.loadURL(origin);
    await selectNativeFile(window.webContents, "#native-file", nativePath);
    const imported = await importRendererFiles(window);
    const nativeArtifact = imported.nativeResult?.artifacts?.[0];
    const generatedArtifact = imported.generatedResult?.artifacts?.[0];
    const stickerArtifact = imported.stickerResult?.artifacts?.[0];
    assert.equal(nativeArtifact?.originalName, path.basename(nativePath));
    assert.equal(generatedArtifact?.originalName, "generated-note.txt");
    assert.equal(stickerArtifact?.originalName, "sticker.png");
    assert.equal(stickerArtifact?.kind, "image");
    assert.equal(readFileSync(nativePath, "utf8"), nativeContent);
    assert.equal(existsSync(path.join(artifactRoot, nativeArtifact.storageName)), true);
    assert.equal(existsSync(path.join(artifactRoot, generatedArtifact.storageName)), true);
    assert.equal(existsSync(path.join(artifactRoot, stickerArtifact.storageName)), true);

    const nativeResponse = await fetch(
      `${origin}/uploaded_files/${encodeURIComponent(nativeArtifact.storageName)}`,
    );
    const generatedResponse = await fetch(
      `${origin}/uploaded_files/${encodeURIComponent(generatedArtifact.storageName)}`,
    );
    assert.equal(await nativeResponse.text(), nativeContent);
    assert.equal(await generatedResponse.text(), "generated artifact smoke");
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      artifacts: [nativeArtifact.originalName, generatedArtifact.originalName, stickerArtifact.originalName],
      backendActivations,
    })}\n`);
  } finally {
    cleanupIpc?.();
    artifacts?.close();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/**
 * 等待 Electron 就绪并执行 smoke；无输入和返回，失败时打印堆栈并设置退出码，始终结束 Electron 进程。
 */
async function main() {
  try {
    await app.whenReady();
    await runApplicationArtifactSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
