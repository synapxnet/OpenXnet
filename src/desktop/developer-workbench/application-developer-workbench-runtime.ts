import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import {
  lstat,
  opendir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
  MAX_DEVELOPER_WORKBENCH_SNAPSHOT_BYTES,
  parseApplyDeveloperWorkbenchMappingRequest,
  parseApplyDeveloperWorkbenchWorkspaceRequest,
  parseCreateDeveloperWorkbenchSnapshotRequest,
  parseDeveloperWorkbenchCodeSearchRequest,
  parseDeveloperWorkbenchSnapshotRequest,
  parseImportDeveloperWorkbenchSnapshotRequest,
  type ApplyDeveloperWorkbenchMappingResult,
  type ApplyDeveloperWorkbenchWorkspaceResult,
  type CreateDeveloperWorkbenchSnapshotRequest,
  type DeveloperWorkbenchCodeSearchMatch,
  type DeveloperWorkbenchCodeSearchResult,
  type DeveloperWorkbenchOverview,
  type DeveloperWorkbenchRepositoriesResult,
  type DeveloperWorkbenchRepository,
  type DeveloperWorkbenchSnapshotDocumentResult,
  type DeveloperWorkbenchSnapshotInclude,
  type DeveloperWorkbenchSnapshotListResult,
  type DeveloperWorkbenchSnapshotMutationResult,
  type DeveloperWorkbenchSnapshotSummary,
  type DeveloperWorkbenchSnapshotWriteResult,
  type ImportDeveloperWorkbenchSnapshotRequest,
} from "../contracts/application-developer-workbench-runtime";
import type { ApplicationTask, ApplicationTaskSnapshot } from "../contracts/application-tasks";
import type { LegacyRendererStateSnapshot } from "../contracts/legacy-renderer-state";

const MAX_REPOSITORY_FILES = 200_000;
const MAX_SEARCH_FILES = 50_000;
const MAX_SEARCH_FILE_BYTES = 1024 * 1024;
const MAX_SEARCH_TOTAL_BYTES = 256 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 15_000;
const MAX_SNAPSHOT_COUNT = 500;
const SENSITIVE_KEY_PATTERN = /(api.?key|authorization|cookie|password|secret|token)/i;
const SENSITIVE_LINE_PATTERN = /(api.?key|authorization|cookie|password|secret|token)\s*[:=]/i;
const SNAPSHOT_FILE_PATTERN = /^snap_[A-Za-z0-9_.-]{1,120}\.json$/;
const IGNORE_DIRECTORIES = new Set([
  ".agent",
  ".git",
  ".hg",
  ".svn",
  ".venv",
  "__pycache__",
  ".cache",
  ".next",
  ".nuxt",
  "build",
  "dev_workbench_snapshots",
  "dist",
  "node_modules",
  "release",
  "uploaded_files",
  "venv",
]);
const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  ".c": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".cs": "C#",
  ".css": "CSS",
  ".go": "Go",
  ".h": "C/C++",
  ".hpp": "C++",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".json": "JSON",
  ".jsx": "JavaScript",
  ".md": "Markdown",
  ".mjs": "JavaScript",
  ".py": "Python",
  ".rs": "Rust",
  ".scss": "SCSS",
  ".sql": "SQL",
  ".toml": "TOML",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".txt": "Text",
  ".vue": "Vue",
  ".xml": "XML",
  ".yaml": "YAML",
  ".yml": "YAML",
});
const SEARCH_TEXT_EXTENSIONS = new Set([
  "", ".bat", ".c", ".cc", ".cfg", ".conf", ".cpp", ".cs", ".css", ".go",
  ".h", ".hpp", ".html", ".ini", ".java", ".js", ".json", ".jsx", ".log",
  ".md", ".mjs", ".ps1", ".py", ".rs", ".sh", ".sql", ".toml", ".ts",
  ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
]);

/** Developer Workbench 读取和更新无密钥兼容状态所需的最小边界。 */
export interface DeveloperWorkbenchStateBoundary {
  getSnapshot(): LegacyRendererStateSnapshot;
  saveSettings(request: unknown): LegacyRendererStateSnapshot;
  saveConversations(request: unknown): LegacyRendererStateSnapshot;
}

/** Developer Workbench Runtime 的依赖。 */
export interface ApplicationDeveloperWorkbenchRuntimeOptions {
  readonly userDataDirectory: string;
  readonly applicationName: string;
  readonly applicationVersion: string;
  readonly state: DeveloperWorkbenchStateBoundary;
  readonly tasks: {
    listTasks(request?: unknown): Promise<ApplicationTaskSnapshot>;
  };
  readonly now?: () => Date;
}

interface WorkspaceContext {
  readonly enabled: boolean;
  readonly engine: string;
  readonly workspaceDirectory: string;
  readonly workspaceName: string;
  readonly permissionMode: string;
  readonly normalizedPermissionMode: string;
  readonly visibilityScope: string;
  readonly collaborationEnabled: boolean;
}

interface StoredSnapshotDocument extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly schema_version: number;
  readonly app_version: string;
  readonly created_at: string;
  readonly include: DeveloperWorkbenchSnapshotInclude;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly settings: Readonly<Record<string, unknown>>;
}

/** 判断未知值是否为普通对象；输入任意值，返回类型保护，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把未知值收敛为普通对象；输入任意值，返回对象或空对象，无副作用。 */
function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return isRecord(value) ? value : {};
}

/** 把未知数组收敛为普通对象数组；输入任意值，返回过滤后的数组，无副作用。 */
function asRecordArray(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** 深度克隆一个有界 JSON 对象；输入对象和字节预算，返回独立副本，超限或不可序列化时抛错。 */
function cloneJsonRecord(
  value: Readonly<Record<string, unknown>>,
  maximumBytes = MAX_DEVELOPER_WORKBENCH_SNAPSHOT_BYTES,
): Record<string, unknown> {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new Error("Developer Workbench state exceeds its byte budget.");
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

/** 删除快照中的凭据字段；输入任意 JSON 值，返回深度克隆的无密钥值，不修改原对象。 */
function stripCredentialFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCredentialFields);
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
    if (SENSITIVE_KEY_PATTERN.test(normalizedKey) && !/configured$/i.test(normalizedKey)) continue;
    result[key] = stripCredentialFields(item);
  }
  return result;
}

/** 拒绝存量快照中的凭据字段；输入任意 JSON 值和深度，无返回，发现密钥或异常深度时抛错。 */
function assertCredentialFreeStoredValue(value: unknown, depth = 0): void {
  if (depth > 12) throw new Error("Developer Workbench snapshot structure is too deep.");
  if (Array.isArray(value)) {
    value.forEach((item) => assertCredentialFreeStoredValue(item, depth + 1));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
    if (SENSITIVE_KEY_PATTERN.test(normalizedKey) && !/configured$/i.test(normalizedKey)) {
      throw new Error("Developer Workbench snapshot contains credential fields.");
    }
    assertCredentialFreeStoredValue(item, depth + 1);
  }
}

/** 读取一个字符串字段；输入对象、字段和默认值，返回去空格文本，无副作用。 */
function readText(
  value: Readonly<Record<string, unknown>>,
  field: string,
  fallback = "",
): string {
  return typeof value[field] === "string" ? value[field].trim() : fallback;
}

/** 标准化 CLI 权限别名；输入权限名，返回执行策略名称，无副作用。 */
function normalizePermissionMode(permissionMode: string): string {
  const aliases: Readonly<Record<string, string>> = Object.freeze({
    acceptEdits: "auto-approve",
    "auto-edit": "auto-approve",
    bypassPermissions: "yolo",
    cowork: "yolo",
  });
  return aliases[permissionMode] ?? permissionMode;
}

/** 返回指定 CLI 引擎使用的设置字段；输入引擎名，返回字段名，无副作用。 */
function getEngineSettingsField(engine: string): string {
  const fields: Readonly<Record<string, string>> = Object.freeze({
    local: "localEnvSettings",
    ds: "dsSettings",
    cc: "ccSettings",
    qc: "qcSettings",
    oc: "ocSettings",
  });
  return fields[engine] ?? "localEnvSettings";
}

/** 从无密钥设置读取工作区上下文；输入设置，返回标准上下文，不访问文件系统。 */
function getWorkspaceContext(settings: Readonly<Record<string, unknown>>): WorkspaceContext {
  const cliSettings = asRecord(settings.CLISettings);
  const engine = readText(cliSettings, "engine", "local") || "local";
  const engineSettings = asRecord(settings[getEngineSettingsField(engine)]);
  const permissionMode = readText(engineSettings, "permissionMode", "default") || "default";
  const workspaceDirectory = readText(cliSettings, "cc_path");
  return {
    enabled: cliSettings.enabled === true,
    engine,
    workspaceDirectory,
    workspaceName: workspaceDirectory ? path.basename(workspaceDirectory) : "",
    permissionMode,
    normalizedPermissionMode: normalizePermissionMode(permissionMode),
    visibilityScope: readText(cliSettings, "visibilityScope", "workspace") || "workspace",
    collaborationEnabled: permissionMode === "cowork",
  };
}

/** 把字节数格式化为稳定摘要；输入非负字节数，返回 B/KB/MB/GB 文本，无副作用。 */
function formatBytes(size: number): string {
  let value = Math.max(0, Number.isFinite(size) ? size : 0);
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return index === 0 ? `${Math.trunc(value)} ${units[index]}` : `${value.toFixed(1)} ${units[index]}`;
}

/** 让出一次事件循环，避免大目录扫描连续占用 Main；无输入，返回下一轮 Promise，无其他副作用。 */
function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** 返回开发任务模板；无输入，返回只读固定模板，不读取磁盘或设置。 */
function getDeveloperWorkbenchTemplates(): readonly Readonly<Record<string, unknown>>[] {
  return [
    {
      id: "plan",
      label: "Plan",
      description: "先梳理现状、相关文件和实施步骤，避免直接重复开发。",
      requires_write: false,
      suggested_goal: "梳理当前功能现状、相关文件与菜单入口，给出明确实施计划。",
      suggested_acceptance: ["列出相关文件、接口和 UI 入口", "给出分步实施方案和影响范围", "说明风险、依赖和验证路径"],
      suggested_constraints: ["先阅读现有实现，避免重复开发", "以审视和规划为主，不要先做大范围改动"],
      execution_notes: ["优先梳理当前工作区里的现有实现、菜单入口和数据流。", "明确说明哪些能力已经存在，哪些只是部分完成。"],
      output_requirement: "输出一份结构化实施计划，明确文件范围、步骤、风险和验证点。",
    },
    {
      id: "review",
      label: "Review",
      description: "以代码审查视角找问题，优先发现 bug、回归风险和测试缺口。",
      requires_write: false,
      suggested_goal: "审查当前实现，识别 bug、回归风险、权限问题和测试空白。",
      suggested_acceptance: ["按严重程度列出主要发现", "指出潜在回归、数据一致性或权限风险", "说明缺失测试或验证空白"],
      suggested_constraints: ["以 findings-first 方式输出，不要先写长总结", "除非任务特别要求，否则不要直接改动源码"],
      execution_notes: ["从功能行为、边界条件、权限控制和状态一致性几个角度审查。", "优先输出高风险问题，再列出中低风险项和测试缺口。"],
      output_requirement: "输出审查发现清单，按严重程度排序，并附上风险说明与建议验证项。",
    },
    {
      id: "diff",
      label: "Diff",
      description: "聚焦变更对比，梳理当前实现与目标之间的差异和缺口。",
      requires_write: false,
      suggested_goal: "比较目标文件、相关模块或历史轨迹，归纳当前差异与待补齐项。",
      suggested_acceptance: ["说明主要差异点和影响范围", "指出功能缺口、菜单缺口或实现不一致处", "给出建议下一步行动"],
      suggested_constraints: ["优先结合工作区现状、任务轨迹和检查点来分析", "输出应突出差异而不是重复罗列无关内容"],
      execution_notes: ["尽量基于目标文件、相关模块、任务轨迹或检查点来定位差异。", "最终结果要指出哪些差异需要修复，哪些属于预期变化。"],
      output_requirement: "输出差异分析报告，包含差异点、影响范围、缺口和建议下一步。",
    },
    {
      id: "patch",
      label: "Patch",
      description: "执行最小必要修改并完成验证，形成可继续集成的补丁结果。",
      requires_write: true,
      suggested_goal: "在最小必要范围内修改现有实现，完成验证并总结改动结果。",
      suggested_acceptance: ["完成最小必要代码修改", "说明改动文件与验证结果", "指出剩余风险和后续建议"],
      suggested_constraints: ["优先沿用现有模式，不要重造平行实现", "修改后要进行必要验证并记录结果"],
      execution_notes: ["先确认现有实现和目标缺口，再进行最小必要修改。", "优先复用已有接口、组件和任务能力，避免重复造轮子。"],
      output_requirement: "输出补丁结果说明，包含改动点、验证结论、残余风险与后续建议。",
    },
  ];
}

/** 把 Core 任务转换为工作台旧卡片结构；输入任务，返回无路径执行细节的摘要，无副作用。 */
function mapTaskForWorkbench(task: ApplicationTask): Readonly<Record<string, unknown>> {
  const details = asRecord(task.details);
  return {
    task_id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    progress: task.progress,
    priority: task.priority,
    agent_type: task.agentType,
    workflow_kind: readText(details, "workflowKind"),
    created_from: task.source,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    is_resumable: task.status === "failed" || task.status === "cancelled",
  };
}

/** Main 持有的 Developer Workbench 本地状态、快照和工作区检查边界。 */
export class ApplicationDeveloperWorkbenchRuntimeService {
  private readonly userDataDirectory: string;
  private readonly snapshotDirectory: string;
  private readonly now: () => Date;
  private operationQueue: Promise<void> = Promise.resolve();

  /** 创建 Runtime；输入用户目录、应用元数据、状态和任务边界，不读取磁盘或启动 Python。 */
  public constructor(private readonly options: ApplicationDeveloperWorkbenchRuntimeOptions) {
    this.userDataDirectory = path.resolve(options.userDataDirectory);
    this.snapshotDirectory = path.join(this.userDataDirectory, "dev_workbench_snapshots");
    this.now = options.now ?? (() => new Date());
  }

  /** 读取开发工作台概览；无输入，返回无密钥状态与 Core 任务摘要，不扫描文件内容或启动 Python。 */
  public async getOverview(): Promise<DeveloperWorkbenchOverview> {
    const state = this.options.state.getSnapshot();
    const settings = state.settings;
    const context = getWorkspaceContext(settings);
    const workspaceExists = await this.isDirectory(context.workspaceDirectory);
    const taskSnapshot = workspaceExists
      ? await this.options.tasks.listTasks({ workspacePath: context.workspaceDirectory })
      : { tasks: [] as readonly ApplicationTask[] };
    const tasks = taskSnapshot.tasks;
    const developerTasks = tasks.filter((task) => task.source === "developer_workbench" || readText(asRecord(task.details), "workflowKind"));
    const providers = asRecordArray(settings.modelProviders);
    const selectedProviderId = String(settings.selectedProvider ?? "").trim();
    const selectedProvider = providers.find((provider) => String(provider.id ?? "").trim() === selectedProviderId);
    const agents = asRecord(settings.agents);
    const agentOptions = Object.entries(agents).slice(0, 1_000).map(([id, value]) => ({
      id,
      name: readText(asRecord(value), "name", id) || id,
    }));
    const mainAgent = String(settings.mainAgent ?? "").trim();
    const providerConfigured = Boolean(selectedProviderId && selectedProvider);
    const mappingConfigured = Boolean(mainAgent && Object.hasOwn(agents, mainAgent));
    const writeEnabled = !["default", "plan"].includes(context.normalizedPermissionMode);
    const warnings = [
      !context.workspaceDirectory ? "尚未配置 CLI 工作区，开发工作台只能显示环境概览。" : "",
      context.workspaceDirectory && !workspaceExists ? "当前 CLI 工作区路径不存在，请先检查路径配置。" : "",
      !context.enabled ? "CLI 当前未启用，结构化开发任务无法进入真实工作区执行。" : "",
      !writeEnabled ? "当前权限模式偏只读，Plan / Review / Diff 更合适。" : "",
      !providerConfigured ? "当前未选择有效的模型 Provider。" : "",
      !mappingConfigured ? "当前默认 Agent 映射未就绪。" : "",
    ].filter(Boolean);
    const readinessItems = [
      { id: "profile", status: "ready", summary: "Desktop typed Runtime", detail: "Developer Workbench 不依赖 Python。" },
      { id: "provider", status: providerConfigured ? "ready" : "blocked", summary: providerConfigured ? "Provider 已配置" : "Provider 未配置", detail: "" },
      { id: "mapping", status: mappingConfigured ? "ready" : "warning", summary: mappingConfigured ? "Agent 映射已配置" : "Agent 映射需检查", detail: "" },
      { id: "workspace", status: workspaceExists ? "ready" : "blocked", summary: workspaceExists ? "工作区可用" : "工作区不可用", detail: "" },
      { id: "permission", status: writeEnabled ? "ready" : "warning", summary: context.permissionMode, detail: "" },
    ];
    const blockedCount = readinessItems.filter((item) => item.status === "blocked").length;
    const warningCount = readinessItems.filter((item) => item.status === "warning").length;
    const overallStatus = blockedCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "ready";
    const providerOptions = providers.slice(0, 500).map((provider) => ({
      id: provider.id ?? "",
      vendor: provider.vendor ?? "",
      url: provider.url ?? "",
      modelId: provider.modelId ?? "",
      models: Array.isArray(provider.models) ? provider.models.slice(0, 500) : [],
      hasApiKey: provider.apiKeyConfigured === true || provider.api_key_configured === true,
    }));
    return {
      schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
      workspace: { path: context.workspaceDirectory, name: context.workspaceName, exists: workspaceExists },
      cli: {
        enabled: context.enabled,
        engine: context.engine,
        permissionMode: context.permissionMode,
        normalizedPermissionMode: context.normalizedPermissionMode,
        visibilityScope: context.visibilityScope,
        toolCount: 0,
        toolNames: [],
      },
      runtime_profile: { profile: "desktop", app_name: this.options.applicationName, user_data_dir: "" },
      configuration_readiness: {
        overall_status: overallStatus,
        blocked_count: blockedCount,
        warning_count: warningCount,
        next_step: warnings[0] ?? "",
        items: readinessItems,
      },
      configuration_assistant: {
        provider_setup: {
          status: providerConfigured ? "ready" : "blocked",
          blocked: !providerConfigured,
          warning: false,
          message: providerConfigured ? "" : "请先配置模型 Provider。",
          selected_provider_id: selectedProviderId || null,
          current_vendor: selectedProvider?.vendor ?? "",
          current_model: selectedProvider?.modelId ?? settings.model ?? "",
          current_base_url: selectedProvider?.url ?? settings.base_url ?? "",
          api_key_configured: selectedProvider?.apiKeyConfigured === true,
          provider_options: providerOptions,
        },
        gateway_provider_setup: {
          enabled: false,
          reachable: false,
          status: "ready",
          blocked: false,
          warning: false,
          message: "",
          selected_provider_id: null,
          current_vendor: "",
          current_model: "",
          current_base_url: "",
          api_key_configured: false,
          provider_options: [],
          profile: "server",
          app_name: "OpenXnet-Server",
          user_data_dir: "",
          management_url: "",
        },
        mapping_setup: {
          status: mappingConfigured ? "ready" : "warning",
          blocked: false,
          warning: !mappingConfigured,
          message: mappingConfigured ? "" : "请选择默认 Agent 映射。",
          is_local_gateway: false,
          current_model: settings.model ?? "",
          current_main_agent: mainAgent,
          provider_models: Array.isArray(selectedProvider?.models) ? selectedProvider.models.slice(0, 500) : [],
          available_agents: agentOptions.map((item) => item.id),
          agent_options: agentOptions,
          resolved_model: settings.model ?? "",
          resolution_source: mappingConfigured ? "desktop_settings" : "",
        },
        workspace_setup: {
          status: workspaceExists ? "ready" : "blocked",
          blocked: !workspaceExists,
          warning: false,
          message: workspaceExists ? "" : "请选择存在的工作区目录。",
          enabled: context.enabled,
          engine: context.engine,
          workspace_dir: context.workspaceDirectory,
          workspace_exists: workspaceExists,
          permission_mode: context.permissionMode,
          normalized_permission_mode: context.normalizedPermissionMode,
          visibility_scope: context.visibilityScope,
          recommended_workspace_dir: "",
          recommended_reason: "",
        },
      },
      workflow_support: {
        plan: true,
        review: true,
        diff: true,
        patch: writeEnabled,
        write_enabled: writeEnabled,
        collaboration: context.collaborationEnabled,
      },
      capability_summary: {
        read: true,
        search: true,
        edit: writeEnabled,
        patch: writeEnabled,
        execute: writeEnabled,
        process: ["auto-approve", "yolo"].includes(context.normalizedPermissionMode),
        tasks: true,
      },
      task_stats: {
        all: tasks.length,
        running: tasks.filter((task) => task.status === "running").length,
        resumable: tasks.filter((task) => task.status === "failed" || task.status === "cancelled").length,
        developer: developerTasks.length,
      },
      recent_dev_tasks: developerTasks.slice(0, 5).map(mapTaskForWorkbench),
      plugin_count: Array.isArray(settings.extensions) ? settings.extensions.length : 0,
      templates: getDeveloperWorkbenchTemplates(),
      warnings,
    };
  }

  /** 扫描当前 Main 设置中的工作区摘要；无输入，返回最多一个仓库，路径缺失时返回固定警告。 */
  public async listRepositories(): Promise<DeveloperWorkbenchRepositoriesResult> {
    const context = getWorkspaceContext(this.options.state.getSnapshot().settings);
    if (!context.workspaceDirectory) return this.emptyRepositories("尚未配置 CLI 工作区");
    const root = await this.resolveWorkspaceDirectory(context.workspaceDirectory);
    if (root === null) return this.emptyRepositories("当前 CLI 工作区路径不存在");
    const repo = await this.inspectRepository(root);
    return { schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA, success: true, repos: [repo], warning: "" };
  }

  /** 在 Main 注入的工作区内执行有界文本搜索；输入查询和数量，返回相对路径命中，超时或预算耗尽时标记 truncated。 */
  public async searchCode(request: unknown): Promise<DeveloperWorkbenchCodeSearchResult> {
    const parsed = parseDeveloperWorkbenchCodeSearchRequest(request);
    const context = getWorkspaceContext(this.options.state.getSnapshot().settings);
    const root = await this.resolveWorkspaceDirectory(context.workspaceDirectory);
    if (root === null) throw new Error("Developer Workbench workspace is unavailable.");
    const results: DeveloperWorkbenchCodeSearchMatch[] = [];
    const queue = [root];
    const query = parsed.query.toLowerCase();
    const deadline = Date.now() + SEARCH_TIMEOUT_MS;
    let inspectedFiles = 0;
    let inspectedBytes = 0;
    let truncated = false;
    while (queue.length > 0 && results.length < (parsed.maxResults ?? 50)) {
      if (Date.now() >= deadline || inspectedFiles >= MAX_SEARCH_FILES || inspectedBytes >= MAX_SEARCH_TOTAL_BYTES) {
        truncated = true;
        break;
      }
      const directory = queue.shift()!;
      let handle;
      try {
        handle = await opendir(directory);
        for await (const entry of handle) {
          if (entry.isSymbolicLink()) continue;
          const absolutePath = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            if (!IGNORE_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".agent-shadow")) queue.push(absolutePath);
            continue;
          }
          if (!entry.isFile()) continue;
          inspectedFiles += 1;
          const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
          if (entry.name.toLowerCase().includes(query) || relativePath.toLowerCase().includes(query)) {
            results.push({ file: relativePath, line: 0, preview: entry.name.slice(0, 240), matchType: "filename" });
            if (results.length >= (parsed.maxResults ?? 50)) break;
          }
          const extension = path.extname(entry.name).toLowerCase();
          if (!SEARCH_TEXT_EXTENSIONS.has(extension)) continue;
          try {
            const fileStat = await stat(absolutePath);
            if (fileStat.size > MAX_SEARCH_FILE_BYTES || fileStat.size <= 0) continue;
            inspectedBytes += fileStat.size;
            if (inspectedBytes > MAX_SEARCH_TOTAL_BYTES) {
              truncated = true;
              break;
            }
            const text = await readFile(absolutePath, "utf8");
            const lines = text.split(/\r?\n/);
            const lineIndex = lines.findIndex((line) => line.toLowerCase().includes(query));
            if (lineIndex >= 0) {
              const rawPreview = (lines[lineIndex] ?? "").trim().slice(0, 240);
              results.push({
                file: relativePath,
                line: lineIndex + 1,
                preview: SENSITIVE_LINE_PATTERN.test(rawPreview) ? "[redacted sensitive line]" : rawPreview,
                matchType: "content",
              });
            }
          } catch {
            // 单个不可读文件不会让整个搜索失败。
          }
          if (inspectedFiles % 256 === 0) await yieldEventLoop();
          if (results.length >= (parsed.maxResults ?? 50)) break;
        }
      } catch {
        // 扫描期间消失或无权访问的目录被跳过。
      }
    }
    return {
      schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
      success: true,
      query: parsed.query,
      results: results.slice(0, parsed.maxResults),
      total: Math.min(results.length, parsed.maxResults ?? 50),
      truncated: truncated || queue.length > 0,
    };
  }

  /** 列出有界本地快照；无输入，返回最多 500 条摘要，损坏或超限文件被忽略。 */
  public listSnapshots(): Promise<DeveloperWorkbenchSnapshotListResult> {
    return this.enqueueOperation(async () => ({
      schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
      success: true,
      snapshots: await this.readSnapshotSummaries(),
    }));
  }

  /** 创建无密钥工作台快照；输入包含范围，返回摘要，状态超限或写入失败时抛错。 */
  public createSnapshot(request: unknown): Promise<DeveloperWorkbenchSnapshotWriteResult> {
    const parsed = parseCreateDeveloperWorkbenchSnapshotRequest(request);
    return this.enqueueOperation(async () => {
      const document = this.buildSnapshotDocument(parsed);
      await this.writeSnapshotDocument(document);
      return {
        schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
        success: true,
        snapshot: await this.requireSnapshotSummary(document.id),
      };
    });
  }

  /** 导入无密钥 JSON 快照；输入名称和文档，返回新 ID 摘要，凭据、格式或体积非法时在写盘前抛错。 */
  public importSnapshot(request: unknown): Promise<DeveloperWorkbenchSnapshotWriteResult> {
    const parsed = parseImportDeveloperWorkbenchSnapshotRequest(request);
    return this.enqueueOperation(async () => {
      const document = this.normalizeImportedSnapshot(parsed);
      await this.writeSnapshotDocument(document);
      return {
        schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
        success: true,
        snapshot: await this.requireSnapshotSummary(document.id),
      };
    });
  }

  /** 读取一个稳定快照文档；输入 ID，返回无密钥 JSON，缺失、损坏或超限时抛错。 */
  public getSnapshot(request: unknown): Promise<DeveloperWorkbenchSnapshotDocumentResult> {
    const parsed = parseDeveloperWorkbenchSnapshotRequest(request);
    return this.enqueueOperation(async () => ({
      schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
      success: true,
      snapshot: await this.readSnapshotDocument(parsed.snapshotId),
    }));
  }

  /** 恢复一个快照的设置与可选会话；输入 ID，返回恢复 ID，通过状态边界写入并广播，缺失或无设置时抛错。 */
  public restoreSnapshot(request: unknown): Promise<DeveloperWorkbenchSnapshotMutationResult> {
    const parsed = parseDeveloperWorkbenchSnapshotRequest(request);
    return this.enqueueOperation(async () => {
      const snapshot = await this.readSnapshotDocument(parsed.snapshotId);
      const snapshotSettings = asRecord(snapshot.settings);
      if (Object.keys(snapshotSettings).length === 0) throw new Error("Snapshot does not contain restorable settings.");
      const state = this.options.state.getSnapshot();
      const nextSettings = cloneJsonRecord(state.settings, 16 * 1024 * 1024);
      let conversations: readonly Readonly<Record<string, unknown>>[] | null = null;
      for (const [key, value] of Object.entries(snapshotSettings)) {
        if (key === "skillDirectory" || key === "skillIds") continue;
        if (key === "conversations") {
          conversations = asRecordArray(value);
          continue;
        }
        nextSettings[key] = value;
      }
      this.options.state.saveSettings({ settings: nextSettings });
      if (conversations !== null) this.options.state.saveConversations({ conversations });
      return {
        schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
        success: true,
        snapshotId: parsed.snapshotId,
      };
    });
  }

  /** 删除一个稳定快照；输入 ID，返回删除 ID，文件不存在或删除失败时抛错。 */
  public deleteSnapshot(request: unknown): Promise<DeveloperWorkbenchSnapshotMutationResult> {
    const parsed = parseDeveloperWorkbenchSnapshotRequest(request);
    return this.enqueueOperation(async () => {
      const filePath = this.getSnapshotPath(parsed.snapshotId);
      if (!existsSync(filePath)) throw new Error("Developer Workbench snapshot was not found.");
      await rm(filePath);
      return {
        schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
        success: true,
        snapshotId: parsed.snapshotId,
      };
    });
  }

  /** 应用一个已由 Main IPC 授权的工作区；输入路径与策略，返回规范配置，通过状态边界持久化并广播。 */
  public applyWorkspace(request: unknown): Promise<ApplyDeveloperWorkbenchWorkspaceResult> {
    const parsed = parseApplyDeveloperWorkbenchWorkspaceRequest(request);
    return this.enqueueOperation(async () => {
      const workspaceDirectory = await this.resolveWorkspaceDirectory(parsed.workspaceDirectory);
      if (workspaceDirectory === null) throw new Error("Developer Workbench workspace is unavailable.");
      const state = this.options.state.getSnapshot();
      const settings = cloneJsonRecord(state.settings, 16 * 1024 * 1024);
      const cliSettings = { ...asRecord(settings.CLISettings) };
      cliSettings.enabled = parsed.enabled;
      cliSettings.engine = parsed.engine;
      cliSettings.cc_path = workspaceDirectory;
      cliSettings.visibilityScope = parsed.visibilityScope;
      settings.CLISettings = cliSettings;
      const engineField = getEngineSettingsField(parsed.engine);
      settings[engineField] = { ...asRecord(settings[engineField]), permissionMode: parsed.permissionMode };
      this.options.state.saveSettings({ settings });
      return {
        schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
        success: true,
        workspaceDirectory,
        permissionMode: parsed.permissionMode,
        enabled: parsed.enabled,
        engine: parsed.engine,
        visibilityScope: parsed.visibilityScope,
      };
    });
  }

  /** 应用本地默认 Agent 映射；输入 Agent ID，返回模型映射，通过状态边界更新主 Agent 和选中 Provider。 */
  public applyMapping(request: unknown): Promise<ApplyDeveloperWorkbenchMappingResult> {
    const parsed = parseApplyDeveloperWorkbenchMappingRequest(request);
    return this.enqueueOperation(async () => {
      const state = this.options.state.getSnapshot();
      const settings = cloneJsonRecord(state.settings, 16 * 1024 * 1024);
      const agents = asRecord(settings.agents);
      if (!Object.hasOwn(agents, parsed.agentId)) throw new Error("Developer Workbench agent was not found.");
      settings.mainAgent = parsed.agentId;
      settings.model = parsed.agentId;
      const selectedProviderId = String(settings.selectedProvider ?? "").trim();
      const providers = asRecordArray(settings.modelProviders).map((provider) => ({ ...provider }));
      const selectedProvider = providers.find((provider) => String(provider.id ?? "").trim() === selectedProviderId);
      if (selectedProvider) {
        selectedProvider.modelId = parsed.agentId;
        const models = Array.isArray(selectedProvider.models)
          ? selectedProvider.models.filter((item): item is string => typeof item === "string" && item.trim() !== "")
          : [];
        selectedProvider.models = [parsed.agentId, ...models.filter((item) => item !== parsed.agentId)].slice(0, 500);
        settings.modelProviders = providers;
      }
      this.options.state.saveSettings({ settings });
      return {
        schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA,
        success: true,
        agentId: parsed.agentId,
        model: parsed.agentId,
      };
    });
  }

  /** 返回固定空仓库结果；输入警告文本，返回 schema 响应，无副作用。 */
  private emptyRepositories(warning: string): DeveloperWorkbenchRepositoriesResult {
    return { schema: APPLICATION_DEVELOPER_WORKBENCH_SCHEMA, success: true, repos: [], warning };
  }

  /** 判断路径是否为普通目录；输入路径，返回布尔值，缺失或符号链接返回 false。 */
  private async isDirectory(directoryPath: string): Promise<boolean> {
    if (!directoryPath) return false;
    try {
      const info = await lstat(directoryPath);
      return info.isDirectory() && !info.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /** 解析存在的真实工作区目录；输入候选路径，返回 canonical 路径，缺失、非目录或 NUL 时返回 null。 */
  private async resolveWorkspaceDirectory(directoryPath: string): Promise<string | null> {
    const normalized = String(directoryPath || "").trim();
    if (!normalized || normalized.length > 32_768 || normalized.includes("\0")) return null;
    try {
      const resolved = await realpath(path.resolve(normalized));
      const info = await lstat(resolved);
      return info.isDirectory() && !info.isSymbolicLink() ? resolved : null;
    } catch {
      return null;
    }
  }

  /** 异步扫描一个工作区摘要；输入 canonical 根目录，返回语言和文件数，达到 20 万文件时截断并定期让出事件循环。 */
  private async inspectRepository(root: string): Promise<DeveloperWorkbenchRepository> {
    const queue = [root];
    const languages = new Map<string, number>();
    let files = 0;
    let truncated = false;
    while (queue.length > 0 && files < MAX_REPOSITORY_FILES) {
      const directory = queue.shift()!;
      try {
        const handle = await opendir(directory);
        for await (const entry of handle) {
          if (entry.isSymbolicLink()) continue;
          const absolutePath = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            if (!IGNORE_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".agent-shadow")) queue.push(absolutePath);
            continue;
          }
          if (!entry.isFile()) continue;
          files += 1;
          const language = LANGUAGE_BY_EXTENSION[path.extname(entry.name).toLowerCase()];
          if (language) languages.set(language, (languages.get(language) ?? 0) + 1);
          if (files % 512 === 0) await yieldEventLoop();
          if (files >= MAX_REPOSITORY_FILES) {
            truncated = true;
            break;
          }
        }
      } catch {
        // 不可访问目录不会使整个工作区概览失败。
      }
    }
    const topLanguages = [...languages.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([name]) => name);
    const rootStat = await stat(root);
    return {
      name: path.basename(root) || root,
      path: root,
      langs: topLanguages.join(", ") || "-",
      indexed: rootStat.mtime.toISOString(),
      files,
      truncated: truncated || queue.length > 0,
    };
  }

  /** 构造一个无密钥快照文档；输入包含选项，返回有界文档，不写盘。 */
  private buildSnapshotDocument(request: CreateDeveloperWorkbenchSnapshotRequest): StoredSnapshotDocument {
    const state = this.options.state.getSnapshot();
    const settings: Record<string, unknown> = {};
    const include: DeveloperWorkbenchSnapshotInclude = {
      roles: request.includeRoles,
      chats: request.includeChats,
      tools: request.includeTools,
      skills: request.includeSkills,
    };
    this.copySnapshotFields(settings, state.settings, include.roles
      ? ["agents", "mainAgent", "memories", "memorySettings", "system_prompt", "SystemPromptsList"]
      : []);
    if (include.chats) {
      this.copySnapshotFields(settings, state.settings, ["conversationId"]);
      settings.conversations = state.conversations;
    }
    this.copySnapshotFields(settings, state.settings, include.tools ? [
      "tools", "llmTools", "mcpServers", "a2aServers", "custom_http", "CLISettings",
      "ccSettings", "qcSettings", "dsSettings", "ocSettings", "localEnvSettings",
      "chromeMCPSettings", "sqlSettings", "KBSettings", "VRMConfig", "workflows",
      "comfyuiServers",
    ] : []);
    this.copySnapshotFields(settings, state.settings, include.skills ? ["skills"] : []);
    const cleanSettings = stripCredentialFields(settings) as Readonly<Record<string, unknown>>;
    const id = this.createSnapshotId();
    const createdAt = this.now().toISOString();
    const agents = asRecord(state.settings.agents);
    const memories = Array.isArray(state.settings.memories) ? state.settings.memories : [];
    const mcpServers = asRecord(state.settings.mcpServers);
    const document: StoredSnapshotDocument = {
      id,
      name: request.name ?? `OpenXnet snapshot ${createdAt.replace("T", " ").replace("Z", "")}`,
      schema_version: 1,
      app_version: this.options.applicationVersion,
      created_at: createdAt,
      include,
      summary: {
        agents: Object.keys(agents).length,
        memories: memories.length,
        mcpServers: Object.keys(mcpServers).length,
      },
      settings: cleanSettings,
    };
    cloneJsonRecord(document);
    return document;
  }

  /** 复制允许进入快照的字段；输入目标、来源和字段列表，无返回，会把无密钥深拷贝写入目标。 */
  private copySnapshotFields(
    target: Record<string, unknown>,
    source: Readonly<Record<string, unknown>>,
    fields: readonly string[],
  ): void {
    for (const field of fields) {
      if (source[field] !== undefined) target[field] = stripCredentialFields(source[field]);
    }
  }

  /** 标准化导入快照；输入已校验请求，返回使用新 ID 的内部文档，不写盘。 */
  private normalizeImportedSnapshot(request: ImportDeveloperWorkbenchSnapshotRequest): StoredSnapshotDocument {
    const raw = request.snapshot;
    let settings = asRecord(raw.settings);
    if (Object.keys(settings).length === 0) {
      const legacy: Record<string, unknown> = {};
      if (raw.agents !== undefined) legacy.agents = raw.agents;
      if (raw.roles !== undefined) legacy.memories = raw.roles;
      if (raw.skills !== undefined) legacy.skills = raw.skills;
      if (isRecord(raw.tools)) {
        if (raw.tools.mcpServers !== undefined) legacy.mcpServers = raw.tools.mcpServers;
        if (raw.tools.customHttpTools !== undefined) legacy.custom_http = raw.tools.customHttpTools;
        if (raw.tools.llmTools !== undefined) legacy.llmTools = raw.tools.llmTools;
      }
      settings = legacy;
    }
    const id = this.createSnapshotId();
    const createdAt = typeof raw.created_at === "string" ? raw.created_at.slice(0, 64) : this.now().toISOString();
    const includeRecord = asRecord(raw.include);
    const include: DeveloperWorkbenchSnapshotInclude = {
      roles: includeRecord.roles === true || settings.agents !== undefined || settings.memories !== undefined,
      chats: includeRecord.chats === true || settings.conversations !== undefined,
      tools: includeRecord.tools === true || settings.tools !== undefined || settings.mcpServers !== undefined,
      skills: includeRecord.skills === true || settings.skills !== undefined,
    };
    const summary = asRecord(raw.summary);
    const document: StoredSnapshotDocument = {
      id,
      name: request.name ?? (typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 160) : "Imported OpenXnet snapshot"),
      schema_version: 1,
      app_version: this.options.applicationVersion,
      created_at: createdAt,
      include,
      summary,
      settings,
    };
    cloneJsonRecord(document);
    return document;
  }

  /** 创建不可预测快照 ID；无输入，返回时间和 UUID 组成的稳定安全 ID，无其他副作用。 */
  private createSnapshotId(): string {
    const timestamp = this.now().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    return `snap_${timestamp}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  }

  /** 返回快照文件路径；输入已校验 ID，返回快照目录内绝对路径，不访问文件系统。 */
  private getSnapshotPath(snapshotId: string): string {
    return path.join(this.snapshotDirectory, `${snapshotId}.json`);
  }

  /** 原子写入一个快照文档；输入文档，无返回，超限或文件冲突时清理临时文件并抛错。 */
  private async writeSnapshotDocument(document: StoredSnapshotDocument): Promise<void> {
    mkdirSync(this.snapshotDirectory, { recursive: true });
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > MAX_DEVELOPER_WORKBENCH_SNAPSHOT_BYTES) {
      throw new Error("Developer Workbench snapshot exceeds its byte budget.");
    }
    const destinationPath = this.getSnapshotPath(document.id);
    const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, destinationPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  /** 读取一个有界快照文档；输入 ID，返回普通对象，缺失、非普通文件、符号链接、超限或 JSON 非法时抛错。 */
  private async readSnapshotDocument(snapshotId: string): Promise<Readonly<Record<string, unknown>>> {
    const filePath = this.getSnapshotPath(snapshotId);
    const fileStat = await lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > MAX_DEVELOPER_WORKBENCH_SNAPSHOT_BYTES) {
      throw new Error("Developer Workbench snapshot is invalid.");
    }
    const value = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (!isRecord(value)) throw new Error("Developer Workbench snapshot is invalid.");
    assertCredentialFreeStoredValue(value);
    return cloneJsonRecord(value);
  }

  /** 读取并排序快照摘要；无输入，返回最多 500 条，损坏或非法文件被忽略。 */
  private async readSnapshotSummaries(): Promise<readonly DeveloperWorkbenchSnapshotSummary[]> {
    if (!existsSync(this.snapshotDirectory)) return [];
    const entries = await readdir(this.snapshotDirectory, { withFileTypes: true });
    const summaries: DeveloperWorkbenchSnapshotSummary[] = [];
    for (const entry of entries.slice(0, MAX_SNAPSHOT_COUNT * 2)) {
      if (!entry.isFile() || entry.isSymbolicLink() || !SNAPSHOT_FILE_PATTERN.test(entry.name)) continue;
      try {
        const id = entry.name.slice(0, -5);
        summaries.push(await this.requireSnapshotSummary(id));
      } catch {
        // 损坏快照不会阻断其余列表。
      }
      if (summaries.length >= MAX_SNAPSHOT_COUNT) break;
    }
    return summaries.sort((left, right) => right.created.localeCompare(left.created));
  }

  /** 构造一个快照摘要；输入 ID，返回摘要，文件缺失或文档非法时抛错。 */
  private async requireSnapshotSummary(snapshotId: string): Promise<DeveloperWorkbenchSnapshotSummary> {
    const filePath = this.getSnapshotPath(snapshotId);
    const fileStat = await lstat(filePath);
    const document = await this.readSnapshotDocument(snapshotId);
    const includeRecord = asRecord(document.include);
    const include: DeveloperWorkbenchSnapshotInclude = {
      roles: includeRecord.roles === true,
      chats: includeRecord.chats === true,
      tools: includeRecord.tools === true,
      skills: includeRecord.skills === true,
    };
    const summary = asRecord(document.summary);
    const roleBits: string[] = [];
    if (include.roles) roleBits.push(`${Number(summary.agents ?? 0)} agents`, `${Number(summary.memories ?? 0)} memories`);
    if (include.tools) roleBits.push(`${Number(summary.mcpServers ?? 0)} MCP`);
    return {
      id: typeof document.id === "string" ? document.id : snapshotId,
      name: typeof document.name === "string" ? document.name : snapshotId,
      created: typeof document.created_at === "string" ? document.created_at : fileStat.mtime.toISOString(),
      size: formatBytes(fileStat.size),
      sizeBytes: fileStat.size,
      roles: roleBits.join(" / ") || "-",
      include,
    };
  }

  /** 串行执行会修改快照或兼容设置的操作；输入异步操作，返回其结果，前序失败不阻塞后续请求。 */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
