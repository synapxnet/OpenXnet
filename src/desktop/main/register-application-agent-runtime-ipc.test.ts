import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_AGENT_RUNTIME_CHANNELS } from "../contracts/application-agent-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationAgentRuntimeIpc } from "./register-application-agent-runtime-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** Agent IPC 测试注册表；保存 handler 并支持受控调用。 */
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

  /** 调用 handler；输入 channel、事件和请求，输出异步结果，缺失 handler 时断言失败。 */
  public async invoke(channel: string, event: unknown, request?: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("Agent Runtime IPC authorizes all handlers and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = { sender: "main" };
  const calls: string[] = [];
  const cleanup = registerApplicationAgentRuntimeIpc({
    ipcMain,
    runtime: {
      createAgent: async () => {
        calls.push("create");
        return { schema: "openxnet.application-agent-runtime.v1", action: "created", agentId: "agent123", agent: { id: "agent123", name: "Agent", systemPrompt: "Prompt", enabled: false } };
      },
      removeAgent: async () => {
        calls.push("remove");
        return { schema: "openxnet.application-agent-runtime.v1", action: "removed", agentId: "agent123", agent: null };
      },
      inspectA2a: async () => {
        calls.push("a2a");
        return { schema: "openxnet.application-agent-runtime.v1", url: "https://agent.example.test", name: "Agent", description: "", version: "1", skills: [], status: "ready", enabled: true };
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("not authorized");
    },
  });
  try {
    assert.equal(ipcMain.handlers.size, 3);
    await ipcMain.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.createAgent, authorized, {});
    await ipcMain.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.removeAgent, authorized, {});
    await ipcMain.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.inspectA2a, authorized, {});
    await assert.rejects(ipcMain.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.createAgent, {}, {}), /not authorized/);
    assert.deepEqual(calls, ["create", "remove", "a2a"]);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
});
