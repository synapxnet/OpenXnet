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

test("desktop chat transport maps bounded commands to typed preload methods", async () => {
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
    body: JSON.stringify({ tool_name: "search", tool_params: { query: "desktop" } }),
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
    ["tool", { toolName: "search", toolParameters: { query: "desktop" } }],
    ["approval", { approvalId: "approval-1", resolution: "approved", consume: true }],
  ]);
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
