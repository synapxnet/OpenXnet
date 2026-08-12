import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

import {
  APPLICATION_CHAT_RESPONSE_SCHEMA,
  APPLICATION_CHAT_STREAM_EVENT_SCHEMA,
  APPLICATION_CHAT_STREAM_SCHEMA,
  type ApplicationChatStreamEvent,
} from "../contracts/application-chat";
import type { ExecutionEngineLease } from "../workers/execution-engine-supervisor";
import { ApplicationChatService } from "./application-chat";

interface RecordedRequest {
  readonly path: string;
  readonly authorization: string;
  readonly body: Readonly<Record<string, unknown>>;
}

/** Read and parse one bounded synthetic HTTP request body. */
async function readRequestBody(request: IncomingMessage): Promise<Readonly<Record<string, unknown>>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Readonly<Record<string, unknown>>;
}

/** Wait until a stream observer receives its terminal event. */
async function waitForTerminalEvent(events: readonly ApplicationChatStreamEvent[]): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!events.some((event) => event.type === "complete" || event.type === "error")) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the synthetic chat stream.");
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

/** Start one loopback server and return its origin and async cleanup function. */
async function startTestServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>,
): Promise<{ readonly origin: string; readonly close: () => Promise<void> }> {
  const server = createServer((request, response) => void handler(request, response));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

/** Create a lease factory that records exact release behavior. */
function createLeaseFactory(origin: string): {
  readonly acquire: () => Promise<ExecutionEngineLease>;
  readonly releaseCounts: number[];
} {
  const releaseCounts: number[] = [];
  return {
    releaseCounts,
    acquire: async () => {
      const index = releaseCounts.push(0) - 1;
      return {
        origin,
        release: () => {
          releaseCounts[index] = (releaseCounts[index] ?? 0) + 1;
        },
      };
    },
  };
}

test("ApplicationChatService forwards bounded commands with private authorization", async () => {
  const requests: RecordedRequest[] = [];
  const server = await startTestServer(async (request, response) => {
    const body = await readRequestBody(request);
    requests.push({
      path: request.url ?? "",
      authorization: String(request.headers.authorization ?? ""),
      body,
    });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, path: request.url }));
  });
  const leases = createLeaseFactory(server.origin);
  const service = new ApplicationChatService({ token: "private-token", acquireEngine: leases.acquire });
  try {
    const completion = await service.complete({
      mode: "simple",
      request: { messages: [{ role: "user", content: "hello" }] },
    });
    const models = await service.listModels();
    const tool = await service.executeTool({
      toolName: "search_tool",
      toolParameters: { query: "desktop" },
      approvalId: "approval-1",
    });
    const approval = await service.resolveApproval({
      approvalId: "approval-1",
      resolution: "approved",
    });

    assert.equal(completion.schema, APPLICATION_CHAT_RESPONSE_SCHEMA);
    assert.equal(completion.statusCode, 200);
    assert.deepEqual(models.body, { ok: true, path: "/v1/models" });
    assert.equal(tool.statusCode, 200);
    assert.equal(approval.statusCode, 200);
    assert.deepEqual(requests.map((request) => request.path), [
      "/simple_chat",
      "/v1/models",
      "/execute_tool_manually",
      "/v1/chat/tools/approval",
    ]);
    assert.ok(requests.every((request) => request.authorization === "Bearer private-token"));
    assert.equal(requests[0]?.body.stream, false);
    assert.deepEqual(requests[2]?.body.tool_params, { query: "desktop" });
    assert.equal(requests[3]?.body.consume, true);
    assert.deepEqual(leases.releaseCounts, [1, 1, 1, 1]);
  } finally {
    service.close();
    await server.close();
  }
});

test("ApplicationChatService preserves stream bytes, order, and lease ownership", async () => {
  const expected = Buffer.from(`data: ${JSON.stringify({ content: "你好, Desktop" })}\n\n`, "utf8");
  const server = await startTestServer(async (request, response) => {
    const body = await readRequestBody(request);
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(body.stream, true);
    response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8" });
    response.write(expected.subarray(0, 9));
    response.end(expected.subarray(9));
  });
  const leases = createLeaseFactory(server.origin);
  const service = new ApplicationChatService({ token: "private-token", acquireEngine: leases.acquire });
  const events: ApplicationChatStreamEvent[] = [];
  const unsubscribe = service.subscribe((event) => events.push(event));
  try {
    const acknowledgement = await service.startStream({
      streamId: "stream-0001",
      mode: "chat",
      request: {
        messages: [{ role: "user", content: "hello" }],
        conversationId: "conversation-1",
      },
    });
    assert.equal(acknowledgement.schema, APPLICATION_CHAT_STREAM_SCHEMA);
    assert.equal(acknowledgement.statusCode, 200);
    await waitForTerminalEvent(events);

    assert.ok(events.every((event) => event.schema === APPLICATION_CHAT_STREAM_EVENT_SCHEMA));
    assert.deepEqual(events.map((event) => event.sequence), events.map((_event, index) => index + 1));
    const actual = Buffer.concat(events
      .filter((event) => event.type === "chunk")
      .map((event) => Buffer.from(event.dataBase64 ?? "", "base64")));
    assert.deepEqual(actual, expected);
    assert.equal(events.at(-1)?.type, "complete");
    assert.deepEqual(leases.releaseCounts, [1]);
  } finally {
    unsubscribe();
    service.close();
    await server.close();
  }
});

test("ApplicationChatService rejects invalid requests before acquiring the engine", async () => {
  let acquisitions = 0;
  const service = new ApplicationChatService({
    token: "private-token",
    acquireEngine: async () => {
      acquisitions += 1;
      throw new Error("Engine must not be acquired.");
    },
  });
  await assert.rejects(
    service.complete({
      mode: "chat",
      request: { messages: [{ role: "user" }], providerSecret: "must-not-cross-ipc" },
    }),
    /provider field 'providerSecret' is not allowed/,
  );
  await assert.rejects(service.abort({}), /requires streamId or conversationId/);
  assert.equal(acquisitions, 0);
  service.close();
});

test("ApplicationChatService rejects oversized responses and releases the lease once", async () => {
  const server = await startTestServer(async (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(Buffer.alloc(2 * 1024 * 1024 + 1, 97));
  });
  const leases = createLeaseFactory(server.origin);
  const service = new ApplicationChatService({ token: "private-token", acquireEngine: leases.acquire });
  try {
    await assert.rejects(service.listModels(), /exceeded its 2 MiB budget/);
    assert.deepEqual(leases.releaseCounts, [1]);
  } finally {
    service.close();
    await server.close();
  }
});

test("ApplicationChatService releases a pre-response stream failure exactly once", async () => {
  const leases = createLeaseFactory("http://127.0.0.1:1");
  const service = new ApplicationChatService({ token: "private-token", acquireEngine: leases.acquire });
  await assert.rejects(service.startStream({
    streamId: "stream-0002",
    mode: "chat",
    request: { messages: [{ role: "user", content: "hello" }] },
  }), /engine request failed/);
  assert.deepEqual(leases.releaseCounts, [1]);
  service.close();
});
