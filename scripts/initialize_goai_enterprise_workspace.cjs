"use strict"

const assert = require("node:assert/strict")
const path = require("node:path")

const {
  ApplicationEnterpriseRuntimeService,
} = require("../build-ts/desktop/enterprise/application-enterprise-runtime")

const WORKSPACE_ID = "ws_goai_demo"
const PROJECT_ID = "project_goai_enterprise_ai_governance"
const REQUIRED_ROLE_TEMPLATES = Object.freeze([
  "goai-incident-commander",
  "goai-evidence-agent",
  "goai-verification-agent",
])
const REQUIRED_ROLE_SKILLS = Object.freeze({
  "goai-incident-commander": "goai-change-execute",
  "goai-evidence-agent": "goai-evidence-collect",
  "goai-verification-agent": "goai-service-verify",
})
const ROLE_DEFINITIONS = Object.freeze([
  {
    id: "role_goai_incident_commander",
    templateId: "goai-incident-commander",
    name: "Incident Commander",
    department: "事件治理",
    icon: "fa-solid fa-tower-broadcast",
    description: "负责任务拆解、上下文汇总、审批申请与闭环结论。",
    system_prompt: "你是 Incident Commander。负责拆解企业任务、向取证与验证角色分派边界清晰的工作，并基于真实证据申请审批。不得伪造 Worker 回执或代替独立验证。",
    permissions: ["delegate", "request_approval", "summarize"],
    tools: [],
    skills: ["goai-change-execute"],
    teamRole: "leader",
  },
  {
    id: "role_goai_evidence_agent",
    templateId: "goai-evidence-agent",
    name: "Evidence Agent",
    department: "跨域取证",
    icon: "fa-solid fa-magnifying-glass-chart",
    description: "负责调用三平台只读工具并形成可追溯证据集。",
    system_prompt: "你是 Evidence Agent。只能按 Leader 委派调用只读取证工具，返回来源、资源版本和观察时间。不得执行审批、生产写操作或最终验证。",
    permissions: ["collect_evidence", "use_read_tools"],
    tools: ["aiops", "dataops", "mlops"],
    skills: ["goai-evidence-collect"],
    teamRole: "worker",
  },
  {
    id: "role_goai_verification_agent",
    templateId: "goai-verification-agent",
    name: "Verification Agent",
    department: "独立验证",
    icon: "fa-solid fa-vial-circle-check",
    description: "负责在处置后独立核验业务、数据、模型与服务状态。",
    system_prompt: "你是 Verification Agent。必须独立读取验证证据并决定 CLOSE 或 ROLLBACK_REQUIRED；不得修改历史证据，也不得与执行者共用职责。",
    permissions: ["verify", "read_evidence"],
    tools: ["aiops", "dataops", "mlops"],
    skills: ["goai-service-verify"],
    teamRole: "verifier",
  },
])
const TEAM_TEMPLATE_ID = "team_goai_semifinal"
const PLATFORM_URLS = Object.freeze({
  aiops: "https://goai.xnetaiops.synapxnet.online",
  dataops: "https://goai.xnetdataops.synapxnet.online",
  mlops: "https://goai.xnetmlops.synapxnet.online",
})

/** 解析 OpenXnet 用户数据目录；优先使用显式环境变量，否则使用当前 Windows 用户目录。 */
function resolveUserDataDirectory() {
  const explicit = String(process.env.OPENXNET_USER_DATA_DIR || "").trim()
  if (explicit) return path.resolve(explicit)
  const appData = String(process.env.APPDATA || "").trim()
  if (!appData) throw new Error("APPDATA is required when OPENXNET_USER_DATA_DIR is not set.")
  return path.join(appData, "OpenXnet")
}

/** 返回比赛专用云工作空间草稿；输入可选现有 ID，输出不含密码或私钥的完整契约。 */
function createWorkspaceDraft(existingId = "") {
  return {
    ...(existingId ? { id: existingId } : {}),
    name: "GOAI Competition Demo",
    type: "cloud",
    status: "running",
    config: {
      local: { path: "", permission_mode: "default" },
      docker: { image: "ubuntu:22.04", daemon_url: "", container_id: "" },
      cloud: { host: "101.32.9.231", port: 22, user: "ubuntu", key_path: "" },
      sandbox: { image: "openxnet/sandbox:latest", ttl_hours: 24 },
    },
    role_card_id: null,
  }
}

/** 创建或更新固定 Workspace；输入 Enterprise Runtime，返回规范工作空间记录。 */
async function ensureWorkspace(runtime) {
  const snapshot = await runtime.listWorkspaces()
  const existing = snapshot.workspaces.find((workspace) => workspace.id === WORKSPACE_ID)
  const result = await runtime.saveWorkspace({
    workspace: createWorkspaceDraft(existing?.id || ""),
  })
  assert.equal(result.workspace.id, WORKSPACE_ID)
  return result.workspace
}

/** 创建或更新比赛演示项目楼层；输入 Enterprise Runtime，返回固定项目记录。 */
async function ensureProject(runtime) {
  const snapshot = await runtime.listProjects()
  const existing = snapshot.projects.find((project) => project.id === PROJECT_ID)
  const result = await runtime.saveProject({
    project: {
      ...(existing ? { id: existing.id, floor: existing.floor } : {}),
      workspaceId: WORKSPACE_ID,
      name: "企业 AI 全链路治理",
      description: "面向 DataOps、MLOps 与 AIOps 的跨域协同、受控执行、独立验证和 Skill 沉淀。",
      color: "#4F46E5",
      icon: "fa-solid fa-diagram-project",
    },
  })
  assert.equal(result.project.id, PROJECT_ID)
  assert.equal(result.project.workspaceId, WORKSPACE_ID)
  return result.project
}

/** 幂等创建并对齐三张比赛角色卡；输入 Runtime，返回当前可运行角色卡。 */
async function ensureRoleCards(runtime) {
  const snapshot = await runtime.listRoleCards()
  for (const definition of ROLE_DEFINITIONS) {
    const { teamRole: _teamRole, ...roleDefinition } = definition
    const existing = snapshot.cards.find((card) => card.templateId === definition.templateId)
    const requiredSkill = REQUIRED_ROLE_SKILLS[definition.templateId]
    const skills = [...new Set([...(Array.isArray(existing?.skills) ? existing.skills : []), requiredSkill].filter(Boolean))]
    await runtime.saveRoleCard({
      mode: existing ? "update" : "create",
      roleCard: {
        ...(existing || roleDefinition),
        id: existing?.id || definition.id,
        name: definition.name,
        description: definition.description,
        system_prompt: definition.system_prompt,
        permissions: definition.permissions,
        tools: definition.tools,
        enabled: true,
        department: definition.department,
        icon: definition.icon,
        skills,
        assignedWorkspace: WORKSPACE_ID,
        projectId: PROJECT_ID,
        templateId: definition.templateId,
        role_scope: "enterprise-governance",
      },
    })
  }
  return (await runtime.listRoleCards()).cards.filter((card) => (
    REQUIRED_ROLE_TEMPLATES.includes(card.templateId)
  ))
}

/** 幂等创建三职能团队模板；输入 Runtime 和角色卡，返回唯一固定比赛模板。 */
async function ensureTeamTemplate(runtime, roles) {
  const rolesByTemplate = new Map(roles.map((role) => [role.templateId, role]))
  const members = ROLE_DEFINITIONS.map((definition) => ({
    roleCardId: rolesByTemplate.get(definition.templateId).id,
    teamRole: definition.teamRole,
  }))
  const templates = (await runtime.listTeamTemplates()).teamTemplates
  const existing = templates.find((template) => template.id === TEAM_TEMPLATE_ID)
    || templates.find((template) => template.workspaceId === WORKSPACE_ID && template.name === "OpenXnet 跨域治理团队")
  const expectedMembers = JSON.stringify(members)
  if (existing && existing.enabled && existing.workspaceId === WORKSPACE_ID && JSON.stringify(existing.members) === expectedMembers) {
    return existing
  }
  const result = await runtime.saveTeamTemplate({
    mode: existing ? "update" : "create",
    teamTemplate: {
      id: existing?.id || TEAM_TEMPLATE_ID,
      name: "OpenXnet 跨域治理团队",
      description: "由 Leader、Evidence Worker 和 Independent Verifier 组成的 AgentTeams 复赛主 Demo 团队。",
      workspaceId: WORKSPACE_ID,
      enabled: true,
      members,
    },
  })
  return result.teamTemplate
}

/** 保存并检查三个 SynapXnet 平台入口；输入 Runtime，返回不含凭据的健康状态。 */
async function configurePlatformServices(runtime) {
  for (const [serviceKey, url] of Object.entries(PLATFORM_URLS)) {
    await runtime.saveXnetService({ serviceKey, url, autoConnect: true })
  }
  return (await runtime.checkAllXnetServices({ autoOnly: true })).services
}

/** 幂等初始化 GOAI 企业工作空间并输出公开验收摘要。 */
async function main() {
  const userDataDirectory = resolveUserDataDirectory()
  const workspaceRuntime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory,
    createId: () => WORKSPACE_ID,
  })
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory,
    createId: () => PROJECT_ID,
  })
  const workspace = await ensureWorkspace(workspaceRuntime)
  const project = await ensureProject(runtime)
  const roles = await ensureRoleCards(runtime)
  const template = await ensureTeamTemplate(runtime, roles)
  const services = await configurePlatformServices(runtime)
  const sandbox = await runtime.getSandboxState()
  const sandboxRoleIds = new Set(sandbox.agents.map((agent) => agent.id))
  assert.equal(roles.every((role) => sandboxRoleIds.has(role.id)), true)
  const platformStatuses = Object.fromEntries(
    Object.entries(services).map(([key, service]) => [key, service.status]),
  )
  const offlineServices = Object.entries(platformStatuses)
    .filter(([, status]) => status !== "online")
    .map(([key]) => key)
  console.log(JSON.stringify({
    success: true,
    workspaceId: workspace.id,
    workspaceStatus: workspace.status,
    projectId: project.id,
    projectFloor: project.floor,
    roleCount: roles.length,
    teamTemplateId: template.id,
    teamTemplateVersion: template.version,
    platformStatuses,
    offlineServices,
    sandboxAgentCount: sandbox.agents.length,
  }))
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    message: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
