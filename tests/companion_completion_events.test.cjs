/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 桌面伴随公开事件与真实页面接点回归 / Companion public events and actual page integration regression.
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
const bridgeSource = fs.readFileSync(path.join(__dirname, '../static/js/openxnet-companion-events.js'), 'utf8');

/** 执行真实专用preload，检查它实际暴露的接口而非替代测试API。 / Execute the actual surface preload to inspect exposed APIs rather than a replacement test API. */
function surfacePreloadHarness(snapshot) {
  const exposed = {}, calls = [], listeners = new Map();
  const ipcRenderer = {
    /** 记录同步皮肤只读请求。 / Record synchronous read-only appearance requests. */
    sendSync(channel) { calls.push({ channel }); return { ok: true, value: 'saved-skin' }; },
    /** 固定通道返回真实契约形状。 / Return contract-shaped results for fixed channels. */
    async invoke(channel, request) { calls.push({ channel, request }); return channel === 'openxnet:completion-notice:snapshot' ? snapshot : true; },
    /** 记录可清理监听。 / Record disposable event listeners. */
    on(channel, listener) { listeners.set(channel, listener); },
    /** 精确移除原监听。 / Remove the original listener exactly. */
    removeListener(channel, listener) { if (listeners.get(channel) === listener) listeners.delete(channel); },
  };
  const context = vm.createContext({ process: { platform: 'win32' },
    /** 仅向真实preload提供Electron桥接环境。 / Supply only the Electron bridge environment to the real preload. */
    require(name) { assert.equal(name, 'electron'); return { ipcRenderer, contextBridge: {
      /** 记录公开窗口对象。 / Record the exposed window objects. */
      exposeInMainWorld(key, value) { exposed[key] = value; },
    } }; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/surface-preload.js'), 'utf8'), context);
  return { exposed, calls, listeners };
}

/** 构造仅用于隔离测试的公开完成结果。 / Construct a public completion result used only by isolated tests. */
function notice(overrides = {}) {
  return { resultId: 'request-one:message-one', source: 'chat', conversationId: 'conversation-one',
    title: '已完成', summary: '公开结果', status: 'completed', occurredAt: '2026-09-14T10:00:00.000Z', ...overrides };
}

/** 使用真实脚本与注入 API，不连接桌面或模型。 / Load the actual script with injected APIs without connecting to desktop or models. */
function harness(options = {}) {
  const context = vm.createContext({ Date, Set, Map, console });
  vm.runInContext(bridgeSource, context);
  let listener = null;
  let unsubscribed = 0;
  const deliveries = [], opens = [], errors = [];
  const api = {
    /** 注入可清理的实时订阅。 / Inject a disposable live subscription. */
    onCompletionNotice(callback) { listener = callback; return () => { unsubscribed += 1; }; },
    /** 返回隔离近期快照。 / Return an isolated recent snapshot. */
    async getCompletionNoticeSnapshot() { return { schema: 'openxnet.completion-notice-snapshot.v1', notices: [] }; },
    /** 记录身份导航，不执行任务。 / Record identity navigation without executing tasks. */
    async openCompletionNotice(value) { opens.push(value); return true; }, ...options.api,
  };
  const bridge = context.OpenXnetCompanionEvents.createBridge({ api, surface: options.surface || 'floating_task_hud',
    /** 收集实际投递形状与静默标记。 / Collect actual delivery shapes and silent flags. */
    onDelivery(message, metadata) { deliveries.push({ message, metadata }); },
    /** 收集预期失败以断言无悬空异常。 / Collect expected failures to assert no unhandled errors. */
    onError(error) { errors.push(error); },
  });
  return { bridge, deliveries, opens, errors, context,
    /** 发送注入的实时事件。 / Send an injected live event. */
    emit(value) { listener(value); },
    /** 读取订阅释放次数。 / Read the unsubscribe count. */
    unsubscribed() { return unsubscribed; },
  };
}

/** 并发快照不得覆盖新结果，也不得重复提示同一结果。 / Concurrent snapshots must neither replace newer results nor alert twice. */
test('snapshot hydration is silent, ordered before live events, and identical results appear once', async () => {
  let resolveSnapshot;
  const pending = new Promise((resolve) => { resolveSnapshot = resolve; });
  const h = harness({ api: { getCompletionNoticeSnapshot: () => pending } });
  const ready = h.bridge.start();
  const fresh = notice({ resultId: 'live-result', occurredAt: '2026-09-14T10:01:00Z' });
  h.emit(fresh);
  resolveSnapshot({ schema: 'openxnet.completion-notice-snapshot.v1', notices: [fresh, notice()] });
  await ready;
  assert.equal(h.deliveries.length, 2);
  assert.equal(h.deliveries[0].metadata.snapshot, true);
  assert.equal(h.deliveries[0].metadata.silent, true);
  assert.equal(h.deliveries[1].message.data.completion_event_id, 'live-result');
  assert.equal(h.deliveries[1].metadata.silent, false);
  h.emit(fresh); await h.bridge.start();
  assert.equal(h.deliveries.length, 2);
});

/** 旧套接字与 Main 按真实身份去重，同时保留导航和再次运行。 / Deduplicate socket and Main by real identity while preserving navigation and later runs. */
test('websocket/Main duplicates retain one display and a navigation alias without hiding later runs', async () => {
  const h = harness(); await h.bridge.start();
  const legacy = { action: 'task_delivery', data: { task_id: 'task-one', status: 'completed', timestamp: '2026-09-14T10:00:00Z', presentation: 'desktop_notification', desktop_control: { action: 'focus' } } };
  assert.equal(h.bridge.acceptOverlay(legacy), true);
  h.emit(notice({ source: 'task', taskId: 'task-one' }));
  assert.equal(h.deliveries.length, 1);
  assert.equal(h.deliveries[0].message.data.desktop_control.action, 'focus');
  assert.equal(await h.bridge.openDelivery(legacy.data), true);
  assert.equal(h.opens[0].resultId, 'request-one:message-one');
  assert.deepEqual(Object.keys(h.opens[0]), ['resultId']);
  assert.equal(h.bridge.acceptOverlay({ ...legacy, channel: 'dynamic_island' }), false);
  h.emit(notice({ source: 'task', taskId: 'task-one', resultId: 'second-run', occurredAt: '2026-09-14T10:02:00Z' }));
  assert.equal(h.deliveries.length, 2);
  assert.equal(h.bridge.acceptOverlay({ action: 'task_delivery', data: { ...legacy.data, timestamp: '2026-09-14T10:02:00Z' } }), false);
});

/** 普通聊天不需要 task_id，并且公开投影不泄露附加字段。 / Ordinary chats need no task ID and public projections cannot expose extra fields. */
test('chat navigation accepts only retained result IDs and strips all nonpublic fields', async () => {
  const h = harness(); await h.bridge.start();
  h.emit(notice({ title: '字'.repeat(140), summary: '文'.repeat(450), apiKey: 'private', toolArgs: { secret: 'private' }, url: 'https://invalid.test', reasoning: 'private' }));
  const delivery = h.deliveries[0].message.data;
  assert.equal(delivery.task_id, ''); assert.equal(delivery.conversation_id, 'conversation-one');
  assert.equal(delivery.title.length, 120); assert.equal(delivery.summary.length, 400);
  assert.equal(JSON.stringify(delivery).includes('private'), false);
  assert.equal(await h.bridge.openDelivery(delivery), true);
  assert.equal(await h.bridge.openDelivery({ completion_event_id: 'forged', conversation_id: 'conversation-one' }), false);
  for (const bad of [notice({ resultId: ' bad' }), notice({ conversationId: 'bad\u0000id' }), notice({ status: 'running' }), notice({ source: 'task' }), notice({ occurredAt: 'today' })]) h.emit(bad);
  assert.equal(h.deliveries.length, 1);
});

/** 关闭后清理事件、按钮和迟到快照。 / Clean up events, buttons, and late snapshots after closing. */
test('button follows selection, stops bubbling, and disposal makes late events inert', async () => {
  const h = harness(); await h.bridge.start();
  let selected = null;
  const button = new EventTarget();
  const binding = h.bridge.bindOpenButton(button, () => selected);
  assert.equal(button.disabled, true); assert.equal(button.hidden, true);
  h.emit(notice()); selected = h.deliveries[0].message.data; binding.refresh();
  assert.equal(button.disabled, false); assert.equal(button.hidden, false);
  button.dispatchEvent(new Event('click')); await Promise.resolve();
  assert.equal(h.opens.length, 1);
  selected = { task_id: 'other' }; binding.refresh(); assert.equal(button.disabled, true);
  h.bridge.dispose(); h.bridge.dispose(); h.emit(notice({ resultId: 'late' }));
  assert.equal(h.unsubscribed(), 1); assert.equal(h.deliveries.length, 1);
  button.dispatchEvent(new Event('click')); assert.equal(h.opens.length, 1);
  let resolveSnapshot;
  const later = harness({ api: { getCompletionNoticeSnapshot: () => new Promise((resolve) => { resolveSnapshot = resolve; }) } });
  const ready = later.bridge.start(); later.bridge.dispose();
  resolveSnapshot({ schema: 'openxnet.completion-notice-snapshot.v1', notices: [notice()] }); await ready;
  assert.equal(later.deliveries.length, 0);
});

/** 快照失败仍消费新结果，不把导航拒绝伪报成功。 / Snapshot failures still drain live results and navigation refusal never reports success. */
test('snapshot failure drains live events, unchanged stays quiet, and navigation failure is honest', async () => {
  const h = harness({ api: { async getCompletionNoticeSnapshot() { throw new Error('fixture unavailable'); }, async openCompletionNotice() { return false; } } });
  const ready = h.bridge.start(); h.emit(notice({ status: 'unchanged' })); await ready;
  assert.equal(h.errors.length, 1); assert.equal(h.deliveries.length, 1);
  assert.equal(h.deliveries[0].metadata.silent, true);
  assert.equal(await h.bridge.openDelivery(h.deliveries[0].message.data), false);
});

/** 提取真实页面函数，注入最小显示环境。 / Extract actual page functions with a minimal injected presentation environment. */
function pageFunctions(name, names, context) {
  const html = fs.readFileSync(path.join(__dirname, '../static', name), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
  const source = scripts.find((script) => script.includes('HOME_CURRENT_FLOW_LAUNCH_STORAGE_KEY'));
  const functions = parse(source, { sourceType: 'script' }).program.body.filter((node) => node.type === 'FunctionDeclaration' && names.includes(node.id.name));
  assert.equal(functions.length, names.length);
  assert.match(source, /companionBridge\.acceptOverlay\(data\)/u);
  assert.match(html, /src="\/js\/openxnet-companion-events\.js"/u);
  for (const node of functions) vm.runInContext(source.slice(node.start, node.end), context);
}

/** 灵动岛真实处理函数不得因快照展开或触发观察请求。 / The actual island handler must not expand or request observations for snapshots. */
test('actual island delivery handler preserves chat identity and keeps snapshot rendering silent', () => {
  let pulses = 0, expands = 0, syncs = 0;
  const context = vm.createContext({ latestDelivery: null, currentDelivery: null, rows: [],
    t: (_key, fallback) => fallback, findHistoryFeedbackMergeTarget: () => null,
    ensureHistoryDeliveryId() {}, renderPrimary() {}, addHistory(value) { context.rows.push(value); },
    pulseHighlight() { pulses += 1; }, setCompact() { expands += 1; }, scheduleAutoCollapse() {},
    syncObservationSnapshotForDelivery() { syncs += 1; },
  });
  pageFunctions('dynamic_island.html', ['handleDelivery'], context);
  const message = { action: 'task_delivery', data: { conversation_id: 'chat-one', completion_event_id: 'result-one', status: 'completed' } };
  context.handleDelivery(message, { snapshot: true, silent: true });
  assert.equal(context.rows[0].conversation_id, 'chat-one'); assert.equal(context.rows[0].completion_event_id, 'result-one');
  assert.equal(pulses + expands + syncs, 0);
  context.handleDelivery(message, { snapshot: false, silent: false });
  assert.equal(pulses, 1); assert.equal(expands, 1); assert.equal(syncs, 1);
});

/** HUD 真实处理函数在快照恢复时保留选择与身份且不闪烁。 / Actual HUD handlers retain selection and identity without pulsing during snapshot restoration. */
test('actual HUD delivery handlers preserve chat navigation and do not pulse restored history', () => {
  let pulses = 0, syncs = 0;
  const context = vm.createContext({ historyItems: [], MAX_HISTORY: 30, followLatest: true, selectedId: '', subtitle: {}, linkedObservationTarget: null,
    txt: (value, fallback = '') => String(value || fallback), idOf: (value) => value.history_delivery_id,
    ensureId(value) { value.history_delivery_id ||= value.completion_event_id; }, syncPin() {},
    pulse() { pulses += 1; }, renderAll() {}, activeDelivery: () => null, getObservationConsoleTarget: () => null,
    syncObservationsForDelivery() { syncs += 1; },
  });
  pageFunctions('floating_task_hud.html', ['onDelivery', 'addDelivery'], context);
  const message = { action: 'task_delivery', data: { conversation_id: 'chat-one', completion_event_id: 'result-one', status: 'completed' } };
  context.onDelivery(message, { snapshot: true, silent: true });
  assert.equal(context.historyItems[0].conversation_id, 'chat-one'); assert.equal(context.historyItems[0].completion_event_id, 'result-one');
  assert.equal(pulses + syncs, 0);
  context.onDelivery(message, { snapshot: false, silent: false });
  assert.equal(pulses, 1); assert.equal(syncs, 1);
});

/** 构造与普通任务分开的企业运行消息。 / Construct an enterprise run message separate from ordinary tasks. */
function runNotice(overrides = {}) {
  return notice({ source: 'enterprise_run', conversationId: undefined, workspaceId: 'workspace-a', incidentId: 'incident-a', traceId: 'trace-a', ...overrides });
}

/** 真正HUD预加载必须接通快照与实时状态，同时不提供发布、皮肤写入或任意IPC。 / The actual HUD preload must connect history and live states without publication, appearance writes or arbitrary IPC. */
test('actual companion preload restores completed runs silently and exposes only bounded read and navigation APIs', async () => {
  const historical = runNotice();
  const surface = surfacePreloadHarness({ schema: 'openxnet.completion-notice-snapshot.v1', notices: [historical] });
  assert.deepEqual(Object.keys(surface.exposed.openxnetDesktop).sort(), ['getCompletionNoticeSnapshot', 'onCompletionNotice', 'openCompletionNotice']);
  assert.deepEqual(Object.keys(surface.exposed.openxnetAppearance).sort(), ['onChanged', 'read']);
  const h = harness({ api: surface.exposed.openxnetDesktop }); await h.bridge.start();
  assert.equal(h.deliveries.length, 1); assert.equal(h.deliveries[0].metadata.snapshot, true); assert.equal(h.deliveries[0].metadata.silent, true);
  assert.equal(h.deliveries[0].message.data.incident_id, 'incident-a');
  const received = surface.listeners.get('openxnet:completion-notice:notice'); assert.equal(typeof received, 'function');
  received({ privateElectronEvent: true }, runNotice({ resultId: 'next-state', status: 'action_required', occurredAt: '2026-09-14T10:00:01.000Z' }));
  assert.equal(h.deliveries.length, 2); assert.equal(h.deliveries[1].metadata.snapshot, false);
  assert.equal(await h.bridge.openDelivery(h.deliveries[1].message), true);
  assert.deepEqual(JSON.parse(JSON.stringify(surface.calls.at(-1))), { channel: 'openxnet:completion-notice:open', request: { resultId: 'next-state' } });
  let changes = 0; const unsubscribe = surface.exposed.openxnetAppearance.onChanged(/** 接收外观变更通知。 / Receive appearance-change notifications. */ () => { changes += 1; });
  surface.listeners.get('openxnet:appearance-preferences:changed')({ privateElectronEvent: true }); assert.equal(changes, 1);
  unsubscribe(); assert.equal(surface.listeners.has('openxnet:appearance-preferences:changed'), false);
  h.bridge.dispose(); assert.equal(surface.listeners.has('openxnet:completion-notice:notice'), false);
});

/** 运行真实皮肤引擎和同步脚本，提供最小可写DOM与只读偏好桥。 / Run the actual skin engine and synchronization script with a minimal DOM and read-only preference bridge. */
function companionThemeHarness(initialNative, legacy = {}) {
  const events = new Map(), documentEvents = new Map(); let native = initialNative; let changed; let unsubscribed = 0;
  /** 保留真实引擎写入的属性和CSS变量。 / Retain attributes and CSS variables written by the actual engine. */
  function element() {
    const attributes = new Map(), styles = new Map();
    return { style: {
      /** 读取现有CSS。 / Read existing CSS. */ getPropertyValue(key) { return styles.get(key) || ''; },
      /** 读取优先级。 / Read CSS priority. */ getPropertyPriority() { return ''; },
      /** 写入受验证变量。 / Write validated variables. */ setProperty(key, value) { styles.set(key, value); },
      /** 移除失败写入。 / Remove failed writes. */ removeProperty(key) { styles.delete(key); },
    },
      /** 读取DOM属性。 / Read DOM attributes. */ getAttribute(key) { return attributes.get(key) ?? null; },
      /** 更新DOM属性。 / Update DOM attributes. */ setAttribute(key, value) { attributes.set(key, value); },
      /** 删除DOM属性。 / Remove DOM attributes. */ removeAttribute(key) { attributes.delete(key); },
    };
  }
  const document = { documentElement: element(), body: null,
    /** 浮窗没有主应用节点。 / Companions have no main app node. */ getElementById() { return null; },
    /** 记录DOM就绪回调。 / Record DOM-ready callbacks. */ addEventListener(name, callback) { documentEvents.set(name, callback); },
  };
  const context = vm.createContext({ document,
    localStorage: { /** 旧存储只读回退。 / Read legacy fallback storage only. */ getItem(key) { return legacy[key] ?? null; } },
    openxnetAppearance: {
      /** 返回Main保存偏好。 / Return Main-owned preferences. */ read() { return native; },
      /** 记录原生主题订阅与清理。 / Record native theme subscriptions and cleanup. */ onChanged(callback) { changed = callback; return function dispose() { unsubscribed += 1; }; },
    },
    /** 记录存储和卸载事件。 / Record storage and unload events. */ addEventListener(name, callback) { events.set(name, callback); },
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/openxnet-skins.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/openxnet-companion-theme.js'), 'utf8'), context);
  return { document, events,
    /** 模拟DOM就绪后真实元素出现。 / Simulate actual elements becoming available at DOM readiness. */ ready() { document.body = element(); documentEvents.get('DOMContentLoaded')(); },
    /** 模拟Main成功保存后的重新读取。 / Simulate rereading after a successful Main save. */ change(value) { native = value; changed(); },
    /** 读取订阅释放结果。 / Read subscription cleanup results. */ unsubscribed() { return unsubscribed; },
  };
}

/** 主窗原生深色优先于旧浅色缓存，更新与重开均保持同一库且不写入偏好。 / Native dark preferences override stale light storage, with live updates and reopen using the same read-only library. */
test('companion theme initializes from native preferences and follows saved skins after DOM readiness', () => {
  const dark = JSON.stringify({ version: 1, selectedId: 'brand-dark', customSkins: [] });
  const light = JSON.stringify({ version: 1, selectedId: 'brand-light', customSkins: [] });
  const h = companionThemeHarness({ ok: true, value: dark }, { 'openxnet.skins.v1': light, 'openxnet-theme': 'light' });
  assert.equal(h.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(h.document.documentElement.style.getPropertyValue('--ox-bg-surface'), '#152536');
  h.ready(); assert.equal(h.document.body.getAttribute('data-skin-mode'), 'dark');
  h.change({ ok: true, value: light }); assert.equal(h.document.documentElement.getAttribute('data-theme'), 'light'); assert.equal(h.document.body.getAttribute('data-skin-mode'), 'light');
  h.change({ ok: false, error: 'unavailable' }); assert.equal(h.document.documentElement.getAttribute('data-theme'), 'light');
  h.events.get('pagehide')(); assert.equal(h.unsubscribed(), 1);
  const legacy = companionThemeHarness({ ok: true, value: null }, { 'openxnet-theme': 'rainbow' }); assert.equal(legacy.document.documentElement.getAttribute('data-theme'), 'dark');
});

/** 直接运行Main真实窗口状态函数，旧悬停标记不能让折叠入口穿透。 / Execute actual Main surface functions so stale hover flags cannot make the compact control click-through. */
test('native island remains clickable when compact expanded and reopened without waiting for hover', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const nodes = parse(source, { sourceType: 'script', allowReturnOutsideFunction: true }).program.body;
  const ignores = []; let shows = 0;
  const context = vm.createContext({ tray: null,
    /** 只记录当前岛窗鼠标与显示操作。 / Record only the current island's mouse and visibility operations. */
    dynamicIslandWindow: { isDestroyed() { return false; }, isVisible() { return false; }, setAlwaysOnTop() {}, setIgnoreMouseEvents(...args) { ignores.push(args); }, showInactive() { shows += 1; } },
    /** 尺寸定位与鼠标状态分别检查。 / Isolate positioning from mouse-state checks. */
    positionDynamicIslandWindow() {},
  });
  for (const name of ['DYNAMIC_ISLAND_SURFACE_LIMITS', 'DYNAMIC_ISLAND_SURFACE_DEFAULT', 'dynamicIslandSurfaceState']) {
    const declaration = nodes.find(/** 提取实际窗口状态声明。 / Extract actual surface-state declarations. */ node => node.type === 'VariableDeclaration' && node.declarations.some(/** 按稳定变量名匹配。 / Match the stable variable name. */ item => item.id.name === name));
    assert.ok(declaration); vm.runInContext(source.slice(declaration.start, declaration.end), context);
  }
  for (const name of ['clampDynamicIslandMetric', 'normalizeDynamicIslandSurfaceState', 'applyDynamicIslandSurfaceState', 'ensureDynamicIslandWindow']) {
    const declaration = nodes.find(/** 提取实际函数实现。 / Extract actual function implementations. */ node => node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(declaration); vm.runInContext(source.slice(declaration.start, declaration.end), context);
  }
  assert.equal(vm.runInContext('DYNAMIC_ISLAND_SURFACE_DEFAULT.interactive', context), true);
  for (const compact of [true, false, true]) {
    const state = context.applyDynamicIslandSurfaceState({ compact, interactive: false, width: 9000, height: 9000 });
    assert.equal(state.interactive, true); assert.equal(state.compact, compact); assert.equal(state.width, 500); assert.equal(state.height, 448);
    assert.deepEqual(ignores.at(-1), [false, undefined]);
  }
  await context.ensureDynamicIslandWindow(); assert.equal(shows, 1); assert.deepEqual(ignores.at(-1), [false, undefined]);
});

/** 页面尺寸同步不能因鼠标未进入或旧折叠事件关闭原生点击。 / Renderer sizing must not disable native clicks because of absent hover or an old collapse event. */
test('actual island sizing always reports an interactive compact or expanded control', () => {
  const sent = []; let compact = true;
  const context = vm.createContext({ lastSurfaceStateKey: '',
    shell: { classList: { /** 提供实际折叠状态。 / Supply the current compact state. */ contains() { return compact; } }, /** 使用紧贴可见卡片的尺寸。 / Use dimensions bounded to the visible card. */ getBoundingClientRect() { return { width: compact ? 180 : 468, height: compact ? 50 : 300 }; } },
    islandBody: { scrollHeight: 200, clientHeight: 200 },
    surfacePresetSize: { compactWidth: 188, compactHeight: 58, expandedWidth: 468, expandedMaxHeight: 448, expandedMinHeight: 220, bottomSafeInset: 12, expandedChromeHeight: 80 },
    dynamicIslandHost: { /** 记录真实页面发给Main的状态。 / Record actual page states sent to Main. */ async setDynamicIslandSurfaceState(state) { sent.push(state); } },
    window: { /** 立即运行一次测量帧。 / Run one measurement frame immediately. */ requestAnimationFrame(callback) { callback(); }, /** 读取无额外外边距的卡片。 / Read a card without extra margins. */ getComputedStyle() { return { marginTop: '0', marginBottom: '0' }; } },
  });
  pageFunctions('dynamic_island.html', ['syncSurfaceState'], context);
  context.syncSurfaceState({ interactive: false }); assert.equal(sent.at(-1).interactive, true); assert.equal(sent.at(-1).height, 58);
  compact = false; context.syncSurfaceState({ interactive: false }); assert.equal(sent.at(-1).interactive, true); assert.equal(sent.at(-1).height, 300);
  compact = true; context.syncSurfaceState(); assert.equal(sent.at(-1).interactive, true); assert.equal(sent.at(-1).compact, true);
  const css = fs.readFileSync(path.join(__dirname, '../static/css/openxnet-desktop-companions.css'), 'utf8');
  assert.match(css, /body\[data-companion="island"\] \.shell\.compact > \.body\s*\{[^}]*display:\s*none;[^}]*padding:\s*0;[^}]*margin:\s*0;/);
  assert.doesNotMatch(css, /body\[data-companion="island"\] \.body\s*\{[^}]*display:\s*none/);
});

/** 跨空间和运行记录不能被结果标识别名串联。 / Cross-workspace and cross-run records must never be joined by result aliases. */
test('enterprise notices preserve independent scopes and reject mixed or forged navigation identities', async () => {
  const h = harness(); await h.bridge.start();
  h.emit(runNotice({ status: 'running' }));
  h.emit(runNotice({ resultId: 'run-b', workspaceId: 'workspace-b', incidentId: 'incident-b', traceId: 'trace-b', status: 'running' }));
  assert.equal(h.deliveries.length, 2);
  const value = h.deliveries[0].message.data;
  assert.equal(h.deliveries[0].metadata.silent, true);
  assert.equal(value.source, 'enterprise_run'); assert.equal(value.workspace_id, 'workspace-a'); assert.equal(value.trace_id, 'trace-a');
  assert.equal(await h.bridge.openDelivery(value), true);
  assert.deepEqual(Object.keys(h.opens[0]), ['resultId']);
  for (const patch of [{ trace_id: 'trace-b' }, { incident_id: 'incident-b' }, { workspace_id: 'workspace-b' }, { source: 'task' }, { task_id: 'task-a' }, { source: undefined }]) {
    assert.equal(await h.bridge.openDelivery({ ...value, ...patch }), false);
  }
  for (const patch of [{ workspaceId: undefined }, { traceId: undefined }, { incidentId: undefined }, { conversationId: 'chat-a' }, { taskId: 'task-a' }, { source: 'task', taskId: 'task-a' }, { source: 'wrong' }]) {
    h.emit(runNotice({ resultId: 'invalid-' + h.deliveries.length, ...patch }));
  }
  assert.equal(h.deliveries.length, 2); assert.equal(h.opens.length, 1);
  assert.equal(h.bridge.acceptOverlay({ action: 'task_delivery', data: { ...value, completion_event_id: 'socket-forgery' } }), false);
});

/** 两浮窗真实处理函数必须保留完整企业范围，不能丢失到普通任务。 / Both actual companion handlers must preserve enterprise scope without turning it into a task. */
test('actual companion handlers retain workspace incident and trace identities for run navigation', () => {
  const data = { source: 'enterprise_run', workspace_id: 'workspace-a', incident_id: 'incident-a', trace_id: 'trace-a', completion_event_id: 'enterprise-result', status: 'action_required' };
  const island = vm.createContext({ latestDelivery: null, currentDelivery: null, rows: [],
    /** 隔离本地化。 / Isolate localization. */ t: (_key, fallback) => fallback,
    /** 无桌面反馈合并。 / No desktop feedback merging. */ findHistoryFeedbackMergeTarget: () => null,
    /** 隔离历史身份分配。 / Isolate history identity assignment. */ ensureHistoryDeliveryId() {},
    /** 隔离主显示。 / Isolate primary rendering. */ renderPrimary() {},
    /** 保留真实结果投影。 / Retain the actual result projection. */ addHistory(value) { island.rows.push(value); },
  });
  pageFunctions('dynamic_island.html', ['handleDelivery'], island);
  island.handleDelivery({ data }, { snapshot: true, silent: true });
  const hud = vm.createContext({ rows: [],
    /** 保留精确字段文本。 / Retain exact field text. */ txt: (value, fallback = '') => String(value || fallback),
    /** 保留真实投递。 / Retain the actual delivery. */ addDelivery(value) { hud.rows.push(value); },
  });
  pageFunctions('floating_task_hud.html', ['onDelivery'], hud);
  hud.onDelivery({ data }, { snapshot: true, silent: true });
  for (const row of [island.rows[0], hud.rows[0]]) {
    for (const key of ['source', 'workspace_id', 'incident_id', 'trace_id', 'completion_event_id']) assert.equal(row[key], data[key]);
    assert.equal(row.task_id, ''); assert.equal(row.conversation_id, '');
  }
});

/** 企业运行展示应提供正式详情入口，不报缺少普通任务ID。 / Enterprise presentation should point to formal details without reporting missing task IDs. */
test('actual companion observation views separate enterprise summaries from ordinary task controls', () => {
  for (const name of ['floating_task_hud.html', 'dynamic_island.html']) {
    const elements = Object.fromEntries(['openHomeFlow', 'openTaskDetail', 'openRecallCenter', 'refreshObservations', 'observationStatus', 'observationSummary', 'observationMeta', 'observationBadges', 'observationMetrics', 'observationList'].map(/** 创建独立节点替身。 / Create isolated node doubles. */ key => [key, { innerHTML: 'old task content', textContent: '', disabled: false }]));
    const context = vm.createContext({ ...elements,
      /** 按ID取隔离元素。 / Resolve isolated elements by ID. */ $: id => elements[id],
      /** 隔离状态文案。 / Isolate status text. */ readStatus: () => '待人工决定',
      /** 保留摘要。 / Retain summaries. */ txt: value => String(value || ''),
      /** 保留本地化回退。 / Retain localization fallbacks. */ t: (_key, fallback) => fallback,
      /** 隔离已知文案转义。 / Isolate known-label escaping. */ escapeHtml: value => value,
      /** 隔离尺寸同步。 / Isolate size synchronization. */ queueSurfaceStateSync() {},
      observationOpenHomeFlow: elements.openHomeFlow, observationOpenTaskDetail: elements.openTaskDetail,
      observationOpenRecall: elements.openRecallCenter, observationRefresh: elements.refreshObservations,
    });
    const method = name === 'floating_task_hud.html' ? 'renderObservations' : 'renderObservationSnapshot';
    pageFunctions(name, [method], context);
    context[method]({ source: 'enterprise_run', summary: '需要人工审阅修复范围', status: 'action_required' });
    assert.equal(elements.observationSummary.textContent, '需要人工审阅修复范围');
    assert.equal(elements.openTaskDetail.disabled, true); assert.equal(elements.openRecallCenter.disabled, true);
    assert.doesNotMatch(elements.observationStatus.textContent + elements.observationList.innerHTML, /no task ID|没有任务 ID|old task content/);
    assert.equal(elements.observationMeta.innerHTML, '');
  }
});
