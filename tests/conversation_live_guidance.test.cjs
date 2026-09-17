/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 实时引导范围与原子回执回归 / Live guidance scope and atomic receipt regression.
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
/** 跨边界克隆独立JSON。 / Clone independent JSON across fixture boundaries. */
function clone(value) { return JSON.parse(JSON.stringify(value)); }
/** 清空在途异步回执，不使用真实时间等待。 / Flush in-flight asynchronous receipts without real-time waits. */
async function flush() { for (let count = 0; count < 16; count += 1) await Promise.resolve(); }
/** 建立真实归属的服务端引导记录。 / Build an explicitly owned server guidance record. */
function item(fields = {}) { return { guidance_id: 'guidance-one', conversation_id: 'chat-a', text: 'Original guidance', state: 'pending', mode: 'soft', priority: 0, revision: 1, created_at: '2026-09-14T01:00:00Z', ...fields }; }
/** 构造实际接口结构的列表。 / Construct lists matching the actual interface structure. */
function listing(items = [], fields = {}) { return { ok: true, runtime_id: 'runtime-one', conversation_id: 'chat-a', items, pending: items.filter((entry) => entry.state === 'pending'), recent: [], status: {}, ...fields }; }
/** 运行真实宿主与固定kernel传输，所有执行端、定时器与网络均隔离。 / Run real host and fixed kernel transport with isolated execution, timers and network. */
function guidanceHost(options = {}) {
  const calls = []; const timers = new Map(); let identity = 0; let now = 100000; let timerId = 0;
  /** 使用测试时钟检查限频。 / Use a fixture clock to inspect throttling. */
  class FixtureDate extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: FixtureDate, Map, Set, JSON, Promise, URLSearchParams, encodeURIComponent,
    console: { warn() {} }, uuid: { v4: () => `request-${++identity}` }, fetch: options.fetch,
    window: { setInterval: (callback) => { timers.set(++timerId, callback); return timerId; }, clearInterval: (id) => timers.delete(id), openxnetDesktop: {
      /** 投递隔离的真实kernel信封。 / Deliver an isolated actual kernel envelope. */
      invokeApplicationKernel: async (request) => { calls.push(clone(request)); return { schema: 'openxnet.kernel-runtime.v1', success: true, operation: request.operation, data: await options.kernel(request.operation, request.payload) }; },
    } },
  });
  const host = { conversationId: 'chat-a', CLISettings: { cc_path: 'E:/fixture' }, activeMenu: 'chat', isSending: true, isTyping: true, userInput: 'Original guidance',
    abortController: new AbortController(), isCurrentLanguageZh: () => true, isDesktopKernelRuntimeAvailable: () => true, ...options.host };
  for (const name of ['getLiveGuidanceCache', 'getLiveGuidanceState', 'applyLiveGuidanceSnapshot', 'refreshLiveGuidanceStatus', 'sendLiveGuidance', 'mutateLiveGuidance', 'updateLiveGuidance', 'detectLiveGuidanceMode', 'normalizeLiveGuidanceMode', 'getActiveLiveGuidanceMode', 'fetchKernelPayload', 'fetchKernelJson', 'invokeBrowserKernelOperation', 'startLiveGuidancePolling', 'stopLiveGuidancePolling', 'handleSendOrGuidance']) {
    const method = methods.find((node) => node.key.name === name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  return { host, calls, timers, advance: (milliseconds) => { now += milliseconds; } };
}

/** 真正生成中追加使用精确会话和实际实例身份，不中止、不伪造已接收。 / Guidance during generation uses exact conversation and runtime identities without abort or fabricated receipt. */
test('live guidance keeps the active generation running and requires a real queue receipt', async () => {
  const h = guidanceHost({ kernel: async (operation, payload) => operation === 'guidance-list' ? listing() : { ok: true, runtime_id: 'runtime-one', guidance: item({ text: payload.text }) } });
  assert.equal(h.host.getLiveGuidanceState().available, false); assert.equal(h.calls.length, 0);
  const controller = h.host.abortController;
  assert.equal(await h.host.handleSendOrGuidance(), true);
  assert.equal(h.host.abortController, controller); assert.equal(controller.signal.aborted, false); assert.equal(h.host.isSending, true);
  assert.equal(h.host.userInput, ''); assert.equal(h.host.getLiveGuidanceState().items[0].state, 'pending');
  assert.deepEqual(h.calls.map((call) => call.operation), ['guidance-list', 'guidance-add']);
  assert.equal(h.calls[1].payload.conversationId, 'chat-a'); assert.equal(h.calls[1].payload.runtimeId, 'runtime-one'); assert.ok(h.calls[1].payload.requestId);
  h.host.conversationId = ''; assert.equal(await h.host.sendLiveGuidance('No identity'), false); assert.equal(h.calls.length, 2);
});

/** 网络失败保留草稿，同一操作的重试保持相同requestId。 / Network failures retain the draft and retries retain the same request ID. */
test('failed guidance submissions retain text and reuse identity on explicit retry', async () => {
  let additions = 0;
  const h = guidanceHost({ kernel: async (operation) => {
    if (operation === 'guidance-list') return listing();
    if (++additions === 1) throw new Error('Fixture disconnected');
    return { ok: true, runtime_id: 'runtime-one', guidance: item({ state: 'consumed', revision: 2 }) };
  } });
  assert.equal(await h.host.sendLiveGuidance(), false); assert.equal(h.host.userInput, 'Original guidance'); assert.match(h.host.getLiveGuidanceState().error, /disconnected/);
  assert.equal(await h.host.sendLiveGuidance(), true);
  const writes = h.calls.filter((call) => call.operation === 'guidance-add'); assert.equal(writes[0].payload.requestId, writes[1].payload.requestId);
  assert.equal(h.host.getLiveGuidanceState().items[0].state, 'consumed');
});

/** 消费竞态以冲突回执为准，不能把已消费的条目标成撤回。 / Consumption races follow conflict receipts without marking consumed entries withdrawn. */
test('atomic edit and withdrawal retain actual revisions and consumption conflicts', async () => {
  let mode = 'edit'; const record = item();
  const h = guidanceHost({ kernel: async (operation, payload) => {
    if (operation === 'guidance-list') return listing([record]);
    if (mode === 'edit') { Object.assign(record, { text: payload.text, revision: 2 }); return { ok: true, runtime_id: 'runtime-one', guidance: record }; }
    Object.assign(record, { state: 'consumed', revision: 3 }); return { ok: false, runtime_id: 'runtime-one', error: { code: 'guidance_conflict', message: 'Already received at checkpoint' }, guidance: record };
  } });
  await h.host.refreshLiveGuidanceStatus();
  let state = h.host.getLiveGuidanceState();
  await h.host.updateLiveGuidance({ ...state.items[0], scope: state.scope }, 'edit', 'Edited guidance');
  assert.equal(h.calls.at(-1).payload.expectedRevision, 1); assert.equal(h.host.getLiveGuidanceState().items[0].text, 'Edited guidance');
  mode = 'consume'; state = h.host.getLiveGuidanceState();
  await assert.rejects(h.host.updateLiveGuidance({ ...state.items[0], scope: state.scope }, 'cancel'), /Already received/);
  assert.equal(h.host.getLiveGuidanceState().items[0].state, 'consumed'); assert.equal(h.calls.at(-1).payload.expectedRevision, 2);
  const count = h.calls.length;
  await assert.rejects(h.host.updateLiveGuidance({ ...state.items[0], scope: state.scope }, 'edit', 'Cannot change'), /已接收/); assert.equal(h.calls.length, count);
});

/** 迟到读写只留在原缓存，不能改另一会话的草稿、队列或发送状态。 / Late reads and writes remain in the original cache without changing another conversation's draft or state. */
test('guidance replies remain isolated across conversation and workspace switches', async () => {
  let resolveList; let resolveAdd;
  const h = guidanceHost({ kernel: async (operation) => operation === 'guidance-list' ? new Promise((resolve) => { resolveList = resolve; }) : new Promise((resolve) => { resolveAdd = resolve; }) });
  const reading = h.host.refreshLiveGuidanceStatus(); await flush();
  h.host.conversationId = 'chat-b'; h.host.userInput = 'Draft B'; resolveList(listing([item()])); await reading;
  assert.equal(h.host.getLiveGuidanceState().items.length, 0); assert.equal(h.host.userInput, 'Draft B');
  h.host.conversationId = 'chat-a'; h.host.userInput = 'Guidance A'; const sending = h.host.sendLiveGuidance(); await flush();
  assert.equal(await h.host.sendLiveGuidance(), false, 'duplicate in-flight submission is locked');
  h.host.CLISettings.cc_path = 'E:/other'; h.host.userInput = 'Other workspace draft';
  resolveAdd({ ok: true, runtime_id: 'runtime-one', guidance: item({ text: 'Guidance A' }) }); assert.equal(await sending, true);
  assert.equal(h.host.getLiveGuidanceState().items.length, 0); assert.equal(h.host.getLiveGuidanceState().sending, false); assert.equal(h.host.userInput, 'Other workspace draft');
});

/** 写入完成之前开始的旧快照不能复活旧文本与修订。 / A snapshot started before a completed write cannot restore stale text or revisions. */
test('stale list reads cannot overwrite a confirmed guidance edit', async () => {
  let reads = 0; let resolveList;
  const h = guidanceHost({ kernel: async (operation, payload) => operation === 'guidance-list' ? (++reads === 1 ? listing([item()]) : new Promise((resolve) => { resolveList = resolve; })) : { ok: true, runtime_id: 'runtime-one', guidance: item({ text: payload.text, revision: 2 }) } });
  await h.host.refreshLiveGuidanceStatus(); const state = h.host.getLiveGuidanceState();
  const reading = h.host.refreshLiveGuidanceStatus(); await flush();
  await h.host.updateLiveGuidance({ ...state.items[0], scope: state.scope }, 'edit', 'Confirmed edit');
  resolveList(listing([item()])); await reading;
  assert.equal(h.host.getLiveGuidanceState().items[0].text, 'Confirmed edit'); assert.equal(h.host.getLiveGuidanceState().items[0].revision, 2);
});

/** 重启后的未接收原文保留为lost，不重新发送到新的执行实例。 / Unreceived text becomes lost after restart and is never replayed into a new runtime. */
test('runtime restart preserves unreceived text and never replays guidance automatically', async () => {
  let restarted = false;
  const h = guidanceHost({ kernel: async () => restarted ? listing([], { runtime_id: 'runtime-two', restarted: true }) : listing([item(), item({ guidance_id: 'received', state: 'consumed' })]) });
  await h.host.refreshLiveGuidanceStatus(); restarted = true; await h.host.refreshLiveGuidanceStatus();
  const state = h.host.getLiveGuidanceState(); assert.equal(state.items.length, 1); assert.equal(state.items[0].state, 'lost'); assert.equal(state.items[0].text, 'Original guidance'); assert.match(state.notice, /重启/);
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].payload.runtimeId, 'runtime-one');
});

/** 列表限频、停止轮询和显式业务错误都保留真实语义。 / Throttling, polling cleanup and explicit business errors retain actual semantics. */
test('guidance reads throttle, polling releases and unsupported responses never appear queued', async () => {
  const h = guidanceHost({ kernel: async () => listing() });
  await h.host.refreshLiveGuidanceStatus(true, false); await h.host.refreshLiveGuidanceStatus(true, false); assert.equal(h.calls.length, 1);
  h.advance(2500); await h.host.refreshLiveGuidanceStatus(true, false); assert.equal(h.calls.length, 2);
  h.host.startLiveGuidancePolling(); assert.equal(h.timers.size, 1); h.host.stopLiveGuidancePolling(); assert.equal(h.timers.size, 0);
  const unavailable = guidanceHost({ kernel: async () => ({ ok: false, error: { code: 'unavailable', message: 'Actual service unavailable' } }) });
  assert.equal(await unavailable.host.sendLiveGuidance(), false); assert.equal(unavailable.host.userInput, 'Original guidance'); assert.equal(unavailable.host.getLiveGuidanceState().items.length, 0);
  await assert.rejects(unavailable.host.fetchKernelJson('guidance-list', { conversationId: 'chat-a' }), /Actual service unavailable/);
});

/** 浏览器兼容通路使用同样的身份、修订与固定端点。 / Browser compatibility uses the same identity, revision and fixed endpoints. */
test('browser guidance operations preserve exact identities and revisions', async () => {
  const requests = [];
  const h = guidanceHost({ kernel: async () => ({}), fetch: async (url, request) => { requests.push([url, request]); return Response.json({ ok: true }); }, host: { isDesktopKernelRuntimeAvailable: () => false } });
  await h.host.fetchKernelPayload('guidance-list', { conversationId: 'chat a', runtimeId: 'runtime-one' });
  await h.host.fetchKernelPayload('guidance-edit', { conversationId: 'chat-a', runtimeId: 'runtime-one', requestId: 'request-one', guidanceId: 'guidance-one', expectedRevision: 7, text: 'New text', mode: 'constraint', priority: 10 });
  await h.host.fetchKernelPayload('guidance-cancel', { conversationId: 'chat-a', runtimeId: 'runtime-one', requestId: 'request-two', guidanceId: 'guidance-one', expectedRevision: 8 });
  assert.match(requests[0][0], /conversation_id=chat\+a&runtime_id=runtime-one/);
  assert.equal(requests[1][0], '/v1/kernel/guidance/edit'); assert.equal(requests[2][0], '/v1/kernel/guidance/cancel');
  const edit = JSON.parse(requests[1][1].body); assert.equal(edit.expected_revision, 7); assert.equal(edit.request_id, 'request-one'); assert.equal(edit.text, 'New text');
  assert.equal(JSON.parse(requests[2][1].body).expected_revision, 8);
});

/** 初次列表读取与提交共享握手，业务冲突正确解包且不占未知操作额度。 / Initial reads and submission share a handshake; business conflicts unwrap correctly without consuming unknown-action capacity. */
test('initial handshake is shared and public HTTP conflicts retain structured receipts', async () => {
  let resolveList;
  const h = guidanceHost({ kernel: async (operation) => operation === 'guidance-list' ? new Promise((resolve) => { resolveList = resolve; }) : { ok: true, runtime_id: 'runtime-one', guidance: item() } });
  const reading = h.host.refreshLiveGuidanceStatus(); const sending = h.host.sendLiveGuidance(); await flush();
  assert.equal(h.calls.length, 1); resolveList(listing()); await reading; assert.equal(await sending, true); assert.equal(h.calls.length, 2);
  const conflict = guidanceHost({ kernel: async () => ({}), host: { isDesktopKernelRuntimeAvailable: () => false }, fetch: async (url) => url.includes('/cancel') ? Response.json({ detail: { ok: false, runtime_id: 'runtime-one', error: { code: 'guidance_conflict', message: 'Received before withdrawal' }, guidance: item({ state: 'consumed', revision: 2 }) } }, { status: 409 }) : Response.json(listing([item()])) });
  await conflict.host.refreshLiveGuidanceStatus(); const state = conflict.host.getLiveGuidanceState();
  await assert.rejects(conflict.host.updateLiveGuidance({ ...state.items[0], scope: state.scope }, 'cancel'), /Received before withdrawal/);
  assert.equal(conflict.host.getLiveGuidanceState().items[0].state, 'consumed'); assert.equal(conflict.host.getLiveGuidanceCache().requests.size, 0);
});
