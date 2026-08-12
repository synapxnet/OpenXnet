import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_DEVELOPER_WORKBENCH_CHANNELS } from "../contracts/application-developer-workbench-runtime";
import type { ApplicationDeveloperWorkbenchRuntimeService } from "../developer-workbench/application-developer-workbench-runtime";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationDeveloperWorkbenchRuntimeIpc } from "./register-application-developer-workbench-runtime-ipc";

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

  /** 调用已注册处理器；输入通道、事件和参数，返回处理结果，缺失通道时断言失败。 */
  public async invoke<TResult>(
    channel: string,
    event: unknown,
    ...arguments_: readonly unknown[]
  ): Promise<TResult> {
    const handler = this.handlers.get(channel);
    assert.ok(handler, `Missing handler for ${channel}`);
    return await handler(event, ...arguments_) as TResult;
  }
}

test("Developer Workbench IPC authorizes senders and workspace paths", async () => {
  const calls: string[] = [];
  const runtime = {
    getOverview: async () => ({ source: "overview" }),
    listRepositories: async () => ({ source: "repositories" }),
    searchCode: async () => ({ source: "search" }),
    listSnapshots: async () => ({ source: "list-snapshots" }),
    createSnapshot: async () => ({ source: "create-snapshot" }),
    importSnapshot: async () => ({ source: "import-snapshot" }),
    getSnapshot: async () => ({ source: "get-snapshot" }),
    restoreSnapshot: async () => ({ source: "restore-snapshot" }),
    deleteSnapshot: async () => ({ source: "delete-snapshot" }),
    applyWorkspace: async () => ({ source: "apply-workspace" }),
    applyMapping: async () => ({ source: "apply-mapping" }),
  } as unknown as ApplicationDeveloperWorkbenchRuntimeService;
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { authorized: true };
  const workspaceDirectory = "C:\\workspace";
  const cleanup = registerApplicationDeveloperWorkbenchRuntimeIpc({
    ipcMain,
    runtime,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
    authorizeWorkspacePath: (_event, candidate) => {
      calls.push(candidate);
      if (candidate !== workspaceDirectory) throw new Error("Workspace path is not authorized.");
    },
  });
  try {
    assert.equal(ipcMain.handlers.size, Object.keys(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS).length);
    const overview = await ipcMain.invoke<{ source: string }>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.overview,
      authorizedEvent,
    );
    assert.equal(overview.source, "overview");
    const applied = await ipcMain.invoke<{ source: string }>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.applyWorkspace,
      authorizedEvent,
      {
        workspaceDirectory,
        permissionMode: "plan",
        enabled: true,
        engine: "local",
        visibilityScope: "workspace",
      },
    );
    assert.equal(applied.source, "apply-workspace");
    assert.deepEqual(calls, [workspaceDirectory]);
    await assert.rejects(
      ipcMain.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.overview, {}),
      /not authorized/,
    );
    await assert.rejects(
      ipcMain.invoke(
        APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.applyWorkspace,
        authorizedEvent,
        {
          workspaceDirectory: "C:\\untrusted",
          permissionMode: "plan",
          enabled: true,
          engine: "local",
          visibilityScope: "workspace",
        },
      ),
      /path is not authorized/,
    );
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
});
