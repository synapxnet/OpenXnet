/** Skill Runtime 的 Main IPC 通道。 */
export const APPLICATION_SKILL_RUNTIME_CHANNELS = Object.freeze({
  list: "openxnet:application-skills:list",
  content: "openxnet:application-skills:content",
  installRepository: "openxnet:application-skills:install-repository",
  importArchive: "openxnet:application-skills:import-archive",
  crystallize: "openxnet:application-skills:crystallize",
  uploadMlops: "openxnet:application-skills:upload-mlops",
  remove: "openxnet:application-skills:remove",
  projectStatus: "openxnet:application-skills:project-status",
  syncProject: "openxnet:application-skills:sync-project",
  revealDirectory: "openxnet:application-skills:reveal-directory",
});

/** Skill Runtime 的公开响应 schema。 */
export const APPLICATION_SKILL_RUNTIME_SCHEMA = "openxnet.skills.v1" as const;

/** Renderer 可提交给 preload 的最小技能 ZIP File 能力。 */
export interface RendererApplicationSkillArchiveFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** preload 从真实 File 提取的本机技能 ZIP 路径。 */
export interface ApplicationSkillArchivePathEntry {
  readonly source: "path";
  readonly path: string;
  readonly originalName: string;
}

/** preload 为无本机路径 File 提供的有界技能 ZIP 字节。 */
export interface ApplicationSkillArchiveBytesEntry {
  readonly source: "bytes";
  readonly originalName: string;
  readonly bytes: Uint8Array;
}

/** Main Runtime 接收的技能 ZIP 导入请求。 */
export interface ImportApplicationSkillArchiveRequest {
  readonly entry: ApplicationSkillArchivePathEntry | ApplicationSkillArchiveBytesEntry;
}

/** Renderer 调用 preload 时使用的技能 ZIP 导入请求。 */
export interface RendererImportApplicationSkillArchiveRequest {
  readonly file: RendererApplicationSkillArchiveFile;
}

/** 从 GitHub 仓库或仓库子目录安装技能的请求。 */
export interface InstallApplicationSkillRepositoryRequest {
  readonly repository: string;
}

/** 对单个技能执行操作的请求。 */
export interface ApplicationSkillIdRequest {
  readonly skillId: string;
}

/** 把企业 Skill 候选上传到 XnetMLOps 仓库的请求。 */
export interface UploadApplicationSkillToMlopsRequest {
  readonly skillId: string;
  readonly workspaceId: string;
}

/** 在全局目录和当前 Main 授权工作区之间同步技能的请求。 */
export interface SyncApplicationSkillProjectRequest {
  readonly skillId: string;
  readonly action: "install" | "remove" | "sync_to_global";
}

/** Skill 证据的事实来源；离线睡眠不是证据来源。 */
export type ApplicationSkillEvidenceOrigin = "work" | "rehearsal" | "manual" | "external" | "legacy";

/** Skill 证据所在的独立环境认证范围。 */
export type ApplicationSkillEnvironmentScope =
  | "synthetic"
  | "simulation"
  | "staging"
  | "shadow"
  | "canary"
  | "production"
  | "legacy";

/** Skill 从证据形成候选包时使用的结晶方式。 */
export type ApplicationSkillDerivationMethod =
  | "work_crystallization"
  | "rehearsal_crystallization"
  | "offline_consolidation"
  | "manual_curation"
  | "external_import"
  | "legacy";

/** 一个 Skill Family 内可独立比较和选择的策略变体。 */
export interface ApplicationSkillStrategyInput {
  readonly strategyId: string;
  readonly name?: string;
  readonly description?: string;
  readonly workflow?: readonly string[];
  readonly toolChain?: readonly string[];
  readonly riskLevel?: "low" | "medium" | "high" | "critical";
  readonly costScore?: number;
  readonly sourceEventIds?: readonly string[];
}

/** 一个 Skill 在明确环境范围内的认证状态。 */
export interface ApplicationSkillCertificationInput {
  readonly scope: ApplicationSkillEnvironmentScope;
  readonly status: "candidate" | "verified" | "active" | "deprecated" | "retired";
  readonly environmentFingerprint?: string;
  readonly evidenceEventIds?: readonly string[];
}

/** 从工作流程生成标准 Agent Skill 和 OpenXnet v2 扩展清单的请求。 */
export interface CrystallizeApplicationSkillRequest {
  readonly name: string;
  readonly skillId?: string;
  readonly description?: string;
  readonly triggerContext?: string;
  readonly workflow?: string;
  readonly notes?: string;
  readonly requiredCapabilities?: readonly string[];
  readonly verification?: readonly string[];
  readonly rollback?: string;
  readonly examples?: readonly string[];
  readonly counterExamples?: readonly string[];
  readonly sourceEventIds?: readonly string[];
  readonly status?: "candidate" | "verified" | "active" | "deprecated";
  readonly source?: "work" | "rehearsal" | "manual" | "external" | "sleep";
  readonly familyId?: string;
  readonly problemFingerprint?: string;
  readonly evidenceOrigin?: ApplicationSkillEvidenceOrigin;
  readonly derivationMethod?: ApplicationSkillDerivationMethod;
  readonly environmentScope?: ApplicationSkillEnvironmentScope;
  readonly environmentFingerprint?: string;
  readonly strategies?: readonly ApplicationSkillStrategyInput[];
  readonly certifications?: readonly ApplicationSkillCertificationInput[];
  readonly syncToProject?: boolean;
  readonly overwrite?: boolean;
}

/** Renderer 可见的技能元数据。 */
export interface ApplicationSkillRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author: string;
  readonly files: readonly string[];
  readonly lifecycleStatus: "candidate" | "verified" | "active" | "deprecated" | "retired" | "legacy";
  readonly evidenceOrigin: ApplicationSkillEvidenceOrigin;
  readonly derivationMethod: ApplicationSkillDerivationMethod;
  readonly environmentScope: ApplicationSkillEnvironmentScope;
  readonly familyId: string;
  readonly productionEligible: boolean;
}

/** 全局技能目录快照。 */
export interface ApplicationSkillCatalog {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly skills: readonly ApplicationSkillRecord[];
}

/** 单个技能 Markdown 内容。 */
export interface ApplicationSkillContentResult {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly skillId: string;
  readonly content: string;
}

/** 技能安装、同步或结晶写入结果。 */
export interface ApplicationSkillWriteResult {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly operation: "installed" | "crystallized" | "synced";
  readonly installedIds: readonly string[];
  readonly message: string;
}

/** 企业 Skill 上传到 XnetMLOps 后的受控结果。 */
export interface ApplicationSkillMlopsUploadResult {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly operation: "uploaded_to_mlops";
  readonly skillId: string;
  readonly workspaceId: string;
  readonly repositorySkillUid: string;
  readonly repositoryStatus: "draft";
  readonly artifactDigest: string;
  readonly message: string;
}

/** 技能删除结果。 */
export interface ApplicationSkillMutationResult {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly operation: "removed";
  readonly skillId: string;
}

/** 当前 Main 授权工作区的技能状态。 */
export interface ApplicationProjectSkillStatus {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly workspaceAvailable: boolean;
  readonly installedIds: readonly string[];
  readonly projectSkills: readonly ApplicationSkillRecord[];
}

/** 打开全局技能目录的结果。 */
export interface ApplicationSkillDirectoryResult {
  readonly schema: typeof APPLICATION_SKILL_RUNTIME_SCHEMA;
  readonly success: true;
}

/** preload 内联技能 ZIP 的最大字节数。 */
export const MAX_INLINE_SKILL_ARCHIVE_BYTES = 16 * 1024 * 1024;
