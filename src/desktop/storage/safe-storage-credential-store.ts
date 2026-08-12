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
  normalizeApplicationGatewayCredentialBootstrap,
  type ApplicationAuthCredentials,
} from "../contracts/application-auth";

/** Maximum encrypted credential file size accepted from disk. */
export const MAX_ENCRYPTED_CREDENTIAL_BYTES = 256 * 1024;

/** Minimal Electron safeStorage surface required by the credential adapter. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** Credential storage interface consumed by the authentication service. */
export interface ApplicationCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationAuthCredentials | null;
  write(credentials: ApplicationAuthCredentials): void;
  clear(): void;
}

/** Options used to create one OS-encrypted credential file. */
export interface SafeStorageCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize decrypted credential JSON before returning it to Core.
 *
 * @param value Candidate decrypted value.
 * @returns Bounded credential payload.
 */
function normalizeCredentials(value: unknown): ApplicationAuthCredentials {
  const record = isRecord(value) ? value : {};
  const accessToken = typeof record.accessToken === "string" ? record.accessToken.trim() : "";
  const refreshToken = typeof record.refreshToken === "string" ? record.refreshToken.trim() : "";
  if (accessToken.length > 32_768 || refreshToken.length > 32_768) {
    throw new Error("Decrypted authentication credentials exceed the token budget.");
  }
  return {
    accessToken,
    refreshToken,
    gatewayBootstrap: normalizeApplicationGatewayCredentialBootstrap(record.gatewayBootstrap),
  };
}

/** OS-backed encrypted credential file used by Desktop Core authentication. */
export class SafeStorageCredentialStore implements ApplicationCredentialStore {
  private readonly filePath: string;

  /**
   * Create a credential adapter without accessing encryption before Electron is ready.
   *
   * @param options Credential path and Electron safeStorage implementation.
   */
  public constructor(private readonly options: SafeStorageCredentialStoreOptions) {
    this.filePath = path.resolve(options.filePath);
  }

  /** Return whether the operating-system encryption backend is currently available. */
  public isAvailable(): boolean {
    if (!this.options.safeStorage.isEncryptionAvailable()) {
      return false;
    }
    let backend: string | undefined;
    try {
      backend = this.options.safeStorage.getSelectedStorageBackend?.();
    } catch {
      backend = undefined;
    }
    return backend !== "basic_text";
  }

  /** Read and decrypt the current credential payload when one exists. */
  public read(): ApplicationAuthCredentials | null {
    if (!existsSync(this.filePath)) {
      return null;
    }
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_CREDENTIAL_BYTES) {
      throw new Error("Encrypted authentication credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted authentication credentials contain invalid JSON.");
    }
    return normalizeCredentials(parsed);
  }

  /** Encrypt and atomically replace the current credential payload. */
  public write(credentials: ApplicationAuthCredentials): void {
    this.assertAvailable();
    const normalized = normalizeCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_CREDENTIAL_BYTES) {
      throw new Error("Encrypted authentication credentials exceed the storage budget.");
    }
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, encrypted, { flag: "wx", mode: 0o600 });
      renameSync(temporaryPath, this.filePath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }

  /** Remove encrypted credentials during logout or invalid-session cleanup. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject credential access while the operating-system encryption backend is unavailable. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system credential encryption is unavailable.");
    }
  }
}
