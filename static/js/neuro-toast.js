/**
 * OpenXnet v0.5.7 — Neuro Toast Notification System
 * ===================================================
 *
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * Proprietary and Confidential.
 *
 * 非阻塞式 Toast 通知系统，对标 Antigravity Monitor 的微反馈体验。
 * 自动挂载容器到 DOM，提供 4 种语义类型 (success/info/warning/error)。
 *
 * 用法:
 *   import { showToast } from './neuro-toast.js';
 *   showToast('操作成功', 'success');
 *   showToast('Token 即将耗尽', 'warning', 5000);
 *
 * 或全局调用:
 *   window.neuroToast('消息内容', 'info');
 *
 * Author: maoyo (AI-assisted)
 * Department: 研发部
 * Date: 2026-04-14
 * Version: 1.0.0
 */

(function () {
  'use strict';

  // ── SVG 图标 ──
  const ICONS = {
    success: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>',
    info: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.469l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2"/></svg>',
    warning: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg>',
    error: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/></svg>'
  };

  // ── 容器管理 ──
  let container = null;

  function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.className = 'neuro-toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    return container;
  }

  // ── 核心 API ──
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = typeof duration === 'number' ? duration : 3000;

    var c = ensureContainer();

    var toast = document.createElement('div');
    toast.className = 'neuro-toast neuro-toast--' + type;

    var iconSpan = document.createElement('span');
    iconSpan.className = 'neuro-toast__icon';
    iconSpan.innerHTML = ICONS[type] || ICONS.info;

    var textSpan = document.createElement('span');
    textSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    c.appendChild(toast);

    // 自动消失
    var timer = setTimeout(function () {
      dismissToast(toast);
    }, duration);

    // 点击提前关闭
    toast.addEventListener('click', function () {
      clearTimeout(timer);
      dismissToast(toast);
    });

    // 最多同时 5 条
    while (c.children.length > 5) {
      dismissToast(c.children[0]);
    }

    return toast;
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('neuro-toast-out');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  }

  // ── 暴露全局 ──
  window.neuroToast = showToast;

  // ── 若使用 ES Module ──
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showToast: showToast, dismissToast: dismissToast };
  }
})();
