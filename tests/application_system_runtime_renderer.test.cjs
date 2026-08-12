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

/** 验证 Desktop 系统操作使用 typed Main Runtime，HTTP 只保留给 Browser/Server。 */
test("desktop system operations use typed Main Runtime while Browser retains HTTP", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const opsBridge = fs.readFileSync(path.resolve(__dirname, "../frontend/ops-vite/src/opsBridge.js"), "utf8");

  const cases = [
    ["async getInternalIP()", "async generateQRCode()", "getApplicationSystemNetworkAddress", "fetch('/api/ip'"],
    ["async updateProxy()", "async openUserfile()", "applyApplicationSystemProxy", "fetch('/api/update_proxy'"],
    ["async openUserfile()", "async openLogfile()", "revealApplicationSystemDirectory", "fetch('/api/get_userfile'"],
    ["async openLogfile()", "async openExtfile()", "revealApplicationSystemDirectory", "fetch('/api/get_userfile'"],
    ["async openExtfile()", "async changeHAEnabled()", "revealApplicationSystemDirectory", "fetch('/api/get_extfile'"],
  ];
  for (const [start, end, bridge, fallback] of cases) {
    const section = extractSection(methods, start, end);
    const desktopGuard = section.indexOf("this.isElectron");
    const typedCall = section.indexOf(bridge);
    const browserFetch = section.indexOf(fallback);
    assert.ok(desktopGuard >= 0 && typedCall > desktopGuard && browserFetch > typedCall);
    assert.match(section.slice(typedCall, browserFetch), /return(?:\s+[^;]+)?;/);
  }

  assert.match(preload, /openxnet:application-system-runtime:apply-proxy/);
  assert.match(preload, /openxnet:application-system-runtime:reveal-directory/);
  assert.match(preload, /openxnet:application-system-runtime:network-address/);
  assert.match(opsBridge, /else if \(!host\.isElectron\)/);
});
