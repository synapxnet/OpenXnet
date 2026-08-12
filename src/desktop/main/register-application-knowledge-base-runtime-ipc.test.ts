import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS } from "../contracts/application-knowledge-base-runtime";
import { registerApplicationKnowledgeBaseRuntimeIpc } from "./register-application-knowledge-base-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 保存知识库 IPC 测试 handler；无输入，实例仅在当前测试进程内使用。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();
  public readonly removed: string[] = [];

  /** 注册测试 handler；输入 channel 和回调，无返回。 */
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

test("knowledge base Runtime IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized: unknown[] = [];
  const calls: string[] = [];
  const cleanup = registerApplicationKnowledgeBaseRuntimeIpc({
    ipcMain,
    runtime: {
      build: async () => { calls.push("build"); return {} as never; },
      status: async () => { calls.push("status"); return {} as never; },
      remove: async () => { calls.push("remove"); return {} as never; },
      query: async () => { calls.push("query"); return {} as never; },
    },
    authorizeEvent: (event) => authorized.push(event),
  });

  for (const channel of Object.values(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS)) {
    await ipcMain.handlers.get(channel)?.({ sender: channel }, { knowledgeBaseId: "kb-one" });
  }
  assert.deepEqual(calls, ["build", "status", "remove", "query"]);
  assert.equal(authorized.length, 4);

  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
  for (const channel of Object.values(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS)) {
    assert.ok(ipcMain.removed.includes(channel));
  }
});
