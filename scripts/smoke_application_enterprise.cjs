"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationEnterpriseRuntimeService,
  ApplicationEnterpriseInsightsRuntimeService,
  LocalUiGateway,
  registerApplicationEnterpriseRuntimeIpc,
  registerApplicationEnterpriseInsightsRuntimeIpc,
} = require("../build-ts/desktop");

/** 启动回环测试端点；输入 HTTP Server，返回监听 Origin，绑定失败时拒绝并且不访问外网。 */
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

/** 关闭回环测试端点；输入 HTTP Server，返回完成 Promise，关闭失败时拒绝。 */
function closeLoopbackServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/** 创建兼容用量数据库；输入文件路径，写入一条确定性记录，失败时抛错。 */
function seedUsageDatabase(databasePath) {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE usage_records (
        id TEXT PRIMARY KEY, timestamp TEXT, conversation_id TEXT, user_id TEXT,
        model TEXT, provider TEXT, input_tokens INTEGER, output_tokens INTEGER,
        cache_read_tokens INTEGER, cache_creation_tokens INTEGER, total_tokens INTEGER,
        cost_usd REAL, duration_ms INTEGER, engine TEXT, request_type TEXT, success INTEGER
      );
      INSERT INTO usage_records VALUES
        ('electron-usage', '2026-07-29 12:00:00', 'conversation', 'electron-user',
         'electron-model', 'electron-provider', 30, 12, 4, 1, 42, 0.03, 150, 'local', 'chat', 1);
    `);
  } finally {
    database.close();
  }
}

/** 创建受控私有 Insights 引擎；输入 token 和请求数组，返回回环 Server，不访问 Python 或外网。 */
function createInsightsServer(token, requests) {
  return http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const requestPath = String(request.url || "");
    requests.push({
      path: requestPath,
      authorization: String(request.headers.authorization || ""),
      body,
    });
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    let payload;
    if (requestPath.endsWith("/neuro/dashboard")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        stats: { totalSymbols: 1, uniqueEntities: 1, avgSuccessRate: 1, competitionSymbols: 0, operatorDistribution: { CausalInfer: 1 } },
        symbols: [{
          id: "electron-symbol",
          operator: "CausalInfer",
          label: "Electron 洞察",
          K: { entities: ["OpenXnet"] },
          metadata: { sourceType: "", recordType: "", workspaceId: "", incidentId: "", traceId: "", stage: "", decision: "", teamRole: "", agentName: "", skillName: "", skillVersion: "", confidence: 0 },
          createdAt: 1_700_000_000,
          successRate: 1,
          activationCount: 1,
        }],
        total: 1,
        rules: [{
          id: "rule-electron",
          name: "Electron Rule",
          domain: "smoke",
          description: "真实 preload 验证",
          bound_operator: "CausalInfer",
          enabled: true,
        }],
      };
    } else if (requestPath.endsWith("/neuro/search")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        symbols: [{
          id: "electron-symbol",
          operator: "CausalInfer",
          label: "Electron 洞察",
          K: { entities: ["OpenXnet"] },
          metadata: { sourceType: "", recordType: "", workspaceId: "", incidentId: "", traceId: "", stage: "", decision: "", teamRole: "", agentName: "", skillName: "", skillVersion: "", confidence: 0 },
          createdAt: 1_700_000_000,
          successRate: 1,
          activationCount: 1,
        }],
        total: 1,
      };
    } else if (requestPath.endsWith("/neuro/remove")) {
      payload = { schema: "openxnet.enterprise-insights.v1", success: true, symbolId: body.symbol_id };
    } else if (requestPath.endsWith("/neuro/maintenance")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        result: { decayed: 1, pruned: 0, protected: 0, remaining: 1, timestamp: "2026-07-29T12:00:00" },
      };
    } else if (requestPath.endsWith("/kg/dashboard")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        stats: { entities: 2, triples: 1, active_triples: 1, expired_triples: 0, competition_triples: 0, active_competition_triples: 0 },
        graph: {
          nodes: [
            { id: "openxnet", label: "OpenXnet", type: "product", degree: 1 },
            { id: "electron", label: "Electron", type: "runtime", degree: 1 },
          ],
          edges: [{ id: "electron-edge", source: "openxnet", target: "electron", label: "uses", confidence: 1, current: true, source_type: "manual" }],
        },
      };
    } else {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        subject: body.subject,
        facts: [{
          direction: "outgoing",
          subject: "OpenXnet",
          predicate: "uses",
          object: "Electron",
          valid_from: "",
          valid_to: "",
          confidence: 1,
          current: true,
          source_type: "manual",
        }],
      };
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": encoded.length });
    response.end(encoded);
  });
}

/** 在真实 preload 中执行企业管理生命周期；输入窗口和健康 URL，返回公开结果，任一 IPC 失败时拒绝。 */
async function exerciseRenderer(window, healthUrl) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const legacyWorkspaces = await runtime.listApplicationEnterpriseWorkspaces();
      const role = await runtime.saveApplicationEnterpriseRoleCard({
        mode: 'create',
        roleCard: {
          name: 'Electron 企业架构师',
          department: '研发部',
          system_prompt: '负责长期架构治理。',
          skills: ['architecture'],
          position3D: { x: 6, z: 9 },
        },
      });
      const updatedRole = await runtime.saveApplicationEnterpriseRoleCard({
        mode: 'update',
        roleCard: { ...role.card, description: '真实 Electron 更新验证' },
      });
      const sandbox = await runtime.getApplicationEnterpriseSandboxState();
      const knowledgeBase = await runtime.saveApplicationEnterpriseKnowledgeBase({
        knowledgeBase: { name: 'Electron 企业规范', description: 'Smoke', category: 'engineering' },
      });
      const versions = await runtime.listApplicationEnterpriseKnowledgeBaseVersions({
        knowledgeBaseId: knowledgeBase.knowledgeBase.id,
      });
      const workspace = await runtime.saveApplicationEnterpriseWorkspace({
        workspace: {
          name: 'Electron Local',
          type: 'local',
          config: {
            local: { path: 'E:\\\\electron-workspace', permission_mode: 'default' },
            docker: { image: 'ubuntu:22.04', daemon_url: '', container_id: '' },
            cloud: { host: '', port: 22, user: 'root', key_path: '' },
            sandbox: { image: 'openxnet/sandbox:latest', ttl_hours: 24 },
          },
        },
      });
      const project = await runtime.saveApplicationEnterpriseProject({
        project: {
          workspaceId: workspace.workspace.id,
          name: 'Electron 项目楼层',
          description: '真实 preload 楼层持久化验证',
          color: '#4ecdc4',
          icon: 'fa-solid fa-layer-group',
        },
      });
      const assignedRole = await runtime.saveApplicationEnterpriseRoleCard({
        mode: 'update',
        roleCard: {
          ...updatedRole.card,
          assignedWorkspace: workspace.workspace.id,
          projectId: project.project.id,
        },
      });
      const projects = await runtime.listApplicationEnterpriseProjects();
      const postedMessage = await runtime.postApplicationEnterpriseMessage({
        workspaceId: workspace.workspace.id,
        projectId: project.project.id,
        recipientIds: [assignedRole.card.id],
        content: '@Electron 企业架构师 请检查项目状态。',
        taskId: null,
        traceId: 'trace-electron-enterprise',
      });
      const messages = await runtime.listApplicationEnterpriseMessages({
        workspaceId: workspace.workspace.id,
        projectId: project.project.id,
        limit: 50,
      });
      await runtime.saveApplicationEnterpriseXnetService({
        serviceKey: 'dataops',
        url: ${JSON.stringify(`${healthUrl}/health`)},
        autoConnect: true,
      });
      const health = await runtime.checkApplicationEnterpriseXnetService({ serviceKey: 'dataops' });
      const services = await runtime.listApplicationEnterpriseXnetServices();
      const usage = await runtime.loadApplicationEnterpriseUsageDashboard({ groupBy: 'day', limit: 14 });
      const neuro = await runtime.loadApplicationEnterpriseNeuroDashboard({ limit: 100 });
      const search = await runtime.searchApplicationEnterpriseNeuroSymbols({ query: 'Electron', operator: 'CausalInfer', limit: 50 });
      const removedSymbol = await runtime.removeApplicationEnterpriseNeuroSymbol({ symbolId: 'electron-symbol' });
      const maintenance = await runtime.runApplicationEnterpriseNeuroMaintenance();
      const graph = await runtime.loadApplicationEnterpriseKnowledgeGraph({ limit: 200 });
      const entity = await runtime.queryApplicationEnterpriseKnowledgeGraphEntity({ subject: 'OpenXnet', limit: 50 });
      const skillBinding = await runtime.setApplicationEnterpriseSkillBinding({
        workspaceId: workspace.workspace.id,
        skillId: 'synapxnet-feature-drift-recovery',
        enabled: true,
        sourceIncidentId: 'inc-electron',
      });
      const skillBindings = await runtime.listApplicationEnterpriseSkillBindings();
      await runtime.removeApplicationEnterpriseProject({ projectId: project.project.id });
      const projectsAfterRemoval = await runtime.listApplicationEnterpriseProjects();
      await runtime.removeApplicationEnterpriseWorkspace({ workspaceId: workspace.workspace.id });
      const skillBindingsAfterRemoval = await runtime.listApplicationEnterpriseSkillBindings();
      await runtime.removeApplicationEnterpriseKnowledgeBase({ knowledgeBaseId: knowledgeBase.knowledgeBase.id });
      await runtime.removeApplicationEnterpriseRoleCard({ roleCardId: role.card.id });
      return {
        legacyWorkspaces, role, updatedRole, sandbox, knowledgeBase, versions, workspace,
        project, assignedRole, projects, postedMessage, messages, projectsAfterRemoval, health, services,
        usage, neuro, search, removedSymbol, maintenance, graph, entity,
        skillBinding, skillBindings, skillBindingsAfterRemoval,
      };
    })()
  `, true);
}

/** 运行真实 Electron Enterprise smoke；无输入，输出 JSON，typed IPC、兼容性或按需启动断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-smoke-"));
  const staticRoot = path.join(root, "ui");
  const userDataDirectory = path.join(root, "user-data");
  const versionRoot = path.join(userDataDirectory, "enterprise_kb_versions", "kb-electron");
  const generatedIds = [
    "role-electron", "kb-electron", "workspace-electron", "project-electron", "message-electron",
  ];
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  let cleanupInsightsIpc = null;
  let healthServerStarted = false;
  let insightsServerStarted = false;
  let backendActivations = 0;
  let healthRequests = 0;
  let insightAcquisitions = 0;
  let insightReleases = 0;
  const insightsToken = "electron-enterprise-insights-token";
  const insightRequests = [];
  const healthServer = http.createServer((_request, response) => {
    healthRequests += 1;
    response.writeHead(204);
    response.end();
  });
  const insightsServer = createInsightsServer(insightsToken, insightRequests);
  try {
    mkdirSync(staticRoot, { recursive: true });
    mkdirSync(versionRoot, { recursive: true });
    writeFileSync(
      path.join(staticRoot, "index.html"),
      "<!doctype html><html><body><main>Enterprise smoke</main></body></html>",
      "utf8",
    );
    writeFileSync(path.join(userDataDirectory, "workspaces.json"), JSON.stringify([{
      id: "legacy-workspace",
      name: "Legacy Docker",
      type: "docker",
      status: "stopped",
      config: {
        local: { path: "", permission_mode: "default" },
        docker: { image: "ubuntu:22.04", daemon_url: "" },
        cloud: { host: "", port: 22, user: "root", key_path: "" },
        sandbox: { image: "openxnet/sandbox:latest", ttl_hours: 24 },
      },
      role_card_id: null,
    }], null, 2), "utf8");
    writeFileSync(path.join(versionRoot, "v1.json"), JSON.stringify({
      version: 1,
      kb_name: "Electron 企业规范",
      doc_count: 7,
      created_at: "2026-07-29 12:00:00",
      snapshot_data: "must-not-cross-ipc",
    }), "utf8");
    seedUsageDatabase(path.join(userDataDirectory, "usage_tracking.db"));

    const healthOrigin = await listenLoopbackServer(healthServer);
    healthServerStarted = true;
    const insightsOrigin = await listenLoopbackServer(insightsServer);
    insightsServerStarted = true;
    const runtime = new ApplicationEnterpriseRuntimeService({
      userDataDirectory,
      createId: () => generatedIds.shift() || "unexpected-generated-id",
    });
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入，不返回，若被调用则累计次数并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Enterprise smoke must not activate the legacy backend.");
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
    cleanupIpc = registerApplicationEnterpriseRuntimeIpc({
      ipcMain,
      runtime,
      /** 授权 smoke 页面；输入 IPC 事件，无返回，非当前窗口发送者时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Enterprise smoke IPC sender is not authorized.");
      },
    });
    const insightsRuntime = new ApplicationEnterpriseInsightsRuntimeService({
      userDataDirectory,
      token: insightsToken,
      acquireEngine: async () => {
        insightAcquisitions += 1;
        return { origin: insightsOrigin, release: () => { insightReleases += 1; } };
      },
    });
    cleanupInsightsIpc = registerApplicationEnterpriseInsightsRuntimeIpc({
      ipcMain,
      runtime: insightsRuntime,
      /** 授权 Insights smoke 页面；输入 IPC 事件，无返回，非当前窗口发送者时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Enterprise Insights smoke IPC sender is not authorized.");
      },
    });
    await window.loadURL(origin);
    const result = await exerciseRenderer(window, healthOrigin);

    assert.equal(result.legacyWorkspaces.workspaces[0].config.docker.container_id, "");
    assert.equal(result.role.card.id, "role-electron");
    assert.equal(result.updatedRole.card.description, "真实 Electron 更新验证");
    assert.deepEqual(
      result.sandbox.agents.find((agent) => agent.id === "role-electron")?.position,
      { x: 6, y: 0, z: 9 },
    );
    assert.equal(result.knowledgeBase.knowledgeBase.id, "kb-electron");
    assert.equal(result.versions.versions.length, 1);
    assert.equal(Object.hasOwn(result.versions.versions[0], "snapshot_data"), false);
    assert.equal(result.workspace.workspace.id, "workspace-electron");
    assert.equal(result.project.project.id, "project-electron");
    assert.equal(result.projects.projects[0].floor, 1);
    assert.equal(result.postedMessage.message.id, "message-electron");
    assert.equal(result.postedMessage.message.senderType, "leader");
    assert.equal(result.messages.messages[0].traceId, "trace-electron-enterprise");
    assert.equal(result.messages.messages[0].mentions[0].roleCardId, "role-electron");
    assert.equal(result.projectsAfterRemoval.projects.length, 0);
    assert.equal(result.health.service.status, "online");
    assert.equal(result.services.services.dataops.status, "online");
    assert.equal(result.usage.summary.total_tokens, 42);
    assert.equal(result.neuro.stats.totalSymbols, 1);
    assert.equal(result.search.symbols[0].id, "electron-symbol");
    assert.equal(result.removedSymbol.symbolId, "electron-symbol");
    assert.equal(result.maintenance.result.decayed, 1);
    assert.equal(result.graph.graph.edges[0].label, "uses");
    assert.equal(result.entity.facts[0].object, "Electron");
    assert.equal(result.skillBinding.binding.enabled, true);
    assert.equal(result.skillBindings.bindings[0].sourceIncidentId, "inc-electron");
    assert.equal(result.skillBindingsAfterRemoval.bindings.length, 0);
    assert.equal(insightAcquisitions, 6);
    assert.equal(insightReleases, 6);
    assert.equal(insightRequests.length, 6);
    assert.equal(healthRequests, 1);
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      roleId: result.role.card.id,
      knowledgeBaseId: result.knowledgeBase.knowledgeBase.id,
      workspaceId: result.workspace.workspace.id,
      healthRequests,
      insightRequests: insightRequests.length,
      backendActivations,
    })}\n`);
  } finally {
    cleanupIpc?.();
    cleanupInsightsIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    if (healthServerStarted) await closeLoopbackServer(healthServer);
    if (insightsServerStarted) await closeLoopbackServer(insightsServer);
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
