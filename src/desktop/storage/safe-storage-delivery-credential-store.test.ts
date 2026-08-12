import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createApplicationDeliveryCredentialScopeId } from "../contracts/application-delivery-credentials";
import type { SafeStorageLike } from "./safe-storage-credential-store";
import { SafeStorageDeliveryCredentialStore } from "./safe-storage-delivery-credential-store";

/** Deterministic non-plaintext encryption stub for delivery storage tests. */
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

test("delivery credential store encrypts and restores scoped secrets", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-delivery-credentials-"));
  const filePath = path.join(directory, "delivery-credentials.bin");
  const store = new SafeStorageDeliveryCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  const scope = { workspacePath: directory, taskId: "task-1", target: "webhook" } as const;
  const scopeId = createApplicationDeliveryCredentialScopeId(scope);
  try {
    store.write({
      [scopeId]: {
        scope,
        credentials: {
          url: "https://hooks.example.test/task-1",
          headers: { Authorization: "Bearer delivery-secret" },
        },
      },
    });
    const encrypted = readFileSync(filePath, "utf8");
    assert.equal(encrypted.includes("delivery-secret"), false);
    assert.equal(store.read()[scopeId]?.credentials.headers?.authorization, "Bearer delivery-secret");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("delivery credential store rejects plaintext storage backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-insecure-delivery-credentials-"));
  const store = new SafeStorageDeliveryCredentialStore({
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
    assert.throws(() => store.write({}), /encryption is unavailable/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
