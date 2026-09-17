/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话任务列表持久化投影回归 / Persisted conversation task-list projection regressions.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { bootstrapApplicationTasks } from "./application-tasks";

test("large legacy task histories retain bounded conversation ownership and public transcripts", /** 大型旧历史不能使公开记录失去合法读取归属。 / Large legacy histories must not remove the ownership needed to read public records. */ async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "ox-conversation-summary-"));
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const transcript = { schema: "openxnet.agent-transcript.v1", task_id: "actual-child", messages: [{ id: "actual-message", kind: "assistant", content: "Actual public reply" }], truncated: false };
    const created = await tasks.createTask({ workspacePath: path.join(directory, "workspace"), title: "Long task", description: "Keep actual records readable", agentType: "default", priority: "normal", scheduleType: "manual", scheduleExpression: "", nextRunAt: "", source: "test", inputArtifactIds: [], details: { context: {
      origin_conversation_id: "actual-conversation", history: ["古".repeat(120_000)], agent_transcript: transcript,
      automation: { state: "active", completion_policy: "continuous", runs: [] },
    } } });
    const detail = await tasks.getTask({ taskId: created.id });
    const context = detail.task.details.context as Record<string, unknown>;
    assert.equal(detail.task.details.details_truncated, true);
    assert.equal(context.origin_conversation_id, "actual-conversation");
    assert.deepEqual(context.agent_transcript, transcript);
    assert.equal((context.automation as Record<string, unknown>).state, "active");
    assert.equal(context.history, undefined);
    assert.ok(Buffer.byteLength(JSON.stringify(detail.task.details), "utf8") < 256 * 1024);
  } finally {
    tasks.close(); assert.equal(path.dirname(directory), os.tmpdir()); assert.match(path.basename(directory), /^ox-conversation-summary-/);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("conversation automation survives durable task lists with a bounded public receipt history", /** 使用真实Core存储验证列表归属与回执预算。 / Verify list ownership and receipt budgets using the actual Core store. */ async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "ox-conversation-summary-"));
  const workspacePath = path.join(directory, "workspace");
  const tasks = bootstrapApplicationTasks({ userDataDirectory: directory });
  try {
    const runs = Array.from({ length: 60 }, /** 构造明确的历史回执序列。 / Construct an explicit historical receipt sequence. */ (_, index) => ({ id: `run-${index}`, outcome: "changed", summary: "result".repeat(100), evidence: ["evidence".repeat(50)], finished_at: "2026-09-14T10:00:00Z", notify: true, private_engine_options: "not-public" }));
    const created = await tasks.createTask({ workspacePath, title: "Observed task", description: "Check actual evidence", agentType: "default", priority: "normal", scheduleType: "recurring", scheduleExpression: "every hour", nextRunAt: "", source: "test", inputArtifactIds: [], details: { context: {
      origin_conversation_id: "actual-conversation", private_context: "not-public",
      agent_transcript: { messages: ["detail-only-transcript"] },
      automation: { state: "active", notification_policy: "changes_only", completion_policy: "until_done", completion_condition: "Verify the result", last_outcome: "changed", last_run_id: "run-59", last_observation_key: "actual-observation", private_options: "not-public", runs },
    } } });
    const listed = await tasks.listTasks({ workspacePath });
    const context = listed.tasks[0]!.details.context as Record<string, unknown>;
    assert.equal(context.origin_conversation_id, "actual-conversation");
    const automation = context.automation as Record<string, unknown>;
    assert.equal(automation.state, "active"); assert.equal(automation.last_run_id, "run-59");
    const publicRuns = automation.runs as Array<Record<string, unknown>>;
    assert.equal(publicRuns.length, 50); assert.equal(publicRuns[0]!.id, "run-10");
    assert.equal(publicRuns[49]!.id, "run-59"); assert.equal(publicRuns[0]!.truncated, true);
    assert.doesNotMatch(JSON.stringify(listed), /not-public|detail-only-transcript/);
    const detail = await tasks.getTask({ taskId: created.id });
    const fullAutomation = (detail.task.details.context as Record<string, unknown>).automation as Record<string, unknown>;
    assert.equal((fullAutomation.runs as unknown[]).length, 60);
    assert.equal(fullAutomation.private_options, "not-public");
  } finally {
    tasks.close(); assert.equal(path.dirname(directory), os.tmpdir()); assert.match(path.basename(directory), /^ox-conversation-summary-/);
    rmSync(directory, { recursive: true, force: true });
  }
});
