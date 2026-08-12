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
  parseApplicationConnectorCredentials,
  type ApplicationConnectorCredentials,
} from "../contracts/application-connector-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted Connector Worker credential file size accepted from disk. */
export const MAX_ENCRYPTED_CONNECTOR_CREDENTIAL_BYTES = 1024 * 1024;

/** Credential storage interface consumed by the Connector Worker boundary. */
export interface ApplicationConnectorCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationConnectorCredentials;
  write(credentials: ApplicationConnectorCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted Connector Worker credential file. */
export interface SafeStorageConnectorCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted Connector Worker credential file owned only by Electron Main. */
export class SafeStorageConnectorCredentialStore implements ApplicationConnectorCredentialStore {
  private readonly filePath: string;

  /** Create a Connector Worker credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageConnectorCredentialStoreOptions) {
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

  /** Read and decrypt all configured Connector Worker credentials. */
  public read(): ApplicationConnectorCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_CONNECTOR_CREDENTIAL_BYTES) {
      throw new Error("Encrypted Connector Worker credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted Connector Worker credentials contain invalid JSON.");
    }
    return parseApplicationConnectorCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured Connector Worker credentials. */
  public write(credentials: ApplicationConnectorCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationConnectorCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_CONNECTOR_CREDENTIAL_BYTES) {
      throw new Error("Encrypted Connector Worker credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no Connector Worker credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system Connector Worker credential encryption is unavailable.");
    }
  }
}
