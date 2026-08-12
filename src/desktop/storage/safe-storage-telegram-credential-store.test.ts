import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageTelegramCredentialStore } from "./safe-storage-telegram-credential-store";

/** Deterministic non-plaintext encryption stub for Telegram storage tests. */
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

test("Telegram credential store encrypts and restores the Bot token", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-telegram-credentials-"));
  const filePath = path.join(directory, "telegram-credentials.bin");
  const store = new SafeStorageTelegramCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ botToken: "123456:telegram-secret" });
    assert.equal(readFileSync(filePath, "utf8").includes("telegram-secret"), false);
    assert.deepEqual(store.read(), { botToken: "123456:telegram-secret" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Telegram credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-telegram-credentials-"));
  try {
    const store = new SafeStorageTelegramCredentialStore({
      filePath: path.join(directory, "telegram.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(
      () => store.write({ botToken: "123456:secret", extra: "unknown" } as never),
      /credentials are invalid/,
    );
    const insecure = new SafeStorageTelegramCredentialStore({
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
      () => insecure.write({ botToken: "123456:telegram-secret" }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
