import {
  APPLICATION_AGENTTEAMS_STATUS_SCHEMA,
  APPLICATION_AGENTTEAMS_TEAM_SCHEMA,
  parseApplyApplicationAgentTeamsTeamRequest,
  parseGetApplicationAgentTeamsTeamRequest,
  type ApplicationAgentTeamsStatus,
  type ApplicationAgentTeamsTeamResult,
  type ApplyApplicationAgentTeamsTeamRequest,
  type GetApplicationAgentTeamsTeamRequest,
} from "../contracts/application-agentteams-runtime";
import type { DesktopCore } from "../core/desktop-core";
import { WorkerRequestError, type WorkerSupervisor } from "../workers/worker-supervisor";

/** AgentTeams Runtime 固定诊断接口。 */
export interface ApplicationAgentTeamsRuntimeLogger {
  warn(message: string): void;
}

/** AgentTeams Runtime 服务依赖。 */
export interface ApplicationAgentTeamsRuntimeServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability" | "getCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly logger?: ApplicationAgentTeamsRuntimeLogger;
}

/** Main 持有的 AgentTeams 状态、Team 同步和结果投影边界。 */
export class ApplicationAgentTeamsRuntimeService {
  private readonly logger: ApplicationAgentTeamsRuntimeLogger;

  /** 创建 AgentTeams Runtime 服务；输入 Core 和 Worker 依赖，无返回且不激活能力。 */
  public constructor(private readonly options: ApplicationAgentTeamsRuntimeServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** 显式检测 AgentTeams；无请求输入，返回公开状态，能力不可用时不启动进程。 */
  public async status(): Promise<ApplicationAgentTeamsStatus> {
    if (this.options.core.getCapability("agentteams").state === "unavailable") {
      return this.createUnavailableStatus();
    }
    try {
      await this.options.core.ensureCapability("agentteams");
      return this.parseStatusPayload(
        await this.options.supervisor.request("agentteams", "agentteams.status", {}),
      );
    } catch (error) {
      return this.createStatusFailure(error);
    }
  }

  /** 同步一个 Team；输入未知请求，返回公开结果，请求无效时直接抛出 TypeError。 */
  public async applyTeam(value: unknown): Promise<ApplicationAgentTeamsTeamResult> {
    const request = parseApplyApplicationAgentTeamsTeamRequest(value);
    return this.executeTeamOperation("apply", request, "agentteams.team.apply");
  }

  /** 查询一个 Team；输入未知请求，返回公开结果，请求无效时直接抛出 TypeError。 */
  public async getTeam(value: unknown): Promise<ApplicationAgentTeamsTeamResult> {
    const request = parseGetApplicationAgentTeamsTeamRequest(value);
    return this.executeTeamOperation("get", request, "agentteams.team.get");
  }

  /** 执行 Team Worker 请求；输入操作、请求和方法，返回脱敏结果，内部失败转换为固定错误。 */
  private async executeTeamOperation(
    operation: "apply" | "get",
    request: ApplyApplicationAgentTeamsTeamRequest | GetApplicationAgentTeamsTeamRequest,
    method: "agentteams.team.apply" | "agentteams.team.get",
  ): Promise<ApplicationAgentTeamsTeamResult> {
    const teamName = "team" in request ? request.team.name : request.teamName;
    const workspaceId = "workspaceId" in request ? request.workspaceId : "";
    try {
      await this.options.core.ensureCapability("agentteams");
      const payload = await this.options.supervisor.request("agentteams", method, { ...request });
      return this.parseTeamPayload(operation, payload, workspaceId, teamName);
    } catch (error) {
      return this.createTeamFailure(operation, workspaceId, teamName, error);
    }
  }

  /** 解析 Worker 状态载荷；输入不可信对象，返回固定公开状态，字段无效时抛出 TypeError。 */
  private parseStatusPayload(payload: Readonly<Record<string, unknown>>): ApplicationAgentTeamsStatus {
    if (payload.schema !== APPLICATION_AGENTTEAMS_STATUS_SCHEMA) {
      throw new TypeError("AgentTeams status response schema is invalid.");
    }
    const cliAvailable = payload.cli_available === true;
    const controllerReachable = payload.controller_reachable === true;
    return {
      schema: APPLICATION_AGENTTEAMS_STATUS_SCHEMA,
      state: controllerReachable ? "ready" : (cliAvailable ? "unreachable" : "unavailable"),
      cliAvailable,
      controllerReachable,
      controllerVersion: this.optionalText(payload.controller_version, 128),
      kubeMode: this.optionalText(payload.kube_mode, 32),
      totalWorkers: this.boundedCount(payload.total_workers),
      totalTeams: this.boundedCount(payload.total_teams),
      totalHumans: this.boundedCount(payload.total_humans),
      errorCode: this.optionalErrorCode(payload.error_code),
      retryable: payload.retryable === true,
    };
  }

  /** 解析 Worker Team 载荷；输入操作、载荷和请求标识，返回有界结果，非法响应时抛出异常。 */
  private parseTeamPayload(
    operation: "apply" | "get",
    payload: Readonly<Record<string, unknown>>,
    fallbackWorkspaceId: string,
    fallbackTeamName: string,
  ): ApplicationAgentTeamsTeamResult {
    if (payload.schema !== APPLICATION_AGENTTEAMS_TEAM_SCHEMA || payload.success !== true) {
      throw new TypeError("AgentTeams team response is invalid.");
    }
    return {
      schema: APPLICATION_AGENTTEAMS_TEAM_SCHEMA,
      operation,
      success: true,
      workspaceId: this.optionalText(payload.workspace_id, 128) || fallbackWorkspaceId,
      teamName: this.optionalText(payload.team_name, 63) || fallbackTeamName,
      phase: this.optionalText(payload.phase, 32) || "Pending",
      leaderName: this.optionalText(payload.leader_name, 63),
      readyWorkers: this.boundedCount(payload.ready_workers),
      totalWorkers: this.boundedCount(payload.total_workers),
      teamRoomId: this.optionalText(payload.team_room_id, 256),
      leaderDmRoomId: this.optionalText(payload.leader_dm_room_id, 256),
      workerNames: this.stringList(payload.worker_names, 64, 63),
      message: this.optionalText(payload.message, 1024),
      errorCode: null,
      retryable: false,
    };
  }

  /** 构建未安装状态；无输入，返回固定公开对象，无副作用。 */
  private createUnavailableStatus(): ApplicationAgentTeamsStatus {
    return {
      schema: APPLICATION_AGENTTEAMS_STATUS_SCHEMA,
      state: "unavailable",
      cliAvailable: false,
      controllerReachable: false,
      controllerVersion: "",
      kubeMode: "",
      totalWorkers: 0,
      totalTeams: 0,
      totalHumans: 0,
      errorCode: "AGENTTEAMS_FEATURE_PACK_UNAVAILABLE",
      retryable: false,
    };
  }

  /** 转换状态异常；输入内部错误，返回固定公开错误，并记录无敏感诊断。 */
  private createStatusFailure(error: unknown): ApplicationAgentTeamsStatus {
    const retryable = error instanceof WorkerRequestError ? error.retryable : true;
    this.logger.warn("AgentTeams Runtime status failed with a private runtime error.");
    return {
      ...this.createUnavailableStatus(),
      state: "error",
      errorCode: retryable ? "AGENTTEAMS_RUNTIME_UNAVAILABLE" : "AGENTTEAMS_RUNTIME_FAILED",
      retryable,
    };
  }

  /** 转换 Team 异常；输入操作、标识和错误，返回固定公开结果，不泄露 CLI 诊断。 */
  private createTeamFailure(
    operation: "apply" | "get",
    workspaceId: string,
    teamName: string,
    error: unknown,
  ): ApplicationAgentTeamsTeamResult {
    const retryable = error instanceof WorkerRequestError ? error.retryable : true;
    this.logger.warn(`AgentTeams Runtime '${operation}' failed with a private runtime error.`);
    return {
      schema: APPLICATION_AGENTTEAMS_TEAM_SCHEMA,
      operation,
      success: false,
      workspaceId,
      teamName,
      phase: "",
      leaderName: "",
      readyWorkers: 0,
      totalWorkers: 0,
      teamRoomId: "",
      leaderDmRoomId: "",
      workerNames: [],
      message: "",
      errorCode: retryable ? "AGENTTEAMS_OPERATION_UNAVAILABLE" : "AGENTTEAMS_OPERATION_FAILED",
      retryable,
    };
  }

  /** 投影可选文本；输入未知值和上限，返回裁剪文本，无效时返回空字符串。 */
  private optionalText(value: unknown, maximumLength: number): string {
    return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
  }

  /** 投影可选错误码；输入未知值，返回有界错误码或空值。 */
  private optionalErrorCode(value: unknown): string | null {
    const normalized = this.optionalText(value, 128);
    return normalized || null;
  }

  /** 投影非负计数；输入未知值，返回有界整数，无效时返回零。 */
  private boundedCount(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) return 0;
    return Math.max(0, Math.min(value, 1_000_000));
  }

  /** 投影字符串列表；输入未知值和预算，返回有界文本数组。 */
  private stringList(value: unknown, maximumItems: number, maximumLength: number): readonly string[] {
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, maximumItems)
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, maximumLength))
      .filter(Boolean);
  }
}
