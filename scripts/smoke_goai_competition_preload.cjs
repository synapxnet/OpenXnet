"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const UI_PROFILE_CHANNEL = "openxnet:application-competition-runtime:get-ui-profile";
const SNAPSHOT_CHANNEL = "openxnet:application-competition-runtime:get-snapshot";
const PRELOAD_PATH = String(process.env.OPENXNET_GOAI_PRELOAD_PATH || "").trim()
  ? path.resolve(process.env.OPENXNET_GOAI_PRELOAD_PATH)
  : path.resolve(__dirname, "../static/js/preload.js");

/** 运行 Competition 沙箱 Preload 烟测；无输入，桥接或 IPC 缺失时抛出断言错误。 */
async function runSmoke() {
  ipcMain.handle(UI_PROFILE_CHANNEL, () => ({
    releaseProfile: "goai-staging",
    rehearsalEnabled: true,
  }));
  ipcMain.handle(SNAPSHOT_CHANNEL, () => ({
    schema: "openxnet.competition-runtime.v1",
    adapterMode: "fixture",
  }));

  let window = null;
  try {
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: PRELOAD_PATH,
      },
    });
    await window.loadURL("data:text/html;charset=utf-8,<html><body>OpenXnet Preload Smoke</body></html>");
    const result = await window.webContents.executeJavaScript(`
      (async () => ({
        bridgeType: typeof window.openxnetDesktop,
        startTaskType: typeof window.openxnetDesktop?.startApplicationCompetitionEnterpriseTask,
        exportEvaluationType: typeof window.openxnetDesktop?.exportApplicationCompetitionEvaluation,
        profile: await window.openxnetDesktop?.getApplicationCompetitionUiProfile?.(),
        snapshot: await window.openxnetDesktop?.getApplicationCompetitionSnapshot?.(),
      }))()
    `, true);

    assert.equal(result.bridgeType, "object");
    assert.equal(result.startTaskType, "function");
    assert.equal(result.exportEvaluationType, "function");
    assert.deepEqual(result.profile, {
      releaseProfile: "goai-staging",
      rehearsalEnabled: true,
    });
    assert.equal(result.snapshot?.schema, "openxnet.competition-runtime.v1");
    process.stdout.write(`${JSON.stringify({ ok: true, preloadPath: PRELOAD_PATH, profile: result.profile })}\n`);
  } finally {
    ipcMain.removeHandler(UI_PROFILE_CHANNEL);
    ipcMain.removeHandler(SNAPSHOT_CHANNEL);
    if (window && !window.isDestroyed()) window.destroy();
  }
}

/** 等待 Electron 并执行 Preload 烟测；无输入，完成后以明确退出码结束。 */
async function main() {
  try {
    await app.whenReady();
    await runSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
