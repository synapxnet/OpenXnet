/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话真实回执回归 / Conversation receipt regression tests.
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
const model = require('../static/js/openxnet-conversation-model.js');
const source = fs.readFileSync(path.join(__dirname, '../static/js/vue_methods.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });
const declarations = ast.program.body.filter((node) => node.type === 'VariableDeclaration');
const methods = declarations.flatMap((node) => node.declarations).find((node) => node.id.name === 'vue_methods').init.properties;

/** 隔离加载真实宿主方法；load real host methods with isolated dependencies. */
function createHost(events = [], overrides = {}, desktop = {}) {
  const notices = [];
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, Date, Math, JSON, TextDecoder,
    vue_data: { isElectron: false },
    showNotification: (...args) => notices.push(args), setTimeout() {},
    sanitizeProtocolMessage: (value) => ({ ...value }), sanitizeToolProtocolName: (name) => name,
    AbortController,
    window: { openxnetDesktop: desktop, openxnetChatFetch: desktop.chatFetch || (async () => new Response(events.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } })) },
  });
  const host = {
    notices, messages: [{ role: 'user', content: 'hello' }], conversations: [],
    conversationId: 'conversation-a', mainAgent: 'openxnet-model', memorySettings: { is_memory: true, selectedMemory: 'role-a' },
    memories: [{ id: 'role-a', name: 'Alpha', avatar: '/uploaded_files/alpha.png' }],
    settings: { model: 'test-model' }, fastSettings: {}, ttsSettings: {}, systemSettings: {}, toolsSettings: { hideToolResults: {} }, fileLinks: [],
    abortController: new AbortController(), approvalMap: {}, asyncToolsID: [],
    startTimer() {}, stopTimer() {}, $nextTick() {}, scrollToBottom() {}, sendMessagesToExtension() {},
    t: (value) => value, isCurrentLanguageZh: () => true, saveConversations: async () => {},
    generateConversationTitle: () => 'Conversation', ...overrides,
  };
  for (const name of ['generateAIResponse', 'sendMessage', 'handleSendOrGuidance', 'importChatRoleAvatar', 'processToolApproval', 'executeToolBackend', 'getActiveCliPermissionMode', 'getCliPermissionModeOptions', 'getPermissionModeLabel', 'normalizeCliWorkspaceSettings']) {
    const method = methods.find((node) => node.key.name === name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  return host;
}

/** 加载真实聊天投影，禁止宿主/网络副作用；load the real chat projection without host or network side effects. */
function createBridgeHarness(host, native = {}, appApis = {}, runtime = {}) {
  let code = fs.readFileSync(path.join(__dirname, '../frontend/chat-vite/src/chatBridge.js'), 'utf8');
  code = code.replace(/^import .*;\s*/m, '').replace('export function createChatBridge', 'function createChatBridge');
  const context = vm.createContext({ window: { openxnetApp: host, electronAPI: native, ...appApis }, navigator: { language: 'zh-CN' }, OpenXnetConversationModel: model, Date, Map, Set, performance, ...runtime });
  vm.runInContext(code, context);
  return {
    bridge: vm.runInContext('createChatBridge()', context),
    messages: () => vm.runInContext('normalizeLiveMessages(window.openxnetApp)', context),
    usage: () => vm.runInContext('buildContextWindowState(window.openxnetApp, true)', context),
    permission: () => vm.runInContext('buildPermissionState(window.openxnetApp, true)', context),
  };
}

/** 模拟宿主真实连接记录，不发起外部请求。 / Simulate an actual host connection record without external requests. */
function connectionBridgeFixture() {
  const state = { state: 'interrupted', conversationId: 'connection-a', requestId: 'request-a', messageId: 'answer-a', workspacePath: 'E:/fixture', kind: 'http', httpStatus: 503, attempt: 0, maxAttempts: 5, canCheck: true, canContinue: true, networkOnline: true };
  const recovery = { conversationId: state.conversationId, requestId: state.requestId, messageId: state.messageId, available: true, pending: false, reason: 'Original execution must be verified' };
  const calls = [];
  const host = { conversationId: state.conversationId, CLISettings: { cc_path: state.workspacePath }, userInput: 'Unsent draft', messages: [{ id: state.messageId, role: 'assistant', content: 'Retained reply', toolResults: [{ id: 'tool-one', content: 'Receipt' }] }],
    /** 提供只读记录。 / Provide read-only records. */
    getConversationConnectionState: () => state,
    /** 提供原恢复记录。 / Provide the original recovery record. */
    getConversationRecoveryState: () => recovery,
    /** 记录调用，返回值不作为服务可达的证据。 / Record calls without treating return values as reachability evidence. */
    checkConversationConnection: async (...args) => { calls.push(args); return true; },
  };
  return { state, recovery, host, calls, ...createBridgeHarness(host) };
}

/** 503不能被在线信号抹去，详情投影去除私有内容和凭据。 / Device connectivity cannot erase HTTP 503; projected details remove private content and credentials. */
test('connection snapshots are read-only, bounded, sanitized and anchored to their actual reply', () => {
  const h = connectionBridgeFixture();
  h.state.detail = '<think>private-thought</think>HTTP 503 https://user:pass@example.test/status?access_token=url-secret#hidden Authorization: Bearer credential-value\napi_key="key-secret" password=pwd-secret sk-abcdefghijklmnop';
  h.state.internalResponse = 'private-body'; h.state.attempt = 9;
  const state = h.bridge.snapshot().connection;
  assert.equal(h.calls.length, 0); assert.equal(state.state, 'interrupted'); assert.equal(state.httpStatus, 503); assert.equal(state.networkOnline, true);
  assert.equal(state.attempt, 0); assert.equal(state.messageId, 'answer-a'); assert.equal(state.canContinue, true);
  assert.match(state.detail, /HTTP 503/); assert.match(state.detail, /https:\/\/example.test\/status/);
  assert.doesNotMatch(state.detail, /private-thought|url-secret|credential-value|key-secret|pwd-secret|abcdefghijklmnop|user:pass/);
  assert.equal(state.internalResponse, undefined);
  h.recovery.requestId = 'another-request'; assert.equal(h.bridge.snapshot().connection.canContinue, false); assert.equal(h.bridge.snapshot().connection.continueReason, '');
  h.state.messageId = 'nonexistent'; assert.equal(h.bridge.snapshot().connection.messageId, '');
  h.state.workspacePath = 'E:/other'; assert.equal(h.bridge.snapshot().connection.state, 'idle');
  h.state.workspacePath = 'E:/fixture'; h.state.conversationId = 'foreign'; assert.equal(h.bridge.snapshot().connection.state, 'idle');
});

/** 检查只调用受控只读入口，锁定重复操作且保留所有已有内容。 / Checks call only the controlled read-only entry, lock duplicates and preserve existing content. */
test('connection checks require exact scope and actual host state, preserving draft and receipts', async () => {
  const h = connectionBridgeFixture(); const reference = { ...h.bridge.snapshot().connection };
  const original = JSON.stringify(h.host.messages);
  for (const foreign of [{ conversationId: 'other' }, { requestId: 'other' }, { workspacePath: 'E:/other' }]) assert.equal(await h.bridge.checkConversationConnection({ ...reference, ...foreign }), false);
  assert.equal(h.calls.length, 0);
  const unchanged = await h.bridge.checkConversationConnection(reference); assert.equal(unchanged.state, 'interrupted', 'a true method return does not prove reachability');
  assert.deepEqual(h.calls, [['connection-a', 'request-a']]);
  let finish;
  h.host.checkConversationConnection = () => new Promise(/** 控制真实检查完成时机。 / Control when the actual check finishes. */ (resolve) => { finish = resolve; });
  const pending = h.bridge.checkConversationConnection(reference);
  assert.equal(await h.bridge.checkConversationConnection(reference), false);
  h.state.state = 'reachable'; finish(true); assert.equal((await pending).state, 'reachable');
  assert.equal(h.host.userInput, 'Unsent draft'); assert.equal(JSON.stringify(h.host.messages), original);
});

/** 原请求检查迟到后不得污染新请求，异常只暴露受限提示。 / Late checks cannot affect a new request, and exceptions expose only limited feedback. */
test('connection checks reject stale request results and never expose raw transport errors', async () => {
  const h = connectionBridgeFixture(); const reference = { ...h.bridge.snapshot().connection }; let finish;
  h.host.checkConversationConnection = () => new Promise(/** 控制迟到回执。 / Control a late receipt. */ (resolve) => { finish = resolve; });
  const pending = h.bridge.checkConversationConnection(reference); h.state.requestId = 'request-b'; finish(true); assert.equal(await pending, false);
  h.state.requestId = 'request-a'; h.host.checkConversationConnection = async () => { throw new Error('Authorization: Bearer private-token'); };
  await assert.rejects(h.bridge.checkConversationConnection(reference), /** 仅允许通用脱敏提示。 / Allow generic sanitized feedback only. */ (error) => !error.message.includes('private-token') && /检查|check/.test(error.message));
});

/** 引导桥只投影状态，停止操作独立于提交并严格校验修改范围。 / Guidance bridge projects state only, keeps stop independent and validates mutation scope. */
test('guidance bridge keeps snapshots read-only and separates scoped mutation from stopping', async () => {
  let reads = 0; let stops = 0; const writes = [];
  const state = { scope: 'scope-a', available: true, items: [] };
  const host = { activeMenu: 'chat', conversationId: 'chat-a', isSending: true, userInput: 'Preserve this draft', getLiveGuidanceState: () => state,
    refreshLiveGuidanceStatus: async () => { reads += 1; return {}; }, updateLiveGuidance: async (...args) => { writes.push(args); return { success: true }; }, stopGenerate: () => { stops += 1; } };
  const h = createBridgeHarness(host);
  assert.equal(h.bridge.snapshot().guidance.scope, 'scope-a'); assert.equal(reads, 0);
  await h.bridge.refreshGuidance(); assert.equal(reads, 1); host.activeMenu = 'settings'; assert.equal(await h.bridge.refreshGuidance(), false); assert.equal(reads, 1);
  await assert.rejects(h.bridge.updateGuidance({ scope: 'scope-b' }, 'cancel'), /会话已变化/); assert.equal(writes.length, 0);
  await h.bridge.updateGuidance({ scope: 'scope-a', guidance_id: 'one', revision: 1 }, 'edit', 'New instruction'); assert.equal(writes.length, 1);
  assert.equal(h.bridge.stopResponse(), true); assert.equal(stops, 1); assert.equal(host.userInput, 'Preserve this draft');
});

/** 构造只存在于测试中的会话自动任务。 / Build conversation automation tasks that exist only in tests. */
function automationBridgeFixture(overrides = {}, appApis = {}, runtime = {}) {
  const automation = { state: 'active', notification_policy: 'changes_only', completion_condition: 'Objective verified', runs: [{ id: 'run-one', outcome: 'changed', summary: 'Actual result', evidence: ['receipt-one'], notify: true, finished_at: '2026-09-14T01:00:00Z' }] };
  const task = { id: 'core-one', legacyTaskId: 'legacy-one', title: 'Fixture monitor', description: 'Read fixture status', status: 'pending', workspacePath: 'E:/fixture', details: { context: { origin_conversation_id: 'automation-chat', automation } } };
  const host = { activeMenu: 'chat', conversationId: 'automation-chat', CLISettings: { cc_path: 'E:/fixture' }, messages: [], taskList: [task], ...overrides };
  const harness = createBridgeHarness(host, {}, appApis, runtime);
  return { ...harness, host, task, automation, tasks: () => harness.bridge.snapshot().automations.tasks };
}

/** 快照仅投影明确归属任务，不访问接口或按名称猜测来源。 / Snapshots project explicit ownership without network access or name-based scope inference. */
test('automation snapshot filters conversation and workspace, merges actual IDs and performs no reads', () => {
  let reads = 0;
  const h = automationBridgeFixture({}, { openxnetDesktop: { listTasks: async () => { reads += 1; return { tasks: [] }; } } });
  h.host.taskList.push({ ...h.task, id: 'foreign-chat', details: { context: { origin_conversation_id: 'other-chat', automation: h.automation } } }, { ...h.task, id: 'foreign-workspace', workspacePath: 'C:/private' }, { ...h.task, id: 'missing-origin', details: { context: { automation: h.automation } } });
  h.host.messages = [{ role: 'assistant', content: 'Task created', taskRefs: [{ taskId: 'legacy-one', originConversationId: 'automation-chat', title: 'Latest task receipt', automation: h.automation }] }];
  const tasks = h.tasks();
  assert.equal(tasks.length, 1); assert.equal(tasks[0].id, 'core-one'); assert.equal(tasks[0].legacyId, 'legacy-one');
  assert.equal(tasks[0].runs[0].summary, 'Actual result'); assert.equal(reads, 0);
});

/** 任务读取限频，离开聊天不会创建后台轮询。 / Task reads are throttled and never poll outside chat. */
test('automation reads once on entry, throttle active tasks and stop outside chat', async () => {
  let now = 10000; let reads = 0;
  /** 使用可控时钟验证间隔，无等待或真实调度器。 / Use a controlled clock without sleeps or real schedulers. */
  class FixtureDate extends Date { static now() { return now; } }
  const h = automationBridgeFixture({}, { openxnetDesktop: { listTasks: async () => { reads += 1; return { tasks: [h.task] }; } } }, { Date: FixtureDate });
  await h.bridge.refreshAutomations(); assert.equal(reads, 1);
  now += 4999; await h.bridge.refreshAutomations(); assert.equal(reads, 1);
  now += 1; await h.bridge.refreshAutomations(); assert.equal(reads, 2);
  h.host.activeMenu = 'task-center'; now += 10000; await h.bridge.refreshAutomations({ force: true }); assert.equal(reads, 2);
  assert.equal(h.tasks().length, 0);
  h.host.activeMenu = 'chat'; await h.bridge.refreshAutomations(); assert.equal(reads, 3);
});

/** 空会话无周期读取，删除任务不会被历史创建回执复活。 / Empty conversations avoid periodic reads and deleted tasks cannot be resurrected by old receipts. */
test('authoritative empty automation lists retire old task refs and idle polling', async () => {
  let reads = 0;
  const h = automationBridgeFixture({}, { openxnetDesktop: { listTasks: async () => { reads += 1; return { tasks: [] }; } } });
  h.host.messages = [{ role: 'assistant', content: 'Created', taskRefs: [{ taskId: 'legacy-one', originConversationId: 'automation-chat', automation: h.automation }] }];
  await h.bridge.refreshAutomations(); assert.equal(h.tasks().length, 0);
  await h.bridge.refreshAutomations(); assert.equal(reads, 1);
  h.host.messages[0].taskRefs.push({ taskId: 'legacy-new', title: 'New task', originConversationId: 'automation-chat', automation: h.automation });
  assert.equal(h.tasks()[0].legacyId, 'legacy-new');
});

/** 切换会话、工作区或卸载后迟到读取不能进入当前快照。 / Late reads after conversation, workspace or unmount changes cannot enter current snapshots. */
test('automation read completion cannot cross scope or revive after suspension', async () => {
  let finish;
  const h = automationBridgeFixture({}, { openxnetDesktop: { listTasks: async () => new Promise((resolve) => { finish = resolve; }) } });
  const pending = h.bridge.refreshAutomations();
  h.host.conversationId = 'other-chat'; finish({ tasks: [h.task] }); await pending;
  assert.equal(h.tasks().length, 0);
  h.host.conversationId = 'automation-chat';
  const suspended = h.bridge.refreshAutomations(); h.bridge.suspendAutomationRefresh(); finish({ tasks: [] });
  assert.equal(await suspended, false); assert.equal(h.tasks()[0].id, 'core-one');
});

/** 控制操作必须包含真实legacy身份与所属会话，失败和审批不伪成功。 / Controlled actions carry actual legacy identity and conversation; failures and approvals never become success. */
test('automation lifecycle uses scoped controlled APIs and actual successful receipts', async () => {
  let response = { success: false, status: 'error', result: 'Actual rejection' }; const requests = [];
  const h = automationBridgeFixture({}, { openxnetChatFetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json(response); } });
  const task = h.tasks()[0];
  await assert.rejects(h.bridge.updateConversationAutomation(task, 'pause'), /Actual rejection/);
  assert.equal(h.tasks()[0].state, 'active');
  response = { success: false, status: 'awaiting_approval' };
  assert.equal((await h.bridge.updateConversationAutomation(task, 'pause')).awaitingApproval, true);
  assert.equal(h.tasks()[0].state, 'active');
  response = { success: true, status: 'completed', taskRef: { taskId: 'legacy-one', originConversationId: 'automation-chat', title: h.task.title, automation: { ...h.automation, state: 'paused' } } };
  assert.equal((await h.bridge.updateConversationAutomation(task, 'pause')).success, true);
  assert.equal(h.tasks()[0].state, 'paused'); assert.equal(h.tasks()[0].id, 'core-one');
  assert.deepEqual(requests[0], { url: '/execute_tool_manually', body: { tool_name: 'update_automation_task', tool_params: { task_id: 'legacy-one', action: 'pause' }, conversationId: 'automation-chat', approval_type: 'once' } });
  h.host.conversationId = 'other-chat'; await assert.rejects(h.bridge.updateConversationAutomation(task, 'complete'), /会话/);
  assert.equal(requests.length, 3);
});

/** 失败读取保留已知状态，并展示真实返回错误。 / Failed reads retain known state and expose actual response errors. */
test('automation web reads honor workspace and never treat backend errors as empty success', async () => {
  const h = automationBridgeFixture({}, { openxnetChatFetch: async (url) => { assert.equal(url, '/v1/tasks/list'); return Response.json({ error: 'Fixture unavailable', tasks: [] }); } });
  assert.equal(await h.bridge.refreshAutomations(), false);
  assert.equal(h.tasks()[0].id, 'core-one'); assert.equal(h.bridge.snapshot().automations.error, 'Fixture unavailable');
});

/** 面板重开也不能重复提交，同时旧读取不得覆盖已确认操作回执。 / Reopening a panel cannot duplicate an action, and old reads cannot overwrite confirmed receipts. */
test('automation bridge locks duplicate actions and rejects reads predating their completion', async () => {
  let finishRead; let finishAction; let writes = 0;
  const h = automationBridgeFixture({}, { openxnetDesktop: { listTasks: async () => new Promise((resolve) => { finishRead = resolve; }) }, openxnetChatFetch: async () => { writes += 1; return new Promise((resolve) => { finishAction = resolve; }); } });
  const task = h.tasks()[0]; const read = h.bridge.refreshAutomations(); const action = h.bridge.updateConversationAutomation(task, 'pause');
  assert.equal(h.tasks()[0].mutationPending, true);
  await assert.rejects(h.bridge.updateConversationAutomation(task, 'complete'), /正在确认/); assert.equal(writes, 1);
  finishAction(Response.json({ success: true, taskRef: { taskId: 'legacy-one', originConversationId: 'automation-chat', automation: { ...h.automation, state: 'paused' } } }));
  await action; assert.equal(h.tasks()[0].state, 'paused'); assert.equal(h.tasks()[0].mutationPending, false);
  finishRead({ tasks: [h.task] }); assert.equal(await read, false); assert.equal(h.tasks()[0].state, 'paused');
});

/** 子任务会话读取只能绑定已有步骤，迟到记录不得跨会话显示。 / Child transcript reads bind existing steps and late records never cross conversations. */
test('subagent transcript bridge binds actual step IDs and discards late responses', async () => {
  let finish; const calls = [];
  const host = { activeMenu: 'chat', conversationId: 'child-chat', CLISettings: { cc_path: 'E:/fixture' }, messages: [{ id: 'child-answer', conversationId: 'child-chat', role: 'assistant', content: 'Delegated', generationFinished: true, activityLog: [{ id: 'child-step', kind: 'subagent', taskId: 'legacy-child', status: 'pending', title: 'Child' }] }] };
  const h = createBridgeHarness(host, { readConversationSubagentTranscript: async (request) => { calls.push(JSON.parse(JSON.stringify(request))); return new Promise((resolve) => { finish = resolve; }); } });
  const step = h.messages()[0].activity.steps[0];
  await assert.rejects(h.bridge.readSubagentTranscript('child-answer', 'foreign'), /子任务/);
  const read = h.bridge.readSubagentTranscript('child-answer', step.id);
  const transcript = { schema: 'openxnet.agent-transcript.v1', messages: [] };
  finish({ taskId: 'legacy-child', conversationId: 'child-chat', transcript });
  assert.equal(await read, transcript);
  assert.deepEqual(calls[0], { taskId: 'legacy-child', conversationId: 'child-chat' });
  const stale = h.bridge.readSubagentTranscript('child-answer', step.id); host.CLISettings.cc_path = 'E:/another';
  finish({ taskId: 'legacy-child', conversationId: 'child-chat', transcript });
  await assert.rejects(stale, /工作区/);
});

/** 完成提醒沿用系统设置，只在原生确认后更新选项，保存失败不改原值。 / Completion alerts use system settings and update only after native confirmation, retaining prior values on failure. */
test('completion preferences await native system-setting confirmation and retain unrelated settings', async () => {
  let finish; const calls = [];
  const host = { systemSettings: { theme: 'custom-theme', completionNotificationsEnabled: true, completionNotificationSound: false } };
  const h = createBridgeHarness(host, { saveSystemSettings: async (settings) => { calls.push(JSON.parse(JSON.stringify(settings))); return new Promise((resolve) => { finish = resolve; }); } });
  const saving = h.bridge.setCompletionPreference('completionNotificationsEnabled', false);
  assert.equal(host.systemSettings.completionNotificationsEnabled, true);
  await assert.rejects(h.bridge.setCompletionPreference('completionNotificationSound', true), /正在保存/);
  host.systemSettings.theme = 'changed-while-saving';
  finish({ settings: { ...calls[0] } }); assert.equal(await saving, true);
  assert.equal(host.systemSettings.completionNotificationsEnabled, false); assert.equal(host.systemSettings.theme, 'changed-while-saving');
  const failed = h.bridge.setCompletionPreference('completionNotificationSound', true); finish({ settings: { completionNotificationSound: false } });
  await assert.rejects(failed, /未获保存确认/); assert.equal(host.systemSettings.completionNotificationSound, false);
  assert.equal(await h.bridge.setCompletionPreference('unrelated-field', true), false); assert.equal(calls.length, 2);
});

/** 工具生命周期使用真实结束回执；tool lifecycles require explicit completion receipts. */
test('streaming tools retain full results, approvals stay waiting, and unfinished calls stay unknown', async () => {
  const events = [];
  for (let index = 0; index < 15; index += 1) {
    events.push({ tool_call_id: `call-${index}`, tool_content: { title: 'read_file', type: 'call', content: `{"path":"file-${index}"}` } });
    events.push({ tool_call_id: `call-${index}`, tool_content: { title: 'read_file', type: 'tool_result', content: 'x'.repeat(700) } });
  }
  events.push({ tool_call_id: 'stream', tool_content: { title: 'runner', type: 'call', content: '{}' } });
  events.push({ tool_call_id: 'stream', tool_content: { title: 'runner', type: 'tool_result_stream', content: 'first' } });
  events.push({ tool_call_id: 'stream', tool_content: { title: 'tool_result_stream', type: 'tool_result_stream', content: 'second' } });
  events.push({ tool_complete: { id: 'stream', name: 'runner' } });
  events.push({ tool_call_id: 'partial-stream', tool_content: { title: 'runner', type: 'tool_result_stream', content: 'unfinished output' } });
  events.push({ tool_call_id: 'background', tool_status: 'pending', tool_content: { title: 'runner', type: 'tool_result', content: 'launched in background' } });
  events.push({ tool_call_id: 'unfinished', tool_content: { title: 'runner', type: 'call', content: '{}' } });
  events.push({ tool_call_id: 'approval', tool_content: { title: 'write_file', type: 'tool_result', content: JSON.stringify({ type: 'approval_required', tool_name: 'write_file', tool_params: { path: 'a' } }) } });
  events.push({ tool_call_id: 'failed', tool_content: { title: 'read_file', type: 'error', content: 'actual failure' } });
  const host = createHost(events);
  await host.generateAIResponse('openxnet-model');
  const message = host.messages.at(-1);
  assert.deepEqual(host.notices, []);
  assert.equal(message.activityLog.filter((step) => step.kind === 'tool').length, 21);
  assert.equal(message.activityLog.find((step) => step.id === 'tool-call-0').output.length, 700);
  assert.equal(message.activityLog.find((step) => step.id === 'tool-stream').output, 'firstsecond');
  assert.equal(message.activityLog.find((step) => step.id === 'tool-stream').status, 'done');
  assert.equal(message.activityLog.find((step) => step.id === 'tool-unfinished').status, 'unknown');
  assert.equal(message.activityLog.find((step) => step.id === 'tool-partial-stream').status, 'unknown');
  assert.equal(message.activityLog.find((step) => step.id === 'tool-background').status, 'pending');
  assert.equal(message.activityLog.find((step) => step.id === 'tool-approval').status, 'awaiting_approval');
  assert.equal(message.activityLog.find((step) => step.id === 'tool-failed').error, 'actual failure');
  assert.deepEqual(host.notices, []);
});

/** 记忆和身份只属于产生它们的消息；memory and identity belong only to the originating message. */
test('memory receipts are conversation-scoped and identity does not follow later role selection', async () => {
  const receipt = { schema: 'openxnet.chat-memory-context.v1', id: 'receipt-a', conversationId: 'conversation-a', source: 'synapxnet-memory-v3', status: 'injected', count: 1, characters: 90 };
  const host = createHost([{ memory_context: receipt }, { memory_context: { ...receipt, id: 'foreign', conversationId: 'conversation-b' } }, { content: 'Hello' }]);
  await host.generateAIResponse('openxnet-model');
  host.memorySettings.selectedMemory = 'role-b';
  host.memories.push({ id: 'role-b', name: 'Beta', avatar: '/uploaded_files/beta.png' });
  const message = host.messages.at(-1);
  assert.equal(message.identity.id, 'role-a');
  assert.equal(message.identity.image, '/uploaded_files/alpha.png');
  assert.equal(message.memoryContext.length, 1);
  const projected = createBridgeHarness(host).messages().at(-1);
  assert.equal(projected.identity.name, 'Alpha');
  assert.equal(projected.memoryContext[0].id, 'receipt-a');
});

/** 创建工具成功不等于子任务完成；successful creation is not completed subtask execution. */
test('subtask references create a separate activity with authoritative pending status', async () => {
  const host = createHost([{ tool_call_id: 'spawn', tool_content: { title: 'create_subtask', type: 'tool_result', content: 'created' }, task_ref: { taskId: 'task-1', parentTaskId: '', agentType: 'default', status: 'pending', title: 'Investigate' } }]);
  await host.generateAIResponse('openxnet-model');
  const message = host.messages.at(-1);
  assert.equal(message.activityLog.find((step) => step.id === 'tool-spawn').status, 'done');
  assert.equal(message.activityLog.find((step) => step.id === 'task-task-1').status, 'pending');
  assert.equal(message.taskRefs[0].taskId, 'task-1');
  assert.equal(message.activityLog.find((step) => step.id === 'task-task-1').agentId, undefined);
});

/** 上下文不虚构上限且保留原消息索引；context limits stay unknown and original message indices survive projection. */
test('projection preserves attachments and source indices while labeling context estimates', () => {
  const indices = [];
  const host = { currentLanguage: 'zh-CN', conversationId: 'c', settings: {}, messages: [{ role: 'system', content: 'system' }, { id: 'm1', role: 'user', content: 'hello', imageLinks: [{ name: 'a.png', path: '/uploaded_files/a.png' }] }, { id: 'm2', role: 'assistant', content: 'answer', agentName: 'Historical', generationFinished: true }], formatMessage: (text, index) => { indices.push(index); return text; } };
  const harness = createBridgeHarness(host);
  assert.equal(harness.messages()[0].attachments[0].name, 'a.png');
  assert.equal(harness.messages()[1].identity.name, 'Historical');
  assert.ok(indices.every((index) => index === 2));
  assert.equal(harness.usage().limit, null);
  assert.equal(harness.usage().estimated, true);
  assert.equal(harness.usage().autoCompactAt, undefined);
  host.messages.at(-1).contextUsage = { source: 'provider', actual: true, promptTokens: 120 };
  assert.equal(harness.usage().used, 120);
  assert.equal(harness.usage().actual, true);
});

/** 失败保存不得替换头像；failed persistence must preserve the previous avatar. */
test('avatar import preserves old data on save failure and binds a successful save to the selected role', async () => {
  const desktop = { importSelectedArtifacts() {}, saveLegacyRendererSettings: async () => { throw new Error('save failed'); } };
  const host = createHost([], { isElectron: true, uploadApplicationFiles: async () => ({ success: true, fileLinks: [{ path: '/uploaded_files/new.png' }] }), buildLegacyRendererSettingsPayload() { return { memories: this.memories }; } }, desktop);
  const file = { type: 'image/png', size: 12 };
  await assert.rejects(host.importChatRoleAvatar('role-a', file), /save failed/);
  assert.equal(host.memories[0].avatar, '/uploaded_files/alpha.png');
  desktop.saveLegacyRendererSettings = async ({ settings }) => ({ schema: 'openxnet.legacy-renderer-state.v1', settings });
  const result = await host.importChatRoleAvatar('role-a', file);
  assert.equal(result.id, 'role-a');
  assert.equal(host.memories[0].avatar, '/uploaded_files/new.png');
  await assert.rejects(host.importChatRoleAvatar('missing', file), /Select a valid role/);
});

/** 上传期间角色变化使保存失效；changing roles during upload invalidates the pending save. */
test('avatar upload refuses a changed role and never issues a settings write', async () => {
  let writes = 0;
  const host = createHost([], { isElectron: true }, { importSelectedArtifacts() {}, saveLegacyRendererSettings: async () => { writes += 1; } });
  host.uploadApplicationFiles = async () => { host.memorySettings.selectedMemory = 'role-b'; return { success: true, fileLinks: [{ path: '/uploaded_files/new.png' }] }; };
  await assert.rejects(host.importChatRoleAvatar('role-a', { type: 'image/png', size: 12 }), /Role changed/);
  assert.equal(writes, 0);
  assert.equal(host.memories[0].avatar, '/uploaded_files/alpha.png');
});

/** 接受回执和开关保存失败不能伪成功；acceptance and settings failures must not become success. */
test('bridge returns actual acceptance and native-memory saves roll back on failure', async () => {
  const host = { settings: { model: 'local-test' }, mainAgent: 'openxnet-model', memorySettings: {}, handleSendOrGuidance: async () => false, autoSaveSettings: async () => { throw new Error('save failed'); } };
  const harness = createBridgeHarness(host);
  assert.equal(await harness.bridge.sendMessage('hello'), false);
  await assert.rejects(harness.bridge.toggleNativeMemory(), /save failed/);
  assert.equal(host.memorySettings.synapxnetV3Enabled, undefined);
  host.settings.model = '';
  await assert.rejects(harness.bridge.sendMessage('hello'), /选择模型/);
});

/** 附件失败保留草稿且不创建消息；failed attachment imports preserve drafts without creating messages. */
test('attachment upload rejection preserves the draft and returns false', async () => {
  const file = { name: 'report.txt' };
  const host = createHost([], {
    userInput: 'keep this draft', files: [file], images: [], readState: {},
    ensureConversationId() {}, uploadApplicationFiles: async () => { throw new Error('import rejected'); },
  });
  assert.equal(await host.sendMessage(), false);
  assert.equal(host.userInput, 'keep this draft');
  assert.equal(host.files[0], file);
  assert.equal(host.messages.length, 1);
  assert.equal(host.isTyping, false);
});

/** 手动执行失败必须抛错；manual execution failures must propagate as failures. */
test('manual tool outcomes require explicit success and preserve empty successful output', async () => {
  const failure = createHost([], {}, { chatFetch: async () => Response.json({ success: false, status: 'error', result: 'permission rejected' }) });
  await assert.rejects(failure.executeToolBackend('tool', {}, 'once'), /permission rejected/);
  const success = createHost([], {}, { chatFetch: async () => Response.json({ success: true, status: 'completed', result: '' }) });
  assert.equal(await success.executeToolBackend('tool', {}, 'once'), '');
});

/** 审批恢复绑定原身份并且不覆盖后续消息；approval continuation binds the original identity without overwriting later messages. */
test('approval updates the owning message and starts a new turn when later messages exist', async () => {
  const owner = { id: 'owner', conversationId: 'conversation-a', role: 'assistant', content: '', identity: { id: 'role-a', kind: 'role', name: 'Alpha' }, activityLog: [{ id: 'tool-approval-1', status: 'awaiting_approval' }] };
  const later = { id: 'later', role: 'assistant', content: 'Later', activityLog: [] };
  const host = createHost([], { messages: [owner, later], approvalMap: { 'approval-1': { tool_name: 'tool', tool_params: {} } }, updateUIBlock() {}, escapeHtml: (value) => value });
  host.executeToolBackend = async () => 'actual output';
  const continuations = [];
  host.generateAIResponse = async (...args) => { continuations.push(args); };
  assert.equal(await host.processToolApproval('approval-1', 'once'), true);
  assert.equal(owner.activityLog[0].status, 'done');
  assert.equal(owner.activityLog[0].output, 'actual output');
  assert.deepEqual(continuations[0], ['memory/role-a', 'Alpha', false]);
  assert.equal(later.content, 'Later');
});

/** 执行失败保留错误且不续写，跨会话拒绝；failed approvals retain errors and foreign conversations are rejected. */
test('approval failure never resumes generation or executes a foreign receipt', async () => {
  const owner = { conversationId: 'conversation-a', content: '', activityLog: [{ id: 'tool-approval-1', status: 'awaiting_approval' }] };
  const host = createHost([], { messages: [owner], approvalMap: { 'approval-1': { tool_name: 'tool', tool_params: {} } }, updateUIBlock() {} });
  let calls = 0;
  host.executeToolBackend = async () => { calls += 1; throw new Error('actual failure'); };
  host.generateAIResponse = async () => assert.fail('must not resume after failure');
  assert.equal(await host.processToolApproval('approval-1', 'once'), false);
  assert.equal(owner.activityLog[0].status, 'error');
  assert.equal(owner.activityLog[0].error, 'actual failure');
  owner.activityLog[0].status = 'awaiting_approval';
  owner.conversationId = 'other-conversation';
  assert.equal(await host.processToolApproval('approval-1', 'once'), false);
  assert.equal(calls, 1);
});

/** 实时助手正文使复制/引用可用，同时保留原 HTML；live assistant text enables copy/quote while preserving the original HTML. */
test('live assistant projection exposes its answer text without changing formatted HTML', () => {
  const host = { isTyping: true, messages: [{ id: 'live-answer', role: 'assistant', pure_content: '已找到答案。', content: '<div class="highlight-block-reasoning">private reasoning</div>已找到答案。' }], formatMessage: (value) => `render:${value}` };
  const message = createBridgeHarness(host).messages()[0];
  assert.equal(message.text, '已找到答案。');
  assert.equal(message.html, 'render:已找到答案。');
});

/** 历史内容中的嵌套工具、审批和推理不进入复制正文；nested tools, approvals and reasoning in history never enter copy text. */
test('historical assistant projection removes nested private blocks and keeps the complete visible answer', () => {
  const answer = '这是完整的可见回复。'.repeat(50);
  const content = `<p>开始 &amp; 摘要</p><div class="highlight-block"><div>tool title</div><pre>private tool input</pre><div>private tool output</div></div><div class='highlight-block-reasoning'><div>private reasoning</div>more private reasoning</div><div class="approval-card">private approval parameters</div><think>hidden chain</think><p>${answer}</p>`;
  const host = { messages: [{ id: 'history-answer', role: 'assistant', content, generationFinished: true }], formatMessage: (value) => `render:${value}` };
  const message = createBridgeHarness(host).messages()[0];
  assert.ok(message.text.startsWith('开始 & 摘要'));
  assert.ok(message.text.endsWith(answer));
  assert.doesNotMatch(message.text, /private|hidden chain|tool title|<div|<pre/);
  assert.equal(message.html, `render:${content}`);
});

/** 只有工具或未闭合推理的消息没有可复制正文；tool-only and unfinished reasoning messages have no copyable answer. */
test('live tool-only and unfinished reasoning messages keep copy text empty', () => {
  const messages = [
    { id: 'only-tools', role: 'assistant', content: '<div class="highlight-block"><div>call</div><pre>private parameters</pre></div>', generationFinished: true },
    { id: 'only-reasoning', role: 'assistant', pure_content: '', content: '<div class="highlight-block-reasoning">private unfinished reasoning' },
    { id: 'thinking-tag', role: 'assistant', content: '<think>private unfinished chain' },
  ];
  const projected = createBridgeHarness({ isTyping: true, messages }).messages();
  assert.ok(projected.every((message) => message.text === ''));
});

/** 正文里的代码示例仍可复制，隐藏HTML不可复制；visible code examples remain copyable while hidden HTML stays excluded. */
test('assistant text preserves visible code examples and removes hidden elements', () => {
  const content = '示例：\n```html\n<div class="highlight-block">visible example</div>\n```\nUse `<think>` as a literal.\n<span hidden>hidden secret</span><span aria-hidden="true">aria secret</span><div style="display:none">style secret</div><script>script secret</script>\n结束 &#x1F600;';
  const message = createBridgeHarness({ messages: [{ id: 'example-answer', role: 'assistant', pure_content: content, generationFinished: true }] }).messages()[0];
  assert.ok(message.text.includes('<div class="highlight-block">visible example</div>'));
  assert.ok(message.text.includes('`<think>`'));
  assert.ok(message.text.endsWith('结束 😀'));
  assert.doesNotMatch(message.text, /hidden secret|aria secret|style secret|script secret/);
});

/** 各引擎只保存真实模式字段，无工作区与禁用 CLI 不引起自动启用。 / Each engine saves its real mode field without enabling a disabled CLI or requiring a workspace. */
test('permission changes use actual engine modes and preserve disabled CLI and unrelated engines', async () => {
  const engines = [['local', 'localEnvSettings', 'auto-approve', 'yolo'], ['ds', 'dsSettings', 'auto-approve', 'yolo'], ['cc', 'ccSettings', 'acceptEdits', 'bypassPermissions'], ['oc', 'ocSettings', 'acceptEdits', 'bypassPermissions'], ['qc', 'qcSettings', 'auto-edit', 'yolo']];
  for (const [engine, key, editMode, highMode] of engines) {
    const saved = [];
    const settings = Object.fromEntries(engines.map(([, field]) => [field, { permissionMode: 'default', keep: field }]));
    const host = createHost([], { ...settings, CLISettings: { enabled: false, engine, cc_path: '', permissionMode: 'default' },
      /** 用内存快照验证实际持久化入参。 / Verify actual persistence inputs through in-memory snapshots. */
      autoSaveSettings: async function savePermissionFixture() { saved.push(JSON.parse(JSON.stringify({ cli: this.CLISettings, settings: this[key] }))); },
      /** 旧 setter 会隐式启用工作区，不得调用。 / The legacy setter implicitly enables workspaces and must not be called. */
      setActiveCliPermissionMode() { throw new Error('Legacy auto-enable setter must not run'); },
    });
    const harness = createBridgeHarness(host);
    const before = harness.permission();
    assert.equal(before.current, 'default');
    assert.equal(before.available, true);
    assert.deepEqual(Array.from(before.options, (option) => option.id), ['default', 'plan', editMode, highMode, 'cowork']);
    assert.equal(saved.length, 0);
    assert.equal(await harness.bridge.setPermissionMode(editMode), true);
    assert.equal(host[key].permissionMode, editMode);
    assert.equal(host.CLISettings.permissionMode, editMode);
    assert.equal(host.CLISettings.enabled, false);
    assert.equal(host.CLISettings.cc_path, '');
    assert.equal(host.CLISettings.engine, engine);
    for (const [, otherKey] of engines) if (otherKey !== key) assert.equal(host[otherKey].permissionMode, 'default');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].cli.enabled, false);
    assert.equal(await harness.bridge.setPermissionMode(editMode), true);
    assert.equal(saved.length, 1, 'selecting the confirmed mode must not write again');
    assert.equal(harness.permission().current, editMode);
  }
});

/** 没有宿主选项时仍采用实际引擎别名，拒绝未知模式。 / Missing host options still use actual engine aliases and reject unknown modes. */
test('fallback permission options match engine aliases and unavailable persistence stays read-only', async () => {
  let saves = 0;
  const host = { CLISettings: { engine: 'local', enabled: false, cc_path: 'E:/existing-workspace' }, localEnvSettings: { permissionMode: 'plan' }, autoSaveSettings: async () => { saves += 1; } };
  const harness = createBridgeHarness(host);
  assert.deepEqual(Array.from(harness.permission().options, (option) => option.id), ['default', 'plan', 'auto-approve', 'yolo', 'cowork']);
  await assert.rejects(harness.bridge.setPermissionMode('bypassPermissions'), /不支持/);
  await assert.rejects(harness.bridge.setPermissionMode(''), /不支持/);
  assert.equal(saves, 0);
  await harness.bridge.setPermissionMode('default');
  assert.equal(host.CLISettings.enabled, false, 'an existing directory must not implicitly enable CLI');
  assert.equal(host.CLISettings.cc_path, 'E:/existing-workspace');
  delete host.autoSaveSettings;
  assert.equal(harness.permission().available, false);
  assert.equal(await harness.bridge.setPermissionMode('yolo'), false);
  assert.equal(host.localEnvSettings.permissionMode, 'default');
});

/** throw、false 与显式失败回执都必须恢复旧模式并补偿持久化。 / Throws, false and explicit failure receipts must restore and persist the previous mode. */
test('permission persistence failures restore original fields and compensate a possible partial save', async () => {
  for (const failure of ['throw', false, { success: false }]) {
    const writes = [];
    const cli = { engine: 'local', enabled: false, permissionMode: 'plan', cc_path: '' };
    const local = { permissionMode: 'plan', keep: 'unchanged' };
    const host = { CLISettings: cli, localEnvSettings: local,
      /** 第一写入模拟落盘后失败，第二写入确认恢复。 / Fail after the first simulated write and acknowledge restoration on the second. */
      autoSaveSettings: async function saveWithFailure() {
        writes.push(this.localEnvSettings.permissionMode);
        if (writes.length === 1) { if (failure === 'throw') throw new Error('Fixture save failed'); return failure; }
        return true;
      },
    };
    await assert.rejects(createBridgeHarness(host).bridge.setPermissionMode('yolo'));
    assert.equal(host.CLISettings, cli);
    assert.equal(host.localEnvSettings, local);
    assert.equal(local.permissionMode, 'plan');
    assert.equal(cli.permissionMode, 'plan');
    assert.equal(cli.enabled, false);
    assert.equal(local.keep, 'unchanged');
    assert.deepEqual(writes, ['yolo', 'plan']);
  }
});

/** 双重失败不宣称后端恢复，且回滚时恢复原先缺失字段。 / Double failures never claim backend restoration and missing fields remain missing after rollback. */
test('failed compensation reports uncertainty and restores initially absent permission fields', async () => {
  const host = { CLISettings: { engine: 'local', enabled: false }, autoSaveSettings: async () => { throw new Error('offline'); } };
  const harness = createBridgeHarness(host);
  await assert.rejects(harness.bridge.setPermissionMode('yolo'), /请重试以确认运行时设置/);
  assert.equal(Object.hasOwn(host.CLISettings, 'permissionMode'), false);
  assert.equal(Object.hasOwn(host, 'localEnvSettings'), false);
  assert.equal(harness.permission().current, 'default');
  assert.equal(harness.permission().pending, false);
});

/** 保存期间保持旧模式、拒绝第二次写入，并隔离引擎切换后的回滚。 / Pending saves retain the old mode, reject duplicate writes and isolate rollback after engine changes. */
test('pending permission changes stay confirmed and never roll back a different current engine', async () => {
  let rejectSave;
  let calls = 0;
  const host = { CLISettings: { engine: 'local', enabled: false, permissionMode: 'default' }, localEnvSettings: { permissionMode: 'default' }, ocSettings: { permissionMode: 'plan' },
    /** 第一轮由测试控制完成，补偿保存正常结束。 / Let the test finish the first save while compensation succeeds. */
    autoSaveSettings() { calls += 1; return calls === 1 ? new Promise((resolve, reject) => { rejectSave = reject; }) : Promise.resolve(true); },
  };
  const harness = createBridgeHarness(host);
  const pending = harness.bridge.setPermissionMode('yolo');
  assert.equal(harness.permission().current, 'default');
  assert.equal(harness.permission().pending, true);
  await assert.rejects(harness.bridge.setPermissionMode('plan'), /正在保存/);
  assert.equal(calls, 1);
  host.CLISettings.engine = 'oc';
  host.CLISettings.permissionMode = 'plan';
  assert.equal(harness.permission().current, 'plan');
  rejectSave(new Error('first engine failed'));
  await assert.rejects(pending, /first engine failed/);
  assert.equal(host.localEnvSettings.permissionMode, 'default');
  assert.equal(host.ocSettings.permissionMode, 'plan');
  assert.equal(host.CLISettings.permissionMode, 'plan');
  assert.equal(host.CLISettings.engine, 'oc');
  assert.equal(host.CLISettings.enabled, false);
});

/** 同范围设置回传换引用后仍恢复失败写入的模式。 / Restore a failed mode change after same-scope settings hydration replaces object references. */
test('permission rollback handles equivalent settings hydration without persisting the failed mode again', async () => {
  const writes = [];
  const host = { CLISettings: { engine: 'local', enabled: false, cc_path: 'E:/fixture', permissionMode: 'default' }, localEnvSettings: { permissionMode: 'default', keep: 'value' },
    /** 首次模拟设置回传和失败，补偿记录真实当前值。 / Simulate initial settings hydration and failure, recording the actual value on compensation. */
    async autoSaveSettings() {
      writes.push(this.localEnvSettings.permissionMode);
      if (writes.length === 1) {
        this.CLISettings = { ...this.CLISettings };
        this.localEnvSettings = { ...this.localEnvSettings, refreshed: true };
        throw new Error('Post-save synchronization failed');
      }
      return true;
    },
  };
  const harness = createBridgeHarness(host);
  await assert.rejects(harness.bridge.setPermissionMode('yolo'), /Post-save synchronization failed/);
  assert.deepEqual(writes, ['yolo', 'default']);
  assert.equal(host.CLISettings.permissionMode, 'default');
  assert.equal(host.localEnvSettings.permissionMode, 'default');
  assert.equal(host.localEnvSettings.refreshed, true);
  assert.equal(host.CLISettings.enabled, false);
  assert.equal(harness.permission().uncertain, false);
});

/** 双重失败后选择当前模式必须真实重存，消除界面与落盘状态差异。 / Selecting the current mode after double failure must really save it to reconcile UI and durable state. */
test('an uncertain permission mode can be saved again even when its displayed value is unchanged', async () => {
  let calls = 0;
  let durable = 'default';
  const host = { CLISettings: { engine: 'local', enabled: false, permissionMode: 'default' }, localEnvSettings: { permissionMode: 'default' },
    /** 首次落盘后失败，补偿离线，最后重试保存成功。 / Fail after the initial write, fail compensation offline, then allow an explicit retry. */
    async autoSaveSettings() {
      calls += 1;
      if (calls !== 2) durable = this.localEnvSettings.permissionMode;
      if (calls <= 2) throw new Error('Temporary failure');
      return true;
    },
  };
  const harness = createBridgeHarness(host);
  await assert.rejects(harness.bridge.setPermissionMode('yolo'), /请重试/);
  assert.equal(durable, 'yolo');
  assert.equal(harness.permission().current, 'default');
  assert.equal(harness.permission().uncertain, true);
  assert.equal(await harness.bridge.setPermissionMode('default'), true);
  assert.equal(calls, 3);
  assert.equal(durable, 'default');
  assert.equal(harness.permission().uncertain, false);
});

/** 实际设置载入归一化不能覆盖明确的禁用值。 / Actual settings hydration normalization must not overwrite an explicit disabled value. */
test('workspace normalization preserves disabled CLI after saved settings are reloaded', () => {
  const host = createHost([], { CLISettings: { enabled: false, cc_path: 'E:/existing-workspace', engine: 'local', permissionMode: 'plan' } });
  host.CLISettings = JSON.parse(JSON.stringify(host.CLISettings));
  host.normalizeCliWorkspaceSettings();
  assert.equal(host.CLISettings.enabled, false);
  assert.equal(host.CLISettings.permissionMode, 'plan');
  host.CLISettings = { cc_path: 'E:/legacy-workspace' };
  host.normalizeCliWorkspaceSettings();
  assert.equal(host.CLISettings.enabled, true, 'legacy settings without an explicit enabled value retain migration behavior');
  host.CLISettings = { enabled: true, cc_path: 'E:/active-workspace' };
  host.normalizeCliWorkspaceSettings();
  assert.equal(host.CLISettings.enabled, true);
});

/** 构造真实模型投影后的文件操作引用。 / Build a file-action reference from the actual model projection. */
function fileBridgeFixture(native = {}) {
  const host = { currentLanguage: 'zh-CN', conversationId: 'file-chat', CLISettings: { engine: 'local', cc_path: 'E:/fixture' }, messages: [{ id: 'file-answer', role: 'assistant', content: 'Updated a file', generationFinished: true, activityLog: [
    { id: 'file-step', kind: 'tool', status: 'done', fileChanges: [{ id: 'receipt-file', path: 'src/example.py', operation: 'modify', after: 'print("fixture")', contentSource: 'receipt' }] },
  ] }] };
  const harness = createBridgeHarness(host, native);
  const message = harness.messages()[0];
  const step = message.activity.steps[0];
  const file = step.fileChanges[0];
  const reference = { conversationId: host.conversationId, workspacePath: host.CLISettings.cc_path, messageId: message.id, stepId: step.id, fileId: file.id, path: file.path };
  return { host, harness, reference };
}

/** 任意路径、外部会话或错误步骤不得进入原生文件接口。 / Arbitrary paths, foreign conversations and wrong steps must never reach native file APIs. */
test('file bridge dispatches only references belonging to the current conversation receipt', async () => {
  const reads = [];
  const { harness, reference } = fileBridgeFixture({ readConversationFile: async (request) => { reads.push(request); return { path: 'E:/fixture/src/example.py', content: 'current text', source: 'workspace' }; } });
  assert.equal(harness.bridge.conversationFileCapabilities().read, true);
  for (const change of [{ path: '../secret.txt' }, { fileId: 'foreign-file' }, { stepId: 'other-step' }, { messageId: 'other-message' }, { conversationId: 'other-chat' }, { workspacePath: 'C:/private' }]) {
    await assert.rejects(harness.bridge.readConversationFile({ ...reference, ...change }));
  }
  assert.equal(reads.length, 0);
  const result = await harness.bridge.readConversationFile(reference);
  assert.equal(result.content, 'current text');
  assert.deepEqual(JSON.parse(JSON.stringify(reads)), [{ workspacePath: 'E:/fixture', path: 'src/example.py' }]);
});

/** 异步磁盘读取期间切换范围，结果不得返回给新会话。 / Disk results must not enter a new conversation when its scope changes while reading. */
test('file bridge rejects stale native reads after the conversation changes', async () => {
  let resolveRead;
  const { host, harness, reference } = fileBridgeFixture({ readConversationFile: () => new Promise((resolve) => { resolveRead = resolve; }) });
  const pending = harness.bridge.readConversationFile(reference);
  host.conversationId = 'new-chat';
  resolveRead({ path: 'E:/fixture/src/example.py', content: 'old text' });
  await assert.rejects(pending, /已变化/);
});

/** 用户选择文件的授权由原生返回，不从回执路径伪造。 / User-selected file grants originate in native responses rather than forged receipt paths. */
test('file bridge binds selected-file grants to the original receipt and dispatches actions without command strings', async () => {
  const actions = [];
  const { harness, reference } = fileBridgeFixture({
    selectConversationFile: async () => ({ source: 'selected-file', path: 'D:/chosen/example.py', content: 'chosen text', grantId: 'native-grant' }),
    listConversationFileEditors: async () => [{ id: 'code', label: 'Visual Studio Code' }],
    actOnConversationFile: async (request) => { actions.push(request); return { success: true }; },
  });
  await assert.rejects(harness.bridge.actOnConversationFile(reference, 'open-editor', 'code', true), /授权已失效/);
  const selected = await harness.bridge.selectConversationFile(reference);
  assert.equal(selected.source, 'selected-file');
  assert.equal((await harness.bridge.listConversationFileEditors(reference))[0].id, 'code');
  await harness.bridge.actOnConversationFile(reference, 'open-editor', 'code', true);
  assert.deepEqual(JSON.parse(JSON.stringify(actions)), [{ workspacePath: 'E:/fixture', path: 'D:/chosen/example.py', grantId: 'native-grant', action: 'open-editor', editorId: 'code' }]);
  await assert.rejects(harness.bridge.actOnConversationFile(reference, 'run-shell', 'echo wrong'));
  await assert.rejects(harness.bridge.actOnConversationFile({ ...reference, path: 'D:/chosen/another.py' }, 'open-editor', 'code', true));
  assert.equal(actions.length, 1);
});

/** 浏览器仅支持已有回执，取消原生选择不产生授权。 / Browsers support received content only and canceled native selection creates no grant. */
test('file bridge exposes unavailable native capabilities honestly and canceled selection creates no grant', async () => {
  const browser = fileBridgeFixture();
  assert.deepEqual(JSON.parse(JSON.stringify(browser.harness.bridge.conversationFileCapabilities())), { read: false, actions: false, editors: false, select: false });
  await assert.rejects(browser.harness.bridge.readConversationFile(browser.reference), /不可|不能/);
  const { harness, reference } = fileBridgeFixture({ selectConversationFile: async () => ({ canceled: true }), actOnConversationFile: async () => { throw new Error('must not execute'); } });
  assert.equal((await harness.bridge.selectConversationFile(reference)).canceled, true);
  await assert.rejects(harness.bridge.actOnConversationFile(reference, 'reveal', '', true), /授权已失效/);
});
