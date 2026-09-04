"use strict"

const assert = require("node:assert/strict")
const { createHmac } = require("node:crypto")
const { rm } = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")

const {
  ApplicationCompetitionRuntimeService,
} = require("../build-ts/desktop/competition/application-competition-runtime")
const {
  FixtureCompetitionToolAdapter,
  HttpCompetitionToolAdapter,
} = require("../build-ts/desktop/competition/competition-tool-adapter")
const {
  getCompetitionScenarioProfile,
} = require("../build-ts/desktop/competition/competition-scenario-registry")
const {
  HttpCompetitionApprovalPublisher,
} = require("../build-ts/desktop/competition/competition-approval-publisher")
const {
  HttpCompetitionAgentTeamsAdapter,
} = require("../build-ts/desktop/competition/competition-agentteams-adapter")
const {
  ApplicationEnterpriseRuntimeService,
} = require("../build-ts/desktop/enterprise/application-enterprise-runtime")
const {
  ApplicationSkillRuntimeService,
} = require("../build-ts/desktop/skills/application-skill-runtime")

/** 读取必填环境变量；输入名称，返回去除首尾空白的值。 */
function requireEnvironment(name) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

/** 读取显式布尔环境变量；输入名称，仅在值为 1 时返回 true。 */
function environmentFlag(name) {
  return String(process.env[name] || "").trim() === "1"
}

/** 强制确认本轮只连接比赛 staging；无输入和返回，未显式确认时拒绝执行。 */
function requireStagingConfirmation() {
  if (!environmentFlag("OPENXNET_GOAI_SMOKE_CONFIRM_STAGING")) {
    throw new Error("OPENXNET_GOAI_SMOKE_CONFIRM_STAGING must be 1.")
  }
}

/** 读取并校验 staging HTTPS 入口；输入变量名，返回不含内嵌凭据的规范 URL。 */
function requireStagingEndpoint(name) {
  const value = requireEnvironment(name)
  let endpoint
  try {
    endpoint = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`)
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error(`${name} must use HTTPS without embedded credentials.`)
  }
  return endpoint.toString().replace(/\/$/, "")
}

/** 校验自动清理目录确实属于本轮临时 smoke；输入目录，无返回，越界时拒绝删除。 */
function assertDisposableSmokeDirectory(directory) {
  const resolved = path.resolve(directory)
  const configuredRoot = String(process.env.OPENXNET_GOAI_SMOKE_TEMP_ROOT || "").trim()
  const temporaryRoot = `${path.resolve(configuredRoot || os.tmpdir())}${path.sep}`
  if (!resolved.startsWith(temporaryRoot) || !path.basename(resolved).startsWith("openxnet-goai-live-")) {
    throw new Error("GOAI smoke cleanup directory is outside the disposable boundary.")
  }
}

/** 为不启用项目同步的 Skill Runtime 提供最小只读状态边界。 */
class SmokeSkillStateBoundary {
  /** 返回空的旧版状态快照；无输入，不访问真实 Renderer 配置。 */
  getSnapshot() {
    return {}
  }
}

/** 为 Live Smoke 保存 Workspace 范围的脱敏知识投影，不保存平台原始证据或凭据。 */
class SmokeCompetitionKnowledgeBoundary {
  constructor() {
    this.projections = new Map()
  }

  /** 幂等保存一个 Incident 投影；输入 Runtime 脱敏请求，返回固定成功计数。 */
  async synchronize(request) {
    this.projections.set(request.incident.incidentId, structuredClone(request))
    return {
      schema: "openxnet.competition-knowledge.v1",
      success: true,
      symbols: request.decisions.length + (request.reasoningDecisions || []).length,
      activeFacts: request.evidence.length + request.actions.length,
      invalidatedFacts: 0,
    }
  }

  /** 按 Workspace 查询历史场景与 Skill 事实；输入 Workspace 和任务文本，返回图谱兼容引用。 */
  async retrieve(workspaceId, query) {
    const normalizedQuery = String(query || "").toLocaleLowerCase()
    const facts = []
    for (const projection of this.projections.values()) {
      if (projection.incident.workspaceId !== workspaceId) continue
      const subject = `Incident:${projection.incident.incidentId}`
      const scenarioObject = `Scenario:${projection.incident.scenarioType}`
      const relevance = normalizedQuery.includes(projection.incident.scenarioType.toLocaleLowerCase()) ? 1 : 0.8
      facts.push(
        { subject, predicate: "belongs_to_workspace", object: `Workspace:${workspaceId}`, confidence: 1 },
        { subject, predicate: "has_scenario", object: scenarioObject, confidence: relevance },
      )
      if (projection.retrospective?.name) {
        facts.push({
          subject,
          predicate: "crystallized_skill",
          object: `Skill:${projection.retrospective.name}`,
          confidence: relevance,
        })
      }
    }
    return facts.slice(0, 100)
  }
}

/** 创建复盘 Skill 发布器；输入技能与企业 Runtime，返回结晶并启用企业绑定的异步函数。 */
function createRetrospectiveSkillPublisher(skillRuntime, enterpriseRuntime) {
  /** 结晶单个复盘 Skill 并绑定来源 Workspace；输入发布请求，返回最终技能 ID。 */
  async function publishRetrospectiveSkill(request) {
    const writeResult = await skillRuntime.crystallizeSkill({
      name: request.name,
      skillId: request.skillId,
      description: request.description,
      triggerContext: request.triggerContext,
      workflow: request.workflow,
      notes: request.notes,
      requiredCapabilities: request.requiredCapabilities,
      verification: request.verification,
      rollback: request.rollback,
      examples: [],
      counterExamples: [],
      sourceEventIds: request.sourceEventIds,
      status: "candidate",
      source: "rehearsal",
      familyId: request.familyId,
      problemFingerprint: request.problemFingerprint,
      evidenceOrigin: request.evidenceOrigin,
      derivationMethod: request.derivationMethod,
      environmentScope: request.environmentScope,
      syncToProject: false,
      overwrite: true,
    })
    const skillId = String(writeResult.installedIds[0] || request.skillId)
    await enterpriseRuntime.setSkillBinding({
      workspaceId: request.workspaceId,
      skillId,
      enabled: true,
      sourceIncidentId: request.incidentId,
    })
    return { skillId }
  }
  return publishRetrospectiveSkill
}

/** 把普通 JSON 编码为 JWT Base64URL 段。 */
function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

/** 创建按 Workspace 和单个工具受限的五分钟 HS256 委托令牌解析器。 */
function createDelegationResolver(secret) {
  if (secret.length < 32) throw new Error("OPENXNET_AGENT_DELEGATION_SECRET is too short.")
  return async (_platform, request) => {
    const issuedAt = Math.floor(Date.now() / 1_000)
    const header = encodeJwtPart({ alg: "HS256", typ: "JWT" })
    const payload = encodeJwtPart({
      sub: request.actorId,
      aud: "openxnet-agent-adapter",
      iat: issuedAt,
      exp: issuedAt + 300,
      workspace_id: request.workspaceId,
      tools: [request.toolName],
    })
    const signingInput = `${header}.${payload}`
    const signature = createHmac("sha256", secret).update(signingInput, "utf8").digest("base64url")
    return `${signingInput}.${signature}`
  }
}

/** 创建绑定请求、Workspace、Incident、Trace 和模板版本的 AgentTeams 五分钟委托令牌。 */
function createAgentTeamsDelegationResolver(secret) {
  if (secret.length < 32) throw new Error("OPENXNET_AGENTTEAMS_DELEGATION_SECRET is too short.")
  return async (context) => {
    const issuedAt = Math.floor(Date.now() / 1_000)
    const header = encodeJwtPart({ alg: "HS256", typ: "JWT" })
    const payload = encodeJwtPart({
      iss: "openxnet-desktop",
      aud: "openxnet-agentteams-adapter",
      sub: "enterprise-goai-smoke",
      iat: issuedAt,
      exp: issuedAt + 300,
      scopes: [context.stage ? "agentteams:task:dispatch" : "agentteams:team:prepare"],
      request_id: context.requestId,
      workspace_id: context.workspaceId,
      incident_id: context.incidentId,
      trace_id: context.traceId,
      team_template_id: context.teamTemplateId,
      team_template_version: context.teamTemplateVersion,
      ...(context.stage ? { team_name: context.teamName, stage: context.stage } : {}),
    })
    const signingInput = `${header}.${payload}`
    const signature = createHmac("sha256", secret).update(signingInput, "utf8").digest("base64url")
    return `${signingInput}.${signature}`
  }
}

/** 解析 Live Smoke 的团队模式；无输入，返回 builtin 或 agentteams，非法值立即拒绝。 */
function resolveTeamRuntime() {
  const value = String(process.env.OPENXNET_GOAI_SMOKE_TEAM_RUNTIME || "agentteams").trim().toLowerCase()
  if (value !== "builtin" && value !== "agentteams") {
    throw new Error("OPENXNET_GOAI_SMOKE_TEAM_RUNTIME must be builtin or agentteams.")
  }
  return value
}

/** 返回三条 PPT 场景及其完整计划验收标准；输入是否强制第三场景验证失败。 */
function competitionScenarios(expectVerificationFailure) {
  const common = {
    workspaceId: "ws_goai_demo",
    severity: "P1",
    actorId: "enterprise-goai:investigator",
  }
  return [
    {
      request: {
        ...common,
        title: "推荐服务 GPU 推理队列拥塞",
        summary: "GPU 已饱和且推理队列积压，CPU HPA 未能触发扩容。",
        scenario: {
          scenarioType: "recommendation-capacity",
          alertUid: "alert_rec_p99_spike",
          serviceUid: "service_rec_inference",
          clusterId: "3",
          namespace: "recommendation-prod",
          workloadName: "recommendation-inference",
          reportUid: "qr_rec_traffic_latest",
          assetUid: "asset_rec_features_prod",
          workflowInstanceUid: "task_rec_features_latest",
          deploymentUid: "deploy_recommendation_prod",
          failingRevision: 6,
          targetRevision: 20,
          rollbackRevision: 6,
          expectedResourceVersion: "42",
          testDatasetRef: "staging://goai/recommendation-dcn-v1/probe",
        },
      },
      planId: "recommendation-capacity-recovery-v2",
      investigationEvidenceCount: 6,
      executionStepCount: 7,
      verificationEvidenceCount: 5,
    },
    {
      request: {
        ...common,
        title: "量化模型归因与受控迭代",
        summary: "低波动与量能基线退化，盘后受控完成真实数据、训练、评估和模拟盘发布。",
        scenario: {
          scenarioType: "quantitative-iteration",
          alertUid: "alert_quant_ic_degradation",
          serviceUid: "service_quant_signal",
          clusterId: "3",
          namespace: "quant-prod",
          workloadName: "quant-signal-inference",
          reportUid: "report_quant_a_share_v1",
          assetUid: "asset_quant_market_daily",
          workflowInstanceUid: "task_quant_a_share_eod_ready",
          deploymentUid: "deploy_quant_ashare_research",
          failingRevision: 1,
          targetRevision: 2,
          rollbackRevision: 1,
          expectedResourceVersion: "42",
          testDatasetRef: "quant://a-share-factor-demo-v1/test",
        },
      },
      planId: "quantitative-ashare-model-iteration-v3",
      investigationEvidenceCount: 6,
      executionStepCount: 7,
      verificationEvidenceCount: 6,
    },
    {
      request: {
        ...common,
        title: "跨域特征漂移恢复",
        summary: "上游采集变更导致风控模型输入漂移，需止损、回填、重训练并灰度发布。",
        scenario: {
          scenarioType: "feature-drift",
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
          targetRevision: 19,
          rollbackRevision: 17,
          expectedResourceVersion: "42",
          testDatasetRef: expectVerificationFailure
            ? "staging://goai/verification-failure-v1"
            : "staging://goai/dataops/assets/asset_risk_features_prod/versions/risk-repaired-v19",
        },
      },
      planId: "feature-drift-full-recovery-v2",
      investigationEvidenceCount: 9,
      executionStepCount: 9,
      verificationEvidenceCount: 5,
    },
  ]
}

/** 按显式白名单筛选 Live Smoke 场景；无配置时返回全部场景，非法值立即拒绝。 */
function selectCompetitionScenarios(scenarios) {
  const requestedType = String(process.env.OPENXNET_GOAI_SMOKE_SCENARIO_TYPE || "").trim()
  if (!requestedType) return scenarios
  const selected = scenarios.filter((scenario) => scenario.request.scenario.scenarioType === requestedType)
  if (selected.length !== 1) {
    throw new Error("OPENXNET_GOAI_SMOKE_SCENARIO_TYPE is invalid.")
  }
  return selected
}

/** 仅保留独立验证阈值字段，排除参数、令牌和自由文本证据正文。 */
function verificationEvidenceSummary(evidence) {
  const allowedFields = [
    "status", "p99Ms", "p95Ms", "batchQueueSize", "successRate", "errorRate",
    "recovered", "queueAwareAutoscaling", "businessKpiRecovered", "passed",
    "activeRevision", "trafficPercent", "informationCoefficient",
    "informationCoefficientThreshold", "sharpeImprovement",
  ]
  const values = {}
  for (const field of allowedFields) {
    const value = evidence.data?.[field]
    if (["string", "number", "boolean"].includes(typeof value)) values[field] = value
  }
  return { toolName: evidence.toolName, values }
}

/** 为失败异常附加不含参数、令牌和自由文本正文的脱敏诊断。 */
function attachSmokeDiagnostics(error, snapshot) {
  const normalized = error instanceof Error ? error : new Error(String(error))
  normalized.goaiDiagnostics = {
    failedInvocations: snapshot.invocations
      .filter((invocation) => invocation.status === "FAILED")
      .slice(-20)
      .map((invocation) => ({
      toolName: invocation.toolName,
      status: invocation.status,
      errorCode: invocation.errorCode,
      errorMessage: invocation.errorMessage,
      })),
    recentVerificationEvidence: snapshot.evidence
      .slice(-12)
      .map(verificationEvidenceSummary),
  }
  return normalized
}

/** 执行真实跨平台竞赛流程并只输出不含凭据的验收摘要。 */
async function main() {
  requireStagingConfirmation()
  const teamRuntime = resolveTeamRuntime()
  const preserveCompetitionData = environmentFlag("OPENXNET_GOAI_SMOKE_PRESERVE_DATA")
  const publishEnterpriseSkill = environmentFlag("OPENXNET_GOAI_SMOKE_PUBLISH_ENTERPRISE_SKILL")
  const expectSkillReuse = environmentFlag("OPENXNET_GOAI_SMOKE_EXPECT_SKILL_REUSE")
  const expectVerificationFailure = environmentFlag("OPENXNET_GOAI_SMOKE_EXPECT_VERIFICATION_FAILURE")
  const prepareAgentTeamsOnly = environmentFlag("OPENXNET_GOAI_SMOKE_PREPARE_AGENTTEAMS_ONLY")
  const endpoints = {
    aiops: requireStagingEndpoint("OPENXNET_AIOPS_BASE_URL"),
    dataops: requireStagingEndpoint("OPENXNET_DATAOPS_BASE_URL"),
    mlops: requireStagingEndpoint("OPENXNET_MLOPS_BASE_URL"),
  }
  const resolveDelegationToken = createDelegationResolver(
    requireEnvironment("OPENXNET_AGENT_DELEGATION_SECRET"),
  )
  const liveAdapter = new HttpCompetitionToolAdapter({
    resolveEndpoint: async (platform) => endpoints[platform],
    resolveDelegationToken,
  })
  const publisher = new HttpCompetitionApprovalPublisher({
    resolveEndpoint: async () => requireStagingEndpoint("OPENXNET_COMPETITION_APPROVAL_BASE_URL"),
    resolveIssuerToken: async () => requireEnvironment("OPENXNET_APPROVAL_ISSUER_TOKEN"),
  })
  const fixtureAdapter = new FixtureCompetitionToolAdapter()
  const userDataDirectory = requireEnvironment("OPENXNET_GOAI_SMOKE_DATA_DIR")
  assertDisposableSmokeDirectory(userDataDirectory)
  const enterpriseRuntime = teamRuntime === "agentteams"
    ? new ApplicationEnterpriseRuntimeService({
      userDataDirectory: requireEnvironment("OPENXNET_GOAI_ENTERPRISE_DATA_DIR"),
    })
    : null
  const teamTemplate = enterpriseRuntime === null
    ? null
    : (await enterpriseRuntime.listTeamTemplates()).teamTemplates.find((template) => (
      template.workspaceId === "ws_goai_demo" && template.enabled
    ))
  if (teamRuntime === "agentteams") {
    assert.ok(teamTemplate, "An enabled ws_goai_demo team template is required.")
  }
  if (publishEnterpriseSkill && enterpriseRuntime === null) {
    throw new Error("Enterprise Skill publication requires the AgentTeams enterprise runtime.")
  }
  const skillRuntime = enterpriseRuntime === null
    ? null
    : new ApplicationSkillRuntimeService({
      globalSkillsRoot: path.join(os.homedir(), ".agents", "skills"),
      bundledSkillsRoot: path.join(__dirname, "..", "skills"),
      state: new SmokeSkillStateBoundary(),
      logger: console,
    })
  const knowledgeBoundary = new SmokeCompetitionKnowledgeBoundary()
  const agentTeamsAdapter = teamRuntime === "agentteams"
    ? new HttpCompetitionAgentTeamsAdapter({
      resolveEndpoint: async () => requireStagingEndpoint("OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL"),
      resolveDelegationToken: createAgentTeamsDelegationResolver(
        requireEnvironment("OPENXNET_AGENTTEAMS_DELEGATION_SECRET"),
      ),
    })
    : null
  const runtime = new ApplicationCompetitionRuntimeService({
    userDataDirectory,
    fixtureAdapter,
    liveAdapter,
    publishApproval: (approval) => publisher.publish(approval),
    resolveTeamTemplate: enterpriseRuntime === null
      ? undefined
      : (teamTemplateId) => enterpriseRuntime.resolveTeamTemplate(teamTemplateId),
    resolveEnabledEnterpriseSkill: enterpriseRuntime === null || skillRuntime === null
      ? undefined
      : async (workspaceId, skillId) => {
        const bindings = await enterpriseRuntime.listSkillBindings()
        const binding = bindings.bindings.find((item) => (
          item.workspaceId === workspaceId && item.skillId === skillId && item.enabled
        ))
        if (!binding) return null
        const catalog = await skillRuntime.listSkills()
        const skill = catalog.skills.find((item) => item.id === skillId)
        if (!skill) return null
        return {
          sourceIncidentId: binding.sourceIncidentId,
          lifecycleStatus: skill.lifecycleStatus,
          environmentScope: skill.environmentScope,
          productionEligible: skill.productionEligible,
        }
      },
    retrieveCompetitionKnowledge: (workspaceId, query) => knowledgeBoundary.retrieve(workspaceId, query),
    synchronizeKnowledge: (request) => knowledgeBoundary.synchronize(request),
    agentTeamsIsolatedServiceEnabled: teamRuntime === "agentteams",
    prepareAgentTeam: agentTeamsAdapter === null
      ? undefined
      : (incident, traceId, resolvedTemplate) => agentTeamsAdapter.prepare(incident, traceId, resolvedTemplate),
    dispatchAgentTeamTask: agentTeamsAdapter === null
      ? undefined
      : (input) => agentTeamsAdapter.dispatch(input),
    publishRetrospectiveSkill: skillRuntime === null || enterpriseRuntime === null
      ? undefined
      : createRetrospectiveSkillPublisher(skillRuntime, enterpriseRuntime),
  })
  try {
    if (prepareAgentTeamsOnly) {
      if (agentTeamsAdapter === null || enterpriseRuntime === null || teamTemplate === null) {
        throw new Error("AgentTeams prepare-only smoke requires the isolated runtime and enterprise template.")
      }
      const scenario = competitionScenarios(false).find((item) => (
        item.request.scenario.scenarioType === "feature-drift"
      )).request
      const timestamp = new Date().toISOString()
      const preflightIncident = {
        incidentId: `inc_preflight_${Date.now()}`,
        workspaceId: scenario.workspaceId,
        projectId: null,
        title: scenario.title,
        summary: scenario.summary,
        severity: scenario.severity,
        status: "OPEN",
        scenario: scenario.scenario,
        createdBy: scenario.actorId,
        createdAt: timestamp,
        updatedAt: timestamp,
        resolvedAt: null,
        activeTraceId: null,
        activeApprovalId: null,
        activeActionId: null,
      }
      const resolvedTemplate = await enterpriseRuntime.resolveTeamTemplate(teamTemplate.id)
      const prepared = await agentTeamsAdapter.prepare(
        preflightIncident,
        `trace_preflight_${Date.now()}`,
        resolvedTemplate,
      )
      console.log(JSON.stringify({ success: true, prepareOnly: true, status: prepared.status, teamName: prepared.teamName }))
      return
    }
    await runtime.setAdapterMode({ mode: "live" })
    await runtime.getSnapshot()
    const scenarioResults = []
    const selectedScenarios = selectCompetitionScenarios(competitionScenarios(expectVerificationFailure))
    for (const scenario of selectedScenarios) {
      const created = await runtime.createIncident(scenario.request)
      const beforeInvestigationEvidenceCount = (await runtime.getSnapshot()).evidence.length
      const investigated = await runtime.runInvestigation({
        incidentId: created.incidentId,
        actorId: "enterprise-goai:investigator",
        teamRuntime,
        teamTemplateId: teamTemplate?.id ?? null,
      })
      const incidentEvidence = investigated.snapshot.evidence.filter((item) => item.incidentId === created.incidentId)
      assert.equal(incidentEvidence.length, scenario.investigationEvidenceCount)
      assert.equal(investigated.snapshot.evidence.length - beforeInvestigationEvidenceCount, scenario.investigationEvidenceCount)
      assert.equal(investigated.snapshot.invocations
        .filter((item) => item.incidentId === created.incidentId)
        .every((item) => item.status === "SUCCEEDED"), true)
      const investigatedIncident = investigated.snapshot.incidents.find((item) => item.incidentId === created.incidentId)
      const investigatedTraceId = investigatedIncident?.activeTraceId
      assert.equal(typeof investigatedTraceId, "string")
      const skillUsage = investigated.snapshot.skillUsages.find((item) => (
        item.incidentId === created.incidentId && item.traceId === investigatedTraceId
      ))
      const skillSelection = investigated.snapshot.reasoningDecisions.find((item) => (
        item.incidentId === created.incidentId
        && item.traceId === investigatedTraceId
        && item.decisionType === "SKILL_SELECTION"
      ))
      assert.equal(skillSelection?.retrievalMode, "ONLINE_HYBRID_RAG_KG")
      assert.ok((skillSelection?.knowledgeRefs.length ?? 0) > 0)
      if (expectSkillReuse) {
        const skillId = getCompetitionScenarioProfile(scenario.request.scenario).skill.skillId
        const enterpriseBindings = await enterpriseRuntime.listSkillBindings()
        const activeBinding = enterpriseBindings.bindings.find((item) => (
          item.workspaceId === scenario.request.workspaceId
          && item.skillId === skillId
          && item.enabled
        ))
        assert.ok(activeBinding?.sourceIncidentId, "Skill reuse requires an enabled certified enterprise binding.")
        assert.equal(skillUsage?.status, "REUSED")
        assert.equal(skillUsage?.sourceIncidentId, activeBinding.sourceIncidentId)
      }
      const teamBinding = investigated.snapshot.teamBindings.find((item) => item.incidentId === created.incidentId)
      assert.equal(teamBinding?.runtime, teamRuntime)
      assert.equal(teamBinding?.status, "READY")
      if (teamRuntime === "agentteams") {
        assert.equal(teamBinding?.teamTemplateId, teamTemplate.id)
        assert.equal(teamBinding?.teamTemplateVersion, teamTemplate.version)
        assert.equal(teamBinding?.memberSnapshots.length, 3)
      }
      const approvalId = investigated.approvalId
      assert.notEqual(approvalId, null)
      const approval = investigated.snapshot.approvals.find((item) => item.approvalId === approvalId)
      assert.equal(approval?.planId, scenario.planId)
      assert.ok(approval?.scopes.some((scope) => scope.compensation))
      await runtime.decideApproval({
        approvalId,
        decision: "APPROVED",
        actorId: "enterprise-goai:approver",
        reason: "三平台证据和完整补偿边界已经核对，批准执行固定计划。",
      })
      await runtime.executeRollback({
        approvalId,
        actorId: "enterprise-goai:operator",
        idempotencyKey: `idem_openxnet_live_${scenario.request.scenario.scenarioType}_${created.incidentId}_dryrun`,
        dryRun: true,
      })
      const executed = await runtime.executeRollback({
        approvalId,
        actorId: "enterprise-goai:operator",
        idempotencyKey: `idem_openxnet_live_${scenario.request.scenario.scenarioType}_${created.incidentId}_execute`,
        dryRun: false,
      })
      assert.notEqual(executed.actionId, null)
      const executedAction = executed.snapshot.actions.find((item) => item.actionId === executed.actionId)
      assert.equal(executedAction?.planId, scenario.planId)
      assert.equal(executedAction?.steps.length, scenario.executionStepCount)
      assert.equal(executedAction?.steps.every((step) => step.status === "SUCCEEDED"), true)
      const replayed = await runtime.executeRollback({
        approvalId,
        actorId: "enterprise-goai:operator",
        idempotencyKey: `idem_openxnet_live_${scenario.request.scenario.scenarioType}_${created.incidentId}_execute`,
        dryRun: false,
      })
      assert.equal(replayed.actionId, executed.actionId)
      const shouldFailVerification = expectVerificationFailure
        && scenario.request.scenario.scenarioType === "feature-drift"
      if (shouldFailVerification) {
        await assert.rejects(
          runtime.verifyRemediation({
            actionId: executed.actionId,
            actorId: "enterprise-goai:verifier",
          }),
          (error) => error?.code === "VERIFICATION_FAILED",
        )
        const failedSnapshot = await runtime.getSnapshot()
        const failedIncident = failedSnapshot.incidents.find((item) => item.incidentId === created.incidentId)
        const failedAction = failedSnapshot.actions.find((item) => item.actionId === executed.actionId)
        assert.equal(failedIncident?.status, "FAILED")
        assert.equal(failedAction?.status, "FAILED")
        assert.equal(failedAction?.stage, "FAILED")
        assert.equal(failedAction?.errorCode, "VERIFICATION_FAILED")
        assert.equal(failedAction?.verificationEvidenceIds.length, scenario.verificationEvidenceCount)
        assert.equal(failedAction?.compensationStatus, "SUCCEEDED")
        assert.equal(failedAction?.compensationSteps.length, 2)
        assert.equal(failedAction?.compensationSteps.every((step) => step.status === "SUCCEEDED"), true)
        const failedTraceId = failedIncident?.activeTraceId
        assert.equal(typeof failedTraceId, "string")
        const failedTraceResource = await runtime.readResource({
          uri: `openxnet://workspaces/ws_goai_demo/incidents/${created.incidentId}/traces/${failedTraceId}`,
        })
        assert.equal(JSON.parse(failedTraceResource.text).status, "FAILED")
        const failedAgentDecisions = failedSnapshot.agentDecisions.filter((item) => (
          item.incidentId === created.incidentId && item.traceId === failedTraceId
        ))
        if (teamRuntime === "agentteams") {
          assert.deepEqual(failedAgentDecisions.map((item) => item.stage), [
            "INVESTIGATION_PLAN", "INVESTIGATION_CONCLUSION", "VERIFICATION_CONCLUSION",
          ])
          assert.equal(failedAgentDecisions.at(-1)?.decision, "ROLLBACK_REQUIRED")
        } else {
          assert.deepEqual(failedAgentDecisions, [])
        }
        await assert.rejects(
          runtime.exportRetrospective({ incidentId: created.incidentId }),
          (error) => error?.code === "INCIDENT_NOT_RESOLVED",
        )
        scenarioResults.push({
          scenarioType: scenario.request.scenario.scenarioType,
          planId: scenario.planId,
          incidentId: created.incidentId,
          traceId: failedTraceId,
          approvalId,
          actionId: executed.actionId,
          executionStepCount: failedAction.steps.length,
          verificationEvidenceCount: failedAction.verificationEvidenceIds.length,
          compensationStepCount: failedAction.compensationSteps.length,
          auditReceiptCount: failedSnapshot.auditReceipts
            .filter((item) => item.incidentId === created.incidentId).length,
          agentDecisionCount: failedAgentDecisions.length,
          incidentStatus: failedIncident.status,
          actionStatus: failedAction.status,
          compensationStatus: failedAction.compensationStatus,
          expectedVerificationFailure: true,
          skillReuseStatus: skillUsage?.status ?? "BASELINE",
          skillSourceIncidentId: skillUsage?.sourceIncidentId ?? null,
          retrievalMode: skillSelection?.retrievalMode ?? null,
          knowledgeReferenceCount: skillSelection?.knowledgeRefs.length ?? 0,
          retrospectiveSkillId: null,
        })
        continue
      }
      const verified = await runtime.verifyRemediation({
        actionId: executed.actionId,
        actorId: "enterprise-goai:verifier",
      })
      const incident = verified.snapshot.incidents.find((item) => item.incidentId === created.incidentId)
      const action = verified.snapshot.actions.find((item) => item.actionId === executed.actionId)
      assert.equal(incident?.status, "RESOLVED")
      assert.equal(action?.status, "SUCCEEDED")
      assert.equal(action?.verificationEvidenceIds.length, scenario.verificationEvidenceCount)
      const traceId = incident?.activeTraceId
      assert.equal(typeof traceId, "string")
      const agentDecisions = verified.snapshot.agentDecisions.filter((item) => (
        item.incidentId === created.incidentId && item.traceId === traceId
      ))
      if (teamRuntime === "agentteams") {
        assert.deepEqual(agentDecisions.map((item) => item.stage), [
          "INVESTIGATION_PLAN", "INVESTIGATION_CONCLUSION", "VERIFICATION_CONCLUSION",
        ])
        assert.deepEqual(agentDecisions.map((item) => item.teamRole), ["worker", "leader", "verifier"])
        assert.equal(agentDecisions.every((item) => (
          item.transportSender.startsWith("@") && item.eventId.startsWith("$"))), true)
      } else {
        assert.deepEqual(agentDecisions, [])
      }
      const traceResource = await runtime.readResource({
        uri: `openxnet://workspaces/ws_goai_demo/incidents/${created.incidentId}/traces/${traceId}`,
      })
      assert.equal(JSON.parse(traceResource.text).status, "SUCCEEDED")
      const retrospective = await runtime.exportRetrospective({ incidentId: created.incidentId })
      assert.equal(typeof retrospective.retrospectivePath, "string")
      if (publishEnterpriseSkill) assert.equal(typeof retrospective.retrospectiveSkillId, "string")
      scenarioResults.push({
        scenarioType: scenario.request.scenario.scenarioType,
        planId: scenario.planId,
        incidentId: created.incidentId,
        traceId,
        approvalId,
        actionId: executed.actionId,
        executionStepCount: action.steps.length,
        verificationEvidenceCount: action.verificationEvidenceIds.length,
        auditReceiptCount: verified.snapshot.auditReceipts
          .filter((item) => item.incidentId === created.incidentId).length,
        agentDecisionCount: agentDecisions.length,
        incidentStatus: incident.status,
        actionStatus: action.status,
        skillReuseStatus: skillUsage?.status ?? "BASELINE",
        skillSourceIncidentId: skillUsage?.sourceIncidentId ?? null,
        retrievalMode: skillSelection?.retrievalMode ?? null,
        knowledgeReferenceCount: skillSelection?.knowledgeRefs.length ?? 0,
        retrospectiveSkillId: retrospective.retrospectiveSkillId,
      })
    }
    const lastScenario = scenarioResults.at(-1)
    console.log(JSON.stringify({
      success: true,
      incidentId: lastScenario.incidentId,
      incidentIds: scenarioResults.map((item) => item.incidentId),
      scenarioCount: scenarioResults.length,
      scenarios: scenarioResults,
      teamRuntime,
    }))
  } catch (error) {
    throw attachSmokeDiagnostics(error, await runtime.getSnapshot())
  } finally {
    if (!preserveCompetitionData) {
      assertDisposableSmokeDirectory(userDataDirectory)
      await rm(userDataDirectory, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 125,
      })
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    code: error && typeof error.code === "string" ? error.code : "UNCLASSIFIED_SMOKE_FAILURE",
    message: error instanceof Error ? error.message : String(error),
    diagnostics: error?.goaiDiagnostics ?? {},
  }))
  process.exitCode = 1
})
