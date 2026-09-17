import assert from "node:assert/strict";
import test from "node:test";

import { FixtureCompetitionToolAdapter, HttpCompetitionToolAdapter, type CompetitionToolAdapterRequest } from "./competition-tool-adapter";

/** 通过公开只读接口获取证据，不预置已修复状态。 / Read evidence through the public adapter without seeding a remediated state. */
async function readFixtureEvidence(
  adapter: FixtureCompetitionToolAdapter,
  toolName: CompetitionToolAdapterRequest["toolName"],
  argumentsValue: Readonly<Record<string, unknown>>,
) {
  return adapter.invoke({ requestId: `summary-${toolName}`, workspaceId: "workspace-summary", incidentId: "incident-summary", traceId: "trace-summary", actorId: "evidence-worker", toolName, arguments: argumentsValue, governance: null });
}

/** 特征漂移的业务预测故障不能被错写成基础设施或副本故障。 / Feature drift degrades predictions without implying infrastructure or replica failures. */
test("Fixture feature drift summaries keep healthy infrastructure separate from degraded predictions", async () => {
  const adapter = new FixtureCompetitionToolAdapter();
  const health = await readFixtureEvidence(adapter, "aiops.service.health", { serviceUid: "service_risk_inference" });
  assert.equal(health.data?.health, "HEALTHY");
  assert.equal(health.data?.errorRate, 0.001);
  assert.equal(health.data?.p95Ms, 95);
  assert.match(health.meta.summary, /基础设施健康/u);
  assert.match(health.meta.summary, /0\.1%/u);
  assert.match(health.meta.summary, /95ms/u);
  assert.doesNotMatch(health.meta.summary, /错误率和延迟异常|服务健康度恢复正常/u);
  const workload = await readFixtureEvidence(adapter, "aiops.k8s.workload.get", { clusterId: "3", namespace: "risk-prod", kind: "Deployment", name: "risk-inference" });
  assert.equal(workload.data?.readyReplicas, 3);
  assert.equal(workload.data?.replicas, 3);
  assert.equal(workload.data?.restartCount, 0);
  assert.match(workload.meta.summary, /3\/3 副本全部就绪，重启 0 次/u);
  assert.doesNotMatch(workload.meta.summary, /存在未就绪副本和重启/u);
  const alert = await readFixtureEvidence(adapter, "aiops.alert.get", { alertUid: "alert_risk_error_rate" });
  assert.equal(alert.data?.status, "FIRING");
  assert.equal(alert.data?.metric, "prediction_error_rate");
  assert.match(alert.meta.summary, /业务预测退化.*18\.4%.*5%/u);
});

/** 容量场景继续保持高延迟与GPU拥塞，但不虚构副本重启。 / Preserve capacity degradation and GPU congestion without inventing replica restarts. */
test("Fixture capacity evidence retains congestion and reports actual workload readiness", async () => {
  const adapter = new FixtureCompetitionToolAdapter();
  const health = await readFixtureEvidence(adapter, "aiops.service.health", { serviceUid: "service_recommendation_inference" });
  assert.equal(health.data?.health, "DEGRADED");
  assert.equal(health.data?.errorRate, 0.05);
  assert.equal(health.data?.p95Ms, 2800);
  assert.equal(health.meta.summary, "服务错误率和延迟异常。");
  const metrics = await readFixtureEvidence(adapter, "aiops.inference.metrics.get", { serviceUid: "service_recommendation_inference", deploymentUid: "deploy_recommendation_prod" });
  assert.equal(metrics.data?.gpuSmUtilization, 1);
  assert.equal(metrics.data?.batchQueueSize, 1000);
  assert.equal(metrics.meta.summary, "GPU 饱和且推理队列严重积压。");
  const workload = await readFixtureEvidence(adapter, "aiops.k8s.workload.get", { clusterId: "3", namespace: "rec-prod", kind: "Deployment", name: "recommendation-inference" });
  assert.equal(workload.data?.readyReplicas, 6);
  assert.equal(workload.data?.replicas, 6);
  assert.equal(workload.data?.restartCount, 0);
  assert.match(workload.meta.summary, /6\/6 副本全部就绪，重启 0 次/u);
});

/** 未处置的健康工具结果也必须报告通过；事件状态不是单项工具结论。 / Healthy tool results must report success even before remediation; incident state is not a tool verdict. */
test("Fixture read summaries follow quality workflow and probe results before remediation", async () => {
  const adapter = new FixtureCompetitionToolAdapter();
  const quality = await readFixtureEvidence(adapter, "dataops.quality.report.get", { reportUid: "qr_quant_latest" });
  assert.equal(quality.data?.status, "PASSED");
  assert.deepEqual(quality.data?.failedRules, []);
  assert.match(quality.meta.summary, /质量报告通过/u);
  const workflow = await readFixtureEvidence(adapter, "dataops.workflow.instance.get", { instanceUid: "workflow_quant_latest" });
  assert.equal(workflow.data?.status, "SUCCEEDED");
  assert.equal(workflow.data?.warning, null);
  assert.doesNotMatch(workflow.meta.summary, /发布了破坏性/u);
  const probe = await readFixtureEvidence(adapter, "mlops.inference.probe", { deploymentUid: "deploy_quant_research", testDatasetRef: "fixture://goai/quant-v1", sampleLimit: 100, timeoutMs: 10000 });
  assert.equal(probe.data?.passed, true);
  assert.equal(probe.meta.summary, "推理探针通过。");
  const driftQuality = await readFixtureEvidence(adapter, "dataops.quality.report.get", { reportUid: "qr_risk_features_120" });
  assert.equal(driftQuality.data?.status, "FAILED");
  assert.match(driftQuality.meta.summary, /维度与空值规则失败/u);
});

test("Fixture competition Adapter rejects stale resource versions", async () => {
  const adapter = new FixtureCompetitionToolAdapter();
  const result = await adapter.invoke({
    requestId: "req-resource-drift",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-resource-drift",
    traceId: "trace-resource-drift",
    actorId: "deployment-operator",
    toolName: "mlops.deployment.rollback",
    arguments: {
      deploymentUid: "deploy_risk_prod",
      targetRevision: 17,
      verificationPolicy: { maxErrorRate: 0.05, maxP95Ms: 300 },
    },
    governance: {
      approvalId: "apr-resource-drift",
      planId: "feature-drift-full-recovery-v2",
      planDigest: "a".repeat(64),
      stepId: "risk-deployment-rollback",
      resourceId: "deploy_risk_prod",
      targetRevision: 17,
      expectedResourceVersion: "41",
      argumentsDigest: "b".repeat(64),
      compensation: true,
      reason: "使用过期资源版本执行回滚。",
      dryRun: false,
      idempotencyKey: "idem-resource-drift",
    },
  });
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "RESOURCE_VERSION_CONFLICT");
  assert.equal(result.error?.retryable, false);
});

test("Fixture competition Adapter exposes verification failure and resets deployment state", async () => {
  const adapter = new FixtureCompetitionToolAdapter();
  await adapter.invoke({
    requestId: "req-rollback",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-failure-demo",
    traceId: "trace-failure-demo",
    actorId: "deployment-operator",
    toolName: "mlops.deployment.rollback",
    arguments: {
      deploymentUid: "deploy_risk_prod",
      targetRevision: 17,
      verificationPolicy: { maxErrorRate: 0.05, maxP95Ms: 300 },
    },
    governance: {
      approvalId: "apr-failure-demo",
      planId: "feature-drift-full-recovery-v2",
      planDigest: "a".repeat(64),
      stepId: "risk-deployment-rollback",
      resourceId: "deploy_risk_prod",
      targetRevision: 17,
      expectedResourceVersion: "42",
      argumentsDigest: "b".repeat(64),
      compensation: true,
      reason: "执行验证失败演示。",
      dryRun: false,
      idempotencyKey: "idem-failure-demo",
    },
  });
  const failedProbe = await adapter.invoke({
    requestId: "req-failed-probe",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-failure-demo",
    traceId: "trace-failure-demo",
    actorId: "independent-verifier",
    toolName: "mlops.inference.probe",
    arguments: {
      deploymentUid: "deploy_risk_prod",
      testDatasetRef: "fixture://goai/verification-failure-v1",
      sampleLimit: 100,
      timeoutMs: 10_000,
    },
    governance: null,
  });
  assert.equal(failedProbe.data?.passed, false);
  assert.equal(failedProbe.meta.summary, "推理探针确认输入契约不匹配。");
  adapter.resetDemoState();
  const resetDeployment = await adapter.invoke({
    requestId: "req-reset-state",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-reset-state",
    traceId: "trace-reset-state",
    actorId: "evidence-agent",
    toolName: "mlops.deployment.get",
    arguments: { deploymentUid: "deploy_risk_prod", includeRevisions: true },
    governance: null,
  });
  assert.equal(resetDeployment.data?.activeRevision, 18);
  assert.equal(resetDeployment.meta.resourceVersion, "42");
});

test("Live competition Adapter redacts accidental upstream credentials", async () => {
  let capturedHeaders = new Headers();
  const adapter = new HttpCompetitionToolAdapter({
    resolveEndpoint: async () => "https://aiops.example.test/",
    resolveDelegationToken: async () => "internal-delegation-token",
    fetchResource: async (_input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({
      success: true,
      data: {
        status: "FIRING",
        apiKey: "upstream-api-key",
        nested: { password: "upstream-password", note: "Bearer upstream-token" },
      },
      error: null,
      meta: {
        requestId: "req-redaction",
        workspaceId: "ws_goai_demo",
        incidentId: "inc-redaction",
        traceId: "trace-redaction",
        toolName: "aiops.alert.get",
        contractVersion: "1.0.0",
        durationMs: 12,
        source: "XnetAIops/mon",
        evidenceId: "ev-redaction",
        resourceVersion: "18",
        observedAt: "2026-08-03T02:00:00.000Z",
        summary: "token=upstream-token Bearer upstream-token",
      },
      auditReceipt: null,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = await adapter.invoke({
    requestId: "req-redaction",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-redaction",
    traceId: "trace-redaction",
    actorId: "actor-redaction",
    toolName: "aiops.alert.get",
    arguments: { alertUid: "alert-risk" },
    governance: null,
  });
  assert.notEqual(result.data, null);
  if (result.data === null) throw new Error("Expected successful structured data.");
  assert.equal(result.data.apiKey, "[redacted]");
  assert.deepEqual(result.data.nested, { password: "[redacted]", note: "Bearer [redacted]" });
  assert.equal(result.meta.summary.includes("upstream-token"), false);
  assert.equal(result.meta.contractVersion, "1.0.0");
  assert.equal(result.meta.durationMs, 12);
  assert.equal(result.meta.source, "XnetAIops/mon");
  assert.equal(result.meta.evidenceId, "ev-redaction");
  assert.equal(capturedHeaders.get("Idempotency-Key"), "req-redaction");
});

test("Live competition Adapter preserves structured platform errors with nullable evidence metadata", async () => {
  const adapter = new HttpCompetitionToolAdapter({
    resolveEndpoint: async () => "https://aiops.example.test/",
    fetchResource: async () => new Response(JSON.stringify({
      success: false,
      data: null,
      error: {
        code: "APPROVAL_REQUIRED",
        message: "写操作缺少完整计划级审批范围",
        retryable: false,
        details: {},
      },
      meta: {
        requestId: "req-approval-error",
        workspaceId: "ws_goai_demo",
        incidentId: "inc-approval-error",
        traceId: "trace-approval-error",
        toolName: "aiops.gpu.capacity.ensure",
        contractVersion: "1.0.0",
        durationMs: 0,
        source: "agent-contract",
        evidenceId: null,
        resourceVersion: null,
        observedAt: "2026-08-03T02:00:00.000Z",
        summary: "写操作缺少完整计划级审批范围",
      },
      auditReceipt: null,
    }), { status: 403, headers: { "Content-Type": "application/json" } }),
  });

  const result = await adapter.invoke({
    requestId: "req-approval-error",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-approval-error",
    traceId: "trace-approval-error",
    actorId: "enterprise-goai:operator",
    toolName: "aiops.gpu.capacity.ensure",
    arguments: { clusterId: "3", nodePool: "gpu-prewarmed", desiredGpuNodes: 4, mode: "ENSURE" },
    governance: {
      approvalId: "apr-approval-error",
      planId: "recommendation-capacity-recovery-v2",
      planDigest: "a".repeat(64),
      stepId: "gpu-capacity-ensure",
      resourceId: "3/gpu-prewarmed",
      targetRevision: 4,
      expectedResourceVersion: "42",
      argumentsDigest: "b".repeat(64),
      compensation: false,
      reason: "审批信息缺失测试。",
      dryRun: true,
      idempotencyKey: "idem-approval-error",
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "APPROVAL_REQUIRED");
  assert.equal(result.meta.evidenceId, undefined);
});

test("Live competition Adapter authenticates and validates remote action completion", async () => {
  let capturedHeaders = new Headers();
  const adapter = new HttpCompetitionToolAdapter({
    resolveEndpoint: async () => "https://mlops.example.test/",
    resolveDelegationToken: async () => "delegation-token",
    fetchResource: async (_input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({
        actionId: "act_12345678",
        deploymentUid: "deploy_risk_prod",
        fromRevision: 18,
        targetRevision: 17,
        status: "SUCCEEDED",
        stage: "FINALIZING",
        dryRun: false,
        errorCode: null,
        errorMessage: null,
        startedAt: "2026-08-03T08:00:00Z",
        completedAt: "2026-08-03T08:00:02Z",
      }), { status: 200 });
    },
  });

  const state = await adapter.waitForAction({
    requestId: "req-action",
    workspaceId: "ws_goai_demo",
    incidentId: "inc-action",
    traceId: "trace-action",
    actorId: "operator",
    toolName: "mlops.deployment.rollback",
    arguments: {
      deploymentUid: "deploy_risk_prod",
      targetRevision: 17,
      verificationPolicy: { maxErrorRate: 0.05, maxP95Ms: 300 },
    },
    governance: {
      approvalId: "apr-action",
      planId: "feature-drift-full-recovery-v2",
      planDigest: "a".repeat(64),
      stepId: "risk-deployment-rollback",
      resourceId: "deploy_risk_prod",
      targetRevision: 17,
      expectedResourceVersion: "42",
      argumentsDigest: "b".repeat(64),
      compensation: true,
      reason: "批准回滚。",
      dryRun: false,
      idempotencyKey: "idem-action",
    },
  }, "act_12345678");

  assert.equal(state.status, "SUCCEEDED");
  assert.equal(capturedHeaders.get("X-OpenXnet-Tool-Name"), "mlops.deployment.rollback");
  assert.equal(capturedHeaders.get("Idempotency-Key"), "req-action:action");
});
