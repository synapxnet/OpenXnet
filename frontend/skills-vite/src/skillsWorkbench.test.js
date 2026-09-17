/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 用途：技能目录选择与宿主行为回归。 Purpose: Skill catalog selection and host behavior regression tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkillsBridge } from './skillsBridge.js';
import { normalizeSkill, filterSkills, resolveBundles, lifecycleTransitionTargets } from './skillsModel.js';

/** 创建隔离宿主，不操作真实文件或服务。 Create an isolated host without real file or service operations. */
function hostFixture() {
  return {
    currentLanguage: 'zh-CN', activeSkillCenterTab: 'library', CLISettings: { cc_path: 'E:/isolated-workspace' },
    computedSkillsList: [
      { id: 'ui-polish', name: 'Interface', isGlobal: true, isProject: false, author: 'Example', version: '2.1.0', files: ['SKILL.md'], lifecycleStatus: 'verified', evidenceOrigin: 'work', environmentScope: 'staging', productionEligible: false },
      { id: 'project-only', name: 'Project only', isGlobal: false, isProject: true },
    ],
    activeSkillPreviewId: 'ui-polish', activeSkillPreviewSource: 'global', renderedSkillContent: '<p>Interface guide</p>',
    skillCrystalDraft: {}, calls: [],
    /** 记录预览与明确来源。 Record the preview and explicit source. */
    async previewSkill(id, source) { this.calls.push(['preview', id, source]); this.activeSkillPreviewId = id; this.activeSkillPreviewSource = source; },
    /** 模拟选择失效，避免保留旧内容。 Simulate selection invalidation and discard old content. */
    clearSkillPreview() { this.activeSkillPreviewId = ''; this.renderedSkillContent = ''; this.skillPreviewGeneration = (this.skillPreviewGeneration || 0) + 1; },
    /** 模拟名字自动生成 ID。 Simulate the existing name-to-ID helper. */
    syncSkillCrystalIdFromName() { this.skillCrystalDraft.id = 'generated-id'; },
  };
}

/** 验证富元数据和未知字段不丢失。 Verify preservation of rich metadata and unknown fields. */
test('catalog snapshots preserve runtime metadata without modifying original records', () => {
  const host = hostFixture(); host.computedSkillsList[0].customEvidence = { ref: 'evidence-1' };
  const result = createSkillsBridge(() => host).snapshot();
  const skill = result.library.items[0];
  assert.equal(skill.author, 'Example'); assert.equal(skill.version, '2.1.0');
  assert.equal(skill.lifecycleStatus, 'verified'); assert.equal(skill.environmentScope, 'staging');
  assert.deepEqual(skill.customEvidence, { ref: 'evidence-1' }); assert.deepEqual(skill.files, ['SKILL.md']);
  skill.files.push('OTHER.md'); assert.deepEqual(host.computedSkillsList[0].files, ['SKILL.md']);
});
/** 验证删除选中项后不自动显示另一技能正文。 Verify that removed selections never transfer their content to another skill. */
test('a missing selected package produces an empty detail instead of first-item fallback', () => {
  const host = hostFixture(); host.activeSkillPreviewId = 'removed';
  const preview = createSkillsBridge(() => host).snapshot().preview;
  assert.equal(preview.current, null); assert.equal(preview.renderedContent, '');
});
/** 验证搜索使旧预览及请求代次失效。 Verify that search clears old previews and invalidates pending generations. */
test('query changes clear selection through the host invalidation contract', () => {
  const host = hostFixture(); const bridge = createSkillsBridge(() => host);
  bridge.setQuery('project');
  assert.equal(host.skillsLibraryQuery, 'project'); assert.equal(host.skillPreviewGeneration, 1);
  assert.equal(bridge.snapshot().preview.current, null); assert.equal(host.renderedSkillContent, '');
});
/** 验证范围与用途筛选基于真实包。 Verify that location and capability filters use real packages. */
test('query and installation filters do not reclassify project-only packages as global', () => {
  const items = hostFixture().computedSkillsList.map((skill) => normalizeSkill(skill));
  assert.deepEqual(filterSkills(items, { location: 'project' }).map((skill) => skill.id), ['project-only']);
  assert.deepEqual(filterSkills(items, { category: 'build', query: 'interface' }).map((skill) => skill.id), ['ui-polish']);
  assert.deepEqual(filterSkills(items, { category: 'goai' }), []);
});
/** 验证内容来源保持明确且不提交路径。 Verify explicit content sources without renderer-supplied paths. */
test('preview chooses the actual package source and preserves explicit source changes', async () => {
  const host = hostFixture(); const bridge = createSkillsBridge(() => host);
  await bridge.previewSkill('project-only'); await bridge.previewSkill('ui-polish', 'project');
  assert.deepEqual(host.calls, [['preview', 'project-only', 'project'], ['preview', 'ui-polish', 'project']]);
});
/** 验证恢复动作保留确认包装层和来源标记。 Verify restored actions retain confirmation wrappers and location flags. */
test('installation actions call established host methods and preserve removal context', async () => {
  const host = hostFixture();
  /** 记录工作区安装，不写真实磁盘。 Record workspace installation without disk writes. */
  host.syncToProject = async function(id) { this.calls.push(['install', id]); };
  /** 记录经过确认包装层的全局移除。 Record removal through the established confirmation wrapper. */
  host.removeGlobalSkill = async function(skill) { this.calls.push(['remove', skill.id, skill.isProject, skill.isGlobal]); };
  const bridge = createSkillsBridge(() => host);
  await bridge.manageSkill('install', 'ui-polish'); await bridge.manageSkill('removeGlobal', 'ui-polish');
  assert.deepEqual(host.calls, [['install', 'ui-polish'], ['remove', 'ui-polish', false, true]]);
  host.CLISettings.cc_path = '';
  await assert.rejects(bridge.manageSkill('install', 'ui-polish'), /Select a workspace/);
  await assert.rejects(bridge.manageSkill('unknown', 'ui-polish'), /Unknown skill action/);
});
/** 验证不可用接口不会伪装成功。 Verify unavailable or failed actions are not reported as success. */
test('missing and failed host contracts propagate actionable errors', async () => {
  const host = hostFixture(); const bridge = createSkillsBridge(() => host);
  await assert.rejects(bridge.invoke('missingAction'), /unavailable/);
  /** 模拟接口失败。 Simulate a host action failure. */
  host.processSkillUpload = async function() { throw new Error('invalid archive'); };
  await assert.rejects(bridge.invoke('processSkillUpload', {}), /invalid archive/);
});
/** 验证企业权限入口先处理访问状态。 Verify enterprise access handling precedes navigation and loading. */
test('enterprise navigation retains access gating and explicit workspace loading', async () => {
  const host = hostFixture(); host.canUseEnterprise = false;
  /** 记录企业访问提示。 Record enterprise access prompts. */
  host.promptEnterpriseAccess = async function(tab) { this.calls.push(['access', tab]); };
  /** 记录绑定读取。 Record binding reads. */
  host.loadEnterpriseSkills = async function() { this.calls.push(['load']); };
  const bridge = createSkillsBridge(() => host);
  await bridge.openEnterprise(); assert.deepEqual(host.calls, [['access', 'enterprise-skills']]);
  host.canUseEnterprise = true; await bridge.openEnterprise();
  assert.equal(host.activeMenu, 'enterprise'); assert.equal(host.enterpriseTab, 'enterprise-skills');
  assert.deepEqual(host.calls.at(-1), ['load']);
});
/** 验证套组缺项不伪造包或安装结果。 Verify missing bundle members never fabricate packages or installation outcomes. */
test('bundle membership uses stable package IDs and explicitly marks missing members', () => {
  const items = hostFixture().computedSkillsList.map((skill) => normalizeSkill(skill));
  const delivery = resolveBundles(items).find((bundle) => bundle.id === 'delivery');
  assert.equal(delivery.members[0].skill.id, 'ui-polish');
  assert.equal(delivery.members.find((member) => member.id === 'regression-audit').skill, null);

});
/** 验证字段更新沿用已修正名字同步方法。 Verify draft updates retain the corrected name synchronization method. */
test('crystal name synchronization uses the existing helper and rejects unknown fields', () => {
  const host = hostFixture(); const bridge = createSkillsBridge(() => host);
  bridge.setCrystalField('name', 'My skill'); assert.equal(host.skillCrystalDraft.id, 'generated-id');
  bridge.setCrystalField('permissions', ['execute']); assert.equal(host.skillCrystalDraft.permissions, undefined);
});
/** 验证员工映射只使用明确包绑定。 Verify employee mappings use explicit package bindings only. */
test('employee associations do not infer execution bindings from capability labels', () => {
  const host = hostFixture(); host.staffRoles = [{ id: 'a', name: 'Designer', skills: ['ui-polish'], skill_ids: [] }, { id: 'b', name: 'Reviewer', skill_ids: ['ui-polish'], tools: ['read-file'] }];
  const snapshot = createSkillsBridge(() => host).snapshot();
  assert.deepEqual(snapshot.employees.map((employee) => employee.skillIds), [[], ['ui-polish']]);
});

/** 验证同 ID 双副本的详情元数据随来源切换。 Verify metadata follows explicit sources for packages sharing an ID. */
test('duplicate package sources retain their own version, author, description and file list', () => {
  const host = hostFixture();
  host.computedSkillsList[0].isProject = true;
  host.skillsList = [{ id: 'ui-polish', name: 'Global guide', description: 'Global description', author: 'Global author', version: '1.0.0', files: ['SKILL.md', 'global.txt'] }];
  host.projectSkillsDetails = [{ id: 'ui-polish', name: 'Project guide', description: 'Project description', author: 'Project author', version: '3.0.0', files: ['SKILL.md', 'project.txt'] }];
  const bridge = createSkillsBridge(() => host);
  assert.equal(bridge.snapshot().preview.current.version, '1.0.0');
  host.activeSkillPreviewSource = 'project';
  const project = bridge.snapshot().preview.current;
  assert.equal(project.version, '3.0.0'); assert.equal(project.description, 'Project description');
  assert.equal(project.author, 'Project author'); assert.deepEqual(project.files, ['SKILL.md', 'project.txt']);
  assert.equal(project.isGlobal, true); assert.equal(project.isProject, true);
  host.projectSkillsDetails = [];
  const missing = bridge.snapshot().preview.current;
  assert.equal(missing.version, ''); assert.equal(missing.description, ''); assert.equal(missing.sourceMetadataUnavailable, true);
});

/** 验证候选仍可降级，退役条目无不支持的操作。 Verify candidates retain deprecation and retired records expose no unsupported actions. */
test('lifecycle actions preserve existing candidate deprecation and verified activation', () => {
  assert.deepEqual(lifecycleTransitionTargets({ status: 'candidate' }), ['verified', 'deprecated']);
  assert.deepEqual(lifecycleTransitionTargets({ lifecycle_status: 'verified' }), ['active', 'deprecated']);
  assert.deepEqual(lifecycleTransitionTargets({ status: 'retired' }), []);
});
/** 验证生命周期失败不成为空成功，重试状态可区分。 Verify lifecycle errors cannot become empty success and retries remain distinguishable. */
test('lifecycle snapshots distinguish unavailable, retrying and authoritative empty states', () => {
  const host = hostFixture(); host.skillLifecycleItems = []; host.skillLifecycleSummary = { counts: {} };
  host.skillLifecycleError = 'Lifecycle service unavailable'; host.skillLifecycleLoading = false;
  const bridge = createSkillsBridge(() => host);
  assert.equal(bridge.snapshot().lifecycle.phase, 'error');
  assert.equal(bridge.snapshot().lifecycle.error, 'Lifecycle service unavailable');
  host.skillLifecycleLoading = true; host.skillLifecycleError = '';
  assert.equal(bridge.snapshot().lifecycle.phase, 'loading');
  host.skillLifecycleLoading = false;
  assert.equal(bridge.snapshot().lifecycle.phase, 'ready');
  assert.deepEqual(bridge.snapshot().lifecycle.items, []);
  host.skillLifecycleItems = [{ skill_id: 'cached', status: 'verified' }]; host.skillLifecycleError = 'Refresh failed';
  const failed = bridge.snapshot().lifecycle;
  assert.equal(failed.phase, 'error'); assert.equal(failed.items[0].skill_id, 'cached');
});
