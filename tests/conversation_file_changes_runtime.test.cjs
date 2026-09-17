/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 文件变更真实回执回归 / File-change runtime receipt regression.
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
const methods = ast.program.body.filter((node) => node.type === 'VariableDeclaration').flatMap((node) => node.declarations).find((node) => node.id.name === 'vue_methods').init.properties;

/** 隔离执行真实流式消息和人工确认方法。 / Execute actual streaming-message and manual-approval methods in isolation. */
function runtime(events = [], overrides = {}, receipt = null) {
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, Date, Math, JSON, TextDecoder, AbortController,
    vue_data: { isElectron: false }, showNotification() {}, setTimeout() {},
    sanitizeProtocolMessage: (value) => ({ ...value }), sanitizeToolProtocolName: (name) => name,
    window: { openxnetChatFetch: async (url) => url === '/execute_tool_manually'
      ? Response.json(receipt)
      : new Response(events.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } }) },
  });
  const host = {
    messages: [{ role: 'user', content: 'Please update the files' }], conversations: [],
    conversationId: 'conversation-a', mainAgent: 'openxnet-model', memorySettings: {}, memories: [],
    settings: { model: 'test-model' }, fastSettings: {}, ttsSettings: {}, systemSettings: {}, toolsSettings: { hideToolResults: {} }, fileLinks: [],
    abortController: new AbortController(), approvalMap: {}, asyncToolsID: [],
    startTimer() {}, stopTimer() {}, $nextTick() {}, scrollToBottom() {}, sendMessagesToExtension() {},
    t: (value) => value, isCurrentLanguageZh: () => true, saveConversations: async () => {}, generateConversationTitle: () => 'Conversation', ...overrides,
  };
  for (const name of ['generateAIResponse', 'processToolApproval', 'executeToolBackend', 'escapeHtml']) {
    const method = methods.find((node) => node.key.name === name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  return host;
}

/** 创建与删除回执经过真实流处理后仍保留差异、状态及工具身份。 / Create/delete receipts retain diffs, status and tool identity through actual stream handling. */
test('streamed file receipts preserve actual identities, structured content and final status', async () => {
  const files = [{ id: 'patch:0', path: 'new.py', operation: 'create', status: 'done', confirmed: true, before: '', after: '<tag>new</tag>', contentSource: 'receipt' }, { id: 'patch:1', path: 'old.py', operation: 'delete', status: 'done', confirmed: true, diff: '--- a/old.py\n+++ /dev/null\n@@ -1 +0,0 @@\n-old', contentSource: 'receipt' }];
  const host = runtime([
    { tool_call_id: 'outer-call', tool_content: { title: 'openai_codex', type: 'call', content: { prompt: 'Update files' } } },
    { tool_call_id: 'outer-call', tool_content: { title: 'openai_codex', type: 'tool_result_stream', content: '' }, fileChanges: files.map((row) => ({ ...row, status: 'running', confirmed: false })) },
    { tool_call_id: 'outer-call', tool_content: { title: 'tool_result_stream', type: 'tool_result_stream', content: 'Finished' }, fileChanges: files },
    { tool_complete: { id: 'outer-call', name: 'openai_codex' } },
    { content: 'The requested files have been updated.' },
  ]);
  await host.generateAIResponse('openxnet-model');
  const message = host.messages.at(-1);
  const step = message.activityLog.find((row) => row.id === 'tool-outer-call');
  assert.equal(step.toolCallId, 'outer-call');
  assert.equal(step.toolName, 'openai_codex');
  assert.equal(step.input.prompt, 'Update files');
  assert.equal(step.output, 'Finished');
  assert.equal(step.status, 'done');
  assert.equal(step.fileChanges[0].before, '');
  assert.deepEqual(model.projectMessageActivity(message).steps.find((row) => row.id === step.id).fileChanges.map((row) => row.operation), ['create', 'delete']);
  assert.doesNotMatch(JSON.stringify(model.buildConversationProjection({ conversationId: 'conversation-a', messages: [message] })), /new\.py|old\.py|<tag>/);
});

/** 结构化输出与现有本地工具成功文本均能到达共享模型。 / Structured outputs and existing local success text both reach the shared model. */
test('local file-tool parameters survive rendering and require actual success evidence', async () => {
  const host = runtime([
    { tool_call_id: 'patch', tool_content: { title: 'edit_file_patch_tool_local', type: 'call', content: { path: 'a.txt', old_string: 'old', new_string: '' } } },
    { tool_call_id: 'patch', tool_status: 'done', tool_content: { title: 'edit_file_patch_tool_local', type: 'tool_result', content: 'Patched successfully (Exact match).' } },
    { tool_call_id: 'unconfirmed', tool_content: { title: 'edit_file_tool_local', type: 'call', content: { path: 'b.txt', content: 'Do not assume written' } } },
  ]);
  await host.generateAIResponse('openxnet-model');
  const projected = model.projectMessageActivity(host.messages.at(-1));
  const patch = projected.steps.find((row) => row.id === 'tool-patch').fileChanges[0];
  assert.equal(patch.confirmed, true);
  assert.equal(patch.after, '');
  assert.equal(patch.contentSource, 'request');
  const pending = projected.steps.find((row) => row.id === 'tool-unconfirmed').fileChanges[0];
  assert.equal(pending.confirmed, false);
  assert.equal(pending.status, 'unknown');
});

/** 对象结果不能退化为object Object，失败也不能被结束事件升级为成功。 / Object results must remain structured and failures cannot become success at stream completion. */
test('structured result objects and failed file events survive the stream boundary', async () => {
  const output = { fileChanges: [{ path: 'blocked.txt', operation: 'modify', status: 'error', confirmed: false, diff: '-old\n+new' }], result: 0 };
  const host = runtime([
    { tool_call_id: 'call', tool_content: { title: 'apply_patch', type: 'call', content: '{}' } },
    { tool_call_id: 'call', tool_status: 'error', tool_content: { title: 'apply_patch', type: 'tool_result', content: output } },
    { tool_complete: { id: 'call', name: 'apply_patch' } },
    { execution_event: { type: 'file_change', status: 'done', changes: [{ path: 'foreign.txt', kind: 'add' }] } },
  ]);
  await host.generateAIResponse('openxnet-model');
  const step = host.messages.at(-1).activityLog.find((row) => row.id === 'tool-call');
  assert.equal(step.output.result, 0);
  assert.equal(step.status, 'error');
  assert.equal(model.projectFileChanges(step)[0].confirmed, false);
  assert.doesNotMatch(JSON.stringify(host.messages.at(-1).activityLog), /foreign\.txt/);
});

/** 人工确认结果只能更新所属消息，结构化文件回执和空结果保留。 / Manual results update only their owning message and preserve structured file receipts and empty results. */
test('manual approval retains explicit file receipts and never writes into a later message', async () => {
  const owner = { id: 'owner', conversationId: 'conversation-a', content: '', activityLog: [{ id: 'tool-approved', status: 'awaiting_approval' }] };
  const later = { id: 'later', role: 'assistant', content: 'Other reply', activityLog: [] };
  const files = [{ path: 'removed.txt', operation: 'delete', status: 'done', confirmed: true, contentSource: 'receipt' }];
  const host = runtime([], { messages: [owner, later], approvalMap: { approved: { tool_name: 'file_tool', tool_params: { path: 'removed.txt' } } }, updateUIBlock() {} }, { success: true, status: 'completed', result: '', fileChanges: files });
  host.generateAIResponse = async () => {};
  assert.equal(await host.processToolApproval('approved', 'once'), true);
  assert.equal(owner.activityLog[0].toolName, 'file_tool');
  assert.equal(owner.activityLog[0].output, '');
  assert.equal(owner.activityLog[0].fileChanges[0].path, 'removed.txt');
  assert.equal(model.projectFileChanges(owner.activityLog[0])[0].confirmed, true);
  assert.equal(later.activityLog.length, 0);
});
