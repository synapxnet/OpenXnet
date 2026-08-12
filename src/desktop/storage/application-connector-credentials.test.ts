import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationConnectorCredentials } from "../contracts/application-connector-credentials";
import {
  ApplicationConnectorCredentialService,
} from "./application-connector-credentials";
import type { ApplicationConnectorCredentialStore } from "./safe-storage-connector-credential-store";

/** In-memory Connector Worker credential store used by service tests. */
class MemoryConnectorCredentialStore implements ApplicationConnectorCredentialStore {
  public credentials: ApplicationConnectorCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory credential map. */
  public read(): ApplicationConnectorCredentials { return this.credentials; }

  /** Replace the current in-memory credential map. */
  public write(credentials: ApplicationConnectorCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory Connector Worker credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationConnectorCredentialService saves exact fields and returns only names", () => {
  const store = new MemoryConnectorCredentialStore();
  const service = new ApplicationConnectorCredentialService({ credentials: store });
  try {
    const snapshot = service.save({
      credentials: {
        qq: { secret: "qq-secret" },
        slack: { bot_token: "xoxb-secret", app_token: "xapp-secret" },
      },
    });
    assert.deepEqual(snapshot.configured.qq, ["secret"]);
    assert.deepEqual(snapshot.configured.slack, ["bot_token", "app_token"]);
    assert.equal(JSON.stringify(snapshot).includes("qq-secret"), false);
    assert.throws(
      () => service.save({ credentials: { qq: { token: "wrong-field" } } }),
      /field is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationConnectorCredentialService migrates six secrets and retains public app IDs", () => {
  const store = new MemoryConnectorCredentialStore();
  const service = new ApplicationConnectorCredentialService({ credentials: store });
  const settings = {
    qqBotConfig: { appid: "qq-app", secret: "qq-secret" },
    feishuBotConfig: { appid: "feishu-app", secret: "feishu-secret" },
    dingtalkBotConfig: { appKey: "ding-key", appSecret: "ding-secret" },
    discordBotConfig: { token: "discord-token" },
    slackBotConfig: { bot_token: "xoxb-secret", app_token: "xapp-secret" },
    telegramBotConfig: { bot_token: "telegram-remains" },
  };
  try {
    const result = service.reconcileLegacySettings(settings);
    const redacted = result.settings as typeof settings;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.qqBotConfig.appid, "qq-app");
    assert.equal(redacted.qqBotConfig.secret, "");
    assert.equal(redacted.dingtalkBotConfig.appKey, "ding-key");
    assert.equal(redacted.dingtalkBotConfig.appSecret, "");
    assert.equal(redacted.telegramBotConfig.bot_token, "telegram-remains");
    assert.deepEqual((redacted.slackBotConfig as Record<string, unknown>).credentialFieldsConfigured, [
      "bot_token",
      "app_token",
    ]);
    assert.deepEqual(store.credentials, {
      qq: { secret: "qq-secret" },
      feishu: { secret: "feishu-secret" },
      dingtalk: { appSecret: "ding-secret" },
      discord: { token: "discord-token" },
      slack: { bot_token: "xoxb-secret", app_token: "xapp-secret" },
    });
  } finally {
    service.close();
  }
});

test("ApplicationConnectorCredentialService preserves plaintext without secure capture", () => {
  const service = new ApplicationConnectorCredentialService({
    credentials: new MemoryConnectorCredentialStore(false),
  });
  const settings = { qqBotConfig: { appid: "qq-app", secret: "qq-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    const redacted = readResult.settings as typeof settings;
    assert.equal(readResult.persistSanitized, false);
    assert.equal(redacted.qqBotConfig.secret, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationConnectorCredentialService builds a bounded Worker-only envelope", () => {
  const store = new MemoryConnectorCredentialStore();
  store.credentials = { discord: { token: "discord-token" } };
  const service = new ApplicationConnectorCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(Buffer.from(
      service.getRuntimeCredentialBootstrap(),
      "base64",
    ).toString("utf8"));
    assert.equal(payload.schema, "openxnet.connector-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
  } finally {
    service.close();
  }
});
