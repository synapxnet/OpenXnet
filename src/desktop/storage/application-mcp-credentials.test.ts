import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationMcpCredentials } from "../contracts/application-mcp-credentials";
import { ApplicationMcpCredentialService } from "./application-mcp-credentials";
import type { ApplicationMcpCredentialStore } from "./safe-storage-mcp-credential-store";

/** In-memory encrypted-boundary substitute used by MCP service tests. */
class TestMcpCredentialStore implements ApplicationMcpCredentialStore {
  public credentials: ApplicationMcpCredentials = {};
  public available = true;

  /** Report secure storage availability for the test service. */
  public isAvailable(): boolean { return this.available; }

  /** Return a detached MCP credential map. */
  public read(): ApplicationMcpCredentials { return structuredClone(this.credentials); }

  /** Replace the detached MCP credential map. */
  public write(credentials: ApplicationMcpCredentials): void {
    this.credentials = structuredClone(credentials);
  }

  /** Clear every in-memory MCP credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationMcpCredentialService saves names and returns only configured metadata", () => {
  const credentials = new TestMcpCredentialStore();
  const service = new ApplicationMcpCredentialService({ credentials });
  try {
    const snapshot = service.save({
      credentials: {
        alpha: {
          env: { API_TOKEN: "stdio-secret" },
          headers: { Authorization: "Bearer transport-secret" },
        },
      },
    });
    assert.deepEqual(snapshot.configured.alpha?.env, ["API_TOKEN"]);
    assert.deepEqual(snapshot.configured.alpha?.headers, ["Authorization"]);
    assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    const runtime = JSON.parse(
      Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"),
    ) as { credentials: ApplicationMcpCredentials };
    assert.equal(runtime.credentials.alpha?.env?.API_TOKEN, "stdio-secret");
    service.save({ clear: [{ serverId: "alpha", all: true }] });
    assert.deepEqual(credentials.read(), {});
  } finally {
    service.close();
  }
});

test("ApplicationMcpCredentialService migrates env, sensitive headers, and duplicate input", () => {
  const credentials = new TestMcpCredentialStore();
  const service = new ApplicationMcpCredentialService({ credentials });
  const input = JSON.stringify({
    mcpServers: {
      alpha: {
        command: "node",
        env: { API_TOKEN: "input-secret", MODE: "production" },
        headers: { Authorization: "Bearer input-header-secret" },
      },
    },
  });
  try {
    const reconciled = service.reconcileLegacySettings({
      mcpServers: {
        alpha: {
          command: "node",
          env: { API_TOKEN: "node-secret", MODE: "production" },
          headers: {
            Authorization: "Bearer node-header-secret",
            "Content-Type": "application/json",
          },
          input,
        },
      },
    }, { requireSecureCapture: true });
    const server = (reconciled.settings.mcpServers as Record<string, Record<string, unknown>>).alpha;
    assert.ok(server !== undefined);
    assert.deepEqual(server.envCredentialsConfigured, ["API_TOKEN", "MODE"]);
    assert.deepEqual(server.headerCredentialsConfigured, ["Authorization"]);
    assert.equal((server.env as Record<string, unknown>).API_TOKEN, "");
    assert.equal((server.headers as Record<string, unknown>).Authorization, "");
    assert.equal((server.headers as Record<string, unknown>)["Content-Type"], "application/json");
    assert.equal(JSON.stringify(reconciled.settings).includes("node-secret"), false);
    assert.equal(String(server.input).includes("input-secret"), false);
    assert.deepEqual(credentials.read(), {
      alpha: {
        env: { API_TOKEN: "node-secret", MODE: "production" },
        headers: { Authorization: "Bearer node-header-secret" },
      },
    });
  } finally {
    service.close();
  }
});

test("ApplicationMcpCredentialService preserves plaintext when encryption is unavailable", () => {
  const credentials = new TestMcpCredentialStore();
  credentials.available = false;
  const service = new ApplicationMcpCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      mcpServers: { alpha: { env: { TOKEN: "only-copy" } } },
    });
    assert.equal(reconciled.persistSanitized, false);
    assert.equal(
      ((reconciled.settings.mcpServers as Record<string, Record<string, unknown>>).alpha
        ?.env as Record<string, unknown>).TOKEN,
      "",
    );
    assert.throws(
      () => service.reconcileLegacySettings(
        { mcpServers: { alpha: { env: { TOKEN: "only-copy" } } } },
        { requireSecureCapture: true },
      ),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationMcpCredentialService prunes removed env names on trusted writes", () => {
  const credentials = new TestMcpCredentialStore();
  credentials.credentials = { alpha: { env: { KEEP: "one", REMOVE: "two" } } };
  const service = new ApplicationMcpCredentialService({ credentials });
  try {
    service.reconcileLegacySettings({
      mcpServers: { alpha: { command: "node", env: { KEEP: "" } } },
    }, { requireSecureCapture: true, pruneMissingScopes: true });
    assert.deepEqual(credentials.read(), { alpha: { env: { KEEP: "one" } } });
  } finally {
    service.close();
  }
});
