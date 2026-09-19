#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 企业审批账户切换边界验收 / Enterprise approval account-switch boundary acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../static/js/vue_methods.js'), 'utf8');
const methods = new Map();
/** 从实际产品文件提取方法，不复制实现。 / Extract methods from the actual product file without duplicating implementation. */
function findMethods(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ObjectMethod') methods.set(node.key.name, source.slice(node.start, node.end));
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(findMethods);
    else if (value && typeof value === 'object') findMethods(value);
  }
}
findMethods(parse(source, { sourceType: 'script' }));

/** 创建可控制完成时间的隔离异步回执。 / Create an isolated response with explicitly controlled settlement. */
function deferred() {
  let resolve; let reject;
  const promise = new Promise(/** 保存仅供测试的完成句柄。 / Capture completion handles for tests only. */ (yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** 执行真实方法并记录账户切换后的所有写回与额外调用。 / Execute a real method and record every write or extra call after account replacement. */
function createHost(name) {
  const gate = deferred(); const late = []; const sent = [];
  let switched = false;
  const incident = { incidentId: 'incident-a', workspaceId: 'workspace-a', activeTraceId: 'trace-a', activeApprovalId: 'approval-a' };
  const approval = { approvalId: 'approval-a', status: 'PENDING', planDigest: 'a'.repeat(64) };
  /** 记录调用并返回统一可控回执。 / Record a call and return the controlled response. */
  function delayed(label) { return (...args) => { sent.push({ label, args }); if (switched) late.push(label); return gate.promise; }; }
  /** 记录不得跨账户调用的同步副作用。 / Record synchronous effects that must never cross account boundaries. */
  function effect(label) { return () => { if (switched) late.push(label); }; }
  const runtime = Object.fromEntries(['getApplicationCompetitionSnapshot', 'getApplicationCompetitionUiProfile', 'resetApplicationCompetitionDemoData', 'createApplicationCompetitionIncident', 'runApplicationCompetitionInvestigation', 'decideApplicationCompetitionApproval', 'executeApplicationCompetitionRollback', 'verifyApplicationCompetitionRemediation', 'setApplicationCompetitionAdapterMode', 'startApplicationCompetitionEnterpriseTask'].map(/** 仅提供有界接口替身，不连接服务。 / Provide bounded interface doubles without service access. */ key => [key, delayed(key)]));
  const scope = { key: 'group-a', workspaceId: 'workspace-a', projectId: null };
  const target = {
    competitionProgressPollGeneration: 1, enterpriseApprovalAccountKey: 'account-a', canUseEnterprise: true,
    competitionBusyAction: '', competitionLoading: false, competitionRehearsalAvailable: true, competitionRehearsalVisible: true,
    competitionDemoScenarioMode: 'recovery', competitionDemoForm: { workspaceId: 'workspace-a', scenario: {} },
    competitionAdapterMode: 'fixture', competitionExecutionMode: 'step', competitionApprovalReason: 'Reviewed',
    enterpriseWorkspaces: [{ id: 'workspace-a' }], competitionTeamRuntime: 'builtin', competitionTeamTemplateId: '',
    enterpriseTab: 'chat', enterpriseChatInput: 'Investigate', enterpriseChatTaskStarting: false, enterpriseChatSending: false,
    enterpriseChatRecipientIds: [], enterpriseChatScopeKey: scope.key,
    enterpriseChatPending: new Proxy({}, { /** 捕获迟到 finally 删除新会话待办。 / Detect late finally blocks deleting new-session pending work. */ deleteProperty(object, key) { if (switched) late.push('delete-pending'); return Reflect.deleteProperty(object, key); } }),
    /** 返回隔离接口。 / Return isolated interfaces. */ getApplicationCompetitionRuntime() { return runtime; },
    /** 返回当前样例事件。 / Return the fixture incident. */ getCompetitionActiveIncident() { return incident; },
    /** 返回当前样例审批。 / Return the fixture approval. */ getCompetitionActiveApproval() { return approval; },
    /** 返回当前样例动作。 / Return the fixture action. */ getCompetitionActiveAction() { return { actionId: 'action-a' }; },
    /** 样例已满足前置条件。 / The fixture satisfies prerequisites. */ getCompetitionInvestigationBlocker() { return ''; },
    /** 固定语言不依赖桌面环境。 / Keep language independent of desktop state. */ isCurrentLanguageZh() { return true; },
    /** 模拟既有群范围。 / Simulate the existing group scope. */ ensureEnterpriseChatScope() { return scope; },
    /** 故意保持旧群ID相同，验证账户边界独立生效。 / Keep group IDs unchanged deliberately to prove independent account protection. */ isEnterpriseChatScopeCurrent() { return true; },
    /** 输出固定测试文案。 / Return fixed test copy. */ enterpriseChatText(zh) { return zh; },
    $confirm: delayed('confirm'), loadCompetitionUiProfile: delayed('profile'), openEnterpriseTab: delayed('open-tab'),
    openOperationsRun: delayed('open-run'), loadCompetitionMemoryArtifacts: delayed('memory'), loadEnterpriseMessages: delayed('messages'),
    loadCompetitionSnapshot: delayed('snapshot-recovery'), selectCompetitionIncident: delayed('select-incident'),
    applyOperationsRuntimeSnapshot: effect('apply-snapshot'), setEnterpriseChatActionError: effect('set-chat-error'),
  };
  const host = new Proxy(target, { /** 记录异步阶段所有响应写回。 / Record all response writes after the async boundary. */ set(object, key, value) { if (switched) late.push(`set:${String(key)}`); return Reflect.set(object, key, value); } });
  const context = { console: { error() {}, warn() {} }, showNotification: effect('notification'), window: { openxnetDesktop: { getSynapxnetMemoryStatus: delayed('memory-status'), listSynapxnetMemories: delayed('memory-list') } } };
  const method = vm.runInNewContext(`({${methods.get(name)}}).${name}`, context);
  return { host, gate, late, sent, method, /** 改账户或代数，模拟新会话已有自己的忙碌状态。 / Replace account or generation while preserving the new session's busy state. */ switchAccount(kind) {
    if (kind === 'generation') target.competitionProgressPollGeneration += 1;
    else target.enterpriseApprovalAccountKey = 'account-b';
    target.competitionBusyAction = 'new-account-work'; target.competitionLoading = true;
    target.enterpriseChatTaskStarting = true; target.competitionMemoryLoading = true;
    switched = true;
  } };
}

const cases = [
  ['loadCompetitionSnapshot'], ['resetCompetitionDemoData'], ['openCompetitionRehearsal'],
  ['openOperationsNoticeTarget', { workspaceId: 'workspace-a', incidentId: 'incident-a', traceId: 'trace-a' }],
  ['createCompetitionDemoIncident'], ['runCompetitionInvestigation'], ['decideCompetitionApproval', 'APPROVED'],
  ['executeCompetitionRollback', false], ['verifyCompetitionRemediation'], ['setCompetitionAdapterMode', 'fixture'],
  ['startEnterpriseCompetitionTask'], ['loadCompetitionUiProfile'], ['loadCompetitionMemoryArtifacts'], ['openOperationsRun', 'incident-a'],
];
for (const [name, argument] of cases) {
  test(`${name} ignores old-session success, failure and finalization`, /** 同时验证账户标识和观察代数单独变化的边界。 / Verify independent changes to account identity and observation generation. */ async () => {
    for (const kind of ['generation', 'account']) for (const fail of [false, true]) {
      const harness = createHost(name);
      const pending = harness.method.call(harness.host, argument);
      assert.ok(harness.sent.length > 0, `${name} reached an actual asynchronous boundary`);
      const initialCalls = harness.sent.length;
      harness.switchAccount(kind);
      if (fail) harness.gate.reject(new Error('Old account response failed'));
      else harness.gate.resolve({ incidents: [], approvals: [], snapshot: { incidents: [], approvals: [] } });
      await Promise.resolve(pending).catch(/** 配置读取仍可向其守卫调用方抛错，不改UI。 / Configuration reads may reject to guarded callers without changing UI. */ () => {});
      assert.deepEqual(harness.late, [], `${name}: ${kind}, fail=${fail}`);
      assert.equal(harness.sent.length, initialCalls, 'An old response must never dispatch new work');
      assert.equal(harness.host.competitionBusyAction, 'new-account-work');
    }
  });
}

test('public approval summaries redact demo and Live access codes', /** 使用虚构凭证验证公开摘要不暴露访问码。 / Verify public summaries redact synthetic access codes. */ () => {
  const method = vm.runInNewContext(`({${methods.get('getCompetitionApprovalPublicText')}}).getCompetitionApprovalPublicText`);
  assert.equal(method(`Demo oxdemo_${'a'.repeat(30)} Live oxlive_${'b'.repeat(30)}`), 'Demo [redacted] Live [redacted]');
});
