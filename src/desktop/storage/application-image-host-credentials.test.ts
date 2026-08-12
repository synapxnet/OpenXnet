import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationImageHostCredentials } from "../contracts/application-image-host-credentials";
import { ApplicationImageHostCredentialService } from "./application-image-host-credentials";
import type { ApplicationImageHostCredentialStore } from "./safe-storage-image-host-credential-store";

/** In-memory image-host credential store used by service tests. */
class MemoryImageHostCredentialStore implements ApplicationImageHostCredentialStore {
  public credentials: ApplicationImageHostCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory image-host credential map. */
  public read(): ApplicationImageHostCredentials { return this.credentials; }

  /** Replace the current in-memory image-host credential map. */
  public write(credentials: ApplicationImageHostCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory image-host credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationImageHostCredentialService saves exact fields and returns names only", () => {
  const store = new MemoryImageHostCredentialStore();
  const service = new ApplicationImageHostCredentialService({ credentials: store });
  try {
    const snapshot = service.save({
      credentials: {
        SMMS_api_key: "smms-secret",
        EI2_api_key: "easy-image-secret",
      },
    });
    assert.deepEqual(snapshot.configured, ["SMMS_api_key", "EI2_api_key"]);
    assert.equal(JSON.stringify(snapshot).includes("smms-secret"), false);
    assert.throws(
      () => service.save({ credentials: { github_token: "wrong-zone" } }),
      /field is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationImageHostCredentialService migrates only image-host fields", () => {
  const store = new MemoryImageHostCredentialStore();
  const service = new ApplicationImageHostCredentialService({ credentials: store });
  const settings = {
    BotConfig: {
      imgHost: "EI2",
      EI2_base_url: "https://images.example.test/api",
      SMMS_api_key: "smms-secret",
      EI2_api_key: "easy-image-secret",
      gitee_token: "gitee-remains-separate",
      github_token: "github-remains-separate",
    },
  };
  try {
    const result = service.reconcileLegacySettings(settings, { requireSecureCapture: true });
    const redacted = result.settings as typeof settings;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.BotConfig.SMMS_api_key, "");
    assert.equal(redacted.BotConfig.EI2_api_key, "");
    assert.equal(redacted.BotConfig.EI2_base_url, "https://images.example.test/api");
    assert.equal(redacted.BotConfig.gitee_token, "gitee-remains-separate");
    assert.equal(redacted.BotConfig.github_token, "github-remains-separate");
    assert.deepEqual(
      (redacted.BotConfig as Record<string, unknown>).imageHostCredentialFieldsConfigured,
      ["SMMS_api_key", "EI2_api_key"],
    );
    assert.deepEqual(store.credentials, {
      SMMS_api_key: "smms-secret",
      EI2_api_key: "easy-image-secret",
    });
  } finally {
    service.close();
  }
});

test("ApplicationImageHostCredentialService preserves plaintext without secure capture", () => {
  const service = new ApplicationImageHostCredentialService({
    credentials: new MemoryImageHostCredentialStore(false),
  });
  const settings = { BotConfig: { SMMS_api_key: "smms-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    assert.equal(readResult.persistSanitized, false);
    assert.equal((readResult.settings.BotConfig as Record<string, unknown>).SMMS_api_key, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationImageHostCredentialService clears one field without changing another", () => {
  const store = new MemoryImageHostCredentialStore();
  store.credentials = {
    SMMS_api_key: "smms-secret",
    EI2_api_key: "easy-image-secret",
  };
  const service = new ApplicationImageHostCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ clear: ["SMMS_api_key"] });
    assert.deepEqual(snapshot.configured, ["EI2_api_key"]);
    assert.deepEqual(store.credentials, { EI2_api_key: "easy-image-secret" });
  } finally {
    service.close();
  }
});

test("ApplicationImageHostCredentialService builds a bounded Worker-only envelope", () => {
  const store = new MemoryImageHostCredentialStore();
  store.credentials = { SMMS_api_key: "smms-secret" };
  const service = new ApplicationImageHostCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(Buffer.from(
      service.getRuntimeCredentialBootstrap(),
      "base64",
    ).toString("utf8"));
    assert.equal(payload.schema, "openxnet.image-host-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
  } finally {
    service.close();
  }
});
