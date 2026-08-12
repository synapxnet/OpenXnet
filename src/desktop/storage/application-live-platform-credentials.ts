import path from "node:path";

import {
  APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS,
  APPLICATION_LIVE_PLATFORM_CREDENTIAL_SCHEMA,
  createApplicationLivePlatformCredentialConfigured,
  parseApplicationLivePlatformCredentialSecret,
  parseApplicationLivePlatformCredentials,
  parseSaveApplicationLivePlatformCredentialsRequest,
  type ApplicationLivePlatformCredentials,
  type ApplicationLivePlatformCredentialSnapshot,
} from "../contracts/application-live-platform-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageLivePlatformCredentialStore,
  type ApplicationLivePlatformCredentialStore,
} from "./safe-storage-live-platform-credential-store";

/** Filename containing only OS-encrypted live-platform credentials. */
export const APPLICATION_LIVE_PLATFORM_CREDENTIAL_FILENAME = "live-platform-credentials.bin";

/** Maximum decoded live-platform credential bootstrap passed to trusted live runtimes. */
export const MAX_LIVE_PLATFORM_RUNTIME_BOOTSTRAP_BYTES = 384 * 1024;

/** Diagnostics sink used without ever logging live-platform credential values. */
export interface ApplicationLivePlatformCredentialLogger {
  warn(message: string): void;
}

/** Dependencies used to create one live-platform credential service. */
export interface ApplicationLivePlatformCredentialServiceOptions {
  readonly credentials: ApplicationLivePlatformCredentialStore;
  readonly logger?: ApplicationLivePlatformCredentialLogger;
}

/** Paths and OS encryption required to bootstrap live-platform credential ownership. */
export interface BootstrapApplicationLivePlatformCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationLivePlatformCredentialLogger;
}

/** Result of removing live-platform credentials from one legacy settings document. */
export interface ReconciledLegacyLivePlatformCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted live-platform credentials change. */
export type ApplicationLivePlatformCredentialChangedListener = (
  snapshot: ApplicationLivePlatformCredentialSnapshot,
) => void;

const LIVE_PLATFORM_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
  "your_token",
  "your-token",
  "your_secret",
  "your-secret",
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
  return LIVE_PLATFORM_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for live-platform credentials consumed by Live Worker or Server compatibility. */
export class ApplicationLivePlatformCredentialService {
  private readonly logger: ApplicationLivePlatformCredentialLogger;
  private readonly listeners = new Set<ApplicationLivePlatformCredentialChangedListener>();
  private closed = false;

  /** Create a live-platform credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationLivePlatformCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured field names without returning live-platform credential values. */
  public getSnapshot(): ApplicationLivePlatformCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_LIVE_PLATFORM_CREDENTIAL_SCHEMA,
      configured: createApplicationLivePlatformCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact live-platform credential update and explicit clear list. */
  public save(value: unknown): ApplicationLivePlatformCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationLivePlatformCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system live-platform credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationLivePlatformCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy live-platform fields and return redacted compatibility settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration behavior for trusted writes.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyLivePlatformCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const node = isRecord(settings.liveConfig) ? settings.liveConfig : null;
    if (node === null) return { settings, persistSanitized: false };
    if (!String(node.youtube_video_id || "").trim() && typeof node.youtube_vedio_id === "string") {
      node.youtube_video_id = node.youtube_vedio_id.trim();
    }
    delete node.youtube_vedio_id;
    if (node.bilibili_type === "open_live") node.bilibili_type = "open";
    const captured: Record<string, string> = {};
    let containsInvalidSecret = false;
    for (const field of APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS) {
      const rawSecret = node[field];
      const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
      if (!secret || isCredentialPlaceholder(secret)) continue;
      try {
        captured[field] = parseApplicationLivePlatformCredentialSecret(rawSecret);
      } catch {
        containsInvalidSecret = true;
      }
    }
    if (containsInvalidSecret && options.requireSecureCapture) {
      throw new Error("Legacy live-platform credential entry is invalid.");
    }
    const containsSecrets = Object.keys(captured).length > 0;
    const previous = this.readCredentials(options.requireSecureCapture === true && containsSecrets);
    let credentials: ApplicationLivePlatformCredentials = previous;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system live-platform credential encryption is unavailable.");
        }
      } else if (!containsInvalidSecret) {
        credentials = parseApplicationLivePlatformCredentials({ ...previous, ...captured });
        capturedSecurely = true;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }
    for (const field of APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS) node[field] = "";
    node.liveCredentialFieldsConfigured = createApplicationLivePlatformCredentialConfigured(
      credentials,
    );
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for an authorized live runtime. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.live-platform-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_LIVE_PLATFORM_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Live-platform credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed live-platform credential changes. */
  public subscribe(listener: ApplicationLivePlatformCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted live-platform credential change. */
  private publish(snapshot: ApplicationLivePlatformCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials while replacing storage details with a stable public error. */
  private readCredentials(strict = false): ApplicationLivePlatformCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted live-platform credentials could not be read.");
      this.logger.warn("Encrypted live-platform credentials could not be read.");
      return {};
    }
  }

  /** Replace or clear the encrypted live-platform credential sidecar. */
  private writeCredentials(credentials: ApplicationLivePlatformCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted live-platform credentials could not be written.");
    }
  }

  /** Reject live-platform credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application live-platform credential service is closed.");
  }
}

/** Bootstrap the independent live-platform credential safeStorage boundary. */
export function bootstrapApplicationLivePlatformCredentials(
  options: BootstrapApplicationLivePlatformCredentialsOptions,
): ApplicationLivePlatformCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageLivePlatformCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_LIVE_PLATFORM_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationLivePlatformCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
