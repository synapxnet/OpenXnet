import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SafeStorageProviderCredentialStore } from "./safe-storage-provider-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Deterministic non-plaintext encryption stub for provider storage tests. */
class TestSafeStorage implements SafeStorageLike {
  /** Report encryption availability for the test adapter. */
  public isEncryptionAvailable(): boolean {
    return true;
  }

  /** Encode plaintext into a deterministic non-plaintext test buffer. */
  public encryptString(plainText: string): Buffer {
    return Buffer.from(`encrypted:${Buffer.from(plainText, "utf8").toString("base64")}`, "utf8");
  }

  /** Decode the deterministic test buffer. */
  public decryptString(encrypted: Buffer): string {
    return Buffer.from(encrypted.toString("utf8").replace(/^encrypted:/, ""), "base64").toString("utf8");
  }
}

test("SafeStorageProviderCredentialStore encrypts provider keys and removes them", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-credentials-"));
  const filePath = path.join(directory, "provider-credentials.bin");
  const store = new SafeStorageProviderCredentialStore({
    filePath,
    safeStorage: new TestSafeStorage(),
  });
  try {
    store.write({ "provider-a": "provider-secret-a", "provider-b": "provider-secret-b" });
    const rawFile = readFileSync(filePath, "utf8");
    assert.equal(rawFile.includes("provider-secret-a"), false);
    assert.equal(rawFile.includes("provider-secret-b"), false);
    assert.deepEqual(store.read(), {
      "provider-a": "provider-secret-a",
      "provider-b": "provider-secret-b",
    });
    store.clear();
    assert.deepEqual(store.read(), {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SafeStorageProviderCredentialStore rejects a plaintext Linux backend", () => {
  const store = new SafeStorageProviderCredentialStore({
    filePath: path.join(os.tmpdir(), "openxnet-insecure-provider-credentials.bin"),
    safeStorage: {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => "basic_text",
      encryptString: (plainText) => Buffer.from(plainText),
      decryptString: (encrypted) => encrypted.toString("utf8"),
    },
  });
  assert.equal(store.isAvailable(), false);
  assert.throws(() => store.write({ provider: "secret" }), /encryption is unavailable/);
});
