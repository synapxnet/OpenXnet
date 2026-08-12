import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_MCP_RUNTIME_CHANNELS } from "../contracts/application-mcp-runtime";
import { registerApplicationMcpRuntimeIpc } from "./register-application-mcp-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 为 MCP Runtime IPC 测试保存处理器；输入频道和回调，无外部副作用。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册处理器；输入频道和回调，无返回，覆盖由生产适配器提前清理。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 移除处理器；输入频道，无返回。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

test("MCP Runtime IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = { authorized: true };
  const calls: string[] = [];
  const cleanup = registerApplicationMcpRuntimeIpc({
    ipcMain,
    runtime: {
      status: async () => { calls.push("status"); return {} as never; },
      start: async () => { calls.push("start"); return {} as never; },
      stop: async () => { calls.push("stop"); return {} as never; },
      listTools: async () => { calls.push("listTools"); return {} as never; },
    },
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("unauthorized");
    },
  });
  for (const channel of Object.values(APPLICATION_MCP_RUNTIME_CHANNELS)) {
    const handler = ipcMain.handlers.get(channel);
    assert.ok(handler);
    assert.throws(() => handler({}, { integration: "home-assistant" }), /unauthorized/);
    await handler(authorized, { integration: "home-assistant" });
  }
  assert.deepEqual(calls, ["status", "start", "stop", "listTools"]);
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
