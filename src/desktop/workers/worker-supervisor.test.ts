import assert from "node:assert/strict";
import test from "node:test";

import { DesktopCore } from "../core/desktop-core";
import type { WorkerEnvelope } from "../contracts/worker-protocol";
import { registerWorkerCapability } from "../core/register-worker-capability";
import { WorkerSupervisor } from "./worker-supervisor";

test("WorkerSupervisor exchanges protocol messages with a Python worker", async () => {
  const supervisor = new WorkerSupervisor();
  supervisor.register({
    capability: "documents",
    command: process.env.PYTHON_EXECUTABLE ?? "python",
    arguments: ["-m", "py.workers.demo_worker", "--capability", "documents"],
    workingDirectory: process.cwd(),
    requestTimeoutMs: 5_000,
    shutdownTimeoutMs: 2_000,
  });

  try {
    const started = await supervisor.start("documents");
    const response = await supervisor.request("documents", "echo", { text: "你好，OpenXnet" });

    assert.equal(started.state, "ready");
    assert.deepEqual(response, { echo: { text: "你好，OpenXnet" } });
  } finally {
    await supervisor.stopAll();
  }

  assert.equal(supervisor.getSnapshot("documents").state, "stopped");
});

test("Worker capability adapter synchronizes Core lifecycle state", async () => {
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  await core.start();
  const unsubscribe = registerWorkerCapability({
    core,
    supervisor,
    definition: {
      capability: "documents",
      command: process.env.PYTHON_EXECUTABLE ?? "python",
      arguments: ["-m", "py.workers.demo_worker", "--capability", "documents"],
      workingDirectory: process.cwd(),
      requestTimeoutMs: 5_000,
      shutdownTimeoutMs: 2_000,
    },
  });

  try {
    const ready = await core.ensureCapability("documents");
    assert.equal(ready.state, "ready");
    assert.equal(typeof ready.metadata?.processId, "number");

    await supervisor.stop("documents");
    assert.equal(core.getCapability("documents").state, "stopped");
  } finally {
    unsubscribe();
    await supervisor.stopAll();
  }
});

test("WorkerSupervisor stops an idle optional worker", async () => {
  const supervisor = new WorkerSupervisor();
  supervisor.register({
    capability: "voice",
    command: process.env.PYTHON_EXECUTABLE ?? "python",
    arguments: ["-m", "py.workers.demo_worker", "--capability", "voice"],
    workingDirectory: process.cwd(),
    requestTimeoutMs: 5_000,
    shutdownTimeoutMs: 2_000,
    idleTimeoutMs: 50,
  });

  try {
    await supervisor.start("voice");
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Idle worker did not stop.")), 2_000);
      const unsubscribe = supervisor.subscribe((snapshot) => {
        if (snapshot.capability === "voice" && snapshot.state === "stopped") {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
    assert.equal(supervisor.getSnapshot("voice").state, "stopped");
  } finally {
    await supervisor.stopAll();
  }
});

test("WorkerSupervisor delivers uncorrelated worker events", async () => {
  const supervisor = new WorkerSupervisor();
  supervisor.register({
    capability: "tasks",
    command: process.env.PYTHON_EXECUTABLE ?? "python",
    arguments: ["-m", "py.workers.demo_worker", "--capability", "tasks"],
    workingDirectory: process.cwd(),
    requestTimeoutMs: 5_000,
  });
  const eventPromise = new Promise<WorkerEnvelope>((resolve) => {
    const unsubscribe = supervisor.subscribeEvents((event) => {
      unsubscribe();
      resolve(event);
    });
  });
  try {
    await supervisor.start("tasks");
    const response = await supervisor.request("tasks", "emit", { taskId: "task-1" });
    const event = await eventPromise;
    assert.equal(response.emitted, true);
    assert.equal(event.kind, "event");
    assert.equal(event.capability, "tasks");
    assert.equal(event.method, "demo.event");
    assert.equal(event.payload.taskId, "task-1");
  } finally {
    await supervisor.stopAll();
  }
});

test("WorkerSupervisor resolves dynamic environment for every fresh process", async () => {
  const supervisor = new WorkerSupervisor();
  let resolutions = 0;
  supervisor.register({
    capability: "documents",
    command: process.env.PYTHON_EXECUTABLE ?? "python",
    arguments: ["-m", "py.workers.demo_worker", "--capability", "documents"],
    workingDirectory: process.cwd(),
    environment: () => {
      resolutions += 1;
      return { OPENXNET_TEST_DYNAMIC_ENVIRONMENT: `generation-${resolutions}` };
    },
    requestTimeoutMs: 5_000,
    shutdownTimeoutMs: 2_000,
  });
  try {
    await supervisor.start("documents");
    await supervisor.stop("documents");
    await supervisor.start("documents");
    assert.equal(resolutions, 2);
  } finally {
    await supervisor.stopAll();
  }
});
