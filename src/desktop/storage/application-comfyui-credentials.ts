import path from "node:path";

import {
  APPLICATION_COMFYUI_CREDENTIAL_SCHEMA,
  createApplicationComfyUiCredentialConfigured,
  parseApplicationComfyUiCredentialSecret,
  parseApplicationComfyUiCredentials,
  parseSaveApplicationComfyUiCredentialsRequest,
  type ApplicationComfyUiCredentials,
  type ApplicationComfyUiCredentialSnapshot,
} from "../contracts/application-comfyui-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageComfyUiCredentialStore,
  type ApplicationComfyUiCredentialStore,
} from "./safe-storage-comfyui-credential-store";

/** Filename containing only OS-encrypted ComfyUI credentials. */
export const APPLICATION_COMFYUI_CREDENTIAL_FILENAME = "comfyui-credentials.bin";

/** Maximum decoded ComfyUI credential bootstrap passed to authorized runtimes. */
export const MAX_COMFYUI_RUNTIME_BOOTSTRAP_BYTES = 96 * 1024;

/** Diagnostics sink used without ever logging ComfyUI credential values. */
export interface ApplicationComfyUiCredentialLogger {
  warn(message: string): void;
}

/** Dependencies used to create one ComfyUI credential service. */
export interface ApplicationComfyUiCredentialServiceOptions {
  readonly credentials: ApplicationComfyUiCredentialStore;
  readonly logger?: ApplicationComfyUiCredentialLogger;
}

/** Paths and OS encryption required to bootstrap ComfyUI credential ownership. */
export interface BootstrapApplicationComfyUiCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationComfyUiCredentialLogger;
}

/** Result of removing ComfyUI credentials from one legacy settings document. */
export interface ReconciledLegacyComfyUiCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted ComfyUI credentials change. */
export type ApplicationComfyUiCredentialChangedListener = (
  snapshot: ApplicationComfyUiCredentialSnapshot,
) => void;

const COMFYUI_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
  "test_api_code",
]);

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Return whether one legacy value is only a non-secret example placeholder. */
function isCredentialPlaceholder(value: string): boolean {
  return COMFYUI_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for ComfyUI credentials consumed by authorized Python runtimes. */
export class ApplicationComfyUiCredentialService {
  private readonly logger: ApplicationComfyUiCredentialLogger;
  private readonly listeners = new Set<ApplicationComfyUiCredentialChangedListener>();
  private closed = false;

  /** Create a ComfyUI credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationComfyUiCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured field names without returning ComfyUI credential values. */
  public getSnapshot(): ApplicationComfyUiCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_COMFYUI_CREDENTIAL_SCHEMA,
      configured: createApplicationComfyUiCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact ComfyUI credential update and explicit clear list. */
  public save(value: unknown): ApplicationComfyUiCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationComfyUiCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system ComfyUI credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationComfyUiCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /** Capture a legacy ComfyUI key and return redacted compatibility settings. */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyComfyUiCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const rawSecret = settings.comfyuiAPIkey;
    const candidate = typeof rawSecret === "string" ? rawSecret.trim() : "";
    let secret = "";
    let containsInvalidSecret = rawSecret !== undefined
      && rawSecret !== null
      && typeof rawSecret !== "string";
    if (candidate && !isCredentialPlaceholder(candidate)) {
      try {
        secret = parseApplicationComfyUiCredentialSecret(rawSecret);
      } catch {
        containsInvalidSecret = true;
      }
    }
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy ComfyUI credential entry is invalid.");
    }
    const previous = this.readCredentials(options.requireSecureCapture === true && Boolean(secret));
    let credentials: ApplicationComfyUiCredentials = previous;
    let capturedSecurely = !secret && !containsInvalidSecret;
    if (secret) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system ComfyUI credential encryption is unavailable.");
        }
      } else if (!containsInvalidSecret) {
        credentials = parseApplicationComfyUiCredentials({ ...previous, api_key: secret });
        capturedSecurely = true;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }
    settings.comfyuiAPIkey = "";
    settings.comfyuiCredentialFieldsConfigured = createApplicationComfyUiCredentialConfigured(
      credentials,
    );
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for authorized ComfyUI consumers. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.comfyui-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_COMFYUI_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("ComfyUI credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed ComfyUI credential changes. */
  public subscribe(listener: ApplicationComfyUiCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted ComfyUI credential change. */
  private publish(snapshot: ApplicationComfyUiCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials while replacing storage details with a stable public error. */
  private readCredentials(strict = false): ApplicationComfyUiCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted ComfyUI credentials could not be read.");
      this.logger.warn("Encrypted ComfyUI credentials could not be read.");
      return {};
    }
  }

  /** Replace or clear the encrypted ComfyUI credential sidecar. */
  private writeCredentials(credentials: ApplicationComfyUiCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted ComfyUI credentials could not be written.");
    }
  }

  /** Reject ComfyUI credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application ComfyUI credential service is closed.");
  }
}

/** Bootstrap the independent ComfyUI credential safeStorage boundary. */
export function bootstrapApplicationComfyUiCredentials(
  options: BootstrapApplicationComfyUiCredentialsOptions,
): ApplicationComfyUiCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageComfyUiCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_COMFYUI_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationComfyUiCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
