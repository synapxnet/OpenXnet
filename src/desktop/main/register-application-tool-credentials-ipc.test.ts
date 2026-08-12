import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS } from "../contracts/application-http-tool-credentials";
import { APPLICATION_MCP_CREDENTIAL_CHANNELS } from "../contracts/application-mcp-credentials";
import { registerApplicationHttpToolCredentialsIpc } from "./register-application-http-tool-credentials-ipc";
import { registerApplicationMcpCredentialsIpc } from "./register-application-mcp-credentials-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Minimal IPC harness used by tool credential adapter tests. */
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

test("tool credential IPC adapters authorize and clean up independent channels", () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const authorizeEvent = (event: unknown): void => {
    if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
  };
  const cleanupMcp = registerApplicationMcpCredentialsIpc({
    ipcMain,
    mcpCredentials: {
      getSnapshot: () => ({ kind: "mcp" }) as never,
      save: () => ({ kind: "mcp-saved" }) as never,
    },
    authorizeEvent,
  });
  const cleanupHttp = registerApplicationHttpToolCredentialsIpc({
    ipcMain,
    httpToolCredentials: {
      getSnapshot: () => ({ kind: "http" }) as never,
      save: () => ({ kind: "http-saved" }) as never,
    },
    authorizeEvent,
  });
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_MCP_CREDENTIAL_CHANNELS.getSnapshot, authorizedEvent),
    { kind: "mcp" },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.save, authorizedEvent, {}),
    { kind: "http-saved" },
  );
  assert.throws(
    () => ipcMain.invoke(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.getSnapshot, {}),
    /not authorized/,
  );
  cleanupMcp();
  cleanupHttp();
  assert.equal(ipcMain.handlers.size, 0);
});
