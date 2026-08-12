import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted provider credential file size accepted from disk. */
export const MAX_ENCRYPTED_PROVIDER_CREDENTIAL_BYTES = 2 * 1024 * 1024;

/** Provider API keys indexed by stable provider identifier. */
export type ApplicationProviderCredentials = Readonly<Record<string, string>>;

/** Credential storage interface consumed by provider settings. */
export interface ApplicationProviderCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationProviderCredentials;
  write(credentials: ApplicationProviderCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted provider credential file. */
export interface SafeStorageProviderCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** Normalize one decrypted provider credential map. */
function normalizeProviderCredentials(value: unknown): ApplicationProviderCredentials {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Decrypted provider credentials must contain an object.");
  }
  const credentials: Record<string, string> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 128) {
    throw new Error("Decrypted provider credentials exceed the provider budget.");
  }
  for (const [rawId, rawSecret] of entries) {
    const providerId = String(rawId || "").trim();
    const secret = typeof rawSecret === "string" ? rawSecret.trim() : "";
    if (
      !providerId
      || providerId.length > 128
      || /[\u0000-\u001F\u007F]/.test(providerId)
      || secret.length > 65_536
    ) {
      throw new Error("Decrypted provider credentials are invalid.");
    }
    if (secret) credentials[providerId] = secret;
  }
  return credentials;
}

/** OS-encrypted provider credential file owned by Electron Main. */
export class SafeStorageProviderCredentialStore implements ApplicationProviderCredentialStore {
  private readonly filePath: string;

  /** Create a provider credential adapter without touching encryption eagerly. */
  public constructor(private readonly options: SafeStorageProviderCredentialStoreOptions) {
    this.filePath = path.resolve(options.filePath);
  }

  /** Return whether a non-plaintext operating-system encryption backend is available. */
  public isAvailable(): boolean {
    if (!this.options.safeStorage.isEncryptionAvailable()) return false;
    let backend: string | undefined;
    try {
      backend = this.options.safeStorage.getSelectedStorageBackend?.();
    } catch {
      backend = undefined;
    }
    return backend !== "basic_text";
  }

  /** Read and decrypt all configured provider credentials. */
  public read(): ApplicationProviderCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_PROVIDER_CREDENTIAL_BYTES) {
      throw new Error("Encrypted provider credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted provider credentials contain invalid JSON.");
    }
    return normalizeProviderCredentials(parsed);
  }

  /** Encrypt and atomically replace all provider credentials. */
  public write(credentials: ApplicationProviderCredentials): void {
    this.assertAvailable();
    const normalized = normalizeProviderCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_PROVIDER_CREDENTIAL_BYTES) {
      throw new Error("Encrypted provider credentials exceed the storage budget.");
    }
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, encrypted, { flag: "wx", mode: 0o600 });
      renameSync(temporaryPath, this.filePath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }

  /** Remove every encrypted provider credential. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject credential access when secure OS encryption is unavailable. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system provider credential encryption is unavailable.");
    }
  }
}
