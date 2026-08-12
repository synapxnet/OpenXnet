import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  APPLICATION_SQL_CREDENTIAL_SCHEMA,
  createApplicationSqlCredentialConfigured,
  parseApplicationSqlCredentialSecret,
  parseApplicationSqlCredentials,
  parseSaveApplicationSqlCredentialsRequest,
  type ApplicationSqlCredentials,
  type ApplicationSqlCredentialSnapshot,
  type ApplicationSqliteDatabaseAuthorization,
} from "../contracts/application-sql-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import {
  SafeStorageSqlCredentialStore,
  type ApplicationSqlCredentialStore,
} from "./safe-storage-sql-credential-store";

/** 仅保存加密 SQL 口令的文件名。 */
export const APPLICATION_SQL_CREDENTIAL_FILENAME = "sql-credentials.bin";

/** 保存用户明确授予的 SQLite 路径映射文件名。 */
export const APPLICATION_SQL_DATABASE_AUTHORIZATION_FILENAME = "sql-database-authorization.json";

/** SQL Worker 与兼容后端启动凭据包允许的最大字节数。 */
export const MAX_SQL_RUNTIME_BOOTSTRAP_BYTES = 128 * 1024;

/** SQLite 授权记录允许的最大文件字节数。 */
export const MAX_SQL_DATABASE_AUTHORIZATION_BYTES = 32 * 1024;

/** Main 内部持有的 SQLite 授权记录。 */
interface SqliteDatabaseAuthorizationRecord {
  readonly schema: "openxnet.sql-database-authorization.v1";
  readonly databaseId: string;
  readonly path: string;
  readonly authorizedAt: string;
}

/** SQL 凭据服务的脱敏诊断接口。 */
export interface ApplicationSqlCredentialLogger {
  warn(message: string): void;
}

/** SQL 凭据与文件授权服务依赖。 */
export interface ApplicationSqlCredentialServiceOptions {
  readonly credentials: ApplicationSqlCredentialStore;
  readonly authorizationPath: string;
  readonly selectSqliteDatabase: () => Promise<string | null>;
  readonly logger?: ApplicationSqlCredentialLogger;
}

/** 启动 SQL 凭据服务所需路径与系统加密能力。 */
export interface BootstrapApplicationSqlCredentialsOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly selectSqliteDatabase: () => Promise<string | null>;
  readonly credentialPath?: string;
  readonly authorizationPath?: string;
  readonly logger?: ApplicationSqlCredentialLogger;
}

/** 从旧设置迁移 SQL 口令后的结果。 */
export interface ReconciledLegacySqlCredentialSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** SQL 口令或数据库授权变化后的监听器。 */
export type ApplicationSqlCredentialChangedListener = (
  snapshot: ApplicationSqlCredentialSnapshot,
) => void;

/** 判断未知值是否为普通对象；输入未知值，返回布尔值，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 深拷贝 JSON 兼容值；输入可序列化值，返回分离副本，序列化失败时向调用方抛出异常。 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 校验数据库授权标识；输入未知值，返回规范文本，格式无效时抛出 Error。 */
function parseDatabaseId(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  ) {
    throw new Error("SQL database authorization identifier is invalid.");
  }
  return value;
}

/** Main 持有的 SQL 凭据和 SQLite 文件授权边界。 */
export class ApplicationSqlCredentialService {
  private readonly logger: ApplicationSqlCredentialLogger;
  private readonly authorizationPath: string;
  private readonly listeners = new Set<ApplicationSqlCredentialChangedListener>();
  private closed = false;

  /** 创建 SQL 安全边界；输入存储、文件选择器与诊断依赖，无返回且不读取口令。 */
  public constructor(private readonly options: ApplicationSqlCredentialServiceOptions) {
    this.logger = options.logger ?? console;
    this.authorizationPath = path.resolve(options.authorizationPath);
  }

  /** 返回脱敏凭据与当前文件授权；无输入，返回固定快照，不包含口令或 Worker 路径字段。 */
  public getSnapshot(): ApplicationSqlCredentialSnapshot {
    this.assertOpen();
    return {
      schema: APPLICATION_SQL_CREDENTIAL_SCHEMA,
      configured: createApplicationSqlCredentialConfigured(this.readCredentials()),
      secureStorage: this.options.credentials.isAvailable()
        ? "desktop-safe-storage"
        : "unavailable",
      database: this.toPublicAuthorization(this.readAuthorization()),
    };
  }

  /** 保存或清除 SQL 口令；输入未知请求，返回脱敏快照，校验或加密失败时抛出固定异常。 */
  public save(value: unknown): ApplicationSqlCredentialSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationSqlCredentialsRequest(value);
    const hasMutation = Boolean(request.credentials && Object.keys(request.credentials).length > 0)
      || Boolean(request.clear && request.clear.length > 0);
    if (hasMutation && !this.options.credentials.isAvailable()) {
      throw new Error("Operating-system SQL credential encryption is unavailable.");
    }
    const previous = this.readCredentials(hasMutation);
    const credentials = cloneJson(previous) as Record<string, string>;
    Object.assign(credentials, request.credentials || {});
    for (const field of request.clear || []) delete credentials[field];
    const normalized = parseApplicationSqlCredentials(credentials);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (changed) this.writeCredentials(normalized);
    const snapshot = this.getSnapshot();
    if (changed) this.publish(snapshot);
    return snapshot;
  }

  /** 打开系统文件选择器并授权一个 SQLite 文件；无输入，返回最新快照，取消选择时保留原授权。 */
  public async selectDatabase(): Promise<ApplicationSqlCredentialSnapshot> {
    this.assertOpen();
    const selectedPath = await this.options.selectSqliteDatabase();
    if (selectedPath === null) return this.getSnapshot();
    const resolvedPath = this.validateSelectedDatabasePath(selectedPath);
    const previous = this.readAuthorization();
    if (previous?.path === resolvedPath) return this.getSnapshot();
    const record: SqliteDatabaseAuthorizationRecord = {
      schema: "openxnet.sql-database-authorization.v1",
      databaseId: randomUUID(),
      path: resolvedPath,
      authorizedAt: new Date().toISOString(),
    };
    this.writeAuthorization(record);
    const snapshot = this.getSnapshot();
    this.publish(snapshot);
    return snapshot;
  }

  /** 捕获旧设置中的 SQL 口令并规范 SQLite 路径键；输入设置，返回脱敏副本和持久化标志。 */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacySqlCredentialSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const node = isRecord(settings.sqlSettings) ? settings.sqlSettings : null;
    if (node === null) return { settings, persistSanitized: false };
    const candidate = typeof node.password === "string" ? node.password.trim() : "";
    let secret = "";
    let invalid = node.password !== undefined && node.password !== null && typeof node.password !== "string";
    if (candidate) {
      try {
        secret = parseApplicationSqlCredentialSecret(candidate);
      } catch {
        invalid = true;
      }
    }
    if (invalid && options.requireSecureCapture) {
      throw new Error("Legacy SQL credential entry is invalid.");
    }
    const previous = this.readCredentials(options.requireSecureCapture === true && Boolean(secret));
    let credentials = previous;
    let captured = !secret && !invalid;
    if (secret) {
      if (!this.options.credentials.isAvailable()) {
        if (options.requireSecureCapture) {
          throw new Error("Operating-system SQL credential encryption is unavailable.");
        }
      } else if (!invalid) {
        credentials = parseApplicationSqlCredentials({ ...previous, password: secret });
        captured = true;
      }
    }
    const changed = JSON.stringify(previous) !== JSON.stringify(credentials);
    if (captured && changed) {
      this.writeCredentials(credentials);
      this.publish(this.getSnapshot());
    }
    node.password = "";
    node.sqlCredentialFieldsConfigured = createApplicationSqlCredentialConfigured(credentials);
    if (!String(node.dbpath || "").trim() && typeof node.dbPath === "string") {
      node.dbpath = node.dbPath.trim();
    }
    delete node.dbPath;
    const sanitized = JSON.stringify(settings) !== JSON.stringify(value);
    return { settings, persistSanitized: captured && sanitized };
  }

  /** 构建 SQL Worker 启动包；无输入，返回有界 Base64，内容仅供 Worker 与兼容后端读取。 */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const authorization = this.readAuthorization();
    const serialized = JSON.stringify({
      schema: "openxnet.sql-credentials.runtime.v1",
      credentials: this.readCredentials(),
      databases: authorization === null
        ? {}
        : { [authorization.databaseId]: authorization.path },
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_SQL_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("SQL credential runtime bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** 订阅 SQL 安全状态变化；输入监听器，返回取消函数，服务关闭后调用会抛出 Error。 */
  public subscribe(listener: ApplicationSqlCredentialChangedListener): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 关闭 SQL 服务并丢弃监听器；无输入和返回，可重复调用且不删除持久化数据。 */
  public close(): void {
    if (this.closed) return;
    this.listeners.clear();
    this.closed = true;
  }

  /** 校验用户选择的 SQLite 文件；输入路径，返回真实绝对路径，不存在、非文件或路径超限时抛出 Error。 */
  private validateSelectedDatabasePath(value: string): string {
    const resolved = realpathSync(path.resolve(value));
    const stats = statSync(resolved);
    if (!stats.isFile() || Buffer.byteLength(resolved, "utf8") > 16 * 1024) {
      throw new Error("Selected SQLite database is invalid.");
    }
    return resolved;
  }

  /** 转换内部授权为 Renderer 元数据；输入授权或空值，返回公开投影，不修改记录。 */
  private toPublicAuthorization(
    record: SqliteDatabaseAuthorizationRecord | null,
  ): ApplicationSqliteDatabaseAuthorization | null {
    if (record === null) return null;
    return {
      databaseId: record.databaseId,
      displayPath: record.path,
      filename: path.basename(record.path),
    };
  }

  /** 读取 SQLite 授权记录；无输入，返回已校验记录或空值，损坏记录仅输出脱敏诊断。 */
  private readAuthorization(): SqliteDatabaseAuthorizationRecord | null {
    if (!existsSync(this.authorizationPath)) return null;
    try {
      const stats = statSync(this.authorizationPath);
      if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_SQL_DATABASE_AUTHORIZATION_BYTES) {
        throw new Error("invalid authorization file");
      }
      const value = JSON.parse(readFileSync(this.authorizationPath, "utf8")) as unknown;
      if (
        !isRecord(value)
        || Object.keys(value).sort().join(",") !== "authorizedAt,databaseId,path,schema"
        || value.schema !== "openxnet.sql-database-authorization.v1"
        || typeof value.path !== "string"
        || !path.isAbsolute(value.path)
        || typeof value.authorizedAt !== "string"
      ) {
        throw new Error("invalid authorization record");
      }
      return {
        schema: value.schema,
        databaseId: parseDatabaseId(value.databaseId),
        path: value.path,
        authorizedAt: value.authorizedAt,
      };
    } catch {
      this.logger.warn("SQLite database authorization could not be read.");
      return null;
    }
  }

  /** 原子持久化 SQLite 授权；输入已校验记录，无返回，写入失败时清理临时文件并抛出异常。 */
  private writeAuthorization(record: SqliteDatabaseAuthorizationRecord): void {
    mkdirSync(path.dirname(this.authorizationPath), { recursive: true });
    const temporaryPath = `${this.authorizationPath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      renameSync(temporaryPath, this.authorizationPath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }

  /** 读取加密 SQL 密钥；输入严格标志，返回密钥，读取失败时按策略抛出或返回空对象。 */
  private readCredentials(strict = false): ApplicationSqlCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch {
      if (strict) throw new Error("Encrypted SQL credentials could not be read.");
      this.logger.warn("Encrypted SQL credentials could not be read.");
      return {};
    }
  }

  /** 替换或删除加密 SQL 密钥文件；输入密钥对象，无返回，失败时抛出固定异常。 */
  private writeCredentials(credentials: ApplicationSqlCredentials): void {
    try {
      if (Object.keys(credentials).length > 0) this.options.credentials.write(credentials);
      else this.options.credentials.clear();
    } catch {
      throw new Error("Encrypted SQL credentials could not be written.");
    }
  }

  /** 发布脱敏快照；输入快照，无返回，按注册顺序同步通知监听器。 */
  private publish(snapshot: ApplicationSqlCredentialSnapshot): void {
    for (const listener of this.listeners) listener(snapshot);
  }

  /** 断言服务尚未关闭；无输入和返回，关闭后抛出 Error。 */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application SQL credential service is closed.");
  }
}

/** 创建独立 SQL 凭据与文件授权服务；输入用户目录、safeStorage 和选择器，返回未激活 Worker 的服务。 */
export function bootstrapApplicationSqlCredentials(
  options: BootstrapApplicationSqlCredentialsOptions,
): ApplicationSqlCredentialService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const credentials = new SafeStorageSqlCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_SQL_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationSqlCredentialService({
    credentials,
    authorizationPath: options.authorizationPath
      ?? path.join(userDataDirectory, APPLICATION_SQL_DATABASE_AUTHORIZATION_FILENAME),
    selectSqliteDatabase: options.selectSqliteDatabase,
    ...(options.logger ? { logger: options.logger } : {}),
  });
}
