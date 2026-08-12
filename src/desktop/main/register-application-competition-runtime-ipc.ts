import {
  APPLICATION_COMPETITION_RUNTIME_CHANNELS,
  type ApplicationCompetitionMutationResult,
  type ApplicationCompetitionResourceResult,
  type ApplicationCompetitionSnapshot,
} from "../contracts/application-competition-runtime";
import type { ApplicationCompetitionRuntimeService } from "../competition/application-competition-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 竞赛 Runtime IPC 注册依赖。 */
export interface RegisterApplicationCompetitionRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationCompetitionRuntimeService,
    | "getSnapshot"
    | "resetDemoData"
    | "createIncident"
    | "runInvestigation"
    | "decideApproval"
    | "executeRollback"
    | "verifyRemediation"
    | "readResource"
    | "exportRetrospective"
    | "setAdapterMode"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly resolveActorId: (
    role: "investigator" | "approver" | "operator" | "verifier",
  ) => string;
}

/** 注册竞赛控制面 typed IPC；输入 Runtime 和发送者授权，返回可重复调用的清理函数。 */
export function registerApplicationCompetitionRuntimeIpc(
  options: RegisterApplicationCompetitionRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent, resolveActorId } = options;

  /** 由 Main 覆盖 Renderer 身份；输入未知请求和职责，返回带可信 actorId 的普通对象。 */
  function withTrustedActor(
    request: unknown,
    role: "investigator" | "approver" | "operator" | "verifier",
  ): Readonly<Record<string, unknown>> {
    if (typeof request !== "object" || request === null || Array.isArray(request)) {
      throw new TypeError("Competition IPC request is invalid.");
    }
    return { ...(request as Record<string, unknown>), actorId: resolveActorId(role) };
  }

  /** 读取竞赛快照；输入 IPC 事件，返回本地状态，未授权时不读文件。 */
  function handleGetSnapshot(event: unknown): Promise<ApplicationCompetitionSnapshot> {
    authorizeEvent(event);
    return runtime.getSnapshot();
  }

  /** 重置演示数据；输入 IPC 事件和确认请求，鉴权后仅清理竞赛控制面。 */
  function handleResetDemoData(event: unknown, request: unknown): Promise<ApplicationCompetitionSnapshot> {
    authorizeEvent(event);
    return runtime.resetDemoData(request);
  }

  /** 创建事件；输入 IPC 事件和未知请求，返回变更结果，未授权时不写文件。 */
  function handleCreateIncident(event: unknown, request: unknown): Promise<ApplicationCompetitionMutationResult> {
    authorizeEvent(event);
    return runtime.createIncident(withTrustedActor(request, "investigator"));
  }

  /** 启动跨域取证；输入 IPC 事件和未知请求，返回待审批状态。 */
  function handleRunInvestigation(event: unknown, request: unknown): Promise<ApplicationCompetitionMutationResult> {
    authorizeEvent(event);
    return runtime.runInvestigation(withTrustedActor(request, "investigator"));
  }

  /** 提交人工审批；输入 IPC 事件和未知决策，返回审批状态。 */
  function handleDecideApproval(event: unknown, request: unknown): Promise<ApplicationCompetitionMutationResult> {
    authorizeEvent(event);
    return runtime.decideApproval(withTrustedActor(request, "approver"));
  }

  /** 执行 MLOps 回滚；输入 IPC 事件和治理请求，返回动作及回执。 */
  function handleExecuteRollback(event: unknown, request: unknown): Promise<ApplicationCompetitionMutationResult> {
    authorizeEvent(event);
    return runtime.executeRollback(withTrustedActor(request, "operator"));
  }

  /** 执行独立验证；输入 IPC 事件和动作请求，返回最终事件状态。 */
  function handleVerifyRemediation(event: unknown, request: unknown): Promise<ApplicationCompetitionMutationResult> {
    authorizeEvent(event);
    return runtime.verifyRemediation(withTrustedActor(request, "verifier"));
  }

  /** 读取竞赛 Resource；输入 IPC 事件和 URI，返回有界 JSON 或 Markdown。 */
  function handleReadResource(event: unknown, request: unknown): Promise<ApplicationCompetitionResourceResult> {
    authorizeEvent(event);
    return runtime.readResource(request);
  }

  /** 导出复盘 Skill；输入 IPC 事件和事件 ID，返回输出路径。 */
  function handleExportRetrospective(event: unknown, request: unknown): Promise<ApplicationCompetitionMutationResult> {
    authorizeEvent(event);
    return runtime.exportRetrospective(request);
  }

  /** 切换 Adapter；输入 IPC 事件和模式，返回最新快照。 */
  function handleSetAdapterMode(event: unknown, request: unknown): Promise<ApplicationCompetitionSnapshot> {
    authorizeEvent(event);
    return runtime.setAdapterMode(request);
  }

  const channels = APPLICATION_COMPETITION_RUNTIME_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.getSnapshot, handleGetSnapshot);
  ipcMain.handle(channels.resetDemoData, handleResetDemoData);
  ipcMain.handle(channels.createIncident, handleCreateIncident);
  ipcMain.handle(channels.runInvestigation, handleRunInvestigation);
  ipcMain.handle(channels.decideApproval, handleDecideApproval);
  ipcMain.handle(channels.executeRollback, handleExecuteRollback);
  ipcMain.handle(channels.verifyRemediation, handleVerifyRemediation);
  ipcMain.handle(channels.readResource, handleReadResource);
  ipcMain.handle(channels.exportRetrospective, handleExportRetrospective);
  ipcMain.handle(channels.setAdapterMode, handleSetAdapterMode);

  /** 移除竞赛 Runtime 的全部 IPC；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
