/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
用途：企业员工发现、能力护照与协作草稿交互。
Purpose: Enterprise employee discovery, capability passports and collaboration drafts.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/

/** 注册独立员工展示模块，不直接调用后端。 Register the employee presentation module without direct backend calls. */
(function registerEmployeeExperience(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OpenXnetEmployeeExperience = api;
})(typeof window === 'object' ? window : null, /** 创建展示方法集合。 Create the presentation method collection. */ function createEmployeeExperience() {
  'use strict';

  const identities = {
    'goai-incident-commander': { label: 'Incident Commander', role: 'Leader', icon: 'fa-solid fa-tower-broadcast', zh: '统筹调查与计划，申请人工审批。', en: 'Coordinates investigation and plans; requests human approval.' },
    'goai-evidence-agent': { label: 'Evidence Agent', role: 'Worker', icon: 'fa-solid fa-magnifying-glass-chart', zh: '只读收集证据，标明来源与版本。', en: 'Collects read-only evidence with source and version.' },
    'goai-verification-agent': { label: 'Verification Agent', role: 'Verifier', icon: 'fa-solid fa-vial-circle-check', zh: '处置后独立取证，核验业务结果。', en: 'Independently collects evidence and verifies outcomes after remediation.' },
  };
  const scenarios = [
    { id: 'knowledge', icon: 'fa-solid fa-diagram-project', zh: '把知识变成可用答案', en: 'Turn knowledge into useful answers', noteZh: '知识整理 · 检索 · 引用验证', noteEn: 'Curation · retrieval · citations', categories: ['knowledge', 'service', 'research'], deliverZh: '可追溯的知识清单、答案样稿和缺口说明', deliverEn: 'A traceable knowledge list, sample answer and gap report', promptZh: '请整理当前项目可用的知识资料，围绕一个真实业务问题给出带来源的答案；列出无法确认的内容和下一步需要补充的资料。', promptEn: 'Organize the knowledge available to this project and answer a real business question with sources. List uncertain points and the information still needed.' },
    { id: 'recovery', icon: 'fa-solid fa-wave-square', zh: '让每次恢复都有依据', en: 'Make every recovery evidence based', noteZh: '事件调查 · 治理 · 独立验证', noteEn: 'Investigation · governance · verification', categories: ['operations', 'governance', 'quality', 'workspace'], deliverZh: '事件证据、处置候选和独立验证清单', deliverEn: 'Incident evidence, response options and an independent verification checklist', promptZh: '请调查当前服务异常，先收集只读证据并区分事实与推测，提出处置候选和验证标准；涉及变更时先申请人工审批。', promptEn: 'Investigate the service issue using read-only evidence. Separate facts from hypotheses and propose response options and verification criteria. Request human approval before changes.' },
    { id: 'delivery', icon: 'fa-solid fa-layer-group', zh: '让一次交付可以复现', en: 'Make a delivery reproducible', noteZh: '数据准备 · 模型迭代 · 协作交付', noteEn: 'Data · model iteration · delivery', categories: ['platform', 'model', 'workflow', 'integration', 'experience', 'product', 'strategy', 'finance', 'people'], deliverZh: '输入版本、任务分工、交付物与验收条件', deliverEn: 'Input versions, task ownership, deliverables and acceptance criteria', promptZh: '请围绕当前项目目标制定可复现的交付计划，列出输入版本、任务分工、需要的技能与验收条件；缺少资料时明确提出，不假设任务已完成。', promptEn: 'Prepare a reproducible delivery plan for this project. List input versions, task ownership, required skills and acceptance criteria. Identify missing information without assuming work is complete.' },
  ];

  /** 创建仅属于界面的状态，各实例互不共享草稿。 Create isolated UI state without sharing drafts between instances. */
  function createState() {
    return { employeeExperienceView: '', employeeScenarioFilter: '', employeeDetailOpen: false, employeeDetailKind: 'template', employeeDetailId: '', employeeTaskDraft: '', employeeScopeDrafts: {}, employeeExperienceNotice: '', employeeExperienceBusy: false };
  }

  /** 标准化字符串列表，保持顺序并去重。 Normalize a text list while preserving order and removing duplicates. */
  function textList(value) {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const entry of value) {
      const text = String(entry || '').trim();
      if (text && !result.includes(text)) result.push(text);
    }
    return result;
  }

  const methods = {
    /** 按宿主语言选择展示文案。 Select display copy using the host language. */
    employeeText(zh, en) {
      return typeof this.isCurrentLanguageZh !== 'function' || this.isCurrentLanguageZh() ? zh : en;
    },

    /** 已有员工优先显示员工页，否则进入岗位发现。 Prefer employees when present, otherwise show role discovery. */
    getEmployeeExperienceView() {
      return ['discover', 'mine', 'goai'].includes(this.employeeExperienceView) ? this.employeeExperienceView : (this.staffRoles?.length ? 'mine' : 'discover');
    },

    /** 切换员工工作视图，不修改业务资料。 Switch employee views without changing business records. */
    setEmployeeExperienceView(view) {
      if (!['discover', 'mine', 'goai'].includes(view)) return;
      this.employeeExperienceView = view;
      this.employeeExperienceNotice = '';
      this.staffRoleTemplatePage = 1;
    },

    /** 取得本产品原创的任务场景说明。 Return original task scenario descriptions. */
    getEmployeeScenarios() {
      return scenarios;
    },

    /** 场景仅筛选岗位，不创建员工或执行任务。 Filter roles by scenario without creating employees or running tasks. */
    selectEmployeeScenario(id) {
      this.employeeScenarioFilter = this.employeeScenarioFilter === id ? '' : id;
      this.staffRoleTemplateCategory = 'all';
      this.staffRoleTemplateQuery = '';
      this.staffRoleTemplatePage = 1;
    },

    /** 在原岗位搜索分类结果上应用可取消场景筛选。 Apply an optional scenario filter to the native role search results. */
    getEmployeeTemplates() {
      const source = this.getFilteredStaffRoleTemplates();
      const scene = scenarios.find(/** 按场景键查找。 Match the scenario key. */ (item) => item.id === this.employeeScenarioFilter);
      return scene ? source.filter(/** 按岗位类别匹配场景。 Match role categories to the scenario. */ (item) => scene.categories.includes(item.category)) : source;
    },

    /** 计算合法分页状态并保留原每页数量。 Compute bounded pagination using the existing page size. */
    getEmployeePagination() {
      const total = this.getEmployeeTemplates().length;
      const size = Math.max(1, Number(this.staffRoleTemplatePageSize) || 10);
      const pages = Math.max(1, Math.ceil(total / size));
      const page = Math.max(1, Math.min(pages, Number(this.staffRoleTemplatePage) || 1));
      return { total, size, pages, page };
    },

    /** 返回当前页岗位，筛选后不会停留在空的旧页。 Return the current page without stale empty pages after filtering. */
    getEmployeeTemplatePage() {
      const pagination = this.getEmployeePagination();
      return this.getEmployeeTemplates().slice((pagination.page - 1) * pagination.size, pagination.page * pagination.size);
    },

    /** 共享搜索覆盖员工身份、部门及两种技能字段。 Search employee identity, department and both skill fields. */
    getEmployeeFilteredStaff() {
      const query = String(this.staffRoleTemplateQuery || '').trim().toLowerCase();
      return (Array.isArray(this.staffRoles) ? this.staffRoles : []).filter(/** 匹配员工资料，不推断运行状态。 Match employee records without inferring runtime state. */ (role) => !query || [role.name, role.department, role.summaryZh, role.summaryEn, ...textList(role.skills), ...textList(role.skill_ids)].join(' ').toLowerCase().includes(query));
    },

    /** 只依据明确模板键识别 GOAI 身份。 Identify GOAI roles only through explicit template keys. */
    getEmployeeGoaiIdentity(role = {}) {
      const key = String(role.templateId || (this.goaiStaffRoleShortcuts || []).find(/** 仅匹配已有快捷项 ID。 Match an existing shortcut ID only. */ (item) => item.id === role.id)?.id || '');
      return identities[key] || null;
    },

    /** 使用岗位类别生成明确标注为建议的任务资料。 Build explicitly suggested task guidance from the role category. */
    getEmployeePlaybook(role = {}) {
      const identity = this.getEmployeeGoaiIdentity(role);
      const scene = identity ? scenarios[1] : (scenarios.find(/** 匹配岗位所属场景。 Match the role scenario. */ (item) => item.categories.includes(role.category)) || scenarios[2]);
      const roleName = String(role.name || this.employeeText('此岗位', 'this role'));
      const summary = this.employeeText(role.summaryZh || role.description || '', role.summaryEn || role.description || '');
      const identityPrompts = {
        Leader: this.employeeText('请梳理当前事件目标与已有证据，向取证和验证员工分派边界清晰的任务；比较候选计划并准备人工审批材料，不自行批准或执行变更。', 'Clarify the incident objective and existing evidence. Delegate bounded tasks to evidence and verification employees, compare response plans and prepare human approval material. Do not approve or execute changes yourself.'),
        Worker: this.employeeText('请在当前工作空间内只读收集相关平台证据，逐项记录来源、资源版本和观察时间；列出缺失信息与矛盾，不执行变更或给出未经验证的恢复结论。', 'Collect read-only platform evidence within this workspace, recording sources, resource versions and observation times. Identify missing or conflicting information without making changes or claiming unverified recovery.'),
        Verifier: this.employeeText('请在完整处置完成后独立重新采集证据，对照事先约定的业务和技术阈值给出验证结论；不把执行回执当成成功依据，也不修改现有证据。', 'After the complete response has finished, independently collect fresh evidence and verify the agreed business and technical thresholds. Do not treat execution receipts as proof of success or modify existing evidence.'),
      };
      return {
        goal: summary || this.employeeText(`围绕当前项目，由${roleName}明确输入、职责和交付。`, `Define inputs, responsibilities and deliverables for ${roleName} in the current project.`),
        delivery: this.employeeText(scene.deliverZh, scene.deliverEn),
        prompt: identityPrompts[identity?.role] || this.employeeText(scene.promptZh, scene.promptEn),
      };
    },

    /** 按真实组织关系解析空间和项目，拒绝跨空间项目。 Resolve organization scope and reject cross-workspace projects. */
    getEmployeeScope(role = {}) {
      const projects = Array.isArray(this.enterpriseProjects) ? this.enterpriseProjects : [];
      const workspaces = Array.isArray(this.enterpriseWorkspaces) ? this.enterpriseWorkspaces : [];
      const project = projects.find(/** 查找明确项目 ID。 Match the explicit project ID. */ (item) => item.id === role.projectId);
      const workspaceId = String(role.assignedWorkspace || project?.workspaceId || '');
      const workspace = workspaces.find(/** 查找所属工作空间。 Match the owning workspace. */ (item) => item.id === workspaceId);
      const conflict = !!(project && role.assignedWorkspace && project.workspaceId !== role.assignedWorkspace);
      return { workspace, project, workspaceId, conflict, valid: !!workspace && !conflict && (!role.projectId || !!project) };
    },

    /** 能力标签、安装包绑定和工具始终独立展示。 Keep capability labels, package bindings and tools separate. */
    getEmployeePassport(role = {}) {
      const catalog = Array.isArray(this.skillsList) ? this.skillsList : [];
      const packages = textList(role.skill_ids).map(/** 查找对应包，缺失时保留原 ID。 Resolve the matching package and preserve unmatched IDs. */ (id) => {
        const skill = catalog.find(/** 只精确匹配安装包 ID。 Match the package ID exactly. */ (item) => String(item.id || '') === id);
        return { id, name: skill?.name || id, found: !!skill };
      });
      return { tags: textList(role.skills), packages, tools: textList(role.tools), permissions: textList(role.permissions), scope: this.getEmployeeScope(role) };
    },

    /** 每次按 ID 重取详情，避免列表变化后显示其他对象。 Resolve details by ID each time without falling back to another object. */
    getEmployeeDetail() {
      const source = this.employeeDetailKind === 'staff' ? this.staffRoles : this.employeeDetailKind === 'goai' ? this.goaiStaffRoleShortcuts : this.getStaffRoleTemplateEntries();
      return (Array.isArray(source) ? source : []).find(/** 严格匹配当前详情 ID。 Match the selected detail ID exactly. */ (item) => String(item.id || '') === this.employeeDetailId) || null;
    },

    /** 打开资料并准备可编辑建议，不触发创建或保存。 Open details with an editable suggestion without creating or saving. */
    openEmployeeDetail(kind, id) {
      if (!['template', 'staff', 'goai'].includes(kind)) return;
      this.employeeDetailKind = kind;
      this.employeeDetailId = String(id || '');
      const detail = this.getEmployeeDetail();
      if (!detail) return;
      this.employeeTaskDraft = this.getEmployeePlaybook(detail).prompt;
      this.employeeExperienceNotice = '';
      this.employeeDetailOpen = true;
    },

    /** 恢复建议仅改详情中的本地任务草稿。 Restore a suggestion only in the local detail draft. */
    resetEmployeeTaskDraft() {
      const detail = this.getEmployeeDetail();
      if (detail) this.employeeTaskDraft = this.getEmployeePlaybook(detail).prompt;
    },

    /** 详情创建沿用原表单入口，仍由用户编辑并保存。 Open the native creation form for user editing and saving. */
    createEmployeeFromDetail() {
      const detail = this.getEmployeeDetail();
      if (!detail || this.employeeDetailKind === 'staff') return;
      this.employeeDetailOpen = false;
      if (this.employeeDetailKind === 'goai') this.createStaffFromGoaiShortcut(detail);
      else this.createStaffFromTemplate(detail.id);
    },

    /** 编辑员工只进入既有编辑表单。 Open the existing employee editor without persisting changes. */
    editEmployeeFromDetail() {
      const detail = this.getEmployeeDetail();
      if (!detail || this.employeeDetailKind !== 'staff') return;
      this.employeeDetailOpen = false;
      this.openStaffRoleForm(detail);
    },

    /** 打开现有组织或技能管理入口，不做自动安装。 Open existing workspace or skill management without installing anything. */
    async openEmployeeManagement(destination) {
      if (this.canUseEnterprise === false || !['enterprise-workspaces', 'enterprise-skills'].includes(destination)) return;
      this.employeeDetailOpen = false;
      await this.openEnterpriseTab(destination);
    },

    /** 权威只读刷新成功后恢复员工空间，仅准备协作草稿。 Restore employee scope only after an authoritative read-only refresh, preparing a draft only. */
    async prepareEmployeeCollaboration(role, draft = '') {
      if (this.employeeExperienceBusy || !role?.id) return false;
      if (this.canUseEnterprise === false) {
        this.employeeExperienceNotice = this.employeeText('当前账户无法使用企业协作。', 'Enterprise collaboration is unavailable for the current account.');
        return false;
      }
      if (role.enabled === false) {
        this.employeeExperienceNotice = this.employeeText('此员工已停用，请先在员工列表中启用。', 'This employee is disabled. Enable it in the employee list first.');
        return false;
      }
      if (!role.assignedWorkspace && !role.projectId) {
        this.employeeExperienceNotice = this.employeeText('请先编辑员工并分配工作空间，再进入协作。', 'Assign a workspace in the employee editor before opening collaboration.');
        return false;
      }
      this.employeeExperienceBusy = true;
      this.employeeExperienceNotice = '';
      this.ensureEnterpriseChatScope?.();
      const previousState = {
        enterpriseTab: this.enterpriseTab || 'staff-roles',
        sandboxCurrentWs: this.sandboxCurrentWs,
        sandboxCurrentProject: this.sandboxCurrentProject,
        sandboxLevel: this.sandboxLevel,
        selected3DAgent: this.selected3DAgent,
        enterpriseChatInput: this.enterpriseChatInput,
        enterpriseMessages: this.enterpriseMessages,
        employeeDetailOpen: this.employeeDetailOpen,
      };
      let enteredSandbox = false;
      const previousWorkspace = String(this.sandboxCurrentWs || this.selected3DAgent?.assignedWorkspace || '');
      const previousProject = String(this.sandboxCurrentProject || this.selected3DAgent?.projectId || '');
      if (previousWorkspace) this.employeeScopeDrafts[JSON.stringify([previousWorkspace, previousProject])] = String(this.enterpriseChatInput || '');
      try {
        if (typeof this.prepareEmployeeCollaborationContext !== 'function') throw new Error(this.employeeText('只读协作检查暂不可用，请重新打开应用后重试。', 'The read-only collaboration check is unavailable. Reopen the app and try again.'));
        const refreshed = await this.prepareEmployeeCollaborationContext();
        if (refreshed !== true) throw new Error(this.employeeExperienceNotice || this.employeeText('无法确认最新员工和空间资料，草稿已保留，请重试。', 'Could not confirm current employee and workspace data. Your draft is preserved; try again.'));
        const current = (this.staffRoles || []).find(/** 使用刷新后的员工身份。 Use the refreshed employee identity. */ (item) => item.id === role.id);
        const scope = this.getEmployeeScope(current || {});
        if (!current || current.enabled === false || !scope.valid) throw new Error(this.employeeText('员工的空间或项目关系不可用，请检查分配后重试。', 'The employee workspace or project is unavailable. Check its assignment and retry.'));
        this.sandboxCurrentWs = scope.workspaceId;
        this.sandboxCurrentProject = scope.project?.id || null;
        this.sandboxLevel = scope.project ? 2 : 1;
        this.selected3DAgent = current;
        this.enterpriseTab = 'enterprise-sandbox';
        enteredSandbox = true;
        if (typeof this.$nextTick === 'function') await this.$nextTick();
        if (typeof this.init3DView === 'function') await this.init3DView();
        if (typeof this.syncEnterprise3DLevel === 'function') this.syncEnterprise3DLevel();
        const targetDraftKey = JSON.stringify([scope.workspaceId, String(scope.project?.id || '')]);
        this.ensureEnterpriseChatScope?.();
        this.enterpriseChatInput = String(draft || '').trim() || this.employeeScopeDrafts[targetDraftKey] || '';
        // 跨范围读取失败时也不能显示旧空间消息。 Never show messages from the old scope if the new scope read fails.
        if (targetDraftKey !== JSON.stringify([previousWorkspace, previousProject])) this.enterpriseMessages = [];
        this.employeeDetailOpen = false;
        await this.openEnterpriseChat(current);
        return true;
      } catch (error) {
        this.employeeExperienceNotice = error?.message || this.employeeText('协作入口打开失败，请重试。', 'Could not open collaboration. Try again.');
        try {
          if (enteredSandbox && previousState.enterpriseTab !== 'enterprise-sandbox' && typeof this.dispose3DView === 'function') this.dispose3DView();
        } catch (cleanupError) {
          // 保留首个失败原因，随后恢复本地草稿。 Preserve the first failure and then restore the local draft.
        }
        Object.assign(this, previousState);
        return false;
      } finally {
        this.employeeExperienceBusy = false;
      }
    },
  };

  return Object.freeze({ createState, methods });
});
