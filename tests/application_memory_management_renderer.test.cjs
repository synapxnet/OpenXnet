"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 提取两个方法标记之间源码；输入源码与标记，输出片段，标记缺失时断言失败。 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startMarker}`);
  return source.slice(start, end);
}

/** 验证 Desktop 记忆管理只走稳定 ID typed bridge，旧 index HTTP 仅位于 Browser fallback。 */
test("desktop memory collection management uses typed Worker boundaries", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const html = fs.readFileSync(path.resolve(__dirname, "../static/index.html"), "utf8");
  const removeMemory = extractSection(methods, "async removeMemory(id)", "editMemory(id)");
  const listRecords = extractSection(methods, "async loadVectorTable(mid)", "startEditRow(tableIndex)");
  const updateRecord = extractSection(methods, "async submitEditRow()", "async deleteVectorRow(row)");
  const deleteRecord = extractSection(methods, "async deleteVectorRow(row)", "isApplicationToolchainRuntimeAvailable()");

  assert.ok(removeMemory.indexOf("if (this.isElectron)") < removeMemory.indexOf("fetch(`/remove_memory`"));
  assert.match(removeMemory, /removeApplicationMemoryCollection/);
  assert.ok(listRecords.indexOf("if (this.isElectron)") < listRecords.indexOf("fetch(`/memory/"));
  assert.match(listRecords, /listApplicationMemoryRecords/);
  assert.ok(updateRecord.indexOf("if (this.isElectron)") < updateRecord.indexOf("fetch(`/memory/"));
  assert.match(updateRecord, /recordId: String\(this\.editRowId/);
  assert.ok(deleteRecord.indexOf("if (this.isElectron)") < deleteRecord.indexOf("fetch(`/memory/"));
  assert.match(deleteRecord, /recordId: String\(row\?\.uuid/);
  assert.doesNotMatch(methods, /async addVectorRow\(\)/);
  assert.match(html, /deleteVectorRow\(vectorTable\[\$index\]\)/);
  assert.match(preload, /openxnet:application-memory-management:list-records/);
  assert.match(preload, /removeApplicationMemoryCollection: \(request\) => ipcRenderer\.invoke/);
});
