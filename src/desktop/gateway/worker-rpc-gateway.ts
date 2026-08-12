import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { isCapabilityId, type CapabilityId } from "../contracts/capability";
import type { DesktopCore } from "../core/desktop-core";
import { WorkerRequestError, type WorkerSupervisor } from "../workers/worker-supervisor";

/** Options for the authenticated loopback bridge used by legacy backend adapters. */
export interface WorkerRpcGatewayOptions {
  readonly core: DesktopCore;
  readonly supervisor: WorkerSupervisor;
  readonly token: string;
  readonly allowedMethods: Readonly<Partial<Record<CapabilityId, readonly string[]>>>;
  readonly host?: string;
  readonly maxBodyBytes?: number;
}

interface WorkerRpcRequest {
  readonly capability: CapabilityId;
  readonly method: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Internal error used to distinguish request size violations from malformed JSON. */
class RequestBodyTooLargeError extends Error {
  /** Create a body-limit failure with a stable error name. */
  public constructor() {
    super("Worker RPC request body exceeds the configured limit.");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Expose allow-listed WorkerSupervisor requests to trusted loopback processes.
 */
export class WorkerRpcGateway {
  private readonly host: string;
  private readonly maxBodyBytes: number;
  private server: Server | null = null;
  private originValue: string | null = null;

  /**
   * Create an unbound gateway for one Desktop Core and worker supervisor.
   *
   * @param options Authentication, method allow-list, and runtime dependencies.
   */
  public constructor(private readonly options: WorkerRpcGatewayOptions) {
    if (!options.token.trim()) {
      throw new Error("Worker RPC Gateway requires a non-empty authentication token.");
    }
    this.host = options.host ?? "127.0.0.1";
    this.maxBodyBytes = options.maxBodyBytes ?? 64 * 1024;
  }

  /**
   * Return the loopback origin after the gateway starts.
   *
   * @returns Bound HTTP origin.
   */
  public get origin(): string {
    if (this.originValue === null) {
      throw new Error("Worker RPC Gateway has not started.");
    }
    return this.originValue;
  }

  /**
   * Bind an ephemeral loopback port.
   *
   * @returns Bound HTTP origin.
   */
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
      throw new Error("Worker RPC Gateway did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** Stop accepting requests and close active loopback connections. */
  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.originValue = null;
    if (server === null) {
      return;
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /**
   * Authenticate, validate, and dispatch one Worker RPC request.
   *
   * @param request Incoming loopback HTTP request.
   * @param response HTTP response returned to the trusted adapter.
   */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.isAllowedHost(request.headers.host)) {
      this.writeError(response, 403, "INVALID_HOST", "Worker RPC host is not allowed.", false);
      return;
    }
    const requestUrl = new URL(request.url ?? "/", this.origin);
    if (requestUrl.pathname !== "/v1/workers/request") {
      this.writeError(response, 404, "NOT_FOUND", "Worker RPC route was not found.", false);
      return;
    }
    if (request.method !== "POST") {
      this.writeError(response, 405, "METHOD_NOT_ALLOWED", "Worker RPC accepts POST only.", false);
      return;
    }
    if (!this.isAuthorized(request.headers.authorization)) {
      this.writeError(response, 401, "UNAUTHORIZED", "Worker RPC authentication failed.", false);
      return;
    }

    try {
      const rpcRequest = await this.parseRequest(request);
      await this.options.core.ensureCapability(rpcRequest.capability);
      const payload = await this.options.supervisor.request(
        rpcRequest.capability,
        rpcRequest.method,
        rpcRequest.payload,
      );
      this.writeJson(response, 200, { ok: true, payload });
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        this.writeError(response, 413, "REQUEST_TOO_LARGE", error.message, false);
        return;
      }
      if (error instanceof WorkerRequestError) {
        this.writeError(
          response,
          error.retryable ? 503 : 422,
          error.code,
          error.message,
          error.retryable,
        );
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = error instanceof SyntaxError || error instanceof TypeError ? 400 : 503;
      this.writeError(response, statusCode, "WORKER_RPC_FAILED", message, statusCode === 503);
    }
  }

  /**
   * Read and validate the small JSON control request.
   *
   * @param request Incoming request stream.
   * @returns Validated capability, method, and payload.
   */
  private async parseRequest(request: IncomingMessage): Promise<WorkerRpcRequest> {
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.maxBodyBytes) {
      throw new RequestBodyTooLargeError();
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > this.maxBodyBytes) {
        throw new RequestBodyTooLargeError();
      }
      chunks.push(buffer);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!this.isRecord(value)) {
      throw new TypeError("Worker RPC body must be a JSON object.");
    }
    const capability = value.capability;
    const method = value.method;
    const payload = value.payload;
    if (!isCapabilityId(capability)) {
      throw new TypeError("Worker RPC capability is invalid.");
    }
    if (typeof method !== "string" || !method.trim()) {
      throw new TypeError("Worker RPC method must be non-empty text.");
    }
    if (!this.options.allowedMethods[capability]?.includes(method)) {
      throw new TypeError(`Worker RPC method '${method}' is not allowed for '${capability}'.`);
    }
    if (!this.isRecord(payload)) {
      throw new TypeError("Worker RPC payload must be a JSON object.");
    }
    return { capability, method, payload };
  }

  /**
   * Compare bearer credentials without leaking token-prefix timing information.
   *
   * @param authorization Incoming Authorization header.
   * @returns True when the bearer token exactly matches.
   */
  private isAuthorized(authorization: string | undefined): boolean {
    const prefix = "Bearer ";
    if (authorization === undefined || !authorization.startsWith(prefix)) {
      return false;
    }
    const expected = Buffer.from(this.options.token, "utf8");
    const received = Buffer.from(authorization.slice(prefix.length), "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /**
   * Validate the Host header against the actual bound loopback endpoint.
   *
   * @param hostHeader Incoming Host header.
   * @returns True when the request targets this gateway instance.
   */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (hostHeader === undefined || this.originValue === null) {
      return false;
    }
    const expectedHost = new URL(this.originValue).host.toLowerCase();
    const normalizedHost = hostHeader.trim().toLowerCase();
    return normalizedHost === expectedHost || normalizedHost === expectedHost.replace("127.0.0.1", "localhost");
  }

  /**
   * Determine whether an unknown JSON value is a string-keyed object.
   *
   * @param value Unknown decoded JSON value.
   * @returns True when fields can be read safely.
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Write a structured Worker RPC error envelope.
   *
   * @param response Outgoing HTTP response.
   * @param statusCode HTTP status code.
   * @param code Stable machine-readable error code.
   * @param message Human-readable diagnostic.
   * @param retryable Whether the caller may retry the operation.
   */
  private writeError(
    response: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
    retryable: boolean,
  ): void {
    this.writeJson(response, statusCode, { ok: false, error: { code, message, retryable } });
  }

  /**
   * Serialize one no-cache UTF-8 JSON response.
   *
   * @param response Outgoing HTTP response.
   * @param statusCode HTTP status code.
   * @param value Serializable response body.
   */
  private writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
    const body = JSON.stringify(value);
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }
}
