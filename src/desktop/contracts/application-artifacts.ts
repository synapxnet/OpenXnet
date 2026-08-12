/** IPC channels owned by the Desktop Core artifact boundary. */
export const APPLICATION_ARTIFACT_CHANNELS = Object.freeze({
  list: "openxnet:application-artifacts:list",
  importFiles: "openxnet:application-artifacts:import-files",
  importRendererFiles: "openxnet:application-artifacts:import-renderer-files",
  registerFiles: "openxnet:application-artifacts:register-files",
  delete: "openxnet:application-artifacts:delete",
});

/** Public schema returned for the application artifact catalog. */
export const APPLICATION_ARTIFACT_SCHEMA = "openxnet.application-artifacts.v1" as const;

/** Media lanes supported by the desktop file library. */
export type ApplicationArtifactKind = "document" | "image" | "video";

/** Lifecycle states retained so task references never silently change identity. */
export type ApplicationArtifactStatus = "available" | "missing" | "deleted";

/** Stable file metadata owned by Desktop Core. */
export interface ApplicationArtifact {
  readonly id: string;
  readonly revision: number;
  readonly storageName: string;
  readonly originalName: string;
  readonly kind: ApplicationArtifactKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string | null;
  readonly status: ApplicationArtifactStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** Consistent artifact catalog returned to an authorized Renderer. */
export interface ApplicationArtifactSnapshot {
  readonly schema: typeof APPLICATION_ARTIFACT_SCHEMA;
  readonly catalogRevision: number;
  readonly generatedAt: string;
  readonly artifacts: readonly ApplicationArtifact[];
}

/** Optional filters accepted when listing the artifact catalog. */
export interface ListApplicationArtifactsRequest {
  readonly includeUnavailable?: boolean;
}

/** Native file paths selected through an authorized Electron dialog. */
export interface ImportApplicationArtifactsRequest {
  readonly paths: readonly string[];
}

/** preload 从真实 File 解析出的本机文件项，路径不会直接暴露为 Renderer API 参数。 */
export interface ImportRendererApplicationArtifactPath {
  readonly source: "path";
  readonly path: string;
}

/** preload 为截图、剪贴板等无本机路径文件生成的有界内联文件项。 */
export interface ImportRendererApplicationArtifactBytes {
  readonly source: "bytes";
  readonly originalName: string;
  readonly bytes: Uint8Array;
}

/** preload 所有权边界提交的文件选择结果。 */
export interface ImportRendererApplicationArtifactsRequest {
  readonly entries: readonly (
    | ImportRendererApplicationArtifactPath
    | ImportRendererApplicationArtifactBytes
  )[];
}

/** contextBridge 可接收的最小 File 能力，避免 Desktop 合约依赖 DOM 类型库。 */
export interface RendererApplicationArtifactFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** One compatibility upload entry already written inside the application artifact directory. */
export interface RegisterApplicationArtifactFile {
  readonly storageName: string;
  readonly originalName: string;
  readonly kind?: ApplicationArtifactKind;
}

/** Compatibility upload batch to register without trusting Renderer file paths. */
export interface RegisterApplicationArtifactsRequest {
  readonly files: readonly RegisterApplicationArtifactFile[];
}

/** Stable artifact IDs selected for deletion. */
export interface DeleteApplicationArtifactsRequest {
  readonly artifactIds: readonly string[];
}

/** Result returned after importing or registering artifact files. */
export interface ApplicationArtifactWriteResult {
  readonly artifacts: readonly ApplicationArtifact[];
  readonly snapshot: ApplicationArtifactSnapshot;
}

/** Result returned after a bounded artifact deletion batch. */
export interface DeleteApplicationArtifactsResult {
  readonly deletedArtifactIds: readonly string[];
  readonly rejectedArtifactIds: readonly string[];
  readonly snapshot: ApplicationArtifactSnapshot;
}

const APPLICATION_ARTIFACT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const MAX_ARTIFACT_BATCH_SIZE = 256;
export const MAX_RENDERER_INLINE_ARTIFACT_BYTES = 32 * 1024 * 1024;
export const MAX_RENDERER_INLINE_ARTIFACT_BATCH_BYTES = 64 * 1024 * 1024;

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate and deduplicate one bounded string list. */
function parseStringList(value: unknown, fieldName: string, pattern?: RegExp): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ARTIFACT_BATCH_SIZE) {
    throw new Error(`${fieldName} must contain between 1 and ${MAX_ARTIFACT_BATCH_SIZE} items.`);
  }
  const normalized = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error(`${fieldName} must contain strings.`);
    }
    const text = item.trim();
    if (!text || text.length > 32_768 || /[\u0000-\u001F\u007F]/.test(text)) {
      throw new Error(`${fieldName} contains an invalid value.`);
    }
    if (pattern !== undefined && !pattern.test(text)) {
      throw new Error(`${fieldName} contains an unsupported value.`);
    }
    normalized.add(text);
  }
  return [...normalized];
}

/** Normalize one bounded display filename without accepting directory separators. */
function parseOriginalName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Artifact originalName must be a string.");
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 255
    || /[\\/\u0000-\u001F\u007F]/.test(normalized)
    || normalized === "."
    || normalized === ".."
  ) {
    throw new Error("Artifact originalName is invalid.");
  }
  return normalized;
}

/** Parse optional artifact list filters from an untrusted IPC value. */
export function parseListApplicationArtifactsRequest(
  value: unknown,
): ListApplicationArtifactsRequest {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "includeUnavailable")) {
    throw new Error("Artifact list request is invalid.");
  }
  return value.includeUnavailable === true ? { includeUnavailable: true } : {};
}

/** Parse an exact native artifact import request. */
export function parseImportApplicationArtifactsRequest(
  value: unknown,
): ImportApplicationArtifactsRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new Error("Exact artifact import paths are required.");
  }
  return { paths: parseStringList(value.paths, "Artifact import paths") };
}

/**
 * 校验 preload 提交的文件选择结果；输入未知 IPC 值，返回有界路径/字节项，字段、数量或预算非法时抛错。
 */
export function parseImportRendererApplicationArtifactsRequest(
  value: unknown,
): ImportRendererApplicationArtifactsRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.entries)) {
    throw new Error("Exact Renderer artifact entries are required.");
  }
  if (value.entries.length === 0 || value.entries.length > MAX_ARTIFACT_BATCH_SIZE) {
    throw new Error(`Renderer artifact import must contain between 1 and ${MAX_ARTIFACT_BATCH_SIZE} files.`);
  }
  let inlineBytes = 0;
  const entries = value.entries.map((candidate) => {
    if (!isRecord(candidate) || candidate.source !== "path" && candidate.source !== "bytes") {
      throw new Error("Renderer artifact entry is invalid.");
    }
    if (candidate.source === "path") {
      if (Object.keys(candidate).some((key) => !["source", "path"].includes(key))) {
        throw new Error("Renderer artifact path contains unsupported fields.");
      }
      return {
        source: "path" as const,
        path: parseStringList([candidate.path], "Renderer artifact path")[0]!,
      };
    }
    if (Object.keys(candidate).some((key) => !["source", "originalName", "bytes"].includes(key))) {
      throw new Error("Renderer inline artifact contains unsupported fields.");
    }
    if (!(candidate.bytes instanceof Uint8Array)) {
      throw new Error("Renderer inline artifact bytes are invalid.");
    }
    if (
      candidate.bytes.byteLength === 0
      || candidate.bytes.byteLength > MAX_RENDERER_INLINE_ARTIFACT_BYTES
    ) {
      throw new Error("Renderer inline artifact exceeds its byte budget.");
    }
    inlineBytes += candidate.bytes.byteLength;
    if (inlineBytes > MAX_RENDERER_INLINE_ARTIFACT_BATCH_BYTES) {
      throw new Error("Renderer inline artifact batch exceeds its byte budget.");
    }
    return {
      source: "bytes" as const,
      originalName: parseOriginalName(candidate.originalName),
      bytes: candidate.bytes,
    };
  });
  return { entries };
}

/** Parse a compatibility artifact registration batch. */
export function parseRegisterApplicationArtifactsRequest(
  value: unknown,
): RegisterApplicationArtifactsRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.files)) {
    throw new Error("Exact artifact registration files are required.");
  }
  if (value.files.length === 0 || value.files.length > MAX_ARTIFACT_BATCH_SIZE) {
    throw new Error(`Artifact registration must contain between 1 and ${MAX_ARTIFACT_BATCH_SIZE} files.`);
  }
  const files = value.files.map((candidate) => {
    if (!isRecord(candidate)) {
      throw new Error("Artifact registration entry is invalid.");
    }
    const keys = Object.keys(candidate);
    if (keys.some((key) => !["storageName", "originalName", "kind"].includes(key))) {
      throw new Error("Artifact registration entry contains unsupported fields.");
    }
    if (typeof candidate.storageName !== "string" || !STORAGE_NAME_PATTERN.test(candidate.storageName)) {
      throw new Error("Artifact storageName is invalid.");
    }
    if (
      candidate.kind !== undefined
      && candidate.kind !== "document"
      && candidate.kind !== "image"
      && candidate.kind !== "video"
    ) {
      throw new Error("Artifact kind is invalid.");
    }
    const file: RegisterApplicationArtifactFile = {
      storageName: candidate.storageName,
      originalName: parseOriginalName(candidate.originalName),
    };
    if (candidate.kind === "document" || candidate.kind === "image" || candidate.kind === "video") {
      return { ...file, kind: candidate.kind };
    }
    return file;
  });
  return { files: files as RegisterApplicationArtifactFile[] };
}

/** Parse a bounded deletion request containing stable artifact IDs. */
export function parseDeleteApplicationArtifactsRequest(
  value: unknown,
): DeleteApplicationArtifactsRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new Error("Exact artifactIds are required for deletion.");
  }
  return {
    artifactIds: parseStringList(
      value.artifactIds,
      "Artifact IDs",
      APPLICATION_ARTIFACT_ID_PATTERN,
    ),
  };
}
