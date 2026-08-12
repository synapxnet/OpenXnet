import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SafeStorageHttpToolCredentialStore } from "./safe-storage-http-tool-credential-store";
import { SafeStorageMcpCredentialStore } from "./safe-storage-mcp-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Deterministic non-plaintext encryption stub for tool credential tests. */
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

test("tool credential stores encrypt independent MCP and custom HTTP files", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-tool-credentials-"));
  const mcpPath = path.join(directory, "mcp-credentials.bin");
  const httpPath = path.join(directory, "http-tool-credentials.bin");
  const safeStorage = new TestSafeStorage();
  const mcp = new SafeStorageMcpCredentialStore({ filePath: mcpPath, safeStorage });
  const http = new SafeStorageHttpToolCredentialStore({ filePath: httpPath, safeStorage });
  try {
    mcp.write({ alpha: { env: { TOKEN: "mcp-secret" } } });
    http.write({ weather: { Authorization: "http-secret" } });
    assert.equal(readFileSync(mcpPath, "utf8").includes("mcp-secret"), false);
    assert.equal(readFileSync(httpPath, "utf8").includes("http-secret"), false);
    assert.deepEqual(mcp.read(), { alpha: { env: { TOKEN: "mcp-secret" } } });
    assert.deepEqual(http.read(), { weather: { Authorization: "http-secret" } });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("tool credential stores reject unknown fields and plaintext backends", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-invalid-tool-credentials-"));
  const safeStorage = new TestSafeStorage();
  const mcp = new SafeStorageMcpCredentialStore({
    filePath: path.join(directory, "mcp.bin"),
    safeStorage,
  });
  try {
    assert.throws(() => mcp.write({ alpha: { unknown: { key: "value" } } } as never), /entry is invalid/);
    const insecure = new SafeStorageHttpToolCredentialStore({
      filePath: path.join(directory, "http.bin"),
      safeStorage: {
        isEncryptionAvailable: () => true,
        getSelectedStorageBackend: () => "basic_text",
        encryptString: (plainText) => Buffer.from(plainText),
        decryptString: (encrypted) => encrypted.toString("utf8"),
      },
    });
    assert.equal(insecure.isAvailable(), false);
    assert.throws(
      () => insecure.write({ weather: { Authorization: "secret" } }),
      /encryption is unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
