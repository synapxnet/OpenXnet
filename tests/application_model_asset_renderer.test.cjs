"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 提取两个标记之间的 Renderer 源码；输入源码和标记，返回片段；标记缺失时断言失败。 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startMarker}`);
  return source.slice(start, end);
}

/** 验证 Desktop 模型管理只走 typed bridge，旧 HTTP/SSE 仅位于明确 Browser fallback。 */
test("desktop model assets use typed Main downloads and isolate Browser SSE fallbacks", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const sherpaDownload = extractSection(methods, "async sherpaDownload(source = 'modelscope')", "async sherpaRemove()");
  const minilmDownload = extractSection(methods, "async minilmDownload(source = 'modelscope')", "async minilmRemove()");
  for (const section of [sherpaDownload, minilmDownload]) {
    const runtimeBranch = section.indexOf("if (runtime)");
    const desktopGuard = section.indexOf("if (this.isApplicationModelAssetDesktopHost())");
    const eventSource = section.indexOf("new EventSource(");
    assert.ok(runtimeBranch >= 0 && desktopGuard > runtimeBranch && eventSource > desktopGuard);
    assert.match(section.slice(runtimeBranch, desktopGuard), /downloadApplicationModelAsset/);
    assert.match(section.slice(desktopGuard, eventSource), /return;/);
  }
  assert.match(methods, /getApplicationModelAssetStatus\(\{ kind: 'sherpa' \}\)/);
  assert.match(methods, /getApplicationModelAssetStatus\(\{ kind: 'minilm' \}\)/);
  assert.match(preload, /openxnet:application-model-assets:download/);
  assert.match(preload, /onApplicationModelAssetProgress: \(callback\) => onRendererEvent/);
});
