import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";

/** Connector Voice Broker 唯一允许的私有请求路径。 */
export const CONNECTOR_VOICE_BROKER_PATH = "/v1/connectors/voice";

/** Connector Worker 与 Main 之间使用的语音请求协议版本。 */
export const CONNECTOR_VOICE_REQUEST_SCHEMA = "openxnet.connector-voice-request.v1" as const;

/** Main 返回给 Connector Worker 的语音结果协议版本。 */
export const CONNECTOR_VOICE_RESULT_SCHEMA = "openxnet.connector-voice-result.v1" as const;

/** Broker 支持的输入和输出音频格式。 */
const CONNECTOR_VOICE_FORMATS = new Set([
  "auto",
  "wav",
  "mp3",
  "flac",
  "ogg",
  "m4a",
  "opus",
  "aac",
  "pcm",
]);

/** 转写上游接收的已验证音频引用。 */
export interface ConnectorVoiceTranscriptionInput {
  readonly artifactPath: string;
  readonly filename: string;
  readonly format: string;
}

/** 合成上游接收的非敏感语音参数。 */
export interface ConnectorVoiceSynthesisInput {
  readonly text: string;
  readonly voice: string;
  readonly index: number;
  readonly mobileOptimized: boolean;
  readonly format: string;
}

/** 合成上游返回给 Broker 的有界音频数据。 */
export interface ConnectorVoiceSynthesisOutput {
  readonly audio: Buffer;
  readonly mediaType: string;
}

/** Connector Voice Broker 的处理器、鉴权信息和资源预算。 */
export interface ConnectorVoiceBrokerGatewayOptions {
  readonly token: string;
  readonly exchangeRoot: string;
  readonly transcribe: (
    input: ConnectorVoiceTranscriptionInput,
    signal: AbortSignal,
  ) => Promise<string>;
  readonly synthesize: (
    input: ConnectorVoiceSynthesisInput,
    signal: AbortSignal,
  ) => Promise<ConnectorVoiceSynthesisOutput>;
  readonly host?: string;
  readonly maxBodyBytes?: number;
  readonly maxInputAudioBytes?: number;
  readonly maxOutputAudioBytes?: number;
}

/** Broker 内部使用的稳定请求校验错误。 */
class ConnectorVoiceRequestError extends Error {
  /** 创建一个不会包含调用方原始数据的校验错误。 */
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConnectorVoiceRequestError";
  }
}

type ConnectorVoiceRequest =
  | {
    readonly schema: typeof CONNECTOR_VOICE_REQUEST_SCHEMA;
    readonly operation: "transcribe";
    readonly artifactName: string;
    readonly filename: string;
    readonly format: string;
  }
  | {
    readonly schema: typeof CONNECTOR_VOICE_REQUEST_SCHEMA;
    readonly operation: "synthesize";
    readonly text: string;
    readonly voice: string;
    readonly index: number;
    readonly mobileOptimized: boolean;
    readonly format: string;
  };

/** 鉴权并执行 Connector Worker 的临时语音文件请求。 */
export class ConnectorVoiceBrokerGateway {
  private readonly host: string;
  private readonly exchangeRoot: string;
  private readonly maxBodyBytes: number;
  private readonly maxInputAudioBytes: number;
  private readonly maxOutputAudioBytes: number;
  private readonly activeRequests = new Set<AbortController>();
  private server: Server | null = null;
  private originValue: string | null = null;

  /** 创建尚未绑定端口的 Connector Voice Broker。 */
  public constructor(private readonly options: ConnectorVoiceBrokerGatewayOptions) {
    if (!options.token.trim()) {
      throw new Error("Connector Voice Broker requires a non-empty token.");
    }
    this.host = options.host ?? "127.0.0.1";
    this.exchangeRoot = path.resolve(options.exchangeRoot);
    this.maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;
    this.maxInputAudioBytes = options.maxInputAudioBytes ?? 25 * 1024 * 1024;
    this.maxOutputAudioBytes = options.maxOutputAudioBytes ?? 25 * 1024 * 1024;
  }

  /** 返回 Broker 启动后绑定的精确回环地址。 */
  public get origin(): string {
    if (this.originValue === null) {
      throw new Error("Connector Voice Broker has not started.");
    }
    return this.originValue;
  }

  /** 创建交换目录并绑定临时回环端口，不启动任何 Python 进程。 */
  public async start(): Promise<string> {
    if (this.server !== null) {
      return this.origin;
    }
    mkdirSync(this.exchangeRoot, { recursive: true, mode: 0o700 });
    this.cleanupStaleOutputArtifacts();
    const server = createServer(this.handleRequest.bind(this));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, this.host, resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      await this.stop();
      throw new Error("Connector Voice Broker did not receive a TCP address.");
    }
    this.originValue = `http://${this.host}:${address.port}`;
    return this.originValue;
  }

  /** 停止接收请求并取消仍在执行的语音上游调用。 */
  public async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.originValue = null;
    for (const controller of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
    if (server === null) {
      return;
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** 在调用语音上游前完成 Host、路径、方法、鉴权和请求体校验。 */
  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.isAllowedHost(request.headers.host)) {
      request.resume();
      this.writeError(response, 403, "INVALID_HOST", "Connector Voice host is not allowed.");
      return;
    }
    const requestUrl = new URL(request.url ?? "/", this.origin);
    if (requestUrl.pathname !== CONNECTOR_VOICE_BROKER_PATH || requestUrl.search) {
      request.resume();
      this.writeError(response, 404, "NOT_FOUND", "Connector Voice route was not found.");
      return;
    }
    if (request.method !== "POST") {
      request.resume();
      this.writeError(response, 405, "METHOD_NOT_ALLOWED", "Connector Voice accepts POST only.");
      return;
    }
    if (!this.isAuthorized(request.headers.authorization)) {
      request.resume();
      this.writeError(response, 401, "UNAUTHORIZED", "Connector Voice authentication failed.");
      return;
    }

    const controller = new AbortController();
    this.activeRequests.add(controller);
    request.once("aborted", () => controller.abort());
    response.once("close", () => {
      if (!response.writableEnded) {
        controller.abort();
      }
    });
    try {
      const payload = await this.readAndParseRequest(request);
      if (payload.operation === "transcribe") {
        const artifactPath = this.resolveInputArtifact(payload.artifactName);
        const text = await this.options.transcribe({
          artifactPath,
          filename: payload.filename,
          format: payload.format,
        }, controller.signal);
        this.writeJson(response, 200, {
          schema: CONNECTOR_VOICE_RESULT_SCHEMA,
          operation: "transcribe",
          success: true,
          text: this.validateTranscription(text),
          errorCode: null,
          retryable: false,
        });
        return;
      }
      const output = await this.options.synthesize({
        text: payload.text,
        voice: payload.voice,
        index: payload.index,
        mobileOptimized: payload.mobileOptimized,
        format: payload.format,
      }, controller.signal);
      const artifact = this.writeOutputArtifact(output);
      this.writeJson(response, 200, {
        schema: CONNECTOR_VOICE_RESULT_SCHEMA,
        operation: "synthesize",
        success: true,
        ...artifact,
        errorCode: null,
        retryable: false,
      });
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }
      if (error instanceof ConnectorVoiceRequestError) {
        this.writeError(response, error.statusCode, error.code, error.message);
        return;
      }
      this.writeError(
        response,
        503,
        "CONNECTOR_VOICE_UNAVAILABLE",
        "Connector Voice service is unavailable.",
      );
    } finally {
      this.activeRequests.delete(controller);
    }
  }

  /** 读取有界 UTF-8 JSON，并解析为两个精确语音操作之一。 */
  private async readAndParseRequest(request: IncomingMessage): Promise<ConnectorVoiceRequest> {
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.maxBodyBytes) {
      throw new ConnectorVoiceRequestError(413, "REQUEST_TOO_LARGE", "Connector Voice request is too large.");
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > this.maxBodyBytes) {
        throw new ConnectorVoiceRequestError(413, "REQUEST_TOO_LARGE", "Connector Voice request is too large.");
      }
      chunks.push(buffer);
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new ConnectorVoiceRequestError(400, "INVALID_REQUEST", "Connector Voice request is invalid.");
    }
    return this.parseRequest(value);
  }

  /** 校验协议版本、字段集合和每个操作的值域。 */
  private parseRequest(value: unknown): ConnectorVoiceRequest {
    if (!this.isRecord(value) || value.schema !== CONNECTOR_VOICE_REQUEST_SCHEMA) {
      throw new ConnectorVoiceRequestError(400, "INVALID_REQUEST", "Connector Voice request is invalid.");
    }
    if (value.operation === "transcribe") {
      const expected = ["schema", "operation", "artifactName", "filename", "format"];
      if (!this.hasExactFields(value, expected)) {
        throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
      }
      return {
        schema: CONNECTOR_VOICE_REQUEST_SCHEMA,
        operation: "transcribe",
        artifactName: this.parseText(value.artifactName, 128, /^[A-Za-z0-9][A-Za-z0-9._-]*$/),
        filename: this.parseText(value.filename, 255, /^[^\\/\u0000-\u001F\u007F]+$/),
        format: this.parseFormat(value.format, true),
      };
    }
    if (value.operation === "synthesize") {
      const expected = [
        "schema",
        "operation",
        "text",
        "voice",
        "index",
        "mobileOptimized",
        "format",
      ];
      if (!this.hasExactFields(value, expected)) {
        throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
      }
      const index = Number(value.index);
      if (!Number.isInteger(index) || index < 0 || index > 10_000 || typeof value.mobileOptimized !== "boolean") {
        throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
      }
      return {
        schema: CONNECTOR_VOICE_REQUEST_SCHEMA,
        operation: "synthesize",
        text: this.parseText(value.text, 20_000),
        voice: this.parseText(value.voice, 128, /^[A-Za-z0-9._:-]+$/),
        index,
        mobileOptimized: value.mobileOptimized,
        format: this.parseFormat(value.format, false),
      };
    }
    throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
  }

  /** 将调用方文件名解析为交换目录中的普通输入文件。 */
  private resolveInputArtifact(artifactName: string): string {
    const candidate = path.resolve(this.exchangeRoot, artifactName);
    if (path.dirname(candidate) !== this.exchangeRoot) {
      throw new ConnectorVoiceRequestError(422, "INVALID_ARTIFACT", "Connector Voice artifact is invalid.");
    }
    let metadata;
    try {
      metadata = lstatSync(candidate);
    } catch {
      throw new ConnectorVoiceRequestError(422, "INVALID_ARTIFACT", "Connector Voice artifact is invalid.");
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new ConnectorVoiceRequestError(422, "INVALID_ARTIFACT", "Connector Voice artifact is invalid.");
    }
    const realRoot = realpathSync(this.exchangeRoot);
    const realCandidate = realpathSync(candidate);
    if (path.dirname(realCandidate) !== realRoot) {
      throw new ConnectorVoiceRequestError(422, "INVALID_ARTIFACT", "Connector Voice artifact is invalid.");
    }
    const size = statSync(realCandidate).size;
    if (size < 1 || size > this.maxInputAudioBytes) {
      throw new ConnectorVoiceRequestError(413, "AUDIO_TOO_LARGE", "Connector Voice audio is outside its size budget.");
    }
    return realCandidate;
  }

  /** 将有界合成结果写入只供 Connector Worker 读取的临时文件。 */
  private writeOutputArtifact(output: ConnectorVoiceSynthesisOutput): {
    artifactName: string;
    mediaType: string;
    byteLength: number;
  } {
    if (!Buffer.isBuffer(output.audio) || output.audio.length < 1 || output.audio.length > this.maxOutputAudioBytes) {
      throw new ConnectorVoiceRequestError(502, "INVALID_VOICE_RESPONSE", "Connector Voice response is invalid.");
    }
    const mediaType = this.normalizeMediaType(output.mediaType);
    const extension = this.extensionForMediaType(mediaType);
    const artifactName = `connector-output-${randomUUID()}.${extension}`;
    const artifactPath = path.join(this.exchangeRoot, artifactName);
    writeFileSync(artifactPath, output.audio, { flag: "wx", mode: 0o600 });
    return { artifactName, mediaType, byteLength: output.audio.length };
  }

  /** 限制转写文本类型和长度，避免上游异常对象进入协议。 */
  private validateTranscription(value: string): string {
    if (typeof value !== "string" || value.length > 100_000 || value.includes("\u0000")) {
      throw new ConnectorVoiceRequestError(502, "INVALID_VOICE_RESPONSE", "Connector Voice response is invalid.");
    }
    return value.trim();
  }

  /** 解析一个有界文本字段并拒绝控制字符或不匹配的值。 */
  private parseText(value: unknown, maximumLength: number, pattern?: RegExp): string {
    if (typeof value !== "string") {
      throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
    }
    const normalized = value.trim();
    if (
      normalized.length < 1
      || normalized.length > maximumLength
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)
      || (pattern !== undefined && !pattern.test(normalized))
    ) {
      throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
    }
    return normalized;
  }

  /** 校验音频格式，并按操作决定是否允许自动检测。 */
  private parseFormat(value: unknown, allowAuto: boolean): string {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!CONNECTOR_VOICE_FORMATS.has(normalized) || (!allowAuto && normalized === "auto")) {
      throw new ConnectorVoiceRequestError(422, "INVALID_REQUEST", "Connector Voice request is invalid.");
    }
    return normalized;
  }

  /** 将上游媒体类型收敛到 Connector 支持的音频集合。 */
  private normalizeMediaType(value: string): string {
    const normalized = String(value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
    const allowed = new Set(["audio/mpeg", "audio/ogg", "audio/wav", "audio/aac", "audio/flac"]);
    if (!allowed.has(normalized)) {
      throw new ConnectorVoiceRequestError(502, "INVALID_VOICE_RESPONSE", "Connector Voice response is invalid.");
    }
    return normalized;
  }

  /** 根据已验证媒体类型生成临时文件扩展名。 */
  private extensionForMediaType(mediaType: string): string {
    return {
      "audio/mpeg": "mp3",
      "audio/ogg": "opus",
      "audio/wav": "wav",
      "audio/aac": "aac",
      "audio/flac": "flac",
    }[mediaType] ?? "audio";
  }

  /** 删除超过一天且由 Broker 创建的遗留输出文件。 */
  private cleanupStaleOutputArtifacts(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1_000;
    for (const entry of readdirSync(this.exchangeRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith("connector-output-")) {
        continue;
      }
      const candidate = path.join(this.exchangeRoot, entry.name);
      try {
        if (statSync(candidate).mtimeMs < cutoff) {
          rmSync(candidate, { force: true });
        }
      } catch {
        // 临时文件清理失败不应阻断桌面启动。
      }
    }
  }

  /** 判断未知值是否为可检查的普通对象。 */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /** 判断对象是否只包含给定的完整字段集合。 */
  private hasExactFields(value: Record<string, unknown>, expected: readonly string[]): boolean {
    const fields = Object.keys(value).sort();
    return fields.length === expected.length
      && fields.every((field, index) => field === [...expected].sort()[index]);
  }

  /** 使用恒定时间比较验证 Connector Worker 的 Bearer 凭据。 */
  private isAuthorized(authorization: string | undefined): boolean {
    const prefix = "Bearer ";
    if (authorization === undefined || !authorization.startsWith(prefix)) {
      return false;
    }
    const expected = Buffer.from(this.options.token, "utf8");
    const received = Buffer.from(authorization.slice(prefix.length), "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /** 将 Host 限制为 Broker 实际绑定的回环端点。 */
  private isAllowedHost(hostHeader: string | undefined): boolean {
    if (hostHeader === undefined || this.originValue === null) {
      return false;
    }
    const expectedHost = new URL(this.originValue).host.toLowerCase();
    const normalizedHost = hostHeader.trim().toLowerCase();
    return normalizedHost === expectedHost
      || normalizedHost === expectedHost.replace("127.0.0.1", "localhost");
  }

  /** 返回一个有界且禁止缓存的 JSON 响应。 */
  private writeJson(response: ServerResponse, statusCode: number, payload: object): void {
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  }

  /** 返回不包含上游异常文本的固定 Broker 错误。 */
  private writeError(
    response: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    this.writeJson(response, statusCode, {
      schema: CONNECTOR_VOICE_RESULT_SCHEMA,
      success: false,
      errorCode: code,
      message,
      retryable: statusCode >= 500,
    });
  }
}
