import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DesktopCore } from "../core/desktop-core";
import { FEATURE_PACK_MANIFEST_SCHEMA } from "./feature-pack";
import { FeaturePackManager } from "./feature-pack-manager";
import {
  GITNEXUS_RUNTIME_CONFIG_SCHEMA,
  registerGitNexusFeaturePack,
} from "./register-gitnexus-feature-pack";

test("GitNexus runtime handoff is created only after capability activation", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-gitnexus-pack-"));
  const sourceRoot = path.join(temporaryRoot, "source");
  const entrypoint = "dist/cli/index.js";
  const entrypointPath = path.join(sourceRoot, ...entrypoint.split("/"));
  const runtimeExecutable = "runtime/node.exe";
  const runtimeExecutablePath = path.join(sourceRoot, ...runtimeExecutable.split("/"));
  const payload = Buffer.from("console.log('gitnexus')", "utf8");
  const runtimeConfigPath = path.join(temporaryRoot, "runtime", "gitnexus.json");
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const core = new DesktopCore();

  try {
    await fs.mkdir(path.dirname(entrypointPath), { recursive: true });
    await fs.mkdir(path.dirname(runtimeExecutablePath), { recursive: true });
    await fs.writeFile(entrypointPath, payload);
    const runtimePayload = Buffer.from("fake-node-runtime", "utf8");
    await fs.writeFile(runtimeExecutablePath, runtimePayload);
    await fs.writeFile(
      path.join(sourceRoot, "manifest.json"),
      `${JSON.stringify({
        schema: FEATURE_PACK_MANIFEST_SCHEMA,
        id: "gitnexus",
        version: "1.0.0",
        runtime: "node",
        desktopProtocolVersion: "1.0",
        platforms: [process.platform],
        architectures: [process.arch],
        entrypoint,
        runtimeExecutable,
        files: [
          {
            path: entrypoint,
            size: payload.length,
            sha256: createHash("sha256").update(payload).digest("hex"),
          },
          {
            path: runtimeExecutable,
            size: runtimePayload.length,
            sha256: createHash("sha256").update(runtimePayload).digest("hex"),
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    await manager.installFromDirectory(sourceRoot);
    await core.start();
    const registered = await registerGitNexusFeaturePack({
      core,
      manager,
      runtimeConfigPath,
    });

    assert.equal(registered, true);
    assert.equal(core.getCapability("gitnexus").state, "stopped");
    await assert.rejects(fs.access(runtimeConfigPath));

    const ready = await core.ensureCapability("gitnexus");
    const runtimeConfig = JSON.parse(await fs.readFile(runtimeConfigPath, "utf8")) as Record<string, unknown>;
    assert.equal(ready.state, "ready");
    assert.equal(runtimeConfig.schema, GITNEXUS_RUNTIME_CONFIG_SCHEMA);
    assert.equal(runtimeConfig.packVersion, "1.0.0");
    assert.equal(runtimeConfig.nodeMode, "node");
    assert.equal(
      runtimeConfig.nodeExecutable,
      path.join(temporaryRoot, "installed", "gitnexus", "versions", "1.0.0", ...runtimeExecutable.split("/")),
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
