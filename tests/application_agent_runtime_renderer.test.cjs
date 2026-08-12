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

/** 验证 Agent、A2A 和 Workflow 的 Desktop 分支不再触发 legacy Python transport。 */
test("desktop Agent A2A and Workflow management use typed Main boundaries", () => {
  const methods = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const server = fs.readFileSync(path.resolve(__dirname, "../server.py"), "utf8");
  const saveAgent = extractSection(methods, "async saveAgent()", "copyAgentId(id)");
  const removeAgent = extractSection(methods, "async removeAgent(id)", "isValidUrl(url)");
  const addA2a = extractSection(methods, "async addA2AServer()", "async removeA2AServer(url)");
  const deleteWorkflow = extractSection(methods, "async deleteWorkflow(filename)", "handleWorkflowDrop(event)");
  const uploadWorkflow = extractSection(methods, "async uploadWorkflow()", "async deleteVideo(video)");

  assert.ok(saveAgent.indexOf("if (this.isElectron)") < saveAgent.indexOf("ensureLegacyWebSocket()"));
  assert.match(saveAgent, /createApplicationAgent/);
  assert.ok(removeAgent.indexOf("if (this.isElectron)") < removeAgent.indexOf("fetch(`\/remove_agent`"));
  assert.match(removeAgent, /removeApplicationAgent/);
  assert.ok(addA2a.indexOf("if (this.isElectron)") < addA2a.indexOf("fetch(`\/a2a`"));
  assert.match(addA2a, /inspectApplicationA2a/);
  assert.ok(deleteWorkflow.indexOf("if (this.isElectron)") < deleteWorkflow.indexOf("fetch(`\/delete_workflow/"));
  assert.match(deleteWorkflow, /deleteArtifacts/);
  assert.ok(uploadWorkflow.indexOf("if (this.isElectron)") < uploadWorkflow.indexOf("fetch(`\/add_workflow`"));
  assert.match(uploadWorkflow, /importSelectedArtifacts/);
  assert.match(preload, /openxnet:application-agent-runtime:create-agent/);
  assert.match(preload, /inspectApplicationA2a: \(request\) => ipcRenderer\.invoke/);
  assert.match(server, /def _resolve_agent_snapshot_path/);
  assert.match(server, /candidate\.parent != root/);
});
