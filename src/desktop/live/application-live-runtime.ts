import type { DesktopCore } from "../core/desktop-core";
import {
  APPLICATION_LIVE_RUNTIME_SCHEMA,
  parseApplicationLiveRuntimeEvent,
  parseApplicationLiveRuntimeMutationRequest,
  type ApplicationLiveRuntimeEvent,
  type ApplicationLiveRuntimeOperation,
  type ApplicationLiveRuntimeResult,
  type ApplicationLiveRuntimeState,
} from "../contracts/application-live-runtime";
import type { WorkerEnvelope } from "../contracts/worker-protocol";
import { WorkerRequestError, type WorkerSupervisor } from "../workers/worker-supervisor";

/** Live Runtime 固定诊断接口。 */
export interface ApplicationLiveRuntimeLogger {
  warn(message: string): void;
}

/** Live Runtime 服务依赖。 */
export interface ApplicationLiveRuntimeServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability" | "getCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request" | "subscribeEvents">;
  readonly waitForCredentialRefresh?: () => Promise<void>;
  readonly logger?: ApplicationLiveRuntimeLogger;
}

/** Main 持有的直播生命周期与 Worker 事件边界。 */
export class ApplicationLiveRuntimeService {
  private readonly listeners = new Set<(event: ApplicationLiveRuntimeEvent) => void>();
  private readonly logger: ApplicationLiveRuntimeLogger;
  private readonly unsubscribeWorkerEvents: () => void;

  /** 创建服务并订阅 Worker 事件；输入依赖，无返回，不激活 Live Worker。 */
  public constructor(private readonly options: ApplicationLiveRuntimeServiceOptions) {
    this.logger = options.logger ?? console;
    this.unsubscribeWorkerEvents = options.supervisor.subscribeEvents(
      this.handleWorkerEvent.bind(this),
    );
  }

  /** 查询直播状态且不激活停止能力；无请求输入，返回固定公开结果，Worker 异常会脱敏。 */
  public async status(): Promise<ApplicationLiveRuntimeResult> {
    const capability = this.options.core.getCapability("live");
    if (!(["ready", "degraded"] as const).includes(capability.state as "ready" | "degraded")) {
      const state: ApplicationLiveRuntimeState = capability.state === "unavailable"
        ? "unavailable"
        : capability.state === "starting"
          ? "starting"
          : capability.state === "stopping"
            ? "stopping"
            : capability.state === "error"
              ? "error"
              : "stopped";
      return this.createResult("status", state !== "error", false, state);
    }
    try {
      return this.fromWorkerPayload(
        "status",
        await this.options.supervisor.request("live", "live.status", {}),
      );
    } catch (error) {
      return this.createFailure("status", error);
    }
  }

  /** 在凭据刷新后启动直播；输入未知请求，返回固定结果，校验错误直接抛出 TypeError。 */
  public start(value: unknown): Promise<ApplicationLiveRuntimeResult> {
    return this.mutate("start", "live.start", value);
  }

  /** 停止直播且不激活停止能力；无请求输入，返回固定结果，内部异常会脱敏。 */
  public async stop(): Promise<ApplicationLiveRuntimeResult> {
    const capability = this.options.core.getCapability("live");
    if (!(["ready", "degraded"] as const).includes(capability.state as "ready" | "degraded")) {
      return this.createResult("stop", true, false, "stopped");
    }
    try {
      return this.fromWorkerPayload(
        "stop",
        await this.options.supervisor.request("live", "live.stop", {}),
      );
    } catch (error) {
      return this.createFailure("stop", error);
    }
  }

  /** 在凭据刷新后重载直播；输入未知请求，返回固定结果，校验错误直接抛出 TypeError。 */
  public reload(value: unknown): Promise<ApplicationLiveRuntimeResult> {
    return this.mutate("reload", "live.reload", value);
  }

  /** 订阅已校验直播事件；输入回调，返回取消函数，监听器异常不会影响其他订阅者。 */
  public subscribe(listener: (event: ApplicationLiveRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 关闭 Worker 事件订阅并清空 Renderer 监听器；无输入和返回值，可重复调用。 */
  public close(): void {
    this.unsubscribeWorkerEvents();
    this.listeners.clear();
  }

  /** 执行启动或重载；输入操作、方法和请求，返回脱敏结果，能力异常转换为固定错误。 */
  private async mutate(
    operation: "start" | "reload",
    method: "live.start" | "live.reload",
    value: unknown,
  ): Promise<ApplicationLiveRuntimeResult> {
    const { configuration } = parseApplicationLiveRuntimeMutationRequest(value);
    try {
      await this.options.waitForCredentialRefresh?.();
      await this.options.core.ensureCapability("live");
      const payload = await this.options.supervisor.request("live", method, { configuration });
      return this.fromWorkerPayload(operation, payload);
    } catch (error) {
      return this.createFailure(operation, error);
    }
  }

  /** 处理 Worker 事件；输入 envelope，无返回，非直播或无效事件被丢弃并记录固定诊断。 */
  private handleWorkerEvent(envelope: WorkerEnvelope): void {
    if (envelope.kind !== "event" || envelope.capability !== "live" || envelope.method !== "live.event") {
      return;
    }
    let event: ApplicationLiveRuntimeEvent;
    try {
      event = parseApplicationLiveRuntimeEvent(envelope.payload);
    } catch {
      this.logger.warn("Live Runtime discarded an invalid Worker event.");
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Renderer listeners own their failures; Worker event delivery continues.
      }
    }
  }

  /** 转换 Worker 状态；输入操作和载荷，返回固定无凭据结果，不修改载荷。 */
  private fromWorkerPayload(
    operation: ApplicationLiveRuntimeOperation,
    payload: Readonly<Record<string, unknown>>,
  ): ApplicationLiveRuntimeResult {
    const isRunning = payload.is_running === true;
    const details = this.parseDetails(payload.details);
    const success = payload.success !== false;
    return this.createResult(
      operation,
      success,
      isRunning,
      success ? (isRunning ? "running" : "stopped") : "error",
      details,
    );
  }

  /** 解析三平台标志；输入未知值，返回固定布尔对象，字段缺失时使用 False。 */
  private parseDetails(value: unknown): ApplicationLiveRuntimeResult["details"] {
    const details = typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    return {
      bilibili: details.bilibili === true,
      youtube: details.youtube === true,
      twitch: details.twitch === true,
    };
  }

  /** 转换内部失败；输入操作和异常，返回固定公开错误并只记录无敏感诊断。 */
  private createFailure(
    operation: ApplicationLiveRuntimeOperation,
    error: unknown,
  ): ApplicationLiveRuntimeResult {
    const retryable = error instanceof WorkerRequestError ? error.retryable : true;
    this.logger.warn(`Live Runtime '${operation}' failed with a private runtime error.`);
    return {
      ...this.createResult(operation, false, false, "error"),
      errorCode: retryable ? "LIVE_RUNTIME_UNAVAILABLE" : "LIVE_RUNTIME_FAILED",
      retryable,
    };
  }

  /** 构建公开结果；输入状态字段，返回完整可序列化对象，无副作用。 */
  private createResult(
    operation: ApplicationLiveRuntimeOperation,
    success: boolean,
    isRunning: boolean,
    status: ApplicationLiveRuntimeState,
    details: ApplicationLiveRuntimeResult["details"] = {
      bilibili: false,
      youtube: false,
      twitch: false,
    },
  ): ApplicationLiveRuntimeResult {
    return {
      schema: APPLICATION_LIVE_RUNTIME_SCHEMA,
      operation,
      success,
      isRunning,
      status,
      details,
      errorCode: status === "error" ? "LIVE_RUNTIME_FAILED" : null,
      retryable: false,
    };
  }
}
