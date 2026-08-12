import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_VR_ASSET_CHANNELS } from "../contracts/application-vr-assets";
import type { ApplicationVrAssetRuntimeService } from "../vr-assets/application-vr-asset-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationVrAssetIpc } from "./register-application-vr-asset-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 测试用 IPC Main，保存并调用注册处理器。 */
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

test("VR Asset IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];
  const runtime = {
    /** 记录目录调用；无输入，返回固定结果。 */
    async listAssets() { calls.push("list"); return { success: true }; },
    /** 记录导入调用；输入请求，返回固定结果。 */
    async importAsset() { calls.push("import"); return { success: true }; },
    /** 记录删除调用；输入请求，返回固定结果。 */
    async deleteAsset() { calls.push("delete"); return { success: true }; },
    /** 记录下载调用；输入请求，返回固定结果。 */
    async downloadCloudModel() { calls.push("download"); return { success: true }; },
  } as unknown as ApplicationVrAssetRuntimeService;
  let authorized = 0;
  const cleanup = registerApplicationVrAssetIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== "trusted") throw new Error("VR asset IPC sender is not authorized.");
      authorized += 1;
    },
  });
  for (const channel of Object.values(APPLICATION_VR_ASSET_CHANNELS)) {
    await ipcMain.invoke(channel, "trusted", {});
  }
  assert.equal(authorized, 4);
  assert.deepEqual(calls, ["list", "import", "delete", "download"]);
  await assert.rejects(ipcMain.invoke(APPLICATION_VR_ASSET_CHANNELS.list, "untrusted"), /not authorized/);
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
