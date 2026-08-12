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
  parseApplicationComfyUiCredentials,
  type ApplicationComfyUiCredentials,
} from "../contracts/application-comfyui-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted ComfyUI credential file size accepted from disk. */
export const MAX_ENCRYPTED_COMFYUI_CREDENTIAL_BYTES = 128 * 1024;

/** Credential storage interface consumed by the ComfyUI runtime boundary. */
export interface ApplicationComfyUiCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationComfyUiCredentials;
  write(credentials: ApplicationComfyUiCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted ComfyUI credential file. */
export interface SafeStorageComfyUiCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted ComfyUI credential file owned only by Electron Main. */
export class SafeStorageComfyUiCredentialStore implements ApplicationComfyUiCredentialStore {
  private readonly filePath: string;

  /** Create a ComfyUI credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageComfyUiCredentialStoreOptions) {
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

  /** Read and decrypt all configured ComfyUI credentials. */
  public read(): ApplicationComfyUiCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_COMFYUI_CREDENTIAL_BYTES) {
      throw new Error("Encrypted ComfyUI credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted ComfyUI credentials contain invalid JSON.");
    }
    return parseApplicationComfyUiCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured ComfyUI credentials. */
  public write(credentials: ApplicationComfyUiCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationComfyUiCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_COMFYUI_CREDENTIAL_BYTES) {
      throw new Error("Encrypted ComfyUI credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no ComfyUI credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system ComfyUI credential encryption is unavailable.");
    }
  }
}
