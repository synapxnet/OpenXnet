"use strict"

const assert = require("node:assert/strict")
const os = require("node:os")
const path = require("node:path")
const { mkdtemp, rm } = require("node:fs/promises")

const {
  ApplicationCompetitionRuntimeService,
} = require("../build-ts/desktop/competition/application-competition-runtime")
const {
  FixtureCompetitionToolAdapter,
} = require("../build-ts/desktop/competition/competition-tool-adapter")

/** 返回与 Live 冒烟测试一致的确定性 GOAI 模型契约漂移场景。 */
function competitionScenario() {
  return {
    workspaceId: "ws_goai_demo",
    title: "GOAI risk model contract drift",
    summary: "The production feature vector has 120 dimensions while model revision 18 requires 128.",
    severity: "P1",
    actorId: "enterprise-goai:investigator",
    scenario: {
      alertUid: "alert_risk_error_rate",
      serviceUid: "service_risk_inference",
      clusterId: "3",
      namespace: "risk-prod",
      workloadName: "risk-inference",
      reportUid: "qr_risk_features_120",
      assetUid: "asset_risk_features_prod",
      workflowInstanceUid: "task_risk_features_latest",
      deploymentUid: "deploy_risk_prod",
      failingRevision: 18,
      targetRevision: 17,
      expectedResourceVersion: "42",
      testDatasetRef: "fixture://goai/risk-120-v1",
    },
  }
}

/** 在快照中按 ID 查找事件，找不到时立即让冒烟测试失败。 */
function requireIncident(snapshot, incidentId) {
  for (const incident of snapshot.incidents) {
    if (incident.incidentId === incidentId) return incident
  }
  assert.fail(`Incident ${incidentId} was not found.`)
}

/** 在快照中按 ID 查找动作，找不到时立即让冒烟测试失败。 */
function requireAction(snapshot, actionId) {
  for (const action of snapshot.actions) {
    if (action.actionId === actionId) return action
  }
  assert.fail(`Action ${actionId} was not found.`)
}

/** 确认全部工具调用成功，避免只按证据数量误判完整流程。 */
function assertAllInvocationsSucceeded(invocations) {
  for (const invocation of invocations) {
    assert.equal(invocation.status, "SUCCEEDED")
  }
}

/** 按三平台汇总记录数；输入调用或证据数组，返回稳定的平台计数。 */
function countByPlatform(records) {
  const counts = { aiops: 0, dataops: 0, mlops: 0 }
  for (const record of records) {
    if (Object.hasOwn(counts, record.platform)) counts[record.platform] += 1
  }
  return counts
}

/** 把 Fixture 结晶结果写入指定 V3 HTTP Runtime；输入发布请求，返回版本记录。 */
async function persistFixtureSkillMemory(origin, publication) {
  const base = String(origin || "").replace(/\/$/u, "")
  const ownerAgent = String(process.env.OPENXNET_SYNAPXNET_MEMORY_OWNER || "openxnet-model").trim() || "openxnet-model"
  const taskId = `skill:${publication.skillId}`
  const listResponse = await fetch(`${base}/v1/synapxnet-memory/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ requesterAgent: ownerAgent, query: publication.skillId, ownerAgent, includeRetired: true, limit: 20 }),
  })
  if (!listResponse.ok) throw new Error(`V3 memory list failed (${listResponse.status}).`)
  const listing = await listResponse.json()
  const existing = (listing.items || []).find((item) => item.taskId === taskId)
  const content = [
    `Skill ID: ${publication.skillId}`,
    `Description: ${publication.description}`,
    `Trigger: ${publication.triggerContext}`,
    `Workflow:\n${publication.workflow}`,
    `Required capabilities: ${(publication.requiredCapabilities || []).join("; ")}`,
    `Verification: ${(publication.verification || []).join("; ")}`,
    `Rollback: ${publication.rollback}`,
    `Source incident: ${publication.incidentId}`,
    `Family: ${publication.familyId}`,
    `Environment: ${publication.environmentScope}`,
  ].join("\n\n")
  const payload = existing
    ? {
      memoryId: existing.memoryId,
      baseVersion: existing.version,
      actorAgent: ownerAgent,
      title: `Skill: ${publication.name}`,
      content,
      qualityScore: 0.98,
      permissions: ["incident-commander", "evidence-agent", "verification-agent"],
      tags: ["skill", "competition", publication.environmentScope, publication.familyId],
      reason: `Fixture Skill re-crystallized from ${publication.incidentId}`,
    }
    : {
      ownerAgent,
      actorAgent: ownerAgent,
      taskId,
      title: `Skill: ${publication.name}`,
      content,
      qualityScore: 0.98,
      permissions: ["incident-commander", "evidence-agent", "verification-agent"],
      tags: ["skill", "competition", publication.environmentScope, publication.familyId],
      source: "competition-fixture",
    }
  const operation = existing ? "edit" : "create"
  const response = await fetch(`${base}/v1/synapxnet-memory/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`V3 memory ${operation} failed (${response.status}).`)
  return response.json()
}

/** 执行无外部凭据的 Fixture 全链路并只输出可公开的验收摘要。 */
async function main() {
  const userDataDirectory = await mkdtemp(path.join(os.tmpdir(), "openxnet-goai-fixture-"))
  const fixtureAdapter = new FixtureCompetitionToolAdapter()
  const memoryOrigin = String(process.env.OPENXNET_SYNAPXNET_MEMORY_ORIGIN || "").trim()
  let skillMemory = null
  const runtime = new ApplicationCompetitionRuntimeService({
    userDataDirectory,
    fixtureAdapter,
    liveAdapter: fixtureAdapter,
    publishRetrospectiveSkill: async (publication) => {
      if (memoryOrigin) skillMemory = await persistFixtureSkillMemory(memoryOrigin, publication)
      return { skillId: publication.skillId }
    },
  })
  try {
    await runtime.setAdapterMode({ mode: "fixture" })
    const created = await runtime.createIncident(competitionScenario())
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "enterprise-goai:investigator",
      teamRuntime: "builtin",
    })
    assert.equal(investigated.snapshot.evidence.length, 9)
    assertAllInvocationsSucceeded(investigated.snapshot.invocations)
    assert.notEqual(investigated.approvalId, null)
    const approvalId = investigated.approvalId

    await runtime.decideApproval({
      approvalId,
      decision: "APPROVED",
      actorId: "enterprise-goai:approver",
      reason: "Fixture evidence is complete and the stable revision is approved.",
    })
    await runtime.executeRollback({
      approvalId,
      actorId: "enterprise-goai:operator",
      idempotencyKey: "idem_openxnet_fixture_dryrun_001",
      dryRun: true,
    })
    const executed = await runtime.executeRollback({
      approvalId,
      actorId: "enterprise-goai:operator",
      idempotencyKey: "idem_openxnet_fixture_rollback_001",
      dryRun: false,
    })
    assert.notEqual(executed.actionId, null)
    const replayed = await runtime.executeRollback({
      approvalId,
      actorId: "enterprise-goai:operator",
      idempotencyKey: "idem_openxnet_fixture_rollback_001",
      dryRun: false,
    })
    assert.equal(replayed.actionId, executed.actionId)

    const verified = await runtime.verifyRemediation({
      actionId: executed.actionId,
      actorId: "enterprise-goai:verifier",
    })
    const incident = requireIncident(verified.snapshot, created.incidentId)
    const action = requireAction(verified.snapshot, executed.actionId)
    assert.equal(incident.status, "RESOLVED")
    assert.equal(action.status, "SUCCEEDED")
    assert.equal(action.verificationEvidenceIds.length, 5)
    const traceResource = await runtime.readResource({
      uri: `openxnet://workspaces/ws_goai_demo/incidents/${created.incidentId}/traces/${incident.activeTraceId}`,
    })
    assert.equal(JSON.parse(traceResource.text).status, "SUCCEEDED")
    const retrospective = await runtime.exportRetrospective({ incidentId: created.incidentId })
    assert.equal(typeof retrospective.retrospectivePath, "string")
    const evaluation = await runtime.exportEvaluation({ incidentId: created.incidentId })
    assert.equal(evaluation.outcome, "RESOLVED")
    assert.equal(evaluation.skillUsageStatus, "BASELINE")
    const platformInvocationCounts = countByPlatform(verified.snapshot.invocations)
    const platformEvidenceCounts = countByPlatform(verified.snapshot.evidence)
    for (const platform of ["aiops", "dataops", "mlops"]) {
      assert.ok(platformInvocationCounts[platform] > 0, `${platform} invocation was not exercised.`)
      assert.ok(platformEvidenceCounts[platform] > 0, `${platform} evidence was not collected.`)
    }

    console.log(JSON.stringify({
      schema: "openxnet.goai.smoke-result.v1",
      mode: "fixture",
      success: true,
      evidenceCount: verified.snapshot.evidence.length,
      verificationEvidenceCount: action.verificationEvidenceIds.length,
      platformInvocationCounts,
      platformEvidenceCounts,
      auditReceiptCount: verified.snapshot.auditReceipts.length,
      incidentStatus: incident.status,
      actionStatus: action.status,
      idempotencyReplayVerified: true,
      retrospectiveCreated: true,
      evaluationCreated: true,
      skillMemoryPersisted: skillMemory !== null,
      skillMemoryId: skillMemory?.memoryId || null,
      skillMemoryVersion: skillMemory?.version || null,
    }))
  } finally {
    await rm(userDataDirectory, { recursive: true, force: true })
  }
}

/** 把冒烟失败转换为不含堆栈和凭据的结构化错误并设置失败退出码。 */
function handleFailure(error) {
  console.error(JSON.stringify({
    schema: "openxnet.goai.smoke-result.v1",
    mode: "fixture",
    success: false,
    message: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
}

main().catch(handleFailure)
