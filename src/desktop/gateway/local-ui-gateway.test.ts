import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalUiGateway } from "./local-ui-gateway";

test("LocalUiGateway serves UTF-8 UI assets before the backend is ready", async () => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-ui-gateway-"));
  const content = "<!doctype html><title>OpenXnet</title><p>桌面界面已就绪</p>";
  await writeFile(path.join(staticRoot, "index.html"), content, "utf8");
  const gateway = new LocalUiGateway({
    staticRoot,
    getBackendOrigin: () => null,
    backendWaitTimeoutMs: 100,
    backendPollIntervalMs: 10,
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(origin);
    const rangeResponse = await fetch(origin, { headers: { Range: "bytes=0-14" } });

    assert.equal(response.status, 200);
    const contentSecurityPolicy = response.headers.get("content-security-policy") ?? "";
    assert.match(contentSecurityPolicy, /object-src 'none'/);
    assert.match(contentSecurityPolicy, /connect-src 'self' data: blob: http: https: ws: wss:/);
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await response.text(), content);
    assert.equal(rangeResponse.status, 206);
    assert.equal((await rangeResponse.arrayBuffer()).byteLength, 15);
  } finally {
    await gateway.stop();
    await rm(staticRoot, { recursive: true, force: true });
  }
});

test("LocalUiGateway serves application artifacts without activating the backend", async () => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-ui-gateway-"));
  const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-artifact-gateway-"));
  await writeFile(path.join(staticRoot, "index.html"), "OpenXnet", "utf8");
  await writeFile(path.join(artifactRoot, "artifact note.txt"), "本地 Artifact", "utf8");
  let activations = 0;
  const gateway = new LocalUiGateway({
    staticRoot,
    artifactRoot,
    getBackendOrigin: () => null,
    activateBackend: async () => {
      activations += 1;
      throw new Error("Backend must not activate for artifacts.");
    },
  });

  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/uploaded_files/artifact%20note.txt`);
    const missing = await fetch(`${origin}/uploaded_files/..%2Fsecret.txt`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "本地 Artifact");
    assert.equal(missing.status, 404);
    assert.equal(activations, 0);
  } finally {
    await gateway.stop();
    await rm(staticRoot, { recursive: true, force: true });
    await rm(artifactRoot, { recursive: true, force: true });
  }
});

test("LocalUiGateway serves nested VR assets without activating the backend", async () => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-ui-gateway-"));
  const vrAssetRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-vr-gateway-"));
  const modelDirectory = path.join(vrAssetRoot, "vrm", "中文模型");
  await mkdir(modelDirectory, { recursive: true });
  await writeFile(path.join(staticRoot, "index.html"), "OpenXnet", "utf8");
  await writeFile(path.join(modelDirectory, "model.vrm"), "vrm model bytes", "utf8");
  let activations = 0;
  const gateway = new LocalUiGateway({
    staticRoot,
    vrAssetRoot,
    getBackendOrigin: () => null,
    activateBackend: async () => {
      activations += 1;
      throw new Error("Backend must not activate for VR assets.");
    },
  });
  try {
    const origin = await gateway.start();
    const response = await fetch(`${origin}/vrm/vrm/%E4%B8%AD%E6%96%87%E6%A8%A1%E5%9E%8B/model.vrm`, {
      headers: { Range: "bytes=0-3" },
    });
    const traversal = await fetch(`${origin}/vrm/safe%2F..%2Fsecret.vrm`);
    const hidden = await fetch(`${origin}/vrm/.private/model.vrm`);
    assert.equal(response.status, 206);
    assert.equal(await response.text(), "vrm ");
    assert.equal(traversal.status, 404);
    assert.equal(hidden.status, 404);
    assert.equal(activations, 0);
  } finally {
    await gateway.stop();
    await rm(staticRoot, { recursive: true, force: true });
    await rm(vrAssetRoot, { recursive: true, force: true });
  }
});

test("LocalUiGateway waits for and streams requests to the legacy backend", async () => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-ui-gateway-"));
  await writeFile(path.join(staticRoot, "index.html"), "OpenXnet", "utf8");
  let backendOrigin: string | null = null;
  const backend = createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ method: request.method, url: request.url }));
  });
  const gateway = new LocalUiGateway({
    staticRoot,
    getBackendOrigin: () => backendOrigin,
    backendWaitTimeoutMs: 2_000,
    backendPollIntervalMs: 10,
  });

  try {
    await listenOnLoopback(backend);
    const address = backend.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, "object");
    const gatewayOrigin = await gateway.start();
    const pendingResponse = fetch(`${gatewayOrigin}/v1/status?source=gateway`);

    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    backendOrigin = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
    const response = await pendingResponse;
    const payload = await response.json() as { method: string; url: string };

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { method: "GET", url: "/v1/status?source=gateway" });
  } finally {
    await gateway.stop();
    await closeServer(backend);
    await rm(staticRoot, { recursive: true, force: true });
  }
});

test("LocalUiGateway activates the backend only for a dynamic request", async () => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-ui-gateway-"));
  await writeFile(path.join(staticRoot, "index.html"), "OpenXnet", "utf8");
  const backend = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ready: true }));
  });
  await listenOnLoopback(backend);
  const backendOrigin = `http://127.0.0.1:${(backend.address() as { port: number }).port}`;
  let activations = 0;
  const gateway = new LocalUiGateway({
    staticRoot,
    getBackendOrigin: () => null,
    activateBackend: async () => {
      activations += 1;
      return backendOrigin;
    },
  });

  try {
    const origin = await gateway.start();
    const staticResponse = await fetch(origin);
    assert.equal(await staticResponse.text(), "OpenXnet");
    assert.equal(activations, 0);
    const apiResponse = await fetch(`${origin}/v1/status`);
    assert.deepEqual(await apiResponse.json(), { ready: true });
    assert.equal(activations, 1);
  } finally {
    await gateway.stop();
    await closeServer(backend);
    await rm(staticRoot, { recursive: true, force: true });
  }
});

test("LocalUiGateway tunnels WebSocket upgrade traffic", async () => {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-ui-gateway-"));
  await writeFile(path.join(staticRoot, "index.html"), "OpenXnet", "utf8");
  const upgradedSockets = new Set<{ destroy(): void }>();
  const backend = createServer();
  backend.on("upgrade", (request, socket) => {
    upgradedSockets.add(socket);
    const key = String(request.headers["sec-websocket-key"] ?? "");
    const accept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"));
  });
  await listenOnLoopback(backend);
  const address = backend.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const backendOrigin = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
  const gateway = new LocalUiGateway({ staticRoot, getBackendOrigin: () => backendOrigin });

  try {
    const gatewayOrigin = await gateway.start();
    const socket = new WebSocket(`${gatewayOrigin.replace("http://", "ws://")}/ws/overlay`);
    await waitForWebSocketOpen(socket);
    assert.equal(socket.readyState, WebSocket.OPEN);
    socket.close();
  } finally {
    for (const socket of upgradedSockets) {
      socket.destroy();
    }
    await gateway.stop();
    await closeServer(backend);
    await rm(staticRoot, { recursive: true, force: true });
  }
});

/** Start an HTTP test server on an ephemeral loopback port. */
function listenOnLoopback(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

/** Close an HTTP test server when it is currently listening. */
function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

/** Wait for a WebSocket client to open or fail within the test deadline. */
function waitForWebSocketOpen(socket: WebSocket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket upgrade timed out.")), 2_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket upgrade failed."));
    }, { once: true });
  });
}
