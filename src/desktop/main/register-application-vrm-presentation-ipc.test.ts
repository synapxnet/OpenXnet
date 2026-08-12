import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_VRM_PRESENTATION_CHANNELS } from "../contracts/application-vrm-presentation-runtime";
import { registerApplicationVrmPresentationIpc } from "./register-application-vrm-presentation-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 为 VRM Presentation IPC 测试保存和调用 handler 的最小实现。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 保存一个 handler；重复通道由 adapter 在注册前清理。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 删除一个精确通道 handler；通道不存在时幂等返回。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 使用测试事件调用已注册 handler；通道缺失时断言失败。 */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined);
    return handler(event, ...arguments_);
  }
}

test("VRM Presentation IPC authorizes status, publish, and configuration before cleanup", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  const authorizedVrmEvent = { sender: "vrm" };
  const request = { type: "stopSpeaking", data: {} };
  const cleanup = registerApplicationVrmPresentationIpc({
    ipcMain,
    runtime: {
      getStatus: () => ({ connections: 1 }),
      publish: (value) => {
        assert.equal(value, request);
        return { delivered: 1 };
      },
      getConfiguration: async () => ({ language: "zh-CN", vrmConfig: { name: "default" } }),
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
    authorizeVrmEvent: (event) => {
      if (event !== authorizedVrmEvent) throw new Error("VRM IPC sender is not authorized.");
    },
  });

  assert.deepEqual(
    ipcMain.invoke(APPLICATION_VRM_PRESENTATION_CHANNELS.status, authorizedEvent),
    { connections: 1 },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_VRM_PRESENTATION_CHANNELS.publish, authorizedEvent, request),
    { delivered: 1 },
  );
  assert.deepEqual(
    await ipcMain.invoke(APPLICATION_VRM_PRESENTATION_CHANNELS.configuration, authorizedVrmEvent),
    { language: "zh-CN", vrmConfig: { name: "default" } },
  );
  assert.throws(
    () => ipcMain.invoke(APPLICATION_VRM_PRESENTATION_CHANNELS.publish, {}, request),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
