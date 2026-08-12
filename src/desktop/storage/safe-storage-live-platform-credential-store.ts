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
  parseApplicationLivePlatformCredentials,
  type ApplicationLivePlatformCredentials,
} from "../contracts/application-live-platform-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted live-platform credential file size accepted from disk. */
export const MAX_ENCRYPTED_LIVE_PLATFORM_CREDENTIAL_BYTES = 512 * 1024;

/** Credential storage interface consumed by the live-platform runtime boundary. */
export interface ApplicationLivePlatformCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationLivePlatformCredentials;
  write(credentials: ApplicationLivePlatformCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted live-platform credential file. */
export interface SafeStorageLivePlatformCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted live-platform credential file owned only by Electron Main. */
export class SafeStorageLivePlatformCredentialStore
implements ApplicationLivePlatformCredentialStore {
  private readonly filePath: string;

  /** Create a live-platform credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageLivePlatformCredentialStoreOptions) {
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

  /** Read and decrypt all configured live-platform credentials. */
  public read(): ApplicationLivePlatformCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_LIVE_PLATFORM_CREDENTIAL_BYTES) {
      throw new Error("Encrypted live-platform credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted live-platform credentials contain invalid JSON.");
    }
    return parseApplicationLivePlatformCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured live-platform credentials. */
  public write(credentials: ApplicationLivePlatformCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationLivePlatformCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_LIVE_PLATFORM_CREDENTIAL_BYTES) {
      throw new Error("Encrypted live-platform credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no live-platform credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system live-platform credential encryption is unavailable.");
    }
  }
}
