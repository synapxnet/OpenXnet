import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_ENTERPRISE_RUNTIME_CHANNELS } from "../contracts/application-enterprise-runtime";
import type { ApplicationEnterpriseRuntimeService } from "../enterprise/application-enterprise-runtime";
import { registerApplicationEnterpriseRuntimeIpc } from "./register-application-enterprise-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 测试用 IPC Main；保存注册处理器并提供确定性调用入口，不访问 Electron。 */
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

test("Enterprise Runtime IPC authorizes all 25 handlers, routes requests and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];

  /** 记录 Runtime 方法调用；输入方法名，返回统一成功对象，无外部副作用。 */
  function recordCall(name: string): { readonly success: true } {
    calls.push(name);
    return { success: true };
  }

  const runtime = {
    /** 记录角色卡列表；无输入，返回固定成功对象。 */
    async listRoleCards() { return recordCall("listRoleCards"); },
    /** 记录角色卡保存；输入请求，返回固定成功对象。 */
    async saveRoleCard() { return recordCall("saveRoleCard"); },
    /** 记录角色卡删除；输入请求，返回固定成功对象。 */
    async removeRoleCard() { return recordCall("removeRoleCard"); },
    /** 记录团队模板列表；无输入，返回固定成功对象。 */
    async listTeamTemplates() { return recordCall("listTeamTemplates"); },
    /** 记录团队模板保存；输入请求，返回固定成功对象。 */
    async saveTeamTemplate() { return recordCall("saveTeamTemplate"); },
    /** 记录团队模板删除；输入请求，返回固定成功对象。 */
    async removeTeamTemplate() { return recordCall("removeTeamTemplate"); },
    /** 记录知识库列表；无输入，返回固定成功对象。 */
    async listKnowledgeBases() { return recordCall("listKnowledgeBases"); },
    /** 记录知识库保存；输入请求，返回固定成功对象。 */
    async saveKnowledgeBase() { return recordCall("saveKnowledgeBase"); },
    /** 记录知识库删除；输入请求，返回固定成功对象。 */
    async removeKnowledgeBase() { return recordCall("removeKnowledgeBase"); },
    /** 记录知识库版本列表；输入请求，返回固定成功对象。 */
    async listKnowledgeBaseVersions() { return recordCall("listKnowledgeBaseVersions"); },
    /** 记录工作区列表；无输入，返回固定成功对象。 */
    async listWorkspaces() { return recordCall("listWorkspaces"); },
    /** 记录工作区保存；输入请求，返回固定成功对象。 */
    async saveWorkspace() { return recordCall("saveWorkspace"); },
    /** 记录工作区删除；输入请求，返回固定成功对象。 */
    async removeWorkspace() { return recordCall("removeWorkspace"); },
    /** 记录项目楼层列表；无输入，返回固定成功对象。 */
    async listProjects() { return recordCall("listProjects"); },
    /** 记录项目楼层保存；输入请求，返回固定成功对象。 */
    async saveProject() { return recordCall("saveProject"); },
    /** 记录项目楼层删除；输入请求，返回固定成功对象。 */
    async removeProject() { return recordCall("removeProject"); },
    /** 记录企业消息列表；输入请求，返回固定成功对象。 */
    async listMessages() { return recordCall("listMessages"); },
    /** 记录企业消息发布；输入请求，返回固定成功对象。 */
    async postMessage() { return recordCall("postMessage"); },
    /** 记录企业 Skill 绑定列表；无输入，返回固定成功对象。 */
    async listSkillBindings() { return recordCall("listSkillBindings"); },
    /** 记录企业 Skill 绑定写入；输入请求，返回固定成功对象。 */
    async setSkillBinding() { return recordCall("setSkillBinding"); },
    /** 记录沙盘状态读取；无输入，返回固定成功对象。 */
    async getSandboxState() { return recordCall("getSandboxState"); },
    /** 记录 Xnet 服务列表；无输入，返回固定成功对象。 */
    async listXnetServices() { return recordCall("listXnetServices"); },
    /** 记录 Xnet 服务保存；输入请求，返回固定成功对象。 */
    async saveXnetService() { return recordCall("saveXnetService"); },
    /** 记录单项 Xnet 检查；输入请求，返回固定成功对象。 */
    async checkXnetService() { return recordCall("checkXnetService"); },
    /** 记录批量 Xnet 检查；输入请求，返回固定成功对象。 */
    async checkAllXnetServices() { return recordCall("checkAllXnetServices"); },
  } as unknown as ApplicationEnterpriseRuntimeService;
  let authorized = 0;
  const cleanup = registerApplicationEnterpriseRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== "trusted") throw new Error("Enterprise IPC sender is not authorized.");
      authorized += 1;
    },
  });

  const channels = Object.values(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS);
  assert.equal(channels.length, 25);
  for (const channel of channels) {
    await ipcMain.invoke(channel, "trusted", { marker: channel });
  }
  assert.equal(authorized, 25);
  assert.deepEqual(calls, [
    "listRoleCards",
    "saveRoleCard",
    "removeRoleCard",
    "listTeamTemplates",
    "saveTeamTemplate",
    "removeTeamTemplate",
    "listKnowledgeBases",
    "saveKnowledgeBase",
    "removeKnowledgeBase",
    "listKnowledgeBaseVersions",
    "listWorkspaces",
    "saveWorkspace",
    "removeWorkspace",
    "listProjects",
    "saveProject",
    "removeProject",
    "listMessages",
    "postMessage",
    "listSkillBindings",
    "setSkillBinding",
    "getSandboxState",
    "listXnetServices",
    "saveXnetService",
    "checkXnetService",
    "checkAllXnetServices",
  ]);
  await assert.rejects(
    ipcMain.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listRoleCards, "untrusted"),
    /not authorized/,
  );
  assert.equal(calls.length, 25);
  cleanup();
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
