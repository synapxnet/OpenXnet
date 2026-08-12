import { existsSync, lstatSync } from "node:fs";
import { request as createHttpRequest } from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
  parseApplicationEnterpriseKnowledgeGraphEntityRequest,
  parseApplicationEnterpriseKnowledgeGraphRequest,
  parseApplicationEnterpriseNeuroDashboardRequest,
  parseApplicationEnterpriseNeuroSearchRequest,
  parseApplicationEnterpriseNeuroSymbolRequest,
  parseApplicationEnterpriseUsageDashboardRequest,
  type ApplicationEnterpriseKnowledgeGraphEdge,
  type ApplicationEnterpriseKnowledgeGraphEntityResult,
  type ApplicationEnterpriseKnowledgeGraphFact,
  type ApplicationEnterpriseKnowledgeGraphNode,
  type ApplicationEnterpriseKnowledgeGraphResult,
  type ApplicationEnterpriseNeuroDashboardResult,
  type ApplicationEnterpriseNeuroMaintenanceResult,
  type ApplicationEnterpriseNeuroRemoveResult,
  type ApplicationEnterpriseNeuroRule,
  type ApplicationEnterpriseNeuroSearchResult,
  type ApplicationEnterpriseNeuroStats,
  type ApplicationEnterpriseNeuroSymbol,
  type ApplicationEnterpriseUsageDashboardRequest,
  type ApplicationEnterpriseUsageDashboardResult,
  type ApplicationEnterpriseUsageModelItem,
  type ApplicationEnterpriseUsageSummary,
  type ApplicationEnterpriseUsageTrendItem,
  type ApplicationEnterpriseUsageUserItem,
} from "../contracts/application-enterprise-insights-runtime";
import {
  APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA,
  type ApplicationCompetitionKnowledgeProjectionRequest,
  type ApplicationCompetitionKnowledgeProjectionResult,
  type ApplicationCompetitionKnowledgePurgeRequest,
} from "../contracts/application-competition-knowledge";
import type { ExecutionEngineLease } from "../workers/execution-engine-supervisor";

const MAX_USAGE_DATABASE_BYTES = 512 * 1024 * 1024;
const MAX_INSIGHTS_REQUEST_BYTES = 64 * 1024;
const MAX_COMPETITION_KNOWLEDGE_REQUEST_BYTES = 512 * 1024;
const MAX_INSIGHTS_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_USAGE_DIMENSIONS = 500;
const INSIGHTS_PATHS = Object.freeze({
  neuroDashboard: "/v1/desktop/enterprise-insights/neuro/dashboard",
  neuroSearch: "/v1/desktop/enterprise-insights/neuro/search",
  neuroRemove: "/v1/desktop/enterprise-insights/neuro/remove",
  neuroMaintenance: "/v1/desktop/enterprise-insights/neuro/maintenance",
  knowledgeGraphDashboard: "/v1/desktop/enterprise-insights/kg/dashboard",
  knowledgeGraphQuery: "/v1/desktop/enterprise-insights/kg/query",
  competitionKnowledgeSync: "/v1/desktop/enterprise-insights/competition/sync",
  competitionKnowledgePurge: "/v1/desktop/enterprise-insights/competition/purge",
});

/** Enterprise Insights Runtime 的诊断输出。 */
export interface ApplicationEnterpriseInsightsRuntimeLogger {
  warn(message: string, error?: unknown): void;
}

/** Enterprise Insights Runtime 构造依赖。 */
export interface ApplicationEnterpriseInsightsRuntimeOptions {
  readonly userDataDirectory: string;
  readonly token: string;
  readonly acquireEngine: () => Promise<ExecutionEngineLease>;
  readonly logger?: ApplicationEnterpriseInsightsRuntimeLogger;
}

/** 读取 Main-owned 用量统计并通过请求租约访问私有 Neuro/KG Engine。 */
export class ApplicationEnterpriseInsightsRuntimeService {
  private readonly usageDatabasePath: string;
  private readonly logger: ApplicationEnterpriseInsightsRuntimeLogger;

  /** 创建企业洞察 Runtime；输入用户目录、私有 token 和租约工厂，仅计算路径，不读库或启动引擎。 */
  public constructor(private readonly options: ApplicationEnterpriseInsightsRuntimeOptions) {
    if (!options.token.trim()) throw new Error("Enterprise Insights Runtime requires a non-empty engine token.");
    this.usageDatabasePath = path.join(path.resolve(options.userDataDirectory), "usage_tracking.db");
    this.logger = options.logger ?? console;
  }

  /** 读取用量面板；输入分组和数量，返回固定聚合，数据库缺失时返回空结果且不创建文件或启动 Python。 */
  public async loadUsageDashboard(value: unknown): Promise<ApplicationEnterpriseUsageDashboardResult> {
    const request = parseApplicationEnterpriseUsageDashboardRequest(value);
    if (!existsSync(this.usageDatabasePath)) return createEmptyUsageDashboard();
    const info = lstatSync(this.usageDatabasePath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_USAGE_DATABASE_BYTES) {
      throw new Error("Enterprise usage database is invalid.");
    }
    try {
      return this.readUsageDashboard(request);
    } catch (error) {
      this.logger.warn("Enterprise usage dashboard could not be read.", error);
      throw new Error("Enterprise usage dashboard is unavailable.");
    }
  }

  /** 读取认知符号面板；输入数量限制，返回脱敏统计、符号和规则，验证失败时不获取引擎租约。 */
  public async loadNeuroDashboard(value: unknown): Promise<ApplicationEnterpriseNeuroDashboardResult> {
    const request = parseApplicationEnterpriseNeuroDashboardRequest(value);
    return parseNeuroDashboardResponse(await this.requestEngine(INSIGHTS_PATHS.neuroDashboard, request), request.limit);
  }

  /** 搜索认知符号；输入文本、算子和数量，返回纯读取结果，验证失败时不获取引擎租约。 */
  public async searchNeuroSymbols(value: unknown): Promise<ApplicationEnterpriseNeuroSearchResult> {
    const request = parseApplicationEnterpriseNeuroSearchRequest(value);
    return parseNeuroSearchResponse(await this.requestEngine(INSIGHTS_PATHS.neuroSearch, request), request.limit);
  }

  /** 删除普通认知符号；输入稳定 ID，返回删除结果，规则 ID 和非法字段在引擎激活前拒绝。 */
  public async removeNeuroSymbol(value: unknown): Promise<ApplicationEnterpriseNeuroRemoveResult> {
    const request = parseApplicationEnterpriseNeuroSymbolRequest(value);
    return parseNeuroRemoveResponse(
      await this.requestEngine(INSIGHTS_PATHS.neuroRemove, { symbol_id: request.symbolId }),
      request.symbolId,
    );
  }

  /** 执行认知符号维护；无输入，返回固定计数，操作由 Execution Engine 单一写入者完成。 */
  public async runNeuroMaintenance(): Promise<ApplicationEnterpriseNeuroMaintenanceResult> {
    return parseNeuroMaintenanceResponse(await this.requestEngine(INSIGHTS_PATHS.neuroMaintenance, {}));
  }

  /** 读取知识图谱面板；输入边数量，返回脱敏统计、节点和边，验证失败时不获取引擎租约。 */
  public async loadKnowledgeGraph(value: unknown): Promise<ApplicationEnterpriseKnowledgeGraphResult> {
    const request = parseApplicationEnterpriseKnowledgeGraphRequest(value);
    return parseKnowledgeGraphResponse(
      await this.requestEngine(INSIGHTS_PATHS.knowledgeGraphDashboard, request),
      request.limit,
    );
  }

  /** 查询知识图谱实体；输入实体和数量，返回脱敏事实，验证失败时不获取引擎租约。 */
  public async queryKnowledgeGraphEntity(value: unknown): Promise<ApplicationEnterpriseKnowledgeGraphEntityResult> {
    const request = parseApplicationEnterpriseKnowledgeGraphEntityRequest(value);
    return parseKnowledgeGraphEntityResponse(
      await this.requestEngine(INSIGHTS_PATHS.knowledgeGraphQuery, request),
      request.subject,
      request.limit,
    );
  }

  /** 同步比赛知识；输入 Main 构建的脱敏事件投影，返回神经符号和图谱幂等计数。 */
  public async synchronizeCompetitionKnowledge(
    request: ApplicationCompetitionKnowledgeProjectionRequest,
  ): Promise<ApplicationCompetitionKnowledgeProjectionResult> {
    return parseCompetitionKnowledgeProjectionResponse(await this.requestEngine(
      INSIGHTS_PATHS.competitionKnowledgeSync,
      request,
      MAX_COMPETITION_KNOWLEDGE_REQUEST_BYTES,
    ));
  }

  /** 清理比赛演示知识；输入明确投影引用，返回已清理符号和事实计数。 */
  public async purgeCompetitionKnowledge(
    request: ApplicationCompetitionKnowledgePurgeRequest,
  ): Promise<ApplicationCompetitionKnowledgeProjectionResult> {
    return parseCompetitionKnowledgeProjectionResponse(await this.requestEngine(
      INSIGHTS_PATHS.competitionKnowledgePurge,
      request,
      MAX_COMPETITION_KNOWLEDGE_REQUEST_BYTES,
    ));
  }

  /** 打开只读 SQLite 并执行固定聚合；输入请求，返回面板，schema 漂移或读取失败时抛错。 */
  private readUsageDashboard(request: ApplicationEnterpriseUsageDashboardRequest): ApplicationEnterpriseUsageDashboardResult {
    const database = new DatabaseSync(this.usageDatabasePath, { readOnly: true, timeout: 1_000 });
    try {
      const table = database.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usage_records'",
      ).get();
      if (!table) return createEmptyUsageDashboard();
      const summaryRow = database.prepare(
        "SELECT COUNT(*) AS total_requests, COALESCE(SUM(total_tokens), 0) AS total_tokens, "
        + "COALESCE(SUM(input_tokens), 0) AS total_input, COALESCE(SUM(output_tokens), 0) AS total_output, "
        + "COALESCE(SUM(cache_read_tokens), 0) AS total_cache_read, "
        + "COALESCE(SUM(cache_creation_tokens), 0) AS total_cache_creation, "
        + "COALESCE(SUM(cost_usd), 0) AS total_cost, COALESCE(AVG(duration_ms), 0) AS avg_duration_ms, "
        + "COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) AS success_count, "
        + "COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) AS failure_count FROM usage_records",
      ).get() as Readonly<Record<string, unknown>>;
      const timeFormat = request.groupBy === "hour"
        ? "%Y-%m-%d %H:00"
        : request.groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";
      const trendRows = database.prepare(
        `SELECT strftime('${timeFormat}', timestamp) AS period, COUNT(*) AS requests, `
        + "COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens, "
        + "COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, "
        + "COALESCE(SUM(cache_creation_tokens), 0) AS cache_creation_tokens, "
        + "COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(cost_usd), 0) AS cost "
        + "FROM usage_records GROUP BY period ORDER BY period DESC LIMIT ?",
      ).all(request.limit) as readonly Readonly<Record<string, unknown>>[];
      const modelRows = database.prepare(
        "SELECT model, COALESCE(provider, '') AS provider, COUNT(*) AS requests, "
        + "COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens, "
        + "COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, "
        + "COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(cost_usd), 0) AS cost "
        + "FROM usage_records GROUP BY model, provider ORDER BY total_tokens DESC LIMIT ?",
      ).all(MAX_USAGE_DIMENSIONS) as readonly Readonly<Record<string, unknown>>[];
      const userRows = database.prepare(
        "SELECT user_id, COUNT(*) AS requests, COALESCE(SUM(input_tokens), 0) AS input_tokens, "
        + "COALESCE(SUM(output_tokens), 0) AS output_tokens, "
        + "COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, "
        + "COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(cost_usd), 0) AS cost, "
        + "COALESCE(AVG(duration_ms), 0) AS avg_duration_ms "
        + "FROM usage_records GROUP BY user_id ORDER BY total_tokens DESC LIMIT ?",
      ).all(MAX_USAGE_DIMENSIONS) as readonly Readonly<Record<string, unknown>>[];
      return {
        schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
        success: true,
        summary: parseUsageSummary(summaryRow),
        trend: trendRows.map(parseUsageTrendItem),
        models: modelRows.map(parseUsageModelItem),
        users: userRows.map(parseUsageUserItem),
      };
    } finally {
      database.close();
    }
  }

  /** 发送一次私有认证请求；输入固定路径和有界载荷，返回 JSON，始终释放引擎租约。 */
  private async requestEngine(
    requestPath: string,
    payload: unknown,
    maximumRequestBytes = MAX_INSIGHTS_REQUEST_BYTES,
  ): Promise<unknown> {
    /** 发送私有认证 JSON；输入路径、载荷和字节预算，返回解析结果并始终释放租约。 */
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    if (body.length > maximumRequestBytes) throw new Error("Enterprise Insights request is too large.");
    const lease = await this.options.acquireEngine();
    const target = new URL(requestPath, lease.origin);
    try {
      return await new Promise<unknown>((resolve, reject) => {
        let settled = false;
        /** 完成私有请求；输入回调和值，无返回，重复完成时忽略。 */
        function settle(callback: (value: unknown) => void, value: unknown): void {
          if (settled) return;
          settled = true;
          callback(value);
        }
        const upstream = createHttpRequest(target, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.options.token}`,
            "Cache-Control": "no-store",
            "Content-Length": String(body.length),
            "Content-Type": "application/json; charset=utf-8",
            Host: target.host,
          },
        }, (response) => {
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          response.on("data", (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.length;
            if (totalBytes > MAX_INSIGHTS_RESPONSE_BYTES) {
              const error = new Error("Enterprise Insights response is too large.");
              response.destroy(error);
              upstream.destroy(error);
              settle(reject, error);
              return;
            }
            chunks.push(buffer);
          });
          response.once("end", () => {
            const statusCode = response.statusCode ?? 500;
            if (statusCode < 200 || statusCode >= 300) {
              const validationFields = summarizeValidationFields(Buffer.concat(chunks));
              const suffix = validationFields.length > 0 ? ` Fields: ${validationFields.join(", ")}.` : "";
              settle(reject, new Error(`Enterprise Insights engine returned HTTP ${statusCode}.${suffix}`));
              return;
            }
            try {
              settle(resolve, JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
            } catch {
              settle(reject, new Error("Enterprise Insights engine returned invalid JSON."));
            }
          });
        });
        upstream.setTimeout(15_000, () => {
          const error = new Error("Enterprise Insights engine request timed out.");
          upstream.destroy(error);
          settle(reject, error);
        });
        upstream.once("error", () => settle(reject, new Error("Enterprise Insights engine request failed.")));
        upstream.end(body);
      });
    } finally {
      lease.release();
    }
  }
}

/**
 * 提取引擎校验错误的字段路径；输入响应字节，仅返回位置而不暴露字段值或错误正文。
 *
 * @param body 引擎错误响应字节
 * @return 最多八个去重字段路径
 */
function summarizeValidationFields(body: Buffer): string[] {
  try {
    const value = JSON.parse(body.toString("utf8")) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    if (!Array.isArray(record.detail)) return [];
    const fields: string[] = [];
    for (const item of record.detail) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
      const detail = item as Record<string, unknown>;
      if (!Array.isArray(detail.loc)) continue;
      const field = detail.loc
        .filter((part): part is string | number => typeof part === "string" || typeof part === "number")
        .map(String)
        .join(".")
        .slice(0, 256);
      if (field && !fields.includes(field)) fields.push(field);
      if (fields.length >= 8) break;
    }
    return fields;
  } catch {
    return [];
  }
}

/** 创建空用量面板；无输入，返回全零结构，不访问数据库或引擎。 */
function createEmptyUsageDashboard(): ApplicationEnterpriseUsageDashboardResult {
  return {
    schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
    success: true,
    summary: {
      total_requests: 0,
      total_tokens: 0,
      total_input: 0,
      total_output: 0,
      total_cache_read: 0,
      total_cache_creation: 0,
      total_cost: 0,
      avg_duration_ms: 0,
      success_count: 0,
      failure_count: 0,
    },
    trend: [],
    models: [],
    users: [],
  };
}

/** 解析用量汇总行；输入 SQLite 行，返回非负有界数值，非法字段时抛错。 */
function parseUsageSummary(row: Readonly<Record<string, unknown>>): ApplicationEnterpriseUsageSummary {
  return {
    total_requests: readCount(row.total_requests, "usage requests"),
    total_tokens: readCount(row.total_tokens, "usage tokens"),
    total_input: readCount(row.total_input, "usage input"),
    total_output: readCount(row.total_output, "usage output"),
    total_cache_read: readCount(row.total_cache_read, "usage cache read"),
    total_cache_creation: readCount(row.total_cache_creation, "usage cache creation"),
    total_cost: readNumber(row.total_cost, "usage cost", 0, Number.MAX_SAFE_INTEGER),
    avg_duration_ms: readNumber(row.avg_duration_ms, "usage duration", 0, Number.MAX_SAFE_INTEGER),
    success_count: readCount(row.success_count, "usage successes"),
    failure_count: readCount(row.failure_count, "usage failures"),
  };
}

/** 解析用量趋势行；输入 SQLite 行，返回固定趋势对象，非法字段时抛错。 */
function parseUsageTrendItem(row: Readonly<Record<string, unknown>>): ApplicationEnterpriseUsageTrendItem {
  return {
    period: readText(row.period, "usage period", 32),
    requests: readCount(row.requests, "usage trend requests"),
    input_tokens: readCount(row.input_tokens, "usage trend input"),
    output_tokens: readCount(row.output_tokens, "usage trend output"),
    cache_read_tokens: readCount(row.cache_read_tokens, "usage trend cache read"),
    cache_creation_tokens: readCount(row.cache_creation_tokens, "usage trend cache creation"),
    total_tokens: readCount(row.total_tokens, "usage trend total"),
    cost: readNumber(row.cost, "usage trend cost", 0, Number.MAX_SAFE_INTEGER),
  };
}

/** 解析模型用量行；输入 SQLite 行，返回固定分组对象，非法字段时抛错。 */
function parseUsageModelItem(row: Readonly<Record<string, unknown>>): ApplicationEnterpriseUsageModelItem {
  return {
    model: readText(row.model, "usage model", 256),
    provider: readText(row.provider, "usage provider", 256),
    requests: readCount(row.requests, "model requests"),
    input_tokens: readCount(row.input_tokens, "model input"),
    output_tokens: readCount(row.output_tokens, "model output"),
    cache_read_tokens: readCount(row.cache_read_tokens, "model cache read"),
    total_tokens: readCount(row.total_tokens, "model total"),
    cost: readNumber(row.cost, "model cost", 0, Number.MAX_SAFE_INTEGER),
  };
}

/** 解析用户用量行；输入 SQLite 行，返回固定分组对象，非法字段时抛错。 */
function parseUsageUserItem(row: Readonly<Record<string, unknown>>): ApplicationEnterpriseUsageUserItem {
  return {
    user_id: readText(row.user_id, "usage user", 256),
    requests: readCount(row.requests, "user requests"),
    input_tokens: readCount(row.input_tokens, "user input"),
    output_tokens: readCount(row.output_tokens, "user output"),
    cache_read_tokens: readCount(row.cache_read_tokens, "user cache read"),
    total_tokens: readCount(row.total_tokens, "user total"),
    cost: readNumber(row.cost, "user cost", 0, Number.MAX_SAFE_INTEGER),
    avg_duration_ms: readNumber(row.avg_duration_ms, "user duration", 0, Number.MAX_SAFE_INTEGER),
  };
}

/** 解析认知面板响应；输入未知值和限制，返回 typed 结果，结构漂移或超限时抛错。 */
function parseNeuroDashboardResponse(value: unknown, limit: number): ApplicationEnterpriseNeuroDashboardResult {
  const record = requireInsightsResponse(value, ["schema", "success", "stats", "symbols", "total", "rules"]);
  const symbols = readArray(record.symbols, "neuro symbols", limit).map(parseNeuroSymbol);
  const rules = readArray(record.rules, "neuro rules", 100).map(parseNeuroRule);
  const total = readCount(record.total, "neuro total");
  if (total < symbols.length) throw new Error("Enterprise neuro total is invalid.");
  return {
    schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
    success: true,
    stats: parseNeuroStats(record.stats),
    symbols,
    total,
    rules,
  };
}

/** 解析认知搜索响应；输入未知值和限制，返回 typed 结果，结构漂移或超限时抛错。 */
function parseNeuroSearchResponse(value: unknown, limit: number): ApplicationEnterpriseNeuroSearchResult {
  const record = requireInsightsResponse(value, ["schema", "success", "symbols", "total"]);
  const symbols = readArray(record.symbols, "neuro search symbols", limit).map(parseNeuroSymbol);
  const total = readCount(record.total, "neuro search total");
  if (total < symbols.length) throw new Error("Enterprise neuro search total is invalid.");
  return { schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA, success: true, symbols, total };
}

/** 解析认知删除响应；输入未知值和预期 ID，返回 typed 结果，ID 漂移时抛错。 */
function parseNeuroRemoveResponse(value: unknown, symbolId: string): ApplicationEnterpriseNeuroRemoveResult {
  const record = requireInsightsResponse(value, ["schema", "success", "symbolId"]);
  if (record.symbolId !== symbolId) throw new Error("Enterprise neuro remove response is invalid.");
  return { schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA, success: true, symbolId };
}

/** 解析维护响应；输入未知值，返回 typed 计数，结构漂移或负数时抛错。 */
function parseNeuroMaintenanceResponse(value: unknown): ApplicationEnterpriseNeuroMaintenanceResult {
  const record = requireInsightsResponse(value, ["schema", "success", "result"]);
  const result = requireExactObject(record.result, ["decayed", "pruned", "protected", "remaining", "timestamp"], "maintenance");
  return {
    schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
    success: true,
    result: {
      decayed: readCount(result.decayed, "maintenance decayed"),
      pruned: readCount(result.pruned, "maintenance pruned"),
      protected: readCount(result.protected, "maintenance protected"),
      remaining: readCount(result.remaining, "maintenance remaining"),
      timestamp: readText(result.timestamp, "maintenance timestamp", 64),
    },
  };
}

/** 解析知识图谱面板响应；输入未知值和边限制，返回 typed 图，结构漂移或超限时抛错。 */
function parseKnowledgeGraphResponse(value: unknown, limit: number): ApplicationEnterpriseKnowledgeGraphResult {
  const record = requireInsightsResponse(value, ["schema", "success", "stats", "graph"]);
  const stats = requireExactObject(
    record.stats,
    ["entities", "triples", "active_triples", "expired_triples", "competition_triples", "active_competition_triples"],
    "graph stats",
  );
  const graph = requireExactObject(record.graph, ["nodes", "edges"], "graph");
  return {
    schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
    success: true,
    stats: {
      entities: readCount(stats.entities, "graph entities"),
      triples: readCount(stats.triples, "graph triples"),
      active_triples: readCount(stats.active_triples, "graph active triples"),
      expired_triples: readCount(stats.expired_triples, "graph expired triples"),
      competition_triples: readCount(stats.competition_triples, "graph competition triples"),
      active_competition_triples: readCount(stats.active_competition_triples, "graph active competition triples"),
    },
    graph: {
      nodes: readArray(graph.nodes, "graph nodes", limit * 2).map(parseKnowledgeGraphNode),
      edges: readArray(graph.edges, "graph edges", limit).map(parseKnowledgeGraphEdge),
    },
  };
}

/** 解析知识图谱实体响应；输入未知值、实体和限制，返回 typed 事实，实体漂移或超限时抛错。 */
function parseKnowledgeGraphEntityResponse(
  value: unknown,
  subject: string,
  limit: number,
): ApplicationEnterpriseKnowledgeGraphEntityResult {
  const record = requireInsightsResponse(value, ["schema", "success", "subject", "facts"]);
  if (record.subject !== subject) throw new Error("Enterprise knowledge graph subject is invalid.");
  return {
    schema: APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA,
    success: true,
    subject,
    facts: readArray(record.facts, "knowledge graph facts", limit).map(parseKnowledgeGraphFact),
  };
}

/** 解析认知符号；输入未知值，返回最小公开字段，复杂引用或越界值时抛错。 */
function parseNeuroSymbol(value: unknown): ApplicationEnterpriseNeuroSymbol {
  const record = requireExactObject(
    value,
    ["id", "operator", "label", "K", "metadata", "createdAt", "successRate", "activationCount"],
    "symbol",
  );
  const knowledge = requireExactObject(record.K, ["entities"], "symbol knowledge");
  const metadata = requireExactObject(record.metadata, [
    "sourceType",
    "recordType",
    "workspaceId",
    "incidentId",
    "traceId",
    "stage",
    "decision",
    "teamRole",
    "agentName",
    "skillName",
    "skillVersion",
    "confidence",
  ], "symbol metadata");
  return {
    id: readText(record.id, "symbol id", 128, true),
    operator: readText(record.operator, "symbol operator", 80, true),
    label: readText(record.label, "symbol label", 2000),
    K: { entities: readArray(knowledge.entities, "symbol entities", 100).map((item) => readText(item, "symbol entity", 256, true)) },
    metadata: {
      sourceType: readText(metadata.sourceType, "symbol source type", 32),
      recordType: readText(metadata.recordType, "symbol record type", 64),
      workspaceId: readText(metadata.workspaceId, "symbol workspace", 256),
      incidentId: readText(metadata.incidentId, "symbol incident", 256),
      traceId: readText(metadata.traceId, "symbol trace", 256),
      stage: readText(metadata.stage, "symbol stage", 64),
      decision: readText(metadata.decision, "symbol decision", 64),
      teamRole: readText(metadata.teamRole, "symbol team role", 32),
      agentName: readText(metadata.agentName, "symbol agent", 256),
      skillName: readText(metadata.skillName, "symbol skill", 128),
      skillVersion: readText(metadata.skillVersion, "symbol skill version", 64),
      confidence: readNumber(metadata.confidence, "symbol decision confidence", 0, 1),
    },
    createdAt: readNumber(record.createdAt, "symbol timestamp", 0, Number.MAX_SAFE_INTEGER),
    successRate: readNumber(record.successRate, "symbol success rate", 0, 1),
    activationCount: readCount(record.activationCount, "symbol activation count"),
  };
}

/** 解析认知规则；输入未知值，返回最小公开字段，复杂配置或结构漂移时抛错。 */
function parseNeuroRule(value: unknown): ApplicationEnterpriseNeuroRule {
  const record = requireExactObject(value, ["id", "name", "domain", "description", "bound_operator", "enabled"], "rule");
  if (typeof record.enabled !== "boolean") throw new Error("Enterprise neuro rule status is invalid.");
  return {
    id: readText(record.id, "rule id", 128, true),
    name: readText(record.name, "rule name", 160, true),
    domain: readText(record.domain, "rule domain", 80),
    description: readText(record.description, "rule description", 4000),
    bound_operator: readText(record.bound_operator, "rule operator", 80),
    enabled: record.enabled,
  };
}

/** 解析认知统计；输入未知值，返回固定统计，未知算子或越界数值时抛错。 */
function parseNeuroStats(value: unknown): ApplicationEnterpriseNeuroStats {
  const record = requireExactObject(
    value,
    ["totalSymbols", "uniqueEntities", "avgSuccessRate", "competitionSymbols", "operatorDistribution"],
    "neuro stats",
  );
  const distribution = requirePlainObject(record.operatorDistribution, "operator distribution");
  if (Object.keys(distribution).length > 100) throw new Error("Enterprise operator distribution is too large.");
  const operatorDistribution: Record<string, number> = {};
  for (const [operator, count] of Object.entries(distribution)) {
    operatorDistribution[readText(operator, "operator", 80, true)] = readCount(count, "operator count");
  }
  return {
    totalSymbols: readCount(record.totalSymbols, "neuro symbols"),
    uniqueEntities: readCount(record.uniqueEntities, "neuro entities"),
    avgSuccessRate: readNumber(record.avgSuccessRate, "neuro success rate", 0, 1),
    competitionSymbols: readCount(record.competitionSymbols, "competition symbols"),
    operatorDistribution,
  };
}

/** 解析知识图谱节点；输入未知值，返回公开节点，路径型或越界字段时抛错。 */
function parseKnowledgeGraphNode(value: unknown): ApplicationEnterpriseKnowledgeGraphNode {
  const record = requireExactObject(value, ["id", "label", "type", "degree"], "graph node");
  return {
    id: readText(record.id, "graph node id", 256, true),
    label: readText(record.label, "graph node label", 256, true),
    type: readText(record.type, "graph node type", 80),
    degree: readCount(record.degree, "graph node degree"),
  };
}

/** 解析知识图谱边；输入未知值，返回公开边，结构漂移或越界字段时抛错。 */
function parseKnowledgeGraphEdge(value: unknown): ApplicationEnterpriseKnowledgeGraphEdge {
  const record = requireExactObject(
    value,
    ["id", "source", "target", "label", "confidence", "current", "source_type"],
    "graph edge",
  );
  if (typeof record.current !== "boolean") throw new Error("Enterprise graph edge state is invalid.");
  const sourceType = readKnowledgeSourceType(record.source_type, "graph edge source type");
  return {
    id: readText(record.id, "graph edge id", 128, true),
    source: readText(record.source, "graph edge source", 256, true),
    target: readText(record.target, "graph edge target", 256, true),
    label: readText(record.label, "graph edge label", 256),
    confidence: readNumber(record.confidence, "graph edge confidence", 0, 1),
    current: record.current,
    source_type: sourceType,
  };
}

/** 解析知识图谱事实；输入未知值，返回公开事实，来源字段或结构漂移时抛错。 */
function parseKnowledgeGraphFact(value: unknown): ApplicationEnterpriseKnowledgeGraphFact {
  const record = requireExactObject(
    value,
    ["direction", "subject", "predicate", "object", "valid_from", "valid_to", "confidence", "current", "source_type"],
    "graph fact",
  );
  if ((record.direction !== "incoming" && record.direction !== "outgoing") || typeof record.current !== "boolean") {
    throw new Error("Enterprise graph fact state is invalid.");
  }
  return {
    direction: record.direction,
    subject: readText(record.subject, "graph fact subject", 256, true),
    predicate: readText(record.predicate, "graph fact predicate", 256, true),
    object: readText(record.object, "graph fact object", 256, true),
    valid_from: readText(record.valid_from, "graph fact valid from", 64),
    valid_to: readText(record.valid_to, "graph fact valid to", 64),
    confidence: readNumber(record.confidence, "graph fact confidence", 0, 1),
    current: record.current,
    source_type: readKnowledgeSourceType(record.source_type, "graph fact source type"),
  };
}

/** 解析比赛投影响应；输入未知引擎值，返回固定计数，字段漂移时抛错。 */
function parseCompetitionKnowledgeProjectionResponse(
  value: unknown,
): ApplicationCompetitionKnowledgeProjectionResult {
  const record = requireExactObject(
    value,
    ["schema", "success", "symbols", "activeFacts", "invalidatedFacts"],
    "competition knowledge response",
  );
  if (record.schema !== APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA || record.success !== true) {
    throw new Error("Enterprise competition knowledge response is invalid.");
  }
  return {
    schema: APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA,
    success: true,
    symbols: readCount(record.symbols, "competition knowledge symbols"),
    activeFacts: readCount(record.activeFacts, "competition knowledge active facts"),
    invalidatedFacts: readCount(record.invalidatedFacts, "competition knowledge invalidated facts"),
  };
}

/** 解析知识来源类别；输入未知值和标签，返回固定联合类型，未知来源时抛错。 */
function readKnowledgeSourceType(value: unknown, label: string): "competition" | "neuro" | "manual" {
  if (value !== "competition" && value !== "neuro" && value !== "manual") {
    throw new Error(`Enterprise Insights ${label} is invalid.`);
  }
  return value;
}

/** 校验 Insights 顶层响应；输入未知值和字段，返回记录，schema、成功标志或字段漂移时抛错。 */
function requireInsightsResponse(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const record = requireExactObject(value, fields, "response");
  if (record.schema !== APPLICATION_ENTERPRISE_INSIGHTS_SCHEMA || record.success !== true) {
    throw new Error("Enterprise Insights response is invalid.");
  }
  return record;
}

/** 校验精确对象；输入未知值、字段和标签，返回记录，结构漂移时抛错。 */
function requireExactObject(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  const record = requirePlainObject(value, label);
  if (Object.keys(record).length !== fields.length || Object.keys(record).some((field) => !fields.includes(field))) {
    throw new Error(`Enterprise Insights ${label} fields are invalid.`);
  }
  return record;
}

/** 校验普通对象；输入未知值和标签，返回记录，数组或空值时抛错。 */
function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Enterprise Insights ${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

/** 校验有界数组；输入未知值、标签和数量，返回数组，类型或数量越界时抛错。 */
function readArray(value: unknown, label: string, maximumItems: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new Error(`Enterprise Insights ${label} is invalid.`);
  }
  return value;
}

/** 读取非负安全整数；输入值和标签，返回整数，小数、负数或溢出时抛错。 */
function readCount(value: unknown, label: string): number {
  const number = readNumber(value, label, 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(number)) throw new Error(`Enterprise Insights ${label} is invalid.`);
  return number;
}

/** 读取有界数值；输入值、标签和范围，返回数值，非有限或越界时抛错。 */
function readNumber(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Enterprise Insights ${label} is invalid.`);
  }
  return value;
}

/** 读取有界文本；输入值、标签、长度和必填标志，返回文本，控制字符或空必填值时抛错。 */
function readText(value: unknown, label: string, maximumLength: number, required = false): string {
  if (typeof value !== "string" || value.length > maximumLength || /[\u0000\u007F]/.test(value)) {
    throw new Error(`Enterprise Insights ${label} is invalid.`);
  }
  const normalized = value.trim();
  if (required && !normalized) throw new Error(`Enterprise Insights ${label} is required.`);
  return normalized;
}
