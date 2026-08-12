import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { ApplicationCompetitionSnapshot } from "../contracts/application-competition-runtime";
import type {
  ApplicationCompetitionRuntimeService,
  ApplicationCompetitionToolCallRequest,
} from "./application-competition-runtime";
import type { CompetitionToolGovernance } from "./competition-tool-adapter";
import {
  COMPETITION_TOOL_REGISTRY,
  getCompetitionToolDescriptor,
  parseCompetitionToolArguments,
} from "./competition-tool-registry";

/** OpenXnet 实现固定的现代 MCP 版本。 */
export const COMPETITION_MCP_PROTOCOL_VERSION = "2026-07-28" as const;

/** 北向 MCP Streamable HTTP 的固定端点。 */
export const COMPETITION_MCP_PATH = "/mcp" as const;

/** 本地 MCP 主体和权限上下文。 */
export interface CompetitionMcpPrincipal {
  readonly actorId: string;
  readonly workspaceId: string;
  readonly scopes: readonly string[];
}

/** 竞赛 MCP Gateway 依赖与安全预算。 */
export interface CompetitionMcpGatewayOptions {
  readonly token: string;
  readonly principal: CompetitionMcpPrincipal;
  readonly runtime: Pick<ApplicationCompetitionRuntimeService, "callTool" | "getSnapshot" | "readResource">;
  readonly host?: string;
  readonly allowedOrigins?: readonly string[];
  readonly maxBodyBytes?: number;
  readonly maxResponseBytes?: number;
}

/** JSON-RPC 协议错误。 */
class CompetitionMcpProtocolError extends Error {
  /** 创建协议错误；输入 HTTP 状态、JSON-RPC 代码、文案和可选数据，无外部副作用。 */
  public constructor(
    public readonly statusCode: number,
    public readonly rpcCode: number,
    message: string,
    public readonly data?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "CompetitionMcpProtocolError";
  }
}

/** 已校验 JSON-RPC 请求。 */
interface ValidatedMcpRequest {
  readonly id: string | number;
  readonly method: string;
  readonly params: Record<string, unknown>;
  readonly meta: Record<string, unknown>;
}

/** 提供 MCP 2026-07-28 工具发现、调用和 Resources 的北向 Gateway。 */
export class CompetitionMcpGateway {
  private readonly host: string;
  private readonly maxBodyBytes: number;
  private readonly maxResponseBytes: number;
  private readonly allowedOrigins: ReadonlySet<string>;
  private server: Server | null = null;
  private originValue: string | null = null;

  /** 创建未绑定 Gateway；输入令牌、主体和 Runtime，不读取业务状态或启动网络。 */
  public constructor(private readonly options: CompetitionMcpGatewayOptions) {
    if (Buffer.byteLength(options.token.trim(), "utf8") < 32) {
      throw new Error("Competition MCP Gateway requires a token of at least 32 UTF-8 bytes.");
    }
    if (!options.principal.actorId.trim() || !options.principal.workspaceId.trim()) {
      throw new Error("Competition MCP Gateway principal is invalid.");
    }
    this.host = options.host ?? "127.0.0.1";
    this.maxBodyBytes = options.maxBodyBytes ?? 512 * 1024;
    this.maxResponseBytes = options.maxResponseBytes ?? 4 * 1024 * 1024;
    this.allowedOrigins = new Set((options.allowedOrigins ?? []).map((origin) => new URL(origin).origin));
  }

  /** 返回已绑定 origin；无输入和副作用，未启动时抛出 Error。 */
  public get origin(): string {
    if (this.originValue === null) throw new Error("Competition MCP Gateway has not started.");
    return this.originValue;
  }

  /** 绑定临时回环端口；无输入，返回 MCP origin，不访问三平台。 */
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
      throw new Error("Competition MCP Gateway did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** 停止 Gateway 并关闭活动连接；无输入和返回，可重复调用且不停止 Runtime。 */
  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.originValue = null;
    if (server === null) return;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** 校验并处理一个 MCP HTTP 请求；输入 Node 请求响应对象，无返回，失败写入固定错误。 */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let requestId: string | number | null = null;
    try {
      this.validateHttpEnvelope(request);
      const payload = await this.readJsonBody(request);
      const validated = this.validateRpcRequest(payload, request);
      requestId = validated.id;
      if (this.shouldStream(validated, request)) {
        await this.writeSseResponse(response, validated);
        return;
      }
      const result = await this.dispatch(validated);
      this.writeRpcSuccess(response, validated.id, result);
    } catch (error) {
      if (error instanceof CompetitionMcpProtocolError) {
        this.writeRpcError(response, requestId, error);
        return;
      }
      this.writeRpcError(
        response,
        requestId,
        new CompetitionMcpProtocolError(500, -32603, "Internal MCP Gateway error"),
      );
    }
  }

  /** 校验路径、方法、Host、Origin、Bearer 和协议 Header；输入 HTTP 请求，无返回，失败抛出协议错误。 */
  private validateHttpEnvelope(request: IncomingMessage): void {
    if (!this.isAllowedHost(request.headers.host)) {
      throw new CompetitionMcpProtocolError(403, -32600, "MCP host is not allowed");
    }
    const requestUrl = new URL(request.url ?? "/", this.origin);
    if (requestUrl.pathname !== COMPETITION_MCP_PATH || requestUrl.search) {
      throw new CompetitionMcpProtocolError(404, -32601, "MCP endpoint was not found");
    }
    if (request.method !== "POST") {
      throw new CompetitionMcpProtocolError(405, -32600, "MCP endpoint accepts POST only");
    }
    const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      throw new CompetitionMcpProtocolError(415, -32600, "MCP endpoint requires application/json");
    }
    const origin = request.headers.origin;
    if (origin !== undefined && !this.allowedOrigins.has(new URL(origin).origin)) {
      throw new CompetitionMcpProtocolError(403, -32600, "MCP Origin is not allowed");
    }
    if (!this.isAuthorized(request.headers.authorization)) {
      throw new CompetitionMcpProtocolError(401, -32600, "MCP authentication failed");
    }
    if (request.headers["mcp-protocol-version"] !== COMPETITION_MCP_PROTOCOL_VERSION) {
      throw new CompetitionMcpProtocolError(400, -32022, "Unsupported protocol version", {
        supported: [COMPETITION_MCP_PROTOCOL_VERSION],
        requested: String(request.headers["mcp-protocol-version"] ?? ""),
      });
    }
  }

  /** 读取有界 UTF-8 JSON；输入 HTTP 请求，返回未知值，非法或超限时抛出协议错误。 */
  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const declared = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declared) && declared > this.maxBodyBytes) {
      throw new CompetitionMcpProtocolError(413, -32600, "MCP request is too large");
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > this.maxBodyBytes) {
        throw new CompetitionMcpProtocolError(413, -32600, "MCP request is too large");
      }
      chunks.push(buffer);
    }
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))) as unknown;
    } catch {
      throw new CompetitionMcpProtocolError(400, -32700, "Parse error");
    }
  }

  /** 校验 JSON-RPC、Header 一致性和每请求 _meta；输入载荷与 HTTP 请求，返回结构化请求。 */
  private validateRpcRequest(value: unknown, request: IncomingMessage): ValidatedMcpRequest {
    if (!isRecord(value) || Array.isArray(value) || value.jsonrpc !== "2.0" || !(typeof value.id === "string" || typeof value.id === "number")) {
      throw new CompetitionMcpProtocolError(400, -32600, "Invalid Request");
    }
    if (typeof value.method !== "string" || !isRecord(value.params) || !isRecord(value.params._meta)) {
      throw new CompetitionMcpProtocolError(400, -32602, "Invalid MCP parameters");
    }
    if (request.headers["mcp-method"] !== value.method) {
      throw new CompetitionMcpProtocolError(400, -32020, "MCP method Header does not match the request");
    }
    const meta = value.params._meta;
    if (
      meta["io.modelcontextprotocol/protocolVersion"] !== COMPETITION_MCP_PROTOCOL_VERSION
      || !isRecord(meta["io.modelcontextprotocol/clientCapabilities"])
    ) {
      throw new CompetitionMcpProtocolError(400, -32602, "Required MCP request metadata is invalid");
    }
    const name = value.method === "tools/call"
      ? value.params.name
      : (value.method === "resources/read" ? value.params.uri : undefined);
    if (name !== undefined && request.headers["mcp-name"] !== name) {
      throw new CompetitionMcpProtocolError(400, -32020, "MCP name Header does not match the request");
    }
    return { id: value.id, method: value.method, params: value.params, meta };
  }

  /** 分派固定 MCP 方法；输入已校验请求，返回 JSON-RPC result，未知方法抛出 -32601。 */
  private async dispatch(request: ValidatedMcpRequest): Promise<Readonly<Record<string, unknown>>> {
    switch (request.method) {
      case "server/discover": return this.discover();
      case "tools/list": return this.listTools();
      case "tools/call": return this.callTool(request);
      case "resources/list": return this.listResources();
      case "resources/templates/list": return this.listResourceTemplates();
      case "resources/read": return this.readResource(request);
      default: throw new CompetitionMcpProtocolError(404, -32601, "Method not found");
    }
  }

  /** 判断请求是否使用单请求 SSE；输入 MCP 请求和 HTTP Header，仅对推理探针返回 true。 */
  private shouldStream(request: ValidatedMcpRequest, httpRequest: IncomingMessage): boolean {
    return request.method === "tools/call"
      && request.params.name === "mlops.inference.probe"
      && String(httpRequest.headers.accept ?? "").toLowerCase().includes("text/event-stream");
  }

  /** 输出推理探针进度和最终 JSON-RPC 响应；输入响应和请求，无返回，流在最终事件后关闭。 */
  private async writeSseResponse(
    response: ServerResponse,
    request: ValidatedMcpRequest,
  ): Promise<void> {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "close",
      "X-Accel-Buffering": "no",
    });
    this.writeSseEvent(response, {
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: {
        progressToken: String(request.id),
        progress: 0,
        total: 1,
        message: "Inference probe started",
      },
    });
    try {
      const result = await this.dispatch(request);
      this.writeSseEvent(response, { jsonrpc: "2.0", id: request.id, result });
    } catch (error) {
      const normalized = error instanceof CompetitionMcpProtocolError
        ? error
        : new CompetitionMcpProtocolError(500, -32603, "Internal MCP Gateway error");
      this.writeSseEvent(response, {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: normalized.rpcCode,
          message: normalized.message,
          ...(normalized.data === undefined ? {} : { data: normalized.data }),
        },
      });
    } finally {
      response.end();
    }
  }

  /** 写入单个 SSE message 事件；输入响应和 JSON 值，无返回，执行响应总字节上限。 */
  private writeSseEvent(response: ServerResponse, value: unknown): void {
    const data = JSON.stringify(value);
    if (Buffer.byteLength(data, "utf8") > this.maxResponseBytes) {
      throw new CompetitionMcpProtocolError(500, -32603, "MCP SSE event is too large");
    }
    response.write(`event: message\ndata: ${data}\n\n`, "utf8");
  }

  /** 返回版本和能力发现结果；无输入，返回现代无会话 MCP 能力。 */
  private discover(): Readonly<Record<string, unknown>> {
    this.requireScope("openxnet:mcp:discover");
    return {
      resultType: "complete",
      supportedVersions: [COMPETITION_MCP_PROTOCOL_VERSION],
      capabilities: { tools: { listChanged: false }, resources: {} },
      _meta: serverMeta(),
      instructions: "在当前企业空间权限内读取跨平台证据；高风险写操作必须使用有效持久审批。",
      ttlMs: 60_000,
      cacheScope: "private",
    };
  }

  /** 返回按 Scope 过滤且确定性排序的三十二个工具；无输入，返回内联 Schema。 */
  private listTools(): Readonly<Record<string, unknown>> {
    this.requireScope("openxnet:tools:list");
    const tools = COMPETITION_TOOL_REGISTRY
      .filter((tool) => this.hasScope(scopeForTool(tool.name)))
      .map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.requiresApproval ? withGovernanceSchema(tool.inputSchema) : tool.inputSchema,
        outputSchema: toolOutputSchema(),
        annotations: {
          readOnlyHint: tool.riskLevel !== "HIGH_RISK_WRITE",
          destructiveHint: tool.riskLevel === "HIGH_RISK_WRITE",
          idempotentHint: true,
          openWorldHint: true,
        },
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    return { resultType: "complete", tools, ttlMs: 60_000, cacheScope: "private", _meta: serverMeta() };
  }

  /** 执行一个授权工具；输入已校验 MCP 请求，返回 TextContent、structuredContent 和资源链接。 */
  private async callTool(request: ValidatedMcpRequest): Promise<Readonly<Record<string, unknown>>> {
    const startedAt = Date.now();
    if (typeof request.params.name !== "string" || !isRecord(request.params.arguments)) {
      throw new CompetitionMcpProtocolError(400, -32602, "MCP tool-call parameters are invalid");
    }
    let descriptor;
    try {
      descriptor = getCompetitionToolDescriptor(request.params.name);
    } catch {
      throw new CompetitionMcpProtocolError(400, -32602, "MCP tool is not registered");
    }
    this.requireScope(scopeForTool(descriptor.name));
    const extracted = extractToolArguments(descriptor.name, request.params.arguments);
    const runtimeRequest: ApplicationCompetitionToolCallRequest = {
      workspaceId: this.options.principal.workspaceId,
      incidentId: optionalMetaText(request.meta["com.synapxnet/incidentId"]),
      traceId: optionalMetaText(request.meta["com.synapxnet/traceId"]),
      actorId: this.options.principal.actorId,
      toolName: descriptor.name,
      arguments: parseCompetitionToolArguments(descriptor, extracted.arguments),
      governance: extracted.governance,
    };
    try {
      const result = await this.options.runtime.callTool(runtimeRequest);
      const links = [] as Readonly<Record<string, unknown>>[];
      if (result.evidenceId !== null) {
        links.push({
          type: "resource_link",
          uri: `openxnet://workspaces/${runtimeRequest.workspaceId}/evidence/${result.evidenceId}`,
          name: result.evidenceId,
          mimeType: "application/json",
        });
      }
      if (result.actionId !== null) {
        links.push({
          type: "resource_link",
          uri: `openxnet://workspaces/${runtimeRequest.workspaceId}/actions/${result.actionId}`,
          name: result.actionId,
          mimeType: "application/json",
        });
      }
      return {
        resultType: "complete",
        content: [{ type: "text", text: result.response.meta.summary }, ...links],
        structuredContent: {
          success: true,
          data: result.response.data,
          error: null,
          meta: {
            requestId: result.response.meta.requestId,
            workspaceId: runtimeRequest.workspaceId,
            incidentId: result.incidentId,
            traceId: result.traceId,
            toolName: descriptor.name,
            contractVersion: "1.0.0",
            observedAt: result.response.meta.observedAt,
            durationMs: result.response.meta.durationMs,
            source: result.response.meta.source,
            ...(result.evidenceId === null ? {} : { evidenceId: result.evidenceId }),
            ...(result.response.meta.resourceVersion ? { resourceVersion: result.response.meta.resourceVersion } : {}),
          },
          auditReceipt: await this.findAuditReceipt(result.actionId),
        },
        isError: false,
        _meta: serverMeta(),
      };
    } catch (error) {
      const normalized = normalizeToolError(error);
      return {
        resultType: "complete",
        content: [{ type: "text", text: normalized.message }],
        structuredContent: {
          success: false,
          data: null,
          error: normalized,
          meta: {
            requestId: `req_${randomUUID()}`,
            workspaceId: runtimeRequest.workspaceId,
            incidentId: runtimeRequest.incidentId ?? "inc_unresolved",
            traceId: runtimeRequest.traceId ?? "trace_unresolved",
            toolName: descriptor.name,
            contractVersion: "1.0.0",
            observedAt: new Date().toISOString(),
            durationMs: Math.max(0, Date.now() - startedAt),
            source: "OpenXnetDesktop/mcp-gateway",
          },
          auditReceipt: null,
        },
        isError: true,
        _meta: serverMeta(),
      };
    }
  }

  /** 列出当前 Workspace 可见资源；无输入，返回确定性 URI 和私有缓存声明。 */
  private async listResources(): Promise<Readonly<Record<string, unknown>>> {
    this.requireScope("openxnet:resources:read");
    const snapshot = await this.options.runtime.getSnapshot();
    const workspaceId = this.options.principal.workspaceId;
    const resources = resourceEntries(snapshot, workspaceId).slice(0, 1_000);
    return { resultType: "complete", resources, ttlMs: 0, cacheScope: "private", _meta: serverMeta() };
  }

  /** 返回固定 Resource URI 模板；无输入，返回 Incident、Trace、Evidence、Action 和回执模板。 */
  private listResourceTemplates(): Readonly<Record<string, unknown>> {
    this.requireScope("openxnet:resources:read");
    const templates = [
      {
        uriTemplate: "openxnet://workspaces/{workspaceId}/incidents/{incidentId}/traces/{traceId}",
        name: "OpenXnet incident trace",
        mimeType: "application/json",
      },
      {
        uriTemplate: "openxnet://workspaces/{workspaceId}/evidence/{evidenceId}",
        name: "OpenXnet evidence",
        mimeType: "application/json",
      },
      {
        uriTemplate: "openxnet://workspaces/{workspaceId}/actions/{actionId}",
        name: "OpenXnet action",
        mimeType: "application/json",
      },
      {
        uriTemplate: "openxnet://workspaces/{workspaceId}/audit-receipts/{receiptId}",
        name: "OpenXnet audit receipt",
        mimeType: "application/json",
      },
    ];
    return { resultType: "complete", resourceTemplates: templates, ttlMs: 60_000, cacheScope: "private", _meta: serverMeta() };
  }

  /** 读取一个 Workspace Resource；输入 MCP 请求，校验 Workspace 后返回 TextResourceContents。 */
  private async readResource(request: ValidatedMcpRequest): Promise<Readonly<Record<string, unknown>>> {
    this.requireScope("openxnet:resources:read");
    if (typeof request.params.uri !== "string") {
      throw new CompetitionMcpProtocolError(400, -32602, "MCP resource URI is invalid");
    }
    const parsed = new URL(request.params.uri);
    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0];
    if (parsed.hostname !== "workspaces" || decodeURIComponent(firstSegment ?? "") !== this.options.principal.workspaceId) {
      throw new CompetitionMcpProtocolError(403, -32602, "MCP resource belongs to another Workspace");
    }
    const resource = await this.options.runtime.readResource({ uri: request.params.uri });
    return {
      resultType: "complete",
      contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.text }],
      ttlMs: request.params.uri.includes("/actions/") ? 0 : 60_000,
      cacheScope: "private",
      _meta: serverMeta(),
    };
  }

  /** 查找动作对应的最新本地审计回执；输入动作 ID，返回回执或 null。 */
  private async findAuditReceipt(actionId: string | null): Promise<Readonly<Record<string, unknown>> | null> {
    if (actionId === null) return null;
    const snapshot = await this.options.runtime.getSnapshot();
    const action = snapshot.actions.find((item) => item.actionId === actionId);
    if (action === undefined) return null;
    const receipt = snapshot.auditReceipts.find((item) =>
      item.incidentId === action.incidentId && item.idempotencyKey === action.idempotencyKey);
    if (receipt === undefined) return null;
    const approval = snapshot.approvals.find((item) => item.approvalId === action.approvalId);
    if (approval === undefined) return null;
    return {
      receiptId: receipt.receiptId,
      requestId: receipt.requestId,
      workspaceId: receipt.workspaceId,
      incidentId: receipt.incidentId,
      traceId: receipt.traceId,
      toolName: receipt.toolName,
      actorId: receipt.actorId,
      approverId: approval.decidedBy ?? approval.requestedBy,
      approvalId: receipt.approvalId,
      requestDigest: approval.argumentsDigest,
      actionId: action.actionId,
      actionStatus: action.status,
      beforeResourceVersion: receipt.resourceVersionBefore,
      afterResourceVersion: receipt.resourceVersionAfter,
      startedAt: action.createdAt,
      completedAt: receipt.recordedAt,
      evidenceIds: [...action.verificationEvidenceIds],
    };
  }

  /** 要求当前主体包含 Scope；输入 Scope，无返回，缺失时抛出 HTTP 403。 */
  private requireScope(scope: string): void {
    if (!this.hasScope(scope)) throw new CompetitionMcpProtocolError(403, -32602, "MCP scope is insufficient");
  }

  /** 判断当前主体是否包含 Scope；输入 Scope，返回布尔值，无副作用。 */
  private hasScope(scope: string): boolean {
    return this.options.principal.scopes.includes(scope) || this.options.principal.scopes.includes("openxnet:competition:admin");
  }

  /** 比较 Bearer；输入 Authorization，返回布尔值，使用定时安全比较且不记录令牌。 */
  private isAuthorized(authorization: string | undefined): boolean {
    const prefix = "Bearer ";
    if (authorization === undefined || !authorization.startsWith(prefix)) return false;
    const expected = Buffer.from(this.options.token, "utf8");
    const received = Buffer.from(authorization.slice(prefix.length), "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /** 校验 Host 是否为实际绑定端点；输入 Host Header，返回布尔值，无副作用。 */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (hostHeader === undefined || this.originValue === null) return false;
    const expected = new URL(this.originValue).host.toLowerCase();
    const received = hostHeader.trim().toLowerCase();
    return received === expected || received === expected.replace("127.0.0.1", "localhost");
  }

  /** 写入 JSON-RPC 成功响应；输入响应、ID 和结果，无返回，执行大小预算。 */
  private writeRpcSuccess(
    response: ServerResponse,
    id: string | number,
    result: Readonly<Record<string, unknown>>,
  ): void {
    this.writeJson(response, 200, { jsonrpc: "2.0", id, result });
  }

  /** 写入 JSON-RPC 错误响应；输入响应、ID 和协议错误，无返回，不包含堆栈。 */
  private writeRpcError(
    response: ServerResponse,
    id: string | number | null,
    error: CompetitionMcpProtocolError,
  ): void {
    if (error.statusCode === 401) {
      response.setHeader("WWW-Authenticate", "Bearer realm=\"openxnet-competition-mcp\"");
    }
    this.writeJson(response, error.statusCode, {
      jsonrpc: "2.0",
      id,
      error: {
        code: error.rpcCode,
        message: error.message,
        ...(error.data === undefined ? {} : { data: error.data }),
      },
    });
  }

  /** 写入有界 JSON；输入响应、状态和载荷，无返回，统一关闭缓存。 */
  private writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
    let body = JSON.stringify(value);
    if (Buffer.byteLength(body, "utf8") > this.maxResponseBytes) {
      statusCode = 500;
      body = JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "MCP response is too large" } });
    }
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }
}

/** 判断未知值是否为普通对象；输入未知值，返回类型守卫，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 返回 MCP Server 元数据；无输入，返回固定名称和版本。 */
function serverMeta(): Readonly<Record<string, unknown>> {
  return { "io.modelcontextprotocol/serverInfo": { name: "openxnet-mcp-gateway", version: "1.0.0" } };
}

/** 根据工具名返回所需 Scope；输入固定名称，返回最小授权 Scope。 */
function scopeForTool(name: string): string {
  const descriptor = getCompetitionToolDescriptor(name);
  if (descriptor.requiresApproval && descriptor.platform === "aiops") return "aiops:capacity:write";
  if (descriptor.requiresApproval && descriptor.platform === "dataops") return "dataops:workflow:write";
  if (descriptor.requiresApproval && name === "mlops.deployment.rollback") return "mlops:deployment:rollback";
  if (descriptor.requiresApproval && descriptor.platform === "mlops") return "mlops:model:iterate";
  if (name.startsWith("aiops.")) return "aiops:evidence:read";
  if (name.startsWith("dataops.")) return "dataops:evidence:read";
  if (name === "mlops.inference.probe") return "mlops:probe:execute";
  return "mlops:evidence:read";
}

/** 为高风险写工具附加 governance Schema；输入领域 Schema，返回内联 MCP Schema。 */
function withGovernanceSchema(domainSchema: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const properties = isRecord(domainSchema.properties) ? domainSchema.properties : {};
  const required = Array.isArray(domainSchema.required) ? domainSchema.required : [];
  return {
    ...domainSchema,
    required: [...required, "governance"],
    properties: {
      ...properties,
      governance: {
        type: "object",
        required: [
          "approvalId", "planId", "planDigest", "stepId", "resourceId", "targetRevision",
          "expectedResourceVersion", "argumentsDigest", "compensation", "reason", "dryRun", "idempotencyKey",
        ],
        properties: {
          approvalId: { type: "string", minLength: 1, maxLength: 128 },
          planId: { type: "string", minLength: 1, maxLength: 128 },
          planDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
          stepId: { type: "string", minLength: 1, maxLength: 128 },
          resourceId: { type: "string", minLength: 1, maxLength: 512 },
          targetRevision: { type: "integer", minimum: 1 },
          expectedResourceVersion: { type: "string", minLength: 1, maxLength: 128 },
          argumentsDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
          compensation: { type: "boolean" },
          reason: { type: "string", minLength: 1, maxLength: 2048 },
          dryRun: { type: "boolean" },
          idempotencyKey: { type: "string", minLength: 1, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
  };
}

/** 返回公共 ToolResponse 输出 Schema；无输入，返回 Draft 2020-12 可内联对象。 */
function toolOutputSchema(): Readonly<Record<string, unknown>> {
  return {
    type: "object",
    required: ["success", "data", "error", "meta", "auditReceipt"],
    properties: {
      success: { type: "boolean" },
      data: { type: ["object", "array", "string", "number", "boolean", "null"] },
      error: {
        type: ["object", "null"],
        properties: {
          code: { type: "string" },
          message: { type: "string", minLength: 1, maxLength: 1_000 },
          retryable: { type: "boolean" },
          details: { type: "object" },
        },
      },
      meta: {
        type: "object",
        required: ["requestId", "workspaceId", "incidentId", "traceId", "toolName", "contractVersion", "observedAt", "durationMs", "source"],
        properties: {
          requestId: { type: "string", minLength: 8, maxLength: 128 },
          workspaceId: { type: "string", minLength: 1, maxLength: 128 },
          incidentId: { type: "string", minLength: 1, maxLength: 128 },
          traceId: { type: "string", minLength: 1, maxLength: 128 },
          toolName: { type: "string", minLength: 3, maxLength: 128 },
          contractVersion: { type: "string", const: "1.0.0" },
          observedAt: { type: "string", format: "date-time" },
          durationMs: { type: "integer", minimum: 0 },
          source: { type: "string", minLength: 1, maxLength: 128 },
          evidenceId: { type: "string", minLength: 1, maxLength: 128 },
          resourceVersion: { type: "string", minLength: 1, maxLength: 128 },
        },
        additionalProperties: false,
      },
      auditReceipt: { type: ["object", "null"] },
    },
    additionalProperties: false,
    allOf: [{
      if: { properties: { success: { const: true } } },
      then: { properties: { error: { type: "null" } } },
      else: { properties: { data: { type: "null" }, error: { type: "object" } } },
    }],
  };
}

/** 分离 MCP governance 和领域参数；输入工具名和 arguments，返回两类有界对象。 */
function extractToolArguments(
  name: string,
  value: Record<string, unknown>,
): { arguments: Readonly<Record<string, unknown>>; governance: CompetitionToolGovernance | null } {
  const descriptor = getCompetitionToolDescriptor(name);
  if (!descriptor.requiresApproval) return { arguments: value, governance: null };
  const { governance, ...argumentsValue } = value;
  if (!isRecord(governance) || Object.keys(governance).length !== 12) {
    throw new CompetitionMcpProtocolError(400, -32602, "High-risk tool governance is invalid");
  }
  const approvalId = requiredText(governance.approvalId, 128);
  const planId = requiredText(governance.planId, 128);
  const planDigest = requiredDigest(governance.planDigest);
  const stepId = requiredText(governance.stepId, 128);
  const resourceId = requiredText(governance.resourceId, 512);
  const targetRevision = requiredPositiveInteger(governance.targetRevision);
  const expectedResourceVersion = requiredText(governance.expectedResourceVersion, 128);
  const argumentsDigest = requiredDigest(governance.argumentsDigest);
  const reason = requiredText(governance.reason, 2_048);
  const idempotencyKey = requiredText(governance.idempotencyKey, 128);
  if (typeof governance.dryRun !== "boolean" || typeof governance.compensation !== "boolean") {
    throw new CompetitionMcpProtocolError(400, -32602, "High-risk tool dry-run flag is invalid");
  }
  return {
    arguments: argumentsValue,
    governance: {
      approvalId,
      planId,
      planDigest,
      stepId,
      resourceId,
      targetRevision,
      expectedResourceVersion,
      argumentsDigest,
      compensation: governance.compensation,
      reason,
      idempotencyKey,
      dryRun: governance.dryRun,
    },
  };
}

/** 读取 SHA-256 摘要；输入未知值，返回规范摘要，无效时抛出 -32602。 */
function requiredDigest(value: unknown): string {
  const digest = requiredText(value, 64);
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    throw new CompetitionMcpProtocolError(400, -32602, "MCP digest parameter is invalid");
  }
  return digest;
}

/** 读取正整数；输入未知值，返回安全整数，无效时抛出 -32602。 */
function requiredPositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new CompetitionMcpProtocolError(400, -32602, "MCP revision parameter is invalid");
  }
  return Number(value);
}

/** 读取 MCP 必填文本；输入未知值和上限，返回规范文本，无效时抛出 -32602。 */
function requiredText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength || value.includes("\u0000")) {
    throw new CompetitionMcpProtocolError(400, -32602, "MCP text parameter is invalid");
  }
  return value.trim();
}

/** 读取可选 Vendor _meta 文本；输入未知值，返回文本或 null，无效时抛出 -32602。 */
function optionalMetaText(value: unknown): string | null {
  if (value === undefined) return null;
  return requiredText(value, 128);
}

/** 把快照投影为当前 Workspace 的 Resource 清单；输入快照和 Workspace，返回 URI 条目。 */
function resourceEntries(
  snapshot: ApplicationCompetitionSnapshot,
  workspaceId: string,
): readonly Readonly<Record<string, unknown>>[] {
  const encode = encodeURIComponent;
  return [
    ...snapshot.traces.filter((item) => item.workspaceId === workspaceId).map((item) => ({
      uri: `openxnet://workspaces/${encode(workspaceId)}/incidents/${encode(item.incidentId)}/traces/${encode(item.traceId)}`,
      name: `Trace ${item.traceId}`,
    })),
    ...snapshot.evidence.filter((item) => item.workspaceId === workspaceId).map((item) => ({
      uri: `openxnet://workspaces/${encode(workspaceId)}/evidence/${encode(item.evidenceId)}`,
      name: item.summary,
    })),
    ...snapshot.actions.filter((item) => item.workspaceId === workspaceId).map((item) => ({
      uri: `openxnet://workspaces/${encode(workspaceId)}/actions/${encode(item.actionId)}`,
      name: `Action ${item.actionId}`,
    })),
    ...snapshot.auditReceipts.filter((item) => item.workspaceId === workspaceId).map((item) => ({
      uri: `openxnet://workspaces/${encode(workspaceId)}/audit-receipts/${encode(item.receiptId)}`,
      name: `Receipt ${item.receiptId}`,
    })),
  ].map((item) => ({ ...item, mimeType: "application/json" }));
}

/** 把 Runtime 异常转换为 Tool Result 错误；输入未知错误，返回脱敏领域错误。 */
function normalizeToolError(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return {
      code: canonicalToolErrorCode(error.code),
      message: error.message.slice(0, 1_000),
      retryable: "retryable" in error && error.retryable === true,
      details: {},
    };
  }
  return { code: "UPSTREAM_UNAVAILABLE", message: "竞赛平台工具暂时不可用。", retryable: true, details: {} };
}

/** 把 Runtime 内部错误码投影为公共 ToolError 枚举。 */
function canonicalToolErrorCode(value: string): string {
  const canonical = new Set([
    "INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED", "APPROVAL_REQUIRED", "APPROVAL_INVALID",
    "RESOURCE_NOT_FOUND", "RESOURCE_VERSION_CONFLICT", "IDEMPOTENCY_CONFLICT", "PRECONDITION_FAILED",
    "RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "TOOL_TIMEOUT", "INTERNAL_ERROR",
  ]);
  if (canonical.has(value)) return value;
  if (["WORKSPACE_ACCESS_DENIED", "TRACE_SCOPE_MISMATCH", "SEPARATION_OF_DUTIES_REQUIRED"].includes(value)) {
    return "PERMISSION_DENIED";
  }
  if (["INCIDENT_NOT_FOUND", "TRACE_NOT_FOUND"].includes(value)) return "RESOURCE_NOT_FOUND";
  return "INTERNAL_ERROR";
}
