#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 复赛环境认证边界 / Semifinal environment certification boundary.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict"

const { createHash } = require("node:crypto")
const path = require("node:path")
const { lstat, mkdir, readFile, writeFile } = require("node:fs/promises")
const { version: releaseVersion } = require("../package.json")
const { getCompetitionScenarioProfile } = require("../build-ts/desktop/competition/competition-scenario-registry")
const { collectCompetitionResourceVersions } = require("../build-ts/desktop/competition/competition-resource-versions")
const { getCompetitionToolDescriptor } = require("../build-ts/desktop/competition/competition-tool-registry")
const SCENARIOS = ["recommendation-capacity", "quantitative-iteration", "feature-drift"]
const SHA256 = /^[a-f0-9]{64}$/u

/** 拒绝缺失或不一致的认证来源；不输出证据正文。 / Reject incomplete provenance without exposing evidence bodies. */
function requireCondition(condition, code) {
  if (!condition) throw new Error(`GOAI_CERTIFICATION_${code}`)
}

/** 计算原始字节摘要。 / Hash original bytes without normalization. */
function digestBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

/** 按公开运行时算法稳定序列化数据。 / Serialize data using the public runtime's stable digest convention. */
function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

/** 读取必填配置并禁止历史目录与全局技能目标。 / Require explicit configuration and reject archived or global destinations. */
function resolveConfiguration(environment = process.env) {
  const fields = {
    dataDirectory: "OPENXNET_GOAI_CERTIFICATION_DATA_DIR",
    enterpriseDirectory: "OPENXNET_GOAI_CERTIFICATION_ENTERPRISE_DIR",
    skillsDirectory: "OPENXNET_GOAI_CERTIFICATION_SKILLS_DIR",
    outputDirectory: "OPENXNET_GOAI_CERTIFICATION_OUTPUT_DIR",
    sourceReceiptPath: "OPENXNET_GOAI_CERTIFICATION_SOURCE_RECEIPT",
    environmentFingerprint: "OPENXNET_GOAI_CERTIFICATION_ENVIRONMENT_FINGERPRINT",
    runStartedAt: "OPENXNET_GOAI_CERTIFICATION_RUN_STARTED_AT",
    aiopsUrl: "OPENXNET_GOAI_CERTIFICATION_AIOPS_URL",
    dataopsUrl: "OPENXNET_GOAI_CERTIFICATION_DATAOPS_URL",
    mlopsUrl: "OPENXNET_GOAI_CERTIFICATION_MLOPS_URL",
  }
  const config = {}
  for (const [key, variable] of Object.entries(fields)) {
    const value = String(environment[variable] || "").trim()
    requireCondition(value.length > 0, `CONFIG_REQUIRED_${variable}`)
    config[key] = value
  }
  const fingerprint = /^goai-staging@([a-zA-Z0-9.-]+):agentteams-v([0-9]+\.[0-9]+\.[0-9]+)$/u.exec(config.environmentFingerprint)
  requireCondition(fingerprint !== null, "ENVIRONMENT_FINGERPRINT_INVALID")
  config.environmentHost = fingerprint[1].toLowerCase()
  for (const platform of ["aiops", "dataops", "mlops"]) {
    let endpoint
    try { endpoint = new URL(config[`${platform}Url`]) } catch { requireCondition(false, "CONFIG_ENDPOINT_INVALID") }
    requireCondition(endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash, "CONFIG_ENDPOINT_INVALID")
    config[`${platform}Url`] = endpoint.href
  }
  requireCondition(Number.isFinite(Date.parse(config.runStartedAt)), "RUN_START_INVALID")
  for (const key of ["dataDirectory", "enterpriseDirectory", "skillsDirectory", "outputDirectory", "sourceReceiptPath"]) {
    requireCondition(path.isAbsolute(config[key]), "ABSOLUTE_PATH_REQUIRED")
    config[key] = path.resolve(config[key])
    const normalized = config[key].replaceAll("\\", "/").toLowerCase()
    requireCondition(!normalized.includes("openxnet-goai-live-preserved") && !normalized.includes("复赛-陈家祥-20260903-v2"), "HISTORICAL_DIRECTORY_FORBIDDEN")
    requireCondition(!/\/\.(?:agents|agent|codex)\/skills(?:\/|$)/u.test(normalized), "GLOBAL_SKILLS_FORBIDDEN")
    requireCondition(config[key] !== path.parse(config[key]).root, "ROOT_DIRECTORY_FORBIDDEN")
  }
  const directories = [config.dataDirectory, config.enterpriseDirectory, config.skillsDirectory, config.outputDirectory]
  for (let index = 0; index < directories.length; index += 1) {
    for (let other = index + 1; other < directories.length; other += 1) {
      const relative = path.relative(directories[index], directories[other])
      const inverse = path.relative(directories[other], directories[index])
      requireCondition(relative !== "" && (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) && (inverse.startsWith(`..${path.sep}`) || path.isAbsolute(inverse)), "DIRECTORIES_MUST_BE_ISOLATED")
    }
  }
  return Object.freeze(config)
}

/** 检查对象属于事件的当前追踪。 / Bind each record to the incident's active trace and workspace. */
function inTrace(record, incident) {
  return record?.incidentId === incident.incidentId && record.traceId === incident.activeTraceId && record.workspaceId === incident.workspaceId
}

/** 检查唯一标识集合相等。 / Compare identifier sets without accepting duplicates. */
function sameIds(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && new Set(left).size === left.length && left.every((id) => right.includes(id))
}

/** 重建固定计划审批摘要，校验参数、资源版本与补偿范围。 / Rebuild the fixed-plan approval digest including parameters, resource versions, and compensation scope. */
function validateApprovalScope(approval, profile) {
  const plan = profile.executionPlan
  const scopes = [
    ...plan.steps.filter((step) => step.kind === "WRITE").map((step) => ({ step, compensation: false })),
    ...plan.compensationSteps.filter((step) => step.kind === "WRITE").map((step) => ({ step, compensation: true })),
  ].map(({ step, compensation }) => ({ stepId: step.stepId, toolName: step.toolName, resourceId: step.resourceId, targetRevision: step.targetRevision, expectedResourceVersion: step.expectedResourceVersion, argumentsDigest: digestBytes(stableSerialize(step.arguments)), compensation }))
  const expected = digestBytes(stableSerialize({ planId: plan.planId, scopes, orderedSteps: plan.steps.map((step) => step.stepId), compensationSteps: plan.compensationSteps.map((step) => step.stepId) }))
  requireCondition(approval.planDigest === expected && approval.argumentsDigest === expected && stableSerialize(approval.scopes) === stableSerialize(scopes), "APPROVAL_SCOPE_MISMATCH")
}

/** 从 Leader 实际接收的原始调查重建审批版本，禁止验证后反填。 / Rebuild approval versions from original investigation received by the Leader, never from later verification. */
function validateResourceVersionEvidence(incident, profile, approval, decisions, invocations, evidence) {
  const leader = decisions.find((item) => item.teamRole === "leader")
  const worker = decisions.find((item) => item.teamRole === "worker")
  const workerAt = Date.parse(worker.createdAt)
  const leaderAt = Date.parse(leader.createdAt)
  const requestedAt = Date.parse(approval.requestedAt)
  const decidedAt = Date.parse(approval.decidedAt)
  requireCondition([workerAt, leaderAt, requestedAt, decidedAt].every(Number.isFinite)
    && workerAt <= leaderAt && leaderAt <= requestedAt && requestedAt <= decidedAt, "RESOURCE_VERSION_TIMELINE_INVALID")
  const ids = leader?.evidenceIds
  requireCondition(Array.isArray(ids) && ids.length === profile.investigationCalls.length && new Set(ids).size === ids.length, "RESOURCE_VERSION_SOURCE_INVALID")
  const selected = evidence.filter((item) => ids.includes(item.evidenceId))
  requireCondition(sameIds(selected.map((item) => item.toolName), profile.investigationCalls.map((call) => call.toolName)), "RESOURCE_VERSION_SOURCE_INVALID")
  for (const item of selected) {
    const invocation = invocations.find((entry) => entry.evidenceId === item.evidenceId)
    const definition = profile.investigationCalls.find((call) => call.toolName === item.toolName)
    requireCondition(invocation?.actionId === null && invocation.actorId === `agentteams:${worker.roleCardId}`
      && invocation.argumentsDigest === digestBytes(stableSerialize(definition.arguments))
      && getCompetitionToolDescriptor(item.toolName).platform === item.platform, "RESOURCE_VERSION_SOURCE_INVALID")
    const startedAt = Date.parse(invocation.startedAt)
    const completedAt = Date.parse(invocation.completedAt)
    requireCondition(Number.isFinite(startedAt) && Number.isFinite(completedAt)
      && workerAt <= startedAt && startedAt <= completedAt && completedAt <= leaderAt, "RESOURCE_VERSION_TIMELINE_INVALID")
  }
  let versions
  try {
    versions = collectCompetitionResourceVersions(selected.map((item) => ({ toolName: item.toolName, response: { success: true, data: item.data } })))
  } catch { requireCondition(false, "RESOURCE_VERSION_EVIDENCE_INVALID") }
  requireCondition(incident.scenario.governedResourceVersions !== undefined
    && stableSerialize(versions) === stableSerialize(incident.scenario.governedResourceVersions), "RESOURCE_VERSION_EVIDENCE_INVALID")
}

/** 校验脱敏 Matrix 账本及身份回执。 / Validate the redacted Matrix ledger and result identities. */
function validateAgentLedger(snapshot, incident, decisions) {
  const all = snapshot.agentDecisions.filter((item) => item.incidentId === incident.incidentId)
  let previous = "0".repeat(64)
  let sequence = 0
  for (const decision of all) {
    requireCondition(Array.isArray(decision.transportEvents) && decision.transportEvents.length >= 2, "MATRIX_EVENTS_MISSING")
    for (const event of decision.transportEvents) {
      sequence += 1
      const value = { previousLedgerDigest: previous, sequence, kind: event.kind, direction: event.direction, roomId: event.roomId, eventId: event.eventId, sender: event.sender, recipient: event.recipient, originServerTs: event.originServerTs, observedAt: event.observedAt, bodyDigest: event.bodyDigest }
      requireCondition(event.sequence === sequence && event.previousLedgerDigest === previous && SHA256.test(event.bodyDigest) && event.ledgerDigest === digestBytes(JSON.stringify(value)), "MATRIX_LEDGER_INVALID")
      previous = event.ledgerDigest
    }
  }
  for (const decision of decisions) {
    requireCondition(decision.transportEvents.some((event) => event.kind === "TASK_RESPONSE" && event.direction === "INBOUND" && event.eventId === decision.eventId && event.sender === decision.transportSender), "MATRIX_IDENTITY_INVALID")
    if (decision.teamRole !== "leader") requireCondition(decision.transportEvents.some((event) => event.kind === "ROUTE_REQUEST") && decision.transportEvents.some((event) => event.kind === "ROUTE_RESPONSE"), "MATRIX_ROUTING_MISSING")
  }
}

/** 按当前场景客观阈值复核独立证据。 / Recheck independent evidence against the current scenario thresholds. */
function validateObjectiveEvidence(incident, evidence) {
  const data = Object.fromEntries(evidence.map((item) => [item.toolName, item.data]))
  const probe = data["mlops.inference.probe"]
  const deployment = data["mlops.deployment.get"]
  const release = data["mlops.release.validation.get"]
  let passed = false
  if (incident.scenario.scenarioType === "recommendation-capacity") {
    const metrics = data["aiops.inference.metrics.get"]
    const recovery = data["aiops.inference.recovery.status"]
    passed = Number.isFinite(metrics?.p99Ms) && metrics.p99Ms <= 300 && Number.isFinite(metrics.batchQueueSize) && metrics.batchQueueSize <= 10
      && Number.isFinite(metrics.successRate) && metrics.successRate >= 0.999 && recovery?.recovered === true && recovery.queueAwareAutoscaling === true && recovery.businessKpiRecovered === true
      && data["dataops.workflow.instance.get"]?.status === "SUCCEEDED" && deployment?.ready === true && deployment.algorithmId === "dcn_1" && deployment.modelVersion === "recommendation-dcn-demo-v1"
      && probe?.passed === true && probe.contractStatus === "MATCHED" && probe.algorithmId === "dcn_1" && probe.productVersion === "recommendation-dcn-demo-v1"
      && Number.isFinite(probe.candidateCount) && probe.candidateCount >= 8 && probe.errorRate === 0 && SHA256.test(probe.modelDigestSha256)
  } else if (incident.scenario.scenarioType === "quantitative-iteration") {
    const health = data["aiops.service.health"]
    const attribution = data["mlops.attribution.report.get"]
    passed = (health?.health === "HEALTHY" || health?.conclusion === "HEALTHY") && data["dataops.dataset.validation.get"]?.passed === true
      && Number.isFinite(attribution?.informationCoefficient) && Number.isFinite(attribution.informationCoefficientThreshold) && attribution.informationCoefficient >= attribution.informationCoefficientThreshold
      && Number.isFinite(attribution.sharpeImprovement) && attribution.sharpeImprovement >= 0.05 && deployment?.activeRevision === incident.scenario.targetRevision
      && release?.passed === true && release.trafficPercent === 100 && probe?.passed === true
  } else {
    passed = data["aiops.inference.recovery.status"]?.businessKpiRecovered === true && data["dataops.dataset.validation.get"]?.passed === true
      && probe?.passed === true && Number.isFinite(probe.errorRate) && probe.errorRate <= 0.05 && Number.isFinite(probe.p95Ms) && probe.p95Ms <= 300
      && deployment?.activeRevision === incident.scenario.targetRevision && release?.passed === true && release.trafficPercent === 100
  }
  requireCondition(passed, "OBJECTIVE_VERIFICATION_FAILED")
}

/** 验证一个明确来源事件的完整成功闭环。 / Validate one explicitly selected incident's complete successful closure. */
function validateIncident(snapshot, incident) {
  const scoped = (collection) => collection.filter((item) => inTrace(item, incident))
  const profile = getCompetitionScenarioProfile(incident.scenario)
  requireCondition(incident.status === "RESOLVED" && incident.activeTraceId && incident.resolvedAt && !/fixture:|verification-failure/iu.test(incident.scenario.testDatasetRef), "INCIDENT_NOT_ACCEPTED")
  const trace = scoped(snapshot.traces).find((item) => item.traceId === incident.activeTraceId)
  const action = scoped(snapshot.actions).find((item) => item.actionId === incident.activeActionId)
  const approval = scoped(snapshot.approvals).find((item) => item.approvalId === incident.activeApprovalId)
  requireCondition(trace?.status === "SUCCEEDED" && action?.status === "SUCCEEDED" && action.stage === "COMPLETED" && action.compensationStatus === "NOT_REQUIRED", "ACTIVE_TRACE_ACTION_INVALID")
  requireCondition(approval?.status === "APPROVED" && approval.decidedBy && approval.decidedBy !== approval.requestedBy && approval.decidedBy !== action.executedBy
    && action.approvalId === approval.approvalId && action.planId === profile.executionPlan.planId && approval.planId === action.planId
    && SHA256.test(action.planDigest) && approval.planDigest === action.planDigest, "APPROVAL_INVALID")
  validateApprovalScope(approval, profile)
  const bindings = scoped(snapshot.teamBindings)
  requireCondition(bindings.length === 1 && bindings[0].runtime === "agentteams" && bindings[0].status === "READY", "AGENTTEAMS_REQUIRED")
  const binding = bindings[0]
  const decisions = scoped(snapshot.agentDecisions)
  const expected = { worker: ["INVESTIGATION_PLAN", "COLLECT_EVIDENCE"], leader: ["INVESTIGATION_CONCLUSION", "REQUEST_APPROVAL"], verifier: ["VERIFICATION_CONCLUSION", "CLOSE"] }
  requireCondition(decisions.length === 3 && new Set(decisions.map((item) => item.roleCardId)).size === 3 && new Set(decisions.map((item) => item.transportSender)).size === 3, "THREE_DISTINCT_AGENTS_REQUIRED")
  requireCondition(binding.memberSnapshots.length === 3 && new Set(binding.memberSnapshots.map((item) => item.roleCardId)).size === 3, "TEAM_ROLES_INVALID")
  for (const [role, [stage, decision]] of Object.entries(expected)) {
    const matching = decisions.filter((item) => item.teamRole === role)
    requireCondition(matching.length === 1 && matching[0].stage === stage && matching[0].decision === decision && matching[0].bindingId === binding.bindingId
      && matching[0].teamName === binding.teamName && binding.memberSnapshots.some((member) => member.roleCardId === matching[0].roleCardId && member.teamRole === role), "AGENT_DECISION_INVALID")
  }
  validateAgentLedger(snapshot, incident, decisions)
  const verifier = decisions.find((item) => item.teamRole === "verifier")
  const verifierActor = `agentteams:${verifier.roleCardId}`
  requireCondition(action.executedBy !== verifierActor, "VERIFIER_NOT_INDEPENDENT")
  const evidence = scoped(snapshot.evidence)
  const invocations = scoped(snapshot.invocations)
  requireCondition(sameIds(trace.invocationIds, invocations.map((item) => item.invocationId)) && invocations.every((item) => item.status === "SUCCEEDED" && item.errorCode === null), "INVOCATION_CHAIN_INVALID")
  requireCondition(new Set(evidence.map((item) => item.evidenceId)).size === evidence.length, "EVIDENCE_DUPLICATED")
  for (const invocation of invocations) {
    const result = evidence.find((item) => item.evidenceId === invocation.evidenceId)
    requireCondition(result && result.toolName === invocation.toolName && result.platform === invocation.platform && SHA256.test(result.contentDigest)
      && result.contentDigest === digestBytes(stableSerialize(result.data)), "EVIDENCE_DIGEST_INVALID")
  }
  validateResourceVersionEvidence(incident, profile, approval, decisions, invocations, evidence)
  requireCondition(action.steps.length === profile.executionPlan.steps.length, "EXECUTION_INCOMPLETE")
  requireCondition(sameIds(action.compensationSteps.map((step) => step.stepId), profile.executionPlan.compensationSteps.map((step) => step.stepId)), "COMPENSATION_PLAN_MISSING")
  const audits = scoped(snapshot.auditReceipts)
  for (const [index, definition] of profile.executionPlan.steps.entries()) {
    const step = action.steps[index]
    const invocation = invocations.find((item) => item.invocationId === step.invocationId)
    requireCondition(step.stepId === definition.stepId && step.toolName === definition.toolName && step.kind === definition.kind && step.status === "SUCCEEDED"
      && invocation?.actionId === action.actionId && invocation.evidenceId === step.evidenceId && invocation.toolName === definition.toolName
      && invocation.argumentsDigest === step.argumentsDigest && step.argumentsDigest === digestBytes(stableSerialize(definition.arguments))
      && step.resourceId === definition.resourceId && step.targetRevision === definition.targetRevision && step.expectedResourceVersion === definition.expectedResourceVersion, "EXECUTION_STEP_INVALID")
    if (step.kind === "WRITE") {
      const matching = audits.filter((item) => item.requestId === invocation.requestId && item.toolName === step.toolName)
      requireCondition(matching.length > 0, "EXECUTION_AUDIT_MISSING")
      const receipt = matching[0]
      const result = evidence.find((item) => item.evidenceId === step.evidenceId)
      const expectedAfter = String(Number(definition.expectedResourceVersion) + 1)
      requireCondition(matching.length === 1 && receipt.approvalId === approval.approvalId && receipt.outcome === "SUCCEEDED"
        && receipt.actorId === action.executedBy && invocation.actorId === action.executedBy
        && receipt.resourceVersionBefore === definition.expectedResourceVersion && receipt.resourceVersionAfter === expectedAfter
        && step.resourceVersionAfter === expectedAfter && result?.resourceVersion === expectedAfter, "EXECUTION_VERSION_RECEIPT_INVALID")
    }
  }
  const verification = evidence.filter((item) => action.verificationEvidenceIds.includes(item.evidenceId))
  requireCondition(sameIds(verification.map((item) => item.evidenceId), action.verificationEvidenceIds)
    && sameIds(verification.map((item) => item.toolName), profile.verificationCalls.map((item) => item.toolName))
    && sameIds(verifier.evidenceIds, action.verificationEvidenceIds), "VERIFICATION_EVIDENCE_INCOMPLETE")
  const executionIds = new Set(action.steps.map((item) => item.evidenceId))
  for (const item of verification) {
    const invocation = invocations.find((entry) => entry.evidenceId === item.evidenceId)
    requireCondition(!executionIds.has(item.evidenceId) && invocation?.actorId === verifierActor && invocation.actionId === null, "VERIFICATION_NOT_INDEPENDENT")
    const definition = profile.verificationCalls.find((call) => call.toolName === item.toolName)
    requireCondition(definition && invocation.argumentsDigest === digestBytes(stableSerialize(definition.arguments))
      && getCompetitionToolDescriptor(item.toolName).platform === item.platform, "VERIFICATION_TARGET_MISMATCH")
  }
  const investigation = invocations.filter((item) => item.actionId === null && !action.verificationEvidenceIds.includes(item.evidenceId))
  for (const call of profile.investigationCalls) requireCondition(investigation.some((item) => item.toolName === call.toolName), "INVESTIGATION_INCOMPLETE")
  requireCondition(audits.some((item) => item.toolName === "openxnet.remediation.verify" && item.actorId === verifierActor && item.approvalId === approval.approvalId && item.outcome === "SUCCEEDED"), "OBJECTIVE_AUDIT_MISSING")
  validateObjectiveEvidence(incident, verification)
  const plans = scoped(snapshot.reasoningDecisions).filter((item) => item.decisionType === "PLAN_SELECTION")
  requireCondition(plans.length === 1 && plans[0].candidates.length >= 3 && plans[0].candidates.some((item) => item.candidateId === plans[0].selectedCandidateId && item.eligible === true), "PLAN_COMPARISON_MISSING")
  return incident
}

/** 验证采集端来源回执，不从旧快照补造服务器来源。 / Validate collector provenance without inventing origins missing from legacy snapshots. */
function selectCertificationIncidents(snapshot, source, config, snapshotSha256, now = Date.now()) {
  requireCondition(snapshot?.schema === "openxnet.competition-runtime.v1" && snapshot.adapterMode === "live", "LIVE_SNAPSHOT_REQUIRED")
  requireCondition(source?.schema === "openxnet.goai-live-certification-source.v1" && source.adapterMode === "live" && source.runtime === "agentteams", "LIVE_SOURCE_REQUIRED")
  requireCondition(source.environmentFingerprint === config.environmentFingerprint && source.snapshotSha256 === snapshotSha256 && SHA256.test(snapshotSha256), "SOURCE_ENVIRONMENT_MISMATCH")
  const startedAt = Date.parse(config.runStartedAt)
  const completedAt = Date.parse(source.completedAt)
  requireCondition(source.runStartedAt === config.runStartedAt && Number.isFinite(startedAt) && Number.isFinite(completedAt)
    && startedAt <= completedAt && completedAt <= now + 300000 && now - startedAt <= 86400000 && Date.parse(snapshot.updatedAt) <= completedAt, "SOURCE_RUN_WINDOW_INVALID")
  const endpoints = {}
  for (const platform of ["aiops", "dataops", "mlops"]) {
    let endpoint
    try { endpoint = new URL(source.platformEndpoints?.[platform]) } catch { requireCondition(false, "SOURCE_ENDPOINT_INVALID") }
    requireCondition(endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash
      && endpoint.href === config[`${platform}Url`] && source.platformAddresses?.[platform] === config.environmentHost, "SOURCE_ENDPOINT_MISMATCH")
    endpoints[platform] = endpoint.origin
  }
  requireCondition(Array.isArray(source.incidents) && source.incidents.length === 3 && new Set(source.incidents.map((item) => item.incidentId)).size === 3, "THREE_SOURCE_INCIDENTS_REQUIRED")
  requireCondition(Array.isArray(source.invocations) && new Set(source.invocations.map((item) => item.invocationId)).size === source.invocations.length, "SOURCE_INVOCATIONS_INVALID")
  const selected = source.incidents.map((reference) => {
    const incident = snapshot.incidents.find((item) => item.incidentId === reference.incidentId)
    requireCondition(incident && incident.activeTraceId === reference.traceId && Date.parse(incident.createdAt) >= startedAt && Date.parse(incident.resolvedAt) <= completedAt, "SOURCE_INCIDENT_TRACE_MISMATCH")
    validateIncident(snapshot, incident)
    const invocations = snapshot.invocations.filter((item) => inTrace(item, incident))
    for (const invocation of invocations) {
      const receipt = source.invocations.find((item) => item.invocationId === invocation.invocationId)
      const evidence = snapshot.evidence.find((item) => item.evidenceId === invocation.evidenceId && inTrace(item, incident))
      requireCondition(receipt && receipt.adapterMode === "live" && receipt.incidentId === incident.incidentId && receipt.traceId === incident.activeTraceId
        && receipt.requestId === invocation.requestId && receipt.platform === invocation.platform && receipt.evidenceId === invocation.evidenceId && receipt.contentDigest === evidence.contentDigest
        && receipt.environmentFingerprint === config.environmentFingerprint && typeof receipt.source === "string" && receipt.source.trim() && !/fixture|simulation|mock|synthetic/iu.test(receipt.source), "INVOCATION_SOURCE_MISMATCH")
      let origin
      try { const url = new URL(receipt.endpoint); requireCondition(!url.username && !url.password && !url.search && !url.hash, "INVOCATION_ENDPOINT_INVALID"); origin = url.origin } catch { requireCondition(false, "INVOCATION_ENDPOINT_INVALID") }
      requireCondition(origin === endpoints[invocation.platform] && receipt.serverAddress === config.environmentHost
        && Date.parse(invocation.startedAt) >= startedAt && Date.parse(invocation.completedAt) >= Date.parse(invocation.startedAt)
        && Date.parse(invocation.completedAt) <= completedAt, "INVOCATION_ENVIRONMENT_MISMATCH")
    }
    return incident
  })
  requireCondition(sameIds(selected.map((item) => item.scenario.scenarioType), SCENARIOS), "THREE_SCENARIOS_REQUIRED")
  requireCondition(new Set(selected.map((item) => item.workspaceId)).size === 1, "WORKSPACE_MISMATCH")
  requireCondition(source.invocations.length === snapshot.invocations.filter((item) => selected.some((incident) => inTrace(item, incident))).length, "SOURCE_INVOCATIONS_EXTRA")
  return SCENARIOS.map((scenarioType) => selected.find((item) => item.scenario.scenarioType === scenarioType))
}

/** 提供无旧版设置的 Skill 状态边界。 / Expose an empty legacy settings boundary for isolated output. */
class CertificationSkillStateBoundary {
  /** 返回空状态，不读取用户配置。 / Return empty state without reading user configuration. */
  getSnapshot() { return {} }
}

/** 计算最终技能包原始字节摘要。 / Hash the exact final Skill package bytes. */
async function digestSkillPackage(directory) {
  const markdown = await readFile(path.join(directory, "SKILL.md"))
  const manifest = await readFile(path.join(directory, "openxnet.skill.json"))
  return createHash("sha256").update(markdown).update(Buffer.from([0])).update(manifest).digest("hex")
}

/** 读取有界普通 JSON 文件，拒绝链接和超大输入。 / Read bounded regular JSON files without following file symlinks. */
async function readJsonDocument(filename) {
  const info = await lstat(filename)
  requireCondition(info.isFile() && !info.isSymbolicLink() && info.size <= 32 * 1024 * 1024, "SOURCE_FILE_INVALID")
  const bytes = await readFile(filename)
  return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), digest: digestBytes(bytes) }
}

/** 防止显式目录通过符号链接跳转到全局或历史目录。 / Reject symlink ancestors that redirect explicit paths into global or archived locations. */
async function validatePathAncestors(filename) {
  let current = path.resolve(filename)
  while (true) {
    try { requireCondition(!(await lstat(current)).isSymbolicLink(), "SYMLINK_PATH_FORBIDDEN") }
    catch (error) { if (error.code !== "ENOENT") throw error }
    const parent = path.dirname(current)
    if (parent === current) return
    current = parent
  }
}

/** 检查目标尚不存在，避免覆盖现有认证制品。 / Require an absent destination to preserve existing certification artifacts. */
async function requireMissingDestination(filename) {
  try { await lstat(filename) }
  catch (error) { if (error.code === "ENOENT") return; throw error }
  requireCondition(false, "EXISTING_OUTPUT_FORBIDDEN")
}

/** 显式检查或认证当前隔离数据，不执行平台工具。 / Inspect or certify explicitly supplied isolated data without calling platform tools. */
async function main(environment = process.env, argumentsValue = process.argv.slice(2)) {
  requireCondition(argumentsValue.every((item) => item === "--check"), "ARGUMENT_INVALID")
  const config = resolveConfiguration(environment)
  for (const filename of [config.dataDirectory, config.enterpriseDirectory, config.skillsDirectory, config.outputDirectory, config.sourceReceiptPath]) await validatePathAncestors(filename)
  const document = await readJsonDocument(path.join(config.dataDirectory, "competition", "control-plane.v1.json"))
  const sourceDocument = await readJsonDocument(config.sourceReceiptPath)
  const snapshot = document.value
  const source = sourceDocument.value
  const incidents = selectCertificationIncidents(snapshot, source, config, document.digest)
  if (argumentsValue.includes("--check")) {
    process.stdout.write(`${JSON.stringify({ success: true, mode: "check-only", skillCount: incidents.length, writeOperationCount: 0 })}\n`)
    return
  }
  // 所有来源先校验，才加载可写服务。 / Validate all sources before loading any writable services.
  const { ApplicationSkillRuntimeService } = require("../build-ts/desktop/skills/application-skill-runtime")
  const destination = path.join(config.outputDirectory, "skill-certifications.json")
  await requireMissingDestination(destination)
  for (const incident of incidents) {
    const target = path.join(config.skillsDirectory, getCompetitionScenarioProfile(incident.scenario).skill.skillId)
    await requireMissingDestination(target)
  }
  requireCondition((await readJsonDocument(path.join(config.dataDirectory, "competition", "control-plane.v1.json"))).digest === document.digest, "SNAPSHOT_CHANGED_BEFORE_CERTIFICATION")
  const skillRuntime = new ApplicationSkillRuntimeService({ globalSkillsRoot: config.skillsDirectory, bundledSkillsRoot: path.join(__dirname, "..", "skills"), state: new CertificationSkillStateBoundary(), logger: console })
  const certifications = []
  for (const incident of incidents) {
    const profile = getCompetitionScenarioProfile(incident.scenario)
    const evidence = snapshot.evidence.filter((item) => inTrace(item, incident))
    const decisions = snapshot.agentDecisions.filter((item) => inTrace(item, incident))
    const reasoning = snapshot.reasoningDecisions.filter((item) => inTrace(item, incident))
    const sourceEventIds = [
      incident.incidentId,
      ...evidence.map((item) => item.evidenceId),
      ...decisions.map((item) => item.decisionId),
      ...reasoning.map((item) => item.reasoningId),
    ].slice(0, 200)
    const toolChain = profile.executionPlan.steps.map((step) => step.toolName)
    await skillRuntime.crystallizeSkill({
      name: profile.skill.name,
      skillId: profile.skill.skillId,
      description: profile.skill.description,
      triggerContext: profile.skill.triggerContext,
      workflow: profile.skill.workflow.join("\n"),
      notes: profile.skill.guardrails,
      requiredCapabilities: profile.skill.requiredCapabilities,
      verification: profile.skill.verification,
      rollback: profile.skill.rollback,
      examples: [incident.title],
      counterExamples: ["绕过审批直接写入。", "仅凭 Executor 成功回执关闭事件。"],
      sourceEventIds,
      status: "verified",
      source: "rehearsal",
      familyId: `family-${profile.skill.skillId}`,
      problemFingerprint: `${incident.scenario.scenarioType}:${incident.scenario.serviceUid}`,
      evidenceOrigin: "rehearsal",
      derivationMethod: "offline_consolidation",
      environmentScope: "staging",
      environmentFingerprint: config.environmentFingerprint,
      strategies: [
        {
          strategyId: "governed-full-closure",
          name: "完整受治理闭环",
          workflow: profile.skill.workflow,
          toolChain,
          riskLevel: "high",
          costScore: 0.7,
          sourceEventIds,
        },
        {
          strategyId: "mitigation-only",
          name: "仅止损候选",
          workflow: profile.skill.workflow.slice(0, 2),
          toolChain: toolChain.slice(0, 2),
          riskLevel: "medium",
          costScore: 0.35,
          sourceEventIds: reasoning.map((item) => item.reasoningId),
        },
        {
          strategyId: "rollback-first",
          name: "验证失败优先回滚",
          workflow: [profile.skill.rollback],
          toolChain: profile.executionPlan.compensationSteps.map((step) => step.toolName),
          riskLevel: "high",
          costScore: 0.5,
          sourceEventIds,
        },
      ],
      certifications: [{
        scope: "staging",
        status: "verified",
        environmentFingerprint: config.environmentFingerprint,
        evidenceEventIds: sourceEventIds,
      }],
      syncToProject: false,
      overwrite: false,
    })
    // 认证不创建或启用企业绑定；后续由明确启用动作授予入口。 / Certification does not create or enable enterprise bindings; a separate explicit action grants that entry.
    const verifier = decisions.find((item) => item.teamRole === "verifier")
    const planDecision = reasoning.find((item) => item.decisionType === "PLAN_SELECTION")
    const skillDirectory = path.join(skillRuntime.skillsDirectory, profile.skill.skillId)
    certifications.push({
      skillId: profile.skill.skillId,
      familyId: `family-${profile.skill.skillId}`,
      sourceIncidentId: incident.incidentId,
      sourceTraceId: incident.activeTraceId,
      sourceSnapshotSha256: source.snapshotSha256,
      environmentScope: "staging",
      lifecycleStatus: "verified",
      environmentFingerprint: config.environmentFingerprint,
      artifactDigest: await digestSkillPackage(skillDirectory),
      crystallizationTrail: [
        { role: "tester", stage: "TESTER_REPRODUCED", eventId: incident.incidentId },
        { role: "developer", stage: "DEVELOPER_COMPARED_STRATEGIES", eventId: planDecision.reasoningId },
        { role: "verifier", stage: "VERIFIER_CERTIFIED", eventId: verifier.decisionId },
        { role: "operator", stage: "ENVIRONMENT_PROMOTED", eventId: `staging:${incident.incidentId}` },
      ],
    })
  }
  const receipt = {
    schema: "openxnet.skill-certification-receipt.v1",
    version: releaseVersion,
    approvalMode: "explicit-operator-trigger",
    actor: "goai-staging-certification-harness",
    reason: "本轮采集来源、固定计划审批、完整执行和独立验证均已核验，认证范围仅限指定 goai-staging 环境。",
    sourceReceiptSha256: sourceDocument.digest,
    sourceSnapshotSha256: document.digest,
    enterpriseEnablement: {
      status: "REQUIRES_EXPLICIT_ENABLEMENT",
      workspaceId: incidents[0].workspaceId,
      enterpriseDirectory: config.enterpriseDirectory,
      bindingWriteCount: 0,
    },
    certifiedAt: new Date().toISOString(),
    certifications,
  }
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  process.stdout.write(`${JSON.stringify({ success: true, destination, skillCount: certifications.length, enterpriseEnablement: "REQUIRES_EXPLICIT_ENABLEMENT", bindingWriteCount: 0 })}\n`)
}

module.exports = { resolveConfiguration, selectCertificationIncidents, digestBytes, stableSerialize, main }

if (require.main === module) {
  // 错误只返回固定错误码，不泄露来源正文。 / Return fixed failure codes without exposing source bodies.
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error && error.message.startsWith("GOAI_CERTIFICATION_") ? error.message : "GOAI_CERTIFICATION_INPUT_OR_OUTPUT_FAILED"}\n`)
    process.exitCode = 1
  })
}
