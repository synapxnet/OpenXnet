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
  parseApplicationRepositoryCredentials,
  type ApplicationRepositoryCredentials,
} from "../contracts/application-repository-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted repository credential file size accepted from disk. */
export const MAX_ENCRYPTED_REPOSITORY_CREDENTIAL_BYTES = 256 * 1024;

/** Credential storage interface consumed by the repository ownership boundary. */
export interface ApplicationRepositoryCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationRepositoryCredentials;
  write(credentials: ApplicationRepositoryCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted repository credential file. */
export interface SafeStorageRepositoryCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted repository credential file owned only by Electron Main. */
export class SafeStorageRepositoryCredentialStore implements ApplicationRepositoryCredentialStore {
  private readonly filePath: string;

  /** Create a repository credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageRepositoryCredentialStoreOptions) {
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

  /** Read and decrypt all configured repository credentials. */
  public read(): ApplicationRepositoryCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_REPOSITORY_CREDENTIAL_BYTES) {
      throw new Error("Encrypted repository credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted repository credentials contain invalid JSON.");
    }
    return parseApplicationRepositoryCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured repository credentials. */
  public write(credentials: ApplicationRepositoryCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationRepositoryCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_REPOSITORY_CREDENTIAL_BYTES) {
      throw new Error("Encrypted repository credentials exceed the storage budget.");
    }
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, encrypted, { mode: 0o600 });
      renameSync(temporaryPath, this.filePath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }

  /** Remove the encrypted sidecar when no repository credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system repository credential encryption is unavailable.");
    }
  }
}
