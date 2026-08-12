import {
  APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS,
  type ApplicationKnowledgeBaseMutationResult,
  type ApplicationKnowledgeBaseQueryResult,
  type ApplicationKnowledgeBaseStatus,
} from "../contracts/application-knowledge-base-runtime";
import type { ApplicationKnowledgeBaseRuntimeService } from "../knowledge/application-knowledge-base-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册知识库 IPC 所需依赖。 */
export interface RegisterApplicationKnowledgeBaseRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationKnowledgeBaseRuntimeService, "build" | "status" | "remove" | "query">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册四条授权知识库命令；输入 IPC、Runtime 和鉴权器，返回清理函数。 */
export function registerApplicationKnowledgeBaseRuntimeIpc(
  options: RegisterApplicationKnowledgeBaseRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 执行授权构建；输入事件和请求，返回最终状态，鉴权失败时不调用 Runtime。 */
  function handleBuild(event: unknown, request: unknown): Promise<ApplicationKnowledgeBaseStatus> {
    authorizeEvent(event);
    return runtime.build(request);
  }

  /** 执行授权状态读取；输入事件和请求，返回稳定状态。 */
  function handleStatus(event: unknown, request: unknown): Promise<ApplicationKnowledgeBaseStatus> {
    authorizeEvent(event);
    return runtime.status(request);
  }

  /** 执行授权删除；输入事件和请求，返回删除结果。 */
  function handleRemove(event: unknown, request: unknown): Promise<ApplicationKnowledgeBaseMutationResult> {
    authorizeEvent(event);
    return runtime.remove(request);
  }

  /** 执行授权检索；输入事件和请求，返回有界脱敏结果。 */
  function handleQuery(event: unknown, request: unknown): Promise<ApplicationKnowledgeBaseQueryResult> {
    authorizeEvent(event);
    return runtime.query(request);
  }

  const channels = Object.values(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.build, handleBuild);
  ipcMain.handle(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.status, handleStatus);
  ipcMain.handle(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.remove, handleRemove);
  ipcMain.handle(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.query, handleQuery);

  /** 清理全部知识库 handler；无输入和返回，可重复执行。 */
  return function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
