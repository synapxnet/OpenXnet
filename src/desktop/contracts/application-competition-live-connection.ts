/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Live 限权接入契约 / Live scoped connection contracts.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

/** 固定受控通道；不暴露密钥读取。 / Fixed authorized channels never expose credential reads. */
export const APPLICATION_COMPETITION_LIVE_CONNECTION_CHANNELS = Object.freeze({
  get: "openxnet:application-competition-live-connection:get",
  test: "openxnet:application-competition-live-connection:test",
  save: "openxnet:application-competition-live-connection:save",
  clear: "openxnet:application-competition-live-connection:clear",
});

/** 仅允许固定公开错误，避免泄漏异常内容。 / Allowlisted public errors prevent exception disclosure. */
export type ApplicationCompetitionLiveConnectionCode =
  | "INVALID_REQUEST" | "INVALID_ENDPOINT" | "WORKSPACE_REQUIRED"
  | "ACCESS_CODE_REQUIRED" | "INVALID_ACCESS_CODE" | "AUTH_REQUIRED" | "ACCOUNT_CHANGED"
  | "STORAGE_UNAVAILABLE" | "STORAGE_READ_FAILED" | "STORAGE_WRITE_FAILED"
  | "CONNECTION_BUSY" | "CHANGE_BLOCKED" | "NETWORK_ERROR" | "TIMEOUT"
  | "REDIRECT_REJECTED" | "RESPONSE_TOO_LARGE" | "INVALID_RESPONSE"
  | "WRONG_SERVICE" | "UNSUPPORTED_SERVICE" | "ACCESS_REJECTED" | "ACCESS_REVOKED"
  | "ACCESS_EXPIRED" | "ACCESS_SCOPE_MISMATCH" | "ACCESS_MODE_MISMATCH" | "ACCESS_QUOTA_EXHAUSTED"
  | "SERVICE_NOT_READY" | "CONNECTION_DISABLED" | "SCOPE_NOT_ALLOWED";

/** 分别描述真实平台配置、连通和身份检查。 / Describe platform configuration, reachability and identity independently. */
export interface ApplicationCompetitionLivePlatformStatus {
  readonly platform: "aiops" | "dataops" | "mlops";
  readonly configured: boolean;
  readonly reachable: boolean;
  readonly identityMatched: boolean;
}

/** 固定就绪检查结果；不接受上游异常详情。 / Bounded readiness results exclude upstream exception details. */
export interface ApplicationCompetitionLiveReadinessCheck {
  readonly id: string;
  readonly label: string;
  readonly ready: boolean;
  readonly code: string;
}

/** 服务端返回的非敏感授权范围。 / Non-sensitive authorization metadata returned by the service. */
export interface ApplicationCompetitionLiveConnectionAccess {
  readonly schema: "openxnet.agentteams.live-access.v1";
  readonly grantId: string;
  readonly label: string;
  readonly workspaceId: string;
  readonly expiresAt: string;
  readonly remainingRequests: number;
  readonly modes: readonly ["live"];
  readonly requiredTeamRuntime: "agentteams";
  readonly serviceReady: boolean;
  readonly allowedTools: readonly string[];
  readonly allowedScenarios: readonly string[];
  readonly platforms: readonly ApplicationCompetitionLivePlatformStatus[];
  readonly approvalReady: boolean;
  readonly checks: readonly ApplicationCompetitionLiveReadinessCheck[];
}

/** 配置页可读取的脱敏状态；读取失败不等同尚未配置。 / Redacted status distinguishes unreadable storage from absent configuration. */
export interface ApplicationCompetitionLiveConnectionSnapshot {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly workspaceId: string;
  readonly credentialConfigured: boolean;
  readonly storageAvailable: boolean;
  readonly source: "saved" | "none";
  readonly access: ApplicationCompetitionLiveConnectionAccess | null;
  readonly storageError?: "STORAGE_UNAVAILABLE" | "STORAGE_READ_FAILED";
}

/** 访问码仅单向传入 Main；留空仅复用同端点和工作空间的保存项。 / Codes flow only into Main; blank values reuse an exact saved target. */
export interface ApplicationCompetitionLiveConnectionRequest {
  readonly endpoint: string;
  readonly workspaceId: string;
  readonly accessCode?: string;
}

/** 显式保存启用状态。 / Explicit persisted enablement state. */
export interface ApplicationCompetitionLiveConnectionSaveRequest extends ApplicationCompetitionLiveConnectionRequest {
  readonly enabled: boolean;
}

/** 所有 IPC 操作的固定结果。 / Fixed result envelope for every IPC operation. */
export interface ApplicationCompetitionLiveConnectionResult {
  readonly ok: boolean;
  readonly code?: ApplicationCompetitionLiveConnectionCode;
  readonly snapshot?: ApplicationCompetitionLiveConnectionSnapshot;
  readonly access?: ApplicationCompetitionLiveConnectionAccess;
}
