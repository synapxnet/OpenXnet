import type {
  ApplicationTask,
  ApplicationTaskEvent,
  ApplicationTaskScheduleType,
  ApplicationTaskSnapshot,
  ApplicationTaskStatus,
} from "./application-tasks";
import { parseGetApplicationTaskRequest } from "./application-tasks";

/** IPC channels owned by the Core task-execution coordination boundary. */
export const APPLICATION_TASK_EXECUTION_CHANNELS = Object.freeze({
  refresh: "openxnet:application-task-execution:refresh",
  get: "openxnet:application-task-execution:get",
  createWorkbench: "openxnet:application-task-execution:create-workbench",
  dispatch: "openxnet:application-task-execution:dispatch",
  start: "openxnet:application-task-execution:start",
  resume: "openxnet:application-task-execution:resume",
  cancel: "openxnet:application-task-execution:cancel",
  delete: "openxnet:application-task-execution:delete",
  changed: "openxnet:application-task-execution:changed",
});

/** Versioned detail envelope returned by the task execution coordinator. */
export const APPLICATION_TASK_EXECUTION_SCHEMA = "openxnet.application-task-execution.v1" as const;

/** Versioned backend-native checkpoint schema accepted only from Task Worker. */
export const TASK_EXECUTION_CHECKPOINT_SCHEMA = "openxnet.task-execution-checkpoint.v1" as const;

/** Versioned terminal delivery outcome schema emitted only by Task Worker. */
export const TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA = "openxnet.task-terminal-delivery-outcome.v1" as const;

/** Refresh request for one application workspace. */
export interface RefreshApplicationTaskExecutionsRequest {
  readonly workspacePath?: string;
}

/** Core task snapshot accompanied by the executor's active workspace path. */
export interface ApplicationTaskExecutionSnapshot extends ApplicationTaskSnapshot {
  readonly executionWorkspacePath: string;
}

/** Shared stable-ID request for one Core-owned task execution. */
export interface ApplicationTaskExecutionRequest {
  readonly taskId: string;
}

/** Developer-workbench workflow identifiers owned by Desktop Core. */
export type DeveloperWorkbenchWorkflowKind = "plan" | "review" | "diff" | "patch";

/** Bounded developer-workbench form submitted through the task coordinator. */
export interface CreateDeveloperWorkbenchTaskExecutionRequest {
  readonly workspacePath: string;
  readonly workflowKind: DeveloperWorkbenchWorkflowKind;
  readonly title?: string;
  readonly goal: string;
  readonly targetPaths: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly constraints: readonly string[];
  readonly additionalContext?: string;
  readonly agentType: string;
  readonly engineName: string;
  readonly permissionMode: string;
}

/** Request used to start one pending task execution. */
export interface StartApplicationTaskExecutionRequest extends ApplicationTaskExecutionRequest {
  readonly triggerSource?: string;
}

/** Request used to resume one failed or cancelled task execution. */
export interface ResumeApplicationTaskExecutionRequest extends ApplicationTaskExecutionRequest {
  readonly resumeNote?: string;
  readonly recoveryAction?: string;
}

/** Core task detail enriched with child tasks and compatibility consensus text. */
export interface ApplicationTaskExecutionDetail {
  readonly schema: typeof APPLICATION_TASK_EXECUTION_SCHEMA;
  readonly task: ApplicationTask;
  readonly events: readonly ApplicationTaskEvent[];
  readonly childTasks: readonly ApplicationTask[];
  readonly consensusContent: string;
}

/** Bounded executor checkpoint delivered through the supervised Task Worker. */
export interface ApplicationTaskExecutionCheckpoint {
  readonly schema: typeof TASK_EXECUTION_CHECKPOINT_SCHEMA;
  readonly workspacePath: string;
  readonly legacyTaskId: string;
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly description: string;
  readonly agentType: string;
  readonly status: ApplicationTaskStatus;
  readonly progress: number;
  readonly scheduleType: ApplicationTaskScheduleType;
  readonly scheduleExpression: string;
  readonly nextRunAt: string | null;
  readonly createdAt: string;
  readonly sourceUpdatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly resultSummary: string;
  readonly errorMessage: string;
  readonly message: string;
  readonly detailsPatch: Readonly<Record<string, unknown>>;
}

/** Terminal delivery states persisted independently from execution status. */
export type ApplicationTaskTerminalDeliveryStatus = "delivered" | "retry_scheduled" | "failed";

/** Bounded terminal delivery outcome delivered through the supervised Task Worker. */
export interface ApplicationTaskTerminalDeliveryOutcome {
  readonly schema: typeof TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA;
  readonly workspacePath: string;
  readonly legacyTaskId: string;
  readonly attemptId: string;
  readonly target: string;
  readonly status: ApplicationTaskTerminalDeliveryStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly retryable: boolean;
  readonly attemptedAt: string;
  readonly deliveredAt: string | null;
  readonly nextAttemptAt: string | null;
  readonly method: string;
  readonly message: string;
  readonly error: string;
}

/** Renderer listener for authoritative task snapshot changes. */
export type ApplicationTaskExecutionListener = (snapshot: ApplicationTaskSnapshot) => void;

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse one bounded non-empty text field. */
function parseText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0
    || normalized.length > maximumLength
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return normalized;
}

/** Parse one checkpoint text field that may explicitly be empty. */
function parseCheckpointText(
  value: unknown,
  field: string,
  maximumLength: number,
  allowEmpty: boolean,
): string {
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

/** Parse and normalize one required checkpoint timestamp. */
function parseCheckpointTimestamp(value: unknown, field: string): string {
  const timestamp = parseCheckpointText(value, field, 128, false);
  const milliseconds = Date.parse(timestamp);
  if (Number.isNaN(milliseconds)) {
    throw new Error(`${field} is invalid.`);
  }
  return new Date(milliseconds).toISOString();
}

/** Parse one optional nullable checkpoint timestamp. */
function parseNullableCheckpointTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : parseCheckpointTimestamp(value, field);
}

/** Parse one optional bounded text field. */
function parseOptionalText(value: unknown, field: string, maximumLength: number): string | undefined {
  if (
    value === undefined
    || value === null
    || (typeof value === "string" && value.trim().length === 0)
  ) return undefined;
  return parseText(value, field, maximumLength);
}

/** Parse one bounded list of non-empty text entries. */
function parseTextList(
  value: unknown,
  field: string,
  maximumEntries: number,
  maximumEntryLength: number,
): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumEntries) {
    throw new Error(`${field} must be a bounded array.`);
  }
  return value.map((entry, index) => (
    parseText(entry, `${field}[${index}]`, maximumEntryLength)
  ));
}

/** Parse an exact workspace refresh request. */
export function parseRefreshApplicationTaskExecutionsRequest(
  value: unknown,
): RefreshApplicationTaskExecutionsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "workspacePath")) {
    throw new Error("Task execution refresh request is invalid.");
  }
  return {
    ...(value.workspacePath === undefined
      ? {}
      : { workspacePath: parseText(value.workspacePath, "workspacePath", 32_768) }),
  };
}

/** Parse an exact stable-ID task execution request. */
export function parseApplicationTaskExecutionRequest(
  value: unknown,
): ApplicationTaskExecutionRequest {
  return parseGetApplicationTaskRequest(value);
}

/** Parse one exact developer-workbench creation request. */
export function parseCreateDeveloperWorkbenchTaskExecutionRequest(
  value: unknown,
): CreateDeveloperWorkbenchTaskExecutionRequest {
  const allowed = [
    "workspacePath", "workflowKind", "title", "goal", "targetPaths",
    "acceptanceCriteria", "constraints", "additionalContext", "agentType",
    "engineName", "permissionMode",
  ];
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("Developer workbench task request is invalid.");
  }
  if (!["plan", "review", "diff", "patch"].includes(String(value.workflowKind ?? ""))) {
    throw new Error("Developer workbench workflow is invalid.");
  }
  const title = parseOptionalText(value.title, "title", 96);
  const additionalContext = parseOptionalText(
    value.additionalContext,
    "additionalContext",
    4_096,
  );
  return {
    workspacePath: parseText(value.workspacePath, "workspacePath", 32_768),
    workflowKind: value.workflowKind as DeveloperWorkbenchWorkflowKind,
    ...(title === undefined ? {} : { title }),
    goal: parseText(value.goal, "goal", 4_096),
    targetPaths: parseTextList(value.targetPaths, "targetPaths", 12, 512),
    acceptanceCriteria: parseTextList(value.acceptanceCriteria, "acceptanceCriteria", 12, 512),
    constraints: parseTextList(value.constraints, "constraints", 12, 512),
    ...(additionalContext === undefined ? {} : { additionalContext }),
    agentType: parseText(value.agentType ?? "default", "agentType", 128),
    engineName: parseText(value.engineName ?? "unknown", "engineName", 128),
    permissionMode: parseText(value.permissionMode ?? "default", "permissionMode", 128),
  };
}

/** Parse one bounded start request. */
export function parseStartApplicationTaskExecutionRequest(
  value: unknown,
): StartApplicationTaskExecutionRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["taskId", "triggerSource"].includes(key))) {
    throw new Error("Task execution start request is invalid.");
  }
  const task = parseGetApplicationTaskRequest({ taskId: value.taskId });
  return {
    ...task,
    ...(value.triggerSource === undefined
      ? {}
      : { triggerSource: parseText(value.triggerSource, "triggerSource", 128) }),
  };
}

/** Parse one bounded resume request. */
export function parseResumeApplicationTaskExecutionRequest(
  value: unknown,
): ResumeApplicationTaskExecutionRequest {
  const allowed = ["taskId", "resumeNote", "recoveryAction"];
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("Task execution resume request is invalid.");
  }
  const task = parseGetApplicationTaskRequest({ taskId: value.taskId });
  return {
    ...task,
    ...(value.resumeNote === undefined
      ? {}
      : { resumeNote: parseText(value.resumeNote, "resumeNote", 32_768) }),
    ...(value.recoveryAction === undefined
      ? {}
      : { recoveryAction: parseText(value.recoveryAction, "recoveryAction", 128) }),
  };
}

/** Parse one exact bounded executor checkpoint emitted by the supervised Worker. */
export function parseApplicationTaskExecutionCheckpoint(
  value: unknown,
): ApplicationTaskExecutionCheckpoint {
  const allowed = [
    "schema", "workspacePath", "legacyTaskId", "parentTaskId", "title", "description",
    "agentType", "status", "progress", "scheduleType", "scheduleExpression", "nextRunAt",
    "createdAt", "sourceUpdatedAt", "startedAt", "completedAt", "resultSummary",
    "errorMessage", "message", "detailsPatch",
  ];
  if (
    !isRecord(value)
    || Object.keys(value).length !== allowed.length
    || Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new Error("Task execution checkpoint fields are invalid.");
  }
  if (value.schema !== TASK_EXECUTION_CHECKPOINT_SCHEMA) {
    throw new Error("Task execution checkpoint schema is invalid.");
  }
  const legacyTaskId = parseCheckpointText(value.legacyTaskId, "legacyTaskId", 128, false);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(legacyTaskId)) {
    throw new Error("legacyTaskId is invalid.");
  }
  const status = String(value.status ?? "") as ApplicationTaskStatus;
  if (!["pending", "running", "completed", "failed", "cancelled"].includes(status)) {
    throw new Error("Task execution checkpoint status is invalid.");
  }
  const progress = Number(value.progress);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new Error("Task execution checkpoint progress is invalid.");
  }
  const scheduleType = String(value.scheduleType ?? "") as ApplicationTaskScheduleType;
  if (!["manual", "once", "recurring"].includes(scheduleType)) {
    throw new Error("Task execution checkpoint schedule type is invalid.");
  }
  if (!isRecord(value.detailsPatch)) {
    throw new Error("Task execution checkpoint detailsPatch is invalid.");
  }
  const detailsPayload = JSON.stringify(value.detailsPatch);
  if (Buffer.byteLength(detailsPayload, "utf8") > 256 * 1024) {
    throw new Error("Task execution checkpoint details exceed the payload budget.");
  }
  const parentTaskId = value.parentTaskId === null
    ? null
    : parseCheckpointText(value.parentTaskId, "parentTaskId", 128, false);
  return {
    schema: TASK_EXECUTION_CHECKPOINT_SCHEMA,
    workspacePath: parseCheckpointText(value.workspacePath, "workspacePath", 32_768, false),
    legacyTaskId,
    parentTaskId,
    title: parseCheckpointText(value.title, "title", 512, false),
    description: parseCheckpointText(value.description, "description", 32_768, true),
    agentType: parseCheckpointText(value.agentType, "agentType", 128, false),
    status,
    progress,
    scheduleType,
    scheduleExpression: parseCheckpointText(
      value.scheduleExpression,
      "scheduleExpression",
      2_048,
      true,
    ),
    nextRunAt: parseNullableCheckpointTimestamp(value.nextRunAt, "nextRunAt"),
    createdAt: parseCheckpointTimestamp(value.createdAt, "createdAt"),
    sourceUpdatedAt: parseCheckpointTimestamp(value.sourceUpdatedAt, "sourceUpdatedAt"),
    startedAt: parseNullableCheckpointTimestamp(value.startedAt, "startedAt"),
    completedAt: parseNullableCheckpointTimestamp(value.completedAt, "completedAt"),
    resultSummary: parseCheckpointText(value.resultSummary, "resultSummary", 32_768, true),
    errorMessage: parseCheckpointText(value.errorMessage, "errorMessage", 32_768, true),
    message: parseCheckpointText(value.message, "message", 4_096, true),
    detailsPatch: value.detailsPatch,
  };
}

/** Parse one exact bounded terminal delivery outcome emitted by Task Worker. */
export function parseApplicationTaskTerminalDeliveryOutcome(
  value: unknown,
): ApplicationTaskTerminalDeliveryOutcome {
  const allowed = [
    "schema", "workspacePath", "legacyTaskId", "attemptId", "target", "status",
    "attempt", "maxAttempts", "retryable", "attemptedAt", "deliveredAt",
    "nextAttemptAt", "method", "message", "error",
  ];
  if (
    !isRecord(value)
    || Object.keys(value).length !== allowed.length
    || Object.keys(value).some((key) => !allowed.includes(key))
    || value.schema !== TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA
  ) {
    throw new Error("Task terminal delivery outcome fields are invalid.");
  }
  const legacyTaskId = parseCheckpointText(value.legacyTaskId, "legacyTaskId", 128, false);
  const attemptId = parseCheckpointText(value.attemptId, "attemptId", 128, false);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(legacyTaskId) || !/^dly_[0-9a-f]{32}$/.test(attemptId)) {
    throw new Error("Task terminal delivery identifiers are invalid.");
  }
  const target = parseCheckpointText(value.target, "target", 64, false);
  const validTargets = [
    "desktop_notification", "dynamic_island", "im_bot", "telegram", "discord", "webhook",
  ];
  if (!validTargets.includes(target)) {
    throw new Error("Task terminal delivery target is invalid.");
  }
  const status = String(value.status ?? "") as ApplicationTaskTerminalDeliveryStatus;
  if (!["delivered", "retry_scheduled", "failed"].includes(status)) {
    throw new Error("Task terminal delivery status is invalid.");
  }
  const attempt = Number(value.attempt);
  const maxAttempts = Number(value.maxAttempts);
  if (
    !Number.isInteger(attempt)
    || !Number.isInteger(maxAttempts)
    || attempt < 1
    || maxAttempts < 1
    || maxAttempts > 10
    || attempt > maxAttempts
    || typeof value.retryable !== "boolean"
  ) {
    throw new Error("Task terminal delivery retry fields are invalid.");
  }
  const deliveredAt = parseNullableCheckpointTimestamp(value.deliveredAt, "deliveredAt");
  const nextAttemptAt = parseNullableCheckpointTimestamp(value.nextAttemptAt, "nextAttemptAt");
  const method = parseCheckpointText(value.method, "method", 128, true);
  const message = parseCheckpointText(value.message, "message", 512, true);
  const error = parseCheckpointText(value.error, "error", 512, true);
  if (
    (status === "delivered" && (deliveredAt === null || nextAttemptAt !== null || error !== ""))
    || (status === "retry_scheduled" && (
      nextAttemptAt === null || deliveredAt !== null || value.retryable !== true || error === ""
    ))
    || (status === "failed" && (deliveredAt !== null || nextAttemptAt !== null || error === ""))
  ) {
    throw new Error("Task terminal delivery outcome state is inconsistent.");
  }
  return {
    schema: TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA,
    workspacePath: parseCheckpointText(value.workspacePath, "workspacePath", 32_768, false),
    legacyTaskId,
    attemptId,
    target,
    status,
    attempt,
    maxAttempts,
    retryable: value.retryable,
    attemptedAt: parseCheckpointTimestamp(value.attemptedAt, "attemptedAt"),
    deliveredAt,
    nextAttemptAt,
    method,
    message,
    error,
  };
}
