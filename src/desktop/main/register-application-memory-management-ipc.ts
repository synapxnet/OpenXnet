import {
  APPLICATION_MEMORY_MANAGEMENT_CHANNELS,
  type ApplicationMemoryMutationResult,
  type ApplicationMemoryRecordListResult,
} from "../contracts/application-memory-management-runtime";
import type { ApplicationMemoryManagementRuntimeService } from "../memory-management/application-memory-management-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Memory 管理 IPC 注册依赖。 */
export interface RegisterApplicationMemoryManagementIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationMemoryManagementRuntimeService,
    "listRecords" | "updateRecord" | "deleteRecord" | "removeCollection"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册四条 sender-authorized Memory 管理 IPC；输入依赖，输出可重复清理函数。 */
export function registerApplicationMemoryManagementIpc(
  options: RegisterApplicationMemoryManagementIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 列出记录；输入事件和未知请求，输出列表，未授权发送者先失败。 */
  function handleList(event: unknown, request: unknown): Promise<ApplicationMemoryRecordListResult> {
    authorizeEvent(event);
    return runtime.listRecords(request);
  }

  /** 更新记录；输入事件和未知请求，输出变更结果，未授权发送者先失败。 */
  function handleUpdate(event: unknown, request: unknown): Promise<ApplicationMemoryMutationResult> {
    authorizeEvent(event);
    return runtime.updateRecord(request);
  }

  /** 删除记录；输入事件和未知请求，输出变更结果，未授权发送者先失败。 */
  function handleDelete(event: unknown, request: unknown): Promise<ApplicationMemoryMutationResult> {
    authorizeEvent(event);
    return runtime.deleteRecord(request);
  }

  /** 删除集合；输入事件和未知请求，输出变更结果，未授权发送者先失败。 */
  function handleRemove(event: unknown, request: unknown): Promise<ApplicationMemoryMutationResult> {
    authorizeEvent(event);
    return runtime.removeCollection(request);
  }

  const channels = Object.values(APPLICATION_MEMORY_MANAGEMENT_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.listRecords, handleList);
  ipcMain.handle(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.updateRecord, handleUpdate);
  ipcMain.handle(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.deleteRecord, handleDelete);
  ipcMain.handle(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.removeCollection, handleRemove);

  /** 清理全部 Memory 管理 handler；无输入和返回，可重复调用。 */
  return function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
