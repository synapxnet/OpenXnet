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
  parseApplicationSqlCredentials,
  type ApplicationSqlCredentials,
} from "../contracts/application-sql-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** 加密 SQL 凭据文件允许的最大字节数。 */
export const MAX_ENCRYPTED_SQL_CREDENTIAL_BYTES = 128 * 1024;

/** SQL 凭据服务消费的持久化接口。 */
export interface ApplicationSqlCredentialStore {
  isAvailable(): boolean;
  read(): ApplicationSqlCredentials;
  write(credentials: ApplicationSqlCredentials): void;
  clear(): void;
}

/** 创建 SQL 加密存储所需的依赖。 */
export interface SafeStorageSqlCredentialStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/** 使用操作系统加密能力持久化 SQL 密钥，文件只由 Electron Main 访问。 */
export class SafeStorageSqlCredentialStore implements ApplicationSqlCredentialStore {
  private readonly filePath: string;

  /** 创建延迟读取的 SQL 凭据存储；输入文件路径和 safeStorage，无返回且不读取磁盘。 */
  public constructor(private readonly options: SafeStorageSqlCredentialStoreOptions) {
    this.filePath = path.resolve(options.filePath);
  }

  /** 判断是否存在非明文系统加密后端；无输入，返回布尔值，探测失败按不可用处理。 */
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

  /** 读取并解密全部 SQL 密钥；无输入，返回规范对象，文件或明文无效时抛出固定异常。 */
  public read(): ApplicationSqlCredentials {
    if (!existsSync(this.filePath)) return {};
    this.assertAvailable();
    const stats = statSync(this.filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ENCRYPTED_SQL_CREDENTIAL_BYTES) {
      throw new Error("Encrypted SQL credential file is invalid.");
    }
    const decrypted = this.options.safeStorage.decryptString(readFileSync(this.filePath));
    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted SQL credentials contain invalid JSON.");
    }
    return parseApplicationSqlCredentials(parsed);
  }

  /** 加密并原子替换全部 SQL 密钥；输入规范密钥，无返回，系统加密或写入失败时抛出异常。 */
  public write(credentials: ApplicationSqlCredentials): void {
    this.assertAvailable();
    const normalized = parseApplicationSqlCredentials(credentials);
    const encrypted = this.options.safeStorage.encryptString(JSON.stringify(normalized));
    if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_ENCRYPTED_SQL_CREDENTIAL_BYTES) {
      throw new Error("Encrypted SQL credentials exceed the storage budget.");
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

  /** 删除 SQL 加密凭据文件；无输入和返回，文件不存在时保持幂等。 */
  public clear(): void {
    rmSync(this.filePath, { force: true });
  }

  /** 断言系统加密可用；无输入和返回，不可用时抛出固定异常。 */
  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new Error("Operating-system SQL credential encryption is unavailable.");
    }
  }
}
