import assert from "node:assert/strict";
import test from "node:test";

import { DESKTOP_BOOTSTRAP_CHANNEL, DESKTOP_BOOTSTRAP_SCHEMA } from "../contracts/desktop-bootstrap";
import { DEFAULT_RUNTIME_SETTINGS, DEFAULT_SYSTEM_SETTINGS, SYSTEM_SETTINGS_SCHEMA } from "../contracts/application-settings";
import { createDesktopCore } from "../core/desktop-core";
import type { IpcMainLike } from "./register-core-ipc";
import { registerDesktopBootstrapIpc } from "./register-desktop-bootstrap-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one synthetic IPC handler. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one synthetic IPC handler. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered synthetic IPC handler. */
  public async invoke<TResult>(channel: string, event: unknown): Promise<TResult> {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return await handler(event) as TResult;
  }
}

test("registerDesktopBootstrapIpc returns one authorized consistent startup snapshot", async () => {
  const ipcMain = new TestIpcMain();
  const core = createDesktopCore();
  await core.start();
  const authorizedEvent = { sender: "main" };
  const cleanup = registerDesktopBootstrapIpc({
    ipcMain,
    core,
    settings: {
      getSystemSettings: () => ({
        schema: SYSTEM_SETTINGS_SCHEMA,
        revision: 0,
        settings: DEFAULT_SYSTEM_SETTINGS,
        updatedAt: null,
      }),
      getRuntimeSettings: () => DEFAULT_RUNTIME_SETTINGS,
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) {
        throw new Error("IPC sender is not authorized.");
      }
    },
    getApplication: () => ({
      version: "1.0.2",
      platform: "win32",
      architecture: "x64",
      locale: "zh-CN",
      packaged: true,
    }),
    now: () => new Date("2026-07-23T07:00:00.000Z"),
  });
  try {
    const snapshot = await ipcMain.invoke<{
      schema: string;
      generatedAt: string;
      core: { capabilities: readonly unknown[] };
      systemSettings: { revision: number };
    }>(DESKTOP_BOOTSTRAP_CHANNEL, authorizedEvent);
    assert.equal(snapshot.schema, DESKTOP_BOOTSTRAP_SCHEMA);
    assert.equal(snapshot.generatedAt, "2026-07-23T07:00:00.000Z");
    assert.equal(snapshot.systemSettings.revision, 0);
    assert.ok(snapshot.core.capabilities.length > 0);
    await assert.rejects(
      ipcMain.invoke(DESKTOP_BOOTSTRAP_CHANNEL, {}),
      /IPC sender is not authorized/,
    );
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.has(DESKTOP_BOOTSTRAP_CHANNEL), false);
});
