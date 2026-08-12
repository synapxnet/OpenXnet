"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationKernelRuntimeService,
  LocalUiGateway,
  registerApplicationKernelRuntimeIpc,
} = require("../build-ts/desktop");

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

/** 创建受控私有 Kernel 引擎；输入 token 和请求数组，返回 Server；不启动 Python 或访问外网。 */
function createKernelServer(token, requests) {
  return http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(request.url, "/v1/desktop/kernel/command");
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    requests.push(body);
    let data = { ok: true };
    if (body.operation === "status") data = { ok: true, runtime: { mode: "shadow" }, workspace: "electron" };
    if (body.operation === "control-board") data = { ok: true, items: [{ plan_id: "plan-electron" }], summary: { total: 1 } };
    if (body.operation === "event-status") data = { ok: true, status: { subscribers: 0 }, recent: [] };
    if (body.operation === "plan-resume") data = { ok: true, advancedCount: 2, plan_id: body.payload.planId };
    if (body.operation === "approval-resolve") data = { ok: true, approval_id: body.payload.approvalId, resolution: body.payload.resolution };
    if (body.operation === "world") data = { ok: true, world: { schema: "openxnet.kernel.world_state.v1", model: body.payload.model } };
    if (body.operation === "audit") data = { ok: true, events: [{ event_type: "kernel.electron.smoke" }] };
    const encoded = Buffer.from(JSON.stringify({
      schema: "openxnet.kernel-runtime.v1",
      success: true,
      operation: body.operation,
      data,
    }), "utf8");
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": encoded.length });
    response.end(encoded);
  });
}

/** 在真实 preload 中执行 Kernel 生命周期；输入窗口，返回公开结果；任一 IPC 失败时拒绝。 */
async function exerciseRenderer(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const status = await runtime.invokeApplicationKernel({ operation: 'status', payload: {} });
      const board = await runtime.invokeApplicationKernel({
        operation: 'control-board',
        payload: { limit: 12, status: '', source: '', allowLowRisk: true, maxSteps: 3 },
      });
      const events = await runtime.invokeApplicationKernel({ operation: 'event-status', payload: { limit: 20 } });
      const resumed = await runtime.invokeApplicationKernel({
        operation: 'plan-resume',
        payload: { planId: 'plan-electron', dryRun: false, allowLowRisk: true, maxSteps: 3, reason: 'electron_smoke', runId: '' },
      });
      const approval = await runtime.invokeApplicationKernel({
        operation: 'approval-resolve',
        payload: { approvalId: 'approval-electron', resolution: 'approved', reason: 'electron_smoke', consume: true },
      });
      const world = await runtime.invokeApplicationKernel({
        operation: 'world',
        payload: { messages: [{ role: 'user', content: 'UTF-8 内核' }], model: 'electron-model', includeRecent: true },
      });
      const audit = await runtime.invokeApplicationKernel({ operation: 'audit', payload: { limit: 120, eventType: '' } });
      return { status, board, events, resumed, approval, world, audit };
    })()
  `, true);
}

/** 运行真实 Electron Kernel smoke；无输入，输出 JSON；typed IPC、租约或 legacy 激活断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-kernel-smoke-"));
  const staticRoot = path.join(root, "ui");
  const token = "electron-kernel-runtime-token";
  const requests = [];
  const engine = createKernelServer(token, requests);
  let engineStarted = false;
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  let acquisitions = 0;
  let releases = 0;
  let backendActivations = 0;
  try {
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Kernel smoke</body></html>", "utf8");
    const engineOrigin = await listenLoopbackServer(engine);
    engineStarted = true;
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；若被调用则累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Kernel smoke must not activate the legacy backend.");
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
    const runtime = new ApplicationKernelRuntimeService({
      token,
      acquireEngine: async () => {
        acquisitions += 1;
        return { origin: engineOrigin, release: () => { releases += 1; } };
      },
    });
    cleanupIpc = registerApplicationKernelRuntimeIpc({
      ipcMain,
      runtime,
      /** 授权 smoke 页面；输入 IPC 事件，无返回；发送者不是当前窗口时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Kernel smoke IPC sender is not authorized.");
      },
    });
    await window.loadURL(origin);
    const result = await exerciseRenderer(window);
    assert.equal(result.status.data.runtime.mode, "shadow");
    assert.equal(result.board.data.items[0].plan_id, "plan-electron");
    assert.deepEqual(result.events.data.recent, []);
    assert.equal(result.resumed.data.advancedCount, 2);
    assert.equal(result.approval.data.resolution, "approved");
    assert.equal(result.world.data.world.model, "electron-model");
    assert.equal(result.audit.data.events[0].event_type, "kernel.electron.smoke");
    assert.equal(requests.length, 7);
    assert.equal(acquisitions, 7);
    assert.equal(releases, 7);
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({ ok: true, requests: requests.length, acquisitions, releases, backendActivations })}\n`);
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    if (engineStarted) await closeLoopbackServer(engine);
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
