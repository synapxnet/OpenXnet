/** SQL 凭据与 SQLite 文件授权 IPC 通道。 */
export const APPLICATION_SQL_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-sql-credentials:get-snapshot",
  save: "openxnet:application-sql-credentials:save",
  selectDatabase: "openxnet:application-sql-credentials:select-database",
});

/** Renderer 可见的 SQL 凭据快照协议。 */
export const APPLICATION_SQL_CREDENTIAL_SCHEMA = "openxnet.sql-credentials.v1" as const;

/** Main 允许持久化的 SQL 密钥字段。 */
export const APPLICATION_SQL_CREDENTIAL_FIELDS = Object.freeze(["password"] as const);

/** SQL 密钥字段联合类型。 */
export type ApplicationSqlCredentialField = (typeof APPLICATION_SQL_CREDENTIAL_FIELDS)[number];

/** 单个 SQL 密钥允许的最大字符数。 */
export const MAX_APPLICATION_SQL_CREDENTIAL_LENGTH = 64 * 1024;

/** Main 持有且不会返回 Renderer 的 SQL 密钥集合。 */
export type ApplicationSqlCredentials = Readonly<
  Partial<Record<ApplicationSqlCredentialField, string>>
>;

/** 用户通过系统文件选择器授予的 SQLite 数据库公开元数据。 */
export interface ApplicationSqliteDatabaseAuthorization {
  readonly databaseId: string;
  readonly displayPath: string;
  readonly filename: string;
}

/** Renderer 可读取的脱敏 SQL 状态。 */
export interface ApplicationSqlCredentialSnapshot {
  readonly schema: typeof APPLICATION_SQL_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationSqlCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
  readonly database: ApplicationSqliteDatabaseAuthorization | null;
}

/** Renderer 可提交的精确 SQL 密钥修改。 */
export interface SaveApplicationSqlCredentialsRequest {
  readonly credentials?: ApplicationSqlCredentials;
  readonly clear?: readonly ApplicationSqlCredentialField[];
}

/** 判断未知值是否为可检查字段的普通对象；输入未知值，返回布尔值，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 判断未知值是否为允许的 SQL 密钥字段；输入未知值，返回布尔值，无副作用。 */
export function isApplicationSqlCredentialField(
  value: unknown,
): value is ApplicationSqlCredentialField {
  return typeof value === "string"
    && APPLICATION_SQL_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** 解析单个 SQL 密钥；输入未知值，返回去首尾空白文本，无效或超限时抛出 TypeError。 */
export function parseApplicationSqlCredentialSecret(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("SQL credential entry is invalid.");
  const secret = value.trim();
  if (
    secret.length < 1
    || secret.length > MAX_APPLICATION_SQL_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("SQL credential entry is invalid.");
  }
  return secret;
}

/** 解析精确 SQL 密钥对象；输入未知值，返回新对象，字段或密钥无效时抛出 TypeError。 */
export function parseApplicationSqlCredentials(value: unknown): ApplicationSqlCredentials {
  if (!isRecord(value)) throw new TypeError("SQL credentials must be an object.");
  const credentials: Partial<Record<ApplicationSqlCredentialField, string>> = {};
  for (const [field, secret] of Object.entries(value)) {
    if (!isApplicationSqlCredentialField(field)) {
      throw new TypeError("SQL credential field is invalid.");
    }
    credentials[field] = parseApplicationSqlCredentialSecret(secret);
  }
  return credentials;
}

/** 生成已配置字段投影；输入 Main 密钥集合，返回字段名数组，不返回密钥值。 */
export function createApplicationSqlCredentialConfigured(
  credentials: ApplicationSqlCredentials,
): readonly ApplicationSqlCredentialField[] {
  return APPLICATION_SQL_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** 解析 SQL 密钥写入请求；输入未知值，返回规范请求，额外字段或冲突操作时抛出 TypeError。 */
export function parseSaveApplicationSqlCredentialsRequest(
  value: unknown,
): SaveApplicationSqlCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("SQL credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationSqlCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_SQL_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationSqlCredentialField(field))
  ) {
    throw new TypeError("SQL credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationSqlCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("SQL credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
