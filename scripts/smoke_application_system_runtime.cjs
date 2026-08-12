"use strict";

const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");
const {
  ApplicationSystemRuntimeService,
  LocalUiGateway,
  registerApplicationSystemRuntimeIpc,
} = require("../build-ts/desktop");

/** 运行真实 Renderer System Runtime smoke；无输入，输出 JSON，IPC 或零后端断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-system-runtime-smoke-"));
  const staticRoot = path.join(root, "ui");
  const userDataRoot = path.join(root, "user-data");
  const proxyConfigurations = [];
  const revealedPaths = [];
  let invalidations = 0;
  let backendActivations = 0;
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  try {
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>System smoke</body></html>", "utf8");
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；被调用时累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("System Runtime smoke must not activate the legacy backend.");
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
    const runtime = new ApplicationSystemRuntimeService({
      userDataDirectory: userDataRoot,
      extensionDirectory: path.join(userDataRoot, "ext"),
      readSettings: () => ({
        language: "auto",
        theme: "party",
        network: "local",
        timezone: "Asia/Shanghai",
        dateFormat: "YYYY-MM-DD",
        launchAtStartup: false,
        startMinimized: false,
        proxy: "http://127.0.0.1:7890",
        proxyMode: "manual",
        isChinaProxy: false,
      }),
      /** 保存 smoke 收到的规范代理配置。 */
      applySessionProxy: async (configuration) => {
        proxyConfigurations.push(configuration);
      },
      /** 保存 smoke 打开的固定目录并模拟 OS 成功。 */
      revealPath: async (directoryPath) => {
        revealedPaths.push(directoryPath);
        return "";
      },
      /** 记录代理更新触发的运行时失效次数。 */
      invalidateRuntimes: async () => {
        invalidations += 1;
      },
      listNetworkInterfaces: () => ({
        Ethernet: [{
          address: "192.168.8.12",
          netmask: "255.255.255.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: false,
          cidr: "192.168.8.12/24",
        }],
      }),
      environment: {},
    });
    cleanupIpc = registerApplicationSystemRuntimeIpc({
      ipcMain,
      runtime,
      /** 只授权 smoke 主窗口。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) {
          throw new Error("System Runtime smoke IPC sender is not authorized.");
        }
      },
    });
    await window.loadURL(origin);
    const result = await window.webContents.executeJavaScript(
      "(async () => ({ proxy: await window.openxnetDesktop.applyApplicationSystemProxy(), directory: await window.openxnetDesktop.revealApplicationSystemDirectory({ directory: 'logs' }), network: await window.openxnetDesktop.getApplicationSystemNetworkAddress() }))()",
      true,
    );
    assert.deepEqual(result.proxy, { success: true, mode: "manual", chinaMirror: false });
    assert.equal("proxy" in result.proxy, false);
    assert.deepEqual(result.directory, { opened: true });
    assert.deepEqual(result.network, { address: "192.168.8.12" });
    assert.deepEqual(proxyConfigurations, [{
      mode: "fixed_servers",
      proxyRules: "http://127.0.0.1:7890",
    }]);
    assert.equal(revealedPaths[0], path.join(userDataRoot, "logs"));
    assert.equal(existsSync(path.join(userDataRoot, "logs")), true);
    assert.equal(invalidations, 1);
    assert.equal(backendActivations, 0);
    process.stdout.write(JSON.stringify({
      ok: true,
      proxyMode: result.proxy.mode,
      directoryOpened: result.directory.opened,
      networkAddress: result.network.address,
      invalidations,
      backendActivations,
    }) + "\n");
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    rmSync(root, { recursive: true, force: true });
  }
}

/** 等待 Electron 就绪并运行 smoke；无输入和返回，失败时打印堆栈并以非零状态退出。 */
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
