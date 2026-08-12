import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import test from "node:test";

import { ConnectorChatBrokerGateway } from "./connector-chat-broker-gateway";

test("ConnectorChatBrokerGateway authenticates exact requests with a separate upstream token", async () => {
  const received: Array<{ authorization: string; body: string }> = [];
  const engine = createServer(async (request, response) => {
    received.push({
      authorization: String(request.headers.authorization ?? ""),
      body: await readRequestText(request),
    });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ choices: [] }));
  });
  await listenOnLoopback(engine);
  let activations = 0;
  let releases = 0;
  const gateway = new ConnectorChatBrokerGateway({
    token: "connector-caller-token",
    upstreamToken: "execution-engine-token",
    acquireChatEngine: async () => {
      activations += 1;
      return { origin: serverOrigin(engine), release: () => { releases += 1; } };
    },
  });

  try {
    const origin = await gateway.start();
    const unknown = await fetch(`${origin}/v1/models`, {
      method: "POST",
      headers: { Authorization: "Bearer connector-caller-token" },
      body: "{}",
    });
    const unauthorized = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });
    assert.equal(unknown.status, 404);
    assert.equal(unauthorized.status, 401);
    assert.equal(activations, 0);

    const body = JSON.stringify({
      model: "super-model",
      messages: [{ role: "user", content: "你好" }],
      stream: false,
      behavior_trigger: true,
    });
    const response = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: "Bearer connector-caller-token",
        "Content-Type": "application/json",
      },
      body,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { choices: [] });
    assert.deepEqual(received, [{ authorization: "Bearer execution-engine-token", body }]);
    assert.equal(activations, 1);
    await waitForCondition(() => releases === 1);
  } finally {
    await gateway.stop();
    await closeServer(engine);
  }
});

test("ConnectorChatBrokerGateway preserves bounded UTF-8 streams", async () => {
  const engine = createServer(async (request, response) => {
    await readRequestText(request);
    response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8" });
    response.write("data: 你好\n\n");
    setImmediate(() => response.end("data: [DONE]\n\n"));
  });
  await listenOnLoopback(engine);
  const gateway = new ConnectorChatBrokerGateway({
    token: "connector-stream-token",
    upstreamToken: "engine-stream-token",
    acquireChatEngine: async () => ({ origin: serverOrigin(engine), release: () => undefined }),
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: "Bearer connector-stream-token",
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ role: "user", content: "stream" }], stream: true }),
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "data: 你好\n\ndata: [DONE]\n\n");
  } finally {
    await gateway.stop();
    await closeServer(engine);
  }
});

test("ConnectorChatBrokerGateway rejects invalid input before activation", async () => {
  let activations = 0;
  const gateway = new ConnectorChatBrokerGateway({
    token: "connector-validation-token",
    upstreamToken: "engine-validation-token",
    maxBodyBytes: 128,
    acquireChatEngine: async () => {
      activations += 1;
      return { origin: "http://127.0.0.1:65535", release: () => undefined };
    },
  });

  try {
    const origin = await gateway.start();
    const unknownField = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: "Bearer connector-validation-token" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        api_key: "must-not-cross",
      }),
    });
    const oversized = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: "Bearer connector-validation-token" },
      body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(256) }] }),
    });
    assert.equal(unknownField.status, 422);
    assert.equal(oversized.status, 413);
    assert.equal(activations, 0);
  } finally {
    await gateway.stop();
  }
});

test("ConnectorChatBrokerGateway replaces upstream failures with fixed errors", async () => {
  const engine = createServer(async (request, response) => {
    await readRequestText(request);
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: "provider rejected secret-value" }));
  });
  await listenOnLoopback(engine);
  const gateway = new ConnectorChatBrokerGateway({
    token: "connector-error-token",
    upstreamToken: "engine-error-token",
    acquireChatEngine: async () => ({ origin: serverOrigin(engine), release: () => undefined }),
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: "Bearer connector-error-token" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });
    const payload = await response.text();
    assert.equal(response.status, 422);
    assert.match(payload, /CONNECTOR_CHAT_REJECTED/);
    assert.doesNotMatch(payload, /secret-value/);
  } finally {
    await gateway.stop();
    await closeServer(engine);
  }
});

/** Read one complete UTF-8 request body for proxy assertions. */
async function readRequestText(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Start one test server on an ephemeral loopback port. */
function listenOnLoopback(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

/** Return the exact origin for one listening test server. */
function serverOrigin(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server is not listening on TCP.");
  }
  return `http://127.0.0.1:${address.port}`;
}

/** Close one test server after pending requests complete. */
function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  server.closeAllConnections?.();
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

/** Wait until an asynchronous gateway lifecycle assertion becomes true. */
async function waitForCondition(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for Connector Chat lifecycle state.");
}
