/** IPC channels owned by the Desktop Core durable-task boundary. */
export const APPLICATION_TASK_CHANNELS = Object.freeze({
  list: "openxnet:application-tasks:list",
  get: "openxnet:application-tasks:get",
  create: "openxnet:application-tasks:create",
});

/** Public schema returned for the application task catalog. */
export const APPLICATION_TASK_SCHEMA = "openxnet.application-tasks.v1" as const;

/** Durable lifecycle states accepted by the Core task state machine. */
export type ApplicationTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** User-visible task priorities retained independently of execution engines. */
export type ApplicationTaskPriority = "low" | "normal" | "high" | "critical";

/** Scheduling modes shared with the current Python execution compatibility layer. */
export type ApplicationTaskScheduleType = "manual" | "once" | "recurring";

/** Artifact relationship attached to one durable task. */
export interface ApplicationTaskArtifactReference {
  readonly artifactId: string;
  readonly relation: "input" | "output";
  readonly label: string;
  readonly ordinal: number;
}

/** One bounded task event retained as an append-only state history. */
export interface ApplicationTaskEvent {
  readonly id: string;
  readonly sequence: number;
  readonly type: string;
  readonly previousStatus: ApplicationTaskStatus | null;
  readonly nextStatus: ApplicationTaskStatus | null;
  readonly progress: number;
  readonly message: string;
  readonly createdAt: string;
}

/** Stable task record owned by Desktop Core. */
export interface ApplicationTask {
  readonly id: string;
  readonly revision: number;
  readonly legacyTaskId: string;
  readonly workspaceId: string;
  readonly workspacePath: string;
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly description: string;
  readonly status: ApplicationTaskStatus;
  readonly progress: number;
  readonly priority: ApplicationTaskPriority;
  readonly agentType: string;
  readonly scheduleType: ApplicationTaskScheduleType;
  readonly scheduleExpression: string;
  readonly nextRunAt: string | null;
  readonly resultSummary: string;
  readonly errorMessage: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly source: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly deletedAt: string | null;
  readonly artifacts: readonly ApplicationTaskArtifactReference[];
}

/** Task catalog returned to an authorized Renderer. */
export interface ApplicationTaskSnapshot {
  readonly schema: typeof APPLICATION_TASK_SCHEMA;
  readonly catalogRevision: number;
  readonly generatedAt: string;
  readonly tasks: readonly ApplicationTask[];
}

/** Detailed task response including append-only Core events. */
export interface ApplicationTaskDetail {
  readonly schema: typeof APPLICATION_TASK_SCHEMA;
  readonly task: ApplicationTask;
  readonly events: readonly ApplicationTaskEvent[];
}

/** Optional task catalog filters. */
export interface ListApplicationTasksRequest {
  readonly workspacePath?: string;
  readonly includeDeleted?: boolean;
}

/** Request for one task by stable Core UUID. */
export interface GetApplicationTaskRequest {
  readonly taskId: string;
}

/** Renderer request used to create one durable Core task before dispatch. */
export interface CreateApplicationTaskRequest {
  readonly workspacePath: string;
  readonly title: string;
  readonly description: string;
  readonly agentType: string;
  readonly priority: ApplicationTaskPriority;
  readonly scheduleType: ApplicationTaskScheduleType;
  readonly scheduleExpression: string;
  readonly nextRunAt: string;
  readonly source: string;
  readonly inputArtifactIds: readonly string[];
  readonly details: Readonly<Record<string, unknown>>;
}

/** Bounded Python execution snapshots imported into Core. */
export interface ReconcileApplicationTasksRequest {
  readonly workspacePath: string;
  readonly tasks: readonly Readonly<Record<string, unknown>>[];
}

/** Explicit Core task state transition request. */
export interface TransitionApplicationTaskRequest {
  readonly taskId: string;
  readonly expectedRevision?: number;
  readonly status: ApplicationTaskStatus;
  readonly progress?: number;
  readonly message?: string;
  readonly resultSummary?: string;
  readonly errorMessage?: string;
  readonly detailsPatch?: Readonly<Record<string, unknown>>;
}

/** Soft-delete request for one durable task. */
export interface DeleteApplicationTaskRequest {
  readonly taskId: string;
  readonly expectedRevision?: number;
}

const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECONCILE_TASKS = 500;
const MAX_RECONCILE_BYTES = 8 * 1024 * 1024;

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize one bounded text value or reject an invalid required field. */
function parseText(value: unknown, field: string, maximumLength: number, allowEmpty = false): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (
    (!allowEmpty && normalized.length === 0)
    || normalized.length > maximumLength
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return normalized;
}

/** Parse one stable Core task UUID. */
function parseTaskId(value: unknown): string {
  const taskId = parseText(value, "taskId", 64);
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error("taskId is invalid.");
  }
  return taskId.toLowerCase();
}

/** Parse one optional optimistic revision. */
function parseExpectedRevision(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 1 || revision > Number.MAX_SAFE_INTEGER) {
    throw new Error("expectedRevision is invalid.");
  }
  return revision;
}

/** Parse one bounded progress percentage. */
function parseProgress(value: unknown): number {
  const progress = Number(value);
  if (!Number.isFinite(progress)) {
    throw new Error("Task progress is invalid.");
  }
  return Math.max(0, Math.min(100, Math.round(progress)));
}

/** Parse a unique list of stable artifact UUIDs. */
function parseArtifactIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 256) {
    throw new Error("inputArtifactIds must be a bounded array.");
  }
  const ids = new Set<string>();
  for (const item of value) {
    const id = parseText(item, "artifactId", 64);
    if (!TASK_ID_PATTERN.test(id)) {
      throw new Error("artifactId is invalid.");
    }
    ids.add(id.toLowerCase());
  }
  return [...ids];
}

/** Parse optional task list filters. */
export function parseListApplicationTasksRequest(value: unknown): ListApplicationTasksRequest {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value) || Object.keys(value).some((key) => !["workspacePath", "includeDeleted"].includes(key))) {
    throw new Error("Task list request is invalid.");
  }
  return {
    ...(value.workspacePath === undefined
      ? {}
      : { workspacePath: parseText(value.workspacePath, "workspacePath", 32_768, true) }),
    ...(value.includeDeleted === true ? { includeDeleted: true } : {}),
  };
}

/** Parse a task detail request. */
export function parseGetApplicationTaskRequest(value: unknown): GetApplicationTaskRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new Error("Exact taskId is required.");
  }
  return { taskId: parseTaskId(value.taskId) };
}

/** Parse one complete durable task creation request. */
export function parseCreateApplicationTaskRequest(value: unknown): CreateApplicationTaskRequest {
  const allowed = [
    "workspacePath", "title", "description", "agentType", "priority", "scheduleType",
    "scheduleExpression", "nextRunAt", "source", "inputArtifactIds", "details",
  ];
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("Task creation request is invalid.");
  }
  const priority: ApplicationTaskPriority = value.priority === "critical"
    ? "critical"
    : value.priority === "high"
      ? "high"
      : value.priority === "low" ? "low" : "normal";
  const scheduleType: ApplicationTaskScheduleType = value.scheduleType === "once"
    ? "once"
    : value.scheduleType === "recurring" ? "recurring" : "manual";
  if (!isRecord(value.details)) {
    throw new Error("Task details must be an object.");
  }
  return {
    workspacePath: parseText(value.workspacePath, "workspacePath", 32_768),
    title: parseText(value.title, "title", 512),
    description: parseText(value.description, "description", 32_768),
    agentType: parseText(value.agentType ?? "default", "agentType", 128),
    priority,
    scheduleType,
    scheduleExpression: parseText(value.scheduleExpression ?? "", "scheduleExpression", 2_048, true),
    nextRunAt: parseText(value.nextRunAt ?? "", "nextRunAt", 128, true),
    source: parseText(value.source ?? "renderer", "source", 128),
    inputArtifactIds: parseArtifactIds(value.inputArtifactIds ?? []),
    details: value.details,
  };
}

/** Parse a bounded batch of Python execution snapshots. */
export function parseReconcileApplicationTasksRequest(value: unknown): ReconcileApplicationTasksRequest {
  if (
    !isRecord(value)
    || Object.keys(value).some((key) => !["workspacePath", "tasks"].includes(key))
    || !Array.isArray(value.tasks)
    || value.tasks.length > MAX_RECONCILE_TASKS
  ) {
    throw new Error("Task reconciliation request is invalid.");
  }
  let serializedTasks: string;
  try {
    serializedTasks = JSON.stringify(value.tasks);
  } catch {
    throw new Error("Task reconciliation entries must be JSON serializable.");
  }
  if (Buffer.byteLength(serializedTasks, "utf8") > MAX_RECONCILE_BYTES) {
    throw new Error("Task reconciliation request exceeds the payload budget.");
  }
  const tasks = value.tasks.map((task) => {
    if (!isRecord(task)) {
      throw new Error("Task reconciliation entries must be objects.");
    }
    return task;
  });
  return {
    workspacePath: parseText(value.workspacePath, "workspacePath", 32_768),
    tasks,
  };
}

/** Parse an explicit state transition request. */
export function parseTransitionApplicationTaskRequest(value: unknown): TransitionApplicationTaskRequest {
  const allowed = [
    "taskId", "expectedRevision", "status", "progress", "message",
    "resultSummary", "errorMessage", "detailsPatch",
  ];
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("Task transition request is invalid.");
  }
  if (!["pending", "running", "completed", "failed", "cancelled"].includes(String(value.status))) {
    throw new Error("Task status is invalid.");
  }
  if (value.detailsPatch !== undefined && !isRecord(value.detailsPatch)) {
    throw new Error("detailsPatch must be an object.");
  }
  const expectedRevision = parseExpectedRevision(value.expectedRevision);
  return {
    taskId: parseTaskId(value.taskId),
    status: value.status as ApplicationTaskStatus,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    ...(value.progress === undefined ? {} : { progress: parseProgress(value.progress) }),
    ...(value.message === undefined ? {} : { message: parseText(value.message, "message", 4_096, true) }),
    ...(value.resultSummary === undefined
      ? {}
      : { resultSummary: parseText(value.resultSummary, "resultSummary", 32_768, true) }),
    ...(value.errorMessage === undefined
      ? {}
      : { errorMessage: parseText(value.errorMessage, "errorMessage", 32_768, true) }),
    ...(isRecord(value.detailsPatch) ? { detailsPatch: value.detailsPatch } : {}),
  };
}

/** Parse a soft-delete request with an optional optimistic revision. */
export function parseDeleteApplicationTaskRequest(value: unknown): DeleteApplicationTaskRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["taskId", "expectedRevision"].includes(key))) {
    throw new Error("Task deletion request is invalid.");
  }
  const expectedRevision = parseExpectedRevision(value.expectedRevision);
  return {
    taskId: parseTaskId(value.taskId),
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  };
}
