import {
  APPLICATION_TASK_EXECUTION_SCHEMA,
  type ApplicationTaskExecutionDetail,
  type ApplicationTaskExecutionListener,
  type ApplicationTaskExecutionSnapshot,
  parseCreateDeveloperWorkbenchTaskExecutionRequest,
  parseApplicationTaskExecutionRequest,
  parseRefreshApplicationTaskExecutionsRequest,
  parseResumeApplicationTaskExecutionRequest,
  parseStartApplicationTaskExecutionRequest,
} from "../contracts/application-task-execution";
import type {
  ApplicationTask,
  ApplicationTaskSnapshot,
} from "../contracts/application-tasks";
import type { WorkerEnvelope } from "../contracts/worker-protocol";
import type { DesktopCore } from "../core/desktop-core";
import type { ApplicationTaskService } from "../storage/application-tasks";
import type { WorkerSupervisor } from "../workers/worker-supervisor";
import { buildDeveloperWorkbenchTask } from "./developer-workbench-task";

/** Dependencies required by the Core-owned task execution coordinator. */
export interface ApplicationTaskExecutionServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request" | "subscribeEvents">;
  readonly tasks: Pick<
    ApplicationTaskService,
    | "listTasks"
    | "getTask"
    | "createTask"
    | "reconcileTasks"
    | "applyExecutionCheckpoint"
    | "applyTerminalDelivery"
    | "transitionTask"
    | "deleteTask"
  >;
  readonly getBrokerOrigin: () => string;
  readonly logger?: Pick<Console, "warn" | "error">;
}

/** Coordinate Core task facts with the supervised Python execution adapter. */
export class ApplicationTaskExecutionService {
  private readonly listeners = new Set<ApplicationTaskExecutionListener>();
  private readonly unsubscribeWorkerEvents: () => void;
  private operationQueue: Promise<void> = Promise.resolve();
  private closed = false;

  /** Create the coordinator and subscribe to uncorrelated worker snapshots. */
  public constructor(private readonly options: ApplicationTaskExecutionServiceOptions) {
    this.unsubscribeWorkerEvents = options.supervisor.subscribeEvents(
      this.handleWorkerEvent.bind(this),
    );
  }

  /** Refresh executor mirrors, repair missing dispatches, and return Core state. */
  public refreshExecutions(request: unknown): Promise<ApplicationTaskExecutionSnapshot> {
    const parsed = parseRefreshApplicationTaskExecutionsRequest(request);
    return this.enqueueOperation(async () => this.refreshWorkspace(parsed.workspacePath ?? ""));
  }

  /** Return one Core detail enriched from the current executor mirror. */
  public getExecution(request: unknown): Promise<ApplicationTaskExecutionDetail> {
    const parsed = parseApplicationTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const coreDetail = await this.options.tasks.getTask(parsed);
      const response = await this.requestWorker("tasks.get", {
        workspacePath: coreDetail.task.workspacePath,
        taskId: coreDetail.task.legacyTaskId,
      });
      const executionTask = this.requireRecord(response.task, "task");
      const childExecutions = Array.isArray(response.child_tasks)
        ? response.child_tasks.filter(this.isRecord)
        : [];
      const snapshot = await this.options.tasks.reconcileTasks({
        workspacePath: coreDetail.task.workspacePath,
        tasks: [executionTask, ...childExecutions],
      });
      const refreshed = await this.options.tasks.getTask(parsed);
      const childTasks = childExecutions.map((child) => {
        const legacyId = String(child.task_id ?? child.legacy_task_id ?? "");
        return snapshot.tasks.find((task) => task.legacyTaskId === legacyId);
      }).filter((task): task is ApplicationTask => task !== undefined);
      this.publish(snapshot);
      return {
        schema: APPLICATION_TASK_EXECUTION_SCHEMA,
        task: refreshed.task,
        events: refreshed.events,
        childTasks,
        consensusContent: this.boundedText(response.consensus_content, 1024 * 1024),
      };
    });
  }

  /** Persist and dispatch one standardized developer-workbench task through Core. */
  public createWorkbenchExecution(request: unknown): Promise<ApplicationTask> {
    const parsed = parseCreateDeveloperWorkbenchTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const created = await this.options.tasks.createTask(buildDeveloperWorkbenchTask(parsed));
      const dispatched = await this.dispatchTask(created, false);
      this.publish(await this.options.tasks.listTasks({ workspacePath: created.workspacePath }));
      return dispatched;
    });
  }

  /** Start the Worker-owned schedule clock after the legacy executor is healthy. */
  public startScheduler(): Promise<Readonly<Record<string, unknown>>> {
    return this.enqueueOperation(async () => this.requestWorker("tasks.scheduler.start", {}));
  }

  /** Create or recover one idempotent Python execution mirror for a Core task. */
  public dispatchExecution(request: unknown): Promise<ApplicationTask> {
    const parsed = parseApplicationTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const detail = await this.options.tasks.getTask(parsed);
      return this.dispatchTask(detail.task, true);
    });
  }

  /** Start one pending execution mirror and reconcile its returned state. */
  public startExecution(request: unknown): Promise<ApplicationTask> {
    const parsed = parseStartApplicationTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const detail = await this.options.tasks.getTask({ taskId: parsed.taskId });
      const response = await this.requestWorker("tasks.start", {
        workspacePath: detail.task.workspacePath,
        taskId: detail.task.legacyTaskId,
        triggerSource: parsed.triggerSource ?? "desktop_core",
      });
      return this.reconcileCommandTask(detail.task.workspacePath, response);
    });
  }

  /** Resume one failed or cancelled execution mirror and reconcile its state. */
  public resumeExecution(request: unknown): Promise<ApplicationTask> {
    const parsed = parseResumeApplicationTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const detail = await this.options.tasks.getTask({ taskId: parsed.taskId });
      const response = await this.requestWorker("tasks.resume", {
        workspacePath: detail.task.workspacePath,
        taskId: detail.task.legacyTaskId,
        resumeNote: parsed.resumeNote ?? "",
        recoveryAction: parsed.recoveryAction ?? "",
      });
      return this.reconcileCommandTask(detail.task.workspacePath, response);
    });
  }

  /** Commit Core cancellation first and mirror it to the executor on a best-effort basis. */
  public cancelExecution(request: unknown): Promise<ApplicationTask> {
    const parsed = parseApplicationTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const detail = await this.options.tasks.getTask(parsed);
      const cancelled = detail.task.status === "cancelled"
        ? detail.task
        : await this.options.tasks.transitionTask({
            taskId: detail.task.id,
            expectedRevision: detail.task.revision,
            status: "cancelled",
            progress: detail.task.progress,
            message: "Task cancellation committed by Desktop Core.",
          });
      try {
        await this.requestWorker("tasks.cancel", {
          workspacePath: cancelled.workspacePath,
          taskId: cancelled.legacyTaskId,
        });
      } catch (error) {
        this.options.logger?.warn("Task execution cancellation mirror is unavailable.", error);
      }
      this.publish(await this.options.tasks.listTasks({ workspacePath: cancelled.workspacePath }));
      return cancelled;
    });
  }

  /** Tombstone the Core task first and remove its executor mirror on a best-effort basis. */
  public deleteExecution(request: unknown): Promise<ApplicationTaskSnapshot> {
    const parsed = parseApplicationTaskExecutionRequest(request);
    return this.enqueueOperation(async () => {
      const detail = await this.options.tasks.getTask(parsed);
      let current = detail.task;
      if (current.status === "running") {
        current = await this.options.tasks.transitionTask({
          taskId: current.id,
          expectedRevision: current.revision,
          status: "cancelled",
          progress: current.progress,
          message: "Task cancelled before Core deletion.",
        });
      }
      const snapshot = await this.options.tasks.deleteTask({
        taskId: current.id,
        expectedRevision: current.revision,
      });
      try {
        if (detail.task.status === "running") {
          await this.requestWorker("tasks.cancel", {
            workspacePath: current.workspacePath,
            taskId: current.legacyTaskId,
          });
        }
        await this.requestWorker("tasks.delete", {
          workspacePath: current.workspacePath,
          taskId: current.legacyTaskId,
        });
      } catch (error) {
        this.options.logger?.warn("Task execution deletion mirror is unavailable.", error);
      }
      this.publish(snapshot);
      return snapshot;
    });
  }

  /** Subscribe to authoritative Core task snapshots. */
  public subscribe(listener: ApplicationTaskExecutionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Release Worker event subscriptions during application shutdown. */
  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribeWorkerEvents();
    this.listeners.clear();
  }

  /** Refresh one workspace and retry missing Core-created mirrors idempotently. */
  private async refreshWorkspace(workspacePath: string): Promise<ApplicationTaskExecutionSnapshot> {
    const response = await this.requestWorker("tasks.list", { workspacePath });
    const executionWorkspacePath = this.boundedText(response.workspace_path, 32_768) || workspacePath;
    const before = await this.options.tasks.listTasks(
      executionWorkspacePath ? { workspacePath: executionWorkspacePath } : {},
    );
    if (!executionWorkspacePath) {
      return { ...before, executionWorkspacePath: "" };
    }
    const executions = this.readExecutionTasks(response);
    let snapshot = await this.options.tasks.reconcileTasks({
      workspacePath: executionWorkspacePath,
      tasks: executions,
    });
    const executionIds = new Set(executions.map((task) => String(task.task_id ?? "")));
    const missing = before.tasks.filter((task) => (
      task.status === "pending"
      && !executionIds.has(task.legacyTaskId)
      && ["renderer", "uiplan", "developer-workbench"].includes(task.source)
    ));
    for (const task of missing.slice(0, 10)) {
      try {
        await this.dispatchTask(task, false);
      } catch (error) {
        this.options.logger?.warn("Task execution mirror remains pending.", error);
      }
    }
    snapshot = await this.options.tasks.listTasks({ workspacePath: executionWorkspacePath });
    this.publish(snapshot);
    return { ...snapshot, executionWorkspacePath };
  }

  /** Dispatch one Core task and optionally propagate a compatibility failure. */
  private async dispatchTask(task: ApplicationTask, propagateFailure: boolean): Promise<ApplicationTask> {
    try {
      const response = await this.requestWorker("tasks.create", {
        workspacePath: task.workspacePath,
        task: this.buildExecutionMirrorPayload(task),
      });
      return await this.reconcileCommandTask(task.workspacePath, response);
    } catch (error) {
      if (task.status === "pending") {
        try {
          await this.options.tasks.transitionTask({
            taskId: task.id,
            expectedRevision: task.revision,
            status: "pending",
            progress: task.progress,
            message: "Task persisted; execution mirror is pending.",
            errorMessage: error instanceof Error ? error.message : String(error),
            detailsPatch: {
              compatibility_dispatch_pending: true,
              compatibility_dispatch_error: error instanceof Error ? error.message : String(error),
            },
          });
        } catch (transitionError) {
          this.options.logger?.warn("Unable to record pending task execution dispatch.", transitionError);
        }
      }
      if (propagateFailure) throw error;
      return (await this.options.tasks.getTask({ taskId: task.id })).task;
    }
  }

  /** Convert one Core task into the legacy executor creation request. */
  private buildExecutionMirrorPayload(task: ApplicationTask): Readonly<Record<string, unknown>> {
    const details = task.details;
    const context = this.isRecord(details.context) ? details.context : {};
    const inputArtifactIds = task.artifacts
      .filter((reference) => reference.relation === "input")
      .map((reference) => reference.artifactId);
    return {
      task_id: task.legacyTaskId,
      title: task.title,
      description: task.description,
      agent_type: task.agentType,
      context: {
        ...context,
        core_task_id: task.id,
        input_artifact_ids: inputArtifactIds,
      },
      schedule_type: task.scheduleType,
      schedule_expression: task.scheduleExpression,
      next_run_at: task.nextRunAt ?? "",
      delivery_targets: Array.isArray(details.delivery_targets)
        ? details.delivery_targets
        : ["task_center"],
      start_immediately: details.start_immediately === true,
    };
  }

  /** Reconcile one worker command response and return the full Core task. */
  private async reconcileCommandTask(
    workspacePath: string,
    response: Readonly<Record<string, unknown>>,
  ): Promise<ApplicationTask> {
    const task = this.requireRecord(response.task, "task");
    const snapshot = await this.options.tasks.reconcileTasks({ workspacePath, tasks: [task] });
    const legacyId = String(task.task_id ?? task.legacy_task_id ?? "");
    const coreTask = snapshot.tasks.find((candidate) => candidate.legacyTaskId === legacyId);
    if (coreTask === undefined) {
      throw new Error("Task execution response could not be reconciled.");
    }
    const detail = await this.options.tasks.getTask({ taskId: coreTask.id });
    this.publish(snapshot);
    return detail.task;
  }

  /** Ensure the task capability and issue one correlated Worker request. */
  private async requestWorker(
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.options.core.ensureCapability("tasks");
    return this.options.supervisor.request("tasks", method, {
      ...payload,
      brokerOrigin: this.options.getBrokerOrigin(),
    });
  }

  /** Queue an uncorrelated worker snapshot for serialized Core reconciliation. */
  private handleWorkerEvent(event: WorkerEnvelope): void {
    if (event.capability !== "tasks" || event.kind !== "event") {
      return;
    }
    void this.enqueueOperation(async () => {
      if (event.method === "tasks.checkpoint") {
        this.publish(await this.options.tasks.applyExecutionCheckpoint(event.payload));
        return;
      }
      if (event.method === "tasks.delivery") {
        this.publish(await this.options.tasks.applyTerminalDelivery(event.payload));
        return;
      }
      if (event.method === "tasks.snapshot") {
        const workspacePath = this.boundedText(event.payload.workspacePath, 32_768);
        if (!workspacePath) return;
        const tasks = Array.isArray(event.payload.tasks)
          ? event.payload.tasks.filter(this.isRecord)
          : [];
        this.publish(await this.options.tasks.reconcileTasks({ workspacePath, tasks }));
      }
    }).catch((error) => {
      this.options.logger?.error("Task execution event reconciliation failed.", error);
    });
  }

  /** Publish one task snapshot without allowing a listener to stop delivery. */
  private publish(snapshot: ApplicationTaskSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Renderer delivery failures do not roll back committed Core task state.
      }
    }
  }

  /** Serialize coordinator mutations and event reconciliation. */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Task execution service is closed."));
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  /** Read bounded execution objects from one Worker response. */
  private readExecutionTasks(response: Readonly<Record<string, unknown>>): Record<string, unknown>[] {
    if (!Array.isArray(response.tasks)) return [];
    return response.tasks.filter(this.isRecord);
  }

  /** Require one object field from a Worker response. */
  private requireRecord(value: unknown, field: string): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new Error(`Task execution response field '${field}' is invalid.`);
    }
    return value;
  }

  /** Determine whether an unknown value is a string-keyed object. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /** Return bounded text from one untrusted Worker field. */
  private boundedText(value: unknown, maximumLength: number): string {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized.length <= maximumLength ? normalized : normalized.slice(0, maximumLength);
  }
}
