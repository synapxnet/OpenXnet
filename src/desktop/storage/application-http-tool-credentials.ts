import { createHash } from "node:crypto";
import path from "node:path";

import {
  APPLICATION_HTTP_TOOL_CREDENTIAL_SCHEMA,
  createApplicationHttpToolCredentialConfigured,
  parseApplicationHttpToolCredentials,
  parseSaveApplicationHttpToolCredentialsRequest,
  type ApplicationHttpToolCredentials,
  type ApplicationHttpToolCredentialSnapshot,
} from "../contracts/application-http-tool-credentials";
import {
  MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT,
  isApplicationToolCredentialPlaceholder,
  isSensitiveApplicationToolHeaderName,
  isToolCredentialRecord,
  parseApplicationToolCredentialHeaderName,
  parseApplicationToolCredentialScope,
  parseApplicationToolCredentialSecret,
} from "../contracts/application-tool-credential-common";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageHttpToolCredentialStore,
  type ApplicationHttpToolCredentialStore,
} from "./safe-storage-http-tool-credential-store";

/** Filename containing only OS-encrypted custom HTTP tool credentials. */
export const APPLICATION_HTTP_TOOL_CREDENTIAL_FILENAME = "http-tool-credentials.bin";

/** Maximum decoded custom HTTP credential bootstrap passed to trusted runtimes. */
export const MAX_HTTP_TOOL_RUNTIME_BOOTSTRAP_BYTES = 2 * 1024 * 1024;

/** Diagnostics sink used without ever logging custom HTTP credential values. */
export interface ApplicationHttpToolCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one custom HTTP credential service. */
export interface ApplicationHttpToolCredentialServiceOptions {
  readonly credentials: ApplicationHttpToolCredentialStore;
  readonly logger?: ApplicationHttpToolCredentialLogger;
}

/** Paths and OS encryption required to bootstrap custom HTTP credential ownership. */
export interface BootstrapApplicationHttpToolCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationHttpToolCredentialLogger;
}

/** Result of removing custom HTTP credentials from one legacy settings document. */
export interface ReconciledLegacyHttpToolCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted custom HTTP credentials change. */
export type ApplicationHttpToolCredentialChangedListener = (
  snapshot: ApplicationHttpToolCredentialSnapshot,
) => void;

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Create one deterministic stable ID for a legacy custom HTTP tool. */
function createLegacyHttpToolId(tool: Record<string, unknown>, index: number): string {
  const source = JSON.stringify([
    index,
    typeof tool.name === "string" ? tool.name : "",
    typeof tool.url === "string" ? tool.url : "",
  ]);
  return `legacy-http-${createHash("sha256").update(source).digest("hex").slice(0, 20)}`;
}

/** Parse one legacy custom HTTP headers field into a plain object. */
function parseLegacyHttpHeaders(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null || value === "") return {};
  if (isToolCredentialRecord(value)) return cloneJson(value);
  if (typeof value !== "string") throw new TypeError("Legacy custom HTTP headers are invalid.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("Legacy custom HTTP headers are invalid.");
  }
  if (!isToolCredentialRecord(parsed)) {
    throw new TypeError("Legacy custom HTTP headers are invalid.");
  }
  return parsed;
}

/** Main-owned boundary for custom HTTP authorization headers. */
export class ApplicationHttpToolCredentialService {
  private readonly logger: ApplicationHttpToolCredentialLogger;
  private readonly listeners = new Set<ApplicationHttpToolCredentialChangedListener>();
  private closed = false;

  /** Create a custom HTTP credential boundary over one initialized encrypted store. */
  public constructor(private readonly options: ApplicationHttpToolCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured header names without returning any credential value. */
  public getSnapshot(): ApplicationHttpToolCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_HTTP_TOOL_CREDENTIAL_SCHEMA,
      configured: createApplicationHttpToolCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact custom HTTP credential update and explicit clear list. */
  public save(value: unknown): ApplicationHttpToolCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationHttpToolCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system custom HTTP credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, Record<string, string>>;
    for (const [toolId, headers] of Object.entries(request.credentials || {})) {
      credentials[toolId] = { ...(credentials[toolId] || {}), ...headers };
    }
    for (const entry of request.clear || []) {
      if (entry.all) {
        delete credentials[entry.toolId];
        continue;
      }
      for (const name of entry.headers || []) delete credentials[entry.toolId]?.[name];
      if (Object.keys(credentials[entry.toolId] || {}).length === 0) delete credentials[entry.toolId];
    }
    const normalized = parseApplicationHttpToolCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy custom HTTP sensitive headers and return redacted settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration and pruning behavior for trusted writes.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: {
      readonly requireSecureCapture?: boolean;
      readonly pruneMissingScopes?: boolean;
    } = {},
  ): ReconciledLegacyHttpToolCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const tools = Array.isArray(settings.custom_http) ? settings.custom_http : null;
    if (tools === null) return { settings, persistSanitized: false };

    const captured: Record<string, Record<string, string>> = {};
    const active = new Map<string, Set<string>>();
    let containsInvalidSecret = tools.length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT;
    tools.forEach((rawTool, index) => {
      if (!isToolCredentialRecord(rawTool)) return;
      let toolId: string;
      try {
        toolId = parseApplicationToolCredentialScope(rawTool.id, "Custom HTTP");
      } catch {
        toolId = createLegacyHttpToolId(rawTool, index);
        rawTool.id = toolId;
      }
      let headers: Record<string, unknown>;
      try {
        headers = parseLegacyHttpHeaders(rawTool.headers);
      } catch {
        containsInvalidSecret = true;
        rawTool.headers = "";
        return;
      }
      const activeHeaders = new Set<string>();
      active.set(toolId, activeHeaders);
      const toolCredentials: Record<string, string> = {};
      for (const [rawName, rawSecret] of Object.entries(headers)) {
        if (!isSensitiveApplicationToolHeaderName(rawName)) continue;
        try {
          const name = parseApplicationToolCredentialHeaderName(rawName);
          activeHeaders.add(name);
          const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
          if (!secret || isApplicationToolCredentialPlaceholder(secret)) continue;
          toolCredentials[name] = parseApplicationToolCredentialSecret(rawSecret, {
            allowLineBreaks: false,
          });
        } catch {
          containsInvalidSecret = true;
        }
      }
      if (Object.keys(toolCredentials).length > 0) captured[toolId] = toolCredentials;
      rawTool.headers = JSON.stringify(headers, null, 2);
    });

    const containsSecrets = Object.keys(captured).length > 0;
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy custom HTTP credential entry is invalid.");
    }
    const previous = this.readCredentials(
      options.requireSecureCapture === true && (containsSecrets || options.pruneMissingScopes === true),
    );
    let credentials: ApplicationHttpToolCredentials = previous;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system custom HTTP credential encryption is unavailable.");
        }
      } else {
        const merged = cloneJson(previous) as Record<string, Record<string, string>>;
        for (const [toolId, headers] of Object.entries(captured)) {
          merged[toolId] = { ...(merged[toolId] || {}), ...headers };
        }
        credentials = parseApplicationHttpToolCredentials(merged);
        capturedSecurely = !containsInvalidSecret;
      }
    }
    if (capturedSecurely && options.pruneMissingScopes) {
      const pruned: Record<string, Record<string, string>> = {};
      for (const [toolId, names] of active) {
        const headers = Object.fromEntries(
          Object.entries(credentials[toolId] || {}).filter(([name]) => names.has(name)),
        );
        if (Object.keys(headers).length > 0) pruned[toolId] = headers;
      }
      credentials = parseApplicationHttpToolCredentials(pruned);
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }

    const configured = createApplicationHttpToolCredentialConfigured(credentials);
    for (const rawTool of tools) {
      if (!isToolCredentialRecord(rawTool) || typeof rawTool.id !== "string") continue;
      let headers: Record<string, unknown>;
      try {
        headers = parseLegacyHttpHeaders(rawTool.headers);
      } catch {
        headers = {};
      }
      for (const name of Object.keys(headers)) {
        if (isSensitiveApplicationToolHeaderName(name)) headers[name] = "";
      }
      rawTool.headers = JSON.stringify(headers, null, 2);
      rawTool.headerCredentialsConfigured = configured[rawTool.id] || [];
    }
    settings.custom_http = tools;
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for trusted HTTP tool runtimes. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.http-tool-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_HTTP_TOOL_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Custom HTTP credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed custom HTTP credential changes. */
  public subscribe(listener: ApplicationHttpToolCredentialChangedListener): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Close the service and discard runtime observers. */
  public close(): void {
    if (this.closed) return;
    this.listeners.clear();
    this.closed = true;
  }

  /** Notify observers after one encrypted custom HTTP credential change. */
  private publish(snapshot: ApplicationHttpToolCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationHttpToolCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted custom HTTP credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted custom HTTP credential sidecar. */
  private writeCredentials(credentials: ApplicationHttpToolCredentials): void {
    if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject custom HTTP credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application custom HTTP credential service is closed.");
  }
}

/** Bootstrap the independent custom HTTP credential safeStorage boundary. */
export function bootstrapApplicationHttpToolCredentials(
  options: BootstrapApplicationHttpToolCredentialsOptions,
): ApplicationHttpToolCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageHttpToolCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_HTTP_TOOL_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationHttpToolCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
