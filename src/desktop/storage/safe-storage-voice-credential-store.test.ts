import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SafeStorageVoiceCredentialStore } from "./safe-storage-voice-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Deterministic non-plaintext encryption stub for voice credential tests. */
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

test("SafeStorageVoiceCredentialStore encrypts, restores, and clears scoped secrets", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-voice-credentials-"));
  const filePath = path.join(directory, "voice-credentials.bin");
  const store = new SafeStorageVoiceCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({
      default: { azureSpeechKey: "azure-secret" },
      Narrator: { fishApiKey: "fish-secret" },
    });
    const rawFile = readFileSync(filePath, "utf8");
    assert.equal(rawFile.includes("azure-secret"), false);
    assert.equal(rawFile.includes("fish-secret"), false);
    assert.deepEqual(store.read(), {
      default: { azureSpeechKey: "azure-secret" },
      Narrator: { fishApiKey: "fish-secret" },
    });
    store.clear();
    assert.deepEqual(store.read(), {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SafeStorageVoiceCredentialStore rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-voice-credentials-"));
  const store = new SafeStorageVoiceCredentialStore({
    filePath: path.join(directory, "voice-credentials.bin"),
    safeStorage: new TestSafeStorage(),
  });
  try {
    assert.throws(
      () => store.write({ default: { unknown: "secret" } } as never),
      /field is invalid/,
    );
    const insecure = new SafeStorageVoiceCredentialStore({
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
      () => insecure.write({ default: { azureSpeechKey: "secret" } }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
