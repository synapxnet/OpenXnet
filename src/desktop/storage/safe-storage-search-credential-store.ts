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

import {
  MAX_APPLICATION_SEARCH_CREDENTIAL_LENGTH,
  isApplicationSearchCredentialId,
  type ApplicationSearchCredentials,
} from "../contracts/application-search-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted search credential file size accepted from disk. */
export const MAX_ENCRYPTED_SEARCH_CREDENTIAL_BYTES = 256 * 1024;

/** Credential storage interface consumed by the search boundary. */
export interface ApplicationSearchCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationSearchCredentials;
  write(credentials: ApplicationSearchCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted search credential file. */
export interface SafeStorageSearchCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** Normalize one decrypted search credential map against the exact ID list. */
function normalizeSearchCredentials(value: unknown): ApplicationSearchCredentials {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Decrypted search credentials must contain an object.");
  }
  const credentials: Partial<Record<string, string>> = {};
  for (const [rawId, rawSecret] of Object.entries(value as Record<string, unknown>)) {
    if (!isApplicationSearchCredentialId(rawId) || typeof rawSecret !== "string") {
      throw new Error("Decrypted search credential entry is invalid.");
    }
    const secret = rawSecret.trim();
    if (
      secret.length > MAX_APPLICATION_SEARCH_CREDENTIAL_LENGTH
      || /[\u0000-\u001F\u007F]/.test(secret)
    ) {
      throw new Error("Decrypted search credential entry is invalid.");
    }
    if (secret) credentials[rawId] = secret;
  }
  return credentials as ApplicationSearchCredentials;
}

/** OS-encrypted search credential file owned only by Electron Main. */
export class SafeStorageSearchCredentialStore implements ApplicationSearchCredentialStore {
  private readonly filePath: string;

  /** Create a search credential adapter without accessing encryption eagerly. */
  public constructor(private readonly options: SafeStorageSearchCredentialStoreOptions) {
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

  /** Read and decrypt all configured search credentials. */
  public read(): ApplicationSearchCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_SEARCH_CREDENTIAL_BYTES) {
      throw new Error("Encrypted search credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted search credentials contain invalid JSON.");
    }
    return normalizeSearchCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured search credentials. */
  public write(credentials: ApplicationSearchCredentials): void {
    this.assertAvailable();
    const normalized = normalizeSearchCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_SEARCH_CREDENTIAL_BYTES) {
      throw new Error("Encrypted search credentials exceed the storage budget.");
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

  /** Remove every encrypted search credential. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject credential access when secure OS encryption is unavailable. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system search credential encryption is unavailable.");
    }
  }
}
