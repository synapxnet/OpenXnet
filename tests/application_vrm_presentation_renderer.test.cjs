"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 提取两个方法标记之间的源码；输入源码和标记，返回片段，标记缺失时断言失败。 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startMarker}`);
  return source.slice(start, end);
}

/** 验证独立桌宠走 Main IPC、嵌入预览跳过事件连接，并为 Browser/Server 保留 WebSocket。 */
test("desktop VRM presentation uses Main events while Browser retains WebSockets", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const vrm = fs.readFileSync(path.resolve(__dirname, "../static/js/vrm.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const vrmPreload = fs.readFileSync(path.resolve(__dirname, "../static/js/vrm-preload.js"), "utf8");

  const status = extractSection(methods, "async refreshVRMConnectionStatus()", "pollVRMStatus()");
  const statusGuard = status.indexOf("if (this.isElectron)");
  const statusFetch = status.indexOf("fetch('/tts/status'");
  assert.ok(statusGuard >= 0 && statusFetch > statusGuard);
  assert.match(status.slice(statusGuard, statusFetch), /getApplicationVrmPresentationStatus/);
  assert.match(status.slice(statusGuard, statusFetch), /return;/);

  const sender = extractSection(methods, "async sendTTSStatusToVRM(type, data)", "browseVrmModelFile()");
  const senderGuard = sender.indexOf("if (this.isElectron)");
  const socketSend = sender.indexOf("this.ttsWebSocket.send");
  assert.ok(senderGuard >= 0 && socketSend > senderGuard);
  assert.match(sender.slice(senderGuard, socketSend), /publishApplicationVrmPresentation/);
  assert.match(sender.slice(senderGuard, socketSend), /return;/);

  const vrmTransport = extractSection(vrm, "function initTTSWebSocket()", "initTTSWebSocket();");
  const embedGuard = vrmTransport.indexOf("if (isEmbedMode)");
  const desktopGuard = vrmTransport.indexOf("if (isDesktopVrmWindow)");
  const desktopSubscription = vrmTransport.indexOf("onPresentationEvent");
  const legacySocket = vrmTransport.indexOf("new WebSocket");
  assert.ok(embedGuard >= 0 && desktopGuard > embedGuard);
  assert.ok(desktopSubscription > desktopGuard && legacySocket > desktopSubscription);
  assert.match(vrmTransport.slice(embedGuard, desktopGuard), /return;/);
  assert.match(vrmTransport.slice(0, legacySocket), /bridge is unavailable/);
  assert.match(vrmTransport.slice(desktopSubscription, legacySocket), /return;/);
  const configuration = extractSection(
    vrm,
    "async function getDesktopVrmConfiguration()",
    "const modelConfig = await fetchVRMConfig();",
  );
  assert.match(configuration, /getPresentationConfiguration/);
  assert.match(configuration, /if \(isEmbedMode\)\s*{\s*return null;/);
  assert.match(configuration, /if \(isDesktopVrmWindow\)/);
  assert.match(configuration, /bridge is unavailable/);
  assert.match(configuration, /desktopVrmConfigurationPromise = null/);
  assert.match(configuration, /fetchDesktopVrmConfiguration/);
  const language = extractSection(configuration, "async function fetchLanguage()", "async function t(key)");
  const languageBridge = language.indexOf("return desktopConfiguration.language");
  const languageFetch = language.indexOf("fetch(`${http_protocol}//${HOST}/cur_language`)");
  assert.ok(languageBridge >= 0 && languageFetch > languageBridge);
  const vrmConfiguration = extractSection(
    vrm,
    "async function fetchVRMConfig()",
    "const modelConfig = await fetchVRMConfig();",
  );
  const vrmConfigurationBridge = vrmConfiguration.indexOf("desktopConfiguration.vrmConfig");
  const vrmConfigFetch = vrmConfiguration.indexOf("fetch(`${http_protocol}//${HOST}/vrm_config`)");
  assert.ok(vrmConfigurationBridge >= 0 && vrmConfigFetch > vrmConfigurationBridge);
  const modelCatalog = extractSection(vrm, "function getConfiguredVRMModels(vrmConfig)", "async function getVRMpath");
  assert.match(modelCatalog, /cloudModels/);
  assert.match(modelCatalog, /model\.remoteUrl/);
  const switchingCatalog = extractSection(vrm, "async function getAllModels()", "async function switchToModel");
  assert.match(switchingCatalog, /getConfiguredVRMModels/);
  assert.match(preload, /openxnet:application-vrm-presentation:status/);
  assert.match(preload, /openxnet:application-vrm-presentation:publish/);
  assert.match(vrmPreload, /openxnet:application-vrm-presentation:event/);
  assert.match(vrmPreload, /openxnet:application-vrm-presentation:configuration/);
  assert.match(vrmPreload, /getPresentationConfiguration/);
});
