import path from "node:path";

import {
  APPLICATION_VOICE_CREDENTIAL_FIELDS,
  APPLICATION_VOICE_CREDENTIAL_SCHEMA,
  APPLICATION_VOICE_DEFAULT_SCOPE,
  MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_COUNT,
  createApplicationVoiceCredentialConfigured,
  parseApplicationVoiceCredentialScope,
  parseApplicationVoiceCredentialSecret,
  parseSaveApplicationVoiceCredentialsRequest,
  type ApplicationVoiceCredentialField,
  type ApplicationVoiceCredentials,
  type ApplicationVoiceCredentialSnapshot,
} from "../contracts/application-voice-credentials";
import {
  SafeStorageVoiceCredentialStore,
  type ApplicationVoiceCredentialStore,
} from "./safe-storage-voice-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Filename containing only OS-encrypted voice vendor credentials. */
export const APPLICATION_VOICE_CREDENTIAL_FILENAME = "voice-credentials.bin";

/** Maximum decoded credential bootstrap passed to the trusted voice backend. */
export const MAX_VOICE_RUNTIME_BOOTSTRAP_BYTES = 2 * 1024 * 1024;

/** Diagnostics sink used without ever logging voice credential values. */
export interface ApplicationVoiceCredentialLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies used to create one voice credential service. */
export interface ApplicationVoiceCredentialServiceOptions {
  readonly credentials: ApplicationVoiceCredentialStore;
  readonly logger?: ApplicationVoiceCredentialLogger;
}

/** Paths and OS encryption required to bootstrap voice credential ownership. */
export interface BootstrapApplicationVoiceCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly credentialPath?: string;
  readonly logger?: ApplicationVoiceCredentialLogger;
}

/** Result of removing voice credentials from one legacy settings document. */
export interface ReconciledLegacyVoiceCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Listener notified after encrypted voice credentials change. */
export type ApplicationVoiceCredentialChangedListener = (
  snapshot: ApplicationVoiceCredentialSnapshot,
) => void;

const VOICE_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
  "your_secret_key",
  "your-secret-key",
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
  return VOICE_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Main-owned boundary for TTS and ASR vendor credentials. */
export class ApplicationVoiceCredentialService {
  private readonly logger: ApplicationVoiceCredentialLogger;
  private readonly listeners = new Set<ApplicationVoiceCredentialChangedListener>();
  private closed = false;

  /** Create a voice credential boundary over one initialized encrypted store. */
  public constructor(private readonly options: ApplicationVoiceCredentialServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** Return configured flags without returning any credential value. */
  public getSnapshot(): ApplicationVoiceCredentialSnapshot {
    this.assertOpen();
    const credentials = this.readCredentials();
    return {
      schema: APPLICATION_VOICE_CREDENTIAL_SCHEMA,
      configured: createApplicationVoiceCredentialConfigured(credentials),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
    };
  }

  /** Apply one exact scoped credential update and explicit clear list. */
  public save(value: unknown): ApplicationVoiceCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationVoiceCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system voice credential encryption is unavailable.");
    }
    const previousCredentials = this.readCredentials(hasMutation);
    const credentials: Record<string, Record<string, string>> = cloneJson(previousCredentials);
    for (const [scope, fields] of Object.entries(request.credentials || {})) {
      credentials[scope] = { ...(credentials[scope] || {}), ...fields };
    }
    for (const entry of request.clear || []) {
      if (entry.fields === undefined) {
        delete credentials[entry.scope];
        continue;
      }
      for (const field of entry.fields) delete credentials[entry.scope]?.[field];
      if (Object.keys(credentials[entry.scope] || {}).length === 0) delete credentials[entry.scope];
    }
    const changed = JSON.stringify(previousCredentials) !== JSON.stringify(credentials);
    if (changed) this.writeCredentials(credentials as ApplicationVoiceCredentials);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /**
   * Capture legacy TTS vendor fields and return only redacted compatibility settings.
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
  ): ReconciledLegacyVoiceCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const ttsSettings = isRecord(settings.ttsSettings) ? settings.ttsSettings : null;
    if (ttsSettings === null) return { settings, persistSanitized: false };

    const scopeNodes: Array<readonly [string, Record<string, unknown>]> = [
      [APPLICATION_VOICE_DEFAULT_SCOPE, ttsSettings],
    ];
    const newtts = isRecord(ttsSettings.newtts) ? ttsSettings.newtts : null;
    if (newtts !== null) {
      for (const [scope, node] of Object.entries(newtts)) {
        if (isRecord(node)) scopeNodes.push([scope, node]);
      }
    }

    const captured: Record<string, Partial<Record<ApplicationVoiceCredentialField, string>>> = {};
    const activeScopes = new Set<string>([APPLICATION_VOICE_DEFAULT_SCOPE]);
    let containsInvalidSecret = scopeNodes.length - 1 > MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_COUNT;
    for (const [rawScope, node] of scopeNodes) {
      let scope: string;
      try {
        scope = parseApplicationVoiceCredentialScope(rawScope);
        activeScopes.add(scope);
      } catch {
        if (APPLICATION_VOICE_CREDENTIAL_FIELDS.some((field) => Boolean(node[field]))) {
          containsInvalidSecret = true;
        }
        for (const field of APPLICATION_VOICE_CREDENTIAL_FIELDS) node[field] = "";
        continue;
      }
      for (const field of APPLICATION_VOICE_CREDENTIAL_FIELDS) {
        const rawSecret = typeof node[field] === "string" ? node[field] : "";
        const secret = rawSecret.trim();
        if (!secret || isCredentialPlaceholder(secret)) continue;
        try {
          const scopeCredentials = captured[scope] || {};
          scopeCredentials[field] = parseApplicationVoiceCredentialSecret(field, rawSecret);
          captured[scope] = scopeCredentials;
        } catch {
          containsInvalidSecret = true;
        }
      }
    }

    const containsSecrets = Object.values(captured).some((fields) => Object.keys(fields).length > 0);
    if (containsInvalidSecret && options.requireSecureCapture === true) {
      throw new Error("Legacy voice credential entry is invalid.");
    }
    const previousCredentials = this.readCredentials(
      options.requireSecureCapture === true && (containsSecrets || options.pruneMissingScopes === true),
    );
    let credentials: ApplicationVoiceCredentials = previousCredentials;
    let capturedSecurely = !containsSecrets && !containsInvalidSecret;
    if (containsSecrets) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture === true) {
          throw new Error("Operating-system voice credential encryption is unavailable.");
        }
      } else {
        const merged: Record<string, Record<string, string>> = cloneJson(previousCredentials);
        for (const [scope, fields] of Object.entries(captured)) {
          merged[scope] = { ...(merged[scope] || {}), ...fields };
        }
        credentials = merged as ApplicationVoiceCredentials;
        capturedSecurely = !containsInvalidSecret;
      }
    }
    if (capturedSecurely && options.pruneMissingScopes === true) {
      credentials = Object.fromEntries(
        Object.entries(credentials).filter(([scope]) => activeScopes.has(scope)),
      );
    }
    const credentialsChanged = JSON.stringify(previousCredentials) !== JSON.stringify(credentials);
    if (capturedSecurely && credentialsChanged) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }

    const configured = createApplicationVoiceCredentialConfigured(credentials);
    for (const [rawScope, node] of scopeNodes) {
      for (const field of APPLICATION_VOICE_CREDENTIAL_FIELDS) {
        node[field] = "";
        node[`${field}_configured`] = configured[rawScope]?.[field] === true;
      }
    }
    settings.ttsSettings = ttsSettings;
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return {
      settings,
      persistSanitized: capturedSecurely && sanitized,
    };
  }

  /** Return a bounded Base64 credential envelope for the trusted voice backend. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const serialized = JSON.stringify({
      schema: "openxnet.voice-credentials.runtime.v1",
      credentials: this.readCredentials(),
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_VOICE_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Voice credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed voice credential changes. */
  public subscribe(listener: ApplicationVoiceCredentialChangedListener): () => void {
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

  /** Notify observers after one encrypted credential change. */
  private publish(snapshot: ApplicationVoiceCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Read encrypted credentials without exposing corruption details to public callers. */
  private readCredentials(strict = false): ApplicationVoiceCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      if (strict) throw error;
      this.logger.warn("Encrypted voice credentials could not be read.", error);
      return {};
    }
  }

  /** Replace or clear the encrypted voice credential sidecar. */
  private writeCredentials(credentials: ApplicationVoiceCredentials): void {
    if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
    else this.options.credentials.clear();
  }

  /** Reject voice credential operations after service shutdown. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application voice credential service is closed.");
  }
}

/** Bootstrap the independent voice credential safeStorage boundary. */
export function bootstrapApplicationVoiceCredentials(
  options: BootstrapApplicationVoiceCredentialsOptions,
): ApplicationVoiceCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageVoiceCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_VOICE_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationVoiceCredentialService({
    credentials,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
