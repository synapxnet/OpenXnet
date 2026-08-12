import type { ApplicationNeuroSymbolicOperationEvent } from "./application-neuro-symbolic-governance";

/** Enterprise Runtime 的 Main IPC 通道。 */
export const APPLICATION_ENTERPRISE_RUNTIME_CHANNELS = Object.freeze({
  listRoleCards: "openxnet:application-enterprise:list-role-cards",
  saveRoleCard: "openxnet:application-enterprise:save-role-card",
  removeRoleCard: "openxnet:application-enterprise:remove-role-card",
  listTeamTemplates: "openxnet:application-enterprise:list-team-templates",
  saveTeamTemplate: "openxnet:application-enterprise:save-team-template",
  removeTeamTemplate: "openxnet:application-enterprise:remove-team-template",
  listKnowledgeBases: "openxnet:application-enterprise:list-knowledge-bases",
  saveKnowledgeBase: "openxnet:application-enterprise:save-knowledge-base",
  removeKnowledgeBase: "openxnet:application-enterprise:remove-knowledge-base",
  listKnowledgeBaseVersions: "openxnet:application-enterprise:list-knowledge-base-versions",
  listWorkspaces: "openxnet:application-enterprise:list-workspaces",
  saveWorkspace: "openxnet:application-enterprise:save-workspace",
  removeWorkspace: "openxnet:application-enterprise:remove-workspace",
  listProjects: "openxnet:application-enterprise:list-projects",
  saveProject: "openxnet:application-enterprise:save-project",
  removeProject: "openxnet:application-enterprise:remove-project",
  listMessages: "openxnet:application-enterprise:list-messages",
  postMessage: "openxnet:application-enterprise:post-message",
  listSkillBindings: "openxnet:application-enterprise:list-skill-bindings",
  setSkillBinding: "openxnet:application-enterprise:set-skill-binding",
  getSandboxState: "openxnet:application-enterprise:get-sandbox-state",
  listXnetServices: "openxnet:application-enterprise:list-xnet-services",
  saveXnetService: "openxnet:application-enterprise:save-xnet-service",
  checkXnetService: "openxnet:application-enterprise:check-xnet-service",
  checkAllXnetServices: "openxnet:application-enterprise:check-all-xnet-services",
});

/** Enterprise Runtime 的公开响应 schema。 */
export const APPLICATION_ENTERPRISE_RUNTIME_SCHEMA = "openxnet.enterprise.v1" as const;

/** 企业团队模板当前存储结构版本。 */
export const APPLICATION_ENTERPRISE_TEAM_TEMPLATE_SCHEMA_VERSION = 1 as const;

/** 企业角色卡草稿。 */
export interface ApplicationEnterpriseRoleCardDraft {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly system_prompt?: string;
  readonly permissions?: readonly string[];
  readonly tools?: readonly string[];
  readonly enabled?: boolean;
  readonly department?: string;
  readonly icon?: string;
  readonly skills?: readonly string[];
  readonly skill_ids?: readonly string[];
  readonly assignedWorkspace?: string;
  readonly projectId?: string;
  readonly templateId?: string;
  readonly category?: string;
  readonly categoryZh?: string;
  readonly categoryEn?: string;
  readonly summaryZh?: string;
  readonly summaryEn?: string;
  readonly accent?: readonly string[];
  readonly runtime_system_prompt?: string;
  readonly agent_name?: string;
  readonly role_scope?: string;
  readonly syncSource?: string;
  readonly bodyType?: string;
  readonly position3D?: { readonly x: number; readonly z: number } | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

/** 已持久化企业角色卡。 */
export interface ApplicationEnterpriseRoleCard extends Required<Omit<ApplicationEnterpriseRoleCardDraft, "position3D">> {
  readonly position3D: { readonly x: number; readonly z: number } | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** 保存企业角色卡请求。 */
export interface SaveApplicationEnterpriseRoleCardRequest {
  readonly roleCard: ApplicationEnterpriseRoleCardDraft;
  readonly mode: "create" | "update";
}

/** 企业角色卡 ID 请求。 */
export interface ApplicationEnterpriseRoleCardRequest {
  readonly roleCardId: string;
}

/** 企业角色卡列表。 */
export interface ApplicationEnterpriseRoleCardListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly cards: readonly ApplicationEnterpriseRoleCard[];
}

/** 企业角色卡写入结果。 */
export interface ApplicationEnterpriseRoleCardWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly card: ApplicationEnterpriseRoleCard;
}

/** 团队成员在编排过程中的职责。 */
export type ApplicationEnterpriseTeamMemberRole = "leader" | "worker" | "verifier";

/** 企业团队模板成员引用。 */
export interface ApplicationEnterpriseTeamTemplateMember {
  readonly roleCardId: string;
  readonly teamRole: ApplicationEnterpriseTeamMemberRole;
}

/** 企业团队模板草稿。 */
export interface ApplicationEnterpriseTeamTemplateDraft {
  readonly id?: string;
  readonly schemaVersion?: typeof APPLICATION_ENTERPRISE_TEAM_TEMPLATE_SCHEMA_VERSION;
  readonly version?: number;
  readonly name: string;
  readonly description?: string;
  readonly workspaceId: string;
  readonly enabled?: boolean;
  readonly members: readonly ApplicationEnterpriseTeamTemplateMember[];
  readonly created_at?: string;
  readonly updated_at?: string;
}

/** 已持久化企业团队模板。 */
export interface ApplicationEnterpriseTeamTemplate {
  readonly id: string;
  readonly schemaVersion: typeof APPLICATION_ENTERPRISE_TEAM_TEMPLATE_SCHEMA_VERSION;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly workspaceId: string;
  readonly enabled: boolean;
  readonly members: readonly ApplicationEnterpriseTeamTemplateMember[];
  readonly created_at: string;
  readonly updated_at: string;
}

/** 保存企业团队模板请求。 */
export interface SaveApplicationEnterpriseTeamTemplateRequest {
  readonly teamTemplate: ApplicationEnterpriseTeamTemplateDraft;
  readonly mode: "create" | "update";
}

/** 企业团队模板 ID 请求。 */
export interface ApplicationEnterpriseTeamTemplateRequest {
  readonly teamTemplateId: string;
}

/** 企业团队模板列表。 */
export interface ApplicationEnterpriseTeamTemplateListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly teamTemplates: readonly ApplicationEnterpriseTeamTemplate[];
}

/** 企业团队模板写入结果。 */
export interface ApplicationEnterpriseTeamTemplateWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly teamTemplate: ApplicationEnterpriseTeamTemplate;
}

/** 已解析团队模板及其角色卡，用于 Main 内部构建不可变运行快照。 */
export interface ApplicationEnterpriseResolvedTeamTemplate {
  readonly teamTemplate: ApplicationEnterpriseTeamTemplate;
  readonly roleCards: readonly ApplicationEnterpriseRoleCard[];
}

/** 企业知识库记录。 */
export interface ApplicationEnterpriseKnowledgeBase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly doc_count: number;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** 企业知识库草稿。 */
export interface ApplicationEnterpriseKnowledgeBaseDraft {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
}

/** 保存企业知识库请求。 */
export interface SaveApplicationEnterpriseKnowledgeBaseRequest {
  readonly knowledgeBase: ApplicationEnterpriseKnowledgeBaseDraft;
}

/** 企业知识库 ID 请求。 */
export interface ApplicationEnterpriseKnowledgeBaseRequest {
  readonly knowledgeBaseId: string;
}

/** 企业知识库列表。 */
export interface ApplicationEnterpriseKnowledgeBaseListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly knowledgeBases: readonly ApplicationEnterpriseKnowledgeBase[];
}

/** 企业知识库写入结果。 */
export interface ApplicationEnterpriseKnowledgeBaseWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly knowledgeBase: ApplicationEnterpriseKnowledgeBase;
}

/** 企业知识库版本摘要。 */
export interface ApplicationEnterpriseKnowledgeBaseVersion {
  readonly version: number;
  readonly kb_name: string;
  readonly doc_count: number;
  readonly created_at: string;
}

/** 企业知识库版本列表。 */
export interface ApplicationEnterpriseKnowledgeBaseVersionListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly knowledgeBaseId: string;
  readonly versions: readonly ApplicationEnterpriseKnowledgeBaseVersion[];
}

/** 企业环境类型。 */
export type ApplicationEnterpriseWorkspaceType = "local" | "docker" | "cloud" | "sandbox";

/** 企业环境的结构化配置。 */
export interface ApplicationEnterpriseWorkspaceConfig {
  readonly local: { readonly path: string; readonly permission_mode: string };
  readonly docker: { readonly image: string; readonly daemon_url: string; readonly container_id: string };
  readonly cloud: { readonly host: string; readonly port: number; readonly user: string; readonly key_path: string };
  readonly sandbox: { readonly image: string; readonly ttl_hours: number };
}

/** 企业工作区草稿。 */
export interface ApplicationEnterpriseWorkspaceDraft {
  readonly id?: string;
  readonly name: string;
  readonly type: ApplicationEnterpriseWorkspaceType;
  readonly status?: "stopped" | "running" | "error";
  readonly config: ApplicationEnterpriseWorkspaceConfig;
  readonly role_card_id?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

/** 已持久化企业工作区。 */
export interface ApplicationEnterpriseWorkspace extends Required<ApplicationEnterpriseWorkspaceDraft> {
  readonly id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/** 保存企业工作区请求。 */
export interface SaveApplicationEnterpriseWorkspaceRequest {
  readonly workspace: ApplicationEnterpriseWorkspaceDraft;
}

/** 企业工作区 ID 请求。 */
export interface ApplicationEnterpriseWorkspaceRequest {
  readonly workspaceId: string;
}

/** 企业工作区列表。 */
export interface ApplicationEnterpriseWorkspaceListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly workspaces: readonly ApplicationEnterpriseWorkspace[];
}

/** 企业工作区写入结果。 */
export interface ApplicationEnterpriseWorkspaceWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly workspace: ApplicationEnterpriseWorkspace;
}

/** 企业沙盘项目楼层草稿。 */
export interface ApplicationEnterpriseProjectDraft {
  readonly id?: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description?: string;
  readonly color?: string;
  readonly icon?: string;
  readonly floor?: number;
}

/** 已持久化企业沙盘项目楼层。 */
export interface ApplicationEnterpriseProject {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
  readonly floor: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 保存企业项目楼层请求。 */
export interface SaveApplicationEnterpriseProjectRequest {
  readonly project: ApplicationEnterpriseProjectDraft;
}

/** 企业项目楼层 ID 请求。 */
export interface ApplicationEnterpriseProjectRequest {
  readonly projectId: string;
}

/** 企业项目楼层列表。 */
export interface ApplicationEnterpriseProjectListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly projects: readonly ApplicationEnterpriseProject[];
}

/** 企业项目楼层写入结果。 */
export interface ApplicationEnterpriseProjectWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly project: ApplicationEnterpriseProject;
}

/** 企业协作消息作者类型。 */
export type ApplicationEnterpriseMessageSenderType = "leader" | "agent" | "system";

/** 企业协作消息投递状态。 */
export type ApplicationEnterpriseMessageStatus = "delivered" | "failed";

/** 企业协作消息内容类型。 */
export type ApplicationEnterpriseMessageKind = "text" | "operation";

/** 企业协作消息中固定的员工身份快照。 */
export interface ApplicationEnterpriseMessageMention {
  readonly roleCardId: string;
  readonly name: string;
}

/** 已持久化的企业协作消息和执行轨迹。 */
export interface ApplicationEnterpriseMessage {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly taskId: string | null;
  readonly traceId: string | null;
  readonly senderType: ApplicationEnterpriseMessageSenderType;
  readonly senderId: string;
  readonly senderName: string;
  readonly recipientIds: readonly string[];
  readonly mentions: readonly ApplicationEnterpriseMessageMention[];
  readonly kind: ApplicationEnterpriseMessageKind;
  readonly content: string;
  readonly operation: ApplicationNeuroSymbolicOperationEvent | null;
  readonly status: ApplicationEnterpriseMessageStatus;
  readonly createdAt: string;
}

/** 查询企业协作消息的范围和数量上限。 */
export interface ListApplicationEnterpriseMessagesRequest {
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly limit: number;
}

/** 企业领导从 Renderer 发送消息时允许提交的字段。 */
export interface PostApplicationEnterpriseMessageRequest {
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly recipientIds: readonly string[];
  readonly content: string;
  readonly taskId: string | null;
  readonly traceId: string | null;
}

/** 企业协作消息列表。 */
export interface ApplicationEnterpriseMessageListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly messages: readonly ApplicationEnterpriseMessage[];
}

/** 企业协作消息写入结果。 */
export interface ApplicationEnterpriseMessageWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly message: ApplicationEnterpriseMessage;
}

/** 企业空间对全局 Skill 的启用绑定。 */
export interface ApplicationEnterpriseSkillBinding {
  readonly workspaceId: string;
  readonly skillId: string;
  readonly enabled: boolean;
  readonly sourceIncidentId: string | null;
  readonly enabledAt: string | null;
  readonly updatedAt: string;
}

/** 设置企业 Skill 启用状态的请求。 */
export interface SetApplicationEnterpriseSkillBindingRequest {
  readonly workspaceId: string;
  readonly skillId: string;
  readonly enabled: boolean;
  readonly sourceIncidentId?: string | null;
}

/** 企业 Skill 绑定列表。 */
export interface ApplicationEnterpriseSkillBindingListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly bindings: readonly ApplicationEnterpriseSkillBinding[];
}

/** 企业 Skill 绑定写入结果。 */
export interface ApplicationEnterpriseSkillBindingWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly binding: ApplicationEnterpriseSkillBinding;
}

/** 企业沙盘状态。 */
export interface ApplicationEnterpriseSandboxStateResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly agents: readonly Readonly<Record<string, unknown>>[];
  readonly scene: Readonly<Record<string, unknown>>;
}

/** 固定 Xnet 服务键。 */
export type ApplicationEnterpriseXnetServiceKey = "dataops" | "mlops" | "aiops";

/** Xnet 服务配置和最近健康状态。 */
export interface ApplicationEnterpriseXnetService {
  readonly name: string;
  readonly url: string;
  readonly status: "online" | "offline";
  readonly last_check: string;
  readonly auto_connect: boolean;
}

/** 保存 Xnet 服务请求。 */
export interface SaveApplicationEnterpriseXnetServiceRequest {
  readonly serviceKey: ApplicationEnterpriseXnetServiceKey;
  readonly url: string;
  readonly autoConnect: boolean;
}

/** 检查单个 Xnet 服务请求。 */
export interface ApplicationEnterpriseXnetServiceRequest {
  readonly serviceKey: ApplicationEnterpriseXnetServiceKey;
}

/** 批量检查 Xnet 服务请求。 */
export interface CheckAllApplicationEnterpriseXnetServicesRequest {
  readonly autoOnly: boolean;
}

/** Xnet 服务列表。 */
export interface ApplicationEnterpriseXnetServiceListResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly services: Readonly<Record<ApplicationEnterpriseXnetServiceKey, ApplicationEnterpriseXnetService>>;
}

/** 单个 Xnet 服务结果。 */
export interface ApplicationEnterpriseXnetServiceWriteResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly serviceKey: ApplicationEnterpriseXnetServiceKey;
  readonly service: ApplicationEnterpriseXnetService;
}

/** 企业记录删除结果。 */
export interface ApplicationEnterpriseRemoveResult {
  readonly schema: typeof APPLICATION_ENTERPRISE_RUNTIME_SCHEMA;
  readonly success: true;
  readonly domain: "role-card" | "team-template" | "knowledge-base" | "workspace" | "project";
  readonly id: string;
}
