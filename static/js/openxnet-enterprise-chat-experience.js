/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
企业会话阅读、身份与范围隔离 / Enterprise conversation reading, identity and scope isolation.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
/** 注册只读会话展示与受控头像导入。 Register conversation presentation and controlled avatar import. */
(function registerEnterpriseChat(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OpenXnetEnterpriseChatExperience = api;
})(typeof window === 'object' ? window : null, /** 创建独立会话方法。 Create isolated conversation methods. */ function createEnterpriseChat(root) {
  'use strict';

  /** 限制头像为受控图片文件路径。 Restrict avatars to controlled image file paths. */
  function safeAvatarUrl(value) {
    const url = typeof value === 'string' ? value.trim() : '';
    return url.length <= 240 && !url.includes('..') && /^\/uploaded_files\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:png|jpe?g|webp|gif)$/i.test(url) ? url : '';
  }

  /** 为每个宿主创建独立阅读状态。 Create isolated reading state for each host. */
  function createState() {
    return { enterpriseChatScopeKey: '', enterpriseChatScopeGeneration: 0, enterpriseChatLoadGeneration: 0,
      enterpriseChatDrafts: {}, enterpriseChatPending: {}, enterpriseChatScopeErrors: {}, enterpriseChatLoadError: '', enterpriseChatActionError: '',
      enterpriseChatDetailId: '', enterpriseChatNavigationOpen: false, enterpriseChatMembersOpen: false,
      enterpriseChatTaskOptionsOpen: false, enterpriseChatPinned: true, enterpriseChatNewCount: 0,
      enterpriseChatActiveMessageId: '', enterpriseAvatarBusy: false, enterpriseChatBrokenAvatars: {} };
  }

  const methods = {
    /** 依据当前语言选择文案。 Select copy using the current language. */
    enterpriseChatText(zh, en) { return this.isCurrentLanguageZh() ? zh : en; },

    /** 中文输入法确认候选时不误发消息。 Avoid sending a message when an IME confirms composed text. */
    handleEnterpriseComposerEnter(event) {
      if (event?.isComposing || event?.keyCode === 229) return;
      event?.preventDefault?.();
      return this.sendEnterpriseMessage();
    },

    /** 对切换后的范围清理消息并恢复独立草稿。 Clear old messages and restore drafts for a changed scope. */
    ensureEnterpriseChatScope() {
      const workspaceId = this.getEnterpriseChatWorkspaceId();
      const projectId = this.getEnterpriseChatProjectId();
      const key = JSON.stringify([workspaceId, projectId || '']);
      if (this.enterpriseChatScopeKey !== key) {
        if (this.enterpriseChatScopeKey) {
          this.enterpriseChatDrafts[this.enterpriseChatScopeKey] = { text: String(this.enterpriseChatInput || ''), recipients: [...this.enterpriseChatRecipientIds] };
        }
        const draft = this.enterpriseChatDrafts[key];
        const initialText = !this.enterpriseChatScopeKey ? this.enterpriseChatInput : '';
        this.enterpriseChatScopeKey = key;
        this.enterpriseChatScopeGeneration += 1;
        this.enterpriseChatLoadGeneration += 1;
        this.enterpriseMessages = [];
        this.enterpriseChatInput = draft?.text || initialText || '';
        this.enterpriseChatRecipientIds = draft?.recipients ? [...draft.recipients] : [];
        this.enterpriseChatDetailId = '';
        this.enterpriseChatActiveMessageId = '';
        this.enterpriseChatNewCount = 0;
        this.enterpriseChatPinned = true;
        this.enterpriseChatLoadError = '';
        this.enterpriseChatActionError = this.enterpriseChatScopeErrors[key] || '';
        this.enterpriseChatLoading = false;
        this.enterpriseChatSending = Boolean(this.enterpriseChatPending[key]?.send);
        this.enterpriseChatTaskStarting = Boolean(this.enterpriseChatPending[key]?.task);
      }
      return { key, workspaceId, projectId, generation: this.enterpriseChatScopeGeneration };
    },

    /** 核验异步结果仍属于当前范围与代数。 Verify an asynchronous result still belongs to the current scope and generation. */
    isEnterpriseChatScopeCurrent(scope) {
      return scope.generation === this.enterpriseChatScopeGeneration && scope.key === this.enterpriseChatScopeKey
        && scope.workspaceId === this.getEnterpriseChatWorkspaceId() && scope.projectId === this.getEnterpriseChatProjectId();
    },

    /** 项目接收同空间公共消息但不接收其他项目。 Include workspace announcements in a project while excluding other projects. */
    isEnterpriseMessageInScope(message, scope = null) {
      const workspaceId = scope?.workspaceId ?? this.getEnterpriseChatWorkspaceId();
      const projectId = scope ? scope.projectId : this.getEnterpriseChatProjectId();
      return Boolean(message?.id && message.workspaceId === workspaceId && (!message.projectId || message.projectId === projectId));
    },

    /** 即使范围刚切换也只渲染当前范围消息。 Render only current-scope messages even immediately after a scope switch. */
    getEnterpriseVisibleMessages() {
      return (this.enterpriseMessages || []).filter(/** 核验消息范围。 Check message scope. */ message => this.isEnterpriseMessageInScope(message));
    },

    /** 将操作失败保留在原范围，返回该范围时仍然可见。 Retain operation failures in their original scope when users return to it. */
    setEnterpriseChatActionError(scope, message) {
      this.enterpriseChatScopeErrors = { ...this.enterpriseChatScopeErrors, [scope.key]: message };
      if (this.isEnterpriseChatScopeCurrent(scope)) this.enterpriseChatActionError = message;
    },

    /** 跟踪阅读位置，离开底部后不抢回视口。 Track reading position without stealing the viewport away from older messages. */
    onEnterpriseChatScroll(event) {
      const element = event?.target;
      if (!element) return;
      this.enterpriseChatPinned = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
      if (this.enterpriseChatPinned) this.enterpriseChatNewCount = 0;
    },

    /** 用稳定消息 ID 定位，不把正文放进选择器。 Navigate by stable message ID without putting content in selectors. */
    jumpToEnterpriseMessage(id) {
      const container = this.$refs?.enterpriseChatMessages;
      const target = Array.from(container?.querySelectorAll('[data-enterprise-message-id]') || []).find(/** 匹配已渲染的消息 ID。 Match the rendered message ID. */ element => element.dataset.enterpriseMessageId === id);
      if (!target) return;
      container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
      this.enterpriseChatPinned = false;
      this.enterpriseChatActiveMessageId = id;
      this.enterpriseChatNavigationOpen = false;
      target.focus({ preventScroll: true });
    },

    /** 构建不会跨范围的定位摘要。 Build navigation summaries that cannot cross scopes. */
    getEnterpriseMessageNavigation() {
      return this.getEnterpriseVisibleMessages().map(/** 只截取可见消息的短摘要。 Extract short summaries from visible messages only. */ message => ({ id: message.id, name: message.senderName, label: String(message.operation?.title || message.content || '').replace(/\s+/g, ' ').slice(0, 72) }));
    },

    /** 每次仅展开一条真实操作的详情。 Expand one real operation at a time. */
    toggleEnterpriseMessageDetails(message) {
      if (!this.isEnterpriseMessageInScope(message)) return;
      this.enterpriseChatDetailId = this.enterpriseChatDetailId === message.id ? '' : message.id;
    },

    /** 从固化决策读取子智能体结果，不暴露内部提示词。 Read subagent outcomes from recorded decisions without exposing internal prompts. */
    getEnterpriseMessageAgents(message) {
      if (!this.isEnterpriseMessageInScope(message) || !message.traceId || !message.taskId) return [];
      return (this.competitionSnapshot?.agentDecisions || []).filter(/** 必须匹配任务、追踪与空间。 Require matching task, trace and workspace. */ decision => decision.workspaceId === message.workspaceId && decision.traceId === message.traceId && decision.taskId === message.taskId);
    },

    /** 员工二维头像仅允许受控图片路径。 Allow only controlled image paths for employee portraits. */
    getEnterpriseStaffAvatar(role) { return safeAvatarUrl(role?.avatarUrl); },

    /** 按不可变发送者 ID 解析头像，禁止用当前选中角色替换历史身份。 Resolve portraits by immutable sender ID rather than the currently selected role. */
    getEnterpriseMessageIdentity(message) {
      const role = message?.senderType === 'agent' ? (this.staffRoles || []).find(/** 仅按发送者 ID 查找员工。 Find staff by sender ID only. */ item => item.id === message.senderId) : null;
      const image = this.enterpriseChatBrokenAvatars[message.id] ? '' : safeAvatarUrl(role?.avatarUrl);
      return { id: message.senderId, name: message.senderName || this.enterpriseChatText('系统', 'System'), image, text: String(message.senderName || 'OX').slice(0, 2), kind: message.senderType, source: role ? 'enterprise-role-card' : 'message' };
    },

    /** 图片失效时使用姓名回退，避免破图。 Fall back to initials when an image cannot load. */
    markEnterpriseAvatarFailed(message) {
      this.enterpriseChatBrokenAvatars = { ...this.enterpriseChatBrokenAvatars, [message.id]: true };
    },

    /** 经既有产物导入边界保存员工头像，不注册智能体。 Save a portrait through the existing artifact boundary without registering an agent. */
    async importEnterpriseStaffAvatar(event) {
      const file = event?.target?.files?.[0];
      if (event?.target) event.target.value = '';
      const roleId = this.selected3DAgent?.id;
      if (!file || !roleId || this.enterpriseAvatarBusy) return;
      const scope = this.ensureEnterpriseChatScope();
      this.enterpriseAvatarBusy = true;
      this.setEnterpriseChatActionError(scope, '');
      try {
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error(this.enterpriseChatText('请选择 5 MB 内的 PNG、JPEG、WebP 或 GIF 图片。', 'Choose a PNG, JPEG, WebP or GIF image up to 5 MB.'));
        if (typeof root?.openxnetDesktop?.importSelectedArtifacts !== 'function') throw new Error(this.enterpriseChatText('请在桌面应用中导入员工头像。', 'Import employee portraits in the desktop app.'));
        const result = await root.openxnetDesktop.importSelectedArtifacts([file]);
        const artifact = result?.artifacts?.[0];
        const avatarUrl = safeAvatarUrl(`/uploaded_files/${artifact?.storageName || ''}`);
        if (artifact?.kind !== 'image' || artifact?.status !== 'available' || !avatarUrl) throw new Error(this.enterpriseChatText('图片导入未返回可用产物，员工资料未修改。', 'The import did not return an available image; the employee profile was not changed.'));
        const current = (this.staffRoles || []).find(/** 保存导入完成时的完整员工记录。 Save the full employee record available at import completion. */ item => item.id === roleId);
        if (!current) throw new Error(this.enterpriseChatText('员工已不存在，头像未关联。', 'The employee no longer exists; the portrait was not linked.'));
        await this.persistStaffRoleToEnterprise({ ...current, avatarUrl }, { createAgent: false });
        if (this.selected3DAgent?.id === roleId) this.selected3DAgent = this.staffRoles.find(/** 更新当前员工展示引用。 Update the selected employee presentation reference. */ item => item.id === roleId) || current;
        this.enterpriseChatBrokenAvatars = {};
      } catch (error) {
        this.setEnterpriseChatActionError(scope, error?.message || 'Avatar import failed');
      } finally {
        this.enterpriseAvatarBusy = false;
      }
    },

    /** 生成显式消费的 VR 只读投影，默认排除正文与私密执行数据。 Build an explicitly consumed read-only VR projection, excluding text and private execution data by default. */
    getEnterpriseConversationProjection(options = {}) {
      const model = root?.OpenXnetConversationModel;
      if (!model) return null;
      const workspaceId = this.getEnterpriseChatWorkspaceId();
      const projectId = this.getEnterpriseChatProjectId();
      const conversationId = JSON.stringify(['enterprise', workspaceId, projectId || '']);
      const messages = this.getEnterpriseVisibleMessages().map(/** 映射当前视图范围并保留最少身份元数据。 Map the current view scope with minimal identity metadata. */ message => ({
        id: message.id, conversationId, workspaceId, projectId, role: message.senderType === 'leader' ? 'user' : 'assistant',
        identity: this.getEnterpriseMessageIdentity(message), text: message.operation ? '' : message.content,
        activity: { steps: this.getEnterpriseMessageInvocations(message).map(/** 仅投影工具状态，不转发参数。 Project tool status without arguments. */ invocation => ({ id: invocation.invocationId, kind: 'tool', status: invocation.status, label: model.getActivityStatusLabel(model.normalizeActivityStatus(invocation.status), this.isCurrentLanguageZh()), duration: this.getEnterpriseInvocationDuration(invocation) })) },
      }));
      return model.buildConversationProjection({ conversationId, workspaceId, projectId, messages, maxMessages: 80, includeTextPreview: options.includeTextPreview === true });
    },
  };
  return Object.freeze({ createState, methods, safeAvatarUrl });
});
