import {
  APPLICATION_DEVELOPER_WORKBENCH_CHANNELS,
  parseApplyDeveloperWorkbenchWorkspaceRequest,
  type ApplyDeveloperWorkbenchMappingResult,
  type ApplyDeveloperWorkbenchWorkspaceResult,
  type DeveloperWorkbenchCodeSearchResult,
  type DeveloperWorkbenchOverview,
  type DeveloperWorkbenchRepositoriesResult,
  type DeveloperWorkbenchSnapshotDocumentResult,
  type DeveloperWorkbenchSnapshotListResult,
  type DeveloperWorkbenchSnapshotMutationResult,
  type DeveloperWorkbenchSnapshotWriteResult,
} from "../contracts/application-developer-workbench-runtime";
import type { ApplicationDeveloperWorkbenchRuntimeService } from "../developer-workbench/application-developer-workbench-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Developer Workbench IPC 注册依赖。 */
export interface RegisterApplicationDeveloperWorkbenchRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationDeveloperWorkbenchRuntimeService,
    | "getOverview"
    | "listRepositories"
    | "searchCode"
    | "listSnapshots"
    | "createSnapshot"
    | "importSnapshot"
    | "getSnapshot"
    | "restoreSnapshot"
    | "deleteSnapshot"
    | "applyWorkspace"
    | "applyMapping"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly authorizeWorkspacePath: (event: unknown, workspaceDirectory: string) => void;
}

/** 注册 Developer Workbench typed IPC；输入 Runtime 和授权依赖，返回清理函数，重复注册时先移除旧处理器。 */
export function registerApplicationDeveloperWorkbenchRuntimeIpc(
  options: RegisterApplicationDeveloperWorkbenchRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent, authorizeWorkspacePath } = options;

  /** 读取工作台概览；输入 IPC 事件，返回无密钥概览，发送者未授权时抛错。 */
  function handleOverview(event: unknown): Promise<DeveloperWorkbenchOverview> {
    authorizeEvent(event);
    return runtime.getOverview();
  }

  /** 扫描 Main 设置中的仓库；输入 IPC 事件，返回有界摘要，发送者未授权时抛错。 */
  function handleRepositories(event: unknown): Promise<DeveloperWorkbenchRepositoriesResult> {
    authorizeEvent(event);
    return runtime.listRepositories();
  }

  /** 搜索 Main 设置中的代码；输入 IPC 事件和精确查询，返回相对路径命中，非法请求在扫描前抛错。 */
  function handleSearchCode(event: unknown, request: unknown): Promise<DeveloperWorkbenchCodeSearchResult> {
    authorizeEvent(event);
    return runtime.searchCode(request);
  }

  /** 列出本地快照；输入 IPC 事件，返回有界摘要，发送者未授权时抛错。 */
  function handleListSnapshots(event: unknown): Promise<DeveloperWorkbenchSnapshotListResult> {
    authorizeEvent(event);
    return runtime.listSnapshots();
  }

  /** 创建本地快照；输入 IPC 事件和包含范围，返回摘要，非法字段或状态超限时抛错。 */
  function handleCreateSnapshot(event: unknown, request: unknown): Promise<DeveloperWorkbenchSnapshotWriteResult> {
    authorizeEvent(event);
    return runtime.createSnapshot(request);
  }

  /** 导入无密钥快照；输入 IPC 事件和 JSON 文档，返回摘要，凭据或超限内容在写盘前抛错。 */
  function handleImportSnapshot(event: unknown, request: unknown): Promise<DeveloperWorkbenchSnapshotWriteResult> {
    authorizeEvent(event);
    return runtime.importSnapshot(request);
  }

  /** 读取快照文档；输入 IPC 事件和 ID，返回 JSON，缺失、损坏或未授权时抛错。 */
  function handleGetSnapshot(event: unknown, request: unknown): Promise<DeveloperWorkbenchSnapshotDocumentResult> {
    authorizeEvent(event);
    return runtime.getSnapshot(request);
  }

  /** 恢复快照；输入 IPC 事件和 ID，返回恢复 ID，状态写入失败或未授权时抛错。 */
  function handleRestoreSnapshot(event: unknown, request: unknown): Promise<DeveloperWorkbenchSnapshotMutationResult> {
    authorizeEvent(event);
    return runtime.restoreSnapshot(request);
  }

  /** 删除快照；输入 IPC 事件和 ID，返回删除 ID，缺失或未授权时抛错。 */
  function handleDeleteSnapshot(event: unknown, request: unknown): Promise<DeveloperWorkbenchSnapshotMutationResult> {
    authorizeEvent(event);
    return runtime.deleteSnapshot(request);
  }

  /** 应用工作区；输入 IPC 事件和精确配置，先校验发送者与 Main 目录授权，再返回规范配置。 */
  function handleApplyWorkspace(event: unknown, request: unknown): Promise<ApplyDeveloperWorkbenchWorkspaceResult> {
    authorizeEvent(event);
    const parsed = parseApplyDeveloperWorkbenchWorkspaceRequest(request);
    authorizeWorkspacePath(event, parsed.workspaceDirectory);
    return runtime.applyWorkspace(parsed);
  }

  /** 应用 Agent 映射；输入 IPC 事件和精确 ID，返回模型映射，未知 Agent 或未授权时抛错。 */
  function handleApplyMapping(event: unknown, request: unknown): Promise<ApplyDeveloperWorkbenchMappingResult> {
    authorizeEvent(event);
    return runtime.applyMapping(request);
  }

  const channels = APPLICATION_DEVELOPER_WORKBENCH_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.overview, handleOverview);
  ipcMain.handle(channels.repositories, handleRepositories);
  ipcMain.handle(channels.searchCode, handleSearchCode);
  ipcMain.handle(channels.listSnapshots, handleListSnapshots);
  ipcMain.handle(channels.createSnapshot, handleCreateSnapshot);
  ipcMain.handle(channels.importSnapshot, handleImportSnapshot);
  ipcMain.handle(channels.getSnapshot, handleGetSnapshot);
  ipcMain.handle(channels.restoreSnapshot, handleRestoreSnapshot);
  ipcMain.handle(channels.deleteSnapshot, handleDeleteSnapshot);
  ipcMain.handle(channels.applyWorkspace, handleApplyWorkspace);
  ipcMain.handle(channels.applyMapping, handleApplyMapping);

  /** 移除本适配器注册的全部 IPC 处理器；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
