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
      cloud: { host: "150.109.120.15", port: 22, user: "ubuntu", key_path: "" },
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

/** 将三张比赛角色卡归属固定 Workspace 和项目楼层；输入 Runtime，返回更新后的角色卡。 */
async function alignRoleCards(runtime) {
  const snapshot = await runtime.listRoleCards()
  const roles = REQUIRED_ROLE_TEMPLATES.map((templateId) => {
    const role = snapshot.cards.find((card) => card.templateId === templateId)
    assert.ok(role, `Required enterprise role card '${templateId}' was not found.`)
    assert.equal(role.enabled, true, `Required enterprise role card '${templateId}' is disabled.`)
    return role
  })
  for (const role of roles) {
    const requiredSkill = REQUIRED_ROLE_SKILLS[role.templateId]
    const skills = [...new Set([...(Array.isArray(role.skills) ? role.skills : []), requiredSkill].filter(Boolean))]
    await runtime.saveRoleCard({
      mode: "update",
      roleCard: { ...role, assignedWorkspace: WORKSPACE_ID, projectId: PROJECT_ID, skills },
    })
  }
  return (await runtime.listRoleCards()).cards.filter((card) => (
    REQUIRED_ROLE_TEMPLATES.includes(card.templateId)
  ))
}

/** 校验已启用的三角色团队模板；输入 Runtime 和角色卡，返回唯一比赛模板。 */
async function requireTeamTemplate(runtime, roles) {
  const roleIds = new Set(roles.map((role) => role.id))
  const templates = (await runtime.listTeamTemplates()).teamTemplates.filter((template) => (
    template.workspaceId === WORKSPACE_ID
      && template.enabled
      && template.members.length >= 3
      && template.members.every((member) => roleIds.has(member.roleCardId))
  ))
  assert.equal(templates.length, 1, "Exactly one enabled GOAI team template is required.")
  assert.equal(templates[0].members.filter((member) => member.teamRole === "leader").length, 1)
  assert.equal(templates[0].members.some((member) => member.teamRole === "verifier"), true)
  return templates[0]
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
  const roles = await alignRoleCards(runtime)
  const template = await requireTeamTemplate(runtime, roles)
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
