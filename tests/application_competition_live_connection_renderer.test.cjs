/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Live 接入交互状态回归 / Live connection interaction-state regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.3.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../static/js/vue_methods.js'), 'utf8');
const start = source.indexOf('  getCompetitionLiveConnectionBridge()');
const end = source.indexOf('  /** 用户明确选演练后才切换 Fixture', start);
assert.ok(start > 0 && end > start);

/** 可控制时序的异步回执。 / Create a controllable async receipt. */
function deferred() {
  let resolve;
  const promise = new Promise(/** 保存完成器。 / Capture the resolver. */ done => { resolve = done; });
  return { promise, resolve };
}

/** 创建脱敏的测试授权。 / Create a redacted test authorization. */
function grant(overrides = {}) {
  return { schema: 'openxnet.agentteams.live-access.v1', grantId: 'live-grant', label: '业务空间受控执行', workspaceId: 'workspace-a', expiresAt: '2027-01-01T00:00:00Z', remainingRequests: 10, modes: ['live'], requiredTeamRuntime: 'agentteams', allowedTools: ['aiops.service.read'], allowedScenarios: ['feature-drift'], serviceReady: true, platforms: ['aiops', 'dataops', 'mlops'].map(/** 创建平台健康记录。 / Create platform health records. */ platform => ({ platform, configured: true, reachable: true, identityMatched: true })), approvalReady: true, checks: [], ...overrides };
}

/** 创建不含原始授权的持久快照。 / Create a saved snapshot with no raw authorization. */
function snapshot(overrides = {}) {
  return { source: 'saved', endpoint: 'https://live.example.test/adapter/', workspaceId: 'workspace-a', enabled: true, credentialConfigured: true, storageAvailable: true, access: grant(), ...overrides };
}

/** 构造实际 Renderer 方法及受控的 Main 接口。 / Load actual renderer methods with controlled Main APIs. */
function appFixture(overrides = {}) {
  const calls = [];
  const bridge = {
    /** 读取保存快照。 / Read the saved snapshot. */
    getApplicationCompetitionLiveConnection: async () => ({ ok: true, snapshot: snapshot() }),
    /** 返回只读检测。 / Return a read-only probe. */
    testApplicationCompetitionLiveConnection: async request => { calls.push({ action: 'test', request }); return { ok: true, access: grant() }; },
    /** 返回保存回执。 / Return a save receipt. */
    saveApplicationCompetitionLiveConnection: async request => { calls.push({ action: 'save', request }); return { ok: true, snapshot: snapshot() }; },
    /** 返回清除回执。 / Return a clear receipt. */
    clearApplicationCompetitionLiveConnection: async () => { calls.push({ action: 'clear' }); return { ok: true, snapshot: snapshot({ source: 'none', endpoint: '', workspaceId: '', enabled: false, credentialConfigured: false, access: null }) }; },
    ...overrides,
  };
  const methods = vm.runInNewContext(`({${source.slice(start, end)}})`, { window: { openxnetDesktop: bridge } });
  const app = { ...methods, competitionLiveConnectionSnapshot: snapshot(), competitionLiveConnectionForm: { endpoint: 'https://live.example.test/adapter/', workspaceId: 'workspace-a', enabled: true }, competitionLiveConnectionBusy: '', competitionLiveConnectionLoading: false, competitionLiveConnectionLoaded: true, competitionLiveConnectionResult: null, competitionLiveConnectionRevision: 0, competitionLiveConnectionLoadVersion: 0, competitionLiveConnectionClearConfirm: false, enterpriseWorkspaces: [{ id: 'workspace-a', name: '风控团队' }, { id: 'workspace-b', name: '数据团队' }], $refs: { competitionLiveAccessCodeInput: { value: '' } },
    /** 固定测试语言。 / Fix the test language. */
    isCurrentLanguageZh: () => true,
    /** 保留固定错误，不反射异常。 / Keep fixed errors without reflecting exceptions. */
    getCompetitionConnectionMessage: code => `fixed:${code}`,
    /** 只读刷新配置。 / Record a read-only configuration refresh. */
    loadCompetitionUiProfile: async () => { calls.push({ action: 'refresh' }); },
  };
  return { app, calls, bridge };
}

/** 同地址授权仅由 Main 复用，不返回 Renderer。 / Same-target authorization is reused only by Main. */
test('same target can reuse saved authorization without transmitting raw credentials', async () => {
  const { app, calls } = appFixture();
  assert.equal(app.canSaveCompetitionLiveConnection(), false);
  assert.equal(await app.testCompetitionLiveConnection(), true);
  assert.equal(calls[0].request.accessCode, undefined);
  assert.equal(app.canSaveCompetitionLiveConnection(), true);
  assert.equal(app.getCompetitionLiveConnectionReceipt().source, 'test');
  assert.equal(await app.saveCompetitionLiveConnection(), true);
  assert.equal(app.getCompetitionLiveConnectionReceipt().source, 'saved');
  assert.equal(app.competitionLiveConnectionResult.action, 'save');
});

/** 新目标不能收到原有授权。 / New targets cannot receive old authorization. */
test('changing an endpoint or workspace clears temporary codes and requires a new authorization', async () => {
  for (const field of ['endpoint', 'workspaceId']) {
    const { app, calls } = appFixture();
    app.$refs.competitionLiveAccessCodeInput.value = 'oxlive_temporary';
    app.competitionLiveConnectionForm[field] = field === 'endpoint' ? 'https://other.example.test/' : 'workspace-b';
    app.invalidateCompetitionLiveConnectionTest(true);
    assert.equal(app.$refs.competitionLiveAccessCodeInput.value, '');
    assert.equal(app.canReuseCompetitionLiveCredential(), false);
    assert.equal(await app.testCompetitionLiveConnection(), false);
    assert.equal(app.competitionLiveConnectionResult.code, 'ACCESS_CODE_REQUIRED');
    assert.equal(calls.length, 0);
  }
});

/** 演示访问码不能进入 Live 通道。 / Demo access codes cannot enter the Live channel. */
test('fixture demo codes are rejected before contacting Live services', async () => {
  const { app, calls } = appFixture();
  app.$refs.competitionLiveAccessCodeInput.value = 'oxdemo_fixture';
  assert.equal(await app.testCompetitionLiveConnection(), false);
  assert.equal(app.competitionLiveConnectionResult.code, 'ACCESS_MODE_MISMATCH');
  assert.equal(calls.length, 0);
});

/** 依赖缺项保留可查看授权，但不能保存。 / Missing dependencies retain the grant receipt but block saving. */
test('valid authorization with unavailable approval service shows exact missing checks and blocks save', async () => {
  const access = grant({ serviceReady: false, approvalReady: false, checks: [{ id: 'approval', label: '审批发布服务未就绪', ready: false, code: 'APPROVAL_UNAVAILABLE' }] });
  const { app, calls } = appFixture({ testApplicationCompetitionLiveConnection: async () => ({ ok: true, access }) });
  assert.equal(await app.testCompetitionLiveConnection(), false);
  assert.equal(app.competitionLiveConnectionResult.code, 'SERVICE_NOT_READY');
  assert.equal(app.getCompetitionLiveConnectionReceipt().access.checks[0].id, 'approval');
  assert.equal(app.canSaveCompetitionLiveConnection(), false);
  assert.equal(await app.saveCompetitionLiveConnection(), false);
  assert.equal(calls.length, 0);
});

/** 服务错误或错误空间回执不形成有效检测。 / Wrong-mode and wrong-workspace receipts never establish a valid check. */
test('fixture-shaped or foreign-workspace service receipts cannot authorize saving', async () => {
  for (const access of [grant({ modes: ['fixture'] }), grant({ workspaceId: 'workspace-b' })]) {
    const { app } = appFixture({ testApplicationCompetitionLiveConnection: async () => ({ ok: true, access }) });
    assert.equal(await app.testCompetitionLiveConnection(), false);
    assert.equal(app.competitionLiveConnectionResult.code, 'INVALID_RESPONSE');
    assert.equal(app.canSaveCompetitionLiveConnection(), false);
  }
});

/** 编辑使在途检测永久失效。 / Editing invalidates an in-flight check permanently. */
test('late test completion cannot restore a check invalidated by editing', async () => {
  const pending = deferred();
  const { app } = appFixture({ testApplicationCompetitionLiveConnection: () => pending.promise });
  const testing = app.testCompetitionLiveConnection();
  app.competitionLiveConnectionForm.endpoint = 'https://changed.example.test/';
  app.invalidateCompetitionLiveConnectionTest(true);
  pending.resolve({ ok: true, access: grant() });
  assert.equal(await testing, false);
  assert.equal(app.competitionLiveConnectionResult, null);
  assert.equal(app.canSaveCompetitionLiveConnection(), false);
});

/** 输入字段变化后必须重新检测。 / Every input change requires another check. */
test('changing the enabled setting invalidates a successful check', async () => {
  const { app } = appFixture();
  await app.testCompetitionLiveConnection();
  app.competitionLiveConnectionForm.enabled = false;
  app.invalidateCompetitionLiveConnectionTest(false);
  assert.equal(app.canSaveCompetitionLiveConnection(), false);
  assert.match(app.getCompetitionLiveConnectionSaveReason(), /重新测试/u);
});

/** 保存失败保留原配置与输入。 / Failed saves preserve previous settings and entered authorization. */
test('failed save retains the original saved connection and never stores error text or codes in result state', async () => {
  const { app } = appFixture({ saveApplicationCompetitionLiveConnection: async () => { throw new Error('sensitive-transport-value'); } });
  const before = app.competitionLiveConnectionSnapshot;
  app.$refs.competitionLiveAccessCodeInput.value = 'oxlive_synthetic_authorization';
  await app.testCompetitionLiveConnection();
  assert.equal(await app.saveCompetitionLiveConnection(), false);
  assert.equal(app.competitionLiveConnectionSnapshot, before);
  assert.equal(app.$refs.competitionLiveAccessCodeInput.value, 'oxlive_synthetic_authorization');
  assert.doesNotMatch(JSON.stringify(app.competitionLiveConnectionResult), /sensitive|synthetic/);
});

/** 保存完成不能覆盖保存期间的新编辑。 / Save completion cannot overwrite newer edits. */
test('successful save applies canonical saved settings while preserving a later draft', async () => {
  const pending = deferred();
  const { app } = appFixture({ saveApplicationCompetitionLiveConnection: () => pending.promise });
  await app.testCompetitionLiveConnection();
  const saving = app.saveCompetitionLiveConnection();
  app.competitionLiveConnectionForm.endpoint = 'https://later.example.test/';
  app.invalidateCompetitionLiveConnectionTest(true);
  pending.resolve({ ok: true, snapshot: snapshot() });
  assert.equal(await saving, true);
  assert.equal(app.competitionLiveConnectionForm.endpoint, 'https://later.example.test/');
  assert.equal(app.competitionLiveConnectionSnapshot.endpoint, 'https://live.example.test/adapter/');
  assert.equal(app.competitionLiveConnectionResult, null);
});

/** 后台读取不覆盖编辑。 / Background reads do not overwrite edits. */
test('loading saved settings preserves a draft edited while the read was pending', async () => {
  const pending = deferred();
  const { app } = appFixture({ getApplicationCompetitionLiveConnection: () => pending.promise });
  const loading = app.loadCompetitionLiveConnection(true);
  app.competitionLiveConnectionForm.endpoint = 'https://draft.example.test/';
  app.invalidateCompetitionLiveConnectionTest(true);
  pending.resolve({ ok: true, snapshot: snapshot() });
  assert.equal(await loading, true);
  assert.equal(app.competitionLiveConnectionForm.endpoint, 'https://draft.example.test/');
  assert.equal(app.competitionLiveConnectionLoading, false);
});

/** 旧读取回执不能覆盖新读取。 / Older reads cannot overwrite newer snapshots. */
test('only the latest read response can replace the saved snapshot', async () => {
  const first = deferred();
  let reads = 0;
  const newest = snapshot({ endpoint: 'https://latest.example.test/' });
  const { app } = appFixture({ getApplicationCompetitionLiveConnection: () => (++reads === 1 ? first.promise : Promise.resolve({ ok: true, snapshot: newest })) });
  const oldRead = app.loadCompetitionLiveConnection(false);
  await app.loadCompetitionLiveConnection(false);
  first.resolve({ ok: true, snapshot: snapshot() });
  assert.equal(await oldRead, false);
  assert.equal(app.competitionLiveConnectionSnapshot.endpoint, 'https://latest.example.test/');
});

/** 清除需确认且不触发任何运行。 / Clearing requires confirmation and never starts a run. */
test('clearing needs explicit confirmation and clears local fields without changing mode', async () => {
  const { app, calls } = appFixture();
  app.competitionAdapterMode = 'fixture';
  assert.equal(await app.clearCompetitionLiveConnection(), false);
  assert.equal(calls.length, 0);
  app.competitionLiveConnectionClearConfirm = true;
  app.$refs.competitionLiveAccessCodeInput.value = 'temporary';
  assert.equal(await app.clearCompetitionLiveConnection(), true);
  assert.equal(app.competitionLiveConnectionForm.endpoint, '');
  assert.equal(app.$refs.competitionLiveAccessCodeInput.value, '');
  assert.equal(app.competitionAdapterMode, 'fixture');
  assert.deepEqual(calls.map(/** 提取操作名。 / Extract operation names. */ item => item.action), ['clear', 'refresh']);
});

/** 地址建议只改草稿，不携带 Fixture 码。 / Suggested URLs change only the draft and never carry Fixture authorization. */
test('using the collaboration URL does not start a request or copy its demo access', () => {
  const { app, calls } = appFixture();
  app.competitionConnectionSnapshot = { endpoint: 'https://shared.example.test/' };
  app.$refs.competitionLiveAccessCodeInput.value = 'temporary';
  assert.equal(app.useCompetitionLiveConnectionSuggestion(), true);
  assert.equal(app.competitionLiveConnectionForm.endpoint, 'https://shared.example.test/');
  assert.equal(app.$refs.competitionLiveAccessCodeInput.value, '');
  assert.equal(calls.length, 0);
});

/** 不可用的系统加密阻止持久化。 / Unavailable OS encryption blocks persistence. */
test('unavailable encryption blocks saving even after a successful probe', async () => {
  const { app } = appFixture();
  app.competitionLiveConnectionSnapshot.storageAvailable = false;
  await app.testCompetitionLiveConnection();
  assert.equal(app.canSaveCompetitionLiveConnection(), false);
  assert.match(app.getCompetitionLiveConnectionSaveReason(), /STORAGE_UNAVAILABLE/);
});

/** 无配置页缓存时仍需遵守 Live 指定协作方式和空间。 / Live runtime and workspace constraints apply without a configuration-page cache. */
test('runtime-profile constraints block builtin and foreign-workspace Live investigations without affecting Fixture', () => {
  const from = source.indexOf('  getCompetitionInvestigationBlocker()');
  const to = source.indexOf('  /**', from);
  const method = vm.runInNewContext(`({${source.slice(from, to)}}).getCompetitionInvestigationBlocker`);
  const app = {
    isCurrentLanguageZh: () => true,
    getCompetitionActiveIncident: () => ({ workspaceId: 'workspace-a' }),
    competitionAdapterMode: 'live', competitionTeamRuntime: 'builtin',
    competitionRuntimeReadiness: { liveRequiredTeamRuntime: 'agentteams', liveWorkspaceId: 'workspace-a', liveExecutionConfigured: true, agentTeamsConfigured: true },
    getCompetitionAvailableTeamTemplates: () => [{ id: 'team-a' }], competitionTeamTemplateId: 'team-a',
  };
  assert.match(method.call(app), /切换为 AgentTeams/u);
  app.competitionTeamRuntime = 'agentteams';
  app.competitionRuntimeReadiness.liveWorkspaceId = 'workspace-b';
  assert.match(method.call(app), /不属于 Live 授权工作空间/u);
  app.competitionAdapterMode = 'fixture';
  app.competitionTeamRuntime = 'builtin';
  assert.equal(method.call(app), '');
});

/** 前置状态与实际启动约束保持一致并导航到正确授权表单。 / Keep preflight status aligned with execution constraints and navigate to the correct authorization form. */
test('Live preflight remains incomplete for the wrong workspace or builtin runtime and opens Live setup', () => {
  const methods = {};
  for (const name of ['getCompetitionDemoPreflight', 'getCompetitionPreflightConfigurationTarget']) {
    const from = source.indexOf(`  ${name}(`);
    const to = source.indexOf('\n  /**', from);
    methods[name] = vm.runInNewContext(`({${source.slice(from, to)}}).${name}`);
  }
  const app = { ...methods, competitionAdapterMode: 'live', competitionTeamRuntime: 'builtin', competitionDemoForm: { workspaceId: 'workspace-a' }, competitionRuntimeReadiness: { liveExecutionConfigured: true, liveRequiredTeamRuntime: 'agentteams', liveWorkspaceId: 'workspace-a' },
    /** 固定中文。 / Use Chinese. */
    isCurrentLanguageZh: () => true,
    /** 使用真实空间标识。 / Retain the actual workspace ID. */
    getCompetitionResolvedWorkspaceId: id => id,
    /** 本例仅聚焦连接约束。 / Focus this case on connection constraints. */
    getCompetitionPrerequisiteSteps: () => [],
  };
  let live = app.getCompetitionDemoPreflight().find(/** 定位 Live 检查项。 / Find the Live check. */ item => item.id === 'live-execution');
  assert.equal(live.done, false);
  assert.match(live.value, /切换为 AgentTeams/u);
  app.competitionTeamRuntime = 'agentteams';
  app.competitionDemoForm.workspaceId = 'workspace-b';
  live = app.getCompetitionDemoPreflight().find(/** 定位 Live 检查项。 / Find the Live check. */ item => item.id === 'live-execution');
  assert.equal(live.done, false);
  assert.match(live.value, /不属于 Live 授权/u);
  assert.equal(app.getCompetitionPreflightConfigurationTarget('agentteams-connection').section, 'live');
  app.competitionAdapterMode = 'fixture';
  assert.equal(app.getCompetitionPreflightConfigurationTarget('agentteams-connection').section, 'agentteams');
});
