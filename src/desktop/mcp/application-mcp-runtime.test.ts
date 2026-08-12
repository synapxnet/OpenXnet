import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationMcpRuntimeService } from "./application-mcp-runtime";

test("MCP Runtime status does not activate a stopped Worker", async () => {
  let activations = 0;
  let requests = 0;
  const service = new ApplicationMcpRuntimeService({
    core: {
      getCapability: () => ({ state: "stopped" }) as never,
      ensureCapability: async () => {
        activations += 1;
        return {} as never;
      },
    },
    supervisor: {
      request: async () => {
        requests += 1;
        return {};
      },
    },
  });
  const result = await service.status({ integration: "home-assistant" });
  assert.equal(result.status, "stopped");
  assert.equal(result.isRunning, false);
  assert.equal(activations, 0);
  assert.equal(requests, 0);
});

test("MCP Runtime start waits for credentials and sends metadata only", async () => {
  const order: string[] = [];
  let workerPayload: Readonly<Record<string, unknown>> | null = null;
  const service = new ApplicationMcpRuntimeService({
    core: {
      getCapability: () => ({ state: "stopped" }) as never,
      ensureCapability: async () => {
        order.push("activate");
        return {} as never;
      },
    },
    supervisor: {
      request: async (_capability, method, payload) => {
        order.push(method);
        workerPayload = payload ?? {};
        return { success: true, is_running: true };
      },
    },
    waitForCredentialRefresh: async () => {
      order.push("credentials");
    },
  });
  const result = await service.start({
    integration: "home-assistant",
    configuration: { url: "https://ha.example.test" },
  });
  assert.equal(result.status, "running");
  assert.deepEqual(order, ["credentials", "activate", "mcp.integration.start"]);
  assert.deepEqual(workerPayload, {
    integration: "home-assistant",
    configuration: { url: "https://ha.example.test" },
  });
  assert.equal(JSON.stringify(workerPayload).includes("api_key"), false);
});

test("MCP Runtime starts external Chrome with an allow-listed package choice only", async () => {
  let workerPayload: Readonly<Record<string, unknown>> | null = null;
  const service = new ApplicationMcpRuntimeService({
    core: {
      getCapability: () => ({ state: "stopped" }) as never,
      ensureCapability: async () => ({}) as never,
    },
    supervisor: {
      request: async (_capability, _method, payload) => {
        workerPayload = payload ?? {};
        return { success: true, is_running: true };
      },
    },
  });
  const result = await service.start({
    integration: "chrome-external",
    configuration: { mcpName: "browser-mcp" },
  });
  assert.equal(result.status, "running");
  assert.deepEqual(workerPayload, {
    integration: "chrome-external",
    configuration: { mcpName: "browser-mcp" },
  });
});

test("MCP Runtime starts SQL with authorization metadata and no credential fields", async () => {
  let workerPayload: Readonly<Record<string, unknown>> | null = null;
  const service = new ApplicationMcpRuntimeService({
    core: {
      getCapability: () => ({ state: "stopped" }) as never,
      ensureCapability: async () => ({}) as never,
    },
    supervisor: {
      request: async (_capability, _method, payload) => {
        workerPayload = payload ?? {};
        return { success: true, is_running: true };
      },
    },
  });
  const result = await service.start({
    integration: "sql",
    configuration: {
      engine: "sqlite",
      databaseId: "00000000-0000-4000-8000-000000000001",
    },
  });
  assert.equal(result.status, "running");
  assert.deepEqual(workerPayload, {
    integration: "sql",
    configuration: {
      engine: "sqlite",
      databaseId: "00000000-0000-4000-8000-000000000001",
    },
  });
  assert.equal(JSON.stringify(workerPayload).includes("password"), false);
  assert.equal(JSON.stringify(workerPayload).includes("dbpath"), false);
});

test("MCP Runtime lists redacted generic tool summaries", async () => {
  let activationCount = 0;
  const service = new ApplicationMcpRuntimeService({
    core: {
      getCapability: () => ({ state: "stopped" }) as never,
      ensureCapability: async () => {
        activationCount += 1;
        return {} as never;
      },
    },
    supervisor: {
      request: async (_capability, method) => {
        assert.equal(method, "mcp.tools.list");
        return {
          integration: "generic:docs",
          tools: [{
            type: "function",
            function: {
              name: "search_docs",
              description: "Search documentation",
              parameters: { type: "object" },
            },
          }],
        };
      },
    },
  });
  const result = await service.listTools({
    integration: "generic:docs",
    configuration: {
      transport: "sse",
      url: "https://mcp.example.test/sse",
    },
  });
  assert.equal(activationCount, 1);
  assert.deepEqual(result.tools, [{
    name: "search_docs",
    description: "Search documentation",
    enabled: true,
  }]);
  assert.equal(JSON.stringify(result).includes("parameters"), false);
});
