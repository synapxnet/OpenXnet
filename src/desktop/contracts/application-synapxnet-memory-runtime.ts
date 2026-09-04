/** Fixed channels for the SynapXnet Memory V3 application boundary. */
export const APPLICATION_SYNAPXNET_MEMORY_CHANNELS = Object.freeze({
  recover: "openxnet:application-synapxnet-memory:recover",
  status: "openxnet:application-synapxnet-memory:status",
  list: "openxnet:application-synapxnet-memory:list",
  history: "openxnet:application-synapxnet-memory:history",
  create: "openxnet:application-synapxnet-memory:create",
  edit: "openxnet:application-synapxnet-memory:edit",
  rollback: "openxnet:application-synapxnet-memory:rollback",
  retire: "openxnet:application-synapxnet-memory:retire",
  export: "openxnet:application-synapxnet-memory:export",
  import: "openxnet:application-synapxnet-memory:import",
  verify: "openxnet:application-synapxnet-memory:verify",
});

export const APPLICATION_SYNAPXNET_MEMORY_SCHEMA = "openxnet.synapxnet-memory-runtime.v1" as const;
export const APPLICATION_SYNAPXNET_MEMORY_TRANSFER_SCHEMA = "openxnet.synapxnet-memory-transfer.v1" as const;

export type SynapxnetMemoryType = "skill" | "incident" | "collaboration" | "decision" | "manual";

export type SynapxnetMemoryRecoverySource =
  | "existing"
  | "competition-history"
  | "bundled-transfer"
  | "empty";

export interface SynapxnetMemoryStatusResult {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly frameworkVersion: string;
  readonly tiers: {
    readonly longTerm: { readonly memories: number; readonly versions: number; readonly committedVersions: number };
    readonly activeNative: { readonly sessions: number };
    readonly shortTerm: { readonly events: number };
  };
  readonly sharedVersions: number;
  readonly ownerAgents: number;
  readonly auditEvents: number;
  readonly auditHealthy: boolean;
}

export interface SynapxnetMemoryRecord {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly memoryId: string;
  readonly version: number;
  readonly ownerAgent: string;
  readonly taskId: string;
  readonly memoryType: SynapxnetMemoryType;
  readonly title: string;
  readonly contentPreview: string;
  readonly content?: string;
  readonly status: "COMMITTED" | "RETIRED";
  readonly qualityScore: number;
  readonly permissions: readonly string[];
  readonly tags: readonly string[];
  readonly payloadSha256: string;
  readonly recordSha256: string;
  readonly operation: string;
  readonly parentRecordSha256: string;
  readonly createdAtUtc: string;
  readonly committedAtUtc: string;
}

export interface SynapxnetMemoryListResult {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly items: readonly SynapxnetMemoryRecord[];
  readonly count: number;
}

export interface SynapxnetMemoryHistoryResult {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly memoryId: string;
  readonly versions: readonly SynapxnetMemoryRecord[];
}

export interface SynapxnetMemoryIntegrityResult {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly checkedVersions: number;
  readonly failures: readonly { readonly memoryId: string; readonly version: number; readonly reason: string }[];
  readonly recordChainHealthy: boolean;
  readonly auditChainHealthy: boolean;
  readonly healthy: boolean;
}

export interface SynapxnetMemoryImportResult {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly manifestSha256: string;
  readonly imported: readonly SynapxnetMemoryRecord[];
  readonly skipped: number;
}

export interface SynapxnetMemoryRecoveryResult {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_SCHEMA;
  readonly source: SynapxnetMemoryRecoverySource;
  readonly reconciledMemories: number;
  readonly importedVersions: number;
  readonly skippedVersions: number;
  readonly manifestSha256: string | null;
  readonly status: SynapxnetMemoryStatusResult;
  readonly integrity: SynapxnetMemoryIntegrityResult | null;
}

export type SynapxnetMemoryTransferDocument = Readonly<Record<string, unknown>> & {
  readonly schema: typeof APPLICATION_SYNAPXNET_MEMORY_TRANSFER_SCHEMA;
  readonly manifestSha256: string;
};

export interface ListSynapxnetMemoriesRequest {
  readonly requesterAgent: string;
  readonly query: string;
  readonly ownerAgent: string;
  readonly includeRetired: boolean;
  readonly limit: number;
}

export interface SynapxnetMemoryIdentityRequest {
  readonly memoryId: string;
  readonly requesterAgent: string;
}

export interface CreateSynapxnetMemoryRequest {
  readonly ownerAgent: string;
  readonly actorAgent: string;
  readonly taskId: string;
  readonly title: string;
  readonly content: string;
  readonly qualityScore: number;
  readonly permissions: readonly string[];
  readonly tags: readonly string[];
  readonly source: string;
}

export interface EditSynapxnetMemoryRequest {
  readonly memoryId: string;
  readonly baseVersion: number;
  readonly actorAgent: string;
  readonly title: string;
  readonly content: string;
  readonly qualityScore: number;
  readonly permissions: readonly string[];
  readonly tags: readonly string[];
  readonly reason: string;
}

export interface RollbackSynapxnetMemoryRequest {
  readonly memoryId: string;
  readonly targetVersion: number;
  readonly actorAgent: string;
  readonly reason: string;
}

export interface RetireSynapxnetMemoryRequest {
  readonly memoryId: string;
  readonly actorAgent: string;
}

export interface ExportSynapxnetMemoriesRequest {
  readonly requesterAgent: string;
  readonly memoryIds: readonly string[];
}

export interface ImportSynapxnetMemoriesRequest {
  readonly actorAgent: string;
  readonly targetOwnerAgent: string;
  readonly document: Readonly<Record<string, unknown>>;
}

export interface RecoverSynapxnetMemoriesRequest {
  readonly actorAgent: string;
}

export interface VerifySynapxnetMemoryRequest {
  readonly requesterAgent: string;
  readonly memoryId: string;
}

/** 解析记忆恢复请求；输入未知值，返回唯一允许接收恢复结果的 Agent 身份。 */
export function parseRecoverSynapxnetMemoriesRequest(value: unknown): RecoverSynapxnetMemoriesRequest {
  const record = exact(value, ["actorAgent"]);
  return { actorAgent: agent(record.actorAgent, "actorAgent") };
}

/** Parse one list request without accepting paths, commands, or additional fields. */
export function parseListSynapxnetMemoriesRequest(value: unknown): ListSynapxnetMemoriesRequest {
  const record = exact(value, ["requesterAgent", "query", "ownerAgent", "includeRetired", "limit"]);
  return {
    requesterAgent: agent(record.requesterAgent, "requesterAgent"),
    query: optionalText(record.query, "query", 2_048),
    ownerAgent: optionalAgent(record.ownerAgent, "ownerAgent"),
    includeRetired: boolean(record.includeRetired, "includeRetired"),
    limit: integer(record.limit, "limit", 1, 500),
  };
}

/** 解析单条记忆身份请求；输入未知值，返回经过摘要和 Agent 校验的请求。 */
export function parseSynapxnetMemoryIdentityRequest(value: unknown): SynapxnetMemoryIdentityRequest {
  const record = exact(value, ["memoryId", "requesterAgent"]);
  return { memoryId: digest(record.memoryId, "memoryId"), requesterAgent: agent(record.requesterAgent, "requesterAgent") };
}

/** 解析记忆创建请求；输入未知值，返回字段完整且大小受限的创建参数。 */
export function parseCreateSynapxnetMemoryRequest(value: unknown): CreateSynapxnetMemoryRequest {
  const record = exact(value, [
    "ownerAgent", "actorAgent", "taskId", "title", "content",
    "qualityScore", "permissions", "tags", "source",
  ]);
  return {
    ownerAgent: agent(record.ownerAgent, "ownerAgent"),
    actorAgent: agent(record.actorAgent, "actorAgent"),
    taskId: identifier(record.taskId, "taskId", 512),
    title: text(record.title, "title", 512),
    content: text(record.content, "content", 512 * 1024),
    qualityScore: number(record.qualityScore, "qualityScore", 0, 1),
    permissions: stringArray(record.permissions, "permissions", 128, true),
    tags: stringArray(record.tags, "tags", 64, false),
    source: text(record.source, "source", 128),
  };
}

/** 解析记忆编辑请求；输入未知值，返回绑定基础版本和操作者的编辑参数。 */
export function parseEditSynapxnetMemoryRequest(value: unknown): EditSynapxnetMemoryRequest {
  const record = exact(value, [
    "memoryId", "baseVersion", "actorAgent", "title", "content",
    "qualityScore", "permissions", "tags", "reason",
  ]);
  return {
    memoryId: digest(record.memoryId, "memoryId"),
    baseVersion: integer(record.baseVersion, "baseVersion", 1, 2_147_483_647),
    actorAgent: agent(record.actorAgent, "actorAgent"),
    title: text(record.title, "title", 512),
    content: text(record.content, "content", 512 * 1024),
    qualityScore: number(record.qualityScore, "qualityScore", 0, 1),
    permissions: stringArray(record.permissions, "permissions", 128, true),
    tags: stringArray(record.tags, "tags", 64, false),
    reason: optionalText(record.reason, "reason", 2_048),
  };
}

/** 解析记忆回滚请求；输入未知值，返回目标版本、操作者和原因。 */
export function parseRollbackSynapxnetMemoryRequest(value: unknown): RollbackSynapxnetMemoryRequest {
  const record = exact(value, ["memoryId", "targetVersion", "actorAgent", "reason"]);
  return {
    memoryId: digest(record.memoryId, "memoryId"),
    targetVersion: integer(record.targetVersion, "targetVersion", 1, 2_147_483_647),
    actorAgent: agent(record.actorAgent, "actorAgent"),
    reason: optionalText(record.reason, "reason", 2_048),
  };
}

/** 解析记忆退役请求；输入未知值，返回记忆摘要和操作者身份。 */
export function parseRetireSynapxnetMemoryRequest(value: unknown): RetireSynapxnetMemoryRequest {
  const record = exact(value, ["memoryId", "actorAgent"]);
  return { memoryId: digest(record.memoryId, "memoryId"), actorAgent: agent(record.actorAgent, "actorAgent") };
}

/** 解析记忆导出请求；输入未知值，返回请求 Agent 和有限记忆摘要列表。 */
export function parseExportSynapxnetMemoriesRequest(value: unknown): ExportSynapxnetMemoriesRequest {
  const record = exact(value, ["requesterAgent", "memoryIds"]);
  return {
    requesterAgent: agent(record.requesterAgent, "requesterAgent"),
    memoryIds: digestArray(record.memoryIds, "memoryIds", 100),
  };
}

/** 解析记忆导入请求；输入未知值，返回目标所有者和受字节预算约束的文档。 */
export function parseImportSynapxnetMemoriesRequest(value: unknown): ImportSynapxnetMemoriesRequest {
  const record = exact(value, ["actorAgent", "targetOwnerAgent", "document"]);
  return {
    actorAgent: agent(record.actorAgent, "actorAgent"),
    targetOwnerAgent: agent(record.targetOwnerAgent, "targetOwnerAgent"),
    document: jsonObject(record.document, "document", 16 * 1024 * 1024),
  };
}

/** 解析记忆完整性校验请求；输入未知值，返回请求 Agent 和可选记忆摘要。 */
export function parseVerifySynapxnetMemoryRequest(value: unknown): VerifySynapxnetMemoryRequest {
  const record = exact(value, ["requesterAgent", "memoryId"]);
  return {
    requesterAgent: agent(record.requesterAgent, "requesterAgent"),
    memoryId: record.memoryId === "" ? "" : digest(record.memoryId, "memoryId"),
  };
}

/** 校验对象只包含指定字段；输入未知值和字段清单，返回精确对象。 */
function exact(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("SynapXnet Memory request must be an object.");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new TypeError("SynapXnet Memory request fields are invalid.");
  }
  return record;
}

/** 校验必填文本并执行长度和控制字符限制；返回规范化文本。 */
function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`SynapXnet Memory field '${field}' must be text.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum || /[\u0000\u007F]/.test(normalized)) {
    throw new TypeError(`SynapXnet Memory field '${field}' is invalid.`);
  }
  return normalized;
}

/** 校验可选文本；空值返回空字符串，非空值复用必填文本规则。 */
function optionalText(value: unknown, field: string, maximum: number): string {
  return value === "" || value === null || value === undefined ? "" : text(value, field, maximum);
}

/** 校验不可包含路径或换行符的稳定标识符；返回规范化标识符。 */
function identifier(value: unknown, field: string, maximum: number): string {
  const normalized = text(value, field, maximum);
  if (/[\\/\r\n]/.test(normalized)) throw new TypeError(`SynapXnet Memory field '${field}' is invalid.`);
  return normalized;
}

/** 校验必填 Agent 标识；返回长度不超过 255 的稳定身份。 */
function agent(value: unknown, field: string): string {
  return identifier(value, field, 255);
}

/** 校验可选 Agent 标识；空值返回空字符串。 */
function optionalAgent(value: unknown, field: string): string {
  return value === "" || value === null || value === undefined ? "" : agent(value, field);
}

/** 校验 SHA-256 十六进制摘要；返回统一小写摘要。 */
function digest(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new TypeError(`SynapXnet Memory field '${field}' must be a SHA-256 digest.`);
  }
  return value.toLowerCase();
}

/** 校验非空且有数量上限的摘要数组；返回规范化摘要列表。 */
function digestArray(value: unknown, field: string, maximum: number): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    throw new TypeError(`SynapXnet Memory field '${field}' is invalid.`);
  }
  return value.map((item) => digest(item, field));
}

/** 校验字符串数组并去重排序；可按参数允许权限通配符。 */
function stringArray(value: unknown, field: string, maximum: number, allowWildcard: boolean): readonly string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError(`SynapXnet Memory field '${field}' must be an array.`);
  }
  return [...new Set(value.map((item) => {
    if (allowWildcard && item === "*") return "*";
    return identifier(item, field, 255);
  }))].sort();
}

/** 校验闭区间内的整数；返回原始数值。 */
function integer(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`SynapXnet Memory field '${field}' must be an integer.`);
  }
  return value;
}

/** 校验闭区间内的有限数值；返回原始数值。 */
function number(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`SynapXnet Memory field '${field}' must be a number.`);
  }
  return value;
}

/** 校验布尔字段；输入未知值和字段名，返回布尔值。 */
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`SynapXnet Memory field '${field}' must be boolean.`);
  return value;
}

/** 克隆可序列化 JSON 对象并限制 UTF-8 字节数；返回只读对象。 */
function jsonObject(value: unknown, field: string, byteLimit: number): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`SynapXnet Memory field '${field}' must be an object.`);
  }
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new TypeError(`SynapXnet Memory field '${field}' must be JSON serializable.`);
  }
  if (Buffer.byteLength(encoded, "utf8") > byteLimit) {
    throw new TypeError(`SynapXnet Memory field '${field}' exceeds its byte budget.`);
  }
  return JSON.parse(encoded) as Readonly<Record<string, unknown>>;
}
