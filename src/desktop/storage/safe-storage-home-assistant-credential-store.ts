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
  parseApplicationHomeAssistantCredentials,
  type ApplicationHomeAssistantCredentials,
} from "../contracts/application-home-assistant-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted Home Assistant credential file size accepted from disk. */
export const MAX_ENCRYPTED_HOME_ASSISTANT_CREDENTIAL_BYTES = 128 * 1024;

/** Credential storage interface consumed by the Home Assistant runtime boundary. */
export interface ApplicationHomeAssistantCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationHomeAssistantCredentials;
  write(credentials: ApplicationHomeAssistantCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted Home Assistant credential file. */
export interface SafeStorageHomeAssistantCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted Home Assistant credential file owned only by Electron Main. */
export class SafeStorageHomeAssistantCredentialStore
implements ApplicationHomeAssistantCredentialStore {
  private readonly filePath: string;

  /** Create a Home Assistant credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageHomeAssistantCredentialStoreOptions) {
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

  /** Read and decrypt all configured Home Assistant credentials. */
  public read(): ApplicationHomeAssistantCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_HOME_ASSISTANT_CREDENTIAL_BYTES) {
      throw new Error("Encrypted Home Assistant credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted Home Assistant credentials contain invalid JSON.");
    }
    return parseApplicationHomeAssistantCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured Home Assistant credentials. */
  public write(credentials: ApplicationHomeAssistantCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationHomeAssistantCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_HOME_ASSISTANT_CREDENTIAL_BYTES) {
      throw new Error("Encrypted Home Assistant credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no Home Assistant credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system Home Assistant credential encryption is unavailable.");
    }
  }
}
