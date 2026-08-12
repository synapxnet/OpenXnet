/** Desktop 知识库运行时 IPC channels。 */
export const APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS = {
  build: "openxnet:application-knowledge-base-runtime:build",
  status: "openxnet:application-knowledge-base-runtime:status",
  remove: "openxnet:application-knowledge-base-runtime:remove",
  query: "openxnet:application-knowledge-base-runtime:query",
} as const;

/** 知识库状态响应 schema。 */
export const APPLICATION_KNOWLEDGE_BASE_STATUS_SCHEMA = "openxnet.knowledge-base-status.v1" as const;

/** 知识库删除响应 schema。 */
export const APPLICATION_KNOWLEDGE_BASE_MUTATION_SCHEMA = "openxnet.knowledge-base-mutation.v1" as const;

/** 知识库检索响应 schema。 */
export const APPLICATION_KNOWLEDGE_BASE_QUERY_SCHEMA = "openxnet.knowledge-base-query.v1" as const;

/** Desktop 可见的知识库运行状态。 */
export type ApplicationKnowledgeBaseStatusValue = "not_found" | "processing" | "completed" | "failed";

/** 只包含稳定知识库标识的请求。 */
export interface ApplicationKnowledgeBaseScopeRequest {
  readonly knowledgeBaseId: string;
}

/** 有界知识库检索请求。 */
export interface ApplicationKnowledgeBaseQueryRequest extends ApplicationKnowledgeBaseScopeRequest {
  readonly query: string;
  readonly limit?: number;
}

/** Desktop 可见的知识库状态。 */
export interface ApplicationKnowledgeBaseStatus {
  readonly schema: typeof APPLICATION_KNOWLEDGE_BASE_STATUS_SCHEMA;
  readonly knowledgeBaseId: string;
  readonly status: ApplicationKnowledgeBaseStatusValue;
}

/** Desktop 可见的知识库删除结果。 */
export interface ApplicationKnowledgeBaseMutationResult {
  readonly schema: typeof APPLICATION_KNOWLEDGE_BASE_MUTATION_SCHEMA;
  readonly knowledgeBaseId: string;
  readonly success: true;
  readonly removed: boolean;
}

/** 一个不含本机路径的知识库检索结果。 */
export interface ApplicationKnowledgeBaseQueryItem {
  readonly id: string;
  readonly content: string;
  readonly summary: string;
  readonly fileName: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Desktop 可见的有界知识库检索结果。 */
export interface ApplicationKnowledgeBaseQueryResult {
  readonly schema: typeof APPLICATION_KNOWLEDGE_BASE_QUERY_SCHEMA;
  readonly knowledgeBaseId: string;
  readonly query: string;
  readonly count: number;
  readonly results: readonly ApplicationKnowledgeBaseQueryItem[];
}

const KNOWLEDGE_BASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** 解析知识库 scope；输入未知值，返回精确请求，额外字段或非法标识时抛出 TypeError。 */
export function parseApplicationKnowledgeBaseScopeRequest(
  value: unknown,
): ApplicationKnowledgeBaseScopeRequest {
  const record = requireExactRecord(value, ["knowledgeBaseId"], "knowledge base scope");
  return { knowledgeBaseId: requireKnowledgeBaseId(record.knowledgeBaseId) };
}

/** 解析知识库查询；输入未知值，返回有界请求，字段无效时抛出 TypeError。 */
export function parseApplicationKnowledgeBaseQueryRequest(
  value: unknown,
): ApplicationKnowledgeBaseQueryRequest {
  const record = requireExactRecord(
    value,
    ["knowledgeBaseId", "query", "limit"],
    "knowledge base query",
    true,
  );
  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (!query || query.length > 8_192) {
    throw new TypeError("Application knowledge base query is invalid.");
  }
  const limit = record.limit === undefined ? 5 : Number(record.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new TypeError("Application knowledge base query limit is invalid.");
  }
  return {
    knowledgeBaseId: requireKnowledgeBaseId(record.knowledgeBaseId),
    query,
    limit,
  };
}

/** 校验知识库标识；输入未知值，返回原文本，格式无效时抛出 TypeError。 */
function requireKnowledgeBaseId(value: unknown): string {
  if (typeof value !== "string" || !KNOWLEDGE_BASE_ID_PATTERN.test(value)) {
    throw new TypeError("Application knowledge base identifier is invalid.");
  }
  return value;
}

/** 校验精确对象字段；输入未知值和允许键，返回记录，类型或字段漂移时抛出 TypeError。 */
function requireExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  label: string,
  allowOptional = false,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Application ${label} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new TypeError(`Application ${label} fields are invalid.`);
  }
  if (!allowOptional && Object.keys(record).length !== allowedKeys.length) {
    throw new TypeError(`Application ${label} fields are invalid.`);
  }
  return record;
}
