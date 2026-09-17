import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationOllamaRuntimeService } from "./application-ollama-runtime";

function response(value: unknown, status = 200): { status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> } {
  const bytes = Buffer.from(JSON.stringify(value));
  return { status, headers: { get: () => String(bytes.byteLength) }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

test("Ollama runtime discovers version and sanitizes model summaries", async () => {
  const calls: string[] = [];
  const service = new ApplicationOllamaRuntimeService({
    now: () => "2026-09-16T00:00:00.000Z",
    fetch: async (url) => {
      calls.push(url);
      return url.endsWith("/api/version")
        ? response({ version: "0.11.2" })
        : response({ models: [
          { name: "qwen3:8b", size: 12, modified_at: "2026-09-15T00:00:00Z", digest: "abcdef0123456789" },
          { name: "qwen3:8b", size: 99 },
          { name: "bad\u0000name", size: 1 },
        ] });
    },
  });
  const result = await service.discover({});
  assert.equal(result.status, "ready");
  assert.equal(result.version, "0.11.2");
  assert.deepEqual(result.models, [{ name: "qwen3:8b", sizeBytes: 12, modifiedAt: "2026-09-15T00:00:00Z", digest: "abcdef0123456789" }]);
  assert.deepEqual(calls, ["http://127.0.0.1:11434/api/version", "http://127.0.0.1:11434/api/tags"]);
});

test("Ollama runtime rejects remote endpoints and returns offline for connection failures", async () => {
  const service = new ApplicationOllamaRuntimeService({ fetch: async () => { throw new Error("offline"); } });
  await assert.rejects(service.discover({ baseUrl: "https://example.com" }), /loopback/);
  const result = await service.discover(undefined);
  assert.equal(result.status, "offline");
  assert.deepEqual(result.models, []);
  assert.equal(result.version, null);
});
