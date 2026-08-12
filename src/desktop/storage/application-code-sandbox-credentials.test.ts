import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationCodeSandboxCredentials } from "../contracts/application-code-sandbox-credentials";
import { ApplicationCodeSandboxCredentialService } from "./application-code-sandbox-credentials";
import type { ApplicationCodeSandboxCredentialStore } from "./safe-storage-code-sandbox-credential-store";

/** In-memory code-sandbox credential store used by service tests. */
class MemoryCodeSandboxCredentialStore implements ApplicationCodeSandboxCredentialStore {
  public credentials: ApplicationCodeSandboxCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory code-sandbox credential map. */
  public read(): ApplicationCodeSandboxCredentials { return this.credentials; }

  /** Replace the current in-memory code-sandbox credential map. */
  public write(credentials: ApplicationCodeSandboxCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory code-sandbox credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationCodeSandboxCredentialService returns configured names without secrets", () => {
  const store = new MemoryCodeSandboxCredentialStore();
  const service = new ApplicationCodeSandboxCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ credentials: { e2b_api_key: "e2b-secret" } });
    assert.deepEqual(snapshot.configured, ["e2b_api_key"]);
    assert.equal(JSON.stringify(snapshot).includes("e2b-secret"), false);
    assert.throws(() => service.save({ credentials: { comfyuiAPIkey: "wrong-zone" } }), /field is invalid/);
  } finally {
    service.close();
  }
});

test("ApplicationCodeSandboxCredentialService migrates only the E2B key", () => {
  const store = new MemoryCodeSandboxCredentialStore();
  const service = new ApplicationCodeSandboxCredentialService({ credentials: store });
  try {
    const result = service.reconcileLegacySettings({
      codeSettings: {
        enabled: true,
        engine: "e2b",
        e2b_api_key: "e2b-secret",
        sandbox_url: "http://127.0.0.1:8080",
      },
      HASettings: { api_key: "separate-trust-zone" },
    }, { requireSecureCapture: true });
    const redacted = result.settings.codeSettings as Record<string, unknown>;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.e2b_api_key, "");
    assert.equal(redacted.sandbox_url, "http://127.0.0.1:8080");
    assert.deepEqual(redacted.codeSandboxCredentialFieldsConfigured, ["e2b_api_key"]);
    assert.deepEqual(result.settings.HASettings, { api_key: "separate-trust-zone" });
  } finally {
    service.close();
  }
});

test("ApplicationCodeSandboxCredentialService preserves plaintext without secure capture", () => {
  const service = new ApplicationCodeSandboxCredentialService({
    credentials: new MemoryCodeSandboxCredentialStore(false),
  });
  const settings = { codeSettings: { e2b_api_key: "e2b-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    assert.equal(readResult.persistSanitized, false);
    assert.equal((readResult.settings.codeSettings as Record<string, unknown>).e2b_api_key, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationCodeSandboxCredentialService rejects invalid legacy types on trusted writes", () => {
  const service = new ApplicationCodeSandboxCredentialService({
    credentials: new MemoryCodeSandboxCredentialStore(),
  });
  try {
    assert.throws(
      () => service.reconcileLegacySettings(
        { codeSettings: { e2b_api_key: 12345 } },
        { requireSecureCapture: true },
      ),
      /entry is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationCodeSandboxCredentialService clears the encrypted E2B key", () => {
  const store = new MemoryCodeSandboxCredentialStore();
  store.credentials = { e2b_api_key: "e2b-secret" };
  const service = new ApplicationCodeSandboxCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ clear: ["e2b_api_key"] });
    assert.deepEqual(snapshot.configured, []);
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});

test("ApplicationCodeSandboxCredentialService builds a bounded runtime envelope", () => {
  const store = new MemoryCodeSandboxCredentialStore();
  store.credentials = { e2b_api_key: "e2b-secret" };
  const service = new ApplicationCodeSandboxCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"));
    assert.equal(payload.schema, "openxnet.code-sandbox-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
  } finally {
    service.close();
  }
});
