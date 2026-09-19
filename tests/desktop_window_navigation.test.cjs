/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
桌面导航与原生窗口状态回归 / Desktop navigation and native window state regressions.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { parse } = require('@babel/parser');

/** 读取源码，不导入或启动桌面程序。 / Read source without importing or launching the desktop application. */
function source(relative) { return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'); }
const mainSource = source('main.js');
const mainAst = parse(mainSource, { sourceType: 'script', allowReturnOutsideFunction: true });
const sceneSource = source('static/js/enterprise3d.js');
const sceneAst = parse(sceneSource, { sourceType: 'script' });
const hostSource = source('static/js/vue_methods.js');
const hostAst = parse(hostSource, { sourceType: 'script' });
const preloadSource = source('static/js/preload.js');

/** 在真实语法树中查找目标节点。 / Find a target node in the production syntax tree. */
function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

/** 模拟可观察的原生窗口变更，不创建真实窗口。 / Model observable native mutations without creating a real window. */
class WindowFixture extends EventEmitter {
  /** 建立普通、最大化或全屏窗口夹具。 / Initialize a normal, maximized, or fullscreen window fixture. */
  constructor(state) {
    super(); this.calls = []; this.maximized = state === 'maximized'; this.fullscreen = state === 'fullscreen';
    this.normalBounds = { x: 137, y: 81, width: 1280, height: 860 };
    this.bounds = this.maximized || this.fullscreen ? { x: 0, y: 0, width: 1920, height: 1040 } : { ...this.normalBounds };
    this.resizable = true; this.shadow = true; this.destroyed = false;
    this.webContents = { /** 不发送任何实际窗口事件。 / Never send real window events. */ send() {} };
  }
  /** 返回销毁状态。 / Return destruction state. */
  isDestroyed() { return this.destroyed; }
  /** 返回最大化状态。 / Return maximization state. */
  isMaximized() { return this.maximized; }
  /** 返回全屏状态。 / Return fullscreen state. */
  isFullScreen() { return this.fullscreen; }
  /** 本夹具不进行最小化。 / This fixture does not minimize windows. */
  isMinimized() { return false; }
  /** 返回窗口边界副本。 / Return a copy of native bounds. */
  getBounds() { return { ...this.bounds }; }
  /** 返回还原边界副本。 / Return a copy of restored bounds. */
  getNormalBounds() { return { ...this.normalBounds }; }
  /** 返回可调整状态。 / Return resizability. */
  isResizable() { return this.resizable; }
  /** 返回窗口阴影状态。 / Return native shadow state. */
  hasShadow() { return this.shadow; }
  /** 记录背景更新。 / Record background updates. */
  setBackgroundColor(color) { this.calls.push(['background', color]); }
  /** 模拟无框Windows禁用调整时丢失最大化。 / Model Windows frameless maximization loss when resizing is disabled. */
  setResizable(value) { this.calls.push(['resizable', value]); this.resizable = value; if (!value) this.maximized = false; }
  /** 记录阴影更新。 / Record shadow updates. */
  setHasShadow(value) { this.calls.push(['shadow', value]); this.shadow = value; }
  /** 模拟退出全屏可能还原原生窗口的行为。 / Model native restoration caused by an exit-fullscreen request. */
  setFullScreen(value) {
    this.calls.push(['fullscreen', value]); this.fullscreen = value; this.maximized = false;
    this.bounds = value ? { x: 0, y: 0, width: 1920, height: 1080 } : { ...this.normalBounds };
  }
  /** 显式最大化夹具。 / Explicitly maximize the fixture. */
  maximize() { this.calls.push(['maximize']); this.maximized = true; this.bounds = { x: 0, y: 0, width: 1920, height: 1040 }; }
  /** 显式还原最大化夹具。 / Explicitly restore the maximized fixture. */
  unmaximize() { this.calls.push(['unmaximize']); this.maximized = false; this.bounds = { ...this.normalBounds }; }
  /** 记录显式紧凑尺寸请求。 / Record explicit compact size requests. */
  setSize(width, height) { this.calls.push(['size', width, height]); this.bounds = { ...this.bounds, width, height }; }
}

/** 连接真实菜单、场景、preload和主进程IPC，外部依赖全部隔离。 / Connect actual menu, scene, preload, and main IPC with isolated external dependencies. */
function createHarness(state = 'maximized') {
  const win = new WindowFixture(state); const handlers = {}; const timers = []; const requests = [];
  const documentNode = { scrollTop: 73, classList: { /** 页面类名更新不改变窗口。 / Page class changes do not mutate native windows. */ toggle() {} } };
  const contentPanel = { scrollTop: 420 };
  const context = vm.createContext({
    console, process: { platform: 'win32' }, mainWindow: win, dynamicIslandWindow: null, floatingTaskHudWindow: null,
    MAIN_WINDOW_MIN_WIDTH: 1024, MAIN_WINDOW_MIN_HEIGHT: 700, isMac: false,
    screen: { /** 提供固定测试显示器。 / Supply a fixed test display. */ getDisplayMatching() { return { workAreaSize: { width: 1920, height: 1040 } }; } },
    /** 校验主窗口身份。 / Validate the main window identity. */ assertMainRendererSender(event) { assert.equal(event.sender, win.webContents); return win; },
    /** 校验可信窗口身份。 / Validate trusted window identity. */ assertTrustedWindowSender(event) { assert.equal(event.sender, win.webContents); return win; },
    /** 仅保留原有尺寸限制。 / Retain the existing size limits. */ clampDynamicIslandMetric(value, minimum, maximum, fallback) { return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback; },
    /** 排队定时回调而不等待真实时间。 / Queue callbacks without waiting on wall time. */ setTimeout(callback) { timers.push(callback); return timers.length; },
    /** 不执行任何动画。 / Do not execute animations. */ cancelAnimationFrame() {},
    document: { documentElement: documentNode, body: documentNode, /** 隔离事件清理。 / Isolate event cleanup. */ removeEventListener() {},
      /** 只允许真实导航方法定位内容面板。 / Allow the real navigation method to locate only the content panel. */
      querySelector(selector) { assert.equal(selector, '.ox-enterprise-detail-content'); return contentPanel; },
    },
    ipcMain: { /** 注册源码中的真实IPC处理器。 / Register the actual IPC handler from source. */ handle(name, callback) { handlers[name] = callback; } },
    ipcRenderer: { /** 将preload请求转交真实主进程处理器。 / Forward preload requests to the actual main handler. */ invoke(channel, payload) { requests.push([channel, payload]); return Promise.resolve(handlers[channel]({ sender: win.webContents }, payload)); } },
    window: { /** 隔离页面事件清理。 / Isolate page event cleanup. */ removeEventListener() {} },
  });
  const names = ['getWindowStatePayload', 'applyBorderlessFullscreenChrome', 'restoreBorderlessFullscreenChrome', 'enterBorderlessFullscreen', 'exitBorderlessFullscreen', 'emitWindowState'];
  const functions = names.map(/** 提取真实声明。 / Extract actual declarations. */ name => {
    const node = mainAst.program.body.find(/** 按函数名定位。 / Locate the named function. */ item => item.type === 'FunctionDeclaration' && item.id.name === name);
    assert.ok(node, name); return mainSource.slice(node.start, node.end);
  });
  vm.runInContext('const fullscreenChromeState = new WeakMap();\n' + functions.join('\n'), context);
  for (const channel of ['window-action', 'toggle-window-size']) {
    const node = findNode(mainAst, /** 定位真实IPC注册。 / Locate the actual IPC registration. */ item => item.type === 'CallExpression' && item.callee?.object?.name === 'ipcMain' && item.callee?.property?.name === 'handle' && item.arguments[0]?.value === channel);
    assert.ok(node, channel); vm.runInContext(mainSource.slice(node.start, node.end), context);
  }
  const preload = findNode(parse(preloadSource, { sourceType: 'script' }), /** 定位真实preload接口。 / Locate the real preload interface. */ item => item.type === 'ObjectProperty' && item.key?.name === 'windowAction');
  context.window.electronAPI = { windowAction: vm.runInContext('(' + preloadSource.slice(preload.value.start, preload.value.end) + ')', context) };
  const sceneClass = sceneAst.program.body.find(/** 查找真实场景类。 / Find the actual scene class. */ item => item.type === 'ClassDeclaration' && item.id.name === 'Enterprise3DScene');
  const selected = sceneClass.body.body.filter(/** 仅提取生命周期与窗口边界方法。 / Extract lifecycle and window boundary methods only. */ item => ['dispose', '_setFullscreenState', 'toggleFullscreen'].includes(item.key?.name));
  const scene = vm.runInContext('(new (class {' + selected.map(/** 保留方法源码。 / Retain method source. */ item => sceneSource.slice(item.start, item.end)).join('\n') + '})())', context);
  Object.assign(scene, {
    _isFullscreen: false, _meshMap: new Map(), scene: { children: [] },
    container: { classList: documentNode.classList, /** 提供页面根节点。 / Supply the page root. */ closest() { return { classList: documentNode.classList, /** 无额外页面宿主。 / No additional page host. */ closest() { return null; } }; } },
    /** 隔离主题清理。 / Isolate theme cleanup. */ _unbindSkinUpdates() {},
    /** 隔离画布清理。 / Isolate canvas cleanup. */ _clearScene() {},
    /** 隔离显卡资源释放。 / Isolate GPU resource cleanup. */ _disposeObjects() {},
    /** 记录页面样式变更。 / Record page style changes. */ _toggleFullscreenViewportStyles(active) { this.pageFullscreen = active; },
    /** 页面周边导航不会改变原生窗口。 / Page navigation chrome does not mutate native windows. */ _toggleAdjacentChrome() {},
    /** 不创建或调整真实画布。 / Never create or resize a real canvas. */ resize() {},
  });
  const host = { enterpriseTab: 'enterprise-sandbox', canUseEnterprise: true, enterprise3DScene: scene,
    /** 保留渲染后回调语义，让真实内容滚动逻辑执行。 / Preserve post-render callback semantics so the real content scrolling logic runs. */
    $nextTick(callback) { if (callback) timers.push(callback); return Promise.resolve(); },
    /** 不调用真实会话服务。 / Do not call a real conversation service. */ closeEnterpriseChat() {},
    /** 不请求真实工作空间。 / Do not request real workspaces. */ async loadWorkspaceEnvs() { this.workspacesLoaded = true; },
  };
  for (const name of ['openEnterpriseTab', 'dispose3DView']) {
    const node = findNode(hostAst, /** 查找真实宿主方法。 / Find the actual host method. */ item => item.type === 'ObjectMethod' && item.key?.name === name);
    assert.ok(node, name); host[name] = vm.runInContext('({' + hostSource.slice(node.start, node.end) + '})', context)[name];
  }
  return { win, handlers, requests, scene, host, context, documentNode, contentPanel, /** 立即执行排队回调。 / Execute queued callbacks immediately. */ flushTimers() { while (timers.length) timers.shift()(); } };
}

for (const state of ['normal', 'maximized', 'fullscreen']) {
  test(`enterprise workspace navigation preserves ${state} window bounds without native IPC`, /** 验证真实菜单至场景销毁链。 / Verify the actual menu-to-scene-disposal chain. */ async () => {
    const h = createHarness(state); const before = h.win.getBounds();
    await h.host.openEnterpriseTab('enterprise-workspaces'); h.flushTimers();
    assert.equal(h.host.enterpriseTab, 'enterprise-workspaces'); assert.equal(h.host.workspacesLoaded, true);
    assert.equal(h.host.enterprise3DScene, null); assert.equal(h.scene._disposed, true);
    assert.equal(h.contentPanel.scrollTop, 0); assert.equal(h.documentNode.scrollTop, 73);
    assert.deepEqual(h.requests, []); assert.deepEqual(h.win.calls, []); assert.deepEqual(h.win.getBounds(), before);
    assert.equal(h.win.isMaximized(), state === 'maximized'); assert.equal(h.win.isFullScreen(), state === 'fullscreen');
  });
}

test('disposing an expanded sandbox clears page chrome while preserving native fullscreen', /** 验证已展开页面的导航清理。 / Verify navigation cleanup of an expanded page. */ async () => {
  const h = createHarness('fullscreen'); h.scene._isFullscreen = true;
  await h.host.openEnterpriseTab('enterprise-workspaces'); h.flushTimers();
  assert.equal(h.scene.pageFullscreen, false); assert.equal(h.win.isFullScreen(), true); assert.deepEqual(h.requests, []);
  assert.equal(h.contentPanel.scrollTop, 0); assert.equal(h.documentNode.scrollTop, 73);
});

test('redundant exit-fullscreen IPC preserves maximized and ordinary windows', /** 验证主进程幂等边界。 / Verify the idempotent main-process boundary. */ async () => {
  for (const state of ['normal', 'maximized']) {
    const h = createHarness(state); const before = h.win.getBounds();
    await h.context.window.electronAPI.windowAction('exit-fullscreen'); h.flushTimers();
    assert.deepEqual(h.win.calls, []); assert.deepEqual(h.win.getBounds(), before); assert.equal(h.win.isMaximized(), state === 'maximized');
  }
});

test('explicit sandbox fullscreen toggle restores prior maximization and emits only state changes', /** 验证显式全屏操作及状态恢复。 / Verify explicit fullscreen operations and state restoration. */ async () => {
  const h = createHarness('maximized');
  h.scene.toggleFullscreen(); assert.equal(h.win.isFullScreen(), true);
  h.scene._setFullscreenState(true); assert.equal(h.requests.length, 1);
  h.scene.toggleFullscreen(); h.win.emit('leave-full-screen'); h.flushTimers();
  assert.equal(h.win.isFullScreen(), false); assert.equal(h.win.isMaximized(), true);
  assert.equal(h.win.resizable, true); assert.equal(h.win.shadow, true);
  assert.deepEqual(h.requests.map(/** 读取实际窗口动作。 / Read the actual window action. */ entry => entry[1]), ['enter-fullscreen', 'exit-fullscreen']);
  assert.equal(h.win.calls.filter(/** 统计最大化恢复次数。 / Count maximization restorations. */ call => call[0] === 'maximize').length, 1);
});

test('explicit fullscreen round trip preserves ordinary window position and dimensions', /** 验证普通窗口显式全屏后还原。 / Verify ordinary bounds after an explicit fullscreen round trip. */ async () => {
  const h = createHarness('normal'); const before = h.win.getBounds();
  await h.context.window.electronAPI.windowAction('enter-fullscreen');
  await h.context.window.electronAPI.windowAction('exit-fullscreen'); h.flushTimers();
  assert.equal(h.win.isMaximized(), false); assert.deepEqual(h.win.getBounds(), before);
});

test('explicit compact request remains the only tested navigation-adjacent size mutation', /** 验证显式紧凑尺寸功能仍可调用。 / Verify explicit compact resizing remains available. */ async () => {
  const h = createHarness('normal');
  await h.handlers['toggle-window-size']({ sender: h.win.webContents }, { width: 1100, height: 760 });
  assert.deepEqual(h.win.calls, [['size', 1100, 760]]);
  assert.equal(h.win.getBounds().x, 137); assert.equal(h.win.getBounds().y, 81);
});

test('window action rejects an untrusted sender before any native mutation', /** 验证既有可信来源限制。 / Verify the existing trusted-sender restriction. */ () => {
  const h = createHarness('maximized');
  assert.throws(/** 提交隔离的非可信来源。 / Submit an isolated untrusted sender. */ () => h.handlers['window-action']({ sender: {} }, 'exit-fullscreen'));
  assert.deepEqual(h.win.calls, []);
});
