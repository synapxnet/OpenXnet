/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 接入 IPC 授权回归测试 / Connection IPC authorization regression tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { APPLICATION_COMPETITION_CONNECTION_CHANNELS, type ApplicationCompetitionConnectionSnapshot } from "../contracts/application-competition-connection";
import type { OpenXnetDesktopApi } from "../contracts/capability";
import { exposeDesktopCore } from "../preload/expose-desktop-core";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationCompetitionConnectionIpc } from "./register-application-competition-connection-ipc";

test("every connection IPC channel authorizes before accessing the service and cleans up", async () => {
  const handlers = new Map<string, (event: unknown, ...args: readonly unknown[]) => unknown>();
  const ipcMain: IpcMainLike = {
    /** 记录测试处理器。 / Record a test handler. */
    handle(channel, listener): void { handlers.set(channel, listener as (event: unknown, ...args: readonly unknown[]) => unknown); },
    /** 删除测试处理器。 / Remove a test handler. */
    removeHandler(channel): void { handlers.delete(channel); },
  };
  const trusted = { sender: "trusted-main-window" };
  const calls: string[] = [];
  const snapshot: ApplicationCompetitionConnectionSnapshot = {
    enabled: false, endpoint: "", workspaceId: "", credentialConfigured: false, storageAvailable: true, source: "none", access: null,
  };
  const cleanup = registerApplicationCompetitionConnectionIpc({
    ipcMain,
    /** 授权失败不允许读取或发请求。 / Failed authorization prevents reads and network work. */
    authorizeEvent(event): void { if (event !== trusted) throw new Error("Unauthorized"); },
    service: {
      /** 返回公开状态。 / Return public status. */
      getSnapshot(): ApplicationCompetitionConnectionSnapshot { calls.push("get"); return snapshot; },
      /** 标记只读测试。 / Mark a read-only test. */
      async test() { calls.push("test"); return { ok: true }; },
      /** 标记保存调用。 / Mark a save invocation. */
      async save() { calls.push("save"); return { ok: true }; },
      /** 标记清除调用。 / Mark a clear invocation. */
      async clear() { calls.push("clear"); return { ok: true }; },
    },
  });
  for (const channel of Object.values(APPLICATION_COMPETITION_CONNECTION_CHANNELS)) {
    const handler = handlers.get(channel);
    assert.ok(handler);
    assert.deepEqual(await handler({ sender: "untrusted" }, {}), { ok: false, code: "AUTH_REQUIRED" });
  }
  assert.deepEqual(calls, []);
  for (const channel of Object.values(APPLICATION_COMPETITION_CONNECTION_CHANNELS)) {
    const result = await handlers.get(channel)?.(trusted, {});
    assert.equal((result as { ok: boolean }).ok, true);
  }
  assert.deepEqual(calls, ["get", "test", "save", "clear"]);
  assert.equal(handlers.size, 4);
  cleanup();
  assert.equal(handlers.size, 0);
});

test("typed and installed preload expose the same restricted connection operations", /** 验证真实两份预加载桥接，防止安装包缺少配置入口。 / Verify both actual preload bridges so the installed app cannot lose connection operations. */ async () => {
  for (const packaged of [false, true]) {
    let api: OpenXnetDesktopApi | undefined;
    const calls: unknown[][] = [];
    const contextBridge = {
      /** 捕获实际发布的桌面能力。 / Capture the actual published desktop capabilities. */
      exposeInMainWorld(name: string, value: unknown): void { if (name === "openxnetDesktop") api = value as OpenXnetDesktopApi; },
    };
    const ipcRenderer = {
      /** 记录操作和载荷，不连接任何服务。 / Record operations and payloads without contacting a service. */
      async invoke(...args: unknown[]): Promise<unknown> { calls.push(args); return { ok: true }; },
      /** 接纳预加载的现有事件监听。 / Accept existing preload event subscriptions. */
      on(): void {},
      /** 接纳预加载的现有事件注销。 / Accept existing preload event unsubscriptions. */
      removeListener(): void {},
    };
    if (packaged) {
      runInNewContext(readFileSync(resolve(process.cwd(), "static/js/preload.js"), "utf8"), {
        /** 只注入 Electron 替身，不加载真实宿主。 / Inject only Electron doubles, never the real host. */
        require(name: string): unknown { assert.equal(name, "electron"); return { contextBridge, ipcRenderer, webUtils: {} }; },
        process: { platform: "win32" }, console,
      });
    } else exposeDesktopCore({ contextBridge, ipcRenderer: ipcRenderer as never });
    assert.ok(api);
    assert.equal("getSavedConnection" in api, false, "Main-only credentials must never be bridged");
    const request = { endpoint: "https://demo.example/adapter/", workspaceId: "workspace-test", accessCode: `oxdemo_${"a".repeat(64)}` };
    const savedRequest = { ...request, enabled: true };
    await api.getApplicationCompetitionConnection();
    await api.testApplicationCompetitionConnection(request);
    await api.saveApplicationCompetitionConnection(savedRequest);
    await api.clearApplicationCompetitionConnection();
    assert.deepEqual(calls, [
      [APPLICATION_COMPETITION_CONNECTION_CHANNELS.get],
      [APPLICATION_COMPETITION_CONNECTION_CHANNELS.test, request],
      [APPLICATION_COMPETITION_CONNECTION_CHANNELS.save, savedRequest],
      [APPLICATION_COMPETITION_CONNECTION_CHANNELS.clear],
    ]);
  }
});
