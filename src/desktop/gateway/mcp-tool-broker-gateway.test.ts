import assert from "node:assert/strict";
import test from "node:test";

import { McpToolBrokerGateway } from "./mcp-tool-broker-gateway";

/** 发送一次 Broker JSON 请求；输入 origin、token、路径和载荷，返回 HTTP 响应。 */
function requestBroker(origin: string, token: string, path: string, payload: unknown): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

test("MCP Tool Broker validates before activation and forwards exact list requests", async () => {
  let activations = 0;
  const workerRequests: Array<{ method: string; payload: Readonly<Record<string, unknown>> }> = [];
  const gateway = new McpToolBrokerGateway({
    token: "mcp-tool-broker-test-token",
    core: {
      ensureCapability: async () => {
        activations += 1;
        return {} as never;
      },
    },
    supervisor: {
      request: async (_capability, method, payload) => {
        workerRequests.push({ method, payload: payload ?? {} });
        return { integration: "home-assistant", tools: [] };
      },
    },
  });
  const origin = await gateway.start();
  try {
    const unauthorized = await requestBroker(origin, "wrong-token", "/v1/mcp/tools/list", {});
    assert.equal(unauthorized.status, 401);
    assert.equal(activations, 0);

    const invalid = await requestBroker(origin, "mcp-tool-broker-test-token", "/v1/mcp/tools/list", {
      integration: "home-assistant",
      configuration: { url: "https://ha.example.test", token: "secret" },
    });
    assert.equal(invalid.status, 422);
    assert.equal(activations, 0);

    const response = await requestBroker(origin, "mcp-tool-broker-test-token", "/v1/mcp/tools/list", {
      integration: "home-assistant",
      configuration: { url: "https://ha.example.test" },
    });
    assert.equal(response.status, 200);
    const chromeResponse = await requestBroker(origin, "mcp-tool-broker-test-token", "/v1/mcp/tools/list", {
      integration: "chrome-external",
      configuration: { mcpName: "playwright-mcp" },
    });
    assert.equal(chromeResponse.status, 200);
    assert.equal(activations, 2);
    assert.deepEqual(workerRequests, [
      {
        method: "mcp.tools.list",
        payload: {
          integration: "home-assistant",
          configuration: { url: "https://ha.example.test" },
        },
      },
      {
        method: "mcp.tools.list",
        payload: {
          integration: "chrome-external",
          configuration: { mcpName: "playwright-mcp" },
        },
      },
    ]);
  } finally {
    await gateway.stop();
  }
});

test("MCP Tool Broker rejects malformed calls before Worker access", async () => {
  let activations = 0;
  const gateway = new McpToolBrokerGateway({
    token: "mcp-tool-broker-test-token",
    core: {
      ensureCapability: async () => {
        activations += 1;
        return {} as never;
      },
    },
    supervisor: { request: async () => ({}) },
  });
  const origin = await gateway.start();
  try {
    const response = await requestBroker(origin, "mcp-tool-broker-test-token", "/v1/mcp/tools/call", {
      integration: "home-assistant",
      configuration: { url: "https://ha.example.test" },
      toolName: "turn_on",
      arguments: {},
      credential: "secret",
    });
    assert.equal(response.status, 422);
    assert.equal(activations, 0);
  } finally {
    await gateway.stop();
  }
});

test("MCP Tool Broker forwards dynamic generic integrations without credentials", async () => {
  let activations = 0;
  const workerRequests: Array<{ method: string; payload: Readonly<Record<string, unknown>> }> = [];
  const gateway = new McpToolBrokerGateway({
    token: "mcp-tool-broker-test-token",
    core: {
      ensureCapability: async () => {
        activations += 1;
        return {} as never;
      },
    },
    supervisor: {
      request: async (_capability, method, payload) => {
        workerRequests.push({ method, payload: payload ?? {} });
        return method === "mcp.tools.list"
          ? { integration: "generic:docs", tools: [] }
          : { integration: "generic:docs", toolName: "search_docs", result: { ok: true } };
      },
    },
  });
  const origin = await gateway.start();
  const configuration = {
    transport: "streamable-http",
    url: "https://mcp.example.test/mcp",
    headers: { Accept: "application/json" },
  };
  try {
    const listResponse = await requestBroker(
      origin,
      "mcp-tool-broker-test-token",
      "/v1/mcp/tools/list",
      { integration: "generic:docs", configuration },
    );
    assert.equal(listResponse.status, 200);
    const callResponse = await requestBroker(
      origin,
      "mcp-tool-broker-test-token",
      "/v1/mcp/tools/call",
      {
        integration: "generic:docs",
        configuration,
        toolName: "search_docs",
        arguments: { query: "runtime" },
      },
    );
    assert.equal(callResponse.status, 200);
    assert.equal(activations, 2);
    assert.deepEqual(workerRequests, [
      {
        method: "mcp.tools.list",
        payload: { integration: "generic:docs", configuration },
      },
      {
        method: "mcp.tools.call",
        payload: {
          integration: "generic:docs",
          configuration,
          toolName: "search_docs",
          arguments: { query: "runtime" },
        },
      },
    ]);

    const secretResponse = await requestBroker(
      origin,
      "mcp-tool-broker-test-token",
      "/v1/mcp/tools/list",
      {
        integration: "generic:docs",
        configuration: {
          ...configuration,
          headers: { Authorization: "Bearer renderer-secret" },
        },
      },
    );
    assert.equal(secretResponse.status, 422);
    assert.equal(activations, 2);
  } finally {
    await gateway.stop();
  }
});
