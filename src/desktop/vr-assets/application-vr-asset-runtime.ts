import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  opendir,
  readdir,
  rename,
  rm,
  type FileHandle,
} from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

import {
  APPLICATION_VR_ASSET_SCHEMA,
  parseDeleteApplicationVrAssetRequest,
  parseDownloadApplicationCloudVrmModelRequest,
  parseImportApplicationVrAssetRequest,
  type ApplicationCloudVrmModelOption,
  type ApplicationVrAssetCatalog,
  type ApplicationVrAssetDeleteResult,
  type ApplicationVrAssetKind,
  type ApplicationVrAssetOption,
  type ApplicationVrAssetWriteResult,
  type ImportApplicationVrAssetRequest,
} from "../contracts/application-vr-assets";
import type { LegacyRendererStateSnapshot } from "../contracts/legacy-renderer-state";

const DEFAULT_REMOTE_BASE_URL = "https://resources.openxnet.synapxnet.com/vrm/";
const PACKAGED_MODEL_NAMES = new Set(["Eku_VRM_v1_0_0"]);
const SCENE_EXTENSIONS = new Set([".ply", ".spz", ".splat", ".ksplat", ".sog"]);
const MAX_NATIVE_BYTES: Readonly<Record<ApplicationVrAssetKind, number>> = Object.freeze({
  model: 512 * 1024 * 1024,
  motion: 128 * 1024 * 1024,
  scene: 4 * 1024 * 1024 * 1024,
});
const MAX_CLOUD_MODEL_BYTES = 1024 * 1024 * 1024;
const CLOUD_DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const URL_NAMESPACE_BYTES = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");

/** VR Runtime 读取和更新无密钥 VRMConfig 所需的最小状态边界。 */
export interface ApplicationVrAssetStateBoundary {
  getSnapshot(): LegacyRendererStateSnapshot;
  saveSettings(request: unknown): LegacyRendererStateSnapshot;
}

/** 云下载响应头的最小读取能力。 */
export interface ApplicationVrAssetResponseHeaders {
  get(name: string): string | null;
}

/** 云下载响应的最小流能力。 */
export interface ApplicationVrAssetFetchResponse {
  readonly status: number;
  readonly headers: ApplicationVrAssetResponseHeaders;
  readonly body: AsyncIterable<Uint8Array> | null;
}

/** 受 Main 网络栈实现的云下载函数。 */
export type ApplicationVrAssetFetch = (
  url: string,
  options: { readonly redirect: "manual"; readonly signal: AbortSignal },
) => Promise<ApplicationVrAssetFetchResponse>;

/** VR Asset Runtime 日志边界。 */
export interface ApplicationVrAssetLogger {
  warn(message: string): void;
}

/** VR Asset Runtime 构造依赖。 */
export interface ApplicationVrAssetRuntimeOptions {
  readonly vrAssetRoot: string;
  readonly uploadRoot: string;
  readonly state: ApplicationVrAssetStateBoundary;
  readonly cloudModelPaths: readonly string[];
  readonly remoteBaseUrl?: string;
  readonly fetch?: ApplicationVrAssetFetch;
  readonly logger?: ApplicationVrAssetLogger;
  readonly createId?: () => string;
}

interface CloudModelDefinition {
  readonly id: string;
  readonly name: string;
  readonly relativePath: string;
  readonly remoteUrl: string;
}

/** 判断未知值是否为普通对象；输入任意值，返回类型保护，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把未知值收敛为普通对象；输入任意值，返回原对象或空对象，无副作用。 */
function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return isRecord(value) ? value : {};
}

/** 把未知数组收敛为普通对象数组；输入任意值，返回过滤结果，无副作用。 */
function asRecordArray(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** 深度克隆有界设置；输入 JSON 对象，返回独立副本，序列化失败或超过 16 MiB 时抛错。 */
function cloneSettings(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 16 * 1024 * 1024) {
    throw new Error("VR asset settings exceed their byte budget.");
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

/** 把路径片段编码为同源 URL；输入 POSIX 相对路径，返回逐段编码路径，无副作用。 */
function encodeAssetPath(relativePath: string): string {
  return relativePath.split("/").map((part) => encodeURIComponent(part)).join("/");
}

/** 用 URL namespace 生成兼容 UUIDv5；输入名称，返回标准 UUID，无副作用。 */
function createUrlUuidV5(name: string): string {
  const digest = createHash("sha1").update(URL_NAMESPACE_BYTES).update(name, "utf8").digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 判断主机是否为回环地址；输入 hostname，返回布尔值，无网络访问。 */
function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "localhost") return true;
  const ipVersion = isIP(normalized);
  return ipVersion === 4
    ? normalized.startsWith("127.")
    : ipVersion === 6 && normalized === "::1";
}

/**
 * 规范云资源基址；输入候选 URL，返回无凭据目录 URL，外部明文、查询、片段或非法地址时返回 null。
 */
function normalizeRemoteBaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const secure = url.protocol === "https:";
    const loopbackDevelopment = url.protocol === "http:" && isLoopbackHost(url.hostname);
    if (!secure && !loopbackDevelopment) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.toString();
  } catch {
    return null;
  }
}

/** 返回资产类型允许的扩展名；输入类型，返回固定集合，无副作用。 */
function getAllowedExtensions(kind: ApplicationVrAssetKind): ReadonlySet<string> {
  if (kind === "model") return new Set([".vrm"]);
  if (kind === "motion") return new Set([".vrma"]);
  return SCENE_EXTENSIONS;
}

/** 判断稳定文件名是否匹配资产类型；输入类型和文件名，返回布尔值，无副作用。 */
function matchesKind(kind: ApplicationVrAssetKind, fileName: string): boolean {
  return getAllowedExtensions(kind).has(path.extname(fileName).toLowerCase());
}

/** 返回 VRMConfig 中对应用户集合字段；输入资产类型，返回固定字段名，无副作用。 */
function getCollectionField(kind: ApplicationVrAssetKind): "userModels" | "userMotions" | "gaussUserScenes" {
  if (kind === "model") return "userModels";
  if (kind === "motion") return "userMotions";
  return "gaussUserScenes";
}

/** 按固定位置完整写入一个流块；输入文件句柄、字节和位置，返回新位置，写入失败时抛错。 */
async function writeChunk(file: FileHandle, bytes: Uint8Array, position: number): Promise<number> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const result = await file.write(buffer, offset, buffer.byteLength - offset, position + offset);
    if (result.bytesWritten <= 0) throw new Error("VR asset stream write failed.");
    offset += result.bytesWritten;
  }
  return position + buffer.byteLength;
}

/** Main 持有的 VRM、VRMA、Gaussian 本地资产与固定云目录 Runtime。 */
export class ApplicationVrAssetRuntimeService {
  private readonly vrAssetRoot: string;
  private readonly uploadRoot: string;
  private readonly remoteBaseUrl: string;
  private readonly cloudModels: ReadonlyMap<string, CloudModelDefinition>;
  private readonly createId: () => string;
  private readonly logger: ApplicationVrAssetLogger;
  private operationQueue: Promise<void> = Promise.resolve();

  /** 创建 VR Runtime；输入资源根、用户目录、状态和固定云目录，不扫描磁盘或发起网络请求。 */
  public constructor(private readonly options: ApplicationVrAssetRuntimeOptions) {
    this.vrAssetRoot = path.resolve(options.vrAssetRoot);
    this.uploadRoot = path.resolve(options.uploadRoot);
    this.logger = options.logger ?? console;
    const configuredBaseUrl = normalizeRemoteBaseUrl(options.remoteBaseUrl ?? DEFAULT_REMOTE_BASE_URL);
    if (configuredBaseUrl === null) {
      this.logger.warn("VR asset remote base URL is invalid; the public default will be used.");
    }
    this.remoteBaseUrl = configuredBaseUrl ?? DEFAULT_REMOTE_BASE_URL;
    this.createId = options.createId ?? randomUUID;
    this.cloudModels = this.buildCloudCatalog(options.cloudModelPaths);
  }

  /** 读取完整 VR 资产目录；无输入，返回内置、用户和固定云模型，不启动 Python 或修改设置。 */
  public listAssets(): Promise<ApplicationVrAssetCatalog> {
    return this.enqueueOperation(async () => {
      const availableUploads = await this.readAvailableUploadNames();
      const vrmConfig = asRecord(this.options.state.getSnapshot().settings.VRMConfig);
      return {
        schema: APPLICATION_VR_ASSET_SCHEMA,
        success: true,
        defaultModels: await this.scanPackagedModels(),
        userModels: this.readUserAssets("model", vrmConfig, availableUploads),
        cloudModels: this.readCloudModels(availableUploads),
        defaultMotions: await this.scanFlatAssets("motion", path.join(this.vrAssetRoot, "animations")),
        userMotions: this.readUserAssets("motion", vrmConfig, availableUploads),
        defaultScenes: await this.scanFlatAssets("scene", path.join(this.vrAssetRoot, "scene")),
        userScenes: this.readUserAssets("scene", vrmConfig, availableUploads),
        remoteBaseUrl: this.remoteBaseUrl,
      };
    });
  }

  /** 导入一个用户 VR 资产；输入 preload 路径或有界字节，返回资产选项，校验、复制或设置保存失败时抛错。 */
  public importAsset(request: unknown): Promise<ApplicationVrAssetWriteResult> {
    const parsed = parseImportApplicationVrAssetRequest(request);
    return this.enqueueOperation(async () => {
      this.assertEntryExtension(parsed);
      await mkdir(this.uploadRoot, { recursive: true });
      const extension = path.extname(parsed.entry.originalName).toLowerCase();
      const assetId = `${this.createId() as string}${extension}`;
      const destination = path.join(this.uploadRoot, assetId);
      const temporaryPath = `${destination}.importing`;
      try {
        if (parsed.entry.source === "path") {
          await this.copyNativeEntry(parsed, temporaryPath);
        } else {
          const inlineBytes = parsed.entry.bytes;
          await open(temporaryPath, "wx").then(async (file) => {
            try {
              await writeChunk(file, inlineBytes, 0);
            } finally {
              await file.close();
            }
          });
        }
        await rename(temporaryPath, destination);
        const asset = this.createUserAsset(parsed.kind, assetId, parsed.displayName, "user");
        this.saveUserAsset(parsed.kind, asset);
        return { schema: APPLICATION_VR_ASSET_SCHEMA, success: true, asset };
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        if (!this.isAssetReferenced(parsed.kind, assetId)) {
          await rm(destination, { force: true }).catch(() => undefined);
        }
        throw error;
      }
    });
  }

  /** 删除一个用户 VR 资产；输入类型和稳定 ID，返回删除结果，内置、缺失、类型漂移或写入失败时抛错。 */
  public deleteAsset(request: unknown): Promise<ApplicationVrAssetDeleteResult> {
    const parsed = parseDeleteApplicationVrAssetRequest(request);
    return this.enqueueOperation(async () => {
      if (!matchesKind(parsed.kind, parsed.assetId)) throw new Error("VR asset kind does not match its ID.");
      const config = asRecord(this.options.state.getSnapshot().settings.VRMConfig);
      const field = getCollectionField(parsed.kind);
      const existsInConfig = asRecordArray(config[field]).some((item) => String(item.id ?? "") === parsed.assetId);
      if (!existsInConfig) throw new Error("VR asset was not found in user configuration.");
      const filePath = path.join(this.uploadRoot, parsed.assetId);
      const fileInfo = await lstat(filePath).catch(() => null);
      if (fileInfo === null || !fileInfo.isFile() || fileInfo.isSymbolicLink()) {
        throw new Error("VR asset file was not found.");
      }
      await rm(filePath);
      this.removeUserAsset(parsed.kind, parsed.assetId);
      return {
        schema: APPLICATION_VR_ASSET_SCHEMA,
        success: true,
        kind: parsed.kind,
        assetId: parsed.assetId,
      };
    });
  }

  /** 下载固定目录中的云 VRM；输入稳定模型 ID，返回用户资产，未知 ID、重定向、超限或网络失败时抛固定错误。 */
  public downloadCloudModel(request: unknown): Promise<ApplicationVrAssetWriteResult> {
    const parsed = parseDownloadApplicationCloudVrmModelRequest(request);
    return this.enqueueOperation(async () => {
      const model = this.cloudModels.get(parsed.modelId);
      if (model === undefined) throw new Error("Cloud VRM model was not found.");
      await mkdir(this.uploadRoot, { recursive: true });
      const destination = path.join(this.uploadRoot, model.id);
      const current = await lstat(destination).catch(() => null);
      if (current !== null && (!current.isFile() || current.isSymbolicLink())) {
        throw new Error("Cloud VRM destination is invalid.");
      }
      if (current === null) await this.downloadCloudFile(model, destination);
      const asset = this.createUserAsset("model", model.id, model.name, "cloud");
      this.saveUserAsset("model", asset);
      return { schema: APPLICATION_VR_ASSET_SCHEMA, success: true, asset };
    });
  }

  /** 把固定相对路径构造为云模型目录；输入路径列表，返回 ID 索引，非法或重复路径被忽略。 */
  private buildCloudCatalog(paths: readonly string[]): ReadonlyMap<string, CloudModelDefinition> {
    const catalog = new Map<string, CloudModelDefinition>();
    for (const item of paths) {
      const normalized = String(item || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
      if (!normalized || path.posix.extname(normalized).toLowerCase() !== ".vrm") continue;
      if (normalized.split("/").some((part) => !part || part === "." || part === "..")) continue;
      const id = `${createUrlUuidV5(`openxnet-vrm-cloud:${normalized}`)}.vrm`;
      const remoteUrl = new URL(encodeAssetPath(normalized), this.remoteBaseUrl).toString();
      catalog.set(id, { id, name: path.posix.basename(normalized, ".vrm"), relativePath: normalized, remoteUrl });
    }
    return catalog;
  }

  /** 扫描打包 VRM 目录；无输入，返回允许发布的普通文件，目录缺失时返回空数组。 */
  private async scanPackagedModels(): Promise<readonly ApplicationVrAssetOption[]> {
    const root = path.join(this.vrAssetRoot, "vrm");
    const results: ApplicationVrAssetOption[] = [];
    if (!existsSync(root)) return results;
    const queue = [root];
    while (queue.length > 0) {
      const directory = queue.shift()!;
      const handle = await opendir(directory).catch(() => null);
      if (handle === null) continue;
      for await (const entry of handle) {
        if (entry.isSymbolicLink()) continue;
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          queue.push(candidate);
          continue;
        }
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".vrm") continue;
        const modelDirectory = path.relative(root, candidate).split(path.sep)[0] ?? "";
        if (!PACKAGED_MODEL_NAMES.has(modelDirectory)) continue;
        const relativePath = path.relative(this.vrAssetRoot, candidate).split(path.sep).join("/");
        results.push({
          id: `builtin-${this.slug(relativePath)}-${createUrlUuidV5(relativePath).replace(/-/g, "").slice(0, 10)}`,
          name: path.basename(entry.name, ".vrm"),
          path: `/vrm/${encodeAssetPath(relativePath)}`,
          type: "default",
          source: "packaged",
          downloaded: true,
          downloadable: false,
        });
      }
    }
    return results.sort((left, right) => left.name.localeCompare(right.name));
  }

  /** 扫描一个内置平面资产目录；输入类型和目录，返回按名称排序的普通文件，缺失时返回空数组。 */
  private async scanFlatAssets(
    kind: "motion" | "scene",
    directory: string,
  ): Promise<readonly ApplicationVrAssetOption[]> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const results: ApplicationVrAssetOption[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink() || !matchesKind(kind, entry.name)) continue;
      const relativePath = path.relative(this.vrAssetRoot, path.join(directory, entry.name)).split(path.sep).join("/");
      results.push({
        id: path.basename(entry.name, path.extname(entry.name)),
        name: path.basename(entry.name, path.extname(entry.name)),
        path: `/vrm/${encodeAssetPath(relativePath)}`,
        type: "default",
        source: "packaged",
        downloaded: true,
        downloadable: false,
      });
    }
    return results.sort((left, right) => left.name.localeCompare(right.name));
  }

  /** 读取上传目录中的普通文件名；无输入，返回集合，缺失目录返回空集合且不创建目录。 */
  private async readAvailableUploadNames(): Promise<ReadonlySet<string>> {
    const entries = await readdir(this.uploadRoot, { withFileTypes: true }).catch(() => []);
    return new Set(entries.filter((entry) => entry.isFile() && !entry.isSymbolicLink()).map((entry) => entry.name));
  }

  /** 从 VRMConfig 投影仍存在的用户资产；输入类型、配置和文件集合，返回规范 URL，不修改状态。 */
  private readUserAssets(
    kind: ApplicationVrAssetKind,
    vrmConfig: Readonly<Record<string, unknown>>,
    availableUploads: ReadonlySet<string>,
  ): readonly ApplicationVrAssetOption[] {
    const field = getCollectionField(kind);
    return asRecordArray(vrmConfig[field]).flatMap((item) => {
      const id = String(item.id ?? "").trim();
      if (!id || !matchesKind(kind, id) || !availableUploads.has(id)) return [];
      const source = item.source === "cloud" || item.cloud === true ? "cloud" : "user";
      return [this.createUserAsset(kind, id, String(item.name ?? path.basename(id, path.extname(id))), source)];
    });
  }

  /** 投影固定云目录并标记本地状态；输入文件集合，返回按名称排序目录，无网络访问。 */
  private readCloudModels(availableUploads: ReadonlySet<string>): readonly ApplicationCloudVrmModelOption[] {
    return [...this.cloudModels.values()].map((model) => {
      const downloaded = availableUploads.has(model.id);
      return {
        ...model,
        remoteBaseUrl: this.remoteBaseUrl,
        type: "cloud" as const,
        source: "cloud" as const,
        cloud: true as const,
        downloaded,
        downloadable: !downloaded,
        ...(downloaded ? { path: `/uploaded_files/${encodeURIComponent(model.id)}` } : {}),
      };
    }).sort((left, right) => left.name.localeCompare(right.name));
  }

  /** 创建一个用户资产选项；输入类型、ID、名称和来源，返回同源 URL，无副作用。 */
  private createUserAsset(
    _kind: ApplicationVrAssetKind,
    id: string,
    name: string,
    source: "user" | "cloud",
  ): ApplicationVrAssetOption {
    return {
      id,
      name: name.trim().slice(0, 160) || path.basename(id, path.extname(id)),
      path: `/uploaded_files/${encodeURIComponent(id)}`,
      type: "user",
      source,
      downloaded: true,
      downloadable: false,
    };
  }

  /** 校验导入文件扩展名；输入已解析请求，无返回，显示名或真实路径扩展漂移时抛错。 */
  private assertEntryExtension(request: ImportApplicationVrAssetRequest): void {
    if (!matchesKind(request.kind, request.entry.originalName)) {
      throw new Error("VR asset extension is unsupported for its kind.");
    }
    if (request.entry.source === "path" && !matchesKind(request.kind, request.entry.path)) {
      throw new Error("VR asset source extension is unsupported for its kind.");
    }
  }

  /** 流式复制一个本机资产；输入请求和临时目标，无返回，符号链接、非普通文件、超限或大小漂移时抛错。 */
  private async copyNativeEntry(request: ImportApplicationVrAssetRequest, temporaryPath: string): Promise<void> {
    if (request.entry.source !== "path") throw new Error("VR asset path entry is required.");
    const sourceInfo = await lstat(request.entry.path);
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error("VR asset source must be a regular file.");
    if (sourceInfo.size <= 0 || sourceInfo.size > MAX_NATIVE_BYTES[request.kind]) {
      throw new Error("VR asset source exceeds its byte budget.");
    }
    await copyFile(request.entry.path, temporaryPath);
    const copiedInfo = await lstat(temporaryPath);
    if (!copiedInfo.isFile() || copiedInfo.isSymbolicLink() || copiedInfo.size !== sourceInfo.size) {
      throw new Error("VR asset source changed while it was copied.");
    }
  }

  /** 把一个资产写入 VRMConfig；输入类型和资产，无返回，设置持久化失败时抛错。 */
  private saveUserAsset(kind: ApplicationVrAssetKind, asset: ApplicationVrAssetOption): void {
    const state = this.options.state.getSnapshot();
    const settings = cloneSettings(state.settings);
    const config = { ...asRecord(settings.VRMConfig) };
    const field = getCollectionField(kind);
    const items = asRecordArray(config[field]).map((item) => ({ ...item }));
    const option = { ...asset, ...(asset.source === "cloud" ? { cloud: true } : {}) };
    const index = items.findIndex((item) => String(item.id ?? "") === asset.id);
    if (index >= 0) items[index] = { ...items[index], ...option };
    else items.push(option);
    config[field] = items;
    if (kind === "motion") {
      const selected = new Set(Array.isArray(config.selectedMotionIds) ? config.selectedMotionIds.map(String) : []);
      selected.add(asset.id);
      config.selectedMotionIds = [...selected];
    }
    if (kind === "scene") config.selectedGaussSceneId = asset.id;
    settings.VRMConfig = config;
    this.options.state.saveSettings({ settings });
  }

  /** 从 VRMConfig 移除一个资产；输入类型和 ID，无返回，并同步相关选择字段。 */
  private removeUserAsset(kind: ApplicationVrAssetKind, assetId: string): void {
    const state = this.options.state.getSnapshot();
    const settings = cloneSettings(state.settings);
    const config = { ...asRecord(settings.VRMConfig) };
    const field = getCollectionField(kind);
    config[field] = asRecordArray(config[field]).filter((item) => String(item.id ?? "") !== assetId);
    if (kind === "model") {
      if (config.selectedModelId === assetId) config.selectedModelId = "";
      if (config.selectedNewModelId === assetId) config.selectedNewModelId = "";
    } else if (kind === "motion") {
      config.selectedMotionIds = Array.isArray(config.selectedMotionIds)
        ? config.selectedMotionIds.map(String).filter((id) => id !== assetId)
        : [];
    } else if (config.selectedGaussSceneId === assetId) {
      config.selectedGaussSceneId = "transparent";
    }
    settings.VRMConfig = config;
    this.options.state.saveSettings({ settings });
  }

  /** 判断新资产是否已进入设置；输入类型和 ID，返回布尔值，无副作用。 */
  private isAssetReferenced(kind: ApplicationVrAssetKind, assetId: string): boolean {
    const config = asRecord(this.options.state.getSnapshot().settings.VRMConfig);
    return asRecordArray(config[getCollectionField(kind)]).some((item) => String(item.id ?? "") === assetId);
  }

  /** 下载并原子写入一个云模型；输入固定目录项和目标路径，无返回，重定向、超限或流错误时清理临时文件。 */
  private async downloadCloudFile(model: CloudModelDefinition, destination: string): Promise<void> {
    if (this.options.fetch === undefined) throw new Error("Cloud VRM download is unavailable.");
    const temporaryPath = `${destination}.downloading`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUD_DOWNLOAD_TIMEOUT_MS);
    let file: FileHandle | null = null;
    try {
      const response = await this.options.fetch(model.remoteUrl, { redirect: "manual", signal: controller.signal });
      if (response.status !== 200 || response.body === null) throw new Error("Cloud VRM download failed.");
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (Number.isFinite(declaredSize) && declaredSize > MAX_CLOUD_MODEL_BYTES) {
        throw new Error("Cloud VRM model exceeds its byte budget.");
      }
      file = await open(temporaryPath, "wx");
      let written = 0;
      for await (const bytes of response.body) {
        if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) continue;
        if (written + bytes.byteLength > MAX_CLOUD_MODEL_BYTES) {
          throw new Error("Cloud VRM model exceeds its byte budget.");
        }
        written = await writeChunk(file, bytes, written);
      }
      if (written === 0) throw new Error("Cloud VRM download returned an empty file.");
      await file.close();
      file = null;
      await rename(temporaryPath, destination);
    } catch {
      throw new Error("Cloud VRM download failed.");
    } finally {
      clearTimeout(timeout);
      await file?.close().catch(() => undefined);
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  /** 把相对路径压缩为兼容 ID slug；输入路径，返回小写短横线文本，无副作用。 */
  private slug(relativePath: string): string {
    return relativePath.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "model";
  }

  /** 串行执行一次目录或写入操作；输入异步函数，返回其结果，失败不会阻塞后续操作。 */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
