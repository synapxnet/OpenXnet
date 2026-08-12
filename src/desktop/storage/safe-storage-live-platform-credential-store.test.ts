import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageLivePlatformCredentialStore } from "./safe-storage-live-platform-credential-store";

/** Deterministic non-plaintext encryption stub for live-platform storage tests. */
class TestSafeStorage implements SafeStorageLike {
  /** Report encryption availability for the test adapter. */
  public isEncryptionAvailable(): boolean { return true; }

  /** Encode plaintext into a deterministic encrypted test buffer. */
  public encryptString(plainText: string): Buffer {
    return Buffer.from(`encrypted:${Buffer.from(plainText).toString("base64")}`, "utf8");
  }

  /** Decode the deterministic encrypted test buffer. */
  public decryptString(encrypted: Buffer): string {
    return Buffer.from(encrypted.toString("utf8").replace(/^encrypted:/, ""), "base64").toString("utf8");
  }
}

test("Live-platform credential store encrypts and restores exact fields", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-live-platform-credentials-"));
  const filePath = path.join(directory, "live-platform-credentials.bin");
  const store = new SafeStorageLivePlatformCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({
      bilibili_sessdata: "bilibili-cookie",
      bilibili_ACCESS_KEY_SECRET: "bilibili-secret",
      bilibili_ROOM_OWNER_AUTH_CODE: "bilibili-owner-code",
      youtube_api_key: "youtube-secret",
      twitch_access_token: "oauth:twitch-secret",
    });
    assert.equal(readFileSync(filePath, "utf8").includes("youtube-secret"), false);
    assert.deepEqual(store.read(), {
      bilibili_sessdata: "bilibili-cookie",
      bilibili_ACCESS_KEY_SECRET: "bilibili-secret",
      bilibili_ROOM_OWNER_AUTH_CODE: "bilibili-owner-code",
      youtube_api_key: "youtube-secret",
      twitch_access_token: "oauth:twitch-secret",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Live-platform credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-live-platform-credentials-"));
  try {
    const store = new SafeStorageLivePlatformCredentialStore({
      filePath: path.join(directory, "live.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(
      () => store.write({ github_token: "wrong-zone" } as never),
      /field is invalid/,
    );
    const insecure = new SafeStorageLivePlatformCredentialStore({
      filePath: path.join(directory, "insecure.bin"),
      safeStorage: {
        isEncryptionAvailable: () => true,
        getSelectedStorageBackend: () => "basic_text",
        encryptString: (plainText) => Buffer.from(plainText),
        decryptString: (encrypted) => encrypted.toString("utf8"),
      },
    });
    assert.equal(insecure.isAvailable(), false);
    assert.throws(
      () => insecure.write({ youtube_api_key: "youtube-secret" }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
