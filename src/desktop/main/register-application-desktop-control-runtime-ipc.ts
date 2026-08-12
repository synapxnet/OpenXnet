import { APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS } from "../contracts/application-desktop-control-runtime";
import type { ApplicationDesktopControlRuntimeService } from "../desktop-control/application-desktop-control-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 Desktop Control Runtime IPC 所需依赖。 */
export interface RegisterApplicationDesktopControlRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationDesktopControlRuntimeService,
    "listWindows" | "listMonitors" | "getActiveWindow" | "listHistory" | "executeAction"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册五条授权窗口控制命令；输入 IPC、Runtime 和鉴权器，返回可重复清理函数。 */
export function registerApplicationDesktopControlRuntimeIpc(
  options: RegisterApplicationDesktopControlRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 列出窗口；输入事件和筛选请求，返回脱敏列表，鉴权失败时不调用 Runtime。 */
  function handleListWindows(event: unknown, request: unknown): ReturnType<typeof runtime.listWindows> {
    authorizeEvent(event);
    return runtime.listWindows(request);
  }

  /** 列出显示器；输入事件，返回脱敏列表，鉴权失败时不调用 Runtime。 */
  function handleListMonitors(event: unknown): ReturnType<typeof runtime.listMonitors> {
    authorizeEvent(event);
    return runtime.listMonitors();
  }

  /** 读取活动窗口；输入事件，返回脱敏状态，鉴权失败时不调用 Runtime。 */
  function handleGetActiveWindow(event: unknown): ReturnType<typeof runtime.getActiveWindow> {
    authorizeEvent(event);
    return runtime.getActiveWindow();
  }

  /** 列出动作历史；输入事件和数量请求，返回有界历史，鉴权失败时不调用 Runtime。 */
  function handleListHistory(event: unknown, request: unknown): ReturnType<typeof runtime.listHistory> {
    authorizeEvent(event);
    return runtime.listHistory(request);
  }

  /** 执行窗口动作；输入事件和精确请求，返回动作结果，鉴权失败时不调用 Runtime。 */
  function handleExecuteAction(event: unknown, request: unknown): ReturnType<typeof runtime.executeAction> {
    authorizeEvent(event);
    return runtime.executeAction(request);
  }

  const channels = Object.values(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listWindows, handleListWindows);
  ipcMain.handle(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listMonitors, handleListMonitors);
  ipcMain.handle(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.getActiveWindow, handleGetActiveWindow);
  ipcMain.handle(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listHistory, handleListHistory);
  ipcMain.handle(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.executeAction, handleExecuteAction);

  /** 清理全部 Desktop Control handler；无输入和返回，可重复执行。 */
  return function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
