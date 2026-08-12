import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilitySnapshot, CapabilityState } from "../contracts/capability";
import { ApplicationConnectorRuntimeService } from "./application-connector-runtime";
import { WorkerRequestError } from "../workers/worker-supervisor";

/** Minimal Core fixture recording Connector capability activation. */
class TestCore {
  public state: CapabilityState = "stopped";

  /** Create one Core fixture over a shared event log. */
  public constructor(public readonly events: string[]) {}

  /** Return one synthetic Connector capability snapshot. */
  public getCapability(): CapabilitySnapshot {
    return {
      id: "connectors",
      displayName: "External Connectors",
      runtime: "python",
      optional: true,
      dependencies: ["core"],
      state: this.state,
      changedAt: new Date(0).toISOString(),
    };
  }

  /** Record activation and make the synthetic capability ready. */
  public async ensureCapability(): Promise<CapabilitySnapshot> {
    this.events.push("ensure");
    this.state = "ready";
    return this.getCapability();
  }
}

/** Minimal Worker Supervisor fixture recording exact method payloads. */
class TestSupervisor {
  public readonly requests: Array<{
    method: string;
    payload: Readonly<Record<string, unknown>>;
  }> = [];
  public failure: Error | null = null;

  /** Return one synthetic Worker response or configured failure. */
  public async request(
    _capability: "connectors",
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    this.requests.push({ method, payload });
    if (this.failure) throw this.failure;
    return {
      platform: payload.platform,
      is_running: method !== "connectors.stop",
      status: method === "connectors.stop" ? "stopped" : "running",
      error_message: "private SDK detail",
    };
  }
}

/** Create one runtime fixture with deterministic dependency ordering. */
function createFixture(): {
  readonly core: TestCore;
  readonly supervisor: TestSupervisor;
  readonly events: string[];
  readonly service: ApplicationConnectorRuntimeService;
} {
  const events: string[] = [];
  const core = new TestCore(events);
  const supervisor = new TestSupervisor();
  const service = new ApplicationConnectorRuntimeService({
    core,
    supervisor,
    getBackendPort: () => { events.push("port"); return 3456; },
    waitForCredentialRefresh: async () => { events.push("credentials"); },
    logger: { warn: () => undefined },
  });
  return { core, supervisor, events, service };
}

test("Connector Runtime status does not activate a stopped capability", async () => {
  const { core, supervisor, service } = createFixture();
  const result = await service.status({ platform: "discord" });
  assert.equal(result.success, true);
  assert.equal(result.isRunning, false);
  assert.equal(result.status, "stopped");
  assert.deepEqual(core.events, []);
  assert.deepEqual(supervisor.requests, []);
});

test("Connector Runtime start waits for credentials and sends only metadata", async () => {
  const { supervisor, events, service } = createFixture();
  const result = await service.start({
    platform: "slack",
    configuration: {
      llm_model: "openxnet-model",
      memory_limit: 30,
      separators: ["."],
      reasoning_visible: true,
      quick_restart: true,
      enable_tts: false,
      wakeWord: "",
      behaviorTargetChatIds: [],
    },
  });
  assert.deepEqual(events, ["credentials", "ensure", "port"]);
  assert.equal(result.success, true);
  assert.equal(result.isRunning, true);
  assert.equal(result.status, "running");
  assert.equal(supervisor.requests[0]?.method, "connectors.start");
  assert.equal(supervisor.requests[0]?.payload.backendPort, 3456);
  const serialized = JSON.stringify(supervisor.requests[0]?.payload);
  assert.doesNotMatch(serialized, /secret|token|credential/i);
});

test("Connector Runtime update does not activate a stopped capability", async () => {
  const { supervisor, events, service } = createFixture();
  const result = await service.update({
    platform: "qq",
    configuration: {
      QQAgent: "openxnet-model",
      memoryLimit: 30,
      appid: "public-app-id",
      separators: ["."],
      reasoningVisible: true,
      quickRestart: true,
      is_sandbox: false,
      toolMemorandumEnabled: true,
    },
  });
  assert.equal(result.success, true);
  assert.equal(result.status, "stopped");
  assert.deepEqual(events, []);
  assert.deepEqual(supervisor.requests, []);
});

test("Connector Runtime update forwards exact metadata without credentials or backend port", async () => {
  const { core, supervisor, events, service } = createFixture();
  core.state = "ready";
  const configuration = {
    llm_model: "openxnet-model",
    memory_limit: 30,
    separators: ["."],
    reasoning_visible: true,
    quick_restart: true,
    enable_tts: false,
    wakeWord: "",
    behaviorSettings: { enabled: true, behaviorList: [] },
    behaviorTargetChatIds: ["channel-1"],
    toolMemorandumEnabled: true,
  };
  const result = await service.update({ platform: "slack", configuration });
  assert.equal(result.success, true);
  assert.equal(result.status, "running");
  assert.deepEqual(events, []);
  assert.deepEqual(supervisor.requests, [{
    method: "connectors.update",
    payload: { platform: "slack", configuration },
  }]);
});

test("Connector Runtime replaces private Worker failures with fixed codes", async () => {
  const { supervisor, service } = createFixture();
  supervisor.failure = new WorkerRequestError(
    "HANDLER_FAILED",
    "private-token-value from SDK",
    false,
  );
  const result = await service.start({
    platform: "discord",
    configuration: {
      llm_model: "openxnet-model",
      memory_limit: 30,
      separators: ["."],
      reasoning_visible: true,
      quick_restart: true,
      enable_tts: false,
      wakeWord: "",
      behaviorTargetChatIds: [],
    },
  });
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "CONNECTOR_RUNTIME_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /private-token-value|HANDLER_FAILED/);
});
