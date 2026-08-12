import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationVoiceCredentials } from "../contracts/application-voice-credentials";
import { ApplicationVoiceCredentialService } from "./application-voice-credentials";
import type { ApplicationVoiceCredentialStore } from "./safe-storage-voice-credential-store";

/** In-memory encrypted-boundary substitute used by voice service tests. */
class TestVoiceCredentialStore implements ApplicationVoiceCredentialStore {
  public credentials: ApplicationVoiceCredentials = {};
  public available = true;

  /** Report secure storage availability for the test service. */
  public isAvailable(): boolean {
    return this.available;
  }

  /** Return a detached voice credential map. */
  public read(): ApplicationVoiceCredentials {
    return structuredClone(this.credentials);
  }

  /** Replace the detached voice credential map. */
  public write(credentials: ApplicationVoiceCredentials): void {
    this.credentials = structuredClone(credentials);
  }

  /** Clear every in-memory voice credential. */
  public clear(): void {
    this.credentials = {};
  }
}

test("ApplicationVoiceCredentialService saves scoped credentials and returns only flags", () => {
  const credentials = new TestVoiceCredentialStore();
  const service = new ApplicationVoiceCredentialService({ credentials });
  try {
    const snapshot = service.save({
      credentials: {
        default: { azureSpeechKey: "azure-secret" },
        Narrator: { fishApiKey: "fish-secret" },
      },
    });
    assert.equal(snapshot.configured.default?.azureSpeechKey, true);
    assert.equal(snapshot.configured.Narrator?.fishApiKey, true);
    assert.equal(snapshot.configured.default?.baiduApiKey, false);
    assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    const runtime = JSON.parse(
      Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"),
    ) as { credentials: ApplicationVoiceCredentials };
    assert.deepEqual(runtime.credentials, {
      default: { azureSpeechKey: "azure-secret" },
      Narrator: { fishApiKey: "fish-secret" },
    });
    service.save({ clear: [{ scope: "Narrator", fields: ["fishApiKey"] }] });
    assert.deepEqual(credentials.read(), { default: { azureSpeechKey: "azure-secret" } });
  } finally {
    service.close();
  }
});

test("ApplicationVoiceCredentialService migrates default and named voice secrets", () => {
  const credentials = new TestVoiceCredentialStore();
  const service = new ApplicationVoiceCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      ttsSettings: {
        engine: "azure",
        azureSpeechKey: "legacy-azure-secret",
        googleServiceAccount: "{\n  \"private_key\": \"legacy-google-secret\"\n}",
        newtts: {
          Narrator: { engine: "fish", fishApiKey: "legacy-fish-secret" },
        },
      },
    }, { requireSecureCapture: true });
    const tts = reconciled.settings.ttsSettings as Record<string, unknown>;
    const narrator = (tts.newtts as Record<string, Record<string, unknown>>).Narrator;
    assert.ok(narrator !== undefined);
    assert.equal(reconciled.persistSanitized, true);
    assert.equal(tts.azureSpeechKey, "");
    assert.equal(tts.azureSpeechKey_configured, true);
    assert.equal(tts.googleServiceAccount, "");
    assert.equal(narrator.fishApiKey, "");
    assert.equal(narrator.fishApiKey_configured, true);
    assert.equal(JSON.stringify(reconciled.settings).includes("legacy-fish-secret"), false);
    assert.deepEqual(credentials.read(), {
      default: {
        azureSpeechKey: "legacy-azure-secret",
        googleServiceAccount: "{\n  \"private_key\": \"legacy-google-secret\"\n}",
      },
      Narrator: { fishApiKey: "legacy-fish-secret" },
    });
  } finally {
    service.close();
  }
});

test("ApplicationVoiceCredentialService preserves plaintext when encryption is unavailable", () => {
  const credentials = new TestVoiceCredentialStore();
  credentials.available = false;
  const service = new ApplicationVoiceCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      ttsSettings: { azureSpeechKey: "only-legacy-copy" },
    });
    assert.equal(reconciled.persistSanitized, false);
    assert.equal(
      (reconciled.settings.ttsSettings as Record<string, unknown>).azureSpeechKey,
      "",
    );
    assert.throws(
      () => service.reconcileLegacySettings(
        { ttsSettings: { azureSpeechKey: "only-legacy-copy" } },
        { requireSecureCapture: true },
      ),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationVoiceCredentialService rejects malformed service accounts without rewriting", () => {
  const credentials = new TestVoiceCredentialStore();
  const service = new ApplicationVoiceCredentialService({ credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      ttsSettings: { googleServiceAccount: "not-json" },
    });
    assert.equal(reconciled.persistSanitized, false);
    assert.throws(
      () => service.reconcileLegacySettings(
        { ttsSettings: { googleServiceAccount: "not-json" } },
        { requireSecureCapture: true },
      ),
      /entry is invalid/,
    );
    assert.deepEqual(credentials.read(), {});
  } finally {
    service.close();
  }
});

test("ApplicationVoiceCredentialService prunes removed named voice scopes on trusted writes", () => {
  const credentials = new TestVoiceCredentialStore();
  credentials.credentials = {
    default: { azureSpeechKey: "azure-secret" },
    RemovedVoice: { fishApiKey: "fish-secret" },
  };
  const service = new ApplicationVoiceCredentialService({ credentials });
  try {
    service.reconcileLegacySettings({
      ttsSettings: { azureSpeechKey: "", newtts: {} },
    }, { requireSecureCapture: true, pruneMissingScopes: true });
    assert.deepEqual(credentials.read(), {
      default: { azureSpeechKey: "azure-secret" },
    });
  } finally {
    service.close();
  }
});
