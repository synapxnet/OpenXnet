import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_LIVE_RUNTIME_CHANNELS } from "../contracts/application-live-runtime";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";
import { registerApplicationLiveRuntimeIpc } from "./register-application-live-runtime-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 保存 Live IPC handlers 的最小测试适配器。 */
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

test("Live Runtime IPC authorizes requests and broadcasts events", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = {};
  let subscriber: ((event: never) => void) | null = null;
  const sent: unknown[] = [];
  const webContents: WebContentsLike = {
    isDestroyed: () => false,
    send: (_channel, payload) => { sent.push(payload); },
  };
  const runtime = {
    status: async () => ({ operation: "status" }) as never,
    start: async () => ({ operation: "start" }) as never,
    stop: async () => ({ operation: "stop" }) as never,
    reload: async () => ({ operation: "reload" }) as never,
    subscribe: (listener: (event: never) => void) => {
      subscriber = listener;
      return () => { subscriber = null; };
    },
  };
  const cleanup = registerApplicationLiveRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("unauthorized");
    },
    getWebContents: () => [webContents],
  });
  await ipcMain.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.status, authorized);
  await ipcMain.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.start, authorized, { configuration: {} });
  await ipcMain.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.stop, authorized);
  await ipcMain.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.reload, authorized, { configuration: {} });
  assert.ok(subscriber !== null);
  (subscriber as (event: never) => void)({ id: "event" } as never);
  assert.equal(sent.length, 1);
  await assert.rejects(
    async () => ipcMain.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.status, {}),
    /unauthorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
  assert.equal(subscriber, null);
});
