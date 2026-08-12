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

/** 验证 Desktop Provider 操作只走 typed Main bridge，并把旧 Python HTTP 限制在 Browser fallback。 */
test("desktop provider discovery and embedding probes isolate legacy HTTP fallbacks", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const modelDiscovery = extractSection(
    methods,
    "async fetchModelsForType(type)",
    "saveLLMTool()",
  );
  const embeddingProbe = extractSection(
    methods,
    "async probeMemoryEmbeddingDimensions(providerId)",
    "async addMemory()",
  );

  const modelDesktopGuard = modelDiscovery.indexOf("if (this.isElectron)");
  const modelLegacyFetch = modelDiscovery.indexOf("fetch(`/llm_models`");
  assert.ok(modelDesktopGuard >= 0 && modelLegacyFetch > modelDesktopGuard);
  assert.match(modelDiscovery.slice(modelDesktopGuard, modelLegacyFetch), /validateApplicationProvider/);
  assert.match(modelDiscovery.slice(modelDesktopGuard, modelLegacyFetch), /return;/);

  const embeddingDesktopGuard = embeddingProbe.indexOf("if (this.isElectron)");
  const embeddingLegacyFetch = embeddingProbe.indexOf("fetch('\/api\/embedding_dims'");
  assert.ok(embeddingDesktopGuard >= 0 && embeddingLegacyFetch > embeddingDesktopGuard);
  assert.match(
    embeddingProbe.slice(embeddingDesktopGuard, embeddingLegacyFetch),
    /probeApplicationProviderEmbedding/,
  );
  assert.match(embeddingProbe, /return 384;/);
  assert.match(methods, /memory\.embedding_dims = await this\.probeMemoryEmbeddingDimensions/);
  assert.match(preload, /openxnet:application-providers:probe-embedding/);
  assert.match(preload, /probeApplicationProviderEmbedding: \(request\) => ipcRenderer\.invoke/);
});
