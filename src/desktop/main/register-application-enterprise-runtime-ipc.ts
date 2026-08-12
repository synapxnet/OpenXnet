import {
  APPLICATION_ENTERPRISE_RUNTIME_CHANNELS,
  type ApplicationEnterpriseKnowledgeBaseListResult,
  type ApplicationEnterpriseKnowledgeBaseVersionListResult,
  type ApplicationEnterpriseKnowledgeBaseWriteResult,
  type ApplicationEnterpriseMessageListResult,
  type ApplicationEnterpriseMessageWriteResult,
  type ApplicationEnterpriseProjectListResult,
  type ApplicationEnterpriseProjectWriteResult,
  type ApplicationEnterpriseRemoveResult,
  type ApplicationEnterpriseRoleCardListResult,
  type ApplicationEnterpriseRoleCardWriteResult,
  type ApplicationEnterpriseSandboxStateResult,
  type ApplicationEnterpriseSkillBindingListResult,
  type ApplicationEnterpriseSkillBindingWriteResult,
  type ApplicationEnterpriseTeamTemplateListResult,
  type ApplicationEnterpriseTeamTemplateWriteResult,
  type ApplicationEnterpriseWorkspaceListResult,
  type ApplicationEnterpriseWorkspaceWriteResult,
  type ApplicationEnterpriseXnetServiceListResult,
  type ApplicationEnterpriseXnetServiceWriteResult,
} from "../contracts/application-enterprise-runtime";
import type { ApplicationEnterpriseRuntimeService } from "../enterprise/application-enterprise-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Enterprise Runtime IPC 注册依赖。 */
export interface RegisterApplicationEnterpriseRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationEnterpriseRuntimeService,
    | "listRoleCards"
    | "saveRoleCard"
    | "removeRoleCard"
    | "listTeamTemplates"
    | "saveTeamTemplate"
    | "removeTeamTemplate"
    | "listKnowledgeBases"
    | "saveKnowledgeBase"
    | "removeKnowledgeBase"
    | "listKnowledgeBaseVersions"
    | "listWorkspaces"
    | "saveWorkspace"
    | "removeWorkspace"
    | "listProjects"
    | "saveProject"
    | "removeProject"
    | "listMessages"
    | "postMessage"
    | "listSkillBindings"
    | "setSkillBinding"
    | "getSandboxState"
    | "listXnetServices"
    | "saveXnetService"
    | "checkXnetService"
    | "checkAllXnetServices"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册 Enterprise Runtime typed IPC；输入 Runtime 和发送者授权，返回清理函数，重复注册时先移除旧处理器。 */
export function registerApplicationEnterpriseRuntimeIpc(
  options: RegisterApplicationEnterpriseRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 列出角色卡；输入 IPC 事件，返回本机记录，未授权时不读文件。 */
  function handleListRoleCards(event: unknown): Promise<ApplicationEnterpriseRoleCardListResult> {
    authorizeEvent(event);
    return runtime.listRoleCards();
  }

  /** 保存角色卡；输入 IPC 事件和草稿，返回记录，未授权时不写文件或同步沙盘。 */
  function handleSaveRoleCard(event: unknown, request: unknown): Promise<ApplicationEnterpriseRoleCardWriteResult> {
    authorizeEvent(event);
    return runtime.saveRoleCard(request);
  }

  /** 删除角色卡；输入 IPC 事件和 ID，返回删除结果，未授权时不写文件。 */
  function handleRemoveRoleCard(event: unknown, request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    authorizeEvent(event);
    return runtime.removeRoleCard(request);
  }

  /** 列出团队模板；输入 IPC 事件，返回本机模板，未授权时不读文件。 */
  function handleListTeamTemplates(event: unknown): Promise<ApplicationEnterpriseTeamTemplateListResult> {
    authorizeEvent(event);
    return runtime.listTeamTemplates();
  }

  /** 保存团队模板；输入 IPC 事件和草稿，返回递增版本，未授权时不写文件。 */
  function handleSaveTeamTemplate(event: unknown, request: unknown): Promise<ApplicationEnterpriseTeamTemplateWriteResult> {
    authorizeEvent(event);
    return runtime.saveTeamTemplate(request);
  }

  /** 删除团队模板；输入 IPC 事件和 ID，返回删除结果，不删除角色卡。 */
  function handleRemoveTeamTemplate(event: unknown, request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    authorizeEvent(event);
    return runtime.removeTeamTemplate(request);
  }

  /** 列出企业知识库；输入 IPC 事件，返回本机记录，未授权时不读文件。 */
  function handleListKnowledgeBases(event: unknown): Promise<ApplicationEnterpriseKnowledgeBaseListResult> {
    authorizeEvent(event);
    return runtime.listKnowledgeBases();
  }

  /** 保存企业知识库；输入 IPC 事件和草稿，返回记录，未授权时不写文件。 */
  function handleSaveKnowledgeBase(event: unknown, request: unknown): Promise<ApplicationEnterpriseKnowledgeBaseWriteResult> {
    authorizeEvent(event);
    return runtime.saveKnowledgeBase(request);
  }

  /** 删除企业知识库；输入 IPC 事件和 ID，返回删除结果，未授权时不删除版本目录。 */
  function handleRemoveKnowledgeBase(event: unknown, request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    authorizeEvent(event);
    return runtime.removeKnowledgeBase(request);
  }

  /** 列出知识库版本；输入 IPC 事件和 ID，返回脱敏摘要，未授权时不读版本文件。 */
  function handleListKnowledgeBaseVersions(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationEnterpriseKnowledgeBaseVersionListResult> {
    authorizeEvent(event);
    return runtime.listKnowledgeBaseVersions(request);
  }

  /** 列出企业环境；输入 IPC 事件，返回元数据，未授权时不读文件。 */
  function handleListWorkspaces(event: unknown): Promise<ApplicationEnterpriseWorkspaceListResult> {
    authorizeEvent(event);
    return runtime.listWorkspaces();
  }

  /** 保存企业环境元数据；输入 IPC 事件和草稿，返回记录，不执行 Docker/SSH。 */
  function handleSaveWorkspace(event: unknown, request: unknown): Promise<ApplicationEnterpriseWorkspaceWriteResult> {
    authorizeEvent(event);
    return runtime.saveWorkspace(request);
  }

  /** 删除企业环境元数据；输入 IPC 事件和 ID，返回结果，不停止外部资源。 */
  function handleRemoveWorkspace(event: unknown, request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    authorizeEvent(event);
    return runtime.removeWorkspace(request);
  }

  /** 列出项目楼层；输入 IPC 事件，返回 Main-owned 记录，未授权时不读文件。 */
  function handleListProjects(event: unknown): Promise<ApplicationEnterpriseProjectListResult> {
    authorizeEvent(event);
    return runtime.listProjects();
  }

  /** 保存项目楼层；输入 IPC 事件和草稿，返回持久记录，未授权时不写文件。 */
  function handleSaveProject(event: unknown, request: unknown): Promise<ApplicationEnterpriseProjectWriteResult> {
    authorizeEvent(event);
    return runtime.saveProject(request);
  }

  /** 删除项目楼层；输入 IPC 事件和 ID，返回结果并解除员工指派。 */
  function handleRemoveProject(event: unknown, request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    authorizeEvent(event);
    return runtime.removeProject(request);
  }

  /** 查询企业协作群消息；输入 IPC 事件和范围，返回有界审计轨迹。 */
  function handleListMessages(event: unknown, request: unknown): Promise<ApplicationEnterpriseMessageListResult> {
    authorizeEvent(event);
    return runtime.listMessages(request);
  }

  /** 发布企业领导消息；输入 IPC 事件和内容，由 Main 绑定作者身份并持久化。 */
  function handlePostMessage(event: unknown, request: unknown): Promise<ApplicationEnterpriseMessageWriteResult> {
    authorizeEvent(event);
    return runtime.postMessage(request);
  }

  /** 列出企业 Skill 绑定；输入 IPC 事件，返回 Workspace 启用关系，未授权时不读文件。 */
  function handleListSkillBindings(event: unknown): Promise<ApplicationEnterpriseSkillBindingListResult> {
    authorizeEvent(event);
    return runtime.listSkillBindings();
  }

  /** 设置企业 Skill 绑定；输入 IPC 事件和结构化请求，返回幂等写入结果。 */
  function handleSetSkillBinding(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationEnterpriseSkillBindingWriteResult> {
    authorizeEvent(event);
    return runtime.setSkillBinding(request);
  }

  /** 读取沙盘状态；输入 IPC 事件，返回角色投影，未授权时不读写文件。 */
  function handleGetSandboxState(event: unknown): Promise<ApplicationEnterpriseSandboxStateResult> {
    authorizeEvent(event);
    return runtime.getSandboxState();
  }

  /** 列出 Xnet 服务；输入 IPC 事件，返回保存配置，不执行网络请求。 */
  function handleListXnetServices(event: unknown): Promise<ApplicationEnterpriseXnetServiceListResult> {
    authorizeEvent(event);
    return runtime.listXnetServices();
  }

  /** 保存 Xnet 服务；输入 IPC 事件和固定配置，返回记录，不执行健康检查。 */
  function handleSaveXnetService(event: unknown, request: unknown): Promise<ApplicationEnterpriseXnetServiceWriteResult> {
    authorizeEvent(event);
    return runtime.saveXnetService(request);
  }

  /** 检查单个 Xnet 服务；输入 IPC 事件和固定键，返回状态，只访问已保存 URL。 */
  function handleCheckXnetService(event: unknown, request: unknown): Promise<ApplicationEnterpriseXnetServiceWriteResult> {
    authorizeEvent(event);
    return runtime.checkXnetService(request);
  }

  /** 批量检查 Xnet 服务；输入 IPC 事件和 autoOnly，返回完整状态，未授权时不访问网络。 */
  function handleCheckAllXnetServices(event: unknown, request: unknown): Promise<ApplicationEnterpriseXnetServiceListResult> {
    authorizeEvent(event);
    return runtime.checkAllXnetServices(request);
  }

  const channels = APPLICATION_ENTERPRISE_RUNTIME_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.listRoleCards, handleListRoleCards);
  ipcMain.handle(channels.saveRoleCard, handleSaveRoleCard);
  ipcMain.handle(channels.removeRoleCard, handleRemoveRoleCard);
  ipcMain.handle(channels.listTeamTemplates, handleListTeamTemplates);
  ipcMain.handle(channels.saveTeamTemplate, handleSaveTeamTemplate);
  ipcMain.handle(channels.removeTeamTemplate, handleRemoveTeamTemplate);
  ipcMain.handle(channels.listKnowledgeBases, handleListKnowledgeBases);
  ipcMain.handle(channels.saveKnowledgeBase, handleSaveKnowledgeBase);
  ipcMain.handle(channels.removeKnowledgeBase, handleRemoveKnowledgeBase);
  ipcMain.handle(channels.listKnowledgeBaseVersions, handleListKnowledgeBaseVersions);
  ipcMain.handle(channels.listWorkspaces, handleListWorkspaces);
  ipcMain.handle(channels.saveWorkspace, handleSaveWorkspace);
  ipcMain.handle(channels.removeWorkspace, handleRemoveWorkspace);
  ipcMain.handle(channels.listProjects, handleListProjects);
  ipcMain.handle(channels.saveProject, handleSaveProject);
  ipcMain.handle(channels.removeProject, handleRemoveProject);
  ipcMain.handle(channels.listMessages, handleListMessages);
  ipcMain.handle(channels.postMessage, handlePostMessage);
  ipcMain.handle(channels.listSkillBindings, handleListSkillBindings);
  ipcMain.handle(channels.setSkillBinding, handleSetSkillBinding);
  ipcMain.handle(channels.getSandboxState, handleGetSandboxState);
  ipcMain.handle(channels.listXnetServices, handleListXnetServices);
  ipcMain.handle(channels.saveXnetService, handleSaveXnetService);
  ipcMain.handle(channels.checkXnetService, handleCheckXnetService);
  ipcMain.handle(channels.checkAllXnetServices, handleCheckAllXnetServices);

  /** 移除本适配器注册的全部 Enterprise IPC；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
