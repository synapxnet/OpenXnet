import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_SYSTEM_RUNTIME_CHANNELS } from "../contracts/application-system-runtime";
import { registerApplicationSystemRuntimeIpc } from "./register-application-system-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 为 System Runtime IPC 测试保存和调用 handler 的最小实现。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 保存一个 handler；重复通道由 adapter 在注册前清理。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 删除一个精确通道 handler；通道不存在时幂等返回。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 使用测试事件调用已注册 handler；通道缺失时断言失败。 */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined);
    return handler(event, ...arguments_);
  }
}

test("System Runtime IPC authorizes every operation and removes all handlers", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  const cleanup = registerApplicationSystemRuntimeIpc({
    ipcMain,
    runtime: {
      applyProxy: async () => ({ success: true, mode: "system", chinaMirror: false }),
      revealDirectory: async () => ({ opened: true }),
      getNetworkAddress: () => ({ address: "127.0.0.1" }),
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });

  assert.deepEqual(
    await ipcMain.invoke(APPLICATION_SYSTEM_RUNTIME_CHANNELS.applyProxy, authorizedEvent),
    { success: true, mode: "system", chinaMirror: false },
  );
  assert.deepEqual(
    await ipcMain.invoke(
      APPLICATION_SYSTEM_RUNTIME_CHANNELS.revealDirectory,
      authorizedEvent,
      { directory: "logs" },
    ),
    { opened: true },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress, authorizedEvent),
    { address: "127.0.0.1" },
  );
  assert.throws(
    () => ipcMain.invoke(APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress, {}),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
