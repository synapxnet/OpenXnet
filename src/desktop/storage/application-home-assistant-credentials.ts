import path from "node:path";

import {
  APPLICATION_HOME_ASSISTANT_CREDENTIAL_SCHEMA,
  createApplicationHomeAssistantCredentialConfigured,
  parseApplicationHomeAssistantCredentialSecret,
  parseApplicationHomeAssistantCredentials,
  parseSaveApplicationHomeAssistantCredentialsRequest,
  type ApplicationHomeAssistantCredentials,
  type ApplicationHomeAssistantCredentialSnapshot,
} from "../contracts/application-home-assistant-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageHomeAssistantCredentialStore,
  type ApplicationHomeAssistantCredentialStore,
} from "./safe-storage-home-assistant-credential-store";

/** Filename containing only OS-encrypted Home Assistant credentials. */
export const APPLICATION_HOME_ASSISTANT_CREDENTIAL_FILENAME = "home-assistant-credentials.bin";

/** MCP Worker 或 Server 兼容 backend 可接收的最大 Home Assistant 凭据 bootstrap。 */
export const MAX_HOME_ASSISTANT_RUNTIME_BOOTSTRAP_BYTES = 96 * 1024;

/** Diagnostics sink used without ever logging Home Assistant credential values. */
export interface ApplicationHomeAssistantCredentialLogger {
  warn(message: string): void;
}

/** Dependencies used to create one Home Assistant credential service. */
export interface ApplicationHomeAssistantCredentialServiceOptions {
  readonly credentials: ApplicationHomeAssistantCredentialStore;
  readonly logger?: ApplicationHomeAssistantCredentialLogger;
}

/** Paths and OS encryption required to bootstrap Home Assistant credential ownership. */
export interface BootstrapApplicationHomeAssistantCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationHomeAssistantCredentialLogger;
}

/** Result of removing Home Assistant credentials from one legacy settings document. */
export interface ReconciledLegacyHomeAssistantCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted Home Assistant credentials change. */
export type ApplicationHomeAssistantCredentialChangedListener = (
  snapshot: ApplicationHomeAssistantCredentialSnapshot,
) => void;

const HOME_ASSISTANT_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
  "your_token",
  "your-token",
  "test_api_code",
]);

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Return whether one legacy value is only a non-secret example placeholder. */
function isCredentialPlaceholder(value: string): boolean {
  return HOME_ASSISTANT_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main 持有的 Home Assistant 凭据边界，仅允许 MCP Worker 与 Server 兼容 backend 消费。 */
export class ApplicationHomeAssistantCredentialService {
  private readonly logger: ApplicationHomeAssistantCredentialLogger;
  private readonly listeners = new Set<ApplicationHomeAssistantCredentialChangedListener>();
  private closed = false;

  /** Create a Home Assistant credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationHomeAssistantCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured field names without returning Home Assistant credential values. */
  public getSnapshot(): ApplicationHomeAssistantCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_HOME_ASSISTANT_CREDENTIAL_SCHEMA,
      configured: createApplicationHomeAssistantCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact Home Assistant credential update and explicit clear list. */
  public save(value: unknown): ApplicationHomeAssistantCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationHomeAssistantCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system Home Assistant credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationHomeAssistantCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /** Capture a legacy Home Assistant token and return redacted compatibility settings. */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyHomeAssistantCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const node = isRecord(settings.HASettings) ? settings.HASettings : null;
    if (node === null) return { settings, persistSanitized: false };
    const rawSecret = node.api_key;
    const candidate = typeof rawSecret === "string" ? rawSecret.trim() : "";
    let secret = "";
    let containsInvalidSecret = rawSecret !== undefined
      && rawSecret !== null
      && typeof rawSecret !== "string";
    if (candidate && !isCredentialPlaceholder(candidate)) {
      try {
        secret = parseApplicationHomeAssistantCredentialSecret(rawSecret);
      } catch {
        containsInvalidSecret = true;
      }
    }
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy Home Assistant credential entry is invalid.");
    }
    const previous = this.readCredentials(options.requireSecureCapture === true && Boolean(secret));
    let credentials: ApplicationHomeAssistantCredentials = previous;
    let capturedSecurely = !secret && !containsInvalidSecret;
    if (secret) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system Home Assistant credential encryption is unavailable.");
        }
      } else if (!containsInvalidSecret) {
        credentials = parseApplicationHomeAssistantCredentials({ ...previous, api_key: secret });
        capturedSecurely = true;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }
    node.api_key = "";
    node.homeAssistantCredentialFieldsConfigured = createApplicationHomeAssistantCredentialConfigured(
      credentials,
    );
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** 返回有界 Base64 凭据包；无输入，供 MCP Worker 或 Server 兼容 backend 启动环境使用。 */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.home-assistant-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_HOME_ASSISTANT_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Home Assistant credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed Home Assistant credential changes. */
  public subscribe(listener: ApplicationHomeAssistantCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted Home Assistant credential change. */
  private publish(snapshot: ApplicationHomeAssistantCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials while replacing storage details with a stable public error. */
  private readCredentials(strict = false): ApplicationHomeAssistantCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted Home Assistant credentials could not be read.");
      this.logger.warn("Encrypted Home Assistant credentials could not be read.");
      return {};
    }
  }

  /** Replace or clear the encrypted Home Assistant credential sidecar. */
  private writeCredentials(credentials: ApplicationHomeAssistantCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted Home Assistant credentials could not be written.");
    }
  }

  /** Reject Home Assistant credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application Home Assistant credential service is closed.");
  }
}

/** Bootstrap the independent Home Assistant credential safeStorage boundary. */
export function bootstrapApplicationHomeAssistantCredentials(
  options: BootstrapApplicationHomeAssistantCredentialsOptions,
): ApplicationHomeAssistantCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageHomeAssistantCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_HOME_ASSISTANT_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationHomeAssistantCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
