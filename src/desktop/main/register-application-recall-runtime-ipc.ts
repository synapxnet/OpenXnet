import { APPLICATION_RECALL_RUNTIME_CHANNELS } from "../contracts/application-recall-runtime";
import type { ApplicationRecallRuntimeService } from "../recall/application-recall-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 Recall Runtime IPC 所需依赖。 */
export interface RegisterApplicationRecallRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationRecallRuntimeService,
    "bootstrap" | "search" | "timeline" | "observations" | "resume" | "rollback" | "publishObservationFocus"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册七条授权 Recall 命令；输入 IPC、Runtime 和鉴权器，返回可重复清理函数。 */
export function registerApplicationRecallRuntimeIpc(
  options: RegisterApplicationRecallRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 读取首屏；输入事件，返回聚合结果，鉴权失败时不激活 Worker。 */
  function handleBootstrap(event: unknown): ReturnType<typeof runtime.bootstrap> {
    authorizeEvent(event);
    return runtime.bootstrap();
  }

  /** 搜索记忆；输入事件和精确请求，返回有界结果，鉴权失败时不激活 Worker。 */
  function handleSearch(event: unknown, request: unknown): ReturnType<typeof runtime.search> {
    authorizeEvent(event);
    return runtime.search(request);
  }

  /** 读取时间线；输入事件和精确请求，返回有界结果，鉴权失败时不激活 Worker。 */
  function handleTimeline(event: unknown, request: unknown): ReturnType<typeof runtime.timeline> {
    authorizeEvent(event);
    return runtime.timeline(request);
  }

  /** 读取观察流；输入事件和精确请求，返回有界结果，鉴权失败时不激活 Worker。 */
  function handleObservations(event: unknown, request: unknown): ReturnType<typeof runtime.observations> {
    authorizeEvent(event);
    return runtime.observations(request);
  }

  /** 恢复中断 turn；输入事件和精确请求，返回恢复提示，鉴权失败时不激活 Worker。 */
  function handleResume(event: unknown, request: unknown): ReturnType<typeof runtime.resume> {
    authorizeEvent(event);
    return runtime.resume(request);
  }

  /** 恢复检查点；输入事件和精确请求，返回固定结果，鉴权失败时不激活 Worker。 */
  function handleRollback(event: unknown, request: unknown): ReturnType<typeof runtime.rollback> {
    authorizeEvent(event);
    return runtime.rollback(request);
  }

  /** 发布观察焦点；输入事件和有界展示请求，返回投递数量，不激活 Python。 */
  function handlePublishObservationFocus(
    event: unknown,
    request: unknown,
  ): ReturnType<typeof runtime.publishObservationFocus> {
    authorizeEvent(event);
    return runtime.publishObservationFocus(request);
  }

  const handlerChannels = [
    APPLICATION_RECALL_RUNTIME_CHANNELS.bootstrap,
    APPLICATION_RECALL_RUNTIME_CHANNELS.search,
    APPLICATION_RECALL_RUNTIME_CHANNELS.timeline,
    APPLICATION_RECALL_RUNTIME_CHANNELS.observations,
    APPLICATION_RECALL_RUNTIME_CHANNELS.resume,
    APPLICATION_RECALL_RUNTIME_CHANNELS.rollback,
    APPLICATION_RECALL_RUNTIME_CHANNELS.publishObservationFocus,
  ];
  for (const channel of handlerChannels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.bootstrap, handleBootstrap);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.search, handleSearch);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.timeline, handleTimeline);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.observations, handleObservations);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.resume, handleResume);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.rollback, handleRollback);
  ipcMain.handle(APPLICATION_RECALL_RUNTIME_CHANNELS.publishObservationFocus, handlePublishObservationFocus);

  /** 清理全部 Recall handler；无输入和返回，可重复执行。 */
  return function cleanup(): void {
    for (const channel of handlerChannels) ipcMain.removeHandler(channel);
  };
}
