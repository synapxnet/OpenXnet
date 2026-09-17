/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 桌面伴随窗口的公开完成事件桥接 / Public completion events for desktop companion windows.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */

/** 发布可隔离测试的伴随窗口桥接。 / Publish the independently testable companion bridge. */
(function publishCompanionEvents(root, factory) {
  const bridge = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = bridge;
  if (root) root.OpenXnetCompanionEvents = bridge;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCompanionEvents(root) {
  'use strict';

  const PUBLIC_STATUSES = new Set(['completed', 'failed', 'action_required', 'changed', 'unchanged']);

  /** 保留精确身份，拒绝控制字符与截断。 / Preserve exact identities without controls or truncation. */
  function identity(value, maximum = 512) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum
      && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value) ? value : '';
  }

  /** 仅输出有界纯文本，不展开对象。 / Emit bounded plain text without expanding objects. */
  function publicText(value, maximum) {
    return typeof value === 'string' ? Array.from(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')).slice(0, maximum).join('') : '';
  }

  /** 规范明确的时间点用于跨投递通道去重。 / Normalize explicit instants for cross-channel deduplication. */
  function instant(value) {
    if (typeof value !== 'string' || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) return '';
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : '';
  }

  /** 只保留 Main 允许的公开完成字段。 / Retain only Main's allowed public completion fields. */
  function normalizeNotice(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const resultId = identity(value.resultId);
    const conversationId = identity(value.conversationId);
    const taskId = identity(value.taskId);
    const occurredAt = instant(value.occurredAt);
    const enterprise = value.source === 'enterprise_run';
    const workspaceId = identity(value.workspaceId), incidentId = identity(value.incidentId), traceId = identity(value.traceId);
    if (!resultId || !occurredAt || (!PUBLIC_STATUSES.has(value.status) && !(enterprise && value.status === 'running'))
      || !['chat', 'task', 'enterprise_run'].includes(value.source) || (value.source === 'chat' && !conversationId)
      || (value.source === 'task' && !taskId)) return null;
    if (enterprise ? !workspaceId || !incidentId || !traceId || conversationId || taskId
      : value.workspaceId != null || value.incidentId != null || value.traceId != null) return null;
    if ((value.conversationId != null && value.conversationId !== '' && !conversationId)
      || (value.taskId != null && value.taskId !== '' && !taskId)) return null;
    return Object.freeze({ resultId, source: value.source, conversationId, taskId,
      ...(enterprise ? { workspaceId, incidentId, traceId } : {}),
      title: publicText(value.title, 120), summary: publicText(value.summary, 400),
      status: value.status, occurredAt });
  }

  /** 仅凭稳定归属与精确时间关联旧投递。 / Link legacy deliveries only by stable ownership and exact time. */
  function deliveryKey(value) {
    if (!value || typeof value !== 'object') return '';
    const taskId = identity(value.task_id || value.taskId);
    const conversationId = identity(value.conversation_id || value.conversationId);
    const time = instant(value.timestamp || value.occurredAt);
    const status = typeof value.status === 'string' ? value.status : '';
    if (value.source === 'enterprise_run') {
      const workspaceId = identity(value.workspace_id || value.workspaceId), incidentId = identity(value.incident_id || value.incidentId), traceId = identity(value.trace_id || value.traceId);
      return time && status && workspaceId && incidentId && traceId && !taskId && !conversationId
        ? JSON.stringify(['enterprise_run', workspaceId, incidentId, traceId, time, status]) : '';
    }
    return time && status && (taskId || conversationId)
      ? JSON.stringify([taskId ? 'task' : 'chat', taskId || conversationId, time, status]) : '';
  }

  /** 将公开结果适配到既有投递入口。 / Adapt one public result to the existing delivery entrypoint. */
  function toDelivery(notice, surface) {
    return { action: 'task_delivery', channel: surface, data: {
      kind: 'completion_notice', completion_event_id: notice.resultId,
      conversation_id: notice.conversationId, task_id: notice.taskId,
      ...(notice.source === 'enterprise_run' ? { source: notice.source, workspace_id: notice.workspaceId, incident_id: notice.incidentId, trace_id: notice.traceId } : {}),
      title: notice.title, summary: notice.summary, status: notice.status,
      timestamp: notice.occurredAt, target: surface, presentation: surface,
    } };
  }

  /** 创建单一订阅桥接，不创建套接字或系统通知。 / Create one subscription bridge without sockets or native notifications. */
  function createBridge(options = {}) {
    const api = options.api || (root && root.openxnetDesktop) || {};
    const surface = options.surface === 'floating_task_hud' ? 'floating_task_hud' : 'dynamic_island';
    const seenResults = new Set();
    const seenDeliveries = new Set();
    const aliases = new Map();
    const notices = new Map();
    const bindings = new Set();
    let disposed = false;
    let loading = false;
    let started = false;
    let ready = null;
    let pending = [];
    let unsubscribe = null;

    /** 向宿主提供可处理的错误，不抛出异步悬空异常。 / Report actionable host errors without unhandled asynchronous failures. */
    function report(error) {
      if (!disposed && typeof options.onError === 'function') options.onError(error);
    }

    /** 更新独立导航按钮，不改变页面布局。 / Refresh independent navigation buttons without changing layout. */
    function refreshButtons() {
      for (const binding of bindings) binding.refresh();
    }

    /** 调用唯一显示入口并标记历史静默语义。 / Invoke the sole display entrypoint with explicit silent-history semantics. */
    function deliver(message, snapshot, silent = snapshot) {
      if (disposed) return false;
      try {
        if (typeof options.onDelivery === 'function') options.onDelivery(message, { snapshot, silent });
      } catch (error) { report(error); }
      refreshButtons();
      return true;
    }

    /** 登记 Main 结果与导航别名，只显示一次明确结果。 / Register Main results and navigation aliases while displaying each explicit result once. */
    function acceptNotice(value, snapshot = false) {
      const notice = normalizeNotice(value);
      if (disposed || !notice || seenResults.has(notice.resultId)) return false;
      seenResults.add(notice.resultId);
      notices.set(notice.resultId, notice);
      const key = deliveryKey(notice);
      if (key) aliases.set(key, notice.resultId);
      if (key && seenDeliveries.has(key)) { refreshButtons(); return false; }
      if (key) seenDeliveries.add(key);
      return deliver(toDelivery(notice, surface), snapshot, snapshot || notice.status === 'unchanged' || notice.status === 'running');
    }

    /** 接收旧套接字投递，保留既有控制能力并阻止双注入。 / Receive legacy socket deliveries, preserving controls and preventing duplicate injection. */
    function acceptOverlay(message) {
      if (disposed || !message || message.action !== 'task_delivery' || !message.data || typeof message.data !== 'object') return false;
      // 企业运行仅信任 Main 验证后的投递。 / Enterprise runs accept only Main-validated deliveries.
      if (message.data.source === 'enterprise_run' || ['workspace_id', 'incident_id', 'trace_id', 'workspaceId', 'incidentId', 'traceId'].some(/** 拒绝旧通道声明企业身份。 / Reject enterprise identities on the legacy channel. */ key => message.data[key] != null)) return false;
      const channel = String(message.channel || message.data.target || '').toLowerCase();
      if (surface === 'dynamic_island' && channel && channel !== 'dynamic_island'
        && message.data.presentation !== 'dynamic_island') return false;
      if (loading) { pending.push({ type: 'overlay', value: message }); return true; }
      const resultId = identity(message.data.completion_event_id);
      const key = deliveryKey(message.data);
      if ((resultId && seenResults.has(resultId)) || (key && seenDeliveries.has(key))) return false;
      if (key) seenDeliveries.add(key);
      return deliver(message, false);
    }

    /** 实时事件在快照加载期间排队，避免历史覆盖新结果。 / Queue live events during snapshot loading so history cannot replace newer results. */
    function onNotice(value) {
      if (disposed) return;
      if (loading) pending.push({ type: 'notice', value });
      else acceptNotice(value, false);
    }

    /** 先订阅再静默恢复近期记录，订阅或快照失败也清理等待。 / Subscribe before silently restoring recent records and drain pending events after failures. */
    function start() {
      if (started || disposed) return ready || Promise.resolve();
      started = true;
      loading = true;
      try {
        if (typeof api.onCompletionNotice === 'function') unsubscribe = api.onCompletionNotice(onNotice);
      } catch (error) { report(error); }
      ready = (async function hydrateHistory() {
        // 静默读取快照并处理先到的实时事件。 / Read a silent snapshot and then process live events that arrived first.
        try {
          const snapshot = typeof api.getCompletionNoticeSnapshot === 'function' ? await api.getCompletionNoticeSnapshot() : null;
          if (!disposed && snapshot && snapshot.schema === 'openxnet.completion-notice-snapshot.v1' && Array.isArray(snapshot.notices)) {
            const queuedIds = new Set(pending.filter((entry) => entry.type === 'notice').map((entry) => normalizeNotice(entry.value)).filter(Boolean).map((notice) => notice.resultId));
            const rows = snapshot.notices.slice(0, 50).map(normalizeNotice).filter(Boolean).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
            for (const notice of rows) if (!queuedIds.has(notice.resultId)) acceptNotice(notice, true);
          }
        } catch (error) { report(error); }
        finally {
          loading = false;
          const queued = pending;
          pending = [];
          for (const entry of queued) {
            if (entry.type === 'notice') acceptNotice(entry.value, false);
            else acceptOverlay(entry.value);
          }
        }
      })();
      return ready;
    }

    /** 通过可信近期结果身份解析导航，不接收任意 URL。 / Resolve navigation through trusted recent result identities without accepting URLs. */
    function resultForDelivery(delivery) {
      const value = delivery && delivery.data ? delivery.data : delivery;
      if (!value || typeof value !== 'object') return '';
      const resultId = identity(value.completion_event_id || value.resultId) || aliases.get(deliveryKey(value));
      const notice = notices.get(resultId);
      if (notice?.source === 'enterprise_run' || value.source === 'enterprise_run') {
        if (!notice || notice.source !== 'enterprise_run' || value.source !== 'enterprise_run'
          || identity(value.workspace_id || value.workspaceId) !== notice.workspaceId
          || identity(value.incident_id || value.incidentId) !== notice.incidentId
          || identity(value.trace_id || value.traceId) !== notice.traceId
          || value.task_id || value.taskId || value.conversation_id || value.conversationId) return '';
      }
      return resultId && notices.has(resultId) ? resultId : '';
    }

    /** 判断当前记录是否具有可打开的可信结果。 / Determine whether the current record has a trusted openable result. */
    function canOpenDelivery(delivery) {
      return !disposed && typeof api.openCompletionNotice === 'function' && Boolean(resultForDelivery(delivery));
    }

    /** 只向 Main 发送结果身份，打开原会话且不重放任务。 / Send only a result identity to Main to open the original conversation without replay. */
    async function openDelivery(delivery) {
      const resultId = resultForDelivery(delivery);
      if (!canOpenDelivery(delivery)) return false;
      try { return await api.openCompletionNotice({ resultId }) === true; }
      catch (error) { report(error); return false; }
    }

    /** 绑定页面现有按钮，按钮状态跟随当前选中的真实记录。 / Bind an existing page button to the currently selected real record. */
    function bindOpenButton(button, getSelectedDelivery) {
      if (!button || typeof button.addEventListener !== 'function' || typeof getSelectedDelivery !== 'function') return null;
      const defaultLabel = button.textContent;
      const binding = {
        /** 更新按钮禁用状态。 / Refresh the button's disabled state. */
        refresh() {
          const selected = getSelectedDelivery();
          const available = canOpenDelivery(selected);
          button.disabled = !available; button.hidden = !available;
          button.textContent = selected?.source === 'enterprise_run' ? '查看运行详情 ↗' : defaultLabel;
        },
        /** 移除本按钮监听。 / Remove this button's listener. */
        dispose() { button.removeEventListener('click', onClick); bindings.delete(binding); },
      };
      /** 打开当前选择并阻止展开容器的冒泡点击。 / Open the current selection without bubbling into the expanding container. */
      async function onClick(event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        const selected = getSelectedDelivery();
        const opened = await openDelivery(selected);
        if (!opened && !disposed && selected?.source === 'enterprise_run' && getSelectedDelivery() === selected) button.textContent = '记录已更新，请在运行指挥台查看';
      }
      button.addEventListener('click', onClick);
      bindings.add(binding);
      binding.refresh();
      return binding;
    }

    /** 页面关闭时注销订阅和按钮，晚到快照不再显示。 / Unsubscribe and detach buttons on close so late snapshots cannot render. */
    function dispose() {
      if (disposed) return;
      disposed = true;
      if (typeof unsubscribe === 'function') unsubscribe();
      unsubscribe = null;
      pending = [];
      for (const binding of [...bindings]) binding.dispose();
      seenResults.clear(); seenDeliveries.clear(); aliases.clear(); notices.clear();
    }

    return Object.freeze({ start, acceptOverlay, openDelivery, canOpenDelivery, bindOpenButton, dispose });
  }

  return Object.freeze({ createBridge, normalizeNotice });
});
