/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话检查点与意外关闭恢复测试 / Conversation checkpoint and unexpected closure recovery tests.
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

/** 克隆持久化JSON以模拟跨进程边界。 / Clone persisted JSON to simulate a process boundary. */
function clone(value) { return JSON.parse(JSON.stringify(value)); }
/** 清空异步持久化与流读取微任务，无真实等待。 / Flush persistence and stream-reading microtasks without real waits. */
async function flush() { for (let index = 0; index < 30; index += 1) await Promise.resolve(); }

/** 隔离加载真实宿主函数，模型、计时器和存储都由测试控制。 / Load actual host functions with isolated, test-controlled models, timers and storage. */
function recoveryHost(options = {}) {
  let now = 100000; let timerId = 0; let saved = clone(options.saved || []);
  const timers = new Map(); const requests = []; const writes = []; const notices = [];
  /** 以测试时钟提供检查点时间。 / Provide checkpoint timestamps from the test clock. */
  class FixtureDate extends Date { static now() { return now; } }
  const desktop = { ...options.desktop,
    /** 保存完整快照或返回测试指定的失败。 / Save a complete snapshot or return the test's chosen failure. */
    async saveLegacyRendererConversations(request) { if (options.persist) await options.persist(request); saved = clone(request.conversations); writes.push(clone(saved)); return { conversations: clone(saved) }; },
  };
  const context = vm.createContext({ Date: FixtureDate, Math, JSON, Map, Set, TextDecoder, AbortController,
    uuid: { v4: () => 'new-conversation-id' }, vue_data: { isElectron: false },
    console: { log() {}, error() {}, warn() {} }, showNotification: (...args) => notices.push(args),
    sanitizeProtocolMessage: (value) => ({ ...value }), sanitizeToolProtocolName: (name) => name,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, due: now + delay }); return id; }, clearTimeout: (id) => timers.delete(id),
    window: { openxnetDesktop: desktop,
      /** 记录实际请求，默认只返回明确结束的隔离回复。 / Record actual requests and default to an explicitly completed fixture reply. */
      async openxnetChatFetch(url, request) { requests.push({ url, request }); return options.fetch ? options.fetch(url, request, () => saved) : Response.json({ conversationId: 'restart-chat', state: 'idle' }); },
    },
  });
  const host = {
    conversationId: 'restart-chat', conversations: clone(saved), messages: [{ id: 'question', role: 'user', content: 'Continue work' }],
    settings: { model: 'fixture-model', selectedProvider: 'fixture-provider' }, fastSettings: {}, memorySettings: {}, memories: [], agents: {}, mainAgent: 'openxnet-model',
    CLISettings: { cc_path: 'E:/fixture' }, system_prompt: 'Original system context', fileLinks: [], files: [], images: [], readState: {},
    ttsSettings: {}, systemSettings: {}, toolsSettings: { hideToolResults: {} }, abortController: new AbortController(), approvalMap: {}, asyncToolsID: [],
    t: (value) => value, isCurrentLanguageZh: () => true, generateConversationTitle: () => 'Recovery fixture',
    startTimer() {}, stopTimer() {}, $nextTick() {}, scrollToBottom() {}, sendMessagesToExtension() {}, stopLiveGuidancePolling() {}, startLiveGuidancePolling() {},
    refreshLiveGuidanceStatus: async () => null, autoSaveSettings: async () => true, maybeHandleKernelConfigIntent: async () => false,
    ...options.host,
  };
  for (const name of ['ensureConversationId', 'loadConversation', 'createConversationCheckpointContext', 'checkpointConversation', 'getConversationRecoveryState', 'resumeInterruptedConversation', 'retryConversationCheckpoint', 'getSanitizedConversations', 'saveConversations', 'generateAIResponse', 'sendMessage', 'stopGenerate', 'getPublicCompletionSummary', 'publishChatCompletionNotice']) {
    const method = methods.find((node) => node.key.name === name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  /** 推进假时钟并执行实际尾随检查点回调。 / Advance the fake clock and execute actual trailing checkpoint callbacks. */
  async function advance(amount) { now += amount; for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); } await flush(); }
  /** 读取独立的持久化结果。 / Read an independent persisted result. */
  const readSaved = () => clone(saved);
  return { host, requests, writes, notices, advance, readSaved };
}

/** 构造明确归属的恢复记录，保留原模型身份。 / Construct an explicitly owned recovery record retaining its original model identity. */
function interruptedConversation(extra = {}) {
  const message = { id: 'partial-answer', role: 'assistant', conversationId: 'restart-chat', agentName: 'Original assistant', generationFinished: false,
    content: 'Saved partial reply', pure_content: 'Saved partial reply', backend_content: [{ role: 'assistant', content: 'Saved partial reply' }], activityLog: [], taskRefs: [], ...extra };
  return { id: 'restart-chat', title: 'Recovery fixture', model: 'fixture-model', selectedProvider: 'fixture-provider', mainAgent: 'openxnet-model', system_prompt: 'Original system context',
    messages: [{ id: 'question', role: 'user', content: 'Original request' }, message], fileLinks: [],
    recovery: { schema: 'openxnet.conversation-recovery.v1', requestId: 'original-request', state: 'streaming', workspacePath: 'E:/fixture', assistantMessageId: message.id, targetAgentId: 'openxnet-model', targetAgentName: 'Original assistant', checkpointAt: 100000 } };
}

/** 模拟从持久化会话重新加载，不自动发起任何请求。 / Simulate loading a persisted conversation without automatically issuing requests. */
function reopenedHost(conversation = interruptedConversation(), options = {}) {
  return recoveryHost({ saved: [conversation], ...options, host: { messages: clone(conversation.messages), abortController: null, isSending: false, isTyping: false, ...options.host } });
}

/** 初始检查点必须早于模型请求，尾随保存保留partial正文和所有回执。 / Initial checkpoints precede model requests, and trailing saves retain partial text and all receipts. */
test('stream checkpoints survive simulated restart with original IDs and partial activity receipts', async () => {
  let stream;
  const h = recoveryHost({ host: { conversationId: null }, fetch: async (url, request, saved) => {
    assert.equal(url, '/v1/chat/completions');
    assert.equal(saved()[0].id, 'new-conversation-id'); assert.equal(saved()[0].messages.at(-1).role, 'assistant');
    return new Response(new ReadableStream({ start(controller) { stream = controller; } }), { headers: { 'content-type': 'text/event-stream' } });
  } });
  const generating = h.host.generateAIResponse('openxnet-model', 'Original assistant'); await flush();
  assert.ok(stream); assert.equal(h.writes.length, 1);
  const events = [
    { content: 'First saved partial answer' },
    { tool_call_id: 'file-call', tool_content: { title: 'write_file', type: 'call', content: '{"path":"src/restart.txt","content":"written"}' } },
    { tool_call_id: 'file-call', tool_content: { title: 'write_file', type: 'tool_result', content: 'Saved src/restart.txt' } },
    { task_ref: { taskId: 'original-child', originConversationId: 'new-conversation-id', status: 'running', title: 'Original child' }, tool_call_id: 'child-call', tool_content: { title: 'create_subtask', type: 'tool_result', content: 'Created original-child' } },
  ];
  for (const delta of events) stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`));
  await flush(); assert.equal(h.writes.length, 1, 'stream writes are throttled');
  await h.advance(1000);
  const durable = h.readSaved(); const savedAnswer = durable[0].messages.at(-1);
  assert.match(savedAnswer.pure_content, /First saved partial answer/); assert.equal(savedAnswer.taskRefs[0].taskId, 'original-child');
  assert.ok(savedAnswer.activityLog.some((step) => step.input?.includes('src/restart.txt')));
  assert.equal(durable[0].recovery.state, 'streaming');
  const restarted = reopenedHost(durable[0], { host: { conversationId: 'new-conversation-id' } });
  assert.equal(restarted.host.getConversationRecoveryState().available, true); assert.equal(restarted.requests.length, 0);
  assert.deepEqual(clone(restarted.host.messages.at(-1).activityLog), savedAnswer.activityLog);
  stream.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); stream.close(); await generating;
  assert.equal(h.readSaved()[0].recovery.state, 'completed');
});

/** 初次保存失败时保留输入和附件，也不发出模型请求。 / A failed initial save retains input and attachments and never sends a model request. */
test('failed initial checkpoint preserves draft and prevents a model request', async () => {
  const h = recoveryHost({ host: { userInput: 'Keep this draft', messages: [], conversationId: null }, persist: async () => { throw new Error('Fixture disk full'); } });
  assert.equal(await h.host.sendMessage(), false); assert.equal(h.host.userInput, 'Keep this draft'); assert.equal(h.host.messages.length, 0);
  assert.equal(h.requests.length, 0); assert.match(h.host.getConversationRecoveryState().error, /Fixture disk full/);
  assert.equal(h.host.getConversationRecoveryState().available, false);
});

/** 写入串行化，晚排队的检查点取得最新内容，失败后可以重试。 / Writes serialize, later checkpoints capture current content, and failures remain retryable. */
test('conversation save queue prevents stale writes and exposes retryable failure', async () => {
  let release; let writes = 0;
  const h = reopenedHost(interruptedConversation(), { persist: async () => { writes += 1; if (writes === 1) await new Promise((resolve) => { release = resolve; }); } });
  const first = h.host.saveConversations(); await flush();
  h.host.conversations[0].messages.at(-1).pure_content = 'Newer saved content';
  const second = h.host.saveConversations(); await flush(); assert.equal(writes, 1);
  release(); await Promise.all([first, second]); assert.equal(writes, 2); assert.equal(h.readSaved()[0].messages.at(-1).pure_content, 'Newer saved content');
});

/** 中途写入失败不丢内存内容，明确重试后清除未保存提示。 / Mid-stream write failures retain in-memory content and explicit retry clears the unsaved notice. */
test('failed streaming checkpoint retains partial data and can be explicitly saved again', async () => {
  let fail = false;
  const h = recoveryHost({ persist: async () => { if (fail) throw new Error('Fixture save unavailable'); } });
  const context = h.host.createConversationCheckpointContext(); await h.host.checkpointConversation(context, true);
  context.messages.push({ id: 'unsaved-answer', role: 'assistant', content: 'Latest partial content', activityLog: [{ id: 'file-result', kind: 'tool', status: 'done', output: 'Saved src/a.txt' }] });
  context.assistantMessageId = 'unsaved-answer'; fail = true;
  assert.equal(await h.host.checkpointConversation(context, true), false);
  assert.equal(h.host.messages.at(-1).content, 'Latest partial content'); assert.match(h.host.getConversationRecoveryState().error, /Fixture save unavailable/);
  fail = false; assert.equal(await h.host.retryConversationCheckpoint(), true);
  assert.equal(h.readSaved()[0].messages.at(-1).content, 'Latest partial content'); assert.equal(h.host.getConversationRecoveryState().error, '');
});

/** 打开历史会话时供应商默认模型不能覆盖原回复所用模型。 / A provider's default model cannot replace the saved reply model when opening history. */
test('loading an interrupted conversation restores its saved model after provider selection', async () => {
  const conversation = interruptedConversation();
  const h = reopenedHost(conversation); h.host.settings.model = 'other-model';
  h.host.selectMainProvider = async () => { h.host.settings.model = 'provider-default'; };
  await h.host.loadConversation('restart-chat');
  assert.equal(h.host.settings.model, 'fixture-model'); assert.equal(h.host.messages.at(-1).pure_content, 'Saved partial reply');
  assert.equal(h.host.getConversationRecoveryState().available, true); assert.equal(h.requests.length, 0);
});

/** 明确结束标记与用户停止均抑制恢复入口，裸EOF仍表示中断。 / Explicit completion and user cancellation suppress recovery, while bare EOF remains interrupted. */
test('completion markers and explicit stop remain distinct from truncated streams', async () => {
  for (const [ending, expected] of [['data: [DONE]\n\n', 'completed'], ['', 'interrupted']]) {
    const h = recoveryHost({ fetch: async () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Actual text' } }] })}\n\n${ending}`, { headers: { 'content-type': 'text/event-stream' } }) });
    await h.host.generateAIResponse('openxnet-model'); assert.equal(h.readSaved()[0].recovery.state, expected);
    assert.equal(h.host.getConversationRecoveryState().available, expected === 'interrupted');
  }
  const h = reopenedHost(interruptedConversation(), { host: { abortController: new AbortController() } });
  h.host.stopGenerate(); await flush(); assert.equal(h.readSaved()[0].recovery.state, 'canceled'); assert.equal(h.host.getConversationRecoveryState().available, false);
});

/** 真实生成流仅在明确完成且最终检查点写入后投递一次。 / Actual generation streams publish once only after explicit completion and final checkpoint persistence. */
test('actual generation emits completion after durable terminal state and stays quiet on interruption or stop', async () => {
  for (const ending of ['completed', 'eof', 'canceled']) {
    let stream; const notices = [];
    const h = recoveryHost({ desktop: { publishCompletionNotice: async (notice) => {
      assert.equal(h.readSaved()[0].recovery.state, 'completed');
      notices.push(clone(notice)); return { accepted: true, delivery: 'submitted' };
    } }, fetch: async (url) => url === '/v1/chat/completions' ? new Response(new ReadableStream({ start(controller) { stream = controller; } }), { headers: { 'content-type': 'text/event-stream' } }) : Response.json({ success: true }) });
    const generating = h.host.generateAIResponse('openxnet-model'); await flush();
    stream.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Actual public result"}}]}\n\n')); await flush();
    assert.equal(notices.length, 0, 'a partial reply is never completed');
    if (ending === 'completed') stream.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
    if (ending === 'canceled') { h.host.stopGenerate(); await flush(); }
    stream.close(); await generating;
    assert.equal(notices.length, ending === 'completed' ? 1 : 0);
    if (ending === 'completed') {
      assert.equal(notices[0].conversationId, 'restart-chat'); assert.equal(notices[0].summary, 'Actual public result');
      assert.match(notices[0].resultId, /^chat:/);
    }
  }
});

/** 流式错误保留未完成协议原件，发送新请求时只清理副本。 / Stream errors retain incomplete original protocol and later requests clean only their outgoing copy. */
test('stream failures retain unfinished tool traces without sending invalid dangling calls later', async () => {
  const h = recoveryHost({ fetch: async () => new Response('data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n\ndata: {"error":{"message":"Fixture interrupted"}}\n\n', { headers: { 'content-type': 'text/event-stream' } }) });
  await h.host.generateAIResponse('openxnet-model'); assert.equal(h.readSaved()[0].recovery.state, 'interrupted');
  assert.match(h.readSaved()[0].messages.at(-1).pure_content, /Partial answer/);
  const conversation = interruptedConversation({ backend_content: [{ role: 'assistant', content: 'Unfinished command', tool_calls: [{ id: 'unconfirmed', function: { name: 'write_file', arguments: '{}' } }] }] });
  let payload;
  const resumed = reopenedHost(conversation, { host: { abortController: new AbortController() }, fetch: async (url, request) => { payload = JSON.parse(request.body); return new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }); } });
  await resumed.host.generateAIResponse('openxnet-model');
  assert.equal(resumed.host.messages[1].backend_content[0].tool_calls[0].id, 'unconfirmed');
  assert.equal(payload.messages.some((message) => message.tool_calls?.some((call) => call.id === 'unconfirmed')), false);
});

/** 原回复运行中、状态未知或工具结果未确认时不继续。 / Running, unknown or unverified prior execution cannot be resumed. */
test('recovery refuses running streams, unknown status and unresolved tool calls', async () => {
  for (const runtimeState of ['running', 'unknown']) {
    const h = reopenedHost(interruptedConversation(), { fetch: async () => Response.json({ conversationId: 'restart-chat', state: runtimeState }) });
    assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), false);
    assert.equal(h.requests.length, 1); assert.ok(h.host.getConversationRecoveryState().reason);
  }
  for (const extra of [{ activityLog: [{ id: 'unknown-write', kind: 'tool', status: 'unknown', toolName: 'write_file' }] }, { backend_content: [{ role: 'assistant', tool_calls: [{ id: 'unmatched', function: { name: 'write_file' } }] }] }]) {
    const h = reopenedHost(interruptedConversation(extra));
    assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), false);
    assert.equal(h.requests.length, 1); assert.match(h.host.getConversationRecoveryState().reason, /工具/);
  }
});

/** 子任务仍运行时只读原任务ID，不能启动新的回复或新子任务。 / A running child is read through its existing ID without starting a new reply or task. */
test('recovery preserves existing child IDs and blocks duplicate task execution', async () => {
  const conversation = interruptedConversation({ taskRefs: [{ taskId: 'original-child' }] });
  let taskReads = 0;
  const h = reopenedHost(conversation, { desktop: { refreshTaskExecutions: async () => { taskReads += 1; return { tasks: [{ id: 'core-child', legacyTaskId: 'original-child', status: 'running', workspacePath: 'E:/fixture', details: { context: { origin_conversation_id: 'restart-chat' } } }] }; } } });
  assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), false);
  assert.equal(taskReads, 1); assert.equal(h.requests.length, 1); assert.equal(h.host.messages.at(-1).taskRefs[0].taskId, 'original-child');
});

test('recovery refuses to bypass missing trusted task APIs through compatibility HTTP', /** 缺少可信任务查询时不使用HTTP旁路且保留原草稿。 / Missing trusted task queries never use an HTTP bypass and preserve the original draft. */ async () => {
  const conversation = interruptedConversation();
  conversation.messages.at(-1).taskRefs = [{ taskId: 'existing-child-task' }];
  const h = reopenedHost(conversation);
  const originalDraft = h.host.userInput;
  assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), false);
  assert.equal(h.requests.length, 1);
  assert.match(h.requests[0].url, /^\/v1\/chat\/recovery-status\?/);
  assert.match(h.host.conversationRecoveryNotice.message, /可信接口|Trusted verification/);
  assert.equal(h.host.userInput, originalDraft);
  assert.equal(h.host.messages.at(-1).generationFinished, false);
});

/** 真实Core与Server任务投影的归属字段均可识别，终态回执可以继续。 / Recognize ownership in actual Core and Server projections and allow verified terminal receipts to continue. */
test('recovery reconciles terminal Core tasks with nested and camel-case ownership', async () => {
  for (const ownership of [{ details: { context: { origin_conversation_id: 'restart-chat' } } }, { originConversationId: 'restart-chat' }, { origin_conversation_id: 'restart-chat' }]) {
    const conversation = interruptedConversation({ taskRefs: [{ taskId: 'original-child', status: 'running' }], activityLog: [{ id: 'child-step', kind: 'subagent', taskId: 'original-child', status: 'running' }] });
    const h = reopenedHost(conversation, { desktop: { refreshTaskExecutions: async () => ({ tasks: [{ id: 'core-child', legacyTaskId: 'original-child', status: 'completed', workspacePath: 'E:/fixture', ...ownership }] }) }, fetch: async (url) => url.startsWith('/v1/chat/recovery-status') ? Response.json({ conversationId: 'restart-chat', state: 'idle' }) : new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }) });
    assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), true);
    assert.equal(h.host.messages.at(-1).taskRefs[0].taskId, 'original-child'); assert.equal(h.host.messages.at(-1).taskRefs[0].status, 'completed');
    assert.equal(h.host.messages.at(-1).activityLog.find((step) => step.id === 'child-step').status, 'completed');
  }
});

/** 明确继续沿用原消息与已确认工具回执，不改变草稿。 / Explicit continuation retains the original message and confirmed receipts without changing the draft. */
test('explicit recovery continues saved context and confirmed receipts without changing the draft', async () => {
  const conversation = interruptedConversation({ activityLog: [{ id: 'saved-write', kind: 'tool', status: 'done', output: 'Saved' }], backend_content: [{ role: 'assistant', tool_calls: [{ id: 'saved-write', type: 'function', function: { name: 'write_file', arguments: '{"path":"a.txt"}' } }] }, { role: 'tool', tool_call_id: 'saved-write', name: 'write_file', content: 'Saved a.txt' }, { role: 'assistant', content: 'Saved partial reply' }] });
  let payload;
  const h = reopenedHost(conversation, { host: { userInput: 'Unsent draft' }, fetch: async (url, request) => {
    if (url.startsWith('/v1/chat/recovery-status')) return Response.json({ conversationId: 'restart-chat', state: 'idle' });
    payload = JSON.parse(request.body);
    return new Response('data: {"choices":[{"delta":{"content":" and continued"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  } });
  assert.equal(h.requests.length, 0);
  assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), true);
  assert.equal(h.host.userInput, 'Unsent draft'); assert.equal(h.host.messages.length, 2); assert.equal(h.host.messages.at(-1).id, 'partial-answer');
  assert.match(h.host.messages.at(-1).pure_content, /Saved partial reply and continued/);
  assert.ok(payload.messages.some((message) => message.role === 'tool' && message.tool_call_id === 'saved-write' && message.content === 'Saved a.txt'));
  assert.equal(payload.conversationId, 'restart-chat'); assert.equal(h.readSaved()[0].recovery.state, 'completed');
});

/** 用户消息已保存但助手尚未创建时，同样可以明确继续。 / A saved user message can be explicitly continued even before an assistant message was created. */
test('recovery handles a crash after saving the user message but before assistant creation', async () => {
  const conversation = interruptedConversation(); conversation.messages.pop(); conversation.recovery.assistantMessageId = '';
  const h = reopenedHost(conversation, { fetch: async (url) => url.startsWith('/v1/chat/recovery-status') ? Response.json({ conversationId: 'restart-chat', state: 'idle' }) : new Response('data: {"choices":[{"delta":{"content":"Recovered answer"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }) });
  assert.equal(h.host.getConversationRecoveryState().messageId, '');
  assert.equal(await h.host.resumeInterruptedConversation('restart-chat', 'original-request'), true);
  assert.equal(h.host.messages.length, 2); assert.equal(h.host.messages.at(-1).pure_content, 'Recovered answer');
});

/** 范围改变后旧检查点只保存原消息，迟到恢复核对不得继续。 / Old checkpoints retain original messages and late recovery checks cannot continue after scope changes. */
test('checkpoint ownership and recovery verification remain isolated across conversation switches', async () => {
  const h = recoveryHost(); const context = h.host.createConversationCheckpointContext(); await h.host.checkpointConversation(context, true);
  h.host.conversationId = 'other-chat'; h.host.messages = [{ id: 'other-user', role: 'user', content: 'Other content' }];
  context.messages.push({ id: 'old-result', role: 'assistant', content: 'Original result' }); await h.host.checkpointConversation(context, true);
  assert.equal(h.readSaved()[0].id, 'restart-chat'); assert.equal(h.readSaved()[0].messages.at(-1).content, 'Original result'); assert.equal(h.host.messages[0].content, 'Other content');
  let finish;
  const pendingHost = reopenedHost(interruptedConversation(), { fetch: async () => new Promise((resolve) => { finish = resolve; }) });
  const pending = pendingHost.host.resumeInterruptedConversation('restart-chat', 'original-request'); await flush();
  pendingHost.host.conversationId = 'other-chat'; finish(Response.json({ conversationId: 'restart-chat', state: 'idle' }));
  assert.equal(await pending, false); assert.equal(pendingHost.requests.length, 1);
});
