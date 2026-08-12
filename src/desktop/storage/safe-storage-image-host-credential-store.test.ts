import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageImageHostCredentialStore } from "./safe-storage-image-host-credential-store";

/** Deterministic non-plaintext encryption stub for image-host storage tests. */
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

test("Image-host credential store encrypts and restores exact fields", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-image-host-credentials-"));
  const filePath = path.join(directory, "image-host-credentials.bin");
  const store = new SafeStorageImageHostCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ SMMS_api_key: "smms-secret", EI2_api_key: "easy-image-secret" });
    assert.equal(readFileSync(filePath, "utf8").includes("smms-secret"), false);
    assert.deepEqual(store.read(), {
      SMMS_api_key: "smms-secret",
      EI2_api_key: "easy-image-secret",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Image-host credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-image-host-credentials-"));
  try {
    const store = new SafeStorageImageHostCredentialStore({
      filePath: path.join(directory, "image-host.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(
      () => store.write({ github_token: "wrong-zone" } as never),
      /field is invalid/,
    );
    const insecure = new SafeStorageImageHostCredentialStore({
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
      () => insecure.write({ SMMS_api_key: "smms-secret" }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
