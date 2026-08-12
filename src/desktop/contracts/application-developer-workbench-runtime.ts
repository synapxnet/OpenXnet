/** Developer Workbench Runtime 的 Main IPC 通道。 */
export const APPLICATION_DEVELOPER_WORKBENCH_CHANNELS = Object.freeze({
  overview: "openxnet:application-developer-workbench:overview",
  repositories: "openxnet:application-developer-workbench:repositories",
  searchCode: "openxnet:application-developer-workbench:search-code",
  listSnapshots: "openxnet:application-developer-workbench:list-snapshots",
  createSnapshot: "openxnet:application-developer-workbench:create-snapshot",
  importSnapshot: "openxnet:application-developer-workbench:import-snapshot",
  getSnapshot: "openxnet:application-developer-workbench:get-snapshot",
  restoreSnapshot: "openxnet:application-developer-workbench:restore-snapshot",
  deleteSnapshot: "openxnet:application-developer-workbench:delete-snapshot",
  applyWorkspace: "openxnet:application-developer-workbench:apply-workspace",
  applyMapping: "openxnet:application-developer-workbench:apply-mapping",
});

/** Developer Workbench Runtime 的公开响应 schema。 */
export const APPLICATION_DEVELOPER_WORKBENCH_SCHEMA = "openxnet.developer-workbench.v1" as const;

/** 代码工作区摘要，不包含任意命令或文件内容。 */
export interface DeveloperWorkbenchRepository {
  readonly name: string;
  readonly path: string;
  readonly langs: string;
  readonly indexed: string;
  readonly files: number;
  readonly truncated: boolean;
}

/** 仓库扫描结果。 */
export interface DeveloperWorkbenchRepositoriesResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly repos: readonly DeveloperWorkbenchRepository[];
  readonly warning: string;
}

/** 一条有界文本搜索命中。 */
export interface DeveloperWorkbenchCodeSearchMatch {
  readonly file: string;
  readonly line: number;
  readonly preview: string;
  readonly matchType: "filename" | "content";
}

/** 代码搜索请求；根目录始终由 Main 设置快照注入。 */
export interface DeveloperWorkbenchCodeSearchRequest {
  readonly query: string;
  readonly maxResults?: number;
}

/** 有界代码搜索结果。 */
export interface DeveloperWorkbenchCodeSearchResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly query: string;
  readonly results: readonly DeveloperWorkbenchCodeSearchMatch[];
  readonly total: number;
  readonly truncated: boolean;
}

/** Developer Workbench 页面概览；动态助手字段仍是无密钥 JSON 记录。 */
export interface DeveloperWorkbenchOverview {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly workspace: Readonly<Record<string, unknown>>;
  readonly cli: Readonly<Record<string, unknown>>;
  readonly runtime_profile: Readonly<Record<string, unknown>>;
  readonly configuration_readiness: Readonly<Record<string, unknown>>;
  readonly configuration_assistant: Readonly<Record<string, unknown>>;
  readonly workflow_support: Readonly<Record<string, unknown>>;
  readonly capability_summary: Readonly<Record<string, unknown>>;
  readonly task_stats: Readonly<Record<string, unknown>>;
  readonly recent_dev_tasks: readonly Readonly<Record<string, unknown>>[];
  readonly plugin_count: number;
  readonly templates: readonly Readonly<Record<string, unknown>>[];
  readonly warnings: readonly string[];
}

/** 快照包含范围。 */
export interface DeveloperWorkbenchSnapshotInclude {
  readonly roles: boolean;
  readonly chats: boolean;
  readonly tools: boolean;
  readonly skills: boolean;
}

/** 快照列表摘要。 */
export interface DeveloperWorkbenchSnapshotSummary {
  readonly id: string;
  readonly name: string;
  readonly created: string;
  readonly size: string;
  readonly sizeBytes: number;
  readonly roles: string;
  readonly include: DeveloperWorkbenchSnapshotInclude;
}

/** 快照列表结果。 */
export interface DeveloperWorkbenchSnapshotListResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly snapshots: readonly DeveloperWorkbenchSnapshotSummary[];
}

/** 创建快照请求。 */
export interface CreateDeveloperWorkbenchSnapshotRequest {
  readonly name?: string;
  readonly includeRoles: boolean;
  readonly includeChats: boolean;
  readonly includeTools: boolean;
  readonly includeSkills: boolean;
}

/** 导入一个无密钥 JSON 快照。 */
export interface ImportDeveloperWorkbenchSnapshotRequest {
  readonly name?: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

/** 通过稳定 ID 操作一个快照。 */
export interface DeveloperWorkbenchSnapshotRequest {
  readonly snapshotId: string;
}

/** 快照写入结果。 */
export interface DeveloperWorkbenchSnapshotWriteResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly snapshot: DeveloperWorkbenchSnapshotSummary;
}

/** 快照文档读取结果。 */
export interface DeveloperWorkbenchSnapshotDocumentResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

/** 快照恢复或删除结果。 */
export interface DeveloperWorkbenchSnapshotMutationResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly snapshotId: string;
}

/** 应用一个 Main 已授权的工作区配置。 */
export interface ApplyDeveloperWorkbenchWorkspaceRequest {
  readonly workspaceDirectory: string;
  readonly permissionMode: string;
  readonly enabled: boolean;
  readonly engine: string;
  readonly visibilityScope: string;
}

/** 应用后的标准工作区配置。 */
export interface ApplyDeveloperWorkbenchWorkspaceResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly workspaceDirectory: string;
  readonly permissionMode: string;
  readonly enabled: boolean;
  readonly engine: string;
  readonly visibilityScope: string;
}

/** 应用本地默认 Agent 映射。 */
export interface ApplyDeveloperWorkbenchMappingRequest {
  readonly agentId: string;
  readonly syncProviderModel: boolean;
}

/** 应用后的 Agent/模型映射。 */
export interface ApplyDeveloperWorkbenchMappingResult {
  readonly schema: typeof APPLICATION_DEVELOPER_WORKBENCH_SCHEMA;
  readonly success: true;
  readonly agentId: string;
  readonly model: string;
}

export const MAX_DEVELOPER_WORKBENCH_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const MAX_QUERY_LENGTH = 256;
const MAX_SNAPSHOT_NAME_LENGTH = 160;
const SNAPSHOT_ID_PATTERN = /^snap_[A-Za-z0-9_.-]{1,120}$/;
const WORKSPACE_ENGINES = new Set(["local", "ds", "cc", "qc", "oc"]);
const PERMISSION_MODES = new Set([
  "default",
  "plan",
  "acceptEdits",
  "auto-edit",
  "auto-approve",
  "bypassPermissions",
  "cowork",
  "yolo",
]);
const VISIBILITY_SCOPES = new Set(["workspace", "global"]);
const SENSITIVE_KEY_PATTERN = /(api.?key|authorization|cookie|password|secret|token)/i;

/** 判断未知值是否为普通 JSON 对象；输入任意值，返回类型保护，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验对象只包含允许字段；输入未知值、字段和标签，返回普通对象，非法时抛错。 */
function requireExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

/** 读取有界非空文本；输入未知值和标签，返回去空格文本，非法时抛错。 */
function requireText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

/** 深度检查导入快照是否包含凭据字段；输入 JSON 值和深度，无返回，发现密钥或越界结构时抛错。 */
function assertCredentialFreeSnapshot(value: unknown, depth = 0): void {
  if (depth > 12) throw new Error("Snapshot structure is too deep.");
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error("Snapshot array is too large.");
    value.forEach((item) => assertCredentialFreeSnapshot(item, depth + 1));
    return;
  }
  if (!isRecord(value)) return;
  if (Object.keys(value).length > 2_000) throw new Error("Snapshot object is too large.");
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
    if (SENSITIVE_KEY_PATTERN.test(normalizedKey) && !/configured$/i.test(normalizedKey)) {
      throw new Error("Snapshot contains credential fields.");
    }
    assertCredentialFreeSnapshot(item, depth + 1);
  }
}

/** 克隆并限制一个导入快照；输入未知值，返回无密钥 JSON 对象，序列化、体积或字段非法时抛错。 */
function cloneSnapshot(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new Error("Snapshot must be an object.");
  assertCredentialFreeSnapshot(value);
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_DEVELOPER_WORKBENCH_SNAPSHOT_BYTES) {
    throw new Error("Snapshot exceeds its byte budget.");
  }
  return JSON.parse(serialized) as Readonly<Record<string, unknown>>;
}

/** 校验代码搜索请求；输入未知 IPC 值，返回有界查询，额外字段或范围非法时抛错。 */
export function parseDeveloperWorkbenchCodeSearchRequest(
  value: unknown,
): DeveloperWorkbenchCodeSearchRequest {
  const record = requireExactRecord(value, ["query", "maxResults"], "Code search request");
  const maxResults = record.maxResults === undefined ? 50 : Number(record.maxResults);
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 100) {
    throw new Error("Code search maxResults is invalid.");
  }
  return {
    query: requireText(record.query, "Code search query", MAX_QUERY_LENGTH),
    maxResults,
  };
}

/** 校验创建快照请求；输入未知 IPC 值，返回精确选项，名称或布尔字段非法时抛错。 */
export function parseCreateDeveloperWorkbenchSnapshotRequest(
  value: unknown,
): CreateDeveloperWorkbenchSnapshotRequest {
  const record = requireExactRecord(
    value,
    ["name", "includeRoles", "includeChats", "includeTools", "includeSkills"],
    "Create snapshot request",
  );
  for (const field of ["includeRoles", "includeChats", "includeTools", "includeSkills"] as const) {
    if (typeof record[field] !== "boolean") throw new Error(`Snapshot ${field} must be boolean.`);
  }
  const request: CreateDeveloperWorkbenchSnapshotRequest = {
    includeRoles: record.includeRoles as boolean,
    includeChats: record.includeChats as boolean,
    includeTools: record.includeTools as boolean,
    includeSkills: record.includeSkills as boolean,
  };
  if (record.name === undefined || String(record.name).trim() === "") return request;
  return { ...request, name: requireText(record.name, "Snapshot name", MAX_SNAPSHOT_NAME_LENGTH) };
}

/** 校验导入快照请求；输入未知 IPC 值，返回深度克隆的无密钥快照，凭据、体积或名称非法时抛错。 */
export function parseImportDeveloperWorkbenchSnapshotRequest(
  value: unknown,
): ImportDeveloperWorkbenchSnapshotRequest {
  const record = requireExactRecord(value, ["name", "snapshot"], "Import snapshot request");
  const request: ImportDeveloperWorkbenchSnapshotRequest = { snapshot: cloneSnapshot(record.snapshot) };
  if (record.name === undefined || String(record.name).trim() === "") return request;
  return { ...request, name: requireText(record.name, "Snapshot name", MAX_SNAPSHOT_NAME_LENGTH) };
}

/** 校验稳定快照 ID 请求；输入未知 IPC 值，返回标准 ID，额外字段或格式非法时抛错。 */
export function parseDeveloperWorkbenchSnapshotRequest(
  value: unknown,
): DeveloperWorkbenchSnapshotRequest {
  const record = requireExactRecord(value, ["snapshotId"], "Snapshot request");
  const snapshotId = requireText(record.snapshotId, "Snapshot ID", 128);
  if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) throw new Error("Snapshot ID is invalid.");
  return { snapshotId };
}

/** 校验工作区应用请求；输入未知 IPC 值，返回精确配置，路径授权由 Main IPC 继续完成。 */
export function parseApplyDeveloperWorkbenchWorkspaceRequest(
  value: unknown,
): ApplyDeveloperWorkbenchWorkspaceRequest {
  const record = requireExactRecord(
    value,
    ["workspaceDirectory", "permissionMode", "enabled", "engine", "visibilityScope"],
    "Workspace apply request",
  );
  const engine = requireText(record.engine, "Workspace engine", 32);
  const permissionMode = requireText(record.permissionMode, "Workspace permission mode", 64);
  const visibilityScope = requireText(record.visibilityScope, "Workspace visibility scope", 32);
  if (!WORKSPACE_ENGINES.has(engine) || !PERMISSION_MODES.has(permissionMode) || !VISIBILITY_SCOPES.has(visibilityScope)) {
    throw new Error("Workspace configuration is unsupported.");
  }
  if (typeof record.enabled !== "boolean") throw new Error("Workspace enabled must be boolean.");
  return {
    workspaceDirectory: requireText(record.workspaceDirectory, "Workspace directory", 32_768),
    permissionMode,
    enabled: record.enabled,
    engine,
    visibilityScope,
  };
}

/** 校验 Agent 映射请求；输入未知 IPC 值，返回精确映射，未知 Agent 由 Runtime 拒绝。 */
export function parseApplyDeveloperWorkbenchMappingRequest(
  value: unknown,
): ApplyDeveloperWorkbenchMappingRequest {
  const record = requireExactRecord(value, ["agentId", "syncProviderModel"], "Mapping apply request");
  if (record.syncProviderModel !== true) throw new Error("Mapping must synchronize the Provider model.");
  return {
    agentId: requireText(record.agentId, "Agent ID", 128),
    syncProviderModel: true,
  };
}
