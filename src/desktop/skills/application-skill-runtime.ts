import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import yaml from "js-yaml";

import {
  APPLICATION_SKILL_RUNTIME_SCHEMA,
  type ApplicationProjectSkillStatus,
  type ApplicationSkillCatalog,
  type ApplicationSkillContentResult,
  type ApplicationSkillCertificationInput,
  type ApplicationSkillDerivationMethod,
  type ApplicationSkillEnvironmentScope,
  type ApplicationSkillEvidenceOrigin,
  type ApplicationSkillMutationResult,
  type ApplicationSkillMlopsUploadResult,
  type ApplicationSkillRecord,
  type ApplicationSkillStrategyInput,
  type ApplicationSkillWriteResult,
  type UploadApplicationSkillToMlopsRequest,
  type CrystallizeApplicationSkillRequest,
  type SyncApplicationSkillProjectRequest,
} from "../contracts/application-skills-runtime";
import type { LegacyRendererStateSnapshot } from "../contracts/legacy-renderer-state";
import {
  createPrivateTemporaryDirectory,
  downloadBoundedHttpsFile,
  extractValidatedZip,
  isPathInside,
  isPlainRecord,
  materializeArchiveEntry,
  pathExists,
  readBoundedUtf8File,
  requireExactRecord,
  requirePackageId,
  type ApplicationPackageFetch,
  type SafeZipArchiveBudget,
} from "../package-management/safe-package-archive";

const SKILL_ZIP_BUDGET: SafeZipArchiveBudget = Object.freeze({
  maximumArchiveBytes: 64 * 1024 * 1024,
  maximumExtractedBytes: 256 * 1024 * 1024,
  maximumEntries: 10_000,
  maximumEntryBytes: 32 * 1024 * 1024,
});
const MAX_SKILL_MARKDOWN_BYTES = 1024 * 1024;
const MAX_SKILL_TREE_ENTRIES = 10_000;
const MAX_SKILL_TREE_BYTES = 256 * 1024 * 1024;
const MAX_SKILLS_PER_ARCHIVE = 200;
const SKILL_METADATA_FILES = Object.freeze([
  "SKILL.md", "skill.md", "SKILLS.md", "skills.md",
  "Skill.md", "Skill.MD", "skill.MD", "SKILL.MD",
]);
const SKILL_DOWNLOAD_HOSTS = new Set(["github.com", "codeload.github.com"]);

/** Skill Runtime 读取 Main-owned 工作区设置所需的最小边界。 */
export interface ApplicationSkillStateBoundary {
  getSnapshot(): LegacyRendererStateSnapshot;
}

/** Skill Runtime 的诊断输出。 */
export interface ApplicationSkillRuntimeLogger {
  info(message: string): void;
  warn(message: string, error?: unknown): void;
}

/** 交给 XnetMLOps 仓库的 Skill 候选包。 */
export interface ApplicationSkillMlopsPublication {
  readonly workspaceId: string;
  readonly skillId: string;
  readonly familyId: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly contentMd: string;
  readonly manifestJson: string;
  readonly artifactDigest: string;
  readonly lifecycleStatus: ApplicationSkillRecord["lifecycleStatus"];
  readonly evidenceOrigin: ApplicationSkillEvidenceOrigin;
  readonly environmentScope: ApplicationSkillEnvironmentScope;
  readonly productionEligible: boolean;
  readonly files: readonly string[];
}

/** XnetMLOps 仓库接收候选包后的最小回执。 */
export interface ApplicationSkillMlopsPublicationReceipt {
  readonly repositorySkillUid: string;
  readonly repositoryStatus: "draft";
}

/** Skill Runtime 构造依赖。 */
export interface ApplicationSkillRuntimeOptions {
  readonly globalSkillsRoot: string;
  readonly bundledSkillsRoot: string;
  readonly state: ApplicationSkillStateBoundary;
  readonly authorizeWorkspaceDirectory?: (workspaceDirectory: string) => boolean;
  readonly fetch?: ApplicationPackageFetch;
  readonly logger?: ApplicationSkillRuntimeLogger;
  readonly now?: () => Date;
  readonly publishToMlopsRepository?: (
    publication: ApplicationSkillMlopsPublication,
  ) => Promise<ApplicationSkillMlopsPublicationReceipt>;
}

interface ParsedSkillRepository {
  readonly archiveUrl: string;
  readonly subpath: readonly string[];
}

interface PreparedSkill {
  readonly id: string;
  readonly sourceDirectory: string;
}

/** 创建默认 fetch 适配器；无输入，返回有界下载接口，网络错误时拒绝。 */
function createDefaultPackageFetch(): ApplicationPackageFetch {
  return async (url, options) => {
    const response = await fetch(url, { redirect: options.redirect, signal: options.signal });
    return {
      status: response.status,
      headers: response.headers,
      body: response.body as AsyncIterable<Uint8Array> | null,
    };
  };
}

/** 把未知值读取为有界字符串；输入任意值、默认值和长度，返回去空格文本，无副作用。 */
function readString(value: unknown, fallback = "", maximumLength = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : fallback;
}

/** 读取字符串数组；输入未知值、字段和预算，返回有界文本数组，类型或数量非法时抛错。 */
function requireStringArray(
  value: unknown,
  label: string,
  maximumItems = 100,
  maximumItemLength = 2000,
): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${label} is invalid.`);
  return value.map((item) => {
    if (typeof item !== "string" || item.length > maximumItemLength) throw new Error(`${label} is invalid.`);
    return item.trim();
  }).filter(Boolean);
}

/** 从名称生成稳定技能 ID；输入名称，返回小写 ID，无法生成时使用时间戳，无副作用。 */
function normalizeSkillId(value: string, now: () => Date): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9FFF_-]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 72);
  return normalized || `crystallized-skill-${Math.floor(now().getTime() / 1000)}`;
}

/** 解析 GitHub 仓库或 tree 深链；输入 URL，返回固定 ZIP URL 和安全子路径，非 HTTPS 或字段非法时抛错。 */
function parseSkillRepository(value: unknown): ParsedSkillRepository {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) throw new Error("Skill repository URL is invalid.");
  const parsed = new URL(value.trim());
  if (
    parsed.protocol !== "https:"
    || parsed.hostname.toLowerCase() !== "github.com"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error("Skill repository URL is invalid.");
  }
  const segments = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (segments.length < 2) throw new Error("Skill repository path is invalid.");
  const owner = segments[0] ?? "";
  const repository = (segments[1] ?? "").replace(/\.git$/i, "");
  const segmentPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
  if (!segmentPattern.test(owner) || !segmentPattern.test(repository)) throw new Error("Skill repository path is invalid.");
  let branch = "main";
  let subpath: readonly string[] = [];
  if (segments.length > 2) {
    if (segments[2] !== "tree" || segments.length < 4) throw new Error("Skill repository deep link is invalid.");
    branch = segments[3] ?? "";
    if (!segmentPattern.test(branch)) throw new Error("Skill repository branch is invalid.");
    subpath = segments.slice(4);
    if (subpath.length > 32 || subpath.some((segment) => !segmentPattern.test(segment))) {
      throw new Error("Skill repository subpath is invalid.");
    }
  }
  return {
    archiveUrl: `https://github.com/${owner}/${repository}/archive/refs/heads/${branch}.zip`,
    subpath,
  };
}

/** 校验技能 ID 请求；输入未知值，返回稳定 ID，字段漂移或 ID 非法时抛错。 */
function parseSkillIdRequest(value: unknown): string {
  const request = requireExactRecord(value, ["skillId"], "skill request");
  return requirePackageId(request.skillId, "Skill id");
}

/** 校验 MLOps 上传请求；输入未知值，返回稳定 Skill/Workspace ID，字段漂移时抛错。 */
function parseMlopsUploadRequest(value: unknown): UploadApplicationSkillToMlopsRequest {
  const request = requireExactRecord(value, ["skillId", "workspaceId"], "MLOps skill upload request");
  return {
    skillId: requirePackageId(request.skillId, "Skill id"),
    workspaceId: requirePackageId(request.workspaceId, "Workspace id"),
  };
}

/** 校验技能同步请求；输入未知值，返回 ID 和固定动作，字段或动作非法时抛错。 */
function parseSkillSyncRequest(value: unknown): SyncApplicationSkillProjectRequest {
  const request = requireExactRecord(value, ["skillId", "action"], "skill sync request");
  const skillId = requirePackageId(request.skillId, "Skill id");
  if (request.action !== "install" && request.action !== "remove" && request.action !== "sync_to_global") {
    throw new Error("Skill sync action is invalid.");
  }
  return { skillId, action: request.action };
}

/** 校验 Skill 策略变体；输入未知数组，返回有界策略，字段漂移或预算非法时抛错。 */
function parseSkillStrategies(value: unknown): readonly ApplicationSkillStrategyInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error("Skill strategies are invalid.");
  return value.map((item) => {
    const strategy = requireExactRecord(
      item,
      ["strategyId", "name", "description", "workflow", "toolChain", "riskLevel", "costScore", "sourceEventIds"],
      "skill strategy",
    );
    const strategyId = requirePackageId(strategy.strategyId, "Skill strategy id");
    const riskLevels = new Set(["low", "medium", "high", "critical"]);
    if (strategy.riskLevel !== undefined && !riskLevels.has(String(strategy.riskLevel))) {
      throw new Error("Skill strategy risk level is invalid.");
    }
    if (
      strategy.costScore !== undefined
      && (typeof strategy.costScore !== "number" || strategy.costScore < 0 || strategy.costScore > 1)
    ) {
      throw new Error("Skill strategy cost score is invalid.");
    }
    return {
      strategyId,
      ...(typeof strategy.name === "string" ? { name: readString(strategy.name, "", 160) } : {}),
      ...(typeof strategy.description === "string"
        ? { description: readString(strategy.description, "", 2000) }
        : {}),
      workflow: requireStringArray(strategy.workflow, "Skill strategy workflow", 200, 4096),
      toolChain: requireStringArray(strategy.toolChain, "Skill strategy tool chain", 100, 256),
      ...(strategy.riskLevel === undefined
        ? {}
        : { riskLevel: strategy.riskLevel as NonNullable<ApplicationSkillStrategyInput["riskLevel"]> }),
      ...(typeof strategy.costScore === "number" ? { costScore: strategy.costScore } : {}),
      sourceEventIds: requireStringArray(strategy.sourceEventIds, "Skill strategy source events", 200, 256),
    };
  });
}

/** 校验 Skill 分环境认证；输入未知数组，返回有界认证，未知范围或状态时抛错。 */
function parseSkillCertifications(value: unknown): readonly ApplicationSkillCertificationInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16) throw new Error("Skill certifications are invalid.");
  const scopes = new Set(["synthetic", "simulation", "staging", "shadow", "canary", "production", "legacy"]);
  const statuses = new Set(["candidate", "verified", "active", "deprecated", "retired"]);
  return value.map((item) => {
    const certification = requireExactRecord(
      item,
      ["scope", "status", "environmentFingerprint", "evidenceEventIds"],
      "skill certification",
    );
    if (!scopes.has(String(certification.scope))) throw new Error("Skill certification scope is invalid.");
    if (!statuses.has(String(certification.status))) throw new Error("Skill certification status is invalid.");
    return {
      scope: certification.scope as ApplicationSkillEnvironmentScope,
      status: certification.status as ApplicationSkillCertificationInput["status"],
      ...(typeof certification.environmentFingerprint === "string"
        ? { environmentFingerprint: readString(certification.environmentFingerprint, "", 256) }
        : {}),
      evidenceEventIds: requireStringArray(certification.evidenceEventIds, "Skill certification events", 200, 256),
    };
  });
}

/** 校验技能结晶请求；输入未知值，返回有界字段，结构、枚举或文本预算非法时抛错。 */
function parseCrystallizeRequest(value: unknown): CrystallizeApplicationSkillRequest {
  const fields = [
    "name", "skillId", "description", "triggerContext", "workflow", "notes",
    "requiredCapabilities", "verification", "rollback", "examples", "counterExamples",
    "sourceEventIds", "status", "source", "familyId", "problemFingerprint",
    "evidenceOrigin", "derivationMethod", "environmentScope", "environmentFingerprint",
    "strategies", "certifications", "syncToProject", "overwrite",
  ];
  const request = requireExactRecord(value, fields, "skill crystallization request");
  const name = readString(request.name, "", 160);
  if (!name) throw new Error("Skill name is required.");
  const optionalTextFields = ["description", "triggerContext", "workflow", "notes", "rollback"] as const;
  for (const field of optionalTextFields) {
    if (request[field] !== undefined && (typeof request[field] !== "string" || request[field].length > 64 * 1024)) {
      throw new Error(`Skill ${field} is invalid.`);
    }
  }
  const statuses = new Set(["candidate", "verified", "active", "deprecated"]);
  const sources = new Set(["work", "rehearsal", "manual", "external", "sleep"]);
  const evidenceOrigins = new Set(["work", "rehearsal", "manual", "external", "legacy"]);
  const derivationMethods = new Set([
    "work_crystallization", "rehearsal_crystallization", "offline_consolidation",
    "manual_curation", "external_import", "legacy",
  ]);
  const environmentScopes = new Set(["synthetic", "simulation", "staging", "shadow", "canary", "production", "legacy"]);
  if (request.status !== undefined && !statuses.has(String(request.status))) throw new Error("Skill status is invalid.");
  if (request.source !== undefined && !sources.has(String(request.source))) throw new Error("Skill source is invalid.");
  if (request.evidenceOrigin !== undefined && !evidenceOrigins.has(String(request.evidenceOrigin))) {
    throw new Error("Skill evidence origin is invalid.");
  }
  if (request.derivationMethod !== undefined && !derivationMethods.has(String(request.derivationMethod))) {
    throw new Error("Skill derivation method is invalid.");
  }
  if (request.environmentScope !== undefined && !environmentScopes.has(String(request.environmentScope))) {
    throw new Error("Skill environment scope is invalid.");
  }
  if (request.syncToProject !== undefined && typeof request.syncToProject !== "boolean") throw new Error("Skill sync flag is invalid.");
  if (request.overwrite !== undefined && typeof request.overwrite !== "boolean") throw new Error("Skill overwrite flag is invalid.");
  return {
    name,
    ...(request.skillId === undefined ? {} : { skillId: requirePackageId(request.skillId, "Skill id") }),
    ...(typeof request.description === "string" ? { description: request.description } : {}),
    ...(typeof request.triggerContext === "string" ? { triggerContext: request.triggerContext } : {}),
    ...(typeof request.workflow === "string" ? { workflow: request.workflow } : {}),
    ...(typeof request.notes === "string" ? { notes: request.notes } : {}),
    requiredCapabilities: requireStringArray(request.requiredCapabilities, "Skill capabilities"),
    verification: requireStringArray(request.verification, "Skill verification"),
    ...(typeof request.rollback === "string" ? { rollback: request.rollback } : {}),
    examples: requireStringArray(request.examples, "Skill examples"),
    counterExamples: requireStringArray(request.counterExamples, "Skill counter examples"),
    sourceEventIds: requireStringArray(request.sourceEventIds, "Skill source events", 200, 256),
    ...(request.status === undefined ? {} : { status: request.status as NonNullable<CrystallizeApplicationSkillRequest["status"]> }),
    ...(request.source === undefined ? {} : { source: request.source as NonNullable<CrystallizeApplicationSkillRequest["source"]> }),
    ...(request.familyId === undefined ? {} : { familyId: requirePackageId(request.familyId, "Skill family id") }),
    ...(typeof request.problemFingerprint === "string"
      ? { problemFingerprint: readString(request.problemFingerprint, "", 256) }
      : {}),
    ...(request.evidenceOrigin === undefined
      ? {}
      : { evidenceOrigin: request.evidenceOrigin as ApplicationSkillEvidenceOrigin }),
    ...(request.derivationMethod === undefined
      ? {}
      : { derivationMethod: request.derivationMethod as ApplicationSkillDerivationMethod }),
    ...(request.environmentScope === undefined
      ? {}
      : { environmentScope: request.environmentScope as ApplicationSkillEnvironmentScope }),
    ...(typeof request.environmentFingerprint === "string"
      ? { environmentFingerprint: readString(request.environmentFingerprint, "", 256) }
      : {}),
    strategies: parseSkillStrategies(request.strategies),
    certifications: parseSkillCertifications(request.certifications),
    ...(request.syncToProject === undefined ? {} : { syncToProject: request.syncToProject }),
    ...(request.overwrite === undefined ? {} : { overwrite: request.overwrite }),
  };
}

/** 管理全局技能、安全安装、结晶和 Main-owned 当前工作区同步。 */
export class ApplicationSkillRuntimeService {
  private readonly globalSkillsRoot: string;
  private readonly bundledSkillsRoot: string;
  private readonly fetchResource: ApplicationPackageFetch;
  private readonly logger: ApplicationSkillRuntimeLogger;
  private readonly now: () => Date;
  private operationQueue: Promise<void> = Promise.resolve();

  /** 创建 Skill Runtime；输入全局/内置目录、状态与网络边界，仅保存配置，不扫描或写盘。 */
  public constructor(private readonly options: ApplicationSkillRuntimeOptions) {
    this.globalSkillsRoot = path.resolve(options.globalSkillsRoot);
    this.bundledSkillsRoot = path.resolve(options.bundledSkillsRoot);
    this.fetchResource = options.fetch ?? createDefaultPackageFetch();
    this.logger = options.logger ?? console;
    this.now = options.now ?? (() => new Date());
  }

  /** 返回全局技能目录绝对路径供 Main shell 使用；无输入，返回固定构造路径，不创建目录。 */
  public get skillsDirectory(): string {
    return this.globalSkillsRoot;
  }

  /** 确保全局技能目录可打开；无输入，补齐内置技能后返回绝对目录，创建或复制失败时拒绝。 */
  public async ensureSkillsDirectory(): Promise<string> {
    await this.ensureBundledSkills();
    await mkdir(this.globalSkillsRoot, { recursive: true });
    return this.globalSkillsRoot;
  }

  /** 列出全局技能；无输入，先补齐缺失内置技能，再返回有界元数据，损坏目录被忽略。 */
  public async listSkills(): Promise<ApplicationSkillCatalog> {
    await this.ensureSkillsDirectory();
    const skills = await this.scanSkillDirectory(this.globalSkillsRoot);
    return { schema: APPLICATION_SKILL_RUNTIME_SCHEMA, success: true, skills };
  }

  /** 读取技能 Markdown；输入稳定 ID，返回 UTF-8 内容，缺失、链接或超过 1 MiB 时拒绝。 */
  public async getSkillContent(request: unknown): Promise<ApplicationSkillContentResult> {
    const skillId = parseSkillIdRequest(request);
    await this.ensureBundledSkills();
    const metadataPath = await this.findSkillMetadataFile(this.skillPath(skillId));
    if (metadataPath === null) throw new Error("Skill metadata file was not found.");
    const content = await readBoundedUtf8File(metadataPath, MAX_SKILL_MARKDOWN_BYTES, "Skill metadata");
    return { schema: APPLICATION_SKILL_RUNTIME_SCHEMA, success: true, skillId, content };
  }

  /** 从 GitHub 仓库或子目录安装技能；输入固定仓库 URL，返回安装 ID，下载或校验失败时不改变现有目录。 */
  public installFromRepository(request: unknown): Promise<ApplicationSkillWriteResult> {
    const parsedRequest = requireExactRecord(request, ["repository"], "skill repository request");
    const repository = parseSkillRepository(parsedRequest.repository);
    return this.enqueueOperation(async () => {
      const temporaryDirectory = await createPrivateTemporaryDirectory(this.globalSkillsRoot, "download");
      try {
        const archivePath = path.join(temporaryDirectory, "skills.zip");
        await downloadBoundedHttpsFile(this.fetchResource, repository.archiveUrl, archivePath, {
          allowedHosts: SKILL_DOWNLOAD_HOSTS,
          maximumBytes: SKILL_ZIP_BUDGET.maximumArchiveBytes,
        });
        const installedIds = await this.installArchive(archivePath, repository.subpath);
        return this.createWriteResult("installed", installedIds, `成功安装 ${installedIds.length} 个技能`);
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });
  }

  /** 从 preload 提取的本机 ZIP 安装技能；输入真实文件项，返回安装 ID，文件或结构非法时不改变现有目录。 */
  public importArchive(request: unknown): Promise<ApplicationSkillWriteResult> {
    const parsed = requireExactRecord(request, ["entry"], "skill archive request");
    return this.enqueueOperation(async () => {
      const temporaryDirectory = await createPrivateTemporaryDirectory(this.globalSkillsRoot, "import");
      try {
        const archivePath = path.join(temporaryDirectory, "skills.zip");
        await materializeArchiveEntry(parsed.entry, archivePath, SKILL_ZIP_BUDGET.maximumArchiveBytes);
        const installedIds = await this.installArchive(archivePath, []);
        return this.createWriteResult("installed", installedIds, `成功安装 ${installedIds.length} 个技能`);
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });
  }

  /** 将工作流程结晶为标准 SKILL.md；输入有界流程字段，返回技能 ID，冲突、工作区或写盘失败时拒绝。 */
  public crystallizeSkill(request: unknown): Promise<ApplicationSkillWriteResult> {
    const parsed = parseCrystallizeRequest(request);
    return this.enqueueOperation(async () => {
      await mkdir(this.globalSkillsRoot, { recursive: true });
      const evidenceOrigin = parsed.evidenceOrigin ?? (parsed.source === "sleep" ? "legacy" : parsed.source ?? "work");
      const environmentScope = parsed.environmentScope ?? "legacy";
      const productionCertified = (parsed.certifications ?? []).some((item) => (
        item.scope === "production" && (item.status === "verified" || item.status === "active")
      ));
      if (
        parsed.syncToProject === true
        && evidenceOrigin === "rehearsal"
        && (environmentScope !== "production" || !productionCertified)
      ) {
        throw new Error("Rehearsal skill requires production certification before project sync.");
      }
      if (parsed.syncToProject === true) await this.requireConfiguredWorkspace();
      const skillId = parsed.skillId ?? normalizeSkillId(parsed.name, this.now);
      const target = this.skillPath(skillId);
      if (await pathExists(target) && parsed.overwrite !== true) throw new Error(`Skill ${skillId} already exists.`);
      const temporaryDirectory = await createPrivateTemporaryDirectory(this.globalSkillsRoot, "crystal");
      try {
        const prepared = path.join(temporaryDirectory, skillId);
        await mkdir(prepared, { recursive: false, mode: 0o700 });
        const content = this.buildCrystallizedContent(parsed, skillId);
        if (Buffer.byteLength(content, "utf8") > MAX_SKILL_MARKDOWN_BYTES) throw new Error("Crystallized skill exceeds its byte budget.");
        await writeFile(path.join(prepared, "SKILL.md"), content, { encoding: "utf8", flag: "wx", mode: 0o600 });
        await writeFile(
          path.join(prepared, "openxnet.skill.json"),
          `${JSON.stringify(this.buildSkillEngineeringManifest(parsed, skillId), null, 2)}\n`,
          { encoding: "utf8", flag: "wx", mode: 0o600 },
        );
        await this.replacePreparedSkills([{ id: skillId, sourceDirectory: prepared }]);
        if (parsed.syncToProject === true) await this.copySkillToProject(skillId);
        return this.createWriteResult(
          "crystallized",
          [skillId],
          `技能结晶已生成: ${skillId}${parsed.syncToProject === true ? "，并已同步到工作区" : ""}`,
        );
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });
  }

  /** 上传一个本地 Skill 候选到 XnetMLOps；输入 Skill/Workspace ID，返回草稿回执，不改变执行权限。 */
  public async uploadSkillToMlops(request: unknown): Promise<ApplicationSkillMlopsUploadResult> {
    const parsed = parseMlopsUploadRequest(request);
    if (!this.options.publishToMlopsRepository) throw new Error("XnetMLOps skill repository is unavailable.");
    const skillDirectory = this.skillPath(parsed.skillId);
    if (!await this.isRegularDirectory(skillDirectory)) throw new Error("Global skill is not installed.");
    await this.validateSkillTree(skillDirectory);
    const record = await this.readSkillMetadata(skillDirectory, parsed.skillId);
    const metadataPath = await this.findSkillMetadataFile(skillDirectory);
    if (!metadataPath) throw new Error("Skill metadata file is unavailable.");
    const contentMd = await readBoundedUtf8File(metadataPath, MAX_SKILL_MARKDOWN_BYTES, "Skill metadata");
    const manifestPath = path.join(skillDirectory, "openxnet.skill.json");
    const manifestJson = await pathExists(manifestPath)
      ? await readBoundedUtf8File(manifestPath, MAX_SKILL_MARKDOWN_BYTES, "OpenXnet skill manifest")
      : "{}";
    try {
      const manifest = JSON.parse(manifestJson);
      if (!isPlainRecord(manifest)) throw new Error("manifest must be an object");
    } catch {
      throw new Error("OpenXnet skill manifest is invalid.");
    }
    const artifactDigest = createHash("sha256")
      .update(contentMd, "utf8")
      .update("\0", "utf8")
      .update(manifestJson, "utf8")
      .digest("hex");
    const receipt = await this.options.publishToMlopsRepository({
      workspaceId: parsed.workspaceId,
      skillId: record.id,
      familyId: record.familyId,
      name: record.name,
      description: record.description,
      version: record.version,
      contentMd,
      manifestJson,
      artifactDigest,
      lifecycleStatus: record.lifecycleStatus,
      evidenceOrigin: record.evidenceOrigin,
      environmentScope: record.environmentScope,
      productionEligible: record.productionEligible,
      files: record.files,
    });
    return {
      schema: APPLICATION_SKILL_RUNTIME_SCHEMA,
      success: true,
      operation: "uploaded_to_mlops",
      skillId: record.id,
      workspaceId: parsed.workspaceId,
      repositorySkillUid: receipt.repositorySkillUid,
      repositoryStatus: receipt.repositoryStatus,
      artifactDigest,
      message: "Skill candidate uploaded to XnetMLOps as a draft.",
    };
  }

  /** 删除全局技能；输入稳定 ID，返回删除结果，缺失、非目录或链接目标时拒绝。 */
  public removeSkill(request: unknown): Promise<ApplicationSkillMutationResult> {
    const skillId = parseSkillIdRequest(request);
    return this.enqueueOperation(async () => {
      const target = this.skillPath(skillId);
      const info = await lstat(target);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Skill directory is invalid.");
      await rm(target, { recursive: true, force: false });
      return { schema: APPLICATION_SKILL_RUNTIME_SCHEMA, success: true, operation: "removed", skillId };
    });
  }

  /** 读取当前 Main-owned 工作区技能状态；无输入，返回技能 ID 和元数据，未配置工作区时返回空状态。 */
  public async getProjectStatus(): Promise<ApplicationProjectSkillStatus> {
    const workspace = await this.resolveConfiguredWorkspace();
    if (workspace === null) {
      return {
        schema: APPLICATION_SKILL_RUNTIME_SCHEMA,
        success: true,
        workspaceAvailable: false,
        installedIds: [],
        projectSkills: [],
      };
    }
    const projectRoot = path.join(workspace, ".agent", "skills");
    if (!await pathExists(projectRoot)) {
      return {
        schema: APPLICATION_SKILL_RUNTIME_SCHEMA,
        success: true,
        workspaceAvailable: true,
        installedIds: [],
        projectSkills: [],
      };
    }
    const projectSkills = await this.scanSkillDirectory(projectRoot);
    return {
      schema: APPLICATION_SKILL_RUNTIME_SCHEMA,
      success: true,
      workspaceAvailable: true,
      installedIds: projectSkills.map((skill) => skill.id),
      projectSkills,
    };
  }

  /** 在全局目录与 Main-owned 当前工作区间同步技能；输入 ID 和固定动作，返回写入结果，未配置工作区时拒绝。 */
  public syncProjectSkill(request: unknown): Promise<ApplicationSkillWriteResult> {
    const parsed = parseSkillSyncRequest(request);
    return this.enqueueOperation(async () => {
      if (parsed.action === "install") await this.copySkillToProject(parsed.skillId);
      else if (parsed.action === "remove") await this.removeProjectSkill(parsed.skillId);
      else await this.copyProjectSkillToGlobal(parsed.skillId);
      return this.createWriteResult("synced", [parsed.skillId], `技能 ${parsed.skillId} 同步完成`);
    });
  }

  /** 从 ZIP 解压并批量原子安装技能；输入 ZIP 和可选仓库子路径，返回排序 ID，无有效技能时抛错。 */
  private async installArchive(archivePath: string, subpath: readonly string[]): Promise<readonly string[]> {
    const temporaryDirectory = await createPrivateTemporaryDirectory(this.globalSkillsRoot, "extract");
    try {
      const extractedRoot = path.join(temporaryDirectory, "unpacked");
      await extractValidatedZip(archivePath, extractedRoot, SKILL_ZIP_BUDGET);
      const repositoryRoot = await this.unwrapSingleDirectory(extractedRoot);
      let sourceRoot = repositoryRoot;
      if (subpath.length > 0) {
        sourceRoot = path.resolve(repositoryRoot, ...subpath);
        if (!isPathInside(repositoryRoot, sourceRoot)) throw new Error("Skill repository subpath is invalid.");
        const sourceInfo = await lstat(sourceRoot);
        if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) throw new Error("Skill repository subpath was not found.");
      }
      const preparedSkills = await this.findPreparedSkills(sourceRoot);
      if (preparedSkills.length === 0) throw new Error("No valid Agent Skill structure containing SKILL.md was found.");
      await this.replacePreparedSkills(preparedSkills);
      return preparedSkills.map((item) => item.id).sort();
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  /** 查找单技能或多技能目录；输入源根，返回最多 200 个已验证目录，无技能时返回空数组。 */
  private async findPreparedSkills(sourceRoot: string): Promise<readonly PreparedSkill[]> {
    if (await this.findSkillMetadataFile(sourceRoot) !== null) {
      const skillId = requirePackageId(path.basename(sourceRoot), "Skill id");
      await this.validateSkillTree(sourceRoot);
      return [{ id: skillId, sourceDirectory: sourceRoot }];
    }
    const nestedSkills = path.join(sourceRoot, "skills");
    const scanRoot = await this.isRegularDirectory(nestedSkills) ? nestedSkills : sourceRoot;
    const entries = await readdir(scanRoot, { withFileTypes: true });
    const result: PreparedSkill[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const candidate = path.join(scanRoot, entry.name);
      if (await this.findSkillMetadataFile(candidate) === null) continue;
      const skillId = requirePackageId(entry.name, "Skill id");
      await this.validateSkillTree(candidate);
      result.push({ id: skillId, sourceDirectory: candidate });
      if (result.length > MAX_SKILLS_PER_ARCHIVE) throw new Error("Skill archive contains too many skills.");
    }
    return result;
  }

  /** 批量替换全局技能目录；输入准备目录，成功时删除备份，任一重命名失败时回滚全部已处理技能。 */
  private async replacePreparedSkills(skills: readonly PreparedSkill[]): Promise<void> {
    await mkdir(this.globalSkillsRoot, { recursive: true });
    const transactionId = randomUUID();
    const backups = new Map<string, string>();
    const installed: string[] = [];
    try {
      for (const skill of skills) {
        const target = this.skillPath(skill.id);
        if (await pathExists(target)) {
          const info = await lstat(target);
          if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Installed skill ${skill.id} is invalid.`);
          const backup = path.join(this.globalSkillsRoot, `.backup-${skill.id}-${transactionId}`);
          await rename(target, backup);
          backups.set(skill.id, backup);
        }
        await rename(skill.sourceDirectory, target);
        installed.push(skill.id);
      }
      for (const backup of backups.values()) await rm(backup, { recursive: true, force: true });
    } catch (error) {
      for (const skillId of installed.reverse()) await rm(this.skillPath(skillId), { recursive: true, force: true });
      for (const [skillId, backup] of backups) {
        if (await pathExists(backup)) await rename(backup, this.skillPath(skillId));
      }
      throw error;
    }
  }

  /** 补齐缺失内置技能；无输入和返回，只复制可信非链接目录，不覆盖用户已有技能。 */
  private async ensureBundledSkills(): Promise<void> {
    if (!await this.isRegularDirectory(this.bundledSkillsRoot)) return;
    await mkdir(this.globalSkillsRoot, { recursive: true });
    const entries = await readdir(this.bundledSkillsRoot, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      try {
        const skillId = requirePackageId(entry.name, "Skill id");
        const target = this.skillPath(skillId);
        if (await pathExists(target)) continue;
        const staging = path.join(this.globalSkillsRoot, `.bundled-${skillId}-${randomUUID()}`);
        await this.copySkillDirectory(path.join(this.bundledSkillsRoot, entry.name), staging);
        try {
          await rename(staging, target);
          this.logger.info(`Installed bundled skill ${skillId}.`);
        } catch (error) {
          await rm(staging, { recursive: true, force: true });
          if (!await pathExists(target)) throw error;
        }
      } catch (error) {
        this.logger.warn(`Skipped invalid bundled skill ${entry.name}.`, error);
      }
    }
  }

  /** 扫描技能根目录；输入根路径，返回有界排序元数据，链接和损坏目录被忽略。 */
  private async scanSkillDirectory(root: string): Promise<readonly ApplicationSkillRecord[]> {
    if (!await this.isRegularDirectory(root)) return [];
    const entries = await readdir(root, { withFileTypes: true });
    const skills: ApplicationSkillRecord[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      try {
        const skillId = requirePackageId(entry.name, "Skill id");
        skills.push(await this.readSkillMetadata(path.join(root, entry.name), skillId));
      } catch (error) {
        this.logger.warn(`Ignored invalid skill directory: ${entry.name}`, error);
      }
    }
    return skills;
  }

  /** 读取技能元数据；输入技能目录和 ID，返回有界记录，缺失 frontmatter 时使用默认字段。 */
  private async readSkillMetadata(skillDirectory: string, skillId: string): Promise<ApplicationSkillRecord> {
    const metadataPath = await this.findSkillMetadataFile(skillDirectory);
    let metadata: Record<string, unknown> = {};
    if (metadataPath !== null) {
      const content = await readBoundedUtf8File(metadataPath, MAX_SKILL_MARKDOWN_BYTES, "Skill metadata");
      const match = /^\s*---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(content.replace(/\r\n?/g, "\n"));
      if (match?.[1]) {
        try {
          const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA, json: true }) as unknown;
          if (isPlainRecord(parsed)) metadata = parsed;
        } catch (error) {
          this.logger.warn(`Ignored invalid skill frontmatter: ${skillId}`, error);
        }
      }
    }
    metadata = { ...metadata, ...await this.readOpenXnetSkillManifest(skillDirectory) };
    const entries = await readdir(skillDirectory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && !entry.name.startsWith(".") && !entry.name.startsWith("~"))
      .map((entry) => entry.name)
      .sort()
      .slice(0, 8);
    const lifecycleValues = new Set(["candidate", "verified", "active", "deprecated", "retired"]);
    const originValues = new Set(["work", "rehearsal", "manual", "external", "legacy"]);
    const derivationValues = new Set([
      "work_crystallization", "rehearsal_crystallization", "offline_consolidation",
      "manual_curation", "external_import", "legacy",
    ]);
    const scopeValues = new Set(["synthetic", "simulation", "staging", "shadow", "canary", "production", "legacy"]);
    const lifecycleStatus = lifecycleValues.has(String(metadata.lifecycle_status))
      ? String(metadata.lifecycle_status) as ApplicationSkillRecord["lifecycleStatus"]
      : "legacy";
    const evidenceOrigin = originValues.has(String(metadata.evidence_origin))
      ? String(metadata.evidence_origin) as ApplicationSkillEvidenceOrigin
      : "legacy";
    const derivationMethod = derivationValues.has(String(metadata.derivation_method))
      ? String(metadata.derivation_method) as ApplicationSkillDerivationMethod
      : "legacy";
    const environmentScope = scopeValues.has(String(metadata.environment_scope))
      ? String(metadata.environment_scope) as ApplicationSkillEnvironmentScope
      : "legacy";
    return {
      id: skillId,
      name: readString(metadata.name ?? metadata.title, skillId, 160) || skillId,
      description: readString(metadata.description ?? metadata.summary, "Agent 智能体技能", 500) || "Agent 智能体技能",
      version: readString(metadata.version, "1.0.0", 80) || "1.0.0",
      author: this.readSkillAuthor(metadata.author),
      files,
      lifecycleStatus,
      evidenceOrigin,
      derivationMethod,
      environmentScope,
      familyId: readString(metadata.family_id, skillId, 192) || skillId,
      productionEligible: environmentScope === "production" && (lifecycleStatus === "verified" || lifecycleStatus === "active"),
    };
  }

  /** 读取 OpenXnet v2 扩展清单；输入技能目录，返回普通元数据，缺失时返回空对象。 */
  private async readOpenXnetSkillManifest(skillDirectory: string): Promise<Record<string, unknown>> {
    const manifestPath = path.join(skillDirectory, "openxnet.skill.json");
    try {
      const info = await lstat(manifestPath);
      if (!info.isFile() || info.isSymbolicLink()) return {};
      const content = await readBoundedUtf8File(manifestPath, MAX_SKILL_MARKDOWN_BYTES, "OpenXnet skill manifest");
      const parsed = JSON.parse(content) as unknown;
      return isPlainRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  /** 读取技能作者；输入字符串、数组或未知值，返回有界作者文本，无副作用。 */
  private readSkillAuthor(value: unknown): string {
    if (typeof value === "string") return readString(value, "Local", 100) || "Local";
    if (Array.isArray(value) && typeof value[0] === "string") return readString(value[0], "Local", 100) || "Local";
    return "Local";
  }

  /** 查找技能元数据文件；输入技能目录，返回第一个普通文件路径，缺失或链接时返回 null。 */
  private async findSkillMetadataFile(skillDirectory: string): Promise<string | null> {
    for (const filename of SKILL_METADATA_FILES) {
      const candidate = path.join(skillDirectory, filename);
      try {
        const info = await lstat(candidate);
        if (info.isFile() && !info.isSymbolicLink()) return candidate;
      } catch {
        // 继续检查兼容文件名。
      }
    }
    return null;
  }

  /** 验证技能目录树资源预算；输入目录，无返回，符号链接、特殊文件、条目或体积超限时抛错。 */
  private async validateSkillTree(skillDirectory: string): Promise<void> {
    const pending = [skillDirectory];
    let entries = 0;
    let bytes = 0;
    while (pending.length > 0) {
      const current = pending.shift()!;
      for (const entry of await readdir(current, { withFileTypes: true })) {
        entries += 1;
        if (entries > MAX_SKILL_TREE_ENTRIES) throw new Error("Skill directory contains too many entries.");
        const candidate = path.join(current, entry.name);
        const info = await lstat(candidate);
        if (info.isSymbolicLink()) throw new Error("Skill symbolic links are not allowed.");
        if (info.isDirectory()) pending.push(candidate);
        else if (info.isFile()) {
          bytes += info.size;
          if (!Number.isSafeInteger(bytes) || bytes > MAX_SKILL_TREE_BYTES) throw new Error("Skill directory exceeds its byte budget.");
        } else throw new Error("Skill special files are not allowed.");
      }
    }
  }

  /** 递归复制一个无链接技能目录；输入源和目标，无返回，结构非法或超限时清理目标并抛错。 */
  private async copySkillDirectory(source: string, destination: string): Promise<void> {
    await this.validateSkillTree(source);
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true, mode: 0o700 });
    const pending: Array<{ readonly source: string; readonly destination: string }> = [{ source, destination }];
    try {
      while (pending.length > 0) {
        const current = pending.shift()!;
        for (const entry of await readdir(current.source, { withFileTypes: true })) {
          const sourcePath = path.join(current.source, entry.name);
          const destinationPath = path.join(current.destination, entry.name);
          if (entry.isDirectory() && !entry.isSymbolicLink()) {
            await mkdir(destinationPath, { recursive: false, mode: 0o700 });
            pending.push({ source: sourcePath, destination: destinationPath });
          } else if (entry.isFile() && !entry.isSymbolicLink()) {
            await copyFile(sourcePath, destinationPath);
          } else throw new Error("Skill directory contains unsupported entries.");
        }
      }
    } catch (error) {
      await rm(destination, { recursive: true, force: true });
      throw error;
    }
  }

  /** 把全局技能原子复制到当前工作区；输入 ID，无返回，工作区或全局技能缺失时抛错。 */
  private async copySkillToProject(skillId: string): Promise<void> {
    const workspace = await this.requireConfiguredWorkspace();
    const source = this.skillPath(skillId);
    if (!await this.isRegularDirectory(source)) throw new Error("Global skill is not installed.");
    const projectSkillsRoot = path.join(workspace, ".agent", "skills");
    await this.copyAndReplaceSkill(source, projectSkillsRoot, skillId);
  }

  /** 把工作区技能原子复制回全局目录；输入 ID，无返回，工作区技能缺失时抛错。 */
  private async copyProjectSkillToGlobal(skillId: string): Promise<void> {
    const workspace = await this.requireConfiguredWorkspace();
    const source = path.join(workspace, ".agent", "skills", skillId);
    if (!await this.isRegularDirectory(source)) throw new Error("Project skill is not installed.");
    await this.copyAndReplaceSkill(source, this.globalSkillsRoot, skillId);
  }

  /** 从当前工作区删除技能；输入 ID，无返回，缺失时幂等，链接或非目录目标时抛错。 */
  private async removeProjectSkill(skillId: string): Promise<void> {
    const workspace = await this.requireConfiguredWorkspace();
    const target = path.join(workspace, ".agent", "skills", skillId);
    if (!await pathExists(target)) return;
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Project skill directory is invalid.");
    await rm(target, { recursive: true, force: false });
  }

  /** 复制并原子替换单个技能；输入源、目标根和 ID，无返回，失败时恢复旧目录。 */
  private async copyAndReplaceSkill(source: string, targetRoot: string, skillId: string): Promise<void> {
    await mkdir(targetRoot, { recursive: true });
    const staging = path.join(targetRoot, `.staging-${skillId}-${randomUUID()}`);
    const backup = path.join(targetRoot, `.backup-${skillId}-${randomUUID()}`);
    const target = path.join(targetRoot, skillId);
    let movedOld = false;
    let movedNew = false;
    try {
      await this.copySkillDirectory(source, staging);
      if (await pathExists(target)) {
        const targetInfo = await lstat(target);
        if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) throw new Error("Existing skill directory is invalid.");
        await rename(target, backup);
        movedOld = true;
      }
      await rename(staging, target);
      movedNew = true;
      if (movedOld) await rm(backup, { recursive: true, force: true });
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      if (movedNew) await rm(target, { recursive: true, force: true });
      if (movedOld && await pathExists(backup)) await rename(backup, target);
      throw error;
    }
  }

  /** 读取 Main-owned CLISettings 工作区；无输入，返回 canonical 普通目录，未配置、缺失或链接时返回 null。 */
  private async resolveConfiguredWorkspace(): Promise<string | null> {
    const settings = this.options.state.getSnapshot().settings;
    const cliSettings = isPlainRecord(settings.CLISettings) ? settings.CLISettings : {};
    const configured = readString(cliSettings.cc_path, "", 32_768);
    if (!configured || configured.includes("\0")) return null;
    try {
      const resolved = await realpath(path.resolve(configured));
      const info = await lstat(resolved);
      if (!info.isDirectory() || info.isSymbolicLink()) return null;
      if (this.options.authorizeWorkspaceDirectory && !this.options.authorizeWorkspaceDirectory(resolved)) return null;
      return resolved;
    } catch {
      return null;
    }
  }

  /** 要求 Main-owned 工作区可用；无输入，返回 canonical 目录，未配置或不可用时抛错。 */
  private async requireConfiguredWorkspace(): Promise<string> {
    const workspace = await this.resolveConfiguredWorkspace();
    if (workspace === null) throw new Error("Configured workspace is unavailable.");
    return workspace;
  }

  /** 解开 ZIP 唯一包装目录；输入解压根，返回子目录或原根，链接和隐藏包装不会被采用。 */
  private async unwrapSingleDirectory(extractedRoot: string): Promise<string> {
    const entries = (await readdir(extractedRoot, { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "__MACOSX");
    return entries.length === 1 && entries[0]?.isDirectory() && !entries[0].isSymbolicLink()
      ? path.join(extractedRoot, entries[0].name)
      : extractedRoot;
  }

  /** 构造标准技能 Markdown；输入已校验请求和 ID，返回 UTF-8/LF 文本，无文件副作用。 */
  private buildCrystallizedContent(request: CrystallizeApplicationSkillRequest, skillId: string): string {
    const description = readString(
      request.description || request.triggerContext,
      "A crystallized workflow distilled from useful agent work.",
      2000,
    );
    const triggerLines = this.plainLines(request.triggerContext, description);
    const workflowLines = this.plainLines(
      request.workflow,
      "Inspect the current task, apply the distilled workflow, verify the result, and report the outcome.",
    );
    const capabilityLines = request.requiredCapabilities?.length
      ? request.requiredCapabilities
      : ["Use the minimum tools required by the workflow."];
    const verificationLines = request.verification?.length
      ? request.verification
      : ["Run a focused verification step before reporting success."];
    const rollbackLines = this.plainLines(request.rollback, "Stop using this skill when the trigger context no longer matches.");
    const exampleLines = request.examples?.length ? request.examples : ["Add examples after the first successful reuse."];
    const counterExampleLines = request.counterExamples?.length
      ? request.counterExamples
      : ["Tasks that do not match the trigger context."];
    const noteLines = this.plainLines(request.notes, "Keep the skill concise and update it after real usage reveals better steps.");
    const source = request.source ?? "work";
    const evidenceOrigin = request.evidenceOrigin ?? (source === "sleep" ? "legacy" : source);
    const derivationMethod = request.derivationMethod ?? {
      work: "work_crystallization",
      rehearsal: "rehearsal_crystallization",
      manual: "manual_curation",
      external: "external_import",
      legacy: "legacy",
    }[evidenceOrigin];
    const environmentScope = request.environmentScope ?? "legacy";
    const status = request.status ?? "candidate";
    const frontmatter = [
      "---",
      `name: ${JSON.stringify(request.name)}`,
      `description: ${JSON.stringify(description)}`,
      "version: 1.0.0",
      `source: ${JSON.stringify(`OpenXnet skill crystallization (${source})`)}`,
      `evidence_origin: ${JSON.stringify(evidenceOrigin)}`,
      `derivation_method: ${JSON.stringify(derivationMethod)}`,
      `environment_scope: ${JSON.stringify(environmentScope)}`,
      `lifecycle_status: ${JSON.stringify(status)}`,
      `skill_id: ${JSON.stringify(skillId)}`,
      `family_id: ${JSON.stringify(request.familyId ?? skillId)}`,
      `generated_at: ${JSON.stringify(this.now().toISOString())}`,
      "---",
    ];
    return [
      ...frontmatter,
      "",
      `# ${request.name}`,
      "",
      "Use this skill when the current task matches the crystallized pattern below.",
      "",
      "## When To Use",
      "",
      ...triggerLines.map((line) => `- ${line}`),
      "",
      "## Workflow",
      "",
      ...workflowLines.map((line, index) => `${index + 1}. ${line}`),
      "",
      "## Required Capabilities",
      "",
      ...capabilityLines.map((line) => `- ${line}`),
      "",
      "## Verification",
      "",
      ...verificationLines.map((line) => `- ${line}`),
      "",
      "## Rollback",
      "",
      ...rollbackLines.map((line) => `- ${line}`),
      "",
      "## Examples",
      "",
      ...exampleLines.map((line) => `- ${line}`),
      "",
      "## Counter Examples",
      "",
      ...counterExampleLines.map((line) => `- ${line}`),
      "",
      "## Strategy Variants",
      "",
      ...(request.strategies?.length
        ? request.strategies.map((item) => `- ${item.strategyId}: ${item.name ?? item.description ?? "strategy variant"}`)
        : ["- default: Apply the workflow above."]),
      "",
      "## Certification Scope",
      "",
      ...(request.certifications?.length
        ? request.certifications.map((item) => `- ${item.scope}: ${item.status}`)
        : [`- ${environmentScope}: candidate`]),
      "",
      "## Guardrails",
      "",
      ...noteLines.map((line) => `- ${line}`),
      "",
    ].join("\n");
  }

  /** 构造 OpenXnet Skill Engineering v2 扩展清单；输入请求和 ID，返回可序列化对象。 */
  private buildSkillEngineeringManifest(
    request: CrystallizeApplicationSkillRequest,
    skillId: string,
  ): Readonly<Record<string, unknown>> {
    const source = request.source ?? "work";
    const evidenceOrigin = request.evidenceOrigin ?? (source === "sleep" ? "legacy" : source);
    const derivationMethod = request.derivationMethod ?? {
      work: "work_crystallization",
      rehearsal: "rehearsal_crystallization",
      manual: "manual_curation",
      external: "external_import",
      legacy: "legacy",
    }[evidenceOrigin];
    return {
      schema: "openxnet.skill-engineering.v2",
      skill_id: skillId,
      family_id: request.familyId ?? skillId,
      problem_fingerprint: request.problemFingerprint ?? "",
      evidence_origin: evidenceOrigin,
      derivation_method: derivationMethod,
      environment_scope: request.environmentScope ?? "legacy",
      environment_fingerprint: request.environmentFingerprint ?? "",
      lifecycle_status: request.status ?? "candidate",
      strategies: (request.strategies ?? []).map((item) => ({
        strategy_id: item.strategyId,
        name: item.name ?? item.strategyId,
        description: item.description ?? "",
        workflow: item.workflow ?? [],
        tool_chain: item.toolChain ?? [],
        risk_level: item.riskLevel ?? "medium",
        cost_score: item.costScore ?? 0,
        source_event_ids: item.sourceEventIds ?? [],
      })),
      certifications: (request.certifications ?? []).map((item) => ({
        scope: item.scope,
        status: item.status,
        environment_fingerprint: item.environmentFingerprint ?? "",
        evidence_event_ids: item.evidenceEventIds ?? [],
      })),
      source_event_ids: request.sourceEventIds ?? [],
      generated_at: this.now().toISOString(),
    };
  }

  /** 把多行输入清理为普通条目；输入文本和回退，返回非空行，无副作用。 */
  private plainLines(value: string | undefined, fallback: string): readonly string[] {
    const lines = String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim().replace(/^[-*•\d.)\s]+/u, "").trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [fallback];
  }

  /** 创建统一技能写入结果；输入操作、ID 和消息，返回 schema 对象，无副作用。 */
  private createWriteResult(
    operation: ApplicationSkillWriteResult["operation"],
    installedIds: readonly string[],
    message: string,
  ): ApplicationSkillWriteResult {
    return { schema: APPLICATION_SKILL_RUNTIME_SCHEMA, success: true, operation, installedIds, message };
  }

  /** 判断路径是否为非链接普通目录；输入路径，返回布尔值，缺失和访问失败返回 false。 */
  private async isRegularDirectory(directoryPath: string): Promise<boolean> {
    try {
      const info = await lstat(directoryPath);
      return info.isDirectory() && !info.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /** 返回全局技能绝对目录；输入已校验 ID，返回根目录内路径，不访问文件系统。 */
  private skillPath(skillId: string): string {
    return path.join(this.globalSkillsRoot, skillId);
  }

  /** 串行执行会修改技能目录的操作；输入异步函数，返回其结果，前序失败不阻塞后续请求。 */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
