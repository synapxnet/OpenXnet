import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  APPLICATION_DELIVERY_CREDENTIAL_SCHEMA,
  createApplicationDeliveryCredentialConfigured,
  createApplicationDeliveryCredentialScopeId,
  parseApplicationDeliveryCredentialHeaderName,
  parseApplicationDeliveryCredentialScope,
  parseApplicationDeliveryCredentialSecret,
  parseApplicationDeliveryCredentialUrl,
  parseApplicationDeliveryCredentialValues,
  parseApplicationDeliveryCredentials,
  parseSaveApplicationDeliveryCredentialsRequest,
  type ApplicationDeliveryCredentialEntry,
  type ApplicationDeliveryCredentialScope,
  type ApplicationDeliveryCredentials,
  type ApplicationDeliveryCredentialSnapshot,
  type ApplicationDeliveryCredentialTarget,
  type ApplicationDeliveryCredentialValues,
} from "../contracts/application-delivery-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageDeliveryCredentialStore,
  type ApplicationDeliveryCredentialStore,
} from "./safe-storage-delivery-credential-store";

/** Filename containing only OS-encrypted task terminal-delivery credentials. */
export const APPLICATION_DELIVERY_CREDENTIAL_FILENAME = "delivery-credentials.bin";

/** Maximum decoded request-scoped credential bootstrap sent to Execution Engine. */
export const MAX_DELIVERY_REQUEST_BOOTSTRAP_BYTES = 256 * 1024;

/** Maximum legacy task file inspected during one-time credential migration. */
export const MAX_LEGACY_DELIVERY_TASK_FILE_BYTES = 1024 * 1024;

/** Maximum legacy task files inspected in one workspace migration. */
export const MAX_LEGACY_DELIVERY_TASK_FILES = 2_000;

/** Diagnostics sink used without ever logging terminal-delivery credential values. */
export interface ApplicationDeliveryCredentialLogger {
  warn(message: string): void;
}

/** Dependencies used to create one terminal-delivery credential service. */
export interface ApplicationDeliveryCredentialServiceOptions {
  readonly credentials: ApplicationDeliveryCredentialStore;
  readonly logger?: ApplicationDeliveryCredentialLogger;
}

/** Paths and OS encryption required to bootstrap delivery credential ownership. */
export interface BootstrapApplicationDeliveryCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationDeliveryCredentialLogger;
}

/** Result of removing credentials from one task details document. */
export interface ReconciledTaskDeliveryCredentialDetails {
  readonly details: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted delivery credentials change. */
export type ApplicationDeliveryCredentialChangedListener = (
  snapshot: ApplicationDeliveryCredentialSnapshot,
) => void;

interface MutableDeliveryCredentialValues {
  url?: string;
  webhook_url?: string;
  headers?: Record<string, string>;
}

interface DeliveryRecordReference {
  readonly target: ApplicationDeliveryCredentialTarget;
  readonly record: Record<string, unknown>;
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Return whether one value is absent rather than an attempted secret. */
function isEmptySecret(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

/** Return one platform-stable absolute workspace identity for scope comparisons. */
function createWorkspaceFingerprint(workspacePath: string): string {
  const resolved = path.resolve(workspacePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Main-owned boundary for task-scoped terminal-delivery credentials. */
export class ApplicationDeliveryCredentialService {
  private readonly logger: ApplicationDeliveryCredentialLogger;
  private readonly listeners = new Set<ApplicationDeliveryCredentialChangedListener>();
  private readonly migratedWorkspaces = new Set<string>();
  private closed = false;

  /** Create a terminal-delivery credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationDeliveryCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured scope metadata without returning terminal-delivery secrets. */
  public getSnapshot(): ApplicationDeliveryCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_DELIVERY_CREDENTIAL_SCHEMA,
      configured: createApplicationDeliveryCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Replace or explicitly clear one exact compound delivery credential scope. */
  public save(value: unknown): ApplicationDeliveryCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationDeliveryCredentialsRequest(value);
    if (!this.options.credentials.isAvailable()) {
      throw new Error("Operating-system delivery credential encryption is unavailable.");
    }
    const previous = this.readCredentials(true);
    const entries = cloneJson(previous) as Record<string, ApplicationDeliveryCredentialEntry>;
    const scopeId = createApplicationDeliveryCredentialScopeId(request.scope);
    if (request.clear === true) delete entries[scopeId];
    else entries[scopeId] = { scope: request.scope, credentials: request.credentials ?? {} };
    const normalized = parseApplicationDeliveryCredentials(entries);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /** Remove every credential associated with one workspace-scoped task. */
  public clearTask(workspacePath: string, taskId: string): void {
    this.assertOpen();
    if (!this.options.credentials.isAvailable()) return;
    const workspaceFingerprint = createWorkspaceFingerprint(workspacePath);
    const previous = this.readCredentials();
    const entries = Object.fromEntries(Object.entries(previous).filter(([, entry]) => (
      createWorkspaceFingerprint(entry.scope.workspacePath) !== workspaceFingerprint
      || entry.scope.taskId !== taskId
    )));
    if (Object.keys(entries).length === Object.keys(previous).length) return;
    this.writeCredentials(parseApplicationDeliveryCredentials(entries));
    this.publish(this.getSnapshot());
  }

  /** Capture inline task delivery credentials and return a configured-only details document. */
  public reconcileTaskDetails(
    workspacePath: string,
    taskId: string,
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledTaskDeliveryCredentialDetails {
    this.assertOpen();
    const details = cloneJson(value) as Record<string, unknown>;
    const references = this.collectDeliveryRecordReferences(details);
    if (references.length === 0) return { details, persistSanitized: false };
    const previous = this.readCredentials(options.requireSecureCapture === true);
    const entries = cloneJson(previous) as Record<string, ApplicationDeliveryCredentialEntry>;
    let containsInvalidSecret = false;
    let foundSecret = false;

    for (const target of ["webhook", "discord"] as const) {
      const scope = parseApplicationDeliveryCredentialScope({ workspacePath, taskId, target });
      const scopeId = createApplicationDeliveryCredentialScopeId(scope);
      const current = entries[scopeId]?.credentials ?? {};
      const candidate: MutableDeliveryCredentialValues = cloneJson(current);
      for (const reference of references.filter((item) => item.target === target)) {
        const extracted = this.extractInlineCredentials(reference.record, target);
        containsInvalidSecret ||= extracted.invalid;
        foundSecret ||= extracted.found;
        try {
          this.mergeCredentialCandidate(candidate, extracted.credentials);
        } catch {
          containsInvalidSecret = true;
        }
      }
      if (Object.keys(candidate).length > 0) {
        try {
          const credentials = this.normalizeCandidate(candidate, target);
          entries[scopeId] = { scope, credentials };
        } catch {
          containsInvalidSecret = true;
        }
      }
    }

    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Task delivery credential entry is invalid.");
    }
    let capturedSecurely = !foundSecret && !containsInvalidSecret;
    const normalizedEntries = parseApplicationDeliveryCredentials(entries);
    const credentialChanged = JSON.stringify(previous) !== JSON.stringify(normalizedEntries);
    if (foundSecret && !containsInvalidSecret) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system delivery credential encryption is unavailable.");
        }
      } else {
        capturedSecurely = true;
      }
    }
    if (capturedSecurely && credentialChanged) {
      this.writeCredentials(normalizedEntries);
      this.publish(this.getSnapshot());
    }
    const activeEntries = capturedSecurely ? normalizedEntries : previous;
    for (const reference of references) {
      const scope = parseApplicationDeliveryCredentialScope({
        workspacePath,
        taskId,
        target: reference.target,
      });
      const entry = activeEntries[createApplicationDeliveryCredentialScopeId(scope)];
      this.redactInlineRecord(reference.record, reference.target, entry?.credentials ?? {});
    }
    const sanitized = JSON.stringify(details) !== JSON.stringify(value);
    return { details, persistSanitized: capturedSecurely && sanitized };
  }

  /** Migrate bounded legacy task files below the workspace selected in settings. */
  public migrateLegacyWorkspaceTasksFromSettings(settings: Readonly<Record<string, unknown>>): number {
    this.assertOpen();
    const cli = isRecord(settings.CLISettings) ? settings.CLISettings : {};
    const rawWorkspace = typeof cli.cc_path === "string" ? cli.cc_path.trim() : "";
    if (!rawWorkspace) return 0;
    let workspacePath: string;
    try {
      workspacePath = realpathSync.native(path.resolve(rawWorkspace));
    } catch {
      return 0;
    }
    const fingerprint = createWorkspaceFingerprint(workspacePath);
    if (this.migratedWorkspaces.has(fingerprint)) return 0;
    if (!this.options.credentials.isAvailable()) return 0;
    const taskDirectory = path.join(workspacePath, ".agent", "tasks");
    if (!existsSync(taskDirectory)) return 0;
    let migrated = 0;
    let scanSucceeded = true;
    let filenames: string[];
    try {
      const taskDirectoryStats = lstatSync(taskDirectory);
      const realTaskDirectory = realpathSync.native(taskDirectory);
      const workspacePrefix = `${createWorkspaceFingerprint(workspacePath)}${path.sep}`;
      if (
        !taskDirectoryStats.isDirectory()
        || taskDirectoryStats.isSymbolicLink()
        || !createWorkspaceFingerprint(realTaskDirectory).startsWith(workspacePrefix)
      ) {
        this.logger.warn("Legacy task delivery credential directory is outside the workspace.");
        return 0;
      }
      filenames = readdirSync(taskDirectory)
        .filter((name) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\.json$/.test(name))
        .slice(0, MAX_LEGACY_DELIVERY_TASK_FILES);
    } catch {
      this.logger.warn("Legacy task delivery credential directory could not be inspected.");
      return 0;
    }
    for (const filename of filenames) {
      const filePath = path.resolve(taskDirectory, filename);
      try {
        const stats = lstatSync(filePath);
        if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_LEGACY_DELIVERY_TASK_FILE_BYTES) {
          continue;
        }
        const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
        if (!isRecord(value)) continue;
        const taskId = typeof value.task_id === "string"
          ? value.task_id
          : filename.slice(0, -".json".length);
        const result = this.reconcileTaskDetails(
          workspacePath,
          taskId,
          value,
          { requireSecureCapture: true },
        );
        if (!result.persistSanitized) continue;
        this.writeJsonAtomically(filePath, result.details);
        migrated += 1;
      } catch {
        scanSucceeded = false;
        this.logger.warn("One legacy task delivery credential file could not be migrated.");
      }
    }
    if (scanSucceeded) this.migratedWorkspaces.add(fingerprint);
    return migrated;
  }

  /** Build one bounded request-scoped bootstrap for an exact broker request. */
  public getRequestCredentialBootstrap(value: unknown): string {
    this.assertOpen();
    const scope = parseApplicationDeliveryCredentialScope(value);
    const entries = this.readCredentials();
    const entry = entries[createApplicationDeliveryCredentialScopeId(scope)];
    if (entry === undefined) return "";
    const serialized = JSON.stringify({
      schema: "openxnet.delivery-credentials.runtime.v1",
      scope: entry.scope,
      credentials: entry.credentials,
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_DELIVERY_REQUEST_BOOTSTRAP_BYTES) {
      throw new Error("Delivery credential request bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed terminal-delivery credential changes. */
  public subscribe(listener: ApplicationDeliveryCredentialChangedListener): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Close the service and discard runtime observers. */
  public close(): void {
    if (this.closed) return;
    this.listeners.clear();
    this.migratedWorkspaces.clear();
    this.closed = true;
  }

  /** Collect mutable webhook and Discord record references from both compatibility shapes. */
  private collectDeliveryRecordReferences(details: Record<string, unknown>): DeliveryRecordReference[] {
    const references: DeliveryRecordReference[] = [];
    const containers = [details.delivery_records];
    if (isRecord(details.context)) containers.push(details.context.delivery_records);
    for (const container of containers) {
      const records: Array<{ readonly inferredTarget: string; readonly value: unknown }> =
        Array.isArray(container)
          ? container.map((value) => ({ inferredTarget: "", value }))
          : isRecord(container)
            ? Object.entries(container).map(([inferredTarget, value]) => ({ inferredTarget, value }))
            : [];
      for (const { inferredTarget, value: rawRecord } of records) {
        if (!isRecord(rawRecord)) continue;
        const target = String(rawRecord.target ?? inferredTarget).trim().toLowerCase();
        if (target === "webhook" || target === "discord") {
          rawRecord.target = target;
          references.push({ target, record: rawRecord });
        }
      }
    }
    return references;
  }

  /** Extract one inline credential candidate without reflecting invalid values. */
  private extractInlineCredentials(
    record: Record<string, unknown>,
    target: ApplicationDeliveryCredentialTarget,
  ): { readonly credentials: MutableDeliveryCredentialValues; readonly found: boolean; readonly invalid: boolean } {
    const config = isRecord(record.config) ? record.config : {};
    const credentials: MutableDeliveryCredentialValues = {};
    let found = false;
    let invalid = record.config !== undefined && !isRecord(record.config);
    const scalarField = target === "webhook" ? "url" : "webhook_url";
    const scalarValue = config[scalarField];
    if (!isEmptySecret(scalarValue)) {
      found = true;
      try {
        credentials[scalarField] = parseApplicationDeliveryCredentialUrl(scalarValue);
      } catch {
        invalid = true;
      }
    }
    if (target === "webhook" && config.headers !== undefined) {
      if (!isRecord(config.headers)) {
        invalid ||= !isEmptySecret(config.headers);
      } else {
        const headers: Record<string, string> = {};
        for (const [rawName, rawSecret] of Object.entries(config.headers)) {
          if (isEmptySecret(rawSecret)) continue;
          found = true;
          try {
            const name = parseApplicationDeliveryCredentialHeaderName(rawName);
            headers[name] = parseApplicationDeliveryCredentialSecret(rawSecret);
          } catch {
            invalid = true;
          }
        }
        if (Object.keys(headers).length > 0) credentials.headers = headers;
      }
    }
    return { credentials, found, invalid };
  }

  /** Merge duplicate task-detail candidates while rejecting conflicting plaintext. */
  private mergeCredentialCandidate(
    destination: MutableDeliveryCredentialValues,
    source: MutableDeliveryCredentialValues,
  ): void {
    for (const field of ["url", "webhook_url"] as const) {
      if (source[field] === undefined) continue;
      if (destination[field] !== undefined && destination[field] !== source[field]) {
        throw new Error("Conflicting task delivery credentials are invalid.");
      }
      destination[field] = source[field];
    }
    if (source.headers !== undefined) {
      const headers = { ...(destination.headers ?? {}) };
      for (const [name, secret] of Object.entries(source.headers)) {
        if (headers[name] !== undefined && headers[name] !== secret) {
          throw new Error("Conflicting task delivery credentials are invalid.");
        }
        headers[name] = secret;
      }
      destination.headers = headers;
    }
  }

  /** Normalize one internal candidate through the strict storage parser. */
  private normalizeCandidate(
    candidate: MutableDeliveryCredentialValues,
    target: ApplicationDeliveryCredentialTarget,
  ): ApplicationDeliveryCredentialValues {
    return parseApplicationDeliveryCredentialValues(candidate, target);
  }

  /** Replace inline secret values with configured-only metadata. */
  private redactInlineRecord(
    record: Record<string, unknown>,
    target: ApplicationDeliveryCredentialTarget,
    credentials: ApplicationDeliveryCredentialValues,
  ): void {
    const config = isRecord(record.config) ? record.config : {};
    if (target === "webhook") {
      config.url = "";
      config.urlConfigured = Boolean(credentials.url);
      const configuredHeaders = Object.keys(credentials.headers ?? {}).sort();
      config.headers = Object.fromEntries(configuredHeaders.map((name) => [name, ""]));
      config.headerCredentialsConfigured = configuredHeaders;
    } else {
      config.webhook_url = "";
      config.webhookUrlConfigured = Boolean(credentials.webhook_url);
    }
    record.config = config;
  }

  /** Write one UTF-8 JSON task file through a same-directory atomic replacement. */
  private writeJsonAtomically(filePath: string, value: Readonly<Record<string, unknown>>): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    let descriptor: number | null = null;
    try {
      descriptor = openSync(temporaryPath, "wx", 0o600);
      writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
      closeSync(descriptor);
      descriptor = null;
      renameSync(temporaryPath, filePath);
    } finally {
      if (descriptor !== null) closeSync(descriptor);
      rmSync(temporaryPath, { force: true });
    }
  }

  /** Notify observers after one encrypted delivery credential change. */
  private publish(snapshot: ApplicationDeliveryCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials while replacing storage details with a stable public error. */
  private readCredentials(strict = false): ApplicationDeliveryCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted delivery credentials could not be read.");
      this.logger.warn("Encrypted delivery credentials could not be read.");
      return {};
    }
  }

  /** Replace or clear the encrypted terminal-delivery credential sidecar. */
  private writeCredentials(credentials: ApplicationDeliveryCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted delivery credentials could not be written.");
    }
  }

  /** Reject delivery credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application delivery credential service is closed.");
  }
}

/** Bootstrap the independent terminal-delivery credential safeStorage boundary. */
export function bootstrapApplicationDeliveryCredentials(
  options: BootstrapApplicationDeliveryCredentialsOptions,
): ApplicationDeliveryCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageDeliveryCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_DELIVERY_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationDeliveryCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
