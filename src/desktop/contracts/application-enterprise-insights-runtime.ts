/** Enterprise Insights Runtime 的 Main IPC 通道。 */
export const APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS = Object.freeze({
  loadUsageDashboard: "openxnet:application-enterprise-insights:load-usage-dashboard",
  loadNeuroDashboard: "openxnet:application-enterprise-insights:load-neuro-dashboard",
  searchNeuroSymbols: "openxnet:application-enterprise-insights:search-neuro-symbols",
  removeNeuroSymbol: "openxnet:application-enterprise-insights:remove-neuro-symbol",
  runNeuroMaintenance: "openxnet:application-enterprise-insights:run-neuro-maintenance",
  loadKnowledgeGraph: "openxnet:application-enterprise-insights:load-knowledge-graph",
  queryKnowledgeGraphEntity: "openxnet:application-enterprise-insights:query-knowledge-graph-entity",
});

/** Enterprise Insights Runtime 的公开响应 schema。 */
export const APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA = "openxnet.enterprise-insights.v1" as const;

/** 用量趋势分组粒度。 */
export type ApplicationEnterpriseUsageGroup = "hour" | "day" | "month";

/** 用量面板请求。 */
export interface ApplicationEnterpriseUsageDashboardRequest {
  readonly groupBy: ApplicationEnterpriseUsageGroup;
  readonly limit: number;
}

/** 用量汇总。 */
export interface ApplicationEnterpriseUsageSummary {
  readonly total_requests: number;
  readonly total_tokens: number;
  readonly total_input: number;
  readonly total_output: number;
  readonly total_cache_read: number;
  readonly total_cache_creation: number;
  readonly total_cost: number;
  readonly avg_duration_ms: number;
  readonly success_count: number;
  readonly failure_count: number;
}

/** 单个用量趋势分组。 */
export interface ApplicationEnterpriseUsageTrendItem {
  readonly period: string;
  readonly requests: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly cache_creation_tokens: number;
  readonly total_tokens: number;
  readonly cost: number;
}

/** 单个模型用量分组。 */
export interface ApplicationEnterpriseUsageModelItem {
  readonly model: string;
  readonly provider: string;
  readonly requests: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly total_tokens: number;
  readonly cost: number;
}

/** 单个用户用量分组。 */
export interface ApplicationEnterpriseUsageUserItem {
  readonly user_id: string;
  readonly requests: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_tokens: number;
  readonly total_tokens: number;
  readonly cost: number;
  readonly avg_duration_ms: number;
}

/** 完整用量面板。 */
export interface ApplicationEnterpriseUsageDashboardResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly summary: ApplicationEnterpriseUsageSummary;
  readonly trend: readonly ApplicationEnterpriseUsageTrendItem[];
  readonly models: readonly ApplicationEnterpriseUsageModelItem[];
  readonly users: readonly ApplicationEnterpriseUsageUserItem[];
}

/** Desktop 可见的认知符号。 */
export interface ApplicationEnterpriseNeuroSymbol {
  readonly id: string;
  readonly operator: string;
  readonly label: string;
  readonly K: { readonly entities: readonly string[] };
  readonly metadata: {
    readonly sourceType: string;
    readonly recordType: string;
    readonly workspaceId: string;
    readonly incidentId: string;
    readonly traceId: string;
    readonly stage: string;
    readonly decision: string;
    readonly teamRole: string;
    readonly agentName: string;
    readonly skillName: string;
    readonly skillVersion: string;
    readonly confidence: number;
  };
  readonly createdAt: number;
  readonly successRate: number;
  readonly activationCount: number;
}

/** Desktop 可见的认知规则。 */
export interface ApplicationEnterpriseNeuroRule {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly description: string;
  readonly bound_operator: string;
  readonly enabled: boolean;
}

/** 认知符号统计。 */
export interface ApplicationEnterpriseNeuroStats {
  readonly totalSymbols: number;
  readonly uniqueEntities: number;
  readonly avgSuccessRate: number;
  readonly competitionSymbols: number;
  readonly operatorDistribution: Readonly<Record<string, number>>;
}

/** 认知符号面板请求。 */
export interface ApplicationEnterpriseNeuroDashboardRequest {
  readonly limit: number;
}

/** 认知符号面板结果。 */
export interface ApplicationEnterpriseNeuroDashboardResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly stats: ApplicationEnterpriseNeuroStats;
  readonly symbols: readonly ApplicationEnterpriseNeuroSymbol[];
  readonly total: number;
  readonly rules: readonly ApplicationEnterpriseNeuroRule[];
}

/** 认知符号搜索请求。 */
export interface ApplicationEnterpriseNeuroSearchRequest {
  readonly query: string;
  readonly operator: string;
  readonly limit: number;
}

/** 认知符号搜索结果。 */
export interface ApplicationEnterpriseNeuroSearchResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly symbols: readonly ApplicationEnterpriseNeuroSymbol[];
  readonly total: number;
}

/** 认知符号 ID 请求。 */
export interface ApplicationEnterpriseNeuroSymbolRequest {
  readonly symbolId: string;
}

/** 认知符号删除结果。 */
export interface ApplicationEnterpriseNeuroRemoveResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly symbolId: string;
}

/** 认知符号维护计数。 */
export interface ApplicationEnterpriseNeuroMaintenanceSummary {
  readonly decayed: number;
  readonly pruned: number;
  readonly protected: number;
  readonly remaining: number;
  readonly timestamp: string;
}

/** 认知符号维护结果。 */
export interface ApplicationEnterpriseNeuroMaintenanceResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly result: ApplicationEnterpriseNeuroMaintenanceSummary;
}

/** 知识图谱面板请求。 */
export interface ApplicationEnterpriseKnowledgeGraphRequest {
  readonly limit: number;
}

/** 知识图谱统计。 */
export interface ApplicationEnterpriseKnowledgeGraphStats {
  readonly entities: number;
  readonly triples: number;
  readonly active_triples: number;
  readonly expired_triples: number;
  readonly competition_triples: number;
  readonly active_competition_triples: number;
}

/** 知识图谱节点。 */
export interface ApplicationEnterpriseKnowledgeGraphNode {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly degree: number;
}

/** 知识图谱边。 */
export interface ApplicationEnterpriseKnowledgeGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly label: string;
  readonly confidence: number;
  readonly current: boolean;
  readonly source_type: "competition" | "neuro" | "manual";
}

/** 知识图谱面板结果。 */
export interface ApplicationEnterpriseKnowledgeGraphResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly stats: ApplicationEnterpriseKnowledgeGraphStats;
  readonly graph: {
    readonly nodes: readonly ApplicationEnterpriseKnowledgeGraphNode[];
    readonly edges: readonly ApplicationEnterpriseKnowledgeGraphEdge[];
  };
}

/** 知识图谱实体请求。 */
export interface ApplicationEnterpriseKnowledgeGraphEntityRequest {
  readonly subject: string;
  readonly limit: number;
}

/** 知识图谱事实。 */
export interface ApplicationEnterpriseKnowledgeGraphFact {
  readonly direction: "incoming" | "outgoing";
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly valid_from: string;
  readonly valid_to: string;
  readonly confidence: number;
  readonly current: boolean;
  readonly source_type: "competition" | "neuro" | "manual";
}

/** 知识图谱实体查询结果。 */
export interface ApplicationEnterpriseKnowledgeGraphEntityResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA;
  readonly success: true;
  readonly subject: string;
  readonly facts: readonly ApplicationEnterpriseKnowledgeGraphFact[];
}

const ENTERPRISE_INSIGHTS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** 解析用量面板请求；输入未知值，返回固定分组和数量，额外字段或越界值时抛错。 */
export function parseApplicationEnterpriseUsageDashboardRequest(
  value: unknown,
): ApplicationEnterpriseUsageDashboardRequest {
  const record = requireExactRecord(value, ["groupBy", "limit"], "usage dashboard request");
  if (record.groupBy !== "hour" && record.groupBy !== "day" && record.groupBy !== "month") {
    throw new TypeError("Enterprise usage group is invalid.");
  }
  return { groupBy: record.groupBy, limit: requireInteger(record.limit, "Usage limit", 1, 90) };
}

/** 解析认知面板请求；输入未知值，返回数量限制，额外字段或越界值时抛错。 */
export function parseApplicationEnterpriseNeuroDashboardRequest(
  value: unknown,
): ApplicationEnterpriseNeuroDashboardRequest {
  const record = requireExactRecord(value, ["limit"], "neuro dashboard request");
  return { limit: requireInteger(record.limit, "Neuro limit", 1, 200) };
}

/** 解析认知搜索请求；输入未知值，返回规范文本、算子和数量，非法字段时抛错。 */
export function parseApplicationEnterpriseNeuroSearchRequest(
  value: unknown,
): ApplicationEnterpriseNeuroSearchRequest {
  const record = requireExactRecord(value, ["query", "operator", "limit"], "neuro search request");
  return {
    query: requireText(record.query, "Neuro query", 512),
    operator: requireText(record.operator, "Neuro operator", 80),
    limit: requireInteger(record.limit, "Neuro search limit", 1, 100),
  };
}

/** 解析认知符号 ID；输入未知值，返回稳定 ID，规则 ID、路径字符或额外字段时抛错。 */
export function parseApplicationEnterpriseNeuroSymbolRequest(
  value: unknown,
): ApplicationEnterpriseNeuroSymbolRequest {
  const record = requireExactRecord(value, ["symbolId"], "neuro symbol request");
  const symbolId = requireText(record.symbolId, "Neuro symbol id", 128);
  if (!ENTERPRISE_INSIGHTS_ID_PATTERN.test(symbolId) || symbolId.startsWith("rule-")) {
    throw new TypeError("Neuro symbol id is invalid.");
  }
  return { symbolId };
}

/** 解析知识图谱面板请求；输入未知值，返回数量限制，额外字段或越界值时抛错。 */
export function parseApplicationEnterpriseKnowledgeGraphRequest(
  value: unknown,
): ApplicationEnterpriseKnowledgeGraphRequest {
  const record = requireExactRecord(value, ["limit"], "knowledge graph request");
  return { limit: requireInteger(record.limit, "Knowledge graph limit", 1, 500) };
}

/** 解析知识图谱实体请求；输入未知值，返回实体和数量，空文本或额外字段时抛错。 */
export function parseApplicationEnterpriseKnowledgeGraphEntityRequest(
  value: unknown,
): ApplicationEnterpriseKnowledgeGraphEntityRequest {
  const record = requireExactRecord(value, ["subject", "limit"], "knowledge graph entity request");
  const subject = requireText(record.subject, "Knowledge graph subject", 256);
  if (!subject) throw new TypeError("Knowledge graph subject is required.");
  return {
    subject,
    limit: requireInteger(record.limit, "Knowledge graph entity limit", 1, 100),
  };
}

/** 校验精确普通对象；输入未知值、字段和标签，返回记录，结构漂移时抛错。 */
function requireExactRecord(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Enterprise ${label} is invalid.`);
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== fields.length || Object.keys(record).some((field) => !fields.includes(field))) {
    throw new TypeError(`Enterprise ${label} fields are invalid.`);
  }
  return record;
}

/** 校验有界整数；输入值、标签和范围，返回整数，类型或范围无效时抛错。 */
function requireInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

/** 校验有界无控制字符文本；输入值、标签和最大长度，返回去空格文本，非法时抛错。 */
function requireText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || value.length > maximumLength || /[\u0000\u007F]/.test(value)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value.trim();
}
