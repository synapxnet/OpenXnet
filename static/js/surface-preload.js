"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const APPLICATION_RECALL_OBSERVATION_FOCUS_CHANNEL = "openxnet:application-recall-runtime:observation-focus-changed";

/** 订阅固定公开通道并返回精确取消函数，不向页面暴露IPC发送器。 / Subscribe to a fixed public channel with exact cleanup, without exposing IPC senders. */
function subscribeCompanionEvent(channel, callback) {
  if (typeof callback !== "function") throw new TypeError("Companion event listener must be a function.");
  /** 仅转发Main公开负载，不暴露Electron事件对象。 / Forward Main's public payload without exposing the Electron event. */
  function handleCompanionEvent(_event, payload) { callback(payload); }
  ipcRenderer.on(channel, handleCompanionEvent);
  /** 清理当前监听，其他订阅保持不变。 / Remove this listener without affecting other subscriptions. */
  return function unsubscribeCompanionEvent() { ipcRenderer.removeListener(channel, handleCompanionEvent); };
}

contextBridge.exposeInMainWorld("openxnetAppearance", Object.freeze({
  /** 只读Main统一保存的皮肤库。 / Read the Main-owned skin library only. */
  read: () => ipcRenderer.sendSync("openxnet:appearance-preferences:read"),
  /** 保存成功时同步外观，不开放皮肤写入。 / Synchronize successful appearance saves without enabling writes. */
  onChanged: callback => subscribeCompanionEvent("openxnet:appearance-preferences:changed", callback),
}));

contextBridge.exposeInMainWorld("openxnetDesktop", Object.freeze({
  /** 静默读取已校验的近期结果，不发布通知。 / Silently read validated recent results without publishing notifications. */
  getCompletionNoticeSnapshot: () => ipcRenderer.invoke("openxnet:completion-notice:snapshot"),
  /** 只用结果ID导航，不开放审批和执行。 / Navigate by result ID without enabling approval or execution. */
  openCompletionNotice: request => ipcRenderer.invoke("openxnet:completion-notice:open", request),
  /** 订阅Main已校验的完成状态。 / Subscribe to Main-validated completion states. */
  onCompletionNotice: callback => subscribeCompanionEvent("openxnet:completion-notice:notice", callback),
}));

/** 订阅 Main 转发的 Recall 观察焦点；输入回调，返回精确取消函数。 */
function onApplicationRecallObservationFocus(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Recall observation focus listener must be a function.");
  }
  /** 转发受信任 payload；输入 Electron 事件和数据，无返回。 */
  function handleObservationFocus(_event, payload) {
    callback(payload);
  }
  ipcRenderer.on(APPLICATION_RECALL_OBSERVATION_FOCUS_CHANNEL, handleObservationFocus);
  /** 移除当前订阅；无输入和返回，可重复执行。 */
  return function unsubscribe() {
    ipcRenderer.removeListener(APPLICATION_RECALL_OBSERVATION_FOCUS_CHANNEL, handleObservationFocus);
  };
}

contextBridge.exposeInMainWorld("electron", {
  isMac: process.platform === "darwin",
  isWindows: process.platform === "win32",
});

contextBridge.exposeInMainWorld("electronAPI", {
  windowAction: (action) => ipcRenderer.invoke("window-action", action),
  getCurrentLanguage: () => ipcRenderer.invoke("get-current-language"),
  setDynamicIslandSurfaceState: (payload) => ipcRenderer.invoke("set-dynamic-island-surface-state", payload),
  getDynamicIslandSurfaceState: () => ipcRenderer.invoke("get-dynamic-island-surface-state"),
  openDynamicIslandWindow: () => ipcRenderer.invoke("open-dynamic-island-window"),
  closeDynamicIslandWindow: () => ipcRenderer.invoke("close-dynamic-island-window"),
  closeFloatingTaskHudWindow: () => ipcRenderer.invoke("close-floating-task-hud-window"),
  onApplicationRecallObservationFocus,
});
