import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_EXTENSION_RUNTIME_CHANNELS } from "../contracts/application-extensions-runtime";
import { APPLICATION_SKILL_RUNTIME_CHANNELS } from "../contracts/application-skills-runtime";
import type { ApplicationExtensionRuntimeService } from "../extensions/application-extension-runtime";
import type { ApplicationSkillRuntimeService } from "../skills/application-skill-runtime";
import { registerApplicationExtensionRuntimeIpc } from "./register-application-extension-runtime-ipc";
import { registerApplicationSkillRuntimeIpc } from "./register-application-skill-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 测试用 IPC Main；输入注册调用并保存处理器，支持受控调用和清理断言。 */
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

test("Extension Runtime IPC authorizes every handler and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];
  const runtime = {
    /** 记录扩展列表；无输入，返回固定结果。 */
    async listExtensions() { calls.push("list"); return { success: true }; },
    /** 记录远端列表；无输入，返回固定结果。 */
    async listRemoteExtensions() { calls.push("remote"); return { success: true }; },
    /** 记录仓库安装；输入请求，返回固定结果。 */
    async installFromRepository() { calls.push("install"); return { success: true }; },
    /** 记录 ZIP 导入；输入请求，返回固定结果。 */
    async importArchive() { calls.push("import"); return { success: true }; },
    /** 记录扩展更新；输入请求，返回固定结果。 */
    async updateExtension() { calls.push("update"); return { success: true }; },
    /** 记录扩展删除；输入请求，返回固定结果。 */
    async removeExtension() { calls.push("remove"); return { success: true }; },
    /** 记录扩展启动；输入请求，返回固定结果。 */
    async startExtension() { calls.push("start"); return { success: true }; },
    /** 记录扩展停止；输入请求，返回固定结果。 */
    async stopExtension() { calls.push("stop"); return { success: true }; },
  } as unknown as ApplicationExtensionRuntimeService;
  let authorized = 0;
  const cleanup = registerApplicationExtensionRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== "trusted") throw new Error("Extension IPC sender is not authorized.");
      authorized += 1;
    },
  });
  for (const channel of Object.values(APPLICATION_EXTENSION_RUNTIME_CHANNELS)) {
    await ipcMain.invoke(channel, "trusted", {});
  }
  assert.equal(authorized, 8);
  assert.deepEqual(calls, ["list", "remote", "install", "import", "update", "remove", "start", "stop"]);
  await assert.rejects(ipcMain.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.list, "untrusted"), /not authorized/);
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});

test("Skill Runtime IPC authorizes every handler, owns reveal path and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const calls: string[] = [];
  const runtime = {
    /** 记录技能列表；无输入，返回固定结果。 */
    async listSkills() { calls.push("list"); return { success: true }; },
    /** 记录内容读取；输入请求，返回固定结果。 */
    async getSkillContent() { calls.push("content"); return { success: true }; },
    /** 记录仓库安装；输入请求，返回固定结果。 */
    async installFromRepository() { calls.push("install"); return { success: true }; },
    /** 记录 ZIP 导入；输入请求，返回固定结果。 */
    async importArchive() { calls.push("import"); return { success: true }; },
    /** 记录技能结晶；输入请求，返回固定结果。 */
    async crystallizeSkill() { calls.push("crystallize"); return { success: true }; },
    /** 记录 MLOps 上传；输入请求，返回固定结果。 */
    async uploadSkillToMlops() { calls.push("upload-mlops"); return { success: true }; },
    /** 记录技能删除；输入请求，返回固定结果。 */
    async removeSkill() { calls.push("remove"); return { success: true }; },
    /** 记录工作区状态；无输入，返回固定结果。 */
    async getProjectStatus() { calls.push("project"); return { success: true }; },
    /** 记录工作区同步；输入请求，返回固定结果。 */
    async syncProjectSkill() { calls.push("sync"); return { success: true }; },
    /** 准备技能目录；无输入，返回 Main-owned 固定路径。 */
    async ensureSkillsDirectory() { calls.push("directory"); return "C:\\Users\\test\\.agents\\skills"; },
  } as unknown as ApplicationSkillRuntimeService;
  let authorized = 0;
  let revealedPath = "";
  const cleanup = registerApplicationSkillRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== "trusted") throw new Error("Skill IPC sender is not authorized.");
      authorized += 1;
    },
    revealDirectory: async (directoryPath) => {
      revealedPath = directoryPath;
      return "";
    },
  });
  for (const channel of Object.values(APPLICATION_SKILL_RUNTIME_CHANNELS)) {
    await ipcMain.invoke(channel, "trusted", {});
  }
  assert.equal(authorized, 10);
  assert.deepEqual(calls, [
    "list", "content", "install", "import", "crystallize", "upload-mlops", "remove", "project", "sync", "directory",
  ]);
  assert.equal(revealedPath, "C:\\Users\\test\\.agents\\skills");
  await assert.rejects(ipcMain.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.list, "untrusted"), /not authorized/);
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
