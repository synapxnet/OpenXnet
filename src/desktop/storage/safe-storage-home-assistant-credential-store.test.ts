import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageHomeAssistantCredentialStore } from "./safe-storage-home-assistant-credential-store";

/** Deterministic non-plaintext encryption stub for Home Assistant storage tests. */
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

test("Home Assistant credential store encrypts and restores the access token", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-home-assistant-credentials-"));
  const filePath = path.join(directory, "home-assistant-credentials.bin");
  const store = new SafeStorageHomeAssistantCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ api_key: "home-assistant-secret" });
    assert.equal(readFileSync(filePath, "utf8").includes("home-assistant-secret"), false);
    assert.deepEqual(store.read(), { api_key: "home-assistant-secret" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Home Assistant credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-home-assistant-credentials-"));
  try {
    const store = new SafeStorageHomeAssistantCredentialStore({
      filePath: path.join(directory, "home-assistant.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(() => store.write({ comfyuiAPIkey: "wrong-zone" } as never), /field is invalid/);
    const insecure = new SafeStorageHomeAssistantCredentialStore({
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
      () => insecure.write({ api_key: "home-assistant-secret" }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
