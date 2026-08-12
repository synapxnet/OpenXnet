"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const APPLICATION_RECALL_OBSERVATION_FOCUS_CHANNEL = "openxnet:application-recall-runtime:observation-focus-changed";

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
