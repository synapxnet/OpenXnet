/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话投影回归 / Conversation projection regression tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../static/js/openxnet-conversation-model.js');

/** 图标由稳定标识生成，协作正文排除隐藏内容并保留换行。 / Icons derive from stable identities and public collaboration text excludes hidden content while preserving newlines. */
test('subagent glyphs are stable and transcripts preserve only public recorded messages', () => {
  assert.deepEqual(model.agentGlyph('worker-a'), model.agentGlyph('worker-a'));
  assert.ok(new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(model.agentGlyph(`worker-${i}`)))).size > 12);
  const transcript = model.normalizeSubagentTranscript({ messages: [
    { id: 'sys', role: 'system', content: 'DO_NOT_SHOW' },
    { id: 'p', role: 'parent', content: '检查文件\n不要执行修改。' },
    { id: 'c', role: 'subagent', content: '<analysis>SECRET</analysis>已检查\n有两处建议。' },
    { id: 'unknown', role: 'untrusted', content: 'NOT_A_KNOWN_ROLE' },
  ] });
  assert.deepEqual(transcript.map((row) => row.id), ['p', 'c']);
  assert.equal(transcript[0].content, '检查文件\n不要执行修改。');
  assert.doesNotMatch(JSON.stringify(transcript), /SECRET|DO_NOT_SHOW|NOT_A_KNOWN_ROLE/);
});

/** 工具结束不等于回复结束，正文仍生成时过程保持展开生命周期。 / A completed tool does not finish a reply while answer generation continues. */
test('activity remains active between completed tools until the reply actually ends', () => {
  const message = { generationFinished: false, activityLog: [{ id: 'edit', status: 'done', endedAt: 4000 }] };
  assert.equal(model.projectMessageActivity(message, { active: true }).active, true);
  assert.equal(model.projectMessageActivity(message, { active: false }).active, false);
  message.generationFinished = true;
  assert.equal(model.projectMessageActivity(message, { active: true }).active, false);
});

/** 完成和中断的耗时不随轮询增加。 / Finished and interrupted durations do not grow with polling. */
test('terminal activity uses recorded time and missing outcomes remain unknown', () => {
  const message = { generationFinished: true, activityStartedAt: 1000, activityLog: [
    { id: 'ok', kind: 'tool', status: 'done', startedAt: 1000, updatedAt: 5000, output: 'retained' },
    { id: 'stopped', status: 'interrupted', startedAt: 2000, endedAt: 6000 },
    { id: 'missing', title: 'Without a receipt' },
  ] };
  const first = model.projectMessageActivity(message, { now: 10000 });
  const later = model.projectMessageActivity(message, { now: 100000 });
  assert.equal(first.elapsedMs, 5000);
  assert.deepEqual(first, later);
  assert.equal(first.steps[0].duration, '4秒');
  assert.equal(first.steps[1].status, 'interrupted');
  assert.equal(first.steps[2].status, 'unknown');
  assert.equal(first.steps[2].duration, '');
  assert.equal(first.active, false);
});

/** 工具历史与结构关联完整保留，不依据工具名称猜测智能体。 / Preserve tool history and structural relations without guessing from tool names. */
test('all activity survives projection with real tool and subagent details', () => {
  const steps = Array.from({ length: 15 }, (_, i) => ({ id: `step-${i}`, status: 'done', kind: 'tool' }));
  steps[0] = { ...steps[0], title: 'spawn_agent report parser', input: { repeated: ['keep', 'keep'] }, output: '<script>inert()</script>', error: 'still relevant' };
  steps[1] = { ...steps[1], agentId: 'agent-12', taskId: 'task-23', status: 'awaiting_approval' };
  const result = model.projectMessageActivity({ activity: { steps } });
  assert.equal(result.steps.length, 15);
  assert.equal(result.steps[0].kind, 'tool');
  assert.deepEqual(result.steps[0].input, steps[0].input);
  assert.equal(result.steps[0].output, '<script>inert()</script>');
  assert.equal(result.steps[1].kind, 'subagent');
  assert.equal(result.steps[1].status, 'awaiting_approval');
  assert.equal(result.steps[1].taskId, 'task-23');
  assert.equal(result.active, false);
});

/** 运行态计时可注入时钟，结束状态不会假装仍在执行。 / Inject the clock for running activity without animating finished work. */
test('running duration is live, but terminal steps override stale active hints', () => {
  const result = model.projectMessageActivity({ activityStartedAt: 100, activityLog: [{ id: 'run', status: 'running', startedAt: 200 }] }, { now: 1200, active: true });
  assert.equal(result.active, true);
  assert.equal(result.elapsedMs, 1100);
  assert.equal(result.steps[0].duration, '1秒');
  assert.equal(model.projectMessageActivity({ activity: { steps: [{ status: 'error' }] } }, { active: true }).active, false);
});

/** 默认跨端数据排除私密正文、工具参数和隐藏详情。 / Default cross-surface data excludes private text, tool parameters and hidden details. */
test('VR projection is allowlisted, scope-isolated and payload-free', () => {
  const projection = model.buildConversationProjection({ conversationId: 'current', workspaceId: 'space', projectId: 'project', messages: [
    { id: 'other', conversationId: 'different', text: 'wrong scope' },
    { id: 'wrong-project', projectId: 'elsewhere' },
    { id: 'keep', conversationId: 'current', role: 'assistant', text: 'private response', html: '<p>private html</p>',
      identity: { id: 'staff', name: 'Research', image: 'javascript:alert(1)', source: 'message' },
      activity: { steps: [{ id: 'tool', kind: 'tool', status: 'error', label: 'private tool description', title: 'query token=private', detail: 'private detail', input: { secret: 'private input' }, output: 'private output', error: 'private error', agentId: 'agent', taskId: 'task' }] },
      attachments: [{ path: 'private file path' }], memoryContext: [
        { id: 'memory', status: 'injected', detail: 'private memory detail', content: 'private memory body', conversationId: 'current', items: [{ title: 'private memory title', memoryId: 'private memory ID', content: 'private item content' }] },
        { id: 'other-memory', status: 'error', conversationId: 'different' },
      ],
    },
  ] });
  assert.equal(projection.messages.length, 1);
  assert.equal(projection.messages[0].id, 'keep');
  assert.equal(projection.messages[0].identity.image, '');
  assert.equal(projection.messages[0].memory.receiptCount, 1);
  assert.deepEqual(projection.messages[0].memory.statuses, ['injected']);
  assert.equal(projection.messages[0].activity.steps[0].agentId, 'agent');
  assert.equal(projection.messages[0].attachmentCount, 1);
  assert.doesNotMatch(JSON.stringify(projection), /private|wrong scope|wrong-project/);
  assert.equal('textPreview' in projection.messages[0], false);
});

/** 预览需显式开启并排除嵌套工具容器。 / Previews require opt-in and exclude nested tool containers. */
test('explicit text previews are bounded without hidden tool data', () => {
  const text = '可见<div class="highlight-block"><div>SECRET</div>MORE SECRET</div>内容' + '🙂'.repeat(400);
  const result = model.buildConversationProjection({ conversationId: 'c', includeTextPreview: true, maxMessages: 1000, messages: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, text, html: 'NEVER READ HTML' })) });
  assert.equal(result.messages.length, 80);
  assert.equal(result.truncated, true);
  assert.equal(result.messages[0].id, 'm20');
  assert.equal(Array.from(result.messages[0].textPreview).length, 280);
  assert.match(result.messages[0].textPreview, /^可见内容/);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|NEVER READ HTML/);
});

/** 历史身份不随当前角色设置变更，图片协议受到限制。 / Historical identity is independent of current settings and image protocols are limited. */
test('identity normalization uses explicit identity and rejects executable images', () => {
  const saved = model.normalizeIdentity({ id: 'original', name: '原角色', image: 'data:image/svg+xml,<svg onload="x"/>', source: 'message' }, { fallbackName: 'New selection' });
  assert.equal(saved.name, '原角色');
  assert.equal(saved.image, '');
  assert.equal(model.normalizeIdentity(null).source, 'unknown');
  assert.equal(model.safeImageUrl('source/avatar.png'), 'source/avatar.png');
  assert.equal(model.safeImageUrl('https://example.test/avatar.png'), 'https://example.test/avatar.png');
  assert.equal(model.safeImageUrl('vbscript:msgbox(1)'), '');
  assert.equal(model.safeImageUrl('data:image/png;base64,YWJj'), 'data:image/png;base64,YWJj');
});

/** 无注入和失败回执不能升级成已注入。 / Unused and failed receipts cannot become injected receipts. */
test('memory receipts retain real status, zero counts and exclude raw memory bodies', () => {
  const receipts = model.normalizeMemoryContext([
    { id: 'off', source: 'synapxnet-memory-v3', type: 'long_term', status: 'not_used', count: 0, characters: 0, reason: 'disabled', content: 'private memory', items: [{ memoryId: 'known', version: 3, recordSha256: 'a'.repeat(64), injectedContentSha256: 'b'.repeat(64), content: 'private memory item' }] },
    { id: 'error', status: 'error', reason: 'worker_unavailable' },
    {}, null,
  ]);
  assert.equal(receipts.length, 3);
  assert.equal(receipts[0].status, 'not_used');
  assert.equal(receipts[0].count, 0);
  assert.equal(receipts[1].count, null);
  assert.equal(receipts[2].status, 'unknown');
  assert.equal(receipts[0].items[0].memoryId, 'known');
  assert.equal(receipts[0].items[0].version, '3');
  assert.equal(receipts[0].items[0].recordSha256.length, 64);
  assert.doesNotMatch(JSON.stringify(receipts), /private memory/);
});

/** 只有附件和重复文本的消息均可独立定位。 / Attachment-only and repeated-text messages remain independently navigable. */
test('navigation keeps stable IDs and distinct repeated turns including attachments', () => {
  const result = model.buildMessageNavigation([
    { id: 'assistant', role: 'assistant', text: 'answer' },
    { id: 'one', role: 'user', text: 'Repeat this sentence.' },
    { id: 'two', role: 'user', text: 'Repeat this sentence.' },
    { id: 'image', role: 'user', attachments: [{ kind: 'image' }] },
    { id: 'two', role: 'user', text: 'duplicate ID' },
    { role: 'user', text: 'missing ID cannot navigate' },
  ]);
  assert.deepEqual(result.map((row) => row.id), ['one', 'two', 'image']);
  assert.equal(result[0].summary, result[1].summary);
  assert.equal(result[2].summary, '1 个附件');
  assert.deepEqual(result.map((row) => row.ordinal), [1, 2, 3]);
});

/** 回复摘要仅来自同轮可见正文，排除工具、隐藏推理和其他作用域。 / Reply previews come only from visible turn text and exclude tools, hidden reasoning and other scopes. */
test('navigation previews visible replies without reading hidden payloads or crossing turn boundaries', () => {
  const result = model.buildMessageNavigation([
    { id: 'question', role: 'user', text: 'How did it go?', conversationId: 'current', workspaceId: 'mine' },
    { id: 'reply', role: 'assistant', conversationId: 'current', text: 'Visible <think>SECRET_THOUGHT<analysis>SECRET_NESTED</analysis></think>answer<div class="highlight-block"><section>SECRET_TOOL</section></div>.', html: 'SECRET_HTML', content: 'SECRET_CONTENT', output: 'SECRET_OUTPUT' },
    { role: 'tool', text: 'SECRET_TOOL_ROLE' },
    { role: 'assistant', channel: 'analysis', text: 'SECRET_CHANNEL' },
    { role: 'assistant', hidden: true, text: 'SECRET_HIDDEN_MESSAGE' },
    { role: 'assistant', conversation_id: 'other', text: 'SECRET_OTHER_CONVERSATION' },
    { role: 'assistant', scope: { workspaceId: 'theirs' }, text: 'SECRET_OTHER_WORKSPACE' },
    { role: 'assistant', text: '<span hidden>SECRET_HIDDEN</span><div aria-hidden="true">SECRET_ARIA</div><section style="display:none">SECRET_STYLE</section>Second visible reply.' },
    { id: 'next', role: 'user', text: 'What now?' },
    { role: 'assistant', html: 'SECRET_HTML_ONLY', activity: { steps: [{ output: 'SECRET_ACTIVITY' }] } },
  ]);
  assert.equal(result[0].replyPreview, 'Visible answer. · Second visible reply.');
  assert.equal(result[1].replyPreview, '');
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
});

/** 字面代码仍可预览，未闭合推理保持隐藏，流式正文按 Unicode 有界。 / Literal code remains previewable, unclosed reasoning stays hidden and streaming text is Unicode-bounded. */
test('navigation preserves visible literal code and bounds partial replies', () => {
  const result = model.buildMessageNavigation([
    { id: 'code', role: 'user', text: 'Explain `<think>`.' },
    { role: 'assistant', text: 'Use `<analysis>` literally.\n```html\n<think>Visible code</think>\n```\n<think>SECRET_UNFINISHED' },
    { id: 'long', role: 'user', attachments: [{ kind: 'file' }] },
    { role: 'assistant', text: '🙂'.repeat(500) },
    { id: 'last', role: 'user', text: 'No answer' },
    { role: 'user', text: 'Missing ID starts another turn' },
    { role: 'assistant', text: 'ORPHAN_REPLY' },
  ], { isZh: false });
  assert.match(result[0].summary, /`<think>`/);
  assert.match(result[0].replyPreview, /<analysis>.*Visible code/);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_UNFINISHED|ORPHAN_REPLY/);
  assert.equal(Array.from(result[1].replyPreview).length, 280);
  assert.equal(result[1].summary, '1 attachment');
  assert.equal(result[2].replyPreview, '');
});

/** 原始命令可供消息内展开，但只读跨设备投影不转发命令。 / Raw commands support inline disclosure but remain excluded from cross-device projections. */
test('activity retains explicit commands while cross-device projections exclude them', () => {
  const message = { id: 'a', role: 'assistant', activity: { steps: [
    { id: 'cmd', kind: 'tool', status: 'done', cmd: 'PRIVATE_CMD', input: { path: 'file.txt' } },
    { id: 'command', kind: 'tool', status: 'done', command: ['PRIVATE_COMMAND', '--check'] },
    { id: 'normal', kind: 'tool', status: 'done', detail: 'Ordinary prose', title: 'Not a command' },
  ] } };
  const activity = model.projectMessageActivity(message);
  assert.equal(activity.steps[0].cmd, 'PRIVATE_CMD');
  assert.deepEqual(activity.steps[1].command, ['PRIVATE_COMMAND', '--check']);
  assert.equal(Object.hasOwn(activity.steps[2], 'cmd'), false);
  assert.equal(Object.hasOwn(activity.steps[2], 'command'), false);
  assert.doesNotMatch(JSON.stringify(model.buildConversationProjection({ messages: [message] })), /PRIVATE_CMD|PRIVATE_COMMAND/);
});

/** 文件申请不代表写入完成，无回执时保留未知状态。 / A file request never proves completion and absent receipts remain unknown. */
test('file write inputs retain proposed content without inventing success or creation', () => {
  const changes = model.projectFileChanges({ id: 'write', toolName: 'edit_file_tool_local', status: 'done', input: { path: 'new-or-existing.txt', content: 'proposed\n' } });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].operation, 'write'); assert.equal(changes[0].confirmed, false); assert.equal(changes[0].status, 'unknown');
  assert.equal(changes[0].after, 'proposed\n'); assert.equal(changes[0].contentSource, 'request');
  assert.equal(changes[0].additions, null); assert.equal(changes[0].deletions, null);
  assert.equal('before' in changes[0], false);
});

/** 只识别受支持工具实际返回的成功文本。 / Recognize success only from actual output of supported file tools. */
test('actual local write and patch receipts confirm operations while preserving request provenance', () => {
  for (const [toolName, output, operation] of [
    ['edit_file_tool_local', 'Saved successfully.', 'write'],
    ['edit_file_tool_local', 'Saved successfully (Backup created: app.py.bak).', 'write'],
    ['edit_file_tool', '[Success] Saved app.py', 'write'],
    ['edit_file_patch_tool_local', 'Patched successfully (Exact match).', 'modify'],
    ['edit_file_patch_tool_local', 'Patched successfully (Normalized line endings match).', 'modify'],
    ['edit_file_patch_tool_local', 'Patched successfully (Fuzzy match: ignored whitespace/indentation differences).', 'modify'],
    ['edit_file_patch_tool', "[Success] Patched 'app.py'.", 'modify'],
  ]) {
    const row = model.projectFileChanges({ id: 'actual', toolName, status: 'done', output, input: JSON.stringify({ path: 'app.py', content: '', old_string: 'before', new_string: '' }) })[0];
    assert.equal(row.confirmed, true); assert.equal(row.status, 'done'); assert.equal(row.operation, operation);
    assert.equal(row.contentSource, 'request'); assert.equal(row.after, '');
    assert.equal(row.additions, null); assert.equal(row.deletions, null);
  }
});

/** 等待、失败与中断不会被成功字样覆盖。 / Pending, failed, and interrupted states cannot be overwritten by success text. */
test('file records preserve pending approval failure interruption and unknown outcomes', () => {
  for (const status of ['pending', 'running', 'awaiting_approval', 'error', 'cancelled', 'interrupted']) {
    const row = model.projectFileChanges({ toolName: 'edit_file_tool_local', status, input: { path: 'a.txt', content: 'next' }, output: 'Saved successfully.' })[0];
    assert.equal(row.status, status); assert.equal(row.confirmed, false);
  }
  const error = model.projectFileChanges({ toolName: 'edit_file_patch_tool_local', status: 'done', input: { path: 'a.txt', old_string: 'old', new_string: 'new' }, output: '[Error] old_string not found; Saved successfully. is just quoted text.' })[0];
  assert.equal(error.status, 'error'); assert.equal(error.confirmed, false);
});

/** 多文件记录来自明确回执，保留创建、删除及重命名。 / Multiple file records come from explicit receipts and retain create, delete, and rename operations. */
test('structured file receipts retain explicit operations identities and zero counts', () => {
  const changes = model.projectFileChanges({ id: 'tool', toolCallId: 'actual-call', status: 'done', output: {
    success: true, fileChanges: [
      { path: 'new.txt', operation: 'create', after: '', additions: 0, deletions: 0 },
      { path: 'gone.txt', kind: 'delete', before: 'old\n', additions: 0, deletions: 1 },
      { path: 'new-name.txt', kind: { type: 'rename' }, oldPath: 'old-name.txt', addedLines: 0, deletedLines: 0 },
    ],
  } });
  assert.equal(changes.length, 3);
  assert.deepEqual(changes.map(/** 读取明确操作。 / Read explicit operations. */ row => row.operation), ['create', 'delete', 'rename']);
  assert.deepEqual(changes.map(/** 读取回执身份。 / Read receipt identities. */ row => row.id), ['actual-call:file:0', 'actual-call:file:1', 'actual-call:file:2']);
  assert.ok(changes.every(/** 验证真实回执来源。 / Verify actual receipt provenance. */ row => row.confirmed && row.contentSource === 'receipt'));
  assert.equal(changes[0].after, ''); assert.equal(changes[0].additions, 0); assert.equal(changes[1].deletions, 1);
  assert.equal(changes[2].previousPath, 'old-name.txt');
});

/** 完整单文件diff可统计，文件头与上下文不计入增删。 / Count complete single-file diffs while excluding headers and context. */
test('complete unified diffs provide reliable line counts for actual file receipts', () => {
  const diff = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1,3 +1,4 @@\n same\n-old\n+new\n+extra\n end\n';
  const row = model.projectFileChanges({ status: 'done', fileChanges: [{ path: 'a.txt', operation: 'modify', diff }] })[0];
  assert.equal(row.diff, diff); assert.equal(row.additions, 2); assert.equal(row.deletions, 1);
  const deleted = model.projectFileChanges({ status: 'done', fileChanges: [{ path: 'gone', operation: 'delete', diff: '--- a/gone\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-old\n\\ No newline at end of file\n' }] })[0];
  assert.equal(deleted.additions, 0); assert.equal(deleted.deletions, 1);
});

/** 不完整、多文件、重叠和自相矛盾的差异不生成计数。 / Incomplete, multi-file, overlapping, and contradictory diffs do not produce counts. */
test('malformed truncated and contradictory diffs keep line counts unknown', () => {
  const valid = '--- a/a\n+++ b/a\n@@ -1,1 +1,1 @@\n-old\n+new\n';
  const cases = [
    { diff: '--- a/a\n+++ b/a\n@@ -1,2 +1,2 @@\n-old\n+new\n' },
    { diff: valid + valid }, { diff: valid, truncated: true },
    { diff: valid + '@@ -1,1 +1,1 @@\n-old\n+new\n' },
    { diff: valid, additions: 12, deletions: 1 },
  ];
  for (const fixture of cases) {
    const row = model.projectFileChanges({ status: 'done', fileChanges: [{ path: 'a', operation: 'modify', ...fixture }] })[0];
    assert.equal(row.additions, null); assert.equal(row.deletions, null);
  }
});

/** 文件事件必须带状态，步骤的失败仍然优先。 / File events require completion evidence and step failure still takes precedence. */
test('execution events preserve completion and failure evidence without command guessing', () => {
  const event = { type: 'file_change', changes: [{ path: 'a.txt', kind: 'add', after: 'new' }] };
  assert.equal(model.projectFileChanges({ executionEvent: event })[0].confirmed, false);
  const done = model.projectFileChanges({ id: 'event-call', executionEvent: { type: 'item.completed', item: { ...event, status: 'completed' } } })[0];
  assert.equal(done.confirmed, true); assert.equal(done.operation, 'create');
  const failed = model.projectFileChanges({ status: 'error', executionEvent: { ...event, status: 'completed' } })[0];
  assert.equal(failed.status, 'error'); assert.equal(failed.confirmed, false);
  assert.deepEqual(model.projectFileChanges({ kind: 'tool', toolName: 'exec_command', status: 'done', input: { cmd: 'rm old.txt; echo data > new.txt' }, output: 'success' }), []);
  assert.deepEqual(model.projectFileChanges({ toolName: 'read_file', status: 'done', input: { path: 'a.txt' }, output: 'Saved successfully.' }), []);
});

/** 文本与路径有界，HTML保持惰性，截断内容不冒充完整差异。 / Bound text and paths, keep HTML inert, and never treat truncated content as a complete diff. */
test('file projection bounds text rejects invalid paths and retains inert recorded content', () => {
  const source = '<script>PRIVATE_FILE_TEXT</script>' + '🙂'.repeat(60000);
  const result = model.projectFileChanges({ status: 'done', fileChanges: [
    { path: 'safe.txt', operation: 'modify', after: source, diff: source },
    { path: 'bad\npath', operation: 'delete' }, { path: 'a'.repeat(4097), operation: 'delete' },
    { path: 'unknown.txt', operation: 'read' },
  ] });
  assert.equal(result.length, 1); assert.equal(result[0].truncated, true);
  assert.ok(result[0].after.length <= 100000); assert.match(result[0].after, /^<script>PRIVATE_FILE_TEXT<\/script>/);
  assert.doesNotMatch(result[0].after, /[\uD800-\uDBFF]$/); assert.equal(result[0].additions, null);
});

/** 显式未知计数不被字符串、负数或正文长度替代。 / Unknown counts are never replaced by strings, negatives, or content length. */
test('invalid counts and proposed diffs never claim actual additions or deletions', () => {
  for (const counts of [{ additions: '3', deletions: -1 }, { additions: 1.5, deletions: Infinity }, { additions: null, deletions: null }]) {
    const row = model.projectFileChanges({ status: 'done', fileChanges: [{ path: 'a', operation: 'modify', before: 'old', after: 'new\nextra', ...counts }] })[0];
    assert.equal(row.additions, null); assert.equal(row.deletions, null);
  }
  const proposed = model.projectFileChanges({ status: 'done', fileChanges: [{ path: 'a', operation: 'modify', contentSource: 'request', confirmed: false, additions: 2, deletions: 1 }] })[0];
  assert.equal(proposed.confirmed, false); assert.equal(proposed.status, 'unknown'); assert.equal(proposed.additions, null);
});

/** 消息投影保留归属，跨设备投影不泄漏文件路径和正文。 / Message projection preserves ownership while cross-device projections exclude paths and content. */
test('file changes remain attached to their step and stay out of cross-device projections', () => {
  const message = { id: 'm', role: 'assistant', activityLog: [{ id: 'owned-step', toolName: 'edit_file_tool_local', toolCallId: 'call-a', status: 'done', output: 'Saved successfully.', input: { path: 'PRIVATE_PATH.txt', content: 'PRIVATE_FILE_BODY' } }] };
  const projected = model.projectMessageActivity(message);
  assert.equal(projected.steps[0].fileChanges[0].id, 'call-a:file:0');
  assert.equal(projected.steps[0].toolName, 'edit_file_tool_local');
  assert.deepEqual(model.projectFileChanges(projected.steps[0]), projected.steps[0].fileChanges);
  assert.doesNotMatch(JSON.stringify(model.buildConversationProjection({ messages: [message] })), /PRIVATE_PATH|PRIVATE_FILE_BODY|fileChanges/);
});
