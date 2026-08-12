"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  DesktopCore,
  FeaturePackManager,
  registerFeaturePackWorker,
  WorkerRpcGateway,
  WorkerSupervisor,
} = require("../build-ts/desktop");

/**
 * Resolve the feature-pack directory supplied to the smoke command.
 *
 * @returns {string} Absolute feature-pack source directory.
 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error("Usage: node scripts/smoke_document_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/**
 * Send one authenticated request through the Worker RPC Gateway.
 *
 * @param {string} origin Bound loopback gateway origin.
 * @param {string} method Allow-listed Document Worker method.
 * @param {Record<string, unknown>} payload Serializable control payload.
 * @returns {Promise<Record<string, unknown>>} Successful Worker payload.
 */
async function requestWorker(origin, method, payload) {
  const response = await fetch(`${origin}/v1/workers/request`, {
    method: "POST",
    headers: {
      Authorization: "Bearer document-pack-smoke-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capability: "documents", method, payload }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body?.payload !== "object") {
    throw new Error(`Packaged Document Worker request failed: ${JSON.stringify(body)}`);
  }
  return body.payload;
}

/**
 * Install, activate, and exercise one packaged RTF extraction.
 *
 * @returns {Promise<void>} Completion after the isolated smoke workspace is removed.
 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-document-pack-smoke-"));
  const exchangeRoot = path.join(temporaryRoot, "exchange");
  const inputPath = path.join(exchangeRoot, "sample.rtf");
  const resultPath = path.join(exchangeRoot, "result.txt");
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "document-pack-smoke-token",
    allowedMethods: {
      documents: ["documents.status", "documents.extract"],
    },
  });
  let unsubscribe = null;

  try {
    await fs.mkdir(exchangeRoot, { recursive: true });
    await fs.writeFile(inputPath, "{\\rtf1\\ansi Packaged document text}", "utf8");
    await fs.writeFile(resultPath, "", "utf8");
    await core.start();
    const origin = await gateway.start();
    await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "documents",
      createDefinition: (pack) => ({
        capability: "documents",
        command: pack.entrypointPath,
        arguments: ["--exchange-root", exchangeRoot],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          OPENXNET_DOCUMENT_EXCHANGE_DIR: exchangeRoot,
        },
        requestTimeoutMs: 30_000,
        shutdownTimeoutMs: 3_000,
      }),
    });
    if (unsubscribe === null) {
      throw new Error("Installed Document feature pack was not discovered.");
    }

    const status = await requestWorker(origin, "documents.status", {});
    const extraction = await requestWorker(origin, "documents.extract", {
      artifactPath: inputPath,
      resultArtifactPath: resultPath,
      format: "rtf",
    });
    const text = await fs.readFile(resultPath, "utf8");
    if (status?.dependencies?.rtf !== true || !text.includes("Packaged document text")) {
      throw new Error(
        `Packaged Document Worker validation failed: ${JSON.stringify({ status, extraction, text })}`,
      );
    }
    process.stdout.write(`${JSON.stringify({ status, extraction, text }, null, 2)}\n`);
  } finally {
    unsubscribe?.();
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
