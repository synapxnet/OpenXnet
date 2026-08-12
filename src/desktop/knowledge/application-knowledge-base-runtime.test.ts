import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { ApplicationKnowledgeBaseRuntimeService } from "./application-knowledge-base-runtime";

/** 启动确定性私有引擎；输入 token，返回 origin、请求记录和关闭函数。 */
async function startTestEngine(token: string): Promise<{
  readonly origin: string;
  readonly requests: Array<{ path: string; authorization: string; body: unknown }>;
  readonly close: () => Promise<void>;
}> {
  const requests: Array<{ path: string; authorization: string; body: unknown }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    const path = String(request.url || "");
    requests.push({
      path,
      authorization: String(request.headers.authorization || ""),
      body,
    });
    const knowledgeBaseId = String(body.knowledgeBaseId || "");
    const payload = path.endsWith("/remove")
      ? {
          schema: "openxnet.knowledge-base-mutation.v1",
          knowledgeBaseId,
          success: true,
          removed: true,
        }
      : path.endsWith("/query")
        ? {
            schema: "openxnet.knowledge-base-query.v1",
            knowledgeBaseId,
            query: body.query,
            count: 1,
            results: [{
              id: `${knowledgeBaseId}:0`,
              content: "runtime result",
              summary: "runtime result",
              fileName: "guide.md",
              metadata: { file_path: "guide.md", doc_id: "doc-1" },
            }],
          }
        : {
            schema: "openxnet.knowledge-base-status.v1",
            knowledgeBaseId,
            status: path.endsWith("/build") ? "completed" : "not_found",
          };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": encoded.length,
    });
    response.end(encoded);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test engine did not bind.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("knowledge base Runtime holds one lease and forwards only validated metadata", async () => {
  const token = "knowledge-base-runtime-test-token";
  const engine = await startTestEngine(token);
  let acquisitions = 0;
  let releases = 0;
  const runtime = new ApplicationKnowledgeBaseRuntimeService({
    token,
    acquireEngine: async () => {
      acquisitions += 1;
      return { origin: engine.origin, release: () => { releases += 1; } };
    },
  });
  try {
    const build = await runtime.build({ knowledgeBaseId: "kb-one" });
    const status = await runtime.status({ knowledgeBaseId: "kb-one" });
    const query = await runtime.query({ knowledgeBaseId: "kb-one", query: "runtime", limit: 5 });
    const removed = await runtime.remove({ knowledgeBaseId: "kb-one" });

    assert.equal(build.status, "completed");
    assert.equal(status.status, "not_found");
    assert.equal(query.results[0]?.fileName, "guide.md");
    assert.equal(removed.removed, true);
    assert.equal(acquisitions, 4);
    assert.equal(releases, 4);
    assert.deepEqual(engine.requests.map((request) => request.path), [
      "/v1/desktop/knowledge-base/build",
      "/v1/desktop/knowledge-base/status",
      "/v1/desktop/knowledge-base/query",
      "/v1/desktop/knowledge-base/remove",
    ]);
    assert.ok(engine.requests.every((request) => request.authorization === `Bearer ${token}`));
    assert.ok(engine.requests.every((request) => !JSON.stringify(request.body).includes("path")));
  } finally {
    await engine.close();
  }
});

test("knowledge base Runtime rejects malformed requests before engine activation", async () => {
  let acquisitions = 0;
  const runtime = new ApplicationKnowledgeBaseRuntimeService({
    token: "knowledge-base-runtime-test-token",
    acquireEngine: async () => {
      acquisitions += 1;
      throw new Error("must not activate");
    },
  });

  await assert.rejects(runtime.status({ knowledgeBaseId: "../escape" }), /identifier/i);
  await assert.rejects(runtime.query({ knowledgeBaseId: "kb-one", query: "", limit: 5 }), /query/i);
  assert.equal(acquisitions, 0);
});
