import assert from "node:assert/strict";
import test from "node:test";

import { DESKTOP_CORE_CHANNELS } from "../contracts/channels";
import type {
  FeaturePackCapabilityId,
  FeaturePackDistributionSnapshot,
  FeaturePackMutationResult,
  FeaturePackProgressEvent,
} from "../contracts/feature-pack-distribution";
import { createDesktopCore } from "../core/desktop-core";
import {
  registerDesktopCoreIpc,
  type FeaturePackDistributionLike,
  type IpcMainLike,
  type WebContentsLike,
} from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** In-memory Electron IPC Main replacement used by allow-list tests. */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one handler by channel. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one handler by channel. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke a registered handler as an untrusted Renderer would. */
  public async invoke<TResult>(channel: string, ...arguments_: readonly unknown[]): Promise<TResult> {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return await handler({}, ...arguments_) as TResult;
  }
}

/** Controllable Feature Pack service replacement used by the IPC adapter test. */
class TestFeaturePacks implements FeaturePackDistributionLike {
  public readonly calls: string[] = [];
  private listener: ((event: FeaturePackProgressEvent) => void) | null = null;

  /** Return an empty but configured Feature Pack snapshot. */
  public async list(refresh = true): Promise<FeaturePackDistributionSnapshot> {
    this.calls.push(`list:${refresh}`);
    return {
      feedStatus: "ready",
      catalogGeneratedAt: "2026-07-23T00:00:00.000Z",
      refreshedAt: "2026-07-23T00:00:00.000Z",
      packs: [],
    };
  }

  /** Record a validated install request. */
  public async install(capabilityId: FeaturePackCapabilityId): Promise<FeaturePackMutationResult> {
    return this.recordMutation(capabilityId, "install");
  }

  /** Record a validated repair request. */
  public async repair(capabilityId: FeaturePackCapabilityId): Promise<FeaturePackMutationResult> {
    return this.recordMutation(capabilityId, "repair");
  }

  /** Record a validated uninstall request. */
  public async uninstall(capabilityId: FeaturePackCapabilityId): Promise<FeaturePackMutationResult> {
    return this.recordMutation(capabilityId, "uninstall");
  }

  /** Capture the progress listener registered by the IPC adapter. */
  public subscribe(listener: (event: FeaturePackProgressEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  /** Emit one progress event to the captured listener. */
  public emit(event: FeaturePackProgressEvent): void {
    this.listener?.(event);
  }

  /** Build a deterministic successful mutation result. */
  private recordMutation(
    capabilityId: FeaturePackCapabilityId,
    operation: FeaturePackMutationResult["operation"],
  ): FeaturePackMutationResult {
    this.calls.push(`${operation}:${capabilityId}`);
    return { capabilityId, operation, version: "1.0.0", restartRequired: true };
  }
}

/** Renderer target collecting Main-process event broadcasts. */
class TestWebContents implements WebContentsLike {
  public readonly messages: Array<{ channel: string; payload: unknown }> = [];

  /** Report the Renderer target as active. */
  public isDestroyed(): boolean {
    return false;
  }

  /** Capture one outbound event. */
  public send(channel: string, payload: unknown): void {
    this.messages.push({ channel, payload });
  }
}

test("registerDesktopCoreIpc enforces Feature Pack request allow-lists and publishes progress", async () => {
  const ipcMain = new TestIpcMain();
  const featurePacks = new TestFeaturePacks();
  const webContents = new TestWebContents();
  let senderAuthorized = true;
  const cleanup = registerDesktopCoreIpc({
    ipcMain,
    core: createDesktopCore(),
    featurePacks,
    authorizeEvent: () => {
      if (!senderAuthorized) throw new Error("IPC sender is not authorized.");
    },
    getWebContents: () => [webContents],
  });

  try {
    await ipcMain.invoke(DESKTOP_CORE_CHANNELS.listFeaturePacks, { refresh: false });
    await ipcMain.invoke(DESKTOP_CORE_CHANNELS.installFeaturePack, { capabilityId: "voice" });
    await ipcMain.invoke(DESKTOP_CORE_CHANNELS.repairFeaturePack, { capabilityId: "voice" });
    await ipcMain.invoke(DESKTOP_CORE_CHANNELS.uninstallFeaturePack, { capabilityId: "voice" });
    assert.deepEqual(featurePacks.calls, [
      "list:false",
      "install:voice",
      "repair:voice",
      "uninstall:voice",
    ]);

    await assert.rejects(
      ipcMain.invoke(DESKTOP_CORE_CHANNELS.installFeaturePack, { capabilityId: "core" }),
      /FEATURE_PACK_OPERATION_FAILED/,
    );
    await assert.rejects(
      ipcMain.invoke(DESKTOP_CORE_CHANNELS.installFeaturePack, {
        capabilityId: "voice",
        sourcePath: "C:\\sensitive\\pack",
      }),
      (error: unknown) => error instanceof Error && !error.message.includes("sensitive"),
    );
    senderAuthorized = false;
    await assert.rejects(
      ipcMain.invoke(DESKTOP_CORE_CHANNELS.getState),
      /IPC sender is not authorized/,
    );
    senderAuthorized = true;

    const progress: FeaturePackProgressEvent = {
      operationId: "operation-1",
      capabilityId: "voice",
      operation: "install",
      phase: "downloading",
      percent: 50,
      transferredBytes: 5,
      totalBytes: 10,
    };
    featurePacks.emit(progress);
    assert.deepEqual(webContents.messages.at(-1), {
      channel: DESKTOP_CORE_CHANNELS.featurePackProgress,
      payload: progress,
    });
  } finally {
    cleanup();
  }

  assert.equal(ipcMain.handlers.has(DESKTOP_CORE_CHANNELS.installFeaturePack), false);
});
