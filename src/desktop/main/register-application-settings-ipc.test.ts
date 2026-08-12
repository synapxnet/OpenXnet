import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  APPLICATION_SETTINGS_CHANNELS,
  DEFAULT_SYSTEM_SETTINGS,
} from "../contracts/application-settings";
import { bootstrapApplicationSettings } from "../storage/application-settings-bootstrap";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationSettingsIpc } from "./register-application-settings-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one test handler by channel. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one test handler by channel. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke a registered handler with a synthetic sender event. */
  public async invoke<TResult>(
    channel: string,
    event: unknown,
    ...arguments_: readonly unknown[]
  ): Promise<TResult> {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return await handler(event, ...arguments_) as TResult;
  }
}

test("registerApplicationSettingsIpc authorizes senders and validates settings requests", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-settings-ipc-"));
  const ipcMain = new TestIpcMain();
  const settings = bootstrapApplicationSettings({ userDataDirectory: directory });
  const authorizedEvent = { authorized: true };
  const cleanup = registerApplicationSettingsIpc({
    ipcMain,
    settings,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) {
        throw new Error("IPC sender is not authorized.");
      }
    },
  });
  try {
    const initial = await ipcMain.invoke(
      APPLICATION_SETTINGS_CHANNELS.getSystemSettings,
      authorizedEvent,
    );
    assert.deepEqual(initial, settings.getSystemSettings());
    const saved = await ipcMain.invoke<{ revision: number; settings: { theme: string } }>(
      APPLICATION_SETTINGS_CHANNELS.saveSystemSettings,
      authorizedEvent,
      { settings: { ...DEFAULT_SYSTEM_SETTINGS, theme: "ink", unsupported: "removed" } },
    );
    assert.equal(saved.revision, 1);
    assert.equal(saved.settings.theme, "ink");
    assert.equal("unsupported" in saved.settings, false);
    await assert.rejects(
      ipcMain.invoke(APPLICATION_SETTINGS_CHANNELS.getSystemSettings, {}),
      /IPC sender is not authorized/,
    );
    await assert.rejects(
      ipcMain.invoke(
        APPLICATION_SETTINGS_CHANNELS.saveSystemSettings,
        authorizedEvent,
        { settings: {}, unexpected: true },
      ),
      /system-settings object is required/,
    );
  } finally {
    cleanup();
    settings.close();
    rmSync(directory, { recursive: true, force: true });
  }
  assert.equal(ipcMain.handlers.size, 0);
});
