import { lstat, readFile } from "node:fs/promises";

import {
  APPLICATION_SYNAPXNET_MEMORY_SCHEMA,
  APPLICATION_SYNAPXNET_MEMORY_TRANSFER_SCHEMA,
  parseCreateSynapxnetMemoryRequest,
  parseEditSynapxnetMemoryRequest,
  parseExportSynapxnetMemoriesRequest,
  parseImportSynapxnetMemoriesRequest,
  parseListSynapxnetMemoriesRequest,
  parseRecoverSynapxnetMemoriesRequest,
  parseRollbackSynapxnetMemoryRequest,
  parseRetireSynapxnetMemoryRequest,
  parseSynapxnetMemoryIdentityRequest,
  parseVerifySynapxnetMemoryRequest,
  type CreateSynapxnetMemoryRequest,
  type EditSynapxnetMemoryRequest,
  type ExportSynapxnetMemoriesRequest,
  type ImportSynapxnetMemoriesRequest,
  type ListSynapxnetMemoriesRequest,
  type RecoverSynapxnetMemoriesRequest,
  type RollbackSynapxnetMemoryRequest,
  type RetireSynapxnetMemoryRequest,
  type SynapxnetMemoryHistoryResult,
  type SynapxnetMemoryIdentityRequest,
  type SynapxnetMemoryImportResult,
  type SynapxnetMemoryIntegrityResult,
  type SynapxnetMemoryListResult,
  type SynapxnetMemoryRecord,
  type SynapxnetMemoryRecoveryResult,
  type SynapxnetMemoryStatusResult,
  type SynapxnetMemoryTransferDocument,
  type VerifySynapxnetMemoryRequest,
} from "../contracts/application-synapxnet-memory-runtime";
import type { DesktopCore } from "../core/desktop-core";
import type { WorkerSupervisor } from "../workers/worker-supervisor";

export interface ApplicationSynapxnetMemoryLogger {
  warn(message: string): void;
}

export interface ApplicationSynapxnetMemoryRuntimeOptions {
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly reconcileTrustedHistory?: () => Promise<number>;
  readonly bootstrapTransfer?: {
    readonly path: string;
    readonly expectedManifestSha256: string;
  };
  readonly logger?: ApplicationSynapxnetMemoryLogger;
}

const MAX_BOOTSTRAP_TRANSFER_BYTES = 16 * 1024 * 1024;

/** 为主进程提供类型安全的 SynapXnet Memory V3 Worker 调用边界。 */
export class ApplicationSynapxnetMemoryRuntimeService {
  private readonly logger: ApplicationSynapxnetMemoryLogger;
  private readonly bootstrapReconciledAgents = new Set<string>();
  private recoveryQueue: Promise<void> = Promise.resolve();
  private trustedHistoryReconciled = false;

  /** 初始化记忆运行时服务，并使用传入日志器或控制台记录脱敏故障。 */
  public constructor(private readonly options: ApplicationSynapxnetMemoryRuntimeOptions) {
    this.logger = options.logger ?? console;
  }

  /** 恢复可信历史记忆；输入目标 Agent，优先补投影本机闭环，再导入哈希锁定的内置迁移包。 */
  public recover(value: unknown): Promise<SynapxnetMemoryRecoveryResult> {
    const request: RecoverSynapxnetMemoriesRequest = parseRecoverSynapxnetMemoriesRequest(value);
    let output: SynapxnetMemoryRecoveryResult | undefined;

    /** 串行执行单次恢复，避免多个 Renderer 请求同时向空库写入重复版本。 */
    const operation = async (): Promise<void> => {
      output = await this.recoverOnce(request);
    };
    const queued = this.recoveryQueue.then(operation, operation);
    this.recoveryQueue = queued.then(() => undefined, () => undefined);
    return queued.then(() => {
      if (output === undefined) throw new Error("SynapXnet Memory recovery did not produce a result.");
      return output;
    });
  }

  /** 查询 Memory V3 Worker 的运行状态、协议版本和存储状态。 */
  public async status(): Promise<SynapxnetMemoryStatusResult> {
    return this.runtimeResult<SynapxnetMemoryStatusResult>("memory.v3.status", {});
  }

  /** 校验筛选条件并分页查询当前主体有权访问的记忆。 */
  public async list(value: unknown): Promise<SynapxnetMemoryListResult> {
    const request: ListSynapxnetMemoriesRequest = parseListSynapxnetMemoriesRequest(value);
    return this.runtimeResult<SynapxnetMemoryListResult>("memory.v3.list", request);
  }

  /** 校验记忆标识并查询该记忆的可追溯版本历史。 */
  public async history(value: unknown): Promise<SynapxnetMemoryHistoryResult> {
    const request: SynapxnetMemoryIdentityRequest = parseSynapxnetMemoryIdentityRequest(value);
    return this.runtimeResult<SynapxnetMemoryHistoryResult>("memory.v3.history", request);
  }

  /** 校验创建请求并生成带来源、权限与完整性信息的新记忆。 */
  public async create(value: unknown): Promise<SynapxnetMemoryRecord> {
    const request: CreateSynapxnetMemoryRequest = parseCreateSynapxnetMemoryRequest(value);
    return this.runtimeResult<SynapxnetMemoryRecord>("memory.v3.create", request);
  }

  /** 校验编辑请求并为目标记忆追加一个可审计的新版本。 */
  public async edit(value: unknown): Promise<SynapxnetMemoryRecord> {
    const request: EditSynapxnetMemoryRequest = parseEditSynapxnetMemoryRequest(value);
    return this.runtimeResult<SynapxnetMemoryRecord>("memory.v3.edit", request);
  }

  /** 校验回滚请求并将指定历史版本恢复为新的当前版本。 */
  public async rollback(value: unknown): Promise<SynapxnetMemoryRecord> {
    const request: RollbackSynapxnetMemoryRequest = parseRollbackSynapxnetMemoryRequest(value);
    return this.runtimeResult<SynapxnetMemoryRecord>("memory.v3.rollback", request);
  }

  /** 校验退役请求并将目标记忆标记为不再参与召回。 */
  public async retire(value: unknown): Promise<SynapxnetMemoryRecord> {
    const request: RetireSynapxnetMemoryRequest = parseRetireSynapxnetMemoryRequest(value);
    return this.runtimeResult<SynapxnetMemoryRecord>("memory.v3.retire", request);
  }

  /** 导出符合筛选条件且不超过传输预算的可迁移记忆文档。 */
  public async export(value: unknown): Promise<SynapxnetMemoryTransferDocument> {
    const request: ExportSynapxnetMemoriesRequest = parseExportSynapxnetMemoriesRequest(value);
    const response = await this.request("memory.v3.export", request);
    return normalizeWorkerResult<SynapxnetMemoryTransferDocument>(
      response,
      APPLICATION_SYNAPXNET_MEMORY_TRANSFER_SCHEMA,
      16 * 1024 * 1024,
    );
  }

  /** 校验并导入受支持的记忆传输文档，返回逐项处理结果。 */
  public async import(value: unknown): Promise<SynapxnetMemoryImportResult> {
    const request: ImportSynapxnetMemoriesRequest = parseImportSynapxnetMemoriesRequest(value);
    return this.runtimeResult<SynapxnetMemoryImportResult>("memory.v3.import", request, 16 * 1024 * 1024);
  }

  /** 验证目标记忆或记忆集合的版本链与内容摘要完整性。 */
  public async verify(value: unknown): Promise<SynapxnetMemoryIntegrityResult> {
    const request: VerifySynapxnetMemoryRequest = parseVerifySynapxnetMemoryRequest(value);
    return this.runtimeResult<SynapxnetMemoryIntegrityResult>("memory.v3.verify", request);
  }

  /** 执行一次受信恢复；输入已校验请求，返回恢复来源、数量和完整性结果。 */
  private async recoverOnce(request: RecoverSynapxnetMemoriesRequest): Promise<SynapxnetMemoryRecoveryResult> {
    let status = await this.status();
    const previousMemoryCount = status.tiers.longTerm.memories;
    let reconciledMemories = 0;
    if (!this.trustedHistoryReconciled && this.options.reconcileTrustedHistory !== undefined) {
      try {
        const reconciled = await this.options.reconcileTrustedHistory();
        reconciledMemories = Number.isInteger(reconciled) && reconciled > 0 ? reconciled : 0;
        this.trustedHistoryReconciled = true;
      } catch {
        this.logger.warn("SynapXnet Memory trusted-history reconciliation failed.");
      }
      status = await this.status();
    }
    const historyAdded = status.tiers.longTerm.memories > previousMemoryCount;

    if (
      this.options.bootstrapTransfer === undefined
      || this.bootstrapReconciledAgents.has(request.actorAgent)
    ) {
      const source = historyAdded
        ? "competition-history"
        : status.tiers.longTerm.memories > 0
          ? "existing"
          : "empty";
      const integrity = historyAdded
        ? await this.verify({ requesterAgent: request.actorAgent, memoryId: "" })
        : null;
      return this.recoveryResult(source, status, { reconciledMemories, integrity });
    }

    const document = await this.readBootstrapTransfer();
    const imported = await this.import({
      actorAgent: request.actorAgent,
      targetOwnerAgent: request.actorAgent,
      document,
    });
    this.bootstrapReconciledAgents.add(request.actorAgent);
    const integrity = await this.verify({ requesterAgent: request.actorAgent, memoryId: "" });
    status = await this.status();
    if (!integrity.healthy || status.tiers.longTerm.memories === 0) {
      throw new Error("SynapXnet Memory trusted bootstrap failed integrity verification.");
    }
    const source = imported.imported.length > 0
      ? "bundled-transfer"
      : historyAdded
        ? "competition-history"
        : "existing";
    return this.recoveryResult(source, status, {
      reconciledMemories,
      importedVersions: imported.imported.length,
      skippedVersions: imported.skipped,
      manifestSha256: imported.manifestSha256,
      integrity,
    });
  }

  /** 读取固定安装路径中的迁移包；无输入，校验文件类型、大小、UTF-8 和预期清单摘要。 */
  private async readBootstrapTransfer(): Promise<Readonly<Record<string, unknown>>> {
    const transfer = this.options.bootstrapTransfer;
    if (transfer === undefined || !/^[a-f0-9]{64}$/u.test(transfer.expectedManifestSha256)) {
      throw new Error("SynapXnet Memory bootstrap configuration is invalid.");
    }
    const information = await lstat(transfer.path);
    if (!information.isFile() || information.isSymbolicLink() || information.size > MAX_BOOTSTRAP_TRANSFER_BYTES) {
      throw new Error("SynapXnet Memory bootstrap package is invalid.");
    }
    const bytes = await readFile(transfer.path);
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("SynapXnet Memory bootstrap package is invalid.");
    }
    const document = value as Readonly<Record<string, unknown>>;
    if (
      document.schema !== APPLICATION_SYNAPXNET_MEMORY_TRANSFER_SCHEMA
      || document.manifestSha256 !== transfer.expectedManifestSha256
    ) {
      throw new Error("SynapXnet Memory bootstrap package failed publisher verification.");
    }
    return document;
  }

  /** 构建稳定恢复结果；输入来源、状态和可选覆盖字段，返回 Renderer 可安全展示的数据。 */
  private recoveryResult(
    source: SynapxnetMemoryRecoveryResult["source"],
    status: SynapxnetMemoryStatusResult,
    values: Partial<Omit<SynapxnetMemoryRecoveryResult, "schema" | "source" | "status">> = {},
  ): SynapxnetMemoryRecoveryResult {
    return {
      schema: APPLICATION_SYNAPXNET_MEMORY_SCHEMA,
      source,
      reconciledMemories: values.reconciledMemories ?? 0,
      importedVersions: values.importedVersions ?? 0,
      skippedVersions: values.skippedVersions ?? 0,
      manifestSha256: values.manifestSha256 ?? null,
      status,
      integrity: values.integrity ?? null,
    };
  }

  /** 请求 Worker 并按公开 Schema、JSON 格式及字节预算规范化响应。 */
  private async runtimeResult<TResult>(
    method: string,
    payload: object,
    byteLimit = 8 * 1024 * 1024,
  ): Promise<TResult> {
    const response = await this.request(method, payload);
    return normalizeWorkerResult<TResult>(response, APPLICATION_SYNAPXNET_MEMORY_SCHEMA, byteLimit);
  }

  /** 确保记忆能力已注册后调用 Worker，并将内部故障转换为稳定公开错误。 */
  private async request(
    method: string,
    payload: object,
  ): Promise<Readonly<Record<string, unknown>>> {
    try {
      await this.options.core.ensureCapability("memory");
      return await this.options.supervisor.request(
        "memory",
        method,
        payload as Readonly<Record<string, unknown>>,
      );
    } catch (error) {
      this.logger.warn(`SynapXnet Memory request '${method}' failed with a private runtime error.`);
      if (error instanceof TypeError) throw error;
      throw new Error("SynapXnet Memory runtime is unavailable.");
    }
  }
}

/** 克隆受大小约束的 Worker 对象，并校验其稳定公开 Schema。 */
function normalizeWorkerResult<TResult>(value: unknown, schema: string, byteLimit: number): TResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("SynapXnet Memory response is invalid.");
  }
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new Error("SynapXnet Memory response is not JSON serializable.");
  }
  if (Buffer.byteLength(encoded, "utf8") > byteLimit) {
    throw new Error("SynapXnet Memory response exceeds its byte budget.");
  }
  const normalized = JSON.parse(encoded) as Record<string, unknown>;
  if (normalized.schema !== schema) {
    throw new Error("SynapXnet Memory response schema is invalid.");
  }
  return normalized as TResult;
}
