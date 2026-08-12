"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  ApplicationRecallRuntimeService,
  DesktopCore,
  FeaturePackManager,
  registerFeaturePackWorker,
  WorkerSupervisor,
} = require("../build-ts/desktop");

/** 解析 Recall smoke 的 Pack 目录；输入命令行参数，返回绝对路径，缺失时抛出说明。 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error("Usage: node scripts/smoke_recall_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/** 递归检查公开结果；输入未知值，无返回，发现私有字段时抛出 Error。 */
function assertPublicResult(value) {
  if (Array.isArray(value)) {
    value.forEach(assertPublicResult);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:api_?key|access_?token|auth_?token|token|secret|password|snapshot_path|workspace_key|process_path|stdout|stderr)$/i.test(key)) {
      throw new Error(`Recall response exposed private field '${key}'.`);
    }
    assertPublicResult(item);
  }
}

/** 安装并验证冻结 Recall Runtime；无输入和返回，结束时总是删除隔离工作区。 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-recall-pack-smoke-"));
  const workspaceDirectory = path.join(temporaryRoot, "workspace");
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  let unsubscribe = null;
  try {
    await fs.mkdir(workspaceDirectory, { recursive: true });
    await core.start();
    await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
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
          MEM0_TELEMETRY: "False",
        },
        requestTimeoutMs: 30_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 0,
      }),
    });
    if (unsubscribe === null) throw new Error("Installed Memory Pack was not discovered.");
    const runtime = new ApplicationRecallRuntimeService({
      core,
      supervisor,
      getScope: () => ({ workspaceDirectory, providerName: "session_store" }),
    });
    const startedAt = Date.now();
    const bootstrap = await runtime.bootstrap();
    const startupMs = Date.now() - startedAt;
    const timeline = await runtime.timeline({
      query: "",
      taskId: "",
      sessionId: "",
      digest: "",
      depthBefore: 3,
      depthAfter: 4,
      limit: 18,
      origin: "",
    });
    const vectorState = core.listCapabilities().find((item) => item.id === "vector-index")?.state;
    if (bootstrap.interrupted.length !== 0 || timeline.timeline.length !== 0) {
      throw new Error("Recall smoke workspace did not start empty.");
    }
    if (vectorState === "starting" || vectorState === "ready") {
      throw new Error(`Recall smoke activated Vector Worker: ${vectorState}`);
    }
    assertPublicResult(bootstrap);
    assertPublicResult(timeline);
    const manifest = JSON.parse(await fs.readFile(path.join(packDirectory, "manifest.json"), "utf8"));
    const forbiddenFiles = (manifest.files ?? []).filter((file) => /fastapi|uvicorn/i.test(String(file.path)));
    if (forbiddenFiles.length > 0) {
      throw new Error(`Memory Pack contains HTTP framework files: ${JSON.stringify(forbiddenFiles)}`);
    }
    process.stdout.write(`${JSON.stringify({
      startupMs,
      vectorState,
      interruptedCount: bootstrap.interrupted.length,
      timelineCount: timeline.timeline.length,
      payloadFiles: manifest.files.length,
      payloadBytes: manifest.files.reduce((total, file) => total + Number(file.size || 0), 0),
    }, null, 2)}\n`);
  } finally {
    unsubscribe?.();
    await supervisor.stopAll();
    await core.stop();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
