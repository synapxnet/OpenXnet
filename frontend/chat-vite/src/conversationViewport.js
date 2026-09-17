/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话阅读位置与草稿范围 / Conversation reading position and draft scope.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */

/** 判断读者是否停留最新消息附近。 Determine whether the reader remains near the latest message. */
export function isNearLatest(viewport, threshold = 72) {
  if (!viewport) return true;
  return Math.max(0, viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) <= threshold;
}

/** 流式更新只跟随主动停留底部的读者。 Follow streaming updates only for readers already at the bottom. */
export function shouldFollowLatest({ nearBottom, explicit = false, scopeChanged = false }) {
  return Boolean(explicit || scopeChanged || nearBottom);
}

/** 用会话与工作区组合隔离未提交草稿。 Isolate unsent drafts by conversation and workspace together. */
export function conversationScopeKey(snapshot = {}) {
  return JSON.stringify([
    String(snapshot.settings?.workspace?.path || ''),
    String(snapshot.conversationId || 'new'),
  ]);
}

/** 计算容器内的定位值，避免滚动整个窗口。 Calculate a local scroll offset without scrolling the outer window. */
export function messageScrollOffset(containerRect, messageRect, scrollTop) {
  return Math.max(0, scrollTop + messageRect.top - containerRect.top - 24);
}
