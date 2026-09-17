"use strict";

/** Install the Desktop typed Chat transport while preserving browser HTTP fallback. */
(function installDesktopChatTransport(global) {
  const nativeFetch = global.fetch.bind(global);
  const activeStreamsByConversation = new Map();
  const CHAT_PATHS = new Set([
    "/v1/chat/completions",
    "/simple_chat",
    "/v1/chat/abort",
    "/v1/chat/recovery-status",
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

  /** 创建标准取消错误并明确标记用户停止。 / Create a standard abort error with explicit user-cancellation semantics. */
  function createAbortError() {
    const error = typeof DOMException === "function"
      ? new DOMException("The Desktop Chat request was aborted.", "AbortError")
      : new Error("The Desktop Chat request was aborted.");
    if (error.name !== "AbortError") error.name = "AbortError";
    error.cancelled = true;
    return error;
  }

  /** 保留真实终止字段供宿主分类，禁止推断状态或重试。 / Preserve actual terminal fields for host classification without inferring status or retries. */
  function createStreamError(event) {
    const cancelled = event.cancelled === true;
    const error = new Error(String(event.message || (cancelled
      ? "The Desktop Chat request was aborted."
      : "Desktop Chat stream failed.")));
    if (cancelled) error.name = "AbortError";
    if (typeof event.code === "string" && event.code.trim()) error.code = event.code;
    if (typeof event.cancelled === "boolean") error.cancelled = event.cancelled;
    if (Number.isInteger(event.status) && event.status >= 100 && event.status <= 599) {
      error.status = event.status;
    }
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

  /** 启动有序IPC流并在确认前后保留相同的终止原因。 / Start an ordered IPC stream and retain its terminal reason across acknowledgement. */
  async function startDesktopStream(mode, request, signal) {
    if (signal?.aborted) throw createAbortError();
    const api = global.openxnetDesktop;
    const streamId = createStreamId();
    const conversationId = String(request.conversation_id || request.conversationId || "").trim();
    let controller;
    let expectedSequence = 1;
    let terminal = false;
    let terminalFailure = null;
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

    /** 保留首个终止错误，避免启动确认失败覆盖用户停止。 / Retain the first terminal error so acknowledgement failure cannot overwrite user Stop. */
    function fail(error) {
      finish(/** 同步保存错误并终止流读取。 / Save the error and terminate stream reads together. */ () => {
        terminalFailure = error;
        controller.error(error);
      });
    }

    /** 消费本流有序事件并保留失败与主动取消的区别。 / Consume ordered events for this stream while distinguishing failure from explicit cancellation. */
    function handleStreamEvent(event) {
      if (!event || event.streamId !== streamId || terminal) return;
      if (event.sequence !== expectedSequence) {
        fail(new Error("Desktop Chat stream event sequence is invalid."));
        return;
      }
      expectedSequence += 1;
      if (event.type === "chunk") {
        controller.enqueue(decodeBase64Chunk(event.dataBase64));
      } else if (event.type === "complete") {
        if (event.cancelled === true) fail(createStreamError(event));
        else finish(/** 正常完成时关闭读取。 / Close reads after normal completion. */ () => controller.close());
      } else if (event.type === "error") {
        fail(createStreamError(event));
      }
    }

    /** 经类型化取消边界传递用户停止，并保留首个终止原因。 / Propagate user Stop across the typed cancellation boundary and retain the first terminal reason. */
    function handleAbort() {
      if (terminal) return;
      void api.abortApplicationChat({
        streamId,
        ...(conversationId ? { conversationId } : {}),
      }).catch(() => undefined);
      fail(createAbortError());
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
      const failure = terminalFailure || (signal?.aborted ? createAbortError() : error);
      fail(failure);
      throw failure;
    }
  }

  /** 将固定聊天请求和只读恢复查询映射到类型化IPC。 / Map fixed chat requests and read-only recovery queries to typed IPC. */
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
    if (path === "/v1/chat/recovery-status") {
      if (method !== "GET") throw new TypeError("Desktop recovery status requires GET.");
      if (typeof api.getApplicationChatRecoveryStatus !== "function") throw new TypeError("Desktop recovery status is unavailable.");
      const requestUrl = new URL(typeof Request !== "undefined" && input instanceof Request ? input.url : String(input), global.location.href);
      if ([...requestUrl.searchParams.keys()].some(/** 拒绝未知查询参数。 / Reject query fields outside the contract. */ key => key !== "conversation_id") || requestUrl.searchParams.getAll("conversation_id").length !== 1) throw new TypeError("Desktop recovery status requires one conversation_id.");
      return createCommandResponse(await api.getApplicationChatRecoveryStatus({ conversationId: requestUrl.searchParams.get("conversation_id") }));
    }
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
        ...(payload.conversationId !== undefined ? { conversationId: payload.conversationId } : {}),
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
