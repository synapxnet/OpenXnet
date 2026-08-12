import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import {
  createServer,
  request as createProxyRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";

import { isPathInside, requirePackageId } from "../package-management/safe-package-archive";

/** 独立扩展页面 Gateway 的依赖。 */
export interface ApplicationExtensionGatewayOptions {
  readonly extensionRoot: string;
  readonly getNodePort: (extensionId: string) => number | null;
  readonly host?: string;
}

interface ExtensionStaticFile {
  readonly absolutePath: string;
  readonly size: number;
}

const EXTENSION_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

const EXTENSION_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors http://127.0.0.1:* http://localhost:*",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "form-action 'self' https:",
].join("; ");

/** 在独立回环 Origin 上提供扩展静态文件或代理已监督 Node 进程。 */
export class ApplicationExtensionGateway {
  private readonly extensionRoot: string;
  private readonly host: string;
  private server: Server | null = null;
  private originValue: string | null = null;

  /** 创建尚未监听端口的扩展 Gateway；输入扩展根和端口解析器，仅规范化配置，不访问文件或启动进程。 */
  public constructor(private readonly options: ApplicationExtensionGatewayOptions) {
    this.extensionRoot = path.resolve(options.extensionRoot);
    this.host = options.host ?? "127.0.0.1";
  }

  /** 返回已绑定回环 Origin；无输入，未启动时抛错，无其他副作用。 */
  public get origin(): string {
    if (this.originValue === null) throw new Error("Extension Gateway has not started.");
    return this.originValue;
  }

  /** 绑定临时回环端口；无输入，返回 Origin，重复调用复用服务器，绑定失败时拒绝。 */
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
      throw new Error("Extension Gateway did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** 停止扩展 Gateway；无输入和返回，可重复调用，会关闭现有连接。 */
  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.originValue = null;
    if (server === null) return;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** 处理扩展 HTTP 请求；输入请求/响应，无返回，非法 Host、ID 或路径返回固定错误。 */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.isAllowedHost(request.headers.host)) {
      this.writeError(response, 403, "INVALID_HOST", "Extension Gateway host is not allowed.");
      return;
    }
    try {
      const requestUrl = new URL(request.url ?? "/", this.origin);
      const route = this.parseRoute(requestUrl.pathname);
      if (route === null) {
        this.writeError(response, 404, "EXTENSION_ROUTE_NOT_FOUND", "Extension route was not found.");
        return;
      }
      const nodePort = this.options.getNodePort(route.extensionId);
      if (nodePort !== null) {
        this.proxyNodeRequest(request, response, requestUrl, nodePort, route.relativePath);
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        this.writeError(response, 405, "METHOD_NOT_ALLOWED", "Static extensions support GET and HEAD only.");
        return;
      }
      const file = await this.resolveStaticFile(route.extensionId, route.relativePath);
      if (file === null) {
        this.writeError(response, 404, "EXTENSION_FILE_NOT_FOUND", "Extension file was not found.");
        return;
      }
      this.serveStaticFile(request, response, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) this.writeError(response, 500, "EXTENSION_GATEWAY_FAILED", message);
      else response.destroy(error instanceof Error ? error : undefined);
    }
  }

  /** 解析 `/<extension-id>/<path>`；输入 URL 路径，返回安全路由，编码异常、点段或控制字符时返回 null。 */
  private parseRoute(pathname: string): { readonly extensionId: string; readonly relativePath: string } | null {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.length > 4096 || /[\\\u0000-\u001F\u007F]/.test(decoded)) return null;
    const segments = decoded.replace(/^\/+/, "").split("/");
    if (segments.length === 0 || segments.length > 64 || segments.some((segment, index) => index > 0 && (segment === "." || segment === ".."))) {
      return null;
    }
    let extensionId: string;
    try {
      extensionId = requirePackageId(segments[0], "Extension id");
    } catch {
      return null;
    }
    const remaining = segments.slice(1);
    if (remaining.some((segment) => segment === "." || segment === "..")) return null;
    return { extensionId, relativePath: remaining.filter(Boolean).join("/") };
  }

  /** 解析扩展内静态文件；输入扩展 ID 和相对路径，返回普通文件元数据，越界、链接或缺失时返回 null。 */
  private async resolveStaticFile(extensionId: string, relativePath: string): Promise<ExtensionStaticFile | null> {
    const extensionDirectory = path.join(this.extensionRoot, extensionId);
    const segments = (relativePath || "index.html").split("/").filter(Boolean);
    if (segments.length === 0 || segments.some((segment) => segment.startsWith(".") || segment === "..")) return null;
    const candidate = path.resolve(extensionDirectory, ...segments);
    if (!isPathInside(extensionDirectory, candidate)) return null;
    try {
      const rootInfo = await lstat(extensionDirectory);
      if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return null;
      let current = extensionDirectory;
      for (const [index, segment] of segments.entries()) {
        current = path.join(current, segment);
        const info = await lstat(current);
        if (info.isSymbolicLink()) return null;
        const isLast = index === segments.length - 1;
        if (!isLast && !info.isDirectory()) return null;
        if (isLast && info.isDirectory()) {
          const indexPath = path.join(current, "index.html");
          const indexInfo = await lstat(indexPath);
          return indexInfo.isFile() && !indexInfo.isSymbolicLink()
            ? { absolutePath: indexPath, size: indexInfo.size }
            : null;
        }
        if (isLast) return info.isFile() ? { absolutePath: current, size: info.size } : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /** 流式返回扩展静态文件；输入请求、响应和文件，无返回，设置隔离 CSP 且不缓存 HTML。 */
  private serveStaticFile(request: IncomingMessage, response: ServerResponse, file: ExtensionStaticFile): void {
    const extension = path.extname(file.absolutePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": EXTENSION_CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Content-Length": file.size,
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=300",
      "Content-Security-Policy": EXTENSION_CONTENT_SECURITY_POLICY,
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(file.absolutePath).pipe(response);
  }

  /** 把扩展请求流式代理到受监督回环 Node 端口；输入请求、响应、URL、端口和相对路径，无返回。 */
  private proxyNodeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
    port: number,
    relativePath: string,
  ): void {
    const target = new URL(`http://127.0.0.1:${port}/${relativePath}${requestUrl.search}`);
    const upstream = createProxyRequest(target, {
      method: request.method,
      headers: this.createProxyHeaders(request.headers, target.host),
    });
    upstream.once("response", (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.statusMessage, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.once("error", (error) => {
      if (!response.headersSent) this.writeError(response, 502, "EXTENSION_PROXY_FAILED", error.message);
      else response.destroy(error);
    });
    request.once("aborted", () => upstream.destroy());
    request.pipe(upstream);
  }

  /** 构造扩展代理请求头；输入原始头和目标 Host，返回移除跳点头及主应用来源信息的副本。 */
  private createProxyHeaders(headers: IncomingHttpHeaders, targetHost: string): IncomingHttpHeaders {
    const result = { ...headers };
    delete result.connection;
    delete result["proxy-connection"];
    delete result.cookie;
    delete result.authorization;
    result.host = targetHost;
    result["x-openxnet-extension-gateway"] = "1";
    return result;
  }

  /** 校验 Host 精确匹配当前回环服务；输入 Host 头，返回布尔值，无文件或网络副作用。 */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (!hostHeader || this.originValue === null) return false;
    const expected = new URL(this.originValue).host.toLowerCase();
    const normalized = hostHeader.trim().toLowerCase();
    return normalized === expected || normalized === expected.replace("127.0.0.1", "localhost");
  }

  /** 返回结构化 Gateway 错误；输入响应、状态、代码和消息，无返回，不暴露堆栈。 */
  private writeError(response: ServerResponse, status: number, code: string, message: string): void {
    const body = JSON.stringify({ error: { code, message } });
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }
}
