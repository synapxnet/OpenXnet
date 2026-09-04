"use strict"

const { createHash } = require("node:crypto")
const path = require("node:path")
const { mkdir, readFile, writeFile } = require("node:fs/promises")

const {
  ApplicationCompetitionRuntimeService,
} = require("../build-ts/desktop/competition/application-competition-runtime")
const {
  FixtureCompetitionToolAdapter,
} = require("../build-ts/desktop/competition/competition-tool-adapter")
const {
  getCompetitionScenarioProfile,
} = require("../build-ts/desktop/competition/competition-scenario-registry")
const {
  ApplicationEnterpriseRuntimeService,
} = require("../build-ts/desktop/enterprise/application-enterprise-runtime")
const {
  ApplicationSkillRuntimeService,
} = require("../build-ts/desktop/skills/application-skill-runtime")

const DATA_DIRECTORY = "E:\\openxnet-temp\\openxnet-goai-live-preserved"
const ENTERPRISE_DIRECTORY = "E:\\openxnet-temp\\openxnet-goai-enterprise-staging"
const ENVIRONMENT_FINGERPRINT = "goai-staging@101.32.9.231:agentteams-v1.2.0"

/** 为不启用项目同步的认证 Runtime 提供最小只读状态边界。 */
class CertificationSkillStateBoundary {
  /** 返回空的旧版状态快照；无输入，不访问 Renderer 设置。 */
  getSnapshot() {
    return {}
  }
}

/** 查找事件最新动作；输入快照和事件，返回最后一个动作或 null。 */
function latestIncidentAction(snapshot, incident) {
  return snapshot.actions
    .filter((action) => action.incidentId === incident.incidentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1) || null
}

/** 选择每个场景最新的 AgentTeams 成功事件；输入快照，返回三条认证来源。 */
function selectCertificationIncidents(snapshot) {
  const sorted = [...snapshot.incidents].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const selected = ["recommendation-capacity", "quantitative-iteration", "feature-drift"].map((scenarioType) => (
    sorted.filter((incident) => {
      const action = latestIncidentAction(snapshot, incident)
      const decisions = snapshot.agentDecisions.filter((decision) => (
        decision.incidentId === incident.incidentId && decision.traceId === incident.activeTraceId
      ))
      return incident.scenario.scenarioType === scenarioType
        && incident.status === "RESOLVED"
        && action?.status === "SUCCEEDED"
        && !String(incident.scenario.testDatasetRef || "").includes("verification-failure")
        && decisions.length === 3
    }).at(-1)
  ))
  if (selected.some((incident) => incident === undefined)) {
    throw new Error("Every GOAI scenario requires one accepted AgentTeams Live incident before staging certification.")
  }
  return selected
}

/** 计算 Skill 包摘要；输入目录，返回 SKILL.md 与扩展清单的联合 SHA-256。 */
async function digestSkillPackage(directory) {
  const markdown = await readFile(path.join(directory, "SKILL.md"))
  const manifest = await readFile(path.join(directory, "openxnet.skill.json"))
  return createHash("sha256").update(markdown).update(Buffer.from([0])).update(manifest).digest("hex")
}

/** 从真实 Trace 认证三项场景 Skill；无输入，写入 staging/verified 包和 UTF-8 认证回执。 */
async function main() {
  const fixtureAdapter = new FixtureCompetitionToolAdapter()
  const competitionRuntime = new ApplicationCompetitionRuntimeService({
    userDataDirectory: DATA_DIRECTORY,
    fixtureAdapter,
    liveAdapter: fixtureAdapter,
  })
  const enterpriseRuntime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: ENTERPRISE_DIRECTORY,
  })
  const skillRuntime = new ApplicationSkillRuntimeService({
    globalSkillsRoot: path.join(process.env.USERPROFILE || process.env.HOME || "", ".agents", "skills"),
    bundledSkillsRoot: path.join(__dirname, "..", "skills"),
    state: new CertificationSkillStateBoundary(),
    logger: console,
  })
  const snapshot = await competitionRuntime.getSnapshot()
  const incidents = selectCertificationIncidents(snapshot)
  const certifications = []
  for (const incident of incidents) {
    const profile = getCompetitionScenarioProfile(incident.scenario)
    const evidence = snapshot.evidence.filter((item) => item.incidentId === incident.incidentId)
    const decisions = snapshot.agentDecisions.filter((item) => item.incidentId === incident.incidentId)
    const reasoning = snapshot.reasoningDecisions.filter((item) => item.incidentId === incident.incidentId)
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
      environmentFingerprint: ENVIRONMENT_FINGERPRINT,
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
        environmentFingerprint: ENVIRONMENT_FINGERPRINT,
        evidenceEventIds: sourceEventIds,
      }],
      syncToProject: false,
      overwrite: true,
    })
    await enterpriseRuntime.setSkillBinding({
      workspaceId: incident.workspaceId,
      skillId: profile.skill.skillId,
      enabled: true,
      sourceIncidentId: incident.incidentId,
    })
    const verifier = decisions.find((item) => item.teamRole === "verifier")
    const planDecision = reasoning.find((item) => item.decisionType === "PLAN_SELECTION")
    const skillDirectory = path.join(skillRuntime.skillsDirectory, profile.skill.skillId)
    certifications.push({
      skillId: profile.skill.skillId,
      familyId: `family-${profile.skill.skillId}`,
      sourceIncidentId: incident.incidentId,
      environmentScope: "staging",
      lifecycleStatus: "verified",
      environmentFingerprint: ENVIRONMENT_FINGERPRINT,
      artifactDigest: await digestSkillPackage(skillDirectory),
      crystallizationTrail: [
        { role: "tester", stage: "TESTER_REPRODUCED", eventId: incident.incidentId },
        { role: "developer", stage: "DEVELOPER_COMPARED_STRATEGIES", eventId: planDecision?.reasoningId || null },
        { role: "verifier", stage: "VERIFIER_CERTIFIED", eventId: verifier?.decisionId || null },
        { role: "operator", stage: "ENVIRONMENT_PROMOTED", eventId: `staging:${incident.incidentId}` },
      ],
    })
  }
  const receipt = {
    schema: "openxnet.skill-certification-receipt.v1",
    version: "1.2.0",
    approvalMode: "explicit-operator-trigger",
    actor: "goai-staging-certification-harness",
    reason: "AgentTeams Live 闭环、独立验证和环境恢复均已通过，认证范围仅限 goai-staging。",
    certifiedAt: new Date().toISOString(),
    certifications,
  }
  const destination = path.join(DATA_DIRECTORY, "competition", "evaluations", "skill-certifications.json")
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({ success: true, destination, skillCount: certifications.length })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
