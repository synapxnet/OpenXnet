import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_CONNECTOR_RUNTIME_CHANNELS } from "../contracts/application-connector-runtime";
import { registerApplicationConnectorRuntimeIpc } from "./register-application-connector-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Minimal IPC harness used by Connector Runtime adapter tests. */
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
  public removeHandler(channel: string): void { this.handlers.delete(channel); }

  /** Invoke one registered handler with a synthetic event. */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return handler(event, ...arguments_);
  }
}

test("Connector Runtime IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const calls: string[] = [];
  const runtime = {
    status: async () => { calls.push("status"); return { operation: "status" } as never; },
    start: async () => { calls.push("start"); return { operation: "start" } as never; },
    stop: async () => { calls.push("stop"); return { operation: "stop" } as never; },
    reload: async () => { calls.push("reload"); return { operation: "reload" } as never; },
    update: async () => { calls.push("update"); return { operation: "update" } as never; },
  };
  const cleanup = registerApplicationConnectorRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });
  for (const channel of Object.values(APPLICATION_CONNECTOR_RUNTIME_CHANNELS)) {
    await ipcMain.invoke(channel, authorizedEvent, { platform: "qq", configuration: {} });
  }
  assert.deepEqual(calls, ["status", "start", "stop", "reload", "update"]);
  await assert.rejects(
    async () => ipcMain.invoke(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.status, {}, { platform: "qq" }),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
