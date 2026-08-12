import { request as createHttpRequest } from "node:http";

import {
  APPLICATION_KNOWLEDGE_BASE_MUTATION_SCHEMA,
  APPLICATION_KNOWLEDGE_BASE_QUERY_SCHEMA,
  APPLICATION_KNOWLEDGE_BASE_STATUS_SCHEMA,
  parseApplicationKnowledgeBaseQueryRequest,
  parseApplicationKnowledgeBaseScopeRequest,
  type ApplicationKnowledgeBaseMutationResult,
  type ApplicationKnowledgeBaseQueryItem,
  type ApplicationKnowledgeBaseQueryResult,
  type ApplicationKnowledgeBaseStatus,
  type ApplicationKnowledgeBaseStatusValue,
} from "../contracts/application-knowledge-base-runtime";
import type { ExecutionEngineLease } from "../workers/execution-engine-supervisor";

const MAX_KNOWLEDGE_BASE_REQUEST_BYTES = 64 * 1024;
const MAX_KNOWLEDGE_BASE_RESPONSE_BYTES = 2 * 1024 * 1024;
const KNOWLEDGE_BASE_PATHS = Object.freeze({
  build: "/v1/desktop/knowledge-base/build",
  status: "/v1/desktop/knowledge-base/status",
  remove: "/v1/desktop/knowledge-base/remove",
  query: "/v1/desktop/knowledge-base/query",
});
const KNOWLEDGE_BASE_STATUSES = new Set<ApplicationKnowledgeBaseStatusValue>([
  "not_found",
  "processing",
  "completed",
  "failed",
]);

/** Main 知识库运行时依赖。 */
export interface ApplicationKnowledgeBaseRuntimeOptions {
  readonly token: string;
  readonly acquireEngine: () => Promise<ExecutionEngineLease>;
}

/** 通过请求租约访问私有 Execution Engine 的知识库运行时。 */
export class ApplicationKnowledgeBaseRuntimeService {
  /** 创建知识库运行时；输入私有 token 和租约工厂，无返回，不提前启动引擎。 */
  public constructor(private readonly options: ApplicationKnowledgeBaseRuntimeOptions) {
    if (!options.token.trim()) {
      throw new Error("Application knowledge base runtime requires a non-empty engine token.");
    }
  }

  /** 构建知识库；输入 scope，返回最终固定状态，验证失败时不获取引擎租约。 */
  public async build(value: unknown): Promise<ApplicationKnowledgeBaseStatus> {
    const request = parseApplicationKnowledgeBaseScopeRequest(value);
    return parseStatusResponse(await this.requestJson(KNOWLEDGE_BASE_PATHS.build, request), request.knowledgeBaseId);
  }

  /** 查询知识库状态；输入 scope，返回固定状态，验证失败时不获取引擎租约。 */
  public async status(value: unknown): Promise<ApplicationKnowledgeBaseStatus> {
    const request = parseApplicationKnowledgeBaseScopeRequest(value);
    return parseStatusResponse(await this.requestJson(KNOWLEDGE_BASE_PATHS.status, request), request.knowledgeBaseId);
  }

  /** 删除知识库索引；输入 scope，返回删除结果，私有错误转换为固定异常。 */
  public async remove(value: unknown): Promise<ApplicationKnowledgeBaseMutationResult> {
    const request = parseApplicationKnowledgeBaseScopeRequest(value);
    return parseMutationResponse(await this.requestJson(KNOWLEDGE_BASE_PATHS.remove, request), request.knowledgeBaseId);
  }

  /** 检索知识库；输入有界查询，返回脱敏结果，响应漂移或超限时抛出固定异常。 */
  public async query(value: unknown): Promise<ApplicationKnowledgeBaseQueryResult> {
    const request = parseApplicationKnowledgeBaseQueryRequest(value);
    return parseQueryResponse(await this.requestJson(KNOWLEDGE_BASE_PATHS.query, request), request);
  }

  /** 发送一次认证 JSON 请求；输入路径和载荷，返回未知响应，始终释放请求租约。 */
  private async requestJson(path: string, payload: unknown): Promise<unknown> {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    if (body.length > MAX_KNOWLEDGE_BASE_REQUEST_BYTES) {
      throw new Error("Application knowledge base request is too large.");
    }
    const lease = await this.options.acquireEngine();
    const target = new URL(path, lease.origin);
    try {
      return await new Promise<unknown>((resolve, reject) => {
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
            if (totalBytes > MAX_KNOWLEDGE_BASE_RESPONSE_BYTES) {
              const error = new Error("Application knowledge base response is too large.");
              response.destroy(error);
              upstream.destroy(error);
              reject(error);
              return;
            }
            chunks.push(buffer);
          });
          response.once("end", () => {
            if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
              reject(new Error("Application knowledge base runtime is unavailable."));
              return;
            }
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
            } catch {
              reject(new Error("Application knowledge base runtime returned invalid JSON."));
            }
          });
        });
        upstream.once("error", () => reject(new Error("Application knowledge base engine request failed.")));
        upstream.end(body);
      });
    } finally {
      lease.release();
    }
  }
}

/** 解析状态响应；输入未知值和预期 ID，返回固定状态，字段漂移时抛出 Error。 */
function parseStatusResponse(value: unknown, knowledgeBaseId: string): ApplicationKnowledgeBaseStatus {
  const record = requireExactResponse(value, ["schema", "knowledgeBaseId", "status"]);
  if (
    record.schema !== APPLICATION_KNOWLEDGE_BASE_STATUS_SCHEMA
    || record.knowledgeBaseId !== knowledgeBaseId
    || !KNOWLEDGE_BASE_STATUSES.has(record.status as ApplicationKnowledgeBaseStatusValue)
  ) {
    throw new Error("Application knowledge base status response is invalid.");
  }
  return record as unknown as ApplicationKnowledgeBaseStatus;
}

/** 解析删除响应；输入未知值和预期 ID，返回固定结果，字段漂移时抛出 Error。 */
function parseMutationResponse(
  value: unknown,
  knowledgeBaseId: string,
): ApplicationKnowledgeBaseMutationResult {
  const record = requireExactResponse(value, ["schema", "knowledgeBaseId", "success", "removed"]);
  if (
    record.schema !== APPLICATION_KNOWLEDGE_BASE_MUTATION_SCHEMA
    || record.knowledgeBaseId !== knowledgeBaseId
    || record.success !== true
    || typeof record.removed !== "boolean"
  ) {
    throw new Error("Application knowledge base mutation response is invalid.");
  }
  return record as unknown as ApplicationKnowledgeBaseMutationResult;
}

/** 解析查询响应；输入未知值和请求，返回有界结果，路径型或复杂元数据时抛出 Error。 */
function parseQueryResponse(
  value: unknown,
  request: { readonly knowledgeBaseId: string; readonly query: string; readonly limit?: number },
): ApplicationKnowledgeBaseQueryResult {
  const record = requireExactResponse(value, ["schema", "knowledgeBaseId", "query", "count", "results"]);
  if (
    record.schema !== APPLICATION_KNOWLEDGE_BASE_QUERY_SCHEMA
    || record.knowledgeBaseId !== request.knowledgeBaseId
    || record.query !== request.query
    || !Array.isArray(record.results)
    || record.results.length > (request.limit ?? 5)
    || record.count !== record.results.length
  ) {
    throw new Error("Application knowledge base query response is invalid.");
  }
  const results = record.results.map(parseQueryItem);
  return {
    schema: APPLICATION_KNOWLEDGE_BASE_QUERY_SCHEMA,
    knowledgeBaseId: request.knowledgeBaseId,
    query: request.query,
    count: results.length,
    results,
  };
}

/** 解析单条检索结果；输入未知值，返回脱敏结果，复杂字段或超长文本时抛出 Error。 */
function parseQueryItem(value: unknown): ApplicationKnowledgeBaseQueryItem {
  const record = requireExactResponse(value, ["id", "content", "summary", "fileName", "metadata"]);
  if (
    typeof record.id !== "string" || !record.id || record.id.length > 256
    || typeof record.content !== "string" || record.content.length > 256 * 1024
    || typeof record.summary !== "string" || record.summary.length > 512
    || typeof record.fileName !== "string" || record.fileName.length > 512
    || typeof record.metadata !== "object" || record.metadata === null || Array.isArray(record.metadata)
  ) {
    throw new Error("Application knowledge base query item is invalid.");
  }
  const metadata = record.metadata as Record<string, unknown>;
  if (
    Object.keys(metadata).length > 64
    || Object.entries(metadata).some(([key, item]) => {
      const pathLike = /path|source|directory/i.test(key);
      return key.length > 128
        || !(item === null || ["string", "number", "boolean"].includes(typeof item))
        || (typeof item === "string" && item.length > 8_192)
        || (pathLike && typeof item === "string" && /[\\/]/.test(item));
    })
  ) {
    throw new Error("Application knowledge base query metadata is invalid.");
  }
  return {
    id: record.id,
    content: record.content,
    summary: record.summary,
    fileName: record.fileName,
    metadata: metadata as Record<string, string | number | boolean | null>,
  };
}

/** 校验精确响应对象；输入未知值和允许字段，返回记录，结构漂移时抛出 Error。 */
function requireExactResponse(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Application knowledge base response is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || Object.keys(record).some((key) => !keys.includes(key))) {
    throw new Error("Application knowledge base response fields are invalid.");
  }
  return record;
}
