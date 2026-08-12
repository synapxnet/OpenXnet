import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapApplicationArtifacts } from "./application-artifacts";
import { ApplicationDeliveryCredentialService } from "./application-delivery-credentials";
import {
  ApplicationTaskConflictError,
  bootstrapApplicationTasks,
} from "./application-tasks";
import type { ApplicationDeliveryCredentials } from "../contracts/application-delivery-credentials";
import type { ApplicationDeliveryCredentialStore } from "./safe-storage-delivery-credential-store";

/** In-memory protected store used to verify pre-persistence task redaction. */
class TaskDeliveryCredentialStore implements ApplicationDeliveryCredentialStore {
  public credentials: ApplicationDeliveryCredentials = {};

  /** Report the synthetic protected backend as available. */
  public isAvailable(): boolean { return true; }

  /** Return the current in-memory scoped credential map. */
  public read(): ApplicationDeliveryCredentials { return this.credentials; }

  /** Replace the current in-memory scoped credential map. */
  public write(credentials: ApplicationDeliveryCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory scoped delivery credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationTaskService persists transitions, events, and artifact references", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-state-"));
  const sourcePath = path.join(directory, "task-input.md");
  writeFileSync(sourcePath, "task input", "utf8");
  const artifacts = bootstrapApplicationArtifacts({ userDataDirectory: directory });
  const imported = await artifacts.importArtifacts({ paths: [sourcePath] });
  const artifactId = imported.artifacts[0]?.id;
  assert.ok(artifactId);
  artifacts.close();

  let clock = "2026-07-23T10:00:00.000Z";
  const tasks = bootstrapApplicationTasks({
    userDataDirectory: directory,
    now: () => new Date(clock),
  });
  try {
    const created = await tasks.createTask({
      workspacePath: path.join(directory, "workspace"),
      title: "Index architecture notes",
      description: "Build a durable index from the selected artifact.",
      agentType: "documents",
      priority: "high",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "test",
      inputArtifactIds: [artifactId],
      details: { acceptance_criteria: ["Index is queryable"] },
    });
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.equal(created.legacyTaskId, created.id);
    assert.equal(created.revision, 1);
    assert.deepEqual(created.artifacts.map((reference) => reference.artifactId), [artifactId]);

    clock = "2026-07-23T10:01:00.000Z";
    const running = await tasks.transitionTask({
      taskId: created.id,
      expectedRevision: 1,
      status: "running",
      progress: 25,
      message: "Execution mirror accepted the task.",
    });
    assert.equal(running.revision, 2);
    assert.equal(running.status, "running");
    assert.equal(running.startedAt, clock);

    await assert.rejects(
      tasks.transitionTask({
        taskId: created.id,
        expectedRevision: 1,
        status: "completed",
      }),
      ApplicationTaskConflictError,
    );

    clock = "2026-07-23T10:02:00.000Z";
    const completed = await tasks.transitionTask({
      taskId: created.id,
      expectedRevision: 2,
      status: "completed",
      resultSummary: "Index ready",
    });
    assert.equal(completed.progress, 100);
    assert.equal(completed.completedAt, clock);
    await assert.rejects(
      tasks.transitionTask({ taskId: created.id, status: "running" }),
      /is not allowed/,
    );

    const detail = await tasks.getTask({ taskId: created.id });
    assert.deepEqual(detail.events.map((event) => event.type), ["created", "transition", "transition"]);
    assert.deepEqual(detail.events.map((event) => event.sequence), [1, 2, 3]);

    const afterDelete = await tasks.deleteTask({
      taskId: created.id,
      expectedRevision: completed.revision,
    });
    assert.equal(afterDelete.tasks.length, 0);
    const completeCatalog = await tasks.listTasks({ includeDeleted: true });
    assert.equal(completeCatalog.tasks[0]?.deletedAt, clock);
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService reconciles legacy execution IDs and rejects stale snapshots", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-reconcile-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({
    userDataDirectory: directory,
    now: () => new Date("2026-07-23T11:00:00.000Z"),
  });
  try {
    const first = await tasks.reconcileTasks({
      workspacePath,
      tasks: [{
        task_id: "a1b2c3d4",
        title: "Legacy task",
        description: "Imported from .agent/tasks",
        status: "pending",
        progress: 0,
        created_at: "2026-07-23T10:30:00.000Z",
        updated_at: "2026-07-23T11:00:00.000Z",
        context: { created_from: "legacy-test" },
      }],
    });
    const imported = first.tasks[0];
    assert.ok(imported);
    assert.match(imported.id, /^[0-9a-f-]{36}$/);
    assert.equal(imported.legacyTaskId, "a1b2c3d4");

    const running = await tasks.reconcileTasks({
      workspacePath,
      tasks: [{
        task_id: "a1b2c3d4",
        title: "Legacy task",
        description: "Imported from .agent/tasks",
        status: "running",
        progress: 60,
        created_at: "2026-07-23T10:30:00.000Z",
        updated_at: "2026-07-23T12:00:00.000Z",
        started_at: "2026-07-23T11:30:00.000Z",
        last_event: "Worker progress synchronized.",
      }],
    });
    assert.equal(running.tasks[0]?.id, imported.id);
    assert.equal(running.tasks[0]?.status, "running");
    assert.equal(running.tasks[0]?.progress, 60);

    const afterStale = await tasks.reconcileTasks({
      workspacePath,
      tasks: [{
        task_id: "a1b2c3d4",
        title: "Legacy task",
        description: "stale",
        status: "completed",
        progress: 100,
        updated_at: "2026-07-23T11:30:00.000Z",
      }],
    });
    assert.equal(afterStale.tasks[0]?.status, "running");
    assert.equal(afterStale.tasks[0]?.description, "Imported from .agent/tasks");

    const detail = await tasks.getTask({ taskId: imported.id });
    assert.deepEqual(detail.events.map((event) => event.type), ["migrated", "execution-sync"]);
  } finally {
    tasks.close();
  }

  const reopened = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const snapshot = await reopened.listTasks({ workspacePath });
    assert.equal(snapshot.tasks[0]?.legacyTaskId, "a1b2c3d4");
    assert.equal(snapshot.tasks[0]?.status, "running");
  } finally {
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService canonicalizes workspace directory aliases", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-workspace-alias-"));
  const workspacePath = path.join(directory, "workspace");
  const workspaceAlias = path.join(directory, "workspace-alias");
  mkdirSync(workspacePath);
  symlinkSync(workspacePath, workspaceAlias, process.platform === "win32" ? "junction" : "dir");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const created = await tasks.createTask({
      workspacePath: workspaceAlias,
      title: "Canonical workspace task",
      description: "Keep one task identity across workspace path aliases.",
      agentType: "default",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "test",
      inputArtifactIds: [],
      details: {},
    });
    const reconciled = await tasks.reconcileTasks({
      workspacePath,
      tasks: [{
        task_id: created.legacyTaskId,
        title: created.title,
        description: created.description,
        status: "running",
        progress: 25,
        updated_at: "2099-07-23T12:00:00.000Z",
      }],
    });
    assert.equal(reconciled.tasks.length, 1);
    assert.equal(reconciled.tasks[0]?.id, created.id);
    assert.equal(reconciled.tasks[0]?.status, "running");
    assert.equal(created.workspacePath, realpathSync.native(workspacePath));
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService resolves legacy parent IDs to stable Core UUIDs", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-parent-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const snapshot = await tasks.reconcileTasks({
      workspacePath,
      tasks: [
        {
          task_id: "legacy-child",
          parent_task_id: "legacy-parent",
          title: "Child task",
          status: "pending",
          updated_at: "2026-07-23T12:00:00.000Z",
        },
        {
          task_id: "legacy-parent",
          title: "Parent task",
          status: "running",
          updated_at: "2026-07-23T12:00:00.000Z",
        },
      ],
    });
    const parent = snapshot.tasks.find((task) => task.legacyTaskId === "legacy-parent");
    const child = snapshot.tasks.find((task) => task.legacyTaskId === "legacy-child");
    assert.ok(parent);
    assert.ok(child);
    assert.equal(child.parentTaskId, parent.id);
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService keeps full details out of task list snapshots", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-summary-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const created = await tasks.createTask({
      workspacePath,
      title: "Bounded detail task",
      description: "Keep task catalogs small while preserving the detail record.",
      agentType: "default",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "test",
      inputArtifactIds: [],
      details: {
        summary: "Visible in task lists",
        private_payload: "detail-only-value",
      },
    });
    const list = await tasks.listTasks({ workspacePath });
    assert.equal(list.tasks[0]?.details.summary, "Visible in task lists");
    assert.equal(list.tasks[0]?.details.private_payload, undefined);

    const detail = await tasks.getTask({ taskId: created.id });
    assert.equal(detail.task.details.private_payload, "detail-only-value");
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService rejects oversized reconciliation payloads", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-budget-"));
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    await assert.rejects(
      async () => tasks.reconcileTasks({
        workspacePath: path.join(directory, "workspace"),
        tasks: [{
          task_id: "oversized-task",
          title: "Oversized task",
          details: "x".repeat((8 * 1024 * 1024) + 1),
        }],
      }),
      /payload budget/,
    );
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService rejects a newer running snapshot after Core cancellation", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-cancel-"));
  const workspacePath = path.join(directory, "workspace");
  let clock = "2026-07-23T13:00:00.000Z";
  const tasks = bootstrapApplicationTasks({
    userDataDirectory: directory,
    now: () => new Date(clock),
  });
  try {
    const created = await tasks.createTask({
      workspacePath,
      title: "Cancellation authority",
      description: "Core cancellation must win over older worker progress.",
      agentType: "default",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "test",
      inputArtifactIds: [],
      details: {},
    });
    clock = "2026-07-23T13:01:00.000Z";
    const running = await tasks.transitionTask({
      taskId: created.id,
      expectedRevision: created.revision,
      status: "running",
      progress: 40,
    });
    clock = "2026-07-23T13:02:00.000Z";
    const cancelled = await tasks.transitionTask({
      taskId: created.id,
      expectedRevision: running.revision,
      status: "cancelled",
      progress: 40,
    });

    const afterLateSnapshot = await tasks.reconcileTasks({
      workspacePath,
      tasks: [{
        task_id: created.legacyTaskId,
        title: created.title,
        description: created.description,
        status: "running",
        progress: 80,
        updated_at: "2026-07-23T13:03:00.000Z",
      }],
    });
    assert.equal(afterLateSnapshot.tasks[0]?.status, "cancelled");
    assert.equal(afterLateSnapshot.tasks[0]?.progress, 40);
    assert.equal(afterLateSnapshot.tasks[0]?.revision, cancelled.revision);
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService merges native checkpoints and rejects stale or cancelled regressions", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-checkpoint-"));
  const workspacePath = path.join(directory, "workspace");
  let clock = "2026-07-23T10:00:00.000Z";
  const tasks = bootstrapApplicationTasks({
    userDataDirectory: directory,
    now: () => new Date(clock),
  });
  try {
    const created = await tasks.createTask({
      workspacePath,
      title: "Native progress",
      description: "Merge executor checkpoints without replacing Core metadata.",
      agentType: "default",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "renderer",
      inputArtifactIds: [],
      details: { core_metadata: "preserved" },
    });
    const checkpoint = {
      schema: "openxnet.task-execution-checkpoint.v1",
      workspacePath,
      legacyTaskId: created.legacyTaskId,
      parentTaskId: null,
      title: created.title,
      description: created.description,
      agentType: created.agentType,
      status: "running",
      progress: 42,
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: null,
      createdAt: created.createdAt,
      sourceUpdatedAt: "2026-07-23T10:01:00.000Z",
      startedAt: "2026-07-23T10:00:30.000Z",
      completedAt: null,
      resultSummary: "",
      errorMessage: "",
      message: "Iteration 3 completed.",
      detailsPatch: { current_iteration: 3, context: { last_heartbeat_at: "2026-07-23T10:01:00.000Z" } },
    };
    const applied = await tasks.applyExecutionCheckpoint(checkpoint);
    assert.equal(applied.tasks[0]?.status, "running");
    assert.equal(applied.tasks[0]?.progress, 42);
    const detail = await tasks.getTask({ taskId: created.id });
    assert.equal(detail.task.details.core_metadata, "preserved");
    assert.equal(detail.task.details.current_iteration, 3);
    assert.equal(detail.events.at(-1)?.type, "executor-checkpoint");

    const stale = await tasks.applyExecutionCheckpoint({
      ...checkpoint,
      progress: 10,
      sourceUpdatedAt: "2026-07-23T10:00:59.000Z",
    });
    assert.equal(stale.tasks[0]?.progress, 42);

    clock = "2026-07-23T10:02:00.000Z";
    const cancelled = await tasks.transitionTask({
      taskId: created.id,
      expectedRevision: detail.task.revision,
      status: "cancelled",
      progress: 42,
      message: "Core cancellation remains authoritative.",
    });
    assert.equal(cancelled.status, "cancelled");
    const regressed = await tasks.applyExecutionCheckpoint({
      ...checkpoint,
      progress: 80,
      sourceUpdatedAt: "2026-07-23T10:03:00.000Z",
    });
    assert.equal(regressed.tasks[0]?.status, "cancelled");
    assert.equal(regressed.tasks[0]?.progress, 42);
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService imports a missing legacy task from a self-contained checkpoint", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-checkpoint-import-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const legacyTaskId = "32345678-1234-4123-8123-123456789abc";
    const snapshot = await tasks.applyExecutionCheckpoint({
      schema: "openxnet.task-execution-checkpoint.v1",
      workspacePath,
      legacyTaskId,
      parentTaskId: null,
      title: "Recovered execution",
      description: "Import an executor checkpoint before a fallback snapshot.",
      agentType: "default",
      status: "failed",
      progress: 35,
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: null,
      createdAt: "2026-07-23T09:00:00.000Z",
      sourceUpdatedAt: "2026-07-23T09:01:00.000Z",
      startedAt: "2026-07-23T09:00:10.000Z",
      completedAt: "2026-07-23T09:01:00.000Z",
      resultSummary: "",
      errorMessage: "Desktop restarted during execution.",
      message: "Recovered from an interrupted runtime session.",
      detailsPatch: { interrupted_recovery_required: true },
    });
    assert.equal(snapshot.tasks[0]?.id, legacyTaskId);
    assert.equal(snapshot.tasks[0]?.legacyTaskId, legacyTaskId);
    assert.equal(snapshot.tasks[0]?.status, "failed");
    assert.equal(snapshot.tasks[0]?.source, "legacy-python");
    const detail = await tasks.getTask({ taskId: legacyTaskId });
    assert.equal(detail.events[0]?.type, "migrated");
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService applies terminal delivery outcomes idempotently", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-delivery-"));
  const workspacePath = path.join(directory, "workspace");
  let clock = "2026-07-24T10:00:00.000Z";
  const tasks = bootstrapApplicationTasks({
    userDataDirectory: directory,
    now: () => new Date(clock),
  });
  try {
    const created = await tasks.createTask({
      workspacePath,
      title: "Terminal delivery",
      description: "Persist delivery facts without changing execution status.",
      agentType: "default",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "renderer",
      inputArtifactIds: [],
      details: { delivery_targets: ["task_center", "webhook", "discord"] },
    });
    clock = "2026-07-24T10:01:00.000Z";
    const completed = await tasks.transitionTask({
      taskId: created.id,
      expectedRevision: created.revision,
      status: "completed",
      progress: 100,
      resultSummary: "done",
      message: "Execution completed before terminal delivery.",
    });
    const outcome = {
      schema: "openxnet.task-terminal-delivery-outcome.v1",
      workspacePath,
      legacyTaskId: created.legacyTaskId,
      attemptId: "dly_0123456789abcdef0123456789abcdef",
      target: "webhook",
      status: "retry_scheduled",
      attempt: 1,
      maxAttempts: 3,
      retryable: true,
      attemptedAt: "2026-07-24T10:02:00.000Z",
      deliveredAt: null,
      nextAttemptAt: "2026-07-24T10:02:15.000Z",
      method: "webhook",
      message: "Delivery will be eligible for a bounded retry.",
      error: "Delivery target is temporarily unavailable.",
    };
    const applied = await tasks.applyTerminalDelivery(outcome);
    assert.equal(applied.tasks[0]?.status, "completed");
    const detail = await tasks.getTask({ taskId: created.id });
    assert.equal(detail.task.details.delivery_status, "retry_scheduled");
    assert.equal(detail.task.details.delivery_next_attempt_at, "2026-07-24T10:02:15.000Z");
    assert.equal(detail.events.at(-1)?.type, "terminal-delivery");
    await tasks.applyTerminalDelivery({
      ...outcome,
      attemptId: "dly_abcdef0123456789abcdef0123456789",
      target: "discord",
      status: "delivered",
      retryable: false,
      attemptedAt: "2026-07-24T10:02:01.000Z",
      deliveredAt: "2026-07-24T10:02:01.000Z",
      nextAttemptAt: null,
      method: "discord_client",
      message: "Delivery completed via discord_client.",
      error: "",
    });
    const multiTarget = await tasks.getTask({ taskId: created.id });
    assert.equal(multiTarget.task.details.delivery_status, "retry_scheduled");
    assert.equal(
      multiTarget.task.details.delivery_last_error,
      "Delivery target is temporarily unavailable.",
    );
    const appliedRevision = multiTarget.task.revision;
    await tasks.applyTerminalDelivery(outcome);
    const duplicate = await tasks.getTask({ taskId: created.id });
    assert.equal(duplicate.task.revision, appliedRevision);
    assert.equal(duplicate.task.status, completed.status);
    await assert.rejects(
      async () => tasks.applyTerminalDelivery({
        ...outcome,
        status: "delivered",
        error: "still failed",
      }),
      /inconsistent/,
    );
  } finally {
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationTaskService removes inline delivery credentials before SQLite persistence", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-delivery-credentials-"));
  const credentialStore = new TaskDeliveryCredentialStore();
  const deliveryCredentials = new ApplicationDeliveryCredentialService({
    credentials: credentialStore,
  });
  const tasks = bootstrapApplicationTasks({
    userDataDirectory: directory,
    deliveryCredentials,
  });
  try {
    const created = await tasks.createTask({
      workspacePath: path.join(directory, "workspace"),
      title: "Deliver securely",
      description: "Keep task-scoped webhook credentials outside Desktop Core SQLite.",
      agentType: "general",
      priority: "normal",
      scheduleType: "manual",
      scheduleExpression: "",
      nextRunAt: "",
      source: "test",
      inputArtifactIds: [],
      details: {
        context: {
          delivery_records: {
            webhook: {
              config: {
                url: "https://hooks.example.test/core-boundary",
                headers: { Authorization: "Bearer sqlite-secret" },
              },
            },
          },
        },
      },
    });
    const serializedTask = JSON.stringify(created);
    assert.equal(serializedTask.includes("sqlite-secret"), false);
    assert.equal(serializedTask.includes("hooks.example.test"), false);
    assert.equal(Object.keys(credentialStore.credentials).length, 1);

    tasks.close();
    const databaseBytes = readFileSync(path.join(directory, "desktop-core.db"));
    assert.equal(databaseBytes.includes(Buffer.from("sqlite-secret", "utf8")), false);
    assert.equal(databaseBytes.includes(Buffer.from("hooks.example.test", "utf8")), false);
  } finally {
    tasks.close();
    deliveryCredentials.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
