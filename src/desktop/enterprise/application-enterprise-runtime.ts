import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
  APPLICATION_ENTERPRISE_TEAM_TEMPLATE_SCHEMA_VERSION,
  type ApplicationEnterpriseKnowledgeBase,
  type ApplicationEnterpriseKnowledgeBaseListResult,
  type ApplicationEnterpriseKnowledgeBaseVersion,
  type ApplicationEnterpriseKnowledgeBaseVersionListResult,
  type ApplicationEnterpriseKnowledgeBaseWriteResult,
  type ApplicationEnterpriseMessage,
  type ApplicationEnterpriseMessageKind,
  type ApplicationEnterpriseMessageListResult,
  type ApplicationEnterpriseMessageSenderType,
  type ApplicationEnterpriseMessageStatus,
  type ApplicationEnterpriseMessageWriteResult,
  type ApplicationEnterpriseProject,
  type ApplicationEnterpriseProjectListResult,
  type ApplicationEnterpriseProjectWriteResult,
  type ApplicationEnterpriseRemoveResult,
  type ApplicationEnterpriseRoleCard,
  type ApplicationEnterpriseRoleCardListResult,
  type ApplicationEnterpriseRoleCardWriteResult,
  type ApplicationEnterpriseSandboxStateResult,
  type ApplicationEnterpriseSkillBinding,
  type ApplicationEnterpriseSkillBindingListResult,
  type ApplicationEnterpriseSkillBindingWriteResult,
  type ApplicationEnterpriseResolvedTeamTemplate,
  type ApplicationEnterpriseWorkspace,
  type ApplicationEnterpriseWorkspaceConfig,
  type ApplicationEnterpriseWorkspaceListResult,
  type ApplicationEnterpriseWorkspaceType,
  type ApplicationEnterpriseWorkspaceWriteResult,
  type ApplicationEnterpriseXnetService,
  type ApplicationEnterpriseXnetServiceKey,
  type ApplicationEnterpriseXnetServiceListResult,
  type ApplicationEnterpriseXnetServiceWriteResult,
  type ApplicationEnterpriseTeamMemberRole,
  type ApplicationEnterpriseTeamTemplate,
  type ApplicationEnterpriseTeamTemplateListResult,
  type ApplicationEnterpriseTeamTemplateWriteResult,
} from "../contracts/application-enterprise-runtime";
import type { ApplicationNeuroSymbolicOperationEvent } from "../contracts/application-neuro-symbolic-governance";
import { parseApplicationNeuroSymbolicOperationEvent } from "../governance/application-neuro-symbolic-governance";
import { isPlainRecord, requireExactRecord } from "../package-management/safe-package-archive";

const MAX_ENTERPRISE_STORE_BYTES = 16 * 1024 * 1024;
const MAX_ENTERPRISE_RECORDS = 2_000;
const MAX_ROLE_TEXT_BYTES = 256 * 1024;
const MAX_ROLE_LIST_ITEMS = 200;
const MAX_TEAM_TEMPLATE_MEMBERS = 20;
const MAX_KB_VERSIONS = 1_000;
const MAX_ENTERPRISE_MESSAGES = 10_000;
const MAX_ENTERPRISE_MESSAGE_RECIPIENTS = 64;
const MAX_ENTERPRISE_MESSAGE_QUERY = 500;
const ENTERPRISE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PROJECT_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const XNET_SERVICE_KEYS = new Set<ApplicationEnterpriseXnetServiceKey>(["dataops", "mlops", "aiops"]);
const WORKSPACE_TYPES = new Set<ApplicationEnterpriseWorkspaceType>(["local", "docker", "cloud", "sandbox"]);
const TEAM_MEMBER_ROLES = new Set<ApplicationEnterpriseTeamMemberRole>(["leader", "worker", "verifier"]);
const DEFAULT_SCENE: Readonly<Record<string, unknown>> = Object.freeze({
  template: "office_default",
  dimensions: { width: 20, height: 15 },
  furniture: [
    { type: "desk", x: 2, z: 2, rotation: 0 },
    { type: "desk", x: 5, z: 2, rotation: 0 },
    { type: "desk", x: 8, z: 2, rotation: 0 },
    { type: "desk", x: 11, z: 2, rotation: 0 },
    { type: "desk", x: 2, z: 6, rotation: 0 },
    { type: "desk", x: 5, z: 6, rotation: 0 },
    { type: "desk", x: 8, z: 6, rotation: 0 },
    { type: "desk", x: 11, z: 6, rotation: 0 },
    { type: "meeting_table", x: 7, z: 10, rotation: 0 },
    { type: "server_rack", x: 14, z: 1, rotation: 0 },
  ],
});
const AGENT_COLORS = Object.freeze([
  "#409EFF", "#67C23A", "#E6A23C", "#F56C6C", "#909399",
  "#9C27B0", "#FF9800", "#00BCD4", "#795548", "#607D8B",
  "#E91E63", "#3F51B5", "#009688", "#FF5722", "#8BC34A",
]);

/** Enterprise Runtime 的最小网络响应。 */
export interface ApplicationEnterpriseFetchResponse {
  readonly status: number;
}

/** Enterprise Runtime 注入的无响应体健康检查 fetch。 */
export type ApplicationEnterpriseFetch = (
  url: string,
  options: { readonly method: "GET"; readonly redirect: "manual"; readonly signal: AbortSignal },
) => Promise<ApplicationEnterpriseFetchResponse>;

/** Enterprise Runtime 的诊断输出。 */
export interface ApplicationEnterpriseRuntimeLogger {
  warn(message: string, error?: unknown): void;
}

/** Enterprise Runtime 构造依赖。 */
export interface ApplicationEnterpriseRuntimeOptions {
  readonly userDataDirectory: string;
  readonly fetch?: ApplicationEnterpriseFetch;
  readonly logger?: ApplicationEnterpriseRuntimeLogger;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly resolveLeaderIdentity?: () => ApplicationEnterpriseLeaderIdentity;
}

/** Main 从认证边界解析出的企业领导公开身份。 */
export interface ApplicationEnterpriseLeaderIdentity {
  readonly id: string;
  readonly name: string;
}

/** Main 内部写入 AgentTeams 或系统执行轨迹时使用的受信任消息。 */
export interface RecordTrustedApplicationEnterpriseMessageInput {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly taskId?: string | null;
  readonly traceId?: string | null;
  readonly senderType: Exclude<ApplicationEnterpriseMessageSenderType, "leader">;
  readonly senderId: string;
  readonly senderName: string;
  readonly recipientIds?: readonly string[];
  readonly content: string;
  readonly operation?: ApplicationNeuroSymbolicOperationEvent | null;
  readonly status?: ApplicationEnterpriseMessageStatus;
}

interface EnterpriseSandboxDocument {
  readonly agents: readonly Readonly<Record<string, unknown>>[];
  readonly scene: Readonly<Record<string, unknown>>;
}

/** 创建默认健康检查 fetch；无输入，返回禁止自动重定向且不读取响应体的网络函数。 */
function createDefaultFetch(): ApplicationEnterpriseFetch {
  return async (url, options) => fetch(url, options);
}

/** 深度克隆有界 JSON；输入值、预算和标签，返回独立值，不可序列化或超限时抛错。 */
function cloneBoundedJson<T>(value: T, maximumBytes: number, label: string): T {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) throw new Error(`${label} exceeds its byte budget.`);
  return JSON.parse(serialized) as T;
}

/** 读取有界文本字段；输入值、标签、长度和必填标记，返回去空格文本，非法时抛错。 */
function requireText(value: unknown, label: string, maximumLength: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${label} is required.`);
    return "";
  }
  if (typeof value !== "string" || value.length > maximumLength || /[\u0000\u007F]/.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  const normalized = value.trim();
  if (required && !normalized) throw new Error(`${label} is required.`);
  return normalized;
}

/** 读取有界唯一字符串列表；输入值和标签，返回清理列表，类型、数量或文本超限时抛错。 */
function requireTextList(value: unknown, label: string, maximumItems = MAX_ROLE_LIST_ITEMS): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${label} is invalid.`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = requireText(item, label, 512);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/** 校验稳定企业记录 ID；输入未知值和标签，返回 ID，路径字符、空值或超长时抛错。 */
function requireEnterpriseId(value: unknown, label: string): string {
  const normalized = requireText(value, label, 128, true);
  if (!ENTERPRISE_ID_PATTERN.test(normalized)) throw new Error(`${label} is invalid.`);
  return normalized;
}

/** 读取安全数字；输入值、默认值和范围，返回范围内数值，非法时使用默认值。 */
function readBoundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

/** 规范 ISO 或旧格式时间文本；输入未知值和回退，返回有界时间文本，无副作用。 */
function readTimestamp(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() && value.length <= 64 ? value.trim() : fallback;
}

/** 构造本地旧格式时间；输入 Date，返回 `YYYY-MM-DD HH:mm:ss`，无副作用。 */
function formatLegacyTimestamp(value: Date): string {
  const pad = (part: number): string => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

/** 判断错误是否为文件缺失；输入未知错误，返回布尔值，无副作用。 */
function isMissingFileError(error: unknown): boolean {
  return isPlainRecord(error) && error.code === "ENOENT";
}

/** 管理企业本地角色卡、知识库、工作区、沙盘和 Xnet 服务，不激活 Python。 */
export class ApplicationEnterpriseRuntimeService {
  private readonly roleCardPath: string;
  private readonly teamTemplatePath: string;
  private readonly knowledgeBasePath: string;
  private readonly knowledgeBaseVersionsRoot: string;
  private readonly workspacePath: string;
  private readonly projectPath: string;
  private readonly messagePath: string;
  private readonly skillBindingPath: string;
  private readonly sandboxPath: string;
  private readonly xnetServicesPath: string;
  private readonly fetchResource: ApplicationEnterpriseFetch;
  private readonly logger: ApplicationEnterpriseRuntimeLogger;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly resolveLeaderIdentity: () => ApplicationEnterpriseLeaderIdentity;
  private operationQueue: Promise<void> = Promise.resolve();

  /** 创建 Enterprise Runtime；输入用户目录和可选边界，仅计算兼容文件路径，不读取文件或访问网络。 */
  public constructor(private readonly options: ApplicationEnterpriseRuntimeOptions) {
    const root = path.resolve(options.userDataDirectory);
    this.roleCardPath = path.join(root, "enterprise_role_cards.json");
    this.teamTemplatePath = path.join(root, "enterprise_team_templates.json");
    this.knowledgeBasePath = path.join(root, "enterprise_knowledge_bases.json");
    this.knowledgeBaseVersionsRoot = path.join(root, "enterprise_kb_versions");
    this.workspacePath = path.join(root, "workspaces.json");
    this.projectPath = path.join(root, "enterprise_projects.json");
    this.messagePath = path.join(root, "enterprise_messages.json");
    this.skillBindingPath = path.join(root, "enterprise_skill_bindings.json");
    this.sandboxPath = path.join(root, "sandbox_state.json");
    this.xnetServicesPath = path.join(root, "xnet_services.json");
    this.fetchResource = options.fetch ?? createDefaultFetch();
    this.logger = options.logger ?? console;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.resolveLeaderIdentity = options.resolveLeaderIdentity ?? (() => ({
      id: "enterprise-leader",
      name: "企业领导",
    }));
  }

  /** 列出企业角色卡；无输入，返回有界规范记录，缺失或损坏文件按空列表处理。 */
  public async listRoleCards(): Promise<ApplicationEnterpriseRoleCardListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      cards: await this.readRoleCards(),
    };
  }

  /** 创建或更新企业角色卡；输入 exact 角色草稿，返回写入记录，非法字段或未知 ID 时不改文件。 */
  public saveRoleCard(request: unknown): Promise<ApplicationEnterpriseRoleCardWriteResult> {
    const parsed = requireExactRecord(request, ["roleCard", "mode"], "enterprise role-card request");
    if (parsed.mode !== "create" && parsed.mode !== "update") throw new Error("Enterprise role-card save mode is invalid.");
    return this.enqueueOperation(async () => {
      const cards = [...await this.readRoleCards()];
      const draft = this.parseRoleCardDraft(parsed.roleCard);
      const now = formatLegacyTimestamp(this.now());
      const requestedId = draft.id;
      const existingIndex = requestedId ? cards.findIndex((card) => card.id === requestedId) : -1;
      if (parsed.mode === "update" && (!requestedId || existingIndex < 0)) throw new Error("Enterprise role card was not found.");
      if (parsed.mode === "create" && existingIndex >= 0) throw new Error("Enterprise role card already exists.");
      const existing = existingIndex >= 0 ? cards[existingIndex] ?? null : null;
      if (existing !== null && !draft.enabled) {
        const templates = await this.readTeamTemplates();
        if (templates.some((template) => template.members.some((member) => member.roleCardId === existing.id))) {
          throw new Error("Enterprise role card is referenced by a team template and cannot be disabled.");
        }
      }
      const card: ApplicationEnterpriseRoleCard = {
        ...draft,
        id: requestedId || this.createValidatedId("Role card id"),
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      if (parsed.mode === "update") cards[existingIndex] = card;
      else cards.push(card);
      await this.writeJsonFile(this.roleCardPath, cards, "Enterprise role cards");
      await this.syncSandbox(cards);
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, card };
    });
  }

  /** 删除企业角色卡；输入稳定 ID，返回删除结果，缺失时拒绝且不改沙盘。 */
  public removeRoleCard(request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    const roleCardId = this.parseIdRequest(request, "roleCardId", "Role card id");
    return this.enqueueOperation(async () => {
      const cards = [...await this.readRoleCards()];
      const templates = await this.readTeamTemplates();
      if (templates.some((template) => template.members.some((member) => member.roleCardId === roleCardId))) {
        throw new Error("Enterprise role card is referenced by a team template and cannot be removed.");
      }
      const remaining = cards.filter((card) => card.id !== roleCardId);
      if (remaining.length === cards.length) throw new Error("Enterprise role card was not found.");
      await this.writeJsonFile(this.roleCardPath, remaining, "Enterprise role cards");
      await this.syncSandbox(remaining);
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, domain: "role-card", id: roleCardId };
    });
  }

  /** 列出企业团队模板；无输入，返回规范模板，缺失或损坏文件按空列表处理。 */
  public async listTeamTemplates(): Promise<ApplicationEnterpriseTeamTemplateListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      teamTemplates: await this.readTeamTemplates(),
    };
  }

  /** 创建或更新团队模板；输入角色引用和职责，校验成员完整性后原子写入并递增版本。 */
  public saveTeamTemplate(request: unknown): Promise<ApplicationEnterpriseTeamTemplateWriteResult> {
    const parsed = requireExactRecord(request, ["teamTemplate", "mode"], "enterprise team-template request");
    if (parsed.mode !== "create" && parsed.mode !== "update") throw new Error("Enterprise team-template save mode is invalid.");
    return this.enqueueOperation(async () => {
      const templates = [...await this.readTeamTemplates()];
      const roleCards = await this.readRoleCards();
      const draft = this.parseTeamTemplateDraft(parsed.teamTemplate);
      this.requireAvailableTeamMembers(draft.members, roleCards);
      const existingIndex = draft.id ? templates.findIndex((template) => template.id === draft.id) : -1;
      if (parsed.mode === "update" && (!draft.id || existingIndex < 0)) throw new Error("Enterprise team template was not found.");
      if (parsed.mode === "create" && existingIndex >= 0) throw new Error("Enterprise team template already exists.");
      const existing = existingIndex >= 0 ? templates[existingIndex] ?? null : null;
      const now = formatLegacyTimestamp(this.now());
      const teamTemplate: ApplicationEnterpriseTeamTemplate = {
        ...draft,
        id: draft.id || this.createValidatedId("Team template id"),
        version: (existing?.version ?? 0) + 1,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      if (existingIndex >= 0) templates[existingIndex] = teamTemplate;
      else templates.push(teamTemplate);
      await this.writeJsonFile(this.teamTemplatePath, templates, "Enterprise team templates");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, teamTemplate };
    });
  }

  /** 删除企业团队模板；输入稳定 ID，返回删除结果，不删除其引用的角色卡。 */
  public removeTeamTemplate(request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    const teamTemplateId = this.parseIdRequest(request, "teamTemplateId", "Team template id");
    return this.enqueueOperation(async () => {
      const templates = [...await this.readTeamTemplates()];
      const remaining = templates.filter((template) => template.id !== teamTemplateId);
      if (remaining.length === templates.length) throw new Error("Enterprise team template was not found.");
      await this.writeJsonFile(this.teamTemplatePath, remaining, "Enterprise team templates");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, domain: "team-template", id: teamTemplateId };
    });
  }

  /** 解析可运行团队模板；输入模板 ID，返回模板和按成员顺序排列的启用角色卡，引用失效时拒绝。 */
  public async resolveTeamTemplate(teamTemplateId: string): Promise<ApplicationEnterpriseResolvedTeamTemplate> {
    const normalizedId = requireEnterpriseId(teamTemplateId, "Team template id");
    const template = (await this.readTeamTemplates()).find((item) => item.id === normalizedId);
    if (template === undefined || !template.enabled) throw new Error("Enterprise team template is unavailable.");
    const roleCards = await this.readRoleCards();
    this.requireAvailableTeamMembers(template.members, roleCards);
    const cardsById = new Map(roleCards.map((card) => [card.id, card] as const));
    return {
      teamTemplate: template,
      roleCards: template.members.map((member) => cardsById.get(member.roleCardId) as ApplicationEnterpriseRoleCard),
    };
  }

  /** 列出企业知识库；无输入，返回有界规范记录，缺失或损坏文件按空列表处理。 */
  public async listKnowledgeBases(): Promise<ApplicationEnterpriseKnowledgeBaseListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      knowledgeBases: await this.readKnowledgeBases(),
    };
  }

  /** 创建或更新企业知识库；输入 exact 草稿，返回记录，未知 ID 或非法字段时不改文件。 */
  public saveKnowledgeBase(request: unknown): Promise<ApplicationEnterpriseKnowledgeBaseWriteResult> {
    const parsed = requireExactRecord(request, ["knowledgeBase"], "enterprise knowledge-base request");
    return this.enqueueOperation(async () => {
      const draft = requireExactRecord(parsed.knowledgeBase, ["id", "name", "description", "category"], "knowledge base");
      const id = draft.id === undefined ? "" : requireEnterpriseId(draft.id, "Knowledge base id");
      const knowledgeBases = [...await this.readKnowledgeBases()];
      const existingIndex = id ? knowledgeBases.findIndex((item) => item.id === id) : -1;
      if (id && existingIndex < 0) throw new Error("Enterprise knowledge base was not found.");
      const existing = existingIndex >= 0 ? knowledgeBases[existingIndex] : null;
      const now = formatLegacyTimestamp(this.now());
      const knowledgeBase: ApplicationEnterpriseKnowledgeBase = {
        id: id || this.createValidatedId("Knowledge base id"),
        name: requireText(draft.name, "Knowledge base name", 160, true),
        description: requireText(draft.description, "Knowledge base description", 4000),
        category: requireText(draft.category, "Knowledge base category", 160),
        doc_count: existing?.doc_count ?? 0,
        version: existing?.version ?? 1,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      if (existingIndex >= 0) knowledgeBases[existingIndex] = knowledgeBase;
      else knowledgeBases.push(knowledgeBase);
      await this.writeJsonFile(this.knowledgeBasePath, knowledgeBases, "Enterprise knowledge bases");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, knowledgeBase };
    });
  }

  /** 删除企业知识库及版本目录；输入稳定 ID，返回删除结果，缺失或非法目录时拒绝。 */
  public removeKnowledgeBase(request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    const knowledgeBaseId = this.parseIdRequest(request, "knowledgeBaseId", "Knowledge base id");
    return this.enqueueOperation(async () => {
      const knowledgeBases = [...await this.readKnowledgeBases()];
      const remaining = knowledgeBases.filter((item) => item.id !== knowledgeBaseId);
      if (remaining.length === knowledgeBases.length) throw new Error("Enterprise knowledge base was not found.");
      await this.writeJsonFile(this.knowledgeBasePath, remaining, "Enterprise knowledge bases");
      await rm(path.join(this.knowledgeBaseVersionsRoot, knowledgeBaseId), { recursive: true, force: true });
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, domain: "knowledge-base", id: knowledgeBaseId };
    });
  }

  /** 列出企业知识库版本摘要；输入稳定 ID，返回最多 1000 条，不暴露 snapshot_data。 */
  public async listKnowledgeBaseVersions(request: unknown): Promise<ApplicationEnterpriseKnowledgeBaseVersionListResult> {
    const knowledgeBaseId = this.parseIdRequest(request, "knowledgeBaseId", "Knowledge base id");
    const directory = path.join(this.knowledgeBaseVersionsRoot, knowledgeBaseId);
    const versions: ApplicationEnterpriseKnowledgeBaseVersion[] = [];
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries.slice(0, MAX_KB_VERSIONS * 2)) {
        if (!entry.isFile() || entry.isSymbolicLink() || !/^v[1-9]\d{0,8}\.json$/.test(entry.name)) continue;
        try {
          const value = await this.readJsonFile(path.join(directory, entry.name), "Knowledge base version");
          if (!isPlainRecord(value)) continue;
          const version = Math.trunc(readBoundedNumber(value.version, 0, 0, 1_000_000_000));
          if (version <= 0) continue;
          versions.push({
            version,
            kb_name: requireText(value.kb_name, "Knowledge base version name", 160),
            doc_count: Math.trunc(readBoundedNumber(value.doc_count, 0, 0, 1_000_000_000)),
            created_at: readTimestamp(value.created_at, ""),
          });
        } catch {
          // 单个损坏版本不会阻断其余历史。
        }
        if (versions.length >= MAX_KB_VERSIONS) break;
      }
    } catch {
      // 缺失版本目录等价于空历史。
    }
    versions.sort((left, right) => right.version - left.version);
    return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, knowledgeBaseId, versions };
  }

  /** 列出企业环境元数据；无输入，返回有界规范记录，不执行 Docker、SSH 或文件系统工作区操作。 */
  public async listWorkspaces(): Promise<ApplicationEnterpriseWorkspaceListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      workspaces: await this.readWorkspaces(),
    };
  }

  /** 创建或更新企业环境元数据；输入结构化草稿，返回记录，不执行 Docker/SSH，未知 ID 时拒绝。 */
  public saveWorkspace(request: unknown): Promise<ApplicationEnterpriseWorkspaceWriteResult> {
    const parsed = requireExactRecord(request, ["workspace"], "enterprise workspace request");
    return this.enqueueOperation(async () => {
      const draft = this.parseWorkspaceDraft(parsed.workspace);
      const workspaces = [...await this.readWorkspaces()];
      const existingIndex = draft.id ? workspaces.findIndex((item) => item.id === draft.id) : -1;
      if (draft.id && existingIndex < 0) throw new Error("Enterprise workspace was not found.");
      const existing = existingIndex >= 0 ? workspaces[existingIndex] : null;
      const now = this.now().toISOString();
      const workspace: ApplicationEnterpriseWorkspace = {
        ...draft,
        id: draft.id || this.createValidatedId("Workspace id"),
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      if (existingIndex >= 0) workspaces[existingIndex] = workspace;
      else workspaces.push(workspace);
      await this.writeJsonFile(this.workspacePath, workspaces, "Enterprise workspaces");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, workspace };
    });
  }

  /** 删除企业环境元数据；输入稳定 ID，清理本地项目与角色指派，不停止或删除任何外部运行资源。 */
  public removeWorkspace(request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    const workspaceId = this.parseIdRequest(request, "workspaceId", "Workspace id");
    return this.enqueueOperation(async () => {
      const workspaces = [...await this.readWorkspaces()];
      const remaining = workspaces.filter((item) => item.id !== workspaceId);
      if (remaining.length === workspaces.length) throw new Error("Enterprise workspace was not found.");
      await this.writeJsonFile(this.workspacePath, remaining, "Enterprise workspaces");
      const bindings = await this.readSkillBindings();
      const remainingBindings = bindings.filter((item) => item.workspaceId !== workspaceId);
      if (remainingBindings.length !== bindings.length) {
        await this.writeJsonFile(this.skillBindingPath, remainingBindings, "Enterprise skill bindings");
      }
      const projects = await this.readProjects();
      const remainingProjects = projects.filter((item) => item.workspaceId !== workspaceId);
      if (remainingProjects.length !== projects.length) {
        await this.writeJsonFile(this.projectPath, remainingProjects, "Enterprise projects");
      }
      const removedProjectIds = new Set(
        projects.filter((item) => item.workspaceId === workspaceId).map((item) => item.id),
      );
      const cards = [...await this.readRoleCards()];
      let cardsChanged = false;
      const detachedCards = cards.map((card) => {
        if (card.assignedWorkspace !== workspaceId && !removedProjectIds.has(card.projectId)) return card;
        cardsChanged = true;
        return {
          ...card,
          assignedWorkspace: card.assignedWorkspace === workspaceId ? "" : card.assignedWorkspace,
          projectId: removedProjectIds.has(card.projectId) ? "" : card.projectId,
          updated_at: formatLegacyTimestamp(this.now()),
        };
      });
      if (cardsChanged) {
        await this.writeJsonFile(this.roleCardPath, detachedCards, "Enterprise role cards");
        await this.syncSandbox(detachedCards);
      }
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, domain: "workspace", id: workspaceId };
    });
  }

  /** 列出企业项目楼层；无输入，返回 Main-owned 规范记录，缺失或损坏文件按空列表处理。 */
  public async listProjects(): Promise<ApplicationEnterpriseProjectListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      projects: await this.readProjects(),
    };
  }

  /** 创建或更新项目楼层；输入项目草稿，校验 Workspace 后分配稳定楼层号并原子写入。 */
  public saveProject(request: unknown): Promise<ApplicationEnterpriseProjectWriteResult> {
    const parsed = requireExactRecord(request, ["project"], "enterprise project request");
    return this.enqueueOperation(async () => {
      const draft = this.parseProjectDraft(parsed.project);
      const workspaces = await this.readWorkspaces();
      if (!workspaces.some((workspace) => workspace.id === draft.workspaceId)) {
        throw new Error("Enterprise project workspace was not found.");
      }
      const projects = [...await this.readProjects()];
      const existingIndex = draft.id ? projects.findIndex((item) => item.id === draft.id) : -1;
      if (draft.id && existingIndex < 0) throw new Error("Enterprise project was not found.");
      const existing = existingIndex >= 0 ? projects[existingIndex] ?? null : null;
      const workspaceProjects = projects.filter((item) => (
        item.workspaceId === draft.workspaceId && item.id !== existing?.id
      ));
      const requestedFloor = draft.floor > 0 ? draft.floor : existing?.floor ?? 0;
      const floor = requestedFloor > 0 && !workspaceProjects.some((item) => item.floor === requestedFloor)
        ? requestedFloor
        : Math.max(0, ...workspaceProjects.map((item) => item.floor)) + 1;
      const timestamp = this.now().toISOString();
      const project: ApplicationEnterpriseProject = {
        ...draft,
        id: draft.id || this.createValidatedId("Project id"),
        floor,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      if (existingIndex >= 0) projects[existingIndex] = project;
      else projects.push(project);
      await this.writeJsonFile(this.projectPath, projects, "Enterprise projects");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, project };
    });
  }

  /** 删除项目楼层；输入稳定 ID，移除楼层并解除角色卡项目指派，历史消息仍保留用于审计。 */
  public removeProject(request: unknown): Promise<ApplicationEnterpriseRemoveResult> {
    const projectId = this.parseIdRequest(request, "projectId", "Project id");
    return this.enqueueOperation(async () => {
      const projects = [...await this.readProjects()];
      const remaining = projects.filter((item) => item.id !== projectId);
      if (remaining.length === projects.length) throw new Error("Enterprise project was not found.");
      const cards = [...await this.readRoleCards()];
      let cardsChanged = false;
      const detachedCards = cards.map((card) => {
        if (card.projectId !== projectId) return card;
        cardsChanged = true;
        return { ...card, projectId: "", updated_at: formatLegacyTimestamp(this.now()) };
      });
      await this.writeJsonFile(this.projectPath, remaining, "Enterprise projects");
      if (cardsChanged) {
        await this.writeJsonFile(this.roleCardPath, detachedCards, "Enterprise role cards");
        await this.syncSandbox(detachedCards);
      }
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, domain: "project", id: projectId };
    });
  }

  /** 查询企业协作消息；输入 Workspace、可选项目和上限，返回按时间升序的有界审计轨迹。 */
  public async listMessages(request: unknown): Promise<ApplicationEnterpriseMessageListResult> {
    const scope = this.parseMessageScope(request);
    await this.requireMessageScope(scope.workspaceId, scope.projectId);
    const messages = (await this.readMessages()).filter((message) => (
      message.workspaceId === scope.workspaceId
      && (scope.projectId === null
        ? message.projectId === null
        : message.projectId === null || message.projectId === scope.projectId)
    ));
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      messages: messages.slice(-scope.limit),
    };
  }

  /** 发布企业领导消息；输入内容和接收员工 ID，由 Main 绑定认证身份、时间与 @员工快照。 */
  public postMessage(request: unknown): Promise<ApplicationEnterpriseMessageWriteResult> {
    const parsed = requireExactRecord(
      request,
      ["workspaceId", "projectId", "recipientIds", "content", "taskId", "traceId"],
      "enterprise message request",
    );
    const workspaceId = requireEnterpriseId(parsed.workspaceId, "Message workspace id");
    const projectId = this.parseOptionalId(parsed.projectId, "Message project id");
    const recipientIds = this.parseRecipientIds(parsed.recipientIds);
    const content = requireText(parsed.content, "Message content", 16_000, true);
    const taskId = this.parseOptionalReference(parsed.taskId, "Message task id");
    const traceId = this.parseOptionalReference(parsed.traceId, "Message trace id");
    return this.enqueueOperation(async () => {
      await this.requireMessageScope(workspaceId, projectId);
      const mentions = await this.resolveMessageMentions(workspaceId, projectId, recipientIds);
      const leader = this.resolveLeaderIdentity();
      const message = this.createMessage({
        workspaceId,
        projectId,
        taskId,
        traceId,
        senderType: "leader",
        senderId: requireEnterpriseId(leader.id, "Message sender id"),
        senderName: requireText(leader.name, "Message sender name", 256, true),
        recipientIds,
        mentions,
        kind: "text",
        content,
        operation: null,
        status: "delivered",
      });
      await this.appendMessage(message);
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, message };
    });
  }

  /** 写入受信任的 AgentTeams 或系统执行轨迹；输入 Main 内部消息，校验身份和范围后持久化。 */
  public recordTrustedMessage(
    input: RecordTrustedApplicationEnterpriseMessageInput,
  ): Promise<ApplicationEnterpriseMessageWriteResult> {
    return this.enqueueOperation(async () => {
      const workspaceId = requireEnterpriseId(input.workspaceId, "Message workspace id");
      const projectId = this.parseOptionalId(input.projectId ?? null, "Message project id");
      const recipientIds = this.parseRecipientIds(input.recipientIds ?? []);
      await this.requireMessageScope(workspaceId, projectId);
      const mentions = await this.resolveMessageMentions(workspaceId, projectId, recipientIds);
      const senderId = requireEnterpriseId(input.senderId, "Message sender id");
      if (input.senderType === "agent") {
        const cards = await this.readRoleCards();
        if (!cards.some((card) => card.id === senderId && card.enabled)) {
          throw new Error("Enterprise message agent identity was not found.");
        }
      }
      const operation = input.operation === undefined || input.operation === null
        ? null
        : parseApplicationNeuroSymbolicOperationEvent(input.operation);
      const message = this.createMessage({
        workspaceId,
        projectId,
        taskId: this.parseOptionalReference(input.taskId ?? null, "Message task id"),
        traceId: this.parseOptionalReference(input.traceId ?? null, "Message trace id"),
        senderType: input.senderType,
        senderId,
        senderName: requireText(input.senderName, "Message sender name", 256, true),
        recipientIds,
        mentions,
        kind: operation === null ? "text" : "operation",
        content: requireText(input.content, "Message content", 16_000, true),
        operation,
        status: input.status ?? "delivered",
      });
      await this.appendMessage(message);
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, message };
    });
  }

  /** 列出企业空间 Skill 绑定；无输入，返回规范化启用状态且不扫描全局技能目录。 */
  public async listSkillBindings(): Promise<ApplicationEnterpriseSkillBindingListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      bindings: await this.readSkillBindings(),
    };
  }

  /** 设置企业空间 Skill 启用状态；输入 Workspace、Skill 和来源事件，幂等覆盖同一绑定。 */
  public setSkillBinding(request: unknown): Promise<ApplicationEnterpriseSkillBindingWriteResult> {
    const parsed = requireExactRecord(
      request,
      ["workspaceId", "skillId", "enabled", "sourceIncidentId"],
      "enterprise skill-binding request",
    );
    const workspaceId = requireEnterpriseId(parsed.workspaceId, "Skill binding workspace id");
    const skillId = requireEnterpriseId(parsed.skillId, "Skill binding skill id");
    if (typeof parsed.enabled !== "boolean") throw new Error("Skill binding enabled flag is invalid.");
    const sourceIncidentId = parsed.sourceIncidentId === null || parsed.sourceIncidentId === undefined
      ? null
      : requireEnterpriseId(parsed.sourceIncidentId, "Skill binding source incident id");
    const enabled = parsed.enabled;
    return this.enqueueOperation(async () => {
      const bindings = [...await this.readSkillBindings()];
      const existingIndex = bindings.findIndex((item) => item.workspaceId === workspaceId && item.skillId === skillId);
      const existing = existingIndex >= 0 ? bindings[existingIndex] ?? null : null;
      const timestamp = this.now().toISOString();
      const binding: ApplicationEnterpriseSkillBinding = {
        workspaceId,
        skillId,
        enabled,
        sourceIncidentId: sourceIncidentId ?? existing?.sourceIncidentId ?? null,
        enabledAt: enabled ? existing?.enabledAt ?? timestamp : null,
        updatedAt: timestamp,
      };
      if (existingIndex >= 0) bindings[existingIndex] = binding;
      else bindings.push(binding);
      await this.writeJsonFile(this.skillBindingPath, bindings, "Enterprise skill bindings");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, binding };
    });
  }

  /** 读取并同步企业沙盘；无输入，返回角色卡投影和场景，不启动 Agent、Worker 或 Python。 */
  public getSandboxState(): Promise<ApplicationEnterpriseSandboxStateResult> {
    return this.enqueueOperation(async () => {
      const document = await this.syncSandbox(await this.readRoleCards());
      return {
        schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
        success: true,
        agents: document.agents,
        scene: document.scene,
      };
    });
  }

  /** 列出 Xnet 服务配置；无输入，返回固定三项，不执行健康检查或访问网络。 */
  public async listXnetServices(): Promise<ApplicationEnterpriseXnetServiceListResult> {
    return {
      schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA,
      success: true,
      services: await this.readXnetServices(),
    };
  }

  /** 保存一个 Xnet URL 和自动连接标志；输入固定服务键和 URL，返回配置，URL 变化时清除旧健康状态。 */
  public saveXnetService(request: unknown): Promise<ApplicationEnterpriseXnetServiceWriteResult> {
    const parsed = requireExactRecord(request, ["serviceKey", "url", "autoConnect"], "Xnet service request");
    const serviceKey = this.requireXnetServiceKey(parsed.serviceKey);
    if (typeof parsed.autoConnect !== "boolean") throw new Error("Xnet auto-connect flag is invalid.");
    const url = this.requireXnetUrl(parsed.url);
    return this.enqueueOperation(async () => {
      const services = { ...await this.readXnetServices() };
      const previous = services[serviceKey];
      const service: ApplicationEnterpriseXnetService = {
        ...previous,
        url,
        auto_connect: parsed.autoConnect as boolean,
        status: url === previous.url && url ? previous.status : "offline",
        last_check: url === previous.url && url ? previous.last_check : "",
      };
      services[serviceKey] = service;
      await this.writeJsonFile(this.xnetServicesPath, services, "Xnet services");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, serviceKey, service };
    });
  }

  /** 检查一个已保存 Xnet 服务；输入固定服务键，返回最新状态，只访问已校验 URL且不跟随重定向。 */
  public checkXnetService(request: unknown): Promise<ApplicationEnterpriseXnetServiceWriteResult> {
    const serviceKey = this.parseXnetRequest(request);
    return this.enqueueOperation(async () => {
      const services = { ...await this.readXnetServices() };
      const service = await this.checkService(serviceKey, services[serviceKey]);
      services[serviceKey] = service;
      await this.writeJsonFile(this.xnetServicesPath, services, "Xnet services");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, serviceKey, service };
    });
  }

  /** 批量检查已保存 Xnet 服务；输入 autoOnly 标志，返回完整三项状态，空 URL 和非自动项不会访问网络。 */
  public checkAllXnetServices(request: unknown): Promise<ApplicationEnterpriseXnetServiceListResult> {
    const parsed = requireExactRecord(request, ["autoOnly"], "Xnet health-check request");
    if (typeof parsed.autoOnly !== "boolean") throw new Error("Xnet auto-only flag is invalid.");
    return this.enqueueOperation(async () => {
      const services = { ...await this.readXnetServices() };
      for (const serviceKey of ["dataops", "mlops", "aiops"] as const) {
        const service = services[serviceKey];
        if (!service.url || (parsed.autoOnly && !service.auto_connect)) continue;
        services[serviceKey] = await this.checkService(serviceKey, service);
      }
      await this.writeJsonFile(this.xnetServicesPath, services, "Xnet services");
      return { schema: APPLICATION_ENTERPRISE_RUNTIME_SCHEMA, success: true, services };
    });
  }

  /** 解析角色卡草稿；输入未知值，返回所有字段完整的有界记录，未知字段或非法数组时抛错。 */
  private parseRoleCardDraft(value: unknown): Omit<ApplicationEnterpriseRoleCard, "created_at" | "updated_at"> {
    const fields = [
      "id", "name", "description", "system_prompt", "permissions", "tools", "enabled", "department", "icon",
      "skills", "skill_ids", "assignedWorkspace", "projectId", "templateId", "category", "categoryZh", "categoryEn",
      "summaryZh", "summaryEn", "accent", "runtime_system_prompt", "agent_name", "role_scope", "syncSource",
      "bodyType", "position3D", "created_at", "updated_at",
    ];
    const draft = requireExactRecord(value, fields, "enterprise role card");
    if (draft.enabled !== undefined && typeof draft.enabled !== "boolean") throw new Error("Role card enabled flag is invalid.");
    let position3D: { readonly x: number; readonly z: number } | null = null;
    if (draft.position3D !== undefined && draft.position3D !== null) {
      const position = requireExactRecord(draft.position3D, ["x", "z"], "role-card position");
      if (typeof position.x !== "number" || typeof position.z !== "number" || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
        throw new Error("Role-card position is invalid.");
      }
      position3D = {
        x: readBoundedNumber(position.x, 0, -10_000, 10_000),
        z: readBoundedNumber(position.z, 0, -10_000, 10_000),
      };
    }
    const id = draft.id === undefined || draft.id === "" ? "" : requireEnterpriseId(draft.id, "Role card id");
    return {
      id,
      name: requireText(draft.name, "Role card name", 160, true),
      description: requireText(draft.description, "Role card description", 16_000),
      system_prompt: requireText(draft.system_prompt, "Role card system prompt", MAX_ROLE_TEXT_BYTES),
      permissions: requireTextList(draft.permissions, "Role card permissions"),
      tools: requireTextList(draft.tools, "Role card tools"),
      enabled: draft.enabled !== false,
      department: requireText(draft.department, "Role card department", 160),
      icon: requireText(draft.icon, "Role card icon", 160),
      skills: requireTextList(draft.skills, "Role card skills"),
      skill_ids: requireTextList(draft.skill_ids, "Role card skill ids"),
      assignedWorkspace: requireText(draft.assignedWorkspace, "Role card workspace", 128),
      projectId: requireText(draft.projectId, "Role card project", 128),
      templateId: requireText(draft.templateId, "Role card template", 128),
      category: requireText(draft.category, "Role card category", 160),
      categoryZh: requireText(draft.categoryZh, "Role card Chinese category", 160),
      categoryEn: requireText(draft.categoryEn, "Role card English category", 160),
      summaryZh: requireText(draft.summaryZh, "Role card Chinese summary", 4000),
      summaryEn: requireText(draft.summaryEn, "Role card English summary", 4000),
      accent: requireTextList(draft.accent, "Role card accents", 8),
      runtime_system_prompt: requireText(draft.runtime_system_prompt, "Role card runtime prompt", MAX_ROLE_TEXT_BYTES),
      agent_name: requireText(draft.agent_name, "Role card agent name", 160),
      role_scope: requireText(draft.role_scope, "Role card scope", 80) || "enterprise",
      syncSource: requireText(draft.syncSource, "Role card sync source", 80) || "enterprise",
      bodyType: requireText(draft.bodyType, "Role card body type", 80) || "default",
      position3D,
    };
  }

  /** 解析团队模板草稿；输入未知值，返回完整有界结构，成员重复、职责非法或 leader 数量错误时抛错。 */
  private parseTeamTemplateDraft(
    value: unknown,
  ): Omit<ApplicationEnterpriseTeamTemplate, "version" | "created_at" | "updated_at"> {
    const draft = requireExactRecord(value, [
      "id", "schemaVersion", "version", "name", "description", "workspaceId", "enabled", "members", "created_at", "updated_at",
    ], "enterprise team template");
    if (
      draft.schemaVersion !== undefined
      && draft.schemaVersion !== APPLICATION_ENTERPRISE_TEAM_TEMPLATE_SCHEMA_VERSION
    ) {
      throw new Error("Enterprise team-template schema version is invalid.");
    }
    if (draft.enabled !== undefined && typeof draft.enabled !== "boolean") {
      throw new Error("Enterprise team-template enabled flag is invalid.");
    }
    if (!Array.isArray(draft.members) || draft.members.length < 3 || draft.members.length > MAX_TEAM_TEMPLATE_MEMBERS) {
      throw new Error("Enterprise team template must contain between 3 and 20 members.");
    }
    const members = draft.members.map((value, index) => {
      const member = requireExactRecord(value, ["roleCardId", "teamRole"], `team-template member ${index + 1}`);
      if (typeof member.teamRole !== "string" || !TEAM_MEMBER_ROLES.has(member.teamRole as ApplicationEnterpriseTeamMemberRole)) {
        throw new Error("Enterprise team-template member role is invalid.");
      }
      return {
        roleCardId: requireEnterpriseId(member.roleCardId, "Team-template role card id"),
        teamRole: member.teamRole as ApplicationEnterpriseTeamMemberRole,
      };
    });
    if (new Set(members.map((member) => member.roleCardId)).size !== members.length) {
      throw new Error("Enterprise team-template members must be unique.");
    }
    if (members.filter((member) => member.teamRole === "leader").length !== 1) {
      throw new Error("Enterprise team template must contain exactly one leader.");
    }
    return {
      id: draft.id === undefined || draft.id === "" ? "" : requireEnterpriseId(draft.id, "Team template id"),
      schemaVersion: APPLICATION_ENTERPRISE_TEAM_TEMPLATE_SCHEMA_VERSION,
      name: requireText(draft.name, "Team template name", 160, true),
      description: requireText(draft.description, "Team template description", 4000),
      workspaceId: requireEnterpriseId(draft.workspaceId, "Team template workspace id"),
      enabled: draft.enabled !== false,
      members,
    };
  }

  /** 校验模板引用的角色卡；输入成员和角色集合，无返回，成员缺失或停用时抛错。 */
  private requireAvailableTeamMembers(
    members: readonly { readonly roleCardId: string }[],
    roleCards: readonly ApplicationEnterpriseRoleCard[],
  ): void {
    const cardsById = new Map(roleCards.map((card) => [card.id, card] as const));
    for (const member of members) {
      const card = cardsById.get(member.roleCardId);
      if (card === undefined) throw new Error(`Enterprise team member '${member.roleCardId}' was not found.`);
      if (!card.enabled) throw new Error(`Enterprise team member '${member.roleCardId}' is disabled.`);
    }
  }

  /** 解析企业环境草稿；输入未知值，返回完整结构，未知字段、枚举或嵌套字段非法时抛错。 */
  private parseWorkspaceDraft(value: unknown): Omit<ApplicationEnterpriseWorkspace, "created_at" | "updated_at"> {
    const draft = requireExactRecord(
      value,
      ["id", "name", "type", "status", "config", "role_card_id", "created_at", "updated_at"],
      "enterprise workspace",
    );
    if (typeof draft.type !== "string" || !WORKSPACE_TYPES.has(draft.type as ApplicationEnterpriseWorkspaceType)) {
      throw new Error("Enterprise workspace type is invalid.");
    }
    const status = draft.status ?? "stopped";
    if (status !== "stopped" && status !== "running" && status !== "error") throw new Error("Workspace status is invalid.");
    const id = draft.id === undefined || draft.id === "" ? "" : requireEnterpriseId(draft.id, "Workspace id");
    return {
      id,
      name: requireText(draft.name, "Workspace name", 160, true),
      type: draft.type as ApplicationEnterpriseWorkspaceType,
      status,
      config: this.parseWorkspaceConfig(draft.config),
      role_card_id: draft.role_card_id === null || draft.role_card_id === undefined || draft.role_card_id === ""
        ? null
        : requireEnterpriseId(draft.role_card_id, "Workspace role card id"),
    };
  }

  /** 解析企业环境嵌套配置；输入未知值，返回四类完整配置，未知字段、端口或预算非法时抛错。 */
  private parseWorkspaceConfig(value: unknown): ApplicationEnterpriseWorkspaceConfig {
    const config = requireExactRecord(value, ["local", "docker", "cloud", "sandbox"], "workspace config");
    const local = requireExactRecord(config.local ?? {}, ["path", "permission_mode"], "local workspace config");
    const docker = requireExactRecord(config.docker ?? {}, ["image", "daemon_url", "container_id"], "Docker workspace config");
    const cloud = requireExactRecord(config.cloud ?? {}, ["host", "port", "user", "key_path"], "cloud workspace config");
    const sandbox = requireExactRecord(config.sandbox ?? {}, ["image", "ttl_hours"], "sandbox workspace config");
    const port = Math.trunc(readBoundedNumber(cloud.port, 22, 1, 65_535));
    if (cloud.port !== undefined && (typeof cloud.port !== "number" || !Number.isInteger(cloud.port) || port !== cloud.port)) {
      throw new Error("Cloud workspace port is invalid.");
    }
    const ttlHours = Math.trunc(readBoundedNumber(sandbox.ttl_hours, 24, 1, 24 * 365));
    if (sandbox.ttl_hours !== undefined && (typeof sandbox.ttl_hours !== "number" || !Number.isInteger(sandbox.ttl_hours))) {
      throw new Error("Sandbox TTL is invalid.");
    }
    return {
      local: {
        path: requireText(local.path, "Local workspace path", 32_768),
        permission_mode: requireText(local.permission_mode, "Local workspace permission mode", 80) || "default",
      },
      docker: {
        image: requireText(docker.image, "Docker workspace image", 512) || "ubuntu:22.04",
        daemon_url: requireText(docker.daemon_url, "Docker daemon URL", 2048),
        container_id: requireText(docker.container_id, "Docker container id", 160),
      },
      cloud: {
        host: requireText(cloud.host, "Cloud workspace host", 512),
        port,
        user: requireText(cloud.user, "Cloud workspace user", 160) || "root",
        key_path: requireText(cloud.key_path, "Cloud workspace key path", 32_768),
      },
      sandbox: {
        image: requireText(sandbox.image, "Sandbox workspace image", 512) || "openxnet/sandbox:latest",
        ttl_hours: ttlHours,
      },
    };
  }

  /** 解析项目楼层草稿；输入未知值，返回完整有界字段，颜色、楼层或未知字段非法时抛错。 */
  private parseProjectDraft(value: unknown): Omit<ApplicationEnterpriseProject, "createdAt" | "updatedAt"> {
    const draft = requireExactRecord(
      value,
      ["id", "workspaceId", "name", "description", "color", "icon", "floor", "createdAt", "updatedAt"],
      "enterprise project",
    );
    const color = requireText(draft.color, "Project color", 32) || "#4ecdc4";
    if (!PROJECT_COLOR_PATTERN.test(color)) throw new Error("Enterprise project color is invalid.");
    const floor = draft.floor === undefined
      ? 0
      : Math.trunc(readBoundedNumber(draft.floor, 0, 1, 10_000));
    if (draft.floor !== undefined && (typeof draft.floor !== "number" || !Number.isInteger(draft.floor) || floor !== draft.floor)) {
      throw new Error("Enterprise project floor is invalid.");
    }
    return {
      id: draft.id === undefined || draft.id === "" ? "" : requireEnterpriseId(draft.id, "Project id"),
      workspaceId: requireEnterpriseId(draft.workspaceId, "Project workspace id"),
      name: requireText(draft.name, "Project name", 160, true),
      description: requireText(draft.description, "Project description", 4_000),
      color,
      icon: requireText(draft.icon, "Project icon", 160) || "fa-solid fa-folder",
      floor,
    };
  }

  /** 解析消息查询范围；输入未知请求，返回 Workspace、项目和数量限制，非法字段时抛错。 */
  private parseMessageScope(value: unknown): { readonly workspaceId: string; readonly projectId: string | null; readonly limit: number } {
    const request = requireExactRecord(value, ["workspaceId", "projectId", "limit"], "enterprise message query");
    if (typeof request.limit !== "number" || !Number.isInteger(request.limit)) {
      throw new Error("Enterprise message query limit is invalid.");
    }
    const limit = Math.trunc(readBoundedNumber(request.limit, 100, 1, MAX_ENTERPRISE_MESSAGE_QUERY));
    if (limit !== request.limit) throw new Error("Enterprise message query limit is invalid.");
    return {
      workspaceId: requireEnterpriseId(request.workspaceId, "Message workspace id"),
      projectId: this.parseOptionalId(request.projectId, "Message project id"),
      limit,
    };
  }

  /** 解析可空企业 ID；输入未知值和标签，返回稳定 ID 或 null，非法文本时抛错。 */
  private parseOptionalId(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === "") return null;
    return requireEnterpriseId(value, label);
  }

  /** 解析可空任务或 Trace 引用；输入未知值和标签，返回有界文本或 null。 */
  private parseOptionalReference(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === "") return null;
    return requireText(value, label, 256, true);
  }

  /** 解析企业消息接收员工；输入未知数组，返回去重稳定 ID，超限或非法时抛错。 */
  private parseRecipientIds(value: unknown): readonly string[] {
    if (!Array.isArray(value) || value.length > MAX_ENTERPRISE_MESSAGE_RECIPIENTS) {
      throw new Error("Enterprise message recipients are invalid.");
    }
    const recipients = value.map((item) => requireEnterpriseId(item, "Message recipient id"));
    if (new Set(recipients).size !== recipients.length) {
      throw new Error("Enterprise message recipients must be unique.");
    }
    return recipients;
  }

  /** 校验消息所在 Workspace 与项目；输入范围，无返回，缺失或跨 Workspace 时抛错。 */
  private async requireMessageScope(workspaceId: string, projectId: string | null): Promise<void> {
    const workspaces = await this.readWorkspaces();
    if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
      throw new Error("Enterprise message workspace was not found.");
    }
    if (projectId === null) return;
    const projects = await this.readProjects();
    if (!projects.some((project) => project.id === projectId && project.workspaceId === workspaceId)) {
      throw new Error("Enterprise message project scope is invalid.");
    }
  }

  /** 解析消息 @员工快照；输入范围和角色 ID，返回稳定名称快照，越权或停用角色时抛错。 */
  private async resolveMessageMentions(
    workspaceId: string,
    projectId: string | null,
    recipientIds: readonly string[],
  ): Promise<readonly { readonly roleCardId: string; readonly name: string }[]> {
    const cards = await this.readRoleCards();
    const cardsById = new Map(cards.map((card) => [card.id, card] as const));
    return recipientIds.map((roleCardId) => {
      const card = cardsById.get(roleCardId);
      const belongsToWorkspace = card?.assignedWorkspace === workspaceId
        || (projectId !== null && card?.projectId === projectId);
      const belongsToProject = projectId === null || !card?.projectId || card.projectId === projectId;
      if (card === undefined || !card.enabled || !belongsToWorkspace || !belongsToProject) {
        throw new Error(`Enterprise message recipient '${roleCardId}' is outside the current scope.`);
      }
      return { roleCardId: card.id, name: card.name };
    });
  }

  /** 构造 Main-owned 企业消息；输入已校验字段，返回带唯一 ID 和时间的不可伪造记录。 */
  private createMessage(
    value: Omit<ApplicationEnterpriseMessage, "id" | "createdAt">,
  ): ApplicationEnterpriseMessage {
    if (value.status !== "delivered" && value.status !== "failed") {
      throw new Error("Enterprise message status is invalid.");
    }
    return {
      ...value,
      id: this.createValidatedId("Message id"),
      createdAt: this.now().toISOString(),
    };
  }

  /** 追加一条企业消息；输入完整消息，无返回，达到审计容量时拒绝且不覆盖历史。 */
  private async appendMessage(message: ApplicationEnterpriseMessage): Promise<void> {
    const messages = [...await this.readMessages()];
    if (messages.length >= MAX_ENTERPRISE_MESSAGES) {
      throw new Error("Enterprise message audit capacity is full.");
    }
    if (messages.some((item) => item.id === message.id)) {
      throw new Error("Enterprise message id already exists.");
    }
    messages.push(message);
    await this.writeJsonFile(this.messagePath, messages, "Enterprise messages");
  }

  /** 读取并规范角色卡兼容文件；无输入，返回最多 2000 条，损坏项被忽略。 */
  private async readRoleCards(): Promise<readonly ApplicationEnterpriseRoleCard[]> {
    const values = await this.readRecordArray(this.roleCardPath, "Enterprise role cards");
    const now = formatLegacyTimestamp(this.now());
    return values.flatMap((value) => {
      try {
        const compatible = this.pickFields(value, [
          "id", "name", "description", "system_prompt", "permissions", "tools", "enabled", "department", "icon",
          "skills", "skill_ids", "assignedWorkspace", "projectId", "templateId", "category", "categoryZh", "categoryEn",
          "summaryZh", "summaryEn", "accent", "runtime_system_prompt", "agent_name", "role_scope", "syncSource",
          "bodyType", "position3D", "created_at", "updated_at",
        ]);
        const draft = this.parseRoleCardDraft(compatible);
        return [{
          ...draft,
          id: draft.id || this.createValidatedId("Role card id"),
          created_at: readTimestamp(value.created_at, now),
          updated_at: readTimestamp(value.updated_at, now),
        }];
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise role card.", error);
        return [];
      }
    });
  }

  /** 读取并规范团队模板文件；无输入，返回有效模板，旧记录缺省版本时迁移为第一版。 */
  private async readTeamTemplates(): Promise<readonly ApplicationEnterpriseTeamTemplate[]> {
    const values = await this.readRecordArray(this.teamTemplatePath, "Enterprise team templates");
    const now = formatLegacyTimestamp(this.now());
    return values.flatMap((value) => {
      try {
        const compatible = this.pickFields(value, [
          "id", "schemaVersion", "version", "name", "description", "workspaceId", "enabled", "members", "created_at", "updated_at",
        ]);
        const draft = this.parseTeamTemplateDraft(compatible);
        return [{
          ...draft,
          id: draft.id || this.createValidatedId("Team template id"),
          version: Math.trunc(readBoundedNumber(value.version, 1, 1, 1_000_000_000)),
          created_at: readTimestamp(value.created_at, now),
          updated_at: readTimestamp(value.updated_at, now),
        }];
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise team template.", error);
        return [];
      }
    });
  }

  /** 读取并规范知识库兼容文件；无输入，返回最多 2000 条，损坏项被忽略。 */
  private async readKnowledgeBases(): Promise<readonly ApplicationEnterpriseKnowledgeBase[]> {
    const values = await this.readRecordArray(this.knowledgeBasePath, "Enterprise knowledge bases");
    const now = formatLegacyTimestamp(this.now());
    return values.flatMap((value) => {
      try {
        return [{
          id: requireEnterpriseId(value.id, "Knowledge base id"),
          name: requireText(value.name, "Knowledge base name", 160, true),
          description: requireText(value.description, "Knowledge base description", 4000),
          category: requireText(value.category, "Knowledge base category", 160),
          doc_count: Math.trunc(readBoundedNumber(value.doc_count, 0, 0, 1_000_000_000)),
          version: Math.trunc(readBoundedNumber(value.version, 1, 1, 1_000_000_000)),
          created_at: readTimestamp(value.created_at, now),
          updated_at: readTimestamp(value.updated_at, now),
        }];
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise knowledge base.", error);
        return [];
      }
    });
  }

  /** 读取并规范环境兼容文件；无输入，返回最多 2000 条，旧缺省配置被补齐。 */
  private async readWorkspaces(): Promise<readonly ApplicationEnterpriseWorkspace[]> {
    const values = await this.readRecordArray(this.workspacePath, "Enterprise workspaces");
    return values.flatMap((value) => {
      try {
        const compatible = {
          ...this.pickFields(value, ["id", "name", "type", "status", "role_card_id", "created_at", "updated_at"]),
          config: this.normalizeStoredWorkspaceConfig(value.config),
        };
        const draft = this.parseWorkspaceDraft(compatible);
        const now = this.now().toISOString();
        return [{
          ...draft,
          id: draft.id || this.createValidatedId("Workspace id"),
          created_at: readTimestamp(value.created_at, now),
          updated_at: readTimestamp(value.updated_at, now),
        }];
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise workspace.", error);
        return [];
      }
    });
  }

  /** 读取并规范项目楼层文件；无输入，返回按 Workspace 和楼层排序的有效记录，损坏项被忽略。 */
  private async readProjects(): Promise<readonly ApplicationEnterpriseProject[]> {
    const values = await this.readRecordArray(this.projectPath, "Enterprise projects");
    const projects = values.flatMap((value) => {
      try {
        const compatible = this.pickFields(value, [
          "id", "workspaceId", "name", "description", "color", "icon", "floor", "createdAt", "updatedAt",
        ]);
        const draft = this.parseProjectDraft(compatible);
        const timestamp = this.now().toISOString();
        return [{
          ...draft,
          id: draft.id || this.createValidatedId("Project id"),
          floor: draft.floor || 1,
          createdAt: readTimestamp(value.createdAt, timestamp),
          updatedAt: readTimestamp(value.updatedAt, timestamp),
        }];
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise project.", error);
        return [];
      }
    });
    return projects.sort((left, right) => (
      left.workspaceId.localeCompare(right.workspaceId) || left.floor - right.floor
    ));
  }

  /** 读取并规范企业消息文件；无输入，返回最多一万条可审计记录，损坏项被忽略。 */
  private async readMessages(): Promise<readonly ApplicationEnterpriseMessage[]> {
    const values = await this.readRecordArray(this.messagePath, "Enterprise messages", MAX_ENTERPRISE_MESSAGES);
    const messages = values.flatMap((value) => {
      try {
        const senderType = value.senderType as ApplicationEnterpriseMessageSenderType;
        const operation = value.operation === undefined || value.operation === null
          ? null
          : parseApplicationNeuroSymbolicOperationEvent(value.operation);
        const kind = (value.kind === undefined
          ? (operation === null ? "text" : "operation")
          : value.kind) as ApplicationEnterpriseMessageKind;
        const status = value.status as ApplicationEnterpriseMessageStatus;
        if (senderType !== "leader" && senderType !== "agent" && senderType !== "system") {
          throw new Error("Enterprise message sender type is invalid.");
        }
        if (status !== "delivered" && status !== "failed") {
          throw new Error("Enterprise message status is invalid.");
        }
        if ((kind !== "text" && kind !== "operation") || (kind === "operation") !== (operation !== null)) {
          throw new Error("Enterprise message kind is invalid.");
        }
        const recipientIds = this.parseRecipientIds(value.recipientIds);
        if (!Array.isArray(value.mentions) || value.mentions.length !== recipientIds.length) {
          throw new Error("Enterprise message mentions are invalid.");
        }
        const mentions = value.mentions.map((item) => {
          const mention = requireExactRecord(item, ["roleCardId", "name"], "enterprise message mention");
          return {
            roleCardId: requireEnterpriseId(mention.roleCardId, "Message mention role id"),
            name: requireText(mention.name, "Message mention name", 256, true),
          };
        });
        if (mentions.some((mention, index) => mention.roleCardId !== recipientIds[index])) {
          throw new Error("Enterprise message mention order is invalid.");
        }
        return [{
          id: requireEnterpriseId(value.id, "Message id"),
          workspaceId: requireEnterpriseId(value.workspaceId, "Message workspace id"),
          projectId: this.parseOptionalId(value.projectId, "Message project id"),
          taskId: this.parseOptionalReference(value.taskId, "Message task id"),
          traceId: this.parseOptionalReference(value.traceId, "Message trace id"),
          senderType,
          senderId: requireEnterpriseId(value.senderId, "Message sender id"),
          senderName: requireText(value.senderName, "Message sender name", 256, true),
          recipientIds,
          mentions,
          kind,
          content: requireText(value.content, "Message content", 16_000, true),
          operation,
          status,
          createdAt: readTimestamp(value.createdAt, this.now().toISOString()),
        }];
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise message.", error);
        return [];
      }
    });
    return messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  /** 读取并规范企业 Skill 绑定；无输入，返回唯一 Workspace/Skill 组合，损坏项被忽略。 */
  private async readSkillBindings(): Promise<readonly ApplicationEnterpriseSkillBinding[]> {
    const values = await this.readRecordArray(this.skillBindingPath, "Enterprise skill bindings");
    const bindings = new Map<string, ApplicationEnterpriseSkillBinding>();
    for (const value of values) {
      try {
        const workspaceId = requireEnterpriseId(value.workspaceId, "Skill binding workspace id");
        const skillId = requireEnterpriseId(value.skillId, "Skill binding skill id");
        if (typeof value.enabled !== "boolean") throw new Error("Skill binding enabled flag is invalid.");
        const sourceIncidentId = value.sourceIncidentId === null || value.sourceIncidentId === undefined
          ? null
          : requireEnterpriseId(value.sourceIncidentId, "Skill binding source incident id");
        const updatedAt = readTimestamp(value.updatedAt, this.now().toISOString());
        bindings.set(`${workspaceId}\u0000${skillId}`, {
          workspaceId,
          skillId,
          enabled: value.enabled,
          sourceIncidentId,
          enabledAt: value.enabled ? readTimestamp(value.enabledAt, updatedAt) : null,
          updatedAt,
        });
      } catch (error) {
        this.logger.warn("Ignored invalid enterprise skill binding.", error);
      }
    }
    return [...bindings.values()].sort((left, right) => (
      left.workspaceId.localeCompare(right.workspaceId) || left.skillId.localeCompare(right.skillId)
    ));
  }

  /** 补齐旧环境缺失的四类配置；输入未知配置，返回普通对象，不修改原值。 */
  private normalizeStoredWorkspaceConfig(value: unknown): Readonly<Record<string, unknown>> {
    const config = isPlainRecord(value) ? value : {};
    return {
      local: { path: "", permission_mode: "default", ...(isPlainRecord(config.local) ? config.local : {}) },
      docker: { image: "ubuntu:22.04", daemon_url: "", container_id: "", ...(isPlainRecord(config.docker) ? config.docker : {}) },
      cloud: { host: "", port: 22, user: "root", key_path: "", ...(isPlainRecord(config.cloud) ? config.cloud : {}) },
      sandbox: { image: "openxnet/sandbox:latest", ttl_hours: 24, ...(isPlainRecord(config.sandbox) ? config.sandbox : {}) },
    };
  }

  /** 同步可重建的沙盘角色投影；输入角色卡，返回最新文档，派生文件写入失败时记录警告但不影响主记录结果。 */
  private async syncSandbox(cards: readonly ApplicationEnterpriseRoleCard[]): Promise<EnterpriseSandboxDocument> {
    const stored = await this.readSandboxDocument();
    const existingAgents = new Map(stored.agents.map((agent) => [String(agent.id ?? ""), agent]));
    const agents = cards.map((card, index) => this.projectSandboxAgent(card, existingAgents.get(card.id), index));
    const document = { agents, scene: stored.scene };
    try {
      await this.writeJsonFile(this.sandboxPath, document, "Enterprise sandbox");
    } catch (error) {
      this.logger.warn("Enterprise sandbox projection could not be persisted and will be rebuilt later.", error);
    }
    return document;
  }

  /** 把角色卡投影为沙盘 Agent；输入角色、旧 Agent 和序号，返回有界对象，无文件副作用。 */
  private projectSandboxAgent(
    card: ApplicationEnterpriseRoleCard,
    existing: Readonly<Record<string, unknown>> | undefined,
    index: number,
  ): Readonly<Record<string, unknown>> {
    const existingPosition = isPlainRecord(existing?.position) ? existing.position : {};
    const configuredPosition = card.position3D;
    const column = index % 4;
    const row = Math.floor(index / 4);
    const position = configuredPosition ?? {
      x: readBoundedNumber(existingPosition.x, 2 + column * 3, -10_000, 10_000),
      z: readBoundedNumber(existingPosition.z, 2 + row * 4, -10_000, 10_000),
    };
    const status = ["idle", "working", "error", "thinking"].includes(String(existing?.status))
      ? String(existing?.status)
      : "idle";
    const metrics = isPlainRecord(existing?.metrics) ? existing.metrics : {};
    return {
      id: card.id,
      name: card.name,
      role: card.name,
      department: card.department,
      assignedWorkspace: card.assignedWorkspace,
      projectId: card.projectId,
      skills: card.skills,
      skill_ids: card.skill_ids,
      icon: card.icon,
      summaryZh: card.summaryZh,
      summaryEn: card.summaryEn,
      templateId: card.templateId,
      category: card.category,
      runtime_system_prompt: card.runtime_system_prompt,
      bodyType: card.bodyType,
      status,
      current_task: existing?.current_task ?? null,
      position: { x: position.x, y: 0, z: position.z },
      target_position: existing?.target_position ?? null,
      animation: typeof existing?.animation === "string" ? existing.animation.slice(0, 32) : "idle",
      avatar_color: typeof existing?.avatar_color === "string" ? existing.avatar_color.slice(0, 32) : AGENT_COLORS[index % AGENT_COLORS.length],
      metrics: {
        tasks_today: Math.trunc(readBoundedNumber(metrics.tasks_today, 0, 0, 1_000_000_000)),
        tasks_total: Math.trunc(readBoundedNumber(metrics.tasks_total, 0, 0, 1_000_000_000)),
        avg_response_ms: readBoundedNumber(metrics.avg_response_ms, 0, 0, 86_400_000),
        uptime_minutes: readBoundedNumber(metrics.uptime_minutes, 0, 0, 1_000_000_000),
      },
      enabled: card.enabled,
    };
  }

  /** 读取沙盘兼容文件；无输入，返回有界 Agent/scene，缺失或损坏时使用默认场景。 */
  private async readSandboxDocument(): Promise<EnterpriseSandboxDocument> {
    try {
      const value = await this.readJsonFile(this.sandboxPath, "Enterprise sandbox");
      if (!isPlainRecord(value)) throw new Error("Enterprise sandbox is invalid.");
      const agents = Array.isArray(value.agents)
        ? value.agents.filter(isPlainRecord).slice(0, MAX_ENTERPRISE_RECORDS).map((item) => cloneBoundedJson(item, 512 * 1024, "Sandbox agent"))
        : [];
      const scene = isPlainRecord(value.scene)
        ? cloneBoundedJson(value.scene, 4 * 1024 * 1024, "Sandbox scene")
        : cloneBoundedJson(DEFAULT_SCENE, 4 * 1024 * 1024, "Sandbox scene");
      return { agents, scene };
    } catch {
      return { agents: [], scene: cloneBoundedJson(DEFAULT_SCENE, 4 * 1024 * 1024, "Sandbox scene") };
    }
  }

  /** 读取固定 Xnet 服务配置；无输入，返回三项规范记录，损坏或缺失字段使用默认值。 */
  private async readXnetServices(): Promise<Record<ApplicationEnterpriseXnetServiceKey, ApplicationEnterpriseXnetService>> {
    let stored: Readonly<Record<string, unknown>> = {};
    try {
      const value = await this.readJsonFile(this.xnetServicesPath, "Xnet services");
      if (isPlainRecord(value)) stored = value;
    } catch {
      // 缺失或损坏配置使用固定默认值。
    }
    const result = {} as Record<ApplicationEnterpriseXnetServiceKey, ApplicationEnterpriseXnetService>;
    const names: Record<ApplicationEnterpriseXnetServiceKey, string> = {
      dataops: "XnetDataOps",
      mlops: "XnetMLOps",
      aiops: "XnetAIOps",
    };
    for (const serviceKey of ["dataops", "mlops", "aiops"] as const) {
      const value = isPlainRecord(stored[serviceKey]) ? stored[serviceKey] : {};
      let url = "";
      try {
        url = this.requireXnetUrl(value.url);
      } catch {
        // 非法旧 URL 不进入 Renderer 或网络边界。
      }
      result[serviceKey] = {
        name: names[serviceKey],
        url,
        status: value.status === "online" && url ? "online" : "offline",
        last_check: url ? readTimestamp(value.last_check, "") : "",
        auto_connect: value.auto_connect === true,
      };
    }
    return result;
  }

  /** 对单个 Xnet 服务执行 5 秒健康检查；输入键和保存配置，返回新状态，不跟随重定向或读取响应体。 */
  private async checkService(
    serviceKey: ApplicationEnterpriseXnetServiceKey,
    service: ApplicationEnterpriseXnetService,
  ): Promise<ApplicationEnterpriseXnetService> {
    if (!service.url) return { ...service, status: "offline", last_check: "" };
    const url = this.requireXnetUrl(service.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    let status: "online" | "offline" = "offline";
    try {
      const response = await this.fetchResource(url, { method: "GET", redirect: "manual", signal: controller.signal });
      status = response.status >= 200 && response.status < 500 && !(response.status >= 300 && response.status < 400)
        ? "online"
        : "offline";
    } catch (error) {
      this.logger.warn(`Xnet health check failed for ${serviceKey}.`, error);
    } finally {
      clearTimeout(timeout);
    }
    return { ...service, status, last_check: this.now().toISOString() };
  }

  /** 校验 Xnet URL；输入未知值，返回规范 URL，空值允许，非 HTTPS 或非回环 HTTP、凭据、查询和片段时抛错。 */
  private requireXnetUrl(value: unknown): string {
    const normalized = requireText(value, "Xnet service URL", 2048);
    if (!normalized) return "";
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
    if (
      parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))
    ) {
      throw new Error("Xnet service URL is not allowed.");
    }
    return parsed.toString();
  }

  /** 校验固定 Xnet 服务键；输入未知值，返回联合类型，未知键时抛错。 */
  private requireXnetServiceKey(value: unknown): ApplicationEnterpriseXnetServiceKey {
    if (typeof value !== "string" || !XNET_SERVICE_KEYS.has(value as ApplicationEnterpriseXnetServiceKey)) {
      throw new Error("Xnet service key is invalid.");
    }
    return value as ApplicationEnterpriseXnetServiceKey;
  }

  /** 解析单个 Xnet 请求；输入未知值，返回固定服务键，额外字段或未知键时抛错。 */
  private parseXnetRequest(value: unknown): ApplicationEnterpriseXnetServiceKey {
    const request = requireExactRecord(value, ["serviceKey"], "Xnet service request");
    return this.requireXnetServiceKey(request.serviceKey);
  }

  /** 解析单字段 ID 请求；输入未知值、字段和标签，返回稳定 ID，额外字段时抛错。 */
  private parseIdRequest(value: unknown, field: string, label: string): string {
    const request = requireExactRecord(value, [field], `${label} request`);
    return requireEnterpriseId(request[field], label);
  }

  /** 创建并校验内部 UUID；输入标签，返回稳定 ID，注入生成器返回非法值时抛错。 */
  private createValidatedId(label: string): string {
    return requireEnterpriseId(this.createId(), label);
  }

  /** 从兼容存量记录挑选允许字段；输入对象和字段列表，返回浅副本，未知字段被忽略且不修改原对象。 */
  private pickFields(
    value: Readonly<Record<string, unknown>>,
    fields: readonly string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (value[field] !== undefined) result[field] = value[field];
    }
    return result;
  }

  /** 读取 JSON 数组文件；输入路径、标签和记录上限，返回普通对象数组，缺失或损坏时返回空并记录诊断。 */
  private async readRecordArray(
    filePath: string,
    label: string,
    maximumRecords = MAX_ENTERPRISE_RECORDS,
  ): Promise<readonly Record<string, unknown>[]> {
    try {
      const value = await this.readJsonFile(filePath, label);
      if (!Array.isArray(value) || value.length > maximumRecords) throw new Error(`${label} is invalid.`);
      return value.filter(isPlainRecord);
    } catch (error) {
      if (!isMissingFileError(error)) this.logger.warn(`Ignored unavailable ${label}.`, error);
      return [];
    }
  }

  /** 读取有界非链接 JSON 文件；输入路径和标签，返回解析值，缺失、超限、非法 UTF-8 或 JSON 时抛错。 */
  private async readJsonFile(filePath: string, label: string): Promise<unknown> {
    const info = await lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ENTERPRISE_STORE_BYTES) throw new Error(`${label} is invalid.`);
    const bytes = await readFile(filePath);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  }

  /** 原子写入兼容 JSON 文件；输入路径、值和标签，无返回，超限或重命名失败时清理临时文件并抛错。 */
  private async writeJsonFile(filePath: string, value: unknown, label: string): Promise<void> {
    const document = cloneBoundedJson(value, MAX_ENTERPRISE_STORE_BYTES, label);
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  /** 串行执行企业写入与沙盘同步；输入异步函数，返回结果，前序失败不阻断后续请求。 */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
