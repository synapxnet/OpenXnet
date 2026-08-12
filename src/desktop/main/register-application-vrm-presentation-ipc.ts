import {
  APPLICATION_VRM_PRESENTATION_CHANNELS,
  type ApplicationVrmPresentationConfiguration,
  type ApplicationVrmPresentationPublishResult,
  type ApplicationVrmPresentationStatus,
} from "../contracts/application-vrm-presentation-runtime";
import type { ApplicationVrmPresentationRuntimeService } from "../vrm/application-vrm-presentation-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 VRM Presentation IPC 所需的 Main 依赖。 */
export interface RegisterApplicationVrmPresentationIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationVrmPresentationRuntimeService, "getStatus" | "publish" | "getConfiguration">;
  readonly authorizeEvent: (event: unknown) => void;
  readonly authorizeVrmEvent: (event: unknown) => void;
}

/** 注册 sender-authorized VRM 状态和事件发布 IPC，并返回精确清理函数。 */
export function registerApplicationVrmPresentationIpc(
  options: RegisterApplicationVrmPresentationIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 授权主 Renderer 后返回当前 VRM 窗口数量，不启动任何后端。 */
  function handleStatus(event: unknown): ApplicationVrmPresentationStatus {
    authorizeEvent(event);
    return runtime.getStatus();
  }

  /** 授权主 Renderer 后校验并广播一条有界展示事件。 */
  function handlePublish(event: unknown, request: unknown): ApplicationVrmPresentationPublishResult {
    authorizeEvent(event);
    return runtime.publish(request);
  }

  /** 授权 VRM 窗口后返回 Main 组合的语言和公开资产配置。 */
  async function handleConfiguration(event: unknown): Promise<ApplicationVrmPresentationConfiguration> {
    options.authorizeVrmEvent(event);
    return runtime.getConfiguration();
  }

  ipcMain.removeHandler(APPLICATION_VRM_PRESENTATION_CHANNELS.status);
  ipcMain.handle(APPLICATION_VRM_PRESENTATION_CHANNELS.status, handleStatus);
  ipcMain.removeHandler(APPLICATION_VRM_PRESENTATION_CHANNELS.publish);
  ipcMain.handle(APPLICATION_VRM_PRESENTATION_CHANNELS.publish, handlePublish);
  ipcMain.removeHandler(APPLICATION_VRM_PRESENTATION_CHANNELS.configuration);
  ipcMain.handle(APPLICATION_VRM_PRESENTATION_CHANNELS.configuration, handleConfiguration);

  /** 删除本 adapter 注册的精确 IPC handlers。 */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_VRM_PRESENTATION_CHANNELS.status);
    ipcMain.removeHandler(APPLICATION_VRM_PRESENTATION_CHANNELS.publish);
    ipcMain.removeHandler(APPLICATION_VRM_PRESENTATION_CHANNELS.configuration);
  }
  return cleanup;
}
