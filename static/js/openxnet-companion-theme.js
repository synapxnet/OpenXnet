/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 桌面浮层皮肤同步 / Desktop overlay skin synchronization.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
/** 复用经过验证的皮肤库，只读取当前选择。 / Reuse the validated skin library without changing the selected skin. */
(function initializeCompanionTheme() {
  let unsubscribe = null;
  /** 跟随主界面的明暗与自定义配色。 / Follow the main application's mode and custom palette. */
  function applyCompanionTheme() {
    try {
      const library = window.OpenXnetSkins;
      const native = typeof window.openxnetAppearance?.read === 'function' ? window.openxnetAppearance.read() : null;
      if (native && !native.ok) return;
      const saved = native?.value ?? localStorage.getItem(library?.STORAGE_KEY || 'openxnet.skins.v1');
      if (library && saved) {
        const storage = { /** 只向皮肤解析器提供已读取文本，禁止保存副作用。 / Give the parser only the captured text, without write side effects. */ getItem() { return saved; } };
        const selected = library.createStore({ storage }).get();
        if (selected.ok && library.apply(selected.value).ok) return;
      }
      const previous = localStorage.getItem('openxnet-theme');
      const mode = ['dark', 'midnight', 'neon', 'ink', 'rainbow'].includes(previous) ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', mode);
    } catch (_) { /* 读取暂不可用时保留已经应用的主题。 / Preserve the applied theme if reading is temporarily unavailable. */ }
  }
  applyCompanionTheme();
  document.addEventListener('DOMContentLoaded', applyCompanionTheme, { once: true });
  if (typeof window.openxnetAppearance?.onChanged === 'function') unsubscribe = window.openxnetAppearance.onChanged(applyCompanionTheme);
  /** 存储事件仅刷新外观，不执行任务。 / Storage events refresh appearance without executing tasks. */
  window.addEventListener('storage', function syncCompanionTheme(event) {
    if (!event.key || event.key === 'openxnet-theme' || event.key === window.OpenXnetSkins?.STORAGE_KEY) applyCompanionTheme();
  });
  /** 伴随窗口真正卸载时释放Main订阅。 / Release the Main subscription when the companion unloads. */
  window.addEventListener('pagehide', function disposeCompanionTheme() { if (typeof unsubscribe === 'function') unsubscribe(); unsubscribe = null; }, { once: true });
})();
