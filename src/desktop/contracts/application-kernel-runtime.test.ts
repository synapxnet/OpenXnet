import assert from "node:assert/strict";
import test from "node:test";

import { parseApplicationKernelCommandRequest } from "./application-kernel-runtime";

test("Kernel command parser normalizes fixed operations and rejects URL-shaped authority", () => {
  assert.deepEqual(parseApplicationKernelCommandRequest({
    operation: "plan-resume",
    payload: {
      planId: "plan-one",
      dryRun: false,
      allowLowRisk: true,
      maxSteps: 3,
      reason: "test_resume",
      runId: "",
    },
  }), {
    operation: "plan-resume",
    payload: {
      planId: "plan-one",
      dryRun: false,
      allowLowRisk: true,
      maxSteps: 3,
      reason: "test_resume",
      runId: "",
    },
  });
  assert.throws(() => parseApplicationKernelCommandRequest({
    operation: "status",
    payload: { url: "/v1/kernel/status" },
  }), /fields/i);
  assert.throws(() => parseApplicationKernelCommandRequest({
    operation: "fetch-url",
    payload: {},
  }), /operation/i);
});

test("Kernel command parser bounds nested execution data before engine activation", () => {
  const parsed = parseApplicationKernelCommandRequest({
    operation: "plan-step-execute",
    payload: {
      planId: "plan-one",
      stepId: "step-one",
      toolParams: { query: "UTF-8 架构", options: ["safe"] },
      approvalId: "",
      reason: "test_execute",
      confirmed: true,
    },
  });
  assert.equal(parsed.payload.planId, "plan-one");
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.payload.toolParams)), { query: "UTF-8 架构", options: ["safe"] });
  assert.throws(() => parseApplicationKernelCommandRequest({
    operation: "trace-detail",
    payload: { traceId: "../private" },
  }), /invalid/i);
  assert.throws(() => parseApplicationKernelCommandRequest({
    operation: "runtime-mode",
    payload: { mode: "root", reason: "x", persist: true, confirmed: true, applyProfile: true },
  }), /mode/i);
});

test("Kernel command parser validates Skill v2 proposal and selection boundaries", () => {
  const selection = parseApplicationKernelCommandRequest({
    operation: "skill-select",
    payload: {
      query: "推荐服务 GPU 队列拥塞恢复",
      environmentScope: "production",
      environmentFingerprint: "prod-v1",
      availableCapabilities: ["metrics.read", "service.verify"],
      topK: 5,
    },
  });
  assert.equal(selection.payload.environmentScope, "production");
  assert.deepEqual(selection.payload.availableCapabilities, ["metrics.read", "service.verify"]);

  const resolution = parseApplicationKernelCommandRequest({
    operation: "skill-change-proposal-resolve",
    payload: {
      proposalId: "proposal-123",
      approved: true,
      actor: "verifier",
      reason: "production evidence passed",
    },
  });
  assert.equal(resolution.payload.approved, true);
  assert.throws(() => parseApplicationKernelCommandRequest({
    operation: "skill-select",
    payload: {
      query: "x",
      environmentScope: "unknown",
      environmentFingerprint: "",
      availableCapabilities: [],
      topK: 5,
    },
  }), /scope/i);
});

test("guidance operations preserve exact long conversation, runtime and idempotency identities", /** 保留完整长身份并扩展固定编辑撤回操作。 / Preserve complete long identities and extend fixed edit/cancel operations. */ () => {
  const conversationId = "会话".repeat(256); const runtimeId = "runtime-1"; const requestId = "request-1";
  assert.deepEqual(parseApplicationKernelCommandRequest({ operation: "guidance-list", payload: { conversationId } }).payload, { conversationId });
  assert.deepEqual(parseApplicationKernelCommandRequest({ operation: "guidance-list", payload: { conversationId, runtimeId } }).payload, { conversationId, runtimeId });
  const add = { conversationId, runtimeId, requestId, turnId: "", traceId: "", text: "补充更详细的验证", mode: "soft", priority: 0 };
  assert.deepEqual(parseApplicationKernelCommandRequest({ operation: "guidance-add", payload: add }).payload, add);
  assert.equal(parseApplicationKernelCommandRequest({ operation: "guidance-add", payload: { ...add, turnId: conversationId, traceId: conversationId } }).payload.turnId, conversationId);
  const mutation = { conversationId, runtimeId, requestId, guidanceId: "guidance-1", expectedRevision: 1 };
  assert.deepEqual(parseApplicationKernelCommandRequest({ operation: "guidance-cancel", payload: mutation }).payload, mutation);
  const edit = { ...mutation, text: "优先解释原因", mode: "constraint", priority: 10 };
  assert.deepEqual(parseApplicationKernelCommandRequest({ operation: "guidance-edit", payload: edit }).payload, edit);
});

test("guidance rejects missing, ambiguous and truncated identities before acquiring authority", /** 所有新身份严格匹配，不使用默认会话或空白别名。 / All identities match strictly, never falling back to default conversations or whitespace aliases. */ () => {
  const mutation = { conversationId: "c1", runtimeId: "r1", requestId: "q1", guidanceId: "g1", expectedRevision: 1 };
  for (const field of ["conversationId", "runtimeId", "requestId", "guidanceId"]) {
    for (const value of [undefined, null, "", " x", "x ", "x\ny", "x\ty", "x".repeat(513)]) {
      assert.throws(/** 校验同一边界的各类无效身份。 / Validate invalid identity forms at the same boundary. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-cancel", payload: { ...mutation, [field]: value } }), /invalid/i);
    }
  }
  assert.throws(/** 查询不得无作用域。 / Queries cannot be unscoped. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-list", payload: { conversationId: "" } }), /invalid/i);
  assert.throws(/** 新增必须提供幂等与运行身份。 / Additions must supply idempotency and runtime identities. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-add", payload: { conversationId: "c1", text: "x", turnId: "", traceId: "", mode: "soft", priority: 0 } }), /invalid/i);
  const add = { conversationId: "c1", runtimeId: "r1", requestId: "q1", text: "x", turnId: "", traceId: "", mode: "soft", priority: 0 };
  for (const field of ["turnId", "traceId"]) {
    assert.throws(/** 可选轮次与追踪身份不能采用空白别名。 / Optional turn and trace identities cannot use whitespace aliases. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-add", payload: { ...add, [field]: " other" } }), /invalid/i);
  }
});

test("guidance edits reject invalid revisions, unbounded content and URL or consume authority", /** 编辑撤回仅允许有界排队内容，不赋予执行与消费权限。 / Edits and cancellation accept bounded queued content without execute or consume authority. */ () => {
  const cancel = { conversationId: "c1", runtimeId: "r1", requestId: "q1", guidanceId: "g1", expectedRevision: 1 };
  const edit = { ...cancel, text: "真实引导", mode: "safety", priority: 10 };
  for (const expectedRevision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", NaN]) {
    assert.throws(/** 版本必须是正安全整数。 / Revisions must be positive safe integers. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-cancel", payload: { ...cancel, expectedRevision } }), /invalid/i);
  }
  for (const patch of [{ text: " " }, { text: "x".repeat(16001) }, { mode: "execute" }, { priority: 101 }, { url: "/private" }, { consume: true }]) {
    assert.throws(/** 拒绝新增权限和超限内容。 / Reject extra authority and oversized content. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-edit", payload: { ...edit, ...patch } }), /invalid/i);
  }
  assert.throws(/** 撤回不能携带替换内容。 / Cancellation cannot carry replacement content. */ () => parseApplicationKernelCommandRequest({ operation: "guidance-cancel", payload: { ...cancel, text: "replacement" } }), /fields/i);
});
