import path from "node:path";

import {
  APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS,
  APPLICATION_IMAGE_HOST_CREDENTIAL_SCHEMA,
  createApplicationImageHostCredentialConfigured,
  parseApplicationImageHostCredentialSecret,
  parseApplicationImageHostCredentials,
  parseSaveApplicationImageHostCredentialsRequest,
  type ApplicationImageHostCredentials,
  type ApplicationImageHostCredentialSnapshot,
} from "../contracts/application-image-host-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageImageHostCredentialStore,
  type ApplicationImageHostCredentialStore,
} from "./safe-storage-image-host-credential-store";

/** Filename containing only OS-encrypted image-host credentials. */
export const APPLICATION_IMAGE_HOST_CREDENTIAL_FILENAME = "image-host-credentials.bin";

/** Maximum decoded image-host credential bootstrap passed to Connector Worker. */
export const MAX_IMAGE_HOST_RUNTIME_BOOTSTRAP_BYTES = 128 * 1024;

/** Diagnostics sink used without ever logging image-host credential values. */
export interface ApplicationImageHostCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one image-host credential service. */
export interface ApplicationImageHostCredentialServiceOptions {
  readonly credentials: ApplicationImageHostCredentialStore;
  readonly logger?: ApplicationImageHostCredentialLogger;
}

/** Paths and OS encryption required to bootstrap image-host credential ownership. */
export interface BootstrapApplicationImageHostCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationImageHostCredentialLogger;
}

/** Result of removing image-host credentials from one legacy settings document. */
export interface ReconciledLegacyImageHostCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted image-host credentials change. */
export type ApplicationImageHostCredentialChangedListener = (
  snapshot: ApplicationImageHostCredentialSnapshot,
) => void;

const IMAGE_HOST_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
  "your_token",
  "your-token",
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
  return IMAGE_HOST_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for image-host credentials consumed by Connector Worker. */
export class ApplicationImageHostCredentialService {
  private readonly logger: ApplicationImageHostCredentialLogger;
  private readonly listeners = new Set<ApplicationImageHostCredentialChangedListener>();
  private closed = false;

  /** Create an image-host credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationImageHostCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured field names without returning image-host credential values. */
  public getSnapshot(): ApplicationImageHostCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_IMAGE_HOST_CREDENTIAL_SCHEMA,
      configured: createApplicationImageHostCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact image-host credential update and explicit clear list. */
  public save(value: unknown): ApplicationImageHostCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationImageHostCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system image-host credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationImageHostCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy image-host fields and return redacted compatibility settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration behavior for trusted writes.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyImageHostCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const node = isRecord(settings.BotConfig) ? settings.BotConfig : null;
    if (node === null) return { settings, persistSanitized: false };
    const captured: Record<string, string> = {};
    let containsInvalidSecret = false;
    for (const field of APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS) {
      const rawSecret = node[field];
      const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
      if (!secret || isCredentialPlaceholder(secret)) continue;
      try {
        captured[field] = parseApplicationImageHostCredentialSecret(rawSecret);
      } catch {
        containsInvalidSecret = true;
      }
    }
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy image-host credential entry is invalid.");
    }
    const containsSecrets = Object.keys(captured).length > 0;
    const previous = this.readCredentials(options.requireSecureCapture === true && containsSecrets);
    let credentials: ApplicationImageHostCredentials = previous;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system image-host credential encryption is unavailable.");
        }
      } else if (!containsInvalidSecret) {
        credentials = parseApplicationImageHostCredentials({ ...previous, ...captured });
        capturedSecurely = true;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }
    for (const field of APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS) node[field] = "";
    node.imageHostCredentialFieldsConfigured = createApplicationImageHostCredentialConfigured(
      credentials,
    );
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for Connector Worker only. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.image-host-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_IMAGE_HOST_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Image-host credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed image-host credential changes. */
  public subscribe(listener: ApplicationImageHostCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted image-host credential change. */
  private publish(snapshot: ApplicationImageHostCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationImageHostCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted image-host credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted image-host credential sidecar. */
  private writeCredentials(credentials: ApplicationImageHostCredentials): void {
    if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject image-host credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application image-host credential service is closed.");
  }
}

/** Bootstrap the independent image-host credential safeStorage boundary. */
export function bootstrapApplicationImageHostCredentials(
  options: BootstrapApplicationImageHostCredentialsOptions,
): ApplicationImageHostCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageImageHostCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_IMAGE_HOST_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationImageHostCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
