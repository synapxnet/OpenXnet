/** MCP Runtime 生命周期 IPC 通道。 */
export const APPLICATION_MCP_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-mcp-runtime:status",
  start: "openxnet:application-mcp-runtime:start",
  stop: "openxnet:application-mcp-runtime:stop",
  listTools: "openxnet:application-mcp-runtime:list-tools",
});

/** MCP Runtime 公开结果协议。 */
export const APPLICATION_MCP_RUNTIME_SCHEMA = "openxnet.application-mcp-runtime.v1" as const;

/** 当前允许通过 Renderer 管理的 MCP 集成。 */
export const APPLICATION_MCP_RUNTIME_INTEGRATIONS = ["home-assistant", "chrome-external", "sql"] as const;

/** 外部 Chrome MCP 的固定实现选项。 */
export const APPLICATION_EXTERNAL_CHROME_MCP_NAMES = ["browser-mcp", "playwright-mcp"] as const;

/** SQL MCP 支持的固定数据库引擎。 */
export const APPLICATION_SQL_MCP_ENGINES = ["sqlite", "postgres", "mysql", "mssql", "oracle"] as const;

/** 通用远程 MCP Server 的动态集成前缀。 */
export const APPLICATION_GENERIC_MCP_INTEGRATION_PREFIX = "generic:" as const;

/** Desktop 允许的通用远程 MCP 传输。 */
export const APPLICATION_GENERIC_MCP_TRANSPORTS = [
  "sse",
  "streamable-http",
  "websocket",
] as const;

/** MCP Runtime 生命周期操作。 */
export type ApplicationMcpRuntimeOperation = "status" | "start" | "stop";

/** MCP Runtime 集成标识。 */
export type ApplicationMcpRuntimeIntegration =
  | (typeof APPLICATION_MCP_RUNTIME_INTEGRATIONS)[number]
  | `${typeof APPLICATION_GENERIC_MCP_INTEGRATION_PREFIX}${string}`;

/** MCP Runtime 公开状态。 */
export type ApplicationMcpRuntimeState =
  | "unavailable"
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

/** Home Assistant 可提交的无密钥运行配置。 */
export interface ApplicationHomeAssistantRuntimeConfiguration {
  readonly url: string;
}

/** 外部 Chrome MCP 可提交的无密钥运行配置。 */
export interface ApplicationExternalChromeMcpRuntimeConfiguration {
  readonly mcpName: (typeof APPLICATION_EXTERNAL_CHROME_MCP_NAMES)[number];
}

/** SQLite 运行时配置只携带 Main 授权标识，不携带本机路径。 */
export interface ApplicationSqliteMcpRuntimeConfiguration {
  readonly engine: "sqlite";
  readonly databaseId: string;
}

/** 远程 SQL 运行时配置不携带口令，口令只由 Worker 启动包提供。 */
export interface ApplicationRemoteSqlMcpRuntimeConfiguration {
  readonly engine: Exclude<(typeof APPLICATION_SQL_MCP_ENGINES)[number], "sqlite">;
  readonly user: string;
  readonly host: string;
  readonly port: number;
  readonly dbname: string;
}

/** 通用远程 MCP 的无密钥配置，认证头只由 Worker 凭据包补齐。 */
export interface ApplicationGenericMcpRuntimeConfiguration {
  readonly transport: (typeof APPLICATION_GENERIC_MCP_TRANSPORTS)[number];
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** MCP Runtime 各集成允许的无密钥配置。 */
export type ApplicationMcpRuntimeConfiguration =
  | ApplicationHomeAssistantRuntimeConfiguration
  | ApplicationExternalChromeMcpRuntimeConfiguration
  | ApplicationSqliteMcpRuntimeConfiguration
  | ApplicationRemoteSqlMcpRuntimeConfiguration
  | ApplicationGenericMcpRuntimeConfiguration;

/** 查询或停止一个 MCP 集成的请求。 */
export interface ApplicationMcpRuntimeIntegrationRequest {
  readonly integration: ApplicationMcpRuntimeIntegration;
}

/** 启动一个 MCP 集成的请求。 */
export interface ApplicationMcpRuntimeStartRequest {
  readonly integration: ApplicationMcpRuntimeIntegration;
  readonly configuration: ApplicationMcpRuntimeConfiguration;
}

/** Renderer 可见的固定 MCP 生命周期结果。 */
export interface ApplicationMcpRuntimeResult {
  readonly schema: typeof APPLICATION_MCP_RUNTIME_SCHEMA;
  readonly operation: ApplicationMcpRuntimeOperation;
  readonly integration: ApplicationMcpRuntimeIntegration;
  readonly success: boolean;
  readonly isRunning: boolean;
  readonly status: ApplicationMcpRuntimeState;
  readonly errorCode: "MCP_RUNTIME_UNAVAILABLE" | "MCP_RUNTIME_FAILED" | null;
  readonly retryable: boolean;
}

/** Renderer 可显示的脱敏 MCP 工具摘要。 */
export interface ApplicationMcpRuntimeToolSummary {
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
}

/** Renderer 工具发现结果，不包含连接配置或凭据。 */
export interface ApplicationMcpRuntimeToolsResult {
  readonly schema: typeof APPLICATION_MCP_RUNTIME_SCHEMA;
  readonly integration: ApplicationMcpRuntimeIntegration;
  readonly success: boolean;
  readonly tools: readonly ApplicationMcpRuntimeToolSummary[];
  readonly errorCode: "MCP_RUNTIME_UNAVAILABLE" | "MCP_RUNTIME_FAILED" | null;
  readonly retryable: boolean;
}

/** 判断未知值是否为普通对象；输入未知值，返回布尔值，无副作用且不抛出异常。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 解析允许的 MCP 集成；输入未知值，返回规范集成名，类型或名称无效时抛出 TypeError。 */
export function parseApplicationMcpRuntimeIntegration(value: unknown): ApplicationMcpRuntimeIntegration {
  if (typeof value !== "string") {
    throw new TypeError("MCP Runtime integration is invalid.");
  }
  if (APPLICATION_MCP_RUNTIME_INTEGRATIONS.some((candidate) => candidate === value)) {
    return value as ApplicationMcpRuntimeIntegration;
  }
  if (!value.startsWith(APPLICATION_GENERIC_MCP_INTEGRATION_PREFIX)) {
    throw new TypeError("MCP Runtime integration is invalid.");
  }
  const serverId = value.slice(APPLICATION_GENERIC_MCP_INTEGRATION_PREFIX.length);
  if (
    !serverId
    || serverId !== serverId.trim()
    || serverId.length > 256
    || /[\u0000-\u001F\u007F]/.test(serverId)
  ) {
    throw new TypeError("MCP Runtime generic server identifier is invalid.");
  }
  return value as ApplicationMcpRuntimeIntegration;
}

/** 判断远程 MCP header 是否可能承载凭据；输入名称，返回布尔值，无副作用。 */
function isSensitiveMcpHeaderName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "authorization"
    || normalized === "proxy-authorization"
    || normalized === "cookie"
    || normalized === "set-cookie"
    || /(^|[-_])(api[-_]?key|token|secret|password|passwd|credential|auth)([-_]|$)/i
      .test(normalized);
}

/** 解析通用 MCP 非敏感 header；输入未知值，返回分离对象，凭据名、控制字符或预算无效时抛出 TypeError。 */
function parseGenericMcpHeaders(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) return {};
  if (!isRecord(value) || Object.keys(value).length > 64) {
    throw new TypeError("MCP Runtime generic headers are invalid.");
  }
  const headers: Record<string, string> = {};
  for (const [name, rawValue] of Object.entries(value)) {
    if (
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(name)
      || isSensitiveMcpHeaderName(name)
      || typeof rawValue !== "string"
      || rawValue.length > 8_192
      || /[\u0000-\u001F\u007F]/.test(rawValue)
    ) {
      throw new TypeError("MCP Runtime generic header is invalid.");
    }
    headers[name] = rawValue;
  }
  return headers;
}

/** 判断 URL 主机是否为显式回环地址；输入主机名，返回布尔值，不执行 DNS 查询。 */
function isLoopbackMcpHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/\.$/, "");
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1";
}

/** 解析查询或停止请求；输入未知值，返回精确请求，额外字段或集成无效时抛出 TypeError。 */
export function parseApplicationMcpRuntimeIntegrationRequest(
  value: unknown,
): ApplicationMcpRuntimeIntegrationRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new TypeError("MCP Runtime integration request is invalid.");
  }
  return { integration: parseApplicationMcpRuntimeIntegration(value.integration) };
}

/** 解析启动请求；输入未知值，返回无密钥副本，额外字段、URL 类型或字节预算无效时抛出 TypeError。 */
export function parseApplicationMcpRuntimeStartRequest(
  value: unknown,
): ApplicationMcpRuntimeStartRequest {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !isRecord(value.configuration)) {
    throw new TypeError("MCP Runtime start request is invalid.");
  }
  const configuration = value.configuration;
  const integration = parseApplicationMcpRuntimeIntegration(value.integration);
  if (integration.startsWith(APPLICATION_GENERIC_MCP_INTEGRATION_PREFIX)) {
    if (
      Object.keys(configuration).some((key) => !["transport", "url", "headers"].includes(key))
      || typeof configuration.transport !== "string"
      || !APPLICATION_GENERIC_MCP_TRANSPORTS.some(
        (candidate) => candidate === configuration.transport,
      )
      || typeof configuration.url !== "string"
    ) {
      throw new TypeError("MCP Runtime generic configuration is invalid.");
    }
    const rawUrl = configuration.url.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new TypeError("MCP Runtime generic URL is invalid.");
    }
    const expectedProtocols = configuration.transport === "websocket"
      ? ["ws:", "wss:"]
      : ["http:", "https:"];
    if (
      Buffer.byteLength(rawUrl, "utf8") > 2_048
      || !expectedProtocols.includes(parsedUrl.protocol)
      || !parsedUrl.hostname
      || parsedUrl.username
      || parsedUrl.password
      || parsedUrl.search
      || parsedUrl.hash
      || (!isLoopbackMcpHostname(parsedUrl.hostname)
        && !["https:", "wss:"].includes(parsedUrl.protocol))
    ) {
      throw new TypeError("MCP Runtime generic URL is invalid.");
    }
    const headers = parseGenericMcpHeaders(configuration.headers);
    return {
      integration,
      configuration: {
        transport: configuration.transport as ApplicationGenericMcpRuntimeConfiguration["transport"],
        url: parsedUrl.toString(),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      },
    };
  }
  if (integration === "home-assistant") {
    if (Object.keys(configuration).length !== 1 || typeof configuration.url !== "string") {
      throw new TypeError("MCP Runtime Home Assistant configuration is invalid.");
    }
    const url = configuration.url.trim();
    if (!url || Buffer.byteLength(url, "utf8") > 2_048) {
      throw new TypeError("MCP Runtime URL is invalid.");
    }
    return { integration, configuration: { url } };
  }
  if (integration === "chrome-external") {
    if (
      Object.keys(configuration).length !== 1
      || typeof configuration.mcpName !== "string"
      || !APPLICATION_EXTERNAL_CHROME_MCP_NAMES.some(
        (candidate) => candidate === configuration.mcpName,
      )
    ) {
      throw new TypeError("MCP Runtime external Chrome configuration is invalid.");
    }
    return {
      integration,
      configuration: {
        mcpName: configuration.mcpName as ApplicationExternalChromeMcpRuntimeConfiguration["mcpName"],
      },
    };
  }
  const engine = configuration.engine;
  if (
    typeof engine !== "string"
    || !APPLICATION_SQL_MCP_ENGINES.some((candidate) => candidate === engine)
  ) {
    throw new TypeError("MCP Runtime SQL engine is invalid.");
  }
  if (engine === "sqlite") {
    if (
      Object.keys(configuration).length !== 2
      || typeof configuration.databaseId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(configuration.databaseId)
    ) {
      throw new TypeError("MCP Runtime SQLite configuration is invalid.");
    }
    return {
      integration,
      configuration: { engine, databaseId: configuration.databaseId },
    };
  }
  if (
    Object.keys(configuration).length !== 5
    || typeof configuration.user !== "string"
    || typeof configuration.host !== "string"
    || typeof configuration.port !== "number"
    || typeof configuration.dbname !== "string"
  ) {
    throw new TypeError("MCP Runtime remote SQL configuration is invalid.");
  }
  const user = configuration.user.trim();
  const host = configuration.host.trim();
  const dbname = configuration.dbname.trim();
  if (
    !user
    || user.length > 256
    || !host
    || host.length > 255
    || !dbname
    || dbname.length > 512
    || !Number.isInteger(configuration.port)
    || configuration.port < 1
    || configuration.port > 65_535
    || /[\u0000-\u001F\u007F]/.test(`${user}${host}${dbname}`)
    || /[\s/@]/.test(host)
  ) {
    throw new TypeError("MCP Runtime remote SQL configuration is invalid.");
  }
  return {
    integration,
    configuration: {
      engine: engine as ApplicationRemoteSqlMcpRuntimeConfiguration["engine"],
      user,
      host,
      port: configuration.port,
      dbname,
    },
  };
}
