import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Maximum serialized document size accepted by the Core database. */
export const MAX_APPLICATION_DOCUMENT_BYTES = 1024 * 1024;

/** Shared filename for the migration-managed Desktop Core database. */
export const APPLICATION_DATABASE_FILENAME = "desktop-core.db";

/** Current schema version of the application-owned SQLite database. */
export const APPLICATION_STORE_SCHEMA_VERSION = 3;

/** Options used to open the application database. */
export interface ApplicationStoreOptions {
  readonly databasePath: string;
  readonly now?: () => Date;
}

/** Versioned JSON document returned by the application store. */
export interface ApplicationDocument<T> {
  readonly key: string;
  readonly revision: number;
  readonly value: T;
  readonly updatedAt: string;
}

interface ApplicationDocumentRow {
  readonly document_key: string;
  readonly revision: number;
  readonly payload: string;
  readonly updated_at: string;
}

interface SchemaVersionRow {
  readonly version: number;
}

/** Stable conflict raised when an optimistic document write is stale. */
export class ApplicationDocumentConflictError extends Error {
  /**
   * Create a document revision conflict.
   *
   * @param key Conflicting document key.
   */
  public constructor(public readonly key: string) {
    super(`Application document '${key}' has changed.`);
    this.name = "ApplicationDocumentConflictError";
  }
}

/** Migration-managed SQLite document store owned by Desktop Core. */
export class ApplicationStore {
  private readonly database: DatabaseSync;
  private readonly now: () => Date;
  private closed = false;

  /**
   * Open the database, configure defensive pragmas, and apply schema migrations.
   *
   * @param options Database path and optional deterministic clock.
   */
  public constructor(options: ApplicationStoreOptions) {
    mkdirSync(path.dirname(path.resolve(options.databasePath)), { recursive: true });
    this.now = options.now ?? (() => new Date());
    this.database = new DatabaseSync(path.resolve(options.databasePath));
    this.configureDatabase();
    this.applyMigrations();
  }

  /**
   * Return the current application database schema version.
   *
   * @returns Highest applied schema migration.
   */
  public getSchemaVersion(): number {
    this.assertOpen();
    const row = this.database
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
      .get() as unknown as SchemaVersionRow;
    return Number(row.version);
  }

  /**
   * Read and parse one versioned JSON document.
   *
   * @param key Stable document key.
   * @returns Stored document or null when it has never been written.
   */
  public getDocument<T>(key: string): ApplicationDocument<T> | null {
    this.assertOpen();
    const normalizedKey = this.validateKey(key);
    const row = this.database
      .prepare(
        "SELECT document_key, revision, payload, updated_at FROM application_documents WHERE document_key = ?",
      )
      .get(normalizedKey) as unknown as ApplicationDocumentRow | undefined;
    if (row === undefined) {
      return null;
    }
    let value: T;
    try {
      value = JSON.parse(row.payload) as T;
    } catch {
      throw new Error(`Application document '${normalizedKey}' contains invalid JSON.`);
    }
    return {
      key: row.document_key,
      revision: Number(row.revision),
      value,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Atomically replace one JSON document and increment its revision.
   *
   * @param key Stable document key.
   * @param value JSON-serializable document value.
   * @param expectedRevision Optional optimistic revision precondition.
   * @returns Newly persisted document.
   */
  public setDocument<T>(
    key: string,
    value: T,
    expectedRevision?: number,
  ): ApplicationDocument<T> {
    this.assertOpen();
    const normalizedKey = this.validateKey(key);
    const payload = this.serializeDocument(value);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.getDocument<T>(normalizedKey);
      if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) {
        throw new ApplicationDocumentConflictError(normalizedKey);
      }
      const revision = (current?.revision ?? 0) + 1;
      const updatedAt = this.now().toISOString();
      this.database.prepare(`
        INSERT INTO application_documents (document_key, revision, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(document_key) DO UPDATE SET
          revision = excluded.revision,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `).run(normalizedKey, revision, payload, updatedAt);
      this.database.exec("COMMIT");
      return { key: normalizedKey, revision, value, updatedAt };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * Atomically delete one document with an optional optimistic revision check.
   *
   * @param key Stable document key.
   * @param expectedRevision Optional optimistic revision precondition.
   * @returns True when an existing document was deleted.
   */
  public deleteDocument(key: string, expectedRevision?: number): boolean {
    this.assertOpen();
    const normalizedKey = this.validateKey(key);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.getDocument<unknown>(normalizedKey);
      if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) {
        throw new ApplicationDocumentConflictError(normalizedKey);
      }
      if (current === null) {
        this.database.exec("COMMIT");
        return false;
      }
      this.database
        .prepare("DELETE FROM application_documents WHERE document_key = ?")
        .run(normalizedKey);
      this.database.exec("COMMIT");
      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * Close the SQLite handle after application shutdown.
   */
  public close(): void {
    if (this.closed) {
      return;
    }
    this.database.close();
    this.closed = true;
  }

  /** Configure SQLite for bounded local desktop durability. */
  private configureDatabase(): void {
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA synchronous = NORMAL");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA trusted_schema = OFF");
    this.database.exec("PRAGMA busy_timeout = 5000");
  }

  /** Apply every missing schema migration in one exclusive transaction. */
  private applyMigrations(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT
    `);
    const currentVersion = this.getSchemaVersion();
    if (currentVersion > APPLICATION_STORE_SCHEMA_VERSION) {
      throw new Error(
        `Application database schema ${currentVersion} is newer than supported schema ${APPLICATION_STORE_SCHEMA_VERSION}.`,
      );
    }
    if (currentVersion >= APPLICATION_STORE_SCHEMA_VERSION) {
      return;
    }
    this.database.exec("BEGIN EXCLUSIVE");
    try {
      if (currentVersion < 1) {
        this.database.exec(`
          CREATE TABLE application_documents (
            document_key TEXT PRIMARY KEY,
            revision INTEGER NOT NULL CHECK (revision >= 1),
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
          ) STRICT
        `);
        this.database.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        ).run(1, "create-application-documents", this.now().toISOString());
      }
      if (currentVersion < 2) {
        this.database.exec(`
          CREATE TABLE application_artifacts (
            artifact_id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL CHECK (revision >= 1),
            storage_name TEXT NOT NULL UNIQUE,
            original_name TEXT NOT NULL,
            media_kind TEXT NOT NULL CHECK (media_kind IN ('document', 'image', 'video')),
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
            sha256 TEXT,
            status TEXT NOT NULL CHECK (status IN ('available', 'missing', 'deleted')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
          ) STRICT;
          CREATE INDEX application_artifacts_kind_status_idx
            ON application_artifacts (media_kind, status, created_at DESC);
        `);
        this.database.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        ).run(2, "create-application-artifacts", this.now().toISOString());
      }
      if (currentVersion < 3) {
        this.database.exec(`
          CREATE TABLE application_tasks (
            task_id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL CHECK (revision >= 1),
            legacy_task_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            workspace_path TEXT NOT NULL,
            parent_task_id TEXT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
            progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
            priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')),
            agent_type TEXT NOT NULL,
            schedule_type TEXT NOT NULL CHECK (schedule_type IN ('manual', 'once', 'recurring')),
            schedule_expression TEXT NOT NULL,
            next_run_at TEXT,
            result_summary TEXT NOT NULL,
            error_message TEXT NOT NULL,
            details_json TEXT NOT NULL,
            source TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            deleted_at TEXT,
            UNIQUE (workspace_id, legacy_task_id)
          ) STRICT;
          CREATE INDEX application_tasks_workspace_status_idx
            ON application_tasks (workspace_id, status, updated_at DESC);
          CREATE TABLE application_task_artifacts (
            task_id TEXT NOT NULL REFERENCES application_tasks(task_id) ON DELETE CASCADE,
            artifact_id TEXT NOT NULL REFERENCES application_artifacts(artifact_id) ON DELETE RESTRICT,
            relation TEXT NOT NULL CHECK (relation IN ('input', 'output')),
            label TEXT NOT NULL,
            ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
            PRIMARY KEY (task_id, artifact_id, relation)
          ) STRICT;
          CREATE INDEX application_task_artifacts_artifact_idx
            ON application_task_artifacts (artifact_id, relation);
          CREATE TABLE application_task_events (
            event_id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES application_tasks(task_id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL CHECK (sequence >= 1),
            event_type TEXT NOT NULL,
            previous_status TEXT,
            next_status TEXT,
            progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE (task_id, sequence)
          ) STRICT;
          CREATE INDEX application_task_events_task_idx
            ON application_task_events (task_id, sequence DESC);
        `);
        this.database.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        ).run(3, "create-application-tasks", this.now().toISOString());
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** Reject operations after the database handle has closed. */
  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Application store is closed.");
    }
  }

  /**
   * Validate a bounded document key before using it in SQL.
   *
   * @param key Candidate document key.
   * @returns Validated key.
   */
  private validateKey(key: string): string {
    if (!/^[a-z][a-z0-9-]{0,127}$/.test(key)) {
      throw new Error("Application document key is invalid.");
    }
    return key;
  }

  /**
   * Serialize a document while enforcing the database payload budget.
   *
   * @param value Candidate JSON value.
   * @returns Serialized JSON text.
   */
  private serializeDocument(value: unknown): string {
    let payload: string | undefined;
    try {
      payload = JSON.stringify(value);
    } catch {
      throw new Error("Application document must be JSON serializable.");
    }
    if (payload === undefined || Buffer.byteLength(payload, "utf8") > MAX_APPLICATION_DOCUMENT_BYTES) {
      throw new Error("Application document exceeds the storage budget.");
    }
    return payload;
  }
}
