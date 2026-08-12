import {
  CAPABILITY_RUNTIMES,
  isCapabilityId,
  type CapabilityId,
  type CapabilityRuntime,
} from "../contracts/capability";

/** Schema identifier for independently distributed OpenXnet feature packs. */
export const FEATURE_PACK_MANIFEST_SCHEMA = "openxnet.feature-pack.v1";

/** Schema identifier for the atomic pointer to an active feature-pack version. */
export const FEATURE_PACK_CURRENT_SCHEMA = "openxnet.feature-pack.current.v1";

/** One integrity-protected file included in a feature pack. */
export interface FeaturePackFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

/** Versioned manifest stored at the root of every feature pack. */
export interface FeaturePackManifest {
  readonly schema: typeof FEATURE_PACK_MANIFEST_SCHEMA;
  readonly id: CapabilityId;
  readonly version: string;
  readonly runtime: CapabilityRuntime;
  readonly desktopProtocolVersion: string;
  readonly platforms: readonly string[];
  readonly architectures: readonly string[];
  readonly entrypoint: string;
  readonly runtimeExecutable: string;
  readonly files: readonly FeaturePackFile[];
}

/** Atomic pointer stored beside installed feature-pack versions. */
export interface FeaturePackCurrentPointer {
  readonly schema: typeof FEATURE_PACK_CURRENT_SCHEMA;
  readonly id: CapabilityId;
  readonly version: string;
}

/** Machine-readable failure codes returned by feature-pack validation and installation. */
export type FeaturePackErrorCode =
  | "INVALID_MANIFEST"
  | "INVALID_SIGNATURE"
  | "UNKNOWN_SIGNING_KEY"
  | "INCOMPATIBLE_PROTOCOL"
  | "INCOMPATIBLE_PLATFORM"
  | "INCOMPATIBLE_ARCHITECTURE"
  | "INVALID_PACK_CONTENT"
  | "PACK_NOT_INSTALLED"
  | "DISTRIBUTION_NOT_CONFIGURED"
  | "DOWNLOAD_FAILED"
  | "DOWNLOAD_TOO_LARGE"
  | "ARCHIVE_HASH_MISMATCH"
  | "UNSAFE_ARCHIVE"
  | "ROLLBACK_DETECTED"
  | "OPERATION_IN_PROGRESS";

/** Error with a stable code suitable for capability lifecycle reporting. */
export class FeaturePackError extends Error {
  /**
   * Create a structured feature-pack error.
   *
   * @param code Stable error classification.
   * @param message Human-readable diagnostic message.
   * @param cause Optional underlying failure.
   */
  public constructor(
    public readonly code: FeaturePackErrorCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "FeaturePackError";
  }
}

/**
 * Determine whether an unknown value is a non-array object.
 *
 * @param value Value crossing the manifest trust boundary.
 * @returns True when string-keyed fields can be read safely.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read a required non-empty string from an untrusted record.
 *
 * @param record Manifest object being parsed.
 * @param field Field name to read.
 * @returns Validated string value.
 */
function readString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new FeaturePackError("INVALID_MANIFEST", `Manifest field '${field}' must be a non-empty string.`);
  }
  return value;
}

/**
 * Read a required non-empty string array from an untrusted record.
 *
 * @param record Manifest object being parsed.
 * @param field Field name to read.
 * @returns Defensive copy of validated strings.
 */
function readStringArray(record: Record<string, unknown>, field: string): readonly string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item === "")) {
    throw new FeaturePackError(
      "INVALID_MANIFEST",
      `Manifest field '${field}' must be a non-empty string array.`,
    );
  }
  return [...value] as string[];
}

/**
 * Validate and normalize a path relative to a feature-pack root.
 *
 * @param value Untrusted manifest path.
 * @param field Field name used in diagnostics.
 * @returns Canonical POSIX-style relative path.
 */
export function normalizeFeaturePackPath(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "" || value.includes("\\")) {
    throw new FeaturePackError(
      "INVALID_MANIFEST",
      `Manifest field '${field}' must be a POSIX-style relative path.`,
    );
  }
  const segments = value.split("/");
  if (
    value.startsWith("/")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new FeaturePackError(
      "INVALID_MANIFEST",
      `Manifest field '${field}' contains an unsafe relative path.`,
    );
  }
  return value;
}

/**
 * Parse one integrity file record from an untrusted manifest.
 *
 * @param value Raw file record.
 * @param index Record index used in diagnostics.
 * @returns Validated immutable file descriptor.
 */
function parseFeaturePackFile(value: unknown, index: number): FeaturePackFile {
  if (!isRecord(value)) {
    throw new FeaturePackError("INVALID_MANIFEST", `Manifest files[${index}] must be an object.`);
  }
  const filePath = normalizeFeaturePackPath(value.path, `files[${index}].path`);
  const size = value.size;
  const sha256 = value.sha256;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
    throw new FeaturePackError("INVALID_MANIFEST", `Manifest files[${index}].size is invalid.`);
  }
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new FeaturePackError("INVALID_MANIFEST", `Manifest files[${index}].sha256 is invalid.`);
  }
  return { path: filePath, size, sha256 };
}

/**
 * Parse and validate an untrusted feature-pack manifest.
 *
 * @param value Parsed JSON value from manifest.json.
 * @returns A defensive, typed manifest.
 */
export function parseFeaturePackManifest(value: unknown): FeaturePackManifest {
  if (!isRecord(value)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack manifest must be an object.");
  }
  if (value.schema !== FEATURE_PACK_MANIFEST_SCHEMA) {
    throw new FeaturePackError("INVALID_MANIFEST", "Unsupported feature-pack manifest schema.");
  }

  const id = readString(value, "id");
  const runtime = readString(value, "runtime");
  const version = readString(value, "version");
  if (!isCapabilityId(id)) {
    throw new FeaturePackError("INVALID_MANIFEST", `Unknown feature-pack capability '${id}'.`);
  }
  if (!CAPABILITY_RUNTIMES.some((candidate) => candidate === runtime)) {
    throw new FeaturePackError("INVALID_MANIFEST", `Unknown feature-pack runtime '${runtime}'.`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(version)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack version is not safe for an install path.");
  }

  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack manifest must include files.");
  }
  const files = value.files.map(parseFeaturePackFile);
  const paths = new Set(files.map((file) => file.path));
  if (paths.size !== files.length) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack manifest contains duplicate file paths.");
  }

  const entrypoint = normalizeFeaturePackPath(value.entrypoint, "entrypoint");
  if (!paths.has(entrypoint)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack entrypoint must be integrity protected.");
  }
  const runtimeExecutable = normalizeFeaturePackPath(value.runtimeExecutable, "runtimeExecutable");
  if (!paths.has(runtimeExecutable)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack runtime executable must be integrity protected.");
  }

  return {
    schema: FEATURE_PACK_MANIFEST_SCHEMA,
    id,
    version,
    runtime: runtime as CapabilityRuntime,
    desktopProtocolVersion: readString(value, "desktopProtocolVersion"),
    platforms: readStringArray(value, "platforms"),
    architectures: readStringArray(value, "architectures"),
    entrypoint,
    runtimeExecutable,
    files,
  };
}

/**
 * Parse and validate an untrusted active-version pointer.
 *
 * @param value Parsed JSON value from current.json.
 * @param expectedId Capability whose pointer is being read.
 * @returns Typed active-version pointer.
 */
export function parseFeaturePackCurrentPointer(
  value: unknown,
  expectedId: CapabilityId,
): FeaturePackCurrentPointer {
  if (!isRecord(value) || value.schema !== FEATURE_PACK_CURRENT_SCHEMA) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack current pointer has an invalid schema.");
  }
  const id = readString(value, "id");
  const version = readString(value, "version");
  if (id !== expectedId || !isCapabilityId(id)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack current pointer has an invalid capability.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(version)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack current pointer has an invalid version.");
  }
  return { schema: FEATURE_PACK_CURRENT_SCHEMA, id, version };
}
