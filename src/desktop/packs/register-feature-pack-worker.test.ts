import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DesktopCore } from "../core/desktop-core";
import { WorkerSupervisor } from "../workers/worker-supervisor";
import { FEATURE_PACK_MANIFEST_SCHEMA } from "./feature-pack";
import { FeaturePackManager } from "./feature-pack-manager";
import { registerFeaturePackWorker } from "./register-feature-pack-worker";

/** 创建一个最小 Memory Feature Pack；输入目录、版本和载荷，返回包目录。 */
async function createMemoryPack(root: string, version: string, content: string): Promise<string> {
  const packDirectory = path.join(root, `memory-${version}`);
  const entrypoint = "runtime/memory-worker.exe";
  const entrypointPath = path.join(packDirectory, ...entrypoint.split("/"));
  const payload = Buffer.from(content, "utf8");
  await fs.mkdir(path.dirname(entrypointPath), { recursive: true });
  await fs.writeFile(entrypointPath, payload);
  await fs.writeFile(
    path.join(packDirectory, "manifest.json"),
    `${JSON.stringify({
      schema: FEATURE_PACK_MANIFEST_SCHEMA,
      id: "memory",
      version,
      runtime: "native",
      desktopProtocolVersion: "1.0",
      platforms: [process.platform],
      architectures: [process.arch],
      entrypoint,
      runtimeExecutable: entrypoint,
      files: [{
        path: entrypoint,
        size: payload.length,
        sha256: createHash("sha256").update(payload).digest("hex"),
      }],
    }, null, 2)}\n`,
    "utf8",
  );
  return packDirectory;
}

/** 注册测试 Worker 并返回选中的 Feature Pack 目录。 */
async function registerMemoryWorker(
  core: DesktopCore,
  supervisor: WorkerSupervisor,
  manager: FeaturePackManager,
  bundledDirectory: string,
): Promise<{ readonly selectedRoot: string; readonly cleanup: () => void }> {
  let selectedRoot = "";
  const cleanup = await registerFeaturePackWorker({
    core,
    supervisor,
    manager,
    capability: "memory",
    bundledDirectory,
    createDefinition: (pack) => {
      selectedRoot = pack.rootDirectory;
      return {
        capability: "memory",
        command: pack.entrypointPath,
      };
    },
  });
  assert.notEqual(cleanup, null);
  return { selectedRoot, cleanup: cleanup as () => void };
}

test("bundled Memory pack is registered when the private store is empty", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-bundled-memory-"));
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();

  try {
    const bundledDirectory = await createMemoryPack(temporaryRoot, "1.2.0", "bundled");
    await core.start();
    const registered = await registerMemoryWorker(core, supervisor, manager, bundledDirectory);
    assert.equal(registered.selectedRoot, path.resolve(bundledDirectory));
    assert.equal(core.getCapability("memory").state, "stopped");
    assert.equal(supervisor.getSnapshot("memory").state, "stopped");
    assert.deepEqual(await manager.listInstalledVersions("memory"), []);
    registered.cleanup();
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("a user-installed Memory pack takes precedence over the bundled baseline", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-installed-memory-"));
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();

  try {
    const bundledDirectory = await createMemoryPack(temporaryRoot, "1.2.0", "bundled");
    const installedDirectory = await createMemoryPack(temporaryRoot, "1.3.0", "installed");
    const installed = await manager.installFromDirectory(installedDirectory);
    await core.start();
    const registered = await registerMemoryWorker(core, supervisor, manager, bundledDirectory);
    assert.equal(registered.selectedRoot, installed.rootDirectory);
    registered.cleanup();
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("bundled Memory payload corruption is rejected before process execution", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-corrupt-memory-"));
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();

  try {
    const bundledDirectory = await createMemoryPack(temporaryRoot, "1.2.0", "bundled");
    await core.start();
    const registered = await registerMemoryWorker(core, supervisor, manager, bundledDirectory);
    await fs.writeFile(path.join(bundledDirectory, "runtime", "memory-worker.exe"), "tampered", "utf8");
    await assert.rejects(core.ensureCapability("memory"), /Feature-pack file size mismatch/);
    assert.equal(supervisor.getSnapshot("memory").state, "stopped");
    registered.cleanup();
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
