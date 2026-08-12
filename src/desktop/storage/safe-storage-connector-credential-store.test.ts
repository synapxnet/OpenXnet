import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageConnectorCredentialStore } from "./safe-storage-connector-credential-store";

/** Deterministic non-plaintext encryption stub for Connector Worker storage tests. */
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

test("Connector Worker credential store encrypts and restores exact fields", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-connector-credentials-"));
  const filePath = path.join(directory, "connector-credentials.bin");
  const store = new SafeStorageConnectorCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({ slack: { bot_token: "xoxb-secret", app_token: "xapp-secret" } });
    assert.equal(readFileSync(filePath, "utf8").includes("xoxb-secret"), false);
    assert.deepEqual(store.read(), {
      slack: { bot_token: "xoxb-secret", app_token: "xapp-secret" },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Connector Worker credential store rejects unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-connector-credentials-"));
  try {
    const store = new SafeStorageConnectorCredentialStore({
      filePath: path.join(directory, "connector.bin"),
      safeStorage: new TestSafeStorage(),
    });
    assert.throws(
      () => store.write({ slack: { signing_secret: "unknown-secret" } } as never),
      /field is invalid/,
    );
    const insecure = new SafeStorageConnectorCredentialStore({
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
      () => insecure.write({ qq: { secret: "qq-secret" } }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
