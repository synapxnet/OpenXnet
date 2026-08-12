"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationVrmPresentationRuntimeService,
  LocalUiGateway,
  registerApplicationVrmPresentationIpc,
} = require("../build-ts/desktop");

/** 在 VRM 窗口注册一次 Main 事件订阅；输入窗口，无返回，bridge 缺失时拒绝。 */
async function subscribeVrmWindow(window) {
  await window.webContents.executeJavaScript(`
    window.__openxnetVrmEvents = [];
    window.vrmRuntime.onPresentationEvent((event) => window.__openxnetVrmEvents.push(event));
    true;
  `, true);
}

/** 在 5 秒预算内轮询 VRM 窗口首个事件；输入窗口，返回事件，超时则抛错。 */
async function waitForVrmEvent(window) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const event = await window.webContents.executeJavaScript(
      "window.__openxnetVrmEvents?.[0] || null",
      true,
    );
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("VRM presentation event was not delivered within 5 seconds.");
}

/** 在主窗口读取状态并发布固定事件；输入窗口，返回公开结果，IPC 失败时拒绝。 */
async function publishFromMainWindow(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const before = await window.openxnetDesktop.getApplicationVrmPresentationStatus();
      const published = await window.openxnetDesktop.publishApplicationVrmPresentation({
        type: 'startSpeaking',
        data: {
          audioDataUrl: 'data:audio/mpeg;base64,AQID',
          chunkIndex: 0,
          totalChunks: 1,
          text: 'Electron VRM',
          expressions: ['happy'],
          voice: 'default',
        },
      });
      return { before, published };
    })()
  `, true);
}

/** 运行真实双窗口 VRM smoke；无输入，输出 JSON；状态、投递或 backend 断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-vrm-presentation-smoke-"));
  const staticRoot = path.join(root, "ui");
  let backendActivations = 0;
  let mainWindow = null;
  let vrmWindow = null;
  let gateway = null;
  let cleanupIpc = null;
  try {
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Main VRM smoke</body></html>", "utf8");
    writeFileSync(path.join(staticRoot, "vrm.html"), "<!doctype html><html><body>VRM smoke</body></html>", "utf8");
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；被调用时累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("VRM presentation smoke must not activate the legacy backend.");
      },
    });
    const origin = await gateway.start();
    mainWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    vrmWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/vrm-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const runtime = new ApplicationVrmPresentationRuntimeService({
      getTargets: () => vrmWindow && !vrmWindow.isDestroyed() ? [vrmWindow.webContents] : [],
      readConfiguration: () => ({ language: "zh-CN", vrmConfig: { name: "default" } }),
      now: () => 123456,
    });
    cleanupIpc = registerApplicationVrmPresentationIpc({
      ipcMain,
      runtime,
      /** 只授权 smoke 主窗口；输入 IPC 事件，无返回，其他发送者立即失败。 */
      authorizeEvent: (event) => {
        if (event?.sender !== mainWindow?.webContents) {
          throw new Error("VRM presentation smoke IPC sender is not authorized.");
        }
      },
      authorizeVrmEvent: (event) => {
        if (event?.sender !== vrmWindow?.webContents) {
          throw new Error("VRM presentation smoke VRM sender is not authorized.");
        }
      },
    });
    await mainWindow.loadURL(origin);
    await vrmWindow.loadURL(`${origin}/vrm.html`);
    await subscribeVrmWindow(vrmWindow);
    const configuration = await vrmWindow.webContents.executeJavaScript(
      "window.vrmRuntime.getPresentationConfiguration()",
      true,
    );
    const result = await publishFromMainWindow(mainWindow);
    const received = await waitForVrmEvent(vrmWindow);
    assert.deepEqual(result.before, { connections: 1 });
    assert.deepEqual(configuration, { language: "zh-CN", vrmConfig: { name: "default" } });
    assert.deepEqual(result.published, { delivered: 1 });
    assert.equal(received.type, "startSpeaking");
    assert.equal(received.data.text, "Electron VRM");
    assert.equal(received.timestamp, 123456);
    vrmWindow.destroy();
    const after = await mainWindow.webContents.executeJavaScript(
      "window.openxnetDesktop.getApplicationVrmPresentationStatus()",
      true,
    );
    assert.deepEqual(after, { connections: 0 });
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      beforeConnections: result.before.connections,
      configurationLanguage: configuration.language,
      configurationName: configuration.vrmConfig.name,
      delivered: result.published.delivered,
      afterConnections: after.connections,
      backendActivations,
    })}\n`);
  } finally {
    cleanupIpc?.();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    if (vrmWindow && !vrmWindow.isDestroyed()) vrmWindow.destroy();
    if (gateway) await gateway.stop();
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
