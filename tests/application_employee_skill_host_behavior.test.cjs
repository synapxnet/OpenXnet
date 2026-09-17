/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 员工保存与技能请求隔离行为回归。Employee persistence and skill request isolation regressions.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { ApplicationEnterpriseRuntimeService } = require('../build-ts/desktop/enterprise/application-enterprise-runtime.js');

const source = fs.readFileSync(path.join(__dirname, '../static/js/vue_methods.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });
const declaration = ast.program.body.find(node => node.type === 'VariableDeclaration'
  && node.declarations.some(item => item.id.name === 'vue_methods'));
const methods = declaration.declarations.find(item => item.id.name === 'vue_methods').init.properties;

/** 从真实宿主源码加载方法，隔离全局副作用。Load real host methods with isolated global effects. */
function createHost(overrides = {}, globals = {}) {
  const notifications = [];
  const context = vm.createContext({
    console: { error() {}, warn() {} },
    showNotification: (...values) => notifications.push(values),
    setTimeout() {},
    uuid: { v4: () => 'generated-staff' },
    WebSocket: { OPEN: 1 },
    ...globals,
  });
  const names = [
    'normalizeStaffRoleRecord', 'createEmptyStaffRoleDraft', 'resolveStaffRoleSkillIds',
    'buildStaffRoleRuntimeSystemPrompt', 'persistStaffRoleToEnterprise', 'saveStaffRole',
    'setStaffRoleEnabled', 'removeStaffRole', 'loadEnterpriseRoleCards',
    'previewSkill', 'clearSkillPreview', 'fetchSkills', 'fetchProjectSkillsStatus',
    'handleRefreshSkills', 'loadEnterpriseSkills', 'setEnterpriseSkillEnabled', 'uploadEnterpriseSkillToMlops',
    'createStaffFromGoaiShortcut', 'removeGlobalSkill', 'removeProjectSkill',
    'prepareEmployeeCollaborationContext', 'mapApplicationEnterpriseWorkspaceToUi', 'fetchSkillLifecycle',
  ];
  const host = {
    enterpriseRoleCards: [], staffRoles: [], staffRoleBusyIds: [], skillsList: [],
    CLISettings: { cc_path: 'project-a' }, canUseEnterprise: true,
    enterpriseSkillWorkspaceId: 'workspace-a',
    t: value => value, isCurrentLanguageZh: () => true,
    getEnterpriseWorkspaceNameById: () => 'Workspace',
    formatMessage: content => `render:${content}`,
    async autoSaveSettings() {}, async refreshSandboxState() {}, _refreshSandbox() {},
    notifications,
  };
  for (const name of names) {
    const node = methods.find(item => item.key?.name === name);
    assert.ok(node, `missing real host method ${name}`);
    host[name] = vm.runInContext(`({${source.slice(node.start, node.end)}})`, context)[name];
  }
  return Object.assign(host, overrides);
}

/** 创建可控制顺序的请求，不访问外部服务。Create a manually ordered request without external services. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** 复制跨VM结果用于值比较。Copy cross-VM results for value comparisons. */
function plain(value) { return JSON.parse(JSON.stringify(value)); }

/** 生成当前协作资料响应，不访问外部服务。Build current collaboration responses without external services. */
function collaborationResults() {
  const envelope = { schema: 'openxnet.enterprise.v1', success: true };
  return {
    roles: { ...envelope, cards: [{ id: 'staff-current', name: 'Current staff', enabled: true, assignedWorkspace: 'workspace-current', projectId: 'project-current' }] },
    workspaces: { ...envelope, workspaces: [{ id: 'workspace-current', name: 'Current workspace', type: 'local', config: {} }] },
    projects: { ...envelope, projects: [{ id: 'project-current', name: 'Current project', workspaceId: 'workspace-current' }] },
  };
}

/** 快照测试存储文件以检测任何持久化副作用。Snapshot fixture storage to detect any persistence side effect. */
function snapshotFixtureStorage(root) {
  return fs.readdirSync(root, { recursive: true }).sort().flatMap(relative => {
    const absolute = path.join(root, relative);
    const info = fs.statSync(absolute);
    return info.isFile() ? [[relative, info.mtimeMs, fs.readFileSync(absolute, 'utf8')]] : [];
  });
}

// 实际Main存储往返保留完整字段。A real Main storage round trip preserves complete fields.
test('staff edit and restart preserve disabled status, scope, tools and explicit skills', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openxnet-staff-host-'));
  try {
    const service = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
    const initial = (await service.saveRoleCard({ mode: 'create', roleCard: {
      id: 'staff-existing', name: 'Evidence', enabled: false,
      skills: ['Evidence'], skill_ids: ['goai-evidence-collect'],
      tools: ['dataops.quality.report.get'], permissions: ['read_evidence'],
      assignedWorkspace: 'workspace-a', projectId: 'project-a', templateId: 'goai-evidence-agent',
      system_prompt: 'Read evidence.', runtime_system_prompt: 'Read only within scope.',
      agent_name: 'Evidence', role_scope: 'enterprise', syncSource: 'enterprise',
      bodyType: 'robot', position3D: { x: 0, z: 2 }, category: 'goai',
    } })).card;
    const runtime = {
      saveApplicationEnterpriseRoleCard: request => service.saveRoleCard(request),
      listApplicationEnterpriseRoleCards: () => service.listRoleCards(),
    };
    const host = createHost({ getApplicationEnterpriseRuntime: () => runtime });
    host.enterpriseRoleCards = [initial];
    host.staffRoles = [initial];
    host.newStaffRole = host.createEmptyStaffRoleDraft({ ...initial, description: 'Updated profile' });
    host.showStaffRoleForm = true;
    assert.equal(await host.saveStaffRole(), true);
    const reloaded = (await new ApplicationEnterpriseRuntimeService({ userDataDirectory: root }).listRoleCards()).cards[0];
    for (const key of ['id', 'enabled', 'skills', 'skill_ids', 'permissions', 'tools', 'assignedWorkspace', 'projectId', 'templateId', 'runtime_system_prompt', 'bodyType', 'position3D']) {
      assert.deepEqual(reloaded[key], initial[key], key);
    }
    assert.equal(reloaded.description, 'Updated profile');
    assert.equal(host.showStaffRoleForm, false);
    const toggle = host.setStaffRoleEnabled(host.staffRoles[0], true);
    assert.equal(host.staffRoles[0].enabled, false);
    assert.equal(await toggle, true);
    assert.equal((await service.listRoleCards()).cards[0].enabled, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// 自动生成运行提示词随源提示更新，自定义提示词另由完整保存测试保护。Generated runtime prompts follow source changes; custom prompts are covered by the full-save test.
test('editing a generated role prompt updates runtime behavior without replacing tool bindings', async () => {
  const host = createHost({ getApplicationEnterpriseRuntime: () => ({
    async saveApplicationEnterpriseRoleCard({ roleCard }) { return { card: roleCard }; },
  }) });
  const role = host.createEmptyStaffRoleDraft({ id: 'generated', name: 'Worker', system_prompt: 'Old instructions.', skill_ids: ['package-a'], tools: ['dataops.quality.report.get'] });
  role.runtime_system_prompt = host.buildStaffRoleRuntimeSystemPrompt(role, role.skill_ids);
  host.enterpriseRoleCards = [role];
  const saved = await host.persistStaffRoleToEnterprise({ ...role, system_prompt: 'New bounded instructions.' }, { createAgent: false });
  assert.match(saved.runtime_system_prompt, /New bounded instructions/);
  assert.doesNotMatch(saved.runtime_system_prompt, /Old instructions/);
  assert.deepEqual(plain(saved.tools), ['dataops.quality.report.get']);
});

// GOAI快捷项只构造草稿，权限与阶段技能保持各自职责。GOAI shortcuts only prepare drafts with role-specific permissions and stage skills.
test('GOAI shortcuts prepare three separate role drafts without creating employees or granting approval', () => {
  const data = fs.readFileSync(path.join(__dirname, '../static/js/vue_data.js'), 'utf8');
  const start = data.indexOf('goaiStaffRoleShortcuts:');
  const end = data.indexOf('staffRoleTemplates:', start);
  const shortcuts = vm.runInNewContext(`({${data.slice(start, end)}})`).goaiStaffRoleShortcuts;
  const expected = ['goai-change-execute', 'goai-evidence-collect', 'goai-service-verify'];
  const host = createHost({ getApplicationEnterpriseRuntime: () => { throw new Error('draft must not persist'); } });
  shortcuts.forEach((shortcut, index) => {
    host.createStaffFromGoaiShortcut(shortcut);
    assert.equal(host.newStaffRole.id, '');
    assert.equal(host.newStaffRole.templateId, shortcut.id);
    assert.deepEqual(plain(host.newStaffRole.skill_ids), [expected[index]]);
    assert.equal(host.newStaffRole.permissions.includes('approve'), false);
    assert.deepEqual(plain(host.newStaffRole.tools), []);
    assert.equal(host.enterpriseRoleCards.length, 0);
  });
});

// 显式空绑定与工具不被建议推断覆盖。Explicit empty bindings and tool names are not overwritten by suggestions.
test('explicit empty package bindings remain empty and tools are never package IDs', async () => {
  const payloads = [];
  let inferred = 0;
  const host = createHost({
    resolveStaffRoleSkillIds: () => { inferred++; return ['suggested-skill']; },
    getApplicationEnterpriseRuntime: () => ({ async saveApplicationEnterpriseRoleCard({ roleCard }) {
      payloads.push(plain(roleCard)); return { card: roleCard };
    } }),
  });
  await host.persistStaffRoleToEnterprise({ id: 'explicit', name: 'Explicit', skill_ids: [], tools: ['aiops.service.health.get'] }, { createAgent: false });
  assert.equal(inferred, 0);
  assert.deepEqual(payloads[0].skill_ids, []);
  assert.deepEqual(payloads[0].tools, ['aiops.service.health.get']);
  await host.persistStaffRoleToEnterprise({ id: 'legacy', name: 'Legacy' }, { createAgent: false });
  assert.equal(inferred, 1);
  assert.deepEqual(payloads[1].skill_ids, ['suggested-skill']);
  assert.deepEqual(payloads[1].tools, []);
});

// 失败保存和启停不改变界面权威记录。Failed save and enablement retain authoritative UI records.
test('failed save and enablement retain the open draft and previous staff state', async () => {
  const waiting = deferred();
  const initial = { id: 'staff-one', name: 'One', enabled: true, skill_ids: [], tools: [] };
  const host = createHost({
    enterpriseRoleCards: [initial], staffRoles: [initial],
    getApplicationEnterpriseRuntime: () => ({ saveApplicationEnterpriseRoleCard: () => waiting.promise }),
  });
  const toggle = host.setStaffRoleEnabled(initial, false);
  assert.equal(host.staffRoles[0].enabled, true);
  assert.equal(await host.setStaffRoleEnabled(initial, false), false);
  waiting.reject(new Error('referenced by a team template'));
  assert.equal(await toggle, false);
  assert.equal(host.staffRoles[0].enabled, true);
  assert.deepEqual(plain(host.staffRoleBusyIds), []);
  host.newStaffRole = host.createEmptyStaffRoleDraft({ ...initial, name: 'Unsaved' });
  host.showStaffRoleForm = true;
  assert.equal(await host.saveStaffRole(), false);
  assert.equal(host.showStaffRoleForm, true);
  assert.equal(host.newStaffRole.name, 'Unsaved');
  assert.equal(host.staffRoles[0].name, 'One');
});

// 删除失败保留员工，成功空列表清理两份投影。Failed deletion retains staff while successful empty reads clear both projections.
test('HTTP deletion failure retains staff and only an authoritative empty list clears it', async () => {
  const initial = { id: 'staff-one', name: 'One' };
  const host = createHost({ getApplicationEnterpriseRuntime: () => null, enterpriseRoleCards: [initial], staffRoles: [initial] }, {
    fetch: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(await host.removeStaffRole(initial.id), false);
  assert.equal(host.staffRoles[0], initial);
  assert.equal(await host.loadEnterpriseRoleCards(), false);
  assert.equal(host.enterpriseRoleCards[0], initial);
  host.getApplicationEnterpriseRuntime = () => ({ async listApplicationEnterpriseRoleCards() { return { cards: [] }; } });
  assert.equal(await host.loadEnterpriseRoleCards(), true);
  assert.deepEqual(plain(host.staffRoles), []);
  assert.deepEqual(plain(host.enterpriseRoleCards), []);
});

// 较早列表不能覆盖已成功保存的员工。An older list cannot overwrite newly persisted staff.
test('a list started before a successful save cannot erase the new staff record', async () => {
  const waiting = deferred();
  const host = createHost({ getApplicationEnterpriseRuntime: () => ({
    listApplicationEnterpriseRoleCards: () => waiting.promise,
    async saveApplicationEnterpriseRoleCard({ roleCard }) { return { card: roleCard }; },
  }) });
  const reading = host.loadEnterpriseRoleCards();
  await host.persistStaffRoleToEnterprise({ id: 'new-one', name: 'New' }, { createAgent: false });
  waiting.resolve({ cards: [] });
  assert.equal(await reading, false);
  assert.equal(host.staffRoles[0].id, 'new-one');
});

// 乱序预览成功和失败不能覆盖新选择。Out-of-order preview success and failure cannot overwrite a newer choice.
test('preview request generations isolate success, catch and finally', async () => {
  const a = deferred(); const b = deferred(); const c = deferred();
  const calls = [];
  const pending = { a, b, c };
  const host = createHost({ getApplicationSkillRuntime: () => ({ getApplicationSkillContent(request) {
    calls.push(plain(request)); return pending[request.skillId].promise;
  } }) });
  const previewA = host.previewSkill('a');
  const previewB = host.previewSkill('b', 'project');
  a.reject(new Error('old failure'));
  await previewA;
  assert.equal(host.activeSkillPreviewId, 'b');
  assert.equal(host.skillPreviewLoading, true);
  assert.equal(host.skillPreviewError, '');
  b.resolve({ content: 'B' });
  assert.equal(await previewB, true);
  assert.equal(host.renderedSkillContent, 'render:B');
  assert.deepEqual(calls[1], { skillId: 'b', source: 'project' });
  pending.a = deferred(); pending.b = deferred();
  const earlier = host.previewSkill('a');
  const latest = host.previewSkill('b');
  pending.b.resolve({ content: 'Latest B' });
  await latest;
  pending.a.resolve({ content: 'Late A' });
  assert.equal(await earlier, false);
  assert.equal(host.renderedSkillContent, 'render:Latest B');
  const previewC = host.previewSkill('c');
  host.clearSkillPreview();
  c.resolve({ content: 'late C' });
  assert.equal(await previewC, false);
  assert.equal(host.activeSkillPreviewId, '');
  assert.equal(host.renderedSkillContent, '');
  assert.equal(host.skillPreviewLoading, false);
});

// 浏览器项目技能不可回退到全局同名正文。Browser project content must not fall back to a global namesake.
test('browser project preview reports unsupported without fetching global content', async () => {
  let fetched = false;
  const host = createHost({ getApplicationSkillRuntime: () => null }, { fetch: async () => { fetched = true; } });
  assert.equal(await host.previewSkill('same-name', 'project'), false);
  assert.equal(fetched, false);
  assert.equal(host.activeSkillPreviewId, 'same-name');
  assert.match(host.skillPreviewError, /暂不支持项目原文/);
});

// 刷新等待两个真实读取，区分失败与空态。Refresh waits for both reads and distinguishes errors from empty results.
test('catalog and project refresh expose real busy state and clear successful empty results', async () => {
  const catalog = deferred(); const project = deferred();
  const host = createHost({
    skillsList: [{ id: 'old' }],
    getApplicationSkillRuntime: () => ({
      listApplicationSkills: () => catalog.promise,
      getApplicationProjectSkillStatus: () => project.promise,
    }),
  });
  let finished = false;
  const refresh = host.handleRefreshSkills().then(() => { finished = true; });
  assert.equal(host.skillsLoading, true);
  assert.equal(host.projectSkillsLoading, true);
  catalog.resolve({ skills: [] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(finished, false);
  project.resolve({ installedIds: [], projectSkills: [] });
  await refresh;
  assert.deepEqual(plain(host.skillsList), []);
  assert.equal(host.projectSkillsLoading, false);
  host.getApplicationSkillRuntime = () => ({ async listApplicationSkills() { throw new Error('catalog offline'); } });
  assert.equal(await host.fetchSkills(), false);
  assert.equal(host.skillCatalogError, 'catalog offline');
  assert.equal(host.skillsLoading, false);
});

// 工作空间切换丢弃旧绑定并限制写入入口。Workspace switches discard old bindings and guard mutation entry points.
test('enterprise binding load rejects the previous workspace and guards disabled enterprise access', async () => {
  const a = deferred(); const b = deferred();
  let count = 0;
  const host = createHost({
    skillsList: [{ id: 'skill' }], fetchSkills: async () => true,
    getApplicationEnterpriseRuntime: () => ({ listApplicationEnterpriseSkillBindings: () => (++count === 1 ? a : b).promise }),
  });
  const oldRead = host.loadEnterpriseSkills();
  await new Promise(setImmediate);
  assert.equal(count, 1);
  host.enterpriseSkillWorkspaceId = 'workspace-b';
  const newRead = host.loadEnterpriseSkills();
  await new Promise(setImmediate);
  assert.equal(count, 2);
  b.resolve({ bindings: [{ workspaceId: 'workspace-b', skillId: 'skill', enabled: false }] });
  await newRead;
  a.resolve({ bindings: [{ workspaceId: 'workspace-a', skillId: 'skill', enabled: true }] });
  assert.equal(await oldRead, false);
  assert.equal(host.enterpriseSkills[0].enterpriseEnabled, false);
  host.canUseEnterprise = false;
  host.getApplicationEnterpriseRuntime = () => { throw new Error('must not access runtime'); };
  assert.equal(await host.setEnterpriseSkillEnabled({ id: 'skill' }, true), false);
  assert.equal(await host.uploadEnterpriseSkillToMlops({ id: 'skill' }), false);
  await host.loadEnterpriseSkills();
  assert.deepEqual(plain(host.enterpriseSkills), []);
});

// 删除Promise覆盖确认、写入和刷新；Deletion promises span confirmation, mutation, and refresh for both sources.
test('skill deletion stays pending through confirmation, mutation and refresh', async () => {
  for (const source of ['global', 'project']) {
    for (const otherCopyExists of [false, true]) {
      const confirmation = deferred(); const deletion = deferred(); const refresh = deferred();
      let confirmations = 0; let mutations = 0; let refreshes = 0; let finished = false;
      const runtimeMethod = source === 'global' ? 'removeApplicationSkill' : 'syncApplicationProjectSkill';
      const hostMethod = source === 'global' ? 'removeGlobalSkill' : 'removeProjectSkill';
      const refreshMethod = source === 'global' ? 'fetchSkills' : 'fetchProjectSkillsStatus';
      const host = createHost({
        $confirm() { confirmations += 1; return confirmation.promise; },
        getApplicationSkillRuntime: () => ({ [runtimeMethod]() { mutations += 1; return deletion.promise; } }),
        [refreshMethod]() { refreshes += 1; return refresh.promise; },
      });
      const skill = { id: 'bounded-skill', [source === 'global' ? 'isProject' : 'isGlobal']: otherCopyExists };
      const pending = host[hostMethod](skill).then(() => { finished = true; });
      await new Promise(setImmediate);
      assert.equal(finished, false);
      assert.equal(confirmations, otherCopyExists ? 0 : 1);
      assert.equal(mutations, otherCopyExists ? 1 : 0);
      if (!otherCopyExists) confirmation.resolve();
      await new Promise(setImmediate);
      assert.equal(mutations, 1);
      assert.equal(finished, false);
      deletion.resolve();
      await new Promise(setImmediate);
      assert.equal(refreshes, 1);
      assert.equal(finished, false);
      refresh.resolve();
      await pending;
      assert.equal(finished, true);
    }
  }
});

// 取消不删除，失败保留通知；Cancellation performs no deletion and real failures retain notifications.
test('skill deletion cancellation and failure preserve their existing behavior', async () => {
  for (const source of ['global', 'project']) {
    const confirmation = deferred();
    let mutations = 0; let refreshes = 0;
    const runtimeMethod = source === 'global' ? 'removeApplicationSkill' : 'syncApplicationProjectSkill';
    const hostMethod = source === 'global' ? 'removeGlobalSkill' : 'removeProjectSkill';
    const refreshMethod = source === 'global' ? 'fetchSkills' : 'fetchProjectSkillsStatus';
    const host = createHost({
      $confirm: () => confirmation.promise,
      getApplicationSkillRuntime: () => ({ async [runtimeMethod]() { mutations += 1; throw new Error('delete failed'); } }),
      [refreshMethod]() { refreshes += 1; },
    });
    const skill = { id: 'bounded-skill', [source === 'global' ? 'isProject' : 'isGlobal']: false };
    const cancelled = host[hostMethod](skill);
    confirmation.reject('cancel');
    await cancelled;
    assert.equal(mutations, 0);
    assert.equal(host.notifications.length, 0);
    skill[source === 'global' ? 'isProject' : 'isGlobal'] = true;
    await host[hostMethod](skill);
    assert.equal(mutations, 1);
    assert.equal(refreshes, 0);
    assert.deepEqual(host.notifications, [['delete failed', 'error']]);
  }
});

// 真实Main三项读取不触发持久化或导航。Real Main reads prepare context without persistence or navigation.
test('collaboration preparation reads current Main records without modifying storage', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openxnet-collaboration-readonly-'));
  try {
    const service = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
    const workspace = (await service.saveWorkspace({ workspace: { name: 'Read only workspace', type: 'local', config: {
      local: { path: root, permission_mode: 'default' },
      docker: { image: 'ubuntu:22.04', daemon_url: '', container_id: '' },
      cloud: { host: '', port: 22, user: 'root', key_path: '' },
      sandbox: { image: 'openxnet/sandbox:latest', ttl_hours: 24 },
    } } })).workspace;
    const project = (await service.saveProject({ project: { workspaceId: workspace.id, name: 'Read only project' } })).project;
    const role = (await service.saveRoleCard({ mode: 'create', roleCard: {
      name: 'Current employee', enabled: false, assignedWorkspace: workspace.id, projectId: project.id,
    } })).card;
    const before = snapshotFixtureStorage(root);
    const calls = [];
    const host = createHost({
      enterpriseTab: 'staff-roles', enterpriseChatInput: 'Keep this draft',
      enterpriseRoleCards: [{ id: 'stale', assignedWorkspace: workspace.id }],
      getApplicationEnterpriseRuntime: () => ({
        listApplicationEnterpriseRoleCards() { calls.push('roles'); return service.listRoleCards(); },
        listApplicationEnterpriseWorkspaces() { calls.push('workspaces'); return service.listWorkspaces(); },
        listApplicationEnterpriseProjects() { calls.push('projects'); return service.listProjects(); },
      }),
      openEnterpriseTab() { throw new Error('navigation is forbidden'); },
      reconcileEnterpriseTeamScopes() { throw new Error('reconciliation is forbidden'); },
      autoSaveSettings() { throw new Error('persistence is forbidden'); },
      _refreshSandbox() { throw new Error('sandbox synchronization is forbidden'); },
    });
    assert.equal(await host.prepareEmployeeCollaborationContext(), true);
    assert.deepEqual(calls.sort(), ['projects', 'roles', 'workspaces']);
    assert.equal(host.staffRoles[0].id, role.id);
    assert.equal(host.staffRoles[0].enabled, false);
    assert.deepEqual(plain(host.enterpriseWorkspaces[0].assignedRoles), [role.id]);
    assert.equal(host.enterpriseProjects[0].id, project.id);
    assert.equal(host.enterpriseTab, 'staff-roles');
    assert.equal(host.enterpriseChatInput, 'Keep this draft');
    assert.equal(host.enterpriseRoleCardsLoading, false);
    assert.deepEqual(snapshotFixtureStorage(root), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// 任一读取失败或响应缺失时不接受旧资料。Any failed or malformed read rejects stale collaboration data.
test('collaboration preparation preserves every projection on failed or malformed reads', async () => {
  for (const broken of ['roles', 'workspaces', 'projects']) {
    for (const failure of ['reject', 'missing', 'unsuccessful', 'invalid-record']) {
      const results = collaborationResults();
      const previous = { enterpriseRoleCards: [{ id: 'old-role' }], staffRoles: [{ id: 'old-staff' }],
        workspaceEnvList: [{ id: 'old-env' }], enterpriseWorkspaces: [{ id: 'old-workspace' }], enterpriseProjects: [{ id: 'old-project' }] };
      const read = async field => {
        if (field !== broken) return results[field];
        if (failure === 'reject') throw new Error(`${field} unavailable`);
        if (failure === 'missing') return { schema: 'openxnet.enterprise.v1', success: true };
        if (failure === 'unsuccessful') return { ...results[field], success: false };
        return { ...results[field], [field === 'roles' ? 'cards' : field]: [null] };
      };
      const host = createHost({ ...previous, getApplicationEnterpriseRuntime: () => ({
        listApplicationEnterpriseRoleCards: () => read('roles'),
        listApplicationEnterpriseWorkspaces: () => read('workspaces'),
        listApplicationEnterpriseProjects: () => read('projects'),
      }) });
      assert.equal(await host.prepareEmployeeCollaborationContext(), false, `${broken}:${failure}`);
      for (const key of Object.keys(previous)) assert.equal(host[key], previous[key], key);
      assert.ok(host.employeeExperienceNotice);
      assert.equal(host.enterpriseRoleCardsLoading, false);
    }
  }
});

// 只有全部成功才提交，权威空列表清除旧投影。Commit only complete batches and clear stale projections on authoritative empty lists.
test('collaboration preparation commits all successful reads together including empty lists', async () => {
  const results = collaborationResults(); const projects = deferred();
  const oldRoles = [{ id: 'old-role' }]; const oldWorkspaces = [{ id: 'old-workspace' }];
  const runtime = {
    listApplicationEnterpriseRoleCards: async () => results.roles,
    listApplicationEnterpriseWorkspaces: async () => results.workspaces,
    listApplicationEnterpriseProjects: () => projects.promise,
  };
  const host = createHost({ enterpriseRoleCards: oldRoles, enterpriseWorkspaces: oldWorkspaces, getApplicationEnterpriseRuntime: () => runtime });
  const loading = host.prepareEmployeeCollaborationContext();
  await new Promise(setImmediate);
  assert.equal(host.enterpriseRoleCards, oldRoles);
  assert.equal(host.enterpriseWorkspaces, oldWorkspaces);
  projects.resolve(results.projects);
  assert.equal(await loading, true);
  runtime.listApplicationEnterpriseRoleCards = async () => ({ ...results.roles, cards: [] });
  runtime.listApplicationEnterpriseWorkspaces = async () => ({ ...results.workspaces, workspaces: [] });
  runtime.listApplicationEnterpriseProjects = async () => ({ ...results.projects, projects: [] });
  assert.equal(await host.prepareEmployeeCollaborationContext(), true);
  for (const key of ['enterpriseRoleCards', 'staffRoles', 'workspaceEnvList', 'enterpriseWorkspaces', 'enterpriseProjects']) assert.deepEqual(plain(host[key]), []);
});

// 环境不支持、访问改变或新员工读取均阻止旧准备继续。Unsupported environments, changed access, or newer staff reads invalidate preparation.
test('collaboration preparation fails closed for browser, access changes and stale reads', async () => {
  let fetched = false;
  const browser = createHost({ getApplicationEnterpriseRuntime: () => null }, { fetch() { fetched = true; } });
  assert.equal(await browser.prepareEmployeeCollaborationContext(), false);
  assert.equal(fetched, false);
  assert.match(browser.employeeExperienceNotice, /桌面端/);
  const denied = createHost({ canUseEnterprise: false, getApplicationEnterpriseRuntime() { throw new Error('must not read'); } });
  assert.equal(await denied.prepareEmployeeCollaborationContext(), false);
  assert.match(denied.employeeExperienceNotice, /无法使用企业协作/);
  for (const invalidation of ['access', 'newer-read']) {
    const results = collaborationResults(); const waiting = deferred();
    const oldProjects = [{ id: 'old-project' }];
    let roleReads = 0;
    const host = createHost({ enterpriseProjects: oldProjects, getApplicationEnterpriseRuntime: () => ({
      listApplicationEnterpriseRoleCards: async () => ++roleReads === 1 ? results.roles : { cards: [{ id: 'newer-role', name: 'Newer identity' }] },
      listApplicationEnterpriseWorkspaces: async () => results.workspaces,
      listApplicationEnterpriseProjects: () => waiting.promise,
    }) });
    const pending = host.prepareEmployeeCollaborationContext();
    if (invalidation === 'access') host.canUseEnterprise = false;
    else await host.loadEnterpriseRoleCards();
    waiting.resolve(results.projects);
    assert.equal(await pending, false);
    assert.equal(host.enterpriseProjects, oldProjects);
    if (invalidation === 'newer-read') assert.equal(host.staffRoles[0].id, 'newer-role');
    else assert.match(host.employeeExperienceNotice, /访问权限已变化/);
  }
});

// 生命周期失败和静默失败持久可见，恢复读取清错。Lifecycle errors persist even for silent reads and clear after recovery.
test('skill lifecycle keeps existing records and persistent errors until a successful retry', async () => {
  const items = [{ id: 'known-skill' }]; const summary = { counts: { active: 1 } };
  const host = createHost({ skillLifecycleItems: items, skillLifecycleSummary: summary,
    fetchKernelJson: async () => { throw new Error('lifecycle unavailable'); },
  });
  await host.fetchSkillLifecycle();
  assert.equal(host.skillLifecycleItems, items);
  assert.equal(host.skillLifecycleSummary, summary);
  assert.match(host.skillLifecycleError, /lifecycle unavailable/);
  assert.equal(host.skillLifecycleLoading, false);
  assert.equal(host.notifications.length, 1);
  await host.fetchSkillLifecycle(true);
  assert.match(host.skillLifecycleError, /lifecycle unavailable/);
  assert.equal(host.notifications.length, 1);
  const retry = deferred();
  host.fetchKernelJson = () => retry.promise;
  const loading = host.fetchSkillLifecycle();
  assert.equal(host.skillLifecycleLoading, true);
  assert.equal(host.skillLifecycleError, '');
  retry.resolve({ skills: [], summary: { counts: {} } });
  await loading;
  assert.equal(host.skillLifecycleLoading, false);
  assert.equal(host.skillLifecycleError, '');
  assert.deepEqual(plain(host.skillLifecycleItems), []);
  assert.deepEqual(plain(host.skillLifecycleSummary), { counts: {} });
});
