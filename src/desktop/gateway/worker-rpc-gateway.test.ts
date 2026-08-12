import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DesktopCore } from "../core/desktop-core";
import { registerWorkerCapability } from "../core/register-worker-capability";
import { WorkerSupervisor } from "../workers/worker-supervisor";
import { WorkerRpcGateway } from "./worker-rpc-gateway";

test("WorkerRpcGateway authenticates and dispatches allow-listed requests", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-worker-rpc-"));
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const token = "test-worker-token";
  await core.start();
  const unsubscribe = registerWorkerCapability({
    core,
    supervisor,
    definition: {
      capability: "voice",
      command: process.env.PYTHON_EXECUTABLE ?? "python",
      arguments: ["-m", "py.workers.demo_worker", "--capability", "voice"],
      workingDirectory: process.cwd(),
      requestTimeoutMs: 5_000,
      shutdownTimeoutMs: 2_000,
    },
  });
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token,
    allowedMethods: { voice: ["echo"] },
  });

  try {
    const origin = await gateway.start();
    const unauthorized = await fetch(`${origin}/v1/workers/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capability: "voice", method: "echo", payload: {} }),
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${origin}/v1/workers/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capability: "voice",
        method: "echo",
        payload: { text: "你好，Voice Worker" },
      }),
    });
    const body = await authorized.json() as { ok: boolean; payload: { echo: { text: string } } };
    assert.equal(authorized.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.payload.echo.text, "你好，Voice Worker");
  } finally {
    await gateway.stop();
    unsubscribe();
    await supervisor.stopAll();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("WorkerRpcGateway rejects methods outside the allow-list", async () => {
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  await core.start();
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "test-worker-token",
    allowedMethods: { voice: ["voice.status"] },
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/v1/workers/request`, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-worker-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ capability: "voice", method: "voice.transcribe", payload: {} }),
    });
    assert.equal(response.status, 400);
  } finally {
    await gateway.stop();
  }
});
