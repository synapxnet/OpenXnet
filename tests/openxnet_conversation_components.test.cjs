/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话组件行为回归 / Conversation component behavior regression tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const uiRequire = createRequire(path.resolve(__dirname, '../frontend/chat-vite/package.json'));
const { parse, compileScript } = uiRequire('@vue/compiler-sfc');
const vue = uiRequire('vue');
const { renderToString } = uiRequire('@vue/server-renderer');
require('../static/js/openxnet-conversation-model.js');
const loaded = new Map();

/** 协作记录读取在切换消息后丢弃迟到结果，并保留安全正文。 / Discard late collaboration reads after message changes and preserve public text safely. */
test('subagent inspector isolates late transcript reads and shows public parent-child messages', async (t) => {
  const { renderer, root } = createTestHost();
  const component = await loadComponent('ConversationInspector');
  const pending = [];
  const state = vue.reactive({ message: { id: 'first', activity: { steps: [{ id: 'agent-first', agentId: 'a', taskId: 'one', status: 'done' }] } }, selection: { kind: 'activity', stepId: 'agent-first' } });
  const app = renderer.createApp({
    /** 通过实际 props 触发同一面板的消息切换。 / Trigger message switching through actual props on the same panel. */
    render() { return vue.h(component, { ...state, loadSubagentTranscript: (messageId, stepId) => new Promise((resolve) => pending.push({ messageId, stepId, resolve })) }); },
  });
  app.mount(root);
  t.after(() => app.unmount());
  assert.equal(pending[0].messageId, 'first');
  state.message = { id: 'second', activity: { steps: [{ id: 'agent-second', agentId: 'b', taskId: 'two', status: 'done' }] } };
  state.selection = { kind: 'activity', stepId: 'agent-second' };
  await vue.nextTick();
  pending[0].resolve({ messages: [{ id: 'wrong', role: 'parent', content: 'OTHER_CONVERSATION' }] });
  await vue.nextTick();
  pending.at(-1).resolve({ messages: [{ id: 'p', role: 'parent', content: '检查资料' }, { id: 'c', role: 'subagent', content: '<analysis>SECRET</analysis>检查完成\n两处建议' }] });
  await Promise.resolve();
  await vue.nextTick();
  const content = findNodes(root, (node) => node.type !== '#comment').map((node) => node.text).join(' ');
  assert.match(content, /主模型 → 子智能体/);
  assert.match(content, /子智能体 → 主模型/);
  assert.match(content, /检查完成\n两处建议/);
  assert.doesNotMatch(content, /OTHER_CONVERSATION|SECRET/);
});

/** 编译真实 SFC，使用已有 Vue 运行时完成隔离测试。 / Compile actual SFCs with the existing Vue runtime for isolated tests. */
async function loadComponent(name) {
  if (loaded.has(name)) return loaded.get(name);
  const filename = path.resolve(__dirname, `../frontend/chat-vite/src/${name}.vue`);
  const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, { id: name, inlineTemplate: true }).content;
  const vueUrl = pathToFileURL(path.resolve(path.dirname(uiRequire.resolve('vue/package.json')), 'index.mjs')).href;
  // 无 DOM 宿主运行真实过渡生命周期，CSS 动画另由浏览器验收。 / Run actual transition lifecycle hooks without DOM CSS hooks; browser checks cover visual motion.
  const code = compiled.replace(/from ["']vue["']/g, `from '${vueUrl}'`).replace(/\bTransition as _Transition\b/g, 'BaseTransition as _Transition').replace(/import ['"]\.\.\/\.\.\/\.\.\/static\/js\/openxnet-conversation-model\.js['"];?/g, '');
  const component = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
  loaded.set(name, component);
  return component;
}

/** 将真实组件渲染为字符串以验证转义和空状态。 / Render actual components to verify escaping and empty states. */
async function renderComponent(name, props) { return renderToString(vue.createSSRApp(await loadComponent(name), props)); }

/** 创建轻量宿主以运行真实 Vue 事件，无需浏览器或服务。 / Create a lightweight host for actual Vue events without browsers or services. */
function createTestHost() {
  /** 建立可记录属性与子节点的节点。 / Build nodes that retain properties and children. */
  function node(type, text = '') { return { type, text, props: {}, children: [], parent: null }; }
  const renderer = vue.createRenderer({
    /** 插入或移动渲染节点。 / Insert or move rendered nodes. */
    insert(child, parent, anchor = null) {
      if (child.parent) child.parent.children = child.parent.children.filter((item) => item !== child);
      child.parent = parent;
      const index = anchor ? parent.children.indexOf(anchor) : -1;
      if (index < 0) parent.children.push(child); else parent.children.splice(index, 0, child);
    },
    /** 移除旧节点。 / Remove obsolete nodes. */
    remove(child) { if (child.parent) child.parent.children = child.parent.children.filter((item) => item !== child); },
    /** 创建元素。 / Create elements. */
    createElement: (tag) => node(tag),
    /** 创建文本。 / Create text. */
    createText: (text) => node('#text', text),
    /** 创建注释。 / Create comments. */
    createComment: (text) => node('#comment', text),
    /** 更新文本。 / Update text. */
    setText: (target, text) => { target.text = text; },
    /** 更新元素文本。 / Update element text. */
    setElementText: (target, text) => { target.text = text; target.children = []; },
    /** 查找父节点。 / Find parent nodes. */
    parentNode: (target) => target.parent,
    /** 查找相邻节点。 / Find sibling nodes. */
    nextSibling: (target) => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
    /** 应用包含事件的属性。 / Apply properties including event handlers. */
    patchProp: (target, key, previous, next) => { target.props[key] = next; },
  });
  return { renderer, root: node('root') };
}

/** 深度查找实际渲染的控件。 / Find actual rendered controls recursively. */
function findNodes(root, predicate) {
  return [...(predicate(root) ? [root] : []), ...root.children.flatMap((child) => findNodes(child, predicate))];
}

/** 构造带真实状态和结果语义的隔离任务投影。 / Build an isolated task projection with actual state and result semantics. */
function automationPanelTask(fields = {}) { return { id: 'fixture-task', legacyId: 'legacy-task', scope: 'fixture-scope', title: 'Status monitor', description: 'Read fixture status', state: 'active', status: 'pending', scheduleExpression: 'every 15 minutes', nextRunAt: '2026-09-14T02:00:00Z', completionCondition: 'Verified recovery', notificationPolicy: 'changes_only', runs: [{ id: 'run-one', outcome: 'unchanged', summary: '<script>inert evidence</script>', evidence: ['actual-receipt'], finishedAt: '2026-09-14T01:00:00Z', notify: false }], ...fields }; }

/** 挂载真实自动任务面板以检验异步操作与历史。 / Mount the actual automation panel to verify async actions and history. */
async function mountAutomationPanel(t, bridge = {}) {
  const { renderer, root } = createTestHost(); const component = await loadComponent('AutomationPanel');
  const state = vue.reactive({ task: automationPanelTask(), canManage: true, canOpenCenter: true, isZh: true }); const events = [];
  const app = renderer.createApp({
    /** 传递可变化任务以及真实事件回调。 / Pass reactive tasks and actual event callbacks. */
    render() { return vue.h(component, { ...state, bridge, onChanged: () => events.push('changed'), onClose: () => events.push('close') }); },
  });
  app.mount(root); await vue.nextTick(); t.after(() => app.unmount());
  /** 查找面板中明确声明的操作。 / Find an explicitly declared panel action. */
  const action = (name) => findNodes(root, (node) => node.props['data-automation-action'] === name)[0];
  return { state, events, root, action };
}

/** 只渲染真实运行记录，普通文本证据不能成为HTML。 / Render actual run history while keeping evidence inert text. */
test('automation details retain schedule, real history, provenance and escaped evidence', async () => {
  const html = await renderComponent('AutomationPanel', { task: automationPanelTask(), bridge: {}, isZh: true, canManage: false });
  assert.match(html, /every 15 minutes/); assert.match(html, /Verified recovery/); assert.match(html, /自动任务结果/);
  assert.match(html, /未发生变化/); assert.match(html, /&lt;script&gt;inert evidence&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|data-automation-action="pause"/);
});

/** 等待审批与拒绝保持原状态，重复点击不能重复调用接口。 / Approval and rejection retain state, and repeated clicks cannot duplicate API calls. */
test('automation panel preserves actual state through pending, failed and approval outcomes', async (t) => {
  let finish; let calls = 0;
  const h = await mountAutomationPanel(t, { updateConversationAutomation: async () => { calls += 1; return new Promise((resolve) => { finish = resolve; }); } });
  const waiting = h.action('pause').props.onClick(); await vue.nextTick();
  assert.equal(h.action('pause').props.disabled, true);
  await h.action('pause').props.onClick(); assert.equal(calls, 1);
  finish({ awaitingApproval: true }); await waiting; await vue.nextTick();
  assert.equal(h.state.task.state, 'active'); assert.deepEqual(h.events, []);
  assert.ok(findNodes(h.root, (node) => node.props.role === 'status' && node.text.includes('等待确认')).length);
  const rejected = h.action('pause').props.onClick(); finish({ success: false }); await rejected; await vue.nextTick();
  assert.equal(h.state.task.state, 'active'); assert.deepEqual(h.events, []);
  assert.ok(findNodes(h.root, (node) => node.props.role === 'alert').length);
  const success = h.action('pause').props.onClick(); finish({ success: true }); await success; await vue.nextTick();
  assert.deepEqual(h.events, ['changed']); assert.equal(h.state.task.state, 'active', 'parent receipt must provide the new state');
  h.state.task.state = 'paused'; await vue.nextTick(); assert.ok(h.action('resume')); assert.equal(h.action('pause'), undefined);
});

/** 面板换任务后迟到结果不能给新任务显示成功。 / A late action result cannot report success for a newly selected task. */
test('automation panel isolates late action results across selected tasks', async (t) => {
  let finish;
  const h = await mountAutomationPanel(t, { updateConversationAutomation: async () => new Promise((resolve) => { finish = resolve; }) });
  const pending = h.action('complete').props.onClick();
  h.state.task = automationPanelTask({ id: 'other-task', scope: 'other-scope' }); await vue.nextTick();
  finish({ success: true }); await pending; await vue.nextTick();
  assert.deepEqual(h.events, []); assert.equal(h.action('pause').props.disabled, false);
});

/** 构建文件面板标签，所有文本均为隔离回执。 / Build file-panel tabs containing isolated receipt text only. */
function previewTab(id = 'one', fields = {}) {
  return { key: id, scope: 'fixture-scope', conversationId: 'fixture-chat', workspacePath: 'E:/fixture', messageId: 'answer', stepId: `step-${id}`, fileId: `file-${id}`, path: `src/${id}.py`, file: { id: `file-${id}`, path: `src/${id}.py`, contentSource: 'receipt', confirmed: true, after: `print('${id}')`, ...fields } };
}

/** 挂载真实文件面板并使标签可切换。 / Mount the actual file panel with switchable tabs. */
async function mountFilePreview(t, tabs, bridge = {}) {
  const { renderer, root } = createTestHost();
  const component = await loadComponent('FilePreviewPanel');
  const state = vue.reactive({ tabs, activeKey: tabs[0]?.key || '', isZh: true });
  const events = [];
  const app = renderer.createApp({
    /** 传入实际事件与动态props。 / Pass actual events and reactive props. */
    render() { return vue.h(component, { ...state, bridge,
      onSelect: (key) => { events.push(['select', key]); state.activeKey = key; },
      onCloseTab: (key) => events.push(['close-tab', key]), onClose: () => events.push(['close']),
    }); },
  });
  app.mount(root);
  await vue.nextTick();
  t.after(() => app.unmount());
  /** 按完整类名或数据属性定位控件。 / Find controls by complete classes or data attributes. */
  function get(className) { return findNodes(root, (node) => String(node.props.class || '').split(/\s+/).includes(className))[0]; }
  /** 读取真实面板展示文字。 / Read text displayed by the actual panel. */
  function text() { return findNodes(root, (node) => node.type !== '#comment').map((node) => node.text || node.props.innerHTML || '').join(' '); }
  return { root, state, events, get, text, app };
}

/** 回执代码惰性渲染并提供行号，浏览器不伪造原生能力。 / Receipt code renders inertly with line numbers and no invented browser-native capabilities. */
test('file preview displays receipt provenance, inert code and line numbers without native controls', async (t) => {
  const harness = await mountFilePreview(t, [previewTab('one', { after: '<script>evil()</script>\nprint("safe")', contentSource: 'request' })]);
  assert.match(harness.text(), /拟议内容/);
  const code = findNodes(harness.root, (node) => node.type === 'code');
  assert.equal(code.length, 2);
  assert.match(code[0].props.innerHTML, /&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.equal(findNodes(harness.root, (node) => node.type === 'script').length, 0);
  assert.equal(findNodes(harness.root, (node) => node.props.class === 'oxc-file-preview__number').length, 2);
  assert.equal(harness.get('oxc-file-preview__read'), undefined);
  assert.equal(harness.get('oxc-file-preview__open'), undefined);
});

/** 标签关闭与键盘切换保留明确文件身份。 / Closing tabs and keyboard switching preserve explicit file identities. */
test('file preview tabs select and close files through real component events', async (t) => {
  const harness = await mountFilePreview(t, [previewTab(), previewTab('two')]);
  const tabs = findNodes(harness.root, (node) => node.props.role === 'tab');
  tabs[0].props.onKeydown({ key: 'ArrowRight', preventDefault() {} });
  await vue.nextTick();
  assert.equal(harness.state.activeKey, 'two');
  assert.match(harness.text(), /print\(&#39;two&#39;\)/);
  findNodes(harness.root, (node) => node.props.class === 'oxc-file-preview__tab-close')[1].props.onClick();
  harness.get('oxc-file-preview__close').props.onClick();
  assert.deepEqual(harness.events, [['select', 'two'], ['close-tab', 'two'], ['close']]);
});

/** 切换文件后迟到的磁盘读取不得覆盖新文件回执。 / A late disk read cannot overwrite another file's receipt after switching tabs. */
test('file preview ignores late disk content after changing the active file', async (t) => {
  let resolveRead;
  const harness = await mountFilePreview(t, [previewTab(), previewTab('two')], { conversationFileCapabilities: () => ({ read: true }), readConversationFile: () => new Promise((resolve) => { resolveRead = resolve; }) });
  const pending = harness.get('oxc-file-preview__read').props.onClick();
  harness.state.activeKey = 'two';
  await vue.nextTick();
  resolveRead({ path: 'E:/fixture/src/one.py', content: 'STALE DISK SECRET', binary: false, source: 'workspace' });
  await pending;
  await vue.nextTick();
  assert.doesNotMatch(harness.text(), /STALE DISK SECRET|当前磁盘内容/);
  assert.match(harness.text(), /two/);
  assert.equal(harness.get('oxc-file-preview__read').props.disabled, false);
});

/** 空磁盘文件、二进制与缺失正文不可混淆。 / Empty disk files, binary files and missing receipt text remain distinct. */
test('file preview distinguishes empty and binary disk content from missing receipts', async (t) => {
  let disk = { path: 'E:/fixture/one.py', content: '', binary: false, source: 'workspace', canOpenDefault: false };
  const harness = await mountFilePreview(t, [previewTab('one', { after: undefined })], { conversationFileCapabilities: () => ({ read: true }), readConversationFile: async () => disk });
  assert.match(harness.text(), /没有文件正文/);
  await harness.get('oxc-file-preview__read').props.onClick();
  await vue.nextTick();
  assert.match(harness.text(), /当前磁盘内容/);
  assert.match(harness.text(), /文件内容为空/);
  disk = { ...disk, content: null, binary: true };
  await harness.get('oxc-file-preview__read').props.onClick();
  await vue.nextTick();
  assert.match(harness.text(), /二进制文件/);
  assert.doesNotMatch(harness.text(), /文件内容为空/);
});

/** 原生菜单只列检测结果，选中文件和取消操作保留真实语义。 / Native menus list detected editors only and preserve selected-file and cancellation semantics. */
test('file actions use detected editors and selected-file provenance without pretending cancellation succeeded', async (t) => {
  const actions = [];
  const harness = await mountFilePreview(t, [previewTab()], {
    conversationFileCapabilities: () => ({ select: true, editors: true, actions: true }),
    selectConversationFile: async () => ({ path: 'D:/chosen/one.py', grantId: 'grant-fixture', source: 'selected-file', content: 'selected receipt', binary: false, canOpenDefault: false }),
    listConversationFileEditors: async () => [{ id: 'code', label: 'Visual Studio Code' }],
    actOnConversationFile: async (...args) => { actions.push(args); return { success: false, canceled: true }; },
  });
  await harness.get('oxc-file-preview__select').props.onClick();
  await vue.nextTick();
  assert.match(harness.text(), /用户选择文件/);
  await harness.get('oxc-file-preview__open').props.onClick();
  await vue.nextTick();
  assert.equal(findNodes(harness.root, (node) => node.props['data-file-action'] === 'open-default').length, 0);
  const editor = findNodes(harness.root, (node) => node.props['data-file-editor'] === 'code')[0];
  assert.ok(editor);
  assert.doesNotMatch(harness.text(), /Cursor|Notepad/);
  await editor.props.onClick();
  await vue.nextTick();
  assert.equal(actions[0][1], 'open-editor');
  assert.equal(actions[0][2], 'code');
  assert.equal(actions[0][3], true);
  assert.match(harness.text(), /已取消/);
  assert.doesNotMatch(harness.text(), /操作已完成/);
});

/** 已删除回执立即清空正文，不复用另一个文件。 / Removed receipts immediately clear content without substituting another file. */
test('file preview invalidates a removed receipt while a native read is pending', async (t) => {
  let resolveRead;
  const harness = await mountFilePreview(t, [previewTab()], { conversationFileCapabilities: () => ({ read: true }), readConversationFile: () => new Promise((resolve) => { resolveRead = resolve; }) });
  const pending = harness.get('oxc-file-preview__read').props.onClick();
  harness.state.tabs[0].file = null;
  await vue.nextTick();
  resolveRead({ content: 'REMOVED RECEIPT CONTENT', path: 'E:/fixture/one.py', source: 'workspace' });
  await pending;
  await vue.nextTick();
  assert.match(harness.text(), /所选文件回执已不可用/);
  assert.doesNotMatch(harness.text(), /REMOVED RECEIPT CONTENT|print/);
});

/** 工具摘要与可展开侧栏保持真实失败和原始文本。 / Activity summaries and inspector retain real failures and inert payload text. */
test('inspector renders structured subagent failures and escapes tool details', async () => {
  const html = await renderComponent('ConversationInspector', {
    isZh: true, selection: { kind: 'activity', stepId: 'call' },
    message: { id: 'message', activity: { steps: [{ id: 'call', kind: 'tool', agentId: 'agent-1', taskId: 'task-1', status: 'error', title: 'Analysis', input: '<img src=x onerror=evil()>', output: { answer: 'partial' }, error: '<script>evil()</script>' }] } },
  });
  assert.match(html, /子智能体/);
  assert.match(html, /task-1/);
  assert.match(html, /交付结果/);
  assert.match(html, /错误详情/);
  assert.match(html, /&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
});

/** 不存在的选中活动必须说明缺失。 / A missing selected activity must be reported as missing. */
test('inspector does not substitute a missing selected activity', async () => {
  const html = await renderComponent('ConversationInspector', { selection: { kind: 'activity', stepId: 'gone' }, message: { id: 'm', activity: { steps: [{ id: 'other', title: 'Remaining', status: 'done', output: 'DO NOT SHOW AS SELECTED' }] } } });
  assert.match(html, /所选记录已不可用/);
  assert.doesNotMatch(html, /DO NOT SHOW AS SELECTED/);
});

/** 注入和未使用状态不能混淆。 / Injection and unused memory states must remain distinct. */
test('memory tab distinguishes unused, failed and injected receipts', async () => {
  const html = await renderComponent('ConversationInspector', { selection: { kind: 'memory' }, message: { id: 'm', conversationId: 'current', memoryContext: [
    { id: 'off', status: 'not_used', source: 'native', count: 0 },
    { id: 'bad', status: 'error', source: 'retrieval' },
    { id: 'yes', status: 'injected', source: 'synapxnet-memory-v3', items: [{ memoryId: 'memory-13', title: 'Saved preference', version: 3, recordSha256: 'a'.repeat(64), content: 'MUST NEVER RENDER MEMORY BODY' }] },
    { id: 'wrong', status: 'injected', source: 'WRONG CONVERSATION', conversationId: 'other' },
  ] } });
  assert.match(html, /本轮未使用/);
  assert.match(html, /读取失败/);
  assert.match(html, /已注入本轮/);
  assert.match(html, /原生记忆 V3/);
  assert.match(html, /Saved preference/);
  assert.match(html, /memory-13/);
  assert.match(html, /记录指纹/);
  assert.doesNotMatch(html, /WRONG CONVERSATION/);
  assert.doesNotMatch(html, /MUST NEVER RENDER MEMORY BODY/);
  const empty = await renderComponent('ConversationInspector', { selection: { kind: 'memory' }, message: { id: 'empty' } });
  assert.match(empty, /暂无本轮记忆回执/);
});

/** 身份来自消息本身，图片和文件附件同时呈现。 / Identity comes from the message and both image and file attachments render. */
test('identity tab retains saved avatar and readable attachment names', async () => {
  const html = await renderComponent('ConversationInspector', { selection: { kind: 'identity' }, message: { id: 'm', role: 'assistant', identity: { name: 'Original role', image: 'source/avatar.png', source: 'message' }, attachments: [{ kind: 'image', name: 'Photo.png', path: 'source/photo.png' }, { kind: 'file', name: 'Report.pdf', path: 'source/report.pdf' }] } });
  assert.match(html, /Original role/);
  assert.match(html, /src="source\/avatar.png"/);
  assert.match(html, /src="source\/photo.png"/);
  assert.match(html, /Report.pdf/);
  assert.match(html, /rel="noopener noreferrer"/);
});

/** 执行摘要可展开全部，内联展开与详情检查保持独立。 / Activity summaries expand all records while inline disclosure remains separate from inspection. */
test('activity expansion and inspect events execute through the actual Vue component', async () => {
  const { renderer, root } = createTestHost();
  const inspections = [];
  const app = renderer.createApp(await loadComponent('ChatActivity'), { activity: { active: true, steps: Array.from({ length: 6 }, (_, i) => ({ id: `step-${i}`, title: `Step ${i}`, status: i === 5 ? 'error' : 'done', kind: 'tool' })) }, onInspect: (selection) => inspections.push(selection) });
  app.mount(root);
  assert.equal(findNodes(root, (node) => node.type === 'button' && node.props.class?.includes('oxc-worklog__step')).length, 3);
  const expand = findNodes(root, (node) => node.type === 'button' && node.props.class === 'oxc-worklog__expand')[0];
  expand.props.onClick();
  await vue.nextTick();
  const rows = findNodes(root, (node) => node.type === 'button' && node.props.class?.includes('oxc-worklog__step'));
  assert.equal(rows.length, 6);
  rows[0].props.onClick();
  await vue.nextTick();
  assert.equal(rows[0].props['aria-expanded'], true);
  assert.deepEqual(inspections, []);
  const inspect = findNodes(root, (node) => node.type === 'button' && node.props.class?.includes('oxc-worklog__inspect'))[0];
  inspect.props.onClick();
  assert.deepEqual(inspections, [{ kind: 'activity', stepId: 'step-0' }]);
  app.unmount();
});

/** 真实消息导航按钮保留 ID 并可用键盘定位。 / Actual navigation buttons retain IDs and support keyboard focus. */
test('message navigation emits stable IDs and supports arrow keys', async () => {
  const { renderer, root } = createTestHost();
  const navigations = [];
  const app = renderer.createApp(await loadComponent('MessageNavigator'), { messages: [{ id: 'u1', role: 'user', text: 'First' }, { id: 'u2', role: 'user', attachments: [{ kind: 'image' }] }], activeId: 'u2', onNavigate: (id) => navigations.push(id) });
  app.mount(root);
  const buttons = findNodes(root, (node) => node.type === 'button' && node.props['data-turn-id']);
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].props['aria-current'], 'location');
  assert.match(buttons[1].props['aria-label'], /1 个附件/);
  buttons[1].props.onClick();
  assert.deepEqual(navigations, ['u2']);
  let focused = null;
  let prevented = false;
  buttons.forEach((button) => { button.focus = () => { focused = button.props['data-turn-id']; }; });
  const nav = findNodes(root, (node) => node.type === 'nav')[0];
  nav.props.onKeydown({ key: 'ArrowDown', target: buttons[0], currentTarget: { querySelectorAll: () => buttons }, preventDefault: () => { prevented = true; } });
  assert.equal(focused, 'u2');
  assert.equal(prevented, true);
  app.unmount();
});

/** 悬停和聚焦预览真实正文，支持 Escape，并在同 ID 的会话切换后清空。 / Hover and focus preview actual text, support Escape and reset across conversations reusing an ID. */
test('message navigation previews visible replies and clears overlays on escape and scope changes', async () => {
  const { renderer, root } = createTestHost();
  const component = await loadComponent('MessageNavigator');
  const state = vue.reactive({ messages: [
    { id: 'u1', role: 'user', text: 'A real question', conversationId: 'one' },
    { id: 'a1', role: 'assistant', text: 'An existing reply <analysis>SECRET_THOUGHT</analysis>', html: 'SECRET_HTML', activity: { steps: [{ output: 'SECRET_OUTPUT' }] } },
    { id: 'u2', role: 'user', text: 'No reply yet', conversationId: 'one' },
  ], activeId: 'u1' });
  /** 保留响应式输入以执行实际会话切换。 / Retain reactive inputs to execute actual scope changes. */
  const app = renderer.createApp({ render: () => vue.h(component, state) });
  app.mount(root);
  /** 读取测试宿主中的实际预览文本。 / Read actual preview text from the test host. */
  const previewText = () => findNodes(root, (node) => node.props.role === 'tooltip').flatMap((node) => findNodes(node, (child) => !!child.text)).map((node) => node.text).join(' ');
  /** 查找可见的实际定位按钮。 / Find actual visible navigation buttons. */
  const ticks = () => findNodes(root, (node) => node.type === 'button' && node.props['data-turn-id']);
  assert.equal(findNodes(root, (node) => node.props.role === 'tooltip').length, 0);
  await ticks()[0].props.onPointerenter({ currentTarget: ticks()[0] });
  await vue.nextTick();
  assert.match(previewText(), /A real question/);
  assert.match(previewText(), /An existing reply/);
  assert.doesNotMatch(previewText(), /SECRET/);
  const tooltip = findNodes(root, (node) => node.props.role === 'tooltip')[0];
  assert.equal(ticks()[0].props['aria-describedby'], tooltip.props.id);
  assert.equal(ticks()[0].props['aria-current'], 'location');
  assert.match(ticks()[0].props.class, /is-current/);
  const nav = findNodes(root, (node) => node.type === 'nav')[0];
  let toggleFocused = false;
  const toggle = findNodes(root, (node) => node.type === 'button' && node.props.class === 'oxc-turn-nav__toggle')[0];
  toggle.focus = () => { toggleFocused = true; };
  nav.props.onKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  await vue.nextTick();
  assert.equal(toggleFocused, true);
  assert.equal(tooltip.inert, true);
  assert.equal(previewText(), '');
  await ticks()[1].props.onFocus({ currentTarget: ticks()[1] });
  await vue.nextTick();
  assert.match(previewText(), /No reply yet/);
  assert.match(previewText(), /暂无可预览的回复/);
  ticks()[1].props.onBlur();
  await vue.nextTick();
  assert.equal(previewText(), '');
  await ticks()[0].props.onFocus({ currentTarget: ticks()[0] });
  await vue.nextTick();
  state.messages = [{ id: 'u1', role: 'user', text: 'New conversation', conversationId: 'two' }];
  await vue.nextTick();
  assert.equal(previewText(), '');
  assert.equal(ticks()[0].props['aria-describedby'], undefined);
  app.unmount();
});

/** 预览靠近正文底部时应上移，并依据所在面板宽度收窄。 / Previews near the reading-area bottom move upward and fit their containing panel width. */
test('message navigation positions hover previews within the reading panel', async () => {
  const { renderer, root } = createTestHost();
  const app = renderer.createApp(await loadComponent('MessageNavigator'), { messages: [{ id: 'u', role: 'user', text: 'Near the bottom' }] });
  app.mount(root);
  const nav = findNodes(root, (node) => node.type === 'nav')[0];
  /** 模拟窄正文区域和底部刻度的真实几何边界。 / Model actual geometry for a narrow reading panel and a tick near its bottom. */
  nav.getBoundingClientRect = () => ({ left: 20, top: 80, height: 500 });
  nav.parentElement = { getBoundingClientRect: () => ({ right: 260 }) };
  const button = findNodes(root, (node) => node.type === 'button' && node.props['data-turn-id'])[0];
  button.getBoundingClientRect = () => ({ top: 560, height: 20 });
  await button.props.onPointerenter({ currentTarget: button });
  await vue.nextTick();
  const preview = findNodes(root, (node) => node.props.role === 'tooltip')[0];
  assert.ok(parseFloat(preview.props.style.top) + 240 <= 500);
  assert.ok(20 + 40 + parseFloat(preview.props.style.width) <= 260);
  app.unmount();
});

/** 长目录选择只调整刻度容器的滚动，不能调用正文滚动。 / Selecting a long outline adjusts only the tick container without invoking message scrolling. */
test('message navigation keeps the current tick visible within its own scroll container', async () => {
  const { renderer, root } = createTestHost();
  const component = await loadComponent('MessageNavigator');
  const state = vue.reactive({ messages: [{ id: 'first', role: 'user', text: 'First' }, { id: 'last', role: 'user', text: 'Last' }], activeId: 'first' });
  /** 通过真实响应式输入触发当前刻度更新。 / Trigger current-tick updates through actual reactive input. */
  const app = renderer.createApp({ render: () => vue.h(component, state) });
  app.mount(root);
  const nav = findNodes(root, (node) => node.type === 'nav')[0];
  /** 模拟内部列表滚动，正文没有暴露任何滚动接口。 / Model internal list scrolling without exposing message-scrolling methods. */
  const list = { scrollTop: 0, getBoundingClientRect: () => ({ top: 100, bottom: 300 }), querySelectorAll: () => [
    { getAttribute: () => 'first', getBoundingClientRect: () => ({ top: 100, bottom: 120 }) },
    { getAttribute: () => 'last', getBoundingClientRect: () => ({ top: 580, bottom: 600 }) },
  ] };
  nav.querySelector = () => list;
  state.activeId = 'last';
  await vue.nextTick();
  assert.equal(list.scrollTop, 300);
  app.unmount();
});
