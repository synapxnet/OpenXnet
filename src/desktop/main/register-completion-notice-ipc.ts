/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
可信完成提醒与只读浮窗快照 / Trusted completion alerts and read-only companion snapshots.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import {
  COMPLETION_NOTICE_CHANNELS,
  type CompletionNotice,
  type CompletionNoticeResult,
  type CompletionNoticeSnapshot,
  type CompletionNoticeTarget,
  type PublishCompletionNoticeRequest,
} from "../contracts/completion-notice";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

export interface CompletionNativeNotification {
  on(event: "click" | "close" | "failed", listener: (...args: unknown[]) => void): unknown;
  show(): void;
  close(): void;
}

export interface RegisterCompletionNoticeOptions {
  readonly ipcMain: IpcMainLike;
  readonly authorizePublisher: (event: unknown) => void;
  readonly authorizeReader: (event: unknown) => void;
  readonly readPreferences: () => { readonly completionNotificationsEnabled?: boolean; readonly completionNotificationSound?: boolean };
  readonly isSupported: () => boolean;
  readonly createNotification: (options: { title: string; body: string; silent: boolean }) => CompletionNativeNotification;
  readonly getReaders: () => readonly WebContentsLike[];
  readonly navigate: (target: CompletionNoticeTarget) => Promise<boolean> | boolean;
  readonly validateEnterpriseRun?: (target: CompletionNoticeTarget) => Promise<boolean> | boolean;
  readonly now?: () => number;
}

const DENIED = "完成提醒格式或身份无效 / Completion notice format or identity is invalid.";
const TERMINAL = new Set(["completed", "failed", "action_required", "changed", "unchanged"]);
const STATUSES = new Set([...TERMINAL, "canceled", "interrupted", "running", "unknown"]);
const KEYS = new Set(["resultId", "source", "conversationId", "taskId", "workspaceId", "incidentId", "traceId", "title", "summary", "status", "occurredAt", "notificationPolicy", "notify", "replay"]);

/** 只接受简单对象与声明字段。 / Accept record objects and declared fields only. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(DENIED);
  return value as Record<string, unknown>;
}

/** 身份保持完整并拒绝控制字符与空白别名。 / Retain complete identities and reject control characters or whitespace aliases. */
function identifier(value: unknown): string {
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(DENIED);
  return value;
}

/** 去除隐藏内容和常见凭据，仅投影短公开文本。 / Remove hidden content and common credentials, projecting short public text only. */
function publicText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length > 65_536) throw new Error(DENIED);
  let text = ""; let offset = 0; let stack: string[] = [];
  const tags = /<\s*(\/?)\s*(think|thought|thinking|analysis|reasoning|system|script|style)\b[^>]*>/gi;
  for (const match of value.matchAll(tags)) {
    if (!stack.length) text += value.slice(offset, match.index);
    const tag = match[2]!.toLowerCase();
    if (match[1]) { const index = stack.lastIndexOf(tag); if (index >= 0) stack = stack.slice(0, index); }
    else if (!match[0].trimEnd().endsWith("/>")) stack.push(tag);
    offset = match.index! + match[0].length;
  }
  if (!stack.length) text += value.slice(offset).replace(/<\s*(?:think|thought|thinking|analysis|reasoning|system|script|style)\b[^>]*$/gi, "");
  const cleaned = text.replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|authorization)["']?\s*[:=]\s*)(?:["'][^"'\r\n]*["']|[^\s,;\r\n}]+)/gi, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g, "[redacted]")
    .replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
  return /[\ud800-\udbff]$/.test(cleaned) ? cleaned.slice(0, -1) : cleaned;
}

/** 校验终态信封，拒绝任意URL、命令和整份任务对象。 / Validate terminal envelopes, rejecting arbitrary URLs, commands, and full task objects. */
function normalize(value: unknown): PublishCompletionNoticeRequest {
  const request = record(value);
  if (Object.keys(request).some(/** 只读允许字段。 / Permit declared fields only. */ key => !KEYS.has(key))
    || !["chat", "task", "enterprise_run"].includes(String(request.source)) || !STATUSES.has(String(request.status))
    || request.notificationPolicy !== undefined && !["all", "changes_only", "silent"].includes(String(request.notificationPolicy))
    || request.notify !== undefined && typeof request.notify !== "boolean"
    || request.replay !== undefined && typeof request.replay !== "boolean") throw new Error(DENIED);
  const resultId = identifier(request.resultId);
  const conversationId = request.conversationId === undefined ? undefined : identifier(request.conversationId);
  const taskId = request.taskId === undefined ? undefined : identifier(request.taskId);
  const enterprise = request.source === "enterprise_run";
  const workspaceId = request.workspaceId === undefined ? undefined : identifier(request.workspaceId);
  const incidentId = request.incidentId === undefined ? undefined : identifier(request.incidentId);
  const traceId = request.traceId === undefined ? undefined : identifier(request.traceId);
  if (enterprise ? !workspaceId || !incidentId || !traceId || conversationId || taskId
    : workspaceId || incidentId || traceId || !conversationId && !taskId || request.source === "chat" && !conversationId || request.source === "task" && !taskId) throw new Error(DENIED);
  if (typeof request.occurredAt !== "string" || request.occurredAt.length > 64 || !/^\d{4}-\d{2}-\d{2}T/.test(request.occurredAt)
    || !Number.isFinite(Date.parse(request.occurredAt))) throw new Error(DENIED);
  return { resultId, source: request.source as CompletionNoticeTarget["source"], ...(conversationId ? { conversationId } : {}), ...(taskId ? { taskId } : {}),
    ...(enterprise && workspaceId && incidentId && traceId ? { workspaceId, incidentId, traceId } : {}),
    title: publicText(request.title, 120) || "OpenXnet", summary: publicText(request.summary, 400),
    status: request.status as PublishCompletionNoticeRequest["status"], occurredAt: new Date(request.occurredAt).toISOString(),
    ...(request.notificationPolicy === undefined ? {} : { notificationPolicy: request.notificationPolicy as "all" | "changes_only" | "silent" }),
    ...(request.notify === undefined ? {} : { notify: request.notify as boolean }), ...(request.replay === undefined ? {} : { replay: request.replay as boolean }) };
}

/** 将公开结果限制为导航身份。 / Restrict a public result to navigation identities. */
function target(notice: CompletionNotice): CompletionNoticeTarget {
  return { resultId: notice.resultId, source: notice.source, ...(notice.conversationId ? { conversationId: notice.conversationId } : {}), ...(notice.taskId ? { taskId: notice.taskId } : {}),
    ...(notice.source === "enterprise_run" && notice.workspaceId && notice.incidentId && notice.traceId ? { workspaceId: notice.workspaceId, incidentId: notice.incidentId, traceId: notice.traceId } : {}) };
}

/** 注册主窗口发布、受限快照和显式导航，不自动打开或聚焦窗口。 / Register main-window publication, bounded snapshots, and explicit navigation without automatic window opening or focus. */
export function registerCompletionNoticeIpc(options: RegisterCompletionNoticeOptions): () => void {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const seen = new Map<string, { identity: string; at: number }>();
  const notices: CompletionNotice[] = [];
  const active = new Set<CompletionNativeNotification>();
  let disposed = false;

  /** 每次读取真实企业归属，未配置或核验失败时拒绝。 / Recheck authoritative enterprise ownership, rejecting missing validators and failures. */
  async function validEnterpriseRun(value: CompletionNoticeTarget): Promise<boolean> {
    if (value.source !== "enterprise_run") return true;
    try { return await options.validateEnterpriseRun?.(value) === true; }
    catch { return false; }
  }

  /** 仅导航到仍保留的验证身份，失败不触发任务。 / Navigate only to retained verified identities; failures never trigger tasks. */
  async function openResult(resultId: string): Promise<boolean> {
    const notice = notices.find(/** 精确匹配近期结果。 / Match a recent result exactly. */ candidate => candidate.resultId === resultId);
    if (!notice || disposed) return false;
    if (notice.source === "enterprise_run" && (!await validEnterpriseRun(target(notice)) || disposed)) return false;
    return options.navigate(target(notice));
  }

  /** 真实新结果只提交一次原生提醒，发送结果与可见性保持区别。 / Submit a native alert once for a real new result, distinguishing submission from visibility. */
  async function publish(event: unknown, value: unknown): Promise<CompletionNoticeResult> {
    options.authorizePublisher(event);
    const request = normalize(value); const timestamp = Date.parse(request.occurredAt); const current = now();
    if (request.replay || timestamp < startedAt || timestamp < current - 300_000 || timestamp > current + 30_000) return { accepted: false, delivery: "stale" };
    const enterprise = request.source === "enterprise_run";
    if ((!TERMINAL.has(request.status) && !(enterprise && request.status === "running")) || !enterprise && (request.notify === false || request.notificationPolicy === "silent")
      || request.notificationPolicy !== "all" && request.status === "unchanged") return { accepted: false, delivery: "suppressed" };
    if (!await validEnterpriseRun(target(request as CompletionNotice))) throw new Error(DENIED);
    if (disposed) return { accepted: false, delivery: "suppressed" };
    const identity = JSON.stringify([request.source, request.conversationId, request.taskId, request.workspaceId, request.incidentId, request.traceId]);
    const previous = seen.get(request.resultId);
    if (previous) {
      if (previous.identity !== identity) throw new Error(DENIED);
      return { accepted: false, delivery: "duplicate" };
    }
    for (const [key, entry] of seen) if (entry.at < current - 300_000) seen.delete(key);
    if (seen.size >= 2_048) return { accepted: false, delivery: "suppressed" };
    seen.set(request.resultId, { identity, at: current });
    const notice: CompletionNotice = { ...target(request as CompletionNotice), title: request.title, summary: request.summary,
      status: request.status as CompletionNotice["status"], occurredAt: request.occurredAt };
    notices.push(notice); if (notices.length > 20) notices.shift();
    for (const reader of options.getReaders()) {
      try { if (!reader.isDestroyed()) reader.send(COMPLETION_NOTICE_CHANNELS.notice, { ...notice }); } catch { /* 已关闭浮窗不阻止其他投递。 / A closed companion cannot block other deliveries. */ }
    }
    if (request.status === "running" || request.notify === false || request.notificationPolicy === "silent") return { accepted: true, delivery: "suppressed" };
    const preferences = options.readPreferences();
    if (preferences.completionNotificationsEnabled === false) return { accepted: true, delivery: "suppressed" };
    if (!options.isSupported()) return { accepted: true, delivery: "unsupported" };
    let pending: CompletionNativeNotification | undefined;
    try {
      const notification = options.createNotification({ title: notice.title, body: notice.summary, silent: preferences.completionNotificationSound !== true });
      pending = notification;
      active.add(notification);
      notification.on("click", /** 用户点击后只请求原身份导航。 / Request original-identity navigation only after a user click. */ () => { void openResult(notice.resultId).catch(/** 导航失败保持静默，不再执行。 / Keep failed navigation inert without executing again. */ () => undefined); });
      notification.on("close", /** 释放关闭的原生对象。 / Release closed native objects. */ () => { active.delete(notification); });
      notification.on("failed", /** 原生失败只释放对象，不生成替代执行。 / Release failed native objects without replacement execution. */ () => { active.delete(notification); });
      while (active.size > 20) { const oldest = active.values().next().value!; active.delete(oldest); oldest.close(); }
      notification.show();
      return { accepted: true, delivery: "submitted" };
    } catch {
      if (pending) {
        active.delete(pending);
        try { pending.close(); } catch { /* 失败对象不妨碍后续投递。 / Failed objects cannot block subsequent deliveries. */ }
      }
      return { accepted: true, delivery: "failed" };
    }
  }

  /** 快照读取无通知副作用。 / Read snapshots without notification side effects. */
  function snapshot(event: unknown): CompletionNoticeSnapshot {
    options.authorizeReader(event);
    return { schema: "openxnet.completion-notice-snapshot.v1", notices: notices.map(/** 返回独立公开投影。 / Return independent public projections. */ notice => ({ ...notice })) };
  }

  /** 浮窗只按近期结果ID请求导航，不接受导航参数。 / Companions request navigation by recent result ID only, accepting no navigation arguments. */
  async function open(event: unknown, value: unknown): Promise<boolean> {
    options.authorizeReader(event); const request = record(value);
    if (Object.keys(request).length !== 1 || !Object.hasOwn(request, "resultId")) throw new Error(DENIED);
    return openResult(identifier(request.resultId));
  }

  const channels = [COMPLETION_NOTICE_CHANNELS.publish, COMPLETION_NOTICE_CHANNELS.snapshot, COMPLETION_NOTICE_CHANNELS.open];
  for (const channel of channels) options.ipcMain.removeHandler(channel);
  options.ipcMain.handle(COMPLETION_NOTICE_CHANNELS.publish, publish);
  options.ipcMain.handle(COMPLETION_NOTICE_CHANNELS.snapshot, snapshot);
  options.ipcMain.handle(COMPLETION_NOTICE_CHANNELS.open, open);
  /** 撤销入口和原生对象，迟到点击不得导航。 / Revoke handlers and native objects so late clicks cannot navigate. */
  return function cleanup(): void {
    disposed = true;
    for (const channel of channels) options.ipcMain.removeHandler(channel);
    for (const notification of active) { try { notification.close(); } catch { /* 窗口退出继续清理。 / Continue shutdown cleanup. */ } }
    active.clear(); notices.length = 0; seen.clear();
  };
}
