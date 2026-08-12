"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 提取两个方法标记之间的源码；输入源码和标记，返回片段，标记缺失时断言失败。 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, "Missing source section " + startMarker);
  return source.slice(start, end);
}

/** 验证 Desktop 贴纸包使用 Core Artifact，multipart 只保留给 Browser/Server。 */
test("desktop sticker packs use Core Artifacts while Browser retains multipart upload", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const desktopBuilder = extractSection(
    methods,
    "async createDesktopStickerPack()",
    "async createStickerPack()",
  );
  assert.match(desktopBuilder, /importSelectedApplicationArtifacts/);
  assert.match(desktopBuilder, /artifact_id/);
  assert.ok(desktopBuilder.includes("'/uploaded_files/'"));
  assert.doesNotMatch(desktopBuilder, /fetch\(/);

  const creator = extractSection(methods, "async createStickerPack()", "deleteStickerPack(stickerPack)");
  const desktopGuard = creator.indexOf("if (this.isElectron)");
  const typedCall = creator.indexOf("createDesktopStickerPack");
  const browserFetch = creator.indexOf("fetch('/create_sticker_pack'");
  assert.ok(desktopGuard >= 0 && typedCall > desktopGuard && browserFetch > typedCall);
  assert.match(creator.slice(desktopGuard, browserFetch), /else/);
});

/** 验证 Desktop 文件库 bridge 缺失时明确失败，不静默进入 Python compatibility routes。 */
test("desktop artifact operations never fall through to compatibility HTTP", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const uploads = extractSection(
    methods,
    "async uploadApplicationFiles(files)",
    "applyApplicationArtifactSnapshot(snapshot)",
  );
  const uploadGuard = uploads.indexOf("if (this.isElectron)");
  const uploadFailure = uploads.indexOf("Artifact runtime unavailable");
  const uploadFetch = uploads.indexOf("fetch('/load_file'");
  assert.ok(uploadGuard >= 0 && uploadFailure > uploadGuard && uploadFetch > uploadFailure);

  const deletion = extractSection(
    methods,
    "async deleteApplicationArtifacts(files)",
    "async uploadStorageFiles(",
  );
  assert.match(deletion, /if \(this\.isElectron\)/);
  assert.match(deletion, /Desktop Artifact runtime is unavailable/);

  const loading = extractSection(methods, "async loadStorageFiles()", "hasApplicationRecallRuntime()");
  const loadGuard = loading.indexOf("if (this.isElectron)");
  const loadFailure = loading.indexOf("Desktop Artifact runtime is unavailable");
  const loadFetch = loading.indexOf("fetch(");
  assert.ok(loadGuard >= 0 && loadFailure > loadGuard && loadFetch > loadFailure);
});
