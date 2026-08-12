import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_MEMORY_MANAGEMENT_CHANNELS } from "../contracts/application-memory-management-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationMemoryManagementIpc } from "./register-application-memory-management-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Memory IPC 测试注册表；保存 handler 并支持受控调用。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册 handler；输入 channel 和函数，无返回，仅修改测试映射。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 移除 handler；输入 channel，无返回，仅修改测试映射。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 调用 handler；输入 channel、事件和请求，输出结果，缺失 handler 时断言失败。 */
  public async invoke(channel: string, event: unknown, request?: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("Memory Management IPC authorizes all handlers and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = { sender: "main" };
  const calls: string[] = [];
  const cleanup = registerApplicationMemoryManagementIpc({
    ipcMain,
    runtime: {
      listRecords: async () => {
        calls.push("list");
        return { schema: "openxnet.application-memory-management.v1", memoryId: "memory", records: [] };
      },
      updateRecord: async () => {
        calls.push("update");
        return { schema: "openxnet.application-memory-management.v1", memoryId: "memory", recordId: "record", action: "updated" };
      },
      deleteRecord: async () => {
        calls.push("delete");
        return { schema: "openxnet.application-memory-management.v1", memoryId: "memory", recordId: "record", action: "deleted" };
      },
      removeCollection: async () => {
        calls.push("remove");
        return { schema: "openxnet.application-memory-management.v1", memoryId: "memory", recordId: "", action: "removed" };
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("not authorized");
    },
  });
  try {
    assert.equal(ipcMain.handlers.size, 4);
    for (const channel of Object.values(APPLICATION_MEMORY_MANAGEMENT_CHANNELS)) {
      await ipcMain.invoke(channel, authorized, {});
    }
    await assert.rejects(
      ipcMain.invoke(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.listRecords, {}, {}),
      /not authorized/,
    );
    assert.deepEqual(calls, ["list", "update", "delete", "remove"]);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
});
