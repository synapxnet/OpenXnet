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

  /** 规范化姓名查询但保留多词姓名的空格。 Normalize name searches while preserving spaces in multiword names. */
  function normalizeMentionName(value) { return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' '); }

  /** 识别正文中合法的提及起点，排除邮箱。 Recognize mention boundaries while excluding email addresses. */
  function isMentionBoundary(character) { return !character || /[\s([{（【，,、：:；;！!？?。\p{Script=Han}]/u.test(character); }

  /** 已选提及必须结束于文字边界。 Selected mentions must end at a text boundary. */
  function isMentionEnd(character) { return !character || /[\s)\]}）】，,、：:；;！!？?。]/u.test(character); }

  /** 从光标前查找当前查询，不把已选提及再次当查询。 Find the query before the caret without reopening selected mentions. */
  function findMentionQuery(text, cursor, selectionEnd = cursor, mentions = []) {
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > text.length || cursor !== selectionEnd) return null;
    const start = text.lastIndexOf('@', cursor - 1);
    if (start < 0 || !isMentionBoundary(text[start - 1]) || mentions.some(/** 排除已选范围。 Exclude selected ranges. */ item => start === item.start && cursor <= item.end)) return null;
    const query = text.slice(start + 1, cursor);
    if (query.length > 100 || /[\n\r@\t，,。；;：:！？!?()[\]{}]/u.test(query)) return null;
    return { start, end: cursor, query: normalizeMentionName(query) };
  }

  /** 文本编辑仅移动未被修改的显式提及，绝不从普通文本推断收件人。 Move unchanged explicit mentions across edits without inferring recipients from plain text. */
  function reconcileMentionRanges(before, after, mentions, members) {
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
    let oldEnd = before.length; let newEnd = after.length;
    while (oldEnd > prefix && newEnd > prefix && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd -= 1; newEnd -= 1; }
    const difference = after.length - before.length;
    const allowed = new Map(members.map(/** 使用稳定身份键建立成员索引。 Index members by stable identity. */ role => [String(role.id), `@${normalizeMentionName(role.name)}`]));
    return mentions.flatMap(/** 丢弃修改、越界或已撤销成员的提及。 Drop edited, out-of-bounds or revoked-member mentions. */ original => {
      const mention = { ...original };
      if (before !== after) {
        if (mention.end <= prefix) { /* 编辑位于提及后。 The edit follows this mention. */ }
        else if (mention.start >= oldEnd) { mention.start += difference; mention.end += difference; }
        else return [];
      }
      return Number.isInteger(mention.start) && Number.isInteger(mention.end) && mention.start >= 0
        && mention.end <= after.length && mention.end > mention.start && allowed.get(mention.id) === mention.text
        && after.slice(mention.start, mention.end) === mention.text && isMentionBoundary(after[mention.start - 1]) && isMentionEnd(after[mention.end]) ? [mention] : [];
    });
  }

  /** 为每个宿主创建独立阅读状态。 Create isolated reading state for each host. */
  function createState() {
    return { enterpriseChatScopeKey: '', enterpriseChatScopeGeneration: 0, enterpriseChatLoadGeneration: 0,
      enterpriseChatDrafts: {}, enterpriseChatPending: {}, enterpriseChatScopeErrors: {}, enterpriseChatLoadError: '', enterpriseChatActionError: '', enterpriseChatProjectionWarning: '',
      enterpriseChatDetailId: '', enterpriseChatNavigationOpen: false, enterpriseChatMembersOpen: false,
      enterpriseChatTaskOptionsOpen: false, enterpriseChatPinned: true, enterpriseChatNewCount: 0,
      enterpriseChatActiveMessageId: '', enterpriseAvatarBusy: false, enterpriseChatBrokenAvatars: {},
      enterpriseChatMentions: [], enterpriseChatMentionText: '', enterpriseChatMentionQuery: null,
      enterpriseChatMentionIndex: 0, enterpriseChatMentionComposing: false };
  }

  const methods = {
    /** 依据当前语言选择文案。 Select copy using the current language. */
    enterpriseChatText(zh, en) { return this.isCurrentLanguageZh() ? zh : en; },

    /** 获取当前输入控件以保留光标。 Get the current composer element to preserve its caret. */
    getEnterpriseComposerElement() {
      const input = this.$refs?.enterpriseChatComposer;
      return input?.textarea || input?.$el?.querySelector?.('textarea') || null;
    },

    /** 关闭当前候选，不删除草稿或已选成员。 Close suggestions without deleting the draft or selected members. */
    closeEnterpriseChatMentions() { this.enterpriseChatMentionQuery = null; this.enterpriseChatMentionIndex = 0; },

    /** 发送成功或范围切换时清理临时提及状态。 Clear temporary mention state after delivery or a scope change. */
    clearEnterpriseChatMentionState() {
      this.closeEnterpriseChatMentions();
      this.enterpriseChatMentions = [];
      this.enterpriseChatMentionText = String(this.enterpriseChatInput || '');
      this.enterpriseChatMentionComposing = false;
    },

    /** 候选只来自当前合法成员，不合成广播或系统身份。 Build candidates from current valid members without inventing broadcast or system identities. */
    getEnterpriseMentionMembers() {
      const seen = new Set();
      return (this.getEnterpriseChatAvailableStaff?.() || []).filter(/** 排除无效身份、重复记录与不可用姓名。 Exclude invalid identities, duplicate records and unusable names. */ role => {
        const id = String(role?.id || '').trim(); const name = normalizeMentionName(role?.name);
        if (!id || role.enabled === false || !name || name.includes('@') || seen.has(id)) return false;
        seen.add(id); return true;
      });
    },

    /** 同步显式提及与收件人，删除正文提及时立即取消接收。 Reconcile explicit mentions and recipients, cancelling delivery targets when their text is removed. */
    reconcileEnterpriseChatMentions() {
      const text = String(this.enterpriseChatInput || '');
      this.enterpriseChatMentions = reconcileMentionRanges(this.enterpriseChatMentionText, text, this.enterpriseChatMentions, this.getEnterpriseMentionMembers());
      this.enterpriseChatMentionText = text;
      this.enterpriseChatRecipientIds = [...new Set(this.enterpriseChatMentions.map(/** 从显式提及取身份。 Read identities from explicit mentions. */ mention => mention.id))];
      return this.enterpriseChatMentions;
    },

    /** 按中文或完整多词姓名筛选候选。 Filter candidates by Chinese or complete multiword names. */
    getEnterpriseMentionCandidates() {
      const query = normalizeMentionName(this.enterpriseChatMentionQuery?.query).toLocaleLowerCase();
      return this.getEnterpriseMentionMembers().filter(/** 大小写无关的姓名筛选。 Match names without case sensitivity. */ role => normalizeMentionName(role.name).toLocaleLowerCase().includes(query));
    },

    /** 只在弹层仍属于当前工作群时显示。 Show the menu only while it belongs to the current group. */
    isEnterpriseMentionMenuVisible() {
      const key = JSON.stringify([this.getEnterpriseChatWorkspaceId(), this.getEnterpriseChatProjectId() || '']);
      return Boolean(this.enterpriseChatMentionQuery && this.enterpriseChatMentionQuery.scopeKey === key
        && !this.enterpriseChatMentionComposing && !this.enterpriseChatSending && !this.enterpriseChatTaskStarting);
    },

    /** 从实际光标刷新查询，保持键盘高亮在有效范围内。 Refresh the query from the real caret and keep keyboard focus within the candidates. */
    updateEnterpriseChatMentionQuery(event = null) {
      const scope = this.ensureEnterpriseChatScope();
      this.reconcileEnterpriseChatMentions();
      const input = event?.target?.tagName === 'TEXTAREA' ? event.target : this.getEnterpriseComposerElement();
      if (input?.ownerDocument && input.ownerDocument.activeElement !== input) { this.closeEnterpriseChatMentions(); return; }
      const query = !this.enterpriseChatMentionComposing && input ? findMentionQuery(this.enterpriseChatInput, input.selectionStart, input.selectionEnd, this.enterpriseChatMentions) : null;
      if (!query) { this.closeEnterpriseChatMentions(); return; }
      if (this.enterpriseChatMentionQuery?.query !== query.query || this.enterpriseChatMentionQuery?.start !== query.start) this.enterpriseChatMentionIndex = 0;
      this.enterpriseChatMentionQuery = { ...query, scopeKey: scope.key };
      this.enterpriseChatMentionIndex = Math.min(this.enterpriseChatMentionIndex, Math.max(0, this.getEnterpriseMentionCandidates().length - 1));
    },

    /** 输入后更新范围，并在控件同步光标后更新弹层。 Update ranges after input and refresh suggestions after the control updates its caret. */
    handleEnterpriseComposerInput(value) {
      const scope = this.ensureEnterpriseChatScope();
      this.enterpriseChatInput = String(value ?? '');
      this.reconcileEnterpriseChatMentions();
      this.$nextTick(/** 等待控件渲染但不跨群处理。 Wait for control rendering without crossing groups. */ () => {
        if (this.isEnterpriseChatScopeCurrent(scope)) this.updateEnterpriseChatMentionQuery();
      });
    },

    /** 中文输入法合成期间关闭候选，完成后再解析。 Close suggestions during IME composition and parse only after completion. */
    handleEnterpriseComposerComposition(event, composing) {
      const scope = this.ensureEnterpriseChatScope();
      this.enterpriseChatMentionComposing = composing;
      if (composing) this.closeEnterpriseChatMentions();
      else {
        this.enterpriseChatInput = String(event?.target?.value ?? this.enterpriseChatInput);
        this.reconcileEnterpriseChatMentions();
        this.$nextTick(/** 合成结束后使用最终文本和光标且不跨群。 Use final text and caret after composition without crossing groups. */ () => {
          if (this.isEnterpriseChatScopeCurrent(scope)) this.updateEnterpriseChatMentionQuery(event);
        });
      }
    },

    /** 键盘焦点保持在输入框，只滚动候选列表。 Keep keyboard focus in the composer and scroll only the candidate list. */
    scrollEnterpriseMentionCandidate() {
      this.$nextTick(/** 只滚动弹层内部，不移动聊天阅读位置。 Scroll inside the popup without moving conversation reading position. */ () => {
        const menu = this.$refs?.enterpriseMentionList;
        const option = menu?.querySelector?.(`[data-mention-index="${this.enterpriseChatMentionIndex}"]`);
        if (!option) return;
        if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
        else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
      });
    },

    /** 成员候选优先消费导航按键，避免 Enter 选择时误发送。 Let suggestions consume navigation keys before Enter can send a message. */
    handleEnterpriseComposerKeydown(event) {
      if (event?.isComposing || event?.keyCode === 229 || this.enterpriseChatMentionComposing) return;
      if (this.isEnterpriseMentionMenuVisible() && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        const choices = this.getEnterpriseMentionCandidates();
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
          event.preventDefault?.(); event.stopPropagation?.();
          if (event.key === 'Escape') this.closeEnterpriseChatMentions();
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (choices.length) this.enterpriseChatMentionIndex = (this.enterpriseChatMentionIndex + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
            this.scrollEnterpriseMentionCandidate();
          } else if (choices[this.enterpriseChatMentionIndex]) this.selectEnterpriseChatMention(choices[this.enterpriseChatMentionIndex]);
          else if (event.key === 'Tab') this.closeEnterpriseChatMentions();
          return;
        }
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) return this.handleEnterpriseComposerEnter(event);
    },

    /** 在当前光标或查询处插入已验证成员，保留后续正文。 Insert a verified member at the caret or query while preserving following text. */
    addEnterpriseChatRecipient(role, range = null) {
      this.ensureEnterpriseChatScope();
      const member = this.getEnterpriseMentionMembers().find(/** 重新验证成员身份。 Revalidate the member identity. */ item => String(item.id) === String(role?.id));
      if (!member) { this.closeEnterpriseChatMentions(); return false; }
      this.reconcileEnterpriseChatMentions();
      const input = this.getEnterpriseComposerElement(); const before = String(this.enterpriseChatInput || '');
      const start = range?.start ?? input?.selectionStart ?? before.length;
      const end = range?.end ?? input?.selectionEnd ?? start;
      if (start < 0 || end < start || end > before.length) return false;
      const leading = isMentionBoundary(before[start - 1]) ? '' : ' ';
      const text = `@${normalizeMentionName(member.name)}`; const inserted = `${leading}${text} `;
      this.enterpriseChatInput = before.slice(0, start) + inserted + before.slice(end);
      this.reconcileEnterpriseChatMentions();
      this.enterpriseChatMentions.push({ id: String(member.id), text, start: start + leading.length, end: start + leading.length + text.length });
      this.reconcileEnterpriseChatMentions(); this.closeEnterpriseChatMentions();
      const scopeKey = this.enterpriseChatScopeKey; const cursor = start + inserted.length;
      this.$nextTick(/** 在同一群内恢复输入焦点及插入位置。 Restore focus and insertion position within the same group. */ () => {
        if (scopeKey !== this.enterpriseChatScopeKey) return;
        const element = this.getEnterpriseComposerElement();
        element?.focus?.({ preventScroll: true }); element?.setSelectionRange?.(cursor, cursor);
      });
      return true;
    },

    /** 仅接受仍属于当前群的候选，失效列表不能产生提及。 Accept only suggestions that still belong to the current group. */
    selectEnterpriseChatMention(role) {
      if (!this.isEnterpriseMentionMenuVisible()) { this.closeEnterpriseChatMentions(); return false; }
      const range = { ...this.enterpriseChatMentionQuery };
      if (this.enterpriseChatInput.slice(range.start, range.end)[0] !== '@') { this.closeEnterpriseChatMentions(); return false; }
      return this.addEnterpriseChatRecipient(role, range);
    },

    /** 移除指定身份的全部显式提及并同步正文。 Remove every explicit mention of an identity and synchronize the draft. */
    removeEnterpriseChatRecipient(role) {
      const id = String(role?.id || role || ''); this.reconcileEnterpriseChatMentions();
      const mentions = this.enterpriseChatMentions.filter(/** 按身份匹配选中提及。 Match selected mentions by identity. */ item => item.id === id).sort(/** 从末尾删除以保持索引有效。 Delete from the end to keep indexes valid. */ (a, b) => b.start - a.start);
      for (const mention of mentions) {
        const end = mention.end + (this.enterpriseChatInput[mention.end] === ' ' ? 1 : 0);
        this.enterpriseChatInput = this.enterpriseChatInput.slice(0, mention.start) + this.enterpriseChatInput.slice(end);
        this.reconcileEnterpriseChatMentions();
      }
      this.closeEnterpriseChatMentions();
    },

    /** 成员面板与输入候选共用同一套提及状态。 Share mention state between the member panel and composer suggestions. */
    toggleEnterpriseChatMention(role) {
      if (this.enterpriseChatRecipientIds.includes(String(role?.id))) this.removeEnterpriseChatRecipient(role);
      else this.addEnterpriseChatRecipient(role);
    },

    /** 中文输入法确认候选时不误发消息。 Avoid sending a message when an IME confirms composed text. */
    handleEnterpriseComposerEnter(event) {
      if (event?.isComposing || event?.keyCode === 229 || this.enterpriseChatMentionComposing) return;
      if (this.isEnterpriseMentionMenuVisible()) return this.handleEnterpriseComposerKeydown({ ...event, key: 'Enter', preventDefault: event?.preventDefault?.bind(event), stopPropagation: event?.stopPropagation?.bind(event) });
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
          this.enterpriseChatDrafts[this.enterpriseChatScopeKey] = { text: String(this.enterpriseChatInput || ''), recipients: [...this.enterpriseChatRecipientIds], mentions: this.enterpriseChatMentions.map(/** 拷贝当前群已选择的提及范围。 Copy explicitly selected mention ranges for this group. */ item => ({ ...item })), mentionText: this.enterpriseChatMentionText };
        }
        const draft = this.enterpriseChatDrafts[key];
        const initialText = !this.enterpriseChatScopeKey ? this.enterpriseChatInput : '';
        this.enterpriseChatScopeKey = key;
        this.enterpriseChatScopeGeneration += 1;
        this.enterpriseChatLoadGeneration += 1;
        this.enterpriseMessages = [];
        this.enterpriseChatInput = draft?.text || initialText || '';
        this.enterpriseChatRecipientIds = draft?.recipients ? [...draft.recipients] : [];
        this.clearEnterpriseChatMentionState();
        this.enterpriseChatMentions = draft?.mentions ? draft.mentions.map(/** 恢复独立草稿的提及范围。 Restore mention ranges from the isolated draft. */ item => ({ ...item })) : [];
        this.enterpriseChatMentionText = draft?.mentionText ?? this.enterpriseChatInput;
        this.reconcileEnterpriseChatMentions();
        this.enterpriseChatDetailId = '';
        this.enterpriseChatActiveMessageId = '';
        this.enterpriseChatNewCount = 0;
        this.enterpriseChatPinned = true;
        this.enterpriseChatLoadError = '';
        this.enterpriseChatProjectionWarning = '';
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

    /** 只展示当前群真实协作投影的来源，不从系统文案猜测 Agent。 Show provenance for real scoped collaboration projections without inferring agents from system copy. */
    getEnterpriseCollaborationSource(message) {
      const source = message?.collaboration;
      if (!this.isEnterpriseMessageInScope(message) || message.senderType !== 'agent' || !source
        || !['handoff', 'result'].includes(source.kind) || !['leader', 'worker', 'verifier'].includes(source.teamRole)
        || !source.decisionId || !source.incidentId || !source.bindingId || !message.traceId || !message.taskId) return null;
      const stages = {
        INVESTIGATION_PLAN: this.enterpriseChatText('调查规划', 'Investigation planning'),
        INVESTIGATION_CONCLUSION: this.enterpriseChatText('证据结论', 'Evidence conclusion'),
        VERIFICATION_CONCLUSION: this.enterpriseChatText('独立验证', 'Independent verification'),
      };
      if (!stages[source.stage]) return null;
      return { stage: stages[source.stage], label: `${this.enterpriseChatText(source.kind === 'handoff' ? '任务交接' : '阶段结果', source.kind === 'handoff' ? 'Task handoff' : 'Stage result')} · ${stages[source.stage]}` };
    },

    /** 员工二维头像仅允许受控图片路径。 Allow only controlled image paths for employee portraits. */
    getEnterpriseStaffAvatar(role) { return safeAvatarUrl(role?.avatarUrl); },

    /** 按不可变发送者 ID 解析头像，禁止用当前选中角色替换历史身份。 Resolve portraits by immutable sender ID rather than the currently selected role. */
    getEnterpriseMessageIdentity(message) {
      const role = message?.senderType === 'agent' ? (this.staffRoles || []).find(/** 仅按发送者 ID 查找员工。 Find staff by sender ID only. */ item => item.id === message.senderId) : null;
      const image = this.enterpriseChatBrokenAvatars[message.id] ? '' : safeAvatarUrl(role?.avatarUrl);
      const icon = this.getEnterpriseCollaborationSource(message) ? { leader: 'fa-solid fa-compass', worker: 'fa-solid fa-magnifying-glass', verifier: 'fa-solid fa-shield-halved' }[message.collaboration.teamRole] : '';
      return { id: message.senderId, name: message.senderName || this.enterpriseChatText('系统', 'System'), image, icon, text: String(message.senderName || 'OX').slice(0, 2), kind: message.senderType, source: role ? 'enterprise-role-card' : 'message' };
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
  return Object.freeze({ createState, methods, safeAvatarUrl, findMentionQuery, reconcileMentionRanges });
});
