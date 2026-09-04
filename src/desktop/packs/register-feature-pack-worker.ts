import type { CapabilityId } from "../contracts/capability";
import type { DesktopCore } from "../core/desktop-core";
import { registerWorkerCapability } from "../core/register-worker-capability";
import type { WorkerDefinition, WorkerSupervisor } from "../workers/worker-supervisor";
import { FeaturePackError } from "./feature-pack";
import type { FeaturePackManager, InstalledFeaturePack } from "./feature-pack-manager";

/** Dependencies for binding an installed executable pack to WorkerSupervisor. */
export interface RegisterFeaturePackWorkerOptions {
  readonly core: DesktopCore;
  readonly manager: FeaturePackManager;
  readonly supervisor: WorkerSupervisor;
  readonly capability: CapabilityId;
  readonly createDefinition: (pack: InstalledFeaturePack) => WorkerDefinition;
  readonly bundledDirectory?: string;
}

/**
 * Discover one executable pack and register a fully verified deferred worker activator.
 *
 * @param options Core, pack store, supervisor, and launch-definition factory.
 * @returns Lifecycle unsubscribe function, or null when the pack is not installed.
 */
export async function registerFeaturePackWorker(
  options: RegisterFeaturePackWorkerOptions,
): Promise<(() => void) | null> {
  let discovered = await options.manager.discoverCurrent(options.capability);
  let usesBundledPack = false;
  if (discovered === null && options.bundledDirectory !== undefined) {
    discovered = await options.manager.discoverDirectory(options.bundledDirectory);
    usesBundledPack = true;
    if (discovered.manifest.id !== options.capability) {
      throw new FeaturePackError(
        "INVALID_MANIFEST",
        "Bundled feature-pack capability does not match the requested worker.",
      );
    }
  }
  if (discovered === null) {
    return null;
  }
  const installedPack = discovered;
  const definition = options.createDefinition(installedPack);
  if (definition.capability !== options.capability) {
    throw new FeaturePackError(
      "INVALID_MANIFEST",
      "Feature-pack worker definition capability does not match the installed pack.",
    );
  }

  /** Verify the immutable discovered version immediately before process execution. */
  async function verifyBeforeStart(): Promise<void> {
    const active = usesBundledPack
      ? await options.manager.inspectDirectory(installedPack.rootDirectory)
      : await options.manager.resolveCurrent(options.capability);
    if (active === null) {
      throw new FeaturePackError(
        "PACK_NOT_INSTALLED",
        `Feature pack '${options.capability}' is not installed.`,
      );
    }
    if (
      active.manifest.version !== installedPack.manifest.version
      || active.rootDirectory !== installedPack.rootDirectory
    ) {
      throw new FeaturePackError(
        "INVALID_PACK_CONTENT",
        `Feature pack '${options.capability}' changed after startup; restart before activation.`,
      );
    }
  }

  return registerWorkerCapability({
    core: options.core,
    supervisor: options.supervisor,
    definition,
    beforeStart: verifyBeforeStart,
  });
}
