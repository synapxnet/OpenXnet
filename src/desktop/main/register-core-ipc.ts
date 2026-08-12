import { DESKTOP_CORE_CHANNELS } from "../contracts/channels";
import {
  isCapabilityId,
  type DesktopCoreSnapshot,
  type EnsureCapabilityRequest,
} from "../contracts/capability";
import {
  isFeaturePackCapabilityId,
  type FeaturePackDistributionSnapshot,
  type FeaturePackMutationResult,
  type FeaturePackProgressEvent,
  type ListFeaturePacksRequest,
  type MutateFeaturePackRequest,
} from "../contracts/feature-pack-distribution";
import type { DesktopCore } from "../core/desktop-core";
import {
  toFeaturePackPublicError,
} from "../packs/feature-pack-distribution";

/** Minimal Electron IPC surface required by the Core adapter. */
export interface IpcMainLike {
  handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void;
  removeHandler(channel: string): void;
}

/** Minimal Renderer web contents surface required for Core event delivery. */
export interface WebContentsLike {
  isDestroyed(): boolean;
  send(channel: string, payload: unknown): void;
}

/** Feature Pack service surface consumed by the IPC adapter. */
export interface FeaturePackDistributionLike {
  list(refresh?: boolean): Promise<FeaturePackDistributionSnapshot>;
  install(capabilityId: MutateFeaturePackRequest["capabilityId"]): Promise<FeaturePackMutationResult>;
  repair(capabilityId: MutateFeaturePackRequest["capabilityId"]): Promise<FeaturePackMutationResult>;
  uninstall(capabilityId: MutateFeaturePackRequest["capabilityId"]): Promise<FeaturePackMutationResult>;
  subscribe(listener: (event: FeaturePackProgressEvent) => void): () => void;
}

/** Dependencies required to expose Desktop Core through Electron IPC. */
export interface RegisterDesktopCoreIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly core: DesktopCore;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWebContents: () => readonly WebContentsLike[];
  readonly featurePacks?: FeaturePackDistributionLike;
}

/**
 * Determine whether an unknown IPC value is a non-array object.
 *
 * @param value Value received from a Renderer.
 * @returns True when fields can be inspected safely.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a Feature Pack list request and reject unexpected fields.
 *
 * @param request Untrusted IPC payload.
 * @returns Whether the remote catalog should be refreshed.
 */
function parseListFeaturePacksRequest(request: unknown): boolean {
  if (request === undefined) {
    return true;
  }
  if (!isRecord(request) || Object.keys(request).some((key) => key !== "refresh")) {
    throw new Error("Feature Pack list request contains unsupported fields.");
  }
  if (request.refresh !== undefined && typeof request.refresh !== "boolean") {
    throw new Error("Feature Pack list request refresh must be a boolean.");
  }
  return request.refresh ?? true;
}

/**
 * Validate a Feature Pack mutation request against the explicit capability allow-list.
 *
 * @param request Untrusted IPC payload.
 * @returns Validated mutation request.
 */
function parseMutateFeaturePackRequest(request: unknown): MutateFeaturePackRequest {
  if (
    !isRecord(request)
    || Object.keys(request).length !== 1
    || !isFeaturePackCapabilityId(request.capabilityId)
  ) {
    throw new Error("A valid Feature Pack capabilityId is required.");
  }
  return { capabilityId: request.capabilityId };
}

/**
 * Replace an internal Feature Pack failure with a sanitized IPC error.
 *
 * @param error Internal service failure.
 * @returns Error containing only a stable code and public message.
 */
function createFeaturePackIpcError(error: unknown): Error {
  const publicError = toFeaturePackPublicError(error);
  const result = new Error(`${publicError.code}: ${publicError.message}`);
  result.name = "FeaturePackError";
  return result;
}

/**
 * Register the allow-listed Desktop Core IPC handlers and state event publisher.
 *
 * @param options Electron and Core dependencies.
 * @returns Cleanup function that removes handlers and subscriptions.
 */
export function registerDesktopCoreIpc(options: RegisterDesktopCoreIpcOptions): () => void {
  const { ipcMain, core, authorizeEvent, featurePacks, getWebContents } = options;

  /** Return aggregate Core state to the requesting Renderer. */
  async function handleGetState(event: unknown): Promise<DesktopCoreSnapshot> {
    authorizeEvent(event);
    return core.getSnapshot();
  }

  /** Return all capability snapshots to the requesting Renderer. */
  async function handleListCapabilities(event: unknown) {
    authorizeEvent(event);
    return core.listCapabilities();
  }

  /** Validate and activate one capability requested by a Renderer. */
  async function handleEnsureCapability(
    event: unknown,
    request: EnsureCapabilityRequest,
  ) {
    authorizeEvent(event);
    if (request === null || typeof request !== "object" || !isCapabilityId(request.capabilityId)) {
      throw new Error("A valid capabilityId is required.");
    }
    return core.ensureCapability(request.capabilityId);
  }

  /** Return installed Feature Pack health and optional signed catalog state. */
  async function handleListFeaturePacks(
    event: unknown,
    request?: ListFeaturePacksRequest,
  ): Promise<FeaturePackDistributionSnapshot> {
    authorizeEvent(event);
    if (featurePacks === undefined) {
      throw new Error("Feature Pack distribution service is unavailable.");
    }
    try {
      return await featurePacks.list(parseListFeaturePacksRequest(request));
    } catch (error) {
      throw createFeaturePackIpcError(error);
    }
  }

  /** Install one allow-listed Feature Pack from the signed catalog. */
  async function handleInstallFeaturePack(
    event: unknown,
    request: MutateFeaturePackRequest,
  ): Promise<FeaturePackMutationResult> {
    authorizeEvent(event);
    if (featurePacks === undefined) {
      throw new Error("Feature Pack distribution service is unavailable.");
    }
    try {
      return await featurePacks.install(parseMutateFeaturePackRequest(request).capabilityId);
    } catch (error) {
      throw createFeaturePackIpcError(error);
    }
  }

  /** Repair one allow-listed Feature Pack from the signed catalog. */
  async function handleRepairFeaturePack(
    event: unknown,
    request: MutateFeaturePackRequest,
  ): Promise<FeaturePackMutationResult> {
    authorizeEvent(event);
    if (featurePacks === undefined) {
      throw new Error("Feature Pack distribution service is unavailable.");
    }
    try {
      return await featurePacks.repair(parseMutateFeaturePackRequest(request).capabilityId);
    } catch (error) {
      throw createFeaturePackIpcError(error);
    }
  }

  /** Uninstall one allow-listed Feature Pack and all of its versions. */
  async function handleUninstallFeaturePack(
    event: unknown,
    request: MutateFeaturePackRequest,
  ): Promise<FeaturePackMutationResult> {
    authorizeEvent(event);
    if (featurePacks === undefined) {
      throw new Error("Feature Pack distribution service is unavailable.");
    }
    try {
      return await featurePacks.uninstall(parseMutateFeaturePackRequest(request).capabilityId);
    } catch (error) {
      throw createFeaturePackIpcError(error);
    }
  }

  /** Broadcast aggregate Core state after a capability transition. */
  function publishSnapshot(): void {
    const snapshot = core.getSnapshot();
    for (const webContents of getWebContents()) {
      if (!webContents.isDestroyed()) {
        webContents.send(DESKTOP_CORE_CHANNELS.stateChanged, snapshot);
      }
    }
  }

  /** Broadcast sanitized Feature Pack progress to active Renderers. */
  function publishFeaturePackProgress(event: FeaturePackProgressEvent): void {
    for (const webContents of getWebContents()) {
      if (!webContents.isDestroyed()) {
        webContents.send(DESKTOP_CORE_CHANNELS.featurePackProgress, event);
      }
    }
  }

  for (const channel of [
    DESKTOP_CORE_CHANNELS.getState,
    DESKTOP_CORE_CHANNELS.listCapabilities,
    DESKTOP_CORE_CHANNELS.ensureCapability,
    DESKTOP_CORE_CHANNELS.listFeaturePacks,
    DESKTOP_CORE_CHANNELS.installFeaturePack,
    DESKTOP_CORE_CHANNELS.repairFeaturePack,
    DESKTOP_CORE_CHANNELS.uninstallFeaturePack,
  ]) {
    ipcMain.removeHandler(channel);
  }
  ipcMain.handle(DESKTOP_CORE_CHANNELS.getState, handleGetState);
  ipcMain.handle(DESKTOP_CORE_CHANNELS.listCapabilities, handleListCapabilities);
  ipcMain.handle(DESKTOP_CORE_CHANNELS.ensureCapability, handleEnsureCapability);
  ipcMain.handle(DESKTOP_CORE_CHANNELS.listFeaturePacks, handleListFeaturePacks);
  ipcMain.handle(DESKTOP_CORE_CHANNELS.installFeaturePack, handleInstallFeaturePack);
  ipcMain.handle(DESKTOP_CORE_CHANNELS.repairFeaturePack, handleRepairFeaturePack);
  ipcMain.handle(DESKTOP_CORE_CHANNELS.uninstallFeaturePack, handleUninstallFeaturePack);
  const unsubscribe = core.subscribe(publishSnapshot);
  const unsubscribeFeaturePacks = featurePacks?.subscribe(publishFeaturePackProgress);

  /** Remove all IPC handlers and the Core state subscription. */
  function cleanup(): void {
    unsubscribe();
    unsubscribeFeaturePacks?.();
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.getState);
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.listCapabilities);
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.ensureCapability);
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.listFeaturePacks);
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.installFeaturePack);
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.repairFeaturePack);
    ipcMain.removeHandler(DESKTOP_CORE_CHANNELS.uninstallFeaturePack);
  }

  return cleanup;
}
