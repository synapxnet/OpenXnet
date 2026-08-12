import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { WorkerEnvelope } from "../contracts/worker-protocol";
import { bootstrapApplicationTasks } from "../storage/application-tasks";
import { ApplicationTaskExecutionService } from "./application-task-execution";

class TestTaskSupervisor {
  public readonly requests: { method: string; payload: Readonly<Record<string, unknown>> }[] = [];
  private listener: ((event: WorkerEnvelope) => void) | null = null;

  /** Record one Worker request and return a deterministic executor response. */
  public async request(
    _capability: "tasks",
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    this.requests.push({ method, payload });
    if (method === "tasks.list") {
      return { tasks: [], workspace_path: payload.workspacePath };
    }
    if (method === "tasks.create") {
      const task = payload.task as Readonly<Record<string, unknown>>;
      return {
        success: true,
        task: {
          ...task,
          status: "pending",
          progress: 0,
          created_at: "2099-07-23T10:00:00.000Z",
          updated_at: "2099-07-23T10:00:00.000Z",
        },
      };
    }
    if (method === "tasks.scheduler.start") {
      return { status: "running", pollIntervalSeconds: 15 };
    }
    if (method === "tasks.cancel") {
      throw new Error("Executor cancellation endpoint is offline.");
    }
    throw new Error(`Unexpected test Worker method '${method}'.`);
  }

  /** Subscribe one coordinator listener to synthetic Worker events. */
  public subscribeEvents(listener: (event: WorkerEnvelope) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  /** Emit one synthetic task Worker event. */
  public emit(payload: Readonly<Record<string, unknown>>, method = "tasks.snapshot"): void {
    this.listener?.({
      protocolVersion: "1.0",
      messageId: "event-1",
      traceId: "event-1",
      kind: "event",
      capability: "tasks",
      method,
      payload,
    });
  }
}

test("ApplicationTaskExecutionService repairs mirrors and keeps Core cancellation authoritative", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-execution-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  const supervisor = new TestTaskSupervisor();
  const ensured: string[] = [];
  const published: number[] = [];
  const execution = new ApplicationTaskExecutionService({
    core: {
      /** Record capability activation requests from the coordinator. */
      async ensureCapability(capabilityId) {
        ensured.push(capabilityId);
        return {} as never;
      },
    },
    supervisor,
    tasks,
    getBrokerOrigin: () => "http://127.0.0.1:3456",
    logger: { warn() {}, error() {} },
  });
  try {
    const created = await tasks.createTask({
      workspacePath,
      title: "Core-first execution",
      description: "Repair a missing executor mirror without Renderer HTTP.",
      agentType: "default",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "renderer",
      inputArtifactIds: [],
      details: { context: { created_from: "renderer" }, start_immediately: false },
    });
    const unsubscribe = execution.subscribe((snapshot) => published.push(snapshot.catalogRevision));
    const refreshed = await execution.refreshExecutions({ workspacePath });
    assert.equal(refreshed.executionWorkspacePath, path.resolve(workspacePath));
    assert.deepEqual(supervisor.requests.map((request) => request.method), ["tasks.list", "tasks.create"]);
    assert.ok(supervisor.requests.every((request) => request.payload.brokerOrigin === "http://127.0.0.1:3456"));
    assert.ok(supervisor.requests.every((request) => !("backendOrigin" in request.payload)));
    assert.ok(ensured.every((capability) => capability === "tasks"));
    assert.equal(refreshed.tasks[0]?.legacyTaskId, created.id);

    supervisor.emit({
      workspacePath,
      tasks: [{
        task_id: created.id,
        title: created.title,
        description: created.description,
        status: "running",
        progress: 35,
        updated_at: "2099-07-23T10:01:00.000Z",
      }],
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const running = await tasks.getTask({ taskId: created.id });
    assert.equal(running.task.status, "running");

    supervisor.emit({
      schema: "openxnet.task-execution-checkpoint.v1",
      workspacePath,
      legacyTaskId: created.id,
      parentTaskId: null,
      title: created.title,
      description: created.description,
      agentType: created.agentType,
      status: "running",
      progress: 55,
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: null,
      createdAt: created.createdAt,
      sourceUpdatedAt: "2099-07-23T10:02:00.000Z",
      startedAt: "2099-07-23T10:01:00.000Z",
      completedAt: null,
      resultSummary: "",
      errorMessage: "",
      message: "Executor iteration checkpoint.",
      detailsPatch: { current_iteration: 4 },
    }, "tasks.checkpoint");
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const checkpointed = await tasks.getTask({ taskId: created.id });
    assert.equal(checkpointed.task.progress, 55);
    assert.equal(checkpointed.task.details.current_iteration, 4);

    const cancelled = await execution.cancelExecution({ taskId: created.id });
    assert.equal(cancelled.status, "cancelled");
    supervisor.emit({
      schema: "openxnet.task-terminal-delivery-outcome.v1",
      workspacePath,
      legacyTaskId: created.legacyTaskId,
      attemptId: "dly_0123456789abcdef0123456789abcdef",
      target: "webhook",
      status: "retry_scheduled",
      attempt: 1,
      maxAttempts: 3,
      retryable: true,
      attemptedAt: "2099-07-23T10:03:00.000Z",
      deliveredAt: null,
      nextAttemptAt: "2099-07-23T10:03:15.000Z",
      method: "webhook",
      message: "Delivery will be eligible for a bounded retry.",
      error: "Delivery target is temporarily unavailable.",
    }, "tasks.delivery");
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const delivery = await tasks.getTask({ taskId: created.id });
    assert.equal(delivery.task.status, "cancelled");
    assert.equal(delivery.task.details.delivery_status, "retry_scheduled");
    assert.equal(delivery.events.at(-1)?.type, "terminal-delivery");
    assert.ok(published.length >= 2);
    unsubscribe();
  } finally {
    execution.close();
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskExecutionService creates developer-workbench tasks Core-first", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-workbench-execution-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  const supervisor = new TestTaskSupervisor();
  const execution = new ApplicationTaskExecutionService({
    core: {
      /** Accept task capability activation for the workbench test. */
      async ensureCapability() {
        return {} as never;
      },
    },
    supervisor,
    tasks,
    getBrokerOrigin: () => "http://127.0.0.1:3456",
    logger: { warn() {}, error() {} },
  });
  try {
    const created = await execution.createWorkbenchExecution({
      workspacePath,
      workflowKind: "review",
      title: "",
      goal: "Review the desktop task boundary",
      targetPaths: ["src/desktop/tasks"],
      acceptanceCriteria: [],
      constraints: [],
      additionalContext: "Prioritize authorization and state consistency.",
      agentType: "default",
      engineName: "oc",
      permissionMode: "plan",
    });
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.equal(created.source, "developer-workbench");
    assert.match(created.title, /^Review: Review the desktop task boundary/);
    assert.match(created.description, /【完成标准】/);
    assert.deepEqual(supervisor.requests.map((request) => request.method), ["tasks.create"]);
    const mirror = supervisor.requests[0]?.payload.task as Readonly<Record<string, unknown>>;
    assert.equal(mirror.task_id, created.id);
    assert.equal(mirror.start_immediately, true);
    const context = mirror.context as Readonly<Record<string, unknown>>;
    assert.equal(context.created_from, "developer_workbench");
    assert.equal(context.requires_write, false);
    const scheduler = await execution.startScheduler();
    assert.equal(scheduler.status, "running");
    assert.deepEqual(supervisor.requests.map((request) => request.method), [
      "tasks.create",
      "tasks.scheduler.start",
    ]);
  } finally {
    execution.close();
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
