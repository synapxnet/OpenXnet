/** Desktop Recall Runtime IPC channels。 */
export const APPLICATION_RECALL_RUNTIME_CHANNELS = Object.freeze({
  bootstrap: "openxnet:application-recall-runtime:bootstrap",
  search: "openxnet:application-recall-runtime:search",
  timeline: "openxnet:application-recall-runtime:timeline",
  observations: "openxnet:application-recall-runtime:observations",
  resume: "openxnet:application-recall-runtime:resume",
  rollback: "openxnet:application-recall-runtime:rollback",
  publishObservationFocus: "openxnet:application-recall-runtime:publish-observation-focus",
  observationFocusChanged: "openxnet:application-recall-runtime:observation-focus-changed",
});

/** Recall 首屏聚合 schema。 */
export const APPLICATION_RECALL_BOOTSTRAP_SCHEMA = "openxnet.recall-bootstrap.v1" as const;

/** Recall 搜索 schema。 */
export const APPLICATION_RECALL_SEARCH_SCHEMA = "openxnet.recall-search.v1" as const;

/** Recall 时间线 schema。 */
export const APPLICATION_RECALL_TIMELINE_SCHEMA = "openxnet.recall-timeline.v1" as const;

/** Recall 观察流 schema。 */
export const APPLICATION_RECALL_OBSERVATIONS_SCHEMA = "openxnet.recall-observations.v1" as const;

/** Recall 恢复 schema。 */
export const APPLICATION_RECALL_RESUME_SCHEMA = "openxnet.recall-resume.v1" as const;

/** Recall 检查点回滚 schema。 */
export const APPLICATION_RECALL_ROLLBACK_SCHEMA = "openxnet.recall-rollback.v1" as const;

/** Recall 观察焦点发布 schema。 */
export const APPLICATION_RECALL_FOCUS_SCHEMA = "openxnet.recall-focus.v1" as const;

/** Recall 公开 JSON 值。 */
export type ApplicationRecallJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ApplicationRecallJsonValue[]
  | ApplicationRecallRecord;

/** Recall 公开记录，不包含凭据或 Worker 私有路径。 */
export interface ApplicationRecallRecord {
  readonly [key: string]: ApplicationRecallJsonValue;
}

/** Recall 搜索请求。 */
export interface ApplicationRecallSearchRequest {
  readonly query: string;
  readonly topK: number;
  readonly origin: "" | "auto" | "manual";
}

/** Recall 时间线请求。 */
export interface ApplicationRecallTimelineRequest {
  readonly query: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly digest: string;
  readonly depthBefore: number;
  readonly depthAfter: number;
  readonly limit: number;
  readonly origin: "" | "auto" | "manual";
}

/** Recall 观察流请求。 */
export interface ApplicationRecallObservationsRequest {
  readonly taskId: string;
  readonly sessionId: string;
  readonly digest: string;
  readonly query: string;
  readonly limit: number;
  readonly origin: "" | "auto" | "manual";
}

/** Recall 中断恢复请求。 */
export interface ApplicationRecallResumeRequest {
  readonly turnId: string;
}

/** Recall 检查点恢复请求。 */
export interface ApplicationRecallRollbackRequest {
  readonly checkpointId: string;
}

/** Recall 首屏聚合结果。 */
export interface ApplicationRecallBootstrapResult {
  readonly schema: typeof APPLICATION_RECALL_BOOTSTRAP_SCHEMA;
  readonly interrupted: readonly ApplicationRecallRecord[];
  readonly turns: readonly ApplicationRecallRecord[];
  readonly checkpoints: readonly ApplicationRecallRecord[];
  readonly decisions: readonly ApplicationRecallRecord[];
  readonly versions: readonly ApplicationRecallRecord[];
  readonly overview: ApplicationRecallRecord;
}

/** Recall 搜索结果。 */
export interface ApplicationRecallSearchResult {
  readonly schema: typeof APPLICATION_RECALL_SEARCH_SCHEMA;
  readonly query: string;
  readonly results: readonly ApplicationRecallRecord[];
  readonly sources: readonly string[];
}

/** Recall 时间线结果。 */
export interface ApplicationRecallTimelineResult {
  readonly schema: typeof APPLICATION_RECALL_TIMELINE_SCHEMA;
  readonly workspace: string;
  readonly query: string;
  readonly mode: "recent" | "query" | "anchor";
  readonly anchor: ApplicationRecallRecord;
  readonly depthBefore: number;
  readonly depthAfter: number;
  readonly timeline: readonly ApplicationRecallRecord[];
}

/** Recall 观察流结果。 */
export interface ApplicationRecallObservationsResult {
  readonly schema: typeof APPLICATION_RECALL_OBSERVATIONS_SCHEMA;
  readonly workspace: string;
  readonly context: ApplicationRecallRecord;
  readonly observations: readonly ApplicationRecallRecord[];
}

/** Recall 中断恢复结果。 */
export interface ApplicationRecallResumeResult {
  readonly schema: typeof APPLICATION_RECALL_RESUME_SCHEMA;
  readonly status: "ok";
  readonly resumePrompt: string;
  readonly resume: ApplicationRecallRecord;
  readonly turn: ApplicationRecallRecord;
}

/** Recall 检查点恢复结果。 */
export interface ApplicationRecallRollbackResult {
  readonly schema: typeof APPLICATION_RECALL_ROLLBACK_SCHEMA;
  readonly status: "ok";
  readonly message: string;
  readonly checkpointId: string;
}

/** 发送给 Desktop 浮层的 Recall 观察焦点。 */
export interface ApplicationRecallObservationFocusRequest {
  readonly clear: boolean;
  readonly task_id: string;
  readonly session_id: string;
  readonly digest: string;
  readonly title: string;
  readonly task_title: string;
  readonly target: string;
  readonly channel: string;
  readonly summary: string;
  readonly detail: string;
  readonly status: string;
  readonly stage: string;
  readonly event_type: string;
  readonly source: string;
  readonly focus_source: string;
  readonly timestamp: string;
  readonly observation_count: number;
  readonly privacy_mode: string;
  readonly private_segment_count: number;
  readonly observations: readonly ApplicationRecallRecord[];
}

/** Recall 观察焦点发布结果。 */
export interface ApplicationRecallObservationFocusResult {
  readonly schema: typeof APPLICATION_RECALL_FOCUS_SCHEMA;
  readonly delivered: number;
}

const ORIGINS = new Set(["", "auto", "manual"]);
const PRIVATE_FOCUS_FIELDS = new Set([
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
const FOCUS_FIELDS = Object.freeze([
  "clear",
  "task_id",
  "session_id",
  "digest",
  "title",
  "task_title",
  "target",
  "channel",
  "summary",
  "detail",
  "status",
  "stage",
  "event_type",
  "source",
  "focus_source",
  "timestamp",
  "observation_count",
  "privacy_mode",
  "private_segment_count",
  "observations",
]);

/** 解析 Recall 搜索请求；输入未知对象，返回精确字段，非法查询或数量时抛出 TypeError。 */
export function parseApplicationRecallSearchRequest(value: unknown): ApplicationRecallSearchRequest {
  const record = requireExactRecord(value, ["query", "topK", "origin"], "search request");
  return {
    query: requireText(record.query, "query", 2_048, false),
    topK: requireInteger(record.topK, "topK", 1, 20),
    origin: requireOrigin(record.origin),
  };
}

/** 解析 Recall 时间线请求；输入未知对象，返回有界查询与锚点，额外字段时抛出 TypeError。 */
export function parseApplicationRecallTimelineRequest(value: unknown): ApplicationRecallTimelineRequest {
  const record = requireExactRecord(
    value,
    ["query", "taskId", "sessionId", "digest", "depthBefore", "depthAfter", "limit", "origin"],
    "timeline request",
  );
  return {
    query: requireText(record.query, "query", 2_048, true),
    taskId: requireText(record.taskId, "taskId", 512, true),
    sessionId: requireText(record.sessionId, "sessionId", 512, true),
    digest: requireText(record.digest, "digest", 512, true),
    depthBefore: requireInteger(record.depthBefore, "depthBefore", 0, 20),
    depthAfter: requireInteger(record.depthAfter, "depthAfter", 0, 20),
    limit: requireInteger(record.limit, "limit", 1, 80),
    origin: requireOrigin(record.origin),
  };
}

/** 解析 Recall 观察流请求；输入未知对象，返回有界目标，全部目标为空时抛出 TypeError。 */
export function parseApplicationRecallObservationsRequest(
  value: unknown,
): ApplicationRecallObservationsRequest {
  const record = requireExactRecord(
    value,
    ["taskId", "sessionId", "digest", "query", "limit", "origin"],
    "observations request",
  );
  const request = {
    taskId: requireText(record.taskId, "taskId", 512, true),
    sessionId: requireText(record.sessionId, "sessionId", 512, true),
    digest: requireText(record.digest, "digest", 512, true),
    query: requireText(record.query, "query", 2_048, true),
    limit: requireInteger(record.limit, "limit", 1, 120),
    origin: requireOrigin(record.origin),
  };
  if (!request.taskId && !request.sessionId && !request.digest && !request.query) {
    throw new TypeError("Recall observations require one target field.");
  }
  return request;
}

/** 解析 Recall 恢复请求；输入未知对象，返回精确 turn ID，控制字符或额外字段时抛出 TypeError。 */
export function parseApplicationRecallResumeRequest(value: unknown): ApplicationRecallResumeRequest {
  const record = requireExactRecord(value, ["turnId"], "resume request");
  return { turnId: requireIdentifier(record.turnId, "turnId", 128) };
}

/** 解析 Recall 回滚请求；输入未知对象，返回精确检查点 ID，控制字符或额外字段时抛出 TypeError。 */
export function parseApplicationRecallRollbackRequest(value: unknown): ApplicationRecallRollbackRequest {
  const record = requireExactRecord(value, ["checkpointId"], "rollback request");
  return { checkpointId: requireIdentifier(record.checkpointId, "checkpointId", 160) };
}

/** 解析观察焦点请求；输入未知对象，返回有界浮层数据，计数或字段漂移时抛出 TypeError。 */
export function parseApplicationRecallObservationFocusRequest(
  value: unknown,
): ApplicationRecallObservationFocusRequest {
  const record = requireExactRecord(value, FOCUS_FIELDS, "observation focus request");
  if (typeof record.clear !== "boolean" || !Array.isArray(record.observations)) {
    throw new TypeError("Recall observation focus fields are invalid.");
  }
  if (record.observations.length > 6) {
    throw new TypeError("Recall observation focus exceeds its item limit.");
  }
  const observations = clonePublicRecords(record.observations, "observations", 6, 512 * 1024);
  const observationCount = requireInteger(record.observation_count, "observation_count", 0, 6);
  if (observationCount !== observations.length) {
    throw new TypeError("Recall observation focus count is invalid.");
  }
  return {
    clear: record.clear,
    task_id: requireText(record.task_id, "task_id", 512, true),
    session_id: requireText(record.session_id, "session_id", 512, true),
    digest: requireText(record.digest, "digest", 512, true),
    title: requireText(record.title, "title", 1_024, true),
    task_title: requireText(record.task_title, "task_title", 1_024, true),
    target: requireText(record.target, "target", 128, true),
    channel: requireText(record.channel, "channel", 128, true),
    summary: requireText(record.summary, "summary", 4_096, true),
    detail: requireText(record.detail, "detail", 8_192, true),
    status: requireText(record.status, "status", 128, true),
    stage: requireText(record.stage, "stage", 128, true),
    event_type: requireText(record.event_type, "event_type", 128, true),
    source: requireText(record.source, "source", 128, true),
    focus_source: requireText(record.focus_source, "focus_source", 128, true),
    timestamp: requireText(record.timestamp, "timestamp", 128, true),
    observation_count: observationCount,
    privacy_mode: requireText(record.privacy_mode, "privacy_mode", 64, true),
    private_segment_count: requireInteger(record.private_segment_count, "private_segment_count", 0, 1_000_000),
    observations,
  };
}

/** 克隆公开记录数组；输入记录、标签和预算，返回 JSON 副本，非法对象或超限时抛出 TypeError。 */
function clonePublicRecords(
  value: readonly unknown[],
  label: string,
  maximumItems: number,
  maximumBytes: number,
): readonly ApplicationRecallRecord[] {
  if (value.length > maximumItems) throw new TypeError(`Recall ${label} exceeds its item limit.`);
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`Recall ${label} must be JSON serializable.`, { cause: error });
  }
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new TypeError(`Recall ${label} exceeds its byte budget.`);
  }
  const parsed = JSON.parse(serialized) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => !isPlainRecord(item))) {
    throw new TypeError(`Recall ${label} items must be objects.`);
  }
  assertPublicFocusValue(parsed, label, 0);
  return parsed as ApplicationRecallRecord[];
}

/** 校验焦点嵌套值；输入 JSON、路径和深度，无返回，发现私有字段或过深数据时抛出 TypeError。 */
function assertPublicFocusValue(value: unknown, path: string, depth: number): void {
  if (depth > 8) throw new TypeError(`Recall ${path} exceeds its depth budget.`);
  if (Array.isArray(value)) {
    if (value.length > 120) throw new TypeError(`Recall ${path} exceeds its item budget.`);
    value.forEach((item, index) => assertPublicFocusValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!isPlainRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_FOCUS_FIELDS.has(key.toLowerCase())) {
      throw new TypeError(`Recall ${path} contains a private field.`);
    }
    assertPublicFocusValue(item, `${path}.${key}`, depth + 1);
  }
}

/** 校验来源筛选；输入未知值，返回固定来源，未知文本时抛出 TypeError。 */
function requireOrigin(value: unknown): "" | "auto" | "manual" {
  if (typeof value !== "string" || !ORIGINS.has(value)) throw new TypeError("Recall origin is invalid.");
  return value as "" | "auto" | "manual";
}

/** 校验运行时标识；输入未知值、字段和长度，返回文本，空值或控制字符时抛出 TypeError。 */
function requireIdentifier(value: unknown, field: string, maximumLength: number): string {
  const normalized = requireText(value, field, maximumLength, false);
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`Recall field '${field}' contains control characters.`);
  }
  return normalized;
}

/** 校验文本；输入未知值、字段、长度和可空标记，返回去空白文本，非法时抛出 TypeError。 */
function requireText(value: unknown, field: string, maximumLength: number, allowEmpty: boolean): string {
  if (typeof value !== "string") throw new TypeError(`Recall field '${field}' must be text.`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maximumLength || /\u0000/u.test(normalized)) {
    throw new TypeError(`Recall field '${field}' is invalid.`);
  }
  return normalized;
}

/** 校验整数；输入未知值、字段和范围，返回整数，越界或非整数时抛出 TypeError。 */
function requireInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`Recall field '${field}' is invalid.`);
  }
  return value as number;
}

/** 校验精确对象；输入未知值、字段和标签，返回记录，缺失或额外字段时抛出 TypeError。 */
function requireExactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new TypeError(`Recall ${label} must be an object.`);
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new TypeError(`Recall ${label} fields are invalid.`);
  }
  return value;
}

/** 判断未知值是否为普通对象；输入未知值，返回布尔值，无副作用。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
