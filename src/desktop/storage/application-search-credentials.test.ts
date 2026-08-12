import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationSearchCredentials } from "../contracts/application-search-credentials";
import { ApplicationSearchCredentialService } from "./application-search-credentials";
import type { ApplicationSearchCredentialStore } from "./safe-storage-search-credential-store";

/** In-memory encrypted-boundary substitute used by search service tests. */
class TestSearchCredentialStore implements ApplicationSearchCredentialStore {
  public credentials: ApplicationSearchCredentials = {};
  public available = true;

  /** Report secure storage availability for the test service. */
  public isAvailable(): boolean {
    return this.available;
  }

  /** Return a detached search credential map. */
  public read(): ApplicationSearchCredentials {
    return structuredClone(this.credentials);
  }

  /** Replace the detached search credential map. */
  public write(credentials: ApplicationSearchCredentials): void {
    this.credentials = structuredClone(credentials);
  }

  /** Clear every in-memory search credential. */
  public clear(): void {
    this.credentials = {};
  }
}

test("ApplicationSearchCredentialService saves and returns only configured flags", () => {
  const credentials = new TestSearchCredentialStore();
  const service = new ApplicationSearchCredentialService({ credentials });
  try {
    const snapshot = service.save({
      credentials: { tavily: "tavily-secret", google: "google-secret" },
    });
    assert.equal(snapshot.configured.tavily, true);
    assert.equal(snapshot.configured.google, true);
    assert.equal(snapshot.configured.bing, false);
    assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    const runtime = JSON.parse(
      Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"),
    ) as { credentials: Record<string, string> };
    assert.deepEqual(runtime.credentials, {
      tavily: "tavily-secret",
      google: "google-secret",
    });
    service.save({ clear: ["tavily"] });
    assert.deepEqual(credentials.read(), { google: "google-secret" });
    assert.throws(
      () => service.save({ credentials: { unknown: "secret" } }),
      /entry is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationSearchCredentialService migrates and redacts legacy webSearch keys", () => {
  const credentials = new TestSearchCredentialStore();
  const service = new ApplicationSearchCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      webSearch: {
        engine: "tavily",
        tavily_api_key: "legacy-tavily-secret",
        google_api_key: "legacy-google-secret",
        Crawl4Ai_api_key: "test_api_code",
      },
    }, { requireSecureCapture: true });
    const webSearch = reconciled.settings.webSearch as Record<string, unknown>;
    assert.equal(reconciled.persistSanitized, true);
    assert.equal(webSearch.tavily_api_key, "");
    assert.equal(webSearch.google_api_key, "");
    assert.equal(webSearch.Crawl4Ai_api_key, "");
    assert.equal(webSearch.tavily_api_key_configured, true);
    assert.equal(webSearch.google_api_key_configured, true);
    assert.equal(webSearch.Crawl4Ai_api_key_configured, false);
    assert.deepEqual(credentials.read(), {
      tavily: "legacy-tavily-secret",
      google: "legacy-google-secret",
    });
    assert.equal(JSON.stringify(reconciled.settings).includes("legacy-tavily-secret"), false);
  } finally {
    service.close();
  }
});

test("ApplicationSearchCredentialService preserves plaintext when secure capture is unavailable", () => {
  const credentials = new TestSearchCredentialStore();
  credentials.available = false;
  const service = new ApplicationSearchCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      webSearch: { bing_api_key: "only-legacy-copy" },
    });
    assert.equal(reconciled.persistSanitized, false);
    assert.equal(
      (reconciled.settings.webSearch as Record<string, unknown>).bing_api_key,
      "",
    );
    assert.throws(
      () => service.reconcileLegacySettings(
        { webSearch: { bing_api_key: "only-legacy-copy" } },
        { requireSecureCapture: true },
      ),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationSearchCredentialService rejects invalid legacy secrets without rewriting them", () => {
  const credentials = new TestSearchCredentialStore();
  const service = new ApplicationSearchCredentialService({ credentials });
  const oversized = "x".repeat(16_385);
  try {
    const reconciled = service.reconcileLegacySettings({
      webSearch: { tavily_api_key: oversized },
    });
    assert.equal(reconciled.persistSanitized, false);
    assert.equal(
      (reconciled.settings.webSearch as Record<string, unknown>).tavily_api_key,
      "",
    );
    assert.throws(
      () => service.reconcileLegacySettings(
        { webSearch: { tavily_api_key: oversized } },
        { requireSecureCapture: true },
      ),
      /entry is invalid/,
    );
    assert.deepEqual(credentials.read(), {});
  } finally {
    service.close();
  }
});
