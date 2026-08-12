"use strict"

const assert = require("node:assert/strict")
const { randomBytes } = require("node:crypto")
const os = require("node:os")
const path = require("node:path")

const {
  ApplicationCompetitionRuntimeService,
} = require("../build-ts/desktop/competition/application-competition-runtime")
const {
  FixtureCompetitionToolAdapter,
} = require("../build-ts/desktop/competition/competition-tool-adapter")
const {
  ApplicationEnterpriseInsightsRuntimeService,
} = require("../build-ts/desktop/enterprise/application-enterprise-insights-runtime")
const {
  ExecutionEngineSupervisor,
} = require("../build-ts/desktop/workers/execution-engine-supervisor")

/** 解析真实 OpenXnet 用户数据目录；输入环境变量，返回规范绝对路径。 */
function resolveUserDataDirectory() {
  const explicit = String(process.env.OPENXNET_USER_DATA_DIR || "").trim()
  if (explicit) return path.resolve(explicit)
  const appData = String(process.env.APPDATA || "").trim()
  if (!appData) throw new Error("APPDATA is required when OPENXNET_USER_DATA_DIR is not set.")
  return path.join(appData, "OpenXnet")
}

/** 创建真实 Execution Engine 启动定义；输入令牌和用户目录，返回受限回环进程配置。 */
function createEngineLaunch(token, userDataDirectory) {
  const projectRoot = path.resolve(__dirname, "..")
  const executable = process.env.OPENXNET_PYTHON_EXECUTABLE
    ? path.resolve(process.env.OPENXNET_PYTHON_EXECUTABLE)
    : path.join(projectRoot, ".venv", "Scripts", "python.exe")
  return {
    command: executable,
    arguments: ["-u", "server.py", "--host", "127.0.0.1", "--port", "0"],
    workingDirectory: projectRoot,
    environment: {
      ...process.env,
      OPENXNET_RUNTIME_ROLE: "execution-engine",
      OPENXNET_USER_DATA_DIR: userDataDirectory,
      OPENXNET_TASK_RPC_TOKEN: token,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      PYTHONUNBUFFERED: "1",
    },
  }
}

/** 将当前比赛事件投影到真实神经符号和时序知识图谱并输出脱敏验收摘要。 */
async function main() {
  const userDataDirectory = resolveUserDataDirectory()
  const token = randomBytes(32).toString("hex")

  /** 为本轮验证返回固定启动定义；无输入，不读取额外配置。 */
  function launchEngine() {
    return createEngineLaunch(token, userDataDirectory)
  }

  const supervisor = new ExecutionEngineSupervisor({
    token,
    createLaunch: launchEngine,
    startupTimeoutMs: 120_000,
    shutdownTimeoutMs: 10_000,
    idleTimeoutMs: 5 * 60_000,
  })

  /** 获取一个真实引擎请求租约；无输入，返回已认证回环 Origin。 */
  async function acquireEngine() {
    return supervisor.acquire()
  }

  const insights = new ApplicationEnterpriseInsightsRuntimeService({
    userDataDirectory,
    token,
    acquireEngine,
    logger: console,
  })
  const fixture = new FixtureCompetitionToolAdapter()

  /** 同步一份脱敏比赛投影；输入投影，返回引擎幂等计数。 */
  async function synchronizeKnowledge(projection) {
    return insights.synchronizeCompetitionKnowledge(projection)
  }

  const competition = new ApplicationCompetitionRuntimeService({
    userDataDirectory,
    fixtureAdapter: fixture,
    liveAdapter: fixture,
    synchronizeKnowledge,
    logger: console,
  })
  try {
    const snapshot = await competition.getSnapshot()
    const incident = [...snapshot.incidents].reverse().find((item) => item.status === "RESOLVED")
    assert.ok(incident, "A resolved GOAI incident is required for knowledge verification.")
    await competition.exportRetrospective({ incidentId: incident.incidentId })

    const neuro = await insights.loadNeuroDashboard({ limit: 200 })
    const search = await insights.searchNeuroSymbols({ query: incident.incidentId, operator: "", limit: 100 })
    const graph = await insights.loadKnowledgeGraph({ limit: 500 })
    const entity = await insights.queryKnowledgeGraphEntity({
      subject: `Incident:${incident.incidentId}`,
      limit: 100,
    })
    const incidentSymbols = search.symbols.filter((item) => item.metadata.incidentId === incident.incidentId)
    assert.ok(neuro.stats.competitionSymbols >= 7, "Competition neuro-symbol projection is incomplete.")
    assert.ok(incidentSymbols.length >= 7, "Incident neuro-symbol search is incomplete.")
    assert.ok(graph.stats.active_competition_triples > 0, "Competition knowledge graph has no active triples.")
    assert.ok(entity.facts.length > 0, "Incident knowledge graph entity has no facts.")

    console.log(JSON.stringify({
      success: true,
      incidentId: incident.incidentId,
      competitionSymbols: neuro.stats.competitionSymbols,
      incidentSymbols: incidentSymbols.length,
      activeCompetitionTriples: graph.stats.active_competition_triples,
      incidentFacts: entity.facts.length,
    }))
  } finally {
    await supervisor.stop()
  }
}

/** 运行验证并将固定错误消息写入标准错误；无输入和返回。 */
async function run() {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

void run()
