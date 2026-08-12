import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SafeStorageSearchCredentialStore } from "./safe-storage-search-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Deterministic non-plaintext encryption stub for search credential tests. */
class TestSafeStorage implements SafeStorageLike {
  /** Report encryption availability for the test adapter. */
  public isEncryptionAvailable(): boolean {
    return true;
  }

  /** Encode plaintext into a deterministic encrypted test buffer. */
  public encryptString(plainText: string): Buffer {
    return Buffer.from(`encrypted:${Buffer.from(plainText).toString("base64")}`, "utf8");
  }

  /** Decode the deterministic encrypted test buffer. */
  public decryptString(encrypted: Buffer): string {
    return Buffer.from(encrypted.toString("utf8").replace(/^encrypted:/, ""), "base64").toString("utf8");
  }
}

test("SafeStorageSearchCredentialStore encrypts, restores, and clears search keys", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-search-credentials-"));
  const filePath = path.join(directory, "search-credentials.bin");
  const store = new SafeStorageSearchCredentialStore({
    filePath,
    safeStorage: new TestSafeStorage(),
  });
  try {
    store.write({ tavily: "tavily-secret", google: "google-secret" });
    const rawFile = readFileSync(filePath, "utf8");
    assert.equal(rawFile.includes("tavily-secret"), false);
    assert.equal(rawFile.includes("google-secret"), false);
    assert.deepEqual(store.read(), { tavily: "tavily-secret", google: "google-secret" });
    store.clear();
    assert.deepEqual(store.read(), {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SafeStorageSearchCredentialStore rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-search-credentials-"));
  const store = new SafeStorageSearchCredentialStore({
    filePath: path.join(directory, "search-credentials.bin"),
    safeStorage: new TestSafeStorage(),
  });
  try {
    assert.throws(() => store.write({ unknown: "secret" } as never), /entry is invalid/);
    const insecure = new SafeStorageSearchCredentialStore({
      filePath: path.join(directory, "insecure.bin"),
      safeStorage: {
        isEncryptionAvailable: () => true,
        getSelectedStorageBackend: () => "basic_text",
        encryptString: (plainText) => Buffer.from(plainText),
        decryptString: (encrypted) => encrypted.toString("utf8"),
      },
    });
    assert.equal(insecure.isAvailable(), false);
    assert.throws(() => insecure.write({ tavily: "secret" }), /encryption is unavailable/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
