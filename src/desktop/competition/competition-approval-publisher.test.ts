import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationCompetitionApproval } from "../contracts/application-competition-runtime";
import { HttpCompetitionApprovalPublisher } from "./competition-approval-publisher";

/** 创建已通过、范围固定的测试审批。 */
function approvedRecord(): ApplicationCompetitionApproval {
  return {
    approvalId: "apr_goai_approved",
    workspaceId: "ws_goai_demo",
    incidentId: "inc_goai_demo",
    traceId: "trace_goai_demo",
    toolName: "mlops.feature.fallback.apply",
    resourceId: "deploy_risk_prod/feature-set",
    targetRevision: 18,
    expectedResourceVersion: "42",
    argumentsDigest: "a".repeat(64),
    planId: "feature-drift-full-recovery-v2",
    planDigest: "b".repeat(64),
    scopes: [{
      stepId: "fallback-feature-apply",
      toolName: "mlops.feature.fallback.apply",
      resourceId: "deploy_risk_prod/feature-set",
      targetRevision: 18,
      expectedResourceVersion: "42",
      argumentsDigest: "c".repeat(64),
      compensation: false,
    }, {
      stepId: "risk-deployment-rollback",
      toolName: "mlops.deployment.rollback",
      resourceId: "deploy_risk_prod",
      targetRevision: 17,
      expectedResourceVersion: "42",
      argumentsDigest: "d".repeat(64),
      compensation: true,
    }],
    reason: "回滚到已验证修订。",
    status: "APPROVED",
    requestedBy: "investigator",
    requestedAt: "2026-08-03T08:00:00.000Z",
    decidedBy: "approver",
    decidedAt: "2026-08-03T08:01:00.000Z",
    decisionReason: "批准。",
  };
}

test("competition approval publisher sends a bounded authenticated attestation", async () => {
  let capturedUrl = "";
  let capturedAuthorization = "";
  let capturedBody: Record<string, unknown> = {};
  const publisher = new HttpCompetitionApprovalPublisher({
    resolveEndpoint: async () => "https://goai.example.test/openxnet-approval/",
    resolveIssuerToken: async () => "issuer-token-with-at-least-thirty-two-characters",
    now: () => new Date("2026-08-03T08:02:00.000Z"),
    fetchResource: async (input, init) => {
      capturedUrl = String(input);
      capturedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    },
  });

  await publisher.publish(approvedRecord());

  assert.equal(capturedUrl, "https://goai.example.test/openxnet-approval/api/v1/approvals/apr_goai_approved");
  assert.match(capturedAuthorization, /^Bearer /u);
  assert.equal(capturedBody.workspaceId, "ws_goai_demo");
  assert.equal(capturedBody.resourceId, "deploy_risk_prod/feature-set");
  assert.equal(capturedBody.traceId, "trace_goai_demo");
  assert.equal(capturedBody.planId, "feature-drift-full-recovery-v2");
  assert.equal(Array.isArray(capturedBody.scopes), true);
  assert.equal((capturedBody.scopes as readonly Record<string, unknown>[]).length, 2);
  assert.equal((capturedBody.scopes as readonly Record<string, unknown>[])[1]?.compensation, true);
  assert.equal(capturedBody.requesterId, "investigator");
  assert.equal(capturedBody.approverId, "approver");
  assert.equal(JSON.stringify(capturedBody).includes("issuer-token"), false);
});
