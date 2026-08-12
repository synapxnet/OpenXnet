"use strict";

const assert = require("node:assert/strict");
const {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationDeveloperWorkbenchRuntimeService,
  LocalUiGateway,
  registerApplicationDeveloperWorkbenchRuntimeIpc,
} = require("../build-ts/desktop");

/** Developer Workbench smoke 使用的内存状态边界。 */
class SmokeStateBoundary {
  /** 创建无密钥状态；输入初始设置，仅保留 JSON 副本，不访问磁盘。 */
  constructor(settings) {
    this.settings = JSON.parse(JSON.stringify(settings));
    this.conversations = [{ id: "conversation-smoke", title: "工作台 smoke" }];
  }

  /** 读取当前状态；无输入，返回独立 JSON 快照，无副作用或失败分支。 */
  getSnapshot() {
    return {
      schema: "openxnet.legacy-renderer-state.v1",
      settingsRevision: 0,
      conversationsRevision: 0,
      generatedAt: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(this.settings)),
      conversations: JSON.parse(JSON.stringify(this.conversations)),
    };
  }

  /** 保存设置；输入精确替换请求，返回更新快照，缺少设置对象时抛错且不修改状态。 */
  saveSettings(request) {
    assert.ok(request?.settings && typeof request.settings === "object");
    this.settings = JSON.parse(JSON.stringify(request.settings));
    return this.getSnapshot();
  }

  /** 保存会话；输入精确替换请求，返回更新快照，缺少会话数组时抛错且不修改状态。 */
  saveConversations(request) {
    assert.ok(Array.isArray(request?.conversations));
    this.conversations = JSON.parse(JSON.stringify(request.conversations));
    return this.getSnapshot();
  }
}

/** 构造 smoke 的无密钥设置；输入工作区路径，返回可覆盖概览、映射和快照的设置对象。 */
function createSmokeSettings(workspaceDirectory) {
  return {
    CLISettings: {
      enabled: true,
      engine: "local",
      cc_path: workspaceDirectory,
      visibilityScope: "workspace",
    },
    localEnvSettings: { permissionMode: "plan" },
    selectedProvider: "provider-smoke",
    model: "agent-smoke-1",
    modelProviders: [{
      id: "provider-smoke",
      vendor: "OpenAI",
      url: "https://provider.example.test/v1",
      modelId: "agent-smoke-1",
      models: ["agent-smoke-1", "agent-smoke-2"],
      apiKeyConfigured: true,
    }],
    agents: {
      "agent-smoke-1": { name: "开发 Agent" },
      "agent-smoke-2": { name: "审查 Agent" },
    },
    mainAgent: "agent-smoke-1",
    memories: [{ id: "role-smoke", name: "开发角色" }],
    mcpServers: { docs: { disabled: true, tokenConfigured: true } },
    extensions: [{ id: "extension-smoke" }],
  };
}

/** 返回空任务目录；无输入，返回符合 Core schema 的 Promise，不触发能力或 Python。 */
async function listSmokeTasks() {
  return {
    schema: "openxnet.application-tasks.v1",
    catalogRevision: 0,
    generatedAt: new Date().toISOString(),
    tasks: [],
  };
}

/**
 * 在真实 preload 中执行工作台生命周期；输入隐藏窗口和授权目录，返回公开结果，任一 IPC 失败时拒绝 Promise。
 */
async function exerciseRendererWorkbench(window, authorizedWorkspace) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const overview = await runtime.getApplicationDeveloperWorkbenchOverview();
      const repositories = await runtime.listApplicationDeveloperWorkbenchRepositories();
      const search = await runtime.searchApplicationDeveloperWorkbenchCode({ query: 'workbenchSmoke', maxResults: 10 });
      const sensitive = await runtime.searchApplicationDeveloperWorkbenchCode({ query: 'API_KEY', maxResults: 10 });
      const created = await runtime.createApplicationDeveloperWorkbenchSnapshot({
        name: 'Electron 工作台快照',
        includeRoles: true,
        includeChats: true,
        includeTools: true,
        includeSkills: false,
      });
      const document = await runtime.getApplicationDeveloperWorkbenchSnapshot({
        snapshotId: created.snapshot.id,
      });
      const mapping = await runtime.applyApplicationDeveloperWorkbenchMapping({
        agentId: 'agent-smoke-2',
        syncProviderModel: true,
      });
      const restored = await runtime.restoreApplicationDeveloperWorkbenchSnapshot({
        snapshotId: created.snapshot.id,
      });
      const imported = await runtime.importApplicationDeveloperWorkbenchSnapshot({
        name: '导入快照',
        snapshot: { settings: { agents: { imported: { name: 'Imported' } } } },
      });
      let credentialRejected = false;
      try {
        await runtime.importApplicationDeveloperWorkbenchSnapshot({
          name: '拒绝密钥',
          snapshot: { settings: { api_token: 'must-not-persist' } },
        });
      } catch {
        credentialRejected = true;
      }
      await runtime.deleteApplicationDeveloperWorkbenchSnapshot({ snapshotId: imported.snapshot.id });
      await runtime.deleteApplicationDeveloperWorkbenchSnapshot({ snapshotId: created.snapshot.id });
      const workspace = await runtime.applyApplicationDeveloperWorkbenchWorkspace({
        workspaceDirectory: ${JSON.stringify(authorizedWorkspace)},
        permissionMode: 'auto-approve',
        enabled: true,
        engine: 'local',
        visibilityScope: 'workspace',
      });
      return {
        overview,
        repositories,
        search,
        sensitive,
        created,
        document,
        mapping,
        restored,
        credentialRejected,
        workspace,
      };
    })()
  `, true);
}

/**
 * 运行真实 Electron Developer Workbench smoke；无输入，输出 JSON，边界或按需启动断言失败时抛错。
 */
async function runApplicationDeveloperWorkbenchSmoke() {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "openxnet-workbench-smoke-"));
  const staticRoot = path.join(temporaryRoot, "ui");
  const initialWorkspace = path.join(temporaryRoot, "初始工作区");
  const authorizedWorkspace = path.join(temporaryRoot, "授权工作区");
  const userDataDirectory = path.join(temporaryRoot, "user-data");
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  let backendActivations = 0;
  try {
    mkdirSync(staticRoot, { recursive: true });
    mkdirSync(path.join(initialWorkspace, "src"), { recursive: true });
    mkdirSync(authorizedWorkspace, { recursive: true });
    writeFileSync(
      path.join(staticRoot, "index.html"),
      "<!doctype html><html><body><main>Developer Workbench smoke</main></body></html>",
      "utf8",
    );
    writeFileSync(
      path.join(initialWorkspace, "src", "源码.ts"),
      "export const workbenchSmoke = '中文';\nconst API_KEY = 'must-redact';\n",
      "utf8",
    );
    const state = new SmokeStateBoundary(createSmokeSettings(initialWorkspace));
    const runtime = new ApplicationDeveloperWorkbenchRuntimeService({
      userDataDirectory,
      applicationName: "OpenXnet",
      applicationVersion: "1.0.2",
      state,
      tasks: { listTasks: listSmokeTasks },
    });
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Developer Workbench smoke must not activate the legacy backend.");
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
    cleanupIpc = registerApplicationDeveloperWorkbenchRuntimeIpc({
      ipcMain,
      runtime,
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) {
          throw new Error("Developer Workbench smoke IPC sender is not authorized.");
        }
      },
      authorizeWorkspacePath: (event, candidatePath) => {
        if (event?.sender !== window?.webContents || path.resolve(candidatePath) !== path.resolve(authorizedWorkspace)) {
          throw new Error("Developer Workbench smoke workspace is not authorized.");
        }
      },
    });
    await window.loadURL(origin);
    const result = await exerciseRendererWorkbench(window, authorizedWorkspace);
    assert.equal(result.overview.workspace.exists, true);
    assert.equal(result.repositories.repos.length, 1);
    assert.equal(result.search.results.some((item) => item.file === "src/源码.ts"), true);
    assert.equal(
      result.sensitive.results.find((item) => item.matchType === "content")?.preview,
      "[redacted sensitive line]",
    );
    assert.equal(JSON.stringify(result.document.snapshot).includes("must-redact"), false);
    assert.equal(result.mapping.model, "agent-smoke-2");
    assert.equal(state.settings.mainAgent, "agent-smoke-1");
    assert.equal(result.credentialRejected, true);
    assert.equal(
      path.resolve(result.workspace.workspaceDirectory),
      path.resolve(realpathSync.native(authorizedWorkspace)),
    );
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      repositoryFiles: result.repositories.repos[0].files,
      searchFile: result.search.results[0]?.file || "",
      credentialRejected: result.credentialRejected,
      backendActivations,
    })}\n`);
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/** 等待 Electron 就绪并运行 smoke；无输入和返回，失败时打印堆栈并以非零状态退出。 */
async function main() {
  try {
    await app.whenReady();
    await runApplicationDeveloperWorkbenchSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
