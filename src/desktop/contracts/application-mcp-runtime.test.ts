import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationMcpRuntimeIntegrationRequest,
  parseApplicationMcpRuntimeStartRequest,
} from "./application-mcp-runtime";

test("MCP Runtime contract accepts exact Home Assistant metadata", () => {
  assert.deepEqual(parseApplicationMcpRuntimeIntegrationRequest({ integration: "home-assistant" }), {
    integration: "home-assistant",
  });
  assert.deepEqual(parseApplicationMcpRuntimeStartRequest({
    integration: "home-assistant",
    configuration: { url: " https://ha.example.test " },
  }), {
    integration: "home-assistant",
    configuration: { url: "https://ha.example.test" },
  });
});

test("MCP Runtime contract accepts exact external Chrome metadata", () => {
  assert.deepEqual(parseApplicationMcpRuntimeIntegrationRequest({ integration: "chrome-external" }), {
    integration: "chrome-external",
  });
  assert.deepEqual(parseApplicationMcpRuntimeStartRequest({
    integration: "chrome-external",
    configuration: { mcpName: "playwright-mcp" },
  }), {
    integration: "chrome-external",
    configuration: { mcpName: "playwright-mcp" },
  });
});

test("MCP Runtime contract accepts SQL metadata without passwords or SQLite paths", () => {
  assert.deepEqual(parseApplicationMcpRuntimeIntegrationRequest({ integration: "sql" }), {
    integration: "sql",
  });
  assert.deepEqual(parseApplicationMcpRuntimeStartRequest({
    integration: "sql",
    configuration: {
      engine: "sqlite",
      databaseId: "00000000-0000-4000-8000-000000000001",
    },
  }), {
    integration: "sql",
    configuration: {
      engine: "sqlite",
      databaseId: "00000000-0000-4000-8000-000000000001",
    },
  });
  assert.deepEqual(parseApplicationMcpRuntimeStartRequest({
    integration: "sql",
    configuration: {
      engine: "postgres",
      user: "openxnet",
      host: "127.0.0.1",
      port: 5432,
      dbname: "workspace",
    },
  }), {
    integration: "sql",
    configuration: {
      engine: "postgres",
      user: "openxnet",
      host: "127.0.0.1",
      port: 5432,
      dbname: "workspace",
    },
  });
});

test("MCP Runtime contract accepts exact generic remote metadata", () => {
  assert.deepEqual(parseApplicationMcpRuntimeIntegrationRequest({ integration: "generic:docs" }), {
    integration: "generic:docs",
  });
  assert.deepEqual(parseApplicationMcpRuntimeStartRequest({
    integration: "generic:docs",
    configuration: {
      transport: "streamable-http",
      url: " https://mcp.example.test/v1/mcp ",
      headers: { Accept: "application/json" },
    },
  }), {
    integration: "generic:docs",
    configuration: {
      transport: "streamable-http",
      url: "https://mcp.example.test/v1/mcp",
      headers: { Accept: "application/json" },
    },
  });
  assert.deepEqual(parseApplicationMcpRuntimeStartRequest({
    integration: "generic:local-events",
    configuration: { transport: "sse", url: "http://127.0.0.1:9000/sse" },
  }), {
    integration: "generic:local-events",
    configuration: { transport: "sse", url: "http://127.0.0.1:9000/sse" },
  });
});

test("MCP Runtime contract rejects credentials, unknown integrations, and extra fields", () => {
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "home-assistant",
    configuration: { url: "https://ha.example.test", api_key: "secret" },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "generic:stdio-server",
    configuration: { command: "node", args: ["server.js"] },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "generic:remote-http",
    configuration: { transport: "sse", url: "http://mcp.example.test/sse" },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "generic:secret-header",
    configuration: {
      transport: "sse",
      url: "https://mcp.example.test/sse",
      headers: { Authorization: "Bearer renderer-secret" },
    },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "generic:query-secret",
    configuration: { transport: "sse", url: "https://mcp.example.test/sse?token=secret" },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "sql",
    configuration: { engine: "sqlite", dbpath: "C:\\secret.db" },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "sql",
    configuration: {
      engine: "postgres",
      user: "openxnet",
      password: "renderer-secret",
      host: "127.0.0.1",
      port: 5432,
      dbname: "workspace",
    },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "home-assistant",
    configuration: { url: "https://ha.example.test" },
    secret: "not-allowed",
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "chrome-external",
    configuration: { mcpName: "custom-package" },
  }), /invalid/i);
  assert.throws(() => parseApplicationMcpRuntimeStartRequest({
    integration: "chrome-external",
    configuration: { mcpName: "browser-mcp", command: "malicious" },
  }), /invalid/i);
});
