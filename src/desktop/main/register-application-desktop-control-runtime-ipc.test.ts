import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS } from "../contracts/application-desktop-control-runtime";
import { registerApplicationDesktopControlRuntimeIpc } from "./register-application-desktop-control-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 保存 Desktop Control IPC 测试 handler；实例只在当前测试进程内使用。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();
  public readonly removed: string[] = [];

  /** 注册测试 handler；输入 channel 和回调，无返回，仅修改内存映射。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 移除测试 handler；输入 channel，无返回，并记录清理动作。 */
  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }
}

test("desktop control Runtime IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized: unknown[] = [];
  const calls: string[] = [];
  const cleanup = registerApplicationDesktopControlRuntimeIpc({
    ipcMain,
    runtime: {
      listWindows: async () => { calls.push("listWindows"); return {} as never; },
      listMonitors: async () => { calls.push("listMonitors"); return {} as never; },
      getActiveWindow: async () => { calls.push("getActiveWindow"); return {} as never; },
      listHistory: async () => { calls.push("listHistory"); return {} as never; },
      executeAction: async () => { calls.push("executeAction"); return {} as never; },
    },
    authorizeEvent: (event) => authorized.push(event),
  });

  for (const channel of Object.values(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS)) {
    await ipcMain.handlers.get(channel)?.({ sender: channel }, {});
  }
  assert.deepEqual(calls, ["listWindows", "listMonitors", "getActiveWindow", "listHistory", "executeAction"]);
  assert.equal(authorized.length, 5);

  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
  for (const channel of Object.values(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS)) {
    assert.ok(ipcMain.removed.includes(channel));
  }
});
