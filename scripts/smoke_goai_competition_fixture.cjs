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

/** 特征漂移闭环固定验证业务恢复、数据集、推理探针、目标修订和发布状态五类证据。 */
const EXPECTED_FEATURE_DRIFT_VERIFICATION_EVIDENCE_COUNT = 5

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

/** 执行无外部凭据的 Fixture 全链路并只输出可公开的验收摘要。 */
async function main() {
  const userDataDirectory = await mkdtemp(path.join(os.tmpdir(), "openxnet-goai-fixture-"))
  const fixtureAdapter = new FixtureCompetitionToolAdapter()
  const runtime = new ApplicationCompetitionRuntimeService({
    userDataDirectory,
    fixtureAdapter,
    liveAdapter: fixtureAdapter,
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
    assert.equal(
      action.verificationEvidenceIds.length,
      EXPECTED_FEATURE_DRIFT_VERIFICATION_EVIDENCE_COUNT,
    )
    const traceResource = await runtime.readResource({
      uri: `openxnet://workspaces/ws_goai_demo/incidents/${created.incidentId}/traces/${incident.activeTraceId}`,
    })
    assert.equal(JSON.parse(traceResource.text).status, "SUCCEEDED")
    const retrospective = await runtime.exportRetrospective({ incidentId: created.incidentId })
    assert.equal(typeof retrospective.retrospectivePath, "string")

    console.log(JSON.stringify({
      schema: "openxnet.goai.smoke-result.v1",
      mode: "fixture",
      success: true,
      evidenceCount: verified.snapshot.evidence.length,
      verificationEvidenceCount: action.verificationEvidenceIds.length,
      auditReceiptCount: verified.snapshot.auditReceipts.length,
      incidentStatus: incident.status,
      actionStatus: action.status,
      idempotencyReplayVerified: true,
      retrospectiveCreated: true,
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
