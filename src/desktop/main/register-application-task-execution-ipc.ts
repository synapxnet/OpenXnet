import {
  APPLICATION_TASK_EXECUTION_CHANNELS,
  type ApplicationTaskExecutionDetail,
  type ApplicationTaskExecutionSnapshot,
} from "../contracts/application-task-execution";
import type { ApplicationTask, ApplicationTaskSnapshot } from "../contracts/application-tasks";
import type { ApplicationTaskExecutionService } from "../tasks/application-task-execution";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

/** Dependencies required to expose Core-owned task execution through Electron IPC. */
export interface RegisterApplicationTaskExecutionIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly execution: Pick<
    ApplicationTaskExecutionService,
    | "refreshExecutions"
    | "getExecution"
    | "createWorkbenchExecution"
    | "dispatchExecution"
    | "startExecution"
    | "resumeExecution"
    | "cancelExecution"
    | "deleteExecution"
    | "subscribe"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWebContents: () => readonly WebContentsLike[];
}

/** Register authorized task-execution requests and Core snapshot broadcasts. */
export function registerApplicationTaskExecutionIpc(
  options: RegisterApplicationTaskExecutionIpcOptions,
): () => void {
  const { ipcMain, execution, authorizeEvent } = options;

  /** Refresh executor mirrors for one authorized Renderer. */
  function handleRefresh(event: unknown, request: unknown): Promise<ApplicationTaskExecutionSnapshot> {
    authorizeEvent(event);
    return execution.refreshExecutions(request);
  }

  /** Retrieve one current execution detail for an authorized Renderer. */
  function handleGet(event: unknown, request: unknown): Promise<ApplicationTaskExecutionDetail> {
    authorizeEvent(event);
    return execution.getExecution(request);
  }

  /** Create one standardized developer-workbench task for an authorized Renderer. */
  function handleCreateWorkbench(event: unknown, request: unknown): Promise<ApplicationTask> {
    authorizeEvent(event);
    return execution.createWorkbenchExecution(request);
  }

  /** Dispatch one persisted Core task to the supervised executor. */
  function handleDispatch(event: unknown, request: unknown): Promise<ApplicationTask> {
    authorizeEvent(event);
    return execution.dispatchExecution(request);
  }

  /** Start one pending task through the supervised executor. */
  function handleStart(event: unknown, request: unknown): Promise<ApplicationTask> {
    authorizeEvent(event);
    return execution.startExecution(request);
  }

  /** Resume one terminal task through the supervised executor. */
  function handleResume(event: unknown, request: unknown): Promise<ApplicationTask> {
    authorizeEvent(event);
    return execution.resumeExecution(request);
  }

  /** Commit task cancellation through the Core coordinator. */
  function handleCancel(event: unknown, request: unknown): Promise<ApplicationTask> {
    authorizeEvent(event);
    return execution.cancelExecution(request);
  }

  /** Tombstone a task and remove its compatibility execution mirror. */
  function handleDelete(event: unknown, request: unknown): Promise<ApplicationTaskSnapshot> {
    authorizeEvent(event);
    return execution.deleteExecution(request);
  }

  const requestChannels = [
    APPLICATION_TASK_EXECUTION_CHANNELS.refresh,
    APPLICATION_TASK_EXECUTION_CHANNELS.get,
    APPLICATION_TASK_EXECUTION_CHANNELS.createWorkbench,
    APPLICATION_TASK_EXECUTION_CHANNELS.dispatch,
    APPLICATION_TASK_EXECUTION_CHANNELS.start,
    APPLICATION_TASK_EXECUTION_CHANNELS.resume,
    APPLICATION_TASK_EXECUTION_CHANNELS.cancel,
    APPLICATION_TASK_EXECUTION_CHANNELS.delete,
  ];
  for (const channel of requestChannels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.refresh, handleRefresh);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.get, handleGet);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.createWorkbench, handleCreateWorkbench);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.dispatch, handleDispatch);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.start, handleStart);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.resume, handleResume);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.cancel, handleCancel);
  ipcMain.handle(APPLICATION_TASK_EXECUTION_CHANNELS.delete, handleDelete);

  const unsubscribe = execution.subscribe((snapshot) => {
    for (const webContents of options.getWebContents()) {
      if (!webContents.isDestroyed()) {
        webContents.send(APPLICATION_TASK_EXECUTION_CHANNELS.changed, snapshot);
      }
    }
  });

  /** Remove every task-execution handler and snapshot subscription. */
  function cleanup(): void {
    unsubscribe();
    for (const channel of requestChannels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
