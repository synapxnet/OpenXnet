import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilitySnapshot, CapabilityState } from "../contracts/capability";
import type { WorkerEnvelope } from "../contracts/worker-protocol";
import { ApplicationLiveRuntimeService } from "./application-live-runtime";

/** 记录 Live capability 激活顺序的最小 Core 测试替身。 */
class TestCore {
  public state: CapabilityState = "stopped";

  /** 保存共享事件列表；输入列表，无返回，不启动能力。 */
  public constructor(public readonly events: string[]) {}

  /** 返回当前 Live capability 快照；无输入，无副作用。 */
  public getCapability(): CapabilitySnapshot {
    return {
      id: "live",
      displayName: "Live Streaming",
      runtime: "python",
      optional: true,
      dependencies: ["core"],
      state: this.state,
      changedAt: new Date(0).toISOString(),
    };
  }

  /** 记录激活并返回 ready 快照；无输入，返回 Promise。 */
  public async ensureCapability(): Promise<CapabilitySnapshot> {
    this.events.push("ensure");
    this.state = "ready";
    return this.getCapability();
  }
}

/** 记录 Worker 请求并允许推送未关联事件的测试替身。 */
class TestSupervisor {
  public readonly requests: Array<{ method: string; payload: Readonly<Record<string, unknown>> }> = [];
  private listener: ((event: WorkerEnvelope) => void) | null = null;

  /** 注册事件监听器；输入回调，返回取消函数，不启动 Worker。 */
  public subscribeEvents(listener: (event: WorkerEnvelope) => void): () => void {
    this.listener = listener;
    return () => { this.listener = null; };
  }

  /** 记录请求并返回确定性状态；输入 capability、方法和载荷，返回安全映射。 */
  public async request(
    _capability: "live",
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    this.requests.push({ method, payload });
    return {
      success: true,
      is_running: method !== "live.stop",
      details: {
        bilibili: method !== "live.stop",
        youtube: false,
        twitch: false,
      },
    };
  }

  /** 向服务推送一个 Worker 事件；输入 envelope，无返回，未订阅时静默结束。 */
  public emit(event: WorkerEnvelope): void {
    this.listener?.(event);
  }
}

/** 创建带凭据顺序记录的 Live Runtime 测试夹具。 */
function createFixture(): {
  core: TestCore;
  supervisor: TestSupervisor;
  service: ApplicationLiveRuntimeService;
  events: string[];
} {
  const events: string[] = [];
  const core = new TestCore(events);
  const supervisor = new TestSupervisor();
  const service = new ApplicationLiveRuntimeService({
    core,
    supervisor,
    waitForCredentialRefresh: async () => { events.push("credentials"); },
    logger: { warn: () => undefined },
  });
  return { core, supervisor, service, events };
}

test("Live Runtime status does not activate a stopped Worker", async () => {
  const { service, supervisor } = createFixture();
  const result = await service.status();
  assert.equal(result.status, "stopped");
  assert.deepEqual(supervisor.requests, []);
  service.close();
});

test("Live Runtime start waits for credentials and sends metadata only", async () => {
  const { service, supervisor, events } = createFixture();
  const result = await service.start({
    configuration: {
      bilibili_enabled: true,
      bilibili_type: "web",
      bilibili_room_id: "123",
      youtube_enabled: false,
      twitch_enabled: false,
    },
  });
  assert.deepEqual(events, ["credentials", "ensure"]);
  assert.equal(result.isRunning, true);
  assert.equal(supervisor.requests[0]?.method, "live.start");
  assert.doesNotMatch(JSON.stringify(supervisor.requests[0]), /secret|token|credential|api_key/i);
  service.close();
});

test("Live Runtime validates Worker events before publishing", () => {
  const { service, supervisor } = createFixture();
  const events: unknown[] = [];
  service.subscribe((event) => events.push(event));
  supervisor.emit({
    protocolVersion: "1.0",
    messageId: "message-id",
    traceId: "trace-id",
    kind: "event",
    capability: "live",
    method: "live.event",
    payload: {
      id: "event-id",
      type: "message",
      content: "用户说：你好",
      danmu_type: "danmaku",
      platform: "bilibili",
    },
  });
  supervisor.emit({
    protocolVersion: "1.0",
    messageId: "bad-id",
    traceId: "bad-id",
    kind: "event",
    capability: "live",
    method: "live.event",
    payload: { content: "invalid" },
  });
  assert.equal(events.length, 1);
  assert.match(JSON.stringify(events[0]), /openxnet\.application-live-event\.v1/);
  service.close();
});
