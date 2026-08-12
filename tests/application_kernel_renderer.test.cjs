"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 验证 Desktop 只执行 operation bridge，同时 Browser fallback 被限制在单一函数内。 */
test("desktop Kernel UI uses one operation bridge while Browser keeps isolated fallbacks", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const data = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_data.js"), "utf8");
  const fallbackStart = methods.indexOf("async invokeBrowserKernelOperation(operation, payload = {})");
  const fallbackEnd = methods.indexOf("async fetchKernelPayload(operation, payload = {})", fallbackStart);
  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
  const withoutBrowserFallback = methods.slice(0, fallbackStart) + methods.slice(fallbackEnd);
  assert.doesNotMatch(withoutBrowserFallback, /fetch\((?:`|')\/v1\/kernel/);
  assert.doesNotMatch(methods, /openxnetChatFetch\((?:`|')\/v1\/kernel/);
  assert.doesNotMatch(data, /kernelActionDialog(?:Endpoint|Method)/);
  assert.doesNotMatch(methods, /kernelInspectorRequest\.(?:url|requestOptions)/);
  assert.match(methods, /window\.openxnetDesktop\.invokeApplicationKernel\(\{ operation, payload \}\)/);
  assert.match(methods, /if \(this\.isDesktopKernelRuntimeAvailable\(\)\) \{[^]*fetchKernelJson\('event-status'/);
  assert.match(preload, /openxnet:application-kernel-runtime:invoke/);
  assert.match(preload, /invokeApplicationKernel: \(request\) => ipcRenderer\.invoke/);
});
