import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { APPLICATION_TASK_CHANNELS } from "../contracts/application-tasks";
import { bootstrapApplicationTasks } from "../storage/application-tasks";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationTasksIpc } from "./register-application-tasks-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one test handler by channel. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one test handler by channel. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered handler through a synthetic Renderer event. */
  public async invoke<TResult>(
    channel: string,
    event: unknown,
    ...arguments_: readonly unknown[]
  ): Promise<TResult> {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return await handler(event, ...arguments_) as TResult;
  }
}

test("registerApplicationTasksIpc authorizes every durable task operation", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-task-ipc-"));
  const workspacePath = path.join(directory, "workspace");
  const ipcMain = new TestIpcMain();
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  const authorizedEvent = { authorized: true };
  const cleanup = registerApplicationTasksIpc({
    ipcMain,
    tasks,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });
  try {
    const created = await ipcMain.invoke<{ id: string; revision: number }>(
      APPLICATION_TASK_CHANNELS.create,
      authorizedEvent,
      {
        workspacePath,
        title: "IPC task",
        description: "Verify the authorized task boundary.",
        agentType: "default",
        priority: "normal",
        scheduleType: "manual",
        scheduleExpression: "",
        nextRunAt: "",
        source: "ipc-test",
        inputArtifactIds: [],
        details: {},
      },
    );
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    const detail = await ipcMain.invoke<{ task: { id: string } }>(
      APPLICATION_TASK_CHANNELS.get,
      authorizedEvent,
      { taskId: created.id },
    );
    assert.equal(detail.task.id, created.id);
    const listed = await ipcMain.invoke<{ tasks: readonly unknown[] }>(
      APPLICATION_TASK_CHANNELS.list,
      authorizedEvent,
      { workspacePath },
    );
    assert.equal(listed.tasks.length, 1);
    await assert.rejects(
      ipcMain.invoke(APPLICATION_TASK_CHANNELS.list, {}, {}),
      /IPC sender is not authorized/,
    );
  } finally {
    cleanup();
    tasks.close();
    rmSync(directory, { recursive: true, force: true });
  }
  assert.equal(ipcMain.handlers.size, 0);
});
