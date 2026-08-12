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
  parseApplicationVoiceCredentials,
  type ApplicationVoiceCredentials,
} from "../contracts/application-voice-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted voice credential file size accepted from disk. */
export const MAX_ENCRYPTED_VOICE_CREDENTIAL_BYTES = 4 * 1024 * 1024;

/** Credential storage interface consumed by the voice boundary. */
export interface ApplicationVoiceCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationVoiceCredentials;
  write(credentials: ApplicationVoiceCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted voice credential file. */
export interface SafeStorageVoiceCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted voice credential file owned only by Electron Main. */
export class SafeStorageVoiceCredentialStore implements ApplicationVoiceCredentialStore {
  private readonly filePath: string;

  /** Create a voice credential adapter without accessing encryption eagerly. */
  public constructor(private readonly options: SafeStorageVoiceCredentialStoreOptions) {
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

  /** Read and decrypt all configured voice credentials. */
  public read(): ApplicationVoiceCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_VOICE_CREDENTIAL_BYTES) {
      throw new Error("Encrypted voice credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted voice credentials contain invalid JSON.");
    }
    return parseApplicationVoiceCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured voice credentials. */
  public write(credentials: ApplicationVoiceCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationVoiceCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_VOICE_CREDENTIAL_BYTES) {
      throw new Error("Encrypted voice credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no voice credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system voice credential encryption is unavailable.");
    }
  }
}
