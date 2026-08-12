"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const APPLICATION_VRM_PRESENTATION_EVENT_CHANNEL = "openxnet:application-vrm-presentation:event";
const APPLICATION_VRM_PRESENTATION_CONFIGURATION_CHANNEL = "openxnet:application-vrm-presentation:configuration";

/**
 * Subscribe to a VMC event without exposing the Electron event object.
 *
 * @param {string} channel Main-to-Renderer VMC channel.
 * @param {Function} callback Renderer callback.
 * @returns {Function} Exact listener unsubscriber.
 */
function onVmcEvent(channel, callback) {
  if (typeof callback !== "function") {
    throw new TypeError("VMC event callback must be a function.");
  }
  const listener = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * Read the current VMC transport configuration.
 *
 * @returns {Promise<object>} Current VMC configuration.
 */
function getVmcConfig() {
  return ipcRenderer.invoke("get-vmc-config");
}

/**
 * Update the VMC transport configuration.
 *
 * @param {object} config Requested VMC configuration.
 * @returns {Promise<object>} Applied VMC configuration.
 */
function setVmcConfig(config) {
  return ipcRenderer.invoke("set-vmc-config", config);
}

/**
 * Change mouse hit testing for the current VRM window.
 *
 * @param {boolean} ignore Whether mouse input should pass through.
 * @param {object} options Electron mouse forwarding options.
 * @returns {Promise<void>} Completion signal.
 */
function setIgnoreMouseEvents(ignore, options) {
  return ipcRenderer.invoke("set-ignore-mouse-events", ignore, options);
}

/**
 * Send one complete VMC animation frame to Main.
 *
 * @param {object} frameData VMC frame payload.
 * @returns {Promise<void>} Completion signal.
 */
function sendVmcFrame(frameData) {
  return ipcRenderer.invoke("send-vmc-frame", frameData);
}

/** 订阅 Main 广播的有界 TTS 展示事件；输入回调，返回精确取消函数。 */
function onPresentationEvent(callback) {
  return onVmcEvent(APPLICATION_VRM_PRESENTATION_EVENT_CHANNEL, callback);
}

/** 读取 Main 组合的语言和公开 VR 资产配置；无输入，失败时拒绝 Promise。 */
function getPresentationConfiguration() {
  return ipcRenderer.invoke(APPLICATION_VRM_PRESENTATION_CONFIGURATION_CHANNEL);
}

contextBridge.exposeInMainWorld("electronAPI", {
  getVMCConfig: getVmcConfig,
  setVMCConfig: setVmcConfig,
  setIgnoreMouseEvents,
});

contextBridge.exposeInMainWorld("vmcAPI", {
  onVMCOscRaw: (callback) => onVmcEvent("vmc-osc-raw", callback),
  sendVMCFrame: sendVmcFrame,
});

contextBridge.exposeInMainWorld("vrmRuntime", {
  onPresentationEvent,
  getPresentationConfiguration,
});
