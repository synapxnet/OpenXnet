import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  APPLICATION_TASK_SCHEMA,
  parseCreateApplicationTaskRequest,
  parseDeleteApplicationTaskRequest,
  parseGetApplicationTaskRequest,
  parseListApplicationTasksRequest,
  parseReconcileApplicationTasksRequest,
  parseTransitionApplicationTaskRequest,
  type ApplicationTask,
  type ApplicationTaskArtifactReference,
  type ApplicationTaskDetail,
  type ApplicationTaskEvent,
  type ApplicationTaskPriority,
  type ApplicationTaskScheduleType,
  type ApplicationTaskSnapshot,
  type ApplicationTaskStatus,
  type CreateApplicationTaskRequest,
} from "../contracts/application-tasks";
import {
  parseApplicationTaskExecutionCheckpoint,
  parseApplicationTaskTerminalDeliveryOutcome,
  type ApplicationTaskExecutionCheckpoint,
  type ApplicationTaskTerminalDeliveryOutcome,
} from "../contracts/application-task-execution";
import {
  APPLICATION_DATABASE_FILENAME,
  ApplicationStore,
} from "./application-store";

/** Maximum compatibility details retained for one durable task. */
export const MAX_APPLICATION_TASK_DETAILS_BYTES = 256 * 1024;

/** Options used to bootstrap the Desktop Core task boundary. */
export interface BootstrapApplicationTasksOptions {
  readonly userDataDirectory: string;
  readonly databasePath?: string;
  readonly now?: () => Date;
  readonly deliveryCredentials?: ApplicationTaskDeliveryCredentialBoundary;
}

/** Credential operations required by the durable task persistence boundary. */
export interface ApplicationTaskDeliveryCredentialBoundary {
  reconcileTaskDetails(
    workspacePath: string,
    taskId: string,
    details: Readonly<Record<string, unknown>>,
    options?: { readonly requireSecureCapture?: boolean },
  ): { readonly details: Readonly<Record<string, unknown>>; readonly persistSanitized: boolean };
  clearTask(workspacePath: string, taskId: string): void;
}

interface ApplicationTaskRow {
  readonly task_id: string;
  readonly revision: number;
  readonly legacy_task_id: string;
  readonly workspace_id: string;
  readonly workspace_path: string;
  readonly parent_task_id: string | null;
  readonly title: string;
  readonly description: string;
  readonly status: ApplicationTaskStatus;
  readonly progress: number;
  readonly priority: ApplicationTaskPriority;
  readonly agent_type: string;
  readonly schedule_type: ApplicationTaskScheduleType;
  readonly schedule_expression: string;
  readonly next_run_at: string | null;
  readonly result_summary: string;
  readonly error_message: string;
  readonly details_json: string;
  readonly source: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly deleted_at: string | null;
}

interface ApplicationTaskArtifactRow {
  readonly artifact_id: string;
  readonly relation: "input" | "output";
  readonly label: string;
  readonly ordinal: number;
}

interface ApplicationTaskEventRow {
  readonly event_id: string;
  readonly sequence: number;
  readonly event_type: string;
  readonly previous_status: ApplicationTaskStatus | null;
  readonly next_status: ApplicationTaskStatus | null;
  readonly progress: number;
  readonly message: string;
  readonly created_at: string;
}

interface CatalogRevisionRow {
  readonly revision: number;
}

interface ReconciledTask {
  readonly legacyTaskId: string;
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
  readonly details: Record<string, unknown>;
  readonly source: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_TRANSITIONS: Readonly<Record<ApplicationTaskStatus, ReadonlySet<ApplicationTaskStatus>>> = {
  pending: new Set(["pending", "running", "completed", "failed", "cancelled"]),
  running: new Set(["running", "completed", "failed", "cancelled"]),
  completed: new Set(["completed", "pending"]),
  failed: new Set(["failed", "pending"]),
  cancelled: new Set(["cancelled", "pending"]),
};

/** Stable conflict raised when an optimistic task mutation is stale. */
export class ApplicationTaskConflictError extends Error {
  /** Create a task revision conflict for one stable task ID. */
  public constructor(public readonly taskId: string) {
    super(`Application task '${taskId}' has changed.`);
    this.name = "ApplicationTaskConflictError";
  }
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return one bounded string without accepting control characters. */
function boundedText(value: unknown, maximumLength: number, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    return fallback;
  }
  return normalized;
}

/** Clamp one unknown number to a whole task progress percentage. */
function boundedProgress(value: unknown): number {
  const progress = Number(value);
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
}

/** Normalize one timestamp or return a supplied fallback. */
function normalizeTimestamp(value: unknown, fallback: string | null): string | null {
  const text = boundedText(value, 128);
  if (!text || Number.isNaN(Date.parse(text))) {
    return fallback;
  }
  return new Date(text).toISOString();
}

/** Normalize one task status from current and historical execution values. */
function normalizeStatus(value: unknown): ApplicationTaskStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "running" || status === "processing") return "running";
  if (status === "completed" || status === "success") return "completed";
  if (status === "failed" || status === "error") return "failed";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  return "pending";
}

/** Normalize one user-visible task priority. */
function normalizePriority(value: unknown): ApplicationTaskPriority {
  const priority = String(value ?? "").trim().toLowerCase();
  if (["critical", "severe"].includes(priority)) return "critical";
  if (priority === "high") return "high";
  if (["low", "minor"].includes(priority)) return "low";
  return "normal";
}

/** Normalize one schedule type from compatibility task details. */
function normalizeScheduleType(value: unknown): ApplicationTaskScheduleType {
  return value === "once" ? "once" : value === "recurring" ? "recurring" : "manual";
}

/** Serialize a detached JSON object while enforcing the task details budget. */
function normalizeDetails(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    throw new Error("Task details must be JSON serializable.");
  }
  if (Buffer.byteLength(payload, "utf8") > MAX_APPLICATION_TASK_DETAILS_BYTES) {
    const reduced = {
      context: isRecord(value.context) ? value.context : {},
      execution_trace: Array.isArray(value.execution_trace) ? value.execution_trace.slice(-100) : [],
      resume_context: isRecord(value.resume_context) ? value.resume_context : {},
      failure_analysis: isRecord(value.failure_analysis) ? value.failure_analysis : {},
      summary: boundedText(value.summary, 8_192),
      last_event: boundedText(value.last_event, 4_096),
      details_truncated: true,
    };
    const reducedPayload = JSON.stringify(reduced);
    if (Buffer.byteLength(reducedPayload, "utf8") > MAX_APPLICATION_TASK_DETAILS_BYTES) {
      return { summary: boundedText(value.summary, 8_192), details_truncated: true };
    }
    return JSON.parse(reducedPayload) as Record<string, unknown>;
  }
  return JSON.parse(payload) as Record<string, unknown>;
}

/** Reduce full execution details to the fields needed by task list surfaces. */
function summarizeDetails(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const summaryKeys = [
    "summary", "last_event", "last_error", "last_result_preview", "is_resumable",
    "failure_analysis", "failure_category", "failure_label", "failure_summary",
    "failure_severity", "retry_recommended", "recovery_suggestions", "recovery_hint",
    "recovery_actions", "interrupted_recovery_required", "interrupted_at",
    "interrupted_reason", "last_active_status", "last_active_at", "last_active_progress",
    "activation_requested_at", "activation_source", "delivery_targets",
    "delivery_target_labels", "delivery_status", "delivery_status_label",
    "delivery_records", "delivery_last_error", "delivery_last_error_at",
    "delivery_next_attempt_at", "last_delivery_at", "schedule_summary",
    "start_immediately", "created_from",
    "engine_name", "cancel_requested", "cancel_reason", "input_artifact_ids",
    "output_artifact_ids", "child_task_count",
  ];
  const summary: Record<string, unknown> = {};
  for (const key of summaryKeys) {
    if (value[key] !== undefined) summary[key] = value[key];
  }
  const context = isRecord(value.context) ? value.context : {};
  summary.context = {
    created_from: context.created_from,
    priority: context.priority,
    core_task_id: context.core_task_id,
    input_artifact_ids: context.input_artifact_ids,
    output_artifact_ids: context.output_artifact_ids,
  };
  return normalizeDetails(summary);
}

/** Serialize normalized details for SQLite storage. */
function serializeDetails(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(normalizeDetails(value));
}

/** Parse stored task details while rejecting database corruption. */
function parseStoredDetails(payload: string, taskId: string): Record<string, unknown> {
  try {
    const value = JSON.parse(payload) as unknown;
    if (!isRecord(value)) {
      throw new Error("not an object");
    }
    return value;
  } catch {
    throw new Error(`Application task '${taskId}' contains invalid details JSON.`);
  }
}

/** Resolve one canonical workspace path and deterministic local identifier. */
function resolveWorkspace(workspacePath: string): { path: string; id: string } {
  const absolutePath = path.resolve(workspacePath);
  let resolvedPath = absolutePath;
  try {
    resolvedPath = realpathSync.native(absolutePath);
  } catch {
    // A task may be drafted before its workspace directory is created.
  }
  const fingerprintPath = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
  return {
    path: resolvedPath,
    id: createHash("sha256").update(fingerprintPath, "utf8").digest("hex"),
  };
}

/** Normalize one legacy execution snapshot into the Core task model. */
function normalizeReconciledTask(
  value: Readonly<Record<string, unknown>>,
  now: string,
): ReconciledTask {
  const context = isRecord(value.context) ? value.context : {};
  const rawLegacyId = boundedText(value.legacy_task_id ?? value.task_id ?? value.id, 128);
  const legacyTaskId = LEGACY_TASK_ID_PATTERN.test(rawLegacyId)
    ? rawLegacyId
    : `legacy-${createHash("sha256").update(JSON.stringify([
        value.title,
        value.created_at,
        value.description,
      ])).digest("hex").slice(0, 24)}`;
  const createdAt = normalizeTimestamp(value.created_at, now) ?? now;
  const updatedAt = normalizeTimestamp(value.updated_at, createdAt) ?? createdAt;
  const status = normalizeStatus(value.status);
  const resultSummary = boundedText(
    value.result_summary ?? value.last_result_preview ?? value.summary ?? value.result,
    32_768,
  );
  const errorMessage = boundedText(value.error_message ?? value.last_error ?? value.error, 32_768);
  return {
    legacyTaskId,
    parentTaskId: boundedText(value.parent_task_id, 128) || null,
    title: boundedText(value.title, 512, legacyTaskId) || legacyTaskId,
    description: boundedText(value.description, 32_768),
    status,
    progress: status === "completed" ? 100 : boundedProgress(value.progress),
    priority: normalizePriority(value.priority ?? context.priority ?? value.failure_severity),
    agentType: boundedText(value.agent_type ?? value.engine_name, 128, "default") || "default",
    scheduleType: normalizeScheduleType(value.schedule_type ?? context.schedule_type),
    scheduleExpression: boundedText(value.schedule_expression ?? context.schedule_expression, 2_048),
    nextRunAt: normalizeTimestamp(value.next_run_at ?? context.next_run_at, null),
    resultSummary,
    errorMessage,
    details: normalizeDetails(value),
    source: boundedText(value.created_from ?? context.created_from, 128, "legacy-python") || "legacy-python",
    createdAt,
    updatedAt,
    startedAt: normalizeTimestamp(value.started_at, null),
    completedAt: normalizeTimestamp(value.completed_at, status === "completed" ? updatedAt : null),
  };
}

/** Desktop Core durable task repository and state machine. */
export class ApplicationTaskService {
  private closed = false;
  private operationQueue: Promise<void> = Promise.resolve();

  /** Create a task service over the migration-managed application database. */
  public constructor(
    private readonly database: DatabaseSync,
    private readonly now: () => Date,
    private readonly deliveryCredentials?: ApplicationTaskDeliveryCredentialBoundary,
  ) {
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA trusted_schema = OFF");
    this.migrateStoredDeliveryCredentials();
  }

  /** List durable tasks, optionally constrained to one workspace. */
  public listTasks(request: unknown = {}): Promise<ApplicationTaskSnapshot> {
    const parsed = parseListApplicationTasksRequest(request);
    return this.enqueueOperation(async () => {
      const workspace = parsed.workspacePath ? resolveWorkspace(parsed.workspacePath) : null;
      return this.createSnapshot(workspace?.id ?? null, parsed.includeDeleted === true);
    });
  }

  /** Return one durable task and its append-only Core event history. */
  public getTask(request: unknown): Promise<ApplicationTaskDetail> {
    const { taskId } = parseGetApplicationTaskRequest(request);
    return this.enqueueOperation(async () => {
      const row = this.getRowById(taskId);
      if (row === null || row.deleted_at !== null) {
        throw new Error(`Application task '${taskId}' was not found.`);
      }
      return {
        schema: APPLICATION_TASK_SCHEMA,
        task: this.rowToTask(row),
        events: this.listEvents(taskId),
      };
    });
  }

  /** Persist a new task before any Python execution dispatch occurs. */
  public createTask(request: unknown): Promise<ApplicationTask> {
    const parsed = parseCreateApplicationTaskRequest(request);
    return this.enqueueOperation(async () => this.insertCreatedTask(parsed));
  }

  /** Reconcile bounded Python execution snapshots into the authoritative Core store. */
  public reconcileTasks(request: unknown): Promise<ApplicationTaskSnapshot> {
    const parsed = parseReconcileApplicationTasksRequest(request);
    return this.enqueueOperation(async () => {
      const workspace = resolveWorkspace(parsed.workspacePath);
      const now = this.now().toISOString();
      this.runTransaction(() => {
        for (const candidate of parsed.tasks) {
          this.reconcileOneTask(workspace, normalizeReconciledTask(candidate, now));
        }
        this.resolveParentTaskReferences(workspace.id);
      });
      return this.createSnapshot(workspace.id, false);
    });
  }

  /** Apply one Worker-validated executor checkpoint without replacing Core identity. */
  public applyExecutionCheckpoint(request: unknown): Promise<ApplicationTaskSnapshot> {
    const checkpoint = parseApplicationTaskExecutionCheckpoint(request);
    return this.enqueueOperation(async () => this.applyCheckpoint(checkpoint));
  }

  /** Apply one Worker-validated terminal delivery outcome without changing execution status. */
  public applyTerminalDelivery(request: unknown): Promise<ApplicationTaskSnapshot> {
    const outcome = parseApplicationTaskTerminalDeliveryOutcome(request);
    return this.enqueueOperation(async () => this.applyTerminalDeliveryOutcome(outcome));
  }

  /** Apply one validated optimistic task state transition. */
  public transitionTask(request: unknown): Promise<ApplicationTask> {
    const parsed = parseTransitionApplicationTaskRequest(request);
    return this.enqueueOperation(async () => this.applyTransition(parsed));
  }

  /** Soft-delete one non-running task while retaining identity and history. */
  public deleteTask(request: unknown): Promise<ApplicationTaskSnapshot> {
    const parsed = parseDeleteApplicationTaskRequest(request);
    return this.enqueueOperation(async () => {
      const row = this.getRowById(parsed.taskId);
      if (row === null || row.deleted_at !== null) {
        throw new Error(`Application task '${parsed.taskId}' was not found.`);
      }
      if (parsed.expectedRevision !== undefined && parsed.expectedRevision !== Number(row.revision)) {
        throw new ApplicationTaskConflictError(parsed.taskId);
      }
      if (row.status === "running") {
        throw new Error("Running tasks must be cancelled before deletion.");
      }
      const deletedAt = this.now().toISOString();
      this.runTransaction(() => {
        this.database.prepare(`
          UPDATE application_tasks
          SET revision = revision + 1, updated_at = ?, deleted_at = ?
          WHERE task_id = ? AND deleted_at IS NULL
        `).run(deletedAt, deletedAt, parsed.taskId);
        this.appendEvent(
          parsed.taskId,
          "deleted",
          row.status,
          row.status,
          Number(row.progress),
          "Task deleted from the application task catalog.",
          deletedAt,
        );
      });
      this.deliveryCredentials?.clearTask(row.workspace_path, row.legacy_task_id);
      return this.createSnapshot(row.workspace_id, false);
    });
  }

  /** Close the task database handle after application shutdown begins. */
  public close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  /** Serialize public task operations to preserve event and revision ordering. */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.assertOpen();
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  /** Insert one Core-created task and its initial artifact links and event. */
  private insertCreatedTask(request: CreateApplicationTaskRequest): ApplicationTask {
    const workspace = resolveWorkspace(request.workspacePath);
    const taskId = randomUUID();
    const createdAt = this.now().toISOString();
    const details = this.protectDeliveryDetails(
      workspace.path,
      taskId,
      normalizeDetails({
        ...request.details,
        input_artifact_ids: request.inputArtifactIds,
      }),
      true,
    );
    this.runTransaction(() => {
      this.database.prepare(`
        INSERT INTO application_tasks (
          task_id, revision, legacy_task_id, workspace_id, workspace_path, parent_task_id,
          title, description, status, progress, priority, agent_type, schedule_type,
          schedule_expression, next_run_at, result_summary, error_message, details_json,
          source, created_at, updated_at, started_at, completed_at, deleted_at
        ) VALUES (?, 1, ?, ?, ?, NULL, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, NULL, NULL, NULL)
      `).run(
        taskId,
        taskId,
        workspace.id,
        workspace.path,
        request.title,
        request.description,
        request.priority,
        request.agentType,
        request.scheduleType,
        request.scheduleExpression,
        request.nextRunAt || null,
        serializeDetails(details),
        request.source,
        createdAt,
        createdAt,
      );
      this.replaceArtifactReferences(taskId, "input", request.inputArtifactIds);
      this.appendEvent(taskId, "created", null, "pending", 0, "Task created in Desktop Core.", createdAt);
    });
    const row = this.getRowById(taskId);
    if (row === null) throw new Error("Created task metadata was not persisted.");
    return this.rowToTask(row);
  }

  /** Insert or update one execution snapshot within an existing transaction. */
  private reconcileOneTask(
    workspace: { readonly path: string; readonly id: string },
    task: ReconciledTask,
  ): void {
    const existing = this.getRowByLegacyId(workspace.id, task.legacyTaskId);
    if (existing !== null && existing.deleted_at !== null) return;
    const parentTaskId = this.resolveLegacyParentId(workspace.id, task.parentTaskId)
      ?? task.parentTaskId;
    const protectedDetails = this.protectDeliveryDetails(
      workspace.path,
      task.legacyTaskId,
      task.details,
      true,
    );
    const detailsJson = serializeDetails(protectedDetails);
    if (existing === null) {
      const taskId = TASK_ID_PATTERN.test(task.legacyTaskId) && this.getRowById(task.legacyTaskId) === null
        ? task.legacyTaskId.toLowerCase()
        : randomUUID();
      this.database.prepare(`
        INSERT INTO application_tasks (
          task_id, revision, legacy_task_id, workspace_id, workspace_path, parent_task_id,
          title, description, status, progress, priority, agent_type, schedule_type,
          schedule_expression, next_run_at, result_summary, error_message, details_json,
          source, created_at, updated_at, started_at, completed_at, deleted_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        taskId,
        task.legacyTaskId,
        workspace.id,
        workspace.path,
        parentTaskId,
        task.title,
        task.description,
        task.status,
        task.progress,
        task.priority,
        task.agentType,
        task.scheduleType,
        task.scheduleExpression,
        task.nextRunAt,
        task.resultSummary,
        task.errorMessage,
        detailsJson,
        task.source,
        task.createdAt,
        task.updatedAt,
        task.startedAt,
        task.completedAt,
      );
      this.syncArtifactReferencesFromDetails(taskId, task.details);
      this.appendEvent(
        taskId,
        "migrated",
        null,
        task.status,
        task.progress,
        "Task imported from the Python execution mirror.",
        task.updatedAt,
      );
      return;
    }
    if (Date.parse(task.updatedAt) <= Date.parse(existing.updated_at)) {
      return;
    }
    if (!ALLOWED_TRANSITIONS[existing.status].has(task.status)) {
      return;
    }
    const changed = existing.parent_task_id !== parentTaskId
      || existing.title !== task.title
      || existing.description !== task.description
      || existing.status !== task.status
      || Number(existing.progress) !== task.progress
      || existing.priority !== task.priority
      || existing.agent_type !== task.agentType
      || existing.schedule_type !== task.scheduleType
      || existing.schedule_expression !== task.scheduleExpression
      || existing.next_run_at !== task.nextRunAt
      || existing.result_summary !== task.resultSummary
      || existing.error_message !== task.errorMessage
      || existing.details_json !== detailsJson
      || existing.started_at !== task.startedAt
      || existing.completed_at !== task.completedAt;
    if (!changed) return;
    this.database.prepare(`
      UPDATE application_tasks SET
        revision = revision + 1, workspace_path = ?, parent_task_id = ?, title = ?,
        description = ?, status = ?, progress = ?, priority = ?, agent_type = ?,
        schedule_type = ?, schedule_expression = ?, next_run_at = ?, result_summary = ?,
        error_message = ?, details_json = ?, updated_at = ?, started_at = ?, completed_at = ?
      WHERE task_id = ?
    `).run(
      workspace.path,
      parentTaskId,
      task.title,
      task.description,
      task.status,
      task.progress,
      task.priority,
      task.agentType,
      task.scheduleType,
      task.scheduleExpression,
      task.nextRunAt,
      task.resultSummary,
      task.errorMessage,
      detailsJson,
      task.updatedAt,
      task.startedAt,
      task.completedAt,
      existing.task_id,
    );
    this.syncArtifactReferencesFromDetails(existing.task_id, task.details);
    if (existing.status !== task.status || Number(existing.progress) !== task.progress) {
      this.appendEvent(
        existing.task_id,
        "execution-sync",
        existing.status,
        task.status,
        task.progress,
        boundedText(task.details.last_event, 4_096, "Execution state synchronized from Python."),
        task.updatedAt,
      );
    }
  }

  /** Insert or advance one workspace-scoped executor checkpoint. */
  private applyCheckpoint(
    checkpoint: ApplicationTaskExecutionCheckpoint,
  ): ApplicationTaskSnapshot {
    const workspace = resolveWorkspace(checkpoint.workspacePath);
    const existing = this.getRowByLegacyId(workspace.id, checkpoint.legacyTaskId);
    if (existing === null) {
      const details = this.mergeCheckpointDetails({}, checkpoint);
      this.runTransaction(() => {
        this.reconcileOneTask(workspace, normalizeReconciledTask({
          ...details,
          task_id: checkpoint.legacyTaskId,
          parent_task_id: checkpoint.parentTaskId,
          title: checkpoint.title,
          description: checkpoint.description,
          agent_type: checkpoint.agentType,
          status: checkpoint.status,
          progress: checkpoint.progress,
          schedule_type: checkpoint.scheduleType,
          schedule_expression: checkpoint.scheduleExpression,
          next_run_at: checkpoint.nextRunAt,
          result_summary: checkpoint.resultSummary,
          error_message: checkpoint.errorMessage,
          created_at: checkpoint.createdAt,
          updated_at: checkpoint.sourceUpdatedAt,
          started_at: checkpoint.startedAt,
          completed_at: checkpoint.completedAt,
          context: isRecord(details.context) ? details.context : {},
        }, checkpoint.sourceUpdatedAt));
      });
      return this.createSnapshot(workspace.id, false);
    }
    if (
      existing.deleted_at !== null
      || Date.parse(checkpoint.sourceUpdatedAt) <= Date.parse(existing.updated_at)
      || !ALLOWED_TRANSITIONS[existing.status].has(checkpoint.status)
    ) {
      return this.createSnapshot(workspace.id, false);
    }
    const progress = checkpoint.status === "completed" ? 100 : checkpoint.progress;
    const details = this.protectDeliveryDetails(
      workspace.path,
      existing.legacy_task_id,
      this.mergeCheckpointDetails(
        parseStoredDetails(existing.details_json, existing.task_id),
        checkpoint,
      ),
      true,
    );
    const detailsJson = serializeDetails(details);
    const changed = existing.status !== checkpoint.status
      || Number(existing.progress) !== progress
      || existing.next_run_at !== checkpoint.nextRunAt
      || existing.result_summary !== checkpoint.resultSummary
      || existing.error_message !== checkpoint.errorMessage
      || existing.details_json !== detailsJson
      || existing.started_at !== checkpoint.startedAt
      || existing.completed_at !== checkpoint.completedAt;
    if (!changed) return this.createSnapshot(workspace.id, false);
    this.runTransaction(() => {
      this.database.prepare(`
        UPDATE application_tasks SET
          revision = revision + 1, status = ?, progress = ?, next_run_at = ?,
          result_summary = ?, error_message = ?, details_json = ?, updated_at = ?,
          started_at = ?, completed_at = ?
        WHERE task_id = ? AND deleted_at IS NULL
      `).run(
        checkpoint.status,
        progress,
        checkpoint.nextRunAt,
        checkpoint.resultSummary,
        checkpoint.errorMessage,
        detailsJson,
        checkpoint.sourceUpdatedAt,
        checkpoint.startedAt,
        checkpoint.completedAt,
        existing.task_id,
      );
      this.appendEvent(
        existing.task_id,
        "executor-checkpoint",
        existing.status,
        checkpoint.status,
        progress,
        checkpoint.message || "Executor checkpoint synchronized through Task Worker.",
        checkpoint.sourceUpdatedAt,
      );
    });
    return this.createSnapshot(workspace.id, false);
  }

  /** Merge bounded checkpoint details while retaining Core-owned metadata. */
  private mergeCheckpointDetails(
    current: Readonly<Record<string, unknown>>,
    checkpoint: ApplicationTaskExecutionCheckpoint,
  ): Record<string, unknown> {
    const patch = checkpoint.detailsPatch;
    const currentContext = isRecord(current.context) ? current.context : {};
    const patchContext = isRecord(patch.context) ? patch.context : {};
    return normalizeDetails({
      ...current,
      ...patch,
      context: { ...currentContext, ...patchContext },
      executor_checkpoint: {
        schema: checkpoint.schema,
        source_updated_at: checkpoint.sourceUpdatedAt,
        status: checkpoint.status,
        progress: checkpoint.progress,
      },
    });
  }

  /** Merge one idempotent terminal delivery outcome into Core task details. */
  private applyTerminalDeliveryOutcome(
    outcome: ApplicationTaskTerminalDeliveryOutcome,
  ): ApplicationTaskSnapshot {
    const workspace = resolveWorkspace(outcome.workspacePath);
    const existing = this.getRowByLegacyId(workspace.id, outcome.legacyTaskId);
    if (
      existing === null
      || existing.deleted_at !== null
      || !["completed", "failed", "cancelled"].includes(existing.status)
    ) {
      return this.createSnapshot(workspace.id, false);
    }
    const currentDetails = parseStoredDetails(existing.details_json, existing.task_id);
    const currentContext = isRecord(currentDetails.context) ? currentDetails.context : {};
    const records = this.indexDeliveryRecords(
      currentDetails.delivery_records ?? currentContext.delivery_records,
    );
    const currentRecord = records.get(outcome.target) ?? {};
    const currentAttempt = Number(currentRecord.attempts ?? 0);
    if (
      currentRecord.last_attempt_id === outcome.attemptId
      || (Number.isInteger(currentAttempt) && currentAttempt >= outcome.attempt)
    ) {
      return this.createSnapshot(workspace.id, false);
    }
    const nextRecord: Record<string, unknown> = {
      ...currentRecord,
      target: outcome.target,
      status: outcome.status,
      attempts: outcome.attempt,
      max_attempts: outcome.maxAttempts,
      retryable: outcome.retryable,
      last_attempt_id: outcome.attemptId,
      last_attempt_at: outcome.attemptedAt,
      last_delivered_at: outcome.deliveredAt,
      next_attempt_at: outcome.nextAttemptAt,
      last_method: outcome.method,
      last_message: outcome.message,
      last_error: outcome.error,
    };
    records.set(outcome.target, nextRecord);
    const recordList = [...records.values()];
    const statuses = recordList.map((record) => String(record.status ?? "").trim());
    const deliveryStatus = statuses.includes("retry_scheduled")
      ? "retry_scheduled"
      : statuses.includes("queued")
        ? "queued"
        : statuses.includes("failed")
          ? "failed"
          : statuses.length > 0 && statuses.every((status) => status === "delivered")
            ? "delivered"
            : outcome.status;
    const deliveryStatusLabel = deliveryStatus === "retry_scheduled"
      ? "Retry Scheduled"
      : deliveryStatus === "delivered"
        ? "Delivered"
        : deliveryStatus === "failed"
          ? "Failed"
          : deliveryStatus === "queued" ? "Queued" : deliveryStatus;
    const nextAttempts = recordList
      .map((record) => normalizeTimestamp(record.next_attempt_at, null))
      .filter((value): value is string => value !== null);
    const nextAttemptAt = nextAttempts.sort()[0] ?? null;
    const failedRecords = recordList
      .map((record) => ({
        error: boundedText(record.last_error, 512),
        attemptedAt: normalizeTimestamp(record.last_attempt_at, null),
      }))
      .filter((record) => record.error !== "")
      .sort((left, right) => String(left.attemptedAt ?? "").localeCompare(String(right.attemptedAt ?? "")));
    const lastFailure = failedRecords.at(-1);
    const deliveredTimes = recordList
      .map((record) => normalizeTimestamp(record.last_delivered_at, null))
      .filter((value): value is string => value !== null)
      .sort();
    const lastDeliveryAt = deliveredTimes.at(-1)
      ?? normalizeTimestamp(currentDetails.last_delivery_at, null);
    const details = normalizeDetails({
      ...currentDetails,
      delivery_records: recordList,
      delivery_status: deliveryStatus,
      delivery_status_label: deliveryStatusLabel,
      delivery_last_error: lastFailure?.error ?? "",
      delivery_last_error_at: lastFailure?.attemptedAt ?? null,
      delivery_next_attempt_at: nextAttemptAt,
      last_delivery_at: lastDeliveryAt,
      context: {
        ...currentContext,
        delivery_records: Object.fromEntries(records),
        delivery_status: deliveryStatus,
        delivery_status_label: deliveryStatusLabel,
        delivery_last_error: lastFailure?.error ?? "",
        delivery_last_error_at: lastFailure?.attemptedAt ?? null,
        delivery_next_attempt_at: nextAttemptAt,
        last_delivery_at: lastDeliveryAt,
      },
      terminal_delivery: {
        schema: outcome.schema,
        attempt_id: outcome.attemptId,
        target: outcome.target,
        status: outcome.status,
        attempted_at: outcome.attemptedAt,
      },
    });
    const updatedAt = Date.parse(outcome.attemptedAt) > Date.parse(existing.updated_at)
      ? outcome.attemptedAt
      : existing.updated_at;
    this.runTransaction(() => {
      this.database.prepare(`
        UPDATE application_tasks SET
          revision = revision + 1, details_json = ?, updated_at = ?
        WHERE task_id = ? AND deleted_at IS NULL
      `).run(serializeDetails(details), updatedAt, existing.task_id);
      this.appendEvent(
        existing.task_id,
        "terminal-delivery",
        existing.status,
        existing.status,
        Number(existing.progress),
        outcome.error || outcome.message || `Terminal delivery is ${outcome.status}.`,
        outcome.attemptedAt,
      );
    });
    return this.createSnapshot(workspace.id, false);
  }

  /** Normalize list or object delivery records into a target-keyed map. */
  private indexDeliveryRecords(value: unknown): Map<string, Record<string, unknown>> {
    const records = new Map<string, Record<string, unknown>>();
    const candidates = Array.isArray(value)
      ? value
      : isRecord(value) ? Object.values(value) : [];
    for (const candidate of candidates) {
      if (!isRecord(candidate)) continue;
      const target = boundedText(candidate.target, 64);
      if (target) records.set(target, { ...candidate });
    }
    return records;
  }

  /** Resolve one workspace-scoped legacy parent ID to its stable Core UUID. */
  private resolveLegacyParentId(workspaceId: string, parentTaskId: string | null): string | null {
    if (parentTaskId === null || TASK_ID_PATTERN.test(parentTaskId)) return parentTaskId;
    const parent = this.getRowByLegacyId(workspaceId, parentTaskId);
    return parent?.task_id ?? null;
  }

  /** Replace resolvable legacy parent IDs after a reconciliation batch. */
  private resolveParentTaskReferences(workspaceId: string): void {
    const rows = this.database.prepare(`
      SELECT task_id, parent_task_id
      FROM application_tasks
      WHERE workspace_id = ? AND parent_task_id IS NOT NULL AND deleted_at IS NULL
    `).all(workspaceId) as unknown as { task_id: string; parent_task_id: string }[];
    for (const row of rows) {
      const parentTaskId = this.resolveLegacyParentId(workspaceId, row.parent_task_id);
      if (parentTaskId !== null && parentTaskId !== row.parent_task_id) {
        this.database.prepare(`
          UPDATE application_tasks
          SET revision = revision + 1, parent_task_id = ?
          WHERE task_id = ?
        `).run(parentTaskId, row.task_id);
      }
    }
  }

  /** Apply one state transition and append its event atomically. */
  private applyTransition(request: ReturnType<typeof parseTransitionApplicationTaskRequest>): ApplicationTask {
    const row = this.getRowById(request.taskId);
    if (row === null || row.deleted_at !== null) {
      throw new Error(`Application task '${request.taskId}' was not found.`);
    }
    if (request.expectedRevision !== undefined && request.expectedRevision !== Number(row.revision)) {
      throw new ApplicationTaskConflictError(request.taskId);
    }
    if (!ALLOWED_TRANSITIONS[row.status].has(request.status)) {
      throw new Error(`Task transition '${row.status}' to '${request.status}' is not allowed.`);
    }
    const updatedAt = this.now().toISOString();
    const progress = request.status === "completed"
      ? 100
      : request.progress ?? Number(row.progress);
    const currentDetails = parseStoredDetails(row.details_json, row.task_id);
    const details = this.protectDeliveryDetails(
      row.workspace_path,
      row.legacy_task_id,
      normalizeDetails({ ...currentDetails, ...(request.detailsPatch ?? {}) }),
      true,
    );
    const startedAt = request.status === "running" ? row.started_at ?? updatedAt : row.started_at;
    const completedAt = ["completed", "failed", "cancelled"].includes(request.status)
      ? updatedAt
      : request.status === "pending" ? null : row.completed_at;
    this.runTransaction(() => {
      this.database.prepare(`
        UPDATE application_tasks SET
          revision = revision + 1, status = ?, progress = ?, result_summary = ?,
          error_message = ?, details_json = ?, updated_at = ?, started_at = ?, completed_at = ?
        WHERE task_id = ?
      `).run(
        request.status,
        progress,
        request.resultSummary ?? row.result_summary,
        request.errorMessage ?? row.error_message,
        serializeDetails(details),
        updatedAt,
        startedAt,
        completedAt,
        row.task_id,
      );
      this.appendEvent(
        row.task_id,
        "transition",
        row.status,
        request.status,
        progress,
        request.message ?? `Task transitioned from ${row.status} to ${request.status}.`,
        updatedAt,
      );
    });
    const updated = this.getRowById(row.task_id);
    if (updated === null) throw new Error("Updated task metadata is unavailable.");
    return this.rowToTask(updated);
  }

  /** Synchronize input and output artifact UUIDs found in compatibility details. */
  private syncArtifactReferencesFromDetails(
    taskId: string,
    details: Readonly<Record<string, unknown>>,
  ): void {
    const context = isRecord(details.context) ? details.context : {};
    const inputIds = this.extractArtifactIds(details.input_artifact_ids ?? context.input_artifact_ids);
    const outputIds = this.extractArtifactIds(details.output_artifact_ids ?? context.output_artifact_ids);
    if (inputIds !== null) this.replaceArtifactReferences(taskId, "input", inputIds);
    if (outputIds !== null) this.replaceArtifactReferences(taskId, "output", outputIds);
  }

  /** Parse optional artifact ID arrays from compatibility details. */
  private extractArtifactIds(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    return [...new Set(value
      .filter((item): item is string => typeof item === "string" && TASK_ID_PATTERN.test(item))
      .map((item) => item.toLowerCase()))].slice(0, 256);
  }

  /** Replace one artifact relationship after validating every referenced row. */
  private replaceArtifactReferences(
    taskId: string,
    relation: "input" | "output",
    artifactIds: readonly string[],
  ): void {
    for (const artifactId of artifactIds) {
      const artifact = this.database.prepare(
        "SELECT status FROM application_artifacts WHERE artifact_id = ?",
      ).get(artifactId) as unknown as { status: string } | undefined;
      if (artifact === undefined || (relation === "input" && artifact.status !== "available")) {
        throw new Error(`Task ${relation} artifact '${artifactId}' is unavailable.`);
      }
    }
    this.database.prepare(
      "DELETE FROM application_task_artifacts WHERE task_id = ? AND relation = ?",
    ).run(taskId, relation);
    const insert = this.database.prepare(`
      INSERT INTO application_task_artifacts (task_id, artifact_id, relation, label, ordinal)
      VALUES (?, ?, ?, '', ?)
    `);
    artifactIds.forEach((artifactId, ordinal) => insert.run(taskId, artifactId, relation, ordinal));
  }

  /** Append one monotonically sequenced task event. */
  private appendEvent(
    taskId: string,
    eventType: string,
    previousStatus: ApplicationTaskStatus | null,
    nextStatus: ApplicationTaskStatus | null,
    progress: number,
    message: string,
    createdAt: string,
  ): void {
    const row = this.database.prepare(
      "SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM application_task_events WHERE task_id = ?",
    ).get(taskId) as unknown as { sequence: number };
    this.database.prepare(`
      INSERT INTO application_task_events (
        event_id, task_id, sequence, event_type, previous_status, next_status,
        progress, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      taskId,
      Number(row.sequence),
      boundedText(eventType, 128, "event"),
      previousStatus,
      nextStatus,
      boundedProgress(progress),
      boundedText(message, 4_096),
      createdAt,
    );
  }

  /** Return one task row by stable Core UUID. */
  private getRowById(taskId: string): ApplicationTaskRow | null {
    const row = this.database.prepare(`
      SELECT task_id, revision, legacy_task_id, workspace_id, workspace_path, parent_task_id,
             title, description, status, progress, priority, agent_type, schedule_type,
             schedule_expression, next_run_at, result_summary, error_message, details_json,
             source, created_at, updated_at, started_at, completed_at, deleted_at
      FROM application_tasks WHERE task_id = ?
    `).get(taskId) as unknown as ApplicationTaskRow | undefined;
    return row ?? null;
  }

  /** Return one task row by its workspace-scoped Python compatibility ID. */
  private getRowByLegacyId(workspaceId: string, legacyTaskId: string): ApplicationTaskRow | null {
    const row = this.database.prepare(`
      SELECT task_id, revision, legacy_task_id, workspace_id, workspace_path, parent_task_id,
             title, description, status, progress, priority, agent_type, schedule_type,
             schedule_expression, next_run_at, result_summary, error_message, details_json,
             source, created_at, updated_at, started_at, completed_at, deleted_at
      FROM application_tasks WHERE workspace_id = ? AND legacy_task_id = ?
    `).get(workspaceId, legacyTaskId) as unknown as ApplicationTaskRow | undefined;
    return row ?? null;
  }

  /** Convert one database row into the public task contract. */
  private rowToTask(row: ApplicationTaskRow, includeFullDetails = true): ApplicationTask {
    const details = this.protectDeliveryDetails(
      row.workspace_path,
      row.legacy_task_id,
      parseStoredDetails(row.details_json, row.task_id),
      false,
    );
    return {
      id: row.task_id,
      revision: Number(row.revision),
      legacyTaskId: row.legacy_task_id,
      workspaceId: row.workspace_id,
      workspacePath: row.workspace_path,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: row.description,
      status: row.status,
      progress: Number(row.progress),
      priority: row.priority,
      agentType: row.agent_type,
      scheduleType: row.schedule_type,
      scheduleExpression: row.schedule_expression,
      nextRunAt: row.next_run_at,
      resultSummary: row.result_summary,
      errorMessage: row.error_message,
      details: includeFullDetails ? details : summarizeDetails(details),
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      deletedAt: row.deleted_at,
      artifacts: this.listArtifactReferences(row.task_id),
    };
  }

  /** Capture task-scoped delivery credentials before returning or persisting details. */
  private protectDeliveryDetails(
    workspacePath: string,
    taskId: string,
    value: Readonly<Record<string, unknown>>,
    requireSecureCapture: boolean,
  ): Record<string, unknown> {
    const details = normalizeDetails(value);
    if (this.deliveryCredentials === undefined) return details;
    return normalizeDetails(this.deliveryCredentials.reconcileTaskDetails(
      workspacePath,
      taskId,
      details,
      { requireSecureCapture },
    ).details);
  }

  /** Defensively migrate inline delivery credentials already present in Core SQLite. */
  private migrateStoredDeliveryCredentials(): void {
    if (this.deliveryCredentials === undefined) return;
    const rows = this.database.prepare(`
      SELECT task_id, legacy_task_id, workspace_path, details_json, deleted_at
      FROM application_tasks
      WHERE details_json LIKE '%delivery_records%'
    `).all() as unknown as Array<Pick<
      ApplicationTaskRow,
      "task_id" | "legacy_task_id" | "workspace_path" | "details_json" | "deleted_at"
    >>;
    for (const row of rows) {
      try {
        const current = parseStoredDetails(row.details_json, row.task_id);
        const result = this.deliveryCredentials.reconcileTaskDetails(
          row.workspace_path,
          row.legacy_task_id,
          current,
          { requireSecureCapture: true },
        );
        if (result.persistSanitized) {
          this.database.prepare(
            "UPDATE application_tasks SET details_json = ? WHERE task_id = ?",
          ).run(serializeDetails(result.details), row.task_id);
        }
        if (row.deleted_at !== null) {
          this.deliveryCredentials.clearTask(row.workspace_path, row.legacy_task_id);
        }
      } catch {
        // Preserve the only legacy copy when secure capture fails; public reads still redact it.
      }
    }
  }

  /** List ordered artifact relationships for one task. */
  private listArtifactReferences(taskId: string): ApplicationTaskArtifactReference[] {
    const rows = this.database.prepare(`
      SELECT artifact_id, relation, label, ordinal
      FROM application_task_artifacts
      WHERE task_id = ?
      ORDER BY relation ASC, ordinal ASC
    `).all(taskId) as unknown as ApplicationTaskArtifactRow[];
    return rows.map((row) => ({
      artifactId: row.artifact_id,
      relation: row.relation,
      label: row.label,
      ordinal: Number(row.ordinal),
    }));
  }

  /** List append-only Core events for one task in chronological order. */
  private listEvents(taskId: string): ApplicationTaskEvent[] {
    const rows = this.database.prepare(`
      SELECT event_id, sequence, event_type, previous_status, next_status,
             progress, message, created_at
      FROM (
        SELECT event_id, sequence, event_type, previous_status, next_status,
               progress, message, created_at
        FROM application_task_events
        WHERE task_id = ?
        ORDER BY sequence DESC
        LIMIT 1000
      )
      ORDER BY sequence ASC
    `).all(taskId) as unknown as ApplicationTaskEventRow[];
    return rows.map((row) => ({
      id: row.event_id,
      sequence: Number(row.sequence),
      type: row.event_type,
      previousStatus: row.previous_status,
      nextStatus: row.next_status,
      progress: Number(row.progress),
      message: row.message,
      createdAt: row.created_at,
    }));
  }

  /** Create a deterministic task catalog snapshot. */
  private createSnapshot(workspaceId: string | null, includeDeleted: boolean): ApplicationTaskSnapshot {
    const conditions: string[] = [];
    const parameters: string[] = [];
    if (workspaceId !== null) {
      conditions.push("workspace_id = ?");
      parameters.push(workspaceId);
    }
    if (!includeDeleted) conditions.push("deleted_at IS NULL");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.database.prepare(`
      SELECT task_id, revision, legacy_task_id, workspace_id, workspace_path, parent_task_id,
             title, description, status, progress, priority, agent_type, schedule_type,
             schedule_expression, next_run_at, result_summary, error_message, details_json,
             source, created_at, updated_at, started_at, completed_at, deleted_at
      FROM application_tasks
      ${where}
      ORDER BY updated_at DESC, task_id ASC
    `).all(...parameters) as unknown as ApplicationTaskRow[];
    const revisionRow = this.database.prepare(
      `SELECT COALESCE(SUM(revision), 0) AS revision FROM application_tasks ${where}`,
    ).get(...parameters) as unknown as CatalogRevisionRow;
    return {
      schema: APPLICATION_TASK_SCHEMA,
      catalogRevision: Number(revisionRow.revision),
      generatedAt: this.now().toISOString(),
      tasks: rows.map((row) => this.rowToTask(row, false)),
    };
  }

  /** Run one synchronous SQLite transaction with rollback on failure. */
  private runTransaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** Reject task operations after the database handle has closed. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application task service is closed.");
  }
}

/** Bootstrap durable tasks over the shared migration-managed Core database. */
export function bootstrapApplicationTasks(
  options: BootstrapApplicationTasksOptions,
): ApplicationTaskService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const databasePath = path.resolve(
    options.databasePath ?? path.join(userDataDirectory, APPLICATION_DATABASE_FILENAME),
  );
  const migrationStore = new ApplicationStore(
    options.now === undefined ? { databasePath } : { databasePath, now: options.now },
  );
  migrationStore.close();
  return new ApplicationTaskService(
    new DatabaseSync(databasePath),
    options.now ?? (() => new Date()),
    options.deliveryCredentials,
  );
}
