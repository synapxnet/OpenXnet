/** VR Asset Runtime 的 Main IPC 通道。 */
export const APPLICATION_VR_ASSET_CHANNELS = Object.freeze({
  list: "openxnet:application-vr-assets:list",
  importAsset: "openxnet:application-vr-assets:import",
  deleteAsset: "openxnet:application-vr-assets:delete",
  downloadCloudModel: "openxnet:application-vr-assets:download-cloud-model",
});

/** VR Asset Runtime 的公开响应 schema。 */
export const APPLICATION_VR_ASSET_SCHEMA = "openxnet.vr-assets.v1" as const;

/** 用户可导入的三类 VR 资产。 */
export type ApplicationVrAssetKind = "model" | "motion" | "scene";

/** VR 页面使用的统一资产选项。 */
export interface ApplicationVrAssetOption {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly type: "default" | "user";
  readonly source: "packaged" | "user" | "cloud";
  readonly downloaded: boolean;
  readonly downloadable: boolean;
}

/** 固定云目录中的 VRM 模型选项。 */
export interface ApplicationCloudVrmModelOption {
  readonly id: string;
  readonly name: string;
  readonly relativePath: string;
  readonly remoteUrl: string;
  readonly remoteBaseUrl: string;
  readonly type: "cloud";
  readonly source: "cloud";
  readonly cloud: true;
  readonly downloaded: boolean;
  readonly downloadable: boolean;
  readonly path?: string;
}

/** VR 页面一次加载所需的完整资产目录。 */
export interface ApplicationVrAssetCatalog {
  readonly schema: typeof APPLICATION_VR_ASSET_SCHEMA;
  readonly success: true;
  readonly defaultModels: readonly ApplicationVrAssetOption[];
  readonly userModels: readonly ApplicationVrAssetOption[];
  readonly cloudModels: readonly ApplicationCloudVrmModelOption[];
  readonly defaultMotions: readonly ApplicationVrAssetOption[];
  readonly userMotions: readonly ApplicationVrAssetOption[];
  readonly defaultScenes: readonly ApplicationVrAssetOption[];
  readonly userScenes: readonly ApplicationVrAssetOption[];
  readonly remoteBaseUrl: string;
}

/** preload 从真实 File 提取的本机资产路径。 */
export interface ApplicationVrAssetPathEntry {
  readonly source: "path";
  readonly path: string;
  readonly originalName: string;
}

/** preload 为无本机路径 File 提供的有界内联资产。 */
export interface ApplicationVrAssetBytesEntry {
  readonly source: "bytes";
  readonly originalName: string;
  readonly bytes: Uint8Array;
}

/** Main Runtime 接收的单文件资产导入请求。 */
export interface ImportApplicationVrAssetRequest {
  readonly kind: ApplicationVrAssetKind;
  readonly displayName: string;
  readonly entry: ApplicationVrAssetPathEntry | ApplicationVrAssetBytesEntry;
}

/** contextBridge 接收的最小 File 能力。 */
export interface RendererApplicationVrAssetFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Renderer 调用 preload 时使用的资产导入请求。 */
export interface RendererImportApplicationVrAssetRequest {
  readonly kind: ApplicationVrAssetKind;
  readonly displayName: string;
  readonly file: RendererApplicationVrAssetFile;
}

/** 删除一个用户 VR 资产的请求。 */
export interface DeleteApplicationVrAssetRequest {
  readonly kind: ApplicationVrAssetKind;
  readonly assetId: string;
}

/** 下载固定云目录中一个 VRM 的请求。 */
export interface DownloadApplicationCloudVrmModelRequest {
  readonly modelId: string;
}

/** 导入或下载资产后的结果。 */
export interface ApplicationVrAssetWriteResult {
  readonly schema: typeof APPLICATION_VR_ASSET_SCHEMA;
  readonly success: true;
  readonly asset: ApplicationVrAssetOption;
}

/** 删除资产后的结果。 */
export interface ApplicationVrAssetDeleteResult {
  readonly schema: typeof APPLICATION_VR_ASSET_SCHEMA;
  readonly success: true;
  readonly kind: ApplicationVrAssetKind;
  readonly assetId: string;
}

export const MAX_INLINE_VR_ASSET_BYTES = 64 * 1024 * 1024;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_PATH_LENGTH = 32_768;
const USER_ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(vrm|vrma|ply|spz|splat|ksplat|sog)$/i;
const VR_ASSET_KINDS = new Set<ApplicationVrAssetKind>(["model", "motion", "scene"]);

/** 判断未知值是否为普通对象；输入任意值，返回类型保护，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 要求对象只包含允许字段；输入未知值、字段和标签，返回普通对象，结构漂移时抛错。 */
function requireExactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some((field) => !fields.includes(field))) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

/** 校验资产类型；输入未知值，返回固定联合类型，不支持时抛错。 */
function requireAssetKind(value: unknown): ApplicationVrAssetKind {
  if (typeof value !== "string" || !VR_ASSET_KINDS.has(value as ApplicationVrAssetKind)) {
    throw new Error("VR asset kind is invalid.");
  }
  return value as ApplicationVrAssetKind;
}

/** 校验不含路径字符的显示名；输入未知值，返回去空格文本，空值、控制字符或超长时抛错。 */
function requireDisplayName(value: unknown): string {
  if (typeof value !== "string") throw new Error("VR asset display name is invalid.");
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > MAX_DISPLAY_NAME_LENGTH
    || /[\\/\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new Error("VR asset display name is invalid.");
  }
  return normalized;
}

/** 校验原始文件名；输入未知值，返回单层文件名，路径分隔符、控制字符或超长时抛错。 */
function requireOriginalName(value: unknown): string {
  if (typeof value !== "string") throw new Error("VR asset original name is invalid.");
  const normalized = value.trim();
  if (!normalized || normalized.length > 255 || /[\\/\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error("VR asset original name is invalid.");
  }
  return normalized;
}

/** 校验 preload 资产导入请求；输入未知 IPC 值，返回单文件请求，字段、路径或内联预算非法时抛错。 */
export function parseImportApplicationVrAssetRequest(value: unknown): ImportApplicationVrAssetRequest {
  const record = requireExactRecord(value, ["kind", "displayName", "entry"], "VR asset import request");
  const entry = requireExactRecord(record.entry, ["source", "path", "originalName", "bytes"], "VR asset entry");
  const originalName = requireOriginalName(entry.originalName);
  if (entry.source === "path") {
    if (entry.bytes !== undefined || typeof entry.path !== "string") {
      throw new Error("VR asset path entry is invalid.");
    }
    const sourcePath = entry.path.trim();
    if (!sourcePath || sourcePath.length > MAX_PATH_LENGTH || /[\u0000-\u001F\u007F]/.test(sourcePath)) {
      throw new Error("VR asset path is invalid.");
    }
    return {
      kind: requireAssetKind(record.kind),
      displayName: requireDisplayName(record.displayName),
      entry: { source: "path", path: sourcePath, originalName },
    };
  }
  if (entry.source !== "bytes" || entry.path !== undefined || !(entry.bytes instanceof Uint8Array)) {
    throw new Error("VR asset inline entry is invalid.");
  }
  if (entry.bytes.byteLength === 0 || entry.bytes.byteLength > MAX_INLINE_VR_ASSET_BYTES) {
    throw new Error("VR asset inline entry exceeds its byte budget.");
  }
  return {
    kind: requireAssetKind(record.kind),
    displayName: requireDisplayName(record.displayName),
    entry: { source: "bytes", originalName, bytes: entry.bytes },
  };
}

/** 校验用户资产删除请求；输入未知 IPC 值，返回类型和稳定 ID，格式或扩展名非法时抛错。 */
export function parseDeleteApplicationVrAssetRequest(value: unknown): DeleteApplicationVrAssetRequest {
  const record = requireExactRecord(value, ["kind", "assetId"], "VR asset delete request");
  const kind = requireAssetKind(record.kind);
  if (typeof record.assetId !== "string" || !USER_ASSET_ID_PATTERN.test(record.assetId)) {
    throw new Error("VR asset ID is invalid.");
  }
  return { kind, assetId: record.assetId };
}

/** 校验云 VRM 下载请求；输入未知 IPC 值，返回稳定模型 ID，额外字段或格式非法时抛错。 */
export function parseDownloadApplicationCloudVrmModelRequest(
  value: unknown,
): DownloadApplicationCloudVrmModelRequest {
  const record = requireExactRecord(value, ["modelId"], "Cloud VRM download request");
  if (typeof record.modelId !== "string" || !/^[0-9a-f-]{36}\.vrm$/i.test(record.modelId)) {
    throw new Error("Cloud VRM model ID is invalid.");
  }
  return { modelId: record.modelId };
}
