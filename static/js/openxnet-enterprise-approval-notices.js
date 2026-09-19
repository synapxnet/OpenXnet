/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
全局企业人工审批提醒与冻结决定 / Global enterprise human approval notices and bound decisions.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
/** 注册可独立验证的审批提醒模块。 Register the independently verifiable approval notice module. */
(function registerEnterpriseApprovalNotices(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OpenXnetEnterpriseApprovalNotices = api;
})(typeof window === 'object' ? window : null, /** 创建无定时器的审批行为。 Create approval behavior without background timers. */ function createEnterpriseApprovalNotices() {
  'use strict';

  /** 绑定标识必须是非空原值，禁止静默改写。 Binding identifiers must be nonempty original values without silent rewriting. */
  function validBinding(value) { return typeof value === 'string' && value.length > 0 && value.length <= 4096 && value.trim() === value; }

  /** 复制并深冻结完整授权范围与计划绑定。 Copy and deeply freeze the complete authorization scopes and plan binding. */
  function freezeApprovalTarget(approval) {
    const fields = ['approvalId', 'incidentId', 'workspaceId', 'traceId', 'planId', 'planDigest'];
    if (!approval || fields.some(/** 拒绝缺少绑定的审批。 Reject approvals with missing bindings. */ field => !validBinding(approval[field]))
      || !Array.isArray(approval.scopes) || approval.scopes.length === 0) return null;
    const scopes = [];
    for (const source of approval.scopes) {
      if (!source || ['stepId', 'toolName', 'resourceId', 'expectedResourceVersion', 'argumentsDigest'].some(/** 核验所有授权字段存在。 Verify every authorization field exists. */ field => !validBinding(source[field]))
        || !Number.isInteger(source.targetRevision) || source.targetRevision < 0 || typeof source.compensation !== 'boolean') return null;
      scopes.push(Object.freeze({ stepId: source.stepId, toolName: source.toolName, resourceId: source.resourceId,
        targetRevision: source.targetRevision, expectedResourceVersion: source.expectedResourceVersion,
        argumentsDigest: source.argumentsDigest, compensation: source.compensation }));
    }
    return Object.freeze({ approvalId: approval.approvalId, incidentId: approval.incidentId, workspaceId: approval.workspaceId,
      traceId: approval.traceId, planId: approval.planId, planDigest: approval.planDigest, scopes: Object.freeze(scopes) });
  }

  /** 稳定序列化固定字段，比较范围顺序和每个授权值。 Serialize fixed fields stably to compare scope order and every authorization value. */
  function targetKey(target) { return target ? JSON.stringify(target) : ''; }

  /** 只接受包含完整事件和审批列表的快照。 Accept only snapshots containing complete incident and approval arrays. */
  function validSnapshot(snapshot) { return !!snapshot && Array.isArray(snapshot.incidents) && Array.isArray(snapshot.approvals); }

  /** 全空间提取当前审批，对重复身份冲突采用拒绝而非猜测。 Collect current approvals across workspaces and reject conflicting duplicate identities rather than guessing. */
  function collectPending(snapshot) {
    if (!validSnapshot(snapshot)) return [];
    const incidents = new Map(); const approvals = new Map();
    for (const incident of snapshot.incidents) {
      if (!validBinding(incident?.incidentId)) continue;
      const signature = JSON.stringify([incident.incidentId, incident.workspaceId, incident.activeTraceId, incident.activeApprovalId, incident.status]);
      const previous = incidents.get(incident.incidentId);
      incidents.set(incident.incidentId, previous && previous.signature !== signature ? { signature: null, incident: null } : previous || { signature, incident });
    }
    for (const approval of snapshot.approvals) {
      if (!validBinding(approval?.approvalId)) continue;
      const target = freezeApprovalTarget(approval);
      const signature = JSON.stringify([approval.status, targetKey(target)]);
      const previous = approvals.get(approval.approvalId);
      approvals.set(approval.approvalId, previous && previous.signature !== signature ? { signature: null, target: null, approval: null } : previous || { signature, target, approval });
    }
    const found = [];
    for (const { incident } of incidents.values()) {
      if (!incident || incident.status !== 'AWAITING_APPROVAL') continue;
      const entry = approvals.get(incident.activeApprovalId);
      if (!entry?.target || entry.approval.status !== 'PENDING') continue;
      const target = entry.target;
      if (target.incidentId !== incident.incidentId || target.workspaceId !== incident.workspaceId || target.traceId !== incident.activeTraceId) continue;
      found.push({ target, incident, approval: entry.approval });
    }
    return found.sort(/** 稳定优先呈现最早请求，不随轮询顺序抢焦点。 Present the oldest request stably without focus changes from polling order. */ (left, right) => String(left.approval.requestedAt || '').localeCompare(String(right.approval.requestedAt || '')) || targetKey(left.target).localeCompare(targetKey(right.target)));
  }

  /** 创建独立会话状态，不持久化权限或原始工具参数。 Create isolated session state without persisting permissions or raw tool arguments. */
  function createState() {
    return { enterpriseApprovalNoticeVisible: false, enterpriseApprovalNoticeTarget: null, enterpriseApprovalNoticePending: [],
      enterpriseApprovalNoticeBusy: false, enterpriseApprovalNoticeError: '', enterpriseApprovalNoticeStale: false,
      enterpriseApprovalNoticeReason: '', enterpriseApprovalNoticeExecutionMode: 'step', enterpriseApprovalNoticeDismissed: [],
      enterpriseApprovalNoticeEnabled: true, enterpriseApprovalNoticeGeneration: 0, enterpriseApprovalNoticeOutcome: '', enterpriseApprovalNoticeOutcomeRecovered: false,
      enterpriseApprovalNoticeReview: null, enterpriseApprovalNoticeSnapshot: null, enterpriseApprovalNoticeDrafts: {}, enterpriseApprovalNoticeRequestedAt: '' };
  }

  const methods = {
    /** 返回当前语言的固定文案。 Return fixed copy in the current language. */
    enterpriseApprovalNoticeText(zh, en) { return this.isCurrentLanguageZh?.() ? zh : en; },

    /** 所有公开输出复用既有脱敏函数，缺失时不返回原值。 Reuse the established sanitizer for all public output and never fall back to raw values. */
    cleanEnterpriseApprovalNoticeText(value, limit = 256) {
      return typeof this.getCompetitionApprovalPublicText === 'function' ? this.getCompetitionApprovalPublicText(typeof value === 'string' ? value : '', limit) : '';
    },

    /** 只有明确企业权限与启用会话才允许显示或决定。 Allow display and decisions only with explicit enterprise permission and an enabled session. */
    canUseEnterpriseApprovalNotices() { return this.canUseEnterprise === true && this.enterpriseApprovalNoticeEnabled === true; },

    /** 登录退出时清理队列并使所有旧异步回调失效。 Clear the queue on session changes and invalidate every previous asynchronous callback. */
    resetEnterpriseApprovalNotices(enabled = false) {
      const generation = this.enterpriseApprovalNoticeGeneration + 1;
      Object.assign(this, createState());
      this.enterpriseApprovalNoticeGeneration = generation;
      this.enterpriseApprovalNoticeEnabled = enabled === true;
    },

    /** 在全部空间同步审批，但不替换用户正在审阅的冻结项。 Synchronize approvals across all workspaces without replacing the frozen item under review. */
    syncEnterpriseApprovalNotices(snapshot) {
      if (!this.canUseEnterpriseApprovalNotices()) {
        if (this.canUseEnterprise !== true) this.resetEnterpriseApprovalNotices(false);
        return [];
      }
      if (!validSnapshot(snapshot)) return this.enterpriseApprovalNoticePending;
      const previousTime = Date.parse(this.enterpriseApprovalNoticeSnapshot?.updatedAt || '');
      const nextTime = Date.parse(snapshot.updatedAt || '');
      if (Number.isFinite(previousTime) && Number.isFinite(nextTime) && nextTime < previousTime) return this.enterpriseApprovalNoticePending;
      this.enterpriseApprovalNoticeSnapshot = snapshot;
      const entries = collectPending(snapshot);
      this.enterpriseApprovalNoticePending = entries.map(/** 保存独立冻结的当前候选。 Keep independently frozen current candidates. */ entry => entry.target);
      if (this.enterpriseApprovalNoticeVisible && this.enterpriseApprovalNoticeTarget) {
        const key = targetKey(this.enterpriseApprovalNoticeTarget);
        if (!entries.some(/** 只认完整绑定一致的当前审批。 Require a current approval with identical complete bindings. */ entry => targetKey(entry.target) === key)) {
          this.enterpriseApprovalNoticeStale = true;
          if (!this.enterpriseApprovalNoticeOutcome) this.enterpriseApprovalNoticeError = this.enterpriseApprovalNoticeText('这项审批已处理或计划已变化，请关闭后重新查看待批事项。', 'This approval was handled or its plan changed. Close it and reopen pending approvals.');
        }
        return this.enterpriseApprovalNoticePending;
      }
      if (!this.enterpriseApprovalNoticeBusy) {
        const next = entries.find(/** 已关闭的同计划不因轮询重复弹出。 Do not redisplay the same dismissed plan on polling. */ entry => !this.enterpriseApprovalNoticeDismissed.includes(targetKey(entry.target)));
        if (next) this.openEnterpriseApprovalNotice(next.target.approvalId);
      }
      return this.enterpriseApprovalNoticePending;
    },

    /** 返回全空间当前合法待批数量，不受页面筛选影响。 Return the valid pending count across all workspaces independently of page filters. */
    getEnterpriseApprovalNoticeCount() { return this.canUseEnterpriseApprovalNotices() ? this.enterpriseApprovalNoticePending.length : 0; },

    /** 只提供净化后的便签字段，当前已决或失效项临时保留。 Expose only sanitized tab fields and temporarily retain the current decided or stale item. */
    getEnterpriseApprovalNoticeTabs() {
      if (!this.canUseEnterpriseApprovalNotices()) return [];
      const entries = collectPending(this.enterpriseApprovalNoticeSnapshot);
      const current = this.enterpriseApprovalNoticeVisible ? this.enterpriseApprovalNoticeTarget : null;
      const currentKey = targetKey(current);
      const recorded = current ? (this.enterpriseApprovalNoticeSnapshot?.approvals || []).find(/** 只读取冻结计划本身的结果。 Read the outcome of the frozen plan itself only. */ approval => targetKey(freezeApprovalTarget(approval)) === currentKey) : null;
      const currentStatus = this.enterpriseApprovalNoticeOutcome || (['APPROVED', 'REJECTED'].includes(recorded?.status) ? recorded.status : this.enterpriseApprovalNoticeStale ? 'STALE' : 'PENDING');
      const tabs = entries.map(/** 按原队列顺序生成独立便签，不暴露目标及授权数据。 Build separate tabs in queue order without exposing targets or authorization data. */ entry => {
        const isCurrent = !!current && entry.target.approvalId === current.approvalId;
        const review = isCurrent ? this.enterpriseApprovalNoticeReview : this.buildEnterpriseApprovalNoticeReview(entry, this.enterpriseApprovalNoticeSnapshot);
        return { approvalId: this.cleanEnterpriseApprovalNoticeText(entry.target.approvalId), title: this.cleanEnterpriseApprovalNoticeText(review?.title, 160),
          workspaceName: this.cleanEnterpriseApprovalNoticeText(review?.workspaceName, 160), status: isCurrent ? currentStatus : 'PENDING', current: isCurrent, stale: isCurrent && currentStatus === 'STALE' };
      });
      if (current && !entries.some(/** 同身份换计划时只保留一个当前便签。 Keep only one current tab when the same identity receives a new plan. */ entry => entry.target.approvalId === current.approvalId)) {
        const position = entries.filter(/** 已决项继续使用原请求时间和稳定身份排序，避免便签编号跳动。 Keep decided items ordered by their original request time and stable identity to prevent tab-number jumps. */ entry => {
          const timeOrder = String(entry.approval.requestedAt || '').localeCompare(this.enterpriseApprovalNoticeRequestedAt);
          return timeOrder < 0 || (timeOrder === 0 && targetKey(entry.target).localeCompare(currentKey) < 0);
        }).length;
        tabs.splice(position, 0, { approvalId: this.cleanEnterpriseApprovalNoticeText(current.approvalId), title: this.cleanEnterpriseApprovalNoticeText(this.enterpriseApprovalNoticeReview?.title, 160),
          workspaceName: this.cleanEnterpriseApprovalNoticeText(this.enterpriseApprovalNoticeReview?.workspaceName, 160), status: currentStatus, current: true, stale: currentStatus === 'STALE' });
      }
      return tabs;
    },

    /** 清除单个完整计划的说明和执行模式草稿。 Clear the reason and execution-mode draft for one complete plan. */
    clearEnterpriseApprovalNoticeDraft(target) {
      const key = targetKey(target);
      if (!key || !Object.hasOwn(this.enterpriseApprovalNoticeDrafts, key)) return;
      const drafts = { ...this.enterpriseApprovalNoticeDrafts }; delete drafts[key]; this.enterpriseApprovalNoticeDrafts = drafts;
    },

    /** 离开时只保存仍可审阅的原计划草稿。 Save a draft on leaving only while its original plan remains reviewable. */
    saveEnterpriseApprovalNoticeDraft() {
      const target = this.enterpriseApprovalNoticeTarget; const key = targetKey(target);
      if (!key) return;
      if (this.enterpriseApprovalNoticeOutcome || this.enterpriseApprovalNoticeStale) { this.clearEnterpriseApprovalNoticeDraft(target); return; }
      this.enterpriseApprovalNoticeDrafts = { ...this.enterpriseApprovalNoticeDrafts, [key]: {
        reason: typeof this.enterpriseApprovalNoticeReason === 'string' ? this.enterpriseApprovalNoticeReason.slice(0, 2000) : '',
        executionMode: this.enterpriseApprovalNoticeExecutionMode === 'automatic' ? 'automatic' : 'step',
      } };
    },

    /** 用户明确点击便签才切换审批，提交中禁止更换目标。 Switch approvals only on an explicit tab click and never during submission. */
    selectEnterpriseApprovalNotice(approvalId) {
      if (!this.canUseEnterpriseApprovalNotices() || this.enterpriseApprovalNoticeBusy || typeof approvalId !== 'string') return false;
      const entry = collectPending(this.enterpriseApprovalNoticeSnapshot).find(/** 按当前合法审批身份解析便签。 Resolve the tab through a currently valid approval identity. */ item => item.target.approvalId === approvalId);
      if (!entry) return false;
      if (this.enterpriseApprovalNoticeVisible && targetKey(this.enterpriseApprovalNoticeTarget) === targetKey(entry.target)) return true;
      this.saveEnterpriseApprovalNoticeDraft();
      this.enterpriseApprovalNoticeVisible = false;
      return this.openEnterpriseApprovalNotice(entry.target.approvalId);
    },

    /** 构建冻结目标的有界业务投影，只关联同空间同运行的来源。 Build a bounded business projection for the frozen target using only same-workspace, same-run sources. */
    buildEnterpriseApprovalNoticeReview(entry, snapshot) {
      const { target, incident, approval } = entry;
      const clean = this.cleanEnterpriseApprovalNoticeText.bind(this);
      const workspace = (Array.isArray(this.enterpriseWorkspaces) ? this.enterpriseWorkspaces : []).find(/** 精确查找空间，不使用当前选中项。 Match the workspace exactly without the current selection. */ item => item?.id === target.workspaceId);
      const contexts = (Array.isArray(snapshot.residentContexts) ? snapshot.residentContexts : []).filter(/** 来源只允许当前绑定的运行。 Admit sources only for the bound run. */ item => item?.workspaceId === target.workspaceId && item.incidentId === target.incidentId && item.traceId === target.traceId);
      const sources = [...new Set(contexts.map(/** 提取固化来源类型。 Read captured source types. */ item => item.source))];
      const sourceNames = { SIMULATION: this.enterpriseApprovalNoticeText('本地模拟 (Fixture)', 'Local simulation (Fixture)'),
        'LIVE-STAGING': this.enterpriseApprovalNoticeText('Live 现场', 'Live environment'), REPLAY: this.enterpriseApprovalNoticeText('历史回放', 'Historical replay') };
      const sourceLabel = sources.length === 1 && Object.hasOwn(sourceNames, sources[0]) ? sourceNames[sources[0]] : this.enterpriseApprovalNoticeText('本次来源未确认', 'Run source unconfirmed');
      const graphs = (Array.isArray(snapshot.taskGraphs) ? snapshot.taskGraphs : []).filter(/** 任务图必须属于审批的空间、事件及追踪。 Require the graph to match the approval workspace, incident and trace. */ graph => graph?.workspaceId === target.workspaceId && graph.incidentId === target.incidentId && graph.traceId === target.traceId);
      const graph = [...graphs].sort(/** 只在同一运行内选最新图。 Choose the latest graph only within the same run. */ (a, b) => Number(b.revision || 0) - Number(a.revision || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
      const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
      const scopes = target.scopes.map(/** 保留授权原顺序，不推断未提供的参数。 Preserve authorization order without inferring missing arguments. */ (scope, index) => {
        const node = scope.compensation === false ? nodes.find(/** 主步骤使用原步骤键与工具名精确关联。 Join primary steps by the exact step key and tool name. */ item => item?.nodeId === `execute:${scope.stepId}` && item.toolName === scope.toolName) : null;
        return Object.freeze({ stepId: clean(scope.stepId), title: clean(node?.title || this.enterpriseApprovalNoticeText(scope.compensation ? `补偿范围 ${index + 1}` : `授权步骤 ${index + 1}`, scope.compensation ? `Compensation scope ${index + 1}` : `Authorized step ${index + 1}`)),
          toolName: clean(scope.toolName), resourceId: clean(scope.resourceId, 1024), targetRevision: scope.targetRevision,
          expectedResourceVersion: clean(scope.expectedResourceVersion, 1024), argumentsDigest: clean(scope.argumentsDigest), compensation: scope.compensation });
      });
      return Object.freeze({ title: clean(incident.title || this.enterpriseApprovalNoticeText('企业协同任务', 'Enterprise task'), 160),
        workspaceName: clean(workspace?.name || this.enterpriseApprovalNoticeText('未关联的工作空间', 'Unlinked workspace'), 160),
        sourceLabel: clean(sourceLabel), summary: clean(approval.reason || incident.summary || '', 1200),
        requestedBy: clean(approval.requestedBy), requestedAt: clean(approval.requestedAt), approvalId: clean(target.approvalId),
        traceId: clean(target.traceId), planId: clean(target.planId), planDigest: clean(target.planDigest), scopes: Object.freeze(scopes) });
    },

    /** 手动重开合法当前审批，已有审阅项不得被其他审批抢占。 Reopen a valid current approval without letting another approval replace one under review. */
    openEnterpriseApprovalNotice(approvalId = null) {
      if (!this.canUseEnterpriseApprovalNotices() || this.enterpriseApprovalNoticeBusy) return false;
      if (this.enterpriseApprovalNoticeVisible) return !approvalId || this.enterpriseApprovalNoticeTarget?.approvalId === approvalId;
      const entries = collectPending(this.enterpriseApprovalNoticeSnapshot);
      const entry = approvalId ? entries.find(/** 按指定审批查找当前记录。 Find the specified current approval. */ item => item.target.approvalId === approvalId) : entries[0];
      if (!entry) return false;
      this.enterpriseApprovalNoticeTarget = entry.target;
      this.enterpriseApprovalNoticeRequestedAt = String(entry.approval.requestedAt || '');
      this.enterpriseApprovalNoticeReview = this.buildEnterpriseApprovalNoticeReview(entry, this.enterpriseApprovalNoticeSnapshot);
      const draft = this.enterpriseApprovalNoticeDrafts[targetKey(entry.target)];
      this.enterpriseApprovalNoticeReason = typeof draft?.reason === 'string' ? draft.reason : '';
      this.enterpriseApprovalNoticeExecutionMode = draft?.executionMode === 'automatic' ? 'automatic' : 'step';
      this.enterpriseApprovalNoticeError = ''; this.enterpriseApprovalNoticeOutcome = ''; this.enterpriseApprovalNoticeOutcomeRecovered = false;
      this.enterpriseApprovalNoticeStale = false; this.enterpriseApprovalNoticeVisible = true;
      return true;
    },

    /** 只返回当前冻结审阅内容，轮询不能改写用户看到的计划。 Return only the frozen review so polling cannot rewrite the plan under the user's eyes. */
    getEnterpriseApprovalNoticeViewModel() { return this.canUseEnterpriseApprovalNotices() && this.enterpriseApprovalNoticeVisible ? this.enterpriseApprovalNoticeReview : null; },

    /** 关闭仅延后当前计划，不表示批准，也不自动换成下一项。 Closing only defers the current plan; it neither approves nor replaces it with the next item. */
    closeEnterpriseApprovalNotice() {
      if (this.enterpriseApprovalNoticeBusy) return false;
      this.saveEnterpriseApprovalNoticeDraft();
      const key = targetKey(this.enterpriseApprovalNoticeTarget);
      if (key && !this.enterpriseApprovalNoticeDismissed.includes(key)) this.enterpriseApprovalNoticeDismissed = [...this.enterpriseApprovalNoticeDismissed, key];
      this.enterpriseApprovalNoticeVisible = false; this.enterpriseApprovalNoticeTarget = null; this.enterpriseApprovalNoticeReview = null;
      this.enterpriseApprovalNoticeReason = ''; this.enterpriseApprovalNoticeError = ''; this.enterpriseApprovalNoticeOutcome = ''; this.enterpriseApprovalNoticeOutcomeRecovered = false;
      this.enterpriseApprovalNoticeStale = false; this.enterpriseApprovalNoticeExecutionMode = 'step';
      return true;
    },

    /** 应用已读取的快照，不导航或选择其他业务对象。 Apply a read snapshot without navigating or selecting another business object. */
    applyEnterpriseApprovalNoticeSnapshot(snapshot) {
      if (typeof this.applyOperationsRuntimeSnapshot === 'function') this.applyOperationsRuntimeSnapshot(snapshot);
      else this.competitionSnapshot = snapshot;
      this.syncEnterpriseApprovalNotices(snapshot);
    },

    /** 决定前复核完整冻结绑定，只调用审批接口且默认批准后暂停。 Recheck every frozen binding before deciding, call only the approval interface and pause after approval by default. */
    async submitEnterpriseApprovalNotice(decision) {
      if (!this.canUseEnterpriseApprovalNotices() || this.enterpriseApprovalNoticeBusy || !this.enterpriseApprovalNoticeVisible
        || !this.enterpriseApprovalNoticeTarget || this.enterpriseApprovalNoticeStale || !['APPROVED', 'REJECTED'].includes(decision)) return false;
      const target = this.enterpriseApprovalNoticeTarget; const key = targetKey(target); const generation = this.enterpriseApprovalNoticeGeneration;
      const executionMode = decision === 'APPROVED' && this.enterpriseApprovalNoticeExecutionMode === 'automatic' ? 'automatic' : 'step';
      const fallback = decision === 'REJECTED'
        ? this.enterpriseApprovalNoticeText('用户在人工审批弹窗中选择拒绝本计划。', 'The user selected rejection in the human approval dialog.')
        : this.enterpriseApprovalNoticeText(executionMode === 'automatic' ? '用户在人工审批弹窗中选择批准本计划并自动执行。' : '用户在人工审批弹窗中选择批准本计划；批准后暂停。', executionMode === 'automatic' ? 'The user selected approval and automatic execution in the human approval dialog.' : 'The user selected approval in the human approval dialog; pause after approval.');
      const reason = this.cleanEnterpriseApprovalNoticeText(this.enterpriseApprovalNoticeReason, 2000) || fallback;
      this.enterpriseApprovalNoticeBusy = true; this.enterpriseApprovalNoticeError = '';
      let runtime = null; let requestSubmitted = false;
      try {
        runtime = this.getApplicationCompetitionRuntime();
        const fresh = await runtime.getApplicationCompetitionSnapshot();
        if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
        if (!validSnapshot(fresh)) throw new Error(this.enterpriseApprovalNoticeText('无法读取完整审批状态，请重试。', 'The complete approval state could not be read. Retry.'));
        const previousTime = Date.parse(this.enterpriseApprovalNoticeSnapshot?.updatedAt || ''); const freshTime = Date.parse(fresh.updatedAt || '');
        if (Number.isFinite(previousTime) && Number.isFinite(freshTime) && freshTime < previousTime) throw new Error(this.enterpriseApprovalNoticeText('审批状态读取已过期，请重新读取后重试。', 'The approval state read is outdated. Refresh and retry.'));
        this.applyEnterpriseApprovalNoticeSnapshot(fresh);
        const current = collectPending(fresh).find(/** 提交前逐项核对绑定与全部授权范围。 Compare every binding and authorization scope immediately before submission. */ entry => targetKey(entry.target) === key);
        if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
        if (!current || this.enterpriseApprovalNoticeStale || targetKey(this.enterpriseApprovalNoticeTarget) !== key) {
          this.enterpriseApprovalNoticeStale = true;
          this.enterpriseApprovalNoticeError = this.enterpriseApprovalNoticeText('这项审批已处理或计划已变化，本次决定没有提交。请关闭后重新审阅。', 'This approval was handled or its plan changed. No decision was submitted. Close it and review again.');
          return false;
        }
        if (typeof runtime.decideApplicationCompetitionApproval !== 'function') throw new Error(this.enterpriseApprovalNoticeText('当前运行时没有可用的审批接口，决定没有发送。', 'The runtime has no available approval interface. No decision was sent.'));
        requestSubmitted = true;
        const result = await runtime.decideApplicationCompetitionApproval({ approvalId: target.approvalId, decision, reason, executionMode, expectedPlanDigest: target.planDigest });
        if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
        if (!validSnapshot(result?.snapshot)) throw new Error(this.enterpriseApprovalNoticeText('审批回执不完整，请重新读取状态后核对。', 'The approval receipt is incomplete. Refresh the state to verify it.'));
        this.applyEnterpriseApprovalNoticeSnapshot(result.snapshot);
        const receipt = result.snapshot.approvals.find(/** 回执必须属于刚才决定的同一冻结计划。 Require the receipt to belong to the exact frozen plan just decided. */ approval => targetKey(freezeApprovalTarget(approval)) === key && approval.status === decision);
        if (!receipt) throw new Error(this.enterpriseApprovalNoticeText('审批回执与本次计划不一致，请重新读取状态后核对。', 'The approval receipt does not match this plan. Refresh the state to verify it.'));
        this.enterpriseApprovalNoticeOutcome = decision; this.enterpriseApprovalNoticeOutcomeRecovered = false;
        this.clearEnterpriseApprovalNoticeDraft(target);
        this.enterpriseApprovalNoticeError = ''; this.enterpriseApprovalNoticeStale = true;
        if (!this.enterpriseApprovalNoticeDismissed.includes(key)) this.enterpriseApprovalNoticeDismissed = [...this.enterpriseApprovalNoticeDismissed, key];
        return true;
      } catch (error) {
        if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
        const detail = this.cleanEnterpriseApprovalNoticeText(error?.message, 420);
        try {
          const recovered = await runtime?.getApplicationCompetitionSnapshot?.();
          if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
          if (!validSnapshot(recovered)) throw new Error('APPROVAL_STATE_UNAVAILABLE');
          const previousTime = Date.parse(this.enterpriseApprovalNoticeSnapshot?.updatedAt || ''); const recoveredTime = Date.parse(recovered.updatedAt || '');
          if (Number.isFinite(previousTime) && Number.isFinite(recoveredTime) && recoveredTime < previousTime) throw new Error('APPROVAL_STATE_OUTDATED');
          this.applyEnterpriseApprovalNoticeSnapshot(recovered);
          if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
          const records = recovered.approvals.filter(/** 只核对本次调用的审批身份。 Check only the approval identity from this call. */ approval => approval.approvalId === target.approvalId);
          const recorded = records.length > 0 && records.every(/** 拒绝重复记录间的计划或结果冲突。 Reject plan or outcome conflicts across duplicate records. */ approval => targetKey(freezeApprovalTarget(approval)) === key && approval.status === decision);
          if (requestSubmitted && recorded) {
            this.enterpriseApprovalNoticeOutcome = decision; this.enterpriseApprovalNoticeOutcomeRecovered = true; this.enterpriseApprovalNoticeStale = true;
            this.clearEnterpriseApprovalNoticeDraft(target);
            if (!this.enterpriseApprovalNoticeDismissed.includes(key)) this.enterpriseApprovalNoticeDismissed = [...this.enterpriseApprovalNoticeDismissed, key];
            this.enterpriseApprovalNoticeError = this.cleanEnterpriseApprovalNoticeText(`${this.enterpriseApprovalNoticeText('该计划已有审批决定；本次提交未收到完整回执，请核对审批记录和运行详情。', 'This plan already has an approval decision. This submission did not receive a complete receipt; check the approval record and run details.')} ${detail}`, 600);
          } else {
            const stillPending = collectPending(recovered).some(/** 只有原冻结计划仍待批才允许再次明确提交。 Permit another explicit submission only while the original frozen plan remains pending. */ entry => targetKey(entry.target) === key);
            if (!stillPending) this.enterpriseApprovalNoticeStale = true;
            const explanation = stillPending
              ? this.enterpriseApprovalNoticeText('审批尚未记录，原计划已保留；重试前会再次核对。', 'The approval is not recorded. The original plan is preserved and will be checked again before retrying.')
              : this.enterpriseApprovalNoticeText('审批状态已变化，请关闭后重新查看；未将其他人的决定作为本次成功回执。', 'The approval state changed. Close and review it again; another person’s decision was not treated as this submission’s success.');
            this.enterpriseApprovalNoticeError = this.cleanEnterpriseApprovalNoticeText(`${explanation} ${detail}`, 600);
          }
        } catch {
          if (generation !== this.enterpriseApprovalNoticeGeneration || !this.canUseEnterpriseApprovalNotices()) return false;
          const explanation = requestSubmitted
            ? this.enterpriseApprovalNoticeText('决定结果暂时无法确认，尚未自动重发。再次提交前会先读取审批状态。', 'The decision outcome is unconfirmed and was not automatically resent. The approval state will be read before another submission.')
            : this.enterpriseApprovalNoticeText('无法核对审批状态，本次尚未发送决定，请重试。', 'The approval state could not be verified. No decision was sent; retry.');
          this.enterpriseApprovalNoticeError = this.cleanEnterpriseApprovalNoticeText(`${explanation} ${detail}`, 600);
        }
        return false;
      } finally {
        if (generation === this.enterpriseApprovalNoticeGeneration) this.enterpriseApprovalNoticeBusy = false;
      }
    },
  };
  return Object.freeze({ createState, methods });
});
