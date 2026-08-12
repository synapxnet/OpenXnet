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

/** 解析命令行提供的 Live Pack 目录；无参数时抛出使用说明。 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) throw new Error("Usage: node scripts/smoke_live_feature_pack.cjs <pack-directory>");
  return path.resolve(argument);
}

/** 发送认证 Worker 请求；输入 origin、方法和载荷，返回成功载荷，协议失败时抛出异常。 */
async function requestWorker(origin, method, payload) {
  const response = await fetch(`${origin}/v1/workers/request`, {
    method: "POST",
    headers: {
      Authorization: "Bearer live-pack-smoke-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capability: "live", method, payload }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body?.payload !== "object") {
    throw new Error(`Packaged Live Worker request failed: ${JSON.stringify(body)}`);
  }
  return body.payload;
}

/** 安装并验证真实 Live Worker 入口；无输入和返回值，结束时总是删除临时工作区。 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-live-pack-smoke-"));
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "live-pack-smoke-token",
    allowedMethods: { live: ["live.dependencies", "live.status"] },
  });
  let unsubscribe = null;
  try {
    await core.start();
    const origin = await gateway.start();
    await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "live",
      createDefinition: (pack) => ({
        capability: "live",
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          OPENXNET_RUNTIME_ROLE: "live-worker",
          OPENXNET_USER_DATA_DIR: temporaryRoot,
        },
        requestTimeoutMs: 30_000,
        shutdownTimeoutMs: 10_000,
        idleTimeoutMs: 0,
      }),
    });
    if (unsubscribe === null) throw new Error("Installed Live Pack was not discovered.");
    const dependencies = await requestWorker(origin, "live.dependencies", {});
    const status = await requestWorker(origin, "live.status", {});
    const unavailable = Object.entries(dependencies.dependencies ?? {})
      .filter(([, available]) => available !== true)
      .map(([moduleName]) => moduleName);
    if (unavailable.length > 0) {
      throw new Error(`Packaged Live dependencies are unavailable: ${unavailable.join(", ")}`);
    }
    if (status?.is_running !== false) {
      throw new Error(`Unexpected packaged Live status: ${JSON.stringify(status)}`);
    }
    if (status?.message !== "直播监听已停止") {
      throw new Error(`Packaged Live status is not valid UTF-8 Chinese: ${JSON.stringify(status)}`);
    }
    process.stdout.write(`${JSON.stringify({ dependencies, status }, null, 2)}\n`);
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
