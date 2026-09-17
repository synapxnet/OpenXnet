/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 真实会话工作台行为回归 / Actual conversation workbench behavior regression.
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
require('../static/js/openxnet-conversation-model.js');
const vueUrl = pathToFileURL(path.resolve(path.dirname(uiRequire.resolve('vue/package.json')), 'index.mjs')).href;
const componentUrls = new Map();
const bridgeKey = '__openxnetConversationAppTestBridge';

/** 用真实 Vue 保留组件行为，仅省略无关 CSS 过渡。 / Keep real Vue behavior while omitting unrelated CSS transitions. */
function dataModule(code) { return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`; }
const runtimeUrl = dataModule(`export * from '${vueUrl}'; export const Transition = { inheritAttrs: false, setup(props, { slots }) { return () => slots.default?.(); } };`);

/** 在内存中编译真实 SFC，只暴露观察点而不改业务函数。 / Compile actual SFCs in memory, exposing observation points without changing business functions. */
function componentModule(name) {
  if (componentUrls.has(name)) return componentUrls.get(name);
  const filename = path.resolve(__dirname, `../frontend/chat-vite/src/${name}.vue`);
  let source = fs.readFileSync(filename, 'utf8');
  if (name === 'App') source = source.replace('</script>', '\ndefineExpose({ refreshSnapshot, snapshot, draft, composerError, readingHistory, hasUnreadOutput, activeMessageId, inspectorSelection, inspectorMessage, handleSend, handleStreamScroll, navigateToMessage, returnToLatest, openMessageInspector, closeMessageInspector, showRoleCardPopover, showMemoryPopover, showContextPopover, showMorePopover });\n</script>');
  const { descriptor, errors } = parse(source, { filename });
  assert.deepEqual(errors, []);
  let code = compileScript(descriptor, { id: `app-test-${name}`, inlineTemplate: true }).content;
  code = code.replace(/from ["']vue["']/g, `from '${runtimeUrl}'`)
    .replace(/import ['"]\.\.\/\.\.\/\.\.\/static\/js\/openxnet-conversation-model\.js['"];?/g, '')
    .replace(/import \{ createChatBridge \} from ['"]\.\/chatBridge['"];?/, `const createChatBridge = () => globalThis.${bridgeKey};`)
    .replace(/from ['"]\.\/conversationViewport\.js['"]/g, `from '${pathToFileURL(path.resolve(__dirname, '../frontend/chat-vite/src/conversationViewport.js')).href}'`)
    .replace(/from ['"]\.\/(ChatActivity|ConversationInspector|MessageNavigator|FilePreviewPanel|AutomationPanel|GuidanceQueue|ConnectionNotice)\.vue['"]/g, (_, child) => `from '${componentModule(child)}'`);
  const url = dataModule(code);
  componentUrls.set(name, url);
  return url;
}

/** 查找轻量宿主内的真实渲染节点。 / Find actual rendered nodes in the lightweight host. */
function findNodes(root, predicate) { return [...(predicate(root) ? [root] : []), ...root.children.flatMap((child) => findNodes(child, predicate))]; }

/** 匹配组件使用的有限选择器。 / Match the bounded selectors used by these components. */
function matches(node, selector) {
  if (selector.startsWith('.')) return String(node.props.class || '').split(/\s+/).includes(selector.slice(1));
  const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attribute) return Object.prototype.hasOwnProperty.call(node.props, attribute[1]) && (attribute[2] === undefined || String(node.props[attribute[1]]) === attribute[2]);
  return node.type === selector;
}

/** 模拟浏览器有限滚动范围与真实视口坐标，不替换 App 业务逻辑。 / Model bounded browser scrolling and viewport coordinates without replacing App logic. */
function constrainLastTurnViewport(harness) {
  const stream = harness.get('.oxc-stream');
  stream.scrollHeight = 680;
  stream.clientHeight = 400;
  stream.rectTop = 0;
  let scrollTop = 100;
  Object.defineProperty(stream, 'scrollTop', {
    configurable: true,
    /** 读取浏览器当前偏移。 / Read the current browser offset. */
    get() { return scrollTop; },
    /** 浏览器不能滚过内容底部。 / Browsers cannot scroll beyond the content bottom. */
    set(value) { scrollTop = Math.max(0, Math.min(Number(value) || 0, stream.scrollHeight - stream.clientHeight)); },
  });
  const contentOffsets = { u1: 20, a1: 100, u2: 620 };
  for (const message of findNodes(harness.root, /** 按实际根节点关联消息。 / Locate actual message roots. */ node => node.props['data-message-id'])) {
    /** 浏览器坐标随滚动变化，末尾目标不一定能抵达视口顶端。 / Viewport coordinates follow scrolling; a final target may never reach the viewport top. */
    message.getBoundingClientRect = function getClampedMessageRect() {
      const top = contentOffsets[message.dataset.messageId] - stream.scrollTop;
      return { top, bottom: top + 60, height: 60, width: 600, left: 0, right: 600 };
    };
  }
  return stream;
}

/** 从真实消息根读取明确的定位高亮契约。 / Read the explicit navigation highlight contract from actual message roots. */
function navigationHighlightedMessages(harness) {
  return findNodes(harness.root, /** 仅接受消息根上的显式目标标记。 / Accept explicit target markers on message roots only. */ node => Boolean(node.props['data-message-id'])
    && (matches(node, '.is-navigation-target') || node.props['data-navigation-selected'] === true || node.props['data-navigation-selected'] === 'true'));
}

/** 构造隔离会话，桥接状态由测试显式控制。 / Build an isolated conversation with explicitly controlled bridge state. */
function baseSnapshot() {
  return {
    isZh: true, activeMenu: 'chat', conversationId: 'chat-a', canUseHost: true, isSending: false, isEmpty: false,
    title: 'Conversation A', messages: [
      { id: 'u1', role: 'user', text: 'First question', attachments: [], identity: { name: 'User' } },
      { id: 'a1', role: 'assistant', text: 'First answer', html: '<p>First answer</p>', attachments: [], memoryContext: [], identity: { name: 'Original assistant', source: 'message' }, activity: { visible: false, steps: [], signature: '' } },
      { id: 'u2', role: 'user', text: 'Next question', attachments: [] },
    ],
    attachments: [], conversations: [], historyQuery: '',
    settings: {
      providerId: 'provider', providerName: 'Provider', model: 'test-model', roleCardAvailable: true,
      roleCardName: 'Role A', roleCardSelectedId: 'role-a', roleCards: [{ id: 'role-a', name: 'Role A', desc: 'Original description' }],
      memoryAvailable: true, nativeMemoryAvailable: true, nativeMemoryEnabled: false,
      workspace: { path: 'E:/workspace-a', name: 'Workspace', loaded: false, projects: [], git: {} },
      providerCards: [{ id: 'provider', name: 'Provider', validationStatus: '' }],
      permission: { current: 'default', options: [] }, contextWindow: { used: 200, limit: 1000, percent: 20, ratio: .2, label: 'Estimate', summary: 'Estimated usage' },
    },
  };
}

/** 挂载完整 App，时间、滚动和宿主调用均可控。 / Mount the complete App with controlled time, scrolling and host calls. */
async function mountApp(overrides = {}) {
  let state = overrides.snapshot || baseSnapshot();
  const timers = new Map();
  const frames = new Map();
  const listeners = new Map();
  let timerId = 0;
  let frameId = 0;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const doc = { activeElement: null, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name) };
  const win = {
    innerWidth: 1280, innerHeight: 900,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = win;
  globalThis.document = doc;
  const sends = [];
  globalThis[bridgeKey] = {
    snapshot: () => structuredClone(state),
    sendMessage: async (text) => { sends.push(text); return overrides.sendMessage ? overrides.sendMessage(text) : true; },
    loadConversation: async () => true, ...overrides.bridge,
  };
  /** 建立具备必要布局接口的轻量节点。 / Create lightweight nodes with required layout interfaces. */
  function node(type, text = '') {
    const result = {
      type, tagName: type.toUpperCase(), text, props: {}, children: [], parent: null, style: {}, dataset: {},
      scrollTop: 0, scrollHeight: type === 'textarea' ? 48 : 1400, clientHeight: 400, rectTop: 0,
      classList: { add() {}, remove() {} },
      focus() { doc.activeElement = result; },
      getBoundingClientRect() { return { top: result.rectTop, bottom: result.rectTop + 160, height: 160, width: 600, left: 0, right: 600 }; },
      querySelectorAll(selector) { return findNodes(result, (child) => child !== result && matches(child, selector)); },
      querySelector(selector) { return result.querySelectorAll(selector)[0] || null; },
      setAttribute(key, value) { result.props[key] = value; },
      removeAttribute(key) { delete result.props[key]; },
      addEventListener() {}, removeEventListener() {},
    };
    return result;
  }
  const root = node('root');
  const body = node('body');
  doc.querySelector = () => body;
  /** 插入、移动和静态节点共享同一宿主操作。 / Share host insertion for dynamic and static nodes. */
  function insert(child, parent, anchor) {
    if (child.parent) child.parent.children = child.parent.children.filter((item) => item !== child);
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(child); else parent.children.splice(index, 0, child);
  }
  const renderer = vue.createRenderer({
    insert,
    remove: (child) => { if (child.parent) child.parent.children = child.parent.children.filter((item) => item !== child); child.parent = null; },
    createElement: (tag) => node(tag), createText: (text) => node('#text', text), createComment: (text) => node('#comment', text),
    setText: (target, text) => { target.text = text; }, setElementText: (target, text) => { target.text = text; target.children = []; },
    parentNode: (target) => target.parent, nextSibling: (target) => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
    querySelector: () => body,
    insertStaticContent: (content, parent, anchor) => { const item = node('#static', content); insert(item, parent, anchor); return [item, item]; },
    patchProp: (target, key, previous, next) => {
      target.props[key] = next;
      if (key === 'style' && next) Object.assign(target.style, next);
      if (key.startsWith('data-')) target.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = next;
      if (key === 'value') target.value = next;
    },
  });
  const component = (await import(componentModule('App'))).default;
  const app = renderer.createApp(component);
  const vm = app.mount(root);
  /** 清空当前微任务与动画帧，防止测试绕过排队滚动。 / Flush actual microtasks and animation frames without bypassing scheduled scrolling. */
  async function flush() {
    for (let pass = 0; pass < 8; pass += 1) {
      await vue.nextTick();
      const pending = [...frames.values()];
      frames.clear();
      for (const frame of pending) frame();
    }
  }
  /** 仅推进一个动画帧批次，保留后续帧用于阅读竞态验证。 / Advance one frame batch, retaining later frames for reading-race verification. */
  async function advanceFrame() {
    await vue.nextTick();
    const pending = [...frames.values()];
    frames.clear();
    for (const frame of pending) frame();
  }
  await flush();
  /** 找出当前实际渲染控件。 / Locate currently rendered controls. */
  function get(selector) { return findNodes(root, (item) => matches(item, selector))[0]; }
  /** 更新桥接输入，等待显式快照刷新。 / Update bridge input, waiting for an explicit snapshot refresh. */
  function update(mutator) { mutator(state); }
  /** 清理组件与隔离全局对象。 / Clean up the component and isolated globals. */
  function cleanup() {
    app.unmount();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    delete globalThis[bridgeKey];
  }
  return { app, vm, root, get, update, flush, advanceFrame, cleanup, sends, listeners, state: () => state };
}

/** 构造带原始工具记录的中断会话。 / Build an interrupted conversation with original tool receipts. */
function connectionAppSnapshot() {
  const state = baseSnapshot();
  state.connection = { conversationId: 'chat-a', requestId: 'request-a', messageId: 'a1', workspacePath: 'E:/workspace-a', state: 'interrupted', kind: 'http', httpStatus: 503, networkOnline: true, attempt: 0, maxAttempts: 5, canCheck: true, canContinue: true, detail: 'HTTP 503 · upstream unavailable', message: '服务暂时不可用，已有内容会保留。' };
  state.recovery = { conversationId: 'chat-a', requestId: 'request-a', messageId: 'a1', available: true, pending: false, reason: '', error: '' };
  state.messages[1].activity = { visible: true, signature: 'tool-receipt', status: 'interrupted', steps: [{ id: 'tool-receipt', kind: 'tool', title: 'Retained tool', status: 'done', result: 'Actual receipt' }] };
  return state;
}

/** 读取真实渲染内容，包含组件子节点。 / Read actual rendered content including component children. */
function renderedText(node) { return node ? [node.text || '', ...(node.children || []).map(renderedText)].join(' ') : ''; }

/** 错误提示紧随原回复，仅合并相同恢复记录且保留未保存错误。 / Inline errors follow the original reply, merging only matching recovery records and retaining save errors. */
test('connection notice anchors actual HTTP failure near the reply and retains unsaved-content recovery', async (t) => {
  const harness = await mountApp({ snapshot: connectionAppSnapshot() }); t.after(harness.cleanup);
  const notice = harness.get('.oxc-connection-notice');
  assert.equal(notice.parent.parent.props['data-message-id'], 'a1'); assert.equal(harness.get('.oxc-recovery-banner'), undefined);
  assert.match(renderedText(notice), /服务暂时不可用/); assert.doesNotMatch(renderedText(notice), /设备网络已离线|正在重新连接/);
  const detail = harness.get('.oxc-connection-notice__details'); assert.ok(detail); assert.equal(detail.props.open, undefined); assert.match(renderedText(detail), /HTTP 503/);
  assert.equal(findNodes(harness.root, (node) => matches(node, '.oxc-connection-notice')).length, 1);
  harness.update((state) => { state.recovery.error = 'Latest partial content is not saved'; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.ok(harness.get('[data-recovery-action="save"]')); assert.ok(harness.get('.oxc-connection-notice'));
  harness.update((state) => { state.recovery.error = ''; state.recovery.requestId = 'other-request'; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.ok(harness.get('.oxc-recovery-banner'), 'a different unfinished request retains its recovery entry');
  harness.update((state) => { state.connection.workspacePath = 'E:/foreign'; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush(); assert.equal(harness.get('.oxc-connection-notice'), undefined);
});

/** 计数只随真实快照变化；服务可达不宣称原回复已经继续。 / Counts follow actual snapshots only; reachable service does not claim the original reply resumed. */
test('connection UI distinguishes device offline, real probe counts, exhausted checks and reachable service', async (t) => {
  const harness = await mountApp({ snapshot: connectionAppSnapshot() }); t.after(harness.cleanup);
  harness.update((state) => { Object.assign(state.connection, { state: 'offline', kind: 'offline', message: '', httpStatus: null, networkOnline: false }); }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.match(renderedText(harness.get('.oxc-connection-notice')), /设备网络已离线/);
  harness.update((state) => { Object.assign(state.connection, { state: 'checking', attempt: 2, canCheck: false, canContinue: false }); }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.match(renderedText(harness.get('.oxc-connection-notice')), /正在检查会话状态 2\/5/); assert.equal(harness.get('[data-connection-action="continue"]'), undefined);
  await harness.flush(); assert.match(renderedText(harness.get('.oxc-connection-notice')), /2\/5/);
  harness.update((state) => { Object.assign(state.connection, { state: 'failed', attempt: 5, canCheck: true }); }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.match(renderedText(harness.get('[data-connection-action="check"]')), /重新检查/);
  harness.update((state) => { Object.assign(state.connection, { state: 'reachable', networkOnline: true }); }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.match(renderedText(harness.get('.oxc-connection-notice')), /原回复尚未继续/); assert.equal(harness.sends.length, 0);
  harness.update((state) => { state.connection.message = '应用服务可达，原回复仍在执行。暂未启动新的生成。'; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.match(renderedText(harness.get('.oxc-connection-notice')), /原回复仍在执行/); assert.equal(harness.get('[data-connection-action="continue"]'), undefined);
});

/** 检查锁和恢复入口保留草稿、工具回执与阅读位置。 / Check locks and recovery actions preserve drafts, tool receipts and reading position. */
test('actual connection buttons check once then reuse safe recovery without changing the draft or reading position', async (t) => {
  let finish; const checks = []; const resumes = [];
  const harness = await mountApp({ snapshot: connectionAppSnapshot(), bridge: {
    /** 仅等待受控检查完成。 / Wait for the controlled check to finish. */
    checkConversationConnection: (reference) => { checks.push(reference); return new Promise((resolve) => { finish = resolve; }); },
    /** 记录既有恢复入口。 / Record the existing recovery entry. */
    resumeConversationRecovery: async (reference) => { resumes.push(reference); return true; },
  } }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Preserved draft' } });
  const stream = harness.get('.oxc-stream'); stream.scrollTop = 110; stream.props.onScrollPassive();
  const original = JSON.stringify(harness.vm.snapshot.messages); const check = harness.get('[data-connection-action="check"]');
  check.props.onClick(); check.props.onClick(); await harness.flush(); assert.equal(checks.length, 1); assert.equal(harness.get('[data-connection-action="check"]').props.disabled, true);
  harness.update((state) => { state.connection.state = 'reachable'; }); finish({ state: 'reachable' }); await harness.flush();
  harness.get('[data-connection-action="continue"]').props.onClick(); await harness.flush();
  assert.deepEqual(checks, [{ conversationId: 'chat-a', requestId: 'request-a', workspacePath: 'E:/workspace-a' }]); assert.deepEqual(resumes, checks);
  assert.equal(harness.vm.draft, 'Preserved draft'); assert.equal(stream.scrollTop, 110); assert.equal(JSON.stringify(harness.vm.snapshot.messages), original); assert.equal(harness.sends.length, 0);
});

/** 同会话新请求及会话切换后，旧按钮和迟到错误均失效。 / Old buttons and late failures expire after a new request or conversation switch. */
test('connection actions reject stale request callbacks and late errors without affecting new drafts', async (t) => {
  let rejectCheck; const checks = []; const resumes = [];
  const harness = await mountApp({ snapshot: connectionAppSnapshot(), bridge: {
    /** 控制旧请求异常回传。 / Control a late failure from the old request. */
    checkConversationConnection: (reference) => { checks.push(reference); return new Promise((resolve, reject) => { rejectCheck = reject; }); },
    /** 记录是否误触恢复。 / Record any incorrectly triggered recovery. */
    resumeConversationRecovery: async (reference) => { resumes.push(reference); return true; },
  } }); t.after(harness.cleanup);
  const oldCheck = harness.get('[data-connection-action="check"]'); const oldContinue = harness.get('[data-connection-action="continue"]');
  oldCheck.props.onClick(); await harness.flush();
  harness.update((state) => { state.connection.requestId = 'request-b'; state.recovery.requestId = 'request-b'; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  oldContinue.props.onClick(); assert.equal(resumes.length, 0);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'New request draft' } });
  rejectCheck(new Error('Authorization: Bearer secret-value')); await harness.flush();
  assert.equal(harness.get('.oxc-connection-notice__error'), undefined); assert.equal(harness.vm.draft, 'New request draft'); assert.equal(checks.length, 1);
  harness.update((state) => { state.conversationId = 'chat-b'; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.equal(harness.get('.oxc-connection-notice'), undefined);
});

/** 用户上滚后流式刷新保留原位置，主动返回最新恢复跟随。 / Streaming preserves manual reading position and resumes after explicit return. */
test('actual App preserves history scrolling during streamed output and resumes explicitly', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const stream = harness.get('.oxc-stream');
  stream.scrollTop = 100;
  stream.props.onScrollPassive();
  harness.update((state) => { state.isSending = true; state.messages[1].html += '<p>More streamed content</p>'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(stream.scrollTop, 100);
  assert.equal(harness.vm.readingHistory, true);
  assert.equal(harness.vm.hasUnreadOutput, true);
  harness.get('.oxc-return-latest').props.onClick();
  await harness.flush();
  assert.equal(harness.vm.readingHistory, false);
  assert.equal(harness.vm.hasUnreadOutput, false);
  assert.ok(stream.scrollTop >= 1000);
});

/** 上滚可发生在快照与下一帧之间。 / A user scroll can occur between a snapshot and the next frame. */
test('manual scroll wins over a follow request already queued by snapshot refresh', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const stream = harness.get('.oxc-stream');
  harness.update((state) => { state.isSending = true; state.messages[1].html += '<p>Stream update</p>'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  stream.scrollTop = 120;
  stream.props.onScrollPassive();
  await harness.flush();
  assert.equal(stream.scrollTop, 120, 'queued nextTick follow must respect later user scroll intent');
  assert.equal(harness.vm.readingHistory, true);
});

/** 真实发言控件可定位，切换会话清除详情并保存各自草稿。 / Actual turn controls navigate, and conversation switches isolate drafts and details. */
test('message navigation and conversation scope switching retain isolated drafts', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const textarea = harness.get('.oxc-input-card__textarea');
  textarea.props.onInput({ target: { value: 'Draft for A' } });
  harness.vm.openMessageInspector('a1', { kind: 'identity' });
  await harness.flush();
  assert.ok(harness.get('.oxc-inspector'));
  const stream = harness.get('.oxc-stream');
  const target = findNodes(harness.root, (node) => node.dataset.messageId === 'u1')[0];
  target.rectTop = 50; stream.rectTop = 10; stream.scrollTop = 100;
  const tick = findNodes(harness.root, (node) => node.props['data-turn-id'] === 'u1')[0];
  tick.props.onClick();
  assert.equal(stream.scrollTop, 116);
  assert.equal(harness.vm.activeMessageId, 'u1');
  harness.update((state) => { state.conversationId = 'chat-b'; state.title = 'Conversation B'; state.messages = [{ id: 'b1', role: 'user', text: 'B' }]; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.vm.draft, '');
  assert.equal(harness.vm.inspectorSelection, null);
  assert.equal(harness.get('.oxc-inspector'), undefined);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Draft for B' } });
  harness.update((state) => { state.conversationId = 'chat-a'; state.messages = baseSnapshot().messages; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.vm.draft, 'Draft for A');
  harness.update((state) => { state.settings.workspace.path = 'E:/workspace-b'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.vm.draft, '');
});

/** 失败保留原草稿并显示可读错误。 / Rejection restores the original draft with a readable error. */
test('actual send rejection restores the draft and attachment-only messages can submit', async (t) => {
  const harness = await mountApp({ sendMessage: async () => false }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Keep this draft' } });
  await harness.vm.handleSend();
  await harness.flush();
  assert.deepEqual(harness.sends, ['Keep this draft']);
  assert.equal(harness.vm.draft, 'Keep this draft');
  assert.ok(harness.get('.oxc-composer-error'));
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: '' } });
  harness.update((state) => { state.attachments = [{ id: 'photo', kind: 'image', name: 'Photo.png', path: 'source/photo.png' }]; });
  harness.vm.refreshSnapshot();
  await harness.flush();
  assert.equal(harness.get('.oxc-send-btn').props.disabled, false);
  await harness.vm.handleSend();
  await harness.flush();
  assert.deepEqual(harness.sends, ['Keep this draft', '']);
  assert.equal(harness.state().attachments.length, 1);
});

/** 输入法确认与换行不触发提交，普通 Enter 仍发送。 / IME confirmation and newlines do not submit, while ordinary Enter sends. */
test('actual textarea protects IME composition and Shift Enter', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const textarea = harness.get('.oxc-input-card__textarea');
  textarea.props.onInput({ target: { value: '中文输入' } });
  let prevented = 0;
  const event = { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13, preventDefault: () => { prevented += 1; } };
  textarea.props.onKeydown({ ...event, isComposing: true });
  textarea.props.onKeydown({ ...event, keyCode: 229 });
  textarea.props.onKeydown({ ...event, shiftKey: true });
  assert.equal(harness.sends.length, 0);
  assert.equal(prevented, 0);
  textarea.props.onKeydown(event);
  await harness.flush();
  assert.deepEqual(harness.sends, ['中文输入']);
  assert.equal(prevented, 1);
});

/** 异步失败不污染后来打开的会话。 / Asynchronous failure cannot overwrite a later conversation's draft. */
test('late send failure restores only the submitting conversation draft', async (t) => {
  let rejectSend;
  const deferred = new Promise((resolve, reject) => { rejectSend = reject; });
  const harness = await mountApp({ sendMessage: () => deferred }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'A pending message' } });
  const pending = harness.vm.handleSend();
  harness.update((state) => { state.conversationId = 'chat-b'; });
  harness.vm.refreshSnapshot();
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'B untouched draft' } });
  rejectSend(new Error('Submission rejected'));
  await pending;
  await harness.flush();
  assert.equal(harness.vm.draft, 'B untouched draft');
  assert.equal(harness.vm.composerError, '');
  harness.update((state) => { state.conversationId = 'chat-a'; });
  harness.vm.refreshSnapshot();
  await harness.flush();
  assert.equal(harness.vm.draft, 'A pending message');
});

/** 已打开的详情随相同消息的真实回执更新。 / Open details follow actual receipt updates for the same message. */
test('open inspector updates identity and actual memory receipts without changing the selection', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  harness.vm.openMessageInspector('a1', { kind: 'memory' });
  await harness.flush();
  harness.update((state) => { state.messages[1].identity.name = 'Saved identity'; state.messages[1].memoryContext = [{ id: 'receipt', source: 'synapxnet-memory-v3', status: 'injected', count: 1, characters: 40 }]; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.vm.inspectorMessage.identity.name, 'Saved identity');
  assert.equal(harness.vm.inspectorMessage.memoryContext[0].status, 'injected');
  assert.equal(harness.vm.inspectorSelection.kind, 'memory');
  assert.ok(harness.get('.oxc-inspector__receipts'));
});

/** 弹层数据变化不能被增量签名漏掉。 / Incremental signatures cannot omit changed popover data. */
test('open role popover reflects changed role metadata on passive refresh', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  harness.get('.oxc-role-trigger').props.onClick({ stopPropagation() {} });
  await harness.flush();
  assert.equal(harness.vm.showRoleCardPopover, true);
  harness.update((state) => { state.settings.roleCards[0].name = 'Renamed role'; state.settings.roleCards[0].desc = 'Updated description'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.vm.snapshot.settings.roleCards[0].name, 'Renamed role');
  assert.ok(findNodes(harness.root, (node) => node.text === 'Updated description').length);
});

/** 相关弹层互斥，避免记忆和角色控件层叠。 / Related popovers are exclusive to avoid overlapping memory and role controls. */
test('opening role controls closes the previously opened memory popover', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  harness.get('.oxc-memory-trigger').props.onClick();
  await harness.flush();
  assert.equal(harness.vm.showMemoryPopover, true);
  harness.get('.oxc-role-trigger').props.onClick({ stopPropagation() {} });
  await harness.flush();
  assert.equal(harness.vm.showRoleCardPopover, true);
  assert.equal(harness.vm.showMemoryPopover, false);
  assert.equal(harness.get('.oxc-memory-controls'), undefined);
});

/** 阅读助手回复时仍标记该轮用户发言。 / Keep the owning user turn marked while reading its assistant reply. */
test('reading an assistant reply keeps its owning user-turn marker active', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const stream = harness.get('.oxc-stream');
  const messages = findNodes(harness.root, (node) => node.props['data-message-id']);
  messages[0].rectTop = -200;
  messages[1].rectTop = 10;
  messages[2].rectTop = 300;
  stream.rectTop = 0;
  stream.scrollTop = 150;
  stream.props.onScrollPassive();
  await harness.flush();
  const activeTicks = findNodes(harness.root, (node) => node.props['data-turn-id'] && node.props['aria-current'] === 'location');
  assert.deepEqual(activeTicks.map((node) => node.props['data-turn-id']), ['u1']);
});

/** 定位末尾消息后的浏览器反馈不能用阅读阈值抹掉用户选择。 / Browser feedback after locating the final turn cannot erase the user's selection with a reading threshold. */
test('locating a final turn survives the browser clamped-scroll feedback', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const stream = constrainLastTurnViewport(harness);
  const tick = findNodes(harness.root, /** 点击真实导航目标。 / Click the actual navigation target. */ node => node.props['data-turn-id'] === 'u2')[0];
  tick.props.onClick();
  assert.equal(stream.scrollTop, 280, 'the browser clamps the requested position to its actual scroll range');
  assert.equal(harness.vm.activeMessageId, 'u2');
  stream.props.onScrollPassive();
  await harness.flush();
  assert.equal(harness.vm.activeMessageId, 'u2', 'programmatic scroll feedback must retain the explicitly selected final turn');
  const activeTicks = findNodes(harness.root, /** 读取渲染后的活动刻度。 / Read the rendered active turn marker. */ node => node.props['data-turn-id'] && node.props['aria-current'] === 'location');
  assert.deepEqual(activeTicks.map(/** 只比较稳定发言 ID。 / Compare stable turn IDs only. */ node => node.props['data-turn-id']), ['u2']);
});

/** 明确定位高亮随目标保留，普通快照和滚动反馈不能让它闪退。 / Keep an explicit target highlight through passive snapshots and scroll feedback. */
test('a clicked message root retains its explicit navigation highlight through passive feedback', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const stream = constrainLastTurnViewport(harness);
  harness.vm.navigateToMessage('u2');
  await harness.flush();
  assert.deepEqual(navigationHighlightedMessages(harness).map(/** 读取高亮消息 ID。 / Read highlighted message IDs. */ node => node.dataset.messageId), ['u2']);
  stream.props.onScrollPassive();
  harness.update(/** 模拟不改变阅读意图的来源刷新。 / Simulate a source refresh that does not change reading intent. */ state => { state.messages[1].identity.name = 'Refreshed assistant'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.deepEqual(navigationHighlightedMessages(harness).map(/** 读取仍然高亮的目标。 / Read the target that remains highlighted. */ node => node.dataset.messageId), ['u2']);
});

for (const intent of [
  { label: 'wheel', handlers: ['onWheelPassive', 'onWheel'], event: { deltaY: -120 } },
  { label: 'keyboard', handlers: ['onKeydown'], event: { key: 'PageUp', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false } },
  { label: 'touch', handlers: ['onTouchstartPassive', 'onTouchmovePassive', 'onTouchstart', 'onTouchmove'], event: { touches: [{ clientX: 80, clientY: 200 }] } },
]) {
  /** 用户明确滚动后解除定位锁定，并按新阅读位置更新刻度。 / Release an explicit navigation target after user scrolling and track the new reading position. */
  test(`explicit ${intent.label} scrolling releases the selected turn and follows actual reading position`, async (t) => {
    const harness = await mountApp(); t.after(harness.cleanup);
    const stream = constrainLastTurnViewport(harness);
    harness.vm.navigateToMessage('u2');
    await harness.flush();
    assert.equal(navigationHighlightedMessages(harness).length, 1);
    const handler = intent.handlers.map(/** 查找实际渲染的用户输入事件。 / Find the actual rendered user-input handler. */ name => stream.props[name]).find(/** 忽略未绑定的事件变体。 / Ignore unbound event variants. */ callback => typeof callback === 'function');
    assert.equal(typeof handler, 'function', `the stream must expose a real ${intent.label} scrolling-intent handler`);
    handler({ ...intent.event, target: stream, currentTarget: stream });
    stream.scrollTop = 100;
    stream.props.onScrollPassive();
    await harness.flush();
    assert.equal(harness.vm.activeMessageId, 'u1');
    assert.equal(harness.vm.readingHistory, true);
    assert.equal(navigationHighlightedMessages(harness).length, 0, 'manual reading no longer carries a stale explicit target');
  });
}

/** 回到最新、会话切换和工作区切换都清理旧范围目标。 / Returning to latest, switching conversations and switching workspaces clear old explicit targets. */
test('return latest and scope switches clear explicit targets even when message IDs repeat', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  constrainLastTurnViewport(harness);
  harness.vm.navigateToMessage('u2');
  await harness.flush();
  assert.equal(navigationHighlightedMessages(harness).length, 1);
  harness.vm.returnToLatest();
  await harness.flush();
  assert.equal(harness.vm.readingHistory, false);
  assert.equal(navigationHighlightedMessages(harness).length, 0);
  harness.vm.navigateToMessage('u1');
  await harness.flush();
  assert.equal(navigationHighlightedMessages(harness).length, 1);
  harness.update(/** 新会话故意复用 ID，防止仅按 ID 遗留高亮。 / Reuse IDs in a new conversation to detect stale highlighting by ID alone. */ state => { state.conversationId = 'chat-b'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(navigationHighlightedMessages(harness).length, 0);
  harness.vm.navigateToMessage('u2');
  await harness.flush();
  assert.equal(navigationHighlightedMessages(harness).length, 1);
  harness.update(/** 工作区也属于独立会话范围。 / A workspace change also defines a new conversation scope. */ state => { state.settings.workspace.path = 'E:/workspace-b'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(navigationHighlightedMessages(harness).length, 0);
});

/** 两帧滚动之间的上滚或定位仍拥有最终决定权。 / Manual scrolling or navigation wins between two scheduled follow frames. */
test('manual scrolling and message navigation cancel a later follow frame', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  const stream = harness.get('.oxc-stream');
  harness.update((state) => { state.isSending = true; state.messages[1].html += '<p>Next stream chunk</p>'; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.advanceFrame();
  assert.ok(stream.scrollTop >= 1000);
  stream.scrollTop = 180;
  stream.props.onScrollPassive();
  await harness.flush();
  assert.equal(stream.scrollTop, 180);
  harness.vm.returnToLatest();
  const target = findNodes(harness.root, (node) => node.dataset.messageId === 'u1')[0];
  target.rectTop = 60; stream.rectTop = 10;
  harness.vm.navigateToMessage('u1');
  const chosenOffset = stream.scrollTop;
  await harness.flush();
  assert.equal(stream.scrollTop, chosenOffset);
  assert.equal(harness.vm.activeMessageId, 'u1');
  assert.equal(harness.vm.readingHistory, true);
});

/** 弹层与详情按双向切换保持互斥，隐藏设置不保留可聚焦控件。 / Bidirectional popover and inspector switching stays exclusive, with hidden settings removed from focus navigation. */
test('memory, context, inspector and settings controls remain mutually exclusive', async (t) => {
  const harness = await mountApp(); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: '上下文弹层打开前的草稿' } });
  const event = { stopPropagation() {} };
  assert.equal(harness.get('.oxc-settings-panel'), undefined);
  harness.get('.oxc-role-trigger').props.onClick(event);
  harness.get('.oxc-memory-trigger').props.onClick(event);
  await harness.flush();
  assert.equal(harness.vm.showRoleCardPopover, false);
  assert.equal(harness.vm.showMemoryPopover, true);
  harness.get('.oxc-context-ring').props.onClick(event);
  await harness.flush();
  assert.equal(harness.vm.showMemoryPopover, false);
  assert.equal(harness.vm.showContextPopover, true);
  harness.vm.openMessageInspector('a1', { kind: 'identity' });
  await harness.flush();
  assert.equal(harness.vm.showContextPopover, false);
  assert.ok(harness.get('.oxc-inspector'));
  const settingsButton = findNodes(harness.root, (node) => node.type === 'button' && node.props.title === '对话设置')[0];
  settingsButton.props.onClick();
  await harness.flush();
  assert.equal(harness.get('.oxc-inspector'), undefined);
  assert.ok(harness.get('.oxc-settings-panel'));
  harness.get('.oxc-settings-panel__close').props.onClick();
  await harness.flush();
  assert.equal(harness.get('.oxc-settings-panel'), undefined);
  assert.equal(harness.vm.draft, '上下文弹层打开前的草稿');
  assert.deepEqual(harness.sends, []);
});

/** 创建包含真实形状权限选项的无工作区会话。 / Create a conversation without a workspace using the real permission option shape. */
function permissionSnapshot() {
  const state = baseSnapshot();
  state.settings.workspace = { loaded: false, path: '', name: '', projects: [], git: {} };
  state.settings.permission = { current: 'default', engine: 'local', available: true, pending: false, scopeHint: '保存不会自动开启代码智能。', options: [
    { id: 'default', label: '默认只读模式', icon: 'fa-solid fa-shield-halved' },
    { id: 'plan', label: '计划模式', icon: 'fa-solid fa-clipboard-list' },
    { id: 'yolo', label: '最高权限模式', icon: 'fa-solid fa-bolt' },
  ] };
  return state;
}

/** 无工作区也必须展示当前权限，打开菜单不改变权限或草稿。 / The current permission remains visible without a workspace; opening its menu changes neither mode nor draft. */
test('permission mode stays visible without a workspace and opening it performs no writes', async (t) => {
  const writes = [];
  const harness = await mountApp({ snapshot: permissionSnapshot(), bridge: { setPermissionMode: async (mode) => { writes.push(mode); return true; } } }); t.after(harness.cleanup);
  const trigger = harness.get('.oxc-chip--permission');
  assert.ok(trigger);
  assert.match(trigger.props['aria-label'], /默认只读模式/);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: '保留权限菜单前的草稿' } });
  harness.get('.oxc-memory-trigger').props.onClick({ stopPropagation() {} });
  trigger.props.onClick({ stopPropagation() {} });
  await harness.flush();
  assert.equal(trigger.props['aria-expanded'], true);
  assert.equal(harness.vm.showMemoryPopover, false);
  assert.ok(harness.get('[data-permission-mode="plan"]'));
  assert.equal(harness.get('[data-permission-mode="default"]').props['aria-pressed'], true);
  assert.equal(harness.vm.draft, '保留权限菜单前的草稿');
  assert.deepEqual(writes, []);
  assert.deepEqual(harness.sends, []);
});

/** 保存期间保留已确认模式并阻止重复操作，成功后才显示新值。 / Saving retains the confirmed mode and blocks duplicate actions until success reveals the new value. */
test('permission selection awaits a true result while retaining the draft and confirmed label', async (t) => {
  const state = permissionSnapshot();
  const writes = [];
  let resolveSave;
  const harness = await mountApp({ snapshot: state, bridge: {
    /** 模拟宿主先修改镜像，再异步确认持久化。 / Simulate a host changing its mirror before asynchronously confirming persistence. */
    setPermissionMode(mode) { writes.push(mode); state.settings.permission.current = mode; return new Promise((resolve) => { resolveSave = resolve; }); },
  } }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: '保存期间不要发送' } });
  const pending = harness.get('[data-permission-mode="yolo"]').props.onClick({ stopPropagation() {} });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /默认只读模式/);
  assert.equal(harness.get('.oxc-chip--permission').props['aria-busy'], true);
  assert.equal(harness.get('[data-permission-mode="plan"]').props.disabled, true);
  assert.equal(harness.get('.oxc-send-btn').props.disabled, true);
  await harness.get('[data-permission-mode="plan"]').props.onClick({ stopPropagation() {} });
  await harness.vm.handleSend();
  assert.equal(harness.vm.draft, '保存期间不要发送');
  assert.deepEqual(harness.sends, []);
  assert.deepEqual(writes, ['yolo']);
  resolveSave(true);
  await pending;
  await harness.flush();
  assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /最高权限模式/);
  assert.equal(harness.get('.oxc-chip--permission').props['aria-busy'], false);
  assert.equal(harness.get('[data-permission-mode="yolo"]').props['aria-pressed'], true);
  await harness.get('[data-permission-mode="yolo"]').props.onClick({ stopPropagation() {} });
  assert.deepEqual(writes, ['yolo']);
  assert.equal(harness.vm.draft, '保存期间不要发送');
});

/** false 和拒绝均保留原模式、附件、草稿并提供可见错误。 / False or rejected saves preserve the mode, attachments and draft with a visible error. */
test('permission save failures preserve composer content and never display a successful switch', async (t) => {
  for (const failure of [false, 'throw']) {
    const state = permissionSnapshot();
    state.attachments = [{ kind: 'file', index: 0, name: 'keep.txt' }];
    const harness = await mountApp({ snapshot: state, bridge: { setPermissionMode: async () => { if (failure === 'throw') throw new Error('权限保存暂不可用'); return false; } } });
    try {
      harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: '失败后保留内容' } });
      await harness.get('[data-permission-mode="plan"]').props.onClick({ stopPropagation() {} });
      await harness.flush();
      assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /默认只读模式/);
      assert.ok(harness.get('.oxc-permission-error'));
      assert.equal(harness.get('.oxc-permission-error').props.role, 'alert');
      assert.equal(harness.vm.draft, '失败后保留内容');
      assert.equal(harness.vm.snapshot.attachments[0].name, 'keep.txt');
      assert.equal(harness.get('[data-permission-mode="default"]').props['aria-pressed'], true);
      assert.deepEqual(harness.sends, []);
    } finally { harness.cleanup(); }
  }
});

/** 无保存能力仍显示模式但禁止假切换。 / A host without persistence still shows its mode but cannot fake a switch. */
test('unavailable permission persistence keeps the current-mode selector readable', async (t) => {
  const state = permissionSnapshot();
  state.settings.permission.available = false;
  let writes = 0;
  const harness = await mountApp({ snapshot: state, bridge: { setPermissionMode: async () => { writes += 1; return true; } } }); t.after(harness.cleanup);
  assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /默认只读模式/);
  assert.equal(harness.get('[data-permission-mode="plan"]').props.disabled, true);
  await harness.get('[data-permission-mode="plan"]').props.onClick({ stopPropagation() {} });
  assert.equal(writes, 0);
});

/** 仅引擎选项变化也刷新菜单，迟到保存不得覆盖新范围的标签。 / Engine-option changes refresh the menu and late saves cannot overwrite labels in a new scope. */
test('permission options refresh passively and pending labels stay isolated across engine and conversation changes', async (t) => {
  const state = permissionSnapshot();
  let rejectSave;
  const harness = await mountApp({ snapshot: state, bridge: { setPermissionMode: () => new Promise((resolve, reject) => { rejectSave = reject; }) } }); t.after(harness.cleanup);
  state.settings.permission.options.push({ id: 'cowork', label: 'Cowork 模式' });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.ok(harness.get('[data-permission-mode="cowork"]'));
  const pending = harness.get('[data-permission-mode="yolo"]').props.onClick({ stopPropagation() {} });
  state.conversationId = 'new-conversation';
  state.settings.permission.engine = 'oc';
  state.settings.permission.current = 'plan';
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /计划模式/);
  rejectSave(new Error('old scope failure'));
  await pending;
  await harness.flush();
  assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /计划模式/);
  assert.equal(harness.get('.oxc-permission-error'), undefined);
});

/** 尚未确认的当前模式必须允许重新保存，不能当作无变化跳过。 / An unconfirmed current mode can be saved again instead of being skipped as unchanged. */
test('an unconfirmed current permission mode exposes its state and can be explicitly retried', async (t) => {
  const state = permissionSnapshot();
  state.settings.permission.uncertain = true;
  const writes = [];
  const harness = await mountApp({ snapshot: state, bridge: {
    /** 明确重试确认当前模式。 / Confirm the current mode through an explicit retry. */
    async setPermissionMode(mode) { writes.push(mode); state.settings.permission.uncertain = false; return true; },
  } }); t.after(harness.cleanup);
  assert.ok(harness.get('.oxc-permission-unconfirmed'));
  assert.equal(harness.get('[data-permission-mode="default"]').props.disabled, false);
  await harness.get('[data-permission-mode="default"]').props.onClick({ stopPropagation() {} });
  await harness.flush();
  assert.deepEqual(writes, ['default']);
  assert.equal(harness.get('.oxc-permission-unconfirmed'), undefined);
  assert.match(harness.get('.oxc-chip--permission').props['aria-label'], /默认只读模式/);
});

/** 构造带当前轮次文件回执的真实App输入。 / Build actual App input containing file receipts for the current turn. */
function filePreviewSnapshot() {
  const state = baseSnapshot();
  state.messages.push({ id: 'a2', role: 'assistant', text: 'Files updated', html: '<p>Files updated</p>', attachments: [], activity: { visible: true, signature: 'files', steps: [
    { id: 'edit-one', title: 'Edit one', status: 'done', fileChanges: [{ id: 'file-one', path: 'src/one.py', operation: 'modify', confirmed: true, additions: 2, deletions: 1, contentSource: 'receipt', after: 'print("one")' }] },
    { id: 'edit-two', title: 'Edit two', status: 'done', fileChanges: [{ id: 'file-two', path: 'src/two.py', operation: 'modify', confirmed: true, additions: null, deletions: null, contentSource: 'receipt', diff: '-before\n+after' }] },
  ] } });
  return state;
}

/** 文件事件必须对应本轮原始回执，任意路径不打开预览。 / File events must match original receipts; arbitrary paths cannot open a preview. */
test('actual App validates file inspection events and preserves multiple file tabs', async (t) => {
  const harness = await mountApp({ snapshot: filePreviewSnapshot() }); t.after(harness.cleanup);
  harness.vm.openMessageInspector('a2', { kind: 'file', stepId: 'edit-one', fileId: 'file-one', path: 'C:/private/secret.txt' });
  await harness.flush();
  assert.equal(harness.get('.oxc-file-preview'), undefined);
  harness.vm.openMessageInspector('a2', { kind: 'file', stepId: 'edit-one', fileId: 'file-one', path: 'src/one.py' });
  await harness.flush();
  assert.ok(harness.get('.oxc-file-preview'));
  assert.equal(harness.get('.oxc-inspector'), undefined);
  harness.vm.openMessageInspector('a2', { kind: 'file', stepId: 'edit-two', fileId: 'file-two', path: 'src/two.py' });
  await harness.flush();
  assert.equal(findNodes(harness.root, (node) => matches(node, '.oxc-file-preview__tab')).length, 2);
  const closeButtons = findNodes(harness.root, (node) => matches(node, '.oxc-file-preview__tab-close'));
  closeButtons[1].props.onClick();
  await harness.flush();
  assert.equal(findNodes(harness.root, (node) => matches(node, '.oxc-file-preview__tab')).length, 1);
  assert.equal(harness.vm.inspectorSelection.fileId, 'file-one');
  assert.deepEqual(harness.sends, []);
});

/** 本轮摘要只显示确认文件及完整已知统计，范围切换清空标签。 / Turn summaries show confirmed files and wholly known totals, and scope changes clear tabs. */
test('current-turn file summary hides unknown totals and clears previews on conversation changes', async (t) => {
  const harness = await mountApp({ snapshot: filePreviewSnapshot() }); t.after(harness.cleanup);
  assert.ok(harness.get('.oxc-file-summary'));
  assert.equal(harness.get('.oxc-file-summary__add'), undefined);
  assert.equal(harness.get('.oxc-file-summary__remove'), undefined);
  harness.get('.oxc-file-summary').props.onClick();
  await harness.flush();
  assert.equal(findNodes(harness.root, (node) => matches(node, '.oxc-file-preview__tab')).length, 2);
  harness.update((state) => { state.conversationId = 'another-chat'; state.messages = [{ id: 'new-user', role: 'user', text: 'New conversation' }]; });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.get('.oxc-file-preview'), undefined);
  assert.equal(harness.get('.oxc-file-summary'), undefined);
});

/** 后续用户发言不复用上轮文件摘要，已删除回执不残留正文。 / A later user turn does not reuse the previous file summary, and removed receipts leave no stale content. */
test('new user turns clear the aggregate while removed selected receipts become unavailable', async (t) => {
  const harness = await mountApp({ snapshot: filePreviewSnapshot() }); t.after(harness.cleanup);
  harness.get('.oxc-file-summary').props.onClick();
  await harness.flush();
  harness.update((state) => { state.messages.at(-1).activity.steps = []; state.messages.at(-1).activity.signature = 'removed'; state.messages.push({ id: 'later-user', role: 'user', text: 'Next task' }); });
  harness.vm.refreshSnapshot(false, { passive: true });
  await harness.flush();
  assert.equal(harness.get('.oxc-file-summary'), undefined);
  assert.ok(harness.get('.oxc-file-preview'));
  assert.equal(harness.get('.oxc-file-preview__code'), undefined);
});

/** 任务卡展开详情时保留草稿和阅读位置，状态更新从真实快照取得。 / Opening automation details preserves drafts and reading position; state updates come from actual snapshots. */
test('actual App automation cards retain reading and drafts while lifecycle results update', async (t) => {
  const state = baseSnapshot();
  state.automations = { canManage: true, canOpenCenter: true, tasks: [{ id: 'automation-one', legacyId: 'legacy-one', scope: 'fixture', title: 'Check service status', description: 'Read actual receipts', state: 'active', status: 'pending', runs: [{ id: 'quiet-run', outcome: 'unchanged', notify: false, summary: 'No change', evidence: [] }, { id: 'changed-run', outcome: 'changed', notify: true, summary: 'Actual new evidence', evidence: [] }] }] };
  const harness = await mountApp({ snapshot: state, bridge: { updateConversationAutomation: async () => { state.automations.tasks[0].state = 'paused'; return { success: true }; } } }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Keep my draft' } });
  const stream = harness.get('.oxc-stream'); stream.scrollTop = 100; stream.props.onScrollPassive();
  harness.get('[data-automation-id="automation-one"]').props.onClick(); await harness.flush();
  assert.ok(harness.get('.oxc-automation-panel')); assert.equal(harness.get('.oxc-inspector'), undefined);
  assert.equal(harness.vm.draft, 'Keep my draft'); assert.equal(stream.scrollTop, 100);
  await harness.get('[data-automation-action="pause"]').props.onClick(); await harness.flush();
  assert.ok(harness.get('[data-automation-state="paused"]')); assert.equal(harness.vm.draft, 'Keep my draft'); assert.deepEqual(harness.sends, []);
  harness.vm.openMessageInspector('a1', { kind: 'identity' }); await harness.flush();
  assert.equal(harness.get('.oxc-automation-panel'), undefined); assert.ok(harness.get('.oxc-inspector'));
  harness.get('[data-automation-id="automation-one"]').props.onClick(); await harness.flush();
  harness.update((next) => { next.conversationId = 'other-chat'; next.automations.tasks = []; }); harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  assert.equal(harness.get('.oxc-automation-panel'), undefined); assert.equal(harness.get('.oxc-automation-card'), undefined);
});

/** 恢复入口不自动执行；明确点击保留草稿和阅读位置，等待核对时禁止重复点击。 / Recovery never runs automatically; explicit clicks preserve drafts and reading and prevent duplicate requests while checking. */
test('actual App recovery requires an explicit click and preserves drafts on unresolved results', async (t) => {
  const state = baseSnapshot(); state.recovery = { available: true, pending: false, requestId: 'interrupted-request', error: '', reason: '' };
  const calls = []; let finish;
  const harness = await mountApp({ snapshot: state, bridge: { resumeConversationRecovery: async (reference) => { calls.push(reference); return new Promise((resolve) => { finish = resolve; }); } } }); t.after(harness.cleanup);
  assert.equal(calls.length, 0); assert.ok(harness.get('[data-recovery-action="continue"]'));
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Keep the unsent draft' } });
  const stream = harness.get('.oxc-stream'); stream.scrollTop = 100; stream.props.onScrollPassive();
  const pending = harness.get('[data-recovery-action="continue"]').props.onClick(); await harness.flush();
  assert.equal(harness.get('[data-recovery-action="continue"]').props.disabled, true); assert.equal(calls.length, 1);
  await harness.get('[data-recovery-action="continue"]').props.onClick(); assert.equal(calls.length, 1);
  state.recovery.reason = 'Original task is still running'; finish(false); await pending; await harness.flush();
  assert.equal(harness.vm.draft, 'Keep the unsent draft'); assert.equal(stream.scrollTop, 100); assert.deepEqual(harness.sends, []);
  assert.deepEqual(calls[0], { conversationId: 'chat-a', requestId: 'interrupted-request', workspacePath: 'E:/workspace-a' });
  assert.ok(harness.get('.oxc-recovery-banner'));
});

/** 正常结束没有恢复入口，保存失败只提供重试持久化。 / Completed replies have no recovery action, and save failures offer persistence retry only. */
test('actual App distinguishes unsaved conversations from interrupted generation', async (t) => {
  const state = baseSnapshot(); state.recovery = { available: false, pending: false, error: 'Fixture disk full', reason: '' }; let saves = 0;
  const harness = await mountApp({ snapshot: state, bridge: { retryConversationSave: async () => { saves += 1; state.recovery.error = ''; return true; } } }); t.after(harness.cleanup);
  assert.equal(harness.get('[data-recovery-action="continue"]'), undefined);
  await harness.get('[data-recovery-action="save"]').props.onClick(); await harness.flush();
  assert.equal(saves, 1); assert.equal(harness.get('.oxc-recovery-banner'), undefined); assert.deepEqual(harness.sends, []);
});

/** 提醒开关在保存时保留已确认值，禁用重复操作并维持草稿。 / Alert switches retain confirmed values while saving, prevent repeated actions and preserve drafts. */
test('actual App completion alert settings wait for persistence and preserve drafts', async (t) => {
  const state = baseSnapshot(); Object.assign(state.settings, { completionPreferencesAvailable: true, completionNotificationsEnabled: true, completionNotificationSound: false });
  let finish; const writes = [];
  const harness = await mountApp({ snapshot: state, bridge: { setCompletionPreference: async (field, value) => { writes.push([field, value]); return new Promise((resolve) => { finish = resolve; }); } } }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Keep notification draft' } });
  harness.get('.oxc-settings-toggle').props.onClick(); await harness.flush();
  const toggle = harness.get('[data-completion-preference="completionNotificationsEnabled"]'); const target = { checked: false };
  const saving = toggle.props.onChange({ target }); await harness.flush();
  assert.equal(target.checked, true); assert.equal(toggle.props.checked, true); assert.equal(toggle.props.disabled, true);
  state.settings.completionNotificationsEnabled = false; finish(true); await saving; await harness.flush();
  assert.equal(toggle.props.checked, false); assert.equal(harness.get('[data-completion-preference="completionNotificationSound"]').props.disabled, true);
  assert.deepEqual(writes, [['completionNotificationsEnabled', false]]); assert.equal(harness.vm.draft, 'Keep notification draft'); assert.deepEqual(harness.sends, []);
});

/** 生成中的引导与停止独立，失败后保留原补充和期间新写内容。 / Guidance and stopping are independent during generation; failures preserve both submitted and newly typed text. */
test('actual App sends guidance without stopping and keeps both drafts after a failed submission', async (t) => {
  const state = baseSnapshot(); state.isSending = true; state.guidance = { scope: 'guidance-chat-a', available: true, items: [], error: '', sending: false };
  let finish; let stops = 0;
  const harness = await mountApp({ snapshot: state, sendMessage: () => new Promise((resolve) => { finish = resolve; }), bridge: { stopResponse: () => { stops += 1; return true; } } }); t.after(harness.cleanup);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Please adjust the next step' } }); await harness.flush();
  assert.equal(harness.get('.oxc-send-btn').props['aria-label'], '发送引导'); assert.ok(harness.get('[data-composer-action="stop"]'));
  const submitting = harness.vm.handleSend(); await harness.flush(); assert.equal(harness.get('.oxc-send-btn').props.disabled, true);
  await harness.vm.handleSend(); assert.equal(harness.sends.length, 1); assert.equal(stops, 0);
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Another unsent detail' } });
  state.guidance.error = 'Fixture queue disconnected'; finish(false); await submitting; await harness.flush();
  assert.match(harness.vm.draft, /Please adjust the next step/); assert.match(harness.vm.draft, /Another unsent detail/); assert.match(harness.vm.composerError, /disconnected/);
  const draft = harness.vm.draft; harness.get('[data-composer-action="stop"]').props.onClick(); assert.equal(stops, 1); assert.equal(harness.vm.draft, draft);
});

/** 编辑消费竞态保留编辑器和实际已接收状态，不出现撤回成功。 / An edit-consumption race preserves the editor and actual received state without claiming withdrawal success. */
test('actual guidance queue retains edits when the execution endpoint already consumed the item', async (t) => {
  const state = baseSnapshot(); state.isSending = true; state.guidance = { scope: 'guidance-chat-a', available: true, error: '', items: [{ guidance_id: 'guidance-one', conversation_id: 'chat-a', revision: 1, text: 'Original instruction', state: 'pending' }] };
  const writes = [];
  const harness = await mountApp({ snapshot: state, bridge: { updateGuidance: async (reference, action, text) => { writes.push({ reference, action, text }); state.guidance.items[0].state = 'consumed'; state.guidance.items[0].revision = 2; throw new Error('The instruction was already received'); } } }); t.after(harness.cleanup);
  harness.get('[data-guidance-action="edit"]').props.onClick(); await harness.flush();
  const editor = harness.get('[aria-label="编辑引导内容"]'); editor.props.onInput({ target: { value: 'Edited instruction' } }); await harness.flush();
  await harness.get('[data-guidance-action="save-edit"]').props.onClick(); await harness.flush();
  assert.equal(writes[0].reference.revision, 1); assert.equal(writes[0].text, 'Edited instruction');
  assert.equal(harness.get('[data-guidance-id="guidance-one"]').props['data-guidance-state'], 'consumed');
  assert.equal(harness.get('[data-guidance-action="cancel"]'), undefined); assert.equal(harness.get('[aria-label="编辑引导内容"]').value, 'Edited instruction');
  assert.match(harness.get('.oxc-guidance-queue__error').text, /already received/); assert.equal(harness.sends.length, 0);
});

/** 会话改变后旧操作不能打开旧编辑器或清空新草稿。 / After a conversation change, old actions cannot reopen editors or clear the new draft. */
test('guidance queue discards late action feedback across scopes and restores lost text only into drafts', async (t) => {
  const state = baseSnapshot(); state.guidance = { scope: 'guidance-chat-a', available: true, items: [{ guidance_id: 'guidance-one', revision: 1, text: 'Pending original', state: 'pending' }] };
  let rejectAction;
  const harness = await mountApp({ snapshot: state, bridge: { updateGuidance: () => new Promise((resolve, reject) => { rejectAction = reject; }) } }); t.after(harness.cleanup);
  const action = harness.get('[data-guidance-action="cancel"]').props.onClick(); await harness.flush();
  state.conversationId = 'chat-b'; state.guidance = { scope: 'guidance-chat-b', available: true, items: [{ guidance_id: 'lost-b', text: 'Unreceived text', state: 'lost' }] };
  harness.vm.refreshSnapshot(false, { passive: true }); await harness.flush();
  harness.get('.oxc-input-card__textarea').props.onInput({ target: { value: 'Draft B' } });
  rejectAction(new Error('Old action failed')); await action; await harness.flush(); assert.equal(harness.get('.oxc-guidance-queue__error'), undefined);
  harness.get('[data-guidance-action="restore"]').props.onClick(); await harness.flush();
  assert.equal(harness.vm.draft, 'Draft B\n\nUnreceived text'); assert.equal(harness.sends.length, 0);
});
