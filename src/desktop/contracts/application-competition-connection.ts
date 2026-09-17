/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 桌面协同接入契约 / Desktop collaboration connection contracts.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

/** 固定受控通道；不暴露密钥读取。 / Fixed authorized channels never expose credential reads. */
export const APPLICATION_COMPETITION_CONNECTION_CHANNELS = Object.freeze({
  get: "openxnet:application-competition-connection:get",
  test: "openxnet:application-competition-connection:test",
  save: "openxnet:application-competition-connection:save",
  clear: "openxnet:application-competition-connection:clear",
});

/** 仅允许固定公开错误，避免泄漏异常内容。 / Allowlisted public errors prevent exception disclosure. */
export type ApplicationCompetitionConnectionCode =
  | "INVALID_REQUEST" | "INVALID_ENDPOINT" | "WORKSPACE_REQUIRED"
  | "ACCESS_CODE_REQUIRED" | "INVALID_ACCESS_CODE" | "AUTH_REQUIRED" | "ACCOUNT_CHANGED"
  | "STORAGE_UNAVAILABLE" | "STORAGE_READ_FAILED" | "STORAGE_WRITE_FAILED"
  | "CONNECTION_BUSY" | "CHANGE_BLOCKED" | "NETWORK_ERROR" | "TIMEOUT"
  | "REDIRECT_REJECTED" | "RESPONSE_TOO_LARGE" | "INVALID_RESPONSE"
  | "WRONG_SERVICE" | "UNSUPPORTED_SERVICE" | "ACCESS_REJECTED" | "ACCESS_REVOKED"
  | "ACCESS_EXPIRED" | "ACCESS_SCOPE_MISMATCH" | "ACCESS_QUOTA_EXHAUSTED"
  | "SERVICE_NOT_READY";

/** 服务端返回的非敏感授权范围。 / Non-sensitive authorization metadata returned by the service. */
export interface ApplicationCompetitionConnectionAccess {
  readonly schema: "openxnet.agentteams.access.v1";
  readonly grantId: string;
  readonly label: string;
  readonly workspaceId: string | null;
  readonly expiresAt: string;
  readonly remainingRequests: number;
  readonly modes: readonly ["fixture"];
  readonly serviceReady: boolean;
}

/** 配置页可读取的脱敏状态；读取失败不等同尚未配置。 / Redacted status distinguishes unreadable storage from absent configuration. */
export interface ApplicationCompetitionConnectionSnapshot {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly workspaceId: string;
  readonly credentialConfigured: boolean;
  readonly storageAvailable: boolean;
  readonly source: "saved" | "deployment" | "none";
  readonly access: ApplicationCompetitionConnectionAccess | null;
  readonly storageError?: "STORAGE_UNAVAILABLE" | "STORAGE_READ_FAILED";
}

/** 访问码仅单向传入 Main；留空仅复用同端点和工作空间的保存项。 / Codes flow only into Main; blank values reuse an exact saved target. */
export interface ApplicationCompetitionConnectionRequest {
  readonly endpoint: string;
  readonly workspaceId: string;
  readonly accessCode?: string;
}

/** 显式保存启用状态。 / Explicit persisted enablement state. */
export interface ApplicationCompetitionConnectionSaveRequest extends ApplicationCompetitionConnectionRequest {
  readonly enabled: boolean;
}

/** 所有 IPC 操作的固定结果。 / Fixed result envelope for every IPC operation. */
export interface ApplicationCompetitionConnectionResult {
  readonly ok: boolean;
  readonly code?: ApplicationCompetitionConnectionCode;
  readonly snapshot?: ApplicationCompetitionConnectionSnapshot;
  readonly access?: ApplicationCompetitionConnectionAccess;
}
