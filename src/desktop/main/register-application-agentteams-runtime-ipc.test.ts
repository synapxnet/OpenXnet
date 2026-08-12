import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS } from "../contracts/application-agentteams-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationAgentTeamsRuntimeIpc } from "./register-application-agentteams-runtime-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 保存 AgentTeams IPC handlers 的最小测试适配器。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册处理器；输入通道和回调，无返回。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 移除处理器；输入通道，无返回。 */
  public removeHandler(channel: string): void { this.handlers.delete(channel); }

  /** 调用处理器；输入通道、事件和参数，返回回调结果，缺失时断言失败。 */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined);
    return handler(event, ...arguments_);
  }
}

test("AgentTeams Runtime IPC authorizes all bounded operations", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = {};
  const runtime = {
    status: async () => ({ state: "ready" }) as never,
    applyTeam: async () => ({ operation: "apply" }) as never,
    getTeam: async () => ({ operation: "get" }) as never,
  };
  const cleanup = registerApplicationAgentTeamsRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("unauthorized");
    },
  });

  await ipcMain.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.status, authorized);
  await ipcMain.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.applyTeam, authorized, {});
  await ipcMain.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.getTeam, authorized, {});
  await assert.rejects(
    async () => ipcMain.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.status, {}),
    /unauthorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
