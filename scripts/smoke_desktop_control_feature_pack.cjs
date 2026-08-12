"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  DesktopCore,
  FeaturePackManager,
  registerFeaturePackWorker,
  WorkerSupervisor,
} = require("../build-ts/desktop");

/** 解析命令行提供的 Desktop Control Pack 目录；无参数时抛出使用说明。 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error("Usage: node scripts/smoke_desktop_control_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/** 递归检查公开结果不含本机路径字段；输入未知值，无返回，发现路径字段时抛出 Error。 */
function assertPathFree(value) {
  if (Array.isArray(value)) {
    value.forEach(assertPathFree);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/path|directory/i.test(key)) {
      throw new Error(`Desktop Control response exposed a local path field '${key}'.`);
    }
    assertPathFree(item);
  }
}

/** 安装并验证真实冻结 Worker；无输入和返回，结束时总是删除临时工作区。 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-desktop-control-pack-smoke-"));
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  let unsubscribe = null;
  try {
    await core.start();
    await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "desktop-control",
      createDefinition: (pack) => ({
        capability: "desktop-control",
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          OPENXNET_RUNTIME_ROLE: "desktop-control-worker",
        },
        requestTimeoutMs: 15_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 0,
      }),
    });
    if (unsubscribe === null) throw new Error("Installed Desktop Control Pack was not discovered.");
    const startedAt = Date.now();
    await core.ensureCapability("desktop-control");
    const startupMs = Date.now() - startedAt;
    const dependencies = await supervisor.request(
      "desktop-control",
      "desktop_control.dependencies",
      {},
    );
    const monitors = await supervisor.request(
      "desktop-control",
      "desktop_control.list_monitors",
      {},
    );
    const activeWindow = await supervisor.request(
      "desktop-control",
      "desktop_control.get_active_window",
      {},
    );
    const windows = await supervisor.request(
      "desktop-control",
      "desktop_control.list_windows",
      { titleQuery: "", includeHidden: false, includeMinimized: true, limit: 5 },
    );
    const history = await supervisor.request(
      "desktop-control",
      "desktop_control.list_history",
      { limit: 8 },
    );
    const unavailable = Object.entries(dependencies.dependencies ?? {})
      .filter(([, available]) => available !== true)
      .map(([moduleName]) => moduleName);
    if (unavailable.length > 0) {
      throw new Error(`Packaged Desktop Control dependencies are unavailable: ${unavailable.join(", ")}`);
    }
    if (!Array.isArray(monitors.monitors) || monitors.monitors.length < 1) {
      throw new Error(`Packaged Desktop Control monitor result is invalid: ${JSON.stringify(monitors)}`);
    }
    if (!Array.isArray(windows.windows) || windows.windows.length > 5) {
      throw new Error(`Packaged Desktop Control window result is invalid: ${JSON.stringify(windows)}`);
    }
    assertPathFree(activeWindow);
    assertPathFree(windows);
    const manifest = JSON.parse(await fs.readFile(path.join(packDirectory, "manifest.json"), "utf8"));
    const forbiddenFiles = (manifest.files ?? []).filter((file) => /fastapi|uvicorn/i.test(String(file.path)));
    if (forbiddenFiles.length > 0) {
      throw new Error(`Desktop Control Pack contains HTTP framework files: ${JSON.stringify(forbiddenFiles)}`);
    }
    process.stdout.write(`${JSON.stringify({
      startupMs,
      dependencies,
      monitorCount: monitors.monitors.length,
      windowCount: windows.windows.length,
      activeWindowFound: activeWindow.found === true,
      historyCount: history.count,
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
