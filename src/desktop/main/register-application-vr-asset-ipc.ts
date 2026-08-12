import {
  APPLICATION_VR_ASSET_CHANNELS,
  type ApplicationVrAssetCatalog,
  type ApplicationVrAssetDeleteResult,
  type ApplicationVrAssetWriteResult,
} from "../contracts/application-vr-assets";
import type { ApplicationVrAssetRuntimeService } from "../vr-assets/application-vr-asset-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** VR Asset IPC 注册依赖。 */
export interface RegisterApplicationVrAssetIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationVrAssetRuntimeService,
    "listAssets" | "importAsset" | "deleteAsset" | "downloadCloudModel"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册 VR Asset typed IPC；输入 Runtime 和发送者授权，返回清理函数，重复注册时先移除旧处理器。 */
export function registerApplicationVrAssetIpc(options: RegisterApplicationVrAssetIpcOptions): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 列出 VR 资产；输入 IPC 事件，返回完整目录，发送者未授权时抛错且不扫描磁盘。 */
  function handleList(event: unknown): Promise<ApplicationVrAssetCatalog> {
    authorizeEvent(event);
    return runtime.listAssets();
  }

  /** 导入 VR 资产；输入 IPC 事件和 preload 文件项，返回用户资产，未授权或请求非法时写盘前抛错。 */
  function handleImport(event: unknown, request: unknown): Promise<ApplicationVrAssetWriteResult> {
    authorizeEvent(event);
    return runtime.importAsset(request);
  }

  /** 删除 VR 资产；输入 IPC 事件、类型和稳定 ID，返回删除结果，未授权或内置资产请求时抛错。 */
  function handleDelete(event: unknown, request: unknown): Promise<ApplicationVrAssetDeleteResult> {
    authorizeEvent(event);
    return runtime.deleteAsset(request);
  }

  /** 下载固定云 VRM；输入 IPC 事件和目录 ID，返回用户资产，未授权或未知 ID 时不访问网络。 */
  function handleDownload(event: unknown, request: unknown): Promise<ApplicationVrAssetWriteResult> {
    authorizeEvent(event);
    return runtime.downloadCloudModel(request);
  }

  const channels = APPLICATION_VR_ASSET_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.list, handleList);
  ipcMain.handle(channels.importAsset, handleImport);
  ipcMain.handle(channels.deleteAsset, handleDelete);
  ipcMain.handle(channels.downloadCloudModel, handleDownload);

  /** 移除本适配器注册的全部 IPC 处理器；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
