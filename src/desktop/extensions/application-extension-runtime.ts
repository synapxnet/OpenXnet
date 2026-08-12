import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { createServer } from "node:net";
import { connect } from "node:net";
import path from "node:path";
import type { Readable } from "node:stream";

import {
  APPLICATION_EXTENSION_RUNTIME_SCHEMA,
  type ApplicationExtensionCatalog,
  type ApplicationExtensionMutationResult,
  type ApplicationExtensionRecord,
  type ApplicationExtensionStartResult,
  type ApplicationExtensionWriteResult,
  type ApplicationRemoteExtensionCatalog,
  type ApplicationRemoteExtensionRecord,
  MAX_INLINE_EXTENSION_ARCHIVE_BYTES,
} from "../contracts/application-extensions-runtime";
import {
  computePackageDependencyHash,
  createPrivateTemporaryDirectory,
  downloadBoundedHttpsFile,
  extractValidatedZip,
  findSingleWrappedPackageRoot,
  isPlainRecord,
  materializeArchiveEntry,
  pathExists,
  readBoundedUtf8File,
  requireExactRecord,
  requirePackageId,
  type ApplicationPackageFetch,
  type SafeZipArchiveBudget,
} from "../package-management/safe-package-archive";
import { ApplicationExtensionGateway } from "./application-extension-gateway";

const EXTENSION_ZIP_BUDGET: SafeZipArchiveBudget = Object.freeze({
  maximumArchiveBytes: 256 * 1024 * 1024,
  maximumExtractedBytes: 1024 * 1024 * 1024,
  maximumEntries: 50_000,
  maximumEntryBytes: 512 * 1024 * 1024,
});
const MAX_EXTENSION_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_REMOTE_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_REMOTE_EXTENSIONS = 500;
const MAX_CHILD_OUTPUT_BYTES = 64 * 1024;
const NPM_INSTALL_TIMEOUT_MS = 5 * 60_000;
const NODE_HEALTH_TIMEOUT_MS = 15_000;
const EXTENSION_DOWNLOAD_HOSTS = new Set(["github.com", "codeload.github.com", "gitee.com"]);
const DEFAULT_REMOTE_CATALOG_URLS = Object.freeze([
  "https://raw.githubusercontent.com/super-agent-party/super-agent-party.github.io/main/plugins.json",
  "https://gitee.com/super-agent-party/super-agent-party.github.io/raw/main/plugins.json",
]);

/** Extension Runtime 的诊断输出。 */
export interface ApplicationExtensionRuntimeLogger {
  info(message: string): void;
  warn(message: string, error?: unknown): void;
}

/** Extension Runtime 构造依赖。 */
export interface ApplicationExtensionRuntimeOptions {
  readonly extensionRoot: string;
  readonly nodeExecutable: string;
  readonly npmCliPath: string;
  readonly fetch?: ApplicationPackageFetch;
  readonly remoteCatalogUrls?: readonly string[];
  readonly logger?: ApplicationExtensionRuntimeLogger;
  readonly now?: () => Date;
}

interface ParsedExtensionRepository {
  readonly id: string;
  readonly repository: string;
  readonly archiveUrl: string;
}

interface RunningExtension {
  readonly process: ExtensionChildProcess;
  readonly port: number;
  output: string;
}

type ExtensionChildProcess = ChildProcessByStdio<null, Readable, Readable>;

/** 判断运行时未知值是否为字符串；输入任意值，返回字符串或默认值，无副作用。 */
function readString(value: unknown, fallback = "", maximumLength = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : fallback;
}

/** 从 npm author 字段读取展示文本；输入字符串或对象，返回有界作者名，无副作用。 */
function readAuthor(value: unknown): string {
  if (typeof value === "string") return readString(value, "未知", 160) || "未知";
  if (isPlainRecord(value)) return readString(value.name, "未知", 160) || "未知";
  return "未知";
}

/** 从 npm repository 字段读取 URL；输入字符串或对象，返回有界 URL，无副作用。 */
function readRepository(value: unknown): string {
  if (typeof value === "string") return readString(value, "", 2048);
  if (isPlainRecord(value)) return readString(value.url, "", 2048).replace(/^git\+/, "");
  return "";
}

/** 把未知数值限制到 UI 尺寸范围；输入值和默认值，返回整数，无副作用。 */
function readDimension(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(4096, Math.max(240, Math.round(value)))
    : fallback;
}

/** 解析固定仓库根 URL；输入 URL，返回规范仓库、稳定 ID 和 ZIP URL，非 HTTPS、非 GitHub/Gitee 或深层路径时抛错。 */
function parseExtensionRepository(value: unknown): ParsedExtensionRepository {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    throw new Error("Extension repository URL is invalid.");
  }
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Extension repository URL is invalid.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "gitee.com") throw new Error("Extension repository host is not allowed.");
  const segments = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (segments.length !== 2) throw new Error("Extension repository must point to a repository root.");
  const owner = segments[0] ?? "";
  const repositoryName = (segments[1] ?? "").replace(/\.git$/i, "");
  const segmentPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
  if (!segmentPattern.test(owner) || !segmentPattern.test(repositoryName)) {
    throw new Error("Extension repository path is invalid.");
  }
  const repository = `https://${host}/${owner}/${repositoryName}`;
  return {
    id: requirePackageId(`${owner}_${repositoryName}`, "Extension id"),
    repository,
    archiveUrl: host === "github.com"
      ? `${repository}/archive/refs/heads/main.zip`
      : `${repository}/repository/archive/main.zip`,
  };
}

/** 校验扩展 ID 请求；输入未知值，返回稳定 ID，字段漂移或 ID 非法时抛错。 */
function parseExtensionIdRequest(value: unknown): string {
  const request = requireExactRecord(value, ["extensionId"], "extension request");
  return requirePackageId(request.extensionId, "Extension id");
}

/** 校验扩展仓库安装请求；输入未知值，返回主/备用仓库，字段或仓库非法时抛错。 */
function parseRepositoryInstallRequest(value: unknown): {
  readonly primary: ParsedExtensionRepository;
  readonly backup: ParsedExtensionRepository | null;
} {
  const request = requireExactRecord(value, ["repository", "backupRepository"], "extension repository request");
  const primary = parseExtensionRepository(request.repository);
  const backupValue = readString(request.backupRepository, "", 2048);
  const backup = backupValue ? parseExtensionRepository(backupValue) : null;
  if (backup !== null && backup.id.toLowerCase() !== primary.id.toLowerCase()) {
    throw new Error("Backup repository must identify the same extension.");
  }
  return { primary, backup };
}

/** 创建默认 fetch 适配器；无输入，返回有界下载接口，网络错误时拒绝且不读取凭据。 */
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

/** 管理扩展目录、安全安装、独立页面 Gateway 和受监督 Node 生命周期。 */
export class ApplicationExtensionRuntimeService {
  private readonly extensionRoot: string;
  private readonly fetchResource: ApplicationPackageFetch;
  private readonly remoteCatalogUrls: readonly string[];
  private readonly logger: ApplicationExtensionRuntimeLogger;
  private readonly running = new Map<string, RunningExtension>();
  private readonly gateway: ApplicationExtensionGateway;
  private operationQueue: Promise<void> = Promise.resolve();

  /** 创建 Extension Runtime；输入目录、Node/npm 和网络边界，仅保存配置，不扫描目录或启动进程。 */
  public constructor(private readonly options: ApplicationExtensionRuntimeOptions) {
    this.extensionRoot = path.resolve(options.extensionRoot);
    this.fetchResource = options.fetch ?? createDefaultPackageFetch();
    this.remoteCatalogUrls = options.remoteCatalogUrls ?? DEFAULT_REMOTE_CATALOG_URLS;
    this.logger = options.logger ?? console;
    this.gateway = new ApplicationExtensionGateway({
      extensionRoot: this.extensionRoot,
      getNodePort: (extensionId) => this.running.get(extensionId)?.port ?? null,
    });
  }

  /** 列出本机扩展；无输入，返回有界元数据，缺失目录会创建，损坏条目被忽略且不启动 Python。 */
  public async listExtensions(): Promise<ApplicationExtensionCatalog> {
    await mkdir(this.extensionRoot, { recursive: true });
    const entries = await readdir(this.extensionRoot, { withFileTypes: true });
    const extensions: ApplicationExtensionRecord[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      try {
        const extensionId = requirePackageId(entry.name, "Extension id");
        const record = await this.readExtension(extensionId);
        if (record !== null) extensions.push(record);
      } catch (error) {
        this.logger.warn(`Ignored invalid extension directory: ${entry.name}`, error);
      }
    }
    return { schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA, success: true, extensions };
  }

  /** 读取固定远程扩展目录；无输入，返回已安装状态，所有固定源失败或目录非法时拒绝。 */
  public async listRemoteExtensions(): Promise<ApplicationRemoteExtensionCatalog> {
    const installed = await this.listExtensions();
    const installedRepositories = new Set(installed.extensions.map((item) => normalizeRepository(item.repository)).filter(Boolean));
    const temporaryDirectory = await createPrivateTemporaryDirectory(this.extensionRoot, "catalog");
    try {
      let lastError: unknown = null;
      for (const catalogUrl of this.remoteCatalogUrls) {
        const catalogPath = path.join(temporaryDirectory, "plugins.json");
        try {
          await downloadBoundedHttpsFile(this.fetchResource, catalogUrl, catalogPath, {
            allowedHosts: new Set(["raw.githubusercontent.com", "gitee.com"]),
            maximumBytes: MAX_REMOTE_CATALOG_BYTES,
            timeoutMs: 15_000,
          });
          const parsed = JSON.parse(await readBoundedUtf8File(catalogPath, MAX_REMOTE_CATALOG_BYTES, "Extension catalog")) as unknown;
          if (!Array.isArray(parsed) || parsed.length > MAX_REMOTE_EXTENSIONS) throw new Error("Extension catalog is invalid.");
          const plugins = parsed.map((item) => this.parseRemoteExtension(item, installedRepositories));
          return { schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA, success: true, plugins };
        } catch (error) {
          lastError = error;
          await rm(catalogPath, { force: true });
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Remote extension catalog is unavailable.");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  /** 从固定仓库主机安装扩展；输入主/备用仓库，返回安装元数据，已存在、下载或校验失败时原目录不变。 */
  public installFromRepository(request: unknown): Promise<ApplicationExtensionWriteResult> {
    const parsed = parseRepositoryInstallRequest(request);
    return this.enqueueOperation(async () => {
      const target = this.extensionPath(parsed.primary.id);
      if (await pathExists(target)) throw new Error("Extension already exists; use update instead.");
      return this.installRepositoryCandidates(parsed.primary.id, [parsed.primary, parsed.backup].filter((item): item is ParsedExtensionRepository => item !== null), "installed");
    });
  }

  /** 从 preload 提取的本机 ZIP 安装扩展；输入真实文件项，返回安装元数据，文件超限、结构非法或 ID 冲突时不改目录。 */
  public importArchive(request: unknown): Promise<ApplicationExtensionWriteResult> {
    const parsed = requireExactRecord(request, ["entry"], "extension archive request");
    return this.enqueueOperation(async () => {
      const temporaryDirectory = await createPrivateTemporaryDirectory(this.extensionRoot, "import");
      try {
        const archivePath = path.join(temporaryDirectory, "package.zip");
        const originalName = await materializeArchiveEntry(parsed.entry, archivePath, EXTENSION_ZIP_BUDGET.maximumArchiveBytes);
        const extensionId = requirePackageId(path.basename(originalName, path.extname(originalName)), "Extension id");
        if (await pathExists(this.extensionPath(extensionId))) throw new Error("Extension already exists.");
        const extension = await this.installArchive(extensionId, archivePath, "installed");
        return { schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA, success: true, operation: "installed", extension };
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });
  }

  /** 更新已安装扩展；输入稳定 ID，返回新元数据，缺少仓库、下载或原子替换失败时保留旧版本。 */
  public updateExtension(request: unknown): Promise<ApplicationExtensionWriteResult> {
    const extensionId = parseExtensionIdRequest(request);
    return this.enqueueOperation(async () => {
      const current = await this.requireExtension(extensionId);
      const repositories = [current.repository, current.backupRepository]
        .filter(Boolean)
        .map(parseExtensionRepository);
      if (repositories.length === 0) throw new Error("Extension package does not declare a repository.");
      if (repositories.some((item) => item.id.toLowerCase() !== extensionId.toLowerCase())) {
        throw new Error("Extension repository does not match its installed id.");
      }
      await this.stopById(extensionId);
      return this.installRepositoryCandidates(extensionId, repositories, "updated");
    });
  }

  /** 删除已安装扩展；输入稳定 ID，先停止 Node 再删除普通目录，缺失或链接目录时拒绝。 */
  public removeExtension(request: unknown): Promise<ApplicationExtensionMutationResult> {
    const extensionId = parseExtensionIdRequest(request);
    return this.enqueueOperation(async () => {
      const target = this.extensionPath(extensionId);
      const info = await lstat(target);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Extension directory is invalid.");
      await this.stopById(extensionId);
      await rm(target, { recursive: true, force: false });
      return { schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA, success: true, operation: "removed", extensionId };
    });
  }

  /** 启动扩展页面；输入稳定 ID，返回独立 Origin URL，静态扩展不创建子进程，Node 失败时清理进程并拒绝。 */
  public startExtension(request: unknown): Promise<ApplicationExtensionStartResult> {
    const extensionId = parseExtensionIdRequest(request);
    return this.enqueueOperation(async () => {
      const extension = await this.requireExtension(extensionId);
      const origin = await this.gateway.start();
      if (extension.hasNodeEntry) await this.startNodeExtension(extensionId);
      return {
        schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA,
        success: true,
        extensionId,
        mode: extension.hasNodeEntry ? "node" : "static",
        url: `${origin}/${encodeURIComponent(extensionId)}/`,
      };
    });
  }

  /** 停止一个 Node 扩展；输入稳定 ID，返回停止结果，未运行时保持幂等。 */
  public stopExtension(request: unknown): Promise<ApplicationExtensionMutationResult> {
    const extensionId = parseExtensionIdRequest(request);
    return this.enqueueOperation(async () => {
      await this.stopById(extensionId);
      return { schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA, success: true, operation: "stopped", extensionId };
    });
  }

  /** 关闭全部扩展进程和独立 Gateway；无输入和返回，单个停止失败不会阻断其余清理。 */
  public async close(): Promise<void> {
    for (const extensionId of [...this.running.keys()]) {
      try {
        await this.stopById(extensionId);
      } catch (error) {
        this.logger.warn(`Failed to stop extension ${extensionId}.`, error);
      }
    }
    await this.gateway.stop();
  }

  /** 依次尝试仓库候选源；输入 ID、候选和操作，返回写入结果，全部失败时抛最后错误且清理暂存目录。 */
  private async installRepositoryCandidates(
    extensionId: string,
    repositories: readonly ParsedExtensionRepository[],
    operation: "installed" | "updated",
  ): Promise<ApplicationExtensionWriteResult> {
    const temporaryDirectory = await createPrivateTemporaryDirectory(this.extensionRoot, "download");
    let lastError: unknown = null;
    try {
      for (const repository of repositories) {
        const archivePath = path.join(temporaryDirectory, `${randomUUID()}.zip`);
        try {
          await downloadBoundedHttpsFile(this.fetchResource, repository.archiveUrl, archivePath, {
            allowedHosts: EXTENSION_DOWNLOAD_HOSTS,
            maximumBytes: EXTENSION_ZIP_BUDGET.maximumArchiveBytes,
          });
          const extension = await this.installArchive(extensionId, archivePath, operation);
          return { schema: APPLICATION_EXTENSION_RUNTIME_SCHEMA, success: true, operation, extension };
        } catch (error) {
          lastError = error;
          await rm(archivePath, { force: true });
        }
      }
      throw lastError instanceof Error ? lastError : new Error("No extension repository source is available.");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  /** 解压、验证并原子替换一个扩展；输入 ID、ZIP 和操作，返回最终元数据，失败时恢复旧目录。 */
  private async installArchive(
    extensionId: string,
    archivePath: string,
    operation: "installed" | "updated",
  ): Promise<ApplicationExtensionRecord> {
    const temporaryDirectory = await createPrivateTemporaryDirectory(this.extensionRoot, "extract");
    try {
      const extractedRoot = path.join(temporaryDirectory, "unpacked");
      await extractValidatedZip(archivePath, extractedRoot, EXTENSION_ZIP_BUDGET);
      const packageRoot = await findSingleWrappedPackageRoot(extractedRoot, ["index.html", "index.js", "package.json"]);
      await this.validatePreparedExtension(packageRoot);
      await this.replaceExtensionDirectory(extensionId, packageRoot, operation === "updated");
      return this.requireExtension(extensionId);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  /** 校验暂存扩展结构；输入包根，无返回，缺少入口、Node 无 package.json 或入口为链接时抛错。 */
  private async validatePreparedExtension(packageRoot: string): Promise<void> {
    const staticEntry = path.join(packageRoot, "index.html");
    const nodeEntry = path.join(packageRoot, "index.js");
    const hasStaticEntry = await this.isRegularFile(staticEntry);
    const hasNodeEntry = await this.isRegularFile(nodeEntry);
    if (!hasStaticEntry && !hasNodeEntry) throw new Error("Extension ZIP must contain index.html or index.js.");
    if (hasNodeEntry && !await this.isRegularFile(path.join(packageRoot, "package.json"))) {
      throw new Error("Node extension must contain package.json.");
    }
    if (await pathExists(path.join(packageRoot, "package.json"))) {
      const text = await readBoundedUtf8File(path.join(packageRoot, "package.json"), MAX_EXTENSION_PACKAGE_BYTES, "Extension package.json");
      if (!isPlainRecord(JSON.parse(text) as unknown)) throw new Error("Extension package.json is invalid.");
    }
  }

  /** 原子替换扩展目录并按依赖指纹复用 node_modules；输入 ID、准备目录和更新标志，无返回，失败时恢复旧目录。 */
  private async replaceExtensionDirectory(extensionId: string, preparedRoot: string, allowExisting: boolean): Promise<void> {
    const target = this.extensionPath(extensionId);
    const targetExists = await pathExists(target);
    if (targetExists !== allowExisting) {
      throw new Error(targetExists ? "Extension already exists." : "Extension is not installed.");
    }
    const backup = path.join(this.extensionRoot, `.backup-${extensionId}-${randomUUID()}`);
    let movedOld = false;
    let movedNew = false;
    let preserveNodeModules = false;
    if (targetExists) {
      const targetInfo = await lstat(target);
      if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) throw new Error("Installed extension directory is invalid.");
      const [oldHash, newHash] = await Promise.all([
        computePackageDependencyHash(path.join(target, "package.json")),
        computePackageDependencyHash(path.join(preparedRoot, "package.json")),
      ]);
      preserveNodeModules = oldHash !== null
        && oldHash === newHash
        && await this.isRegularDirectory(path.join(target, "node_modules"));
    }
    try {
      if (targetExists) {
        await rename(target, backup);
        movedOld = true;
      }
      await rename(preparedRoot, target);
      movedNew = true;
      if (preserveNodeModules) {
        await rename(path.join(backup, "node_modules"), path.join(target, "node_modules"));
      }
      if (movedOld) await rm(backup, { recursive: true, force: true });
    } catch (error) {
      if (movedNew) await rm(target, { recursive: true, force: true });
      if (movedOld && await pathExists(backup)) await rename(backup, target);
      throw error;
    }
  }

  /** 读取一个扩展元数据；输入稳定 ID，返回记录，无入口时返回 null，损坏 package.json 时使用默认字段。 */
  private async readExtension(extensionId: string): Promise<ApplicationExtensionRecord | null> {
    const extensionDirectory = this.extensionPath(extensionId);
    const directoryInfo = await lstat(extensionDirectory);
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) return null;
    const hasStaticEntry = await this.isRegularFile(path.join(extensionDirectory, "index.html"));
    const hasNodeEntry = await this.isRegularFile(path.join(extensionDirectory, "index.js"));
    if (!hasStaticEntry && !hasNodeEntry) return null;
    let metadata: Record<string, unknown> = {};
    const packagePath = path.join(extensionDirectory, "package.json");
    if (await this.isRegularFile(packagePath)) {
      try {
        const parsed = JSON.parse(await readBoundedUtf8File(packagePath, MAX_EXTENSION_PACKAGE_BYTES, "Extension package.json")) as unknown;
        if (isPlainRecord(parsed)) metadata = parsed;
      } catch (error) {
        this.logger.warn(`Ignored invalid package.json for extension ${extensionId}.`, error);
      }
    }
    return {
      id: extensionId,
      name: readString(metadata.name, extensionId, 160) || extensionId,
      description: readString(metadata.description, "无描述", 1000) || "无描述",
      version: readString(metadata.version, "1.0.0", 80) || "1.0.0",
      author: readAuthor(metadata.author),
      systemPrompt: readString(metadata.systemPrompt, "", 64 * 1024),
      repository: readRepository(metadata.repository),
      backupRepository: readRepository(metadata.backupRepository),
      category: readString(metadata.category, "", 120),
      transparent: metadata.transparent === true,
      width: readDimension(metadata.width, 800),
      height: readDimension(metadata.height, 600),
      enableVrmWindowSize: metadata.enableVrmWindowSize === true,
      hasStaticEntry,
      hasNodeEntry,
    };
  }

  /** 要求扩展存在；输入稳定 ID，返回元数据，缺失或无入口时抛错。 */
  private async requireExtension(extensionId: string): Promise<ApplicationExtensionRecord> {
    const extension = await this.readExtension(extensionId).catch(() => null);
    if (extension === null) throw new Error("Extension is not installed.");
    return extension;
  }

  /** 解析远程目录条目；输入未知值和本机仓库集合，返回有界记录，字段或仓库非法时抛错。 */
  private parseRemoteExtension(
    value: unknown,
    installedRepositories: ReadonlySet<string>,
  ): ApplicationRemoteExtensionRecord {
    if (!isPlainRecord(value)) throw new Error("Remote extension entry is invalid.");
    const repository = parseExtensionRepository(value.repository);
    const backupValue = readString(value.backupRepository, "", 2048);
    if (backupValue) parseExtensionRepository(backupValue);
    return {
      id: repository.id,
      name: readString(value.name, repository.id, 160) || repository.id,
      description: readString(value.description, "", 1000),
      author: readString(value.author, "未知", 160) || "未知",
      version: readString(value.version, "1.0.0", 80) || "1.0.0",
      category: readString(value.category, "Unknown", 120) || "Unknown",
      repository: repository.repository,
      backupRepository: backupValue,
      installed: installedRepositories.has(normalizeRepository(repository.repository)),
    };
  }

  /** 启动一个 Node 扩展；输入稳定 ID，无返回，依赖安装、进程退出或端口未就绪时清理并抛错。 */
  private async startNodeExtension(extensionId: string): Promise<void> {
    const existing = this.running.get(extensionId);
    if (existing && existing.process.exitCode === null) return;
    if (existing) this.running.delete(extensionId);
    const extensionDirectory = this.extensionPath(extensionId);
    await this.installNodeDependenciesIfNeeded(extensionDirectory);
    const port = await reserveLoopbackPort();
    const child = spawn(this.options.nodeExecutable, ["index.js", String(port)], {
      cwd: extensionDirectory,
      env: this.createChildEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    const running: RunningExtension = { process: child, port, output: "" };
    this.running.set(extensionId, running);
    this.captureChildOutput(running, child.stdout);
    this.captureChildOutput(running, child.stderr);
    child.once("exit", () => {
      if (this.running.get(extensionId)?.process === child) this.running.delete(extensionId);
    });
    try {
      await waitForLoopbackPort(port, child, NODE_HEALTH_TIMEOUT_MS);
    } catch (error) {
      await terminateChild(child);
      this.running.delete(extensionId);
      const detail = running.output.trim();
      throw new Error(detail ? `Extension process failed: ${detail}` : "Extension process did not become ready.", { cause: error });
    }
  }

  /** 在需要时用随包 npm 安装生产依赖；输入扩展目录，无返回，无依赖时跳过，命令失败或超时时抛错。 */
  private async installNodeDependenciesIfNeeded(extensionDirectory: string): Promise<void> {
    const packagePath = path.join(extensionDirectory, "package.json");
    const packageText = await readBoundedUtf8File(packagePath, MAX_EXTENSION_PACKAGE_BYTES, "Extension package.json");
    const packageDocument = JSON.parse(packageText) as unknown;
    if (!isPlainRecord(packageDocument)) throw new Error("Extension package.json is invalid.");
    const dependencies = isPlainRecord(packageDocument.dependencies) ? Object.keys(packageDocument.dependencies) : [];
    if (dependencies.length === 0) return;
    const nodeModulesPath = path.join(extensionDirectory, "node_modules");
    if (await this.isRegularDirectory(nodeModulesPath)) {
      const [modulesInfo, packageInfo] = await Promise.all([stat(nodeModulesPath), stat(packagePath)]);
      if (modulesInfo.mtimeMs >= packageInfo.mtimeMs) return;
    }
    if (!existsSync(this.options.npmCliPath)) throw new Error("Bundled npm CLI is unavailable.");
    const result = await runBoundedChild(
      this.options.nodeExecutable,
      [this.options.npmCliPath, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
      extensionDirectory,
      this.createChildEnvironment(),
      NPM_INSTALL_TIMEOUT_MS,
    );
    if (result.exitCode !== 0) throw new Error(`npm install failed: ${result.output || `exit ${result.exitCode}`}`);
  }

  /** 构造扩展进程最小环境；无输入，返回通用系统路径和 Node 标记，不包含应用凭据。 */
  private createChildEnvironment(): NodeJS.ProcessEnv {
    const allowedNames = [
      "APPDATA", "ComSpec", "HOME", "LANG", "LC_ALL", "LOCALAPPDATA", "PATH", "PATHEXT",
      "SystemRoot", "TEMP", "TMP", "USERPROFILE", "WINDIR",
    ];
    const environment: NodeJS.ProcessEnv = {
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
    };
    for (const name of allowedNames) {
      const value = process.env[name];
      if (value) environment[name] = value;
    }
    return environment;
  }

  /** 有界收集扩展进程输出；输入运行记录和流，无返回，超过 64 KiB 时只保留尾部。 */
  private captureChildOutput(running: RunningExtension, stream: NodeJS.ReadableStream): void {
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      running.output = `${running.output}${chunk}`.slice(-MAX_CHILD_OUTPUT_BYTES);
    });
  }

  /** 停止指定运行进程；输入稳定 ID，无返回，未运行时幂等，超时后强制终止。 */
  private async stopById(extensionId: string): Promise<void> {
    const running = this.running.get(extensionId);
    if (!running) return;
    this.running.delete(extensionId);
    await terminateChild(running.process);
  }

  /** 判断路径是否为非链接普通文件；输入路径，返回布尔值，缺失和访问失败返回 false。 */
  private async isRegularFile(filePath: string): Promise<boolean> {
    try {
      const info = await lstat(filePath);
      return info.isFile() && !info.isSymbolicLink();
    } catch {
      return false;
    }
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

  /** 返回扩展绝对目录；输入已校验 ID，返回根目录内路径，不访问文件系统。 */
  private extensionPath(extensionId: string): string {
    return path.join(this.extensionRoot, extensionId);
  }

  /** 串行执行会修改扩展目录或进程的操作；输入异步函数，返回其结果，前序失败不阻塞后续请求。 */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

/** 规范仓库 URL 用于本机/远端比较；输入 URL，返回小写无尾斜杠文本，无副作用。 */
function normalizeRepository(value: string): string {
  return value.trim().replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

/** 预留一个临时回环端口；无输入，返回端口，监听或关闭失败时拒绝。 */
function reserveLoopbackPort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve extension port."));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

/** 等待子进程监听回环端口；输入端口、进程和预算，无返回，提前退出或超时时拒绝。 */
async function waitForLoopbackPort(
  port: number,
  child: ExtensionChildProcess,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Extension process exited with code ${child.exitCode}.`);
    const ready = await new Promise<boolean>((resolve) => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.setTimeout(300);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Extension process health check timed out.");
}

/** 终止子进程并等待退出；输入进程，无返回，3 秒未退出时强制终止。 */
async function terminateChild(child: ExtensionChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await signalChildTree(child, false);
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
  ]);
  if (!exited && child.exitCode === null) {
    await signalChildTree(child, true);
    if (child.exitCode === null) await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
}

/** 向受监督进程树发送终止信号；输入进程和强制标志，无返回，平台命令失败时回退到直接 kill。 */
async function signalChildTree(child: ExtensionChildProcess, force: boolean): Promise<void> {
  const processId = child.pid;
  if (processId === undefined) return;
  if (process.platform === "win32") {
    const arguments_ = ["/PID", String(processId), "/T", ...(force ? ["/F"] : [])];
    const killer = spawn("taskkill.exe", arguments_, { stdio: "ignore", windowsHide: true });
    const exitCode = await new Promise<number>((resolve) => {
      killer.once("error", () => resolve(-1));
      killer.once("exit", (code) => resolve(code ?? -1));
    });
    if (exitCode === 0 || child.exitCode !== null) return;
    child.kill(force ? "SIGKILL" : "SIGTERM");
    return;
  }
  try {
    process.kill(-processId, force ? "SIGKILL" : "SIGTERM");
  } catch {
    child.kill(force ? "SIGKILL" : "SIGTERM");
  }
}

/** 执行一次有界子进程命令；输入命令、参数、目录、环境和超时，返回退出码与输出，超时会终止进程。 */
async function runBoundedChild(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ readonly exitCode: number; readonly output: string }> {
  const child = spawn(command, [...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  let output = "";
  /** 收集一个输出流；输入可读流，无返回，只保留有界尾部。 */
  function capture(stream: NodeJS.ReadableStream): void {
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      output = `${output}${chunk}`.slice(-MAX_CHILD_OUTPUT_BYTES);
    });
  }
  capture(child.stdout);
  capture(child.stderr);
  const exitCode = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      void terminateChild(child).then(() => reject(new Error("Child process timed out.")), reject);
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code ?? -1);
    });
  });
  return { exitCode, output: output.trim() };
}
