import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_SEARCH_CREDENTIAL_CHANNELS } from "../contracts/application-search-credentials";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationSearchCredentialsIpc } from "./register-application-search-credentials-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Minimal IPC harness used by search credential adapter tests. */
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

  /** Invoke one registered handler with a synthetic event. */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return handler(event, ...arguments_);
  }
}

test("registerApplicationSearchCredentialsIpc authorizes and cleans up every handler", () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const calls: string[] = [];
  const cleanup = registerApplicationSearchCredentialsIpc({
    ipcMain,
    searchCredentials: {
      getSnapshot: () => {
        calls.push("get");
        return { kind: "snapshot" } as never;
      },
      save: () => {
        calls.push("save");
        return { kind: "saved" } as never;
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.getSnapshot, authorizedEvent),
    { kind: "snapshot" },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.save, authorizedEvent, {}),
    { kind: "saved" },
  );
  assert.deepEqual(calls, ["get", "save"]);
  assert.throws(
    () => ipcMain.invoke(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.getSnapshot, {}),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
