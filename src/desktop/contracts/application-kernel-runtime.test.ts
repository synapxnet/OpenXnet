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
