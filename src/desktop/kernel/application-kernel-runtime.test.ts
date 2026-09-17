import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { ApplicationKernelRuntimeService } from "./application-kernel-runtime";

/** 启动隔离确定性Kernel替身，返回请求与业务回执。 / Start an isolated deterministic Kernel double with request capture and business receipts. */
async function startKernelEngine(token: string, respond?: (body: Record<string, unknown>) => unknown): Promise<{
  readonly origin: string;
  readonly requests: Array<{ readonly path: string; readonly authorization: string; readonly body: unknown }>;
  readonly close: () => Promise<void>;
}> {
  const requests: Array<{ path: string; authorization: string; body: unknown }> = [];
  const server = createServer(/** 仅处理测试随机端口上的固定请求。 / Handle fixed requests only on the random test port. */ async (request, response) => {
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
      data: respond ? respond(body) : { ok: true, runtime: { mode: "shadow" } },
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

test("guidance uses the existing authenticated fixed route and preserves consumed conflict receipts", /** 四个引导操作复用原生固定通路，业务冲突不伪装成功。 / All four guidance operations reuse the native fixed route, retaining business conflicts accurately. */ async () => {
  const conversationId = "会话".repeat(256);
  const conflict = { ok: false, error: { code: "guidance_conflict", message: "Guidance was already consumed." }, runtime_id: "runtime-1",
    guidance: { guidance_id: "guidance-1", conversation_id: conversationId, state: "consumed", revision: 2 } };
  const engine = await startKernelEngine("guidance-test-token", /** 生成实际公开冲突回执。 / Generate actual public conflict receipts. */ body => body.operation === "guidance-cancel" ? conflict : { ok: true, runtime_id: "runtime-1", conversation_id: conversationId });
  let acquired = 0; let released = 0;
  const runtime = new ApplicationKernelRuntimeService({ token: "guidance-test-token",
    /** 租用隔离替身，记录每次释放。 / Lease the isolated double and record every release. */
    acquireEngine: async () => { acquired++; return { origin: engine.origin,
      /** 释放当前测试请求。 / Release the current test request. */ release: () => { released++; } }; },
  });
  const identity = { conversationId, runtimeId: "runtime-1", requestId: "request-1" };
  try {
    const requests = [
      { operation: "guidance-list", payload: { conversationId } },
      { operation: "guidance-add", payload: { ...identity, text: "补充要求", turnId: "", traceId: "", mode: "soft", priority: 0 } },
      { operation: "guidance-edit", payload: { ...identity, guidanceId: "guidance-1", expectedRevision: 1, text: "更详细地解释", mode: "constraint", priority: 10 } },
      { operation: "guidance-cancel", payload: { ...identity, guidanceId: "guidance-1", expectedRevision: 1 } },
    ];
    for (const request of requests) {
      const result = await runtime.invoke(request);
      if (request.operation === "guidance-cancel") assert.deepEqual(JSON.parse(JSON.stringify(result.data)), conflict);
    }
    assert.equal(acquired, 4); assert.equal(released, 4);
    assert.deepEqual(engine.requests.map(/** 只检查固定授权路径。 / Inspect fixed authorized paths only. */ request => ({ path: request.path, authorization: request.authorization })),
      requests.map(/** 所有引导操作共用一个路径和凭据。 / All guidance operations share one path and credential. */ () => ({ path: "/v1/desktop/kernel/command", authorization: "Bearer guidance-test-token" })));
    assert.deepEqual(engine.requests.map(/** 保留实际身份和修订字段。 / Retain actual identity and revision fields. */ request => request.body), requests);
    await assert.rejects(runtime.invoke({ operation: "guidance-cancel", payload: { ...requests[3]!.payload, conversationId: " c1" } }), /invalid/i);
    assert.equal(acquired, 4);
  } finally { await engine.close(); }
});
