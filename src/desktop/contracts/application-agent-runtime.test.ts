import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCreateApplicationAgentRequest,
  parseInspectApplicationA2aRequest,
  parseRemoveApplicationAgentRequest,
} from "./application-agent-runtime";

test("Agent Runtime contract accepts exact bounded requests", () => {
  assert.deepEqual(
    parseCreateApplicationAgentRequest({ name: "测试 Agent", systemPrompt: "负责回归检查" }),
    { name: "测试 Agent", systemPrompt: "负责回归检查" },
  );
  assert.deepEqual(parseRemoveApplicationAgentRequest({ agentId: "agent_123" }), { agentId: "agent_123" });
  assert.deepEqual(
    parseInspectApplicationA2aRequest({ url: "http://127.0.0.1:5000/agent" }),
    { url: "http://127.0.0.1:5000/agent" },
  );
  assert.deepEqual(
    parseInspectApplicationA2aRequest({ url: "https://agent.example.test" }),
    { url: "https://agent.example.test" },
  );
});

test("Agent Runtime contract rejects paths, remote HTTP and request drift", () => {
  assert.throws(
    () => parseCreateApplicationAgentRequest({ name: "Agent", systemPrompt: "Prompt", command: "calc.exe" }),
    /fields are invalid/i,
  );
  assert.throws(() => parseRemoveApplicationAgentRequest({ agentId: "../agent" }), /invalid/i);
  assert.throws(() => parseInspectApplicationA2aRequest({ url: "http://agent.example.test" }), /not allowed/i);
  assert.throws(
    () => parseInspectApplicationA2aRequest({ url: "https://user:secret@agent.example.test" }),
    /not allowed/i,
  );
});
