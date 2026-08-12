import {
  APPLICATION_EXTENSION_RUNTIME_CHANNELS,
  type ApplicationExtensionCatalog,
  type ApplicationExtensionMutationResult,
  type ApplicationExtensionStartResult,
  type ApplicationExtensionWriteResult,
  type ApplicationRemoteExtensionCatalog,
} from "../contracts/application-extensions-runtime";
import type { ApplicationExtensionRuntimeService } from "../extensions/application-extension-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Extension Runtime IPC 注册依赖。 */
export interface RegisterApplicationExtensionRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationExtensionRuntimeService,
    | "listExtensions"
    | "listRemoteExtensions"
    | "installFromRepository"
    | "importArchive"
    | "updateExtension"
    | "removeExtension"
    | "startExtension"
    | "stopExtension"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册 Extension Runtime typed IPC；输入 Runtime 和发送者授权，返回清理函数，重复注册时先移除旧处理器。 */
export function registerApplicationExtensionRuntimeIpc(
  options: RegisterApplicationExtensionRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 列出扩展；输入 IPC 事件，返回本机目录，发送者未授权时不扫描磁盘。 */
  function handleList(event: unknown): Promise<ApplicationExtensionCatalog> {
    authorizeEvent(event);
    return runtime.listExtensions();
  }

  /** 列出固定远程扩展；输入 IPC 事件，返回目录，发送者未授权时不访问网络。 */
  function handleListRemote(event: unknown): Promise<ApplicationRemoteExtensionCatalog> {
    authorizeEvent(event);
    return runtime.listRemoteExtensions();
  }

  /** 从仓库安装扩展；输入 IPC 事件和固定仓库请求，返回安装结果，未授权或非法时下载前抛错。 */
  function handleInstallRepository(event: unknown, request: unknown): Promise<ApplicationExtensionWriteResult> {
    authorizeEvent(event);
    return runtime.installFromRepository(request);
  }

  /** 导入本机扩展 ZIP；输入 IPC 事件和 preload 文件项，返回安装结果，未授权或超限时写盘前抛错。 */
  function handleImportArchive(event: unknown, request: unknown): Promise<ApplicationExtensionWriteResult> {
    authorizeEvent(event);
    return runtime.importArchive(request);
  }

  /** 更新扩展；输入 IPC 事件和稳定 ID，返回更新结果，未授权或仓库非法时不替换目录。 */
  function handleUpdate(event: unknown, request: unknown): Promise<ApplicationExtensionWriteResult> {
    authorizeEvent(event);
    return runtime.updateExtension(request);
  }

  /** 删除扩展；输入 IPC 事件和稳定 ID，返回删除结果，未授权时不停止进程或删除文件。 */
  function handleRemove(event: unknown, request: unknown): Promise<ApplicationExtensionMutationResult> {
    authorizeEvent(event);
    return runtime.removeExtension(request);
  }

  /** 启动扩展；输入 IPC 事件和稳定 ID，返回隔离 URL，未授权时不启动 Gateway 或子进程。 */
  function handleStart(event: unknown, request: unknown): Promise<ApplicationExtensionStartResult> {
    authorizeEvent(event);
    return runtime.startExtension(request);
  }

  /** 停止扩展；输入 IPC 事件和稳定 ID，返回停止结果，未授权时不触碰子进程。 */
  function handleStop(event: unknown, request: unknown): Promise<ApplicationExtensionMutationResult> {
    authorizeEvent(event);
    return runtime.stopExtension(request);
  }

  const channels = APPLICATION_EXTENSION_RUNTIME_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.list, handleList);
  ipcMain.handle(channels.listRemote, handleListRemote);
  ipcMain.handle(channels.installRepository, handleInstallRepository);
  ipcMain.handle(channels.importArchive, handleImportArchive);
  ipcMain.handle(channels.update, handleUpdate);
  ipcMain.handle(channels.remove, handleRemove);
  ipcMain.handle(channels.start, handleStart);
  ipcMain.handle(channels.stop, handleStop);

  /** 移除本适配器注册的全部 Extension IPC；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
