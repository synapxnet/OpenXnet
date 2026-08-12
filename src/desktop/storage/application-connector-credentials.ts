import path from "node:path";

import {
  APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS,
  APPLICATION_CONNECTOR_CREDENTIAL_SCHEMA,
  createApplicationConnectorCredentialConfigured,
  getApplicationConnectorCredentialFields,
  parseApplicationConnectorCredentialSecret,
  parseApplicationConnectorCredentials,
  parseSaveApplicationConnectorCredentialsRequest,
  type ApplicationConnectorCredentialField,
  type ApplicationConnectorCredentialPlatform,
  type ApplicationConnectorCredentials,
  type ApplicationConnectorCredentialSnapshot,
} from "../contracts/application-connector-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageConnectorCredentialStore,
  type ApplicationConnectorCredentialStore,
} from "./safe-storage-connector-credential-store";

/** Filename containing only OS-encrypted Connector Worker credentials. */
export const APPLICATION_CONNECTOR_CREDENTIAL_FILENAME = "connector-credentials.bin";

/** Maximum decoded credential bootstrap passed to Connector Worker. */
export const MAX_CONNECTOR_RUNTIME_BOOTSTRAP_BYTES = 512 * 1024;

/** Legacy settings object owned by each Connector Worker platform. */
export const APPLICATION_CONNECTOR_SETTINGS_KEYS = Object.freeze({
  qq: "qqBotConfig",
  feishu: "feishuBotConfig",
  dingtalk: "dingtalkBotConfig",
  discord: "discordBotConfig",
  slack: "slackBotConfig",
});

/** Diagnostics sink used without ever logging Connector Worker credential values. */
export interface ApplicationConnectorCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one Connector Worker credential service. */
export interface ApplicationConnectorCredentialServiceOptions {
  readonly credentials: ApplicationConnectorCredentialStore;
  readonly logger?: ApplicationConnectorCredentialLogger;
}

/** Paths and OS encryption required to bootstrap Connector Worker credential ownership. */
export interface BootstrapApplicationConnectorCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationConnectorCredentialLogger;
}

/** Result of removing Connector Worker credentials from one legacy settings document. */
export interface ReconciledLegacyConnectorCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted Connector Worker credentials change. */
export type ApplicationConnectorCredentialChangedListener = (
  snapshot: ApplicationConnectorCredentialSnapshot,
) => void;

const CONNECTOR_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_secret",
  "your-secret",
  "your_token",
  "your-token",
  "xoxb-your-token",
  "xapp-your-token",
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
  return CONNECTOR_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for optional Connector Worker platform credentials. */
export class ApplicationConnectorCredentialService {
  private readonly logger: ApplicationConnectorCredentialLogger;
  private readonly listeners = new Set<ApplicationConnectorCredentialChangedListener>();
  private closed = false;

  /** Create a Connector Worker credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationConnectorCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured names without returning any Connector Worker credential value. */
  public getSnapshot(): ApplicationConnectorCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_CONNECTOR_CREDENTIAL_SCHEMA,
      configured: createApplicationConnectorCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact Connector Worker credential update and explicit clear list. */
  public save(value: unknown): ApplicationConnectorCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationConnectorCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system Connector Worker credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, Record<string, string>>;
    for (const [platform, fields] of Object.entries(request.credentials || {})) {
      credentials[platform] = { ...(credentials[platform] || {}), ...fields };
    }
    for (const entry of request.clear || []) {
      if (entry.fields === undefined) {
        delete credentials[entry.platform];
        continue;
      }
      for (const field of entry.fields) delete credentials[entry.platform]?.[field];
      if (Object.keys(credentials[entry.platform] || {}).length === 0) {
        delete credentials[entry.platform];
      }
    }
    const normalized = parseApplicationConnectorCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy Connector Worker fields and return redacted compatibility settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration behavior for trusted writes.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyConnectorCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const captured: Record<string, Record<string, string>> = {};
    let containsInvalidSecret = false;
    let foundConnectorConfig = false;

    for (const platform of APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS) {
      const settingsKey = APPLICATION_CONNECTOR_SETTINGS_KEYS[platform];
      const node = isRecord(settings[settingsKey]) ? settings[settingsKey] : null;
      if (node === null) continue;
      foundConnectorConfig = true;
      for (const field of getApplicationConnectorCredentialFields(platform)) {
        const rawSecret = node[field];
        const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
        if (!secret || isCredentialPlaceholder(secret)) continue;
        try {
          captured[platform] = captured[platform] || {};
          captured[platform][field] = parseApplicationConnectorCredentialSecret(rawSecret);
        } catch {
          containsInvalidSecret = true;
        }
      }
    }
    if (!foundConnectorConfig) return { settings, persistSanitized: false };

    const containsSecrets = Object.keys(captured).length > 0;
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy Connector Worker credential entry is invalid.");
    }
    const previous = this.readCredentials(options.requireSecureCapture === true && containsSecrets);
    let credentials: ApplicationConnectorCredentials = previous;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system Connector Worker credential encryption is unavailable.");
        }
      } else {
        const merged = cloneJson(previous) as Record<string, Record<string, string>>;
        for (const [platform, fields] of Object.entries(captured)) {
          merged[platform] = { ...(merged[platform] || {}), ...fields };
        }
        credentials = parseApplicationConnectorCredentials(merged);
        capturedSecurely = !containsInvalidSecret;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }

    const configured = createApplicationConnectorCredentialConfigured(credentials);
    for (const platform of APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS) {
      const settingsKey = APPLICATION_CONNECTOR_SETTINGS_KEYS[platform];
      const node = isRecord(settings[settingsKey]) ? settings[settingsKey] : null;
      if (node === null) continue;
      for (const field of getApplicationConnectorCredentialFields(platform)) node[field] = "";
      node.credentialFieldsConfigured = configured[platform];
    }
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for Connector Worker only. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.connector-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_CONNECTOR_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Connector Worker credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed Connector Worker credential changes. */
  public subscribe(listener: ApplicationConnectorCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted Connector Worker credential change. */
  private publish(snapshot: ApplicationConnectorCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationConnectorCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted Connector Worker credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted Connector Worker credential sidecar. */
  private writeCredentials(credentials: ApplicationConnectorCredentials): void {
    if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject Connector Worker credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application Connector Worker credential service is closed.");
  }
}

/** Bootstrap the independent Connector Worker credential safeStorage boundary. */
export function bootstrapApplicationConnectorCredentials(
  options: BootstrapApplicationConnectorCredentialsOptions,
): ApplicationConnectorCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageConnectorCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_CONNECTOR_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationConnectorCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
