import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageRepositoryCredentialStore } from "./safe-storage-repository-credential-store";

/** Deterministic non-plaintext encryption stub for repository storage tests. */
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

test("Repository credential store encrypts and restores exact fields", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-repository-credentials-"));
  const filePath = path.join(directory, "repository-credentials.bin");
  const store = new SafeStorageRepositoryCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ gitee_token: "gitee-secret", github_token: "github-secret" });
    assert.equal(readFileSync(filePath, "utf8").includes("gitee-secret"), false);
    assert.deepEqual(store.read(), {
      gitee_token: "gitee-secret",
      github_token: "github-secret",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Repository credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-repository-credentials-"));
  try {
    const store = new SafeStorageRepositoryCredentialStore({
      filePath: path.join(directory, "repository.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(
      () => store.write({ SMMS_api_key: "wrong-zone" } as never),
      /field is invalid/,
    );
    const insecure = new SafeStorageRepositoryCredentialStore({
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
      () => insecure.write({ github_token: "github-secret" }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
