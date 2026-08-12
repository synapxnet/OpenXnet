import path from "node:path";

import {
  APPLICATION_CODE_SANDBOX_CREDENTIAL_FIELDS,
  APPLICATION_CODE_SANDBOX_CREDENTIAL_SCHEMA,
  createApplicationCodeSandboxCredentialConfigured,
  parseApplicationCodeSandboxCredentialSecret,
  parseApplicationCodeSandboxCredentials,
  parseSaveApplicationCodeSandboxCredentialsRequest,
  type ApplicationCodeSandboxCredentials,
  type ApplicationCodeSandboxCredentialSnapshot,
} from "../contracts/application-code-sandbox-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageCodeSandboxCredentialStore,
  type ApplicationCodeSandboxCredentialStore,
} from "./safe-storage-code-sandbox-credential-store";

/** Filename containing only OS-encrypted code-sandbox credentials. */
export const APPLICATION_CODE_SANDBOX_CREDENTIAL_FILENAME = "code-sandbox-credentials.bin";

/** Maximum decoded code-sandbox credential bootstrap passed to Python runtimes. */
export const MAX_CODE_SANDBOX_RUNTIME_BOOTSTRAP_BYTES = 96 * 1024;

/** Diagnostics sink used without ever logging code-sandbox credential values. */
export interface ApplicationCodeSandboxCredentialLogger {
  warn(message: string): void;
}

/** Dependencies used to create one code-sandbox credential service. */
export interface ApplicationCodeSandboxCredentialServiceOptions {
  readonly credentials: ApplicationCodeSandboxCredentialStore;
  readonly logger?: ApplicationCodeSandboxCredentialLogger;
}

/** Paths and OS encryption required to bootstrap code-sandbox credential ownership. */
export interface BootstrapApplicationCodeSandboxCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationCodeSandboxCredentialLogger;
}

/** Result of removing code-sandbox credentials from one legacy settings document. */
export interface ReconciledLegacyCodeSandboxCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted code-sandbox credentials change. */
export type ApplicationCodeSandboxCredentialChangedListener = (
  snapshot: ApplicationCodeSandboxCredentialSnapshot,
) => void;

const CODE_SANDBOX_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
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
  return CODE_SANDBOX_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for code-sandbox credentials consumed by authorized Python runtimes. */
export class ApplicationCodeSandboxCredentialService {
  private readonly logger: ApplicationCodeSandboxCredentialLogger;
  private readonly listeners = new Set<ApplicationCodeSandboxCredentialChangedListener>();
  private closed = false;

  /** Create a code-sandbox credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationCodeSandboxCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured field names without returning code-sandbox credential values. */
  public getSnapshot(): ApplicationCodeSandboxCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_CODE_SANDBOX_CREDENTIAL_SCHEMA,
      configured: createApplicationCodeSandboxCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact code-sandbox credential update and explicit clear list. */
  public save(value: unknown): ApplicationCodeSandboxCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationCodeSandboxCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system code-sandbox credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationCodeSandboxCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /** Capture a legacy E2B key and return redacted compatibility settings. */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyCodeSandboxCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const node = isRecord(settings.codeSettings) ? settings.codeSettings : null;
    if (node === null) return { settings, persistSanitized: false };
    const rawSecret = node.e2b_api_key;
    const candidate = typeof rawSecret === "string" ? rawSecret.trim() : "";
    let secret = "";
    let containsInvalidSecret = rawSecret !== undefined
      && rawSecret !== null
      && typeof rawSecret !== "string";
    if (candidate && !isCredentialPlaceholder(candidate)) {
      try {
        secret = parseApplicationCodeSandboxCredentialSecret(rawSecret);
      } catch {
        containsInvalidSecret = true;
      }
    }
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy code-sandbox credential entry is invalid.");
    }
    const previous = this.readCredentials(options.requireSecureCapture === true && Boolean(secret));
    let credentials: ApplicationCodeSandboxCredentials = previous;
    let capturedSecurely = !secret && !containsInvalidSecret;
    if (secret) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system code-sandbox credential encryption is unavailable.");
        }
      } else if (!containsInvalidSecret) {
        credentials = parseApplicationCodeSandboxCredentials({ ...previous, e2b_api_key: secret });
        capturedSecurely = true;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }
    node.e2b_api_key = "";
    node.codeSandboxCredentialFieldsConfigured = createApplicationCodeSandboxCredentialConfigured(
      credentials,
    );
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for authorized Python runtimes only. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.code-sandbox-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_CODE_SANDBOX_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Code-sandbox credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed code-sandbox credential changes. */
  public subscribe(listener: ApplicationCodeSandboxCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted code-sandbox credential change. */
  private publish(snapshot: ApplicationCodeSandboxCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials while replacing storage details with a stable public error. */
  private readCredentials(strict = false): ApplicationCodeSandboxCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted code-sandbox credentials could not be read.");
      this.logger.warn("Encrypted code-sandbox credentials could not be read.");
      return {};
    }
  }

  /** Replace or clear the encrypted code-sandbox credential sidecar. */
  private writeCredentials(credentials: ApplicationCodeSandboxCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted code-sandbox credentials could not be written.");
    }
  }

  /** Reject code-sandbox credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application code-sandbox credential service is closed.");
  }
}

/** Bootstrap the independent code-sandbox credential safeStorage boundary. */
export function bootstrapApplicationCodeSandboxCredentials(
  options: BootstrapApplicationCodeSandboxCredentialsOptions,
): ApplicationCodeSandboxCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageCodeSandboxCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_CODE_SANDBOX_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationCodeSandboxCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
