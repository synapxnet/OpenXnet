import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationComfyUiCredentials } from "../contracts/application-comfyui-credentials";
import { ApplicationComfyUiCredentialService } from "./application-comfyui-credentials";
import type { ApplicationComfyUiCredentialStore } from "./safe-storage-comfyui-credential-store";

/** In-memory ComfyUI credential store used by service tests. */
class MemoryComfyUiCredentialStore implements ApplicationComfyUiCredentialStore {
  public credentials: ApplicationComfyUiCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory ComfyUI credential map. */
  public read(): ApplicationComfyUiCredentials { return this.credentials; }

  /** Replace the current in-memory ComfyUI credential map. */
  public write(credentials: ApplicationComfyUiCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory ComfyUI credential. */
  public clear(): void { this.credentials = {}; }
}

test("ComfyUI service returns configured names without secrets", () => {
  const store = new MemoryComfyUiCredentialStore();
  const service = new ApplicationComfyUiCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ credentials: { api_key: "comfyui-secret" } });
    assert.deepEqual(snapshot.configured, ["api_key"]);
    assert.equal(JSON.stringify(snapshot).includes("comfyui-secret"), false);
    assert.throws(
      () => service.save({ credentials: { e2b_api_key: "wrong-zone" } }),
      /field is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ComfyUI service migrates only the global key", () => {
  const store = new MemoryComfyUiCredentialStore();
  const service = new ApplicationComfyUiCredentialService({ credentials: store });
  try {
    const result = service.reconcileLegacySettings({
      comfyuiServers: ["http://127.0.0.1:8188", "https://comfy.example.test"],
      comfyuiAPIkey: "comfyui-secret",
      HASettings: { api_key: "separate-trust-zone" },
    }, { requireSecureCapture: true });
    assert.equal(result.persistSanitized, true);
    assert.equal(result.settings.comfyuiAPIkey, "");
    assert.deepEqual(result.settings.comfyuiCredentialFieldsConfigured, ["api_key"]);
    assert.deepEqual(result.settings.comfyuiServers, [
      "http://127.0.0.1:8188",
      "https://comfy.example.test",
    ]);
    assert.deepEqual(result.settings.HASettings, { api_key: "separate-trust-zone" });
  } finally {
    service.close();
  }
});

test("ComfyUI service requires secure capture and rejects invalid legacy values", () => {
  const unavailable = new ApplicationComfyUiCredentialService({
    credentials: new MemoryComfyUiCredentialStore(false),
  });
  try {
    const result = unavailable.reconcileLegacySettings({ comfyuiAPIkey: "comfyui-secret" });
    assert.equal(result.persistSanitized, false);
    assert.equal(result.settings.comfyuiAPIkey, "");
    assert.throws(
      () => unavailable.reconcileLegacySettings(
        { comfyuiAPIkey: "comfyui-secret" },
        { requireSecureCapture: true },
      ),
      /encryption is unavailable/,
    );
  } finally {
    unavailable.close();
  }

  const available = new ApplicationComfyUiCredentialService({
    credentials: new MemoryComfyUiCredentialStore(),
  });
  try {
    assert.throws(
      () => available.reconcileLegacySettings(
        { comfyuiAPIkey: 12345 },
        { requireSecureCapture: true },
      ),
      /entry is invalid/,
    );
  } finally {
    available.close();
  }
});

test("ComfyUI service clears credentials and builds an authorized-runtime envelope", () => {
  const store = new MemoryComfyUiCredentialStore();
  store.credentials = { api_key: "comfyui-secret" };
  const service = new ApplicationComfyUiCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(
      Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"),
    );
    assert.equal(payload.schema, "openxnet.comfyui-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
    assert.deepEqual(service.save({ clear: ["api_key"] }).configured, []);
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});
