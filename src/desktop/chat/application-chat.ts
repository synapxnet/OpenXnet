import { request as createHttpRequest, type ClientRequest, type IncomingMessage } from "node:http";

import {
  APPLICATION_CHAT_RESPONSE_SCHEMA,
  APPLICATION_CHAT_STREAM_EVENT_SCHEMA,
  APPLICATION_CHAT_STREAM_SCHEMA,
  type AbortApplicationChatRequest,
  type ApplicationChatMode,
  type ApplicationChatProviderRequest,
  type ApplicationChatResponse,
  type ApplicationChatStreamAcknowledgement,
  type ApplicationChatStreamEvent,
  type ApplicationChatStreamListener,
  type CompleteApplicationChatRequest,
  type ExecuteApplicationChatToolRequest,
  type ResolveApplicationChatApprovalRequest,
  type StartApplicationChatStreamRequest,
} from "../contracts/application-chat";
import type { ExecutionEngineLease } from "../workers/execution-engine-supervisor";

const MAX_CHAT_BODY_BYTES = 2 * 1024 * 1024;
const MAX_CHAT_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_STREAM_CHUNK_BYTES = 64 * 1024;
const STREAM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const PROVIDER_REQUEST_KEYS = new Set([
  "messages",
  "model",
  "tools",
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
  "enable_tools",
  "disable_tools",
  "conversationId",
  "conversation_id",
]);

/** Dependencies required by the Main-owned typed chat transport. */
export interface ApplicationChatServiceOptions {
  readonly token: string;
  readonly acquireEngine: () => Promise<ExecutionEngineLease>;
}

interface ActiveChatStream {
  readonly streamId: string;
  readonly conversationId: string;
  readonly request: ClientRequest;
  readonly lease: ExecutionEngineLease;
  sequence: number;
  terminal: boolean;
}

/**
 * Proxy typed chat commands to the private Execution Engine without exposing HTTP to Renderer.
 */
export class ApplicationChatService {
  private readonly listeners = new Set<ApplicationChatStreamListener>();
  private readonly streams = new Map<string, ActiveChatStream>();

  /** Create one chat service with a private process credential and engine lease factory. */
  public constructor(private readonly options: ApplicationChatServiceOptions) {
    if (!options.token.trim()) {
      throw new Error("Application Chat requires a non-empty engine token.");
    }
  }

  /** Subscribe to ordered chat stream events. */
  public subscribe(listener: ApplicationChatStreamListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Start one chat or simple-completion stream over a request-scoped engine lease. */
  public async startStream(value: unknown): Promise<ApplicationChatStreamAcknowledgement> {
    const normalized = normalizeStartStreamRequest(value);
    if (this.streams.has(normalized.streamId)) {
      throw new Error("Application chat streamId is already active.");
    }
    const payload = { ...normalized.request, stream: true };
    const body = serializeBoundedJson(payload);
    const lease = await this.options.acquireEngine();
    const path = normalized.mode === "chat" ? "/v1/chat/completions" : "/simple_chat";
    return this.openStream(normalized, path, body, lease);
  }

  /** Execute one non-stream chat or simple completion and return bounded JSON. */
  public async complete(value: unknown): Promise<ApplicationChatResponse> {
    const normalized = normalizeCompleteRequest(value);
    const path = normalized.mode === "chat" ? "/v1/chat/completions" : "/simple_chat";
    return this.requestJson(path, { ...normalized.request, stream: false });
  }

  /** Retrieve the provider and agent model list through the private engine. */
  public async listModels(): Promise<ApplicationChatResponse> {
    return this.requestJson("/v1/models", {});
  }

  /** Cancel one local stream and best-effort abort its provider conversation. */
  public async abort(value: unknown): Promise<ApplicationChatResponse> {
    const normalized = normalizeAbortRequest(value);
    if (normalized.streamId) {
      const active = this.streams.get(normalized.streamId);
      if (active !== undefined) {
        this.finishStream(active, { cancelled: true });
        active.request.destroy();
      }
    }
    if (!normalized.conversationId) {
      return createLocalResponse(200, { cancelled: Boolean(normalized.streamId) });
    }
    return this.requestJson("/v1/chat/abort", {
      conversationId: normalized.conversationId,
    });
  }

  /** Execute one explicitly approved tool inside the credential-retaining engine. */
  public async executeTool(value: unknown): Promise<ApplicationChatResponse> {
    const normalized = normalizeExecuteToolRequest(value);
    return this.requestJson("/execute_tool_manually", {
      tool_name: normalized.toolName,
      tool_params: normalized.toolParameters,
      approval_type: normalized.approvalType ?? "",
      approval_id: normalized.approvalId ?? "",
      trace_id: normalized.traceId ?? "",
    });
  }

  /** Resolve one approval without exposing the broader Kernel HTTP surface. */
  public async resolveApproval(value: unknown): Promise<ApplicationChatResponse> {
    const normalized = normalizeResolveApprovalRequest(value);
    return this.requestJson("/v1/chat/tools/approval", {
      approval_id: normalized.approvalId,
      resolution: normalized.resolution,
      reason: normalized.reason ?? "",
      consume: normalized.consume ?? true,
    });
  }

  /** Terminate every active stream during application shutdown. */
  public close(): void {
    for (const active of [...this.streams.values()]) {
      this.finishStream(active, { cancelled: true });
      active.request.destroy();
    }
    this.listeners.clear();
  }

  /** Open one authenticated upstream stream and resolve after response headers arrive. */
  private openStream(
    normalized: StartApplicationChatStreamRequest,
    path: string,
    body: Buffer,
    lease: ExecutionEngineLease,
  ): Promise<ApplicationChatStreamAcknowledgement> {
    let target: URL;
    try {
      target = new URL(path, lease.origin);
    } catch (error) {
      lease.release();
      throw error;
    }
    return new Promise<ApplicationChatStreamAcknowledgement>((resolve, reject) => {
      let acknowledged = false;
      let upstream: ClientRequest;
      try {
        upstream = createHttpRequest(target, {
          method: "POST",
          headers: this.createHeaders(target, body.length),
        });
      } catch (error) {
        lease.release();
        reject(error);
        return;
      }
      const active: ActiveChatStream = {
        streamId: normalized.streamId,
        conversationId: readConversationId(normalized.request),
        request: upstream,
        lease,
        sequence: 0,
        terminal: false,
      };
      this.streams.set(active.streamId, active);
      upstream.once("response", (response) => {
        acknowledged = true;
        resolve({
          schema: APPLICATION_CHAT_STREAM_SCHEMA,
          streamId: active.streamId,
          statusCode: response.statusCode ?? 502,
          contentType: String(response.headers["content-type"] ?? "application/octet-stream"),
        });
        this.forwardStreamResponse(active, response);
      });
      upstream.once("error", () => {
        if (!acknowledged) {
          this.releaseStream(active);
          reject(new Error("Application chat engine request failed."));
          return;
        }
        this.failStream(active, "CHAT_ENGINE_STREAM_FAILED", "Chat stream was interrupted.");
      });
      upstream.end(body);
    });
  }

  /** Forward response bytes as ordered bounded base64 events. */
  private forwardStreamResponse(active: ActiveChatStream, response: IncomingMessage): void {
    response.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      for (let offset = 0; offset < buffer.length; offset += MAX_STREAM_CHUNK_BYTES) {
        const bounded = buffer.subarray(offset, offset + MAX_STREAM_CHUNK_BYTES);
        this.emit(active, { type: "chunk", dataBase64: bounded.toString("base64") });
      }
    });
    response.once("end", () => this.finishStream(active));
    response.once("error", () => {
      this.failStream(active, "CHAT_ENGINE_RESPONSE_FAILED", "Chat response stream failed.");
    });
    response.once("aborted", () => {
      this.failStream(active, "CHAT_ENGINE_RESPONSE_ABORTED", "Chat response stream was aborted.");
    });
  }

  /** Emit one terminal error and release its active stream. */
  private failStream(active: ActiveChatStream, code: string, message: string): void {
    if (active.terminal) {
      return;
    }
    this.emit(active, { type: "error", code, message });
    this.releaseStream(active);
  }

  /** Emit one completion event and release the stream exactly once. */
  private finishStream(active: ActiveChatStream, options: { cancelled?: boolean } = {}): void {
    if (active.terminal) {
      return;
    }
    this.emit(active, { type: "complete", cancelled: options.cancelled ?? false });
    this.releaseStream(active);
  }

  /** Release one stream map entry and its request-scoped engine lease. */
  private releaseStream(active: ActiveChatStream): void {
    if (active.terminal) {
      return;
    }
    active.terminal = true;
    if (this.streams.get(active.streamId) === active) {
      this.streams.delete(active.streamId);
    }
    active.lease.release();
  }

  /** Publish one ordered stream event without exposing provider credentials. */
  private emit(
    active: ActiveChatStream,
    event: Omit<ApplicationChatStreamEvent, "schema" | "streamId" | "sequence">,
  ): void {
    if (active.terminal) {
      return;
    }
    active.sequence += 1;
    const payload: ApplicationChatStreamEvent = {
      schema: APPLICATION_CHAT_STREAM_EVENT_SCHEMA,
      streamId: active.streamId,
      sequence: active.sequence,
      ...event,
    };
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch {
        // Renderer observers own their failures; stream cleanup must continue.
      }
    }
  }

  /** Execute one bounded authenticated JSON request over a temporary engine lease. */
  private async requestJson(path: string, payload: unknown): Promise<ApplicationChatResponse> {
    const body = serializeBoundedJson(payload);
    const lease = await this.options.acquireEngine();
    const target = new URL(path, lease.origin);
    try {
      return await new Promise<ApplicationChatResponse>((resolve, reject) => {
        let settled = false;
        /** Resolve the command once and ignore late response events. */
        function resolveOnce(response: ApplicationChatResponse): void {
          if (settled) return;
          settled = true;
          resolve(response);
        }

        /** Reject the command once and ignore late request errors. */
        function rejectOnce(error: Error): void {
          if (settled) return;
          settled = true;
          reject(error);
        }

        const upstream = createHttpRequest(target, {
          method: "POST",
          headers: this.createHeaders(target, body.length),
        }, (response) => {
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          response.on("data", (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.length;
            if (totalBytes > MAX_CHAT_RESPONSE_BYTES) {
              const error = new Error("Application chat response exceeded its 2 MiB budget.");
              rejectOnce(error);
              response.destroy(error);
              upstream.destroy(error);
              return;
            }
            chunks.push(buffer);
          });
          response.once("end", () => {
            const contentType = String(response.headers["content-type"] ?? "application/json");
            const text = Buffer.concat(chunks).toString("utf8");
            resolveOnce({
              schema: APPLICATION_CHAT_RESPONSE_SCHEMA,
              statusCode: response.statusCode ?? 502,
              contentType,
              body: parseResponseBody(text, contentType),
            });
          });
        });
        upstream.once("error", () => rejectOnce(new Error("Application chat engine command failed.")));
        upstream.end(body);
      });
    } finally {
      lease.release();
    }
  }

  /** Build exact secret-retaining HTTP headers for one private engine request. */
  private createHeaders(target: URL, contentLength: number): Readonly<Record<string, string>> {
    return {
      Accept: "*/*",
      Authorization: `Bearer ${this.options.token}`,
      "Cache-Control": "no-store",
      "Content-Length": String(contentLength),
      "Content-Type": "application/json; charset=utf-8",
      Host: target.host,
    };
  }
}

/** Normalize one streaming request and reject unknown top-level fields. */
function normalizeStartStreamRequest(value: unknown): StartApplicationChatStreamRequest {
  const record = requireExactRecord(value, ["streamId", "mode", "request"], "chat stream request");
  const streamId = requireIdentifier(record.streamId, "streamId", STREAM_ID_PATTERN);
  const mode = normalizeMode(record.mode);
  return { streamId, mode, request: normalizeProviderRequest(record.request) };
}

/** Normalize one non-stream completion request. */
function normalizeCompleteRequest(value: unknown): CompleteApplicationChatRequest {
  const record = requireExactRecord(value, ["mode", "request"], "chat completion request");
  return { mode: normalizeMode(record.mode), request: normalizeProviderRequest(record.request) };
}

/** Normalize one local and provider cancellation request. */
function normalizeAbortRequest(value: unknown): AbortApplicationChatRequest {
  const record = requireExactRecord(value, ["streamId", "conversationId"], "chat abort request", true);
  const streamId = record.streamId === undefined
    ? undefined
    : requireIdentifier(record.streamId, "streamId", STREAM_ID_PATTERN);
  const conversationId = record.conversationId === undefined
    ? undefined
    : requireIdentifier(record.conversationId, "conversationId", IDENTIFIER_PATTERN);
  if (streamId === undefined && conversationId === undefined) {
    throw new TypeError("Application chat abort requires streamId or conversationId.");
  }
  return {
    ...(streamId === undefined ? {} : { streamId }),
    ...(conversationId === undefined ? {} : { conversationId }),
  };
}

/** Normalize one manual tool execution request. */
function normalizeExecuteToolRequest(value: unknown): ExecuteApplicationChatToolRequest {
  const record = requireExactRecord(
    value,
    ["toolName", "toolParameters", "approvalType", "approvalId", "traceId"],
    "chat tool request",
    true,
  );
  const toolName = requireIdentifier(record.toolName, "toolName", IDENTIFIER_PATTERN);
  const toolParameters = requirePlainRecord(record.toolParameters, "toolParameters");
  return {
    toolName,
    toolParameters,
    ...readOptionalBoundedStrings(record, ["approvalType", "approvalId", "traceId"]),
  };
}

/** Normalize one exact approval resolution request. */
function normalizeResolveApprovalRequest(value: unknown): ResolveApplicationChatApprovalRequest {
  const record = requireExactRecord(
    value,
    ["approvalId", "resolution", "reason", "consume"],
    "chat approval request",
    true,
  );
  const approvalId = requireIdentifier(record.approvalId, "approvalId", IDENTIFIER_PATTERN);
  if (record.resolution !== "approved" && record.resolution !== "denied") {
    throw new TypeError("Application chat approval resolution is invalid.");
  }
  const reason = record.reason === undefined ? undefined : requireBoundedString(record.reason, "reason", 512);
  if (record.consume !== undefined && typeof record.consume !== "boolean") {
    throw new TypeError("Application chat approval consume must be boolean.");
  }
  return {
    approvalId,
    resolution: record.resolution,
    ...(reason === undefined ? {} : { reason }),
    ...(record.consume === undefined ? {} : { consume: record.consume }),
  };
}

/** Normalize the allow-listed provider request fields and enforce its JSON budget. */
function normalizeProviderRequest(value: unknown): ApplicationChatProviderRequest {
  const record = requirePlainRecord(value, "request");
  for (const key of Object.keys(record)) {
    if (!PROVIDER_REQUEST_KEYS.has(key)) {
      throw new TypeError(`Application chat provider field '${key}' is not allowed.`);
    }
  }
  if (!Array.isArray(record.messages) || record.messages.length < 1 || record.messages.length > 256) {
    throw new TypeError("Application chat messages must contain between 1 and 256 entries.");
  }
  const messages = record.messages.map((message, index) => requirePlainRecord(message, `messages[${index}]`));
  const normalized = { ...record, messages } as ApplicationChatProviderRequest;
  serializeBoundedJson(normalized);
  return normalized;
}

/** Normalize the exact chat engine mode. */
function normalizeMode(value: unknown): ApplicationChatMode {
  if (value !== "chat" && value !== "simple") {
    throw new TypeError("Application chat mode is invalid.");
  }
  return value;
}

/** Require a plain object and reject arrays or custom prototypes. */
function requirePlainRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Application chat ${field} must be an object.`);
  }
  return { ...(value as Readonly<Record<string, unknown>>) };
}

/** Require an object whose keys are all explicitly recognized. */
function requireExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  field: string,
  optionalKeys = false,
): Record<string, unknown> {
  const record = requirePlainRecord(value, field);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      throw new TypeError(`Application ${field} field '${key}' is not allowed.`);
    }
  }
  if (!optionalKeys) {
    for (const key of allowedKeys) {
      if (!(key in record)) {
        throw new TypeError(`Application ${field} requires '${key}'.`);
      }
    }
  }
  return record;
}

/** Require one bounded identifier matching its contract-specific pattern. */
function requireIdentifier(value: unknown, field: string, pattern: RegExp): string {
  const normalized = requireBoundedString(value, field, 128);
  if (!pattern.test(normalized)) {
    throw new TypeError(`Application chat ${field} is invalid.`);
  }
  return normalized;
}

/** Require one non-empty bounded UTF-8 string. */
function requireBoundedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`Application chat ${field} must be text.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new TypeError(`Application chat ${field} is outside its length budget.`);
  }
  return normalized;
}

/** Read optional bounded string fields while preserving their contract names. */
function readOptionalBoundedStrings(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    if (record[field] !== undefined) {
      result[field] = requireBoundedString(record[field], field, 512);
    }
  }
  return result;
}

/** Serialize one JSON payload after enforcing the private HTTP body budget. */
function serializeBoundedJson(value: unknown): Buffer {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Application chat payload is not JSON serializable.");
  }
  const body = Buffer.from(serialized, "utf8");
  if (body.length > MAX_CHAT_BODY_BYTES) {
    throw new TypeError("Application chat payload exceeds the 2 MiB budget.");
  }
  return body;
}

/** Parse JSON responses while preserving bounded text errors from compatibility handlers. */
function parseResponseBody(text: string, contentType: string): unknown {
  if (!text) {
    return null;
  }
  if (contentType.toLowerCase().includes("json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { error: { message: "Chat Engine returned invalid JSON." } };
    }
  }
  return text;
}

/** Build one local typed response without activating the engine. */
function createLocalResponse(statusCode: number, body: unknown): ApplicationChatResponse {
  return {
    schema: APPLICATION_CHAT_RESPONSE_SCHEMA,
    statusCode,
    contentType: "application/json; charset=utf-8",
    body,
  };
}

/** Resolve one bounded conversation ID from either supported compatibility field. */
function readConversationId(request: ApplicationChatProviderRequest): string {
  return String(request.conversation_id ?? request.conversationId ?? "").trim().slice(0, 128);
}
