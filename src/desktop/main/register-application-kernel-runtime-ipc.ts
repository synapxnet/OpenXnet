import {
  APPLICATION_KERNEL_RUNTIME_CHANNELS,
  type ApplicationKernelCommandResult,
} from "../contracts/application-kernel-runtime";
import type { ApplicationKernelRuntimeService } from "../kernel/application-kernel-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Kernel Runtime IPC 注册依赖。 */
export interface RegisterApplicationKernelRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationKernelRuntimeService, "invoke">;
  readonly authorizeEvent: (event: unknown) => void;
}

/**
 * 注册 Kernel Runtime typed IPC；输入 Runtime 和发送者授权器，返回幂等清理函数；重复注册时先移除旧处理器，未授权请求不会激活引擎。
 */
export function registerApplicationKernelRuntimeIpc(
  options: RegisterApplicationKernelRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;
  const channel = APPLICATION_KERNEL_RUNTIME_CHANNELS.invoke;

  /** 执行固定 Kernel 操作；输入事件和不可信命令，返回公开结果；未授权时抛错且不调用 Runtime。 */
  function handleInvoke(event: unknown, request: unknown): Promise<ApplicationKernelCommandResult> {
    authorizeEvent(event);
    return runtime.invoke(request);
  }

  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handleInvoke);

  /** 移除 Kernel Runtime IPC；无输入和返回，可重复调用，不影响其他通道。 */
  function cleanup(): void {
    ipcMain.removeHandler(channel);
  }

  return cleanup;
}
