"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const { app, BrowserWindow } = require("electron");

const {
  ApplicationCompetitionRuntimeService,
  FixtureCompetitionToolAdapter,
  LocalUiGateway,
} = require("../build-ts/desktop");

const QA_ROOT = path.resolve(__dirname, "../../.codex-build/goai-ui-smoke");
const USER_DATA_ROOT = path.join(QA_ROOT, "user-data");
const SCREENSHOT_ROOT = path.join(QA_ROOT, "screenshots");

// 当前烟测只验证 DOM/CSS 布局；在无可用 GPU 进程的 CI 环境中显式使用软件合成。
app.disableHardwareAcceleration();

/** 创建跨域特征漂移演示请求；无输入，返回与 Live 演示一致的资源上下文。 */
function createFeatureDriftIncidentRequest() {
  return {
    workspaceId: "ws_goai_demo",
    projectId: "project_goai_enterprise_ai_governance",
    title: "跨域特征漂移恢复",
    summary: "上游采集变更导致风控模型输入漂移，需止损、回填、重训练并灰度发布。",
    severity: "P1",
    actorId: "enterprise-goai:investigator",
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
      testDatasetRef: "fixture://goai/risk-repaired-v19",
    },
  };
}

/** 创建视觉烟测使用的三角色企业团队模板；无输入，返回 Runtime 可固化的角色卡快照。 */
function createVisualAgentTeamTemplate() {
  const timestamp = "2026-08-11T12:00:00.000Z";
  const roleCards = [
    {
      id: "role-goai-leader",
      name: "事件指挥官",
      description: "拆解任务、汇总证据并申请审批。",
      system_prompt: "只依据有来源的证据作出治理决定。",
      runtime_system_prompt: "保持审批、执行和验证职责分离。",
      permissions: ["plan", "request-approval"],
      tools: [],
      enabled: true,
      department: "治理中心",
      icon: "fa-solid fa-sitemap",
      skills: ["goai-change-execute"],
      skill_ids: ["goai-change-execute"],
      assignedWorkspace: "ws_goai_demo",
      projectId: "project_goai_enterprise_ai_governance",
      templateId: "",
      category: "governance",
      categoryZh: "治理",
      categoryEn: "Governance",
      summaryZh: "事件治理负责人",
      summaryEn: "Incident governance leader",
      accent: ["#2563eb"],
      agent_name: "incident-commander",
      role_scope: "leader",
      syncSource: "goai-ui-smoke",
      bodyType: "standard",
      position3D: null,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "role-goai-evidence",
      name: "跨域取证工程师",
      description: "读取三平台证据并形成根因假设。",
      system_prompt: "只调用只读工具并保留证据引用。",
      runtime_system_prompt: "禁止在取证阶段执行写操作。",
      permissions: ["read-evidence"],
      tools: ["aiops.alert.get", "dataops.lineage.get", "mlops.deployment.get"],
      enabled: true,
      department: "平台工程",
      icon: "fa-solid fa-magnifying-glass-chart",
      skills: ["goai-evidence-collect"],
      skill_ids: ["goai-evidence-collect"],
      assignedWorkspace: "ws_goai_demo",
      projectId: "project_goai_enterprise_ai_governance",
      templateId: "",
      category: "evidence",
      categoryZh: "取证",
      categoryEn: "Evidence",
      summaryZh: "跨平台证据收集",
      summaryEn: "Cross-platform evidence collection",
      accent: ["#0891b2"],
      agent_name: "evidence-agent",
      role_scope: "worker",
      syncSource: "goai-ui-smoke",
      bodyType: "standard",
      position3D: null,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "role-goai-verifier",
      name: "独立验证官",
      description: "独立读取恢复证据并决定关闭或回滚。",
      system_prompt: "不得沿用执行人的成功结论。",
      runtime_system_prompt: "仅依据场景阈值输出 CLOSE 或 ROLLBACK_REQUIRED。",
      permissions: ["verify"],
      tools: ["aiops.inference.recovery.status", "dataops.dataset.validation.get", "mlops.inference.probe"],
      enabled: true,
      department: "质量治理",
      icon: "fa-solid fa-shield-halved",
      skills: ["goai-service-verify"],
      skill_ids: ["goai-service-verify"],
      assignedWorkspace: "ws_goai_demo",
      projectId: "project_goai_enterprise_ai_governance",
      templateId: "",
      category: "verification",
      categoryZh: "验证",
      categoryEn: "Verification",
      summaryZh: "独立恢复验证",
      summaryEn: "Independent remediation verification",
      accent: ["#16a34a"],
      agent_name: "verification-agent",
      role_scope: "verifier",
      syncSource: "goai-ui-smoke",
      bodyType: "standard",
      position3D: null,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];
  return {
    teamTemplate: {
      id: "team-goai-visual",
      schemaVersion: 1,
      version: 1,
      name: "OpenXnet 跨域治理团队",
      description: "三角色职责分离的 AgentTeams 视觉烟测模板。",
      workspaceId: "ws_goai_demo",
      enabled: true,
      members: [
        { roleCardId: roleCards[0].id, teamRole: "leader" },
        { roleCardId: roleCards[1].id, teamRole: "worker" },
        { roleCardId: roleCards[2].id, teamRole: "verifier" },
      ],
      created_at: timestamp,
      updated_at: timestamp,
    },
    roleCards,
  };
}

/** 创建符合 AgentTeams 阶段、角色和 Matrix 事件约束的烟测回执；输入任务，返回可审计结果。 */
async function createVisualAgentTeamTaskResult(input) {
  const expectedRole = input.stage === "INVESTIGATION_PLAN"
    ? "worker"
    : input.stage === "INVESTIGATION_CONCLUSION" ? "leader" : "verifier";
  const member = input.binding.memberSnapshots.find((item) => item.teamRole === expectedRole);
  const leader = input.binding.memberSnapshots.find((item) => item.teamRole === "leader");
  if (!member || !leader) throw new Error("Visual AgentTeams role snapshots are incomplete.");
  const decision = input.stage === "INVESTIGATION_PLAN"
    ? "COLLECT_EVIDENCE"
    : input.stage === "INVESTIGATION_CONCLUSION" ? "REQUEST_APPROVAL" : "CLOSE";
  const sender = `@${expectedRole}:agentteams.visual`;
  const routeEvents = expectedRole === "leader" ? [] : [
    {
      kind: "ROUTE_REQUEST",
      direction: "OUTBOUND",
      roomId: "!goai-visual:agentteams",
      eventId: `$route-request-${input.stage.toLowerCase()}`,
      sender: "@gateway:agentteams.visual",
      recipient: "@leader:agentteams.visual",
      originServerTs: null,
      observedAt: "2026-08-11T12:00:00.000Z",
      redactedBody: `Leader route request for ${input.stage}`,
      bodyDigest: "a".repeat(64),
    },
    {
      kind: "ROUTE_RESPONSE",
      direction: "INBOUND",
      roomId: "!goai-visual:agentteams",
      eventId: `$route-response-${input.stage.toLowerCase()}`,
      sender: "@leader:agentteams.visual",
      recipient: "@gateway:agentteams.visual",
      originServerTs: 1_786_000_000_000,
      observedAt: "2026-08-11T12:00:00.000Z",
      redactedBody: `Leader assigned ${member.name}`,
      bodyDigest: "b".repeat(64),
    },
  ];
  return {
    taskId: `visual-${input.stage.toLowerCase()}`,
    stage: input.stage,
    route: expectedRole === "leader" ? null : {
      leaderRoleCardId: leader.roleCardId,
      leaderName: leader.name,
      transportSender: "@leader:agentteams.visual",
      assigneeRoleCardId: member.roleCardId,
      taskBriefDigest: "c".repeat(64),
    },
    result: {
      roleCardId: member.roleCardId,
      agentName: member.name,
      teamRole: expectedRole,
      transportSender: sender,
      eventId: `$task-result-${input.stage.toLowerCase()}`,
      decision,
      summary: input.stage === "INVESTIGATION_PLAN"
        ? "已接收任务上下文，选择三平台只读工具并绑定证据引用。"
        : input.stage === "INVESTIGATION_CONCLUSION"
          ? "跨域证据一致，已形成带审批范围、资源版本和补偿计划的处置请求。"
          : "已独立读取恢复证据，全部场景阈值通过，明确允许关闭事件。",
      confidence: 0.96,
      requestedToolNames: input.stage === "INVESTIGATION_PLAN" ? [...input.availableToolNames] : [],
      evidenceIds: input.stage === "INVESTIGATION_PLAN" ? [] : input.evidence.map((item) => item.evidenceId),
      skillName: input.skill.name,
      skillVersion: input.skill.version,
      outputDigest: "d".repeat(64),
    },
    transportEvents: [
      ...routeEvents,
      {
        kind: "TASK_REQUEST",
        direction: "OUTBOUND",
        roomId: "!goai-visual:agentteams",
        eventId: `$task-request-${input.stage.toLowerCase()}`,
        sender: "@gateway:agentteams.visual",
        recipient: sender,
        originServerTs: null,
        observedAt: "2026-08-11T12:00:00.000Z",
        redactedBody: `Bounded task request for ${input.stage}`,
        bodyDigest: "e".repeat(64),
      },
      {
        kind: "TASK_RESPONSE",
        direction: "INBOUND",
        roomId: "!goai-visual:agentteams",
        eventId: `$task-result-${input.stage.toLowerCase()}`,
        sender,
        recipient: "@gateway:agentteams.visual",
        originServerTs: 1_786_000_000_100,
        observedAt: "2026-08-11T12:00:00.000Z",
        redactedBody: `Bounded task response for ${input.stage}`,
        bodyDigest: "f".repeat(64),
      },
    ],
    completedAt: "2026-08-11T12:00:00.000Z",
  };
}

/** 生成已完成取证、审批、执行、验证和 Skill 沉淀的正式竞赛快照。 */
async function createResolvedCompetitionSnapshot() {
  let sequence = 0;
  const resolvedTeamTemplate = createVisualAgentTeamTemplate();
  const adapter = new FixtureCompetitionToolAdapter({
    now: () => new Date("2026-08-11T12:00:00.000Z"),
  });
  const runtime = new ApplicationCompetitionRuntimeService({
    userDataDirectory: USER_DATA_ROOT,
    fixtureAdapter: adapter,
    liveAdapter: adapter,
    now: () => new Date("2026-08-11T12:00:00.000Z"),
    createId: () => `ui${++sequence}`,
    resolveTeamTemplate: async (teamTemplateId) => {
      if (teamTemplateId !== resolvedTeamTemplate.teamTemplate.id) throw new Error("Unknown visual team template.");
      return resolvedTeamTemplate;
    },
    agentTeamsIsolatedServiceEnabled: true,
    prepareAgentTeam: async () => ({ teamName: "openxnet-goai-visual", status: "READY" }),
    dispatchAgentTeamTask: createVisualAgentTeamTaskResult,
    publishRetrospectiveSkill: async (request) => ({ skillId: request.skillId }),
  });
  const created = await runtime.createIncident(createFeatureDriftIncidentRequest());
  const investigated = await runtime.runInvestigation({
    incidentId: created.incidentId,
    actorId: "enterprise-goai:investigator",
    teamRuntime: "agentteams",
    teamTemplateId: resolvedTeamTemplate.teamTemplate.id,
  });
  assert.ok(investigated.approvalId);
  await runtime.decideApproval({
    approvalId: investigated.approvalId,
    decision: "APPROVED",
    actorId: "enterprise-goai:approver",
    reason: "跨平台证据、补偿计划和资源版本完整，批准受控执行。",
  });
  const executed = await runtime.executeRollback({
    approvalId: investigated.approvalId,
    actorId: "enterprise-goai:executor",
    idempotencyKey: "goai-ui-smoke-feature-drift",
    dryRun: false,
  });
  assert.ok(executed.actionId);
  await runtime.verifyRemediation({
    actionId: executed.actionId,
    actorId: "enterprise-goai:verifier",
  });
  await runtime.exportRetrospective({ incidentId: created.incidentId });
  await runtime.setAdapterMode({ mode: "live" });
  return runtime.getSnapshot();
}

/** 启动本地 UI Gateway；输入静态目录，返回可关闭的回环服务。 */
async function startUiGateway(staticRoot) {
  const gateway = new LocalUiGateway({
    staticRoot,
    getBackendOrigin: () => null,
    /** 阻止视觉烟测激活兼容后端；无输入，始终抛出错误。 */
    activateBackend: async () => {
      throw new Error("GOAI UI smoke must not activate the legacy backend.");
    },
  });
  const origin = await gateway.start();
  return { gateway, origin };
}

/** 等待 Renderer 完成 Vue 挂载；输入窗口，超时或挂载失败时抛错。 */
async function waitForRenderer(window) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 15000;
      const check = () => {
        if (typeof openxnetApp !== 'undefined' && document.querySelector('.openxnet-redesign-app')) {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error('OpenXnet Renderer did not mount in time.'));
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    })
  `, true);
}

/** 等待目标元素可见；输入窗口、选择器和超时，元素具备稳定尺寸时返回。 */
async function waitForVisibleSelector(window, selector, timeoutMs = 15_000) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const selector = ${JSON.stringify(selector)};
      const deadline = Date.now() + ${Number(timeoutMs)};
      const check = () => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect?.();
        const style = element ? getComputedStyle(element) : null;
        if (rect && rect.width > 32 && rect.height > 32 && style?.display !== 'none' && style?.visibility !== 'hidden') {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error('Visible selector timeout: ' + selector));
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    })
  `, true);
}

/** 等待菜单与企业页签连续稳定；输入窗口、菜单和页签，启动恢复任务反复覆盖时抛错。 */
async function stabilizeApplicationView(window, activeMenu, enterpriseTab) {
  let stablePasses = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await window.webContents.executeJavaScript(`
      (async () => {
        openxnetApp.authState.status = 'signed_in_premium';
        openxnetApp.authState.enterpriseAccess = true;
        openxnetApp.activeMenu = ${JSON.stringify(activeMenu)};
        openxnetApp.enterpriseTab = ${JSON.stringify(enterpriseTab)};
        await openxnetApp.$nextTick();
        return {
          activeMenu: openxnetApp.activeMenu,
          enterpriseTab: openxnetApp.enterpriseTab,
          canUseEnterprise: openxnetApp.canUseEnterprise === true,
        };
      })()
    `, true);
    stablePasses = state.activeMenu === activeMenu
      && state.enterpriseTab === enterpriseTab
      && state.canUseEnterprise
      ? stablePasses + 1
      : 0;
    if (stablePasses >= 3) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Application view did not stabilize: ${activeMenu}/${enterpriseTab}`);
}

/** 将页面切换到已登录企业账号；输入窗口，无返回。 */
async function unlockEnterpriseWorkspace(window) {
  await window.webContents.executeJavaScript(`
    (async () => {
      openxnetApp.authState.status = 'signed_in_premium';
      openxnetApp.authState.enterpriseAccess = true;
      openxnetApp.authState.profile = {
        ...openxnetApp.authState.profile,
        name: 'GOAI 演示账号',
        id: 'goai-ui-smoke'
      };
      openxnetApp.activeMenu = 'enterprise';
      await openxnetApp.$nextTick();
    })()
  `, true);
}

/** 渲染事件治理中心；输入窗口、Runtime 快照和发布态选项，无返回。 */
async function renderCompetitionWorkbench(window, snapshot, options = {}) {
  const rehearsalAvailable = options.rehearsalAvailable === true;
  const rehearsalVisible = rehearsalAvailable && options.rehearsalVisible === true;
  const adapterMode = options.adapterMode === "fixture" ? "fixture" : "live";
  await window.webContents.executeJavaScript(`
    (async () => {
      openxnetApp.authState.status = 'signed_in_premium';
      openxnetApp.authState.enterpriseAccess = true;
      openxnetApp.loadCompetitionUiProfile = () => {
        openxnetApp.competitionReleaseProfile = ${JSON.stringify(rehearsalAvailable ? "goai-staging" : "production")};
        openxnetApp.competitionRehearsalAvailable = ${JSON.stringify(rehearsalAvailable)};
        if (!openxnetApp.competitionRehearsalAvailable) openxnetApp.competitionRehearsalVisible = false;
      };
      openxnetApp.activeMenu = 'enterprise';
      openxnetApp.enterpriseTab = 'competition';
      openxnetApp.competitionSnapshot = ${JSON.stringify(snapshot)};
      openxnetApp.competitionReleaseProfile = ${JSON.stringify(rehearsalAvailable ? "goai-staging" : "production")};
      openxnetApp.competitionRehearsalAvailable = ${JSON.stringify(rehearsalAvailable)};
      openxnetApp.competitionRehearsalVisible = ${JSON.stringify(rehearsalVisible)};
      openxnetApp.competitionAdapterMode = ${JSON.stringify(adapterMode)};
      openxnetApp.competitionTeamRuntime = 'agentteams';
      openxnetApp.xnetServices = {
        aiops: { name: 'XnetAIOps', url: 'https://goai.xnetaiops.synapxnet.online', status: 'online', last_check: '2026-08-11T12:00:00.000Z', auto_connect: true },
        dataops: { name: 'XnetDataOps', url: 'https://goai.xnetdataops.synapxnet.online', status: 'online', last_check: '2026-08-11T12:00:00.000Z', auto_connect: true },
        mlops: { name: 'XnetMLOps', url: 'https://goai.xnetmlops.synapxnet.online', status: 'online', last_check: '2026-08-11T12:00:00.000Z', auto_connect: true }
      };
      await openxnetApp.$nextTick();
    })()
  `, true);
  await stabilizeApplicationView(window, "enterprise", "competition");
  await waitForVisibleSelector(window, ".competition-workbench");
  await new Promise((resolve) => setTimeout(resolve, 250));
}

/** 返回沙盘视觉测试数据；输入真实竞赛快照，包含项目楼层、三名员工和关联 Trace 的操作消息。 */
function createSandboxFixture(snapshot) {
  const workspace = {
    id: "ws_goai_demo",
    name: "GOAI Competition Demo",
    type: "cloud",
    status: "running",
    host: "101.32.9.231",
    port: 22,
    username: "ubuntu",
    path: "",
  };
  const project = {
    id: "project_goai_enterprise_ai_governance",
    workspaceId: workspace.id,
    name: "企业 AI 全链路治理",
    description: "DataOps、MLOps 与 AIOps 跨域协同处置现场",
    floor: 1,
    color: "#2563eb",
    icon: "fa-solid fa-diagram-project",
  };
  const roles = [
    {
      id: "role-goai-leader",
      name: "事件指挥官",
      department: "治理中心",
      description: "拆解任务、协调冲突并申请审批",
      enabled: true,
      assignedWorkspace: workspace.id,
      projectId: project.id,
      skills: ["goai-change-execute"],
      position3D: { x: -2.5, z: 0.5 },
    },
    {
      id: "role-goai-evidence",
      name: "跨域取证工程师",
      department: "平台工程",
      description: "读取三平台证据并形成根因假设",
      enabled: true,
      assignedWorkspace: workspace.id,
      projectId: project.id,
      skills: ["goai-evidence-collect"],
      position3D: { x: 0, z: -1.5 },
    },
    {
      id: "role-goai-verifier",
      name: "独立验证官",
      department: "质量治理",
      description: "独立核验恢复阈值并决定闭环或回滚",
      enabled: true,
      assignedWorkspace: workspace.id,
      projectId: project.id,
      skills: ["goai-service-verify"],
      position3D: { x: 2.5, z: 0.5 },
    },
  ];
  const incident = snapshot.incidents.at(-1);
  const traceId = incident?.activeTraceId || null;
  const invocations = snapshot.invocations.filter((item) => item.incidentId === incident?.incidentId);
  const evidence = snapshot.evidence.filter((item) => item.incidentId === incident?.incidentId);
  const approval = snapshot.approvals.find((item) => item.incidentId === incident?.incidentId) || null;
  const action = snapshot.actions.find((item) => item.incidentId === incident?.incidentId) || null;
  const messages = [
    {
      id: "message-goai-leader",
      workspaceId: workspace.id,
      projectId: project.id,
      senderType: "leader",
      senderId: "goai-ui-smoke",
      senderName: "负责人",
      kind: "text",
      content: "@跨域取证工程师 请对齐三平台证据，先确认根因再提交处置计划。",
      mentions: [{ roleCardId: roles[1].id, roleName: roles[1].name }],
      taskId: null,
      traceId,
      operation: null,
      createdAt: "2026-08-11T12:00:00.000Z",
    },
    {
      id: "message-goai-operation",
      workspaceId: workspace.id,
      projectId: project.id,
      senderType: "agent",
      senderId: roles[0].id,
      senderName: roles[0].name,
      kind: "operation",
      content: "已形成跨域恢复计划并等待审批。",
      mentions: [],
      taskId: action?.actionId || incident?.incidentId || null,
      traceId,
      operation: {
        operationId: "operation-goai-feature-drift",
        authorityLevel: "NSX-4",
        riskClass: "RK-2",
        evidenceGrade: "EV-2",
        decision: "APPROVAL_REQUIRED",
        phase: "AWAITING_APPROVAL",
        title: "跨域特征漂移完整恢复计划",
        summary: "备用特征止损、三年数据回填、重训练、5% 灰度与全量提升均已绑定补偿计划。",
        toolNames: ["dataops.feature.backfill.start", "mlops.deployment.canary.apply"],
        skillName: "跨域特征漂移恢复",
        targetResource: "deploy_risk_prod",
        actionDigest: "a".repeat(64),
        approvalId: approval?.approvalId || null,
        invocationIds: invocations.slice(0, 2).map((item) => item.invocationId),
        evidenceIds: evidence.slice(0, 2).map((item) => item.evidenceId),
        ruleCodes: ["NSX.APPROVAL.HIGH_RISK_WRITE"],
        ruleReasons: ["生产环境写操作必须审批并具备补偿计划。"],
        verificationSummary: null,
      },
      createdAt: "2026-08-11T12:01:00.000Z",
    },
  ];
  return { workspace, project, roles, messages };
}

/** 渲染项目楼层和企业群聊；输入窗口、沙盘数据和竞赛快照，无返回。 */
async function renderEnterpriseSandbox(window, fixture, snapshot) {
  await window.webContents.executeJavaScript(`
    (async () => {
      openxnetApp.authState.status = 'signed_in_premium';
      openxnetApp.authState.enterpriseAccess = true;
      openxnetApp.activeMenu = 'enterprise';
      openxnetApp.enterpriseTab = 'enterprise-sandbox';
      openxnetApp.enterpriseWorkspaces = [${JSON.stringify(fixture.workspace)}];
      openxnetApp.enterpriseProjects = [${JSON.stringify(fixture.project)}];
      openxnetApp.staffRoles = ${JSON.stringify(fixture.roles)};
      openxnetApp.enterpriseRoleCards = ${JSON.stringify(fixture.roles)};
      openxnetApp.enterpriseMessages = ${JSON.stringify(fixture.messages)};
      openxnetApp.competitionSnapshot = ${JSON.stringify(snapshot)};
      openxnetApp.sandboxLevel = 1;
      openxnetApp.sandboxCurrentWs = ${JSON.stringify(fixture.workspace.id)};
      openxnetApp.sandboxCurrentProject = null;
      await openxnetApp.$nextTick();
      await openxnetApp.init3DView();
      openxnetApp.openSandboxProjectFloor(${JSON.stringify(fixture.project.id)});
      openxnetApp.enterpriseMessages = ${JSON.stringify(fixture.messages)};
      openxnetApp.enterpriseChatRecipientIds = [${JSON.stringify(fixture.roles[1].id)}];
      openxnetApp.enterpriseChatInput = '@跨域取证工程师 ';
      openxnetApp.showSandboxChatPanel = true;
      openxnetApp.enterpriseSandboxWorkView = 'chat';
      openxnetApp.syncEnterpriseAuditIncidentSelection();
      await openxnetApp.$nextTick();
      openxnetApp.enterprise3DScene?.resize?.();
    })()
  `, true);
  await stabilizeApplicationView(window, "enterprise", "enterprise-sandbox");
  await waitForVisibleSelector(window, ".enterprise-sandbox-workbench");
  await new Promise((resolve) => setTimeout(resolve, 900));
}

/** 切换稳定主题；输入窗口和 light/dark，更新主题属性并等待重绘。 */
async function applyTheme(window, theme) {
  await window.webContents.executeJavaScript(`
    (async () => {
      openxnetApp.systemSettings.theme = ${JSON.stringify(theme)};
      document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
      document.documentElement.setAttribute('data-theme-choice', ${JSON.stringify(theme)});
      await openxnetApp.$nextTick();
    })()
  `, true);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

/** 检查指定页面的滚动与文本溢出；输入窗口和根选择器，返回诊断摘要。 */
async function inspectLayout(window, rootSelector) {
  return window.webContents.executeJavaScript(`
    (() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      if (!root) return { missing: true, scrollContainers: [], clippedText: [] };
      const describe = (element) => {
        const classes = String(element.className || '').trim().split(/\\s+/).filter(Boolean).slice(0, 3);
        return [element.tagName.toLowerCase(), ...classes.map((item) => '.' + item)].join('');
      };
      const descendants = [root, ...root.querySelectorAll('*')];
      const scrollContainers = descendants.filter((element) => {
        const style = getComputedStyle(element);
        return ['auto', 'scroll'].includes(style.overflowY)
          && element.scrollHeight > element.clientHeight + 2;
      }).map(describe);
      const clippedText = descendants.filter((element) => {
        const text = String(element.textContent || '').trim();
        if (!text || element.children.length > 0) return false;
        if (element.closest('.competition-table-scroll, pre, code')) return false;
        return element.scrollWidth > element.clientWidth + 2;
      }).slice(0, 30).map((element) => ({
        selector: describe(element),
        text: String(element.textContent || '').trim().slice(0, 80),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        display: getComputedStyle(element).display,
        whiteSpace: getComputedStyle(element).whiteSpace,
        wordBreak: getComputedStyle(element).wordBreak,
        overflowWrap: getComputedStyle(element).overflowWrap,
        parentWidth: element.parentElement?.clientWidth || 0,
      }));
      return {
        missing: false,
        theme: document.documentElement.getAttribute('data-theme'),
        rootWidth: Math.round(root.getBoundingClientRect().width),
        rootHeight: Math.round(root.getBoundingClientRect().height),
        scrollContainers,
        clippedText,
      };
    })()
  `, true);
}

/** 捕获完整窗口截图；输入窗口和文件名，返回绝对路径。 */
async function captureWindow(window, fileName) {
  await window.webContents.executeJavaScript(`
    (async () => {
      if (typeof openxnetApp !== 'undefined' && openxnetApp.activeMenu === 'enterprise') {
        openxnetApp.authState.status = 'signed_in_premium';
        openxnetApp.authState.enterpriseAccess = true;
        await openxnetApp.$nextTick();
      }
    })()
  `, true);
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 120));
  await window.capturePage();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const image = await window.capturePage();
  const outputPath = path.join(SCREENSHOT_ROOT, fileName);
  writeFileSync(outputPath, image.toPNG());
  return outputPath;
}

/** 调整桌面窗口并等待布局稳定；输入窗口、宽高，无返回。 */
async function resizeWindow(window, width, height) {
  window.setSize(width, height, false);
  await new Promise((resolve) => setTimeout(resolve, 500));
  window.webContents.invalidate();
}

/** 把指定工作台区域滚动到视口顶部；输入窗口和选择器，元素不存在时抛出错误。 */
async function scrollSelectorIntoView(window, selector) {
  await window.webContents.executeJavaScript(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing visual smoke selector: ' + ${JSON.stringify(selector)});
      element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
    })()
  `, true);
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 180));
}

/** 运行真实 Renderer 的 GOAI UI 烟测；无输入，输出截图与布局验收摘要。 */
async function runSmoke() {
  rmSync(QA_ROOT, { recursive: true, force: true });
  mkdirSync(USER_DATA_ROOT, { recursive: true });
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  const snapshot = await createResolvedCompetitionSnapshot();
  const staticRoot = path.resolve(__dirname, "../static");
  const { gateway, origin } = await startUiGateway(staticRoot);
  let window = null;
  try {
    window = new BrowserWindow({
      show: true,
      x: -10_000,
      y: -10_000,
      width: 1440,
      height: 960,
      minWidth: 1024,
      minHeight: 720,
      skipTaskbar: true,
      backgroundColor: "#0b1020",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    await window.loadURL(origin);
    await waitForRenderer(window);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await unlockEnterpriseWorkspace(window);

    const emptySnapshot = { ...snapshot, incidents: [] };
    await applyTheme(window, "light");
    await renderCompetitionWorkbench(window, emptySnapshot, {
      rehearsalAvailable: true,
      rehearsalVisible: true,
      adapterMode: "fixture",
    });
    await stabilizeApplicationView(window, "enterprise", "competition");
    const competitionRehearsalEmptyLayout = await inspectLayout(window, ".competition-workbench");
    const competitionRehearsalContract = await window.webContents.executeJavaScript(`
      (() => ({
        panelVisible: Boolean(document.querySelector('.competition-rehearsal-panel')),
        stagingLabelVisible: document.body.innerText.includes('比赛 Staging 演练'),
        fixtureVisible: Array.from(document.querySelectorAll('.competition-rehearsal-panel button')).some((item) => item.textContent.trim() === 'Fixture'),
        liveVisible: Array.from(document.querySelectorAll('.competition-rehearsal-panel button')).some((item) => item.textContent.trim() === 'Live'),
        createVisible: document.body.innerText.includes('创建演示事件'),
      }))()
    `, true);
    const competitionRehearsalEmptyPath = await captureWindow(window, "competition-rehearsal-empty.png");

    await renderCompetitionWorkbench(window, emptySnapshot, {
      rehearsalAvailable: false,
      rehearsalVisible: false,
    });
    const competitionProductionEmptyLayout = await inspectLayout(window, ".competition-workbench");
    const competitionProductionContract = await window.webContents.executeJavaScript(`
      (() => ({
        titleVisible: document.body.innerText.includes('事件治理中心'),
        waitingVisible: document.body.innerText.includes('等待企业事件'),
        rehearsalToggleVisible: Boolean(document.querySelector('.competition-rehearsal-toggle')),
        rehearsalPanelVisible: Boolean(document.querySelector('.competition-rehearsal-panel')),
        adapterControlsVisible: Array.from(document.querySelectorAll('.competition-segmented button')).some((item) => ['Fixture', 'Live'].includes(item.textContent.trim())),
      }))()
    `, true);
    const competitionProductionEmptyPath = await captureWindow(window, "competition-production-empty.png");

    await renderCompetitionWorkbench(window, snapshot, {
      rehearsalAvailable: true,
      rehearsalVisible: false,
    });
    await applyTheme(window, "light");
    await stabilizeApplicationView(window, "enterprise", "competition");
    const competitionLightLayout = await inspectLayout(window, ".competition-workbench");
    const competitionLightPath = await captureWindow(window, "competition-light.png");
    await applyTheme(window, "dark");
    await stabilizeApplicationView(window, "enterprise", "competition");
    const competitionDarkLayout = await inspectLayout(window, ".competition-workbench");
    const competitionDarkPath = await captureWindow(window, "competition-dark.png");
    const competitionSectionOrder = await window.webContents.executeJavaScript(`
      (() => {
        const readBox = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { selector, top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
        };
        const primary = [
          '.competition-stage-rail', '.competition-incident-pane', '.competition-action-pane',
          '.competition-plan-flow', '.competition-agent-flow',
        ].map(readBox).filter(Boolean);
        const ordered = [
          readBox('.competition-task-graph'),
          readBox('.competition-assurance-grid'),
          readBox('.competition-evidence-grid'),
          readBox('.competition-secondary-grid'),
        ];
        const stackIsOrdered = (items) => items.every((item, index) => (
          index === 0 || item.top >= items[index - 1].bottom - 1
        ));
        const contextItems = Array.from(document.querySelectorAll('.competition-context-flow > ol > li')).map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
        });
        const gateItems = Array.from(document.querySelectorAll('.competition-completion-gates > ol > li')).map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
        });
        return {
          primaryBottom: Math.max(...primary.map((item) => item.bottom)),
          sections: ordered,
          complete: ordered.every(Boolean),
          followsPrimary: Boolean(ordered[0]) && ordered[0].top >= Math.max(...primary.map((item) => item.bottom)) - 1,
          ordered: ordered.every(Boolean) && stackIsOrdered(ordered),
          contextItemsOrdered: stackIsOrdered(contextItems),
          gateItemsOrdered: stackIsOrdered(gateItems),
        };
      })()
    `, true);
    const competitionProcessContract = await window.webContents.executeJavaScript(`
      (() => {
        const completion = openxnetApp.getCompetitionCompletionSummary();
        return {
          contextTransferCount: openxnetApp.getCompetitionContextTransfers().length,
          matrixEventCount: openxnetApp.getCompetitionActiveAgentDecisions().flatMap((item) => item.transportEvents || []).length,
          taskEventCount: openxnetApp.getCompetitionTaskGraphEvents().length,
          toolResultCount: document.querySelectorAll('.competition-task-node__result').length,
          completionGateCount: document.querySelectorAll('.competition-completion-gates > ol > li').length,
          completionPassed: completion.passed,
          completionTotal: completion.total,
          completionAllowed: completion.complete,
          skillRoundCount: document.querySelectorAll('.competition-skill-rounds li').length,
          memoryPanelVisible: Boolean(document.querySelector('.competition-memory-skill')),
        };
      })()
    `, true);
    await scrollSelectorIntoView(window, ".competition-agent-flow");
    const competitionContextPath = await captureWindow(window, "competition-agentteams-context.png");
    await scrollSelectorIntoView(window, ".competition-assurance-grid");
    const competitionAssurancePath = await captureWindow(window, "competition-completion-memory.png");
    await scrollSelectorIntoView(window, ".competition-workbench");
    await resizeWindow(window, 1_024, 720);
    await stabilizeApplicationView(window, "enterprise", "competition");
    const competitionCompactLayout = await inspectLayout(window, ".competition-workbench");
    const competitionCompactPath = await captureWindow(window, "competition-compact.png");
    await resizeWindow(window, 1_440, 960);

    const sandboxFixture = createSandboxFixture(snapshot);
    await renderEnterpriseSandbox(window, sandboxFixture, snapshot);
    const sandboxPath = await captureWindow(window, "enterprise-sandbox-chat.png");
    const sandboxLayout = await inspectLayout(window, ".enterprise-sandbox-workbench");
    await window.webContents.executeJavaScript(`
      (async () => {
        openxnetApp.setEnterpriseSandboxWorkView('work');
        await openxnetApp.$nextTick();
      })()
    `, true);
    const sandboxWorkPath = await captureWindow(window, "enterprise-sandbox-work.png");
    const sandboxWorkLayout = await inspectLayout(window, ".enterprise-sandbox-panel--chat");
    const sandboxTaskNodeCount = await window.webContents.executeJavaScript(`document.querySelectorAll('.enterprise-sandbox-task-node').length`, true);
    await window.webContents.executeJavaScript(`
      (async () => {
        openxnetApp.setEnterpriseSandboxWorkView('audit');
        await openxnetApp.$nextTick();
      })()
    `, true);
    const sandboxAuditPath = await captureWindow(window, "enterprise-sandbox-audit.png");
    const sandboxAuditLayout = await inspectLayout(window, ".enterprise-sandbox-panel--chat");
    const sandboxUnifiedContract = await window.webContents.executeJavaScript(`
      (() => ({
        tabCount: document.querySelectorAll('.enterprise-sandbox-work-tab').length,
        activeTab: document.querySelector('.enterprise-sandbox-work-tab.is-active')?.textContent.trim() || '',
        chatVisible: Boolean(document.querySelector('.enterprise-sandbox-chat-messages')),
        invocationCount: document.querySelectorAll('.enterprise-sandbox-invocation').length,
        receiptCount: document.querySelectorAll('.enterprise-sandbox-audit-row').length,
        scenarioType: openxnetApp.enterpriseCompetitionScenarioType,
      }))()
    `, true);
    await window.webContents.executeJavaScript(`
      (async () => {
        openxnetApp.setEnterpriseSandboxWorkView('chat');
        await openxnetApp.$nextTick();
      })()
    `, true);
    await resizeWindow(window, 1_024, 720);
    const sandboxCompactPath = await captureWindow(window, "enterprise-sandbox-chat-compact.png");
    const sandboxCompactLayout = await inspectLayout(window, ".enterprise-sandbox-workbench");
    const sandboxContract = await window.webContents.executeJavaScript(`
      (() => ({
        viewportHeight: window.innerHeight,
        activeMenu: openxnetApp.activeMenu,
        enterpriseTab: openxnetApp.enterpriseTab,
        projectFloorVisible: document.body.innerText.includes('企业 AI 全链路治理'),
        chatVisible: Boolean(document.querySelector('.enterprise-sandbox-panel--chat')),
        operationVisible: Boolean(document.querySelector('.enterprise-sandbox-operation.is-rk-2')),
        canvasCount: document.querySelectorAll('#enterprise-3d-container canvas').length,
        bodyClasses: document.body.className,
        shellClasses: document.querySelector('.enterprise-sandbox-shell')?.className || '',
        elements: [
          '.enterprise-sandbox-navigator',
          '.enterprise-sandbox-stage',
          '.enterprise-sandbox-panel--chat',
          '#enterprise-3d-container canvas',
          '.enterprise-sandbox-chat-input',
          '.enterprise-sandbox-chat-textarea',
          '.enterprise-sandbox-chat-task',
          '.enterprise-sandbox-chat-send',
        ].map((selector) => {
          const element = document.querySelector(selector);
          if (!element) return { selector, missing: true };
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            selector,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            zIndex: style.zIndex,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }),
      }))()
    `, true);

    process.stdout.write(`${JSON.stringify({
      phase: "layout-diagnostics",
      competitionProductionEmptyLayout,
      competitionRehearsalEmptyLayout,
      competitionProductionContract,
      competitionRehearsalContract,
      competitionProcessContract,
      competitionSectionOrder,
      competitionLightLayout,
      competitionDarkLayout,
      competitionCompactLayout,
      sandboxLayout,
      sandboxWorkLayout,
      sandboxAuditLayout,
      sandboxCompactLayout,
      sandboxContract,
      sandboxUnifiedContract,
      sandboxTaskNodeCount,
    })}\n`);

    assert.equal(competitionProductionEmptyLayout.missing, false);
    assert.equal(competitionRehearsalEmptyLayout.missing, false);
    assert.equal(competitionLightLayout.missing, false);
    assert.equal(competitionDarkLayout.missing, false);
    assert.equal(competitionCompactLayout.missing, false);
    assert.equal(sandboxLayout.missing, false);
    assert.equal(sandboxWorkLayout.missing, false);
    assert.equal(sandboxAuditLayout.missing, false);
    assert.equal(sandboxCompactLayout.missing, false);
    assert.equal(competitionProductionEmptyLayout.clippedText.length, 0);
    assert.equal(competitionRehearsalEmptyLayout.clippedText.length, 0);
    assert.equal(competitionLightLayout.clippedText.length, 0);
    assert.equal(competitionDarkLayout.clippedText.length, 0);
    assert.equal(competitionCompactLayout.clippedText.length, 0);
    assert.equal(sandboxLayout.clippedText.length, 0);
    assert.equal(sandboxWorkLayout.clippedText.length, 0);
    assert.equal(sandboxAuditLayout.clippedText.length, 0);
    assert.equal(sandboxCompactLayout.clippedText.length, 0);
    assert.equal(competitionProductionContract.titleVisible, true);
    assert.equal(competitionProductionContract.waitingVisible, true);
    assert.equal(competitionProductionContract.rehearsalToggleVisible, false);
    assert.equal(competitionProductionContract.rehearsalPanelVisible, false);
    assert.equal(competitionProductionContract.adapterControlsVisible, false);
    assert.equal(competitionRehearsalContract.panelVisible, true);
    assert.equal(competitionRehearsalContract.stagingLabelVisible, true);
    assert.equal(competitionRehearsalContract.fixtureVisible, true);
    assert.equal(competitionRehearsalContract.liveVisible, true);
    assert.equal(competitionRehearsalContract.createVisible, true);
    assert.equal(competitionProcessContract.contextTransferCount, 3);
    assert.equal(competitionProcessContract.matrixEventCount, 10);
    assert.ok(competitionProcessContract.taskEventCount > 0);
    assert.ok(competitionProcessContract.toolResultCount > 0);
    assert.ok(competitionProcessContract.completionGateCount >= 6);
    assert.equal(competitionProcessContract.completionPassed, competitionProcessContract.completionTotal);
    assert.equal(competitionProcessContract.completionAllowed, true);
    assert.equal(competitionProcessContract.skillRoundCount, 4);
    assert.equal(competitionProcessContract.memoryPanelVisible, true);
    assert.equal(competitionSectionOrder.complete, true);
    assert.equal(competitionSectionOrder.followsPrimary, true);
    assert.equal(competitionSectionOrder.ordered, true);
    assert.equal(competitionSectionOrder.contextItemsOrdered, true);
    assert.equal(competitionSectionOrder.gateItemsOrdered, true);
    assert.equal(
      competitionLightLayout.scrollContainers.filter((item) => item !== "main.oxe-content.ent-panels-content").length,
      0,
    );
    assert.equal(sandboxContract.projectFloorVisible, true);
    assert.equal(sandboxContract.chatVisible, true);
    assert.equal(sandboxContract.operationVisible, true);
    assert.equal(sandboxContract.canvasCount, 1);
    assert.equal(sandboxUnifiedContract.tabCount, 3);
    assert.match(sandboxUnifiedContract.activeTab, /审计|Audit/u);
    assert.equal(sandboxUnifiedContract.chatVisible, false);
    assert.ok(sandboxTaskNodeCount > 0);
    assert.ok(sandboxUnifiedContract.invocationCount > 0);
    assert.ok(sandboxUnifiedContract.receiptCount > 0);
    assert.equal(sandboxUnifiedContract.scenarioType, "feature-drift");
    const sandboxElements = new Map(sandboxContract.elements.map((item) => [item.selector, item]));
    const chatPanel = sandboxElements.get('.enterprise-sandbox-panel--chat');
    for (const selector of [
      '.enterprise-sandbox-chat-input',
      '.enterprise-sandbox-chat-textarea',
      '.enterprise-sandbox-chat-task',
      '.enterprise-sandbox-chat-send',
    ]) {
      const element = sandboxElements.get(selector);
      assert.ok(element && !element.missing, `${selector} is missing from compact chat.`);
      assert.notEqual(element.display, 'none', `${selector} is hidden in compact chat.`);
      assert.ok(element.y >= chatPanel.y, `${selector} starts above the compact chat panel.`);
      assert.ok(element.y + element.height <= chatPanel.y + chatPanel.height + 1, `${selector} is clipped below the compact chat panel.`);
      assert.ok(element.y + element.height <= sandboxContract.viewportHeight, `${selector} is outside the compact viewport.`);
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      incidentStatus: snapshot.incidents.at(-1)?.status,
      executionSteps: snapshot.actions.at(-1)?.steps.length,
      evidenceCount: snapshot.evidence.length,
      competitionProductionEmptyLayout,
      competitionRehearsalEmptyLayout,
      competitionProductionContract,
      competitionRehearsalContract,
      competitionProcessContract,
      competitionLightLayout,
      competitionDarkLayout,
      competitionCompactLayout,
      sandboxLayout,
      sandboxWorkLayout,
      sandboxAuditLayout,
      sandboxCompactLayout,
      sandboxContract,
      sandboxUnifiedContract,
      sandboxTaskNodeCount,
      screenshots: [
        competitionProductionEmptyPath,
        competitionRehearsalEmptyPath,
        competitionLightPath,
        competitionDarkPath,
        competitionContextPath,
        competitionAssurancePath,
        competitionCompactPath,
        sandboxPath,
        sandboxWorkPath,
        sandboxAuditPath,
        sandboxCompactPath,
      ],
    })}\n`);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await gateway.stop();
  }
}

/** 等待 Electron 就绪并运行 GOAI UI 烟测；无输入，失败时输出堆栈并返回非零状态。 */
async function main() {
  try {
    await app.whenReady();
    await runSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
