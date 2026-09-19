/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
全局人工审批隔离与复核行为测试 / Global human approval isolation and revalidation behavior tests.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { parse } = require('@babel/parser');
const notices = require('../static/js/openxnet-enterprise-approval-notices.js');
const { parseDecideApplicationCompetitionApprovalRequest } = require('../build-ts/desktop/contracts/application-competition-runtime.js');
const source = fs.readFileSync(path.join(__dirname, '../static/js/vue_methods.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });
const declaration = ast.program.body.find(/** 定位真实宿主方法表。 Locate the real host method table. */ node => node.type === 'VariableDeclaration' && node.declarations.some(/** 匹配宿主变量。 Match the host variable. */ item => item.id.name === 'vue_methods'));
const sanitizerNode = declaration.declarations.find(/** 提取宿主声明。 Extract the host declaration. */ item => item.id.name === 'vue_methods').init.properties.find(/** 使用生产脱敏实现。 Use the production sanitizer implementation. */ item => item.key?.name === 'getCompetitionApprovalPublicText');
const sanitizer = vm.runInNewContext(`({${source.slice(sanitizerNode.start, sanitizerNode.end)}})`).getCompetitionApprovalPublicText;

/** 拷贝快照以独立模拟服务端状态变化。 Copy a snapshot to simulate an independent server state change. */
function copy(value) { return JSON.parse(JSON.stringify(value)); }

/** 创建完整绑定的真实形状审批记录。 Build an approval record with complete bindings in the real contract shape. */
function fixture(suffix = 'a', workspaceId = `workspace-${suffix}`) {
  const incident = { incidentId: `incident-${suffix}`, workspaceId, activeApprovalId: `approval-${suffix}`, activeTraceId: `trace-${suffix}`, status: 'AWAITING_APPROVAL', title: `业务恢复 ${suffix}`, summary: '恢复业务通过率' };
  const approval = { approvalId: incident.activeApprovalId, incidentId: incident.incidentId, workspaceId, traceId: incident.activeTraceId,
    planId: `plan-${suffix}`, planDigest: (suffix === 'b' ? 'b' : 'a').repeat(64), status: 'PENDING', reason: '待审核的恢复计划', requestedBy: 'goai-leader', requestedAt: '2026-09-18T01:00:00Z',
    scopes: [{ stepId: 'repair', toolName: 'data.repair', resourceId: 'resource-one', targetRevision: 3, expectedResourceVersion: 'version-2', argumentsDigest: 'c'.repeat(64), compensation: false },
      { stepId: 'undo', toolName: 'data.restore', resourceId: 'resource-one', targetRevision: 3, expectedResourceVersion: 'version-2', argumentsDigest: 'd'.repeat(64), compensation: true }] };
  return { incident, approval };
}

/** 合并审批记录为跨空间快照。 Combine approval records into an all-workspace snapshot. */
function snapshot(...entries) {
  return { incidents: entries.map(/** 提取事件。 Extract incidents. */ entry => entry.incident), approvals: entries.map(/** 提取审批。 Extract approvals. */ entry => entry.approval), taskGraphs: [], residentContexts: [], updatedAt: '2026-09-18T01:00:00Z' };
}

/** 构造审批回执，事件可继续执行但审批决定已持久化。 Build a decision receipt while allowing the incident to continue its workflow. */
function decided(value, decision = 'APPROVED') {
  const result = copy(value);
  result.approvals[0].status = decision;
  result.incidents[0].status = decision === 'APPROVED' ? 'MITIGATING' : 'REJECTED';
  result.updatedAt = '2026-09-18T01:00:01Z';
  return { snapshot: result };
}

/** 创建不会导航、执行或真实联网的行为宿主。 Create a behavior host that cannot navigate, execute or perform real network calls. */
function createHost(value = snapshot(fixture()), overrides = {}) {
  const requests = [];
  const host = { ...notices.createState(), ...notices.methods, canUseEnterprise: true,
    enterpriseWorkspaces: [{ id: 'workspace-a', name: '风控工作空间' }, { id: 'workspace-b', name: '数据工作空间' }],
    competitionSnapshot: value, competitionSelectedIncidentId: 'unrelated-selected-incident', operationsWorkspaceFilter: 'unrelated-workspace',
    getCompetitionApprovalPublicText: sanitizer,
    /** 选择测试语言。 Select the test language. */ isCurrentLanguageZh() { return true; },
    /** 只记录快照应用，不产生其他页面副作用。 Record snapshot application without side effects in other pages. */ applyOperationsRuntimeSnapshot(next) { this.competitionSnapshot = next; this.syncEnterpriseApprovalNotices(next); },
    /** 提供可控只读和审批边界。 Provide controllable read-only and decision boundaries. */ getApplicationCompetitionRuntime() {
      return { /** 读取可控快照。 Read the controlled snapshot. */ async getApplicationCompetitionSnapshot() { return copy(value); },
        /** 通过真实后端契约校验后记录请求，身份由IPC边界添加。 Record the request after real backend contract validation, with identity added at the IPC boundary. */ async decideApplicationCompetitionApproval(request) { parseDecideApplicationCompetitionApprovalRequest({ ...request, actorId: 'human-operator' }); requests.push(request); return decided(value, request.decision); },
        /** 禁止由提醒层执行动作。 Forbid execution by the notice layer. */ executeApplicationCompetitionRollback() { throw new Error('Unexpected execution'); } };
    },
    /** 禁止提醒层切换当前事件。 Forbid incident selection by the notice layer. */ selectCompetitionIncident() { throw new Error('Unexpected selection'); },
    /** 禁止提醒层打开其他页面。 Forbid page navigation by the notice layer. */ openEnterpriseTab() { throw new Error('Unexpected navigation'); },
    ...overrides,
  };
  return { host, requests };
}

/** 控制异步请求返回顺序。 Control asynchronous request completion order. */
function deferred() {
  let resolve; let reject;
  const promise = new Promise(/** 暴露测试专用完成器。 Expose test-only completion callbacks. */ (yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('restored pending approvals open immediately and repeated polling preserves the frozen review', /** 验证首次恢复和重复轮询。 Verify initial recovery and repeated polling. */ () => {
  const value = snapshot(fixture()); const { host } = createHost(value);
  host.syncEnterpriseApprovalNotices(value);
  assert.equal(host.enterpriseApprovalNoticeVisible, true); assert.equal(host.getEnterpriseApprovalNoticeCount(), 1);
  const target = host.enterpriseApprovalNoticeTarget; const view = host.getEnterpriseApprovalNoticeViewModel();
  assert.equal(Object.isFrozen(target), true); assert.equal(Object.isFrozen(target.scopes[0]), true);
  host.syncEnterpriseApprovalNotices(copy(value));
  assert.equal(host.enterpriseApprovalNoticeTarget, target); assert.equal(host.getEnterpriseApprovalNoticeViewModel(), view);
  assert.equal(host.competitionSelectedIncidentId, 'unrelated-selected-incident');
  value.approvals[0].scopes[0].resourceId = 'mutated-outside';
  assert.equal(target.scopes[0].resourceId, 'resource-one');
});

test('closing suppresses repeated automatic notices but keeps the count and permits manual reopening', /** 验证稍后处理和手动重开。 Verify deferred review and manual reopening. */ () => {
  const value = snapshot(fixture()); const { host, requests } = createHost(value);
  host.syncEnterpriseApprovalNotices(value); host.enterpriseApprovalNoticeExecutionMode = 'automatic';
  assert.equal(host.closeEnterpriseApprovalNotice(), true); host.syncEnterpriseApprovalNotices(copy(value));
  assert.equal(host.enterpriseApprovalNoticeVisible, false); assert.equal(host.getEnterpriseApprovalNoticeCount(), 1);
  assert.equal(host.openEnterpriseApprovalNotice(), true); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'automatic');
  assert.equal(requests.length, 0);
});

test('new approvals across workspaces queue without replacing the current review', /** 验证多空间队列不抢占。 Verify all-workspace queuing without focus stealing. */ () => {
  const first = fixture(); const second = fixture('b'); const value = snapshot(first); const { host } = createHost(value);
  host.syncEnterpriseApprovalNotices(value); const original = host.enterpriseApprovalNoticeTarget;
  host.syncEnterpriseApprovalNotices(snapshot(first, second));
  assert.equal(host.getEnterpriseApprovalNoticeCount(), 2); assert.equal(host.enterpriseApprovalNoticeTarget, original);
  assert.equal(host.openEnterpriseApprovalNotice('approval-b'), false);
  host.closeEnterpriseApprovalNotice(); host.syncEnterpriseApprovalNotices(snapshot(first, second));
  assert.equal(host.enterpriseApprovalNoticeTarget.approvalId, 'approval-b');
  assert.equal(host.getEnterpriseApprovalNoticeViewModel().workspaceName, '数据工作空间');
});

test('inactive traces, foreign workspaces, nonpending approvals and incomplete scopes cannot be reviewed', /** 验证每项当前绑定条件。 Verify every current-binding condition. */ () => {
  const variants = [
    /** 改变事件状态。 Change incident state. */ item => { item.incident.status = 'RESOLVED'; },
    /** 改变活动审批。 Change the active approval. */ item => { item.incident.activeApprovalId = 'old'; },
    /** 改变活动追踪。 Change the active trace. */ item => { item.incident.activeTraceId = 'new'; },
    /** 改变审批空间。 Change the approval workspace. */ item => { item.approval.workspaceId = 'foreign'; },
    /** 改变审批事件。 Change the approval incident. */ item => { item.approval.incidentId = 'foreign'; },
    /** 改变审批状态。 Change approval status. */ item => { item.approval.status = 'APPROVED'; },
    /** 移除计划摘要。 Remove the plan digest. */ item => { item.approval.planDigest = ''; },
    /** 移除授权范围。 Remove authorization scopes. */ item => { item.approval.scopes = []; },
    /** 移除资源版本。 Remove the resource version. */ item => { item.approval.scopes[0].expectedResourceVersion = ''; },
  ];
  for (const change of variants) {
    const entry = fixture(); change(entry); const { host } = createHost(snapshot(entry));
    host.syncEnterpriseApprovalNotices(snapshot(entry));
    assert.equal(host.getEnterpriseApprovalNoticeCount(), 0); assert.equal(host.openEnterpriseApprovalNotice(), false);
  }
});

test('duplicate records are deduplicated and conflicting identities fail closed', /** 验证去重和冲突拒绝。 Verify deduplication and rejection of conflicting identities. */ () => {
  const entry = fixture(); const { host } = createHost();
  host.syncEnterpriseApprovalNotices(snapshot(entry, copy(entry))); assert.equal(host.getEnterpriseApprovalNoticeCount(), 1);
  const changed = copy(entry); changed.approval.planDigest = 'other-plan';
  const { host: conflict } = createHost(); conflict.syncEnterpriseApprovalNotices(snapshot(entry, changed));
  assert.equal(conflict.getEnterpriseApprovalNoticeCount(), 0); assert.equal(conflict.enterpriseApprovalNoticeVisible, false);
  changed.approval = copy(entry.approval); changed.incident.activeTraceId = 'conflicting-trace';
  conflict.syncEnterpriseApprovalNotices(snapshot(entry, changed)); assert.equal(conflict.getEnterpriseApprovalNoticeCount(), 0);
});

test('the public review uses exact graph and source bindings and sanitizes all displayed strings', /** 验证公开展示绑定及脱敏。 Verify public display bindings and sanitization. */ () => {
  const entry = fixture(); entry.approval.reason = '说明 api_key=PRIVATE_SECRET https://demo.test/path?token=PRIVATE_QUERY';
  entry.incident.title = '恢复 Bearer PRIVATE_BEARER'; const value = snapshot(entry);
  value.residentContexts = [{ workspaceId: 'workspace-a', incidentId: 'incident-a', traceId: 'trace-a', source: 'LIVE-STAGING' }, { workspaceId: 'workspace-b', incidentId: 'incident-a', traceId: 'trace-a', source: 'SIMULATION' }];
  value.taskGraphs = [
    { workspaceId: 'workspace-b', incidentId: 'incident-a', traceId: 'trace-a', revision: 99, nodes: [{ nodeId: 'execute:repair', toolName: 'data.repair', title: 'FOREIGN_TITLE' }] },
    { workspaceId: 'workspace-a', incidentId: 'incident-a', traceId: 'trace-a', revision: 1, nodes: [{ nodeId: 'execute:repair', toolName: 'data.repair', title: '修复特征输入' }] },
  ];
  const { host } = createHost(value); host.syncEnterpriseApprovalNotices(value); const view = host.getEnterpriseApprovalNoticeViewModel();
  assert.equal(view.sourceLabel, 'Live 现场'); assert.equal(view.scopes[0].title, '修复特征输入');
  assert.equal(view.scopes[1].compensation, true); assert.equal(view.scopes[0].targetRevision, 3);
  assert.doesNotMatch(JSON.stringify(view), /PRIVATE_|FOREIGN_TITLE/);
  const before = JSON.stringify(view); value.taskGraphs[1].nodes[0].title = 'Changed after review'; host.syncEnterpriseApprovalNotices(value);
  assert.equal(JSON.stringify(host.getEnterpriseApprovalNoticeViewModel()), before);
});

test('a refreshed handled approval is never submitted and the original dialog becomes stale', /** 验证已处理审批阻断旧决定。 Verify a handled approval blocks the old decision. */ async () => {
  const value = snapshot(fixture()); let writes = 0;
  const { host } = createHost(value, { /** 提供已处理的最新状态。 Provide a freshly handled approval. */ getApplicationCompetitionRuntime() { return {
    /** 返回已处理快照。 Return a handled snapshot. */ async getApplicationCompetitionSnapshot() { return decided(value).snapshot; },
    /** 捕获任何错误写入。 Count any erroneous write. */ async decideApplicationCompetitionApproval() { writes += 1; },
  }; } });
  host.syncEnterpriseApprovalNotices(value); const original = host.enterpriseApprovalNoticeTarget;
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false);
  assert.equal(writes, 0); assert.equal(host.enterpriseApprovalNoticeStale, true); assert.equal(host.enterpriseApprovalNoticeTarget, original);
  assert.match(host.enterpriseApprovalNoticeError, /没有提交/);
});

test('plan identifiers, digests and every scope binding are rechecked before submitting', /** 验证计划及每项授权字段的二次核对。 Verify revalidation of the plan and every authorization field. */ async () => {
  const changes = [
    /** 改变计划身份。 Change plan identity. */ approval => { approval.planId += '-new'; },
    /** 改变计划摘要。 Change plan digest. */ approval => { approval.planDigest = 'e'.repeat(64); },
    /** 改变步骤键。 Change the step key. */ approval => { approval.scopes[0].stepId = 'new'; },
    /** 改变工具。 Change the tool. */ approval => { approval.scopes[0].toolName = 'other'; },
    /** 改变资源。 Change the resource. */ approval => { approval.scopes[0].resourceId = 'other'; },
    /** 改变目标修订。 Change the target revision. */ approval => { approval.scopes[0].targetRevision += 1; },
    /** 改变资源版本。 Change the resource version. */ approval => { approval.scopes[0].expectedResourceVersion += '-new'; },
    /** 改变参数摘要。 Change the argument digest. */ approval => { approval.scopes[0].argumentsDigest = 'e'.repeat(64); },
    /** 改变补偿标记。 Change the compensation flag. */ approval => { approval.scopes[0].compensation = true; },
    /** 改变范围顺序。 Change scope order. */ approval => { approval.scopes.reverse(); },
  ];
  for (const change of changes) {
    const value = snapshot(fixture()); const fresh = copy(value); change(fresh.approvals[0]); let writes = 0;
    const { host } = createHost(value, { /** 提供发生变化的只读状态。 Provide changed read-only state. */ getApplicationCompetitionRuntime() { return {
      /** 返回变更后的快照。 Return the changed snapshot. */ async getApplicationCompetitionSnapshot() { return fresh; },
      /** 捕获错误写入。 Count erroneous writes. */ async decideApplicationCompetitionApproval() { writes += 1; },
    }; } });
    host.syncEnterpriseApprovalNotices(value); assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(writes, 0);
    assert.equal(host.enterpriseApprovalNoticeStale, true);
  }
});

test('default approval pauses, sends the expected digest and preserves a completed original item', /** 验证默认暂停与决定回执。 Verify default pause and the decision receipt. */ async () => {
  const value = snapshot(fixture()); const { host, requests } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), true);
  assert.equal(requests.length, 1); assert.equal(requests[0].executionMode, 'step'); assert.equal(requests[0].expectedPlanDigest, 'a'.repeat(64));
  assert.match(requests[0].reason, /用户在人工审批弹窗中选择/); assert.match(requests[0].reason, /暂停/);
  assert.equal(host.enterpriseApprovalNoticeVisible, true); assert.equal(host.enterpriseApprovalNoticeOutcome, 'APPROVED');
  assert.equal(host.enterpriseApprovalNoticeOutcomeRecovered, false);
  assert.equal(host.enterpriseApprovalNoticeStale, true); assert.equal(host.getEnterpriseApprovalNoticeCount(), 0);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(requests.length, 1);
});

test('automatic execution must be explicitly selected and rejection always uses step mode', /** 验证明确自动模式和拒绝边界。 Verify explicit automatic mode and rejection boundaries. */ async () => {
  for (const decision of ['APPROVED', 'REJECTED']) {
    const value = snapshot(fixture()); const { host, requests } = createHost(value); host.syncEnterpriseApprovalNotices(value);
    host.enterpriseApprovalNoticeExecutionMode = 'automatic'; host.enterpriseApprovalNoticeReason = '审核具体计划';
    assert.equal(await host.submitEnterpriseApprovalNotice(decision), true);
    assert.equal(requests[0].executionMode, decision === 'APPROVED' ? 'automatic' : 'step'); assert.equal(requests[0].reason, '审核具体计划');
  }
});

test('a pending request blocks duplicate clicks, closing and switching and freezes the selected mode', /** 验证异步提交防重及模式冻结。 Verify asynchronous submission deduplication and frozen execution mode. */ async () => {
  const value = snapshot(fixture(), fixture('b')); const read = deferred(); const writes = [];
  const { host } = createHost(value, { /** 注入延迟读取。 Inject a delayed read. */ getApplicationCompetitionRuntime() { return {
    /** 延迟返回快照。 Delay returning the snapshot. */ getApplicationCompetitionSnapshot() { return read.promise; },
    /** 记录批准模式。 Record the approval mode. */ async decideApplicationCompetitionApproval(request) { writes.push(request); return decided(value); },
  }; } });
  host.syncEnterpriseApprovalNotices(value); const submission = host.submitEnterpriseApprovalNotice('APPROVED');
  assert.equal(host.enterpriseApprovalNoticeBusy, true); assert.equal(host.closeEnterpriseApprovalNotice(), false); assert.equal(host.openEnterpriseApprovalNotice('approval-b'), false);
  assert.equal(host.selectEnterpriseApprovalNotice('approval-b'), false); assert.equal(Object.keys(host.enterpriseApprovalNoticeDrafts).length, 0);
  assert.equal(await host.submitEnterpriseApprovalNotice('REJECTED'), false);
  host.enterpriseApprovalNoticeExecutionMode = 'automatic'; read.resolve(value);
  assert.equal(await submission, true); assert.equal(writes.length, 1); assert.equal(writes[0].executionMode, 'step');
  assert.equal(host.enterpriseApprovalNoticeTarget.approvalId, 'approval-a'); assert.equal(host.getEnterpriseApprovalNoticeCount(), 1);
});

test('failed requests remain reviewable and retries re-read state instead of blindly replaying', /** 验证失败保留和重试复核。 Verify failure preservation and read-before-retry behavior. */ async () => {
  const value = snapshot(fixture()); let reads = 0; let writes = 0;
  const { host } = createHost(value, { /** 提供一次失败后成功的审批边界。 Provide an approval boundary that fails once then succeeds. */ getApplicationCompetitionRuntime() { return {
    /** 记录每次只读复核。 Count each read-only revalidation. */ async getApplicationCompetitionSnapshot() { reads += 1; return copy(value); },
    /** 首次失败后允许显式重试。 Fail once and permit an explicit retry. */ async decideApplicationCompetitionApproval() { writes += 1; if (writes === 1) throw new Error('暂不可用 token=PRIVATE_ERROR'); return decided(value); },
  }; } });
  host.syncEnterpriseApprovalNotices(value); const target = host.enterpriseApprovalNoticeTarget;
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(host.enterpriseApprovalNoticeTarget, target);
  assert.equal(host.enterpriseApprovalNoticeBusy, false); assert.equal(host.enterpriseApprovalNoticeStale, false); assert.doesNotMatch(host.enterpriseApprovalNoticeError, /PRIVATE_ERROR/);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), true); assert.equal(reads, 3); assert.equal(writes, 2);
});

test('explicit permission is required even when the property is undefined', /** 验证未定义权限也拒绝。 Verify undefined permission also denies access. */ async () => {
  for (const permission of [false, undefined, null, 'true']) {
    const value = snapshot(fixture()); const { host, requests } = createHost(value, { canUseEnterprise: permission });
    host.syncEnterpriseApprovalNotices(value); assert.equal(host.enterpriseApprovalNoticeVisible, false); assert.equal(host.getEnterpriseApprovalNoticeCount(), 0);
    assert.equal(host.openEnterpriseApprovalNotice(), false); assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(requests.length, 0);
  }
});

test('permission loss during the read prevents any decision and backend denials remain errors', /** 验证权限撤销和服务端拒绝。 Verify permission revocation and backend rejection. */ async () => {
  const value = snapshot(fixture()); const read = deferred(); let writes = 0;
  const { host } = createHost(value, { /** 注入可撤销权限的读取边界。 Inject a read boundary during which permission can be revoked. */ getApplicationCompetitionRuntime() { return {
    /** 返回延迟读取。 Return the delayed read. */ getApplicationCompetitionSnapshot() { return read.promise; },
    /** 捕获任何不应发生的写入。 Count any prohibited write. */ async decideApplicationCompetitionApproval() { writes += 1; },
  }; } });
  host.syncEnterpriseApprovalNotices(value); const submission = host.submitEnterpriseApprovalNotice('APPROVED'); host.canUseEnterprise = false; read.resolve(value);
  assert.equal(await submission, false); assert.equal(writes, 0);
  const { host: denied } = createHost(value, { /** 提供真实形状的服务端拒绝。 Provide a contract-shaped backend denial. */ getApplicationCompetitionRuntime() { return {
    /** 返回当前状态。 Return current state. */ async getApplicationCompetitionSnapshot() { return value; },
    /** 拒绝未经授权的审批。 Deny unauthorized approval. */ async decideApplicationCompetitionApproval() { throw new Error('APPROVER_PERMISSION_DENIED'); },
  }; } });
  denied.syncEnterpriseApprovalNotices(value); assert.equal(await denied.submitEnterpriseApprovalNotice('APPROVED'), false);
  assert.equal(denied.enterpriseApprovalNoticeOutcome, ''); assert.match(denied.enterpriseApprovalNoticeError, /PERMISSION_DENIED/);
});

test('logout during a read suppresses late submission and requires a new enabled session', /** 验证退出登录后的读取隔离。 Verify read isolation after logout. */ async () => {
  const value = snapshot(fixture()); const read = deferred(); let writes = 0;
  const { host } = createHost(value, { /** 提供延迟只读边界。 Provide a delayed read-only boundary. */ getApplicationCompetitionRuntime() { return {
    /** 返回延迟快照。 Return a delayed snapshot. */ getApplicationCompetitionSnapshot() { return read.promise; },
    /** 捕获旧会话写入。 Count old-session writes. */ async decideApplicationCompetitionApproval() { writes += 1; },
  }; } });
  host.syncEnterpriseApprovalNotices(value); const submission = host.submitEnterpriseApprovalNotice('APPROVED'); host.resetEnterpriseApprovalNotices();
  read.resolve(value); assert.equal(await submission, false); assert.equal(writes, 0); assert.equal(host.enterpriseApprovalNoticeVisible, false);
  host.syncEnterpriseApprovalNotices(value); assert.equal(host.enterpriseApprovalNoticeVisible, false);
  host.resetEnterpriseApprovalNotices(true); host.syncEnterpriseApprovalNotices(value); assert.equal(host.enterpriseApprovalNoticeVisible, true);
});

test('a late decision receipt from a logged-out session cannot replace a new review', /** 验证退出后的写回执不会污染新会话。 Verify an old decision receipt cannot contaminate a new session. */ async () => {
  const first = snapshot(fixture()); const second = snapshot(fixture('b')); const write = deferred();
  const { host } = createHost(first, { /** 提供延迟写回执。 Provide a delayed decision receipt. */ getApplicationCompetitionRuntime() { return {
    /** 读取当前审批。 Read the current approval. */ async getApplicationCompetitionSnapshot() { return first; },
    /** 延迟返回决定结果。 Delay the decision result. */ decideApplicationCompetitionApproval() { return write.promise; },
  }; } });
  host.syncEnterpriseApprovalNotices(first); const submission = host.submitEnterpriseApprovalNotice('APPROVED'); await Promise.resolve();
  host.resetEnterpriseApprovalNotices(false); host.resetEnterpriseApprovalNotices(true); host.syncEnterpriseApprovalNotices(second);
  const target = host.enterpriseApprovalNoticeTarget; write.resolve(decided(first));
  assert.equal(await submission, false); assert.equal(host.enterpriseApprovalNoticeTarget, target); assert.equal(target.approvalId, 'approval-b');
  assert.equal(host.enterpriseApprovalNoticeOutcome, ''); assert.equal(host.enterpriseApprovalNoticeBusy, false);
});

test('a changed plan discovered by polling never retargets the old approve button', /** 验证轮询换计划后旧按钮不复用。 Verify polling a new plan never reuses the old approve button. */ async () => {
  const value = snapshot(fixture()); const { host, requests } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  const old = host.enterpriseApprovalNoticeTarget; const next = copy(value); next.approvals[0].planDigest = 'e'.repeat(64);
  host.syncEnterpriseApprovalNotices(next); assert.equal(host.enterpriseApprovalNoticeTarget, old); assert.equal(host.enterpriseApprovalNoticeStale, true);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(requests.length, 0);
  host.closeEnterpriseApprovalNotice(); host.syncEnterpriseApprovalNotices(next);
  assert.equal(host.enterpriseApprovalNoticeTarget.planDigest, 'e'.repeat(64)); assert.equal(host.enterpriseApprovalNoticeStale, false);
});

test('a stale snapshot cannot reopen an already handled approval', /** 验证过期快照不会复活已处理审批。 Verify an outdated snapshot cannot revive a handled approval. */ () => {
  const value = snapshot(fixture()); const { host } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  host.syncEnterpriseApprovalNotices(decided(value).snapshot); host.closeEnterpriseApprovalNotice(); host.syncEnterpriseApprovalNotices(value);
  assert.equal(host.enterpriseApprovalNoticeVisible, false); assert.equal(host.getEnterpriseApprovalNoticeCount(), 0);
});

test('an automatic workflow failure after persisted approval is read back without resubmitting', /** 验证已批准后的自动执行异常不会重放审批。 Verify an automatic execution failure after persisted approval cannot replay approval. */ async () => {
  const value = snapshot(fixture()); let stored = value; let writes = 0; let reads = 0;
  const { host } = createHost(value, { /** 提供先保存审批再执行异常的运行时。 Provide a runtime that persists approval before execution fails. */ getApplicationCompetitionRuntime() { return {
    /** 回读最新持久状态。 Read back the latest persisted state. */ async getApplicationCompetitionSnapshot() { reads += 1; return copy(stored); },
    /** 保存审批后模拟验证异常。 Persist approval then simulate a verification error. */ async decideApplicationCompetitionApproval(request) { writes += 1; assert.equal(request.executionMode, 'automatic'); stored = decided(value).snapshot; throw new Error('VERIFIER_UNAVAILABLE api_key=PRIVATE_EXECUTION'); },
  }; } });
  host.syncEnterpriseApprovalNotices(value); host.enterpriseApprovalNoticeExecutionMode = 'automatic';
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false);
  assert.equal(reads, 2); assert.equal(writes, 1); assert.equal(host.enterpriseApprovalNoticeOutcome, 'APPROVED');
  assert.equal(host.enterpriseApprovalNoticeStale, true); assert.equal(host.enterpriseApprovalNoticeOutcomeRecovered, true);
  assert.match(host.enterpriseApprovalNoticeError, /已有审批决定.*未收到完整回执/);
  assert.doesNotMatch(host.enterpriseApprovalNoticeError, /PRIVATE_EXECUTION/);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(writes, 1);
});

test('a read error followed by another actor decision never claims that this request succeeded', /** 验证读取阶段别人的审批不冒充本次成功。 Verify another actor's decision during reads never becomes this request's success. */ async () => {
  const value = snapshot(fixture()); let reads = 0; let writes = 0;
  const { host } = createHost(value, { /** 模拟初次读取失败后其他人完成审批。 Simulate an initial read failure followed by another actor completing approval. */ getApplicationCompetitionRuntime() { return {
    /** 返回其他人的决定。 Return another actor's decision. */ async getApplicationCompetitionSnapshot() { reads += 1; if (reads === 1) throw new Error('Read failed'); return decided(value).snapshot; },
    /** 捕获任何错误写入。 Count any erroneous write. */ async decideApplicationCompetitionApproval() { writes += 1; },
  }; } });
  host.syncEnterpriseApprovalNotices(value); assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false);
  assert.equal(writes, 0); assert.equal(host.enterpriseApprovalNoticeOutcome, ''); assert.equal(host.enterpriseApprovalNoticeStale, true);
  assert.match(host.enterpriseApprovalNoticeError, /未将其他人的决定/);
});

test('an unconfirmed decision outcome stays explicit and the next attempt reads before writing', /** 验证无法回读时保留未知结果且重试前必读。 Verify unavailable readback leaves an explicit unknown outcome and enforces read-before-retry. */ async () => {
  const value = snapshot(fixture()); let reads = 0; let writes = 0;
  const { host } = createHost(value, { /** 模拟写入结果未知且回读失败。 Simulate an unknown write outcome and failed readback. */ getApplicationCompetitionRuntime() { return {
    /** 首次允许复核，回读失败，下次发现审批已记录。 Allow the first check, fail readback, then reveal the persisted decision. */ async getApplicationCompetitionSnapshot() { reads += 1; if (reads === 1) return value; if (reads === 2) throw new Error('Offline'); return decided(value).snapshot; },
    /** 写入后模拟响应中断。 Simulate response loss after writing. */ async decideApplicationCompetitionApproval() { writes += 1; throw new Error('Response lost'); },
  }; } });
  host.syncEnterpriseApprovalNotices(value); assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false);
  assert.equal(host.enterpriseApprovalNoticeOutcome, ''); assert.match(host.enterpriseApprovalNoticeError, /暂时无法确认/);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(writes, 1); assert.equal(reads, 3);
  assert.equal(host.enterpriseApprovalNoticeStale, true);
});

test('a concurrent approval by another window is recovered without claiming the current submission succeeded', /** 验证同期其他窗口的批准只显示恢复状态而不归因本次请求。 Verify concurrent approval by another window is only a recovered state, never attributed to this request. */ async () => {
  const value = snapshot(fixture()); let stored = value; let writes = 0;
  const { host } = createHost(value, { /** 模拟其他窗口抢先批准。 Simulate another window approving first. */ getApplicationCompetitionRuntime() { return {
    /** 回读同期决定。 Read the concurrent decision. */ async getApplicationCompetitionSnapshot() { return copy(stored); },
    /** 当前请求收到状态冲突，已存决定属于其他操作者。 Reject this request with a state conflict while the stored decision belongs to another actor. */ async decideApplicationCompetitionApproval() {
      writes += 1; stored = decided(value).snapshot; stored.approvals[0].decidedBy = 'different-human'; throw new Error('APPROVAL_STATE_INVALID');
    },
  }; } });
  host.syncEnterpriseApprovalNotices(value); assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false);
  assert.equal(writes, 1); assert.equal(host.enterpriseApprovalNoticeOutcome, 'APPROVED'); assert.equal(host.enterpriseApprovalNoticeOutcomeRecovered, true);
  assert.match(host.enterpriseApprovalNoticeError, /该计划已有审批决定/); assert.doesNotMatch(host.enterpriseApprovalNoticeError, /你的|本次成功/);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), false); assert.equal(writes, 1);
  host.closeEnterpriseApprovalNotice(); assert.equal(host.enterpriseApprovalNoticeOutcomeRecovered, false);
  host.resetEnterpriseApprovalNotices(true); host.syncEnterpriseApprovalNotices(value); assert.equal(host.enterpriseApprovalNoticeOutcomeRecovered, false);
});

test('approval tabs expose only sanitized labels and keep pending order across workspaces', /** 验证多空间便签顺序和最小公开数据。 Verify cross-workspace tab order and minimal public data. */ () => {
  const first = fixture(); const second = fixture('b'); first.incident.title = '恢复 token=PRIVATE_TAB';
  const value = snapshot(first, second); const { host } = createHost(value);
  host.enterpriseWorkspaces[1].name = '数据空间 secret=PRIVATE_WORKSPACE'; host.syncEnterpriseApprovalNotices(value);
  const tabs = host.getEnterpriseApprovalNoticeTabs();
  assert.deepEqual(tabs.map(/** 提取便签身份。 Extract tab identities. */ tab => tab.approvalId), ['approval-a', 'approval-b']);
  assert.deepEqual(tabs.map(/** 提取当前标记。 Extract current markers. */ tab => tab.current), [true, false]);
  assert.deepEqual(Object.keys(tabs[0]), ['approvalId', 'title', 'workspaceName', 'status', 'current', 'stale']);
  assert.doesNotMatch(JSON.stringify(tabs), /PRIVATE_|planDigest|scopes|argumentsDigest|resource-one/);
  assert.equal(host.selectEnterpriseApprovalNotice('approval-b'), true);
  assert.equal(host.enterpriseApprovalNoticeTarget.workspaceId, 'workspace-b');
  assert.deepEqual(host.getEnterpriseApprovalNoticeTabs().map(/** 提取切换后的当前标记。 Extract current markers after switching. */ tab => tab.current), [false, true]);
  assert.equal(host.selectEnterpriseApprovalNotice('unknown'), false);
  host.canUseEnterprise = false; assert.deepEqual(host.getEnterpriseApprovalNoticeTabs(), []); assert.equal(host.selectEnterpriseApprovalNotice('approval-a'), false);
});

test('explicit tab switches preserve independent reason and execution-mode drafts for each exact plan', /** 验证显式切换按完整计划隔离草稿。 Verify explicit switching isolates drafts by complete plan. */ () => {
  const value = snapshot(fixture(), fixture('b')); const { host } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  host.enterpriseApprovalNoticeReason = 'A 的审核说明'; host.enterpriseApprovalNoticeExecutionMode = 'automatic';
  assert.equal(host.openEnterpriseApprovalNotice('approval-b'), false, 'automatic opening still cannot replace the current review');
  assert.equal(host.selectEnterpriseApprovalNotice('approval-b'), true);
  assert.equal(host.enterpriseApprovalNoticeReason, ''); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'step');
  host.enterpriseApprovalNoticeReason = 'B 的审核说明'; host.enterpriseApprovalNoticeExecutionMode = 'step';
  assert.equal(host.selectEnterpriseApprovalNotice('approval-a'), true);
  assert.equal(host.enterpriseApprovalNoticeReason, 'A 的审核说明'); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'automatic');
  assert.equal(host.selectEnterpriseApprovalNotice('approval-b'), true);
  assert.equal(host.enterpriseApprovalNoticeReason, 'B 的审核说明'); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'step');
  host.resetEnterpriseApprovalNotices(false); assert.deepEqual(host.enterpriseApprovalNoticeDrafts, {});
  host.resetEnterpriseApprovalNotices(true); host.syncEnterpriseApprovalNotices(value);
  assert.equal(host.enterpriseApprovalNoticeReason, ''); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'step');
});

test('a new plan under the same approval ID cannot reuse an older plan draft', /** 验证同审批换计划不会继承旧说明和自动执行选择。 Verify a new plan under the same approval cannot inherit old notes or automatic execution. */ () => {
  const value = snapshot(fixture(), fixture('b')); const { host } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  host.enterpriseApprovalNoticeReason = '仅适用于旧计划'; host.enterpriseApprovalNoticeExecutionMode = 'automatic';
  host.selectEnterpriseApprovalNotice('approval-b');
  const updated = copy(value); updated.approvals[0].planDigest = 'e'.repeat(64); updated.approvals[0].scopes[0].resourceId = 'new-resource';
  host.syncEnterpriseApprovalNotices(updated); assert.equal(host.selectEnterpriseApprovalNotice('approval-a'), true);
  assert.equal(host.enterpriseApprovalNoticeTarget.planDigest, 'e'.repeat(64));
  assert.equal(host.enterpriseApprovalNoticeReason, ''); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'step');
  host.enterpriseApprovalNoticeReason = '第二版说明'; host.enterpriseApprovalNoticeExecutionMode = 'automatic';
  const replacement = copy(updated); replacement.approvals[0].planDigest = 'f'.repeat(64); host.syncEnterpriseApprovalNotices(replacement);
  const tabs = host.getEnterpriseApprovalNoticeTabs();
  assert.equal(tabs.length, 2); assert.equal(tabs[0].stale, true); assert.equal(tabs[0].status, 'STALE');
  assert.equal(host.enterpriseApprovalNoticeTarget.planDigest, 'e'.repeat(64), 'polling must not replace the frozen plan');
  assert.equal(host.selectEnterpriseApprovalNotice('approval-a'), true);
  assert.equal(host.enterpriseApprovalNoticeTarget.planDigest, 'f'.repeat(64)); assert.equal(host.enterpriseApprovalNoticeReason, ''); assert.equal(host.enterpriseApprovalNoticeExecutionMode, 'step');
});

test('a decided or stale current tab is retained temporarily and successful approval clears its draft', /** 验证当前已决或失效便签临时保留且成功清理草稿。 Verify temporary retention of decided or stale tabs and draft cleanup after success. */ async () => {
  const value = snapshot(fixture(), fixture('b')); const { host } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  host.enterpriseApprovalNoticeReason = '审核完成'; host.selectEnterpriseApprovalNotice('approval-b'); host.selectEnterpriseApprovalNotice('approval-a');
  const key = JSON.stringify(host.enterpriseApprovalNoticeTarget); assert.equal(Object.hasOwn(host.enterpriseApprovalNoticeDrafts, key), true);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), true); assert.equal(Object.hasOwn(host.enterpriseApprovalNoticeDrafts, key), false);
  const completedTabs = host.getEnterpriseApprovalNoticeTabs();
  assert.deepEqual(completedTabs.map(/** 提取便签身份与已决状态。 Extract tab identities and decision states. */ tab => [tab.approvalId, tab.status, tab.current]), [['approval-a', 'APPROVED', true], ['approval-b', 'PENDING', false]]);
  host.selectEnterpriseApprovalNotice('approval-b');
  assert.equal(host.getEnterpriseApprovalNoticeTabs().length, 1); assert.equal(Object.hasOwn(host.enterpriseApprovalNoticeDrafts, key), false);
  const fresh = snapshot(fixture(), fixture('b')); const { host: stale } = createHost(fresh); stale.syncEnterpriseApprovalNotices(fresh);
  const removed = snapshot(fixture('b')); stale.syncEnterpriseApprovalNotices(removed);
  assert.equal(stale.getEnterpriseApprovalNoticeTabs()[0].status, 'STALE'); stale.selectEnterpriseApprovalNotice('approval-b');
  assert.equal(stale.getEnterpriseApprovalNoticeTabs().length, 1);
});

test('the current tab keeps its position after approval even when request timestamps are equal', /** 验证相同请求时间下批准后便签位置也不跳动。 Verify approval preserves tab position even when request timestamps are equal. */ async () => {
  const value = snapshot(fixture(), fixture('b')); const { host } = createHost(value); host.syncEnterpriseApprovalNotices(value);
  const before = host.getEnterpriseApprovalNoticeTabs().map(/** 保存批准前身份顺序。 Save identity order before approval. */ tab => tab.approvalId);
  assert.equal(await host.submitEnterpriseApprovalNotice('APPROVED'), true);
  assert.deepEqual(host.getEnterpriseApprovalNoticeTabs().map(/** 读取批准后身份顺序。 Read identity order after approval. */ tab => tab.approvalId), before);
  assert.equal(host.getEnterpriseApprovalNoticeTabs()[0].current, true); assert.equal(host.getEnterpriseApprovalNoticeTabs()[0].status, 'APPROVED');
});
