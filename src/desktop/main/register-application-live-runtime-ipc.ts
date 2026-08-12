import { APPLICATION_LIVE_RUNTIME_CHANNELS } from "../contracts/application-live-runtime";
import type { ApplicationLiveRuntimeService } from "../live/application-live-runtime";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

/** 注册 Live Runtime IPC 所需依赖。 */
export interface RegisterApplicationLiveRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationLiveRuntimeService,
    "status" | "start" | "stop" | "reload" | "subscribe"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWebContents: () => readonly WebContentsLike[];
}

/** 注册授权生命周期处理器和事件广播；输入依赖，返回清理函数，注册前移除旧处理器。 */
export function registerApplicationLiveRuntimeIpc(
  options: RegisterApplicationLiveRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 查询状态；输入 Electron 事件，返回公开结果，未授权时抛出异常。 */
  function handleStatus(event: unknown): ReturnType<ApplicationLiveRuntimeService["status"]> {
    authorizeEvent(event);
    return runtime.status();
  }

  /** 启动直播；输入 Electron 事件和请求，返回公开结果，未授权或请求无效时抛出异常。 */
  function handleStart(
    event: unknown,
    request: unknown,
  ): ReturnType<ApplicationLiveRuntimeService["start"]> {
    authorizeEvent(event);
    return runtime.start(request);
  }

  /** 停止直播；输入 Electron 事件，返回公开结果，未授权时抛出异常。 */
  function handleStop(event: unknown): ReturnType<ApplicationLiveRuntimeService["stop"]> {
    authorizeEvent(event);
    return runtime.stop();
  }

  /** 重载直播；输入 Electron 事件和请求，返回公开结果，未授权或请求无效时抛出异常。 */
  function handleReload(
    event: unknown,
    request: unknown,
  ): ReturnType<ApplicationLiveRuntimeService["reload"]> {
    authorizeEvent(event);
    return runtime.reload(request);
  }

  const requestChannels = [
    APPLICATION_LIVE_RUNTIME_CHANNELS.status,
    APPLICATION_LIVE_RUNTIME_CHANNELS.start,
    APPLICATION_LIVE_RUNTIME_CHANNELS.stop,
    APPLICATION_LIVE_RUNTIME_CHANNELS.reload,
  ];
  for (const channel of requestChannels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_LIVE_RUNTIME_CHANNELS.status, handleStatus);
  ipcMain.handle(APPLICATION_LIVE_RUNTIME_CHANNELS.start, handleStart);
  ipcMain.handle(APPLICATION_LIVE_RUNTIME_CHANNELS.stop, handleStop);
  ipcMain.handle(APPLICATION_LIVE_RUNTIME_CHANNELS.reload, handleReload);

  const unsubscribe = runtime.subscribe((liveEvent) => {
    for (const webContents of options.getWebContents()) {
      if (!webContents.isDestroyed()) {
        webContents.send(APPLICATION_LIVE_RUNTIME_CHANNELS.event, liveEvent);
      }
    }
  });

  /** 移除全部处理器和事件订阅；无输入和返回值，可在应用退出时调用。 */
  function cleanup(): void {
    unsubscribe();
    for (const channel of requestChannels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
