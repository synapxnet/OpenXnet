import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { ApplicationKernelRuntimeService } from "./application-kernel-runtime";

/** 启动确定性私有 Kernel 引擎；输入 token，返回 origin、请求记录和关闭函数；绑定失败时抛错。 */
async function startKernelEngine(token: string): Promise<{
  readonly origin: string;
  readonly requests: Array<{ readonly path: string; readonly authorization: string; readonly body: unknown }>;
  readonly close: () => Promise<void>;
}> {
  const requests: Array<{ path: string; authorization: string; body: unknown }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    requests.push({
      path: String(request.url || ""),
      authorization: String(request.headers.authorization || ""),
      body,
    });
    const encoded = Buffer.from(JSON.stringify({
      schema: "openxnet.kernel-runtime.v1",
      success: true,
      operation: body.operation,
      data: { ok: true, runtime: { mode: "shadow" } },
    }), "utf8");
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": encoded.length });
    response.end(encoded);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Kernel test engine did not bind.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("Kernel Runtime validates, authenticates and releases one request lease", async () => {
  const token = "kernel-runtime-test-token";
  const engine = await startKernelEngine(token);
  let acquisitions = 0;
  let releases = 0;
  const runtime = new ApplicationKernelRuntimeService({
    token,
    acquireEngine: async () => {
      acquisitions += 1;
      return { origin: engine.origin, release: () => { releases += 1; } };
    },
  });
  try {
    const result = await runtime.invoke({ operation: "runtime", payload: {} });
    assert.equal(result.operation, "runtime");
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)), { ok: true, runtime: { mode: "shadow" } });
    assert.equal(acquisitions, 1);
    assert.equal(releases, 1);
    assert.deepEqual(engine.requests, [{
      path: "/v1/desktop/kernel/command",
      authorization: `Bearer ${token}`,
      body: { operation: "runtime", payload: {} },
    }]);
  } finally {
    await engine.close();
  }
});

test("Kernel Runtime rejects malformed commands before acquiring the engine", async () => {
  let acquisitions = 0;
  const runtime = new ApplicationKernelRuntimeService({
    token: "kernel-runtime-test-token",
    acquireEngine: async () => {
      acquisitions += 1;
      throw new Error("must not activate");
    },
  });
  await assert.rejects(runtime.invoke({ operation: "status", payload: { endpoint: "/private" } }), /fields/i);
  await assert.rejects(runtime.invoke({
    operation: "trace-retry",
    payload: { traceId: "../trace", toolName: "x", toolParams: {}, approvalId: "", reason: "x" },
  }), /invalid/i);
  assert.equal(acquisitions, 0);
});
