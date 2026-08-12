import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS } from "../contracts/application-enterprise-insights-runtime";
import type { ApplicationEnterpriseInsightsRuntimeService } from "../enterprise/application-enterprise-insights-runtime";
import { registerApplicationEnterpriseInsightsRuntimeIpc } from "./register-application-enterprise-insights-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 测试用 IPC Main；保存处理器并提供确定性调用入口，不访问 Electron。 */
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

test("Enterprise Insights IPC authorizes all seven handlers and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];

  /** 记录 Runtime 调用；输入方法名，返回固定成功对象，无外部副作用。 */
  function recordCall(name: string): { readonly success: true } {
    calls.push(name);
    return { success: true };
  }

  const runtime = {
    /** 记录用量读取；输入请求，返回固定成功对象。 */
    async loadUsageDashboard() { return recordCall("usage"); },
    /** 记录认知面板读取；输入请求，返回固定成功对象。 */
    async loadNeuroDashboard() { return recordCall("neuro"); },
    /** 记录认知搜索；输入请求，返回固定成功对象。 */
    async searchNeuroSymbols() { return recordCall("search"); },
    /** 记录认知删除；输入请求，返回固定成功对象。 */
    async removeNeuroSymbol() { return recordCall("remove"); },
    /** 记录认知维护；无输入，返回固定成功对象。 */
    async runNeuroMaintenance() { return recordCall("maintenance"); },
    /** 记录知识图谱读取；输入请求，返回固定成功对象。 */
    async loadKnowledgeGraph() { return recordCall("graph"); },
    /** 记录实体查询；输入请求，返回固定成功对象。 */
    async queryKnowledgeGraphEntity() { return recordCall("entity"); },
  } as unknown as ApplicationEnterpriseInsightsRuntimeService;
  let authorized = 0;
  const cleanup = registerApplicationEnterpriseInsightsRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== "trusted") throw new Error("Enterprise Insights IPC sender is not authorized.");
      authorized += 1;
    },
  });
  for (const channel of Object.values(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS)) {
    await ipcMain.invoke(channel, "trusted", {});
  }
  assert.equal(authorized, 7);
  assert.deepEqual(calls, ["usage", "neuro", "search", "remove", "maintenance", "graph", "entity"]);
  await assert.rejects(
    ipcMain.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadUsageDashboard, "untrusted", {}),
    /not authorized/,
  );
  assert.equal(calls.length, 7);
  cleanup();
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
