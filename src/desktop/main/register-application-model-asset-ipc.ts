import {
  APPLICATION_MODEL_ASSET_CHANNELS,
  type ApplicationModelAssetProgressEvent,
  type ApplicationModelAssetStatus,
} from "../contracts/application-model-assets";
import type { ApplicationModelAssetRuntimeService } from "../model-assets/application-model-asset-runtime";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

/** Model Asset Runtime IPC 注册依赖。 */
export interface RegisterApplicationModelAssetIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationModelAssetRuntimeService, "getStatus" | "download" | "remove" | "subscribe">;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWebContents: () => readonly WebContentsLike[];
}

/**
 * 注册 Model Asset typed IPC；输入 Runtime、发送者授权器和窗口枚举器，返回幂等清理函数；未授权请求不会访问磁盘或网络。
 */
export function registerApplicationModelAssetIpc(options: RegisterApplicationModelAssetIpcOptions): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 读取模型状态；输入事件和请求，返回无路径摘要；未授权时不访问磁盘。 */
  function handleGetStatus(event: unknown, request: unknown): Promise<ApplicationModelAssetStatus> {
    authorizeEvent(event);
    return runtime.getStatus(request);
  }

  /** 下载固定模型；输入事件和请求，返回安装状态；未授权或参数非法时不访问网络。 */
  function handleDownload(event: unknown, request: unknown): Promise<ApplicationModelAssetStatus> {
    authorizeEvent(event);
    return runtime.download(request);
  }

  /** 删除固定模型；输入事件和请求，返回未安装状态；未授权时不停止 Worker 或修改文件。 */
  function handleRemove(event: unknown, request: unknown): Promise<ApplicationModelAssetStatus> {
    authorizeEvent(event);
    return runtime.remove(request);
  }

  const requestChannels = [
    APPLICATION_MODEL_ASSET_CHANNELS.getStatus,
    APPLICATION_MODEL_ASSET_CHANNELS.download,
    APPLICATION_MODEL_ASSET_CHANNELS.remove,
  ];
  for (const channel of requestChannels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_MODEL_ASSET_CHANNELS.getStatus, handleGetStatus);
  ipcMain.handle(APPLICATION_MODEL_ASSET_CHANNELS.download, handleDownload);
  ipcMain.handle(APPLICATION_MODEL_ASSET_CHANNELS.remove, handleRemove);

  const unsubscribe = runtime.subscribe((progress: ApplicationModelAssetProgressEvent) => {
    for (const webContents of options.getWebContents()) {
      if (!webContents.isDestroyed()) webContents.send(APPLICATION_MODEL_ASSET_CHANNELS.progress, progress);
    }
  });

  /** 移除 Model Asset handlers 和进度订阅；无输入和返回，可重复调用，不影响其他 IPC。 */
  function cleanup(): void {
    unsubscribe();
    for (const channel of requestChannels) ipcMain.removeHandler(channel);
  }

  return cleanup;
}
