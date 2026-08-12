import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_KERNEL_RUNTIME_CHANNELS } from "../contracts/application-kernel-runtime";
import type { ApplicationKernelRuntimeService } from "../kernel/application-kernel-runtime";
import { registerApplicationKernelRuntimeIpc } from "./register-application-kernel-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 测试用 IPC Main；保存处理器并提供确定性调用入口，不访问 Electron。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册测试处理器；输入通道和监听器，无返回，会覆盖同名处理器。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 移除测试处理器；输入通道，无返回，不存在时忽略。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 调用测试处理器；输入通道、事件和参数，返回结果，通道缺失时断言失败。 */
  public async invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler, `Missing handler for ${channel}`);
    return await handler(event, ...arguments_);
  }
}

test("Kernel Runtime IPC authorizes before invoking and cleans up idempotently", async () => {
  const ipcMain = new TestIpcMain();
  const calls: unknown[] = [];
  const runtime = {
    /** 记录 Kernel 调用；输入命令，返回固定结果，不访问引擎。 */
    async invoke(request: unknown) {
      calls.push(request);
      return { schema: "openxnet.kernel-runtime.v1", success: true, operation: "status", data: { ok: true } };
    },
  } as unknown as ApplicationKernelRuntimeService;
  const cleanup = registerApplicationKernelRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== "trusted") throw new Error("Kernel Runtime IPC sender is not authorized.");
    },
  });
  const command = { operation: "status", payload: {} };
  await ipcMain.invoke(APPLICATION_KERNEL_RUNTIME_CHANNELS.invoke, "trusted", command);
  assert.deepEqual(calls, [command]);
  await assert.rejects(
    ipcMain.invoke(APPLICATION_KERNEL_RUNTIME_CHANNELS.invoke, "untrusted", command),
    /not authorized/i,
  );
  assert.equal(calls.length, 1);
  cleanup();
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
