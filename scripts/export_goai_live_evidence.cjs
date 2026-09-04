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

/** 读取并校验 Live 证据数据目录；无输入，返回位于 E 盘的现有目录。 */
function requireDataDirectory() {
  const value = String(
    process.env.OPENXNET_GOAI_SMOKE_DATA_DIR
      || "E:\\openxnet-temp\\openxnet-goai-live-preserved",
  ).trim()
  const resolved = path.resolve(value)
  if (!resolved.toLocaleLowerCase().startsWith("e:\\")) {
    throw new Error("Live evidence data directory must stay on drive E.")
  }
  return resolved
}

/** 计算证据文件摘要；输入绝对路径，返回十六进制 SHA-256。 */
async function digestFile(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex")
}

/** 查找事件的最新动作；输入控制面快照和事件，返回按创建时间排序后的最后动作。 */
function latestIncidentAction(snapshot, incident) {
  return snapshot.actions
    .filter((action) => action.incidentId === incident.incidentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1) || null
}

/** 统计事件当前 Trace 的 AgentTeams 决策；输入快照和事件，返回身份化阶段记录。 */
function incidentAgentDecisions(snapshot, incident) {
  return snapshot.agentDecisions.filter((decision) => (
    decision.incidentId === incident.incidentId && decision.traceId === incident.activeTraceId
  ))
}

/** 判断事件是否满足 Live 成功证据门槛；输入快照和事件，返回三角色、成功动作与终态是否齐全。 */
function isAcceptedSuccess(snapshot, incident) {
  const action = latestIncidentAction(snapshot, incident)
  return incident.status === "RESOLVED"
    && action?.status === "SUCCEEDED"
    && !String(incident.scenario.testDatasetRef || "").includes("verification-failure")
    && incidentAgentDecisions(snapshot, incident).length === 3
}

/** 判断事件是否满足 Live 失败补偿门槛；输入快照和事件，返回失败、三角色与两步补偿是否齐全。 */
function isAcceptedFailure(snapshot, incident) {
  const action = latestIncidentAction(snapshot, incident)
  return incident.scenario.scenarioType === "feature-drift"
    && incident.status === "FAILED"
    && action?.status === "FAILED"
    && action.compensationStatus === "SUCCEEDED"
    && action.compensationSteps.length === 2
    && incidentAgentDecisions(snapshot, incident).length === 3
}

/** 选择三条成功链和一条失败补偿链；输入快照，返回排除调试失败的四个验收事件。 */
function selectAcceptedIncidents(snapshot) {
  const sorted = [...snapshot.incidents].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const successes = ["recommendation-capacity", "quantitative-iteration", "feature-drift"].map((scenarioType) => (
    sorted.filter((incident) => (
      incident.scenario.scenarioType === scenarioType && isAcceptedSuccess(snapshot, incident)
    )).at(-1)
  ))
  const failure = sorted.filter((incident) => isAcceptedFailure(snapshot, incident)).at(-1)
  if (successes.some((incident) => incident === undefined) || failure === undefined) {
    throw new Error("Three accepted Live successes and one compensated failure are required.")
  }
  return [...successes, failure]
}

/** 导出全部 Live 终态事件；无输入，写入 UTF-8 证据与总清单并输出公开摘要。 */
async function main() {
  const userDataDirectory = requireDataDirectory()
  const fixtureAdapter = new FixtureCompetitionToolAdapter()
  const runtime = new ApplicationCompetitionRuntimeService({
    userDataDirectory,
    fixtureAdapter,
    liveAdapter: fixtureAdapter,
  })
  const snapshot = await runtime.getSnapshot()
  const incidents = selectAcceptedIncidents(snapshot)
  const exports = []
  for (const incident of incidents) {
    const result = await runtime.exportEvaluation({ incidentId: incident.incidentId })
    const files = [result.reportPath, result.telemetryPath, result.agentTeamsEventsPath]
    exports.push({
      incidentId: incident.incidentId,
      scenarioType: incident.scenario.scenarioType,
      outcome: result.outcome,
      skillUsageStatus: result.skillUsageStatus,
      files: await Promise.all(files.map(async (filePath) => ({
        path: filePath,
        sha256: await digestFile(filePath),
      }))),
    })
  }
  const manifest = {
    schema: "openxnet.goai-live-evidence-manifest.v1",
    version: "1.2.0",
    environmentClaim: "staging",
    generatedAt: new Date().toISOString(),
    incidentCount: exports.length,
    exports,
  }
  const manifestPath = path.join(userDataDirectory, "competition", "evaluations", "live-evidence-manifest.json")
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({
    success: true,
    manifestPath,
    incidentCount: exports.length,
    outcomes: exports.map((item) => ({
      incidentId: item.incidentId,
      scenarioType: item.scenarioType,
      outcome: item.outcome,
    })),
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
