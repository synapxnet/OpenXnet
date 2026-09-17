#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 企业空间风格偏好回归 / Enterprise spatial preference regressions.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const preferenceKey = 'openxnet.enterprise.presentation.v1';
const source = fs.readFileSync(path.resolve(__dirname, '../static/js/vue_methods.js'), 'utf8');

/** 提取实际宿主方法进行独立验证；extract a real host method for isolated verification. */
function loadSandboxMethod(name, nextName, globals = {}) {
  const start = source.indexOf(`  ${name}(`);
  const end = source.indexOf(`  ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `Host method is present: ${name}`);
  return vm.runInNewContext(`({${source.slice(start, end)}})`, globals)[name.replace(/^async /, '')];
}

/** 构建有真实偏好方法的宿主夹具；build a host fixture using actual preference methods. */
function createHost(options = {}) {
  const events = [];
  const storage = new Map([[preferenceKey, options.saved ?? 'studio']]);
  const localStorage = {
    /** 模拟本地读取和真实异常；simulate local reads and genuine storage exceptions. */
    getItem(key) {
      if (options.readError) throw new Error('Storage read denied');
      return storage.has(key) ? storage.get(key) : null;
    },
    /** 记录持久化顺序并支持拒绝写入；record persistence order and support denied writes. */
    setItem(key, value) {
      events.push(['save', key, value]);
      if (options.writeError) throw new Error('Storage write denied');
      storage.set(key, value);
    },
  };
  const globals = {
    window: { localStorage },
    console: {
      /** 收集预期错误而不污染测试输出；capture expected errors without noisy test output. */
      warn(...args) { events.push(['warning', ...args]); },
    },
  };
  const scene = {
    style: options.current ?? 'studio',
    /** 模拟成功和场景拒绝以检查宿主回退；simulate success and scene rejection to verify host retention. */
    setPresentationStyle(style) {
      events.push(['scene', style]);
      if (options.sceneError === 'throw') throw new Error('Scene rebuild failed');
      if (options.sceneError === 'false') return false;
      this.style = style;
      return true;
    },
  };
  const app = {
    sandboxPresentationStyle: options.current ?? 'studio',
    sandboxPresentationOpen: true,
    sandboxPresentationError: '',
    enterprise3DScene: scene,
    sandboxLevel: 2,
    sandboxCurrentWs: 'workspace-current',
    sandboxCurrentProject: 'project-current',
    selected3DAgent: { id: 'staff-current', position3D: { x: 0, z: 3 } },
    enterpriseChatInput: '保留草稿 / Keep draft',
    /** 返回夹具语言；return the fixture language. */
    isCurrentLanguageZh() { return options.language !== 'en'; },
    /** 记录关闭而不模拟 DOM；record closing without simulating the DOM. */
    closeSandboxPresentation() {
      events.push(['close']);
      this.sandboxPresentationOpen = false;
    },
    getSandboxPresentationOptions: loadSandboxMethod('getSandboxPresentationOptions', 'getSandboxPresentationLabel'),
    restoreSandboxPresentation: loadSandboxMethod('restoreSandboxPresentation', 'setSandboxPresentation', globals),
    setSandboxPresentation: loadSandboxMethod('setSandboxPresentation', 'closeSandboxPresentation', globals),
  };
  return { app, scene, events, storage };
}

/** 已保存的三个白名单风格都可恢复；all three saved allowlisted presentations restore. */
test('real host restores every supported saved presentation without writing business data', () => {
  for (const saved of ['studio', 'atrium', 'command']) {
    const { app, events } = createHost({ saved });
    app.restoreSandboxPresentation();
    assert.equal(app.sandboxPresentationStyle, saved);
    assert.deepEqual(events, []);
  }
});

/** 无效存储值不能变成有效 UI 状态；invalid persisted values cannot become active UI state. */
test('real host falls back to studio for missing or malformed persisted preferences', () => {
  for (const saved of ['', 'unknown', 'COMMAND', '{"style":"atrium"}', ' atrium ']) {
    const { app } = createHost({ saved, current: 'command' });
    app.restoreSandboxPresentation();
    assert.equal(app.sandboxPresentationStyle, 'studio');
  }
  const { app, storage } = createHost({ current: 'command' });
  storage.clear();
  app.restoreSandboxPresentation();
  assert.equal(app.sandboxPresentationStyle, 'studio');
});

/** 读取失败仍验证内存值；a failed read still validates the in-memory fallback. */
test('storage read failure retains valid in-memory presentation and rejects an invalid one', () => {
  for (const current of ['studio', 'atrium', 'command', '', 'obsolete-skin']) {
    const { app } = createHost({ current, readError: true });
    app.restoreSandboxPresentation();
    const expected = ['studio', 'atrium', 'command'].includes(current) ? current : 'studio';
    assert.equal(app.sandboxPresentationStyle, expected, `Fallback for ${JSON.stringify(current)}`);
  }
});

/** 成功切换只改变外观与本地偏好；a successful switch changes presentation and local preference only. */
test('successful switching persists after the scene succeeds and retains selection, scope, position and draft', () => {
  const { app, scene, events, storage } = createHost();
  const selected = app.selected3DAgent;
  const position = selected.position3D;
  assert.equal(app.setSandboxPresentation('command'), true);
  assert.deepEqual(events, [['scene', 'command'], ['save', preferenceKey, 'command'], ['close']]);
  assert.equal(app.sandboxPresentationStyle, 'command');
  assert.equal(scene.style, 'command');
  assert.equal(storage.get(preferenceKey), 'command');
  assert.equal(app.sandboxPresentationOpen, false);
  assert.equal(app.sandboxPresentationError, '');
  assert.equal(app.sandboxLevel, 2);
  assert.equal(app.sandboxCurrentWs, 'workspace-current');
  assert.equal(app.sandboxCurrentProject, 'project-current');
  assert.equal(app.selected3DAgent, selected);
  assert.equal(selected.position3D, position);
  assert.equal(app.enterpriseChatInput, '保留草稿 / Keep draft');
});

/** 非法切换必须在场景调用前拒绝；invalid switches must be rejected before reaching the scene. */
test('unsupported switch does not change the scene, preference, picker or existing feedback', () => {
  const { app, events, storage } = createHost({ current: 'atrium', saved: 'atrium' });
  app.sandboxPresentationError = 'Existing feedback';
  for (const style of ['unknown', '', null, undefined, { id: 'studio' }]) {
    assert.equal(app.setSandboxPresentation(style), false);
    assert.equal(app.sandboxPresentationStyle, 'atrium');
    assert.equal(app.sandboxPresentationOpen, true);
    assert.equal(app.sandboxPresentationError, 'Existing feedback');
  }
  assert.deepEqual(events, []);
  assert.equal(storage.get(preferenceKey), 'atrium');
});

/** 场景失败不得保存未生效的选择；scene failures must not persist an unapplied selection. */
test('scene rejection or rebuild error retains the previous preference and leaves retry available', () => {
  for (const sceneError of ['false', 'throw']) {
    const { app, scene, events, storage } = createHost({ current: 'atrium', saved: 'atrium', sceneError });
    assert.equal(app.setSandboxPresentation('command'), false);
    assert.equal(app.sandboxPresentationStyle, 'atrium');
    assert.equal(scene.style, 'atrium');
    assert.equal(storage.get(preferenceKey), 'atrium');
    assert.equal(app.sandboxPresentationOpen, true);
    assert.match(app.sandboxPresentationError, /空间切换未完成/);
    assert.equal(events.some(event => event[0] === 'save' || event[0] === 'close'), false);
  }
});

/** 拒绝保存时如实提示但保留本次显示；denied persistence reports the issue while retaining the current display. */
test('storage write failure keeps the applied scene and reports unsaved appearance in both languages', () => {
  for (const language of ['zh', 'en']) {
    const { app, scene, storage } = createHost({ current: 'atrium', saved: 'atrium', writeError: true, language });
    assert.equal(app.setSandboxPresentation('command'), true);
    assert.equal(app.sandboxPresentationStyle, 'command');
    assert.equal(scene.style, 'command');
    assert.equal(storage.get(preferenceKey), 'atrium');
    assert.equal(app.sandboxPresentationOpen, false);
    assert.match(app.sandboxPresentationError, language === 'zh' ? /无法保存外观偏好/ : /could not be saved/);
  }
});
