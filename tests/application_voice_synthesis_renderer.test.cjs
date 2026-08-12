"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 提取两个方法标记之间的 Renderer 源码；输入源码和标记，返回片段，标记缺失时断言失败。 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startMarker}`);
  return source.slice(start, end);
}

/** 验证 Desktop TTS 只提交非敏感 typed IPC 参数，旧 `/tts` 仅存在于 Browser 分支。 */
test("desktop voice synthesis uses typed Main IPC while Browser retains HTTP", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const helper = extractSection(
    methods,
    "async synthesizeVoiceBlob(text, index = 0, voice = 'default'",
    "async transcribeDesktopVoiceBlob(wavBlob)",
  );
  const desktopGuard = helper.indexOf("if (isElectron)");
  const legacyFetch = helper.indexOf("fetch('/tts'");
  assert.ok(desktopGuard >= 0 && legacyFetch > desktopGuard);
  assert.match(helper.slice(desktopGuard, legacyFetch), /synthesizeApplicationVoice/);
  assert.match(helper.slice(desktopGuard, legacyFetch), /return new Blob/);
  assert.doesNotMatch(helper.slice(desktopGuard, legacyFetch), /ttsSettings/);

  const migratedCallers = [
    extractSection(methods, "async processTTSChunk(message, index)", "async startAudioPlayProcess"),
    extractSection(methods, "async processReadTTSChunk(index)", "async ClickToListen"),
    extractSection(methods, "async processTTSChunkWithoutPlayback(index)", "stopSegmentTTS(isEnd = true)"),
    extractSection(methods, "async synthSegment(idx)", "async doPlayAudio"),
  ];
  for (const caller of migratedCallers) {
    assert.match(caller, /synthesizeVoiceBlob/);
    assert.doesNotMatch(caller, /fetch\((`|')\/tts/);
  }

  const preview = extractSection(methods, "async ClickToListen", "downloadAudio()");
  const previewDesktopGuard = preview.indexOf("if (isElectron)");
  const previewLegacyFetch = preview.indexOf("fetch('/tts'");
  assert.ok(previewDesktopGuard >= 0 && previewLegacyFetch > previewDesktopGuard);
  assert.match(preview.slice(previewDesktopGuard, previewLegacyFetch), /synthesizeVoiceBlob/);

  const systemCatalog = extractSection(methods, "async fetchSystemVoices()", "addTableEnhancements()");
  const systemDesktopGuard = systemCatalog.indexOf("if (isElectron)");
  const systemLegacyFetch = systemCatalog.indexOf("fetch('/system/voices'");
  assert.ok(systemDesktopGuard >= 0 && systemLegacyFetch > systemDesktopGuard);
  assert.match(systemCatalog.slice(systemDesktopGuard, systemLegacyFetch), /listApplicationSystemVoices/);

  const providerCatalog = extractSection(methods, "async fetchTetosNewVoices(provider)", "getVoiceLabel(v)");
  const providerDesktopGuard = providerCatalog.indexOf("if (isElectron)");
  const providerLegacyFetch = providerCatalog.indexOf("fetch('/tts/tetos/list_voices'");
  const providerDesktopReturn = providerCatalog.indexOf("            return;", providerDesktopGuard);
  assert.ok(providerDesktopGuard >= 0 && providerLegacyFetch > providerDesktopGuard);
  assert.ok(providerDesktopReturn > providerDesktopGuard && providerDesktopReturn < providerLegacyFetch);
  const providerDesktopBranch = providerCatalog.slice(providerDesktopGuard, providerDesktopReturn);
  assert.match(providerDesktopBranch, /listApplicationProviderVoices/);
  assert.doesNotMatch(providerDesktopBranch, /speech_key|api_key|secret_key/);

  const referenceLifecycle = extractSection(methods, "async uploadGsvAudio()", "async startVRM()");
  const importDesktopGuard = referenceLifecycle.indexOf("if (this.isElectron)");
  const legacyUpload = referenceLifecycle.indexOf("fetch(`/upload_gsv_ref_audio`");
  assert.ok(importDesktopGuard >= 0 && legacyUpload > importDesktopGuard);
  assert.match(referenceLifecycle.slice(importDesktopGuard, legacyUpload), /importApplicationVoiceReference/);
  const removeDesktopGuard = referenceLifecycle.indexOf("if (this.isElectron)", legacyUpload);
  const legacyDelete = referenceLifecycle.indexOf("fetch(`/delete_audio/", removeDesktopGuard);
  assert.ok(removeDesktopGuard > legacyUpload && legacyDelete > removeDesktopGuard);
  assert.match(referenceLifecycle.slice(removeDesktopGuard, legacyDelete), /removeApplicationVoiceReference/);
  assert.match(preload, /openxnet:application-voice-runtime:synthesize/);
  assert.match(preload, /synthesizeApplicationVoice: \(request\) => ipcRenderer\.invoke/);
  assert.match(preload, /openxnet:application-voice-runtime:list-system-voices/);
  assert.match(preload, /openxnet:application-voice-runtime:list-provider-voices/);
  assert.match(preload, /openxnet:application-voice-runtime:import-reference/);
  assert.match(preload, /openxnet:application-voice-runtime:remove-reference/);
  assert.match(preload, /webUtils\.getPathForFile\(file\)/);
});
