import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS } from "../contracts/application-toolchain-runtime";
import { registerApplicationToolchainRuntimeIpc } from "./register-application-toolchain-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 保存 Toolchain IPC 测试 handler；实例只在当前测试进程内使用。 */
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

test("toolchain Runtime IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized: unknown[] = [];
  const calls: string[] = [];
  const cleanup = registerApplicationToolchainRuntimeIpc({
    ipcMain,
    runtime: {
      probe: async () => { calls.push("probe"); return {} as never; },
      listDockerContainers: async () => { calls.push("listDockerContainers"); return {} as never; },
      pullDockerImage: async () => { calls.push("pullDockerImage"); return {} as never; },
      mutateDockerContainer: async () => { calls.push("mutateDockerContainer"); return {} as never; },
    },
    authorizeEvent: (event) => authorized.push(event),
  });

  for (const channel of Object.values(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS)) {
    await ipcMain.handlers.get(channel)?.({ sender: channel }, {});
  }
  assert.deepEqual(calls, ["probe", "listDockerContainers", "pullDockerImage", "mutateDockerContainer"]);
  assert.equal(authorized.length, 4);

  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
  for (const channel of Object.values(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS)) {
    assert.ok(ipcMain.removed.includes(channel));
  }
});
