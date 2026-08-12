import { APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS } from "../contracts/application-agentteams-runtime";
import type { ApplicationAgentTeamsRuntimeService } from "../agentteams/application-agentteams-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 AgentTeams Runtime IPC 所需依赖。 */
export interface RegisterApplicationAgentTeamsRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationAgentTeamsRuntimeService, "status" | "applyTeam" | "getTeam">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册授权的 AgentTeams 状态和 Team 操作；输入依赖，返回清理函数。 */
export function registerApplicationAgentTeamsRuntimeIpc(
  options: RegisterApplicationAgentTeamsRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 查询 AgentTeams 状态；输入 Electron 事件，返回公开状态，未授权时抛出异常。 */
  function handleStatus(event: unknown): ReturnType<ApplicationAgentTeamsRuntimeService["status"]> {
    authorizeEvent(event);
    return runtime.status();
  }

  /** 同步 Team；输入 Electron 事件和未知请求，返回公开结果，未授权或无效时抛出异常。 */
  function handleApplyTeam(
    event: unknown,
    request: unknown,
  ): ReturnType<ApplicationAgentTeamsRuntimeService["applyTeam"]> {
    authorizeEvent(event);
    return runtime.applyTeam(request);
  }

  /** 查询 Team；输入 Electron 事件和未知请求，返回公开结果，未授权或无效时抛出异常。 */
  function handleGetTeam(
    event: unknown,
    request: unknown,
  ): ReturnType<ApplicationAgentTeamsRuntimeService["getTeam"]> {
    authorizeEvent(event);
    return runtime.getTeam(request);
  }

  const channels = [
    APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.status,
    APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.applyTeam,
    APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.getTeam,
  ];
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.status, handleStatus);
  ipcMain.handle(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.applyTeam, handleApplyTeam);
  ipcMain.handle(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.getTeam, handleGetTeam);

  /** 移除全部 AgentTeams handlers；无输入和返回值，可重复调用。 */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
