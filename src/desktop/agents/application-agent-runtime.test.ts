import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LegacyRendererStateService } from "../storage/legacy-renderer-state";
import {
  ApplicationAgentRuntimeService,
  type ApplicationAgentRuntimeFetchResponse,
} from "./application-agent-runtime";

/** 构造有界 Fetch JSON 响应；输入状态和 JSON，输出测试响应，无网络副作用。 */
function jsonResponse(status: number, value: unknown): ApplicationAgentRuntimeFetchResponse {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return {
    status,
    headers: { get: () => String(body.byteLength) },
    arrayBuffer: async () => body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    ) as ArrayBuffer,
  };
}

test("Agent Runtime creates and removes one path-free atomic snapshot", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-agent-runtime-"));
  const state = new LegacyRendererStateService({ userDataDirectory: root });
  state.saveSettings({ settings: { agents: {}, model: "model-a", fast: { enabled: false } } });
  const runtime = new ApplicationAgentRuntimeService({
    userDataDirectory: root,
    state,
    createId: () => "agent123",
  });
  try {
    const created = await runtime.createAgent({ name: "回归 Agent", systemPrompt: "检查 UTF-8" });
    const snapshotPath = path.join(root, "agents", "agent123.json");
    assert.equal(created.agent?.name, "回归 Agent");
    assert.equal(JSON.stringify(created).includes(root), false);
    assert.equal(existsSync(snapshotPath), true);
    const snapshot = readFileSync(snapshotPath, "utf8");
    assert.equal(snapshot.includes("\r\n"), false);
    assert.match(snapshot, /"model": "model-a"/);
    const storedAgent = (state.getSnapshot().settings.agents as Record<string, Record<string, unknown>>).agent123;
    assert.equal(storedAgent?.config_path, "");
    assert.equal(storedAgent?.system_prompt, "检查 UTF-8");

    const removed = await runtime.removeAgent({ agentId: "agent123" });
    assert.equal(removed.action, "removed");
    assert.equal(existsSync(snapshotPath), false);
    assert.deepEqual(state.getSnapshot().settings.agents, {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Agent Runtime discovers one bounded A2A card without redirects", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-a2a-runtime-"));
  const state = new LegacyRendererStateService({ userDataDirectory: root });
  const requests: Array<{ readonly url: string; readonly redirect: string }> = [];
  const runtime = new ApplicationAgentRuntimeService({
    userDataDirectory: root,
    state,
    fetch: async (url, init) => {
      requests.push({ url, redirect: init.redirect });
      if (url.endsWith("/.well-known/agent.json")) return jsonResponse(404, {});
      return jsonResponse(200, {
        name: "A2A 测试节点",
        description: "受控节点",
        version: "1.0.0",
        authentication: { token: "must-not-return" },
        skills: [{ id: "review", name: "Review", description: "检查", tags: ["qa"], examples: ["run"] }],
      });
    },
  });
  try {
    const result = await runtime.inspectA2a({ url: "http://127.0.0.1:5000" });
    assert.equal(result.name, "A2A 测试节点");
    assert.equal(result.skills[0]?.id, "review");
    assert.equal(JSON.stringify(result).includes("must-not-return"), false);
    assert.deepEqual(requests, [
      { url: "http://127.0.0.1:5000/.well-known/agent.json", redirect: "error" },
      { url: "http://127.0.0.1:5000/agent.json", redirect: "error" },
    ]);
    await assert.rejects(runtime.inspectA2a({ url: "http://remote.example.test" }), /not allowed/i);
    assert.equal(requests.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
