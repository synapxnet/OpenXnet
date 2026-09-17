/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
隔离完成通知原生边界测试 / Isolated completion-notice native-boundary tests.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { COMPLETION_NOTICE_CHANNELS as CHANNELS, type CompletionNoticeSnapshot, type CompletionNoticeTarget, type PublishCompletionNoticeRequest } from "../contracts/completion-notice";
import { normalizeSystemSettings } from "../contracts/application-settings";
import { registerCompletionNoticeIpc, type CompletionNativeNotification } from "./register-completion-notice-ipc";
import type { IpcMainLike } from "./register-core-ipc";
import type { OpenXnetDesktopApi } from "../contracts/capability";
import { exposeDesktopCore } from "../preload/expose-desktop-core";

type Handler = (event: unknown, ...args: readonly unknown[]) => unknown;

class TestIpc implements IpcMainLike {
  readonly handlers = new Map<string, Handler>();
  /** 注册隔离处理器。 / Register an isolated handler. */
  handle<TArgs extends readonly unknown[], TResult>(channel: string, handler: (event: unknown, ...args: TArgs) => TResult | Promise<TResult>): void {
    this.handlers.set(channel, handler as Handler);
  }
  /** 移除原处理器。 / Remove the original handler. */
  removeHandler(channel: string): void { this.handlers.delete(channel); }
  /** 调用真实注册边界而不连接Electron。 / Invoke the actual registered boundary without connecting to Electron. */
  async invoke(channel: string, event: unknown, value?: unknown): Promise<any> {
    const handler = this.handlers.get(channel); assert.ok(handler); return handler(event, value);
  }
}

class FakeNotification implements CompletionNativeNotification {
  readonly listeners = new Map<string, (...args: unknown[]) => void>();
  shown = 0; closed = 0; failShow = false;
  /** 保存模拟系统事件。 / Retain simulated system events. */
  on(event: "click" | "close" | "failed", listener: (...args: unknown[]) => void): void { this.listeners.set(event, listener); }
  /** 只计数提交，绝不弹出真实系统通知。 / Count submissions without showing real system alerts. */
  show(): void { if (this.failShow) throw new Error("submission failed"); this.shown++; }
  /** 模拟释放原生对象。 / Simulate native-object release. */
  close(): void { this.closed++; this.listeners.get("close")?.(); }
}

/** 创建可控时钟、通知和窗口的独立边界。 / Create a boundary with isolated clocks, notifications, and windows. */
function fixture(options: { validateEnterpriseRun?: (target: CompletionNoticeTarget) => Promise<boolean> | boolean } = {}) {
  const ipc = new TestIpc(); const main = {}; const companion = {}; const notifications: FakeNotification[] = [];
  const nativeOptions: { title: string; body: string; silent: boolean }[] = [];
  const broadcast: unknown[] = []; const navigated: CompletionNoticeTarget[] = [];
  const state = { time: Date.parse("2026-09-14T12:00:00.000Z"), enabled: true, sound: false, supported: true, fail: false, failShow: false };
  const cleanup = registerCompletionNoticeIpc({
    ipcMain: ipc,
    /** 模拟严格主窗口授权。 / Simulate strict main-window authorization. */
    authorizePublisher: event => { if (event !== main) throw new Error("unauthorized publisher"); },
    /** 模拟现有可信伴随窗口读取权限。 / Simulate existing trusted companion read permission. */
    authorizeReader: event => { if (event !== main && event !== companion) throw new Error("unauthorized reader"); },
    /** 每次发布应用当前偏好。 / Apply current preferences for each publication. */
    readPreferences: () => ({ completionNotificationsEnabled: state.enabled, completionNotificationSound: state.sound }),
    /** 模拟操作系统能力。 / Simulate operating-system support. */
    isSupported: () => state.supported,
    /** 模拟系统提交与同步失败。 / Simulate system submission and synchronous failure. */
    createNotification: options => { if (state.fail) throw new Error("native unavailable"); nativeOptions.push(options); const notification = new FakeNotification(); notification.failShow = state.failShow; notifications.push(notification); return notification; },
    /** 模拟当前浮窗；一个关闭、一个发送中关闭。 / Simulate current companions, including closed and concurrently closing windows. */
    getReaders: () => [{
      /** 可用窗口。 / Live window. */ isDestroyed: () => false,
      /** 收集公开投递。 / Collect public deliveries. */ send: (_channel, payload) => { broadcast.push(payload); },
    }, {
      /** 已关闭窗口。 / Closed window. */ isDestroyed: () => true,
      /** 已关闭窗口不得发送。 / Closed windows must not send. */ send: () => { throw new Error("closed send"); },
    }, {
      /** 发送时仍可能已关闭。 / A window may close while sending. */ isDestroyed: () => false,
      /** 模拟并发关闭。 / Simulate concurrent closure. */ send: () => { throw new Error("concurrent close"); },
    }],
    /** 只记录导航，不启动任务或模型。 / Record navigation without starting tasks or models. */
    navigate: target => { navigated.push(target); return true; },
    ...(options.validateEnterpriseRun ? { validateEnterpriseRun: options.validateEnterpriseRun } : {}),
    /** 提供确定性时间。 / Provide deterministic time. */
    now: () => state.time,
  });
  /** 生成真实新终态信封。 / Generate a fresh terminal envelope. */
  function request(overrides: Partial<PublishCompletionNoticeRequest> = {}): PublishCompletionNoticeRequest {
    return { resultId: "result-1", source: "chat", ...(overrides.source === "enterprise_run" ? {} : { conversationId: "conversation-1" }), title: "答复已完成", summary: "已更新设计文件。", status: "completed", occurredAt: new Date(state.time).toISOString(), ...overrides };
  }
  /** 从可信主窗口发布结果。 / Publish a result from the trusted main window. */
  const publish = (overrides: Partial<PublishCompletionNoticeRequest> = {}) => ipc.invoke(CHANNELS.publish, main, request(overrides));
  return { ipc, main, companion, state, cleanup, request, publish, notifications, nativeOptions, broadcast, navigated };
}

test("completion alerts submit once and navigate only after an explicit click", /** 验证真实提交、去重与点击身份。 / Verify actual submission, deduplication, and click identities. */ async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.publish(), { accepted: true, delivery: "submitted" });
    assert.equal(f.notifications[0]?.shown, 1); assert.equal(f.navigated.length, 0);
    assert.deepEqual(await f.publish({ summary: "重复结果" }), { accepted: false, delivery: "duplicate" });
    assert.equal(f.broadcast.length, 1); assert.equal(f.notifications.length, 1);
    f.notifications[0]!.listeners.get("click")!();
    assert.deepEqual(f.navigated, [{ resultId: "result-1", source: "chat", conversationId: "conversation-1" }]);
    assert.equal(f.nativeOptions[0]?.silent, true);
  } finally { f.cleanup(); }
});

test("publish and read boundaries reject untrusted senders, extra commands, and identity aliases", /** 拒绝未授权与跨身份载荷。 / Reject unauthorized and cross-identity payloads. */ async () => {
  const f = fixture();
  try {
    await assert.rejects(f.ipc.invoke(CHANNELS.publish, f.companion, f.request()), /unauthorized/);
    await assert.rejects(f.ipc.invoke(CHANNELS.snapshot, {}), /unauthorized/);
    await assert.rejects(f.ipc.invoke(CHANNELS.open, {}, { resultId: "result-1" }), /unauthorized/);
    for (const patch of [{ url: "https://invalid.test" }, { command: "execute" }, { conversationId: " c" }, { resultId: "x".repeat(513) }, { source: "chat", conversationId: undefined }, { task: {} }, { occurredAt: "yesterday" }]) {
      await assert.rejects(f.ipc.invoke(CHANNELS.publish, f.main, { ...f.request(), ...patch }), /invalid/);
    }
    await f.publish();
    await assert.rejects(f.publish({ conversationId: "other" }), /invalid/);
    assert.equal(f.notifications.length, 1);
  } finally { f.cleanup(); }
});

test("cancellation, unfinished results, muted runs, and history never replay a completion", /** 未完成、静音和历史均保持安静。 / Keep unfinished, muted, and historical results quiet. */ async () => {
  const f = fixture();
  try {
    for (const status of ["canceled", "interrupted", "running", "unknown", "unchanged"] as const) assert.equal((await f.publish({ status })).delivery, "suppressed");
    assert.equal((await f.publish({ notificationPolicy: "silent" })).delivery, "suppressed");
    assert.equal((await f.publish({ notify: false })).delivery, "suppressed");
    assert.equal((await f.publish({ replay: true })).delivery, "stale");
    assert.equal((await f.publish({ occurredAt: "2026-09-14T11:59:59.999Z" })).delivery, "stale");
    assert.equal((await f.publish({ occurredAt: "2026-09-14T13:00:00.000Z" })).delivery, "stale");
    assert.equal(f.notifications.length, 0); assert.equal(f.broadcast.length, 0);
    assert.equal((await f.publish({ status: "unchanged", notificationPolicy: "all" })).delivery, "submitted");
    const restarted = fixture();
    try { restarted.state.time += 600_000; assert.equal((await restarted.publish({ occurredAt: "2026-09-14T12:00:00.000Z" })).delivery, "stale"); }
    finally { restarted.cleanup(); }
  } finally { f.cleanup(); }
});

test("persisted desktop preferences suppress native alerts without discarding companion results", /** 原生开关不破坏公开结果，旧设置迁移默认值正确。 / Native preferences preserve public results and legacy defaults migrate correctly. */ async () => {
  const f = fixture();
  try {
    f.state.enabled = false;
    assert.equal((await f.publish()).delivery, "suppressed"); assert.equal(f.broadcast.length, 1); assert.equal(f.notifications.length, 0);
    f.state.enabled = true; f.state.sound = true;
    assert.equal((await f.publish({ resultId: "result-2" })).delivery, "submitted"); assert.equal(f.nativeOptions[0]?.silent, false);
    const defaults = normalizeSystemSettings({}); assert.equal(defaults.completionNotificationsEnabled, true); assert.equal(defaults.completionNotificationSound, false);
    const muted = normalizeSystemSettings({ completionNotificationsEnabled: false, completionNotificationSound: true });
    assert.equal(muted.completionNotificationsEnabled, false); assert.equal(muted.completionNotificationSound, true);
  } finally { f.cleanup(); }
});

test("native unsupported and failed states are reported without pretending the user saw the alert", /** 系统不支持或提交失败均如实返回。 / Report unsupported or failed system submissions truthfully. */ async () => {
  const f = fixture();
  try {
    f.state.supported = false; assert.equal((await f.publish()).delivery, "unsupported");
    f.state.supported = true; f.state.fail = true; assert.equal((await f.publish({ resultId: "result-2" })).delivery, "failed");
    assert.equal(f.notifications.length, 0); assert.equal(f.broadcast.length, 2); assert.equal(f.navigated.length, 0);
    f.state.fail = false; f.state.failShow = true;
    assert.equal((await f.publish({ resultId: "result-3" })).delivery, "failed");
    assert.equal(f.notifications[0]!.closed, 1);
  } finally { f.cleanup(); }
});

test("native text and companion snapshots contain bounded public content only", /** 验证凭据隐藏区清理和长度边界。 / Verify credential and hidden-block cleanup with length boundaries. */ async () => {
  const f = fixture();
  try {
    await f.publish({ title: "标题".repeat(100), summary: '<think>private reasoning</think>Done password="secret-value" Bearer abcdef <system>private prompt</system>' + "。".repeat(500) });
    const snapshot = await f.ipc.invoke(CHANNELS.snapshot, f.companion) as CompletionNoticeSnapshot;
    assert.equal(snapshot.notices[0]!.title.length, 120); assert.equal(snapshot.notices[0]!.summary.length, 400);
    assert.doesNotMatch(JSON.stringify(snapshot), /private reasoning|secret-value|abcdef|private prompt|notificationPolicy|notify|replay/);
    assert.match(snapshot.notices[0]!.summary, /\[redacted\]/);
    assert.equal(f.nativeOptions[0]!.body, snapshot.notices[0]!.summary);
    await f.publish({ resultId: "unclosed", summary: "Public<think>hidden until end" });
    assert.equal(f.nativeOptions[1]!.body, "Public");
    await f.publish({ resultId: "mismatched", summary: "Public<think>hidden</system>still hidden" });
    assert.equal(f.nativeOptions[2]!.body, "Public");
  } finally { f.cleanup(); }
});

test("snapshots remain bounded and read/open operations never publish or execute", /** 近期读取和导航无执行副作用且身份过期失效。 / Recent reads and navigation never execute, and expired identities become unavailable. */ async () => {
  const f = fixture();
  try {
    for (let index = 0; index < 24; index++) await f.publish({ resultId: `result-${index}`, source: "task", taskId: "task-1", status: index === 23 ? "failed" : "completed" });
    const snapshot = await f.ipc.invoke(CHANNELS.snapshot, f.companion) as CompletionNoticeSnapshot;
    assert.equal(snapshot.notices.length, 20); assert.equal(f.broadcast.length, 24); assert.equal(f.navigated.length, 0);
    assert.equal(await f.ipc.invoke(CHANNELS.open, f.companion, { resultId: "result-0" }), false);
    assert.equal(await f.ipc.invoke(CHANNELS.open, f.companion, { resultId: "result-23" }), true);
    assert.deepEqual(f.navigated[0], { resultId: "result-23", source: "task", conversationId: "conversation-1", taskId: "task-1" });
    await assert.rejects(f.ipc.invoke(CHANNELS.open, f.companion, { resultId: "result-23", taskId: "other" }), /invalid/);
    assert.equal(f.notifications.length, 24);
  } finally { f.cleanup(); }
});

test("shutdown removes IPC and prevents late notification clicks", /** 关闭后迟到事件不能打开会话。 / Late events cannot open conversations after shutdown. */ async () => {
  const f = fixture(); await f.publish(); f.cleanup();
  assert.equal(f.ipc.handlers.size, 0); assert.equal(f.notifications[0]!.closed, 1);
  f.notifications[0]!.listeners.get("click")!(); assert.equal(f.navigated.length, 0);
});

test("typed and packaged preload APIs share fixed channels and hide native events", /** 两份真实预加载代码保持一致且不泄漏原生事件。 / Both actual preload implementations agree and never expose native events. */ async () => {
  for (const packaged of [false, true]) {
    let api: OpenXnetDesktopApi | undefined;
    const calls: unknown[][] = []; const listeners = new Map<string, (...args: unknown[]) => void>();
    const contextBridge = {
      /** 收集真实暴露的API。 / Capture the actually exposed API. */
      exposeInMainWorld(name: string, value: unknown): void { if (name === "openxnetDesktop") api = value as OpenXnetDesktopApi; },
    };
    const ipcRenderer = {
      /** 收集固定IPC调用。 / Capture fixed IPC invocations. */
      async invoke(...args: unknown[]): Promise<unknown> { calls.push(args); return { accepted: true, delivery: "submitted" }; },
      /** 保存精确事件订阅。 / Retain exact event subscriptions. */
      on(channel: string, listener: (...args: unknown[]) => void): void { listeners.set(channel, listener); },
      /** 确认精确事件卸载。 / Confirm exact event unsubscription. */
      removeListener(channel: string, listener: (...args: unknown[]) => void): void { assert.equal(listeners.get(channel), listener); listeners.delete(channel); },
    };
    if (packaged) {
      runInNewContext(readFileSync(resolve(process.cwd(), "static/js/preload.js"), "utf8"), {
        /** 只允许注入Electron测试替身。 / Allow injected Electron doubles only. */
        require: (name: string) => { assert.equal(name, "electron"); return { contextBridge, ipcRenderer, webUtils: {} }; },
        process: { platform: "win32" }, console,
      });
    } else exposeDesktopCore({ contextBridge, ipcRenderer: ipcRenderer as never });
    assert.ok(api);
    const request: PublishCompletionNoticeRequest = { resultId: "preload-test", source: "chat", conversationId: "c1", title: "完成", summary: "已保存", status: "completed", occurredAt: new Date().toISOString() };
    await api.publishCompletionNotice(request); await api.getCompletionNoticeSnapshot(); await api.openCompletionNotice({ resultId: request.resultId });
    assert.deepEqual(calls, [[CHANNELS.publish, request], [CHANNELS.snapshot], [CHANNELS.open, { resultId: request.resultId }]]);
    const received: unknown[][] = [];
    const offNotice = api.onCompletionNotice(/** 仅收集公开参数。 / Collect public arguments only. */ (...args) => { received.push(args); });
    const offNavigate = api.onCompletionNoticeNavigate(/** 仅收集导航身份。 / Collect navigation identities only. */ (...args) => { received.push(args); });
    const nativeEvent = { sender: "private native transport" };
    listeners.get(CHANNELS.notice)!(nativeEvent, request); listeners.get(CHANNELS.navigate)!(nativeEvent, { resultId: "preload-test" });
    assert.deepEqual(received, [[request], [{ resultId: "preload-test" }]]);
    offNotice(); offNavigate(); assert.equal(listeners.has(CHANNELS.notice), false); assert.equal(listeners.has(CHANNELS.navigate), false);
  }
});

/** 构造独立企业运行身份，不能沿用普通会话身份。 / Build an independent enterprise run identity without an ordinary conversation identity. */
function enterpriseRun(overrides: Partial<PublishCompletionNoticeRequest> = {}): Partial<PublishCompletionNoticeRequest> {
  return { source: "enterprise_run", workspaceId: "workspace-a", incidentId: "incident-a", traceId: "trace-a", ...overrides };
}

test("enterprise running updates stay in companions and approved navigation retains exact active run ownership", /** 运行中仅浮窗，点击重新校验当前运行且不执行。 / Running updates reach companions only and clicks revalidate active ownership without execution. */ async () => {
  let active = true; let checks = 0;
  const f = fixture({ /** 模拟真实快照归属检查。 / Simulate authoritative snapshot ownership checks. */ validateEnterpriseRun(target) { checks++; return active && target.workspaceId === "workspace-a" && target.incidentId === "incident-a" && target.traceId === "trace-a"; } });
  try {
    assert.deepEqual(await f.publish(enterpriseRun({ status: "running" })), { accepted: true, delivery: "suppressed" });
    assert.equal(f.notifications.length, 0); assert.equal(f.broadcast.length, 1); assert.equal(f.navigated.length, 0);
    const snapshot = await f.ipc.invoke(CHANNELS.snapshot, f.companion) as CompletionNoticeSnapshot;
    assert.equal(snapshot.notices[0]!.source, "enterprise_run"); assert.equal(snapshot.notices[0]!.status, "running");
    assert.equal(await f.ipc.invoke(CHANNELS.open, f.companion, { resultId: "result-1" }), true);
    assert.deepEqual(f.navigated[0], { resultId: "result-1", source: "enterprise_run", workspaceId: "workspace-a", incidentId: "incident-a", traceId: "trace-a" });
    assert.equal((await f.publish(enterpriseRun({ resultId: "approval-1", status: "action_required" }))).delivery, "submitted");
    assert.equal(f.notifications.length, 1);
    active = false;
    assert.equal(await f.ipc.invoke(CHANNELS.open, f.companion, { resultId: "approval-1" }), false);
    assert.equal(f.navigated.length, 1); assert.ok(checks >= 4);
  } finally { f.cleanup(); }
});

test("enterprise notices reject missing scope, wrong sources, mixed tasks and cross-run identities", /** 拒绝缺项、来源冒用和跨运行标识。 / Reject missing scope, source spoofing, and cross-run identities. */ async () => {
  const f = fixture({ /** 仅接受真实当前运行。 / Accept only the authoritative current run. */ validateEnterpriseRun(target) { return target.workspaceId === "workspace-a" && target.incidentId === "incident-a" && target.traceId === "trace-a"; } });
  try {
    for (const patch of [{ workspaceId: undefined }, { incidentId: undefined }, { traceId: undefined }, { taskId: "task-a" }, { conversationId: "chat-a" },
      { source: "task", taskId: "task-a" }, { source: "chat", conversationId: "chat-a" }, { source: "incident" }, { workspaceId: "workspace-b" }, { incidentId: "incident-b" }, { traceId: "trace-b" }]) {
      await assert.rejects(f.ipc.invoke(CHANNELS.publish, f.main, { ...f.request(enterpriseRun()), ...patch }), /invalid/);
    }
    assert.equal(f.broadcast.length, 0); assert.equal(f.notifications.length, 0);
    await f.publish(enterpriseRun());
    assert.equal((await f.publish(enterpriseRun())).delivery, "duplicate");
    await assert.rejects(f.publish({ source: "task", taskId: "task-a" }), /invalid/);
    await assert.rejects(f.ipc.invoke(CHANNELS.open, f.companion, { resultId: "result-1", traceId: "trace-b" }), /invalid/);
    assert.equal(f.navigated.length, 0);
  } finally { f.cleanup(); }
});

test("enterprise notices fail closed without a verifier while muted results remain visible in companions", /** 缺失核验时拒绝，静音企业结果仍保留浮窗。 / Reject missing validation while muted enterprise results remain in companions. */ async () => {
  const missing = fixture();
  try { await assert.rejects(missing.publish(enterpriseRun()), /invalid/); assert.equal(missing.broadcast.length, 0); }
  finally { missing.cleanup(); }
  const f = fixture({ /** 提供明确成功的隔离核验。 / Provide explicitly successful isolated validation. */ validateEnterpriseRun: () => true });
  try {
    assert.deepEqual(await f.publish(enterpriseRun({ notify: false, summary: '证据已完成 <think>hidden</think>api_key="private-value"' })), { accepted: true, delivery: "suppressed" });
    assert.equal(f.broadcast.length, 1); assert.equal(f.notifications.length, 0);
    assert.doesNotMatch(JSON.stringify(f.broadcast), /hidden|private-value/);
    await assert.rejects(f.publish(enterpriseRun({ traceId: "trace-b" })), /invalid/);
  } finally { f.cleanup(); }
});
