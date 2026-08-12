import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { DesktopCore } from "../core/desktop-core";
import { FeaturePackError } from "./feature-pack";
import type { FeaturePackManager, InstalledFeaturePack } from "./feature-pack-manager";

/** Schema for the short-lived runtime handoff consumed by the Python MCP adapter. */
export const GITNEXUS_RUNTIME_CONFIG_SCHEMA = "openxnet.gitnexus-runtime.v1";

/** Runtime handoff written only after a GitNexus pack passes full verification. */
export interface GitNexusRuntimeConfig {
  readonly schema: typeof GITNEXUS_RUNTIME_CONFIG_SCHEMA;
  readonly packVersion: string;
  readonly packRoot: string;
  readonly entrypoint: string;
  readonly nodeExecutable: string;
  readonly nodeMode: "electron" | "node";
}

/** Dependencies required to register the GitNexus feature-pack activator. */
export interface RegisterGitNexusFeaturePackOptions {
  readonly core: DesktopCore;
  readonly manager: FeaturePackManager;
  readonly runtimeConfigPath: string;
}

/**
 * Register GitNexus as installed while deferring payload verification until activation.
 *
 * @param options Desktop Core, feature-pack store, and runtime handoff paths.
 * @returns True when a compatible current version was discovered.
 */
export async function registerGitNexusFeaturePack(
  options: RegisterGitNexusFeaturePackOptions,
): Promise<boolean> {
  await fs.rm(options.runtimeConfigPath, { force: true });
  const discovered = await options.manager.discoverCurrent("gitnexus");
  if (discovered === null) {
    return false;
  }
  if (discovered.manifest.runtime !== "node") {
    throw new FeaturePackError("INVALID_MANIFEST", "GitNexus feature pack must declare the Node runtime.");
  }

  options.core.registerActivator("gitnexus", async () => {
    const activePack = await options.manager.resolveCurrent("gitnexus");
    if (activePack === null) {
      throw new FeaturePackError("PACK_NOT_INSTALLED", "GitNexus feature pack is not installed.");
    }
    const runtimeConfig = createGitNexusRuntimeConfig(
      activePack,
    );
    await writeRuntimeConfig(options.runtimeConfigPath, runtimeConfig);
    return {
      packVersion: activePack.manifest.version,
      entrypoint: activePack.entrypointPath,
      runtimeConfigPath: options.runtimeConfigPath,
    };
  });
  return true;
}

/**
 * Build the runtime handoff for a fully verified GitNexus pack.
 *
 * @param pack Verified active feature pack.
 * @returns Serializable runtime configuration.
 */
function createGitNexusRuntimeConfig(
  pack: InstalledFeaturePack,
): GitNexusRuntimeConfig {
  return {
    schema: GITNEXUS_RUNTIME_CONFIG_SCHEMA,
    packVersion: pack.manifest.version,
    packRoot: pack.rootDirectory,
    entrypoint: pack.entrypointPath,
    nodeExecutable: path.join(
      pack.rootDirectory,
      ...pack.manifest.runtimeExecutable.split("/"),
    ),
    nodeMode: "node",
  };
}

/**
 * Write runtime configuration through a same-directory atomic rename.
 *
 * @param runtimeConfigPath Destination JSON path visible to Python.
 * @param runtimeConfig Validated handoff content.
 */
async function writeRuntimeConfig(
  runtimeConfigPath: string,
  runtimeConfig: GitNexusRuntimeConfig,
): Promise<void> {
  const directory = path.dirname(runtimeConfigPath);
  const temporaryPath = path.join(directory, `.gitnexus-runtime-${randomUUID()}.json`);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, "utf8");
  try {
    await fs.rename(temporaryPath, runtimeConfigPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}
