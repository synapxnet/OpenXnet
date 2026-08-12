import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  SafeStorageCredentialStore,
  type SafeStorageLike,
} from "./safe-storage-credential-store";

/** Deterministic encryption stub used to test the credential file boundary. */
class TestSafeStorage implements SafeStorageLike {
  /** Report encryption availability for the test adapter. */
  public isEncryptionAvailable(): boolean {
    return true;
  }

  /** Encode plaintext into a non-plaintext deterministic test buffer. */
  public encryptString(plainText: string): Buffer {
    return Buffer.from(`encrypted:${Buffer.from(plainText, "utf8").toString("base64")}`, "utf8");
  }

  /** Decode the deterministic test buffer. */
  public decryptString(encrypted: Buffer): string {
    const encoded = encrypted.toString("utf8").replace(/^encrypted:/, "");
    return Buffer.from(encoded, "base64").toString("utf8");
  }
}

test("SafeStorageCredentialStore encrypts, restores, and clears authentication secrets", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-safe-credentials-"));
  const filePath = path.join(directory, "auth-credentials.bin");
  const store = new SafeStorageCredentialStore({ filePath, safeStorage: new TestSafeStorage() });
  try {
    store.write({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      gatewayBootstrap: {
        provider_name: "OpenXnet Gateway",
        vendor: "OpenAI",
        wire_api: "responses",
        requires_openai_auth: true,
        base_url: "https://gateway.example.test/v1",
        api_key: "gateway-secret",
        model_scopes: ["model-a"],
        plan_code: "pro",
      },
    });
    const rawFile = readFileSync(filePath, "utf8");
    assert.equal(rawFile.includes("access-secret"), false);
    assert.equal(rawFile.includes("refresh-secret"), false);
    assert.equal(rawFile.includes("gateway-secret"), false);
    assert.equal(store.read()?.gatewayBootstrap?.api_key, "gateway-secret");
    store.clear();
    assert.equal(store.read(), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SafeStorageCredentialStore rejects the insecure Linux basic_text backend", () => {
  const store = new SafeStorageCredentialStore({
    filePath: path.join(os.tmpdir(), "openxnet-insecure-credentials.bin"),
    safeStorage: {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => "basic_text",
      encryptString: (plainText) => Buffer.from(plainText),
      decryptString: (encrypted) => encrypted.toString("utf8"),
    },
  });
  assert.equal(store.isAvailable(), false);
  assert.throws(
    () => store.write({ accessToken: "secret", refreshToken: "", gatewayBootstrap: null }),
    /encryption is unavailable/,
  );
});
