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
  parseApplicationImageHostCredentials,
  type ApplicationImageHostCredentials,
} from "../contracts/application-image-host-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted image-host credential file size accepted from disk. */
export const MAX_ENCRYPTED_IMAGE_HOST_CREDENTIAL_BYTES = 256 * 1024;

/** Credential storage interface consumed by the image-host runtime boundary. */
export interface ApplicationImageHostCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationImageHostCredentials;
  write(credentials: ApplicationImageHostCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted image-host credential file. */
export interface SafeStorageImageHostCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted image-host credential file owned only by Electron Main. */
export class SafeStorageImageHostCredentialStore implements ApplicationImageHostCredentialStore {
  private readonly filePath: string;

  /** Create an image-host credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageImageHostCredentialStoreOptions) {
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

  /** Read and decrypt all configured image-host credentials. */
  public read(): ApplicationImageHostCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_IMAGE_HOST_CREDENTIAL_BYTES) {
      throw new Error("Encrypted image-host credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted image-host credentials contain invalid JSON.");
    }
    return parseApplicationImageHostCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured image-host credentials. */
  public write(credentials: ApplicationImageHostCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationImageHostCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_IMAGE_HOST_CREDENTIAL_BYTES) {
      throw new Error("Encrypted image-host credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no image-host credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system image-host credential encryption is unavailable.");
    }
  }
}
