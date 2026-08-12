import path from "node:path";

import {
  APPLICATION_SEARCH_CREDENTIAL_IDS,
  APPLICATION_SEARCH_CREDENTIAL_SCHEMA,
  MAX_APPLICATION_SEARCH_CREDENTIAL_LENGTH,
  createApplicationSearchCredentialConfigured,
  parseSaveApplicationSearchCredentialsRequest,
  type ApplicationSearchCredentialId,
  type ApplicationSearchCredentials,
  type ApplicationSearchCredentialSnapshot,
} from "../contracts/application-search-credentials";
import {
  SafeStorageSearchCredentialStore,
  type ApplicationSearchCredentialStore,
} from "./safe-storage-search-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Filename containing only OS-encrypted search and crawler credentials. */
export const APPLICATION_SEARCH_CREDENTIAL_FILENAME = "search-credentials.bin";

/** Maximum decoded credential bootstrap passed to one trusted Python runtime. */
export const MAX_SEARCH_RUNTIME_BOOTSTRAP_BYTES = 64 * 1024;

/** Legacy webSearch field associated with each stable credential identifier. */
export const APPLICATION_SEARCH_CREDENTIAL_LEGACY_FIELDS: Readonly<
  Record<ApplicationSearchCredentialId, string>
> = Object.freeze({
  tavily: "tavily_api_key",
  jina: "jina_api_key",
  crawl4ai: "Crawl4Ai_api_key",
  bing: "bing_api_key",
  google: "google_api_key",
  brave: "brave_api_key",
  exa: "exa_api_key",
  serper: "serper_api_key",
  bochaai: "bochaai_api_key",
  firecrawl: "firecrawl_api_key",
});

/** Diagnostics sink used without ever logging search credential values. */
export interface ApplicationSearchCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one search credential service. */
export interface ApplicationSearchCredentialServiceOptions {
  readonly credentials: ApplicationSearchCredentialStore;
  readonly logger?: ApplicationSearchCredentialLogger;
}

/** Paths and OS encryption required to bootstrap search credential ownership. */
export interface BootstrapApplicationSearchCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationSearchCredentialLogger;
}

/** Result of removing search credentials from one legacy settings document. */
export interface ReconciledLegacySearchCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted search credentials change. */
export type ApplicationSearchCredentialChangedListener = (
  snapshot: ApplicationSearchCredentialSnapshot,
) => void;

const SEARCH_CREDENTIAL_PLACEHOLDERS = new Set([
  "test_api_code",
  "your_api_key",
  "your-api-key",
]);

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Return whether one legacy value is a non-secret example placeholder. */
function isCredentialPlaceholder(value: string): boolean {
  return SEARCH_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for search and crawler credentials. */
export class ApplicationSearchCredentialService {
  private readonly logger: ApplicationSearchCredentialLogger;
  private readonly listeners = new Set<ApplicationSearchCredentialChangedListener>();
  private closed = false;

  /** Create a search credential boundary over one initialized encrypted store. */
  public constructor(private readonly options: ApplicationSearchCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured flags without returning any credential value. */
  public getSnapshot(): ApplicationSearchCredentialSnapshot {
    this.assertOpen();
    const credentials = this.readCredentials();
    return {
      schema: APPLICATION_SEARCH_CREDENTIAL_SCHEMA,
      configured: createApplicationSearchCredentialConfigured(credentials),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact credential update and explicit clear list. */
  public save(value: unknown): ApplicationSearchCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationSearchCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system search credential encryption is unavailable.");
    }
    const previousCredentials = this.readCredentials(hasMutation);
    const credentials: Partial<Record<ApplicationSearchCredentialId, string>> = {
      ...previousCredentials,
      ...(request.credentials || {}),
    };
    for (const id of request.clear || []) delete credentials[id];
    const changed = JSON.stringify(previousCredentials) !== JSON.stringify(credentials);
    if (changed) this.writeCredentials(credentials);
    const snapshot = this.getSnapshot();
    if (changed) {
      for (const listener of this.listeners) listener(snapshot);
    }
    return snapshot;
  }

  /**
   * Capture legacy webSearch keys and return only redacted compatibility settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration behavior for writes that must not lose plaintext.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacySearchCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const webSearch = isRecord(settings.webSearch) ? settings.webSearch : null;
    if (webSearch === null) {
      return { settings, persistSanitized: false };
    }
    const captured: Partial<Record<ApplicationSearchCredentialId, string>> = {};
    let containsInvalidSecret = false;
    for (const id of APPLICATION_SEARCH_CREDENTIAL_IDS) {
      const field = APPLICATION_SEARCH_CREDENTIAL_LEGACY_FIELDS[id];
      const secret = typeof webSearch[field] === "string" ? webSearch[field].trim() : "";
      if (!secret || isCredentialPlaceholder(secret)) continue;
      if (
        secret.length > MAX_APPLICATION_SEARCH_CREDENTIAL_LENGTH
        || /[\u0000-\u001F\u007F]/.test(secret)
      ) {
        containsInvalidSecret = true;
        continue;
      }
      captured[id] = secret;
    }
    const containsSecrets = Object.keys(captured).length > 0;
    if (containsInvalidSecret && options.requireSecureCapture === true) {
      throw new Error("Legacy search credential entry is invalid.");
    }
    const previousCredentials = this.readCredentials(
      options.requireSecureCapture === true && containsSecrets,
    );
    let credentials = previousCredentials;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture === true) {
          throw new Error("Operating-system search credential encryption is unavailable.");
        }
      } else {
        credentials = { ...credentials, ...captured };
        this.writeCredentials(credentials);
        capturedSecurely = true;
        if (JSON.stringify(previousCredentials) !== JSON.stringify(credentials)) {
          const snapshot = this.getSnapshot();
          for (const listener of this.listeners) listener(snapshot);
        }
      }
    }
    const configured = createApplicationSearchCredentialConfigured(credentials);
    for (const id of APPLICATION_SEARCH_CREDENTIAL_IDS) {
      const field = APPLICATION_SEARCH_CREDENTIAL_LEGACY_FIELDS[id];
      webSearch[field] = "";
      webSearch[`${field}_configured`] = configured[id];
    }
    settings.webSearch = webSearch;
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return {
      settings,
      persistSanitized: capturedSecurely && sanitized,
    };
  }

  /** Return a bounded Base64 credential envelope for one trusted Python process. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.search-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_SEARCH_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Search credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed search credential changes. */
  public subscribe(listener: ApplicationSearchCredentialChangedListener): () => void {
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

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationSearchCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted search credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted search credential sidecar. */
  private writeCredentials(credentials: ApplicationSearchCredentials): void {
    if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject search credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application search credential service is closed.");
  }
}

/** Bootstrap the independent search credential safeStorage boundary. */
export function bootstrapApplicationSearchCredentials(
  options: BootstrapApplicationSearchCredentialsOptions,
): ApplicationSearchCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageSearchCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_SEARCH_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationSearchCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
