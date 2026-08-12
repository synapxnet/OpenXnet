import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationLivePlatformCredentials } from "../contracts/application-live-platform-credentials";
import { ApplicationLivePlatformCredentialService } from "./application-live-platform-credentials";
import type { ApplicationLivePlatformCredentialStore } from "./safe-storage-live-platform-credential-store";

/** In-memory live-platform credential store used by service tests. */
class MemoryLivePlatformCredentialStore implements ApplicationLivePlatformCredentialStore {
  public credentials: ApplicationLivePlatformCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory live-platform credential map. */
  public read(): ApplicationLivePlatformCredentials { return this.credentials; }

  /** Replace the current in-memory live-platform credential map. */
  public write(credentials: ApplicationLivePlatformCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory live-platform credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationLivePlatformCredentialService saves exact fields and returns names only", () => {
  const store = new MemoryLivePlatformCredentialStore();
  const service = new ApplicationLivePlatformCredentialService({ credentials: store });
  try {
    const snapshot = service.save({
      credentials: {
        bilibili_sessdata: "bilibili-cookie",
        bilibili_ACCESS_KEY_SECRET: "bilibili-secret",
        bilibili_ROOM_OWNER_AUTH_CODE: "bilibili-owner-code",
        youtube_api_key: "youtube-secret",
        twitch_access_token: "oauth:twitch-secret",
      },
    });
    assert.equal(snapshot.configured.length, 5);
    assert.equal(JSON.stringify(snapshot).includes("youtube-secret"), false);
    assert.throws(
      () => service.save({ credentials: { gitee_token: "wrong-zone" } }),
      /field is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationLivePlatformCredentialService migrates secrets and normalizes metadata", () => {
  const store = new MemoryLivePlatformCredentialStore();
  const service = new ApplicationLivePlatformCredentialService({ credentials: store });
  const settings = {
    liveConfig: {
      bilibili_type: "open_live",
      bilibili_room_id: "12345",
      bilibili_ACCESS_KEY_ID: "public-access-id",
      bilibili_ACCESS_KEY_SECRET: "bilibili-secret",
      bilibili_APP_ID: "public-app-id",
      bilibili_ROOM_OWNER_AUTH_CODE: "owner-auth-code",
      youtube_vedio_id: "legacy-video-id",
      youtube_api_key: "youtube-secret",
      twitch_channel: "openxnet",
      twitch_access_token: "oauth:twitch-secret",
    },
  };
  try {
    const result = service.reconcileLegacySettings(settings, { requireSecureCapture: true });
    const redacted = result.settings.liveConfig as Record<string, unknown>;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.bilibili_ACCESS_KEY_SECRET, "");
    assert.equal(redacted.bilibili_ROOM_OWNER_AUTH_CODE, "");
    assert.equal(redacted.youtube_api_key, "");
    assert.equal(redacted.twitch_access_token, "");
    assert.equal(redacted.bilibili_ACCESS_KEY_ID, "public-access-id");
    assert.equal(redacted.bilibili_APP_ID, "public-app-id");
    assert.equal(redacted.youtube_video_id, "legacy-video-id");
    assert.equal("youtube_vedio_id" in redacted, false);
    assert.equal(redacted.bilibili_type, "open");
    assert.deepEqual(redacted.liveCredentialFieldsConfigured, [
      "bilibili_ACCESS_KEY_SECRET",
      "bilibili_ROOM_OWNER_AUTH_CODE",
      "youtube_api_key",
      "twitch_access_token",
    ]);
  } finally {
    service.close();
  }
});

test("ApplicationLivePlatformCredentialService preserves plaintext without secure capture", () => {
  const service = new ApplicationLivePlatformCredentialService({
    credentials: new MemoryLivePlatformCredentialStore(false),
  });
  const settings = { liveConfig: { youtube_api_key: "youtube-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    assert.equal(readResult.persistSanitized, false);
    assert.equal((readResult.settings.liveConfig as Record<string, unknown>).youtube_api_key, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationLivePlatformCredentialService clears one field without changing another", () => {
  const store = new MemoryLivePlatformCredentialStore();
  store.credentials = {
    youtube_api_key: "youtube-secret",
    twitch_access_token: "oauth:twitch-secret",
  };
  const service = new ApplicationLivePlatformCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ clear: ["youtube_api_key"] });
    assert.deepEqual(snapshot.configured, ["twitch_access_token"]);
    assert.deepEqual(store.credentials, { twitch_access_token: "oauth:twitch-secret" });
  } finally {
    service.close();
  }
});

test("ApplicationLivePlatformCredentialService builds a bounded live-runtime envelope", () => {
  const store = new MemoryLivePlatformCredentialStore();
  store.credentials = { youtube_api_key: "youtube-secret" };
  const service = new ApplicationLivePlatformCredentialService({ credentials: store });
  try {
    const payload = JSON.parse(Buffer.from(
      service.getRuntimeCredentialBootstrap(),
      "base64",
    ).toString("utf8"));
    assert.equal(payload.schema, "openxnet.live-platform-credentials.runtime.v1");
    assert.deepEqual(payload.credentials, store.credentials);
  } finally {
    service.close();
  }
});
