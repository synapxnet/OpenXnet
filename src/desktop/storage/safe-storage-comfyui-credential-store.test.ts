import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageComfyUiCredentialStore } from "./safe-storage-comfyui-credential-store";

/** Deterministic non-plaintext encryption stub for ComfyUI storage tests. */
class TestSafeStorage implements SafeStorageLike {
  /** Report encryption availability for the test adapter. */
  public isEncryptionAvailable(): boolean { return true; }

  /** Encode plaintext into a deterministic encrypted test buffer. */
  public encryptString(plainText: string): Buffer {
    return Buffer.from(`encrypted:${Buffer.from(plainText).toString("base64")}`, "utf8");
  }

  /** Decode the deterministic encrypted test buffer. */
  public decryptString(encrypted: Buffer): string {
    return Buffer.from(
      encrypted.toString("utf8").replace(/^encrypted:/, ""),
      "base64",
    ).toString("utf8");
  }
}

test("ComfyUI credential store encrypts and restores the API key", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-comfyui-credentials-"));
  const filePath = path.join(directory, "comfyui-credentials.bin");
  const store = new SafeStorageComfyUiCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ api_key: "comfyui-secret" });
    assert.equal(readFileSync(filePath, "utf8").includes("comfyui-secret"), false);
    assert.deepEqual(store.read(), { api_key: "comfyui-secret" });
    assert.throws(() => store.write({ HASettings: "wrong-zone" } as never), /field is invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ComfyUI credential store rejects plaintext storage backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-insecure-comfyui-credentials-"));
  const store = new SafeStorageComfyUiCredentialStore({
    filePath: path.join(directory, "insecure.bin"),
    safeStorage: {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => "basic_text",
      encryptString: (plainText) => Buffer.from(plainText),
      decryptString: (encrypted) => encrypted.toString("utf8"),
    },
  });
  try {
    assert.equal(store.isAvailable(), false);
    assert.throws(() => store.write({ api_key: "comfyui-secret" }), /encryption is unavailable/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
