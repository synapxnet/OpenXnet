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
  parseApplicationDeliveryCredentials,
  type ApplicationDeliveryCredentials,
} from "../contracts/application-delivery-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted terminal-delivery credential file size accepted from disk. */
export const MAX_ENCRYPTED_DELIVERY_CREDENTIAL_BYTES = 4 * 1024 * 1024;

/** Storage interface consumed by the terminal-delivery credential boundary. */
export interface ApplicationDeliveryCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationDeliveryCredentials;
  write(credentials: ApplicationDeliveryCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted terminal-delivery credential file. */
export interface SafeStorageDeliveryCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted terminal-delivery credential file owned only by Electron Main. */
export class SafeStorageDeliveryCredentialStore implements ApplicationDeliveryCredentialStore {
  private readonly filePath: string;

  /** Create a terminal-delivery credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageDeliveryCredentialStoreOptions) {
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

  /** Read and decrypt every configured terminal-delivery credential scope. */
  public read(): ApplicationDeliveryCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_DELIVERY_CREDENTIAL_BYTES) {
      throw new Error("Encrypted delivery credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted delivery credentials contain invalid JSON.");
    }
    return parseApplicationDeliveryCredentials(parsed);
  }

  /** Encrypt and atomically replace every terminal-delivery credential scope. */
  public write(credentials: ApplicationDeliveryCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationDeliveryCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_DELIVERY_CREDENTIAL_BYTES) {
      throw new Error("Encrypted delivery credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no delivery credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system delivery credential encryption is unavailable.");
    }
  }
}
