/** Memory 管理 Runtime 固定 IPC channel。 */
export const APPLICATION_MEMORY_MANAGEMENT_CHANNELS = Object.freeze({
  listRecords: "openxnet:application-memory-management:list-records",
  updateRecord: "openxnet:application-memory-management:update-record",
  deleteRecord: "openxnet:application-memory-management:delete-record",
  removeCollection: "openxnet:application-memory-management:remove-collection",
});

/** Memory 管理 Runtime 公开 schema。 */
export const APPLICATION_MEMORY_MANAGEMENT_SCHEMA = "openxnet.application-memory-management.v1" as const;

/** 指向一个设置内记忆集合的精确请求。 */
export interface ApplicationMemoryCollectionRequest {
  readonly memoryId: string;
}

/** 指向一个稳定向量记录的精确请求。 */
export interface ApplicationMemoryRecordRequest extends ApplicationMemoryCollectionRequest {
  readonly recordId: string;
}

/** 更新一个稳定向量记录文本的精确请求。 */
export interface UpdateApplicationMemoryRecordRequest extends ApplicationMemoryRecordRequest {
  readonly text: string;
}

/** Renderer 可展示的无路径记忆记录。 */
export interface ApplicationMemoryRecord {
  readonly recordId: string;
  readonly index: number;
  readonly text: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 记忆集合列表结果。 */
export interface ApplicationMemoryRecordListResult {
  readonly schema: typeof APPLICATION_MEMORY_MANAGEMENT_SCHEMA;
  readonly memoryId: string;
  readonly records: readonly ApplicationMemoryRecord[];
}

/** 记忆记录或集合变更结果。 */
export interface ApplicationMemoryMutationResult {
  readonly schema: typeof APPLICATION_MEMORY_MANAGEMENT_SCHEMA;
  readonly memoryId: string;
  readonly action: "updated" | "deleted" | "removed";
  readonly recordId: string;
}

/**
 * 解析记忆集合请求；输入不可信 IPC 值，输出稳定 memoryId。
 * 本函数无副作用，路径字符、控制字符、空值或额外字段会以 TypeError 失败。
 */
export function parseApplicationMemoryCollectionRequest(
  value: unknown,
): ApplicationMemoryCollectionRequest {
  const record = requireExactRecord(value, ["memoryId"], "collection request");
  return { memoryId: requireIdentifier(record.memoryId, "memoryId", 255) };
}

/**
 * 解析记忆记录请求；输入不可信 IPC 值，输出 memoryId 与 recordId。
 * 本函数无副作用，非法标识或字段漂移会以 TypeError 失败。
 */
export function parseApplicationMemoryRecordRequest(value: unknown): ApplicationMemoryRecordRequest {
  const record = requireExactRecord(value, ["memoryId", "recordId"], "record request");
  return {
    memoryId: requireIdentifier(record.memoryId, "memoryId", 255),
    recordId: requireIdentifier(record.recordId, "recordId", 128),
  };
}

/**
 * 解析记忆文本更新请求；输入不可信 IPC 值，输出稳定 ID 与有界文本。
 * 本函数无副作用，空文本、超限或额外字段会以 TypeError 失败。
 */
export function parseUpdateApplicationMemoryRecordRequest(
  value: unknown,
): UpdateApplicationMemoryRecordRequest {
  const record = requireExactRecord(value, ["memoryId", "recordId", "text"], "update request");
  const text = requireText(record.text, "text", 512 * 1024);
  if (!text) throw new TypeError("Application Memory field 'text' is required.");
  return {
    memoryId: requireIdentifier(record.memoryId, "memoryId", 255),
    recordId: requireIdentifier(record.recordId, "recordId", 128),
    text,
  };
}

/** 校验精确对象；输入未知值、字段和标签，输出记录，类型或字段漂移时抛出 TypeError。 */
function requireExactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Application Memory ${label} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new TypeError(`Application Memory ${label} fields are invalid.`);
  }
  return record;
}

/** 校验稳定标识；输入未知值、字段和长度，输出文本，路径或控制字符时抛出 TypeError。 */
function requireIdentifier(value: unknown, field: string, maximumLength: number): string {
  const normalized = requireText(value, field, maximumLength);
  if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new TypeError(`Application Memory field '${field}' is invalid.`);
  }
  return normalized;
}

/** 校验有界文本；输入未知值、字段和长度，输出去空白文本，非法时抛出 TypeError。 */
function requireText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`Application Memory field '${field}' must be text.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength || /[\u0000\u007F]/.test(normalized)) {
    throw new TypeError(`Application Memory field '${field}' is invalid.`);
  }
  return normalized;
}
