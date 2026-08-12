import {
  APPLICATION_TASK_CHANNELS,
  type ApplicationTask,
  type ApplicationTaskDetail,
  type ApplicationTaskSnapshot,
} from "../contracts/application-tasks";
import type { ApplicationTaskService } from "../storage/application-tasks";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose durable tasks through Electron IPC. */
export interface RegisterApplicationTasksIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly tasks: Pick<
    ApplicationTaskService,
    "listTasks" | "getTask" | "createTask"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized Desktop Core durable-task IPC boundary. */
export function registerApplicationTasksIpc(
  options: RegisterApplicationTasksIpcOptions,
): () => void {
  const { ipcMain, tasks, authorizeEvent } = options;

  /** List durable tasks for an authorized Renderer. */
  function handleList(event: unknown, request: unknown): Promise<ApplicationTaskSnapshot> {
    authorizeEvent(event);
    return tasks.listTasks(request);
  }

  /** Return one durable task and its Core event history. */
  function handleGet(event: unknown, request: unknown): Promise<ApplicationTaskDetail> {
    authorizeEvent(event);
    return tasks.getTask(request);
  }

  /** Persist one task before dispatching it to a compatibility executor. */
  function handleCreate(event: unknown, request: unknown): Promise<ApplicationTask> {
    authorizeEvent(event);
    return tasks.createTask(request);
  }

  ipcMain.removeHandler(APPLICATION_TASK_CHANNELS.list);
  ipcMain.removeHandler(APPLICATION_TASK_CHANNELS.get);
  ipcMain.removeHandler(APPLICATION_TASK_CHANNELS.create);
  ipcMain.handle(APPLICATION_TASK_CHANNELS.list, handleList);
  ipcMain.handle(APPLICATION_TASK_CHANNELS.get, handleGet);
  ipcMain.handle(APPLICATION_TASK_CHANNELS.create, handleCreate);

  /** Remove every durable-task IPC handler registered by this adapter. */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_TASK_CHANNELS.list);
    ipcMain.removeHandler(APPLICATION_TASK_CHANNELS.get);
    ipcMain.removeHandler(APPLICATION_TASK_CHANNELS.create);
  }
  return cleanup;
}
