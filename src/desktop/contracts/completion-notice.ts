/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
有界完成提醒协议 / Bounded completion notice protocol.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/

export const COMPLETION_NOTICE_CHANNELS = Object.freeze({
  publish: "openxnet:completion-notice:publish",
  snapshot: "openxnet:completion-notice:snapshot",
  open: "openxnet:completion-notice:open",
  notice: "openxnet:completion-notice:notice",
  navigate: "openxnet:completion-notice:navigate",
});

export type CompletionNoticeStatus = "completed" | "failed" | "action_required" | "changed" | "unchanged" | "running";

export interface CompletionNoticeTarget {
  readonly resultId: string;
  readonly source: "chat" | "task" | "enterprise_run";
  readonly conversationId?: string;
  readonly taskId?: string;
  readonly workspaceId?: string;
  readonly incidentId?: string;
  readonly traceId?: string;
}

export interface CompletionNotice extends CompletionNoticeTarget {
  readonly title: string;
  readonly summary: string;
  readonly status: CompletionNoticeStatus;
  readonly occurredAt: string;
}

export interface PublishCompletionNoticeRequest extends Omit<CompletionNotice, "status"> {
  readonly status: CompletionNoticeStatus | "canceled" | "interrupted" | "running" | "unknown";
  readonly notificationPolicy?: "all" | "changes_only" | "silent";
  readonly notify?: boolean;
  readonly replay?: boolean;
}

export interface CompletionNoticeResult {
  readonly accepted: boolean;
  readonly delivery: "submitted" | "duplicate" | "suppressed" | "stale" | "unsupported" | "failed";
}

export interface CompletionNoticeSnapshot {
  readonly schema: "openxnet.completion-notice-snapshot.v1";
  readonly notices: readonly CompletionNotice[];
}

export type CompletionNoticeListener = (notice: CompletionNotice) => void;
export type CompletionNoticeNavigateListener = (target: CompletionNoticeTarget) => void;
