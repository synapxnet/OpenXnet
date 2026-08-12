import {
  APPLICATION_AGENT_RUNTIME_CHANNELS,
  type ApplicationA2aInspectionResult,
  type ApplicationAgentMutationResult,
} from "../contracts/application-agent-runtime";
import type { ApplicationAgentRuntimeService } from "../agents/application-agent-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Agent Runtime IPC 注册依赖。 */
export interface RegisterApplicationAgentRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationAgentRuntimeService, "createAgent" | "removeAgent" | "inspectA2a">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册 sender-authorized Agent/A2A IPC；输入依赖，输出清理函数，重复注册会先移除旧 handler。 */
export function registerApplicationAgentRuntimeIpc(
  options: RegisterApplicationAgentRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 创建 Agent；输入事件和未知请求，输出 Runtime 结果，未授权发送者先失败。 */
  function handleCreateAgent(event: unknown, request: unknown): Promise<ApplicationAgentMutationResult> {
    authorizeEvent(event);
    return runtime.createAgent(request);
  }

  /** 删除 Agent；输入事件和未知请求，输出 Runtime 结果，未授权发送者先失败。 */
  function handleRemoveAgent(event: unknown, request: unknown): Promise<ApplicationAgentMutationResult> {
    authorizeEvent(event);
    return runtime.removeAgent(request);
  }

  /** 探测 A2A 卡片；输入事件和未知请求，输出公开卡片，未授权发送者先失败。 */
  function handleInspectA2a(event: unknown, request: unknown): Promise<ApplicationA2aInspectionResult> {
    authorizeEvent(event);
    return runtime.inspectA2a(request);
  }

  const channels = Object.values(APPLICATION_AGENT_RUNTIME_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_AGENT_RUNTIME_CHANNELS.createAgent, handleCreateAgent);
  ipcMain.handle(APPLICATION_AGENT_RUNTIME_CHANNELS.removeAgent, handleRemoveAgent);
  ipcMain.handle(APPLICATION_AGENT_RUNTIME_CHANNELS.inspectA2a, handleInspectA2a);

  /** 移除本适配器注册的全部 handler；无输入和返回，多次调用保持幂等。 */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
