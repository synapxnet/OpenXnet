/** IPC channels owned by the typed Desktop chat transport. */
export const APPLICATION_CHAT_CHANNELS = {
  startStream: "openxnet:application-chat:start-stream",
  complete: "openxnet:application-chat:complete",
  listModels: "openxnet:application-chat:list-models",
  abort: "openxnet:application-chat:abort",
  executeTool: "openxnet:application-chat:execute-tool",
  resolveApproval: "openxnet:application-chat:resolve-approval",
  streamEvent: "openxnet:application-chat:stream-event",
} as const;

/** Stable schema for one started Desktop chat stream. */
export const APPLICATION_CHAT_STREAM_SCHEMA = "openxnet.application-chat-stream.v1" as const;

/** Stable schema for ordered Main-to-Renderer chat stream events. */
export const APPLICATION_CHAT_STREAM_EVENT_SCHEMA = "openxnet.application-chat-stream-event.v1" as const;

/** Stable schema for bounded non-stream chat responses. */
export const APPLICATION_CHAT_RESPONSE_SCHEMA = "openxnet.application-chat-response.v1" as const;

/** Engine operation selected by one typed chat request. */
export type ApplicationChatMode = "chat" | "simple";

/** Bounded provider request whose implementation-specific fields stay behind Main. */
export interface ApplicationChatProviderRequest {
  readonly messages: readonly Readonly<Record<string, unknown>>[];
  readonly model?: string;
  readonly tools?: unknown;
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
  readonly fileLinks?: readonly string[];
  readonly enable_thinking?: boolean;
  readonly enable_deep_research?: boolean;
  readonly enable_web_search?: boolean;
  readonly asyncToolsID?: readonly string[];
  readonly reasoning_effort?: string;
  readonly is_app_bot?: boolean;
  readonly is_sub_agent?: boolean;
  readonly enable_tools?: readonly string[];
  readonly disable_tools?: readonly string[];
  readonly conversationId?: string;
  readonly conversation_id?: string;
}

/** Request used to begin one typed streaming chat operation. */
export interface StartApplicationChatStreamRequest {
  readonly streamId: string;
  readonly mode: ApplicationChatMode;
  readonly request: ApplicationChatProviderRequest;
}

/** Acknowledgement returned after the private engine accepts a stream. */
export interface ApplicationChatStreamAcknowledgement {
  readonly schema: typeof APPLICATION_CHAT_STREAM_SCHEMA;
  readonly streamId: string;
  readonly statusCode: number;
  readonly contentType: string;
}

/** Ordered stream event emitted without exposing Electron or engine internals. */
export interface ApplicationChatStreamEvent {
  readonly schema: typeof APPLICATION_CHAT_STREAM_EVENT_SCHEMA;
  readonly streamId: string;
  readonly sequence: number;
  readonly type: "chunk" | "complete" | "error";
  readonly dataBase64?: string;
  readonly code?: string;
  readonly message?: string;
  readonly cancelled?: boolean;
}

/** Listener used by Renderer clients to consume one or more filtered streams. */
export type ApplicationChatStreamListener = (event: ApplicationChatStreamEvent) => void;

/** Request used for one bounded non-stream provider completion. */
export interface CompleteApplicationChatRequest {
  readonly mode: ApplicationChatMode;
  readonly request: ApplicationChatProviderRequest;
}

/** Generic bounded JSON result returned by a typed chat command. */
export interface ApplicationChatResponse {
  readonly schema: typeof APPLICATION_CHAT_RESPONSE_SCHEMA;
  readonly statusCode: number;
  readonly contentType: string;
  readonly body: unknown;
}

/** Request used to cancel one local stream and its provider conversation. */
export interface AbortApplicationChatRequest {
  readonly streamId?: string;
  readonly conversationId?: string;
}

/** Exact manual tool execution request accepted from Renderer. */
export interface ExecuteApplicationChatToolRequest {
  readonly toolName: string;
  readonly toolParameters: Readonly<Record<string, unknown>>;
  readonly approvalType?: string;
  readonly approvalId?: string;
  readonly traceId?: string;
}

/** Exact approval-only resolution request accepted from Renderer. */
export interface ResolveApplicationChatApprovalRequest {
  readonly approvalId: string;
  readonly resolution: "approved" | "denied";
  readonly reason?: string;
  readonly consume?: boolean;
}
