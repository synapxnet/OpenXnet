import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_RECALL_RUNTIME_CHANNELS } from "../contracts/application-recall-runtime";
import { registerApplicationRecallRuntimeIpc } from "./register-application-recall-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 内存 IPC Main 替身，记录 Recall handler 注册和清理。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册 handler；输入 channel 和函数，无返回。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    handler: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, handler as Handler);
  }

  /** 删除 handler；输入 channel，无返回。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

}

test("Recall IPC authorizes every command before invoking Runtime and cleans handlers", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];
  let authorized = false;
  const runtime = {
    /** 验证首屏调用顺序；无输入，返回测试结果。 */
    async bootstrap() {
      assert.equal(authorized, true);
      calls.push("bootstrap");
      return {} as never;
    },
    /** 验证搜索调用顺序；输入请求，返回测试结果。 */
    async search() {
      assert.equal(authorized, true);
      calls.push("search");
      return {} as never;
    },
    /** 验证时间线调用顺序；输入请求，返回测试结果。 */
    async timeline() {
      assert.equal(authorized, true);
      calls.push("timeline");
      return {} as never;
    },
    /** 验证观察流调用顺序；输入请求，返回测试结果。 */
    async observations() {
      assert.equal(authorized, true);
      calls.push("observations");
      return {} as never;
    },
    /** 验证恢复调用顺序；输入请求，返回测试结果。 */
    async resume() {
      assert.equal(authorized, true);
      calls.push("resume");
      return {} as never;
    },
    /** 验证回滚调用顺序；输入请求，返回测试结果。 */
    async rollback() {
      assert.equal(authorized, true);
      calls.push("rollback");
      return {} as never;
    },
    /** 验证焦点发布调用顺序；输入请求，返回测试结果。 */
    publishObservationFocus() {
      assert.equal(authorized, true);
      calls.push("focus");
      return {} as never;
    },
  };
  const cleanup = registerApplicationRecallRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: () => {
      authorized = true;
    },
  });

  for (const [channel, expected] of [
    [APPLICATION_RECALL_RUNTIME_CHANNELS.bootstrap, "bootstrap"],
    [APPLICATION_RECALL_RUNTIME_CHANNELS.search, "search"],
    [APPLICATION_RECALL_RUNTIME_CHANNELS.timeline, "timeline"],
    [APPLICATION_RECALL_RUNTIME_CHANNELS.observations, "observations"],
    [APPLICATION_RECALL_RUNTIME_CHANNELS.resume, "resume"],
    [APPLICATION_RECALL_RUNTIME_CHANNELS.rollback, "rollback"],
    [APPLICATION_RECALL_RUNTIME_CHANNELS.publishObservationFocus, "focus"],
  ] as const) {
    authorized = false;
    await ipcMain.handlers.get(channel)?.({}, {});
    assert.equal(calls.at(-1), expected);
  }
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
