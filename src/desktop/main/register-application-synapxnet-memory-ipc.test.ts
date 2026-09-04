import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_SYNAPXNET_MEMORY_CHANNELS } from "../contracts/application-synapxnet-memory-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationSynapxnetMemoryIpc } from "./register-application-synapxnet-memory-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  public async invoke(channel: string, event: unknown, request?: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("SynapXnet Memory IPC authorizes every V3 handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = { sender: "main" };
  const calls: string[] = [];
  const runtimeResult = { schema: "openxnet.synapxnet-memory-runtime.v1" } as never;
  const runtime = {
    recover: async () => { calls.push("recover"); return runtimeResult; },
    status: async () => { calls.push("status"); return runtimeResult; },
    list: async () => { calls.push("list"); return runtimeResult; },
    history: async () => { calls.push("history"); return runtimeResult; },
    create: async () => { calls.push("create"); return runtimeResult; },
    edit: async () => { calls.push("edit"); return runtimeResult; },
    rollback: async () => { calls.push("rollback"); return runtimeResult; },
    retire: async () => { calls.push("retire"); return runtimeResult; },
    export: async () => { calls.push("export"); return runtimeResult; },
    import: async () => { calls.push("import"); return runtimeResult; },
    verify: async () => { calls.push("verify"); return runtimeResult; },
  };
  const cleanup = registerApplicationSynapxnetMemoryIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("not authorized");
    },
  });

  try {
    assert.equal(ipcMain.handlers.size, Object.keys(APPLICATION_SYNAPXNET_MEMORY_CHANNELS).length);
    for (const channel of Object.values(APPLICATION_SYNAPXNET_MEMORY_CHANNELS)) {
      await ipcMain.invoke(channel, authorized, {});
    }
    await assert.rejects(
      ipcMain.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.status, {}, {}),
      /not authorized/,
    );
    assert.equal(calls.length, 11);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
});
