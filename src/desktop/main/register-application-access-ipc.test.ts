import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_ACCESS_CHANNELS } from "../contracts/application-access";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationAccessIpc } from "./register-application-access-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Minimal IPC harness used by account gateway adapter tests. */
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

test("registerApplicationAccessIpc authorizes and cleans up the gateway handler", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const requests: unknown[] = [];
  const cleanup = registerApplicationAccessIpc({
    ipcMain,
    access: {
      request: async (request) => {
        requests.push(request);
        return { ok: true, kind: "result" } as never;
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });
  const request = { path: "/v1/access/plans" };
  assert.deepEqual(
    await ipcMain.invoke(APPLICATION_ACCESS_CHANNELS.request, authorizedEvent, request),
    { ok: true, kind: "result" },
  );
  assert.deepEqual(requests, [request]);
  await assert.rejects(
    Promise.resolve(ipcMain.invoke(APPLICATION_ACCESS_CHANNELS.request, {}, request)),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
