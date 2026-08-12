import {
  APPLICATION_SYSTEM_RUNTIME_CHANNELS,
  type ApplicationSystemNetworkAddressResult,
  type ApplyApplicationSystemProxyResult,
  type RevealApplicationSystemDirectoryResult,
} from "../contracts/application-system-runtime";
import type { ApplicationSystemRuntimeService } from "../system/application-system-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 Application System Runtime IPC 所需的 Main 依赖。 */
export interface RegisterApplicationSystemRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationSystemRuntimeService, "applyProxy" | "revealDirectory" | "getNetworkAddress">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册 sender-authorized 系统 IPC，并返回删除精确 handlers 的清理函数。 */
export function registerApplicationSystemRuntimeIpc(
  options: RegisterApplicationSystemRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 授权 Renderer 后应用 Main-owned 代理设置。 */
  function handleApplyProxy(event: unknown): Promise<ApplyApplicationSystemProxyResult> {
    authorizeEvent(event);
    return runtime.applyProxy();
  }

  /** 授权 Renderer 后打开一个固定应用目录。 */
  function handleRevealDirectory(
    event: unknown,
    request: unknown,
  ): Promise<RevealApplicationSystemDirectoryResult> {
    authorizeEvent(event);
    return runtime.revealDirectory(request);
  }

  /** 授权 Renderer 后返回 Main 读取的有界 IPv4 地址。 */
  function handleNetworkAddress(event: unknown): ApplicationSystemNetworkAddressResult {
    authorizeEvent(event);
    return runtime.getNetworkAddress();
  }

  ipcMain.removeHandler(APPLICATION_SYSTEM_RUNTIME_CHANNELS.applyProxy);
  ipcMain.handle(APPLICATION_SYSTEM_RUNTIME_CHANNELS.applyProxy, handleApplyProxy);
  ipcMain.removeHandler(APPLICATION_SYSTEM_RUNTIME_CHANNELS.revealDirectory);
  ipcMain.handle(APPLICATION_SYSTEM_RUNTIME_CHANNELS.revealDirectory, handleRevealDirectory);
  ipcMain.removeHandler(APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress);
  ipcMain.handle(APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress, handleNetworkAddress);

  /** 删除本 adapter 注册的全部系统 IPC handlers。 */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_SYSTEM_RUNTIME_CHANNELS.applyProxy);
    ipcMain.removeHandler(APPLICATION_SYSTEM_RUNTIME_CHANNELS.revealDirectory);
    ipcMain.removeHandler(APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress);
  }
  return cleanup;
}
