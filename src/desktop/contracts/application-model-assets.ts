/** Model Asset Runtime 的 Main IPC 通道。 */
export const APPLICATION_MODEL_ASSET_CHANNELS = Object.freeze({
  getStatus: "openxnet:application-model-assets:get-status",
  download: "openxnet:application-model-assets:download",
  remove: "openxnet:application-model-assets:remove",
  progress: "openxnet:application-model-assets:progress",
});

/** Model Asset Runtime 的公开 schema。 */
export const APPLICATION_MODEL_ASSET_SCHEMA = "openxnet.model-assets.v1" as const;

/** Main 管理的本地模型种类。 */
export type ApplicationModelAssetKind = "sherpa" | "minilm";

/** 固定模型下载源。 */
export type ApplicationModelAssetSource = "modelscope" | "huggingface";

/** 本地模型健康状态。 */
export type ApplicationModelAssetState = "not-installed" | "installed" | "damaged" | "downloading";

/** 模型操作进度阶段。 */
export type ApplicationModelAssetProgressPhase = "preparing" | "downloading" | "verifying" | "installing" | "completed" | "failed";

/** 单个模型状态请求。 */
export interface ApplicationModelAssetRequest {
  readonly kind: ApplicationModelAssetKind;
}

/** 固定源模型下载请求。 */
export interface DownloadApplicationModelAssetRequest extends ApplicationModelAssetRequest {
  readonly source: ApplicationModelAssetSource;
}

/** 已安装模型文件摘要。 */
export interface ApplicationModelAssetFileSummary {
  readonly name: string;
  readonly size: number;
}

/** 本地模型状态结果。 */
export interface ApplicationModelAssetStatus {
  readonly schema: typeof APPLICATION_MODEL_ASSET_SCHEMA;
  readonly kind: ApplicationModelAssetKind;
  readonly modelName: string;
  readonly state: ApplicationModelAssetState;
  readonly source: ApplicationModelAssetSource | null;
  readonly version: string | null;
  readonly files: readonly ApplicationModelAssetFileSummary[];
}

/** 模型下载进度事件。 */
export interface ApplicationModelAssetProgressEvent {
  readonly schema: typeof APPLICATION_MODEL_ASSET_SCHEMA;
  readonly operationId: string;
  readonly kind: ApplicationModelAssetKind;
  readonly source: ApplicationModelAssetSource;
  readonly phase: ApplicationModelAssetProgressPhase;
  readonly percent: number;
  readonly transferredBytes: number;
  readonly totalBytes: number;
  readonly currentFile: string;
  readonly errorCode?: string;
}

/** Renderer 模型进度监听器。 */
export type ApplicationModelAssetProgressListener = (event: ApplicationModelAssetProgressEvent) => void;

/**
 * 解析模型状态或删除请求；输入不可信 IPC 值，返回固定 kind；类型、额外字段或未知 kind 时抛出 TypeError，且不访问磁盘。
 */
export function parseApplicationModelAssetRequest(value: unknown): ApplicationModelAssetRequest {
  const request = requireExactRecord(value, ["kind"], "Model asset request");
  return { kind: requireKind(request.kind) };
}

/**
 * 解析模型下载请求；输入不可信 IPC 值，返回固定 kind/source；类型、额外字段或未知值时抛出 TypeError，且不访问网络。
 */
export function parseDownloadApplicationModelAssetRequest(value: unknown): DownloadApplicationModelAssetRequest {
  const request = requireExactRecord(value, ["kind", "source"], "Model asset download request");
  return {
    kind: requireKind(request.kind),
    source: requireSource(request.source),
  };
}

/** 校验模型 kind；输入未知值，返回固定 kind；未知值时抛出 TypeError。 */
function requireKind(value: unknown): ApplicationModelAssetKind {
  if (value !== "sherpa" && value !== "minilm") throw new TypeError("Model asset kind is invalid.");
  return value;
}

/** 校验模型 source；输入未知值，返回固定 source；未知值时抛出 TypeError。 */
function requireSource(value: unknown): ApplicationModelAssetSource {
  if (value !== "modelscope" && value !== "huggingface") throw new TypeError("Model asset source is invalid.");
  return value;
}

/** 校验精确普通对象；输入值、字段和标签，返回记录；类型、原型或字段漂移时抛出 TypeError。 */
function requireExactRecord(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label} is invalid.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} prototype is invalid.`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== fields.length || Object.keys(record).some((field) => !fields.includes(field))) {
    throw new TypeError(`${label} fields are invalid.`);
  }
  return record;
}
