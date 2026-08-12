"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/** Channels accepted by the unprivileged startup screen. */
const STARTUP_EVENT_CHANNELS = new Set(["backend-ready", "trigger-search"]);

/**
 * Subscribe to one allow-listed startup event without exposing Electron internals.
 *
 * @param {string} channel Allow-listed channel.
 * @param {Function} callback Renderer callback.
 * @returns {Function} Exact listener unsubscriber.
 */
function onStartupEvent(channel, callback) {
  if (!STARTUP_EVENT_CHANNELS.has(channel) || typeof callback !== "function") {
    throw new TypeError("A valid startup event subscription is required.");
  }
  const listener = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("electron", {
  isMac: process.platform === "darwin",
  isWindows: process.platform === "win32",
  ipcRenderer: { on: onStartupEvent },
  openMainApp: () => ipcRenderer.invoke("open-main-app"),
});
