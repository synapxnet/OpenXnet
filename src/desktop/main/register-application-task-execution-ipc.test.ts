import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_TASK_EXECUTION_CHANNELS } from "../contracts/application-task-execution";
import type { ApplicationTaskSnapshot } from "../contracts/application-tasks";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";
import { registerApplicationTaskExecutionIpc } from "./register-application-task-execution-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one synthetic task execution handler. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one synthetic task execution handler. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered synthetic task execution handler. */
  public async invoke(channel: string, event: unknown, request: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("registerApplicationTaskExecutionIpc authorizes commands and broadcasts snapshots", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  let listener: ((snapshot: ApplicationTaskSnapshot) => void) | null = null;
  const sent: { channel: string; payload: unknown }[] = [];
  const snapshot = {
    schema: "openxnet.application-tasks.v1",
    catalogRevision: 0,
    generatedAt: "2026-07-23T10:00:00.000Z",
    tasks: [],
  } as ApplicationTaskSnapshot;
  const webContents: WebContentsLike = {
    isDestroyed: () => false,
    send: (channel, payload) => sent.push({ channel, payload }),
  };
  const execution = {
    refreshExecutions: async () => ({ ...snapshot, executionWorkspacePath: "C:\\workspace" }),
    getExecution: async () => ({ schema: "openxnet.application-task-execution.v1", childTasks: [] }),
    createWorkbenchExecution: async () => ({ id: "task" }),
    dispatchExecution: async () => ({ id: "task" }),
    startExecution: async () => ({ id: "task" }),
    resumeExecution: async () => ({ id: "task" }),
    cancelExecution: async () => ({ id: "task" }),
    deleteExecution: async () => snapshot,
    subscribe: (nextListener: (value: ApplicationTaskSnapshot) => void) => {
      listener = nextListener;
      return () => {
        listener = null;
      };
    },
  };
  const cleanup = registerApplicationTaskExecutionIpc({
    ipcMain,
    execution: execution as never,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
    getWebContents: () => [webContents],
  });
  try {
    const channels = Object.values(APPLICATION_TASK_EXECUTION_CHANNELS)
      .filter((channel) => channel !== APPLICATION_TASK_EXECUTION_CHANNELS.changed);
    assert.equal(ipcMain.handlers.size, channels.length);
    await ipcMain.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.refresh, authorizedEvent, {});
    await assert.rejects(
      ipcMain.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.cancel, {}, { taskId: "invalid" }),
      /not authorized/,
    );
    assert.ok(listener);
    (listener as (value: ApplicationTaskSnapshot) => void)(snapshot);
    assert.deepEqual(sent, [{ channel: APPLICATION_TASK_EXECUTION_CHANNELS.changed, payload: snapshot }]);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
  assert.equal(listener, null);
});
