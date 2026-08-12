import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_SQL_CREDENTIAL_CHANNELS } from "../contracts/application-sql-credentials";
import { registerApplicationSqlCredentialsIpc } from "./register-application-sql-credentials-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 提供 SQL IPC 测试所需的最小 Main 模拟器。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 注册模拟 IPC；输入通道和处理器，无返回，仅写入测试映射。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 删除模拟 IPC；输入通道，无返回，通道不存在时保持幂等。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 调用模拟 IPC；输入通道、事件和参数，返回处理结果，通道缺失时断言失败。 */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return handler(event, ...arguments_);
  }
}

test("SQL credential IPC authorizes snapshot, save, and system file selection", async () => {
  const ipcMain = new TestIpcMain();
  const authorized = { sender: "main" };
  const cleanup = registerApplicationSqlCredentialsIpc({
    ipcMain,
    sqlCredentials: {
      getSnapshot: () => ({ kind: "snapshot" }) as never,
      save: () => ({ kind: "saved" }) as never,
      selectDatabase: async () => ({ kind: "selected" }) as never,
    },
    authorizeEvent: (event) => {
      if (event !== authorized) throw new Error("unauthorized");
    },
  });
  assert.throws(
    () => ipcMain.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.getSnapshot, {}),
    /unauthorized/,
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.getSnapshot, authorized),
    { kind: "snapshot" },
  );
  assert.deepEqual(
    ipcMain.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.save, authorized, {}),
    { kind: "saved" },
  );
  assert.deepEqual(
    await ipcMain.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.selectDatabase, authorized),
    { kind: "selected" },
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
