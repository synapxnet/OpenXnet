import assert from "node:assert/strict";
import test from "node:test";

import { CapabilityRegistry } from "./capability-registry";
import { DesktopCore } from "./desktop-core";
import { LegacyBackendLifecycleCoordinator } from "./legacy-backend-lifecycle";

test("CapabilityRegistry enforces lifecycle transitions", () => {
  const registry = new CapabilityRegistry(() => new Date("2026-07-22T00:00:00.000Z"));
  registry.register({
    id: "voice",
    displayName: "Voice",
    runtime: "python",
    optional: true,
    dependencies: [],
  });

  assert.equal(registry.transition("voice", "starting").state, "starting");
  assert.equal(registry.transition("voice", "ready").state, "ready");
  assert.throws(() => registry.transition("voice", "installing"), /Invalid capability transition/);
});

test("DesktopCore coalesces concurrent capability activation", async () => {
  const core = new DesktopCore();
  let activationCount = 0;

  await core.start();
  core.registerActivator("voice", async () => {
    activationCount += 1;
    await Promise.resolve();
    return { engine: "test" };
  });

  const [first, second] = await Promise.all([
    core.ensureCapability("voice"),
    core.ensureCapability("voice"),
  ]);

  assert.equal(activationCount, 1);
  assert.equal(first.state, "ready");
  assert.deepEqual(second, first);
});

test("DesktopCore defines Chat against the independent execution engine", () => {
  const core = new DesktopCore();
  const chat = core.getCapability("chat");

  assert.deepEqual(chat.dependencies, ["execution-engine"]);
  assert.equal(chat.runtime, "python");
  assert.equal(chat.state, "unavailable");
});

test("DesktopCore 定义的 Connector 能力不再依赖通用后端", () => {
  const core = new DesktopCore();
  const connectors = core.getCapability("connectors");

  assert.deepEqual(connectors.dependencies, ["core"]);
  assert.equal(connectors.runtime, "python");
  assert.equal(connectors.state, "unavailable");
});

test("DesktopCore retries after an in-flight activation is marked as failed", async () => {
  const core = new DesktopCore();
  let activationCount = 0;
  let rejectFirstActivation: ((error: Error) => void) | null = null;

  await core.start();
  core.registerActivator("voice", async () => {
    activationCount += 1;
    if (activationCount === 1) {
      await new Promise<never>((_resolve, reject) => {
        rejectFirstActivation = reject;
      });
    }
    return { attempt: activationCount };
  });

  const firstActivation = core.ensureCapability("voice");
  await Promise.resolve();
  core.setCapabilityState("voice", "error", {
    error: { code: "PROCESS_EXITED", message: "Worker exited.", retryable: true },
  });
  const retry = core.ensureCapability("voice");
  assert.notEqual(rejectFirstActivation, null);
  (rejectFirstActivation as unknown as (error: Error) => void)(new Error("Worker exited."));

  await assert.rejects(firstActivation, /Worker exited/);
  const recovered = await retry;
  assert.equal(activationCount, 2);
  assert.equal(recovered.state, "ready");
});

test("Legacy 后端生命周期只消费一次预期退出标记", () => {
  const coordinator = new LegacyBackendLifecycleCoordinator({
    isBackendActive: () => false,
    isApplicationQuitting: () => false,
    stopBackend: async () => undefined,
    startBackend: async () => undefined,
  });
  const process = {};

  coordinator.markExpectedExit(process);

  assert.equal(coordinator.consumeExpectedExit(process), true);
  assert.equal(coordinator.consumeExpectedExit(process), false);
});

test("Legacy 后端凭据刷新等待预期停止完成后再启动", async () => {
  const events: string[] = [];
  let backendActive = true;
  let releaseStop: (() => void) | null = null;
  const stopBarrier = new Promise<void>((resolve) => {
    releaseStop = resolve;
  });
  const coordinator = new LegacyBackendLifecycleCoordinator({
    isBackendActive: () => backendActive,
    isApplicationQuitting: () => false,
    stopBackend: async () => {
      events.push("stop");
      await stopBarrier;
      backendActive = false;
    },
    startBackend: async () => {
      events.push("start");
      backendActive = true;
    },
  });

  const firstRefresh = coordinator.scheduleCredentialRefresh();
  const duplicateRefresh = coordinator.scheduleCredentialRefresh();
  assert.equal(firstRefresh, duplicateRefresh);
  assert.deepEqual(events, ["stop"]);

  assert.notEqual(releaseStop, null);
  (releaseStop as unknown as () => void)();
  await firstRefresh;

  assert.deepEqual(events, ["stop", "start"]);
  assert.equal(backendActive, true);
});

test("Legacy 后端未运行时只更新凭据且保持按需启动", async () => {
  const events: string[] = [];
  const coordinator = new LegacyBackendLifecycleCoordinator({
    isBackendActive: () => false,
    isApplicationQuitting: () => false,
    stopBackend: async () => {
      events.push("stop");
    },
    startBackend: async () => {
      events.push("start");
    },
  });

  await coordinator.scheduleCredentialRefresh();

  assert.deepEqual(events, []);
});
