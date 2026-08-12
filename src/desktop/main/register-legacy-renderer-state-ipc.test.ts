import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_RENDERER_STATE_CHANNELS,
  LEGACY_RENDERER_STATE_CHANGED_SCHEMA,
  LEGACY_RENDERER_STATE_SCHEMA,
  type LegacyRendererStateChangedEvent,
} from "../contracts/legacy-renderer-state";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";
import { registerLegacyRendererStateIpc } from "./register-legacy-renderer-state-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one synthetic compatibility state handler. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one synthetic compatibility state handler. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered synthetic compatibility state handler. */
  public async invoke(channel: string, event: unknown, request?: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("registerLegacyRendererStateIpc authorizes, publishes, and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  let listener: ((event: LegacyRendererStateChangedEvent) => void) | null = null;
  const calls: string[] = [];
  const sent: { channel: string; payload: unknown }[] = [];
  const snapshot = {
    schema: LEGACY_RENDERER_STATE_SCHEMA,
    settingsRevision: 0,
    conversationsRevision: 0,
    generatedAt: "2026-07-26T08:00:00.000Z",
    settings: {},
    conversations: [],
  } as const;
  const state = {
    getSnapshot: () => { calls.push("get"); return snapshot; },
    saveSettings: (_value: unknown) => { calls.push("settings"); return snapshot; },
    saveConversations: (_value: unknown) => { calls.push("conversations"); return snapshot; },
    saveVrmConfig: (_value: unknown) => { calls.push("vrm"); return snapshot; },
    subscribe: (nextListener: (event: LegacyRendererStateChangedEvent) => void) => {
      listener = nextListener;
      return () => { listener = null; };
    },
  };
  const webContents: WebContentsLike = {
    isDestroyed: () => false,
    send: (channel, payload) => sent.push({ channel, payload }),
  };
  const cleanup = registerLegacyRendererStateIpc({
    ipcMain,
    state,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
    getWebContents: () => [webContents, { isDestroyed: () => true, send: () => undefined }],
  });
  try {
    assert.equal(ipcMain.handlers.size, 4);
    await ipcMain.invoke(LEGACY_RENDERER_STATE_CHANNELS.getSnapshot, authorizedEvent);
    await ipcMain.invoke(LEGACY_RENDERER_STATE_CHANNELS.saveSettings, authorizedEvent, { settings: {} });
    await ipcMain.invoke(
      LEGACY_RENDERER_STATE_CHANNELS.saveConversations,
      authorizedEvent,
      { conversations: [] },
    );
    await ipcMain.invoke(LEGACY_RENDERER_STATE_CHANNELS.saveVrmConfig, authorizedEvent, { vrmConfig: {} });
    await assert.rejects(
      ipcMain.invoke(LEGACY_RENDERER_STATE_CHANNELS.getSnapshot, {}),
      /not authorized/,
    );
    assert.deepEqual(calls, ["get", "settings", "conversations", "vrm"]);

    const changed: LegacyRendererStateChangedEvent = {
      schema: LEGACY_RENDERER_STATE_CHANGED_SCHEMA,
      domain: "settings",
      snapshot,
    };
    assert.ok(listener);
    (listener as (event: LegacyRendererStateChangedEvent) => void)(changed);
    assert.deepEqual(sent, [{ channel: LEGACY_RENDERER_STATE_CHANNELS.changed, payload: changed }]);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
  assert.equal(listener, null);
});
