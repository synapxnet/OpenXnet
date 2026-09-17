#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 认证来源隔离回归 / Certification provenance isolation regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict"

const assert = require("node:assert/strict")
const { execFileSync } = require("node:child_process")
const { mkdtemp, mkdir, writeFile, readdir, rm } = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const { getCompetitionScenarioProfile } = require("../build-ts/desktop/competition/competition-scenario-registry")
const { resolveConfiguration, selectCertificationIncidents, digestBytes, stableSerialize } = require("../scripts/certify_goai_staging_skills.cjs")

/** 构造隔离配置，无真实凭据或联网。 / Create isolated configuration without credentials or network access. */
function configurationEnvironment(root) {
  return {
    OPENXNET_GOAI_CERTIFICATION_DATA_DIR: path.join(root, "data"),
    OPENXNET_GOAI_CERTIFICATION_ENTERPRISE_DIR: path.join(root, "enterprise"),
    OPENXNET_GOAI_CERTIFICATION_SKILLS_DIR: path.join(root, "skills"),
    OPENXNET_GOAI_CERTIFICATION_OUTPUT_DIR: path.join(root, "output"),
    OPENXNET_GOAI_CERTIFICATION_SOURCE_RECEIPT: path.join(root, "source.json"),
    OPENXNET_GOAI_CERTIFICATION_ENVIRONMENT_FINGERPRINT: "goai-staging@150.109.52.248:agentteams-v1.2.0",
    OPENXNET_GOAI_CERTIFICATION_RUN_STARTED_AT: new Date(Date.now() - 60000).toISOString(),
    OPENXNET_GOAI_CERTIFICATION_AIOPS_URL: "https://goai.xnetaiops.example.test/",
    OPENXNET_GOAI_CERTIFICATION_DATAOPS_URL: "https://goai.xnetdataops.example.test/",
    OPENXNET_GOAI_CERTIFICATION_MLOPS_URL: "https://goai.xnetmlops.example.test/",
  }
}

/** 创建明确标注为测试的三场景合同样本。 / Build explicit contract-test samples for the three public scenario shapes. */
function acceptedSample(root = path.join(os.tmpdir(), "goai-certification-contract")) {
  const environment = configurationEnvironment(root)
  const config = resolveConfiguration(environment)
  const timestamp = new Date(Date.now() - 1000).toISOString()
  /** 为本地合同创建严格有序的阶段时刻。 / Create strictly ordered stage timestamps for the local contract. */
  const stageAt = (secondsBeforeCompletion) => new Date(Date.parse(timestamp) - secondsBeforeCompletion * 1000).toISOString()
  const snapshot = { schema: "openxnet.competition-runtime.v1", adapterMode: "live", incidents: [], traces: [], invocations: [], evidence: [], approvals: [], actions: [], auditReceipts: [], teamBindings: [], agentDecisions: [], reasoningDecisions: [], updatedAt: timestamp }
  for (const scenarioType of ["recommendation-capacity", "quantitative-iteration", "feature-drift"]) {
    const incidentId = `contract-test-${scenarioType}`
    const traceId = `${incidentId}-trace`
    const scope = { workspaceId: "contract-test-workspace", incidentId, traceId }
    const scenario = { scenarioType, alertUid: "alert", serviceUid: "service", clusterId: "cluster", namespace: "namespace", workloadName: "workload", reportUid: "report", assetUid: "asset", workflowInstanceUid: "workflow", deploymentUid: "deployment", failingRevision: 18, targetRevision: 19, rollbackRevision: 17, expectedResourceVersion: "42", testDatasetRef: "staging://contract-test/dataset" }
    const baseline = getCompetitionScenarioProfile(scenario)
    scenario.governedResourceVersions = { aiops: {}, dataops: {}, mlops: {} }
    for (const step of [...baseline.executionPlan.steps, ...baseline.executionPlan.compensationSteps]) {
      (scenario.governedResourceVersions[step.toolName.split(".")[0]] ??= {})[step.resourceId] = "42"
    }
    const profile = getCompetitionScenarioProfile(scenario)
    const incident = { ...scope, scenario, title: "Contract test only", status: "RESOLVED", activeTraceId: traceId, activeActionId: `${incidentId}-action`, activeApprovalId: `${incidentId}-approval`, createdAt: stageAt(50), resolvedAt: timestamp }
    const trace = { ...scope, status: "SUCCEEDED", invocationIds: [], completedAt: timestamp }
    const action = { ...scope, actionId: incident.activeActionId, approvalId: incident.activeApprovalId, planId: profile.executionPlan.planId, planDigest: "a".repeat(64), status: "SUCCEEDED", stage: "COMPLETED", compensationStatus: "NOT_REQUIRED", executedBy: "controlled-executor", steps: [], compensationSteps: profile.executionPlan.compensationSteps.map((step) => ({ ...step, status: "PENDING" })), verificationEvidenceIds: [] }
    const approval = { ...scope, approvalId: incident.activeApprovalId, planId: action.planId, planDigest: action.planDigest, status: "APPROVED", requestedBy: "agentteams:role-leader", decidedBy: "human-approver", requestedAt: stageAt(34), decidedAt: stageAt(30), scopes: [] }
    const binding = { ...scope, bindingId: `${incidentId}-binding`, runtime: "agentteams", status: "READY", teamName: "contract-test-team", memberSnapshots: ["leader", "worker", "verifier"].map((teamRole) => ({ roleCardId: `role-${teamRole}`, teamRole })) }

    /** 添加公开形状的调用与摘要证据。 / Add a public-shape invocation and digest-bound evidence record. */
    function addEvidence(toolName, actorId, actionId = null, argumentsValue = {}) {
      const number = snapshot.invocations.length + 1
      const evidenceId = `contract-evidence-${number}`
      const platform = toolName.split(".")[0]
      const data = { passed: true, p99Ms: 250, batchQueueSize: 4, successRate: 0.9999, recovered: true, queueAwareAutoscaling: true, businessKpiRecovered: true, status: "SUCCEEDED", ready: true, algorithmId: "dcn_1", modelVersion: "recommendation-dcn-demo-v1", contractStatus: "MATCHED", productVersion: "recommendation-dcn-demo-v1", candidateCount: 10, errorRate: 0, modelDigestSha256: "b".repeat(64), health: "HEALTHY", informationCoefficient: 0.08, informationCoefficientThreshold: 0.05, sharpeImprovement: 0.1, activeRevision: 19, trafficPercent: 100, p95Ms: 180 }
      const startedAt = stageAt(actorId === "agentteams:role-worker" ? 40 : actorId === "agentteams:role-verifier" ? 15 : 25)
      const completedAt = stageAt(actorId === "agentteams:role-worker" ? 39 : actorId === "agentteams:role-verifier" ? 14 : 20)
      const evidence = { ...scope, evidenceId, toolName, platform, data, contentDigest: digestBytes(stableSerialize(data)), resourceVersion: "43", observedAt: completedAt }
      const invocation = { ...scope, invocationId: `contract-invocation-${number}`, requestId: `contract-request-${number}`, actorId, toolName, platform, status: "SUCCEEDED", argumentsDigest: digestBytes(stableSerialize(argumentsValue)), evidenceId, actionId, errorCode: null, startedAt, completedAt }
      snapshot.evidence.push(evidence)
      snapshot.invocations.push(invocation)
      trace.invocationIds.push(invocation.invocationId)
      return { evidence, invocation }
    }

    const investigationEvidenceIds = []
    for (const call of profile.investigationCalls) {
      const { evidence } = addEvidence(call.toolName, "agentteams:role-worker", null, call.arguments)
      evidence.data.resourceVersions = structuredClone(scenario.governedResourceVersions[evidence.platform] ?? {})
      evidence.contentDigest = digestBytes(stableSerialize(evidence.data))
      investigationEvidenceIds.push(evidence.evidenceId)
    }
    for (const [index, step] of profile.executionPlan.steps.entries()) {
      const { evidence, invocation } = addEvidence(step.toolName, action.executedBy, action.actionId, step.arguments)
      evidence.resourceVersion = String(Number(step.expectedResourceVersion) + (step.kind === "WRITE" ? 1 : 0))
      action.steps.push({ ...step, sequence: index + 1, status: "SUCCEEDED", invocationId: invocation.invocationId, evidenceId: evidence.evidenceId, argumentsDigest: invocation.argumentsDigest, resourceVersionAfter: evidence.resourceVersion, startedAt: invocation.startedAt, completedAt: invocation.completedAt })
      if (step.kind === "WRITE") snapshot.auditReceipts.push({ ...scope, receiptId: `audit-${invocation.requestId}`, requestId: invocation.requestId, toolName: step.toolName, actorId: action.executedBy, approvalId: approval.approvalId, resourceVersionBefore: step.expectedResourceVersion, resourceVersionAfter: evidence.resourceVersion, outcome: "SUCCEEDED", recordedAt: invocation.completedAt })
    }
    approval.scopes = [
      ...profile.executionPlan.steps.filter((step) => step.kind === "WRITE").map((step) => ({ step, compensation: false })),
      ...profile.executionPlan.compensationSteps.map((step) => ({ step, compensation: true })),
    ].map(({ step, compensation }) => ({ stepId: step.stepId, toolName: step.toolName, resourceId: step.resourceId, targetRevision: step.targetRevision, expectedResourceVersion: step.expectedResourceVersion, argumentsDigest: digestBytes(stableSerialize(step.arguments)), compensation }))
    action.planDigest = digestBytes(stableSerialize({ planId: profile.executionPlan.planId, scopes: approval.scopes, orderedSteps: profile.executionPlan.steps.map((step) => step.stepId), compensationSteps: profile.executionPlan.compensationSteps.map((step) => step.stepId) }))
    approval.planDigest = action.planDigest
    approval.argumentsDigest = action.planDigest
    for (const call of profile.verificationCalls) action.verificationEvidenceIds.push(addEvidence(call.toolName, "agentteams:role-verifier", null, call.arguments).evidence.evidenceId)
    snapshot.auditReceipts.push({ ...scope, receiptId: `verify-${incidentId}`, toolName: "openxnet.remediation.verify", actorId: "agentteams:role-verifier", approvalId: approval.approvalId, outcome: "SUCCEEDED" })
    let previousLedgerDigest = "0".repeat(64)
    let sequence = 0
    for (const [teamRole, stage, decision] of [["worker", "INVESTIGATION_PLAN", "COLLECT_EVIDENCE"], ["leader", "INVESTIGATION_CONCLUSION", "REQUEST_APPROVAL"], ["verifier", "VERIFICATION_CONCLUSION", "CLOSE"]]) {
      const transportSender = `@${teamRole}:contract-test`
      const eventId = `$result-${incidentId}-${teamRole}`
      const decisionAt = stageAt(teamRole === "worker" ? 45 : teamRole === "leader" ? 35 : 10)
      const events = []
      for (const kind of [...(teamRole === "leader" ? [] : ["ROUTE_REQUEST", "ROUTE_RESPONSE"]), "TASK_REQUEST", "TASK_RESPONSE"]) {
        const direction = kind.endsWith("RESPONSE") ? "INBOUND" : "OUTBOUND"
        const value = { previousLedgerDigest, sequence: ++sequence, kind, direction, roomId: "!contract-test-room", eventId: kind === "TASK_RESPONSE" ? eventId : `$${incidentId}-${teamRole}-${kind}`, sender: direction === "INBOUND" ? transportSender : "@gateway:contract-test", recipient: direction === "INBOUND" ? "@gateway:contract-test" : transportSender, originServerTs: direction === "INBOUND" ? Date.parse(decisionAt) : null, observedAt: decisionAt, bodyDigest: "c".repeat(64) }
        previousLedgerDigest = digestBytes(JSON.stringify(value))
        events.push({ ...value, ledgerDigest: previousLedgerDigest, redactedBody: "Contract test only" })
      }
      snapshot.agentDecisions.push({ ...scope, decisionId: `${incidentId}-${teamRole}`, bindingId: binding.bindingId, teamName: binding.teamName, roleCardId: `role-${teamRole}`, teamRole, stage, decision, eventId, transportSender, transportEvents: events, createdAt: decisionAt, evidenceIds: teamRole === "verifier" ? [...action.verificationEvidenceIds] : teamRole === "leader" ? investigationEvidenceIds : [] })
    }
    snapshot.reasoningDecisions.push({ ...scope, reasoningId: `${incidentId}-reasoning`, decisionType: "PLAN_SELECTION", selectedCandidateId: "full-plan", candidates: [{ candidateId: "full-plan", eligible: true }, { candidateId: "mitigation", eligible: false }, { candidateId: "rollback", eligible: false }] })
    snapshot.incidents.push(incident)
    snapshot.traces.push(trace)
    snapshot.actions.push(action)
    snapshot.approvals.push(approval)
    snapshot.teamBindings.push(binding)
  }
  const source = { schema: "openxnet.goai-live-certification-source.v1", adapterMode: "live", runtime: "agentteams", environmentFingerprint: config.environmentFingerprint, runStartedAt: config.runStartedAt, completedAt: timestamp, platformEndpoints: {}, platformAddresses: {}, incidents: snapshot.incidents.map((item) => ({ incidentId: item.incidentId, traceId: item.activeTraceId })), invocations: [] }
  for (const platform of ["aiops", "dataops", "mlops"]) {
    source.platformEndpoints[platform] = config[`${platform}Url`]
    source.platformAddresses[platform] = config.environmentHost
  }
  for (const invocation of snapshot.invocations) {
    const evidence = snapshot.evidence.find((item) => item.evidenceId === invocation.evidenceId)
    source.invocations.push({ invocationId: invocation.invocationId, requestId: invocation.requestId, incidentId: invocation.incidentId, traceId: invocation.traceId, platform: invocation.platform, evidenceId: invocation.evidenceId, contentDigest: evidence.contentDigest, adapterMode: "live", environmentFingerprint: config.environmentFingerprint, endpoint: source.platformEndpoints[invocation.platform], serverAddress: config.environmentHost, source: "contract-test-only" })
  }
  return { environment, config, snapshot, source }
}

/** 绑定本次样本原始字节，调用纯校验。 / Bind current sample bytes before invoking pure validation. */
function validate(sample) {
  const hash = digestBytes(JSON.stringify(sample.snapshot))
  sample.source.snapshotSha256 = hash
  return selectCertificationIncidents(sample.snapshot, sample.source, sample.config, hash)
}

/** 验证明确完整来源可通过，但不会生成认证产物。 / Accept complete explicit sources without producing certifications. */
test("certification accepts three complete trace-bound contracts without writes", () => {
  const sample = acceptedSample()
  assert.deepEqual(validate(sample).map((item) => item.scenario.scenarioType), ["recommendation-capacity", "quantitative-iteration", "feature-drift"])
})

/** 覆盖互相独立的错误来源，拒绝而不是筛到其他旧事件。 / Reject independent provenance failures instead of falling back to old incidents. */
const rejectedCases = [
  ["resource map includes unobserved versions", "RESOURCE_VERSION_EVIDENCE_INVALID", (sample) => { sample.snapshot.incidents[0].scenario.governedResourceVersions.aiops.unobserved = "42" }],
  ["Leader did not receive original version evidence", "RESOURCE_VERSION_SOURCE_INVALID", (sample) => { sample.snapshot.agentDecisions.find((item) => item.teamRole === "leader").evidenceIds = [] }],
  ["verification targets an unrelated deployment", "VERIFICATION_TARGET_MISMATCH", (sample) => {
    const action = sample.snapshot.actions[0]
    const evidenceId = action.verificationEvidenceIds.find((id) => sample.snapshot.evidence.find((item) => item.evidenceId === id).toolName === "mlops.deployment.get")
    sample.snapshot.invocations.find((item) => item.evidenceId === evidenceId).argumentsDigest = digestBytes(stableSerialize({ deploymentUid: "unrelated-healthy-deployment", includeRevisions: true }))
  }],
  ["investigation completes after Leader decision", "RESOURCE_VERSION_TIMELINE_INVALID", (sample) => {
    const leader = sample.snapshot.agentDecisions.find((item) => item.teamRole === "leader")
    sample.snapshot.invocations.find((item) => item.evidenceId === leader.evidenceIds[0]).completedAt = sample.snapshot.approvals[0].decidedAt
  }],
  ["investigation starts before Worker decision", "RESOURCE_VERSION_TIMELINE_INVALID", (sample) => {
    const worker = sample.snapshot.agentDecisions.find((item) => item.teamRole === "worker")
    sample.snapshot.invocations[0].startedAt = new Date(Date.parse(worker.createdAt) - 1).toISOString()
  }],
  ["approval predates Leader decision", "RESOURCE_VERSION_TIMELINE_INVALID", (sample) => {
    const leader = sample.snapshot.agentDecisions.find((item) => item.teamRole === "leader")
    sample.snapshot.approvals[0].requestedAt = new Date(Date.parse(leader.createdAt) - 1).toISOString()
  }],
  ["approval decision predates request", "RESOURCE_VERSION_TIMELINE_INVALID", (sample) => {
    sample.snapshot.approvals[0].decidedAt = new Date(Date.parse(sample.snapshot.approvals[0].requestedAt) - 1).toISOString()
  }],
  ["missing Leader decision time", "RESOURCE_VERSION_TIMELINE_INVALID", (sample) => { delete sample.snapshot.agentDecisions.find((item) => item.teamRole === "leader").createdAt }],
  ["invalid approval time", "RESOURCE_VERSION_TIMELINE_INVALID", (sample) => { sample.snapshot.approvals[0].requestedAt = "invalid" }],
  ["write audit reports an unapproved before version", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => { sample.snapshot.auditReceipts[0].resourceVersionBefore = "999" }],
  ["write audit reports a regressed after version", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => { sample.snapshot.auditReceipts[0].resourceVersionAfter = "1" }],
  ["write step reports a different after version", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => { sample.snapshot.actions[0].steps[0].resourceVersionAfter = "999" }],
  ["write evidence reports a different after version", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => {
    sample.snapshot.evidence.find((item) => item.evidenceId === sample.snapshot.actions[0].steps[0].evidenceId).resourceVersion = "999"
  }],
  ["duplicate write audits", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => { sample.snapshot.auditReceipts.push({ ...sample.snapshot.auditReceipts[0], receiptId: "duplicate" }) }],
  ["write audit names another executor", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => { sample.snapshot.auditReceipts[0].actorId = "other-executor" }],
  ["write invocation names another executor", "EXECUTION_VERSION_RECEIPT_INVALID", (sample) => {
    sample.snapshot.invocations.find((item) => item.invocationId === sample.snapshot.actions[0].steps[0].invocationId).actorId = "other-executor"
  }],
  ["fixture snapshot", "LIVE_SNAPSHOT_REQUIRED", (sample) => { sample.snapshot.adapterMode = "fixture" }],
  ["fixture source with live snapshot", "INVOCATION_SOURCE_MISMATCH", (sample) => { sample.source.invocations[0].source = "OpenXnetDesktop/fixture" }],
  ["missing source receipt", "LIVE_SOURCE_REQUIRED", (sample) => { sample.source.schema = null }],
  ["action from another trace", "ACTIVE_TRACE_ACTION_INVALID", (sample) => { sample.snapshot.actions[0].traceId = "old-trace" }],
  ["selected old trace", "SOURCE_INCIDENT_TRACE_MISMATCH", (sample) => { sample.source.incidents[0].traceId = "old-trace" }],
  ["missing verifier", "THREE_DISTINCT_AGENTS_REQUIRED", (sample) => { sample.snapshot.agentDecisions.splice(2, 1) }],
  ["three decisions with duplicate role", "AGENT_DECISION_INVALID", (sample) => { sample.snapshot.agentDecisions[2].teamRole = "worker" }],
  ["verifier refuses closure", "AGENT_DECISION_INVALID", (sample) => { sample.snapshot.agentDecisions[2].decision = "ROLLBACK_REQUIRED" }],
  ["builtin binding", "AGENTTEAMS_REQUIRED", (sample) => { sample.snapshot.teamBindings[0].runtime = "builtin" }],
  ["missing final verification tool", "VERIFICATION_EVIDENCE_INCOMPLETE", (sample) => { sample.snapshot.actions[0].verificationEvidenceIds.pop() }],
  ["executor performs verification", "VERIFICATION_NOT_INDEPENDENT", (sample) => { const evidenceId = sample.snapshot.actions[0].verificationEvidenceIds[0]; sample.snapshot.invocations.find((item) => item.evidenceId === evidenceId).actorId = "controlled-executor" }],
  ["execution step missing", "EXECUTION_INCOMPLETE", (sample) => { sample.snapshot.actions[0].steps.pop() }],
  ["approved scope changed", "APPROVAL_SCOPE_MISMATCH", (sample) => { sample.snapshot.approvals[0].scopes[0].targetRevision += 1 }],
  ["execution resources differ from approval", "EXECUTION_STEP_INVALID", (sample) => { sample.snapshot.actions[0].steps[0].resourceId = "unapproved-resource" }],
  ["compensation plan missing", "COMPENSATION_PLAN_MISSING", (sample) => { sample.snapshot.actions[0].compensationSteps = [] }],
  ["missing objective audit", "OBJECTIVE_AUDIT_MISSING", (sample) => { sample.snapshot.auditReceipts = sample.snapshot.auditReceipts.filter((item) => item.toolName !== "openxnet.remediation.verify") }],
  ["mutated evidence body", "EVIDENCE_DIGEST_INVALID", (sample) => { sample.snapshot.evidence[0].data.passed = false }],
  ["broken Matrix ledger", "MATRIX_LEDGER_INVALID", (sample) => { sample.snapshot.agentDecisions[0].transportEvents[0].ledgerDigest = "d".repeat(64) }],
  ["old environment fingerprint", "SOURCE_ENVIRONMENT_MISMATCH", (sample) => { sample.source.environmentFingerprint = "goai-staging@101.32.9.231:agentteams-v1.2.0" }],
  ["one invocation from historical host", "INVOCATION_ENVIRONMENT_MISMATCH", (sample) => { sample.source.invocations[0].serverAddress = "101.32.9.231" }],
  ["one platform still resolves to old host", "SOURCE_ENDPOINT_MISMATCH", (sample) => { sample.source.platformAddresses.mlops = "101.32.9.231" }],
  ["stale historical run", "SOURCE_RUN_WINDOW_INVALID", (sample) => { sample.config = { ...sample.config, runStartedAt: "2026-09-02T00:00:00.000Z" }; sample.source.runStartedAt = sample.config.runStartedAt }],
  ["old invocation in a current run", "INVOCATION_ENVIRONMENT_MISMATCH", (sample) => { sample.snapshot.invocations.find((item) => item.actorId === "agentteams:role-verifier").startedAt = "2026-09-02T00:00:00.000Z" }],
]
for (const [name, errorCode, mutate] of rejectedCases) {
  /** 每个反例独立创建公开合同样本。 / Create an independent public-contract sample for each rejection. */
  test(`certification rejects ${name}`, () => {
    const sample = acceptedSample()
    mutate(sample)
    assert.throws(() => validate(sample), new RegExp(`GOAI_CERTIFICATION_${errorCode}`))
  })
}

/** 数字指标即使摘要一致也必须满足独立验证阈值。 / Reject threshold failures even when evidence hashes are internally consistent. */
test("certification rechecks objective thresholds after valid evidence digests", () => {
  const sample = acceptedSample()
  const evidenceId = sample.snapshot.actions[0].verificationEvidenceIds[0]
  const evidence = sample.snapshot.evidence.find((item) => item.evidenceId === evidenceId)
  assert.equal(evidence.toolName, "aiops.inference.metrics.get")
  const investigationMetrics = sample.snapshot.evidence.find((item) => item.incidentId === evidence.incidentId && item.toolName === evidence.toolName && item.evidenceId !== evidenceId)
  assert.ok(investigationMetrics.data.p99Ms <= 300)
  evidence.data.p99Ms = 800
  evidence.contentDigest = digestBytes(stableSerialize(evidence.data))
  sample.source.invocations.find((item) => item.evidenceId === evidenceId).contentDigest = evidence.contentDigest
  assert.throws(() => validate(sample), /GOAI_CERTIFICATION_OBJECTIVE_VERIFICATION_FAILED/)
})

/** 同名调查指标不能替代处置后独立验证指标。 / Investigation metrics with the same tool name cannot replace post-execution independent metrics. */
test("certification rejects recommendation investigation metrics substituted for independent verification", () => {
  const sample = acceptedSample()
  const action = sample.snapshot.actions[0]
  const investigationMetrics = sample.snapshot.evidence.find((item) => item.incidentId === action.incidentId && item.toolName === "aiops.inference.metrics.get" && !action.verificationEvidenceIds.includes(item.evidenceId))
  action.verificationEvidenceIds[0] = investigationMetrics.evidenceId
  const verifier = sample.snapshot.agentDecisions.find((item) => item.incidentId === action.incidentId && item.teamRole === "verifier")
  verifier.evidenceIds = [...action.verificationEvidenceIds]
  assert.throws(() => validate(sample), /GOAI_CERTIFICATION_VERIFICATION_NOT_INDEPENDENT/)
})

/** 原始快照摘要不可用当前内存数据隐式替换。 / Require the collector's digest of the exact snapshot bytes. */
test("certification rejects a source receipt bound to different snapshot bytes", () => {
  const sample = acceptedSample()
  sample.source.snapshotSha256 = "0".repeat(64)
  assert.throws(() => selectCertificationIncidents(sample.snapshot, sample.source, sample.config, digestBytes(JSON.stringify(sample.snapshot))), /GOAI_CERTIFICATION_SOURCE_ENVIRONMENT_MISMATCH/)
})

/** 参数无默认历史目录，也不允许全局或交叠写目标。 / Reject missing, global, historical, or overlapping destination configuration. */
test("certification requires explicit isolated destinations and HTTPS origins", () => {
  assert.throws(() => resolveConfiguration({}), /CONFIG_REQUIRED/)
  const environment = configurationEnvironment(path.join(os.tmpdir(), "goai-config-contract"))
  assert.throws(() => resolveConfiguration({ ...environment, OPENXNET_GOAI_CERTIFICATION_SKILLS_DIR: path.join(os.tmpdir(), ".agents", "skills") }), /GLOBAL_SKILLS_FORBIDDEN/)
  assert.throws(() => resolveConfiguration({ ...environment, OPENXNET_GOAI_CERTIFICATION_DATA_DIR: path.join(os.tmpdir(), "openxnet-goai-live-preserved") }), /HISTORICAL_DIRECTORY_FORBIDDEN/)
  assert.throws(() => resolveConfiguration({ ...environment, OPENXNET_GOAI_CERTIFICATION_OUTPUT_DIR: environment.OPENXNET_GOAI_CERTIFICATION_SKILLS_DIR }), /DIRECTORIES_MUST_BE_ISOLATED/)
  assert.throws(() => resolveConfiguration({ ...environment, OPENXNET_GOAI_CERTIFICATION_AIOPS_URL: "http://150.109.52.248/" }), /CONFIG_ENDPOINT_INVALID/)
})

/** CLI 只读检查不能提前创建 Skill、企业绑定或认证文件。 / Ensure CLI check mode never creates Skills, enterprise bindings, or certification files. */
test("certification --check reads isolated sources and creates no writable outputs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "goai-certification-check-"))
  try {
    const sample = acceptedSample(root)
    const bytes = JSON.stringify(sample.snapshot)
    sample.source.snapshotSha256 = digestBytes(bytes)
    await mkdir(path.join(sample.config.dataDirectory, "competition"), { recursive: true })
    await writeFile(path.join(sample.config.dataDirectory, "competition", "control-plane.v1.json"), bytes)
    await writeFile(sample.config.sourceReceiptPath, JSON.stringify(sample.source))
    const output = execFileSync(process.execPath, [path.resolve(__dirname, "../scripts/certify_goai_staging_skills.cjs"), "--check"], { env: { ...process.env, ...sample.environment }, encoding: "utf8", windowsHide: true })
    assert.equal(JSON.parse(output).writeOperationCount, 0)
    assert.deepEqual((await readdir(root)).sort(), ["data", "source.json"])
  } finally {
    // 仅删除已验证位于系统临时目录的本测试根。 / Remove only this verified test root under the system temporary directory.
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    await rm(root, { recursive: true, force: true })
  }
})
