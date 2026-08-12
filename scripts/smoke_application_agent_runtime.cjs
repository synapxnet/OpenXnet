"use strict";

const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationAgentRuntimeService,
  LegacyRendererStateService,
  LocalUiGateway,
  bootstrapApplicationArtifacts,
  registerApplicationAgentRuntimeIpc,
  registerApplicationArtifactsIpc,
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

/** 创建固定 A2A 卡片 Server；输入请求数组，返回回环 Server，未知路径返回 404。 */
function createA2aServer(requests) {
  return http.createServer((request, response) => {
    requests.push(request.url);
    if (request.method !== "GET" || request.url !== "/.well-known/agent.json") {
      response.writeHead(404).end();
      return;
    }
    const payload = Buffer.from(JSON.stringify({
      name: "Electron A2A",
      description: "Agent Runtime smoke",
      version: "1.0.0",
      authentication: { token: "a2a-private-token" },
      skills: [{ id: "review", name: "Review", description: "Review files", tags: ["qa"] }],
    }), "utf8");
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": payload.length });
    response.end(payload);
  });
}

/** 在真实 preload 中执行 Agent、A2A 与 Workflow Artifact 生命周期；输入窗口和 Origin，返回公开结果。 */
async function exerciseRenderer(window, a2aOrigin) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const created = await runtime.createApplicationAgent({ name: 'Electron Agent', systemPrompt: '检查 UTF-8' });
      const a2a = await runtime.inspectApplicationA2a({ url: ${JSON.stringify(a2aOrigin)} });
      const workflowFile = new File(
        [JSON.stringify({ '1': { class_type: 'KSampler', inputs: { seed: 1 } } })],
        'electron-workflow.json',
        { type: 'application/json' },
      );
      const imported = await runtime.importSelectedArtifacts([workflowFile]);
      const artifactId = imported.artifacts[0].id;
      const deleted = await runtime.deleteArtifacts({ artifactIds: [artifactId] });
      const removed = await runtime.removeApplicationAgent({ agentId: created.agentId });
      return { created, a2a, imported, deleted, removed };
    })()
  `, true);
}

/** 运行真实 Electron Agent Runtime smoke；无输入，输出 JSON；路径、密钥、Artifact 或 backend 断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-agent-runtime-smoke-"));
  const staticRoot = path.join(root, "ui");
  const a2aRequests = [];
  const a2aServer = createA2aServer(a2aRequests);
  let a2aStarted = false;
  let window = null;
  let gateway = null;
  let cleanupAgentIpc = null;
  let cleanupArtifactIpc = null;
  let artifacts = null;
  let backendActivations = 0;
  try {
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Agent Runtime smoke</body></html>", "utf8");
    const a2aOrigin = await listenLoopbackServer(a2aServer);
    a2aStarted = true;
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；若被调用则累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Agent Runtime smoke must not activate the legacy backend.");
      },
    });
    const uiOrigin = await gateway.start();
    const state = new LegacyRendererStateService({ userDataDirectory: root });
    state.saveSettings({ settings: { agents: {}, model: "electron-model", workflows: [] } });
    const agentRuntime = new ApplicationAgentRuntimeService({
      userDataDirectory: root,
      state,
      createId: () => "agent123",
    });
    artifacts = bootstrapApplicationArtifacts({ userDataDirectory: root });
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const authorizeEvent = (event) => {
      if (event?.sender !== window?.webContents) throw new Error("Agent Runtime smoke IPC sender is not authorized.");
    };
    cleanupAgentIpc = registerApplicationAgentRuntimeIpc({ ipcMain, runtime: agentRuntime, authorizeEvent });
    cleanupArtifactIpc = registerApplicationArtifactsIpc({
      ipcMain,
      artifacts,
      authorizeEvent,
      /** 拒绝路径导入；输入事件和路径，无返回，本 smoke 只允许 preload 内联 File。 */
      authorizeImportPath: () => {
        throw new Error("Agent Runtime smoke does not authorize native paths.");
      },
    });
    await window.loadURL(uiOrigin);
    const result = await exerciseRenderer(window, a2aOrigin);
    const serialized = JSON.stringify(result);
    const artifact = result.imported.artifacts[0];
    assert.equal(result.created.agentId, "agent123");
    assert.equal(result.a2a.name, "Electron A2A");
    assert.equal(result.a2a.skills[0].id, "review");
    assert.equal(result.removed.action, "removed");
    assert.deepEqual(result.deleted.deletedArtifactIds, [artifact.id]);
    assert.equal(existsSync(path.join(root, "agents", "agent123.json")), false);
    assert.equal(existsSync(path.join(root, "uploaded_files", artifact.storageName)), false);
    assert.deepEqual(state.getSnapshot().settings.agents, {});
    assert.deepEqual(a2aRequests, ["/.well-known/agent.json"]);
    assert.equal(serialized.includes(root), false);
    assert.equal(serialized.includes("a2a-private-token"), false);
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({ ok: true, a2aRequests: a2aRequests.length, artifacts: 1, agentSnapshotsRemaining: 0, privateFieldsExposed: false, backendActivations })}\n`);
  } finally {
    cleanupAgentIpc?.();
    cleanupArtifactIpc?.();
    artifacts?.close();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    if (a2aStarted) await closeLoopbackServer(a2aServer);
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
