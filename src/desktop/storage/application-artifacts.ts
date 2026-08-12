import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { copyFile, lstat, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  APPLICATION_ARTIFACT_SCHEMA,
  parseDeleteApplicationArtifactsRequest,
  parseImportApplicationArtifactsRequest,
  parseImportRendererApplicationArtifactsRequest,
  parseListApplicationArtifactsRequest,
  parseRegisterApplicationArtifactsRequest,
  type ApplicationArtifact,
  type ApplicationArtifactKind,
  type ApplicationArtifactSnapshot,
  type ApplicationArtifactStatus,
  type ApplicationArtifactWriteResult,
  type DeleteApplicationArtifactsResult,
  type RegisterApplicationArtifactFile,
} from "../contracts/application-artifacts";
import {
  APPLICATION_DATABASE_FILENAME,
  ApplicationStore,
} from "./application-store";

/** Maximum source file size copied into the desktop artifact library. */
export const MAX_APPLICATION_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024;

/** Maximum legacy settings payload inspected during lazy metadata migration. */
export const MAX_LEGACY_ARTIFACT_SETTINGS_BYTES = 16 * 1024 * 1024;

const ARTIFACT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

const DOCUMENT_EXTENSIONS = new Set([
  "doc", "docx", "ppt", "pptx", "xls", "xlsx", "pdf", "pages", "numbers", "key",
  "rtf", "odt", "epub", "js", "ts", "py", "java", "c", "cpp", "h", "hpp", "go",
  "rs", "swift", "kt", "dart", "rb", "php", "html", "css", "scss", "less", "vue",
  "svelte", "jsx", "tsx", "json", "xml", "yml", "yaml", "sql", "sh", "csv", "tsv",
  "txt", "md", "markdown", "log", "conf", "ini", "env", "toml",
]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "avi"]);

const MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  bmp: "image/bmp",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  md: "text/markdown",
  markdown: "text/markdown",
  mov: "video/quicktime",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  webm: "video/webm",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
});

/** Warning sink used for optional legacy migration diagnostics. */
export interface ApplicationArtifactLogger {
  warn(message: string, error?: unknown): void;
}

/** Options used to bootstrap the Desktop Core artifact boundary. */
export interface BootstrapApplicationArtifactsOptions {
  readonly userDataDirectory: string;
  readonly databasePath?: string;
  readonly artifactDirectory?: string;
  readonly legacyDatabasePath?: string;
  readonly legacySettingsPath?: string;
  readonly now?: () => Date;
  readonly logger?: ApplicationArtifactLogger;
}

interface ApplicationArtifactRow {
  readonly artifact_id: string;
  readonly revision: number;
  readonly storage_name: string;
  readonly original_name: string;
  readonly media_kind: ApplicationArtifactKind;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly sha256: string | null;
  readonly status: ApplicationArtifactStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

interface CatalogRevisionRow {
  readonly revision: number;
}

interface LegacySettingsRow {
  readonly data: unknown;
}

interface LegacyArtifactMetadata {
  readonly originalName: string;
  readonly kind: ApplicationArtifactKind;
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return the lower-case extension without its leading period. */
function getExtension(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase();
}

/** Classify one allow-listed file extension for the desktop library. */
function classifyExtension(extension: string): ApplicationArtifactKind | null {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }
  return null;
}

/** Resolve a deterministic MIME type for one allow-listed extension. */
function resolveMimeType(extension: string, kind: ApplicationArtifactKind): string {
  return MIME_TYPES[extension]
    ?? (kind === "image" ? `image/${extension}` : kind === "video" ? `video/${extension}` : "application/octet-stream");
}

/** Normalize an untrusted legacy display name to one local filename. */
function normalizeLegacyDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = path.basename(value.trim());
  if (
    !normalized
    || normalized.length > 255
    || /[\\/\u0000-\u001F\u007F]/.test(normalized)
    || normalized === "."
    || normalized === ".."
  ) {
    return fallback;
  }
  return normalized;
}

/** Parse one bounded UTF-8 legacy settings object without modifying it. */
function readLegacyJsonRecord(
  filePath: string,
  logger: ApplicationArtifactLogger,
): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    if (statSync(filePath).size > MAX_LEGACY_ARTIFACT_SETTINGS_BYTES) {
      throw new Error("Legacy artifact settings exceed the migration budget.");
    }
    const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!isRecord(value)) {
      throw new Error("Legacy artifact settings must contain an object.");
    }
    return value;
  } catch (error) {
    logger.warn(`Ignored invalid legacy artifact settings '${filePath}'.`, error);
    return null;
  }
}

/** Read the legacy Python settings row without creating or changing its database. */
function readLegacyPythonSettings(
  databasePath: string,
  logger: ApplicationArtifactLogger,
): Record<string, unknown> | null {
  if (!existsSync(databasePath)) {
    return null;
  }
  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true, timeout: 1_000 });
    const table = database.prepare(
      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
    ).get();
    if (table === undefined) {
      return null;
    }
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get() as
      | LegacySettingsRow
      | undefined;
    if (row === undefined || typeof row.data !== "string") {
      return null;
    }
    if (Buffer.byteLength(row.data, "utf8") > MAX_LEGACY_ARTIFACT_SETTINGS_BYTES) {
      throw new Error("Legacy Python artifact settings exceed the migration budget.");
    }
    const value = JSON.parse(row.data) as unknown;
    if (!isRecord(value)) {
      throw new Error("Legacy Python artifact settings must contain an object.");
    }
    return value;
  } catch (error) {
    logger.warn(`Ignored invalid legacy artifact database '${databasePath}'.`, error);
    return null;
  } finally {
    database?.close();
  }
}

/** Collect legacy file display names by their application-owned storage filename. */
function collectLegacyArtifactMetadata(
  sources: readonly (Record<string, unknown> | null)[],
): Map<string, LegacyArtifactMetadata> {
  const metadata = new Map<string, LegacyArtifactMetadata>();
  const fields: readonly [string, ApplicationArtifactKind][] = [
    ["textFiles", "document"],
    ["imageFiles", "image"],
    ["videoFiles", "video"],
    ["vedioFiles", "video"],
  ];
  for (const source of sources) {
    if (source === null) {
      continue;
    }
    for (const [field, kind] of fields) {
      const entries = source[field];
      if (!Array.isArray(entries)) {
        continue;
      }
      for (const entry of entries) {
        if (!isRecord(entry) || typeof entry.unique_filename !== "string") {
          continue;
        }
        const storageName = entry.unique_filename.trim();
        if (!STORAGE_NAME_PATTERN.test(storageName) || metadata.has(storageName)) {
          continue;
        }
        metadata.set(storageName, {
          originalName: normalizeLegacyDisplayName(entry.original_filename, storageName),
          kind,
        });
      }
    }
  }
  return metadata;
}

/** Convert a SQLite row into the public artifact contract. */
function rowToArtifact(row: ApplicationArtifactRow): ApplicationArtifact {
  return {
    id: row.artifact_id,
    revision: Number(row.revision),
    storageName: row.storage_name,
    originalName: row.original_name,
    kind: row.media_kind,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Desktop Core artifact metadata and binary lifecycle service. */
export class ApplicationArtifactService {
  private closed = false;
  private migrationPromise: Promise<void> | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  /** Create a service over an initialized schema and application-owned artifact directory. */
  public constructor(
    private readonly database: DatabaseSync,
    private readonly artifactDirectory: string,
    private readonly legacyDatabasePath: string,
    private readonly legacySettingsPath: string,
    private readonly now: () => Date,
    private readonly logger: ApplicationArtifactLogger,
  ) {
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA trusted_schema = OFF");
  }

  /** List artifacts after lazily reconciling legacy metadata and the upload directory. */
  public listArtifacts(request: unknown = {}): Promise<ApplicationArtifactSnapshot> {
    const parsed = parseListApplicationArtifactsRequest(request);
    return this.enqueueOperation(async () => {
      await this.ensureLegacyMigration();
      return this.createSnapshot(parsed.includeUnavailable === true);
    });
  }

  /** Copy native dialog files into application storage and assign stable artifact IDs. */
  public importArtifacts(request: unknown): Promise<ApplicationArtifactWriteResult> {
    const parsed = parseImportApplicationArtifactsRequest(request);
    return this.enqueueOperation(async () => {
      await this.ensureLegacyMigration();
      const artifacts: ApplicationArtifact[] = [];
      for (const sourcePath of parsed.paths) {
        artifacts.push(await this.importOneFile(sourcePath));
      }
      return { artifacts, snapshot: this.createSnapshot(false) };
    });
  }

  /**
   * 导入 preload 从真实 File 解析的本机路径或有界内联内容；输入经过精确校验，返回稳定 Artifact 和最新快照，文件失败时停止后续导入并保留此前成功项。
   */
  public importRendererArtifacts(request: unknown): Promise<ApplicationArtifactWriteResult> {
    const parsed = parseImportRendererApplicationArtifactsRequest(request);
    return this.enqueueOperation(async () => {
      await this.ensureLegacyMigration();
      const artifacts: ApplicationArtifact[] = [];
      for (const entry of parsed.entries) {
        artifacts.push(
          entry.source === "path"
            ? await this.importOneFile(entry.path)
            : await this.importOneBuffer(entry.originalName, entry.bytes),
        );
      }
      return { artifacts, snapshot: this.createSnapshot(false) };
    });
  }

  /** Register files written by the temporary Python HTTP compatibility upload route. */
  public registerArtifacts(request: unknown): Promise<ApplicationArtifactWriteResult> {
    const parsed = parseRegisterApplicationArtifactsRequest(request);
    return this.enqueueOperation(async () => {
      await this.ensureLegacyMigration();
      const artifacts: ApplicationArtifact[] = [];
      for (const file of parsed.files) {
        artifacts.push(await this.registerOneFile(file));
      }
      return { artifacts, snapshot: this.createSnapshot(false) };
    });
  }

  /** Delete artifact binaries while retaining tombstone metadata for future task references. */
  public deleteArtifacts(request: unknown): Promise<DeleteApplicationArtifactsResult> {
    const parsed = parseDeleteApplicationArtifactsRequest(request);
    return this.enqueueOperation(async () => {
      await this.ensureLegacyMigration();
      const deletedArtifactIds: string[] = [];
      const rejectedArtifactIds: string[] = [];
      for (const artifactId of parsed.artifactIds) {
        if (await this.deleteOneArtifact(artifactId)) {
          deletedArtifactIds.push(artifactId);
        } else {
          rejectedArtifactIds.push(artifactId);
        }
      }
      return {
        deletedArtifactIds,
        rejectedArtifactIds,
        snapshot: this.createSnapshot(false),
      };
    });
  }

  /** Close the SQLite handle after application shutdown begins. */
  public close(): void {
    if (this.closed) {
      return;
    }
    this.database.close();
    this.closed = true;
  }

  /** Serialize public operations so filesystem and SQLite changes preserve order. */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.assertOpen();
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Run legacy discovery once on first use without adding work to application startup. */
  private async ensureLegacyMigration(): Promise<void> {
    if (this.migrationPromise === null) {
      this.migrationPromise = this.reconcileLegacyArtifacts().catch((error: unknown) => {
        this.migrationPromise = null;
        throw error;
      });
    }
    await this.migrationPromise;
  }

  /** Reconcile supported upload files and prior Python settings into Core metadata. */
  private async reconcileLegacyArtifacts(): Promise<void> {
    mkdirSync(this.artifactDirectory, { recursive: true });
    const metadata = collectLegacyArtifactMetadata([
      readLegacyPythonSettings(this.legacyDatabasePath, this.logger),
      readLegacyJsonRecord(this.legacySettingsPath, this.logger),
    ]);
    const directoryEntries = await readdir(this.artifactDirectory, { withFileTypes: true });
    const availableStorageNames = new Set<string>();
    for (const entry of directoryEntries) {
      if (!entry.isFile() || !STORAGE_NAME_PATTERN.test(entry.name)) {
        continue;
      }
      const extension = getExtension(entry.name);
      const inferredKind = classifyExtension(extension);
      if (inferredKind === null) {
        continue;
      }
      const filePath = path.join(this.artifactDirectory, entry.name);
      const fileStat = await lstat(filePath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        continue;
      }
      availableStorageNames.add(entry.name);
      const legacy = metadata.get(entry.name);
      this.upsertReconciledArtifact({
        storageName: entry.name,
        originalName: legacy?.originalName ?? entry.name,
        kind: legacy?.kind ?? inferredKind,
        sizeBytes: fileStat.size,
        createdAt: (fileStat.birthtimeMs > 0 ? fileStat.birthtime : fileStat.mtime).toISOString(),
        available: true,
      });
    }
    for (const [storageName, legacy] of metadata) {
      if (availableStorageNames.has(storageName) || classifyExtension(getExtension(storageName)) === null) {
        continue;
      }
      this.upsertReconciledArtifact({
        storageName,
        originalName: legacy.originalName,
        kind: legacy.kind,
        sizeBytes: 0,
        createdAt: this.now().toISOString(),
        available: false,
      });
    }
    const availableRows = this.database.prepare(
      "SELECT storage_name FROM application_artifacts WHERE status = 'available'",
    ).all() as unknown as { storage_name: string }[];
    const updatedAt = this.now().toISOString();
    for (const row of availableRows) {
      if (!availableStorageNames.has(row.storage_name)) {
        this.database.prepare(`
          UPDATE application_artifacts
          SET revision = revision + 1, status = 'missing', updated_at = ?
          WHERE storage_name = ? AND status = 'available'
        `).run(updatedAt, row.storage_name);
      }
    }
  }

  /** Insert or refresh one file discovered through compatibility reconciliation. */
  private upsertReconciledArtifact(input: {
    readonly storageName: string;
    readonly originalName: string;
    readonly kind: ApplicationArtifactKind;
    readonly sizeBytes: number;
    readonly createdAt: string;
    readonly available: boolean;
  }): void {
    const existing = this.getRowByStorageName(input.storageName);
    if (existing?.status === "deleted") {
      return;
    }
    const status: ApplicationArtifactStatus = input.available ? "available" : "missing";
    const extension = getExtension(input.storageName);
    const mimeType = resolveMimeType(extension, input.kind);
    const updatedAt = this.now().toISOString();
    if (existing !== null) {
      const changed = existing.original_name !== input.originalName
        || existing.media_kind !== input.kind
        || existing.mime_type !== mimeType
        || Number(existing.size_bytes) !== input.sizeBytes
        || existing.status !== status;
      if (changed) {
        this.database.prepare(`
          UPDATE application_artifacts
          SET revision = revision + 1,
              original_name = ?, media_kind = ?, mime_type = ?, size_bytes = ?,
              status = ?, updated_at = ?, deleted_at = NULL
          WHERE artifact_id = ?
        `).run(
          input.originalName,
          input.kind,
          mimeType,
          input.sizeBytes,
          status,
          updatedAt,
          existing.artifact_id,
        );
      }
      return;
    }
    const artifactId = this.createArtifactId(input.storageName);
    this.database.prepare(`
      INSERT INTO application_artifacts (
        artifact_id, revision, storage_name, original_name, media_kind, mime_type,
        size_bytes, sha256, status, created_at, updated_at, deleted_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)
    `).run(
      artifactId,
      input.storageName,
      input.originalName,
      input.kind,
      mimeType,
      input.sizeBytes,
      status,
      input.createdAt,
      updatedAt,
    );
  }

  /** Import one regular allow-listed file without loading its bytes into Main-process memory. */
  private async importOneFile(sourcePath: string): Promise<ApplicationArtifact> {
    const resolvedSourcePath = path.resolve(sourcePath);
    const sourceStat = await lstat(resolvedSourcePath);
    if (
      !sourceStat.isFile()
      || sourceStat.isSymbolicLink()
      || sourceStat.size > MAX_APPLICATION_ARTIFACT_BYTES
    ) {
      throw new Error("Artifact source must be a bounded regular file.");
    }
    const originalName = normalizeLegacyDisplayName(path.basename(resolvedSourcePath), "");
    const extension = getExtension(originalName);
    const kind = classifyExtension(extension);
    if (!originalName || kind === null) {
      throw new Error("Artifact source file type is not supported.");
    }
    const artifactId = randomUUID();
    const storageName = `${artifactId}.${extension}`;
    const destinationPath = path.join(this.artifactDirectory, storageName);
    const temporaryPath = path.join(this.artifactDirectory, `.${artifactId}.importing`);
    try {
      await copyFile(resolvedSourcePath, temporaryPath, constants.COPYFILE_EXCL);
      const sha256 = await this.hashFile(temporaryPath);
      await rename(temporaryPath, destinationPath);
      const createdAt = this.now().toISOString();
      this.database.prepare(`
        INSERT INTO application_artifacts (
          artifact_id, revision, storage_name, original_name, media_kind, mime_type,
          size_bytes, sha256, status, created_at, updated_at, deleted_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'available', ?, ?, NULL)
      `).run(
        artifactId,
        storageName,
        originalName,
        kind,
        resolveMimeType(extension, kind),
        sourceStat.size,
        sha256,
        createdAt,
        createdAt,
      );
      const row = this.getRowById(artifactId);
      if (row === null) {
        throw new Error("Imported artifact metadata was not persisted.");
      }
      return rowToArtifact(row);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      await rm(destinationPath, { force: true });
      throw error;
    }
  }

  /**
   * 把截图或剪贴板产生的有界字节写入 Artifact 目录；输入文件名和字节，返回稳定元数据，写入或登记失败时清理临时文件并抛错。
   */
  private async importOneBuffer(
    originalName: string,
    bytes: Uint8Array,
  ): Promise<ApplicationArtifact> {
    const extension = getExtension(originalName);
    const kind = classifyExtension(extension);
    if (kind === null) {
      throw new Error("Artifact source file type is not supported.");
    }
    const artifactId = randomUUID();
    const storageName = `${artifactId}.${extension}`;
    const destinationPath = path.join(this.artifactDirectory, storageName);
    const temporaryPath = path.join(this.artifactDirectory, `.${artifactId}.importing`);
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    try {
      await writeFile(temporaryPath, buffer, { flag: "wx" });
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      await rename(temporaryPath, destinationPath);
      const createdAt = this.now().toISOString();
      this.database.prepare(`
        INSERT INTO application_artifacts (
          artifact_id, revision, storage_name, original_name, media_kind, mime_type,
          size_bytes, sha256, status, created_at, updated_at, deleted_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'available', ?, ?, NULL)
      `).run(
        artifactId,
        storageName,
        originalName,
        kind,
        resolveMimeType(extension, kind),
        buffer.byteLength,
        sha256,
        createdAt,
        createdAt,
      );
      const row = this.getRowById(artifactId);
      if (row === null) {
        throw new Error("Imported inline artifact metadata was not persisted.");
      }
      return rowToArtifact(row);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      await rm(destinationPath, { force: true });
      throw error;
    }
  }

  /** Register one regular file that already exists under the application artifact root. */
  private async registerOneFile(file: RegisterApplicationArtifactFile): Promise<ApplicationArtifact> {
    const filePath = path.join(this.artifactDirectory, file.storageName);
    const fileStat = await lstat(filePath);
    if (
      !fileStat.isFile()
      || fileStat.isSymbolicLink()
      || fileStat.size > MAX_APPLICATION_ARTIFACT_BYTES
    ) {
      throw new Error("Registered artifact must be a bounded regular file.");
    }
    const extension = getExtension(file.storageName);
    const inferredKind = classifyExtension(extension);
    if (inferredKind === null || (file.kind !== undefined && file.kind !== inferredKind)) {
      throw new Error("Registered artifact file type is not supported.");
    }
    const existing = this.getRowByStorageName(file.storageName);
    if (existing?.status === "deleted") {
      throw new Error("Deleted artifact storage identity cannot be reused.");
    }
    const sha256 = existing?.sha256 ?? await this.hashFile(filePath);
    const kind = file.kind ?? inferredKind;
    const updatedAt = this.now().toISOString();
    if (existing === null) {
      const artifactId = this.createArtifactId(file.storageName);
      this.database.prepare(`
        INSERT INTO application_artifacts (
          artifact_id, revision, storage_name, original_name, media_kind, mime_type,
          size_bytes, sha256, status, created_at, updated_at, deleted_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'available', ?, ?, NULL)
      `).run(
        artifactId,
        file.storageName,
        file.originalName,
        kind,
        resolveMimeType(extension, kind),
        fileStat.size,
        sha256,
        (fileStat.birthtimeMs > 0 ? fileStat.birthtime : fileStat.mtime).toISOString(),
        updatedAt,
      );
      const inserted = this.getRowById(artifactId);
      if (inserted === null) {
        throw new Error("Registered artifact metadata was not persisted.");
      }
      return rowToArtifact(inserted);
    }
    const changed = existing.original_name !== file.originalName
      || existing.media_kind !== kind
      || Number(existing.size_bytes) !== fileStat.size
      || existing.sha256 !== sha256
      || existing.status !== "available";
    if (changed) {
      this.database.prepare(`
        UPDATE application_artifacts
        SET revision = revision + 1, original_name = ?, media_kind = ?, mime_type = ?,
            size_bytes = ?, sha256 = ?, status = 'available', updated_at = ?, deleted_at = NULL
        WHERE artifact_id = ?
      `).run(
        file.originalName,
        kind,
        resolveMimeType(extension, kind),
        fileStat.size,
        sha256,
        updatedAt,
        existing.artifact_id,
      );
    }
    const updated = this.getRowById(existing.artifact_id);
    if (updated === null) {
      throw new Error("Registered artifact metadata is unavailable.");
    }
    return rowToArtifact(updated);
  }

  /** Remove one artifact binary and record a durable deletion tombstone. */
  private async deleteOneArtifact(artifactId: string): Promise<boolean> {
    const row = this.getRowById(artifactId);
    if (row === null) {
      return false;
    }
    if (row.status === "deleted") {
      return true;
    }
    const filePath = path.join(this.artifactDirectory, row.storage_name);
    try {
      const fileStat = await lstat(filePath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        return false;
      }
      await rm(filePath);
    } catch (error) {
      const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
      if (code !== "ENOENT") {
        this.logger.warn(`Failed to delete artifact '${artifactId}'.`, error);
        return false;
      }
    }
    const deletedAt = this.now().toISOString();
    this.database.prepare(`
      UPDATE application_artifacts
      SET revision = revision + 1, status = 'deleted', updated_at = ?, deleted_at = ?
      WHERE artifact_id = ? AND status <> 'deleted'
    `).run(deletedAt, deletedAt, artifactId);
    return true;
  }

  /** Calculate a SHA-256 digest through a bounded streaming read. */
  private async hashFile(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) {
      hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
  }

  /** Create a stable ID, preserving legacy UUID storage stems where possible. */
  private createArtifactId(storageName: string): string {
    const candidate = path.parse(storageName).name;
    if (ARTIFACT_ID_PATTERN.test(candidate) && this.getRowById(candidate) === null) {
      return candidate.toLowerCase();
    }
    let artifactId = randomUUID();
    while (this.getRowById(artifactId) !== null) {
      artifactId = randomUUID();
    }
    return artifactId;
  }

  /** Read one artifact row by stable ID. */
  private getRowById(artifactId: string): ApplicationArtifactRow | null {
    const row = this.database.prepare(`
      SELECT artifact_id, revision, storage_name, original_name, media_kind, mime_type,
             size_bytes, sha256, status, created_at, updated_at, deleted_at
      FROM application_artifacts WHERE artifact_id = ?
    `).get(artifactId) as unknown as ApplicationArtifactRow | undefined;
    return row ?? null;
  }

  /** Read one artifact row by its private compatibility storage filename. */
  private getRowByStorageName(storageName: string): ApplicationArtifactRow | null {
    const row = this.database.prepare(`
      SELECT artifact_id, revision, storage_name, original_name, media_kind, mime_type,
             size_bytes, sha256, status, created_at, updated_at, deleted_at
      FROM application_artifacts WHERE storage_name = ?
    `).get(storageName) as unknown as ApplicationArtifactRow | undefined;
    return row ?? null;
  }

  /** Return one deterministic public catalog snapshot. */
  private createSnapshot(includeUnavailable: boolean): ApplicationArtifactSnapshot {
    const rows = this.database.prepare(`
      SELECT artifact_id, revision, storage_name, original_name, media_kind, mime_type,
             size_bytes, sha256, status, created_at, updated_at, deleted_at
      FROM application_artifacts
      ${includeUnavailable ? "" : "WHERE status = 'available'"}
      ORDER BY created_at DESC, artifact_id ASC
    `).all() as unknown as ApplicationArtifactRow[];
    const revisionRow = this.database.prepare(
      "SELECT COALESCE(SUM(revision), 0) AS revision FROM application_artifacts",
    ).get() as unknown as CatalogRevisionRow;
    return {
      schema: APPLICATION_ARTIFACT_SCHEMA,
      catalogRevision: Number(revisionRow.revision),
      generatedAt: this.now().toISOString(),
      artifacts: rows.map(rowToArtifact),
    };
  }

  /** Reject operations after the artifact service has closed. */
  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Application artifact service is closed.");
    }
  }
}

/** Bootstrap the lazy Desktop Core artifact service over the shared application database. */
export function bootstrapApplicationArtifacts(
  options: BootstrapApplicationArtifactsOptions,
): ApplicationArtifactService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const databasePath = path.resolve(
    options.databasePath ?? path.join(userDataDirectory, APPLICATION_DATABASE_FILENAME),
  );
  const artifactDirectory = path.resolve(
    options.artifactDirectory ?? path.join(userDataDirectory, "uploaded_files"),
  );
  const legacyDatabasePath = path.resolve(
    options.legacyDatabasePath ?? path.join(userDataDirectory, "super_agent_party.db"),
  );
  const legacySettingsPath = path.resolve(
    options.legacySettingsPath ?? path.join(userDataDirectory, "settings.json"),
  );
  mkdirSync(artifactDirectory, { recursive: true });
  const migrationStore = new ApplicationStore(
    options.now === undefined ? { databasePath } : { databasePath, now: options.now },
  );
  migrationStore.close();
  const database = new DatabaseSync(databasePath);
  return new ApplicationArtifactService(
    database,
    artifactDirectory,
    legacyDatabasePath,
    legacySettingsPath,
    options.now ?? (() => new Date()),
    options.logger ?? console,
  );
}
