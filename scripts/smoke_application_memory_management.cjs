"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationMemoryManagementRuntimeService,
  LocalUiGateway,
  registerApplicationMemoryManagementIpc,
} = require("../build-ts/desktop");

/** 在真实 preload 中执行 Memory 管理生命周期；输入窗口，返回公开结果，任一 IPC 失败时拒绝。 */
async function exerciseRenderer(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const listed = await runtime.listApplicationMemoryRecords({ memoryId: 'memory123' });
      const updated = await runtime.updateApplicationMemoryRecord({
        memoryId: 'memory123',
        recordId: 'record123',
        text: 'Electron 更新',
      });
      const deleted = await runtime.deleteApplicationMemoryRecord({
        memoryId: 'memory123',
        recordId: 'record123',
      });
      const removed = await runtime.removeApplicationMemoryCollection({ memoryId: 'memory123' });
      return { listed, updated, deleted, removed };
    })()
  `, true);
}

/** 运行真实 Electron Memory 管理 smoke；无输入，输出 JSON；IPC、稳定 ID 或 backend 断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-memory-management-smoke-"));
  const staticRoot = path.join(root, "ui");
  const calls = [];
  let activations = 0;
  let backendActivations = 0;
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  try {
    mkdirSync(staticRoot, { recursive: true });
    mkdirSync(path.join(root, "memory_cache", "memory123"), { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Memory Management smoke</body></html>", "utf8");
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；若被调用则累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Memory Management smoke must not activate the legacy backend.");
      },
    });
    const origin = await gateway.start();
    const runtime = new ApplicationMemoryManagementRuntimeService({
      userDataDirectory: root,
      /** 记录 Memory capability 激活；无输入，返回固定状态，不启动进程。 */
      core: { ensureCapability: async () => { activations += 1; return {}; } },
      supervisor: {
        /** 返回固定 Worker 响应；输入能力、方法和 payload，输出对应公开结果。 */
        request: async (capability, method, payload) => {
          assert.equal(capability, "memory");
          calls.push({ method, payload });
          if (method === "memory.collection.list") {
            return {
              memoryId: "memory123",
              records: [{ recordId: "record123", index: 0, text: "Electron 记忆", createdAt: "created", updatedAt: "updated" }],
            };
          }
          const action = method === "memory.collection.update"
            ? "updated"
            : (method === "memory.collection.delete-record" ? "deleted" : "removed");
          return { memoryId: "memory123", recordId: action === "removed" ? "" : "record123", action };
        },
      },
    });
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    cleanupIpc = registerApplicationMemoryManagementIpc({
      ipcMain,
      runtime,
      /** 授权 smoke 页面；输入 IPC 事件，无返回；发送者不是当前窗口时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Memory Management smoke IPC sender is not authorized.");
      },
    });
    await window.loadURL(origin);
    const result = await exerciseRenderer(window);
    assert.equal(result.listed.records[0].recordId, "record123");
    assert.equal(result.updated.action, "updated");
    assert.equal(result.deleted.action, "deleted");
    assert.equal(result.removed.action, "removed");
    assert.deepEqual(calls.map((call) => call.method), [
      "memory.collection.list",
      "memory.collection.update",
      "memory.collection.delete-record",
      "memory.collection.remove",
    ]);
    assert.equal(activations, 4);
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({ ok: true, requests: calls.length, stableRecordId: result.listed.records[0].recordId, memoryActivations: activations, backendActivations })}\n`);
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
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
