import assert from "node:assert/strict";
import test from "node:test";

import { DesktopCore } from "./desktop-core";
import { registerExecutionEngineCapability } from "./register-execution-engine-capability";
import type {
  ExecutionEngineListener,
  ExecutionEngineSnapshot,
  ExecutionEngineSupervisor,
} from "../workers/execution-engine-supervisor";

class FakeExecutionEngineSupervisor {
  private readonly listeners = new Set<ExecutionEngineListener>();

  /** Subscribe one fake lifecycle listener. */
  public subscribe(listener: ExecutionEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Simulate one successful engine startup and return non-secret process metadata. */
  public async start(): Promise<ExecutionEngineSnapshot> {
    this.emit("starting", null);
    return this.emit("ready", null, 4242);
  }

  /** Emit one deterministic fake supervisor lifecycle transition. */
  public emit(
    state: ExecutionEngineSnapshot["state"],
    error: string | null,
    processId: number | null = null,
  ): ExecutionEngineSnapshot {
    const snapshot = { state, error, processId, activeRequests: 0 };
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    return snapshot;
  }
}

test("registerExecutionEngineCapability synchronizes activation and idle shutdown", async () => {
  const core = new DesktopCore();
  const fake = new FakeExecutionEngineSupervisor();
  const unregister = registerExecutionEngineCapability({
    core,
    supervisor: fake as unknown as ExecutionEngineSupervisor,
  });

  try {
    await core.start();
    const ready = await core.ensureCapability("execution-engine");
    assert.equal(ready.state, "ready");
    assert.equal(ready.metadata?.processId, 4242);
    assert.equal(ready.metadata?.runtime, "execution-engine");
    assert.equal(JSON.stringify(ready.metadata).includes("http://"), false);

    fake.emit("stopping", null, 4242);
    fake.emit("stopped", null);
    assert.equal(core.getCapability("execution-engine").state, "stopped");
  } finally {
    unregister();
  }
});

test("registerExecutionEngineCapability converts unexpected exits into retryable Core errors", async () => {
  const core = new DesktopCore();
  const fake = new FakeExecutionEngineSupervisor();
  registerExecutionEngineCapability({
    core,
    supervisor: fake as unknown as ExecutionEngineSupervisor,
  });
  await core.start();
  await core.ensureCapability("execution-engine");

  fake.emit("error", "engine exited", null);
  const failed = core.getCapability("execution-engine");
  assert.equal(failed.state, "error");
  assert.equal(failed.error?.code, "EXECUTION_ENGINE_FAILED");
  assert.equal(failed.error?.retryable, true);
});
