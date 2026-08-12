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
  parseApplicationTelegramCredentials,
  type ApplicationTelegramCredentials,
} from "../contracts/application-telegram-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted Telegram credential file size accepted from disk. */
export const MAX_ENCRYPTED_TELEGRAM_CREDENTIAL_BYTES = 256 * 1024;

/** Credential storage interface consumed by the Telegram runtime boundary. */
export interface ApplicationTelegramCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationTelegramCredentials;
  write(credentials: ApplicationTelegramCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted Telegram credential file. */
export interface SafeStorageTelegramCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted Telegram credential file owned only by Electron Main. */
export class SafeStorageTelegramCredentialStore implements ApplicationTelegramCredentialStore {
  private readonly filePath: string;

  /** Create a Telegram credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageTelegramCredentialStoreOptions) {
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

  /** Read and decrypt the configured Telegram Bot token. */
  public read(): ApplicationTelegramCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_TELEGRAM_CREDENTIAL_BYTES) {
      throw new Error("Encrypted Telegram credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted Telegram credentials contain invalid JSON.");
    }
    return parseApplicationTelegramCredentials(parsed);
  }

  /** Encrypt and atomically replace the configured Telegram Bot token. */
  public write(credentials: ApplicationTelegramCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationTelegramCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_TELEGRAM_CREDENTIAL_BYTES) {
      throw new Error("Encrypted Telegram credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no Telegram credential remains. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system Telegram credential encryption is unavailable.");
    }
  }
}
