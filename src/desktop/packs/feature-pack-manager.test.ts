import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FeaturePackError, FEATURE_PACK_MANIFEST_SCHEMA } from "./feature-pack";
import { FeaturePackManager } from "./feature-pack-manager";

async function createPack(
  root: string,
  version: string,
  content: string,
  options: { platform?: string; sha256?: string } = {},
): Promise<string> {
  const packDirectory = path.join(root, `pack-${version}`);
  const entrypoint = "dist/cli/index.js";
  const entrypointPath = path.join(packDirectory, ...entrypoint.split("/"));
  const runtimeExecutable = "runtime/node.exe";
  const runtimeExecutablePath = path.join(packDirectory, ...runtimeExecutable.split("/"));
  const payload = Buffer.from(content, "utf8");
  await fs.mkdir(path.dirname(entrypointPath), { recursive: true });
  await fs.mkdir(path.dirname(runtimeExecutablePath), { recursive: true });
  await fs.writeFile(entrypointPath, payload);
  await fs.writeFile(runtimeExecutablePath, payload);
  await fs.writeFile(
    path.join(packDirectory, "manifest.json"),
    `${JSON.stringify({
      schema: FEATURE_PACK_MANIFEST_SCHEMA,
      id: "gitnexus",
      version,
      runtime: "node",
      desktopProtocolVersion: "1.0",
      platforms: [options.platform ?? process.platform],
      architectures: [process.arch],
      entrypoint,
      runtimeExecutable,
      files: [entrypoint, runtimeExecutable].map((filePath) => ({
        path: filePath,
        size: payload.length,
        sha256: filePath === entrypoint && options.sha256
          ? options.sha256
          : createHash("sha256").update(payload).digest("hex"),
      })),
    }, null, 2)}\n`,
    "utf8",
  );
  return packDirectory;
}

test("FeaturePackManager installs, resolves, and rolls back validated packs", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-feature-pack-"));
  const sourceRoot = path.join(temporaryRoot, "source");
  const installRoot = path.join(temporaryRoot, "installed");
  const manager = new FeaturePackManager({ rootDirectory: installRoot });

  try {
    const firstSource = await createPack(sourceRoot, "1.0.0", "first");
    const secondSource = await createPack(sourceRoot, "2.0.0", "second");
    await manager.installFromDirectory(firstSource);
    const second = await manager.installFromDirectory(secondSource);
    assert.equal(second.manifest.version, "2.0.0");
    assert.equal((await manager.resolveCurrent("gitnexus"))?.manifest.version, "2.0.0");

    const rolledBack = await manager.selectVersion("gitnexus", "1.0.0");
    assert.equal(rolledBack.manifest.version, "1.0.0");
    assert.equal((await manager.resolveCurrent("gitnexus"))?.manifest.version, "1.0.0");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("FeaturePackManager rejects corrupted payloads", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-feature-pack-"));
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });

  try {
    const source = await createPack(temporaryRoot, "1.0.0", "payload", { sha256: "0".repeat(64) });
    await assert.rejects(
      manager.installFromDirectory(source),
      (error: unknown) => error instanceof FeaturePackError && error.code === "INVALID_PACK_CONTENT",
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("FeaturePackManager rejects incompatible platforms", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-feature-pack-"));
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });

  try {
    const incompatiblePlatform = process.platform === "win32" ? "linux" : "win32";
    const source = await createPack(temporaryRoot, "1.0.0", "payload", {
      platform: incompatiblePlatform,
    });
    await assert.rejects(
      manager.installFromDirectory(source),
      (error: unknown) => error instanceof FeaturePackError && error.code === "INCOMPATIBLE_PLATFORM",
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
