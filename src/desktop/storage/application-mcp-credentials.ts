import path from "node:path";

import {
  APPLICATION_MCP_CREDENTIAL_SCHEMA,
  createApplicationMcpCredentialConfigured,
  parseApplicationMcpCredentials,
  parseSaveApplicationMcpCredentialsRequest,
  type ApplicationMcpCredentials,
  type ApplicationMcpCredentialSnapshot,
  type ApplicationMcpServerCredentials,
} from "../contracts/application-mcp-credentials";
import {
  MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT,
  isApplicationToolCredentialPlaceholder,
  isSensitiveApplicationToolHeaderName,
  isToolCredentialRecord,
  parseApplicationToolCredentialEnvironmentName,
  parseApplicationToolCredentialHeaderName,
  parseApplicationToolCredentialScope,
  parseApplicationToolCredentialSecret,
} from "../contracts/application-tool-credential-common";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageMcpCredentialStore,
  type ApplicationMcpCredentialStore,
} from "./safe-storage-mcp-credential-store";

/** Filename containing only OS-encrypted MCP credentials. */
export const APPLICATION_MCP_CREDENTIAL_FILENAME = "mcp-credentials.bin";

/** Server 兼容 backend 可接收的最大 MCP 凭据 bootstrap。 */
export const MAX_MCP_RUNTIME_BOOTSTRAP_BYTES = 2 * 1024 * 1024;

/** Diagnostics sink used without ever logging MCP credential values. */
export interface ApplicationMcpCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one MCP credential service. */
export interface ApplicationMcpCredentialServiceOptions {
  readonly credentials: ApplicationMcpCredentialStore;
  readonly logger?: ApplicationMcpCredentialLogger;
}

/** Paths and OS encryption required to bootstrap MCP credential ownership. */
export interface BootstrapApplicationMcpCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationMcpCredentialLogger;
}

/** Result of removing MCP credentials from one legacy settings document. */
export interface ReconciledLegacyMcpCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted MCP credentials change. */
export type ApplicationMcpCredentialChangedListener = (
  snapshot: ApplicationMcpCredentialSnapshot,
) => void;

interface ActiveMcpCredentialNames {
  readonly env: Set<string>;
  readonly headers: Set<string>;
}

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Parse the server config duplicated inside one legacy MCP input document. */
function parseLegacyMcpInput(value: unknown, serverId: string): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("Legacy MCP input JSON is invalid.");
  }
  if (!isToolCredentialRecord(parsed)) throw new TypeError("Legacy MCP input JSON is invalid.");
  const servers = isToolCredentialRecord(parsed.mcpServers) ? parsed.mcpServers : parsed;
  const config = servers[serverId] ?? Object.values(servers)[0];
  if (!isToolCredentialRecord(config)) throw new TypeError("Legacy MCP input JSON is invalid.");
  return config;
}

/** Merge credential-bearing MCP lanes from the object and duplicated input JSON. */
function mergeLegacyMcpConfig(
  node: Record<string, unknown>,
  inputConfig: Record<string, unknown> | null,
): Record<string, unknown> {
  const source = { ...(inputConfig || {}), ...node };
  const inputEnv = isToolCredentialRecord(inputConfig?.env) ? inputConfig.env : {};
  const nodeEnv = isToolCredentialRecord(node.env) ? node.env : {};
  const inputHeaders = isToolCredentialRecord(inputConfig?.headers) ? inputConfig.headers : {};
  const nodeHeaders = isToolCredentialRecord(node.headers) ? node.headers : {};
  return {
    ...source,
    env: { ...inputEnv, ...nodeEnv },
    headers: { ...inputHeaders, ...nodeHeaders },
  };
}

/** Build one secret-free MCP input document from a redacted server node. */
function buildRedactedMcpInput(serverId: string, node: Record<string, unknown>): string {
  const config: Record<string, unknown> = {};
  for (const key of ["command", "args", "env", "url", "headers"]) {
    if (node[key] !== undefined) config[key] = cloneJson(node[key]);
  }
  return JSON.stringify({ mcpServers: { [serverId]: config } }, null, 2);
}

/** Main-owned boundary for MCP process and transport credentials. */
export class ApplicationMcpCredentialService {
  private readonly logger: ApplicationMcpCredentialLogger;
  private readonly listeners = new Set<ApplicationMcpCredentialChangedListener>();
  private closed = false;

  /** Create an MCP credential boundary over one initialized encrypted store. */
  public constructor(private readonly options: ApplicationMcpCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured names without returning any credential value. */
  public getSnapshot(): ApplicationMcpCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_MCP_CREDENTIAL_SCHEMA,
      configured: createApplicationMcpCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact scoped MCP credential update and explicit clear list. */
  public save(value: unknown): ApplicationMcpCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationMcpCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system MCP credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, {
      env?: Record<string, string>;
      headers?: Record<string, string>;
    }>;
    for (const [serverId, lanes] of Object.entries(request.credentials || {})) {
      const current = credentials[serverId] || {};
      credentials[serverId] = {
        ...(Object.keys({ ...(current.env || {}), ...(lanes.env || {}) }).length > 0
          ? { env: { ...(current.env || {}), ...(lanes.env || {}) } }
          : {}),
        ...(Object.keys({ ...(current.headers || {}), ...(lanes.headers || {}) }).length > 0
          ? { headers: { ...(current.headers || {}), ...(lanes.headers || {}) } }
          : {}),
      };
    }
    for (const entry of request.clear || []) {
      if (entry.all) {
        delete credentials[entry.serverId];
        continue;
      }
      for (const name of entry.env || []) delete credentials[entry.serverId]?.env?.[name];
      for (const name of entry.headers || []) delete credentials[entry.serverId]?.headers?.[name];
      this.removeEmptyServer(credentials, entry.serverId);
    }
    const normalized = parseApplicationMcpCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy MCP env/header values and return redacted compatibility settings.
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
  ): ReconciledLegacyMcpCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const servers = isToolCredentialRecord(settings.mcpServers) ? settings.mcpServers : null;
    if (servers === null) return { settings, persistSanitized: false };

    const captured: Record<string, {
      env?: Record<string, string>;
      headers?: Record<string, string>;
    }> = {};
    const active = new Map<string, ActiveMcpCredentialNames>();
    let containsInvalidSecret = Object.keys(servers).length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT;
    for (const [rawServerId, rawNode] of Object.entries(servers)) {
      if (!isToolCredentialRecord(rawNode)) continue;
      let serverId: string;
      let inputConfig: Record<string, unknown> | null = null;
      try {
        serverId = parseApplicationToolCredentialScope(rawServerId, "MCP");
        inputConfig = parseLegacyMcpInput(rawNode.input, serverId);
      } catch {
        containsInvalidSecret = true;
        rawNode.input = "";
        continue;
      }
      const source = mergeLegacyMcpConfig(rawNode, inputConfig);
      const names: ActiveMcpCredentialNames = { env: new Set(), headers: new Set() };
      active.set(serverId, names);
      const serverCredentials: { env?: Record<string, string>; headers?: Record<string, string> } = {};

      const env = isToolCredentialRecord(source.env) ? source.env : {};
      if (source.env !== undefined && !isToolCredentialRecord(source.env)) containsInvalidSecret = true;
      for (const [rawName, rawSecret] of Object.entries(env)) {
        try {
          const name = parseApplicationToolCredentialEnvironmentName(rawName);
          names.env.add(name);
          const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
          if (!secret || isApplicationToolCredentialPlaceholder(secret)) continue;
          serverCredentials.env = serverCredentials.env || {};
          serverCredentials.env[name] = parseApplicationToolCredentialSecret(rawSecret, {
            allowLineBreaks: true,
          });
        } catch {
          containsInvalidSecret = true;
        }
      }

      const headers = isToolCredentialRecord(source.headers) ? source.headers : {};
      if (source.headers !== undefined && !isToolCredentialRecord(source.headers)) containsInvalidSecret = true;
      for (const [rawName, rawSecret] of Object.entries(headers)) {
        if (!isSensitiveApplicationToolHeaderName(rawName)) continue;
        try {
          const name = parseApplicationToolCredentialHeaderName(rawName);
          names.headers.add(name);
          const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
          if (!secret || isApplicationToolCredentialPlaceholder(secret)) continue;
          serverCredentials.headers = serverCredentials.headers || {};
          serverCredentials.headers[name] = parseApplicationToolCredentialSecret(rawSecret, {
            allowLineBreaks: false,
          });
        } catch {
          containsInvalidSecret = true;
        }
      }
      if (serverCredentials.env || serverCredentials.headers) captured[serverId] = serverCredentials;
      rawNode.env = cloneJson(env);
      rawNode.headers = cloneJson(headers);
    }

    const containsSecrets = Object.keys(captured).length > 0;
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy MCP credential entry is invalid.");
    }
    const previous = this.readCredentials(
      options.requireSecureCapture === true && (containsSecrets || options.pruneMissingScopes === true),
    );
    let credentials: ApplicationMcpCredentials = previous;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system MCP credential encryption is unavailable.");
        }
      } else {
        const merged = cloneJson(previous) as Record<string, {
          env?: Record<string, string>;
          headers?: Record<string, string>;
        }>;
        for (const [serverId, lanes] of Object.entries(captured)) {
          const current = merged[serverId] || {};
          merged[serverId] = {
            ...(Object.keys({ ...(current.env || {}), ...(lanes.env || {}) }).length > 0
              ? { env: { ...(current.env || {}), ...(lanes.env || {}) } }
              : {}),
            ...(Object.keys({ ...(current.headers || {}), ...(lanes.headers || {}) }).length > 0
              ? { headers: { ...(current.headers || {}), ...(lanes.headers || {}) } }
              : {}),
          };
        }
        credentials = parseApplicationMcpCredentials(merged);
        capturedSecurely = !containsInvalidSecret;
      }
    }
    if (capturedSecurely && options.pruneMissingScopes) {
      credentials = this.pruneCredentials(credentials, active);
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }

    const configured = createApplicationMcpCredentialConfigured(credentials);
    for (const [serverId, rawNode] of Object.entries(servers)) {
      if (!isToolCredentialRecord(rawNode)) continue;
      const env = isToolCredentialRecord(rawNode.env) ? rawNode.env : {};
      for (const name of Object.keys(env)) env[name] = "";
      const headers = isToolCredentialRecord(rawNode.headers) ? rawNode.headers : {};
      for (const name of Object.keys(headers)) {
        if (isSensitiveApplicationToolHeaderName(name)) headers[name] = "";
      }
      rawNode.env = env;
      rawNode.headers = headers;
      rawNode.envCredentialsConfigured = configured[serverId]?.env || [];
      rawNode.headerCredentialsConfigured = configured[serverId]?.headers || [];
      rawNode.input = buildRedactedMcpInput(serverId, rawNode);
    }
    settings.mcpServers = servers;
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** 返回有界 Base64 凭据包；无输入，仅供受信任的 Server 兼容 backend 启动环境使用。 */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.mcp-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_MCP_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("MCP credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed MCP credential changes. */
  public subscribe(listener: ApplicationMcpCredentialChangedListener): () => void {
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

  /** Prune missing servers and removed credential names after a trusted settings write. */
  private pruneCredentials(
    credentials: ApplicationMcpCredentials,
    active: ReadonlyMap<string, ActiveMcpCredentialNames>,
  ): ApplicationMcpCredentials {
    const pruned: Record<string, ApplicationMcpServerCredentials> = {};
    for (const [serverId, names] of active) {
      const current = credentials[serverId];
      if (!current) continue;
      const env = Object.fromEntries(
        Object.entries(current.env || {}).filter(([name]) => names.env.has(name)),
      );
      const headers = Object.fromEntries(
        Object.entries(current.headers || {}).filter(([name]) => names.headers.has(name)),
      );
      if (Object.keys(env).length > 0 || Object.keys(headers).length > 0) {
        pruned[serverId] = {
          ...(Object.keys(env).length > 0 ? { env } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        };
      }
    }
    return parseApplicationMcpCredentials(pruned);
  }

  /** Remove empty credential lanes and their empty server owner. */
  private removeEmptyServer(
    credentials: Record<string, { env?: Record<string, string>; headers?: Record<string, string> }>,
    serverId: string,
  ): void {
    const current = credentials[serverId];
    if (!current) return;
    if (Object.keys(current.env || {}).length === 0) delete current.env;
    if (Object.keys(current.headers || {}).length === 0) delete current.headers;
    if (!current.env && !current.headers) delete credentials[serverId];
  }

  /** Notify observers after one encrypted MCP credential change. */
  private publish(snapshot: ApplicationMcpCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationMcpCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted MCP credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted MCP credential sidecar. */
  private writeCredentials(credentials: ApplicationMcpCredentials): void {
    if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject MCP credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application MCP credential service is closed.");
  }
}

/** Bootstrap the independent MCP credential safeStorage boundary. */
export function bootstrapApplicationMcpCredentials(
  options: BootstrapApplicationMcpCredentialsOptions,
): ApplicationMcpCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageMcpCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_MCP_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationMcpCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
