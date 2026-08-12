import {
  APPLICATION_CONNECTOR_RUNTIME_SCHEMA,
  parseApplicationConnectorRuntimeMutationRequest,
  parseApplicationConnectorRuntimePlatformRequest,
  type ApplicationConnectorRuntimeOperation,
  type ApplicationConnectorRuntimePlatform,
  type ApplicationConnectorRuntimeResult,
  type ApplicationConnectorRuntimeState,
} from "../contracts/application-connector-runtime";
import type { DesktopCore } from "../core/desktop-core";
import { WorkerRequestError, type WorkerSupervisor } from "../workers/worker-supervisor";

/** Fixed diagnostics sink that never receives Connector configuration or SDK errors. */
export interface ApplicationConnectorRuntimeLogger {
  warn(message: string): void;
}

/** Dependencies used to control the Connector Worker from authorized Main IPC. */
export interface ApplicationConnectorRuntimeServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability" | "getCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly getBackendPort: () => number;
  readonly waitForCredentialRefresh?: () => Promise<void>;
  readonly logger?: ApplicationConnectorRuntimeLogger;
}

/** Main-owned runtime boundary for optional Connector Worker platforms. */
export class ApplicationConnectorRuntimeService {
  private readonly logger: ApplicationConnectorRuntimeLogger;

  /** 使用 Core 与 Worker Supervisor 创建服务；仅保存依赖，不启动进程，构造失败时直接抛出异常。 */
  public constructor(private readonly options: ApplicationConnectorRuntimeServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** 查询平台状态且不激活进程；输入未知请求，返回脱敏结果，请求无效时抛出 TypeError。 */
  public async status(value: unknown): Promise<ApplicationConnectorRuntimeResult> {
    const { platform } = parseApplicationConnectorRuntimePlatformRequest(value);
    const capability = this.options.core.getCapability("connectors");
    if (!(["ready", "degraded"] as const).includes(capability.state as "ready" | "degraded")) {
      const state: ApplicationConnectorRuntimeState = capability.state === "unavailable"
        ? "unavailable"
        : capability.state === "starting"
          ? "starting"
          : capability.state === "stopping"
            ? "stopping"
            : capability.state === "error"
              ? "error"
              : "stopped";
      return this.createResult("status", platform, state !== "error", false, state);
    }
    try {
      const payload = await this.options.supervisor.request(
        "connectors",
        "connectors.status",
        { platform },
      );
      return this.fromWorkerPayload("status", platform, payload);
    } catch (error) {
      return this.createFailure("status", platform, error);
    }
  }

  /** 在凭据刷新后启动平台；输入含无密钥配置，返回固定结果，内部失败会转换为公开错误码。 */
  public async start(value: unknown): Promise<ApplicationConnectorRuntimeResult> {
    return this.mutate("start", "connectors.start", value);
  }

  /** 停止指定平台且不激活已停止 Worker；输入平台请求，返回固定结果，内部失败会脱敏。 */
  public async stop(value: unknown): Promise<ApplicationConnectorRuntimeResult> {
    const { platform } = parseApplicationConnectorRuntimePlatformRequest(value);
    const capability = this.options.core.getCapability("connectors");
    if (!(["ready", "degraded"] as const).includes(capability.state as "ready" | "degraded")) {
      return this.createResult("stop", platform, true, false, "stopped");
    }
    try {
      const payload = await this.options.supervisor.request(
        "connectors",
        "connectors.stop",
        { platform },
      );
      return this.fromWorkerPayload("stop", platform, payload);
    } catch (error) {
      return this.createFailure("stop", platform, error);
    }
  }

  /** 在凭据持久化后重载平台；输入含无密钥配置，返回固定结果，不主动启动兼容或语音后端。 */
  public async reload(value: unknown): Promise<ApplicationConnectorRuntimeResult> {
    return this.mutate("reload", "connectors.reload", value);
  }

  /** 热更新已运行平台且不激活 Worker；输入无密钥配置，返回固定结果，不刷新凭据或注入后端端口。 */
  public async update(value: unknown): Promise<ApplicationConnectorRuntimeResult> {
    const { platform, configuration } = parseApplicationConnectorRuntimeMutationRequest(value);
    const capability = this.options.core.getCapability("connectors");
    if (!(["ready", "degraded"] as const).includes(capability.state as "ready" | "degraded")) {
      return this.createResult("update", platform, true, false, "stopped");
    }
    try {
      const payload = await this.options.supervisor.request(
        "connectors",
        "connectors.update",
        { platform, configuration },
      );
      return this.fromWorkerPayload("update", platform, payload);
    } catch (error) {
      return this.createFailure("update", platform, error);
    }
  }

  /** 执行启动或重载；输入操作、方法和请求，返回公开结果，能力或 Worker 异常会被脱敏。 */
  private async mutate(
    operation: "start" | "reload",
    method: "connectors.start" | "connectors.reload",
    value: unknown,
  ): Promise<ApplicationConnectorRuntimeResult> {
    const { platform, configuration } = parseApplicationConnectorRuntimeMutationRequest(value);
    try {
      await this.options.waitForCredentialRefresh?.();
      await this.options.core.ensureCapability("connectors");
      const backendPort = this.options.getBackendPort();
      if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65_535) {
        throw new Error("Connector Runtime backend port is unavailable.");
      }
      const payload = await this.options.supervisor.request("connectors", method, {
        platform,
        configuration,
        backendPort,
      });
      return this.fromWorkerPayload(operation, platform, payload);
    } catch (error) {
      return this.createFailure(operation, platform, error);
    }
  }

  /** 把 Worker 状态转换为稳定公开结果；输入操作、平台和载荷，返回无凭据对象且不修改载荷。 */
  private fromWorkerPayload(
    operation: ApplicationConnectorRuntimeOperation,
    platform: ApplicationConnectorRuntimePlatform,
    payload: Readonly<Record<string, unknown>>,
  ): ApplicationConnectorRuntimeResult {
    const isRunning = payload.is_running === true;
    const rawStatus = String(payload.status ?? "").trim().toLowerCase();
    const status: ApplicationConnectorRuntimeState = rawStatus === "error"
      ? "error"
      : rawStatus === "starting"
        ? "starting"
        : rawStatus === "stopping"
          ? "stopping"
          : isRunning
            ? "running"
            : "stopped";
    return this.createResult(operation, platform, status !== "error", isRunning, status);
  }

  /** 把内部异常替换为固定公开失败；输入操作、平台和异常，返回脱敏结果并仅记录固定诊断。 */
  private createFailure(
    operation: ApplicationConnectorRuntimeOperation,
    platform: ApplicationConnectorRuntimePlatform,
    error: unknown,
  ): ApplicationConnectorRuntimeResult {
    const retryable = error instanceof WorkerRequestError ? error.retryable : true;
    this.logger.warn(`Connector Runtime '${operation}' failed with a private runtime error.`);
    return {
      ...this.createResult(operation, platform, false, false, "error"),
      errorCode: retryable ? "CONNECTOR_RUNTIME_UNAVAILABLE" : "CONNECTOR_RUNTIME_FAILED",
      retryable,
    };
  }

  /** 构建完整无凭据运行时结果；输入状态字段，返回可序列化对象，无副作用且不抛出供应商异常。 */
  private createResult(
    operation: ApplicationConnectorRuntimeOperation,
    platform: ApplicationConnectorRuntimePlatform,
    success: boolean,
    isRunning: boolean,
    status: ApplicationConnectorRuntimeState,
  ): ApplicationConnectorRuntimeResult {
    return {
      schema: APPLICATION_CONNECTOR_RUNTIME_SCHEMA,
      operation,
      platform,
      success,
      isRunning,
      status,
      errorCode: status === "error" ? "CONNECTOR_RUNTIME_FAILED" : null,
      retryable: false,
    };
  }
}
