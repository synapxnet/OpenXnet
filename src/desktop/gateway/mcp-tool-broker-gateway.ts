import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { parseApplicationMcpRuntimeStartRequest } from "../contracts/application-mcp-runtime";
import type { DesktopCore } from "../core/desktop-core";
import type { WorkerSupervisor } from "../workers/worker-supervisor";

/** Execution Engine 可访问的精确 MCP 工具路径。 */
export const MCP_TOOL_BROKER_PATHS = Object.freeze({
  list: "/v1/mcp/tools/list",
  call: "/v1/mcp/tools/call",
});

/** 私有 MCP Tool Broker 依赖与预算。 */
export interface McpToolBrokerGatewayOptions {
  readonly token: string;
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly waitForCredentialRefresh?: () => Promise<void>;
  readonly host?: string;
  readonly maxBodyBytes?: number;
  readonly maxResponseBytes?: number;
}

/** 校验后可发送给 MCP Worker 的工具请求。 */
interface ValidatedMcpToolRequest {
  readonly method: "mcp.tools.list" | "mcp.tools.call";
  readonly payload: Readonly<Record<string, unknown>>;
}

/** 在 Worker 激活前返回的稳定 Broker 校验错误。 */
class McpToolBrokerRequestError extends Error {
  /** 创建固定请求错误；输入状态、代码和安全消息，无外部副作用。 */
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "McpToolBrokerRequestError";
  }
}

/** 鉴权 Execution Engine 请求并把有界工具操作转发到 MCP Worker。 */
export class McpToolBrokerGateway {
  private readonly host: string;
  private readonly maxBodyBytes: number;
  private readonly maxResponseBytes: number;
  private server: Server | null = null;
  private originValue: string | null = null;

  /** 创建未绑定 Broker；输入 bearer、Core 和 Worker 依赖，无返回，不激活 MCP capability。 */
  public constructor(private readonly options: McpToolBrokerGatewayOptions) {
    if (!options.token.trim()) {
      throw new Error("MCP Tool Broker requires a non-empty token.");
    }
    this.host = options.host ?? "127.0.0.1";
    this.maxBodyBytes = options.maxBodyBytes ?? 512 * 1024;
    this.maxResponseBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
  }

  /** 返回已绑定回环 origin；无输入和副作用，未启动时抛出 Error。 */
  public get origin(): string {
    if (this.originValue === null) throw new Error("MCP Tool Broker has not started.");
    return this.originValue;
  }

  /** 绑定临时回环端口；无输入，返回 origin，不激活 MCP Worker。 */
  public async start(): Promise<string> {
    if (this.server !== null) return this.origin;
    const server = createServer(this.handleRequest.bind(this));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, this.host, resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      await this.stop();
      throw new Error("MCP Tool Broker did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** 停止 Broker 并关闭活动连接；无输入和返回，可重复调用且不停止 MCP Worker。 */
  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.originValue = null;
    if (server === null) return;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** 校验并处理一个 HTTP 请求；输入 Node 请求响应对象，无返回，失败只写固定无缓存错误。 */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.isAllowedHost(request.headers.host)) {
      request.resume();
      this.writeError(response, 403, "INVALID_HOST", "MCP Tool Broker host is not allowed.");
      return;
    }
    const requestUrl = new URL(request.url ?? "/", this.origin);
    if (
      (requestUrl.pathname !== MCP_TOOL_BROKER_PATHS.list
        && requestUrl.pathname !== MCP_TOOL_BROKER_PATHS.call)
      || requestUrl.search
    ) {
      request.resume();
      this.writeError(response, 404, "NOT_FOUND", "MCP Tool Broker route was not found.");
      return;
    }
    if (request.method !== "POST") {
      request.resume();
      this.writeError(response, 405, "METHOD_NOT_ALLOWED", "MCP Tool Broker accepts POST only.");
      return;
    }
    if (!this.isAuthorized(request.headers.authorization)) {
      request.resume();
      this.writeError(response, 401, "UNAUTHORIZED", "MCP Tool Broker authentication failed.");
      return;
    }

    try {
      const payload = await this.readJsonBody(request);
      const validated = this.validateRequest(requestUrl.pathname, payload);
      await this.options.waitForCredentialRefresh?.();
      await this.options.core.ensureCapability("mcp");
      const result = await this.options.supervisor.request("mcp", validated.method, validated.payload);
      this.writeSuccess(response, result);
    } catch (error) {
      if (error instanceof McpToolBrokerRequestError) {
        this.writeError(response, error.statusCode, error.code, error.message);
        return;
      }
      this.writeError(response, 503, "MCP_RUNTIME_UNAVAILABLE", "MCP Runtime is unavailable.");
    }
  }

  /** 读取有界 UTF-8 JSON；输入请求，返回未知值，格式或大小无效时抛出固定请求错误。 */
  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.maxBodyBytes) {
      throw new McpToolBrokerRequestError(413, "REQUEST_TOO_LARGE", "MCP request is too large.");
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > this.maxBodyBytes) {
        throw new McpToolBrokerRequestError(413, "REQUEST_TOO_LARGE", "MCP request is too large.");
      }
      chunks.push(buffer);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new McpToolBrokerRequestError(400, "INVALID_REQUEST", "MCP request is invalid.");
    }
  }

  /** 校验精确工具操作；输入路径和未知 JSON，返回 Worker 方法与载荷，额外字段或超限参数时抛出请求错误。 */
  private validateRequest(pathname: string, value: unknown): ValidatedMcpToolRequest {
    if (pathname === MCP_TOOL_BROKER_PATHS.list) {
      try {
        const request = parseApplicationMcpRuntimeStartRequest(value);
        return {
          method: "mcp.tools.list",
          payload: { integration: request.integration, configuration: request.configuration },
        };
      } catch {
        throw new McpToolBrokerRequestError(422, "INVALID_REQUEST", "MCP tool-list request is invalid.");
      }
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new McpToolBrokerRequestError(422, "INVALID_REQUEST", "MCP tool-call request is invalid.");
    }
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 4
      || typeof record.toolName !== "string"
      || !record.toolName.trim()
      || record.toolName.length > 128
      || typeof record.arguments !== "object"
      || record.arguments === null
      || Array.isArray(record.arguments)
    ) {
      throw new McpToolBrokerRequestError(422, "INVALID_REQUEST", "MCP tool-call request is invalid.");
    }
    let startRequest;
    try {
      startRequest = parseApplicationMcpRuntimeStartRequest({
        integration: record.integration,
        configuration: record.configuration,
      });
    } catch {
      throw new McpToolBrokerRequestError(422, "INVALID_REQUEST", "MCP tool-call request is invalid.");
    }
    return {
      method: "mcp.tools.call",
      payload: {
        ...startRequest,
        toolName: record.toolName.trim(),
        arguments: record.arguments as Record<string, unknown>,
      },
    };
  }

  /** 比较进程 bearer；输入 Authorization，返回布尔值，使用定时安全比较且不记录凭据。 */
  private isAuthorized(authorization: string | undefined): boolean {
    const prefix = "Bearer ";
    if (authorization === undefined || !authorization.startsWith(prefix)) return false;
    const expected = Buffer.from(this.options.token, "utf8");
    const received = Buffer.from(authorization.slice(prefix.length), "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /** 校验 Host 是否等于实际绑定端点；输入 Host 头，返回布尔值，无副作用。 */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (hostHeader === undefined || this.originValue === null) return false;
    const expectedHost = new URL(this.originValue).host.toLowerCase();
    const normalizedHost = hostHeader.trim().toLowerCase();
    return normalizedHost === expectedHost
      || normalizedHost === expectedHost.replace("127.0.0.1", "localhost");
  }

  /** 写入有界成功响应；输入响应和 Worker 载荷，无返回，超限时改写固定 502 错误。 */
  private writeSuccess(response: ServerResponse, payload: Readonly<Record<string, unknown>>): void {
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body, "utf8") > this.maxResponseBytes) {
      this.writeError(response, 502, "RESPONSE_TOO_LARGE", "MCP response is too large.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }

  /** 写入固定 Broker 错误；输入响应、状态、代码和安全文案，无返回且不包含内部诊断。 */
  private writeError(
    response: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    const body = JSON.stringify({
      schema: "openxnet.mcp-tool-broker-error.v1",
      code,
      message,
      retryable: statusCode >= 500,
    });
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }
}
