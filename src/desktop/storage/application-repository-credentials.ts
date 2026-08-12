import path from "node:path";

import {
  APPLICATION_REPOSITORY_CREDENTIAL_FIELDS,
  APPLICATION_REPOSITORY_CREDENTIAL_SCHEMA,
  createApplicationRepositoryCredentialConfigured,
  parseApplicationRepositoryCredentialSecret,
  parseApplicationRepositoryCredentials,
  parseSaveApplicationRepositoryCredentialsRequest,
  type ApplicationRepositoryCredentials,
  type ApplicationRepositoryCredentialSnapshot,
} from "../contracts/application-repository-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageRepositoryCredentialStore,
  type ApplicationRepositoryCredentialStore,
} from "./safe-storage-repository-credential-store";

/** Filename containing only OS-encrypted repository credentials. */
export const APPLICATION_REPOSITORY_CREDENTIAL_FILENAME = "repository-credentials.bin";

/** Diagnostics sink that never receives repository credential values or storage errors. */
export interface ApplicationRepositoryCredentialLogger {
  warn(message: string): void;
}

/** Dependencies used to create one repository credential service. */
export interface ApplicationRepositoryCredentialServiceOptions {
  readonly credentials: ApplicationRepositoryCredentialStore;
  readonly logger?: ApplicationRepositoryCredentialLogger;
}

/** Paths and OS encryption required to bootstrap repository credential ownership. */
export interface BootstrapApplicationRepositoryCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationRepositoryCredentialLogger;
}

/** Result of removing repository credentials from one legacy settings document. */
export interface ReconciledLegacyRepositoryCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

const REPOSITORY_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_token",
  "your-token",
  "your_api_token",
  "your-api-token",
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
  return REPOSITORY_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned storage boundary for repository credentials with no runtime consumer. */
export class ApplicationRepositoryCredentialService {
  private readonly logger: ApplicationRepositoryCredentialLogger;
  private closed = false;

  /** Create a repository credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationRepositoryCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured field names without returning repository credential values. */
  public getSnapshot(): ApplicationRepositoryCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_REPOSITORY_CREDENTIAL_SCHEMA,
      configured: createApplicationRepositoryCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact repository credential update and explicit clear list. */
  public save(value: unknown): ApplicationRepositoryCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationRepositoryCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system repository credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationRepositoryCredentials(credentials);
    if (JSON.stringify(previous) !== JSON.stringify(normalized)) {
      this.writeCredentials(normalized);
    }
    return this.getSnapshot();
  }

  /**
   * Capture legacy repository tokens and return redacted compatibility settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration behavior for trusted writes.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyRepositoryCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const node = isRecord(settings.BotConfig) ? settings.BotConfig : null;
    if (node === null) return { settings, persistSanitized: false };
    const captured: Record<string, string> = {};
    let containsInvalidSecret = false;
    for (const field of APPLICATION_REPOSITORY_CREDENTIAL_FIELDS) {
      const rawSecret = node[field];
      const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
      if (!secret || isCredentialPlaceholder(secret)) continue;
      try {
        captured[field] = parseApplicationRepositoryCredentialSecret(rawSecret);
      } catch {
        containsInvalidSecret = true;
      }
    }
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy repository credential entry is invalid.");
    }
    const containsSecrets = Object.keys(captured).length > 0;
    const previous = this.readCredentials(options.requireSecureCapture === true && containsSecrets);
    let credentials: ApplicationRepositoryCredentials = previous;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system repository credential encryption is unavailable.");
        }
      } else if (!containsInvalidSecret) {
        credentials = parseApplicationRepositoryCredentials({ ...previous, ...captured });
        capturedSecurely = true;
      }
    }
    if (capturedSecurely && JSON.stringify(previous) !== JSON.stringify(credentials)) {
      this.writeCredentials(credentials);
    }
    for (const field of APPLICATION_REPOSITORY_CREDENTIAL_FIELDS) node[field] = "";
    node.repositoryCredentialFieldsConfigured = createApplicationRepositoryCredentialConfigured(
      credentials,
    );
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Close the service and reject subsequent repository credential operations. */
  public close(): void {
    this.closed = true;
  }

  /** Read encrypted credentials while replacing storage details with a stable public error. */
  private readCredentials(strict = false): ApplicationRepositoryCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted repository credentials could not be read.");
      this.logger.warn("Encrypted repository credentials could not be read.");
      return {};
    }
  }

  /** Replace or clear the encrypted repository credential sidecar. */
  private writeCredentials(credentials: ApplicationRepositoryCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted repository credentials could not be written.");
    }
  }

  /** Reject repository credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application repository credential service is closed.");
  }
}

/** Bootstrap the independent repository credential safeStorage boundary. */
export function bootstrapApplicationRepositoryCredentials(
  options: BootstrapApplicationRepositoryCredentialsOptions,
): ApplicationRepositoryCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageRepositoryCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_REPOSITORY_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationRepositoryCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
