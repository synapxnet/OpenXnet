/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 用途：技能发现与真实套组模型。 Purpose: Skill discovery and real package bundle model.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
export const SKILL_GROUPS = [
  { id: 'all', zh: '全部能力', en: 'All capabilities', icon: 'fa-solid fa-shapes' },
  { id: 'build', zh: '产品与交付', en: 'Build & deliver', icon: 'fa-solid fa-pen-ruler' },
  { id: 'knowledge', zh: '知识与协作', en: 'Knowledge & teamwork', icon: 'fa-solid fa-diagram-project' },
  { id: 'govern', zh: '治理与运维', en: 'Governance & operations', icon: 'fa-solid fa-shield-halved' },
  { id: 'goai', zh: 'GOAI 任务', en: 'GOAI tasks', icon: 'fa-solid fa-cubes' },
];
export const SKILL_BUNDLES = [
  { id: 'delivery', zh: '从界面到交付', en: 'Interface to delivery', descriptionZh: '整理界面、验证关键流程，再准备发布。', descriptionEn: 'Refine interfaces, check workflows, then prepare delivery.', icon: 'fa-solid fa-pen-ruler', skillIds: ['ui-polish', 'regression-audit', 'release-checklist'], starterZh: '请先梳理这个界面的主任务，提出层级与间距调整，再列出发布前必须验证的操作。', starterEn: 'Map the primary interface task, propose layout and spacing changes, then list interactions to verify before delivery.' },
  { id: 'knowledge', zh: '把经验变成协作能力', en: 'Knowledge into teamwork', descriptionZh: '组织知识、设计员工岗位，并安排任务交接。', descriptionEn: 'Structure knowledge, define employee roles and plan handoffs.', icon: 'fa-solid fa-diagram-project', skillIds: ['knowledge-base-curator', 'role-card-builder', 'agent-orchestrator'], starterZh: '请根据现有项目资料，整理知识目录、岗位职责与交接清单，标注缺失的信息。', starterEn: 'Draft a knowledge index, role responsibilities and handoff checklist from project materials, identifying missing information.' },
  { id: 'goai', zh: '企业事件协作', en: 'Enterprise incident teamwork', descriptionZh: '取证、制定受控计划、独立验证，连接 GOAI 主线。', descriptionEn: 'Collect evidence, prepare a governed plan and independently verify outcomes.', icon: 'fa-solid fa-cubes', skillIds: ['goai-evidence-collect', 'goai-change-execute', 'goai-service-verify'], starterZh: '请整理当前事件的只读证据需求、人工审批点和独立验证标准，先给出计划。', starterEn: 'Outline read-only evidence needs, human approval points and independent verification criteria. Start with a plan.' },
  { id: 'operations', zh: '模型服务排查', en: 'Diagnose model services', descriptionZh: '定位连接与工作区问题，核对真实配置边界。', descriptionEn: 'Inspect connectivity and workspace issues within explicit configuration boundaries.', icon: 'fa-solid fa-satellite-dish', skillIds: ['provider-diagnostics', 'workspace-ops', 'security-audit'], starterZh: '请先检查模型服务与工作区的连接条件，列出证据和可验证的修复建议。', starterEn: 'Inspect model service and workspace connection requirements, then list evidence and verifiable repair recommendations.' },
];
/** 根据真实包 ID 分类。 Classify actual package IDs. */
export function skillGroup(id) {
  if (/^(goai-|synapxnet-)/i.test(id)) return 'goai';
  if (/(ui-polish|regression|release|office|presentation|document|spreadsheet)/i.test(id)) return 'build';
  if (/(knowledge|role-card|agent-orchestrator|memory|find-skills)/i.test(id)) return 'knowledge';
  if (/(diagnos|security|workspace|subscription|ops)/i.test(id)) return 'govern';
  return 'all';
}
/** 保留运行时元数据，规范展示字段。 Preserve runtime metadata and normalize display fields. */
export function normalizeSkill(skill, isZh = true) {
  const id = String(skill.id || '').trim();
  const group = skillGroup(id);
  const category = SKILL_GROUPS.find((item) => item.id === group) || SKILL_GROUPS[0];
  return {
    ...skill, id, group, groupLabel: isZh ? category.zh : category.en, icon: category.icon,
    name: String(skill.displayName || skill.name || id), alias: String(skill.displayAlias || id),
    description: String(skill.displayDescription || skill.description || ''),
    previewSummary: String(skill.previewSummary || skill.displayDescription || skill.description || ''),
    previewHighlights: Array.isArray(skill.previewHighlights) ? [...skill.previewHighlights] : [],
    tags: Array.isArray(skill.tags) ? [...skill.tags] : [], files: Array.isArray(skill.files) ? [...skill.files] : [],
    version: String(skill.version || ''), author: String(skill.author || ''),
    lifecycleStatus: String(skill.lifecycleStatus || skill.lifecycle_status || 'legacy'),
    evidenceOrigin: String(skill.evidenceOrigin || skill.evidence_origin || 'legacy'),
    environmentScope: String(skill.environmentScope || skill.environment_scope || 'legacy'),
    familyId: String(skill.familyId || skill.family_id || ''),
    isGlobal: skill.isGlobal === true, isProject: skill.isProject === true,
    installed: skill.isGlobal === true || skill.isProject === true, productionEligible: skill.productionEligible === true,
  };
}
/** 按关键词、类别及安装位置筛选本地目录。 Filter the local catalog by query, category and installation location. */
export function filterSkills(items, { query = '', category = 'all', location = 'all' } = {}) {
  const text = String(query).trim().toLowerCase();
  return items.filter((skill) => {
    if (category !== 'all' && skill.group !== category) return false;
    if (location === 'global' && !skill.isGlobal) return false;
    if (location === 'project' && !skill.isProject) return false;
    if (location === 'installed' && !skill.installed) return false;
    return !text || [skill.id, skill.name, skill.description, skill.alias, ...skill.tags].join(' ').toLowerCase().includes(text);
  });
}
/** 套组解析真实安装包，缺失成员明确为空。 Resolve real bundle packages with explicit missing members. */
export function resolveBundles(items) {
  const byId = new Map(items.map((skill) => [skill.id, skill]));
  return SKILL_BUNDLES.map((bundle) => ({ ...bundle, members: bundle.skillIds.map((id) => ({ id, skill: byId.get(id) || null })) }));
}
/** 生成原创可编辑建议，不代表历史执行记录。 Generate editable original suggestions without claiming previous execution. */
export function createTaskStarter(skill, isZh = true) {
  const bundle = SKILL_BUNDLES.find((item) => item.skillIds.includes(skill.id));
  if (bundle) return isZh ? bundle.starterZh : bundle.starterEn;
  return isZh ? `请使用「${skill.name}」协助我处理：\n目标：\n相关资料：\n预期交付：\n先确认缺失信息并给出计划，执行前说明需要的权限。` : `Help me with ${skill.name}:\nGoal:\nMaterials:\nExpected deliverable:\nIdentify missing information, propose a plan and explain required permissions before execution.`;
}
/** 翻译已知状态并保留未知值。 Localize known metadata values while preserving unknown values. */
export function metadataLabel(value, isZh = true) {
  const labels = {
    candidate: ['候选', 'Candidate'], verified: ['已验证', 'Verified'], active: ['启用', 'Active'], deprecated: ['降级', 'Deprecated'], retired: ['退役', 'Retired'], legacy: ['未标注', 'Not specified'],
    work: ['工作沉淀', 'Work'], rehearsal: ['演练', 'Rehearsal'], manual: ['人工整理', 'Manual'], external: ['外部导入', 'External'],
    synthetic: ['合成环境', 'Synthetic'], simulation: ['仿真', 'Simulation'], staging: ['预发布', 'Staging'], shadow: ['影子验证', 'Shadow'], canary: ['灰度', 'Canary'], production: ['生产', 'Production'],
  };
  return labels[value]?.[isZh ? 0 : 1] || value || (isZh ? '未提供' : 'Not provided');
}

/** 保留旧版验证、启用和降级入口，最终由宿主校验。 Retain existing verify, activate and deprecate actions for host validation. */
export function lifecycleTransitionTargets(item) {
  const status = item.status || item.lifecycle_status;
  const targets = status === 'candidate' ? ['verified'] : status === 'verified' ? ['active'] : [];
  if (status && !['deprecated', 'retired'].includes(status)) targets.push('deprecated');
  return targets;
}
