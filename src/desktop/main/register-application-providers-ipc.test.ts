import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_PROVIDER_CHANNELS,
  APPLICATION_PROVIDER_SCHEMA,
} from "../contracts/application-providers";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationProvidersIpc } from "./register-application-providers-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Synthetic IPC registry used to test provider sender authorization. */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one provider IPC handler. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one provider IPC handler. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered provider IPC handler. */
  public async invoke(channel: string, event: unknown, request?: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("registerApplicationProvidersIpc authorizes, dispatches, and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  const calls: string[] = [];
  const snapshot = {
    schema: APPLICATION_PROVIDER_SCHEMA,
    revision: 0,
    providers: [],
    updatedAt: null,
    secureStorage: "desktop-safe-storage",
  } as const;
  const cleanup = registerApplicationProvidersIpc({
    ipcMain,
    providers: {
      getSnapshot: () => { calls.push("get"); return snapshot; },
      saveProviders: () => { calls.push("save"); return snapshot; },
      validateProvider: async () => {
        calls.push("validate");
        return {
          status: "ready",
          message: "ready",
          vendor: "OpenAI",
          url: "https://provider.example.test/v1",
          modelId: "model-a",
          apiKeyConfigured: true,
          apiKeyOptional: false,
          matchedModel: true,
          models: ["model-a"],
          checks: [],
        };
      },
      probeEmbeddingDimensions: async () => {
        calls.push("probe-embedding");
        return {
          providerId: "provider-a",
          modelId: "model-a",
          dimensions: 3,
        };
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });
  try {
    assert.equal(ipcMain.handlers.size, 4);
    await ipcMain.invoke(APPLICATION_PROVIDER_CHANNELS.getSnapshot, authorizedEvent);
    await ipcMain.invoke(APPLICATION_PROVIDER_CHANNELS.saveProviders, authorizedEvent, { providers: [] });
    await ipcMain.invoke(APPLICATION_PROVIDER_CHANNELS.validateProvider, authorizedEvent, {});
    await ipcMain.invoke(
      APPLICATION_PROVIDER_CHANNELS.probeEmbedding,
      authorizedEvent,
      { providerId: "provider-a" },
    );
    await assert.rejects(
      ipcMain.invoke(APPLICATION_PROVIDER_CHANNELS.getSnapshot, {}),
      /not authorized/,
    );
    assert.deepEqual(calls, ["get", "save", "validate", "probe-embedding"]);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
});
