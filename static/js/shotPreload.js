"use strict";

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Submit the selected screenshot rectangle to Main.
 *
 * @param {object} rect Selected screen rectangle.
 * @returns {void}
 */
function finishShot(rect) {
  ipcRenderer.send('screenshot-selected', rect)
}

/**
 * Cancel the active screenshot selection.
 *
 * @returns {void}
 */
function cancelShot() {
  ipcRenderer.send('screenshot-selected', null)
}

contextBridge.exposeInMainWorld('electronAPI', {
  finishShot,
  cancelShot,
})
