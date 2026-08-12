import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS } from "../contracts/application-code-sandbox-credentials";
import { registerApplicationCodeSandboxCredentialsIpc } from "./register-application-code-sandbox-credentials-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Minimal IPC harness used by code-sandbox credential adapter tests. */
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

test("Code-sandbox credential IPC authorizes every handler and cleans up", () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const cleanup = registerApplicationCodeSandboxCredentialsIpc({
    ipcMain,
    codeSandboxCredentials: {
      getSnapshot: () => ({ kind: "code-sandbox" }) as never,
      save: () => ({ kind: "code-sandbox-saved" }) as never,
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.getSnapshot, authorizedEvent),
    { kind: "code-sandbox" },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.save, authorizedEvent, {}),
    { kind: "code-sandbox-saved" },
  );
  assert.throws(
    () => ipcMain.invoke(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.getSnapshot, {}),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
