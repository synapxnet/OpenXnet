import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationHttpToolCredentials } from "../contracts/application-http-tool-credentials";
import { ApplicationHttpToolCredentialService } from "./application-http-tool-credentials";
import type { ApplicationHttpToolCredentialStore } from "./safe-storage-http-tool-credential-store";

/** In-memory encrypted-boundary substitute used by custom HTTP service tests. */
class TestHttpToolCredentialStore implements ApplicationHttpToolCredentialStore {
  public credentials: ApplicationHttpToolCredentials = {};
  public available = true;

  /** Report secure storage availability for the test service. */
  public isAvailable(): boolean { return this.available; }

  /** Return a detached custom HTTP credential map. */
  public read(): ApplicationHttpToolCredentials { return structuredClone(this.credentials); }

  /** Replace the detached custom HTTP credential map. */
  public write(credentials: ApplicationHttpToolCredentials): void {
    this.credentials = structuredClone(credentials);
  }

  /** Clear every in-memory custom HTTP credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationHttpToolCredentialService saves headers and returns only names", () => {
  const credentials = new TestHttpToolCredentialStore();
  const service = new ApplicationHttpToolCredentialService({ credentials });
  try {
    const snapshot = service.save({
      credentials: { "tool-a": { Authorization: "Bearer http-secret" } },
    });
    assert.deepEqual(snapshot.configured["tool-a"], ["Authorization"]);
    assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    service.save({ clear: [{ toolId: "tool-a", headers: ["Authorization"] }] });
    assert.deepEqual(credentials.read(), {});
  } finally {
    service.close();
  }
});

test("ApplicationHttpToolCredentialService assigns legacy IDs and migrates only sensitive headers", () => {
  const credentials = new TestHttpToolCredentialStore();
  const service = new ApplicationHttpToolCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      custom_http: [{
        name: "weather",
        url: "https://weather.example.test",
        headers: JSON.stringify({
          Authorization: "Bearer weather-secret",
          "Content-Type": "application/json",
        }),
      }],
    }, { requireSecureCapture: true });
    const tool = (reconciled.settings.custom_http as Array<Record<string, unknown>>)[0];
    assert.ok(tool !== undefined);
    assert.match(String(tool.id), /^legacy-http-/);
    assert.deepEqual(tool.headerCredentialsConfigured, ["Authorization"]);
    const headers = JSON.parse(String(tool.headers)) as Record<string, string>;
    assert.equal(headers.Authorization, "");
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(JSON.stringify(reconciled.settings).includes("weather-secret"), false);
    assert.equal(credentials.read()[String(tool.id)]?.Authorization, "Bearer weather-secret");
  } finally {
    service.close();
  }
});

test("ApplicationHttpToolCredentialService preserves malformed legacy headers", () => {
  const credentials = new TestHttpToolCredentialStore();
  const service = new ApplicationHttpToolCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      custom_http: [{ id: "tool-a", headers: "not-json" }],
    });
    assert.equal(reconciled.persistSanitized, false);
    assert.equal((reconciled.settings.custom_http as Array<Record<string, unknown>>)[0]?.headers, "{}");
    assert.throws(
      () => service.reconcileLegacySettings(
        { custom_http: [{ id: "tool-a", headers: "not-json" }] },
        { requireSecureCapture: true },
      ),
      /entry is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationHttpToolCredentialService prunes removed tools on trusted writes", () => {
  const credentials = new TestHttpToolCredentialStore();
  credentials.credentials = {
    keep: { Authorization: "one" },
    remove: { Authorization: "two" },
  };
  const service = new ApplicationHttpToolCredentialService({ credentials });
  try {
    service.reconcileLegacySettings({
      custom_http: [{ id: "keep", headers: '{"Authorization":""}' }],
    }, { requireSecureCapture: true, pruneMissingScopes: true });
    assert.deepEqual(credentials.read(), { keep: { Authorization: "one" } });
  } finally {
    service.close();
  }
});
