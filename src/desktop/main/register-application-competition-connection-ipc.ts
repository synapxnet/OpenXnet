/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 桌面演示接入受控 IPC / Authorized desktop demo connection IPC.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */
import { APPLICATION_COMPETITION_CONNECTION_CHANNELS, type ApplicationCompetitionConnectionResult } from "../contracts/application-competition-connection";
import type { ApplicationCompetitionConnectionService } from "../competition/application-competition-connection";
import type { IpcMainLike } from "./register-core-ipc";

/** IPC 只依赖公开配置操作，不暴露 Main 凭据读取器。 / IPC depends only on public operations and never exposes the Main credential reader. */
export interface RegisterApplicationCompetitionConnectionIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly service: Pick<ApplicationCompetitionConnectionService, "getSnapshot" | "test" | "save" | "clear">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 为四个固定操作先校验窗口和账号，捕获错误不得回显秘密。 / Authorize the window and account before all four fixed operations without echoing secrets. */
export function registerApplicationCompetitionConnectionIpc(options: RegisterApplicationCompetitionConnectionIpcOptions): () => void {
  const operations = {
    /** 返回公开快照。 / Return the public snapshot. */
    get: (): ApplicationCompetitionConnectionResult => ({ ok: true, snapshot: options.service.getSnapshot() }),
    /** 测试输入配置。 / Test the submitted configuration. */
    test: (request: unknown): Promise<ApplicationCompetitionConnectionResult> => options.service.test(request),
    /** 保存输入配置。 / Save the submitted configuration. */
    save: (request: unknown): Promise<ApplicationCompetitionConnectionResult> => options.service.save(request),
    /** 清除当前账号本机配置。 / Clear this account's local configuration. */
    clear: (): Promise<ApplicationCompetitionConnectionResult> => options.service.clear(),
  };
  for (const key of Object.keys(operations) as (keyof typeof operations)[]) {
    options.ipcMain.handle(APPLICATION_COMPETITION_CONNECTION_CHANNELS[key],
      /** 所有操作统一校验发送者，不信任 Renderer 身份。 / Apply the same sender authorization to every operation, never trusting renderer identities. */
      async (event: unknown, request: unknown): Promise<ApplicationCompetitionConnectionResult> => {
        try { options.authorizeEvent(event); } catch { return { ok: false, code: "AUTH_REQUIRED" }; }
        try { return await operations[key](request); } catch { return { ok: false, code: "INVALID_REQUEST" }; }
      });
  }
  /** 在退出时卸载四个固定通道。 / Remove the four fixed channels during shutdown. */
  return (): void => {
    for (const channel of Object.values(APPLICATION_COMPETITION_CONNECTION_CHANNELS)) options.ipcMain.removeHandler(channel);
  };
}
