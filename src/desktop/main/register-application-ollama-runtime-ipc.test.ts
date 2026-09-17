import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_OLLAMA_RUNTIME_CHANNELS } from "../contracts/application-ollama-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationOllamaRuntimeIpc } from "./register-application-ollama-runtime-ipc";

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, (event: unknown, request?: unknown) => unknown>();
  public handle<TArguments extends readonly unknown[], TResult>(channel: string, listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>): void {
    this.handlers.set(channel, listener as unknown as (event: unknown, request?: unknown) => unknown);
  }
  public removeHandler(channel: string): void { this.handlers.delete(channel); }
}

test("Ollama IPC authorizes and dispatches discovery", async () => {
  const ipcMain = new TestIpcMain();
  const allowed = {};
  const cleanup = registerApplicationOllamaRuntimeIpc({
    ipcMain,
    runtime: { discover: async (request) => ({ schema: "openxnet.ollama-discovery.v1", status: "offline", baseUrl: "http://127.0.0.1:11434", version: null, models: [], checkedAt: String(request) }) },
    authorizeEvent: (event) => { if (event !== allowed) throw new Error("not authorized"); },
  });
  const handler = ipcMain.handlers.get(APPLICATION_OLLAMA_RUNTIME_CHANNELS.discover);
  assert.ok(handler);
  await assert.rejects(async () => handler({}), /not authorized/);
  const result = await handler(allowed, {});
  assert.equal((result as { status: string }).status, "offline");
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
