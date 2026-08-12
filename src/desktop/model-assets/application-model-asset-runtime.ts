import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  APPLICATION_MODEL_ASSET_SCHEMA,
  parseApplicationModelAssetRequest,
  parseDownloadApplicationModelAssetRequest,
  type ApplicationModelAssetKind,
  type ApplicationModelAssetProgressEvent,
  type ApplicationModelAssetProgressListener,
  type ApplicationModelAssetSource,
  type ApplicationModelAssetStatus,
} from "../contracts/application-model-assets";

const MODEL_ASSET_MANIFEST_SCHEMA = "openxnet.model-asset-install.v1";
const MODEL_ASSET_MANIFEST_NAME = ".openxnet-model.json";
const MAX_MODEL_MANIFEST_BYTES = 64 * 1024;

/** 固定模型文件声明。 */
export interface ApplicationModelAssetCatalogFile {
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly sha256: string;
}

/** 固定模型版本声明。 */
export interface ApplicationModelAssetCatalogRelease {
  readonly kind: ApplicationModelAssetKind;
  readonly modelName: string;
  readonly source: ApplicationModelAssetSource;
  readonly version: string;
  readonly files: readonly ApplicationModelAssetCatalogFile[];
}

/** Model Asset Runtime 构造依赖。 */
export interface ApplicationModelAssetRuntimeOptions {
  readonly modelRoots: Readonly<Record<ApplicationModelAssetKind, string>>;
  readonly prepareMutation: (kind: ApplicationModelAssetKind) => Promise<void>;
  readonly fetchImplementation?: typeof globalThis.fetch;
  readonly createOperationId?: () => string;
  readonly catalog?: readonly ApplicationModelAssetCatalogRelease[];
  readonly allowInsecureLoopback?: boolean;
  readonly logger?: Pick<Console, "warn">;
}

interface ModelAssetInstallManifest {
  readonly schema: typeof MODEL_ASSET_MANIFEST_SCHEMA;
  readonly kind: ApplicationModelAssetKind;
  readonly modelName: string;
  readonly source: ApplicationModelAssetSource;
  readonly version: string;
  readonly files: readonly {
    readonly name: string;
    readonly size: number;
    readonly sha256: string;
  }[];
}

interface ActiveModelDownload {
  readonly operationId: string;
  readonly kind: ApplicationModelAssetKind;
  readonly source: ApplicationModelAssetSource;
  readonly totalBytes: number;
  transferredBytes: number;
  lastPercent: number;
  lastPublishedAt: number;
}

/** 固定本地模型目录和不可变下载清单。 */
export const DEFAULT_APPLICATION_MODEL_ASSET_CATALOG: readonly ApplicationModelAssetCatalogRelease[] = Object.freeze([
  {
    kind: "sherpa",
    modelName: "sherpa-onnx-sense-voice-zh-en-ja-ko-yue",
    source: "modelscope",
    version: "73eca47697f980daa3d16112404174b6b950b514",
    files: [
      {
        name: "model.int8.onnx",
        url: "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/73eca47697f980daa3d16112404174b6b950b514/model.int8.onnx",
        size: 239_233_841,
        sha256: "c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51",
      },
      {
        name: "tokens.txt",
        url: "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/73eca47697f980daa3d16112404174b6b950b514/tokens.txt",
        size: 315_894,
        sha256: "f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc",
      },
    ],
  },
  {
    kind: "sherpa",
    modelName: "sherpa-onnx-sense-voice-zh-en-ja-ko-yue",
    source: "huggingface",
    version: "355f4d4884d8afd08aef04b9007a8556d7b463b2",
    files: [
      {
        name: "model.int8.onnx",
        url: "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09/resolve/355f4d4884d8afd08aef04b9007a8556d7b463b2/model.int8.onnx?download=true",
        size: 237_115_547,
        sha256: "12ca1a2ae7ecf3e0019ef2822307ee0b5cadc9196569e379b4c4026f8205276d",
      },
      {
        name: "tokens.txt",
        url: "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09/resolve/355f4d4884d8afd08aef04b9007a8556d7b463b2/tokens.txt?download=true",
        size: 315_894,
        sha256: "f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc",
      },
    ],
  },
  {
    kind: "minilm",
    modelName: "paraphrase-multilingual-MiniLM-L12-v2",
    source: "modelscope",
    version: "3d26be06a662164d54f7ffe720321c69d67b3766",
    files: [
      {
        name: "model_O4.onnx",
        url: "https://modelscope.cn/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/3d26be06a662164d54f7ffe720321c69d67b3766/onnx/model_O4.onnx",
        size: 235_166_264,
        sha256: "307bba13f9f5708461169c9f2d633c76c5572919bcc998606b6e5aea46f05db4",
      },
      {
        name: "tokenizer.json",
        url: "https://modelscope.cn/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/3d26be06a662164d54f7ffe720321c69d67b3766/tokenizer.json",
        size: 9_081_518,
        sha256: "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8",
      },
    ],
  },
  {
    kind: "minilm",
    modelName: "paraphrase-multilingual-MiniLM-L12-v2",
    source: "huggingface",
    version: "e8f8c211226b894fcb81acc59f3b34ba3efd5f42",
    files: [
      {
        name: "model_O4.onnx",
        url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/onnx/model_O4.onnx?download=true",
        size: 235_166_264,
        sha256: "307bba13f9f5708461169c9f2d633c76c5572919bcc998606b6e5aea46f05db4",
      },
      {
        name: "tokenizer.json",
        url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/tokenizer.json?download=true",
        size: 9_081_518,
        sha256: "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8",
      },
    ],
  },
]);

/** Main-owned 本地模型状态、下载、校验和原子安装服务。 */
export class ApplicationModelAssetRuntimeService {
  private readonly modelRoots: Readonly<Record<ApplicationModelAssetKind, string>>;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly createOperationId: () => string;
  private readonly catalog: readonly ApplicationModelAssetCatalogRelease[];
  private readonly allowInsecureLoopback: boolean;
  private readonly logger: Pick<Console, "warn">;
  private readonly listeners = new Set<ApplicationModelAssetProgressListener>();
  private readonly activeDownloads = new Map<ApplicationModelAssetKind, ActiveModelDownload>();
  private readonly activeMutations = new Set<ApplicationModelAssetKind>();

  /**
   * 创建模型资产 Runtime；输入固定根目录、Worker 停止器和可选下载依赖，仅校验清单且不访问磁盘或网络；清单非法时抛错。
   */
  public constructor(private readonly options: ApplicationModelAssetRuntimeOptions) {
    this.modelRoots = {
      sherpa: path.resolve(options.modelRoots.sherpa),
      minilm: path.resolve(options.modelRoots.minilm),
    };
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.createOperationId = options.createOperationId ?? randomUUID;
    this.catalog = options.catalog ?? DEFAULT_APPLICATION_MODEL_ASSET_CATALOG;
    this.allowInsecureLoopback = options.allowInsecureLoopback === true;
    this.logger = options.logger ?? console;
    this.validateCatalog();
  }

  /** 订阅模型进度；输入监听器，返回幂等取消函数；监听器异常不会影响下载。 */
  public subscribe(listener: ApplicationModelAssetProgressListener): () => void {
    this.listeners.add(listener);

    /** 移除当前模型进度监听器；无输入和返回，可重复调用。 */
    function unsubscribe(this: ApplicationModelAssetRuntimeService): void {
      this.listeners.delete(listener);
    }

    return unsubscribe.bind(this);
  }

  /**
   * 读取模型状态；输入不可信 kind，返回安装健康摘要；不启动 Worker、不访问网络，旧模型首次识别时会校验哈希并补写 manifest。
   */
  public async getStatus(value: unknown): Promise<ApplicationModelAssetStatus> {
    const request = parseApplicationModelAssetRequest(value);
    const active = this.activeDownloads.get(request.kind);
    if (active) {
      const release = this.getRelease(active.kind, active.source);
      return this.createStatus(release, "downloading", []);
    }
    return this.inspectInstalled(request.kind);
  }

  /**
   * 下载并原子安装模型；输入固定 kind/source，返回安装状态；并发同类操作、网络、大小、哈希或原子提交失败时抛出固定错误并清理暂存目录。
   */
  public async download(value: unknown): Promise<ApplicationModelAssetStatus> {
    const request = parseDownloadApplicationModelAssetRequest(value);
    if (this.activeMutations.has(request.kind)) throw new Error("Model asset operation is already running.");
    const release = this.getRelease(request.kind, request.source);
    const operation: ActiveModelDownload = {
      operationId: this.createOperationId(),
      kind: request.kind,
      source: request.source,
      totalBytes: release.files.reduce((total, file) => total + file.size, 0),
      transferredBytes: 0,
      lastPercent: -1,
      lastPublishedAt: 0,
    };
    this.activeMutations.add(request.kind);
    this.activeDownloads.set(request.kind, operation);
    const modelRoot = this.modelRoots[request.kind];
    const targetDirectory = path.join(modelRoot, release.modelName);
    const stagingDirectory = path.join(modelRoot, `.downloading-${request.kind}-${operation.operationId}`);
    try {
      await this.requireOwnedDirectory(modelRoot, true);
      await fs.rm(stagingDirectory, { recursive: true, force: true });
      await fs.mkdir(stagingDirectory, { recursive: false });
      this.publishProgress(operation, "preparing", "", true);
      for (const file of release.files) {
        await this.downloadFile(operation, file, path.join(stagingDirectory, file.name));
      }
      this.publishProgress(operation, "verifying", "", true);
      await this.writeManifest(stagingDirectory, release);
      await this.options.prepareMutation(request.kind);
      this.publishProgress(operation, "installing", "", true);
      await this.promoteStagingDirectory(targetDirectory, stagingDirectory, operation.operationId);
      this.publishProgress(operation, "completed", "", true);
      return this.createStatus(release, "installed", release.files.map((file) => ({ name: file.name, size: file.size })));
    } catch (error) {
      this.publishProgress(operation, "failed", "", true, publicDownloadErrorCode(error));
      throw new Error(publicDownloadErrorMessage(error));
    } finally {
      this.activeDownloads.delete(request.kind);
      this.activeMutations.delete(request.kind);
      await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * 删除本地模型；输入不可信 kind，返回未安装状态；操作进行中时拒绝，删除前停止对应 Worker，缺失目录按幂等成功处理。
   */
  public async remove(value: unknown): Promise<ApplicationModelAssetStatus> {
    const request = parseApplicationModelAssetRequest(value);
    if (this.activeMutations.has(request.kind)) throw new Error("Model asset operation is already running.");
    this.activeMutations.add(request.kind);
    const release = this.getRelease(request.kind, "modelscope");
    const targetDirectory = path.join(this.modelRoots[request.kind], release.modelName);
    const removingDirectory = path.join(
      this.modelRoots[request.kind],
      `.removing-${request.kind}-${this.createOperationId()}`,
    );
    try {
      await this.options.prepareMutation(request.kind);
      try {
        await fs.rename(targetDirectory, removingDirectory);
      } catch (error) {
        if (isMissingPathError(error)) return this.createStatus(release, "not-installed", []);
        throw new Error("Model asset could not be removed.");
      }
      try {
        await fs.rm(removingDirectory, { recursive: true, force: true });
        return this.createStatus(release, "not-installed", []);
      } catch {
        throw new Error("Model asset could not be removed.");
      }
    } finally {
      this.activeMutations.delete(request.kind);
    }
  }

  /** 校验固定清单；无输入和返回；重复项、路径、URL、大小或哈希非法时抛错。 */
  private validateCatalog(): void {
    const keys = new Set<string>();
    for (const release of this.catalog) {
      const key = `${release.kind}:${release.source}`;
      if (keys.has(key)) throw new Error("Model asset catalog contains duplicate releases.");
      keys.add(key);
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(release.modelName) || !/^[a-f0-9]{40}$/.test(release.version)) {
        throw new Error("Model asset catalog release is invalid.");
      }
      if (release.files.length === 0 || release.files.length > 16) throw new Error("Model asset catalog file count is invalid.");
      for (const file of release.files) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(file.name)) throw new Error("Model asset filename is invalid.");
        if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 2 * 1024 * 1024 * 1024) {
          throw new Error("Model asset file size is invalid.");
        }
        if (!/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error("Model asset file hash is invalid.");
        assertDownloadUrl(file.url, this.allowInsecureLoopback);
      }
    }
    for (const kind of ["sherpa", "minilm"] as const) {
      for (const source of ["modelscope", "huggingface"] as const) this.getRelease(kind, source);
    }
  }

  /** 查找固定模型版本；输入 kind/source，返回版本；清单缺失时抛错。 */
  private getRelease(kind: ApplicationModelAssetKind, source: ApplicationModelAssetSource): ApplicationModelAssetCatalogRelease {
    const release = this.catalog.find((item) => item.kind === kind && item.source === source);
    if (!release) throw new Error("Model asset release is unavailable.");
    return release;
  }

  /** 列出某类固定版本；输入 kind，返回两个源版本；清单缺失时返回空数组。 */
  private getReleases(kind: ApplicationModelAssetKind): readonly ApplicationModelAssetCatalogRelease[] {
    return this.catalog.filter((item) => item.kind === kind);
  }

  /** 检查已安装目录；输入 kind，返回状态；未知或损坏文件不会被当作可用模型。 */
  private async inspectInstalled(kind: ApplicationModelAssetKind): Promise<ApplicationModelAssetStatus> {
    const releases = this.getReleases(kind);
    const fallback = this.getRelease(kind, "modelscope");
    const targetDirectory = path.join(this.modelRoots[kind], fallback.modelName);
    let directoryInfo;
    try {
      directoryInfo = await fs.lstat(targetDirectory);
    } catch (error) {
      if (isMissingPathError(error)) return this.createStatus(fallback, "not-installed", []);
      return this.createStatus(fallback, "damaged", []);
    }
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) return this.createStatus(fallback, "damaged", []);
    const manifest = await this.readManifest(targetDirectory);
    if (manifest) {
      const release = releases.find((item) => item.source === manifest.source && item.version === manifest.version);
      if (release && await this.filesMatchRelease(targetDirectory, release, false)) {
        return this.createStatus(release, "installed", release.files.map((file) => ({ name: file.name, size: file.size })));
      }
      return this.createStatus(fallback, "damaged", []);
    }
    for (const release of releases) {
      if (!await this.filesMatchRelease(targetDirectory, release, true)) continue;
      try {
        await this.writeManifest(targetDirectory, release);
      } catch (error) {
        this.logger.warn("Verified legacy model manifest could not be persisted.", error);
      }
      return this.createStatus(release, "installed", release.files.map((file) => ({ name: file.name, size: file.size })));
    }
    return this.createStatus(fallback, "damaged", []);
  }

  /** 读取安装 manifest；输入目录，返回合法 manifest 或 null；缺失、超限、链接或结构漂移时返回 null。 */
  private async readManifest(directory: string): Promise<ModelAssetInstallManifest | null> {
    const manifestPath = path.join(directory, MODEL_ASSET_MANIFEST_NAME);
    try {
      const info = await fs.lstat(manifestPath);
      if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > MAX_MODEL_MANIFEST_BYTES) return null;
      return parseInstallManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")) as unknown);
    } catch {
      return null;
    }
  }

  /** 比较目录文件；输入目录、版本和是否校验哈希，返回布尔值；缺失、链接、大小或哈希漂移时返回 false。 */
  private async filesMatchRelease(
    directory: string,
    release: ApplicationModelAssetCatalogRelease,
    verifyHashes: boolean,
  ): Promise<boolean> {
    for (const file of release.files) {
      const filePath = path.join(directory, file.name);
      try {
        const info = await fs.lstat(filePath);
        if (!info.isFile() || info.isSymbolicLink() || info.size !== file.size) return false;
        if (verifyHashes && await hashFile(filePath) !== file.sha256) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  /** 下载并校验一个文件；输入活动操作、固定文件和目标路径，无返回；网络、大小或哈希不匹配时抛错并删除半文件。 */
  private async downloadFile(
    operation: ActiveModelDownload,
    file: ApplicationModelAssetCatalogFile,
    destination: string,
  ): Promise<void> {
    const response = await this.fetchImplementation(file.url, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "application/octet-stream,application/json,text/plain" },
    });
    if (!response.ok || !response.body || response.redirected && response.url === "") {
      throw new Error("MODEL_DOWNLOAD_FAILED");
    }
    assertDownloadUrl(response.url || file.url, this.allowInsecureLoopback);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 0 && contentLength !== file.size) {
      throw new Error("MODEL_SIZE_MISMATCH");
    }
    const handle = await fs.open(destination, "wx", 0o600);
    const hash = createHash("sha256");
    let fileBytes = 0;
    try {
      const reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const bytes = Buffer.from(chunk.value);
        fileBytes += bytes.length;
        operation.transferredBytes += bytes.length;
        if (fileBytes > file.size || operation.transferredBytes > operation.totalBytes) throw new Error("MODEL_SIZE_MISMATCH");
        hash.update(bytes);
        await handle.write(bytes);
        this.publishProgress(operation, "downloading", file.name, false);
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (fileBytes !== file.size) throw new Error("MODEL_SIZE_MISMATCH");
    if (hash.digest("hex") !== file.sha256) throw new Error("MODEL_HASH_MISMATCH");
    this.publishProgress(operation, "downloading", file.name, true);
  }

  /** 写入原子安装 manifest；输入目录和固定版本，无返回；序列化或重命名失败时抛错。 */
  private async writeManifest(directory: string, release: ApplicationModelAssetCatalogRelease): Promise<void> {
    const manifest: ModelAssetInstallManifest = {
      schema: MODEL_ASSET_MANIFEST_SCHEMA,
      kind: release.kind,
      modelName: release.modelName,
      source: release.source,
      version: release.version,
      files: release.files.map((file) => ({ name: file.name, size: file.size, sha256: file.sha256 })),
    };
    const target = path.join(directory, MODEL_ASSET_MANIFEST_NAME);
    const temporary = `${target}.tmp-${this.createOperationId()}`;
    await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, target);
  }

  /** 原子提升暂存目录；输入目标、暂存和操作 ID，无返回；失败时恢复原目录并抛错。 */
  private async promoteStagingDirectory(target: string, staging: string, operationId: string): Promise<void> {
    const backup = `${target}.replacing-${operationId}`;
    let backupCreated = false;
    let promoted = false;
    try {
      try {
        await fs.rename(target, backup);
        backupCreated = true;
      } catch (error) {
        if (!isMissingPathError(error)) throw error;
      }
      await fs.rename(staging, target);
      promoted = true;
      if (backupCreated) await fs.rm(backup, { recursive: true, force: true });
    } catch (error) {
      if (promoted) await fs.rm(target, { recursive: true, force: true });
      if (backupCreated) await fs.rename(backup, target);
      throw error;
    } finally {
      await fs.rm(backup, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** 校验或创建 Main-owned 根目录；输入路径和创建开关，无返回；链接、非目录或缺失时抛错。 */
  private async requireOwnedDirectory(directory: string, create: boolean): Promise<void> {
    if (create) await fs.mkdir(directory, { recursive: true });
    const info = await fs.lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("MODEL_ROOT_INVALID");
  }

  /** 构造公开状态；输入版本、状态和文件，返回无路径摘要，不访问磁盘。 */
  private createStatus(
    release: ApplicationModelAssetCatalogRelease,
    state: ApplicationModelAssetStatus["state"],
    files: ApplicationModelAssetStatus["files"],
  ): ApplicationModelAssetStatus {
    return {
      schema: APPLICATION_MODEL_ASSET_SCHEMA,
      kind: release.kind,
      modelName: release.modelName,
      state,
      source: state === "installed" || state === "downloading" ? release.source : null,
      version: state === "installed" ? release.version : null,
      files,
    };
  }

  /** 发布有节流的模型进度；输入操作、阶段、文件和强制开关，无返回；监听器错误会被隔离。 */
  private publishProgress(
    operation: ActiveModelDownload,
    phase: ApplicationModelAssetProgressEvent["phase"],
    currentFile: string,
    force: boolean,
    errorCode?: string,
  ): void {
    const percent = operation.totalBytes > 0
      ? Math.max(0, Math.min(100, Math.floor((operation.transferredBytes / operation.totalBytes) * 100)))
      : 0;
    const now = Date.now();
    if (!force && percent === operation.lastPercent && now - operation.lastPublishedAt < 100) return;
    operation.lastPercent = percent;
    operation.lastPublishedAt = now;
    const event: ApplicationModelAssetProgressEvent = {
      schema: APPLICATION_MODEL_ASSET_SCHEMA,
      operationId: operation.operationId,
      kind: operation.kind,
      source: operation.source,
      phase,
      percent: phase === "completed" ? 100 : percent,
      transferredBytes: operation.transferredBytes,
      totalBytes: operation.totalBytes,
      currentFile,
      ...(errorCode ? { errorCode } : {}),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn("Model asset progress listener failed.", error);
      }
    }
  }
}

/** 解析安装 manifest；输入未知 JSON，返回精确结构；字段、文件名、大小或哈希漂移时返回 null。 */
function parseInstallManifest(value: unknown): ModelAssetInstallManifest | null {
  if (!isExactRecord(value, ["schema", "kind", "modelName", "source", "version", "files"])) return null;
  if (value.schema !== MODEL_ASSET_MANIFEST_SCHEMA) return null;
  if (value.kind !== "sherpa" && value.kind !== "minilm") return null;
  if (value.source !== "modelscope" && value.source !== "huggingface") return null;
  if (typeof value.modelName !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.modelName)) return null;
  if (typeof value.version !== "string" || !/^[a-f0-9]{40}$/.test(value.version)) return null;
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > 16) return null;
  const files: Array<{ name: string; size: number; sha256: string }> = [];
  for (const item of value.files) {
    if (!isExactRecord(item, ["name", "size", "sha256"])) return null;
    if (typeof item.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(item.name)) return null;
    if (!Number.isSafeInteger(item.size) || Number(item.size) <= 0) return null;
    if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)) return null;
    files.push({ name: item.name, size: Number(item.size), sha256: item.sha256 });
  }
  return {
    schema: MODEL_ASSET_MANIFEST_SCHEMA,
    kind: value.kind,
    modelName: value.modelName,
    source: value.source,
    version: value.version,
    files,
  };
}

/** 校验精确普通对象；输入值和字段，返回是否匹配；不抛错且不修改输入。 */
function isExactRecord(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((field) => fields.includes(field));
}

/** 计算普通文件 SHA-256；输入路径，返回十六进制哈希；读取失败时向上抛错。 */
async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

/** 校验固定下载 URL；输入 URL 和开发开关，返回解析结果；凭据、协议或非回环明文 URL 时抛错。 */
function assertDownloadUrl(value: string, allowInsecureLoopback: boolean): URL {
  const url = new URL(value);
  if (url.username || url.password) throw new Error("Model asset URL contains credentials.");
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback)) {
    throw new Error("Model asset URL must use HTTPS.");
  }
  return url;
}

/** 判断文件系统错误是否为路径缺失；输入未知错误，返回布尔值，不修改错误。 */
function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** 映射下载失败代码；输入未知错误，返回固定公开 code，不泄露 URL、路径或底层异常。 */
function publicDownloadErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "MODEL_HASH_MISMATCH") return "HASH_MISMATCH";
  if (message === "MODEL_SIZE_MISMATCH") return "SIZE_MISMATCH";
  if (message === "MODEL_ROOT_INVALID") return "STORAGE_INVALID";
  return "DOWNLOAD_FAILED";
}

/** 映射下载失败消息；输入未知错误，返回固定公开文本，不泄露 URL、路径或底层异常。 */
function publicDownloadErrorMessage(error: unknown): string {
  const code = publicDownloadErrorCode(error);
  if (code === "HASH_MISMATCH") return "Model asset integrity verification failed.";
  if (code === "SIZE_MISMATCH") return "Model asset size verification failed.";
  if (code === "STORAGE_INVALID") return "Model asset storage is invalid.";
  return "Model asset download failed.";
}
