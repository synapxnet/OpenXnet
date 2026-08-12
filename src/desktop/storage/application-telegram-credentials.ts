import path from "node:path";

import {
  APPLICATION_TELEGRAM_CREDENTIAL_SCHEMA,
  parseApplicationTelegramBotToken,
  parseSaveApplicationTelegramCredentialsRequest,
  type ApplicationTelegramCredentials,
  type ApplicationTelegramCredentialSnapshot,
} from "../contracts/application-telegram-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageTelegramCredentialStore,
  type ApplicationTelegramCredentialStore,
} from "./safe-storage-telegram-credential-store";

/** Filename containing only the OS-encrypted Telegram Bot token. */
export const APPLICATION_TELEGRAM_CREDENTIAL_FILENAME = "telegram-credentials.bin";

/** Maximum decoded Telegram credential bootstrap passed to a trusted Python runtime. */
export const MAX_TELEGRAM_RUNTIME_BOOTSTRAP_BYTES = 128 * 1024;

/** Canonical and obsolete compatibility settings keys inspected during migration. */
export const APPLICATION_TELEGRAM_SETTINGS_KEYS = Object.freeze([
  "telegramBotConfig",
  "telegramBot",
] as const);

/** Diagnostics sink used without ever logging the Telegram Bot token. */
export interface ApplicationTelegramCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one Telegram credential service. */
export interface ApplicationTelegramCredentialServiceOptions {
  readonly credentials: ApplicationTelegramCredentialStore;
  readonly logger?: ApplicationTelegramCredentialLogger;
}

/** Paths and OS encryption required to bootstrap Telegram credential ownership. */
export interface BootstrapApplicationTelegramCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationTelegramCredentialLogger;
}

/** Result of removing Telegram credentials from one legacy settings document. */
export interface ReconciledLegacyTelegramCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after the encrypted Telegram Bot token changes. */
export type ApplicationTelegramCredentialChangedListener = (
  snapshot: ApplicationTelegramCredentialSnapshot,
) => void;

const TELEGRAM_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_token",
  "your-token",
  "telegram_bot_token",
  "telegram-bot-token",
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
  return TELEGRAM_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for the Telegram Bot token shared by trusted Python consumers. */
export class ApplicationTelegramCredentialService {
  private readonly logger: ApplicationTelegramCredentialLogger;
  private readonly listeners = new Set<ApplicationTelegramCredentialChangedListener>();
  private closed = false;

  /** Create a Telegram credential boundary over one encrypted store. */
  public constructor(private readonly options: ApplicationTelegramCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured state without returning the Telegram Bot token. */
  public getSnapshot(): ApplicationTelegramCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_TELEGRAM_CREDENTIAL_SCHEMA,
      configured: Boolean(this.readCredentials().botToken),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact Telegram Bot token replacement or explicit clear. */
  public save(value: unknown): ApplicationTelegramCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationTelegramCredentialsRequest(value);
    const hasMutation = request.botToken !== undefined || request.clear === true;
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system Telegram credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials: ApplicationTelegramCredentials = request.clear === true
      ? {}
      : request.botToken !== undefined
        ? { botToken: request.botToken }
        : previous;
    const changed = previous.botToken !== credentials.botToken;
    if (changed) this.writeCredentials(credentials);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy Telegram Bot tokens and return redacted compatibility settings.
   *
   * @param value Legacy settings object read or received by Main.
   * @param options Migration behavior for trusted writes.
   * @returns Redacted settings plus safe rewrite eligibility.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyTelegramCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const capturedTokens = new Set<string>();
    let containsInvalidToken = false;
    let foundTelegramConfig = false;

    for (const settingsKey of APPLICATION_TELEGRAM_SETTINGS_KEYS) {
      const node = isRecord(settings[settingsKey]) ? settings[settingsKey] : null;
      if (node === null) continue;
      foundTelegramConfig = true;
      const rawToken = node.bot_token;
      const token = typeof rawToken === "string" ? rawToken.trim() : "";
      if (!token || isCredentialPlaceholder(token)) continue;
      try {
        capturedTokens.add(parseApplicationTelegramBotToken(rawToken));
      } catch {
        containsInvalidToken = true;
      }
    }
    if (!foundTelegramConfig) return { settings, persistSanitized: false };
    if (capturedTokens.size > 1) containsInvalidToken = true;
    if (containsInvalidToken && options.requireSecureCapture) {
      throw new Error("Legacy Telegram credential entry is invalid or conflicting.");
    }

    const capturedToken = capturedTokens.size === 1 ? [...capturedTokens][0] : undefined;
    const previous = this.readCredentials(
      options.requireSecureCapture === true && capturedToken !== undefined,
    );
    let credentials = previous;
    let capturedSecurely = capturedToken === undefined && !containsInvalidToken;
    if (capturedToken !== undefined) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system Telegram credential encryption is unavailable.");
        }
      } else if (!containsInvalidToken) {
        credentials = { botToken: capturedToken };
        capturedSecurely = true;
      }
    }
    const changed = previous.botToken !== credentials.botToken;
    if (capturedSecurely && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }

    for (const settingsKey of APPLICATION_TELEGRAM_SETTINGS_KEYS) {
      const node = isRecord(settings[settingsKey]) ? settings[settingsKey] : null;
      if (node === null) continue;
      node.bot_token = "";
      node.credentialFieldsConfigured = credentials.botToken ? ["bot_token"] : [];
    }
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: capturedSecurely && sanitized };
  }

  /** Return a bounded Base64 credential envelope for one trusted Python consumer. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.telegram-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_TELEGRAM_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Telegram credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed Telegram credential changes. */
  public subscribe(listener: ApplicationTelegramCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted Telegram credential change. */
  private publish(snapshot: ApplicationTelegramCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationTelegramCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted Telegram credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted Telegram credential sidecar. */
  private writeCredentials(credentials: ApplicationTelegramCredentials): void {
    if (credentials.botToken) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject Telegram credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application Telegram credential service is closed.");
  }
}

/** Bootstrap the independent Telegram credential safeStorage boundary. */
export function bootstrapApplicationTelegramCredentials(
  options: BootstrapApplicationTelegramCredentialsOptions,
): ApplicationTelegramCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageTelegramCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_TELEGRAM_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationTelegramCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
