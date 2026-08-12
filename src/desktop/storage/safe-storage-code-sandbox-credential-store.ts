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
  parseApplicationCodeSandboxCredentials,
  type ApplicationCodeSandboxCredentials,
} from "../contracts/application-code-sandbox-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted code-sandbox credential file size accepted from disk. */
export const MAX_ENCRYPTED_CODE_SANDBOX_CREDENTIAL_BYTES = 128 * 1024;

/** Credential storage interface consumed by the code-sandbox runtime boundary. */
export interface ApplicationCodeSandboxCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationCodeSandboxCredentials;
  write(credentials: ApplicationCodeSandboxCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted code-sandbox credential file. */
export interface SafeStorageCodeSandboxCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted code-sandbox credential file owned only by Electron Main. */
export class SafeStorageCodeSandboxCredentialStore
implements ApplicationCodeSandboxCredentialStore {
  private readonly filePath: string;

  /** Create a code-sandbox credential adapter without eager decryption. */
  public constructor(private readonly options: SafeStorageCodeSandboxCredentialStoreOptions) {
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

  /** Read and decrypt all configured code-sandbox credentials. */
  public read(): ApplicationCodeSandboxCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_CODE_SANDBOX_CREDENTIAL_BYTES) {
      throw new Error("Encrypted code-sandbox credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted code-sandbox credentials contain invalid JSON.");
    }
    return parseApplicationCodeSandboxCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured code-sandbox credentials. */
  public write(credentials: ApplicationCodeSandboxCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationCodeSandboxCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_CODE_SANDBOX_CREDENTIAL_BYTES) {
      throw new Error("Encrypted code-sandbox credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no code-sandbox credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system code-sandbox credential encryption is unavailable.");
    }
  }
}
