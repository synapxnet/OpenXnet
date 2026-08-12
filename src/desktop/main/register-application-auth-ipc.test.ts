import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_AUTH_CHANNELS } from "../contracts/application-auth";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationAuthIpc } from "./register-application-auth-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Minimal IPC harness used by the authentication boundary tests. */
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
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return handler(event, ...arguments_);
  }
}

test("registerApplicationAuthIpc authorizes every authentication operation", () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const calls: string[] = [];
  const cleanup = registerApplicationAuthIpc({
    ipcMain,
    auth: {
      getSession: () => {
        calls.push("get");
        return { kind: "snapshot" } as never;
      },
      saveSession: () => {
        calls.push("save");
        return { kind: "saved" } as never;
      },
      clearSession: () => {
        calls.push("clear");
        return { kind: "cleared" } as never;
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) {
        throw new Error("IPC sender is not authorized.");
      }
    },
  });
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_AUTH_CHANNELS.getSession, authorizedEvent),
    { kind: "snapshot" },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_AUTH_CHANNELS.saveSession, authorizedEvent, {}),
    { kind: "saved" },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_AUTH_CHANNELS.clearSession, authorizedEvent),
    { kind: "cleared" },
  );
  assert.deepEqual(calls, ["get", "save", "clear"]);
  assert.throws(
    () => ipcMain.invoke(APPLICATION_AUTH_CHANNELS.getSession, {}),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
