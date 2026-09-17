#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 真实聊天连接反馈回归 / Actual chat connection feedback regressions.
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
const methods = ast.program.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === 'vue_methods').init.properties;

/** 清空微任务而不等待真实网络；flush microtasks without waiting for a real network. */
async function flush() { for (let index = 0; index < 40; index += 1) await Promise.resolve(); }

/** 加载实际宿主、恢复与生成方法，使用可控网络和时钟；load actual host, recovery and generation methods with a controlled network and clock. */
function createHost(options = {}) {
  let time = 100000; let sequence = 0;
  const timers = new Map(); const requests = []; const notices = []; const listeners = new Map(); const saved = [];
  const network = { onLine: options.online !== false };
  /** 为所有实际检查提供假时间；provide a fake clock to actual status checks. */
  class FixtureDate extends Date { static now() { return time; } }
  const context = vm.createContext({ Date: FixtureDate, Math, JSON, Map, Set, TextDecoder, AbortController, navigator: network,
    console: { log() {}, error() {}, warn() {} }, uuid: { v4: () => 'chat-a' }, vue_data: { isElectron: false },
    showNotification: (...args) => notices.push(args), sanitizeProtocolMessage: value => ({ ...value }), sanitizeToolProtocolName: name => name,
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, due: time + delay }); return id; }, clearTimeout: id => timers.delete(id),
    window: { OpenXnetConversationModel: model, addEventListener: (event, callback) => listeners.set(event, callback),
      /** 只通过测试网络返回响应并记录真实调用；return responses through the test network and record actual calls. */
      async openxnetChatFetch(url, request) { requests.push({ url, request }); return options.fetch ? options.fetch(url, request) : Response.json({ conversationId: 'chat-a', state: 'idle' }); },
    },
  });
  const host = {
    conversationId: 'chat-a', conversationConnectionStates: {}, conversationNetworkOnline: network.onLine, conversations: [],
    messages: [{ id: 'question', role: 'user', content: 'Work on this' }], userInput: 'Next unsent draft',
    settings: { selectedProvider: 'fixture-provider', model: 'fixture-model' }, fastSettings: {}, memorySettings: {}, memories: [], agents: {}, mainAgent: 'openxnet-model',
    CLISettings: { cc_path: 'E:/fixture' }, system_prompt: '', fileLinks: [], files: [], images: [], readState: {},
    ttsSettings: {}, systemSettings: {}, toolsSettings: { hideToolResults: {} }, abortController: new AbortController(), approvalMap: {}, asyncToolsID: [],
    isSending: true, isTyping: true, isCurrentLanguageZh: () => true, t: value => value, generateConversationTitle: () => 'Connection fixture',
    startTimer() {}, stopTimer() {}, $nextTick() {}, scrollToBottom() {}, sendMessagesToExtension() {}, sendTTSStatusToVRM() {},
    stopLiveGuidancePolling() {}, startLiveGuidancePolling() {}, refreshLiveGuidanceStatus: async () => null,
    autoSaveSettings: async () => true, maybeHandleKernelConfigIntent: async () => false,
    /** 持久化真实检查点的副本；persist a copy of the actual checkpoint. */
    async saveConversations() { saved.push(JSON.parse(JSON.stringify(this.conversations))); return true; },
    ...options.host,
  };
  for (const name of ['ensureConversationId', 'createConversationCheckpointContext', 'checkpointConversation', 'getConversationRecoveryState', 'resumeInterruptedConversation', 'generateAIResponse', 'sendMessage',
    'ensureConversationConnectionSignals', 'beginConversationConnection', 'setConversationConnectionFeedback', 'classifyConversationConnectionFailure', 'getConversationConnectionState', 'readConversationConnectionStatus', 'checkConversationConnection']) {
    const method = methods.find(node => node.key.name === name);
    assert.ok(method, name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  /** 推进已调度的假计时器；advance scheduled fake timers. */
  async function advance(milliseconds) {
    time += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= time) { timers.delete(id); timer.callback(); }
    await flush();
  }
  /** 发出设备网络信号，不改变系统网络；emit a device signal without changing the system network. */
  function signal(online) { network.onLine = online; listeners.get(online ? 'online' : 'offline')?.(); }
  return { host, requests, notices, saved, advance, signal, timers };
}

/** 准备真实恢复检查所需的原消息与请求身份；prepare original message and request identity for actual recovery checks. */
function interrupt(host, failure = { kind: 'http', httpStatus: 503, retryable: true, detail: 'HTTP 503 · service_response' }) {
  const message = { id: 'partial', role: 'assistant', conversationId: 'chat-a', content: 'Preserved text', pure_content: 'Preserved text', backend_content: [{ role: 'assistant', content: 'Preserved text' }], activityLog: [], taskRefs: [], generationFinished: false };
  host.messages.push(message);
  host.conversations = [{ id: 'chat-a', selectedProvider: 'fixture-provider', model: 'fixture-model', messages: host.messages, recovery: { schema: 'openxnet.conversation-recovery.v1', requestId: 'request-a', assistantMessageId: message.id, state: 'interrupted', workspacePath: 'E:/fixture' } }];
  const scope = host.beginConversationConnection({ conversationId: 'chat-a', requestId: 'request-a' }, message);
  host.setConversationConnectionFeedback(scope, { ...failure, state: 'interrupted' });
  host.isSending = false; host.isTyping = false;
  return { message, scope };
}

/** 从真实错误分类，详情不包含凭据或私有响应；classify actual failures without including credentials or private responses in details. */
test('failure classifier distinguishes offline, HTTP, timeout, stream, auth, quota and cancellation', () => {
  const cases = [
    [new TypeError('Failed fetch https://x/?token=secret Authorization: Bearer secret'), { online: false }, 'offline', null],
    [{ status: 503, message: 'secret server body' }, {}, 'http', 503],
    [{ code: 'HTTP_429', message: 'secret' }, {}, 'http', 429],
    [{ code: 'ETIMEDOUT', name: 'AbortError' }, {}, 'timeout', null],
    [{ code: 'STREAM_INTERRUPTED' }, {}, 'stream', null],
    [{ statusCode: 401 }, { online: false }, 'auth', 401],
    [{ statusCode: 429, code: 'insufficient_quota' }, {}, 'quota', 429],
    [{ name: 'AbortError', cancelled: true, code: 'stopped' }, {}, 'canceled', null],
  ];
  for (const [error, options, kind, status] of cases) {
    const value = model.classifyConnectionFailure(error, options);
    assert.equal(value.kind, kind); assert.equal(value.httpStatus, status);
    assert.doesNotMatch(value.detail, /secret|token|Bearer|https:/);
  }
});

/** 真实503失败只触发有界GET检查，不重放POST；an actual 503 triggers bounded GET checks without replaying the POST. */
test('actual generation HTTP 503 preserves content and draft, then exhausts exactly five read-only checks', async () => {
  const h = createHost({ fetch: async () => new Response('private https://service/?token=secret', { status: 503 }) });
  await h.host.generateAIResponse('openxnet-model'); await flush();
  for (const delay of [500, 1000, 2000, 4000]) await h.advance(delay);
  const state = h.host.getConversationConnectionState();
  assert.equal(state.state, 'failed'); assert.equal(state.kind, 'http'); assert.equal(state.httpStatus, 503);
  assert.equal(state.attempt, 5); assert.equal(state.maxAttempts, 5);
  assert.equal(h.requests.filter(row => row.request.method === 'POST').length, 1);
  assert.equal(h.requests.filter(row => row.request.method === 'GET').length, 5);
  assert.equal(h.host.userInput, 'Next unsent draft');
  assert.equal(h.host.messages.at(-1).content, '');
  assert.equal(h.host.messages.at(-1).backend_content.length, 1);
  assert.equal(h.host.conversations[0].recovery.state, 'interrupted');
  assert.equal(state.messageId, String(h.host.messages.at(-1).id));
  assert.doesNotMatch(JSON.stringify([state, h.notices, h.host.messages.at(-1).activityLog]), /secret|https:\/\/service|response error/);
});

/** 没有DONE的EOF保留正文和真实工具协议；EOF without DONE retains text and actual tool protocol. */
test('actual premature stream EOF retains partial reply and tool receipts and requires explicit continuation', async () => {
  const deltas = [
    { content: 'Actual partial reply' },
    { tool_call_id: 'file-call', tool_content: { title: 'write_file', type: 'call', content: '{"path":"src/item.txt"}' } },
    { tool_call_id: 'file-call', tool_content: { title: 'write_file', type: 'tool_result', content: 'Saved src/item.txt' } },
  ];
  const h = createHost({ fetch: async (url) => url.includes('recovery-status') ? Response.json({ conversationId: 'chat-a', state: 'idle' })
    : new Response(deltas.map(delta => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } }) });
  await h.host.generateAIResponse('openxnet-model'); await flush();
  const message = h.host.messages.at(-1); const state = h.host.getConversationConnectionState();
  assert.match(message.pure_content, /Actual partial reply/); assert.doesNotMatch(message.content, /response error/);
  assert.ok(message.backend_content.some(row => row.role === 'tool' && row.tool_call_id === 'file-call'));
  assert.equal(message.generationFinished, false); assert.equal(state.kind, 'stream'); assert.equal(state.state, 'reachable');
  assert.equal(state.attempt, 1); assert.equal(state.canContinue, true);
  assert.equal(h.requests.filter(row => row.request.method === 'POST').length, 1);
  assert.match(state.message, /原响应流无法直接续接/);
});

/** 取消不触发错误卡、自动探测或重发；cancellation triggers no error card, automatic probe or resend. */
test('actual typed cancellation remains an explicit stop', async () => {
  const h = createHost({ fetch: async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError', cancelled: true, code: 'USER_STOP' }); } });
  await h.host.generateAIResponse('openxnet-model'); await flush();
  assert.equal(h.host.getConversationConnectionState().state, 'idle');
  assert.equal(h.host.conversations[0].recovery.state, 'canceled');
  assert.equal(h.requests.length, 1); assert.equal(h.notices.length, 0);
});

/** 离线与恢复信号不伪装模型恢复；offline and online signals never pretend the model recovered. */
test('device offline then online retains interruption and requires a fresh state check', async () => {
  const h = createHost(); interrupt(h.host);
  h.signal(false);
  assert.equal(h.host.getConversationConnectionState().state, 'offline');
  assert.equal(h.host.getConversationConnectionState().canCheck, false);
  assert.equal(await h.host.checkConversationConnection('chat-a', 'request-a'), false);
  assert.equal(h.requests.length, 0);
  h.signal(true);
  assert.equal(h.host.getConversationConnectionState().state, 'interrupted');
  assert.equal(h.host.getConversationConnectionState().canContinue, false);
  await h.host.checkConversationConnection('chat-a', 'request-a');
  assert.equal(h.host.getConversationConnectionState().state, 'reachable');
  assert.equal(h.host.userInput, 'Next unsent draft');
});

/** 实际离线失败在网络信号恢复后仍保留中断；an actual offline failure remains interrupted after the network signal returns. */
test('an actual offline generation does not claim the device is still offline after an online signal', async () => {
  const h = createHost({ online: false, fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await h.host.generateAIResponse('openxnet-model');
  assert.equal(h.host.getConversationConnectionState().state, 'offline');
  assert.equal(h.requests.length, 1);
  h.signal(true);
  const state = h.host.getConversationConnectionState();
  assert.equal(state.state, 'interrupted'); assert.equal(state.canContinue, false); assert.equal(state.canCheck, true);
  assert.match(state.message, /网络信号已恢复/);
  assert.equal(h.requests.length, 1);
});

/** 真实发送路径遇到失败时停止群聊后续模型，并保留新输入草稿；the actual send path stops later group models after failure and preserves a new draft. */
test('sendMessage stops a failed group sequence and preserves the draft typed during its first request', async () => {
  let h;
  h = createHost({ host: { isSending: false, isTyping: false, isGroupMode: true, selectedGroupAgents: ['openxnet-model', 'second-agent'], agents: { 'second-agent': { name: 'Second' } } },
    fetch: async (url, request) => {
      if (request.method === 'POST') { h.host.userInput = 'New draft typed during the request'; return new Response('Unavailable', { status: 503 }); }
      return Response.json({ conversationId: 'chat-a', state: 'idle' });
    } });
  assert.equal(await h.host.sendMessage(), true); await flush();
  assert.equal(h.requests.filter(row => row.request.method === 'POST').length, 1);
  assert.equal(h.host.userInput, 'New draft typed during the request');
  assert.equal(h.host.messages.filter(message => message.role === 'assistant').length, 1);
});

/** 同会话新请求不能被迟到旧错误清除发送状态；a late old error cannot clear a newer request's sending state in the same conversation. */
test('late generation failure cannot clear a newer request in the same conversation', async () => {
  let rejectRequest;
  const h = createHost({ fetch: () => new Promise((resolve, reject) => { rejectRequest = reject; }) });
  const generating = h.host.generateAIResponse('openxnet-model'); await flush();
  const newer = { id: 'newer-answer', role: 'assistant', conversationId: 'chat-a' };
  h.host.beginConversationConnection({ conversationId: 'chat-a', requestId: 'new-request' }, newer);
  h.host.conversations[0].recovery.requestId = 'new-request';
  h.host.isSending = true; h.host.isTyping = true;
  rejectRequest(new TypeError('Failed to fetch')); await generating; await flush();
  assert.equal(h.host.isSending, true); assert.equal(h.host.isTyping, true);
  assert.equal(h.host.getConversationConnectionState().state, 'idle');
  assert.equal(h.requests.length, 1); assert.equal(h.notices.length, 0);
});

/** 旧检查不能污染新会话或同会话新请求；old checks cannot affect another conversation or a newer request in the same conversation. */
test('late check receipts are scoped to both conversation and request', async () => {
  for (const switchRequest of [false, true]) {
    let resolveFetch;
    const h = createHost({ fetch: () => new Promise(resolve => { resolveFetch = resolve; }) });
    const { message } = interrupt(h.host);
    const checking = h.host.checkConversationConnection('chat-a', 'request-a'); await flush();
    if (switchRequest) {
      h.host.conversations[0].recovery.requestId = 'request-new';
      h.host.beginConversationConnection({ conversationId: 'chat-a', requestId: 'request-new' }, message);
    } else { h.host.conversationId = 'chat-b'; h.host.messages = []; }
    resolveFetch(Response.json({ conversationId: 'chat-a', state: 'idle' }));
    assert.equal(await checking, false);
    const state = h.host.getConversationConnectionState();
    assert.equal(state.state, 'idle'); assert.equal(state.canContinue, false);
    assert.equal(h.requests.length, 1);
  }
});

/** 原连接错误不能在同会话的其他工作区出现；a prior connection failure cannot appear in another workspace of the same conversation. */
test('connection feedback and checks remain in the original workspace', async () => {
  const h = createHost(); interrupt(h.host);
  assert.equal(h.host.getConversationConnectionState().workspacePath, 'E:/fixture');
  h.host.CLISettings.cc_path = 'E:/other-workspace';
  assert.equal(h.host.getConversationConnectionState().state, 'idle');
  assert.equal(await h.host.checkConversationConnection('chat-a', 'request-a'), false);
  assert.equal(h.requests.length, 0);
  h.host.CLISettings.cc_path = 'E:/fixture';
  assert.equal(h.host.getConversationConnectionState().state, 'interrupted');
});

/** 探测计数来自实际请求且服务可达不等于旧任务完成；probe counters come from requests and reachability does not complete prior work. */
test('a running or unknown original reply remains blocked after a successful application probe', async () => {
  for (const runtimeState of ['running', 'unknown']) {
    const h = createHost({ fetch: async () => Response.json({ conversationId: 'chat-a', state: runtimeState }) });
    interrupt(h.host);
    await h.host.checkConversationConnection('chat-a', 'request-a');
    const state = h.host.getConversationConnectionState();
    assert.equal(state.state, 'reachable'); assert.equal(state.canContinue, false); assert.equal(state.attempt, 1);
    assert.equal(h.requests[0].request.method, 'GET');
    if (runtimeState === 'running') assert.match(state.message, /仍在执行/);
    else assert.match(state.message, /仍无法确认/);
  }
});

/** 401不盲目重试且恢复状态详情不回显私有字段；401 is not blindly retried and persisted details cannot expose private fields. */
test('authentication failures stop checking immediately and imported raw details are excluded', async () => {
  const h = createHost({ fetch: async () => new Response('Authorization Bearer secret', { status: 401 }) });
  const { message } = interrupt(h.host);
  await h.host.checkConversationConnection('chat-a', 'request-a');
  const state = h.host.getConversationConnectionState();
  assert.equal(state.kind, 'auth'); assert.equal(state.attempt, 1); assert.equal(state.canContinue, false);
  assert.equal(h.requests.length, 1);
  h.host.conversationConnectionStates = {};
  message.connectionFeedback.detail = 'Authorization: Bearer secret https://x/?api_key=private';
  assert.doesNotMatch(h.host.getConversationConnectionState().detail, /secret|private|api_key|https:/);
});

/** 真正超时会取消GET，且不谎报模型请求重连；a real timeout cancels the GET without claiming a model reconnection. */
test('a stalled status response times out and cancels its actual probe', async () => {
  let signal;
  const h = createHost({ fetch: (url, request) => { signal = request.signal; return new Promise(() => {}); } });
  const reading = h.host.readConversationConnectionStatus('chat-a');
  const rejected = assert.rejects(reading, error => error.code === 'ETIMEDOUT');
  await h.advance(8000); await rejected;
  assert.equal(signal.aborted, true); assert.equal(h.requests.length, 1);
});

/** 继续操作仍遵守原工具结果守卫；continuation still respects the existing tool-outcome guard. */
test('reachable application never bypasses unresolved tool outcomes during explicit continuation', async () => {
  const h = createHost(); const { message } = interrupt(h.host);
  message.activityLog = [{ kind: 'tool', id: 'unknown-tool', status: 'running' }];
  await h.host.checkConversationConnection('chat-a', 'request-a');
  assert.equal(await h.host.resumeInterruptedConversation('chat-a', 'request-a'), false);
  assert.match(h.host.conversationRecoveryNotice.message, /工具结果尚未确认/);
  assert.equal(h.requests.filter(row => row.request?.method === 'POST').length, 0);
  assert.equal(h.host.userInput, 'Next unsent draft');
});

/** 显式继续的核对失败也不能回显令牌或私有响应；failed verification during explicit continuation also excludes tokens and private responses. */
test('explicit continuation uses bounded verification and safe failure feedback', async () => {
  const h = createHost({ fetch: async () => { throw new TypeError('Failed at https://private/?api_key=secret Authorization: Bearer token'); } });
  interrupt(h.host);
  assert.equal(await h.host.resumeInterruptedConversation('chat-a', 'request-a'), false);
  assert.doesNotMatch(h.host.conversationRecoveryNotice.message, /secret|token|private|api_key|https:/);
  assert.equal(h.host.getConversationConnectionState().state, 'failed');
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].request.method, 'GET');
  assert.equal(h.host.userInput, 'Next unsent draft');
});
