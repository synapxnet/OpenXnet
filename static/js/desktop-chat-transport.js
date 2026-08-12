"use strict";

/** Install the Desktop typed Chat transport while preserving browser HTTP fallback. */
(function installDesktopChatTransport(global) {
  const nativeFetch = global.fetch.bind(global);
  const activeStreamsByConversation = new Map();
  const CHAT_PATHS = new Set([
    "/v1/chat/completions",
    "/simple_chat",
    "/v1/chat/abort",
    "/v1/models",
    "/execute_tool_manually",
    "/v1/kernel/approvals/resolve",
    "/v1/chat/tools/approval",
  ]);

  /** Return whether the isolated preload exposes the complete typed Chat API. */
  function hasDesktopChatApi() {
    const api = global.openxnetDesktop;
    return Boolean(
      api
      && typeof api.startApplicationChatStream === "function"
      && typeof api.completeApplicationChat === "function"
      && typeof api.listApplicationChatModels === "function"
      && typeof api.abortApplicationChat === "function"
      && typeof api.executeApplicationChatTool === "function"
      && typeof api.resolveApplicationChatApproval === "function"
      && typeof api.onApplicationChatStreamEvent === "function"
    );
  }

  /** Resolve one fetch input to an exact application path. */
  function resolveRequestPath(input) {
    const value = typeof Request !== "undefined" && input instanceof Request ? input.url : String(input);
    return new URL(value, global.location.href).pathname;
  }

  /** Resolve one fetch method from init or a Request object. */
  function resolveRequestMethod(input, init) {
    const requestMethod = typeof Request !== "undefined" && input instanceof Request ? input.method : "GET";
    return String(init?.method || requestMethod || "GET").toUpperCase();
  }

  /** Parse one JSON fetch body without accepting alternate encodings. */
  async function readJsonBody(input, init) {
    let source = init?.body;
    if (source === undefined && typeof Request !== "undefined" && input instanceof Request) {
      source = await input.clone().text();
    }
    if (source === undefined || source === null || source === "") return {};
    if (typeof source !== "string") {
      throw new TypeError("Desktop Chat requests require a JSON text body.");
    }
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Desktop Chat request body must be an object.");
    }
    return parsed;
  }

  /** Create a standards-compatible abort error for stream readers. */
  function createAbortError() {
    if (typeof DOMException === "function") {
      return new DOMException("The Desktop Chat request was aborted.", "AbortError");
    }
    const error = new Error("The Desktop Chat request was aborted.");
    error.name = "AbortError";
    return error;
  }

  /** Generate one contract-safe Renderer-owned stream identifier. */
  function createStreamId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return `chat-${global.crypto.randomUUID()}`;
    }
    return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }

  /** Decode one bounded Base64 IPC chunk without UTF-8 boundary loss. */
  function decodeBase64Chunk(value) {
    const binary = global.atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  /** Convert one typed command result into a native Response object. */
  function createCommandResponse(result) {
    const contentType = String(result?.contentType || "application/json; charset=utf-8");
    const body = typeof result?.body === "string"
      ? result.body
      : JSON.stringify(result?.body ?? null);
    const status = Number(result?.statusCode || 502);
    return new Response(body, {
      status: status >= 200 && status <= 599 ? status : 502,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  }

  /** Remove transport state associated with one terminal stream. */
  function clearStreamState(conversationId, streamId, unsubscribe, signal, handleAbort) {
    unsubscribe();
    if (signal) signal.removeEventListener("abort", handleAbort);
    if (conversationId && activeStreamsByConversation.get(conversationId) === streamId) {
      activeStreamsByConversation.delete(conversationId);
    }
  }

  /** Start one typed stream and expose its ordered IPC bytes as a ReadableStream Response. */
  async function startDesktopStream(mode, request, signal) {
    const api = global.openxnetDesktop;
    const streamId = createStreamId();
    const conversationId = String(request.conversation_id || request.conversationId || "").trim();
    let controller;
    let expectedSequence = 1;
    let terminal = false;
    const body = new ReadableStream({
      /** Capture the stream controller before any IPC event can arrive. */
      start(nextController) {
        controller = nextController;
      },
    });

    let unsubscribe = () => undefined;

    /** Finish local stream state exactly once. */
    function finish(action) {
      if (terminal) return;
      terminal = true;
      clearStreamState(conversationId, streamId, unsubscribe, signal, handleAbort);
      action();
    }

    /** Consume one ordered event belonging to this Renderer-owned stream. */
    function handleStreamEvent(event) {
      if (!event || event.streamId !== streamId || terminal) return;
      if (event.sequence !== expectedSequence) {
        finish(() => controller.error(new Error("Desktop Chat stream event sequence is invalid.")));
        return;
      }
      expectedSequence += 1;
      if (event.type === "chunk") {
        controller.enqueue(decodeBase64Chunk(event.dataBase64));
      } else if (event.type === "complete") {
        finish(() => controller.close());
      } else if (event.type === "error") {
        finish(() => controller.error(new Error(String(event.message || "Desktop Chat stream failed."))));
      }
    }

    /** Propagate a browser AbortSignal across the typed cancellation boundary. */
    function handleAbort() {
      if (terminal) return;
      void api.abortApplicationChat({
        streamId,
        ...(conversationId ? { conversationId } : {}),
      }).catch(() => undefined);
      finish(() => controller.error(createAbortError()));
    }

    unsubscribe = api.onApplicationChatStreamEvent(handleStreamEvent);
    if (conversationId) activeStreamsByConversation.set(conversationId, streamId);
    if (signal) signal.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) handleAbort();

    try {
      const acknowledgement = await api.startApplicationChatStream({ streamId, mode, request });
      if (signal?.aborted) throw createAbortError();
      return new Response(body, {
        status: acknowledgement.statusCode,
        headers: {
          "Content-Type": acknowledgement.contentType,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      finish(() => controller.error(error));
      throw error;
    }
  }

  /** Route one recognized request through typed IPC and retain HTTP for other profiles. */
  async function openxnetChatFetch(input, init = undefined) {
    let path;
    try {
      path = resolveRequestPath(input);
    } catch {
      return nativeFetch(input, init);
    }
    if (!CHAT_PATHS.has(path) || !hasDesktopChatApi()) {
      return nativeFetch(input, init);
    }

    const method = resolveRequestMethod(input, init);
    const api = global.openxnetDesktop;
    if (path === "/v1/models") {
      if (method !== "GET" && method !== "POST") return nativeFetch(input, init);
      return createCommandResponse(await api.listApplicationChatModels());
    }
    if (method !== "POST") return nativeFetch(input, init);

    const payload = await readJsonBody(input, init);
    if (path === "/v1/chat/completions" || path === "/simple_chat") {
      const { stream = false, ...request } = payload;
      const mode = path === "/v1/chat/completions" ? "chat" : "simple";
      return stream
        ? startDesktopStream(mode, request, init?.signal)
        : createCommandResponse(await api.completeApplicationChat({ mode, request }));
    }
    if (path === "/v1/chat/abort") {
      const conversationId = String(payload.conversationId || "").trim();
      const streamId = activeStreamsByConversation.get(conversationId);
      return createCommandResponse(await api.abortApplicationChat({
        ...(streamId ? { streamId } : {}),
        ...(conversationId ? { conversationId } : {}),
      }));
    }
    if (path === "/execute_tool_manually") {
      return createCommandResponse(await api.executeApplicationChatTool({
        toolName: payload.tool_name,
        toolParameters: payload.tool_params || {},
        ...(payload.approval_type ? { approvalType: payload.approval_type } : {}),
        ...(payload.approval_id ? { approvalId: payload.approval_id } : {}),
        ...(payload.trace_id ? { traceId: payload.trace_id } : {}),
      }));
    }
    return createCommandResponse(await api.resolveApplicationChatApproval({
      approvalId: payload.approval_id,
      resolution: payload.resolution,
      ...(payload.reason ? { reason: payload.reason } : {}),
      ...(typeof payload.consume === "boolean" ? { consume: payload.consume } : {}),
    }));
  }

  global.openxnetChatFetch = openxnetChatFetch;
})(window);
