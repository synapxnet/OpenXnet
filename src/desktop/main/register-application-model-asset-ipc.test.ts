import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_MODEL_ASSET_CHANNELS } from "../contracts/application-model-assets";
import type { ApplicationModelAssetRuntimeService } from "../model-assets/application-model-asset-runtime";
import { registerApplicationModelAssetIpc } from "./register-application-model-asset-ipc";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 测试用 IPC Main；保存处理器并提供确定性调用入口，不访问 Electron。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册处理器；输入通道和监听器，无返回，会覆盖同名处理器。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 移除处理器；输入通道，无返回，不存在时忽略。 */
  public removeHandler(channel: string): void { this.handlers.delete(channel); }

  /** 调用处理器；输入通道、事件和参数，返回结果，通道缺失时断言失败。 */
  public async invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return await handler(event, ...arguments_);
  }
}

test("Model Asset IPC authorizes commands, broadcasts progress and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];
  const sent: unknown[] = [];
  let progressListener: ((event: unknown) => void) | null = null;
  const runtime = {
    /** 记录状态读取；输入请求，返回固定结果。 */
    async getStatus() { calls.push("status"); return { state: "not-installed" }; },
    /** 记录下载；输入请求，返回固定结果。 */
    async download() { calls.push("download"); return { state: "installed" }; },
    /** 记录删除；输入请求，返回固定结果。 */
    async remove() { calls.push("remove"); return { state: "not-installed" }; },
    /** 保存进度监听器；输入监听器，返回清理函数。 */
    subscribe(listener: (event: unknown) => void) { progressListener = listener; return () => { progressListener = null; }; },
  } as unknown as ApplicationModelAssetRuntimeService;
  const webContents = {
    /** 返回窗口未销毁；无输入，返回 false。 */
    isDestroyed: () => false,
    /** 记录发送事件；输入通道和载荷，无返回。 */
    send: (channel: string, payload: unknown) => { sent.push({ channel, payload }); },
  } as WebContentsLike;
  const cleanup = registerApplicationModelAssetIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => { if (event !== "trusted") throw new Error("not authorized"); },
    getWebContents: () => [webContents],
  });
  await ipcMain.invoke(APPLICATION_MODEL_ASSET_CHANNELS.getStatus, "trusted", { kind: "sherpa" });
  await ipcMain.invoke(APPLICATION_MODEL_ASSET_CHANNELS.download, "trusted", { kind: "sherpa", source: "modelscope" });
  await ipcMain.invoke(APPLICATION_MODEL_ASSET_CHANNELS.remove, "trusted", { kind: "sherpa" });
  assert.deepEqual(calls, ["status", "download", "remove"]);
  await assert.rejects(ipcMain.invoke(APPLICATION_MODEL_ASSET_CHANNELS.getStatus, "untrusted", {}), /not authorized/);
  assert.equal(calls.length, 3);
  assert.ok(progressListener);
  (progressListener as (event: unknown) => void)({ phase: "downloading" });
  assert.deepEqual(sent, [{ channel: APPLICATION_MODEL_ASSET_CHANNELS.progress, payload: { phase: "downloading" } }]);
  cleanup();
  cleanup();
  assert.equal(progressListener, null);
  assert.equal(ipcMain.handlers.size, 0);
});
