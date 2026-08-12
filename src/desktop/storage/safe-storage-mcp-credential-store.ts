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
  parseApplicationMcpCredentials,
  type ApplicationMcpCredentials,
} from "../contracts/application-mcp-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Maximum encrypted MCP credential file size accepted from disk. */
export const MAX_ENCRYPTED_MCP_CREDENTIAL_BYTES = 4 * 1024 * 1024;

/** Credential storage interface consumed by the MCP boundary. */
export interface ApplicationMcpCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationMcpCredentials;
  write(credentials: ApplicationMcpCredentials): void;
  clear(): void;
}

/** Options required to create one encrypted MCP credential file. */
export interface SafeStorageMcpCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** OS-encrypted MCP credential file owned only by Electron Main. */
export class SafeStorageMcpCredentialStore implements ApplicationMcpCredentialStore {
  private readonly filePath: string;

  /** Create an MCP credential adapter without accessing encryption eagerly. */
  public constructor(private readonly options: SafeStorageMcpCredentialStoreOptions) {
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

  /** Read and decrypt all configured MCP credentials. */
  public read(): ApplicationMcpCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_MCP_CREDENTIAL_BYTES) {
      throw new Error("Encrypted MCP credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted MCP credentials contain invalid JSON.");
    }
    return parseApplicationMcpCredentials(parsed);
  }

  /** Encrypt and atomically replace all configured MCP credentials. */
  public write(credentials: ApplicationMcpCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationMcpCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_MCP_CREDENTIAL_BYTES) {
      throw new Error("Encrypted MCP credentials exceed the storage budget.");
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

  /** Remove the encrypted sidecar when no MCP credentials remain. */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** Reject operations when Electron cannot provide protected encryption. */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system MCP credential encryption is unavailable.");
    }
  }
}
