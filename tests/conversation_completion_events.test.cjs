/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话和任务真实完成事件 / Actual conversation and task completion events.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../static/js/vue_methods.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });
const methods = ast.program.body.filter((node) => node.type === 'VariableDeclaration').flatMap((node) => node.declarations).find((node) => node.id.name === 'vue_methods').init.properties;

/** 使用注入的原生接口运行真实完成方法，不投递系统通知。 / Run actual completion methods with injected native APIs without delivering system notifications. */
function completionHost(desktop = {}, fields = {}) {
  const notices = [];
  const context = vm.createContext({ window: { openxnetDesktop: { publishCompletionNotice: async (notice) => { notices.push(JSON.parse(JSON.stringify(notice))); return { accepted: true, delivery: 'submitted' }; }, ...desktop } }, console: { warn() {} }, Date, Map, Set, Promise });
  const host = { conversationId: 'currently-open-chat', isCurrentLanguageZh: () => true, conversations: [], CLISettings: { cc_path: 'E:/fixture' }, ...fields };
  for (const name of ['getPublicCompletionSummary', 'publishChatCompletionNotice', 'observeTaskCompletionSnapshot', 'connectCompletionNoticeNavigation', 'openCompletionNoticeTarget']) {
    const method = methods.find((node) => node.key.name === name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  return { host, notices };
}
/** 清空通知投递微任务。 / Flush notification delivery microtasks. */
async function flush() { for (let index = 0; index < 8; index += 1) await Promise.resolve(); }
/** 构造与Core快照一致的任务身份和完成时间。 / Build task identities and completion times matching Core snapshots. */
function task(fields = {}) { return { id: 'core-task', legacyTaskId: 'legacy-task', title: 'Actual task', status: 'running', completedAt: null, workspacePath: 'E:/fixture', resultSummary: 'Actual public result', details: { context: { origin_conversation_id: 'original-chat' } }, ...fields }; }

/** 聊天完成来源为真实终态，隐藏推理不会进入摘要，重复回调不重发。 / Chat completion requires actual terminal state, excludes hidden reasoning and deduplicates repeated callbacks. */
test('chat completion notices require real completion and retain only public bounded summaries', async () => {
  const h = completionHost();
  const context = { requestId: 'actual-request', conversationId: 'original-chat', state: 'completed', metadata: { title: 'Original conversation' } };
  const message = { id: 'reply-one', generationFinished: true, pure_content: '<think>hidden reasoning</think><b>Public answer</b>', activityLog: [], activityEndedAt: Date.now() };
  await h.host.publishChatCompletionNotice(context, message); await h.host.publishChatCompletionNotice(context, message);
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].source, 'chat'); assert.equal(h.notices[0].conversationId, 'original-chat');
  assert.equal(h.notices[0].summary, 'Public answer'); assert.equal(h.notices[0].resultId, 'chat:actual-request:reply-one');
  for (const state of ['streaming', 'interrupted', 'canceled']) await h.host.publishChatCompletionNotice({ ...context, requestId: state, state }, message);
  for (const status of ['running', 'pending', 'awaiting_approval', 'unknown', 'interrupted']) await h.host.publishChatCompletionNotice({ ...context, requestId: status }, { ...message, activityLog: [{ kind: 'tool', status }] });
  assert.equal(h.notices.length, 1);
});

/** 未闭合及嵌套隐藏区不能因剥离标签变成公开摘要。 / Unclosed or nested hidden sections cannot become public summaries through tag stripping. */
test('public summaries suppress nested and unclosed hidden sections before truncation', () => {
  const h = completionHost();
  for (const tag of ['think', 'thought', 'thinking', 'analysis', 'reasoning', 'system', 'script', 'style']) {
    assert.equal(h.host.getPublicCompletionSummary(`Public <${tag}>private`), 'Public');
    assert.equal(h.host.getPublicCompletionSummary(`<${tag}>private</${tag}>Public`), 'Public');
    assert.equal(h.host.getPublicCompletionSummary(`Public <${tag} data-secret="private`), 'Public');
  }
  assert.equal(h.host.getPublicCompletionSummary('Before <analysis>private <think>nested</think> still private</analysis> After'), 'Before After');
  assert.equal(h.host.getPublicCompletionSummary('Before <system><analysis>private</system> After'), 'Before After');
  assert.equal(h.host.getPublicCompletionSummary(`<analysis>${'private'.repeat(100)}</analysis>${'Public '.repeat(100)}`).length, 400);
  assert.equal(h.host.getPublicCompletionSummary('a😀', 2), 'a');
});

/** 历史快照仅登记基线，真实running->completed变化只发布一次。 / Historical snapshots only establish a baseline; actual running-to-completed transitions publish once. */
test('task snapshot observer skips history and publishes a terminal transition exactly once', async () => {
  const h = completionHost(); const past = '2026-01-01T00:00:00Z';
  h.host.observeTaskCompletionSnapshot({ tasks: [task({ status: 'completed', completedAt: past })] }, false);
  h.host.observeTaskCompletionSnapshot({ tasks: [task({ status: 'completed', completedAt: past })] }, true); await flush(); assert.equal(h.notices.length, 0);
  h.host.observeTaskCompletionSnapshot({ tasks: [task()] }, true);
  const completed = task({ status: 'completed', completedAt: new Date().toISOString() });
  h.host.observeTaskCompletionSnapshot({ tasks: [completed] }, true); h.host.observeTaskCompletionSnapshot({ tasks: [completed] }, true); await flush();
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].conversationId, 'original-chat'); assert.equal(h.notices[0].taskId, 'legacy-task'); assert.equal(h.notices[0].summary, 'Actual public result');
});

/** 自动任务使用真实run身份与通知策略，静默结果不被升级为通知。 / Automations retain actual run identities and notification policies without promoting silent results to alerts. */
test('automation completion preserves run notification policies and does not replay initial runs', async () => {
  const h = completionHost();
  const run = { id: 'old-run', outcome: 'completed', summary: 'Old result', notify: true, finished_at: '2026-01-01T00:00:00Z' };
  const current = task({ details: { context: { origin_conversation_id: 'original-chat', automation: { notification_policy: 'changes_only', runs: [run] } } } });
  h.host.observeTaskCompletionSnapshot({ tasks: [current] }, false);
  current.details.context.automation.runs.push({ id: 'quiet-run', outcome: 'unchanged', summary: 'No change', notify: false, finished_at: new Date().toISOString() });
  h.host.observeTaskCompletionSnapshot({ tasks: [current] }, true); await flush();
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].resultId, 'task:legacy-task:quiet-run'); assert.equal(h.notices[0].notify, false); assert.equal(h.notices[0].notificationPolicy, 'changes_only');
  current.details.context.automation.notification_policy = 'silent';
  current.details.context.automation.runs.push({ id: 'done-run', outcome: 'completed', summary: 'Objective verified', notify: false, finished_at: new Date().toISOString() });
  h.host.observeTaskCompletionSnapshot({ tasks: [current] }, true); h.host.observeTaskCompletionSnapshot({ tasks: [current] }, true); await flush();
  assert.equal(h.notices.length, 2); assert.equal(h.notices[1].notificationPolicy, 'silent'); assert.equal(h.notices[1].notify, false);
});

/** 无归属任务不会猜成当前会话，主动取消也不发布完成。 / Tasks without ownership never inherit the current conversation, and cancellation never publishes completion. */
test('unscoped tasks keep their actual task target and canceled runs do not alert', async () => {
  const h = completionHost(); const current = task({ details: {} });
  h.host.observeTaskCompletionSnapshot({ tasks: [current] }, false);
  h.host.observeTaskCompletionSnapshot({ tasks: [{ ...current, status: 'cancelled', completedAt: new Date().toISOString() }] }, true); await flush(); assert.equal(h.notices.length, 0);
  h.host.observeTaskCompletionSnapshot({ tasks: [{ ...current, status: 'failed', completedAt: new Date().toISOString(), errorMessage: 'Actual failure', resultSummary: '' }] }, true); await flush();
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].conversationId, undefined); assert.equal(h.notices[0].status, 'failed'); assert.equal(h.notices[0].summary, 'Actual failure');
});

/** 点击通知只打开真实已有目标，既不生成回复也不创建任务。 / Notification clicks open actual existing targets without generating replies or creating tasks. */
test('completion navigation opens the owning conversation and rejects unknown targets', async () => {
  let navigation; const loaded = []; let unsubscribed = 0;
  const h = completionHost({ onCompletionNoticeNavigate: (callback) => { navigation = callback; return () => { unsubscribed += 1; }; } }, { conversations: [{ id: 'original-chat' }], userInput: 'Keep this draft', loadConversation: async (id) => loaded.push(id) });
  h.host.connectCompletionNoticeNavigation(); h.host.connectCompletionNoticeNavigation(); assert.equal(unsubscribed, 1);
  navigation({ resultId: 'result-one', source: 'chat', conversationId: 'original-chat' }); await flush();
  assert.deepEqual(loaded, ['original-chat']); assert.equal(h.host.activeMenu, 'chat'); assert.equal(h.host.userInput, 'Keep this draft');
  assert.equal(await h.host.openCompletionNoticeTarget({ resultId: 'unknown', source: 'chat', conversationId: 'missing' }), false);
  assert.equal(h.notices.length, 0);
});

/** 原生通知失败不改变任务状态或抛出未处理的异常。 / Native notification failure neither changes task state nor throws an unhandled exception. */
test('native notification failures never change task outcomes', async () => {
  const h = completionHost({ publishCompletionNotice: () => { throw new Error('Native notice unavailable'); } });
  const current = task(); h.host.observeTaskCompletionSnapshot({ tasks: [current] }, false);
  const completed = { ...current, status: 'completed', completedAt: new Date().toISOString() };
  h.host.observeTaskCompletionSnapshot({ tasks: [completed] }, true); await flush(); assert.equal(completed.status, 'completed');
});
