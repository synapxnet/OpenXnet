import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutionEngineSupervisor,
  type ExecutionEngineState,
} from "./execution-engine-supervisor";

const ENGINE_SOURCE = String.raw`
const http = require("node:http");
const token = "execution-engine-test-token";
const server = http.createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }
  if (request.headers.authorization !== "Bearer " + token) {
    response.writeHead(401).end();
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end('{"status":"ready"}');
});
server.listen(0, "127.0.0.1", () => {
  process.stdout.write("REAL_PORT_FOUND:" + server.address().port + "\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

test("ExecutionEngineSupervisor coalesces startup and holds idle shutdown with leases", async () => {
  const states: ExecutionEngineState[] = [];
  const supervisor = new ExecutionEngineSupervisor({
    token: "execution-engine-test-token",
    createLaunch: () => ({
      command: process.execPath,
      arguments: ["-e", ENGINE_SOURCE],
    }),
    startupTimeoutMs: 5_000,
    shutdownTimeoutMs: 2_000,
    idleTimeoutMs: 100,
  });
  const unsubscribe = supervisor.subscribe((snapshot) => states.push(snapshot.state));

  try {
    const [first, second] = await Promise.all([supervisor.acquire(), supervisor.acquire()]);
    assert.equal(first.origin, second.origin);
    assert.equal(supervisor.getSnapshot().state, "ready");
    assert.equal(supervisor.getSnapshot().activeRequests, 2);

    first.release();
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    assert.equal(supervisor.getSnapshot().state, "ready");
    assert.equal(supervisor.getSnapshot().activeRequests, 1);

    second.release();
    await waitForState(supervisor, "stopped");
    assert.ok(states.includes("starting"));
    assert.ok(states.includes("ready"));
    assert.ok(states.includes("stopping"));
    assert.equal(supervisor.getSnapshot().processId, null);
  } finally {
    unsubscribe();
    await supervisor.stop();
  }
});

test("ExecutionEngineSupervisor reports authentication failure without exposing its token", async () => {
  const supervisor = new ExecutionEngineSupervisor({
    token: "wrong-test-token",
    createLaunch: () => ({
      command: process.execPath,
      arguments: ["-e", ENGINE_SOURCE],
    }),
    startupTimeoutMs: 500,
    shutdownTimeoutMs: 1_000,
    idleTimeoutMs: 0,
  });

  await assert.rejects(supervisor.start(), /health check timed out/i);
  assert.equal(supervisor.getSnapshot().state, "error");
  assert.doesNotMatch(supervisor.getSnapshot().error ?? "", /wrong-test-token/);
  await supervisor.stop();
});

/** Wait until the supervisor reaches one expected lifecycle state. */
async function waitForState(
  supervisor: ExecutionEngineSupervisor,
  expectedState: ExecutionEngineState,
): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if (supervisor.getSnapshot().state === expectedState) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for Execution Engine state '${expectedState}'.`);
}
