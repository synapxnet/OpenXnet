import { existsSync } from "node:fs";
import path from "node:path";

import {
  APPLICATION_MEMORY_MANAGEMENT_SCHEMA,
  parseApplicationMemoryCollectionRequest,
  parseApplicationMemoryRecordRequest,
  parseUpdateApplicationMemoryRecordRequest,
  type ApplicationMemoryMutationResult,
  type ApplicationMemoryRecord,
  type ApplicationMemoryRecordListResult,
} from "../contracts/application-memory-management-runtime";
import type { DesktopCore } from "../core/desktop-core";
import type { WorkerSupervisor } from "../workers/worker-supervisor";

/** Memory 管理 Runtime 诊断接口。 */
export interface ApplicationMemoryManagementLogger {
  warn(message: string): void;
}

/** Memory 管理 Runtime 依赖。 */
export interface ApplicationMemoryManagementRuntimeOptions {
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly userDataDirectory?: string;
  readonly logger?: ApplicationMemoryManagementLogger;
}

/** Main 与独立 Memory Worker 之间的记忆集合管理边界。 */
export class ApplicationMemoryManagementRuntimeService {
  private readonly logger: ApplicationMemoryManagementLogger;
  private readonly memoryRoot: string | null;

  /** 初始化 Worker 依赖；输入 Core、Supervisor 和日志器，无返回，不提前激活能力。 */
  public constructor(private readonly options: ApplicationMemoryManagementRuntimeOptions) {
    this.logger = options.logger ?? console;
    this.memoryRoot = options.userDataDirectory
      ? path.resolve(options.userDataDirectory, "memory_cache")
      : null;
  }

  /** 列出一个记忆集合；输入稳定 memoryId，输出有界无路径记录，Worker 失败时抛出固定错误。 */
  public async listRecords(value: unknown): Promise<ApplicationMemoryRecordListResult> {
    const request = parseApplicationMemoryCollectionRequest(value);
    if (!this.collectionExists(request.memoryId)) {
      return { schema: APPLICATION_MEMORY_MANAGEMENT_SCHEMA, memoryId: request.memoryId, records: [] };
    }
    const response = await this.request("memory.collection.list", { ...request });
    return this.parseListResult(response, request.memoryId);
  }

  /** 更新一个记忆记录文本；输入稳定 ID 与文本，输出固定变更结果，失败时不暴露 Worker 细节。 */
  public async updateRecord(value: unknown): Promise<ApplicationMemoryMutationResult> {
    const request = parseUpdateApplicationMemoryRecordRequest(value);
    const response = await this.request("memory.collection.update", { ...request });
    return this.parseMutationResult(response, request.memoryId, request.recordId, "updated");
  }

  /** 删除一个记忆记录；输入稳定 ID，输出固定变更结果，Vector Worker 失败时返回统一不可用错误。 */
  public async deleteRecord(value: unknown): Promise<ApplicationMemoryMutationResult> {
    const request = parseApplicationMemoryRecordRequest(value);
    const response = await this.request("memory.collection.delete-record", { ...request });
    return this.parseMutationResult(response, request.memoryId, request.recordId, "deleted");
  }

  /** 删除整个记忆集合；输入稳定 memoryId，输出固定结果，Worker 会先释放缓存再删除持久化文件。 */
  public async removeCollection(value: unknown): Promise<ApplicationMemoryMutationResult> {
    const request = parseApplicationMemoryCollectionRequest(value);
    if (!this.collectionExists(request.memoryId)) {
      return {
        schema: APPLICATION_MEMORY_MANAGEMENT_SCHEMA,
        memoryId: request.memoryId,
        recordId: "",
        action: "removed",
      };
    }
    const response = await this.request("memory.collection.remove", { ...request });
    return this.parseMutationResult(response, request.memoryId, "", "removed");
  }

  /** 请求 Memory Worker；输入固定方法和公开 payload，输出记录，能力或 Worker 失败时抛出固定错误。 */
  private async request(
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    try {
      await this.options.core.ensureCapability("memory");
      return await this.options.supervisor.request("memory", method, payload);
    } catch {
      this.logger.warn(`Memory Management request '${method}' failed with a private runtime error.`);
      throw new Error("Memory management runtime is unavailable.");
    }
  }

  /** 检查固定记忆目录是否存在；输入已校验 ID，输出布尔值，不读取内容且不激活 Worker。 */
  private collectionExists(memoryId: string): boolean {
    if (this.memoryRoot === null) return true;
    const candidate = path.resolve(this.memoryRoot, memoryId);
    return path.dirname(candidate) === this.memoryRoot && existsSync(candidate);
  }

  /** 解析 Worker 列表；输入未知响应和预期 memoryId，输出有界记录，字段漂移时抛出固定错误。 */
  private parseListResult(
    value: unknown,
    expectedMemoryId: string,
  ): ApplicationMemoryRecordListResult {
    const record = requireExactResponse(value, ["memoryId", "records"]);
    if (record.memoryId !== expectedMemoryId || !Array.isArray(record.records) || record.records.length > 10_000) {
      throw new Error("Memory management response is invalid.");
    }
    const records = record.records.map((item, index) => parseMemoryRecord(item, index));
    if (Buffer.byteLength(JSON.stringify(records), "utf8") > 8 * 1024 * 1024) {
      throw new Error("Memory management response exceeds its byte budget.");
    }
    return { schema: APPLICATION_MEMORY_MANAGEMENT_SCHEMA, memoryId: expectedMemoryId, records };
  }

  /** 解析 Worker 变更结果；输入响应和预期字段，输出固定结果，不匹配时抛出固定错误。 */
  private parseMutationResult(
    value: unknown,
    expectedMemoryId: string,
    expectedRecordId: string,
    expectedAction: ApplicationMemoryMutationResult["action"],
  ): ApplicationMemoryMutationResult {
    const record = requireExactResponse(value, ["memoryId", "recordId", "action"]);
    if (
      record.memoryId !== expectedMemoryId
      || record.recordId !== expectedRecordId
      || record.action !== expectedAction
    ) {
      throw new Error("Memory management mutation response is invalid.");
    }
    return {
      schema: APPLICATION_MEMORY_MANAGEMENT_SCHEMA,
      memoryId: expectedMemoryId,
      recordId: expectedRecordId,
      action: expectedAction,
    };
  }
}

/** 解析单条 Worker 记录；输入未知值和预期索引，输出公开记录，非法字段时抛错。 */
function parseMemoryRecord(value: unknown, expectedIndex: number): ApplicationMemoryRecord {
  const record = requireExactResponse(value, ["recordId", "index", "text", "createdAt", "updatedAt"]);
  if (record.index !== expectedIndex) throw new Error("Memory management record order is invalid.");
  return {
    recordId: requirePublicText(record.recordId, "recordId", 128, false),
    index: expectedIndex,
    text: requirePublicText(record.text, "text", 512 * 1024, true),
    createdAt: requirePublicText(record.createdAt, "createdAt", 128, true),
    updatedAt: requirePublicText(record.updatedAt, "updatedAt", 128, true),
  };
}

/** 校验精确 Worker 对象；输入未知值和字段，输出记录，额外字段或非对象时抛错。 */
function requireExactResponse(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Memory management response is invalid.");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new Error("Memory management response fields are invalid.");
  }
  return record;
}

/** 校验公开文本；输入值、字段、长度和可空标记，输出文本，非法或私有控制字符时抛错。 */
function requirePublicText(
  value: unknown,
  field: string,
  maximumLength: number,
  allowEmpty: boolean,
): string {
  if (typeof value !== "string") throw new Error(`Memory management field '${field}' is invalid.`);
  if ((!allowEmpty && !value) || value.length > maximumLength || /[\u0000\u007F]/.test(value)) {
    throw new Error(`Memory management field '${field}' is invalid.`);
  }
  return value;
}
