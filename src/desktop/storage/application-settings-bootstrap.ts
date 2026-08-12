import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  APPLICATION_DOCUMENT_KEYS,
  DEFAULT_RUNTIME_SETTINGS,
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_SETTINGS_SCHEMA,
  normalizeRuntimeSettings,
  normalizeSystemSettings,
  parseSaveSystemSettingsRequest,
  type RuntimeSettings,
  type SystemSettingsSnapshot,
} from "../contracts/application-settings";
import { ApplicationStore } from "./application-store";

/** Maximum legacy settings payload inspected during one-time migration. */
export const MAX_LEGACY_SETTINGS_BYTES = 16 * 1024 * 1024;

/** Warning sink used when optional legacy settings cannot be imported or mirrored. */
export interface ApplicationSettingsLogger {
  warn(message: string, error?: unknown): void;
}

/** Paths and dependencies used to bootstrap application settings. */
export interface BootstrapApplicationSettingsOptions {
  readonly userDataDirectory: string;
  readonly databasePath?: string;
  readonly legacyDatabasePath?: string;
  readonly legacySettingsPath?: string;
  readonly legacyConfigPath?: string;
  readonly logger?: ApplicationSettingsLogger;
}

interface LegacySettingsRow {
  readonly data: unknown;
}

/** Application-owned settings boundary backed by the Desktop Core database. */
export class ApplicationSettingsService {
  private closed = false;
  private systemMirrorFingerprint: string | null = null;
  private runtimeMirrorFingerprint: string | null = null;

  /**
   * Create a settings boundary over an initialized store and compatibility paths.
   *
   * @param store Open application store.
   * @param settingsMirrorPath Legacy Python settings mirror.
   * @param configMirrorPath Legacy Electron runtime configuration mirror.
   * @param logger Warning sink for non-authoritative mirror failures.
   */
  public constructor(
    private readonly store: ApplicationStore,
    private readonly settingsMirrorPath: string,
    private readonly configMirrorPath: string,
    private readonly logger: ApplicationSettingsLogger,
  ) {}

  /**
   * Return normalized system settings and their durable revision.
   *
   * @returns Current settings snapshot, or revision zero for defaults not yet persisted.
   */
  public getSystemSettings(): SystemSettingsSnapshot {
    this.assertOpen();
    const document = this.store.getDocument<unknown>(APPLICATION_DOCUMENT_KEYS.systemSettings);
    if (document === null) {
      return {
        schema: SYSTEM_SETTINGS_SCHEMA,
        revision: 0,
        settings: normalizeSystemSettings(DEFAULT_SYSTEM_SETTINGS),
        updatedAt: null,
      };
    }
    return {
      schema: SYSTEM_SETTINGS_SCHEMA,
      revision: document.revision,
      settings: normalizeSystemSettings(document.value),
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Validate and persist a complete Renderer-owned system settings replacement.
   *
   * @param request Untrusted save request.
   * @returns Newly persisted settings snapshot.
   */
  public saveSystemSettings(request: unknown): SystemSettingsSnapshot {
    this.assertOpen();
    const { settings } = parseSaveSystemSettingsRequest(request);
    const fingerprint = JSON.stringify(settings);
    const current = this.getSystemSettings();
    if (current.revision > 0 && JSON.stringify(current.settings) === fingerprint) {
      if (this.systemMirrorFingerprint !== fingerprint) {
        this.mirrorProperties(this.settingsMirrorPath, { systemSettings: settings });
        this.systemMirrorFingerprint = fingerprint;
      }
      return current;
    }
    const document = this.store.setDocument(APPLICATION_DOCUMENT_KEYS.systemSettings, settings);
    this.mirrorProperties(this.settingsMirrorPath, { systemSettings: settings });
    this.systemMirrorFingerprint = fingerprint;
    return {
      schema: SYSTEM_SETTINGS_SCHEMA,
      revision: document.revision,
      settings,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Return normalized runtime settings required before Renderer startup.
   *
   * @returns Current runtime settings or bounded defaults.
   */
  public getRuntimeSettings(): RuntimeSettings {
    this.assertOpen();
    const document = this.store.getDocument<unknown>(APPLICATION_DOCUMENT_KEYS.runtimeSettings);
    return normalizeRuntimeSettings(document?.value ?? DEFAULT_RUNTIME_SETTINGS);
  }

  /**
   * Persist normalized startup runtime settings and update the legacy config mirror.
   *
   * @param value Candidate runtime settings.
   * @returns Persisted normalized runtime settings.
   */
  public saveRuntimeSettings(value: unknown): RuntimeSettings {
    this.assertOpen();
    const settings = normalizeRuntimeSettings(value);
    const fingerprint = JSON.stringify(settings);
    const current = this.store.getDocument<unknown>(APPLICATION_DOCUMENT_KEYS.runtimeSettings);
    if (
      current !== null
      && JSON.stringify(normalizeRuntimeSettings(current.value)) === fingerprint
    ) {
      if (this.runtimeMirrorFingerprint !== fingerprint) {
        this.mirrorProperties(this.configMirrorPath, {
          networkVisible: settings.networkVisible,
          chromeMCPSettings: settings.chromeMCPSettings,
        });
        this.runtimeMirrorFingerprint = fingerprint;
      }
      return settings;
    }
    this.store.setDocument(APPLICATION_DOCUMENT_KEYS.runtimeSettings, settings);
    this.mirrorProperties(this.configMirrorPath, {
      networkVisible: settings.networkVisible,
      chromeMCPSettings: settings.chromeMCPSettings,
    });
    this.runtimeMirrorFingerprint = fingerprint;
    return settings;
  }

  /** Close the underlying database handle once application shutdown begins. */
  public close(): void {
    if (this.closed) {
      return;
    }
    this.store.close();
    this.closed = true;
  }

  /** Reject settings operations after the service has closed. */
  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Application settings service is closed.");
    }
  }

  /**
   * Update one compatibility JSON property without making that mirror authoritative.
   *
   * @param filePath Mirror file path.
   * @param updates Properties to replace together.
   */
  private mirrorProperties(filePath: string, updates: Record<string, unknown>): void {
    try {
      const current = readLegacyJsonRecord(filePath, this.logger) ?? {};
      writeJsonAtomically(filePath, { ...current, ...updates });
    } catch (error) {
      this.logger.warn(`Failed to update legacy settings mirror '${filePath}'.`, error);
    }
  }
}

/**
 * Determine whether an unknown value exposes non-array object fields.
 *
 * @param value Candidate value.
 * @returns True for inspectable records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a bounded UTF-8 JSON object from disk.
 *
 * @param filePath Candidate JSON file.
 * @param logger Warning sink for malformed optional legacy data.
 * @returns Parsed record or null when unavailable or invalid.
 */
function readLegacyJsonRecord(
  filePath: string,
  logger: ApplicationSettingsLogger,
): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    if (statSync(filePath).size > MAX_LEGACY_SETTINGS_BYTES) {
      throw new Error("Legacy settings file exceeds the migration budget.");
    }
    const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!isRecord(value)) {
      throw new Error("Legacy settings JSON must contain an object.");
    }
    return value;
  } catch (error) {
    logger.warn(`Ignored invalid legacy settings file '${filePath}'.`, error);
    return null;
  }
}

/**
 * Read the Python settings row without modifying or creating its database.
 *
 * @param databasePath Legacy Python SQLite path.
 * @param logger Warning sink for malformed optional legacy data.
 * @returns Parsed settings object or null when unavailable or invalid.
 */
function readLegacyPythonSettings(
  databasePath: string,
  logger: ApplicationSettingsLogger,
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
    if (Buffer.byteLength(row.data, "utf8") > MAX_LEGACY_SETTINGS_BYTES) {
      throw new Error("Legacy Python settings row exceeds the migration budget.");
    }
    const value = JSON.parse(row.data) as unknown;
    if (!isRecord(value)) {
      throw new Error("Legacy Python settings row must contain a JSON object.");
    }
    return value;
  } catch (error) {
    logger.warn(`Ignored invalid legacy Python settings database '${databasePath}'.`, error);
    return null;
  } finally {
    database?.close();
  }
}

/**
 * Persist one UTF-8 JSON object by replacing a same-directory temporary file.
 *
 * @param filePath Destination JSON path.
 * @param value JSON object to persist.
 */
function writeJsonAtomically(filePath: string, value: Record<string, unknown>): void {
  const resolvedPath = path.resolve(filePath);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(resolvedPath),
    `.${path.basename(resolvedPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporaryPath, resolvedPath);
  } catch (error) {
    if (descriptor !== null) {
      closeSync(descriptor);
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

/**
 * Select the first legacy object field from Python SQLite and JSON fallback data.
 *
 * @param primary Preferred Python settings object.
 * @param fallback Legacy settings JSON object.
 * @param property Settings field to locate.
 * @returns First matching object field or null.
 */
function selectLegacyRecordField(
  primary: Record<string, unknown> | null,
  fallback: Record<string, unknown> | null,
  property: string,
): Record<string, unknown> | null {
  if (isRecord(primary?.[property])) {
    return primary[property];
  }
  if (isRecord(fallback?.[property])) {
    return fallback[property];
  }
  return null;
}

/**
 * Open the Desktop Core settings database and perform idempotent legacy imports.
 *
 * @param options User-data paths and optional diagnostics sink.
 * @returns Ready application settings service.
 */
export function bootstrapApplicationSettings(
  options: BootstrapApplicationSettingsOptions,
): ApplicationSettingsService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const databasePath = options.databasePath ?? path.join(userDataDirectory, "desktop-core.db");
  const legacyDatabasePath = options.legacyDatabasePath
    ?? path.join(userDataDirectory, "super_agent_party.db");
  const legacySettingsPath = options.legacySettingsPath
    ?? path.join(userDataDirectory, "settings.json");
  const legacyConfigPath = options.legacyConfigPath
    ?? path.join(userDataDirectory, "config.json");
  const logger = options.logger ?? console;
  const store = new ApplicationStore({ databasePath });

  const pythonSettings = readLegacyPythonSettings(legacyDatabasePath, logger);
  const jsonSettings = readLegacyJsonRecord(legacySettingsPath, logger);
  const legacyConfig = readLegacyJsonRecord(legacyConfigPath, logger);

  if (store.getDocument(APPLICATION_DOCUMENT_KEYS.systemSettings) === null) {
    const systemSettings = selectLegacyRecordField(
      pythonSettings,
      jsonSettings,
      "systemSettings",
    );
    if (systemSettings !== null) {
      store.setDocument(
        APPLICATION_DOCUMENT_KEYS.systemSettings,
        normalizeSystemSettings(systemSettings),
      );
    }
  }

  if (store.getDocument(APPLICATION_DOCUMENT_KEYS.runtimeSettings) === null) {
    const pythonChromeSettings = selectLegacyRecordField(
      pythonSettings,
      jsonSettings,
      "chromeMCPSettings",
    );
    const configHasRuntime = legacyConfig !== null
      && (legacyConfig.chromeMCPSettings !== undefined || legacyConfig.networkVisible !== undefined);
    if (configHasRuntime || pythonChromeSettings !== null) {
      store.setDocument(
        APPLICATION_DOCUMENT_KEYS.runtimeSettings,
        normalizeRuntimeSettings({
          chromeMCPSettings: legacyConfig?.chromeMCPSettings ?? pythonChromeSettings,
          networkVisible: legacyConfig?.networkVisible,
        }),
      );
    }
  }

  return new ApplicationSettingsService(
    store,
    legacySettingsPath,
    legacyConfigPath,
    logger,
  );
}
