import type { DesktopCore } from "../core/desktop-core";
import {
  APPLICATION_RECALL_BOOTSTRAP_SCHEMA,
  APPLICATION_RECALL_FOCUS_SCHEMA,
  APPLICATION_RECALL_OBSERVATIONS_SCHEMA,
  APPLICATION_RECALL_RESUME_SCHEMA,
  APPLICATION_RECALL_ROLLBACK_SCHEMA,
  APPLICATION_RECALL_SEARCH_SCHEMA,
  APPLICATION_RECALL_TIMELINE_SCHEMA,
  parseApplicationRecallObservationFocusRequest,
  parseApplicationRecallObservationsRequest,
  parseApplicationRecallResumeRequest,
  parseApplicationRecallRollbackRequest,
  parseApplicationRecallSearchRequest,
  parseApplicationRecallTimelineRequest,
  type ApplicationRecallBootstrapResult,
  type ApplicationRecallJsonValue,
  type ApplicationRecallObservationFocusRequest,
  type ApplicationRecallObservationFocusResult,
  type ApplicationRecallObservationsResult,
  type ApplicationRecallRecord,
  type ApplicationRecallResumeResult,
  type ApplicationRecallRollbackResult,
  type ApplicationRecallSearchResult,
  type ApplicationRecallTimelineResult,
} from "../contracts/application-recall-runtime";
import type { WorkerSupervisor } from "../workers/worker-supervisor";

const MAX_PUBLIC_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_PUBLIC_TEXT_LENGTH = 16 * 1024;
const MAX_PUBLIC_RECORD_KEYS = 128;
const MAX_PUBLIC_DEPTH = 8;
const PRIVATE_RESPONSE_FIELDS = new Set([
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "authtoken",
  "auth_token",
  "token",
  "secret",
  "password",
  "snapshot_path",
  "workspace_key",
  "process_path",
  "stdout",
  "stderr",
]);

/** Main 注入给 Recall Worker 的私有工作区作用域。 */
export interface ApplicationRecallRuntimeScope {
  readonly workspaceDirectory: string;
  readonly providerName: string;
}

/** Recall Runtime 固定诊断接口。 */
export interface ApplicationRecallRuntimeLogger {
  warn(message: string): void;
}

/** Recall Runtime 服务依赖。 */
export interface ApplicationRecallRuntimeServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly getScope: () => ApplicationRecallRuntimeScope;
  readonly publishObservationFocus?: (request: ApplicationRecallObservationFocusRequest) => number;
  readonly logger?: ApplicationRecallRuntimeLogger;
}

/** Main 持有的 Recall Center 与 Memory Worker 边界。 */
export class ApplicationRecallRuntimeService {
  private readonly logger: ApplicationRecallRuntimeLogger;

  /** 创建 Runtime；输入 Core、Worker、作用域和发布器，无返回，不提前激活 Python。 */
  public constructor(private readonly options: ApplicationRecallRuntimeServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** 读取 Recall 首屏；无 Renderer 输入，返回聚合结果，Worker 失败时抛出固定错误。 */
  public async bootstrap(): Promise<ApplicationRecallBootstrapResult> {
    return parseBootstrapResult(await this.request("recall.bootstrap", { ...this.scopePayload() }));
  }

  /** 搜索 Recall；输入有界查询，返回脱敏记录，失败时不暴露工作区内部错误。 */
  public async search(value: unknown): Promise<ApplicationRecallSearchResult> {
    const request = parseApplicationRecallSearchRequest(value);
    return parseSearchResult(await this.request("recall.search", { ...this.scopePayload(), ...request }));
  }

  /** 读取时间线；输入有界查询或锚点，返回渐进记录，失败时抛出固定错误。 */
  public async timeline(value: unknown): Promise<ApplicationRecallTimelineResult> {
    const request = parseApplicationRecallTimelineRequest(value);
    return parseTimelineResult(await this.request("recall.timeline", { ...this.scopePayload(), ...request }));
  }

  /** 读取观察流；输入至少一个目标字段，返回脱敏记录，失败时抛出固定错误。 */
  public async observations(value: unknown): Promise<ApplicationRecallObservationsResult> {
    const request = parseApplicationRecallObservationsRequest(value);
    return parseObservationsResult(
      await this.request("recall.observations", { ...this.scopePayload(), ...request }),
    );
  }

  /** 恢复中断 turn；输入精确 ID，返回恢复提示，失败时抛出固定错误。 */
  public async resume(value: unknown): Promise<ApplicationRecallResumeResult> {
    const request = parseApplicationRecallResumeRequest(value);
    return parseResumeResult(await this.request("recall.resume", { turnId: request.turnId }));
  }

  /** 恢复工作区检查点；输入精确 ID，返回固定结果，失败时不暴露 Git 输出。 */
  public async rollback(value: unknown): Promise<ApplicationRecallRollbackResult> {
    const request = parseApplicationRecallRollbackRequest(value);
    return parseRollbackResult(
      await this.request("recall.rollback", {
        workspaceDirectory: this.scopePayload().workspaceDirectory,
        checkpointId: request.checkpointId,
      }),
    );
  }

  /** 发布观察焦点；输入有界展示数据，返回投递数量，不激活任何 Python capability。 */
  public publishObservationFocus(value: unknown): ApplicationRecallObservationFocusResult {
    const request = parseApplicationRecallObservationFocusRequest(value);
    const delivered = this.options.publishObservationFocus?.(request) ?? 0;
    return {
      schema: APPLICATION_RECALL_FOCUS_SCHEMA,
      delivered: Number.isSafeInteger(delivered) && delivered > 0 ? delivered : 0,
    };
  }

  /** 请求 Memory Worker；输入 allow-list 方法和内部 payload，返回记录，失败时抛出固定错误。 */
  private async request(
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    try {
      await this.options.core.ensureCapability("memory");
      return await this.options.supervisor.request("memory", method, payload);
    } catch {
      this.logger.warn(`Recall Runtime request '${method}' failed with a private runtime error.`);
      throw new Error("Recall runtime is unavailable.");
    }
  }

  /** 读取 Main 私有作用域；无输入，返回规范化 payload，非法内部设置时抛出固定错误。 */
  private scopePayload(): ApplicationRecallRuntimeScope {
    const scope = this.options.getScope();
    if (
      typeof scope?.workspaceDirectory !== "string"
      || scope.workspaceDirectory.length > 32_767
      || scope.workspaceDirectory.includes("\u0000")
      || typeof scope.providerName !== "string"
      || scope.providerName.length > 128
    ) {
      throw new Error("Recall runtime scope is invalid.");
    }
    return {
      workspaceDirectory: scope.workspaceDirectory.trim(),
      providerName: scope.providerName.trim(),
    };
  }
}

/** 解析首屏响应；输入 Worker 值，返回有界聚合，字段漂移或私有字段时抛出固定错误。 */
function parseBootstrapResult(value: unknown): ApplicationRecallBootstrapResult {
  const record = requireExactResponse(
    value,
    ["interrupted", "turns", "checkpoints", "decisions", "versions", "overview"],
  );
  return {
    schema: APPLICATION_RECALL_BOOTSTRAP_SCHEMA,
    interrupted: parseRecordArray(record.interrupted, "interrupted", 20),
    turns: parseRecordArray(record.turns, "turns", 20),
    checkpoints: parseRecordArray(record.checkpoints, "checkpoints", 30),
    decisions: parseRecordArray(record.decisions, "decisions", 30),
    versions: parseRecordArray(record.versions, "versions", 100),
    overview: parsePublicRecord(record.overview, "overview"),
  };
}

/** 解析搜索响应；输入 Worker 值，返回有界结果，计数或来源字段漂移时抛出固定错误。 */
function parseSearchResult(value: unknown): ApplicationRecallSearchResult {
  const record = requireExactResponse(value, ["query", "results", "count", "sources"]);
  const results = parseRecordArray(record.results, "results", 20);
  if (record.count !== results.length || !Array.isArray(record.sources) || record.sources.length > 16) {
    throw new Error("Recall search response is invalid.");
  }
  return {
    schema: APPLICATION_RECALL_SEARCH_SCHEMA,
    query: parsePublicText(record.query, "query", 2_048),
    results,
    sources: record.sources.map((item) => parsePublicText(item, "source", 128)),
  };
}

/** 解析时间线响应；输入 Worker 值，返回有界结果，模式或计数漂移时抛出固定错误。 */
function parseTimelineResult(value: unknown): ApplicationRecallTimelineResult {
  const record = requireExactResponse(
    value,
    ["workspace", "query", "mode", "anchor", "depth_before", "depth_after", "timeline", "count"],
  );
  const timeline = parseRecordArray(record.timeline, "timeline", 80);
  if (
    record.count !== timeline.length
    || !["recent", "query", "anchor"].includes(String(record.mode))
    || !isBoundedInteger(record.depth_before, 0, 20)
    || !isBoundedInteger(record.depth_after, 0, 20)
  ) {
    throw new Error("Recall timeline response is invalid.");
  }
  return {
    schema: APPLICATION_RECALL_TIMELINE_SCHEMA,
    workspace: parsePublicText(record.workspace, "workspace", 32_767),
    query: parsePublicText(record.query, "query", 2_048),
    mode: record.mode as "recent" | "query" | "anchor",
    anchor: parsePublicRecord(record.anchor, "anchor"),
    depthBefore: record.depth_before,
    depthAfter: record.depth_after,
    timeline,
  };
}

/** 解析观察流响应；输入 Worker 值，返回有界结果，计数或上下文字段漂移时抛出固定错误。 */
function parseObservationsResult(value: unknown): ApplicationRecallObservationsResult {
  const record = requireExactResponse(value, ["workspace", "context", "observations", "count"]);
  const observations = parseRecordArray(record.observations, "observations", 120);
  if (record.count !== observations.length) throw new Error("Recall observations response is invalid.");
  return {
    schema: APPLICATION_RECALL_OBSERVATIONS_SCHEMA,
    workspace: parsePublicText(record.workspace, "workspace", 32_767),
    context: parsePublicRecord(record.context, "context"),
    observations,
  };
}

/** 解析恢复响应；输入 Worker 值，返回固定结果，状态或记录字段漂移时抛出固定错误。 */
function parseResumeResult(value: unknown): ApplicationRecallResumeResult {
  const record = requireExactResponse(value, ["status", "resume", "resume_prompt", "turn"]);
  if (record.status !== "ok") throw new Error("Recall resume response is invalid.");
  return {
    schema: APPLICATION_RECALL_RESUME_SCHEMA,
    status: "ok",
    resumePrompt: parsePublicText(record.resume_prompt, "resumePrompt", 16_384),
    resume: parsePublicRecord(record.resume, "resume"),
    turn: parsePublicRecord(record.turn, "turn"),
  };
}

/** 解析回滚响应；输入 Worker 值，返回固定结果，状态或文本漂移时抛出固定错误。 */
function parseRollbackResult(value: unknown): ApplicationRecallRollbackResult {
  const record = requireExactResponse(value, ["status", "message", "checkpoint_id"]);
  if (record.status !== "ok") throw new Error("Recall rollback response is invalid.");
  return {
    schema: APPLICATION_RECALL_ROLLBACK_SCHEMA,
    status: "ok",
    message: parsePublicText(record.message, "message", 2_048),
    checkpointId: parsePublicText(record.checkpoint_id, "checkpointId", 160),
  };
}

/** 解析公开记录数组；输入未知值、标签和数量，返回不可变记录，超限或非对象时抛出固定错误。 */
function parseRecordArray(value: unknown, label: string, maximumItems: number): readonly ApplicationRecallRecord[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new Error(`Recall ${label} response is invalid.`);
  }
  return value.map((item) => parsePublicRecord(item, label));
}

/** 解析公开记录；输入未知值和标签，返回深度有界 JSON，私有字段或超预算时抛出固定错误。 */
function parsePublicRecord(value: unknown, label: string): ApplicationRecallRecord {
  const budget = { bytes: 0 };
  const normalized = normalizePublicValue(value, label, 0, budget);
  if (typeof normalized !== "object" || normalized === null || Array.isArray(normalized)) {
    throw new Error(`Recall ${label} record is invalid.`);
  }
  if (budget.bytes > MAX_PUBLIC_RESPONSE_BYTES) throw new Error(`Recall ${label} response exceeds its budget.`);
  return normalized as ApplicationRecallRecord;
}

/** 递归规范化公开 JSON；输入未知值、路径、深度和预算，返回安全值，非法类型或私有字段时失败。 */
function normalizePublicValue(
  value: unknown,
  path: string,
  depth: number,
  budget: { bytes: number },
): ApplicationRecallJsonValue {
  if (depth > MAX_PUBLIC_DEPTH) throw new Error(`Recall ${path} exceeds its depth budget.`);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Recall ${path} number is invalid.`);
    return value;
  }
  if (typeof value === "string") {
    if (value.length > MAX_PUBLIC_TEXT_LENGTH || value.includes("\u0000")) {
      throw new Error(`Recall ${path} text is invalid.`);
    }
    budget.bytes += Buffer.byteLength(value, "utf8");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 120) throw new Error(`Recall ${path} array exceeds its item budget.`);
    return value.map((item, index) => normalizePublicValue(item, `${path}[${index}]`, depth + 1, budget));
  }
  if (typeof value !== "object" || value === null) throw new Error(`Recall ${path} value is invalid.`);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PUBLIC_RECORD_KEYS) throw new Error(`Recall ${path} record exceeds its key budget.`);
  const output: Record<string, ApplicationRecallJsonValue> = {};
  for (const [key, item] of entries) {
    const normalizedKey = key.toLowerCase();
    if (key.length > 128 || PRIVATE_RESPONSE_FIELDS.has(normalizedKey)) {
      throw new Error(`Recall ${path} contains a private field.`);
    }
    budget.bytes += Buffer.byteLength(key, "utf8");
    output[key] = normalizePublicValue(item, `${path}.${key}`, depth + 1, budget);
  }
  return output;
}

/** 校验公开文本；输入未知值、标签和长度，返回文本，非法值时抛出固定错误。 */
function parsePublicText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || value.length > maximumLength || value.includes("\u0000")) {
    throw new Error(`Recall ${label} response is invalid.`);
  }
  return value;
}

/** 校验整数范围；输入未知值和边界，返回布尔值，无副作用。 */
function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

/** 校验精确 Worker 响应；输入未知值和字段，返回记录，缺失或额外字段时抛出固定错误。 */
function requireExactResponse(value: unknown, fields: readonly string[]): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Recall Worker response must be an object.");
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Recall Worker response must be JSON serializable.");
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_PUBLIC_RESPONSE_BYTES) {
    throw new Error("Recall Worker response exceeds its byte budget.");
  }
  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new Error("Recall Worker response fields are invalid.");
  }
  return record;
}
