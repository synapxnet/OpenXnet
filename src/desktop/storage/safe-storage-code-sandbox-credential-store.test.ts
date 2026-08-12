import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageCodeSandboxCredentialStore } from "./safe-storage-code-sandbox-credential-store";

/** Deterministic non-plaintext encryption stub for code-sandbox storage tests. */
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

test("Code-sandbox credential store encrypts and restores the E2B key", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-code-sandbox-credentials-"));
  const filePath = path.join(directory, "code-sandbox-credentials.bin");
  const store = new SafeStorageCodeSandboxCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ e2b_api_key: "e2b-secret" });
    assert.equal(readFileSync(filePath, "utf8").includes("e2b-secret"), false);
    assert.deepEqual(store.read(), { e2b_api_key: "e2b-secret" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Code-sandbox credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-code-sandbox-credentials-"));
  try {
    const store = new SafeStorageCodeSandboxCredentialStore({
      filePath: path.join(directory, "code-sandbox.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(() => store.write({ HA_api_key: "wrong-zone" } as never), /field is invalid/);
    const insecure = new SafeStorageCodeSandboxCredentialStore({
      filePath: path.join(directory, "insecure.bin"),
      safeStorage: {
        isEncryptionAvailable: () => true,
        getSelectedStorageBackend: () => "basic_text",
        encryptString: (plainText) => Buffer.from(plainText),
        decryptString: (encrypted) => encrypted.toString("utf8"),
      },
    });
    assert.equal(insecure.isAvailable(), false);
    assert.throws(() => insecure.write({ e2b_api_key: "e2b-secret" }), /encryption is unavailable/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
