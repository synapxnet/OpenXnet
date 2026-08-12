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
    throw new Error("Usage: node scripts/smoke_vector_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/**
 * Resolve an optional external model root used for real inference validation.
 *
 * @returns {string|null} Absolute model root, or null for status-only smoke.
 */
function resolveModelRoot() {
  const argument = process.argv[3];
  return argument ? path.resolve(argument) : null;
}

/**
 * Send one authenticated allow-listed Worker RPC request.
 *
 * @param {string} origin Bound Worker RPC origin.
 * @param {string} method Vector Worker method name.
 * @param {Record<string, unknown>} payload Serializable control payload.
 * @returns {Promise<Record<string, unknown>>} Successful Worker payload.
 */
async function requestWorker(origin, method, payload) {
  const response = await fetch(`${origin}/v1/workers/request`, {
    method: "POST",
    headers: {
      Authorization: "Bearer vector-pack-smoke-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capability: "vector-index", method, payload }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body?.payload !== "object") {
    throw new Error(`Packaged Vector Worker request failed: ${JSON.stringify(body)}`);
  }
  return body.payload;
}

/**
 * Write a row-major little-endian float32 matrix for persistent Worker RPC.
 *
 * @param {string} artifactPath Destination below the private exchange root.
 * @param {number[][]} vectors Rectangular vector matrix.
 * @returns {Promise<{vectorCount: number, dimension: number}>} Matrix dimensions.
 */
async function writeFloat32Artifact(artifactPath, vectors) {
  if (vectors.length === 0 || vectors[0].length === 0) {
    throw new Error("Persistent vector smoke requires a non-empty matrix.");
  }
  const dimension = vectors[0].length;
  if (vectors.some((vector) => vector.length !== dimension)) {
    throw new Error("Persistent vector smoke matrix must be rectangular.");
  }
  const artifact = Buffer.alloc(vectors.length * dimension * Float32Array.BYTES_PER_ELEMENT);
  let offset = 0;
  for (const vector of vectors) {
    for (const value of vector) {
      artifact.writeFloatLE(value, offset);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
  }
  await fs.writeFile(artifactPath, artifact);
  return { vectorCount: vectors.length, dimension };
}

/**
 * Install and query a real packaged Vector Worker through every runtime boundary.
 *
 * @returns {Promise<void>} Completion after the isolated smoke workspace is removed.
 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const externalModelRoot = resolveModelRoot();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-vector-pack-smoke-"));
  const exchangeRoot = path.join(temporaryRoot, "exchange");
  const modelRoot = externalModelRoot ?? path.join(temporaryRoot, "models");
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "vector-pack-smoke-token",
    allowedMethods: {
      "vector-index": [
        "vector.status",
        "vector.embed",
        "vector.rebuild",
        "vector.search",
        "vector.store.build",
        "vector.store.search",
        "vector.store.inspect",
        "vector.store.delete",
      ],
    },
  });
  let unsubscribe = null;

  try {
    await core.start();
    const installed = await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "vector-index",
      createDefinition: (pack) => ({
        capability: "vector-index",
        command: pack.entrypointPath,
        arguments: [
          "--exchange-root", exchangeRoot,
          "--model-root", modelRoot,
          "--storage-root", temporaryRoot,
        ],
        workingDirectory: pack.rootDirectory,
        requestTimeoutMs: 30_000,
        shutdownTimeoutMs: 3_000,
        idleTimeoutMs: 30_000,
      }),
    });
    if (unsubscribe === null) {
      throw new Error("Installed Vector pack was not discovered.");
    }
    const origin = await gateway.start();
    const status = await requestWorker(origin, "vector.status", {});
    if (status.dependencyAvailable !== true) {
      throw new Error(`Packaged Vector Worker dependencies are unavailable: ${JSON.stringify(status)}`);
    }
    await fs.mkdir(exchangeRoot, { recursive: true });
    const persistentIndexPath = path.join(temporaryRoot, "persistent", "index.faiss");
    const persistentBuildPath = path.join(exchangeRoot, "persistent-build.f32");
    const persistentBuildShape = await writeFloat32Artifact(
      persistentBuildPath,
      [[1, 0], [0, 1], [3, 3]],
    );
    const persistentBuild = await requestWorker(origin, "vector.store.build", {
      indexPath: persistentIndexPath,
      artifactPath: persistentBuildPath,
      ...persistentBuildShape,
      distance: "euclidean",
      normalizeL2: false,
    });
    const persistentQueryPath = path.join(exchangeRoot, "persistent-query.f32");
    const persistentQueryShape = await writeFloat32Artifact(persistentQueryPath, [[1, 0]]);
    const persistentSearch = await requestWorker(origin, "vector.store.search", {
      indexPath: persistentIndexPath,
      artifactPath: persistentQueryPath,
      ...persistentQueryShape,
      topK: 2,
      normalizeL2: false,
    });
    const persistentInspect = await requestWorker(origin, "vector.store.inspect", {
      indexPath: persistentIndexPath,
    });
    if (
      persistentBuild.itemCount !== 3
      || persistentSearch?.results?.[0]?.position !== 0
      || persistentInspect.itemCount !== 3
      || persistentInspect.dimension !== 2
    ) {
      throw new Error(`Packaged persistent-vector smoke failed: ${JSON.stringify({
        persistentBuild,
        persistentSearch,
        persistentInspect,
      })}`);
    }
    const persistentDelete = await requestWorker(origin, "vector.store.delete", {
      indexPath: persistentIndexPath,
    });
    if (persistentDelete.deleted !== true) {
      throw new Error(`Packaged persistent-vector cleanup failed: ${JSON.stringify(persistentDelete)}`);
    }
    let inference = null;
    if (externalModelRoot !== null) {
      if (status.modelAvailable !== true) {
        throw new Error(`Packaged Vector Worker model is unavailable: ${JSON.stringify(status)}`);
      }
      await fs.mkdir(exchangeRoot, { recursive: true });
      const embedRequestPath = path.join(exchangeRoot, "embed-request.json");
      const embedResultPath = path.join(exchangeRoot, "embed-result.json");
      await fs.writeFile(embedRequestPath, JSON.stringify({ texts: ["OpenXnet vector smoke"] }), "utf8");
      await fs.writeFile(embedResultPath, "{}", "utf8");
      const embed = await requestWorker(origin, "vector.embed", {
        artifactPath: embedRequestPath,
        resultArtifactPath: embedResultPath,
      });
      const embedResult = JSON.parse(await fs.readFile(embedResultPath, "utf8"));
      if (embed.count !== 1 || embedResult?.embeddings?.[0]?.length !== 384) {
        throw new Error(`Packaged Vector Worker inference is invalid: ${JSON.stringify(embedResult)}`);
      }
      const rebuildPath = path.join(exchangeRoot, "rebuild.json");
      await fs.writeFile(rebuildPath, JSON.stringify({
        items: [
          { id: "openxnet", text: "OpenXnet vector smoke" },
          { id: "unrelated", text: "weather forecast" },
        ],
      }), "utf8");
      const rebuild = await requestWorker(origin, "vector.rebuild", { artifactPath: rebuildPath });
      const search = await requestWorker(origin, "vector.search", {
        query: "OpenXnet vector",
        topK: 2,
      });
      if (rebuild.itemCount !== 2 || search?.results?.[0]?.id !== "openxnet") {
        throw new Error(`Packaged Vector Worker index smoke failed: ${JSON.stringify(search)}`);
      }
      inference = {
        dimension: embedResult.embeddings[0].length,
        inferenceTimeMs: embed.inferenceTimeMs,
        indexed: rebuild.itemCount,
        firstMatch: search.results[0],
      };
    }
    process.stdout.write(`${JSON.stringify({
      packVersion: installed.manifest.version,
      capabilityState: core.getCapability("vector-index").state,
      worker: status,
      persistent: {
        indexed: persistentBuild.itemCount,
        dimension: persistentInspect.dimension,
        firstMatch: persistentSearch.results[0],
        deleted: persistentDelete.deleted,
      },
      inference,
    }, null, 2)}\n`);
  } finally {
    await gateway.stop();
    await supervisor.stopAll();
    unsubscribe?.();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
