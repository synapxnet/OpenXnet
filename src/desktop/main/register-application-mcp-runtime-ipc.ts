import { APPLICATION_MCP_RUNTIME_CHANNELS } from "../contracts/application-mcp-runtime";
import type { ApplicationMcpRuntimeService } from "../mcp/application-mcp-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 MCP Runtime IPC 所需依赖。 */
export interface RegisterApplicationMcpRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationMcpRuntimeService, "status" | "start" | "stop" | "listTools">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册授权 MCP 生命周期处理器；输入依赖，返回清理函数，注册前移除旧处理器。 */
export function registerApplicationMcpRuntimeIpc(
  options: RegisterApplicationMcpRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 查询集成状态；输入 Electron 事件和请求，返回公开结果，未授权时抛出异常。 */
  function handleStatus(event: unknown, request: unknown): ReturnType<ApplicationMcpRuntimeService["status"]> {
    authorizeEvent(event);
    return runtime.status(request);
  }

  /** 启动集成；输入 Electron 事件和请求，返回公开结果，未授权或请求无效时抛出异常。 */
  function handleStart(event: unknown, request: unknown): ReturnType<ApplicationMcpRuntimeService["start"]> {
    authorizeEvent(event);
    return runtime.start(request);
  }

  /** 停止集成；输入 Electron 事件和请求，返回公开结果，未授权或请求无效时抛出异常。 */
  function handleStop(event: unknown, request: unknown): ReturnType<ApplicationMcpRuntimeService["stop"]> {
    authorizeEvent(event);
    return runtime.stop(request);
  }

  /** 发现集成工具；输入 Electron 事件和启动请求，返回脱敏摘要，未授权时抛出异常。 */
  function handleListTools(
    event: unknown,
    request: unknown,
  ): ReturnType<ApplicationMcpRuntimeService["listTools"]> {
    authorizeEvent(event);
    return runtime.listTools(request);
  }

  const handlers = new Map<string, (event: unknown, request: unknown) => unknown>([
    [APPLICATION_MCP_RUNTIME_CHANNELS.status, handleStatus],
    [APPLICATION_MCP_RUNTIME_CHANNELS.start, handleStart],
    [APPLICATION_MCP_RUNTIME_CHANNELS.stop, handleStop],
    [APPLICATION_MCP_RUNTIME_CHANNELS.listTools, handleListTools],
  ]);
  for (const channel of handlers.keys()) ipcMain.removeHandler(channel);
  for (const [channel, handler] of handlers) ipcMain.handle(channel, handler);

  /** 移除全部 MCP Runtime 处理器；无输入和返回值，可在应用退出时调用。 */
  function cleanup(): void {
    for (const channel of handlers.keys()) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
