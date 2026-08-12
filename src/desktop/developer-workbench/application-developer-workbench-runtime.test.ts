import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  LEGACY_RENDERER_STATE_SCHEMA,
  type LegacyRendererStateSnapshot,
} from "../contracts/legacy-renderer-state";
import { ApplicationDeveloperWorkbenchRuntimeService } from "./application-developer-workbench-runtime";

/** 测试用无密钥状态边界，记录 Runtime 的设置和会话写入。 */
class TestStateBoundary {
  public settings: Record<string, unknown>;
  public conversations: readonly Readonly<Record<string, unknown>>[];

  /** 创建可变测试状态；输入设置和会话，仅保存内存引用，不访问磁盘。 */
  public constructor(
    settings: Record<string, unknown>,
    conversations: readonly Readonly<Record<string, unknown>>[] = [],
  ) {
    this.settings = settings;
    this.conversations = conversations;
  }

  /** 返回当前测试快照；无输入，返回独立 JSON 值，无副作用。 */
  public getSnapshot(): LegacyRendererStateSnapshot {
    return {
      schema: LEGACY_RENDERER_STATE_SCHEMA,
      settingsRevision: 0,
      conversationsRevision: 0,
      generatedAt: "2026-07-29T12:00:00.000Z",
      settings: JSON.parse(JSON.stringify(this.settings)),
      conversations: JSON.parse(JSON.stringify(this.conversations)),
    };
  }

  /** 保存测试设置；输入精确请求，返回更新快照，非法请求时抛错。 */
  public saveSettings(request: unknown): LegacyRendererStateSnapshot {
    assert.ok(request && typeof request === "object" && !Array.isArray(request));
    this.settings = JSON.parse(JSON.stringify((request as { settings: unknown }).settings));
    return this.getSnapshot();
  }

  /** 保存测试会话；输入精确请求，返回更新快照，非法请求时抛错。 */
  public saveConversations(request: unknown): LegacyRendererStateSnapshot {
    assert.ok(request && typeof request === "object" && !Array.isArray(request));
    this.conversations = JSON.parse(JSON.stringify((request as { conversations: unknown }).conversations));
    return this.getSnapshot();
  }
}

/** 创建覆盖 Runtime 主要功能的无密钥设置。 */
function createSettings(workspaceDirectory: string): Record<string, unknown> {
  return {
    CLISettings: {
      enabled: true,
      engine: "local",
      cc_path: workspaceDirectory,
      visibilityScope: "workspace",
    },
    localEnvSettings: { permissionMode: "plan" },
    selectedProvider: "provider-1",
    model: "agent-1",
    modelProviders: [{
      id: "provider-1",
      vendor: "OpenAI",
      url: "https://provider.example.test/v1",
      modelId: "agent-1",
      models: ["agent-1"],
      apiKeyConfigured: true,
      api_key: "",
    }],
    agents: { "agent-1": { name: "Coder" }, "agent-2": { name: "Reviewer" } },
    mainAgent: "agent-1",
    memories: [{ id: "memory-1", name: "Role" }],
    mcpServers: { docs: { disabled: true, tokenConfigured: true } },
    extensions: [{ id: "extension-1" }],
  };
}

test("Developer Workbench Runtime reads overview and scans only the Main-owned workspace", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-dev-workbench-"));
  const workspace = path.join(directory, "workspace");
  const alternateWorkspace = path.join(directory, "alternate");
  mkdirSync(path.join(workspace, "src"), { recursive: true });
  mkdirSync(path.join(workspace, "node_modules", "ignored"), { recursive: true });
  mkdirSync(alternateWorkspace, { recursive: true });
  writeFileSync(path.join(workspace, "src", "main.ts"), "export const hello = 'world';\nconst API_KEY = 'secret';\n", "utf8");
  writeFileSync(path.join(workspace, "node_modules", "ignored", "secret.ts"), "hello", "utf8");
  const state = new TestStateBoundary(createSettings(workspace));
  const runtime = new ApplicationDeveloperWorkbenchRuntimeService({
    userDataDirectory: path.join(directory, "user-data"),
    applicationName: "OpenXnet",
    applicationVersion: "1.0.2",
    state,
    tasks: {
      listTasks: async () => ({
        schema: "openxnet.application-tasks.v1",
        catalogRevision: 1,
        generatedAt: "2026-07-29T12:00:00.000Z",
        tasks: [],
      }),
    },
  });
  try {
    const overview = await runtime.getOverview();
    assert.equal(overview.workspace.exists, true);
    assert.equal(overview.runtime_profile.user_data_dir, "");
    assert.equal(overview.plugin_count, 1);
    assert.equal(overview.templates.length, 4);

    const repositories = await runtime.listRepositories();
    assert.equal(repositories.repos.length, 1);
    assert.equal(repositories.repos[0]?.files, 1);
    assert.match(repositories.repos[0]?.langs ?? "", /TypeScript/);

    const search = await runtime.searchCode({ query: "hello", maxResults: 10 });
    assert.equal(search.results[0]?.file, "src/main.ts");
    assert.equal(search.results.some((item) => item.file.includes("node_modules")), false);
    const sensitive = await runtime.searchCode({ query: "API_KEY", maxResults: 10 });
    assert.equal(sensitive.results.find((item) => item.matchType === "content")?.preview, "[redacted sensitive line]");
    await assert.rejects(
      runtime.searchCode({ query: "hello", maxResults: 10, root: directory }),
      /invalid/,
    );

    const applied = await runtime.applyWorkspace({
      workspaceDirectory: alternateWorkspace,
      permissionMode: "auto-approve",
      enabled: true,
      engine: "local",
      visibilityScope: "workspace",
    });
    assert.equal(applied.workspaceDirectory, realpathSync.native(alternateWorkspace));
    assert.equal((state.settings.CLISettings as { cc_path: string }).cc_path, realpathSync.native(alternateWorkspace));
    assert.equal((state.settings.localEnvSettings as { permissionMode: string }).permissionMode, "auto-approve");

    const mapping = await runtime.applyMapping({ agentId: "agent-2", syncProviderModel: true });
    assert.equal(mapping.model, "agent-2");
    assert.equal(state.settings.mainAgent, "agent-2");
    await assert.rejects(
      runtime.applyMapping({ agentId: "missing", syncProviderModel: true }),
      /not found/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Developer Workbench Runtime creates, restores, imports, and deletes credential-free snapshots", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-dev-snapshot-"));
  const workspace = path.join(directory, "workspace");
  mkdirSync(workspace, { recursive: true });
  const state = new TestStateBoundary(createSettings(workspace), [{ id: "conversation-1", title: "Chat" }]);
  const runtime = new ApplicationDeveloperWorkbenchRuntimeService({
    userDataDirectory: path.join(directory, "user-data"),
    applicationName: "OpenXnet",
    applicationVersion: "1.0.2",
    state,
    tasks: { listTasks: async () => ({
      schema: "openxnet.application-tasks.v1",
      catalogRevision: 0,
      generatedAt: "2026-07-29T12:00:00.000Z",
      tasks: [],
    }) },
    now: () => new Date("2026-07-29T12:00:00.000Z"),
  });
  try {
    const created = await runtime.createSnapshot({
      name: "Baseline",
      includeRoles: true,
      includeChats: true,
      includeTools: true,
      includeSkills: false,
    });
    assert.equal(created.snapshot.name, "Baseline");
    const snapshotPath = path.join(directory, "user-data", "dev_workbench_snapshots", `${created.snapshot.id}.json`);
    assert.equal(existsSync(snapshotPath), true);
    const document = await runtime.getSnapshot({ snapshotId: created.snapshot.id });
    assert.equal(JSON.stringify(document.snapshot).includes("api_key"), false);
    assert.equal(JSON.stringify(document.snapshot).includes("secret"), false);

    state.settings.mainAgent = "agent-2";
    state.conversations = [];
    await runtime.restoreSnapshot({ snapshotId: created.snapshot.id });
    assert.equal(state.settings.mainAgent, "agent-1");
    assert.equal(state.conversations[0]?.id, "conversation-1");

    assert.throws(
      () => runtime.importSnapshot({
        name: "Unsafe",
        snapshot: { settings: { access_token: "plaintext-secret" } },
      }),
      /credential fields/,
    );
    const imported = await runtime.importSnapshot({
      name: "Imported",
      snapshot: { agents: { "agent-3": { name: "Imported Agent" } } },
    });
    const listed = await runtime.listSnapshots();
    assert.equal(listed.snapshots.length, 2);
    await runtime.deleteSnapshot({ snapshotId: imported.snapshot.id });
    assert.equal((await runtime.listSnapshots()).snapshots.length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
