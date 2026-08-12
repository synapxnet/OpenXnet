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
  parseApplicationHttpToolCredentials,
  type ApplicationHttpToolCredentials,
} from "../contracts/application-http-tool-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted custom HTTP credential file size accepted from disk. */
export const MAX_ENCRYPTED_HTTP_TOOL_CREDENTIAL_BYTES = 4 * 1024 * 1024;

/** Credential storage interface consumed by the custom HTTP boundary. */
export interface ApplicationHttpToolCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationHttpToolCredentials;
  write(credentials: ApplicationHttpToolCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted custom HTTP credential file. */
export interface SafeStorageHttpToolCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted custom HTTP credential file owned only by Electron Main. */
export class SafeStorageHttpToolCredentialStore implements ApplicationHttpToolCredentialStore {
  private readonly filePath: string;

  /** Create a custom HTTP credential adapter without accessing encryption eagerly. */
  public constructor(private readonly options: SafeStorageHttpToolCredentialStoreOptions) {
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

  /** Read and decrypt all configured custom HTTP credentials. */
  public read(): ApplicationHttpToolCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_HTTP_TOOL_CREDENTIAL_BYTES) {
      throw new Error("Encrypted custom HTTP credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted custom HTTP credentials contain invalid JSON.");
    }
    return parseApplicationHttpToolCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured custom HTTP credentials. */
  public write(credentials: ApplicationHttpToolCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationHttpToolCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_HTTP_TOOL_CREDENTIAL_BYTES) {
      throw new Error("Encrypted custom HTTP credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no custom HTTP credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system custom HTTP credential encryption is unavailable.");
    }
  }
}
