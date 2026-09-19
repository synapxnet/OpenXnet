/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
审批通知生命周期回归 / Approval notice lifecycle regression.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
__version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

/** 装载真实生命周期和轮询方法，用隔离运行时替代接口。 / Load actual lifecycle and polling methods with an isolated runtime. */
function makeHost() {
  const calls = []; const timers = new Map(); let nextTimer = 0;
  const window = {
    OpenXnetEnterpriseApprovalNotices: {
      /** 仅提供集成所需的隔离数据。 / Provide only isolated integration state. */
      createState() { return {}; },
      methods: {},
    },
    /** 记录定时工作，禁止真实后台轮询。 / Record scheduled work without real background polling. */
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    /** 清理当前测试定时工作。 / Clear scheduled work in this test only. */
    clearTimeout(id) { timers.delete(id); },
  };
  const context = { window, vue_data: {}, vue_methods: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'static/js/openxnet-enterprise-approval-bootstrap.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(root, 'static/js/vue_methods.js'), 'utf8');
  const begin = source.indexOf('  applyOperationsRuntimeSnapshot(snapshot) {');
  const end = source.indexOf('  async openOperationsNoticeTarget(target)', begin);
  assert.ok(begin >= 0 && end > begin);
  const methods = vm.runInNewContext(`({${source.slice(begin, end)}})`, { window, console });
  const lifecycle = window.OpenXnetEnterpriseApprovalLifecycle;
  let read = async () => ({ incidents: [], approvals: [], updatedAt: '2026-09-18T00:00:00Z' });
  const app = {
    ...lifecycle.methods, ...methods, canUseEnterprise: true, competitionProgressPollGeneration: 0,
    competitionProgressPollTimer: null, competitionBusyAction: '', enterpriseTab: 'enterprise-sandbox',
    authState: { profile: { id: 'account-a' } },
    /** 记录重置而不模拟任何人工决定。 / Record resets without simulating human decisions. */
    resetEnterpriseApprovalNotices(enabled) { calls.push(['reset', enabled]); },
    /** 记录到达当前会话的快照。 / Record snapshots delivered to the current session. */
    syncEnterpriseApprovalNotices(snapshot) { calls.push(['sync', snapshot]); },
    /** 返回仅读取的运行时替身。 / Return a read-only runtime double. */
    getApplicationCompetitionRuntime() { return { getApplicationCompetitionSnapshot: () => read() }; },
  };
  Object.defineProperty(app, 'enterpriseApprovalAccountKey', { get: lifecycle.computed.enterpriseApprovalAccountKey });
  return { app, calls, timers, lifecycle, setRead(value) { read = value; } };
}

/** 推進承诺队列，不等待真实计时器。 / Drain promises without waiting for real timers. */
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

test('login restores pending approvals from a different menu and keeps one observation timer', async () => {
  const { app, calls, timers } = makeHost();
  app.restartEnterpriseApprovalObservation(app.enterpriseApprovalAccountKey);
  await flush();
  assert.equal(calls.filter(item => item[0] === 'sync').length, 1);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 15000);
  app.scheduleOperationsRuntimePoll();
  assert.equal(timers.size, 1);
  assert.equal(app.enterpriseTab, 'enterprise-sandbox');
});

test('logout drops an outstanding snapshot and removes the scheduled watcher', async () => {
  const { app, calls, timers, setRead } = makeHost();
  let complete;
  setRead(() => new Promise(resolve => { complete = resolve; }));
  app.restartEnterpriseApprovalObservation(app.enterpriseApprovalAccountKey);
  await flush();
  app.canUseEnterprise = false;
  app.competitionBusyAction = 'investigate';
  app.competitionLoading = true;
  app.competitionMemoryLoading = true;
  app.enterpriseChatTaskStarting = true;
  app.enterpriseChatSending = true;
  app.enterpriseChatPending = { 'old-account': { task: true } };
  app.restartEnterpriseApprovalObservation('');
  complete({ incidents: [{ status: 'AWAITING_APPROVAL' }], approvals: [] });
  await flush();
  assert.equal(calls.some(item => item[0] === 'sync'), false);
  assert.equal(timers.size, 0);
  assert.deepEqual(calls.at(-1), ['reset', false]);
  assert.equal(app.competitionBusyAction, '');
  assert.equal(app.competitionLoading, false);
  assert.equal(app.competitionMemoryLoading, false);
  assert.equal(app.enterpriseChatTaskStarting, false);
  assert.equal(app.enterpriseChatSending, false);
  assert.equal(Object.keys(app.enterpriseChatPending).length, 0);
});

test('switching accounts while a poll is pending cannot restore the old queue', async () => {
  const { app, calls, timers, setRead } = makeHost();
  app.restartEnterpriseApprovalObservation(app.enterpriseApprovalAccountKey);
  await flush();
  const oldPoll = [...timers.values()][0]; timers.clear();
  let complete;
  setRead(() => new Promise(resolve => { complete = resolve; }));
  const inFlight = oldPoll.callback();
  app.authState.profile.id = 'account-b';
  setRead(async () => ({ incidents: [], approvals: [], marker: 'new-account' }));
  app.restartEnterpriseApprovalObservation(app.enterpriseApprovalAccountKey);
  await flush();
  complete({ incidents: [], approvals: [], marker: 'old-account' });
  await inFlight;
  assert.equal(calls.some(item => item[1]?.marker === 'old-account'), false);
  assert.equal(calls.filter(item => item[1]?.marker === 'new-account').length, 1);
  assert.equal(timers.size, 1);
});

test('active tasks use a bounded read-only poll and teardown closes the notice state', async () => {
  const { app, calls, timers, lifecycle, setRead } = makeHost();
  setRead(async () => ({ incidents: [{ workspaceId: 'w', incidentId: 'i', status: 'AWAITING_APPROVAL' }], approvals: [] }));
  app.restartEnterpriseApprovalObservation(app.enterpriseApprovalAccountKey);
  await flush();
  assert.equal([...timers.values()][0].delay, 3000);
  lifecycle.beforeUnmount.call(app);
  assert.equal(timers.size, 0);
  assert.deepEqual(calls.at(-1), ['reset', false]);
});

test('approval dialog and reopen entry are global, with explicit execution labels', () => {
  const html = fs.readFileSync(path.join(root, 'static/index.html'), 'utf8');
  assert.match(html, /class="enterprise-approval-entry"[^>]+@click="openEnterpriseApprovalNotice\(\)"/u);
  assert.ok(html.indexOf('v-model="enterpriseApprovalNoticeVisible"') < html.indexOf("enterpriseTab === 'ops-control'"));
  assert.match(html, /批准，暂不执行/u);
  assert.match(html, /批准并自动执行/u);
  assert.match(html, /:before-close="beforeCloseEnterpriseApprovalNotice"/u);
  assert.ok(html.indexOf('js/openxnet-enterprise-approval-notices.js') < html.indexOf('js/openxnet-enterprise-approval-bootstrap.js'));
  assert.ok(html.indexOf('js/openxnet-enterprise-approval-bootstrap.js') < html.indexOf('js/renderer.js'));
});
