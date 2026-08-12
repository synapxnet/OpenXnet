import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationHomeAssistantCredentials } from "../contracts/application-home-assistant-credentials";
import { ApplicationHomeAssistantCredentialService } from "./application-home-assistant-credentials";
import type { ApplicationHomeAssistantCredentialStore } from "./safe-storage-home-assistant-credential-store";

/** In-memory Home Assistant credential store used by service tests. */
class MemoryHomeAssistantCredentialStore implements ApplicationHomeAssistantCredentialStore {
  public credentials: ApplicationHomeAssistantCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory Home Assistant credential map. */
  public read(): ApplicationHomeAssistantCredentials { return this.credentials; }

  /** Replace the current in-memory Home Assistant credential map. */
  public write(credentials: ApplicationHomeAssistantCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory Home Assistant credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationHomeAssistantCredentialService returns configured names without secrets", () => {
  const store = new MemoryHomeAssistantCredentialStore();
  const service = new ApplicationHomeAssistantCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ credentials: { api_key: "home-assistant-secret" } });
    assert.deepEqual(snapshot.configured, ["api_key"]);
    assert.equal(JSON.stringify(snapshot).includes("home-assistant-secret"), false);
    assert.throws(() => service.save({ credentials: { e2b_api_key: "wrong-zone" } }), /field is invalid/);
  } finally {
    service.close();
  }
});

test("ApplicationHomeAssistantCredentialService migrates only the Home Assistant token", () => {
  const store = new MemoryHomeAssistantCredentialStore();
  const service = new ApplicationHomeAssistantCredentialService({ credentials: store });
  try {
    const result = service.reconcileLegacySettings({
      HASettings: {
        enabled: true,
        api_key: "home-assistant-secret",
        url: "http://127.0.0.1:8123",
      },
      comfyuiAPIkey: "separate-trust-zone",
    }, { requireSecureCapture: true });
    const redacted = result.settings.HASettings as Record<string, unknown>;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.api_key, "");
    assert.equal(redacted.enabled, true);
    assert.equal(redacted.url, "http://127.0.0.1:8123");
    assert.deepEqual(redacted.homeAssistantCredentialFieldsConfigured, ["api_key"]);
    assert.equal(result.settings.comfyuiAPIkey, "separate-trust-zone");
  } finally {
    service.close();
  }
});

test("ApplicationHomeAssistantCredentialService preserves plaintext without secure capture", () => {
  const service = new ApplicationHomeAssistantCredentialService({
    credentials: new MemoryHomeAssistantCredentialStore(false),
  });
  const settings = { HASettings: { api_key: "home-assistant-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    assert.equal(readResult.persistSanitized, false);
    assert.equal((readResult.settings.HASettings as Record<string, unknown>).api_key, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationHomeAssistantCredentialService rejects invalid legacy types on trusted writes", () => {
  const service = new ApplicationHomeAssistantCredentialService({
    credentials: new MemoryHomeAssistantCredentialStore(),
  });
  try {
    assert.throws(
      () => service.reconcileLegacySettings(
        { HASettings: { api_key: 12345 } },
        { requireSecureCapture: true },
      ),
      /entry is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationHomeAssistantCredentialService clears the encrypted token", () => {
  const store = new MemoryHomeAssistantCredentialStore();
  store.credentials = { api_key: "home-assistant-secret" };
  const service = new ApplicationHomeAssistantCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ clear: ["api_key"] });
    assert.deepEqual(snapshot.configured, []);
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});

test("ApplicationHomeAssistantCredentialService builds a bounded trusted-runtime envelope", () => {
  const store = new MemoryHomeAssistantCredentialStore();
  store.credentials = { api_key: "home-assistant-secret" };
  const service = new ApplicationHomeAssistantCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"));
    assert.equal(payload.schema, "openxnet.home-assistant-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
  } finally {
    service.close();
  }
});
