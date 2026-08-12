"use strict";

const fs = require("node:fs/promises");
const http = require("node:http");
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
 * Resolve the feature-pack directory supplied to the smoke command.
 *
 * @returns {string} Absolute feature-pack source directory.
 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error("Usage: node scripts/smoke_memory_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/**
 * Start a loopback OpenAI-compatible endpoint for offline embedding validation.
 *
 * @returns {Promise<{origin: string, stop: () => Promise<void>}>} Bound origin and shutdown callback.
 */
async function startFakeOpenAiServer() {
  const server = http.createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/embeddings") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      JSON.parse(body);
      const payload = JSON.stringify({
        object: "list",
        data: [{ object: "embedding", index: 0, embedding: [1, 0] }],
        model: "smoke-embedding",
        usage: { prompt_tokens: 1, total_tokens: 1 },
      });
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      });
      response.end(payload);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fake OpenAI server did not receive a TCP address.");
  }
  return {
    origin: `http://127.0.0.1:${address.port}/v1`,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/**
 * Send one authenticated request through the Worker RPC Gateway.
 *
 * @param {string} origin Bound loopback gateway origin.
 * @param {string} method Allow-listed Memory Worker method.
 * @param {Record<string, unknown>} payload Serializable control payload.
 * @returns {Promise<Record<string, unknown>>} Successful Worker payload.
 */
async function requestWorker(origin, method, payload) {
  const response = await fetch(`${origin}/v1/workers/request`, {
    method: "POST",
    headers: {
      Authorization: "Bearer memory-pack-smoke-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capability: "memory", method, payload }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body?.payload !== "object") {
    throw new Error(`Packaged Memory Worker request failed: ${JSON.stringify(body)}`);
  }
  return body.payload;
}

/** 递归检查 Recall 公开结果；输入未知值，无返回，发现私有字段时抛出 Error。 */
function assertRecallPublicResult(value) {
  if (Array.isArray(value)) {
    value.forEach(assertRecallPublicResult);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:api_?key|access_?token|auth_?token|token|secret|password|snapshot_path|workspace_key|process_path|stdout|stderr)$/i.test(key)) {
      throw new Error(`Packaged Recall response exposed private field '${key}'.`);
    }
    assertRecallPublicResult(item);
  }
}

/**
 * 安装并验证冻结 Memory Worker；输入 Pack 目录，结束时删除隔离工作区和本地假服务。
 *
 * @returns {Promise<void>} 全部 Recall 与 Mem0 离线验证完成后结束。
 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-memory-pack-smoke-"));
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const fakeOpenAi = await startFakeOpenAiServer();
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "memory-pack-smoke-token",
    allowedMethods: {
      memory: [
        "memory.status",
        "memory.search",
        "memory.release",
        "memory.collection.list",
        "memory.collection.update",
        "memory.collection.delete-record",
        "memory.collection.remove",
        "recall.bootstrap",
        "recall.timeline",
        "recall.observations",
        "recall.close",
      ],
    },
  });
  let unsubscribeVector = null;
  let unsubscribeMemory = null;

  try {
    await core.start();
    const origin = await gateway.start();
    unsubscribeVector = registerWorkerCapability({
      core,
      supervisor,
      definition: {
        capability: "vector-index",
        command: process.env.PYTHON_EXECUTABLE ?? "python",
        arguments: ["-m", "py.workers.demo_worker", "--capability", "vector-index"],
        workingDirectory: path.resolve(__dirname, ".."),
        requestTimeoutMs: 5_000,
        shutdownTimeoutMs: 2_000,
      },
    });
    await manager.installFromDirectory(packDirectory);
    unsubscribeMemory = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "memory",
      createDefinition: (pack) => ({
        capability: "memory",
        command: pack.entrypointPath,
        arguments: ["--storage-root", temporaryRoot],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          OPENXNET_USER_DATA_DIR: temporaryRoot,
          OPENXNET_VECTOR_EXCHANGE_DIR: path.join(temporaryRoot, "vector-exchange"),
          OPENXNET_WORKER_RPC_ORIGIN: origin,
          OPENXNET_WORKER_RPC_TOKEN: "memory-pack-smoke-token",
          MEM0_TELEMETRY: "False",
        },
        requestTimeoutMs: 30_000,
        shutdownTimeoutMs: 3_000,
      }),
    });
    if (unsubscribeMemory === null) {
      throw new Error("Installed Memory feature pack was not discovered.");
    }

    const workspaceDirectory = path.join(temporaryRoot, "workspace");
    await fs.mkdir(workspaceDirectory, { recursive: true });
    const recallStartedAt = Date.now();
    const recall = await requestWorker(origin, "recall.bootstrap", {
      workspaceDirectory,
      providerName: "session_store",
    });
    const recallStartupMs = Date.now() - recallStartedAt;
    const vectorStateAfterRecall = core.listCapabilities().find((item) => item.id === "vector-index")?.state;
    const timeline = await requestWorker(origin, "recall.timeline", {
      workspaceDirectory,
      providerName: "session_store",
      query: "",
      taskId: "",
      sessionId: "",
      digest: "",
      depthBefore: 3,
      depthAfter: 4,
      limit: 18,
      origin: "",
    });
    if (!Array.isArray(recall.interrupted) || !Array.isArray(recall.checkpoints)) {
      throw new Error(`Packaged Recall bootstrap is invalid: ${JSON.stringify(recall)}`);
    }
    if (!Array.isArray(timeline.timeline) || timeline.timeline.length !== 0) {
      throw new Error(`Packaged Recall timeline is invalid: ${JSON.stringify(timeline)}`);
    }
    if (vectorStateAfterRecall === "starting" || vectorStateAfterRecall === "ready") {
      throw new Error(`Recall bootstrap activated Vector Worker: ${vectorStateAfterRecall}`);
    }
    assertRecallPublicResult(recall);
    assertRecallPublicResult(timeline);

    const status = await requestWorker(origin, "memory.status", {});
    const search = await requestWorker(origin, "memory.search", {
      configuration: {
        memoryId: "smoke-memory",
        embedder: {
          model: "smoke-embedding",
          apiKey: "smoke-key",
          baseUrl: fakeOpenAi.origin,
          dimensions: 2,
        },
        llm: {
          model: "smoke-chat",
          apiKey: "smoke-key",
          baseUrl: fakeOpenAi.origin,
        },
      },
      query: "offline memory smoke",
      userId: "smoke-user",
      limit: 3,
    });
    const release = await requestWorker(origin, "memory.release", {});
    const managementDirectory = path.join(temporaryRoot, "memory_cache", "management-memory");
    await fs.mkdir(managementDirectory, { recursive: true });
    await fs.writeFile(path.join(managementDirectory, "agent-party.records.json"), `${JSON.stringify({
      schema: "openxnet.vector-records.v1",
      records: {
        "record-one": { data: "before", created_at: "created", timetamp: "updated" },
      },
      positions: { 0: "record-one" },
    })}\n`, "utf8");
    const recordsBefore = await requestWorker(origin, "memory.collection.list", {
      memoryId: "management-memory",
    });
    const updatedRecord = await requestWorker(origin, "memory.collection.update", {
      memoryId: "management-memory",
      recordId: "record-one",
      text: "after",
    });
    const recordsAfter = await requestWorker(origin, "memory.collection.list", {
      memoryId: "management-memory",
    });
    const removedCollection = await requestWorker(origin, "memory.collection.remove", {
      memoryId: "management-memory",
    });
    if (status.dependencyAvailable !== true || status.vectorWorkerConfigured !== true) {
      throw new Error(`Packaged Memory Worker is not ready: ${JSON.stringify(status)}`);
    }
    if (
      typeof search.results !== "object"
      || search.results === null
      || !Array.isArray(search.results.results)
      || search.results.results.length !== 0
    ) {
      throw new Error(`Unexpected packaged Memory search result: ${JSON.stringify(search)}`);
    }
    if (release.released !== 1) {
      throw new Error(`Unexpected packaged Memory release result: ${JSON.stringify(release)}`);
    }
    if (
      recordsBefore.records?.[0]?.recordId !== "record-one"
      || recordsBefore.records?.[0]?.text !== "before"
      || updatedRecord.action !== "updated"
      || recordsAfter.records?.[0]?.text !== "after"
      || removedCollection.action !== "removed"
    ) {
      throw new Error(`Packaged Memory management result is invalid: ${JSON.stringify({ recordsBefore, updatedRecord, recordsAfter, removedCollection })}`);
    }
    const managementExists = await fs.stat(managementDirectory).then(() => true, () => false);
    if (managementExists) {
      throw new Error("Packaged Memory management did not remove its fixed collection directory.");
    }
    const historyPath = path.join(temporaryRoot, "memory_cache", "smoke-memory", "history.db");
    const historyExists = await fs.stat(historyPath).then(() => true, () => false);
    if (!historyExists) {
      throw new Error("Packaged Memory Worker did not create history.db below storage root.");
    }
    const manifest = JSON.parse(await fs.readFile(path.join(packDirectory, "manifest.json"), "utf8"));
    const forbiddenFiles = (manifest.files ?? []).filter((file) => /fastapi|uvicorn/i.test(String(file.path)));
    if (forbiddenFiles.length > 0) {
      throw new Error(`Memory Pack contains HTTP framework files: ${JSON.stringify(forbiddenFiles)}`);
    }
    process.stdout.write(`${JSON.stringify({
      recallStartupMs,
      vectorStateAfterRecall,
      recall,
      timeline,
      status,
      search,
      release,
      recordsBefore,
      updatedRecord,
      recordsAfter,
      removedCollection,
      historyExists,
      payloadFiles: manifest.files.length,
      payloadBytes: manifest.files.reduce((total, file) => total + Number(file.size || 0), 0),
    }, null, 2)}\n`);
  } finally {
    unsubscribeMemory?.();
    unsubscribeVector?.();
    await gateway.stop();
    await supervisor.stopAll();
    await core.stop();
    await fakeOpenAi.stop();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
