"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const transportSourcePath = path.resolve(__dirname, "../static/js/desktop-chat-transport.js");
const transportSource = fs.readFileSync(transportSourcePath, "utf8");

/** Create one browser-like transport harness with a configurable Desktop API. */
function createTransportHarness(desktopApi) {
  const fallbackCalls = [];
  const window = {
    location: { href: "http://127.0.0.1:3456/" },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    atob,
    openxnetDesktop: desktopApi,
    fetch: async (...args) => {
      fallbackCalls.push(args);
      return new Response("fallback", { status: 200 });
    },
  };
  const context = vm.createContext({
    window,
    URL,
    Request,
    Response,
    ReadableStream,
    Uint8Array,
    DOMException,
    Error,
    TypeError,
    JSON,
    Map,
    Set,
    Math,
    Date,
  });
  vm.runInContext(transportSource, context, { filename: transportSourcePath });
  return { fallbackCalls, window };
}

/** Create a complete typed Desktop Chat API with per-test overrides. */
function createDesktopApi(overrides = {}) {
  return {
    startApplicationChatStream: async () => ({
      streamId: "chat-00000000-0000-4000-8000-000000000001",
      statusCode: 200,
      contentType: "text/event-stream; charset=utf-8",
    }),
    completeApplicationChat: async () => ({ statusCode: 200, contentType: "application/json", body: {} }),
    listApplicationChatModels: async () => ({ statusCode: 200, contentType: "application/json", body: {} }),
    abortApplicationChat: async () => ({ statusCode: 200, contentType: "application/json", body: {} }),
    executeApplicationChatTool: async () => ({ statusCode: 200, contentType: "application/json", body: {} }),
    resolveApplicationChatApproval: async () => ({ statusCode: 200, contentType: "application/json", body: {} }),
    onApplicationChatStreamEvent: () => () => undefined,
    ...overrides,
  };
}

/** 提供可控桌面终止事件并记录清理与取消边界。 / Provide controlled desktop terminal events and record cleanup and abort boundaries. */
async function openControlledStream(signal) {
  const state = { streamId: null, listener: null, unsubscribeCount: 0, abortCalls: [] };
  const api = createDesktopApi({
    /** 捕获真实订阅入口供延迟事件验收。 / Capture the real subscription callback for late-event verification. */
    onApplicationChatStreamEvent(listener) {
      state.listener = listener;
      return /** 记录每次订阅清理。 / Record each subscription cleanup. */ () => { state.unsubscribeCount += 1; };
    },
    /** 确认已接收的流身份且不伪造任何重试。 / Acknowledge the accepted stream identity without fabricating retries. */
    async startApplicationChatStream(request) {
      state.streamId = request.streamId;
      return { statusCode: 200, contentType: "text/event-stream; charset=utf-8" };
    },
    /** 记录显式取消请求。 / Record explicit cancellation requests. */
    async abortApplicationChat(request) {
      state.abortCalls.push(JSON.parse(JSON.stringify(request)));
      return { statusCode: 200, contentType: "application/json", body: {} };
    },
  });
  const harness = createTransportHarness(api);
  const response = await harness.window.openxnetChatFetch("/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ stream: true, conversationId: "connection-test" }),
    signal,
  });
  return {
    state, harness, response,
    /** 经原始订阅回调发送真实有序事件。 / Deliver an ordered event through the original subscription callback. */
    emit(event) { state.listener({ streamId: state.streamId, sequence: 1, ...event }); },
  };
}

test("typed stream failures retain real classification fields and release stream ownership", /** 保留故障信息且不让已终止流继续占用会话。 / Preserve failure evidence without retaining terminal stream ownership. */ async () => {
  const stream = await openControlledStream();
  const reading = stream.response.body.getReader().read();
  stream.emit({ type: "error", code: "CHAT_ENGINE_STREAM_FAILED", message: "Chat stream was interrupted.", cancelled: false, status: 503 });
  await assert.rejects(reading, /** 验证宿主可取得原始类型化字段。 / Verify the host receives original typed classification fields. */ (error) => {
    assert.equal(error.name, "Error");
    assert.equal(error.code, "CHAT_ENGINE_STREAM_FAILED");
    assert.equal(error.message, "Chat stream was interrupted.");
    assert.equal(error.cancelled, false);
    assert.equal(error.status, 503);
    return true;
  });
  assert.equal(stream.state.unsubscribeCount, 1);
  stream.emit({ sequence: 2, type: "complete" });
  assert.equal(stream.state.unsubscribeCount, 1);
  await stream.harness.window.openxnetChatFetch("/v1/chat/abort", {
    method: "POST", body: JSON.stringify({ conversationId: "connection-test" }),
  });
  assert.deepEqual(stream.state.abortCalls, [{ conversationId: "connection-test" }]);
});

test("stream metadata never fabricates HTTP status or cancellation from untyped values", /** 错误元数据不得将字符串或缺省值猜测为状态。 / Error metadata must not infer status from strings or absent fields. */ async () => {
  const invalidStatuses = [undefined, null, "503", 0, 99, 600, 503.5, NaN, Infinity, {}, true];
  for (const status of invalidStatuses) {
    const stream = await openControlledStream();
    const reading = stream.response.body.getReader().read();
    stream.emit({ type: "error", code: 503, cancelled: "true", status, statusCode: 503, message: "HTTP 503", retryAttempt: 3 });
    await assert.rejects(reading, /** 无真实字段时不编造状态、取消和重试次数。 / Do not invent status, cancellation or retry counts when valid fields are absent. */ (error) => {
      assert.equal(error.name, "Error");
      for (const key of ["status", "statusCode", "code", "cancelled", "retryAttempt"]) assert.equal(Object.hasOwn(error, key), false);
      return true;
    });
    assert.equal(stream.state.unsubscribeCount, 1);
  }
});

test("remote cancellation remains AbortError for both complete and error terminals", /** 服务端明确取消不可被当成成功或网络失败。 / Explicit remote cancellation must not become success or a network failure. */ async () => {
  for (const type of ["complete", "error"]) {
    const stream = await openControlledStream();
    const reading = stream.response.body.getReader().read();
    stream.emit({ type, cancelled: true, code: "CHAT_USER_CANCELLED" });
    await assert.rejects(reading, /** 保留取消语义及其原始代码。 / Retain cancellation semantics and the original code. */ (error) => {
      assert.equal(error.name, "AbortError");
      assert.equal(error.cancelled, true);
      assert.equal(error.code, "CHAT_USER_CANCELLED");
      assert.equal(Object.hasOwn(error, "status"), false);
      return true;
    });
    assert.equal(stream.state.unsubscribeCount, 1);
    assert.deepEqual(stream.state.abortCalls, []);
    stream.emit({ sequence: 2, type: "error", code: "CHAT_ENGINE_RESPONSE_FAILED" });
    assert.equal(stream.state.unsubscribeCount, 1);
  }
});

test("user Stop aborts once and ignores a later transport failure", /** 用户停止优先于迟到的断流错误且清理监听。 / User Stop takes precedence over a late stream failure and clears its listener. */ async () => {
  const controller = new AbortController();
  const stream = await openControlledStream(controller.signal);
  const reading = stream.response.body.getReader().read();
  controller.abort();
  await assert.rejects(reading, /** 验证停止不会变成网络错误。 / Verify Stop does not become a network error. */ (error) => error.name === "AbortError" && error.cancelled === true);
  assert.deepEqual(stream.state.abortCalls, [{ streamId: stream.state.streamId, conversationId: "connection-test" }]);
  stream.emit({ type: "error", code: "CHAT_ENGINE_RESPONSE_FAILED", message: "Late disconnect" });
  controller.abort();
  assert.equal(stream.state.abortCalls.length, 1);
  assert.equal(stream.state.unsubscribeCount, 1);
});

test("a previously stopped request never starts a desktop stream", /** 已取消的请求不得在停止后创建新的执行。 / A cancelled request must not create new execution after Stop. */ async () => {
  const controller = new AbortController();
  const calls = [];
  const api = createDesktopApi({
    /** 记录任何不应发生的启动。 / Record any unexpected start. */
    async startApplicationChatStream() { calls.push("start"); throw new Error("Unexpected start"); },
    /** 记录任何不应发生的订阅。 / Record any unexpected subscription. */
    onApplicationChatStreamEvent() { calls.push("subscribe"); return /** 提供空清理函数。 / Provide a no-op cleanup. */ () => undefined; },
  });
  const harness = createTransportHarness(api);
  controller.abort();
  await assert.rejects(harness.window.openxnetChatFetch("/v1/chat/completions", {
    method: "POST", body: JSON.stringify({ stream: true }), signal: controller.signal,
  }), /** 确认请求以主动取消结束。 / Confirm explicit cancellation ends the request. */ (error) => error.name === "AbortError" && error.cancelled === true);
  assert.deepEqual(calls, []);
});

test("acknowledgement rejection cannot overwrite an earlier Stop or typed stream error", /** 启动失败回执不得覆盖先收到的主动取消或类型化失败。 / Startup rejection must not overwrite a prior explicit cancellation or typed failure. */ async () => {
  for (const scenario of ["local-stop", "remote-stop", "typed-error"]) {
    let listener;
    let rejectStart;
    let markStarted;
    let streamId;
    let unsubscribeCount = 0;
    const started = new Promise(/** 观察启动调用确实开始。 / Observe that the start call has actually begun. */ (resolve) => { markStarted = resolve; });
    const controller = new AbortController();
    const api = createDesktopApi({
      /** 保留订阅回调并记录清理。 / Retain the event callback and record cleanup. */
      onApplicationChatStreamEvent(next) {
        listener = next;
        return /** 记录终止清理次数。 / Record terminal cleanup count. */ () => { unsubscribeCount += 1; };
      },
      /** 模拟服务端已收请求但响应头尚未返回。 / Simulate an accepted request before response headers arrive. */
      startApplicationChatStream(request) {
        streamId = request.streamId;
        markStarted();
        return new Promise(/** 保留之后返回的启动失败。 / Retain a later startup rejection. */ (_resolve, reject) => { rejectStart = reject; });
      },
    });
    const harness = createTransportHarness(api);
    const fetching = harness.window.openxnetChatFetch("/v1/chat/completions", {
      method: "POST", body: JSON.stringify({ stream: true }), signal: controller.signal,
    });
    await started;
    if (scenario === "local-stop") controller.abort();
    else listener({ streamId, sequence: 1, type: scenario === "remote-stop" ? "complete" : "error", cancelled: scenario === "remote-stop", code: "ORIGINAL_TERMINAL_CODE" });
    rejectStart(new Error("Application chat engine request failed."));
    await assert.rejects(fetching, /** 校验首个终止原因没有被通用错误替代。 / Verify the first terminal reason was not replaced by a generic error. */ (error) => {
      if (scenario === "typed-error") {
        assert.equal(error.name, "Error");
        assert.equal(error.cancelled, false);
      } else {
        assert.equal(error.name, "AbortError");
        assert.equal(error.cancelled, true);
      }
      if (scenario !== "local-stop") assert.equal(error.code, "ORIGINAL_TERMINAL_CODE");
      assert.notEqual(error.message, "Application chat engine request failed.");
      return true;
    });
    assert.equal(unsubscribeCount, 1);
  }
});

test("normal completion closes the reader and removes its AbortSignal handler", /** 正常完成保持成功且结束后的停止不再触发IPC。 / Normal completion remains successful and later Stop does not invoke IPC. */ async () => {
  const controller = new AbortController();
  const stream = await openControlledStream(controller.signal);
  const reading = stream.response.body.getReader().read();
  stream.emit({ type: "complete", cancelled: false });
  assert.deepEqual(await reading, { value: undefined, done: true });
  controller.abort();
  assert.equal(stream.state.unsubscribeCount, 1);
  assert.deepEqual(stream.state.abortCalls, []);
});

test("sequence corruption is rejected before accepting terminal metadata", /** 顺序损坏不能借取消字段绕过有序传输验证。 / Corrupt sequences cannot bypass ordering validation using cancellation metadata. */ async () => {
  const stream = await openControlledStream();
  const reading = stream.response.body.getReader().read();
  stream.emit({ sequence: 2, type: "complete", cancelled: true });
  await assert.rejects(reading, /stream event sequence is invalid/);
  assert.equal(stream.state.unsubscribeCount, 1);
});

test("desktop chat transport reconstructs ordered UTF-8 stream bytes", async () => {
  let listener = null;
  let startedRequest = null;
  const expected = Buffer.from("data: 你好\n\n", "utf8");
  const api = createDesktopApi({
    onApplicationChatStreamEvent: (nextListener) => {
      listener = nextListener;
      return () => { listener = null; };
    },
    startApplicationChatStream: async (request) => {
      startedRequest = request;
      listener({ streamId: request.streamId, sequence: 1, type: "chunk", dataBase64: expected.toString("base64") });
      listener({ streamId: request.streamId, sequence: 2, type: "complete" });
      return { statusCode: 200, contentType: "text/event-stream; charset=utf-8" };
    },
  });
  const harness = createTransportHarness(api);
  const response = await harness.window.openxnetChatFetch("/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "hello" }],
      stream: true,
      conversationId: "conversation-1",
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  assert.equal(startedRequest.mode, "chat");
  assert.equal(startedRequest.request.stream, undefined);
  assert.equal(listener, null);
  assert.deepEqual(harness.fallbackCalls, []);
});

test("desktop chat transport maps bounded commands to typed preload methods", /** 保留手动工具的原会话身份。 / Retain the originating conversation identity for manual tools. */ async () => {
  const calls = [];
  const api = createDesktopApi({
    listApplicationChatModels: async () => {
      calls.push(["models"]);
      return { statusCode: 200, contentType: "application/json", body: { data: [{ id: "model-1" }] } };
    },
    executeApplicationChatTool: async (request) => {
      calls.push(["tool", request]);
      return { statusCode: 200, contentType: "application/json", body: { result: "ok" } };
    },
    resolveApplicationChatApproval: async (request) => {
      calls.push(["approval", request]);
      return { statusCode: 200, contentType: "application/json", body: { ok: true } };
    },
  });
  const harness = createTransportHarness(api);
  const models = await harness.window.openxnetChatFetch("/v1/models");
  const tool = await harness.window.openxnetChatFetch("/execute_tool_manually", {
    method: "POST",
    body: JSON.stringify({ tool_name: "search", tool_params: { query: "desktop" }, conversationId: "origin-conversation" }),
  });
  const approval = await harness.window.openxnetChatFetch("/v1/kernel/approvals/resolve", {
    method: "POST",
    body: JSON.stringify({ approval_id: "approval-1", resolution: "approved", consume: true }),
  });

  assert.deepEqual(await models.json(), { data: [{ id: "model-1" }] });
  assert.deepEqual(await tool.json(), { result: "ok" });
  assert.deepEqual(await approval.json(), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["models"],
    ["tool", { toolName: "search", toolParameters: { query: "desktop" }, conversationId: "origin-conversation" }],
    ["approval", { approvalId: "approval-1", resolution: "approved", consume: true }],
  ]);
});

test("desktop recovery GET uses typed IPC with the exact query identity", /** 恢复查询只经过类型化IPC，不退回兼容HTTP。 / Recovery queries use typed IPC without compatibility HTTP fallback. */ async () => {
  const calls = [];
  const api = createDesktopApi({
    /** 仅返回模拟的原执行状态。 / Return only simulated original execution status. */
    getApplicationChatRecoveryStatus: async (request) => { calls.push(request); return { statusCode: 200, body: { conversationId: request.conversationId, state: "running", abortRequested: true } }; },
  });
  const harness = createTransportHarness(api);
  const response = await harness.window.openxnetChatFetch(new Request("http://127.0.0.1:3456/v1/chat/recovery-status?conversation_id=" + encodeURIComponent("会话&scope=other")));
  assert.deepEqual(await response.json(), { conversationId: "会话&scope=other", state: "running", abortRequested: true });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ conversationId: "会话&scope=other" }]);
  assert.deepEqual(harness.fallbackCalls, []);
  for (const url of ["/v1/chat/recovery-status", "/v1/chat/recovery-status?conversation_id=one&conversation_id=two", "/v1/chat/recovery-status?conversation_id=one&url=http://untrusted"]) await assert.rejects(harness.window.openxnetChatFetch(url));
  await assert.rejects(harness.window.openxnetChatFetch("/v1/chat/recovery-status?conversation_id=one", { method: "POST" }));
  assert.equal(calls.length, 1); assert.deepEqual(harness.fallbackCalls, []);
});

test("missing Desktop recovery support fails explicitly while browser profiles retain their fetch", /** 原生缺失不能冒充空闲，浏览器仍使用自身认证接口。 / Missing native support cannot imply idle; browser profiles retain their authenticated interface. */ async () => {
  const desktop = createTransportHarness(createDesktopApi());
  await assert.rejects(desktop.window.openxnetChatFetch("/v1/chat/recovery-status?conversation_id=one"), /unavailable/);
  assert.deepEqual(desktop.fallbackCalls, []);
  const browser = createTransportHarness(undefined);
  assert.equal(await (await browser.window.openxnetChatFetch("/v1/chat/recovery-status?conversation_id=one")).text(), "fallback");
  assert.equal(browser.fallbackCalls.length, 1);
});

test("browser profile retains native fetch fallback", async () => {
  const harness = createTransportHarness(undefined);
  const response = await harness.window.openxnetChatFetch("/simple_chat", { method: "POST" });
  assert.equal(await response.text(), "fallback");
  assert.equal(harness.fallbackCalls.length, 1);
});

test("desktop chat source no longer calls compatibility HTTP directly", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const indexHtml = fs.readFileSync(path.resolve(__dirname, "../static/index.html"), "utf8");
  assert.doesNotMatch(rendererMethods, /window\.openxnetChatFetch\((?:`|')\/v1\/kernel/);
  assert.match(rendererMethods, /invokeApplicationKernel\(\{ operation, payload \}\)/);
  assert.doesNotMatch(rendererMethods, /await fetch\(apiUrl/);
  assert.doesNotMatch(rendererMethods, /await fetch\((?:`|')[^\n]*(?:simple_chat|v1\/chat\/completions|v1\/models|execute_tool_manually)/);
  assert.match(indexHtml, /desktop-chat-transport\.js[^]*vue_methods\.js/);
});
