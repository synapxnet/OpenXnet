import { createReadStream } from "node:fs";
import { lstat, stat } from "node:fs/promises";
import {
  createServer,
  request as createProxyRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { connect as connectSocket, type Socket } from "node:net";
import path from "node:path";

/** Options used to host local UI assets and proxy the legacy backend. */
export interface LocalUiGatewayOptions {
  readonly staticRoot: string;
  readonly artifactRoot?: string;
  readonly vrAssetRoot?: string;
  readonly getBackendOrigin: () => string | null;
  readonly activateBackend?: () => Promise<string>;
  readonly host?: string;
  readonly backendWaitTimeoutMs?: number;
  readonly backendPollIntervalMs?: number;
}

interface StaticFile {
  readonly absolutePath: string;
  readonly size: number;
}

interface ByteRange {
  readonly start: number;
  readonly end: number;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".onnx": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".vrm": "model/gltf-binary",
  ".vrma": "application/octet-stream",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Transitional CSP that blocks remote code while legacy inline UI is migrated. */
const DESKTOP_UI_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob: http: https:",
  "connect-src 'self' data: blob: http: https: ws: wss:",
  "frame-src http: https:",
  "worker-src 'self' blob:",
  "form-action 'self'",
].join("; ");

/**
 * Serve the desktop UI immediately and bridge legacy HTTP/WebSocket traffic.
 */
export class LocalUiGateway {
  private readonly staticRoot: string;
  private readonly artifactRoot: string | null;
  private readonly vrAssetRoot: string | null;
  private readonly host: string;
  private readonly backendWaitTimeoutMs: number;
  private readonly backendPollIntervalMs: number;
  private server: Server | null = null;
  private originValue: string | null = null;
  private backendActivation: Promise<string> | null = null;

  /**
   * 创建尚未绑定端口的 Gateway；输入静态目录、可选 Artifact 目录和后端解析器，仅规范化配置，不访问网络或启动 Python。
   */
  public constructor(private readonly options: LocalUiGatewayOptions) {
    this.staticRoot = path.resolve(options.staticRoot);
    this.artifactRoot = options.artifactRoot === undefined
      ? null
      : path.resolve(options.artifactRoot);
    this.vrAssetRoot = options.vrAssetRoot === undefined
      ? null
      : path.resolve(options.vrAssetRoot);
    this.host = options.host ?? "127.0.0.1";
    this.backendWaitTimeoutMs = options.backendWaitTimeoutMs ?? 180_000;
    this.backendPollIntervalMs = options.backendPollIntervalMs ?? 100;
  }

  /**
   * Return the gateway origin after startup.
   *
   * @returns Bound HTTP origin.
   */
  public get origin(): string {
    if (this.originValue === null) {
      throw new Error("Local UI Gateway has not started.");
    }
    return this.originValue;
  }

  /**
   * Bind an ephemeral loopback port and begin serving UI requests.
   *
   * @returns Bound HTTP origin.
   */
  public async start(): Promise<string> {
    if (this.server !== null) {
      return this.origin;
    }

    const server = createServer(this.handleHttpRequest.bind(this));
    server.on("upgrade", this.handleUpgrade.bind(this));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, this.host, resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      await this.stop();
      throw new Error("Local UI Gateway did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /**
   * Stop accepting requests and close active Gateway connections.
   */
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
   * 提供本地 UI 与 Artifact 文件，其余请求按需代理旧后端；输入 HTTP 请求/响应，无返回，非法文件路径直接返回固定错误且不会激活 Python。
   */
  private async handleHttpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.isAllowedHost(request.headers.host)) {
      this.writeJsonError(response, 403, "INVALID_HOST", "Gateway host is not allowed.");
      return;
    }

    try {
      const requestUrl = new URL(request.url ?? "/", this.origin);
      if (request.method === "GET" || request.method === "HEAD") {
        if (requestUrl.pathname.startsWith("/uploaded_files/")) {
          const artifactFile = await this.resolveArtifactFile(requestUrl.pathname);
          if (artifactFile === null) {
            this.writeJsonError(response, 404, "ARTIFACT_NOT_FOUND", "Artifact file was not found.");
            return;
          }
          this.serveStaticFile(request, response, artifactFile);
          return;
        }
        if (requestUrl.pathname.startsWith("/vrm/")) {
          const vrAssetFile = await this.resolveVrAssetFile(requestUrl.pathname);
          if (vrAssetFile === null) {
            this.writeJsonError(response, 404, "VR_ASSET_NOT_FOUND", "VR asset file was not found.");
            return;
          }
          this.serveStaticFile(request, response, vrAssetFile);
          return;
        }
        const staticFile = await this.resolveStaticFile(requestUrl.pathname);
        if (staticFile !== null) {
          this.serveStaticFile(request, response, staticFile);
          return;
        }
      }
      await this.proxyHttpRequest(request, response);
    } catch (error) {
      if (!response.headersSent) {
        const message = error instanceof Error ? error.message : String(error);
        this.writeJsonError(response, 500, "UI_GATEWAY_FAILED", message);
      } else {
        response.destroy(error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * 把 `/uploaded_files/<filename>` 解析为应用目录内的普通文件；输入 URL 路径，返回文件元数据，目录穿越、子目录、符号链接或缺失文件返回 null。
   */
  private async resolveArtifactFile(pathname: string): Promise<StaticFile | null> {
    if (this.artifactRoot === null) {
      return null;
    }
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const prefix = "/uploaded_files/";
    if (!decodedPath.startsWith(prefix) || decodedPath.includes("\0")) {
      return null;
    }
    const fileName = decodedPath.slice(prefix.length);
    if (
      !fileName
      || fileName.startsWith(".")
      || fileName !== path.basename(fileName)
      || /[\\/\u0000-\u001F\u007F]/.test(fileName)
    ) {
      return null;
    }
    const candidate = path.resolve(this.artifactRoot, fileName);
    if (!this.isInsideRoot(this.artifactRoot, candidate)) {
      return null;
    }
    try {
      const fileStat = await lstat(candidate);
      return fileStat.isFile() && !fileStat.isSymbolicLink()
        ? { absolutePath: candidate, size: fileStat.size }
        : null;
    } catch {
      return null;
    }
  }

  /**
   * 把 `/vrm/<relative-path>` 解析为打包根内的普通文件；输入 URL 路径，返回文件元数据，点段、越界或任一层符号链接返回 null。
   */
  private async resolveVrAssetFile(pathname: string): Promise<StaticFile | null> {
    if (this.vrAssetRoot === null) return null;
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const prefix = "/vrm/";
    if (!decodedPath.startsWith(prefix) || decodedPath.length > 4096 || /[\\\u0000-\u001F\u007F]/.test(decodedPath)) {
      return null;
    }
    const relativePath = decodedPath.slice(prefix.length);
    const segments = relativePath.split("/");
    if (
      segments.length === 0
      || segments.length > 16
      || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith("."))
    ) {
      return null;
    }
    const candidate = path.resolve(this.vrAssetRoot, ...segments);
    if (!this.isInsideRoot(this.vrAssetRoot, candidate)) return null;
    let current = this.vrAssetRoot;
    try {
      const rootInfo = await lstat(current);
      if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return null;
      for (const [index, segment] of segments.entries()) {
        current = path.join(current, segment);
        const fileInfo = await lstat(current);
        if (fileInfo.isSymbolicLink()) return null;
        const isLast = index === segments.length - 1;
        if (isLast ? !fileInfo.isFile() : !fileInfo.isDirectory()) return null;
        if (isLast) return { absolutePath: current, size: fileInfo.size };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Proxy an upgraded WebSocket connection after the backend becomes ready.
   *
   * @param request Incoming upgrade request.
   * @param clientSocket Renderer network socket.
   * @param head Bytes received after the HTTP upgrade headers.
   */
  private async handleUpgrade(request: IncomingMessage, clientSocket: Socket, head: Buffer): Promise<void> {
    if (!this.isAllowedHost(request.headers.host)) {
      this.writeSocketError(clientSocket, 403, "Forbidden");
      return;
    }

    try {
      const backendOrigin = await this.waitForBackendOrigin();
      const target = new URL(backendOrigin);
      const upstreamSocket = connectSocket(Number(target.port || 80), target.hostname);

      /** Forward the original upgrade request after connecting to the backend. */
      function forwardUpgradeRequest(): void {
        const headerLines = [`${request.method ?? "GET"} ${request.url ?? "/"} HTTP/${request.httpVersion}`];
        for (let index = 0; index < request.rawHeaders.length; index += 2) {
          const name = request.rawHeaders[index];
          const value = request.rawHeaders[index + 1];
          if (name === undefined || value === undefined || name.toLowerCase() === "proxy-connection") {
            continue;
          }
          headerLines.push(`${name}: ${name.toLowerCase() === "host" ? target.host : value}`);
        }
        upstreamSocket.write(`${headerLines.join("\r\n")}\r\n\r\n`);
        if (head.length > 0) {
          upstreamSocket.write(head);
        }
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      }

      upstreamSocket.once("connect", forwardUpgradeRequest);
      upstreamSocket.once("error", () => this.writeSocketError(clientSocket, 502, "Bad Gateway"));
      clientSocket.once("error", () => upstreamSocket.destroy());
    } catch {
      this.writeSocketError(clientSocket, 503, "Backend Not Ready");
    }
  }

  /**
   * Resolve a URL path to a safe file inside the packaged static root.
   *
   * @param pathname URL pathname requested by the Renderer.
   * @returns Existing file metadata or null when the path belongs to the API.
   */
  private async resolveStaticFile(pathname: string): Promise<StaticFile | null> {
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decodedPath.includes("\0")) {
      return null;
    }

    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
    const baseCandidate = path.resolve(this.staticRoot, relativePath);
    if (!this.isInsideStaticRoot(baseCandidate)) {
      return null;
    }
    const candidates = path.extname(baseCandidate)
      ? [baseCandidate]
      : [baseCandidate, `${baseCandidate}.html`, path.join(baseCandidate, "index.html")];

    for (const candidate of candidates) {
      if (!this.isInsideStaticRoot(candidate)) {
        continue;
      }
      try {
        const fileStat = await stat(candidate);
        if (fileStat.isFile()) {
          return { absolutePath: candidate, size: fileStat.size };
        }
      } catch {
        // Missing static candidates fall through to the legacy API proxy.
      }
    }
    return null;
  }

  /**
   * Stream a static file with MIME, cache, HEAD, and single-range support.
   *
   * @param request Incoming static request.
   * @param response Gateway response.
   * @param file Resolved static file metadata.
   */
  private serveStaticFile(request: IncomingMessage, response: ServerResponse, file: StaticFile): void {
    const extension = path.extname(file.absolutePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    const rangeHeader = request.headers.range;
    const byteRange = rangeHeader === undefined ? null : this.parseByteRange(rangeHeader, file.size);

    response.setHeader("Content-Type", contentType);
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Cache-Control", extension === ".html" ? "no-cache" : "public, max-age=3600");
    response.setHeader("Content-Security-Policy", DESKTOP_UI_CONTENT_SECURITY_POLICY);
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (rangeHeader !== undefined && byteRange === null) {
      response.writeHead(416, { "Content-Range": `bytes */${file.size}` });
      response.end();
      return;
    }

    if (byteRange !== null) {
      const contentLength = byteRange.end - byteRange.start + 1;
      response.writeHead(206, {
        "Content-Length": contentLength,
        "Content-Range": `bytes ${byteRange.start}-${byteRange.end}/${file.size}`,
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(file.absolutePath, { start: byteRange.start, end: byteRange.end }).pipe(response);
      return;
    }

    response.writeHead(200, { "Content-Length": file.size });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(file.absolutePath).pipe(response);
  }

  /**
   * Proxy an HTTP request while preserving streaming request and response bodies.
   *
   * @param request Incoming Renderer request.
   * @param response Gateway response.
   */
  private async proxyHttpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let backendOrigin: string;
    try {
      backendOrigin = await this.waitForBackendOrigin();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.writeJsonError(response, 503, "BACKEND_NOT_READY", message);
      return;
    }

    const target = new URL(request.url ?? "/", backendOrigin);
    const headers = this.createProxyHeaders(request.headers, target.host);
    const upstream = createProxyRequest(target, {
      method: request.method,
      headers,
    });
    upstream.once("response", (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.statusMessage,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    });
    upstream.once("error", (error) => {
      if (!response.headersSent) {
        this.writeJsonError(response, 502, "BACKEND_PROXY_FAILED", error.message);
      } else {
        response.destroy(error);
      }
    });
    request.once("aborted", () => upstream.destroy());
    request.pipe(upstream);
  }

  /**
   * Wait until Desktop Core reports a usable backend origin.
   *
   * @returns Backend HTTP origin.
   */
  private async waitForBackendOrigin(): Promise<string> {
    const readyOrigin = this.options.getBackendOrigin();
    if (readyOrigin !== null) {
      return readyOrigin;
    }
    if (this.options.activateBackend !== undefined) {
      const activation = this.backendActivation
        ?? Promise.resolve().then(() => this.options.activateBackend?.() ?? "");
      this.backendActivation = activation;
      try {
        const activatedOrigin = await activation;
        if (!activatedOrigin) {
          throw new Error("Backend activation did not return an origin.");
        }
        return activatedOrigin;
      } finally {
        if (this.backendActivation === activation) {
          this.backendActivation = null;
        }
      }
    }
    const deadline = Date.now() + this.backendWaitTimeoutMs;
    while (Date.now() < deadline) {
      const origin = this.options.getBackendOrigin();
      if (origin !== null) {
        return origin;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, this.backendPollIntervalMs));
    }
    throw new Error(`Backend was not ready within ${this.backendWaitTimeoutMs} ms.`);
  }

  /**
   * Validate the Host header against the bound loopback Gateway endpoint.
   *
   * @param hostHeader Incoming Host header.
   * @returns True when the request targets this Gateway instance.
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
   * 判断候选绝对路径是否仍位于静态目录内；输入候选路径，返回布尔值，无副作用且不访问文件系统。
   */
  private isInsideStaticRoot(candidate: string): boolean {
    return this.isInsideRoot(this.staticRoot, candidate);
  }

  /**
   * 判断候选绝对路径是否仍位于指定根目录内；输入根目录和候选路径，返回布尔值，无副作用且不访问文件系统。
   */
  private isInsideRoot(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }

  /**
   * Parse a standards-compliant single byte range.
   *
   * @param header HTTP Range header.
   * @param size Full file size.
   * @returns Normalized byte range or null for unsupported/invalid input.
   */
  private parseByteRange(header: string, size: number): ByteRange | null {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (match === null || size <= 0) {
      return null;
    }
    const startText = match[1] ?? "";
    const endText = match[2] ?? "";
    if (!startText && !endText) {
      return null;
    }
    if (!startText) {
      const suffixLength = Number(endText);
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        return null;
      }
      return { start: Math.max(0, size - suffixLength), end: size - 1 };
    }

    const start = Number(startText);
    const requestedEnd = endText ? Number(endText) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) {
      return null;
    }
    return { start, end: Math.min(requestedEnd, size - 1) };
  }

  /**
   * Copy request headers while replacing hop-by-hop and destination values.
   *
   * @param headers Incoming request headers.
   * @param targetHost Backend host and port.
   * @returns Headers safe to send to the backend.
   */
  private createProxyHeaders(headers: IncomingHttpHeaders, targetHost: string): IncomingHttpHeaders {
    const proxyHeaders = { ...headers };
    delete proxyHeaders.connection;
    delete proxyHeaders["proxy-connection"];
    proxyHeaders.host = targetHost;
    proxyHeaders["x-openxnet-ui-gateway"] = "1";
    return proxyHeaders;
  }

  /**
   * Return a structured JSON error without exposing internal stack traces.
   *
   * @param response Gateway response.
   * @param statusCode HTTP error status.
   * @param code Stable machine-readable error code.
   * @param message Human-readable diagnostic.
   */
  private writeJsonError(
    response: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    const body = JSON.stringify({ error: { code, message } });
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }

  /**
   * Write a minimal HTTP error response to a raw upgrade socket.
   *
   * @param socket Client upgrade socket.
   * @param statusCode HTTP status code.
   * @param statusText HTTP status text.
   */
  private writeSocketError(socket: Socket, statusCode: number, statusText: string): void {
    if (socket.destroyed) {
      return;
    }
    socket.end(
      `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  }
}
