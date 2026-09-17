"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

/** 提取两个方法标记之间源码；输入源码与标记，输出片段，标记缺失时断言失败。 */
function extractSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startMarker}`);
  return source.slice(start, end);
}

/** Load the real draft-opening methods without starting transport or application services. */
function loadRoleDraftMethods() {
  const source = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const sections = [
    extractSection(source, "editMemory(id) {", "getVendorName(providerId) {"),
    extractSection(source, "editTTS(name) {", "openAddAppearanceDialog() {"),
    extractSection(source, "editAppearance(name) {", "deleteAppearance(name) {"),
  ];
  return vm.runInNewContext(`({${sections.join("\n")}})`, { JSON });
}

/** Editing a role's nested entries and cancelling must leave the stored role unchanged. */
test("role memory draft cancellation preserves nested stored data", () => {
  const methods = loadRoleDraftMethods();
  const host = {
    memories: [{ id: "role-1", characterBook: [{ keysRaw: "alpha", content: "original" }], alternateGreetings: ["hello"] }],
    showAddMemoryDialog: false,
  };
  const before = JSON.stringify(host.memories);
  methods.editMemory.call(host, "role-1");
  assert.equal(host.showAddMemoryDialog, true);
  host.newMemory.characterBook[0].content = "unsaved";
  host.newMemory.alternateGreetings.push("unsaved");
  host.showAddMemoryDialog = false;
  assert.equal(JSON.stringify(host.memories), before);
});

/** Voice preset options must also remain detached until the user explicitly saves. */
test("voice preset draft cancellation preserves nested stored data", () => {
  const methods = loadRoleDraftMethods();
  const host = {
    ttsSettings: { newtts: { narrator: { name: "narrator", gsvAudioOptions: [{ name: "original", value: "clip.wav" }] } } },
    _pendingVoiceDraftCredentialFields: new Set(["api_key"]),
    showAddTTSDialog: false,
  };
  const before = JSON.stringify(host.ttsSettings);
  methods.editTTS.call(host, "narrator");
  assert.equal(host.showAddTTSDialog, true);
  assert.equal(host._editingTTSName, "narrator");
  host.newTTSConfig.gsvAudioOptions[0].name = "unsaved";
  host.newTTSConfig.gsvAudioOptions.push({ name: "draft" });
  host.showAddTTSDialog = false;
  assert.equal(JSON.stringify(host.ttsSettings), before);
});

/** Appearance motion edits are drafts and must not change an existing preset on cancel. */
test("appearance preset draft cancellation preserves stored motion choices", () => {
  const methods = loadRoleDraftMethods();
  const host = { VRMConfig: { newVRM: { office: { name: "office", selectedMotionIds: ["idle"], settings: { expression: "neutral" } } } }, showAddAppearanceDialog: false };
  const before = JSON.stringify(host.VRMConfig);
  methods.editAppearance.call(host, "office");
  assert.equal(host.showAddAppearanceDialog, true);
  host.newAppearanceConfig.selectedMotionIds.push("wave");
  host.newAppearanceConfig.settings.expression = "happy";
  host.showAddAppearanceDialog = false;
  assert.equal(JSON.stringify(host.VRMConfig), before);
});

/** Old roles without character books and missing preset ids must not crash or open stale forms. */
test("role draft openers tolerate incomplete and missing saved entries", () => {
  const methods = loadRoleDraftMethods();
  for (const incomplete of [{ id: "old" }, { id: "old", characterBook: null }, { id: "old", characterBook: [] }]) {
    const host = { memories: [incomplete], showAddMemoryDialog: false };
    methods.editMemory.call(host, "old");
    assert.equal(host.newMemory.characterBook.length, 1);
    assert.equal(host.newMemory.characterBook[0].content, "");
    assert.ok(Array.isArray(host.newMemory.alternateGreetings));
  }
  for (const [name, id] of [["editMemory", "missing"], ["editTTS", "missing"], ["editAppearance", "missing"]]) {
    const host = { memories: null, ttsSettings: {}, VRMConfig: {}, untouched: "draft" };
    const before = JSON.stringify(host);
    assert.doesNotThrow(() => methods[name].call(host, id));
    assert.equal(JSON.stringify(host), before);
  }
});

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
