/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
用途：员工发现、详情与跨空间协作草稿行为回归。
Purpose: Regression coverage for employee discovery, details and scoped collaboration drafts.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
const assert = require('node:assert/strict');
const test = require('node:test');
const api = require('../static/js/openxnet-employee-experience.js');

/** 创建无网络宿主，记录原生动作。 Create a network-free host that records native actions. */
function createHost(overrides = {}) {
  return Object.assign(api.createState(), api.methods, {
    staffRoles: [],
    enterpriseWorkspaces: [{ id: 'workspace-a', name: 'Workspace A' }, { id: 'workspace-b', name: 'Workspace B' }],
    enterpriseProjects: [{ id: 'project-a', workspaceId: 'workspace-a', name: 'Project A' }],
    skillsList: [{ id: 'installed-skill', name: 'Installed skill' }],
    goaiStaffRoleShortcuts: [{ id: 'goai-evidence-agent', name: 'Evidence Agent', skills: ['Evidence'] }],
    staffRoleTemplateQuery: '', staffRoleTemplateCategory: 'all', staffRoleTemplatePage: 1, staffRoleTemplatePageSize: 10,
    enterpriseTab: 'staff-roles',
    events: [],
    /** 固定测试语言。 Fix the test language. */
    isCurrentLanguageZh() { return true; },
    /** 提供稳定模板清单。 Provide a stable template catalog. */
    getStaffRoleTemplateEntries() {
      return Array.from({ length: 37 }, /** 生成有不同分类的模板。 Generate templates with distinct categories. */ (_, index) => ({ id: `role-${index}`, name: `Role ${index}`, category: index % 2 ? 'knowledge' : 'model', skills: ['Analysis'] }));
    },
    /** 复现原搜索与分类接口。 Reproduce the native search and category interface. */
    getFilteredStaffRoleTemplates() {
      return this.getStaffRoleTemplateEntries().filter(/** 应用搜索与分类条件。 Apply search and category conditions. */ (item) => (this.staffRoleTemplateCategory === 'all' || item.category === this.staffRoleTemplateCategory) && item.name.toLowerCase().includes(this.staffRoleTemplateQuery.toLowerCase()));
    },
    /** 记录原模板创建表单入口。 Record the native template form entry. */
    createStaffFromTemplate(id) { this.events.push(['template-form', id]); },
    /** 记录原 GOAI 创建表单入口。 Record the native GOAI form entry. */
    createStaffFromGoaiShortcut(shortcut) { this.events.push(['goai-form', shortcut.id]); },
    /** 记录原员工编辑表单入口。 Record the native employee edit form entry. */
    openStaffRoleForm(role) { this.events.push(['edit-form', role.id]); },
    /** 协作准备不能经过会协调持久化的通用入口。 Collaboration preparation must not use the generic entry that reconciles persisted records. */
    async openEnterpriseTab() { this.events.push(['forbidden-navigation']); throw new Error('Unexpected generic enterprise navigation'); },
    /** 记录权威只读检查并明确返回成功。 Record the authoritative read-only check and explicitly confirm success. */
    async prepareEmployeeCollaborationContext() { this.events.push(['context-refresh']); return true; },
    /** 场景初始化只允许在目标范围验证后进行。 Initialize the scene only after validating the target scope. */
    async init3DView() { assert.equal(this.enterpriseTab, 'enterprise-sandbox'); assert.ok(this.getEmployeeScope(this.selected3DAgent).valid); this.events.push(['scene-init']); },
    /** 验证恢复后的空间才会进入聊天。 Record chat only after scope restoration. */
    async openEnterpriseChat(role) { this.events.push(['chat', role.id, this.sandboxCurrentWs, this.sandboxCurrentProject, this.enterpriseChatInput]); },
    /** 发送永远不应由资料交互调用。 Sending must never be invoked by profile interactions. */
    sendEnterpriseMessage() { throw new Error('Unexpected message send'); },
    /** 执行永远不应由资料交互调用。 Execution must never be invoked by profile interactions. */
    startEnterpriseCompetitionTask() { throw new Error('Unexpected task execution'); },
  }, overrides);
}

test('employee view defaults follow real records and state drafts are isolated', /** 验证默认视图和实例隔离。 Verify default views and instance isolation. */ () => {
  const first = createHost();
  const second = createHost({ staffRoles: [{ id: 'employee' }] });
  assert.equal(first.getEmployeeExperienceView(), 'discover');
  assert.equal(second.getEmployeeExperienceView(), 'mine');
  first.employeeScopeDrafts.private = 'draft';
  assert.deepEqual(second.employeeScopeDrafts, {});
  first.setEmployeeExperienceView('goai');
  first.setEmployeeExperienceView('unsupported');
  assert.equal(first.getEmployeeExperienceView(), 'goai');
});

test('all 37 native templates remain reachable and narrowed searches clamp pagination', /** 验证完整目录与搜索分页。 Verify the complete catalog and search pagination. */ () => {
  const host = createHost();
  const ids = new Set();
  for (let page = 1; page <= 4; page++) {
    host.staffRoleTemplatePage = page;
    for (const item of host.getEmployeeTemplatePage()) ids.add(item.id);
  }
  assert.equal(ids.size, 37);
  host.staffRoleTemplateQuery = 'Role 36';
  assert.equal(host.getEmployeePagination().page, 1);
  assert.equal(host.getEmployeeTemplatePage()[0].id, 'role-36');
  host.selectEmployeeScenario('knowledge');
  assert.equal(host.staffRoleTemplateQuery, '');
  assert.ok(host.getEmployeeTemplates().every(/** 验证场景类别。 Verify scenario categories. */ (item) => item.category === 'knowledge'));
  host.selectEmployeeScenario('knowledge');
  assert.equal(host.getEmployeeTemplates().length, 37);
});

test('opening, editing and closing task suggestions does not create or persist a role', /** 验证资料交互没有保存副作用。 Verify that profile interactions do not persist data. */ () => {
  const host = createHost();
  host.openEmployeeDetail('template', 'role-0');
  assert.equal(host.employeeDetailOpen, true);
  assert.ok(host.employeeTaskDraft.length > 10);
  host.employeeTaskDraft = 'Edited local suggestion';
  host.employeeDetailOpen = false;
  assert.deepEqual(host.events, []);
  assert.equal(host.staffRoles.length, 0);
  host.employeeDetailId = 'missing';
  assert.equal(host.getEmployeeDetail(), null);
  host.createEmployeeFromDetail();
  assert.deepEqual(host.events, []);
});

test('explicit creation continues through the native template and GOAI forms', /** 验证创建沿用原生表单。 Verify creation uses native forms. */ () => {
  const host = createHost();
  host.openEmployeeDetail('template', 'role-2');
  host.createEmployeeFromDetail();
  assert.equal(host.employeeDetailOpen, false);
  host.openEmployeeDetail('goai', 'goai-evidence-agent');
  host.createEmployeeFromDetail();
  assert.deepEqual(host.events, [['template-form', 'role-2'], ['goai-form', 'goai-evidence-agent']]);
  assert.equal(host.staffRoles.length, 0);
});

test('passport separates labels, package bindings and tools without fabricated installation', /** 验证能力护照的真实字段边界。 Verify honest passport field boundaries. */ () => {
  const host = createHost();
  const role = { skills: ['Analysis', 'Analysis'], skill_ids: ['installed-skill', 'missing-skill'], tools: ['xnet.evidence.read'], assignedWorkspace: 'workspace-a', projectId: 'project-a' };
  const original = JSON.stringify(role);
  const passport = host.getEmployeePassport(role);
  assert.deepEqual(passport.tags, ['Analysis']);
  assert.deepEqual(passport.tools, ['xnet.evidence.read']);
  assert.deepEqual(passport.packages, [{ id: 'installed-skill', name: 'Installed skill', found: true }, { id: 'missing-skill', name: 'missing-skill', found: false }]);
  assert.equal(passport.scope.valid, true);
  assert.equal(JSON.stringify(role), original);
  assert.equal(host.getEmployeeGoaiIdentity({ name: 'Evidence Agent' }), null);
  assert.equal(host.getEmployeeGoaiIdentity({ templateId: 'goai-evidence-agent' }).role, 'Worker');
});

test('disabled and unassigned employees cannot open collaboration', /** 验证停用与未分配员工不能进入协作。 Verify disabled and unassigned employees cannot open collaboration. */ async () => {
  const host = createHost();
  assert.equal(await host.prepareEmployeeCollaboration({ id: 'disabled', enabled: false, assignedWorkspace: 'workspace-a' }), false);
  assert.equal(await host.prepareEmployeeCollaboration({ id: 'unassigned', enabled: true }), false);
  assert.deepEqual(host.events, []);
});

test('collaboration rejects missing, disabled or cross-workspace employees after refreshing', /** 验证刷新后仍严格校验目标范围。 Verify target scope after refreshing. */ async () => {
  const cases = [
    [],
    [{ id: 'employee', enabled: false, assignedWorkspace: 'workspace-a' }],
    [{ id: 'employee', assignedWorkspace: 'workspace-b', projectId: 'project-a' }],
    [{ id: 'employee', assignedWorkspace: 'missing' }],
    [{ id: 'employee', assignedWorkspace: 'workspace-a', projectId: 'missing' }],
  ];
  for (const staffRoles of cases) {
    const host = createHost({ staffRoles });
    assert.equal(await host.prepareEmployeeCollaboration({ id: 'employee', assignedWorkspace: 'workspace-a' }), false);
    assert.equal(host.enterpriseTab, 'staff-roles');
    assert.equal(host.employeeExperienceBusy, false);
    assert.ok(host.employeeExperienceNotice);
    assert.equal(host.events.some(/** 检查聊天未打开。 Check chat did not open. */ (event) => event[0] === 'chat'), false);
  }
});

test('collaboration restores exact target scope and only prepares an explicit task draft', /** 验证精确范围与草稿准备。 Verify exact scope and draft preparation. */ async () => {
  const role = { id: 'employee', enabled: true, assignedWorkspace: 'workspace-a', projectId: 'project-a' };
  const host = createHost({ staffRoles: [role], sandboxCurrentWs: 'workspace-b', sandboxCurrentProject: null, enterpriseChatInput: 'Other workspace draft' });
  assert.equal(await host.prepareEmployeeCollaboration(role, '  Read-only investigation draft  '), true);
  assert.equal(host.sandboxLevel, 2);
  assert.equal(host.selected3DAgent, role);
  assert.equal(host.employeeScopeDrafts['["workspace-b",""]'], 'Other workspace draft');
  assert.deepEqual(host.events.at(-1), ['chat', 'employee', 'workspace-a', 'project-a', 'Read-only investigation draft']);
  assert.equal(host.employeeExperienceBusy, false);
});

test('opening another employee never mixes drafts from a different workspace', /** 验证不同空间草稿隔离。 Verify draft isolation between workspaces. */ async () => {
  const role = { id: 'employee', assignedWorkspace: 'workspace-a' };
  const previousMessages = [{ id: 'workspace-b-message', content: 'Other workspace message' }];
  const host = createHost({ staffRoles: [role], sandboxCurrentWs: 'workspace-b', sandboxCurrentProject: null, enterpriseChatInput: 'Private workspace B draft', enterpriseMessages: previousMessages });
  await host.prepareEmployeeCollaboration(role);
  assert.equal(host.enterpriseChatInput, '');
  assert.equal(host.employeeScopeDrafts['["workspace-b",""]'], 'Private workspace B draft');
  assert.deepEqual(host.enterpriseMessages, []);
  assert.equal(previousMessages.length, 1);
  assert.deepEqual(host.events.at(-1), ['chat', 'employee', 'workspace-a', null, '']);
});

test('a chat opening error restores the previous local view and drafts without generic navigation', /** 验证聊天打开异常时恢复本地状态。 Verify restoration of local state after a chat opening error. */ async () => {
  const role = { id: 'employee', assignedWorkspace: 'workspace-a' };
  const messages = [{ id: 'old-message' }];
  const host = createHost({
    staffRoles: [role], sandboxCurrentWs: 'workspace-b', sandboxCurrentProject: null, enterpriseChatInput: 'Existing draft', employeeDetailOpen: true, enterpriseMessages: messages,
    /** 模拟聊天入口异常。 Simulate a chat opening failure. */
    async openEnterpriseChat() { throw new Error('Chat unavailable'); },
    /** 仅记录场景释放。 Record scene disposal only. */
    dispose3DView() { this.events.push(['scene-dispose']); },
  });
  assert.equal(await host.prepareEmployeeCollaboration(role, 'New task'), false);
  assert.equal(host.enterpriseTab, 'staff-roles');
  assert.equal(host.sandboxCurrentWs, 'workspace-b');
  assert.equal(host.enterpriseChatInput, 'Existing draft');
  assert.equal(host.employeeDetailOpen, true);
  assert.equal(host.enterpriseMessages, messages);
  assert.deepEqual(host.events, [['context-refresh'], ['scene-init'], ['scene-dispose']]);
});

test('enterprise access and read failures remain visible without launching collaboration', /** 验证访问边界与只读失败。 Verify access boundaries and read failures. */ async () => {
  const role = { id: 'employee', assignedWorkspace: 'workspace-a' };
  const denied = createHost({ staffRoles: [role], canUseEnterprise: false });
  assert.equal(await denied.prepareEmployeeCollaboration(role), false);
  assert.deepEqual(denied.events, []);
  const unavailable = createHost({
    staffRoles: [role],
    /** 模拟权威只读检查异常。 Simulate an authoritative read failure. */
    async prepareEmployeeCollaborationContext() { throw new Error('Workspace data unavailable'); },
  });
  assert.equal(await unavailable.prepareEmployeeCollaboration(role), false);
  assert.equal(unavailable.enterpriseTab, 'staff-roles');
  assert.equal(unavailable.employeeExperienceBusy, false);
  assert.equal(unavailable.employeeExperienceNotice, 'Workspace data unavailable');
});

test('a false context refresh blocks stale valid records and preserves both task and chat drafts', /** 验证失败刷新不使用旧资料并保留草稿。 Verify a failed refresh cannot use stale records and preserves drafts. */ async () => {
  const role = { id: 'employee', assignedWorkspace: 'workspace-a', enabled: true };
  const host = createHost({
    staffRoles: [role], employeeTaskDraft: 'User edited task', enterpriseChatInput: 'Existing conversation draft', employeeDetailOpen: true,
    /** 模拟宿主明确返回失败并提供原因。 Simulate an explicit host failure with an actionable reason. */
    async prepareEmployeeCollaborationContext() { this.events.push(['context-refresh']); this.employeeExperienceNotice = 'Current project list could not be read'; return false; },
  });
  assert.equal(await host.prepareEmployeeCollaboration(role, host.employeeTaskDraft), false);
  assert.deepEqual(host.events, [['context-refresh']]);
  assert.equal(host.employeeTaskDraft, 'User edited task');
  assert.equal(host.enterpriseChatInput, 'Existing conversation draft');
  assert.equal(host.employeeDetailOpen, true);
  assert.equal(host.enterpriseTab, 'staff-roles');
  assert.equal(host.employeeExperienceNotice, 'Current project list could not be read');
});

test('successful read-only refresh resolves the fresh employee before scene initialization', /** 验证成功刷新后才采用最新员工并初始化。 Verify fresh identity resolution before scene initialization. */ async () => {
  const stale = { id: 'employee', assignedWorkspace: 'workspace-b' };
  const current = { id: 'employee', assignedWorkspace: 'workspace-a', projectId: 'project-a' };
  const host = createHost({
    staffRoles: [stale],
    /** 用权威只读结果替换旧员工投影。 Replace the stale projection with authoritative read-only data. */
    async prepareEmployeeCollaborationContext() { this.events.push(['context-refresh']); this.staffRoles = [current]; return true; },
  });
  assert.equal(await host.prepareEmployeeCollaboration(stale, 'Prepared task'), true);
  assert.deepEqual(host.events, [['context-refresh'], ['scene-init'], ['chat', 'employee', 'workspace-a', 'project-a', 'Prepared task']]);
  assert.equal(host.selected3DAgent, current);
});

test('missing read-only capability never falls back to generic navigation', /** 验证只读能力缺失时不降级至通用导航。 Verify missing read-only capability never falls back to generic navigation. */ async () => {
  const role = { id: 'employee', assignedWorkspace: 'workspace-a' };
  const host = createHost({ staffRoles: [role], prepareEmployeeCollaborationContext: undefined });
  assert.equal(await host.prepareEmployeeCollaboration(role), false);
  assert.deepEqual(host.events, []);
  assert.equal(host.enterpriseTab, 'staff-roles');
  assert.ok(host.employeeExperienceNotice);
});

test('GOAI task suggestions retain independent roles and human approval boundaries', /** 验证 GOAI 建议的职责边界。 Verify responsibility boundaries in GOAI suggestions. */ () => {
  const host = createHost();
  const leader = host.getEmployeePlaybook({ templateId: 'goai-incident-commander' }).prompt;
  const worker = host.getEmployeePlaybook({ templateId: 'goai-evidence-agent' }).prompt;
  const verifier = host.getEmployeePlaybook({ templateId: 'goai-verification-agent' }).prompt;
  assert.match(leader, /人工审批/);
  assert.match(leader, /不自行批准/);
  assert.match(worker, /只读/);
  assert.match(verifier, /独立重新采集/);
  assert.match(verifier, /不把执行回执当成成功依据/);
});
