import {
  createHash,
  createPublicKey,
  randomUUID,
  verify,
  type KeyObject,
} from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { extract, list, type ReadEntry } from "tar";

import {
  FEATURE_PACK_CAPABILITY_IDS,
  type FeaturePackCapabilityId,
  type FeaturePackDistributionItem,
  type FeaturePackDistributionSnapshot,
  type FeaturePackMutationResult,
  type FeaturePackOperation,
  type FeaturePackProgressEvent,
  type FeaturePackProgressListener,
  type FeaturePackProgressPhase,
  type FeaturePackPublicError,
} from "../contracts/feature-pack-distribution";
import {
  FeaturePackError,
  type FeaturePackErrorCode,
} from "./feature-pack";
import type { FeaturePackManager } from "./feature-pack-manager";

/** Schema identifier for the signed remote Feature Pack catalog. */
export const FEATURE_PACK_CATALOG_SCHEMA = "openxnet.feature-pack.catalog.v1";

/** Schema identifier for detached Ed25519 signatures. */
export const FEATURE_PACK_SIGNATURE_SCHEMA = "openxnet.feature-pack.signature.v1";

/** Schema identifier for the persisted signed-catalog anti-rollback watermark. */
export const FEATURE_PACK_CATALOG_STATE_SCHEMA = "openxnet.feature-pack.catalog-state.v1";

const DEFAULT_MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_SIGNATURE_BYTES = 16 * 1024;
const DEFAULT_MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_MAX_EXTRACTED_BYTES = 4 * 1024 * 1024 * 1024;
const DEFAULT_MAX_ARCHIVE_FILES = 100_000;

const DISPLAY_NAMES: Readonly<Record<FeaturePackCapabilityId, string>> = {
  voice: "Voice and ASR",
  "vector-index": "Vector Index",
  memory: "Long-term Memory",
  documents: "Document Processing",
  connectors: "External Connectors",
  live: "Live Streaming",
  mcp: "MCP Integrations",
  agentteams: "AgentTeams Runtime",
  "desktop-control": "Desktop Window Control",
  gitnexus: "GitNexus",
};

/** Detached signature stored beside a signed JSON document. */
export interface FeaturePackSignature {
  readonly schema: typeof FEATURE_PACK_SIGNATURE_SCHEMA;
  readonly keyId: string;
  readonly algorithm: "ed25519";
  readonly signature: string;
}

/** One platform-specific archive published in the signed catalog. */
export interface FeaturePackCatalogEntry {
  readonly id: FeaturePackCapabilityId;
  readonly version: string;
  readonly platform: string;
  readonly architecture: string;
  readonly archiveUrl: string;
  readonly archiveSize: number;
  readonly archiveSha256: string;
}

/** Parsed and verified remote Feature Pack catalog. */
export interface FeaturePackCatalog {
  readonly schema: typeof FEATURE_PACK_CATALOG_SCHEMA;
  readonly generatedAt: string;
  readonly entries: readonly FeaturePackCatalogEntry[];
}

/** Runtime limits and dependencies for the Feature Pack distribution service. */
export interface FeaturePackDistributionOptions {
  readonly manager: FeaturePackManager;
  readonly stagingDirectory: string;
  readonly auditLogPath: string;
  readonly catalogStatePath?: string;
  readonly feedUrl?: string;
  readonly trustedKeys?: Readonly<Record<string, string>>;
  readonly allowInsecureLoopback?: boolean;
  readonly platform?: NodeJS.Platform;
  readonly architecture?: string;
  readonly maxCatalogBytes?: number;
  readonly maxSignatureBytes?: number;
  readonly maxArchiveBytes?: number;
  readonly maxExtractedBytes?: number;
  readonly maxArchiveFiles?: number;
  readonly fetchImplementation?: typeof globalThis.fetch;
  readonly beforeMutation?: (capabilityId: FeaturePackCapabilityId) => Promise<void>;
}

interface ActiveOperation {
  readonly operationId: string;
  readonly operation: FeaturePackOperation;
}

interface DownloadResult {
  readonly bytes: number;
  readonly sha256: string;
}

interface AuditRecord {
  readonly timestamp: string;
  readonly operationId: string;
  readonly capabilityId: FeaturePackCapabilityId;
  readonly operation: FeaturePackOperation;
  readonly outcome: "succeeded" | "failed";
  readonly version: string | null;
  readonly errorCode: string | null;
}

interface FeaturePackCatalogState {
  readonly schema: typeof FEATURE_PACK_CATALOG_STATE_SCHEMA;
  readonly generatedAt: string;
  readonly sha256: string;
}

/**
 * Determine whether an unknown value is a non-array object.
 *
 * @param value Value crossing a JSON trust boundary.
 * @returns True when string-keyed fields can be read safely.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read a non-empty string from an untrusted object.
 *
 * @param record Object being parsed.
 * @param field Required field name.
 * @returns Validated string.
 */
function readString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new FeaturePackError("INVALID_MANIFEST", `Field '${field}' must be a non-empty string.`);
  }
  return value;
}

/**
 * Parse and validate a detached signature envelope.
 *
 * @param value Untrusted JSON value from a signature file.
 * @returns Validated detached signature metadata.
 */
export function parseFeaturePackSignature(value: unknown): FeaturePackSignature {
  if (!isRecord(value) || value.schema !== FEATURE_PACK_SIGNATURE_SCHEMA) {
    throw new FeaturePackError("INVALID_SIGNATURE", "Unsupported Feature Pack signature schema.");
  }
  const keyId = readString(value, "keyId");
  const signature = readString(value, "signature");
  if (value.algorithm !== "ed25519") {
    throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack signatures must use Ed25519.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(keyId)) {
    throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack signature keyId is invalid.");
  }
  if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) {
    throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack signature encoding is invalid.");
  }
  return {
    schema: FEATURE_PACK_SIGNATURE_SCHEMA,
    keyId,
    algorithm: "ed25519",
    signature,
  };
}

/**
 * Validate a distribution URL and reject credential-bearing or insecure endpoints.
 *
 * @param value Absolute or resolved distribution URL.
 * @param allowInsecureLoopback Whether HTTP loopback endpoints are permitted for development.
 * @returns Parsed URL accepted by the transport policy.
 */
export function assertFeaturePackDistributionUrl(
  value: string,
  allowInsecureLoopback = false,
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack distribution URL is invalid.", {
      cause: error,
    });
  }
  if (url.username !== "" || url.password !== "") {
    throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack distribution URLs cannot contain credentials.");
  }
  const isLoopback = url.hostname === "localhost"
    || url.hostname === "127.0.0.1"
    || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && isLoopback)) {
    throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack distribution requires HTTPS.");
  }
  return url;
}

/**
 * Parse an untrusted signed catalog after its raw bytes have been verified.
 *
 * @param value Parsed catalog JSON.
 * @param catalogUrl Verified catalog URL used to resolve relative archive URLs.
 * @param allowInsecureLoopback Whether development loopback HTTP is permitted.
 * @returns Validated catalog.
 */
export function parseFeaturePackCatalog(
  value: unknown,
  catalogUrl: URL,
  allowInsecureLoopback = false,
): FeaturePackCatalog {
  if (!isRecord(value) || value.schema !== FEATURE_PACK_CATALOG_SCHEMA) {
    throw new FeaturePackError("INVALID_MANIFEST", "Unsupported Feature Pack catalog schema.");
  }
  const generatedAt = readString(value, "generatedAt");
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature Pack catalog generatedAt is invalid.");
  }
  if (!Array.isArray(value.entries)) {
    throw new FeaturePackError("INVALID_MANIFEST", "Feature Pack catalog entries must be an array.");
  }

  const seen = new Set<string>();
  const entries = value.entries.map((candidate, index): FeaturePackCatalogEntry => {
    if (!isRecord(candidate)) {
      throw new FeaturePackError("INVALID_MANIFEST", `Catalog entry ${index} must be an object.`);
    }
    const id = readString(candidate, "id");
    if (!FEATURE_PACK_CAPABILITY_IDS.some((capabilityId) => capabilityId === id)) {
      throw new FeaturePackError("INVALID_MANIFEST", `Catalog entry ${index} has an unknown capability.`);
    }
    const version = readString(candidate, "version");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(version)) {
      throw new FeaturePackError("INVALID_MANIFEST", `Catalog entry ${index} has an invalid version.`);
    }
    const platform = readString(candidate, "platform");
    const architecture = readString(candidate, "architecture");
    const archiveSize = candidate.archiveSize;
    const archiveSha256 = candidate.archiveSha256;
    if (typeof archiveSize !== "number" || !Number.isSafeInteger(archiveSize) || archiveSize <= 0) {
      throw new FeaturePackError("INVALID_MANIFEST", `Catalog entry ${index} has an invalid archive size.`);
    }
    if (typeof archiveSha256 !== "string" || !/^[a-f0-9]{64}$/.test(archiveSha256)) {
      throw new FeaturePackError("INVALID_MANIFEST", `Catalog entry ${index} has an invalid archive hash.`);
    }
    let archiveUrl: URL;
    try {
      archiveUrl = new URL(readString(candidate, "archiveUrl"), catalogUrl);
    } catch (error) {
      throw new FeaturePackError("INVALID_MANIFEST", `Catalog entry ${index} has an invalid archive URL.`, {
        cause: error,
      });
    }
    assertFeaturePackDistributionUrl(archiveUrl.href, allowInsecureLoopback);
    const duplicateKey = `${id}:${version}:${platform}:${architecture}`;
    if (seen.has(duplicateKey)) {
      throw new FeaturePackError("INVALID_MANIFEST", "Feature Pack catalog contains duplicate entries.");
    }
    seen.add(duplicateKey);
    return {
      id: id as FeaturePackCapabilityId,
      version,
      platform,
      architecture,
      archiveUrl: archiveUrl.href,
      archiveSize,
      archiveSha256,
    };
  });
  return { schema: FEATURE_PACK_CATALOG_SCHEMA, generatedAt, entries };
}

/**
 * Convert an internal failure into a stable Renderer-safe error.
 *
 * @param error Unknown operation failure.
 * @returns Sanitized error without paths, URLs, or credentials.
 */
export function toFeaturePackPublicError(error: unknown): FeaturePackPublicError {
  const code = error instanceof FeaturePackError ? error.code : "FEATURE_PACK_OPERATION_FAILED";
  const messages: Readonly<Record<string, string>> = {
    INVALID_MANIFEST: "Feature Pack metadata is invalid.",
    INVALID_SIGNATURE: "Feature Pack signature verification failed.",
    UNKNOWN_SIGNING_KEY: "Feature Pack signing key is not trusted by this application.",
    INCOMPATIBLE_PROTOCOL: "Feature Pack is incompatible with this desktop protocol.",
    INCOMPATIBLE_PLATFORM: "Feature Pack is not available for this operating system.",
    INCOMPATIBLE_ARCHITECTURE: "Feature Pack is not available for this processor architecture.",
    INVALID_PACK_CONTENT: "Feature Pack contents failed integrity verification.",
    PACK_NOT_INSTALLED: "Feature Pack is not installed.",
    DISTRIBUTION_NOT_CONFIGURED: "Feature Pack distribution is not configured.",
    DOWNLOAD_FAILED: "Feature Pack download failed.",
    DOWNLOAD_TOO_LARGE: "Feature Pack download exceeded the configured size limit.",
    ARCHIVE_HASH_MISMATCH: "Feature Pack archive integrity verification failed.",
    UNSAFE_ARCHIVE: "Feature Pack archive contains an unsafe entry.",
    ROLLBACK_DETECTED: "Feature Pack downgrade or catalog rollback was blocked.",
    OPERATION_IN_PROGRESS: "Another operation is already running for this Feature Pack.",
    FEATURE_PACK_OPERATION_FAILED: "Feature Pack operation failed.",
  };
  return {
    code,
    message: messages[code] ?? messages.FEATURE_PACK_OPERATION_FAILED ?? "Feature Pack operation failed.",
    retryable: ["DOWNLOAD_FAILED", "DOWNLOAD_TOO_LARGE", "ARCHIVE_HASH_MISMATCH"].includes(code),
  };
}

/**
 * Manage signed catalog discovery, trusted download, installation, repair, and removal.
 */
export class FeaturePackDistributionService {
  private readonly manager: FeaturePackManager;
  private readonly stagingDirectory: string;
  private readonly auditLogPath: string;
  private readonly catalogStatePath: string;
  private readonly feedUrl: string | null;
  private readonly trustedKeys: ReadonlyMap<string, KeyObject>;
  private readonly allowInsecureLoopback: boolean;
  private readonly platform: NodeJS.Platform;
  private readonly architecture: string;
  private readonly maxCatalogBytes: number;
  private readonly maxSignatureBytes: number;
  private readonly maxArchiveBytes: number;
  private readonly maxExtractedBytes: number;
  private readonly maxArchiveFiles: number;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly beforeMutation: (capabilityId: FeaturePackCapabilityId) => Promise<void>;
  private readonly listeners = new Set<FeaturePackProgressListener>();
  private readonly activeOperations = new Map<FeaturePackCapabilityId, ActiveOperation>();
  private readonly restartRequired = new Set<FeaturePackCapabilityId>();
  private catalog: FeaturePackCatalog | null = null;
  private catalogError: FeaturePackPublicError | null = null;

  /**
   * Create a distribution service bound to an application-owned staging area.
   *
   * @param options Store, trust, transport, and resource limit configuration.
   */
  public constructor(options: FeaturePackDistributionOptions) {
    this.manager = options.manager;
    this.stagingDirectory = path.resolve(options.stagingDirectory);
    this.auditLogPath = path.resolve(options.auditLogPath);
    this.catalogStatePath = path.resolve(
      options.catalogStatePath
        ?? path.join(path.dirname(options.auditLogPath), "feature-pack-catalog-state.json"),
    );
    this.feedUrl = options.feedUrl?.trim() || null;
    this.allowInsecureLoopback = options.allowInsecureLoopback ?? false;
    this.platform = options.platform ?? process.platform;
    this.architecture = options.architecture ?? process.arch;
    this.maxCatalogBytes = options.maxCatalogBytes ?? DEFAULT_MAX_CATALOG_BYTES;
    this.maxSignatureBytes = options.maxSignatureBytes ?? DEFAULT_MAX_SIGNATURE_BYTES;
    this.maxArchiveBytes = options.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
    this.maxExtractedBytes = options.maxExtractedBytes ?? DEFAULT_MAX_EXTRACTED_BYTES;
    this.maxArchiveFiles = options.maxArchiveFiles ?? DEFAULT_MAX_ARCHIVE_FILES;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.beforeMutation = options.beforeMutation ?? (async () => undefined);
    this.trustedKeys = this.parseTrustedKeys(options.trustedKeys ?? {});
  }

  /**
   * Subscribe to sanitized operation progress events.
   *
   * @param listener Listener invoked after each progress transition.
   * @returns Function that removes the listener.
   */
  public subscribe(listener: FeaturePackProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Return installed health and optionally refresh the signed remote catalog.
   *
   * @param refresh Whether to request a fresh signed catalog before listing.
   * @returns Renderer-safe distribution snapshot.
   */
  public async list(refresh = true): Promise<FeaturePackDistributionSnapshot> {
    if (refresh && this.isConfigured()) {
      try {
        await this.refreshCatalog();
        this.catalogError = null;
      } catch (error) {
        this.catalogError = toFeaturePackPublicError(error);
      }
    }

    const packs = await Promise.all(
      FEATURE_PACK_CAPABILITY_IDS.map((capabilityId) => this.buildDistributionItem(capabilityId)),
    );
    const feedStatus = !this.isConfigured()
      ? "not-configured"
      : (this.catalogError === null ? "ready" : "error");
    return {
      feedStatus,
      catalogGeneratedAt: this.catalog?.generatedAt ?? null,
      refreshedAt: new Date().toISOString(),
      packs,
      ...(this.catalogError === null ? {} : { error: this.catalogError }),
    };
  }

  /**
   * Download and install the current catalog version for a capability.
   *
   * @param capabilityId Allow-listed capability to install.
   * @returns Completed mutation result requiring an application restart.
   */
  public async install(
    capabilityId: FeaturePackCapabilityId,
  ): Promise<FeaturePackMutationResult> {
    return this.runMutation(capabilityId, "install");
  }

  /**
   * Re-download and atomically replace the current catalog version for a capability.
   *
   * @param capabilityId Allow-listed capability to repair.
   * @returns Completed mutation result requiring an application restart.
   */
  public async repair(
    capabilityId: FeaturePackCapabilityId,
  ): Promise<FeaturePackMutationResult> {
    return this.runMutation(capabilityId, "repair");
  }

  /**
   * Stop and remove every installed version for a capability.
   *
   * @param capabilityId Allow-listed capability to uninstall.
   * @returns Completed mutation result requiring an application restart.
   */
  public async uninstall(
    capabilityId: FeaturePackCapabilityId,
  ): Promise<FeaturePackMutationResult> {
    return this.runMutation(capabilityId, "uninstall");
  }

  /**
   * Execute one serialized mutation with progress, audit, and cleanup guarantees.
   *
   * @param capabilityId Capability being mutated.
   * @param operation Requested lifecycle operation.
   * @returns Completed mutation result.
   */
  private async runMutation(
    capabilityId: FeaturePackCapabilityId,
    operation: FeaturePackOperation,
  ): Promise<FeaturePackMutationResult> {
    if (this.activeOperations.has(capabilityId)) {
      throw new FeaturePackError(
        "OPERATION_IN_PROGRESS",
        "A Feature Pack operation is already running for this capability.",
      );
    }
    const operationId = randomUUID();
    this.activeOperations.set(capabilityId, { operationId, operation });
    let version: string | null = null;
    try {
      this.emitProgress(operationId, capabilityId, operation, "preparing", null, null, null);
      if (operation === "uninstall") {
        const versions = await this.manager.listInstalledVersions(capabilityId);
        version = versions.find((candidate) => candidate.active)?.version ?? null;
        await this.beforeMutation(capabilityId);
        this.emitProgress(operationId, capabilityId, operation, "removing", null, null, null);
        await this.manager.removeCapability(capabilityId);
      } else {
        const release = await this.resolveRelease(capabilityId);
        version = release.version;
        const installed = await this.manager.listInstalledVersions(capabilityId);
        if (operation === "repair" && installed.length === 0) {
          throw new FeaturePackError("PACK_NOT_INSTALLED", "Feature Pack is not installed.");
        }
        const newestInstalled = installed
          .filter((candidate) => candidate.valid)
          .sort((left, right) => this.compareVersions(right.version, left.version))[0];
        if (newestInstalled !== undefined && this.compareVersions(release.version, newestInstalled.version) < 0) {
          throw new FeaturePackError("ROLLBACK_DETECTED", "Feature Pack downgrade was blocked.");
        }
        await this.installRelease(operationId, operation, release);
      }
      this.restartRequired.add(capabilityId);
      this.emitProgress(operationId, capabilityId, operation, "completed", 100, null, null);
      await this.appendAudit({
        timestamp: new Date().toISOString(),
        operationId,
        capabilityId,
        operation,
        outcome: "succeeded",
        version,
        errorCode: null,
      });
      return { capabilityId, operation, version, restartRequired: true };
    } catch (error) {
      const publicError = toFeaturePackPublicError(error);
      this.emitProgress(operationId, capabilityId, operation, "failed", null, null, null, publicError);
      await this.appendAudit({
        timestamp: new Date().toISOString(),
        operationId,
        capabilityId,
        operation,
        outcome: "failed",
        version,
        errorCode: publicError.code,
      }).catch(() => undefined);
      throw error;
    } finally {
      this.activeOperations.delete(capabilityId);
    }
  }

  /**
   * Download, verify, extract, and atomically install one catalog release.
   *
   * @param operationId Public operation correlation identifier.
   * @param operation Install or repair operation.
   * @param release Signed catalog entry to install.
   */
  private async installRelease(
    operationId: string,
    operation: "install" | "repair",
    release: FeaturePackCatalogEntry,
  ): Promise<void> {
    const operationRoot = path.join(this.stagingDirectory, operationId);
    const archivePath = path.join(operationRoot, "pack.tar.gz");
    const packDirectory = path.join(operationRoot, "pack");
    await fs.mkdir(operationRoot, { recursive: true, mode: 0o700 });
    try {
      const archiveUrl = assertFeaturePackDistributionUrl(
        release.archiveUrl,
        this.allowInsecureLoopback,
      );
      const download = await this.downloadArchive(
        archiveUrl,
        archivePath,
        release.archiveSize,
        operationId,
        release.id,
        operation,
      );
      this.emitProgress(operationId, release.id, operation, "verifying-archive", null, null, null);
      if (download.bytes !== release.archiveSize || download.sha256 !== release.archiveSha256) {
        throw new FeaturePackError("ARCHIVE_HASH_MISMATCH", "Feature Pack archive hash does not match catalog.");
      }
      this.emitProgress(operationId, release.id, operation, "extracting", null, null, null);
      await this.extractArchive(archivePath, packDirectory);
      this.emitProgress(operationId, release.id, operation, "verifying-pack", null, null, null);
      await this.verifySignedPack(packDirectory);
      const inspected = await this.manager.inspectDirectory(packDirectory);
      if (inspected.manifest.id !== release.id || inspected.manifest.version !== release.version) {
        throw new FeaturePackError("INVALID_MANIFEST", "Feature Pack does not match its signed catalog entry.");
      }
      await this.beforeMutation(release.id);
      this.emitProgress(operationId, release.id, operation, "installing", null, null, null);
      await this.manager.installFromDirectory(packDirectory, {
        replaceExisting: operation === "repair",
      });
    } finally {
      await fs.rm(operationRoot, { recursive: true, force: true });
    }
  }

  /**
   * Resolve the latest compatible release from a freshly verified catalog.
   *
   * @param capabilityId Capability whose release should be selected.
   * @returns Highest compatible catalog entry.
   */
  private async resolveRelease(
    capabilityId: FeaturePackCapabilityId,
  ): Promise<FeaturePackCatalogEntry> {
    if (!this.isConfigured()) {
      throw new FeaturePackError(
        "DISTRIBUTION_NOT_CONFIGURED",
        "Feature Pack feed and trusted signing keys are required.",
      );
    }
    await this.refreshCatalog();
    const release = this.selectRelease(capabilityId);
    if (release === null) {
      throw new FeaturePackError("DOWNLOAD_FAILED", "No compatible Feature Pack release is available.");
    }
    return release;
  }

  /**
   * Fetch and verify catalog.json plus its adjacent catalog.sig.
   *
   * @returns Parsed signed catalog cached by the service.
   */
  private async refreshCatalog(): Promise<FeaturePackCatalog> {
    if (!this.isConfigured() || this.feedUrl === null) {
      throw new FeaturePackError(
        "DISTRIBUTION_NOT_CONFIGURED",
        "Feature Pack feed and trusted signing keys are required.",
      );
    }
    const configuredUrl = assertFeaturePackDistributionUrl(this.feedUrl, this.allowInsecureLoopback);
    const catalogUrl = configuredUrl.pathname.endsWith("/")
      ? new URL("catalog.json", configuredUrl)
      : configuredUrl;
    const signatureUrl = new URL(
      catalogUrl.pathname.endsWith("catalog.json")
        ? catalogUrl.pathname.slice(0, -"catalog.json".length) + "catalog.sig"
        : `${catalogUrl.pathname}.sig`,
      catalogUrl,
    );
    const [catalogBytes, signatureBytes] = await Promise.all([
      this.fetchBytes(catalogUrl, this.maxCatalogBytes),
      this.fetchBytes(signatureUrl, this.maxSignatureBytes),
    ]);
    this.verifyDetachedSignature(catalogBytes, signatureBytes);
    let value: unknown;
    try {
      value = JSON.parse(catalogBytes.toString("utf8")) as unknown;
    } catch (error) {
      throw new FeaturePackError("INVALID_MANIFEST", "Feature Pack catalog contains invalid JSON.", {
        cause: error,
      });
    }
    const catalog = parseFeaturePackCatalog(value, catalogUrl, this.allowInsecureLoopback);
    await this.commitCatalogState(catalog, catalogBytes);
    this.catalog = catalog;
    return catalog;
  }

  /**
   * Enforce a persistent catalog timestamp and digest watermark before accepting updates.
   *
   * @param catalog Newly verified signed catalog.
   * @param catalogBytes Exact signed catalog bytes.
   */
  private async commitCatalogState(catalog: FeaturePackCatalog, catalogBytes: Buffer): Promise<void> {
    const nextTimestamp = Date.parse(catalog.generatedAt);
    if (nextTimestamp > Date.now() + 24 * 60 * 60 * 1000) {
      throw new FeaturePackError("INVALID_MANIFEST", "Feature Pack catalog timestamp is too far in the future.");
    }
    const nextHash = createHash("sha256").update(catalogBytes).digest("hex");
    let current: FeaturePackCatalogState | null = null;
    try {
      const source = await fs.readFile(this.catalogStatePath, "utf8");
      const value = JSON.parse(source) as unknown;
      if (
        !isRecord(value)
        || value.schema !== FEATURE_PACK_CATALOG_STATE_SCHEMA
        || typeof value.generatedAt !== "string"
        || Number.isNaN(Date.parse(value.generatedAt))
        || typeof value.sha256 !== "string"
        || !/^[a-f0-9]{64}$/.test(value.sha256)
      ) {
        throw new FeaturePackError("ROLLBACK_DETECTED", "Feature Pack catalog state is invalid.");
      }
      current = {
        schema: FEATURE_PACK_CATALOG_STATE_SCHEMA,
        generatedAt: value.generatedAt,
        sha256: value.sha256,
      };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        if (error instanceof FeaturePackError) {
          throw error;
        }
        throw new FeaturePackError("ROLLBACK_DETECTED", "Feature Pack catalog state could not be verified.", {
          cause: error,
        });
      }
    }

    if (current !== null) {
      const currentTimestamp = Date.parse(current.generatedAt);
      if (nextTimestamp < currentTimestamp || (nextTimestamp === currentTimestamp && nextHash !== current.sha256)) {
        throw new FeaturePackError("ROLLBACK_DETECTED", "Feature Pack catalog rollback was blocked.");
      }
      if (nextTimestamp === currentTimestamp && nextHash === current.sha256) {
        return;
      }
    }

    const temporaryPath = `${this.catalogStatePath}.${randomUUID()}.tmp`;
    await fs.mkdir(path.dirname(this.catalogStatePath), { recursive: true, mode: 0o700 });
    await fs.writeFile(temporaryPath, `${JSON.stringify({
      schema: FEATURE_PACK_CATALOG_STATE_SCHEMA,
      generatedAt: catalog.generatedAt,
      sha256: nextHash,
    }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      await fs.rename(temporaryPath, this.catalogStatePath);
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }
  }

  /**
   * Fetch a small signed metadata resource under a strict byte budget.
   *
   * @param url HTTPS or permitted development URL.
   * @param maximumBytes Maximum accepted response size.
   * @returns Response bytes.
   */
  private async fetchBytes(url: URL, maximumBytes: number): Promise<Buffer> {
    let response: Response;
    try {
      response = await this.fetchImplementation(url, { redirect: "follow" });
    } catch (error) {
      throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack metadata request failed.", {
        cause: error,
      });
    }
    assertFeaturePackDistributionUrl(response.url || url.href, this.allowInsecureLoopback);
    if (!response.ok || response.body === null) {
      throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack metadata request was unsuccessful.");
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
      throw new FeaturePackError("DOWNLOAD_TOO_LARGE", "Feature Pack metadata exceeds its byte budget.");
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maximumBytes) {
        throw new FeaturePackError("DOWNLOAD_TOO_LARGE", "Feature Pack metadata exceeds its byte budget.");
      }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks, total);
  }

  /**
   * Stream an archive to private staging while calculating SHA-256 and progress.
   *
   * @param url Verified archive URL.
   * @param destinationPath Private temporary archive path.
   * @param expectedBytes Signed expected archive size.
   * @param operationId Operation correlation identifier.
   * @param capabilityId Capability being installed.
   * @param operation Install or repair operation.
   * @returns Downloaded byte count and digest.
   */
  private async downloadArchive(
    url: URL,
    destinationPath: string,
    expectedBytes: number,
    operationId: string,
    capabilityId: FeaturePackCapabilityId,
    operation: "install" | "repair",
  ): Promise<DownloadResult> {
    if (expectedBytes > this.maxArchiveBytes) {
      throw new FeaturePackError("DOWNLOAD_TOO_LARGE", "Feature Pack archive exceeds the configured byte budget.");
    }
    let response: Response;
    try {
      response = await this.fetchImplementation(url, { redirect: "follow" });
    } catch (error) {
      throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack archive request failed.", { cause: error });
    }
    assertFeaturePackDistributionUrl(response.url || url.href, this.allowInsecureLoopback);
    if (!response.ok || response.body === null) {
      throw new FeaturePackError("DOWNLOAD_FAILED", "Feature Pack archive request was unsuccessful.");
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && (contentLength > expectedBytes || contentLength > this.maxArchiveBytes)) {
      throw new FeaturePackError("DOWNLOAD_TOO_LARGE", "Feature Pack archive exceeds its signed size.");
    }

    const handle = await fs.open(destinationPath, "wx", 0o600);
    const hash = createHash("sha256");
    let total = 0;
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        total += chunk.byteLength;
        if (total > expectedBytes || total > this.maxArchiveBytes) {
          throw new FeaturePackError("DOWNLOAD_TOO_LARGE", "Feature Pack archive exceeds its signed size.");
        }
        const bytes = Buffer.from(chunk);
        hash.update(bytes);
        await handle.write(bytes);
        const percent = expectedBytes > 0 ? Math.min(99, Math.floor((total / expectedBytes) * 100)) : null;
        this.emitProgress(
          operationId,
          capabilityId,
          operation,
          "downloading",
          percent,
          total,
          expectedBytes,
        );
      }
    } finally {
      await handle.close();
    }
    return { bytes: total, sha256: hash.digest("hex") };
  }

  /**
   * Extract a tar.gz archive while rejecting traversal, links, special files, and bombs.
   *
   * @param archivePath Downloaded archive path.
   * @param destinationDirectory Empty private extraction directory.
   */
  private async extractArchive(archivePath: string, destinationDirectory: string): Promise<void> {
    await fs.mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
    let extractedBytes = 0;
    let fileCount = 0;
    let validationError: FeaturePackError | null = null;

    /** Inspect one entry during a non-writing archive pass. */
    const inspectEntry = (entry: ReadEntry): void => {
      if (validationError !== null) {
        return;
      }
      try {
        this.validateArchiveEntryPath(entry.path);
        if (entry.type !== "File" && entry.type !== "OldFile" && entry.type !== "Directory") {
          throw new FeaturePackError("UNSAFE_ARCHIVE", "Feature Pack archive contains a forbidden entry type.");
        }
        if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
          throw new FeaturePackError("UNSAFE_ARCHIVE", "Feature Pack archive contains an invalid entry size.");
        }
        if (entry.type !== "Directory") {
          fileCount += 1;
          extractedBytes += entry.size;
        }
        if (fileCount > this.maxArchiveFiles || extractedBytes > this.maxExtractedBytes) {
          throw new FeaturePackError("UNSAFE_ARCHIVE", "Feature Pack archive exceeds extraction limits.");
        }
      } catch (error) {
        validationError = error instanceof FeaturePackError
          ? error
          : new FeaturePackError("UNSAFE_ARCHIVE", "Feature Pack archive entry is invalid.", { cause: error });
      }
    };

    try {
      await list({ file: archivePath, strict: true, onReadEntry: inspectEntry });
      if (validationError !== null) {
        throw validationError;
      }
      await extract({
        file: archivePath,
        cwd: destinationDirectory,
        strict: true,
        preservePaths: false,
        unlink: false,
        noChmod: true,
      });
    } catch (error) {
      if (error instanceof FeaturePackError) {
        throw error;
      }
      throw new FeaturePackError("UNSAFE_ARCHIVE", "Feature Pack archive could not be extracted safely.", {
        cause: error,
      });
    }
  }

  /**
   * Reject absolute, parent-relative, ambiguous, or Windows-style archive paths.
   *
   * @param entryPath Raw path from a tar header.
   */
  private validateArchiveEntryPath(entryPath: string): void {
    const normalizedInput = entryPath.endsWith("/") ? entryPath.slice(0, -1) : entryPath;
    const segments = normalizedInput.split("/");
    if (
      normalizedInput === ""
      || normalizedInput.includes("\\")
      || normalizedInput.includes("\0")
      || normalizedInput.startsWith("/")
      || /^[A-Za-z]:/.test(normalizedInput)
      || segments.some((segment) => segment === "" || segment === "." || segment === "..")
      || path.posix.normalize(normalizedInput) !== normalizedInput
    ) {
      throw new FeaturePackError("UNSAFE_ARCHIVE", "Feature Pack archive contains an unsafe path.");
    }
  }

  /**
   * Verify manifest.sig against the exact raw UTF-8 manifest.json bytes.
   *
   * @param packDirectory Extracted Feature Pack root.
   */
  private async verifySignedPack(packDirectory: string): Promise<void> {
    let manifestBytes: Buffer;
    let signatureBytes: Buffer;
    try {
      [manifestBytes, signatureBytes] = await Promise.all([
        fs.readFile(path.join(packDirectory, "manifest.json")),
        fs.readFile(path.join(packDirectory, "manifest.sig")),
      ]);
    } catch (error) {
      throw new FeaturePackError("INVALID_SIGNATURE", "Signed Feature Pack metadata is missing.", {
        cause: error,
      });
    }
    if (manifestBytes.byteLength > this.maxCatalogBytes || signatureBytes.byteLength > this.maxSignatureBytes) {
      throw new FeaturePackError("INVALID_SIGNATURE", "Signed Feature Pack metadata exceeds its byte budget.");
    }
    this.verifyDetachedSignature(manifestBytes, signatureBytes);
  }

  /**
   * Verify raw bytes with a detached signature and an application-trusted key.
   *
   * @param payload Exact signed bytes.
   * @param signatureBytes UTF-8 JSON signature envelope.
   */
  private verifyDetachedSignature(payload: Buffer, signatureBytes: Buffer): void {
    let value: unknown;
    try {
      value = JSON.parse(signatureBytes.toString("utf8")) as unknown;
    } catch (error) {
      throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack signature contains invalid JSON.", {
        cause: error,
      });
    }
    const signature = parseFeaturePackSignature(value);
    const key = this.trustedKeys.get(signature.keyId);
    if (key === undefined) {
      throw new FeaturePackError("UNKNOWN_SIGNING_KEY", "Feature Pack signing key is not trusted.");
    }
    const signatureBuffer = Buffer.from(signature.signature, "base64");
    if (!verify(null, payload, key, signatureBuffer)) {
      throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack signature does not match its payload.");
    }
  }

  /**
   * Parse and validate configured Ed25519 public keys once at construction time.
   *
   * @param values PEM public keys indexed by stable keyId.
   * @returns Immutable trusted key map.
   */
  private parseTrustedKeys(values: Readonly<Record<string, string>>): ReadonlyMap<string, KeyObject> {
    const keys = new Map<string, KeyObject>();
    for (const [keyId, pem] of Object.entries(values)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(keyId) || typeof pem !== "string") {
        throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack trust store contains an invalid key record.");
      }
      let key: KeyObject;
      try {
        key = createPublicKey(pem);
      } catch (error) {
        throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack trust store contains an invalid public key.", {
          cause: error,
        });
      }
      if (key.asymmetricKeyType !== "ed25519") {
        throw new FeaturePackError("INVALID_SIGNATURE", "Feature Pack trust store keys must use Ed25519.");
      }
      keys.set(keyId, key);
    }
    return keys;
  }

  /**
   * Determine whether both a feed URL and at least one trusted key are configured.
   *
   * @returns True when remote management can enforce its trust policy.
   */
  private isConfigured(): boolean {
    return this.feedUrl !== null && this.trustedKeys.size > 0;
  }

  /**
   * Select the highest compatible catalog version for a capability.
   *
   * @param capabilityId Capability to resolve.
   * @returns Compatible release or null when the catalog has none.
   */
  private selectRelease(capabilityId: FeaturePackCapabilityId): FeaturePackCatalogEntry | null {
    const candidates = (this.catalog?.entries ?? [])
      .filter((entry) => (
        entry.id === capabilityId
        && entry.platform === this.platform
        && entry.architecture === this.architecture
      ))
      .sort((left, right) => this.compareVersions(right.version, left.version));
    return candidates[0] ?? null;
  }

  /**
   * Compare release identifiers using deterministic numeric-aware ordering.
   *
   * @param left First version.
   * @param right Second version.
   * @returns Negative, zero, or positive ordering value.
   */
  private compareVersions(left: string, right: string): number {
    return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
  }

  /**
   * Build one Renderer-safe item from installed version health and catalog state.
   *
   * @param capabilityId Capability to summarize.
   * @returns Distribution item without local paths.
   */
  private async buildDistributionItem(
    capabilityId: FeaturePackCapabilityId,
  ): Promise<FeaturePackDistributionItem> {
    const release = this.selectRelease(capabilityId);
    const operation = this.activeOperations.get(capabilityId)?.operation ?? null;
    try {
      const versions = await this.manager.listInstalledVersions(capabilityId);
      const active = versions.find((candidate) => candidate.active);
      const validActive = active?.valid === true ? active : null;
      const installedVersion = active?.version ?? null;
      let status: FeaturePackDistributionItem["status"] = "not-installed";
      if (active !== undefined && !active.valid) {
        status = "damaged";
      } else if (validActive !== null) {
        status = release !== null && this.compareVersions(release.version, validActive.version) > 0
          ? "update-available"
          : "installed";
      } else if (versions.length > 0) {
        status = "damaged";
      }
      return {
        capabilityId,
        displayName: DISPLAY_NAMES[capabilityId],
        status,
        installedVersion,
        availableVersion: release?.version ?? null,
        operation,
        restartRequired: this.restartRequired.has(capabilityId),
        ...(status === "damaged"
          ? { error: toFeaturePackPublicError(new FeaturePackError("INVALID_PACK_CONTENT", "Damaged pack.")) }
          : {}),
      };
    } catch (error) {
      return {
        capabilityId,
        displayName: DISPLAY_NAMES[capabilityId],
        status: "damaged",
        installedVersion: null,
        availableVersion: release?.version ?? null,
        operation,
        restartRequired: this.restartRequired.has(capabilityId),
        error: toFeaturePackPublicError(error),
      };
    }
  }

  /**
   * Notify progress listeners while isolating observer failures.
   *
   * @param operationId Operation correlation identifier.
   * @param capabilityId Capability being mutated.
   * @param operation Current lifecycle operation.
   * @param phase Current stable progress phase.
   * @param percent Percentage from zero to one hundred when measurable.
   * @param transferredBytes Downloaded byte count when measurable.
   * @param totalBytes Signed total byte count when measurable.
   * @param error Optional sanitized terminal failure.
   */
  private emitProgress(
    operationId: string,
    capabilityId: FeaturePackCapabilityId,
    operation: FeaturePackOperation,
    phase: FeaturePackProgressPhase,
    percent: number | null,
    transferredBytes: number | null,
    totalBytes: number | null,
    error?: FeaturePackPublicError,
  ): void {
    const event: FeaturePackProgressEvent = {
      operationId,
      capabilityId,
      operation,
      phase,
      percent,
      transferredBytes,
      totalBytes,
      ...(error === undefined ? {} : { error }),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Progress observers cannot interrupt an installation transaction.
      }
    }
  }

  /**
   * Append one sanitized JSON audit record using UTF-8 JSON Lines.
   *
   * @param record Completed operation record without paths or URLs.
   */
  private async appendAudit(record: AuditRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.auditLogPath), { recursive: true, mode: 0o700 });
    await fs.appendFile(this.auditLogPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
