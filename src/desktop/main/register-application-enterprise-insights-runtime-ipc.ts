import {
  APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS,
  type ApplicationEnterpriseKnowledgeGraphEntityResult,
  type ApplicationEnterpriseKnowledgeGraphResult,
  type ApplicationEnterpriseNeuroDashboardResult,
  type ApplicationEnterpriseNeuroMaintenanceResult,
  type ApplicationEnterpriseNeuroRemoveResult,
  type ApplicationEnterpriseNeuroSearchResult,
  type ApplicationEnterpriseUsageDashboardResult,
} from "../contracts/application-enterprise-insights-runtime";
import type { ApplicationEnterpriseInsightsRuntimeService } from "../enterprise/application-enterprise-insights-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Enterprise Insights IPC 注册依赖。 */
export interface RegisterApplicationEnterpriseInsightsRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationEnterpriseInsightsRuntimeService,
    | "loadUsageDashboard"
    | "loadNeuroDashboard"
    | "searchNeuroSymbols"
    | "removeNeuroSymbol"
    | "runNeuroMaintenance"
    | "loadKnowledgeGraph"
    | "queryKnowledgeGraphEntity"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册 Enterprise Insights typed IPC；输入 Runtime 和发送者授权，返回清理函数，重复注册时移除旧处理器。 */
export function registerApplicationEnterpriseInsightsRuntimeIpc(
  options: RegisterApplicationEnterpriseInsightsRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 读取用量面板；输入事件和请求，返回 Main 聚合，未授权时不打开数据库。 */
  function handleLoadUsageDashboard(event: unknown, request: unknown): Promise<ApplicationEnterpriseUsageDashboardResult> {
    authorizeEvent(event);
    return runtime.loadUsageDashboard(request);
  }

  /** 读取认知面板；输入事件和请求，返回脱敏面板，未授权时不激活引擎。 */
  function handleLoadNeuroDashboard(event: unknown, request: unknown): Promise<ApplicationEnterpriseNeuroDashboardResult> {
    authorizeEvent(event);
    return runtime.loadNeuroDashboard(request);
  }

  /** 搜索认知符号；输入事件和请求，返回有界结果，未授权时不激活引擎。 */
  function handleSearchNeuroSymbols(event: unknown, request: unknown): Promise<ApplicationEnterpriseNeuroSearchResult> {
    authorizeEvent(event);
    return runtime.searchNeuroSymbols(request);
  }

  /** 删除认知符号；输入事件和稳定 ID，返回结果，未授权时不修改存储。 */
  function handleRemoveNeuroSymbol(event: unknown, request: unknown): Promise<ApplicationEnterpriseNeuroRemoveResult> {
    authorizeEvent(event);
    return runtime.removeNeuroSymbol(request);
  }

  /** 执行认知维护；输入事件，返回计数，未授权时不激活引擎或修改存储。 */
  function handleRunNeuroMaintenance(event: unknown): Promise<ApplicationEnterpriseNeuroMaintenanceResult> {
    authorizeEvent(event);
    return runtime.runNeuroMaintenance();
  }

  /** 读取知识图谱；输入事件和请求，返回脱敏图，未授权时不激活引擎。 */
  function handleLoadKnowledgeGraph(event: unknown, request: unknown): Promise<ApplicationEnterpriseKnowledgeGraphResult> {
    authorizeEvent(event);
    return runtime.loadKnowledgeGraph(request);
  }

  /** 查询知识图谱实体；输入事件和请求，返回脱敏事实，未授权时不激活引擎。 */
  function handleQueryKnowledgeGraphEntity(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationEnterpriseKnowledgeGraphEntityResult> {
    authorizeEvent(event);
    return runtime.queryKnowledgeGraphEntity(request);
  }

  const channels = APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.loadUsageDashboard, handleLoadUsageDashboard);
  ipcMain.handle(channels.loadNeuroDashboard, handleLoadNeuroDashboard);
  ipcMain.handle(channels.searchNeuroSymbols, handleSearchNeuroSymbols);
  ipcMain.handle(channels.removeNeuroSymbol, handleRemoveNeuroSymbol);
  ipcMain.handle(channels.runNeuroMaintenance, handleRunNeuroMaintenance);
  ipcMain.handle(channels.loadKnowledgeGraph, handleLoadKnowledgeGraph);
  ipcMain.handle(channels.queryKnowledgeGraphEntity, handleQueryKnowledgeGraphEntity);

  /** 移除本适配器注册的全部 Enterprise Insights IPC；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
