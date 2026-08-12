import type { DesktopCore } from "../core/desktop-core";
import {
  APPLICATION_MCP_RUNTIME_SCHEMA,
  parseApplicationMcpRuntimeIntegrationRequest,
  parseApplicationMcpRuntimeStartRequest,
  type ApplicationMcpRuntimeIntegration,
  type ApplicationMcpRuntimeOperation,
  type ApplicationMcpRuntimeResult,
  type ApplicationMcpRuntimeState,
  type ApplicationMcpRuntimeToolsResult,
} from "../contracts/application-mcp-runtime";
import { WorkerRequestError, type WorkerSupervisor } from "../workers/worker-supervisor";

/** MCP Runtime 固定诊断接口。 */
export interface ApplicationMcpRuntimeLogger {
  warn(message: string): void;
}

/** MCP Runtime 服务依赖。 */
export interface ApplicationMcpRuntimeServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability" | "getCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly waitForCredentialRefresh?: () => Promise<void>;
  readonly logger?: ApplicationMcpRuntimeLogger;
}

/** Main 持有的 MCP 集成生命周期边界。 */
export class ApplicationMcpRuntimeService {
  private readonly logger: ApplicationMcpRuntimeLogger;

  /** 创建服务；输入 Core、Worker 和凭据依赖，无返回，不激活 MCP Worker。 */
  public constructor(private readonly options: ApplicationMcpRuntimeServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** 查询集成状态且不激活停止能力；输入未知请求，返回固定公开结果，请求无效时抛出 TypeError。 */
  public async status(value: unknown): Promise<ApplicationMcpRuntimeResult> {
    const { integration } = parseApplicationMcpRuntimeIntegrationRequest(value);
    const capability = this.options.core.getCapability("mcp");
    if (!(capability.state === "ready" || capability.state === "degraded")) {
      return this.createResult(
        "status",
        integration,
        capability.state !== "error",
        false,
        this.mapCapabilityState(capability.state),
      );
    }
    try {
      return this.fromWorkerPayload(
        "status",
        integration,
        await this.options.supervisor.request("mcp", "mcp.status", { integration }),
      );
    } catch (error) {
      return this.createFailure("status", integration, error);
    }
  }

  /** 启动一个允许的 MCP 集成；输入未知请求，返回固定结果，校验错误直接抛出 TypeError。 */
  public async start(value: unknown): Promise<ApplicationMcpRuntimeResult> {
    const request = parseApplicationMcpRuntimeStartRequest(value);
    try {
      await this.options.waitForCredentialRefresh?.();
      await this.options.core.ensureCapability("mcp");
      const payload = await this.options.supervisor.request("mcp", "mcp.integration.start", {
        integration: request.integration,
        configuration: request.configuration,
      });
      return this.fromWorkerPayload("start", request.integration, payload);
    } catch (error) {
      return this.createFailure("start", request.integration, error);
    }
  }

  /** 停止集成且不激活停止能力；输入未知请求，返回固定结果，请求无效时抛出 TypeError。 */
  public async stop(value: unknown): Promise<ApplicationMcpRuntimeResult> {
    const { integration } = parseApplicationMcpRuntimeIntegrationRequest(value);
    const capability = this.options.core.getCapability("mcp");
    if (!(capability.state === "ready" || capability.state === "degraded")) {
      return this.createResult("stop", integration, true, false, "stopped");
    }
    try {
      return this.fromWorkerPayload(
        "stop",
        integration,
        await this.options.supervisor.request("mcp", "mcp.integration.stop", { integration }),
      );
    } catch (error) {
      return this.createFailure("stop", integration, error);
    }
  }

  /** 发现一个 MCP 集成的工具；输入启动请求，返回脱敏摘要，连接失败时返回固定公开错误。 */
  public async listTools(value: unknown): Promise<ApplicationMcpRuntimeToolsResult> {
    const request = parseApplicationMcpRuntimeStartRequest(value);
    try {
      await this.options.waitForCredentialRefresh?.();
      await this.options.core.ensureCapability("mcp");
      const payload = await this.options.supervisor.request("mcp", "mcp.tools.list", {
        integration: request.integration,
        configuration: request.configuration,
      });
      const rawTools = payload.tools;
      if (!Array.isArray(rawTools) || rawTools.length > 512) {
        throw new TypeError("MCP Runtime tool list is invalid.");
      }
      const tools = rawTools.map((tool) => {
        const functionNode = typeof tool === "object" && tool !== null && !Array.isArray(tool)
          ? (tool as Record<string, unknown>).function
          : null;
        if (
          typeof functionNode !== "object"
          || functionNode === null
          || Array.isArray(functionNode)
          || typeof (functionNode as Record<string, unknown>).name !== "string"
        ) {
          throw new TypeError("MCP Runtime tool schema is invalid.");
        }
        const record = functionNode as Record<string, unknown>;
        return {
          name: record.name as string,
          description: typeof record.description === "string" ? record.description : "",
          enabled: true,
        };
      });
      return {
        schema: APPLICATION_MCP_RUNTIME_SCHEMA,
        integration: request.integration,
        success: true,
        tools,
        errorCode: null,
        retryable: false,
      };
    } catch (error) {
      const retryable = error instanceof WorkerRequestError ? error.retryable : true;
      this.logger.warn("MCP Runtime tool discovery failed with a private runtime error.");
      return {
        schema: APPLICATION_MCP_RUNTIME_SCHEMA,
        integration: request.integration,
        success: false,
        tools: [],
        errorCode: retryable ? "MCP_RUNTIME_UNAVAILABLE" : "MCP_RUNTIME_FAILED",
        retryable,
      };
    }
  }

  /** 把能力状态映射为公开 MCP 状态；输入 Core 状态，返回稳定状态，无副作用。 */
  private mapCapabilityState(state: string): ApplicationMcpRuntimeState {
    if (state === "unavailable") return "unavailable";
    if (state === "starting") return "starting";
    if (state === "stopping") return "stopping";
    if (state === "error") return "error";
    return "stopped";
  }

  /** 转换 Worker 状态；输入操作、集成和载荷，返回固定无凭据结果，不修改载荷。 */
  private fromWorkerPayload(
    operation: ApplicationMcpRuntimeOperation,
    integration: ApplicationMcpRuntimeIntegration,
    payload: Readonly<Record<string, unknown>>,
  ): ApplicationMcpRuntimeResult {
    const isRunning = payload.is_running === true;
    const success = payload.success !== false;
    return this.createResult(
      operation,
      integration,
      success,
      isRunning,
      success ? (isRunning ? "running" : "stopped") : "error",
    );
  }

  /** 转换内部失败；输入操作、集成和异常，返回固定公开错误并只记录无敏感诊断。 */
  private createFailure(
    operation: ApplicationMcpRuntimeOperation,
    integration: ApplicationMcpRuntimeIntegration,
    error: unknown,
  ): ApplicationMcpRuntimeResult {
    const retryable = error instanceof WorkerRequestError ? error.retryable : true;
    this.logger.warn(`MCP Runtime '${operation}' failed with a private runtime error.`);
    return {
      ...this.createResult(operation, integration, false, false, "error"),
      errorCode: retryable ? "MCP_RUNTIME_UNAVAILABLE" : "MCP_RUNTIME_FAILED",
      retryable,
    };
  }

  /** 构建公开结果；输入状态字段，返回完整可序列化对象，无副作用。 */
  private createResult(
    operation: ApplicationMcpRuntimeOperation,
    integration: ApplicationMcpRuntimeIntegration,
    success: boolean,
    isRunning: boolean,
    status: ApplicationMcpRuntimeState,
  ): ApplicationMcpRuntimeResult {
    return {
      schema: APPLICATION_MCP_RUNTIME_SCHEMA,
      operation,
      integration,
      success,
      isRunning,
      status,
      errorCode: status === "error" ? "MCP_RUNTIME_FAILED" : null,
      retryable: false,
    };
  }
}
