import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import test from "node:test";

import { TaskExecutionBrokerGateway } from "./task-execution-broker-gateway";

test("TaskExecutionBrokerGateway authenticates exact routes before lazy activation", async () => {
  const received: Array<{ path: string; authorization: string; body: string }> = [];
  const backend = createServer(async (request, response) => {
    received.push({
      path: request.url ?? "",
      authorization: String(request.headers.authorization ?? ""),
      body: await readRequestText(request),
    });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ready: true }));
  });
  await listenOnLoopback(backend);
  const backendOrigin = serverOrigin(backend);
  let activations = 0;
  let releases = 0;
  const gateway = new TaskExecutionBrokerGateway({
    token: "task-test-token",
    acquireProviderEngine: async () => {
      activations += 1;
      return {
        origin: backendOrigin,
        release: () => {
          releases += 1;
        },
      };
    },
  });

  try {
    const origin = await gateway.start();
    const unknown = await fetch(`${origin}/v1/tasks/executor/unknown`, {
      method: "POST",
      headers: { Authorization: "Bearer task-test-token" },
    });
    const unauthorized = await fetch(`${origin}/v1/tasks/executor/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(unknown.status, 404);
    assert.equal(unauthorized.status, 401);
    assert.equal(activations, 0);

    const response = await fetch(`${origin}/v1/tasks/executor/preflight`, {
      method: "POST",
      headers: {
        Authorization: "Bearer task-test-token",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ schema: "test", prompt: "你好" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ready: true });
    assert.equal(activations, 1);
    assert.deepEqual(received, [{
      path: "/v1/tasks/executor/preflight",
      authorization: "Bearer task-test-token",
      body: JSON.stringify({ schema: "test", prompt: "你好" }),
    }]);
    await waitForCondition(() => releases === 1);
  } finally {
    await gateway.stop();
    await closeServer(backend);
  }
});

test("TaskExecutionBrokerGateway preserves streamed session events", async () => {
  const backend = createServer(async (request, response) => {
    await readRequestText(request);
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.write("data: first\n\n");
    setImmediate(() => response.end("data: done\n\n"));
  });
  await listenOnLoopback(backend);
  const gateway = new TaskExecutionBrokerGateway({
    token: "stream-test-token",
    acquireProviderEngine: async () => ({ origin: serverOrigin(backend), release: () => undefined }),
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/v1/tasks/executor/session/turn`, {
      method: "POST",
      headers: {
        Authorization: "Bearer stream-test-token",
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/event-stream/);
    assert.equal(await response.text(), "data: first\n\ndata: done\n\n");
  } finally {
    await gateway.stop();
    await closeServer(backend);
  }
});

test("TaskExecutionBrokerGateway rejects oversized bodies without activation", async () => {
  let activations = 0;
  const gateway = new TaskExecutionBrokerGateway({
    token: "size-test-token",
    maxBodyBytes: 16,
    acquireProviderEngine: async () => {
      activations += 1;
      return { origin: "http://127.0.0.1:65535", release: () => undefined };
    },
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/v1/tasks/executor/session/evaluate`, {
      method: "POST",
      headers: {
        Authorization: "Bearer size-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "request exceeds the configured limit" }),
    });
    const payload = await response.json() as { code: string };
    assert.equal(response.status, 413);
    assert.equal(payload.code, "REQUEST_TOO_LARGE");
    assert.equal(activations, 0);
  } finally {
    await gateway.stop();
  }
});

test("TaskExecutionBrokerGateway injects one Main credential only on exact delivery requests", async () => {
  const received = new Map<string, Record<string, unknown>>();
  const backend = createServer(async (request, response) => {
    received.set(
      request.url ?? "",
      JSON.parse(await readRequestText(request)) as Record<string, unknown>,
    );
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ready: true }));
  });
  await listenOnLoopback(backend);
  const resolvedScopes: Readonly<Record<string, unknown>>[] = [];
  let activations = 0;
  const gateway = new TaskExecutionBrokerGateway({
    token: "delivery-boundary-token",
    acquireProviderEngine: async () => {
      activations += 1;
      return { origin: serverOrigin(backend), release: () => undefined };
    },
    resolveDeliveryCredentialBootstrap: (scope) => {
      resolvedScopes.push(scope);
      return "main-owned-envelope";
    },
  });
  const requestPayload = {
    workspacePath: "C:\\workspace",
    taskId: "task-1",
    target: "webhook",
  };
  try {
    const origin = await gateway.start();
    const paths = [
      "/v1/tasks/executor/preflight",
      "/v1/tasks/executor/session/turn",
      "/v1/tasks/executor/session/evaluate",
      "/v1/tasks/executor/session/cancel",
      "/v1/tasks/executor/delivery/dispatch",
    ];
    for (const pathname of paths) {
      const response = await fetch(`${origin}${pathname}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer delivery-boundary-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      assert.equal(response.status, 200);
    }
    for (const pathname of paths.slice(0, -1)) {
      assert.deepEqual(received.get(pathname), requestPayload);
    }
    assert.deepEqual(received.get(paths.at(-1) ?? ""), {
      ...requestPayload,
      deliveryCredentialBootstrap: "main-owned-envelope",
    });
    assert.deepEqual(resolvedScopes, [requestPayload]);

    const workerSupplied = await fetch(`${origin}/v1/tasks/executor/delivery/dispatch`, {
      method: "POST",
      headers: {
        Authorization: "Bearer delivery-boundary-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...requestPayload,
        deliveryCredentialBootstrap: "worker-controlled-envelope",
      }),
    });
    assert.equal(workerSupplied.status, 503);
    assert.equal(activations, paths.length);
    assert.deepEqual(resolvedScopes, [requestPayload]);
  } finally {
    await gateway.stop();
    await closeServer(backend);
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

/** Return the exact loopback origin for one listening test server. */
function serverOrigin(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server is not listening on TCP.");
  }
  return `http://127.0.0.1:${address.port}`;
}

/** Close one test server when it is listening. */
function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  server.closeAllConnections?.();
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

/** Wait until one asynchronous proxy lifecycle assertion becomes true. */
async function waitForCondition(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for gateway lifecycle condition.");
}
