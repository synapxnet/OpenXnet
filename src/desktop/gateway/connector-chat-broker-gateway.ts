import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  request as createProxyRequest,
  type ClientRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

/** Exact private route exposed only to the supervised Connector Worker. */
export const CONNECTOR_CHAT_BROKER_PATH = "/v1/chat/completions";

/** Exact top-level fields accepted by the private Connector Chat contract. */
const CONNECTOR_CHAT_REQUEST_FIELDS = new Set([
  "model",
  "messages",
  "tools",
  "stream",
  "temperature",
  "max_tokens",
  "top_p",
  "fileLinks",
  "enable_thinking",
  "enable_deep_research",
  "enable_web_search",
  "asyncToolsID",
  "reasoning_effort",
  "is_app_bot",
  "is_sub_agent",
  "behavior_trigger",
  "enable_tools",
  "disable_tools",
  "conversationId",
  "conversation_id",
]);

/** Request-scoped Execution Engine lease used by Connector Chat traffic. */
export interface ConnectorChatEngineLease {
  readonly origin: string;
  release(): void;
}

/** Dependencies and budgets for the private Connector Chat boundary. */
export interface ConnectorChatBrokerGatewayOptions {
  readonly token: string;
  readonly upstreamToken: string;
  readonly acquireChatEngine: () => Promise<ConnectorChatEngineLease>;
  readonly host?: string;
  readonly maxBodyBytes?: number;
  readonly maxResponseBytes?: number;
}

/** Internal error used to reject a request before engine activation. */
class ConnectorChatRequestError extends Error {
  /** Create one stable broker validation error. */
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConnectorChatRequestError";
  }
}

/** Authenticate Connector Worker Chat traffic and proxy it to Execution Engine. */
export class ConnectorChatBrokerGateway {
  private readonly host: string;
  private readonly maxBodyBytes: number;
  private readonly maxResponseBytes: number;
  private readonly activeUpstreamRequests = new Set<ClientRequest>();
  private server: Server | null = null;
  private originValue: string | null = null;

  /** Create an unbound gateway with separate caller and upstream credentials. */
  public constructor(private readonly options: ConnectorChatBrokerGatewayOptions) {
    if (!options.token.trim() || !options.upstreamToken.trim()) {
      throw new Error("Connector Chat Broker requires non-empty caller and upstream tokens.");
    }
    this.host = options.host ?? "127.0.0.1";
    this.maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024;
    this.maxResponseBytes = options.maxResponseBytes ?? 8 * 1024 * 1024;
  }

  /** Return the loopback origin after the gateway starts. */
  public get origin(): string {
    if (this.originValue === null) {
      throw new Error("Connector Chat Broker has not started.");
    }
    return this.originValue;
  }

  /** Bind an ephemeral loopback port without activating Execution Engine. */
  public async start(): Promise<string> {
    if (this.server !== null) {
      return this.origin;
    }
    const server = createServer(this.handleRequest.bind(this));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, this.host, resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      await this.stop();
      throw new Error("Connector Chat Broker did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** Stop accepting requests and terminate active upstream streams. */
  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.originValue = null;
    for (const request of this.activeUpstreamRequests) {
      request.destroy();
    }
    this.activeUpstreamRequests.clear();
    if (server === null) {
      return;
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** Validate one private request before acquiring an Execution Engine lease. */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let requestAborted = false;
    request.once("aborted", () => {
      requestAborted = true;
    });
    if (!this.isAllowedHost(request.headers.host)) {
      request.resume();
      this.writeError(response, 403, "INVALID_HOST", "Connector Chat host is not allowed.");
      return;
    }
    const requestUrl = new URL(request.url ?? "/", this.origin);
    if (requestUrl.pathname !== CONNECTOR_CHAT_BROKER_PATH || requestUrl.search) {
      request.resume();
      this.writeError(response, 404, "NOT_FOUND", "Connector Chat route was not found.");
      return;
    }
    if (request.method !== "POST") {
      request.resume();
      this.writeError(response, 405, "METHOD_NOT_ALLOWED", "Connector Chat accepts POST only.");
      return;
    }
    if (!this.isAuthorized(request.headers.authorization)) {
      request.resume();
      this.writeError(response, 401, "UNAUTHORIZED", "Connector Chat authentication failed.");
      return;
    }

    try {
      const body = await this.readAndValidateRequestBody(request);
      if (requestAborted) {
        return;
      }
      const engineLease = await this.acquireChatEngine();
      if (requestAborted) {
        engineLease.release();
        return;
      }
      this.proxyRequest(request, response, body, engineLease);
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }
      if (error instanceof ConnectorChatRequestError) {
        request.resume();
        this.writeError(response, error.statusCode, error.code, error.message);
        return;
      }
      this.writeError(
        response,
        503,
        "CONNECTOR_CHAT_UNAVAILABLE",
        "Connector Chat service is unavailable.",
      );
    }
  }

  /** Read bounded UTF-8 JSON and enforce the exact top-level Chat schema. */
  private async readAndValidateRequestBody(request: IncomingMessage): Promise<Buffer> {
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.maxBodyBytes) {
      throw new ConnectorChatRequestError(413, "REQUEST_TOO_LARGE", "Connector Chat request is too large.");
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > this.maxBodyBytes) {
        throw new ConnectorChatRequestError(413, "REQUEST_TOO_LARGE", "Connector Chat request is too large.");
      }
      chunks.push(buffer);
    }
    const body = Buffer.concat(chunks);
    let payload: unknown;
    try {
      payload = JSON.parse(body.toString("utf8")) as unknown;
    } catch {
      throw new ConnectorChatRequestError(400, "INVALID_REQUEST", "Connector Chat request is invalid.");
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new ConnectorChatRequestError(400, "INVALID_REQUEST", "Connector Chat request is invalid.");
    }
    const record = payload as Record<string, unknown>;
    if (
      !Array.isArray(record.messages)
      || record.messages.length < 1
      || record.messages.length > 256
      || Object.keys(record).some((field) => !CONNECTOR_CHAT_REQUEST_FIELDS.has(field))
    ) {
      throw new ConnectorChatRequestError(422, "INVALID_REQUEST", "Connector Chat request is invalid.");
    }
    return body;
  }

  /** Acquire and validate one request-scoped Execution Engine lease. */
  private async acquireChatEngine(): Promise<ConnectorChatEngineLease> {
    const lease = await this.options.acquireChatEngine();
    const origin = this.normalizeEngineOrigin(lease.origin);
    let released = false;
    return {
      origin,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        lease.release();
      },
    };
  }

  /** Proxy one validated Chat request while retaining its engine lease. */
  private proxyRequest(
    sourceRequest: IncomingMessage,
    response: ServerResponse,
    body: Buffer,
    engineLease: ConnectorChatEngineLease,
  ): void {
    const target = new URL(CONNECTOR_CHAT_BROKER_PATH, engineLease.origin);
    let leaseReleased = false;
    const releaseLease = (): void => {
      if (leaseReleased) {
        return;
      }
      leaseReleased = true;
      engineLease.release();
    };
    let upstream: ClientRequest;
    try {
      upstream = createProxyRequest(target, {
        method: "POST",
        headers: {
          Accept: String(sourceRequest.headers.accept ?? "application/json"),
          Authorization: `Bearer ${this.options.upstreamToken}`,
          "Cache-Control": "no-store",
          "Content-Length": String(body.length),
          "Content-Type": "application/json; charset=utf-8",
          Host: target.host,
        },
      });
    } catch (error) {
      releaseLease();
      throw error;
    }
    this.activeUpstreamRequests.add(upstream);
    const release = (): void => {
      this.activeUpstreamRequests.delete(upstream);
      releaseLease();
    };
    upstream.once("close", release);
    upstream.once("response", (upstreamResponse) => {
      const statusCode = upstreamResponse.statusCode ?? 502;
      if (statusCode < 200 || statusCode >= 300) {
        upstreamResponse.resume();
        upstreamResponse.once("end", release);
        this.writeError(
          response,
          statusCode >= 500 ? 503 : 422,
          statusCode >= 500 ? "CONNECTOR_CHAT_UNAVAILABLE" : "CONNECTOR_CHAT_REJECTED",
          "Connector Chat request failed.",
        );
        return;
      }
      const headers: Record<string, string> = { "Cache-Control": "no-store" };
      const contentType = upstreamResponse.headers["content-type"];
      if (typeof contentType === "string") {
        headers["Content-Type"] = contentType;
      }
      response.writeHead(statusCode, headers);
      let responseBytes = 0;
      upstreamResponse.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        responseBytes += buffer.length;
        if (responseBytes > this.maxResponseBytes) {
          upstreamResponse.destroy();
          response.destroy();
          return;
        }
        if (!response.write(buffer)) {
          upstreamResponse.pause();
          response.once("drain", () => upstreamResponse.resume());
        }
      });
      upstreamResponse.once("end", () => {
        response.end();
        release();
      });
      upstreamResponse.once("close", release);
      upstreamResponse.once("error", () => response.destroy());
    });
    upstream.once("error", () => {
      if (!response.headersSent && !response.destroyed) {
        this.writeError(
          response,
          502,
          "CONNECTOR_CHAT_UNAVAILABLE",
          "Connector Chat service is unavailable.",
        );
      } else {
        response.destroy();
      }
    });
    sourceRequest.once("aborted", () => upstream.destroy());
    response.once("close", () => {
      if (!response.writableEnded) {
        upstream.destroy();
      }
    });
    upstream.end(body);
  }

  /** Require an exact loopback origin returned by Execution Engine supervision. */
  private normalizeEngineOrigin(value: string): string {
    const normalized = String(value ?? "").trim().replace(/\/$/, "");
    const parsed = new URL(normalized);
    if (
      parsed.protocol !== "http:"
      || !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
      || !parsed.port
      || parsed.username
      || parsed.password
      || !["", "/"].includes(parsed.pathname)
      || parsed.search
      || parsed.hash
    ) {
      throw new Error("Connector Chat engine returned an invalid loopback origin.");
    }
    return normalized;
  }

  /** Compare the Connector Worker bearer without token-prefix timing leakage. */
  private isAuthorized(authorization: string | undefined): boolean {
    const prefix = "Bearer ";
    if (authorization === undefined || !authorization.startsWith(prefix)) {
      return false;
    }
    const expected = Buffer.from(this.options.token, "utf8");
    const received = Buffer.from(authorization.slice(prefix.length), "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /** Validate Host against the gateway's exact bound loopback endpoint. */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (hostHeader === undefined || this.originValue === null) {
      return false;
    }
    const expectedHost = new URL(this.originValue).host.toLowerCase();
    const normalizedHost = hostHeader.trim().toLowerCase();
    return normalizedHost === expectedHost
      || normalizedHost === expectedHost.replace("127.0.0.1", "localhost");
  }

  /** Write one bounded caller-safe no-cache broker error. */
  private writeError(
    response: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    const body = JSON.stringify({
      schema: "openxnet.connector-chat-broker-error.v1",
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
