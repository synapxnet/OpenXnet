"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  DesktopCore,
  FeaturePackManager,
  registerFeaturePackWorker,
  registerWorkerCapability,
  WorkerRpcGateway,
  WorkerSupervisor,
} = require("../build-ts/desktop");

/**
 * Resolve the Connector feature-pack directory supplied to the smoke command.
 *
 * @returns {string} Absolute feature-pack source directory.
 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error("Usage: node scripts/smoke_connector_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/**
 * Send one authenticated request through the Worker RPC Gateway.
 *
 * @param {string} origin Bound loopback gateway origin.
 * @param {string} method Allow-listed Connector Worker method.
 * @param {Record<string, unknown>} payload Serializable control payload.
 * @returns {Promise<Record<string, unknown>>} Successful Worker payload.
 */
async function requestWorker(origin, method, payload) {
  const response = await fetch(`${origin}/v1/workers/request`, {
    method: "POST",
    headers: {
      Authorization: "Bearer connector-pack-smoke-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capability: "connectors", method, payload }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body?.payload !== "object") {
    throw new Error(`Packaged Connector Worker request failed: ${JSON.stringify(body)}`);
  }
  return body.payload;
}

/**
 * Install and exercise packaged SDK imports without using live credentials.
 *
 * @returns {Promise<void>} Completion after the isolated smoke workspace is removed.
 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-connector-pack-smoke-"));
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "connector-pack-smoke-token",
    allowedMethods: {
      connectors: ["connectors.dependencies", "connectors.status"],
    },
  });
  let unsubscribeBackend = null;
  let unsubscribeConnectors = null;

  try {
    await core.start();
    const origin = await gateway.start();
    unsubscribeBackend = registerWorkerCapability({
      core,
      supervisor,
      definition: {
        capability: "legacy-backend",
        command: process.env.PYTHON_EXECUTABLE ?? "python",
        arguments: ["-m", "py.workers.demo_worker", "--capability", "legacy-backend"],
        workingDirectory: path.resolve(__dirname, ".."),
        requestTimeoutMs: 5_000,
        shutdownTimeoutMs: 2_000,
      },
    });
    await manager.installFromDirectory(packDirectory);
    unsubscribeConnectors = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "connectors",
      createDefinition: (pack) => ({
        capability: "connectors",
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          OPENXNET_RUNTIME_ROLE: "connector-worker",
          OPENXNET_USER_DATA_DIR: temporaryRoot,
        },
        requestTimeoutMs: 60_000,
        shutdownTimeoutMs: 15_000,
        idleTimeoutMs: 0,
      }),
    });
    if (unsubscribeConnectors === null) {
      throw new Error("Installed Connector feature pack was not discovered.");
    }

    const dependencies = await requestWorker(origin, "connectors.dependencies", {});
    const statuses = {};
    for (const platformName of ["qq", "feishu", "dingtalk", "discord", "slack", "telegram"]) {
      statuses[platformName] = await requestWorker(origin, "connectors.status", {
        platform: platformName,
      });
    }
    const unavailable = Object.entries(dependencies.dependencies ?? {})
      .filter(([, available]) => available !== true)
      .map(([platformName]) => platformName);
    if (unavailable.length > 0) {
      throw new Error(`Packaged connector SDKs are unavailable: ${unavailable.join(", ")}`);
    }
    if (Object.values(statuses).some((status) => status?.is_running !== false)) {
      throw new Error(`Unexpected packaged Connector statuses: ${JSON.stringify(statuses)}`);
    }
    process.stdout.write(`${JSON.stringify({ dependencies, statuses }, null, 2)}\n`);
  } finally {
    unsubscribeConnectors?.();
    unsubscribeBackend?.();
    await gateway.stop();
    await supervisor.stopAll();
    await core.stop();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
