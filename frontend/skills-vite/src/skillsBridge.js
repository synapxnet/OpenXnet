/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 用途：技能工作台宿主对接。 Purpose: Skill workbench host bridge.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import { normalizeSkill } from './skillsModel.js';
/** 读取宿主实例。 Resolve the mounted host instance. */
function getHostApp() { return typeof window === 'undefined' ? null : window.openxnetApp || null; }
/** 区分生命周期读取中、失败与成功，保留缓存但不冒充权威空列表。 Distinguish pending, failed and successful lifecycle reads without presenting cached data as authoritative emptiness. */
function getLifecycleSnapshot(host) {
  const error = String(host?.skillLifecycleError || '');
  const loading = !!host?.skillLifecycleLoading;
  return {
    summary: { ...(host?.skillLifecycleSummary || {}) }, counts: host?.skillLifecycleSummary?.counts || {},
    items: [...(host?.skillLifecycleItems || [])], loading, error,
    phase: loading ? 'loading' : error ? 'error' : 'ready',
    running: !!host?.skillLifecycleRunning, states: host?.getSkillLifecycleStates?.() || [],
  };
}
/** 创建可测试桥接，写入沿用真实宿主动作。 Create a testable bridge with writes delegated to real host actions. */
export function createSkillsBridge(resolveHost = getHostApp) {
  /** 调用宿主方法，缺失接口明确报错。 Invoke a host method and report unavailable contracts explicitly. */
  async function invoke(method, ...args) {
    const host = resolveHost();
    if (typeof host?.[method] !== 'function') throw new Error(`技能接口暂不可用 / Skill action unavailable: ${method}`);
    return await host[method](...args);
  }
  /** 输出完整目录和确定选择，不把正文移给其他技能。 Snapshot the full catalog and exact selection without content substitution. */
  function snapshot() {
    const host = resolveHost();
    const isZh = typeof host?.isCurrentLanguageZh === 'function' ? !!host.isCurrentLanguageZh() : !String(host?.currentLanguage || 'zh').startsWith('en');
    const records = Array.isArray(host?.computedSkillsList) ? host.computedSkillsList : (host?.skillsList || []).map((skill) => ({ ...skill, isGlobal: true }));
    const items = records.map((skill) => normalizeSkill(skill, isZh));
    const activeId = String(host?.activeSkillPreviewId || '');
    const catalogSkill = items.find((skill) => skill.id === activeId) || null;
    const source = String(host?.activeSkillPreviewSource || 'global');
    const sourceRecords = source === 'project' ? host?.projectSkillsDetails : host?.skillsList;
    const sourceRecord = Array.isArray(sourceRecords) ? sourceRecords.find((skill) => skill.id === activeId) : null;
    const sourceUnavailable = !!catalogSkill && Array.isArray(sourceRecords) && !sourceRecord;
    const current = !catalogSkill ? null : sourceRecord
      ? normalizeSkill({ ...sourceRecord, isGlobal: catalogSkill.isGlobal, isProject: catalogSkill.isProject }, isZh)
      : sourceUnavailable
        ? normalizeSkill({ id: activeId, name: catalogSkill.name, isGlobal: catalogSkill.isGlobal, isProject: catalogSkill.isProject, sourceMetadataUnavailable: true }, isZh)
        : catalogSkill;
    return {
      isZh, available: !!host, activeMenu: String(host?.activeMenu || ''), activeTab: String(host?.activeSkillCenterTab || 'library'),
      query: String(host?.skillsLibraryQuery || ''), workspacePath: String(host?.CLISettings?.cc_path || ''), canUseEnterprise: host?.canUseEnterprise === true,
      library: { items, loading: !!host?.skillsLoading || !!host?.projectSkillsLoading, error: String(host?.skillCatalogError || host?.projectSkillsError || '') },
      preview: { activeId, current, source, loading: !!current && !!host?.skillPreviewLoading, error: current ? String(host?.skillPreviewError || '') : '', renderedContent: current ? String(host?.renderedSkillContent || '') : '' },
      transform: { githubUrl: String(host?.newSkillUrl || ''), isInstalling: !!host?.isSkillInstalling, isUploading: !!host?.isUploading },
      crystal: { draft: { ...(host?.skillCrystalDraft || {}) }, preview: String(host?.skillCrystalPreview || ''), busy: !!host?.isSkillCrystallizing, sourceOptions: host?.getSkillCrystalSourceOptions?.() || [] },
      lifecycle: getLifecycleSnapshot(host),
      employees: (host?.staffRoles || []).map((role) => ({ id: role.id, name: role.name, skillIds: Array.isArray(role.skill_ids) ? [...role.skill_ids] : [] })),
    };
  }
  /** 切换页面并按需读取生命周期。 Open a host surface and load lifecycle data when needed. */
  async function openTab(tab) { await invoke('openSkillCenter', tab); if (tab === 'lifecycle') await invoke('fetchSkillLifecycle', false); }
  /** 清理选择并使在途预览失效。 Clear selection and invalidate pending previews. */
  function clearPreview() {
    const host = resolveHost();
    if (typeof host?.clearSkillPreview === 'function') return host.clearSkillPreview();
    if (host) { host.activeSkillPreviewId = ''; host.renderedSkillContent = ''; host.skillPreviewError = ''; host.skillPreviewLoading = false; }
  }
  /** 修改搜索并清理旧预览。 Update the query and discard the old preview. */
  function setQuery(value) { const host = resolveHost(); if (host) host.skillsLibraryQuery = String(value); clearPreview(); }
  /** 按确定安装来源读取正文。 Read skill content from its selected installation source. */
  async function previewSkill(id, source) {
    const skill = snapshot().library.items.find((item) => item.id === id);
    if (!skill) throw new Error('技能不在当前目录 / Skill is no longer in the catalog.');
    return await invoke('previewSkill', id, source || (skill.isGlobal ? 'global' : 'project'));
  }
  /** 执行现有安装动作并保留移除确认。 Run existing installation actions and retain removal confirmations. */
  async function manageSkill(action, id) {
    const skill = snapshot().library.items.find((item) => item.id === id);
    if (!skill) throw new Error('技能已不可用 / Skill is unavailable.');
    const methods = { install: 'syncToProject', removeProject: 'removeProjectSkill', syncGlobal: 'syncToGlobal', removeGlobal: 'removeGlobalSkill' };
    if (!methods[action]) throw new Error('未知技能操作 / Unknown skill action.');
    if (['install', 'removeProject', 'syncGlobal'].includes(action) && !snapshot().workspacePath) throw new Error('请先选择工作区 / Select a workspace first.');
    return await invoke(methods[action], action.startsWith('remove') ? skill : id);
  }
  /** 进入企业页面，沿用原有登录权限提示。 Open enterprise management using existing access handling. */
  async function openEnterprise(tab = 'enterprise-skills') {
    const host = resolveHost();
    if (!host?.canUseEnterprise) return await invoke('promptEnterpriseAccess', tab);
    host.activeMenu = 'enterprise'; host.enterpriseTab = tab;
    if (tab === 'enterprise-skills') await invoke('loadEnterpriseSkills');
  }
  /** 更新结晶草稿，沿用名字同步和预览。 Update crystal fields and retain name synchronization and preview generation. */
  function setCrystalField(field, value) {
    const host = resolveHost();
    if (!host?.skillCrystalDraft || !['source', 'name', 'id', 'description', 'trigger', 'workflow', 'notes', 'syncToWorkspace'].includes(field)) return;
    host.skillCrystalDraft[field] = value;
    if (field === 'name') host.syncSkillCrystalIdFromName?.();
    else if (field === 'id') host.handleSkillCrystalIdInput?.();
    else host.refreshSkillCrystalPreview?.();
  }
  /** 保存仓库地址，不开始安装。 Store a repository URL without starting installation. */
  function setGithubUrl(value) { const host = resolveHost(); if (host) host.newSkillUrl = String(value); }
  return { snapshot, invoke, openTab, clearPreview, setQuery, previewSkill, manageSkill, openEnterprise, setCrystalField, setGithubUrl };
}
