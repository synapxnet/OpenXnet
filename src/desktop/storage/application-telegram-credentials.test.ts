import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationTelegramCredentials } from "../contracts/application-telegram-credentials";
import { ApplicationTelegramCredentialService } from "./application-telegram-credentials";
import type { ApplicationTelegramCredentialStore } from "./safe-storage-telegram-credential-store";

/** In-memory Telegram credential store used by service tests. */
class MemoryTelegramCredentialStore implements ApplicationTelegramCredentialStore {
  public credentials: ApplicationTelegramCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory Telegram credential. */
  public read(): ApplicationTelegramCredentials { return this.credentials; }

  /** Replace the current in-memory Telegram credential. */
  public write(credentials: ApplicationTelegramCredentials): void { this.credentials = credentials; }

  /** Remove the in-memory Telegram credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationTelegramCredentialService saves a token and returns configured state only", () => {
  const store = new MemoryTelegramCredentialStore();
  const service = new ApplicationTelegramCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ botToken: "123456:telegram-secret" });
    assert.equal(snapshot.configured, true);
    assert.equal(JSON.stringify(snapshot).includes("telegram-secret"), false);
    assert.equal(store.credentials.botToken, "123456:telegram-secret");
    assert.throws(
      () => service.save({ botToken: "123456:replacement", clear: true }),
      /saved and cleared together/,
    );
    assert.equal(service.save({ clear: true }).configured, false);
  } finally {
    service.close();
  }
});

test("ApplicationTelegramCredentialService migrates canonical and obsolete settings keys", () => {
  const store = new MemoryTelegramCredentialStore();
  const service = new ApplicationTelegramCredentialService({ credentials: store });
  const settings = {
    telegramBotConfig: {
      bot_token: "123456:telegram-secret",
      TelegramAgent: "openxnet-model",
      behaviorTargetChatIds: ["100"],
    },
    telegramBot: {
      bot_token: "123456:telegram-secret",
      behaviorTargetChatIds: ["legacy"],
    },
  };
  try {
    const result = service.reconcileLegacySettings(settings, { requireSecureCapture: true });
    const redacted = result.settings as typeof settings;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.telegramBotConfig.bot_token, "");
    assert.equal(redacted.telegramBot.bot_token, "");
    assert.equal(redacted.telegramBotConfig.TelegramAgent, "openxnet-model");
    assert.deepEqual(redacted.telegramBotConfig.behaviorTargetChatIds, ["100"]);
    assert.deepEqual(
      (redacted.telegramBotConfig as Record<string, unknown>).credentialFieldsConfigured,
      ["bot_token"],
    );
    assert.equal(store.credentials.botToken, "123456:telegram-secret");
  } finally {
    service.close();
  }
});

test("ApplicationTelegramCredentialService rejects conflicting legacy tokens", () => {
  const store = new MemoryTelegramCredentialStore();
  const service = new ApplicationTelegramCredentialService({ credentials: store });
  try {
    assert.throws(
      () => service.reconcileLegacySettings({
        telegramBotConfig: { bot_token: "123456:canonical-secret" },
        telegramBot: { bot_token: "123456:different-secret" },
      }, { requireSecureCapture: true }),
      /invalid or conflicting/,
    );
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});

test("ApplicationTelegramCredentialService refuses plaintext migration without secure capture", () => {
  const service = new ApplicationTelegramCredentialService({
    credentials: new MemoryTelegramCredentialStore(false),
  });
  const settings = { telegramBotConfig: { bot_token: "123456:telegram-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    assert.equal(readResult.persistSanitized, false);
    assert.equal((readResult.settings.telegramBotConfig as Record<string, unknown>).bot_token, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationTelegramCredentialService builds a bounded trusted-runtime envelope", () => {
  const store = new MemoryTelegramCredentialStore();
  store.credentials = { botToken: "123456:telegram-secret" };
  const service = new ApplicationTelegramCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(Buffer.from(
      service.getRuntimeCredentialBootstrap(),
      "base64",
    ).toString("utf8"));
    assert.equal(payload.schema, "openxnet.telegram-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
  } finally {
    service.close();
  }
});
