import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  request as createProxyRequest,
  type ClientRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

/** Exact task broker routes exposed to the supervised Task Worker. */
export const TASK_EXECUTION_BROKER_PATHS = new Set([
  "/v1/tasks/executor/preflight",
  "/v1/tasks/executor/session/turn",
  "/v1/tasks/executor/session/evaluate",
  "/v1/tasks/executor/session/cancel",
  "/v1/tasks/executor/delivery/dispatch",
]);

/** Dependencies used by the lightweight Desktop task broker boundary. */
export interface TaskExecutionBrokerGatewayOptions {
  readonly token: string;
  readonly acquireProviderEngine: () => Promise<TaskExecutionProviderEngineLease>;
  readonly resolveDeliveryCredentialBootstrap?: (scope: Readonly<Record<string, unknown>>) => string;
  readonly host?: string;
  readonly maxBodyBytes?: number;
}

/** Request-scoped lease returned by the independently supervised provider engine. */
export interface TaskExecutionProviderEngineLease {
  readonly origin: string;
  release(): void;
}

/** Internal error used to preserve bounded request handling. */
class TaskBrokerRequestTooLargeError extends Error {
  /** Create one stable request-size error. */
  public constructor() {
    super("Task broker request exceeds the configured limit.");
    this.name = "TaskBrokerRequestTooLargeError";
  }
}

/**
 * Authenticate Task Worker traffic and activate the provider engine only on demand.
 */
export class TaskExecutionBrokerGateway {
  private readonly host: string;
  private readonly maxBodyBytes: number;
  private readonly activeUpstreamRequests = new Set<ClientRequest>();
  private server: Server | null = null;
  private originValue: string | null = null;

  /**
   * Create an unbound gateway with a process-scoped bearer credential.
   *
   * @param options Authentication, activation, and request-budget options.
   */
  public constructor(private readonly options: TaskExecutionBrokerGatewayOptions) {
    if (!options.token.trim()) {
      throw new Error("Task Execution Broker Gateway requires a non-empty token.");
    }
    this.host = options.host ?? "127.0.0.1";
    this.maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024;
  }

  /** Return the loopback origin after the gateway starts. */
  public get origin(): string {
    if (this.originValue === null) {
      throw new Error("Task Execution Broker Gateway has not started.");
    }
    return this.originValue;
  }

  /** Bind an ephemeral loopback port without activating the provider engine. */
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
      throw new Error("Task Execution Broker Gateway did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** Stop accepting broker traffic and terminate active upstream streams. */
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

  /**
   * Validate and proxy one exact Task Worker broker request.
   *
   * @param request Incoming loopback HTTP request.
   * @param response HTTP response returned to Task Worker.
   */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let requestAborted = false;
    request.once("aborted", () => {
      requestAborted = true;
    });
    if (!this.isAllowedHost(request.headers.host)) {
      request.resume();
      this.writeError(response, 403, "INVALID_HOST", "Task broker host is not allowed.");
      return;
    }
    const requestUrl = new URL(request.url ?? "/", this.origin);
    if (!TASK_EXECUTION_BROKER_PATHS.has(requestUrl.pathname) || requestUrl.search) {
      request.resume();
      this.writeError(response, 404, "NOT_FOUND", "Task broker route was not found.");
      return;
    }
    if (request.method !== "POST") {
      request.resume();
      this.writeError(response, 405, "METHOD_NOT_ALLOWED", "Task broker accepts POST only.");
      return;
    }
    if (!this.isAuthorized(request.headers.authorization)) {
      request.resume();
      this.writeError(response, 401, "UNAUTHORIZED", "Task broker authentication failed.");
      return;
    }

    try {
      const requestBody = await this.readRequestBody(request);
      const body = this.injectDeliveryCredentialBootstrap(requestUrl.pathname, requestBody);
      if (requestAborted) {
        return;
      }
      const engineLease = await this.acquireProviderEngine();
      if (requestAborted) {
        engineLease.release();
        return;
      }
      this.proxyRequest(requestUrl.pathname, request, response, body, engineLease);
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }
      if (error instanceof TaskBrokerRequestTooLargeError) {
        request.resume();
        this.writeError(response, 413, "REQUEST_TOO_LARGE", error.message);
        return;
      }
      this.writeError(
        response,
        503,
        "TASK_PROVIDER_ENGINE_UNAVAILABLE",
        "Task provider engine is unavailable.",
      );
    }
  }

  /**
   * Read one bounded JSON request before starting the heavyweight provider engine.
   *
   * @param request Incoming request stream.
   * @returns Exact buffered request bytes.
   */
  private async readRequestBody(request: IncomingMessage): Promise<Buffer> {
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.maxBodyBytes) {
      throw new TaskBrokerRequestTooLargeError();
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > this.maxBodyBytes) {
        throw new TaskBrokerRequestTooLargeError();
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  /** Inject one Main-owned request-scoped credential only on the exact delivery route. */
  private injectDeliveryCredentialBootstrap(pathname: string, body: Buffer): Buffer {
    if (
      pathname !== "/v1/tasks/executor/delivery/dispatch"
      || this.options.resolveDeliveryCredentialBootstrap === undefined
    ) {
      return body;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body.toString("utf8")) as unknown;
    } catch {
      throw new Error("Task delivery broker body is invalid.");
    }
    if (
      typeof payload !== "object"
      || payload === null
      || Array.isArray(payload)
      || Object.prototype.hasOwnProperty.call(payload, "deliveryCredentialBootstrap")
    ) {
      throw new Error("Task delivery broker body is invalid.");
    }
    const record = payload as Record<string, unknown>;
    const bootstrap = this.options.resolveDeliveryCredentialBootstrap({
      workspacePath: record.workspacePath,
      taskId: record.taskId,
      target: record.target,
    });
    if (!bootstrap) return body;
    const enriched = Buffer.from(JSON.stringify({
      ...record,
      deliveryCredentialBootstrap: bootstrap,
    }), "utf8");
    if (enriched.byteLength > this.maxBodyBytes) throw new TaskBrokerRequestTooLargeError();
    return enriched;
  }

  /** Acquire and validate one request-scoped provider-engine lease. */
  private async acquireProviderEngine(): Promise<TaskExecutionProviderEngineLease> {
    const lease = await this.options.acquireProviderEngine();
    const origin = this.normalizeProviderEngineOrigin(lease.origin);
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

  /**
   * Forward one authenticated request while preserving streamed provider events.
   *
   * @param pathname Exact broker route.
   * @param sourceRequest Original Task Worker request.
   * @param response Outgoing Task Worker response.
   * @param body Validated request bytes.
   * @param engineLease Request activity lease for the provider engine.
   */
  private proxyRequest(
    pathname: string,
    sourceRequest: IncomingMessage,
    response: ServerResponse,
    body: Buffer,
    engineLease: TaskExecutionProviderEngineLease,
  ): void {
    const target = new URL(pathname, engineLease.origin);
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
          Authorization: `Bearer ${this.options.token}`,
          "Cache-Control": "no-store",
          "Content-Length": String(body.length),
          "Content-Type": String(
            sourceRequest.headers["content-type"] ?? "application/json; charset=utf-8",
          ),
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
      const headers: Record<string, string> = {
        "Cache-Control": "no-store",
      };
      const contentType = upstreamResponse.headers["content-type"];
      if (typeof contentType === "string") {
        headers["Content-Type"] = contentType;
      }
      response.writeHead(upstreamResponse.statusCode ?? 502, headers);
      upstreamResponse.once("end", release);
      upstreamResponse.once("close", release);
      upstreamResponse.pipe(response);
    });
    upstream.once("error", () => {
      if (!response.headersSent && !response.destroyed) {
        this.writeError(
          response,
          502,
          "TASK_PROVIDER_ENGINE_FAILED",
          "Task provider engine request failed.",
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

  /**
   * Require one exact loopback HTTP origin returned by the provider activator.
   *
   * @param value Candidate provider-engine origin.
   * @returns Normalized origin without a trailing slash.
   */
  private normalizeProviderEngineOrigin(value: string): string {
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
      throw new Error("Task provider engine returned an invalid loopback origin.");
    }
    return normalized;
  }

  /** Compare the bearer credential without leaking token-prefix timing. */
  private isAuthorized(authorization: string | undefined): boolean {
    const prefix = "Bearer ";
    if (authorization === undefined || !authorization.startsWith(prefix)) {
      return false;
    }
    const expected = Buffer.from(this.options.token, "utf8");
    const received = Buffer.from(authorization.slice(prefix.length), "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /** Validate the Host header against the bound loopback endpoint. */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (hostHeader === undefined || this.originValue === null) {
      return false;
    }
    const expectedHost = new URL(this.originValue).host.toLowerCase();
    const normalizedHost = hostHeader.trim().toLowerCase();
    return normalizedHost === expectedHost
      || normalizedHost === expectedHost.replace("127.0.0.1", "localhost");
  }

  /**
   * Write one bounded no-cache broker error.
   *
   * @param response Outgoing HTTP response.
   * @param statusCode HTTP status code.
   * @param code Stable machine-readable error code.
   * @param message Generic caller-safe message.
   */
  private writeError(
    response: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    const body = JSON.stringify({
      schema: "openxnet.task-broker-error.v1",
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
