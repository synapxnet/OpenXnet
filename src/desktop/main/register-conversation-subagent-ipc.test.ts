/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
子智能体只读隔离边界回归 / Subagent read-only isolation boundary regressions.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ApplicationTask, ApplicationTaskDetail } from "../contracts/application-tasks";
import type { IpcMainLike } from "./register-core-ipc";
import { CONVERSATION_SUBAGENT_CHANNEL, registerConversationSubagentIpc } from "./register-conversation-subagent-ipc";

/** 创建真实临时目录与只读持久任务替身。 / Create actual temporary directories and read-only durable task substitutes. */
async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ox-agent-transcript-"));
  const workspace = path.join(directory, "workspace"); const outside = path.join(directory, "outside");
  await mkdir(workspace); await mkdir(outside);
  const handlers = new Map<string, (event: unknown, value: unknown) => unknown>();
  const ipcMain: IpcMainLike = {
    /** 注册测试调用入口。 / Register a test invocation entry. */
    handle(channel, listener) { handlers.set(channel, listener as unknown as (event: unknown, value: unknown) => unknown); },
    /** 删除测试调用入口。 / Remove a test invocation entry. */
    removeHandler(channel) { handlers.delete(channel); },
  };
  const task = { id: "79a22e59-a0ec-4774-965f-639004d48849", legacyTaskId: "actual-child", workspacePath: workspace,
    deletedAt: null, details: { context: { origin_conversation_id: "conversation-one", system_prompt: "never expose",
      agent_transcript: { schema: "openxnet.agent-transcript.v1", task_id: "actual-child", parent_task_id: "actual-parent", session_id: "actual-run",
        messages: [{ id: "delegation", kind: "delegation", content: "Actual delegated input", created_at: "2026-09-14T10:00:00Z" },
          { id: "reply", kind: "assistant", content: "Visible<think>hidden reasoning</think> reply", status: "done", settings: { password: "never expose" } }], truncated: false } } } } as unknown as ApplicationTask;
  const state = { workspace, task, refreshTask: task, refreshCount: 0, listCount: 0, mutateOnRefresh: null as (() => void) | null };
  const unregister = registerConversationSubagentIpc({ ipcMain,
    /** 拒绝非主窗口调用。 / Reject calls outside the main window. */ authorizeEvent(event) { if (event !== "trusted") throw new Error("untrusted sender"); },
    /** 提供Main当前工作区。 / Supply Main's current workspace. */ getWorkspacePath() { return state.workspace; },
    /** 仅读取限定工作区任务目录。 / Read only the workspace task catalog. */ async listTasks(request) {
      state.listCount += 1; assert.equal(path.normalize(request.workspacePath).toLowerCase(), workspace.toLowerCase());
      return { schema: "openxnet.application-tasks.v1", catalogRevision: 1, generatedAt: "now", tasks: [state.task] };
    },
    /** 返回Core任务而不执行它。 / Return the Core task without executing it. */ async getTask(request) {
      assert.equal(request.taskId, task.id); return { task: state.task, events: [], schema: "openxnet.application-tasks.v1" } as ApplicationTaskDetail;
    },
    /** 只刷新同一任务并允许模拟竞态。 / Refresh the same task only and allow simulated races. */ async refreshTask(request) {
      state.refreshCount += 1; assert.equal(request.taskId, task.id); state.mutateOnRefresh?.(); return { task: state.refreshTask };
    },
  });
  return { state, task, outside,
    /** 调用真实IPC处理器。 / Invoke the actual IPC handler. */ async read(value: unknown = { taskId: "actual-child", conversationId: "conversation-one" }, event = "trusted") {
      return await handlers.get(CONVERSATION_SUBAGENT_CHANNEL)!(event, value) as { taskId: string; conversationId: string; transcript: Record<string, unknown> | null };
    },
    /** 仅清理本测试明确创建的目录。 / Clean up only the directory explicitly created by this test. */ async close() {
      unregister(); assert.equal(handlers.size, 0); assert.equal(path.dirname(directory), os.tmpdir()); assert.match(path.basename(directory), /^ox-agent-transcript-/);
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("scoped reads resolve actual task IDs and return only visible allowlisted records", /** 验证真实身份及公开字段。 / Verify actual identities and public fields. */ async () => {
  const f = await fixture(); try {
    const first = await f.read(); const second = await f.read({ taskId: f.task.id, conversationId: "conversation-one" });
    assert.equal(first.taskId, "actual-child"); assert.deepEqual(first, second);
    const encoded = JSON.stringify(first); assert.match(encoded, /Actual delegated input/); assert.match(encoded, /Visible reply/);
    assert.doesNotMatch(encoded, /hidden reasoning|never expose|settings|system_prompt|consensus/);
    assert.equal(f.state.refreshCount, 2);
  } finally { await f.close(); }
});

test("untrusted callers invalid requests and substituted conversation IDs fail before refresh", /** 阻止伪造调用方和会话。 / Block forged callers and conversations. */ async () => {
  const f = await fixture(); try {
    await assert.rejects(f.read(undefined, "untrusted"), /untrusted/); assert.equal(f.state.listCount, 0);
    for (const value of [null, {}, { taskId: "actual-child", conversationId: "other-conversation" }, { taskId: "other-task", conversationId: "conversation-one" },
      { taskId: "actual-child", conversationId: "conversation-one", workspacePath: f.outside }, { taskId: "actual-child", conversationId: "conversation-one\n" }]) await assert.rejects(f.read(value));
    assert.equal(f.state.refreshCount, 0);
  } finally { await f.close(); }
});

test("unbound historical tasks and other-workspace tasks never reach the Worker", /** 旧任务无归属时拒绝而非猜测。 / Reject unbound historical tasks rather than guessing ownership. */ async () => {
  const f = await fixture(); try {
    f.state.task = { ...f.task, details: { context: {} } }; await assert.rejects(f.read());
    f.state.task = { ...f.task, workspacePath: f.outside }; await assert.rejects(f.read());
    f.state.task = { ...f.task, deletedAt: "2026-09-14T00:00:00Z" }; await assert.rejects(f.read());
    assert.equal(f.state.refreshCount, 0);
  } finally { await f.close(); }
});

test("workspace ownership and identity changes during refresh are rejected", /** 在异步读取后再次检查安全边界。 / Recheck boundaries after asynchronous reads. */ async () => {
  const f = await fixture(); try {
    f.state.refreshTask = { ...f.task, details: { context: { origin_conversation_id: "other-conversation" } } }; await assert.rejects(f.read());
    f.state.refreshTask = { ...f.task, legacyTaskId: "substituted-task" }; await assert.rejects(f.read());
    f.state.refreshTask = f.task; f.state.mutateOnRefresh = /** 模拟读取中切换工作区。 / Simulate a workspace switch during the read. */ () => { f.state.workspace = f.outside; }; await assert.rejects(f.read());
  } finally { await f.close(); }
});

test("missing or mismatched transcript reports absence without exposing legacy history", /** 不把旧摘要伪造为双方对话。 / Do not fabricate bilateral conversations from legacy summaries. */ async () => {
  const f = await fixture(); try {
    f.state.refreshTask = { ...f.task, details: { context: { origin_conversation_id: "conversation-one", history: ["old raw secret"] } } };
    assert.equal((await f.read()).transcript, null);
    f.state.refreshTask = { ...f.task, details: { context: { origin_conversation_id: "conversation-one", agent_transcript: { schema: "openxnet.agent-transcript.v1", task_id: "other-child", messages: [] } } } };
    assert.equal((await f.read()).transcript, null);
  } finally { await f.close(); }
});

test("public projection drops private roles and redacts credentials before bounding Unicode", /** 私有角色和凭据不得进入公开回执。 / Private roles and credentials cannot enter public records. */ async () => {
  const f = await fixture(); try {
    f.state.refreshTask = { ...f.task, details: { context: { origin_conversation_id: "conversation-one", agent_transcript: {
      schema: "openxnet.agent-transcript.v1", task_id: "actual-child", messages: [
        { kind: "system", content: "private system message" }, { kind: "analysis", content: "private analysis" },
        { id: "tool", kind: "tool_receipt", content: 'password="actual-secret" api_key=actual-key Bearer abc.def.ghi', status: "error", tool_name: "actual-tool" },
        { id: "large", kind: "assistant", content: "🙂".repeat(60_000) },
      ],
    } } } };
    const response = await f.read(); const encoded = JSON.stringify(response);
    assert.doesNotMatch(encoded, /private|actual-secret|actual-key|abc.def.ghi/); assert.match(encoded, /redacted/);
    assert.equal(response.transcript?.truncated, true); assert.ok(Buffer.byteLength(encoded, "utf8") < 96 * 1024);
  } finally { await f.close(); }
});
