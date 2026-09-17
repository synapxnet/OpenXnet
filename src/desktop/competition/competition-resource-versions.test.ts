// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
/**
 * 逐资源审批版本回归 / Per-resource approval version regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15 | Version: 1.0.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ApplicationCompetitionScenarioContext, ApplicationCompetitionSnapshot } from "../contracts/application-competition-runtime";
import { ApplicationCompetitionRuntimeError, ApplicationCompetitionRuntimeService } from "./application-competition-runtime";
import { bindCompetitionResourceVersions, collectCompetitionResourceVersions } from "./competition-resource-versions";
import { getCompetitionScenarioProfile } from "./competition-scenario-registry";
import { FixtureCompetitionToolAdapter, HttpCompetitionToolAdapter, type CompetitionToolAdapterRequest, type CompetitionToolAdapterResponse } from "./competition-tool-adapter";
import { getCompetitionToolDescriptor, type CompetitionToolName } from "./competition-tool-registry";

const scenario: ApplicationCompetitionScenarioContext = {
  scenarioType: "recommendation-capacity", alertUid: "alert_rec", serviceUid: "service_rec_inference",
  clusterId: "3", namespace: "recommendation-prod", workloadName: "recommendation-inference",
  reportUid: "report_rec", assetUid: "asset_rec", workflowInstanceUid: "task_rec",
  deploymentUid: "deploy_recommendation_prod", failingRevision: 6, targetRevision: 8,
  expectedResourceVersion: "42", testDatasetRef: "contract-test://recommendation",
};
const aiopsVersions = {
  "3/gpu-prewarmed": "44", "deploy_recommendation_prod/runtime": "44",
  "3/recommendation-prod/recommendation-inference": "45", "service_rec_inference/traffic": "43",
  "3/recommendation-prod/recommendation-inference/autoscaling": "43",
};

/** 创建无网络的明确测试响应。 / Build an explicit offline contract-test response. */
function sample(toolName: CompetitionToolName, resourceVersions: unknown): CompetitionToolAdapterResponse {
  return {
    success: true, error: null, data: { resourceVersions },
    meta: { requestId: "test", workspaceId: "test", incidentId: "test", traceId: "test", toolName,
      contractVersion: "1.0.0", durationMs: 0, source: "contract-test-only",
      platform: getCompetitionToolDescriptor(toolName).platform, resourceVersion: "42",
      observedAt: "2026-09-15T00:00:00.000Z", summary: "Contract test only" },
  };
}

/** 独立资源基线、重复写与补偿版本应保持固定。 / Distinct baselines, repeated writes, and compensation versions must stay fixed. */
test("binds distinct recommendation resources and full-plan compensation without mutating legacy input", () => {
  const original = getCompetitionScenarioProfile(scenario);
  const bound = bindCompetitionResourceVersions(original, { aiops: aiopsVersions });
  assert.deepEqual(bound.executionPlan.steps.map((step) => step.expectedResourceVersion), ["44", "44", "45", "43", "43", "46", "45"]);
  assert.deepEqual(bound.executionPlan.compensationSteps.map((step) => step.expectedResourceVersion), ["47", "45"]);
  assert.equal(original.executionPlan.steps[0]?.expectedResourceVersion, "42");
  assert.equal(bindCompetitionResourceVersions(original, undefined), original);
});

/** 同名资源按平台隔离，质量门不消耗版本。 / Separate identical resource names by platform; read gates do not consume versions. */
test("namespaces platforms and leaves quality-gate versions unchanged", () => {
  const profile = getCompetitionScenarioProfile({ ...scenario, scenarioType: "feature-drift" });
  const base = profile.executionPlan.steps[0]!;
  const bound = bindCompetitionResourceVersions({ ...profile, executionPlan: { ...profile.executionPlan,
    steps: [
      { ...base, resourceId: "same", toolName: "dataops.training.dataset.build", kind: "WRITE" },
      { ...base, resourceId: "same", toolName: "dataops.dataset.validation.get", kind: "QUALITY_GATE" },
      { ...base, resourceId: "same", toolName: "dataops.training.dataset.build", kind: "WRITE" },
      { ...base, resourceId: "same", toolName: "mlops.training.search.start", kind: "WRITE" },
    ], compensationSteps: [],
  } }, { dataops: { same: "60" }, mlops: { same: "80" } });
  assert.deepEqual(bound.executionPlan.steps.map((step) => step.expectedResourceVersion), ["60", "61", "61", "80"]);
  assert.equal(profile.executionPlan.steps.find((step) => step.stepId === "repaired-dataset-gate")?.resourceId, "asset_rec/backfill");
});

/** 聚合只信任工具描述符的平台身份。 / Collection trusts the tool descriptor's platform identity only. */
test("collects version evidence by actual platform and rejects conflicting or malformed maps", () => {
  const aiops = sample("aiops.inference.metrics.get", { same: "44" });
  const dataops = sample("dataops.workflow.instance.get", { same: "60" });
  const collected = collectCompetitionResourceVersions([
    { toolName: aiops.meta.toolName, response: { ...aiops, meta: { ...aiops.meta, platform: "mlops" } } },
    { toolName: dataops.meta.toolName, response: dataops },
  ]);
  assert.equal(collected.aiops?.same, "44");
  assert.equal(collected.dataops?.same, "60");
  assert.equal(collected.mlops, undefined);
  assert.throws(() => collectCompetitionResourceVersions([
    { toolName: aiops.meta.toolName, response: aiops },
    { toolName: aiops.meta.toolName, response: sample(aiops.meta.toolName, { same: "45" }) },
  ]), /conflicting/u);
  for (const invalid of [null, [], "42", { same: 42 }, { same: "0" }, { same: "01" }, { same: "-1" },
    { same: "1.5" }, { same: "9007199254740991" }, { "bad resource": "42" }, JSON.parse('{"__proto__":"42"}')]) {
    assert.throws(() => collectCompetitionResourceVersions([{ toolName: aiops.meta.toolName, response: sample(aiops.meta.toolName, invalid) }]), TypeError);
  }
  assert.throws(() => bindCompetitionResourceVersions(getCompetitionScenarioProfile(scenario), {}), /missing/u);
  assert.throws(() => bindCompetitionResourceVersions(getCompetitionScenarioProfile(scenario), { aiops: { ...aiopsVersions, "3/gpu-prewarmed": "invalid" } }), TypeError);
});

type ContractFault = "none" | "missing" | "missing-target" | "conflict" | "scope" | "write-version";

/** 运行真实控制面配合离线合同适配器；不作为 Live 验收。 / Run the production control plane with an offline contract adapter, never as Live acceptance. */
function contractRuntime(directory: string, fault: ContractFault = "none") {
  const fixture = new FixtureCompetitionToolAdapter();
  const calls: CompetitionToolName[] = [];
  const runtime = new ApplicationCompetitionRuntimeService({
    userDataDirectory: directory, fixtureAdapter: fixture,
    /** 单元测试的无网络审批发布替身。 / Offline approval publisher for unit tests only. */
    async publishApproval() {},
    liveAdapter: {
      /** 保留调用作用域并仅替换测试版本响应。 / Preserve invocation scope and replace only test version evidence. */
      async invoke(request) {
        calls.push(request.toolName);
        const response = await fixture.invoke(request);
        if (fault === "write-version" && request.governance !== null) {
          return { ...response, success: true, error: null, data: { status: "SUCCEEDED" }, meta: { ...response.meta, resourceVersion: "1" } };
        }
        let versions: Record<string, string> | undefined;
        if (request.toolName === "aiops.inference.metrics.get" && fault !== "missing") {
          versions = { ...aiopsVersions };
          if (fault === "missing-target") delete versions["3/gpu-prewarmed"];
        }
        if (fault === "conflict" && request.toolName === "aiops.service.health") versions = { "3/gpu-prewarmed": "99" };
        return { ...response, data: { ...response.data, ...(versions ? { resourceVersions: versions } : {}) },
          meta: { ...response.meta, ...(fault === "scope" ? { traceId: "another-trace" } : {}) } };
      },
    },
  });
  return { runtime, calls };
}

/** 缺失、冲突或跨追踪版本必须在审批之前拒绝。 / Reject missing, conflicting, or cross-trace versions before approval. */
for (const fault of ["missing", "missing-target", "conflict", "scope"] as const) {
  /** 失败仅保留调查读取且不生成写权限。 / Failure preserves investigation reads without creating write authorization. */
  test(`Live branch refuses ${fault} resource evidence before any approval or write`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "goai-version-reject-"));
    try {
      const { runtime, calls } = contractRuntime(directory, fault);
      await runtime.setAdapterMode({ mode: "live" });
      const created = await runtime.createIncident({ workspaceId: "contract_test", title: "Contract test", summary: "No network", severity: "P1", actorId: "requester", scenario });
      await assert.rejects(runtime.runInvestigation({ incidentId: created.incidentId, actorId: "requester", teamRuntime: "builtin" }),
        /** 断言精确领域错误，不吞掉其他异常。 / Assert the exact domain error without swallowing unrelated exceptions. */
        (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "RESOURCE_VERSION_EVIDENCE_INVALID");
      const snapshot = await runtime.getSnapshot();
      assert.equal(calls.length, 6);
      assert.equal(calls.every((name) => !getCompetitionToolDescriptor(name).requiresApproval), true);
      assert.equal(snapshot.approvals.length, 0);
      assert.equal(snapshot.actions.length, 0);
      assert.equal(snapshot.incidents[0]?.status, "FAILED");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}

/** 新版审批重启后仍保留实际版本，篡改不能进入执行。 / Actual versions persist across restart and tampering cannot enter execution. */
test("Live branch persists version scopes, rejects renderer injection and detects approved-map tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "goai-version-persist-"));
  try {
    const { runtime } = contractRuntime(directory);
    const request = { workspaceId: "contract_test", title: "Contract test", summary: "No network", severity: "P1", actorId: "requester", scenario };
    await assert.rejects(runtime.createIncident({ ...request, scenario: { ...scenario, governedResourceVersions: { aiops: aiopsVersions } } }), TypeError);
    await runtime.setAdapterMode({ mode: "live" });
    const created = await runtime.createIncident(request);
    const investigated = await runtime.runInvestigation({ incidentId: created.incidentId, actorId: "requester", teamRuntime: "builtin" });
    assert.deepEqual(investigated.snapshot.approvals[0]?.scopes.map((scope) => scope.expectedResourceVersion), ["44", "44", "45", "43", "43", "46", "45", "47", "45"]);
    const { runtime: restarted, calls } = contractRuntime(directory);
    const persisted = await restarted.getSnapshot();
    assert.deepEqual(persisted.incidents[0]?.scenario.governedResourceVersions?.aiops, aiopsVersions);
    await assert.rejects(restarted.setAdapterMode({ mode: "fixture" }),
      /** 活跃审批不能换到另一个适配器。 / Active approval cannot switch to another adapter. */
      (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "ADAPTER_MODE_IN_USE");
    assert.equal((await restarted.setAdapterMode({ mode: "live" })).adapterMode, "live");
    const approvalId = investigated.approvalId!;
    await restarted.decideApproval({ approvalId, actorId: "reviewer", decision: "APPROVED", reason: "Contract test only" });
    const filename = path.join(directory, "competition", "control-plane.v1.json");
    const raw = JSON.parse(await readFile(filename, "utf8"));
    const legacy = structuredClone(raw);
    delete legacy.incidents[0].scenario.governedResourceVersions;
    await writeFile(filename, JSON.stringify(legacy));
    await assert.rejects(restarted.executeRollback({ approvalId, actorId: "executor", idempotencyKey: "contract-legacy", dryRun: false }),
      /** 旧 Live 审批须重新取得逐资源证据。 / Legacy Live approval must collect fresh per-resource evidence. */
      (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "RESOURCE_VERSION_EVIDENCE_INVALID");
    raw.incidents[0].scenario.governedResourceVersions.aiops["3/gpu-prewarmed"] = "99";
    await writeFile(filename, JSON.stringify(raw));
    await assert.rejects(restarted.executeRollback({ approvalId, actorId: "executor", idempotencyKey: "contract-tamper", dryRun: false }),
      /** 保持固定审批摘要，拒绝悄然换版。 / Preserve the fixed approval digest and reject silent version replacement. */
      (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "APPROVAL_SCOPE_MISMATCH");
    assert.equal(calls.length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

/** 前置知识读取尚未完成时也不能悄然换平台。 / Platform switching is blocked even before preliminary knowledge retrieval completes. */
test("investigation protects its adapter mode before the first persisted trace", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "goai-version-prepare-"));
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>(/** 暂停明确的前置读取窗口。 / Pause the precise preliminary-read window. */ resolve => { release = resolve; });
  const observed = new Promise<void>(/** 通知前置读取已经开始。 / Signal that preliminary retrieval has started. */ resolve => { entered = resolve; });
  let investigation: ReturnType<ApplicationCompetitionRuntimeService["runInvestigation"]> | undefined;
  try {
    const fixture = new FixtureCompetitionToolAdapter();
    const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: fixture, liveAdapter: fixture,
      /** 用无网络屏障复现模式竞争窗口。 / Reproduce the mode race with an offline barrier. */
      async retrieveCompetitionKnowledge() { entered(); await pending; return []; },
    });
    const created = await runtime.createIncident({ workspaceId: "contract_test", title: "Contract test", summary: "No network", severity: "P1", actorId: "requester", scenario });
    investigation = runtime.runInvestigation({ incidentId: created.incidentId, actorId: "requester", teamRuntime: "builtin" });
    await observed;
    assert.equal((await runtime.getSnapshot()).traces.length, 0);
    await assert.rejects(runtime.setAdapterMode({ mode: "live" }),
      /** 首个Trace之前仍受相同环境约束。 / The same environment constraint applies before the first trace. */
      (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "ADAPTER_MODE_IN_USE");
    release();
    const result = await investigation;
    assert.equal(result.snapshot.adapterMode, "fixture");
    assert.equal(result.snapshot.approvals.length, 1);
  } finally {
    release();
    await investigation?.catch(/** 清理前等待可能的失败调用结束。 / Await a possibly failed call before cleanup. */ () => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

/** 成功状态却返回倒退版本时，不得记录步骤成功。 / A success flag with a regressed version must not complete a step. */
test("Live execution rejects a false successful version receipt and never records successful writes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "goai-version-write-"));
  try {
    const { runtime } = contractRuntime(directory, "write-version");
    await runtime.setAdapterMode({ mode: "live" });
    const created = await runtime.createIncident({ workspaceId: "contract_test", title: "Contract test", summary: "No network", severity: "P1", actorId: "requester", scenario });
    const investigated = await runtime.runInvestigation({ incidentId: created.incidentId, actorId: "requester", teamRuntime: "builtin" });
    const approvalId = investigated.approvalId!;
    await runtime.decideApproval({ approvalId, actorId: "reviewer", decision: "APPROVED", reason: "Contract test only" });
    await assert.rejects(runtime.executeRollback({ approvalId, actorId: "executor", idempotencyKey: "contract-write-version", dryRun: false }),
      /** 精确识别不可信版本回执。 / Identify the untrusted version receipt precisely. */
      (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "RESOURCE_VERSION_RECEIPT_INVALID");
    const snapshot = await runtime.getSnapshot();
    assert.equal(snapshot.actions[0]?.status, "FAILED");
    assert.equal(snapshot.actions[0]?.steps.some((step) => step.status === "SUCCEEDED"), false);
    assert.equal(snapshot.auditReceipts.some((receipt) => receipt.outcome === "SUCCEEDED"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

/** 审计主体、审批和版本必须来自同一次真实写响应。 / Audit identities, approval and versions must belong to the same write response. */
test("HTTP adapter validates upstream governed audit scope and version transitions", async () => {
  const step = getCompetitionScenarioProfile(scenario).executionPlan.steps[0]!;
  const request: CompetitionToolAdapterRequest = { requestId: "test-request", workspaceId: "test-workspace", incidentId: "test-incident", traceId: "test-trace", actorId: "test-executor", toolName: step.toolName, arguments: step.arguments,
    governance: { approvalId: "test-approval", planId: "test-plan", planDigest: "a".repeat(64), stepId: step.stepId, resourceId: step.resourceId, targetRevision: step.targetRevision, expectedResourceVersion: "44", argumentsDigest: "b".repeat(64), compensation: false, reason: "Contract test only", dryRun: false, idempotencyKey: "test-key" },
  };
  const base = { ...sample(request.toolName, {}), meta: { ...sample(request.toolName, {}).meta, requestId: request.requestId, workspaceId: request.workspaceId, incidentId: request.incidentId, traceId: request.traceId, resourceVersion: "45" },
    auditReceipt: { requestId: request.requestId, workspaceId: request.workspaceId, incidentId: request.incidentId, traceId: request.traceId, toolName: request.toolName, actorId: request.actorId, approverId: "test-reviewer", approvalId: "test-approval", requestDigest: "b".repeat(64), beforeResourceVersion: "44", afterResourceVersion: "45", actionStatus: "SUCCEEDED" },
  };
  for (const fault of ["none", "missing", "scope", "digest", "before", "after", "jump", "actor", "status"] as const) {
    const value = structuredClone(base);
    if (fault === "scope") value.auditReceipt.traceId = "other-trace";
    if (fault === "digest") value.auditReceipt.requestDigest = "c".repeat(64);
    if (fault === "before") value.auditReceipt.beforeResourceVersion = "1";
    if (fault === "after") value.auditReceipt.afterResourceVersion = "1";
    if (fault === "jump") value.meta.resourceVersion = value.auditReceipt.afterResourceVersion = "46";
    if (fault === "actor") value.auditReceipt.approverId = request.actorId;
    if (fault === "status") value.auditReceipt.actionStatus = "FAILED";
    const adapter = new HttpCompetitionToolAdapter({
      /** 无网络测试域名。 / Offline test hostname. */
      resolveEndpoint: async () => "https://contract.example.test/",
      /** 无效测试凭据仅用于无网络替身。 / Dummy credentials only for the offline substitute. */
      resolveDelegationToken: async () => "contract-test-only",
      /** 返回合成合同响应，绝不访问服务器。 / Return a synthetic contract response without contacting any server. */
      fetchResource: async () => new Response(JSON.stringify({ ...value, auditReceipt: fault === "missing" ? null : value.auditReceipt }), { status: 200 }),
    });
    if (fault === "none") assert.equal((await adapter.invoke(request)).success, true);
    else await assert.rejects(adapter.invoke(request), /receipt|version/iu, fault);
  }
});

/** 失败事件重新取证不得继承旧版本。 / Reinvestigation of a failed incident must not inherit old versions. */
test("reinvestigation clears previously governed versions instead of filling missing current evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "goai-version-reinvestigate-"));
  try {
    const { runtime } = contractRuntime(directory);
    await runtime.setAdapterMode({ mode: "live" });
    const created = await runtime.createIncident({ workspaceId: "contract_test", title: "Contract test", summary: "No network", severity: "P1", actorId: "requester", scenario });
    await runtime.runInvestigation({ incidentId: created.incidentId, actorId: "requester", teamRuntime: "builtin" });
    const filename = path.join(directory, "competition", "control-plane.v1.json");
    const raw = JSON.parse(await readFile(filename, "utf8"));
    raw.incidents[0].status = "FAILED";
    await writeFile(filename, JSON.stringify(raw));
    const { runtime: restarted } = contractRuntime(directory, "missing");
    await assert.rejects(restarted.runInvestigation({ incidentId: created.incidentId, actorId: "requester", teamRuntime: "builtin" }),
      /** 缺本轮证据不能继承前次审批版本。 / Missing current evidence cannot inherit prior approval versions. */
      (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "RESOURCE_VERSION_EVIDENCE_INVALID");
    const snapshot: ApplicationCompetitionSnapshot = await restarted.getSnapshot();
    assert.equal(snapshot.approvals.length, 1);
    assert.equal(snapshot.incidents[0]?.activeApprovalId, null);
    assert.equal(snapshot.incidents[0]?.scenario.governedResourceVersions, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
