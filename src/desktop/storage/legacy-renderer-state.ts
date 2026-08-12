import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  LEGACY_RENDERER_STATE_CHANGED_SCHEMA,
  LEGACY_RENDERER_STATE_SCHEMA,
  type LegacyRendererStateChangedEvent,
  type LegacyRendererStateChangedListener,
  type LegacyRendererStateSnapshot,
} from "../contracts/legacy-renderer-state";

const MAX_SETTINGS_BYTES = 16 * 1024 * 1024;
const MAX_CONVERSATIONS_BYTES = 32 * 1024 * 1024;
const MAX_CONVERSATION_COUNT = 10_000;

interface LegacyRendererStateRow {
  readonly data: unknown;
}

/** Optional diagnostics sink for malformed compatibility state. */
export interface LegacyRendererStateLogger {
  warn(message: string, error?: unknown): void;
}

/** Paths and diagnostics required by the compatibility state bridge. */
export interface LegacyRendererStateServiceOptions {
  readonly userDataDirectory: string;
  readonly settingsDatabasePath?: string;
  readonly conversationsDatabasePath?: string;
  readonly logger?: LegacyRendererStateLogger;
  readonly now?: () => Date;
  readonly normalizeSettings?: (
    settings: Readonly<Record<string, unknown>>,
    operation: "read" | "write",
  ) => {
    readonly settings: Readonly<Record<string, unknown>>;
    readonly persistSanitized: boolean;
  };
}

/**
 * Read and update legacy Renderer state without activating the Python backend.
 */
export class LegacyRendererStateService {
  private readonly settingsDatabasePath: string;
  private readonly conversationsDatabasePath: string;
  private readonly logger: LegacyRendererStateLogger;
  private readonly now: () => Date;
  private readonly normalizeSettings: NonNullable<LegacyRendererStateServiceOptions["normalizeSettings"]>;
  private readonly listeners = new Set<LegacyRendererStateChangedListener>();
  private settingsRevision = 0;
  private conversationsRevision = 0;

  /** Create one compatibility bridge over the existing Python SQLite files. */
  public constructor(options: LegacyRendererStateServiceOptions) {
    const userDataDirectory = path.resolve(options.userDataDirectory);
    this.settingsDatabasePath = path.resolve(
      options.settingsDatabasePath ?? path.join(userDataDirectory, "super_agent_party.db"),
    );
    this.conversationsDatabasePath = path.resolve(
      options.conversationsDatabasePath ?? path.join(userDataDirectory, "conversations.db"),
    );
    this.logger = options.logger ?? console;
    this.now = options.now ?? (() => new Date());
    this.normalizeSettings = options.normalizeSettings ?? ((settings) => ({
      settings,
      persistSanitized: false,
    }));
  }

  /** Read one bounded compatibility snapshot without creating missing databases. */
  public getSnapshot(): LegacyRendererStateSnapshot {
    const settingsDocument = this.readRecord(this.settingsDatabasePath, MAX_SETTINGS_BYTES, "settings");
    const conversationDocument = this.readRecord(
      this.conversationsDatabasePath,
      MAX_CONVERSATIONS_BYTES,
      "conversations",
    );
    const normalizedSettings = this.normalizeSettings(settingsDocument, "read");
    if (normalizedSettings.persistSanitized && existsSync(this.settingsDatabasePath)) {
      this.writeRecord(this.settingsDatabasePath, normalizedSettings.settings);
    }
    const storedConversations = normalizeConversations(conversationDocument.conversations);
    const embeddedConversations = normalizeConversations(normalizedSettings.settings.conversations);
    const conversations = storedConversations.length > 0 ? storedConversations : embeddedConversations;
    const { conversations: _embeddedConversations, ...settings } = normalizedSettings.settings;
    return this.createSnapshot(settings, conversations);
  }

  /** Persist one exact bounded legacy settings replacement. */
  public saveSettings(value: unknown): LegacyRendererStateSnapshot {
    const request = requireExactRecord(value, ["settings"], "settings request");
    const settings = cloneBoundedRecord(request.settings, "settings", MAX_SETTINGS_BYTES);
    const normalized = this.normalizeSettings(settings, "write");
    this.writeRecord(this.settingsDatabasePath, normalized.settings);
    this.settingsRevision += 1;
    return this.publish("settings");
  }

  /** Persist one exact bounded legacy conversations replacement. */
  public saveConversations(value: unknown): LegacyRendererStateSnapshot {
    const request = requireExactRecord(value, ["conversations"], "conversations request");
    const conversations = cloneBoundedConversations(request.conversations);
    this.writeRecord(this.conversationsDatabasePath, { conversations });
    this.conversationsRevision += 1;
    return this.publish("conversations");
  }

  /** Update only VRMConfig while preserving all other compatibility settings. */
  public saveVrmConfig(value: unknown): LegacyRendererStateSnapshot {
    const request = requireExactRecord(value, ["vrmConfig"], "VRM request");
    const vrmConfig = cloneBoundedRecord(request.vrmConfig, "vrmConfig", MAX_SETTINGS_BYTES);
    const storedSettings = this.readRecord(this.settingsDatabasePath, MAX_SETTINGS_BYTES, "settings");
    const settings = this.normalizeSettings(storedSettings, "write").settings;
    const nextSettings = cloneBoundedRecord(
      { ...settings, VRMConfig: vrmConfig },
      "settings",
      MAX_SETTINGS_BYTES,
    );
    this.writeRecord(this.settingsDatabasePath, nextSettings);
    this.settingsRevision += 1;
    return this.publish("settings");
  }

  /** Subscribe to state changes produced through this Main-owned bridge. */
  public subscribe(listener: LegacyRendererStateChangedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Build one immutable snapshot from already normalized compatibility values. */
  private createSnapshot(
    settings: Readonly<Record<string, unknown>>,
    conversations: readonly Readonly<Record<string, unknown>>[],
  ): LegacyRendererStateSnapshot {
    return {
      schema: LEGACY_RENDERER_STATE_SCHEMA,
      settingsRevision: this.settingsRevision,
      conversationsRevision: this.conversationsRevision,
      generatedAt: this.now().toISOString(),
      settings,
      conversations,
    };
  }

  /** Publish one state change after rebuilding the authoritative compatibility snapshot. */
  private publish(domain: LegacyRendererStateChangedEvent["domain"]): LegacyRendererStateSnapshot {
    const snapshot = this.getSnapshot();
    const event: LegacyRendererStateChangedEvent = {
      schema: LEGACY_RENDERER_STATE_CHANGED_SCHEMA,
      domain,
      snapshot,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Observer failures cannot roll back an already committed SQLite write.
      }
    }
    return snapshot;
  }

  /** Read one JSON object from the legacy single-row settings table. */
  private readRecord(databasePath: string, maximumBytes: number, label: string): Record<string, unknown> {
    if (!existsSync(databasePath)) return {};
    let database: DatabaseSync | null = null;
    try {
      if (statSync(databasePath).size > maximumBytes * 4) {
        throw new Error(`Legacy ${label} database exceeds its file budget.`);
      }
      database = new DatabaseSync(databasePath, { readOnly: true, timeout: 5_000 });
      const table = database.prepare(
        "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
      ).get();
      if (table === undefined) return {};
      const row = database.prepare("SELECT data FROM settings WHERE id = 1").get() as
        | LegacyRendererStateRow
        | undefined;
      if (row === undefined || typeof row.data !== "string") return {};
      return parseBoundedRecord(row.data, label, maximumBytes);
    } catch (error) {
      this.logger.warn(`Ignored invalid legacy ${label} state.`, error);
      return {};
    } finally {
      database?.close();
    }
  }

  /** Atomically replace one legacy single-row JSON document. */
  private writeRecord(databasePath: string, value: Readonly<Record<string, unknown>>): void {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    const serialized = JSON.stringify(value, null, 2);
    const database = new DatabaseSync(databasePath, { timeout: 5_000 });
    try {
      database.exec("PRAGMA secure_delete = ON");
      database.exec("BEGIN IMMEDIATE");
      database.exec("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
      database.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(serialized);
      database.exec("COMMIT");
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // The original write error remains authoritative.
      }
      throw error;
    } finally {
      database.close();
    }
  }
}

/** Require a plain record containing every and only the allowed fields. */
function requireExactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Legacy Renderer ${label} must be an object.`);
  }
  const record = value as Readonly<Record<string, unknown>>;
  const actualKeys = Object.keys(record);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    throw new TypeError(`Legacy Renderer ${label} fields are invalid.`);
  }
  return record;
}

/** Clone one JSON record after enforcing its serialized byte budget. */
function cloneBoundedRecord(value: unknown, label: string, maximumBytes: number): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Legacy Renderer ${label} must be an object.`);
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`Legacy Renderer ${label} must be JSON serializable.`, { cause: error });
  }
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new TypeError(`Legacy Renderer ${label} exceeds its byte budget.`);
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

/** Parse one bounded database JSON object. */
function parseBoundedRecord(serialized: string, label: string, maximumBytes: number): Record<string, unknown> {
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new TypeError(`Legacy Renderer ${label} exceeds its byte budget.`);
  }
  return cloneBoundedRecord(JSON.parse(serialized) as unknown, label, maximumBytes);
}

/** Clone and bound one conversations array received from Renderer. */
function cloneBoundedConversations(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || value.length > MAX_CONVERSATION_COUNT) {
    throw new TypeError("Legacy Renderer conversations are invalid.");
  }
  const document = cloneBoundedRecord({ conversations: value }, "conversations", MAX_CONVERSATIONS_BYTES);
  return normalizeConversations(document.conversations);
}

/** Normalize a stored conversations field without accepting non-record items. */
function normalizeConversations(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || value.length > MAX_CONVERSATION_COUNT) return [];
  return value.filter((item): item is Readonly<Record<string, unknown>> => (
    typeof item === "object" && item !== null && !Array.isArray(item)
  ));
}
