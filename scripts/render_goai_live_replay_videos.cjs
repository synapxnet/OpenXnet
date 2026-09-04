"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const { app, BrowserWindow } = require("electron");
const { LocalUiGateway } = require("../build-ts/desktop");

const DEFAULT_DATA_ROOT = "E:\\openxnet-temp\\openxnet-goai-live-preserved";
const DEFAULT_OUTPUT_ROOT = "E:\\openxnet-temp\\goai-live-video-20260903";
const DEFAULT_MEMORY_SUMMARY = "E:\\openxnet-temp\\goai-live-video-20260902\\memory-replay.json";
const DEFAULT_PLATFORM_SCREENSHOT_ROOT = "E:\\openxnet-source\\.codex-tmp\\goai-platform-live";
const PLATFORM_SCREENSHOTS = Object.freeze({
  dataops: {
    fileName: "xnetdataops-dashboard.png",
    name: "XnetDataOps",
    detail: "真实数据源、元数据、质量告警与查询记录，作为跨域证据和训练数据入口。",
  },
  mlops: {
    fileName: "xnetmlops-dashboard.png",
    name: "XnetMLOps",
    detail: "真实训练任务、模型产出、在线服务与发布状态，支撑模型迭代和部署验证。",
  },
  aiops: {
    fileName: "xnetaiops-dashboard.png",
    name: "XnetAIOps",
    detail: "真实节点、服务可用率、资源负载与运行事件，支撑容量治理和服务恢复验证。",
  },
});
const VIDEO_SCENARIOS = Object.freeze([
  {
    scenarioType: "recommendation-capacity",
    fileName: "DEMO-01-推荐服务GPU拥塞自治恢复.mp4",
    title: "推荐服务 GPU 拥塞自治恢复",
    task: "请调查推荐服务 GPU 饱和、队列积压与 P99 延迟飙升，并提交可审批、可回滚的容量治理计划。",
    platformOrder: ["aiops", "mlops", "dataops"],
  },
  {
    scenarioType: "quantitative-iteration",
    fileName: "DEMO-02-量化模型归因与受控迭代.mp4",
    title: "量化模型归因与受控迭代",
    task: "请完成盘后因子归因、训练评估与模拟盘灰度，禁止自动切换真实资金。",
    platformOrder: ["mlops", "dataops", "aiops"],
  },
  {
    scenarioType: "feature-drift",
    fileName: "DEMO-03-跨域特征漂移恢复.mp4",
    title: "跨域特征漂移恢复",
    task: "请调查优质客户审批通过率持续下降，并给出可审批、可回滚的跨域恢复方案。",
    platformOrder: ["dataops", "mlops", "aiops"],
  },
]);
let progressLogPath = "";
let annotationWindow = null;

/** 输出单行 UTF-8 结构化进度，便于定位长时间录制阶段。 */
function logProgress(phase, detail = {}) {
  const line = `${JSON.stringify({ timestamp: new Date().toISOString(), phase, ...detail })}\n`;
  process.stdout.write(line);
  if (progressLogPath) appendFileSync(progressLogPath, line, "utf8");
}

/** 为异步录制步骤增加有界超时并保留阶段名称。 */
async function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 超过 ${timeoutMs}ms。`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** 读取环境变量中的绝对路径；未配置时使用 E 盘默认目录。 */
function resolveDirectory(name, fallback) {
  const value = String(process.env[name] || fallback).trim();
  if (!path.isAbsolute(value)) throw new Error(`${name} 必须是绝对路径。`);
  return path.resolve(value);
}

/** 按可选环境变量筛选录制场景；未配置时仍生成完整三场景交付。 */
function resolveVideoScenarios() {
  const configured = String(process.env.OPENXNET_GOAI_VIDEO_SCENARIOS || "").trim();
  if (!configured) return VIDEO_SCENARIOS;
  const requested = new Set(configured.split(",").map((item) => item.trim()).filter(Boolean));
  const selected = VIDEO_SCENARIOS.filter((scenario) => requested.has(scenario.scenarioType));
  assert.equal(selected.length, requested.size, `存在未知录制场景：${configured}`);
  return selected;
}

/** 读取 UTF-8 JSON 对象并拒绝非对象根节点。 */
function readJson(filePath) {
  const value = JSON.parse(readFileSync(filePath, "utf8"));
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`JSON 根节点必须是对象：${filePath}`);
  }
  return value;
}

/** 通过 JSON 序列化生成不共享引用的快照副本。 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 返回本轮清单中三个成功场景和一个失败补偿场景。 */
function resolveEvidenceSelection(manifest) {
  const successes = new Map();
  let failure = null;
  for (const item of manifest.exports || []) {
    if (item.outcome === "RESOLVED") successes.set(item.scenarioType, item.incidentId);
    if (item.outcome === "FAILED") failure = item.incidentId;
  }
  for (const scenario of VIDEO_SCENARIOS) {
    assert.ok(successes.has(scenario.scenarioType), `缺少 ${scenario.scenarioType} 成功 Live Incident。`);
  }
  assert.ok(failure, "缺少真实 Live 验证失败与补偿 Incident。");
  return { successes, failure };
}

/** 判断控制面记录是否属于指定 Incident 或其活动 Trace。 */
function belongsToIncident(item, incidentId, traceId) {
  if (!item || typeof item !== "object") return false;
  return item.incidentId === incidentId || (traceId && item.traceId === traceId);
}

/** 从总控制面中提取单个 Incident 的完整、原始 Live 证据子集。 */
function selectIncidentSnapshot(source, incidentId) {
  const incident = (source.incidents || []).find((item) => item.incidentId === incidentId);
  assert.ok(incident, `控制面缺少 Incident：${incidentId}`);
  const traceId = incident.activeTraceId;
  const collections = [
    "traces",
    "invocations",
    "evidence",
    "approvals",
    "actions",
    "auditReceipts",
    "teamBindings",
    "agentDecisions",
    "skillUsages",
    "taskGraphs",
    "reasoningDecisions",
    "skillEvolutionRuns",
  ];
  const selected = { ...cloneJson(source), adapterMode: "live", incidents: [cloneJson(incident)] };
  for (const name of collections) {
    selected[name] = (source[name] || [])
      .filter((item) => belongsToIncident(item, incidentId, traceId))
      .map(cloneJson);
  }
  return selected;
}

/** 按时间边界裁剪工具调用和证据，重建某一审计时刻的可见状态。 */
function filterRecordsBefore(records, cutoff) {
  const cutoffTime = Date.parse(cutoff || "");
  if (!Number.isFinite(cutoffTime)) return records.map(cloneJson);
  return records.filter((item) => {
    const timestamp = item.observedAt || item.completedAt || item.startedAt || item.createdAt;
    const time = Date.parse(timestamp || "");
    return !Number.isFinite(time) || time <= cutoffTime;
  }).map(cloneJson);
}

/** 把任务图节点重建为指定治理阶段的状态，供审计回放展示。 */
function rebuildTaskGraph(graph, phase, completedSteps = 0) {
  const rebuilt = cloneJson(graph);
  rebuilt.nodes = (rebuilt.nodes || []).map((node) => {
    const result = { ...node };
    if (phase === "approval") {
      result.status = ["ROUTING", "RETRIEVAL", "EVIDENCE", "REASONING"].includes(node.lane)
        ? (node.nodeId === "fuse-cross-platform-evidence" ? "PENDING" : "SUCCEEDED")
        : "PENDING";
    } else if (phase === "execution") {
      if (node.lane === "EXECUTION") {
        const sequence = Number((node.nodeId.match(/^execute:(.+)$/) || [])[1]
          ? rebuilt.nodes.filter((candidate) => candidate.lane === "EXECUTION")
            .findIndex((candidate) => candidate.nodeId === node.nodeId) + 1
          : 0);
        result.status = sequence <= completedSteps ? "SUCCEEDED" : (sequence === completedSteps + 1 ? "RUNNING" : "PENDING");
      } else if (["VERIFICATION", "CRYSTALLIZATION"].includes(node.lane)) {
        result.status = "PENDING";
      }
    } else if (phase === "verification" && ["VERIFICATION", "CRYSTALLIZATION"].includes(node.lane)) {
      result.status = "PENDING";
    }
    return result;
  });
  rebuilt.status = phase === "approval" ? "AWAITING_APPROVAL" : "RUNNING";
  rebuilt.completedAt = null;
  rebuilt.crystallizedAt = null;
  return rebuilt;
}

/** 根据真实终态和审计时间重建待审批、执行中或待验证画面。 */
function buildReplayPhaseSnapshot(finalSnapshot, phase, completedSteps = 0) {
  const replay = cloneJson(finalSnapshot);
  const incident = replay.incidents[0];
  const approval = replay.approvals[0];
  const action = replay.actions[0];
  if (phase === "approval") {
    incident.status = "AWAITING_APPROVAL";
    incident.activeActionId = null;
    incident.resolvedAt = null;
    if (approval) {
      approval.status = "PENDING";
      approval.decidedBy = null;
      approval.decidedAt = null;
      approval.decisionReason = null;
    }
    replay.actions = [];
    replay.agentDecisions = replay.agentDecisions.filter((item) => item.stage !== "VERIFICATION_CONCLUSION");
    replay.skillEvolutionRuns = [];
    replay.evidence = filterRecordsBefore(replay.evidence, approval?.requestedAt);
    replay.invocations = filterRecordsBefore(replay.invocations, approval?.requestedAt);
    replay.taskGraphs = replay.taskGraphs.map((graph) => rebuildTaskGraph(graph, phase));
  } else if (phase === "execution") {
    incident.status = "MITIGATING";
    incident.resolvedAt = null;
    replay.agentDecisions = replay.agentDecisions.filter((item) => item.stage !== "VERIFICATION_CONCLUSION");
    replay.skillEvolutionRuns = [];
    if (action) {
      action.status = "RUNNING";
      action.stage = "EXECUTING";
      action.completedAt = null;
      action.verificationEvidenceIds = [];
      action.steps = action.steps.map((step, index) => ({
        ...step,
        status: index < completedSteps ? "SUCCEEDED" : (index === completedSteps ? "RUNNING" : "PENDING"),
        completedAt: index < completedSteps ? step.completedAt : null,
        evidenceId: index < completedSteps ? step.evidenceId : null,
      }));
    }
    const allowedEvidence = new Set((action?.steps || []).slice(0, completedSteps).map((step) => step.evidenceId).filter(Boolean));
    const approvalEvidence = filterRecordsBefore(replay.evidence, approval?.requestedAt);
    replay.evidence = [
      ...approvalEvidence,
      ...replay.evidence.filter((item) => allowedEvidence.has(item.evidenceId)),
    ].filter((item, index, items) => items.findIndex((candidate) => candidate.evidenceId === item.evidenceId) === index);
    replay.taskGraphs = replay.taskGraphs.map((graph) => rebuildTaskGraph(graph, phase, completedSteps));
  } else if (phase === "verification") {
    incident.status = "MITIGATING";
    incident.resolvedAt = null;
    replay.agentDecisions = replay.agentDecisions.filter((item) => item.stage !== "VERIFICATION_CONCLUSION");
    replay.skillEvolutionRuns = [];
    if (action) {
      action.status = "SUCCEEDED";
      action.stage = "VERIFYING";
      action.completedAt = null;
      action.verificationEvidenceIds = [];
    }
    replay.taskGraphs = replay.taskGraphs.map((graph) => rebuildTaskGraph(graph, phase));
  }
  replay.updatedAt = approval?.requestedAt || incident.updatedAt;
  return replay;
}

/** 启动只服务本地静态界面的 UI Gateway，禁止激活兼容后端。 */
async function startUiGateway(staticRoot) {
  const gateway = new LocalUiGateway({
    staticRoot,
    getBackendOrigin: () => null,
    activateBackend: async () => {
      throw new Error("Live 审计回放不得激活兼容后端。");
    },
  });
  const origin = await gateway.start();
  return { gateway, origin };
}

/** 等待真实 OpenXnet Renderer 完成 Vue 挂载。 */
async function waitForRenderer(window) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 20000;
      const check = () => {
        if (typeof openxnetApp !== 'undefined' && document.querySelector('.openxnet-redesign-app')) return resolve(true);
        if (Date.now() >= deadline) return reject(new Error('OpenXnet Renderer 挂载超时。'));
        window.setTimeout(check, 50);
      };
      check();
    })
  `, true);
}

/** 固定浅色主题和企业权限，保证三段视频视觉一致。 */
async function prepareRenderer(window) {
  await window.webContents.executeJavaScript(`
    (async () => {
      openxnetApp.authState.status = 'signed_in_premium';
      openxnetApp.authState.enterpriseAccess = true;
      openxnetApp.authState.profile = { ...openxnetApp.authState.profile, id: 'goai-live-replay', name: 'GOAI 企业账号' };
      openxnetApp.systemSettings.theme = 'light';
      openxnetApp.loadCompetitionSnapshot = async () => openxnetApp.competitionSnapshot;
      openxnetApp.loadCompetitionUiProfile = async () => ({ releaseProfile: 'goai-staging', rehearsalEnabled: true });
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-theme-choice', 'light');
      await openxnetApp.$nextTick();
    })()
  `, true);
}

/** 渲染指定 Incident 快照并写入真实 Memory V3 记录摘要。 */
async function renderCompetition(window, snapshot, memoryRecord, memoryStatus) {
  await window.webContents.executeJavaScript(`
    (() => {
      openxnetApp.activeMenu = 'enterprise';
      openxnetApp.enterpriseTab = 'competition';
      openxnetApp.competitionReleaseProfile = 'goai-staging';
      openxnetApp.competitionRehearsalAvailable = true;
      openxnetApp.competitionRehearsalVisible = false;
      openxnetApp.competitionAdapterMode = 'live';
      openxnetApp.competitionTeamRuntime = 'agentteams';
      return true;
    })()
  `, true);
  logProgress("competition-view-selected", { incidentId: snapshot.incidents[0]?.incidentId });
  await window.webContents.executeJavaScript(`
    (() => {
      openxnetApp.competitionSnapshot = ${JSON.stringify(snapshot)};
      return true;
    })()
  `, true);
  logProgress("competition-snapshot-injected", { incidentId: snapshot.incidents[0]?.incidentId });
  await window.webContents.executeJavaScript(`
    (() => {
      openxnetApp.competitionMemoryStatus = ${JSON.stringify(memoryStatus || null)};
      openxnetApp.competitionMemoryRecords = ${JSON.stringify(memoryRecord ? [memoryRecord] : [])};
      openxnetApp.competitionMemoryError = '';
      openxnetApp.xnetServices = {
        aiops: { name: 'XnetAIOps', url: 'https://goai.xnetaiops.synapxnet.online/', status: 'online', last_check: ${JSON.stringify(snapshot.updatedAt)}, auto_connect: true },
        dataops: { name: 'XnetDataOps', url: 'https://goai.xnetdataops.synapxnet.online/', status: 'online', last_check: ${JSON.stringify(snapshot.updatedAt)}, auto_connect: true },
        mlops: { name: 'XnetMLOps', url: 'https://goai.xnetmlops.synapxnet.online/', status: 'online', last_check: ${JSON.stringify(snapshot.updatedAt)}, auto_connect: true }
      };
      return true;
    })()
  `, true);
  logProgress("competition-support-state-injected", { incidentId: snapshot.incidents[0]?.incidentId });
  await new Promise((resolve) => setTimeout(resolve, 600));
}

/** 把真实 AgentTeams 决策与治理记录投影为企业项目群消息。 */
function buildEnterpriseMessages(snapshot, scenario) {
  const incident = snapshot.incidents[0];
  const decisions = snapshot.agentDecisions || [];
  const approval = snapshot.approvals[0];
  const action = snapshot.actions[0];
  const base = {
    workspaceId: incident.workspaceId,
    projectId: "project_goai_enterprise_ai_governance",
    taskId: incident.incidentId,
    traceId: incident.activeTraceId,
    mentions: [],
    operation: null,
    status: "delivered",
  };
  return [
    {
      ...base,
      id: `${incident.incidentId}-leader-input`,
      senderType: "leader",
      senderId: "goai-live-operator",
      senderName: "企业负责人",
      kind: "text",
      content: `@Evidence Agent ${scenario.task}`,
      mentions: [{ roleCardId: "role_goai_evidence_agent", roleName: "Evidence Agent" }],
      createdAt: incident.createdAt,
    },
    ...decisions.map((decision, index) => ({
      ...base,
      id: `${incident.incidentId}-agent-${index + 1}`,
      senderType: "agent",
      senderId: decision.roleCardId,
      senderName: decision.agentName,
      kind: "operation",
      content: decision.summary,
      createdAt: decision.createdAt || incident.updatedAt,
      operation: {
        operationId: decision.decisionId,
        authorityLevel: decision.teamRole === "leader" ? "NSX-4" : "NSX-2",
        riskClass: decision.teamRole === "leader" ? "RK-2" : "RK-1",
        evidenceGrade: decision.evidenceIds?.length ? "EV-2" : "EV-1",
        decision: decision.decision,
        phase: decision.stage,
        title: `${decision.agentName} · ${decision.stage}`,
        summary: decision.summary,
        toolNames: decision.requestedToolNames || [],
        skillName: `${decision.skillName}@${decision.skillVersion}`,
        targetResource: incident.scenario.deploymentUid,
        actionDigest: decision.outputDigest,
        approvalId: approval?.approvalId || null,
        invocationIds: [],
        evidenceIds: decision.evidenceIds || [],
        ruleCodes: [],
        ruleReasons: [],
        verificationSummary: decision.teamRole === "verifier" ? decision.decision : null,
      },
    })),
    ...(action ? [{
      ...base,
      id: `${incident.incidentId}-governance`,
      senderType: "system",
      senderId: "openxnet-governance",
      senderName: "OpenXnet Governance",
      kind: "operation",
      content: `计划 ${action.planId} 已完成 ${action.steps.length}/${action.steps.length} 步，等待独立验证结论。`,
      createdAt: action.completedAt || incident.updatedAt,
      operation: {
        operationId: action.actionId,
        authorityLevel: "NSX-4",
        riskClass: "RK-2",
        evidenceGrade: "EV-2",
        decision: action.status,
        phase: action.stage,
        title: action.planTitle,
        summary: `审批 ${approval?.status || '-'} · 执行 ${action.status}`,
        toolNames: action.steps.map((step) => step.toolName),
        skillName: snapshot.skillUsages[0]?.skillId || "-",
        targetResource: action.deploymentUid,
        actionDigest: action.planDigest,
        approvalId: approval?.approvalId || null,
        invocationIds: [],
        evidenceIds: action.steps.map((step) => step.evidenceId).filter(Boolean),
        ruleCodes: ["NSX.APPROVAL.HIGH_RISK_WRITE"],
        ruleReasons: ["写操作必须经过独立人工审批并绑定补偿范围。"],
        verificationSummary: null,
      },
    }] : []),
  ];
}

/** 渲染项目楼层中的企业群聊和工作轨迹。 */
async function renderEnterpriseChat(window, snapshot, scenario) {
  const messages = buildEnterpriseMessages(snapshot, scenario);
  const enterpriseSnapshot = cloneJson(snapshot);
  enterpriseSnapshot.incidents = (enterpriseSnapshot.incidents || []).map((incident) => ({
    ...incident,
    projectId: "project_goai_enterprise_ai_governance",
  }));
  await window.webContents.executeJavaScript(`
    (() => {
      openxnetApp.activeMenu = 'enterprise';
      openxnetApp.enterpriseTab = 'enterprise-sandbox';
      openxnetApp.enterpriseWorkspaces = [{
        id: 'ws_goai_demo', name: 'GOAI Competition Demo', type: 'cloud', status: 'running', host: '101.32.9.231', port: 22, username: 'ubuntu', path: ''
      }];
      openxnetApp.enterpriseProjects = [{
        id: 'project_goai_enterprise_ai_governance', workspaceId: 'ws_goai_demo', name: '企业 AI 全链路治理',
        description: 'DataOps、MLOps 与 AIOps 跨域协同处置现场', floor: 1, color: '#2563eb', icon: 'fa-solid fa-diagram-project'
      }];
      openxnetApp.staffRoles = [
        { id: 'role_goai_incident_commander', name: 'Incident Commander', department: '事件治理', enabled: true, assignedWorkspace: 'ws_goai_demo', projectId: 'project_goai_enterprise_ai_governance', skills: ['goai-change-execute'], position3D: { x: -2.5, z: 0.5 } },
        { id: 'role_goai_evidence_agent', name: 'Evidence Agent', department: '跨域取证', enabled: true, assignedWorkspace: 'ws_goai_demo', projectId: 'project_goai_enterprise_ai_governance', skills: ['goai-evidence-collect'], position3D: { x: 0, z: -1.5 } },
        { id: 'role_goai_verification_agent', name: 'Verification Agent', department: '独立验证', enabled: true, assignedWorkspace: 'ws_goai_demo', projectId: 'project_goai_enterprise_ai_governance', skills: ['goai-service-verify'], position3D: { x: 2.5, z: 0.5 } }
      ];
      openxnetApp.enterpriseRoleCards = openxnetApp.staffRoles;
      openxnetApp.enterpriseMessages = ${JSON.stringify(messages)};
      openxnetApp.competitionSnapshot = ${JSON.stringify(enterpriseSnapshot)};
      openxnetApp.sandboxLevel = 2;
      openxnetApp.sandboxCurrentWs = 'ws_goai_demo';
      openxnetApp.sandboxCurrentProject = 'project_goai_enterprise_ai_governance';
      openxnetApp.showSandboxChatPanel = true;
      openxnetApp.enterpriseSandboxWorkView = 'chat';
      return true;
    })()
  `, true);
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  await setEnterpriseSandboxCaptureView(window, "chat");
}

/** 切换企业沙盘协作页签，并保持项目与审计快照不被异步恢复流程覆盖。 */
async function setEnterpriseSandboxCaptureView(window, view) {
  await window.webContents.executeJavaScript(`
    (async () => {
      openxnetApp.authState.status = 'signed_in_premium';
      openxnetApp.authState.enterpriseAccess = true;
      openxnetApp.activeMenu = 'enterprise';
      openxnetApp.enterpriseTab = 'enterprise-sandbox';
      openxnetApp.showSandboxChatPanel = true;
      openxnetApp.setEnterpriseSandboxWorkView(${JSON.stringify(view)});
      await openxnetApp.$nextTick();
      return openxnetApp.enterpriseSandboxWorkView;
    })()
  `, true);
  await new Promise((resolve) => setTimeout(resolve, 720));
}

/** 生成包含真实平台截图、平台身份和证据说明的独立录制页面。 */
function buildPlatformFrameHtml(platform, screenshotBuffer) {
  const imageSource = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;
  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${platform.name} 真实平台证据</title>
        <style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
          body { padding: 24px 28px; color: #10233f; background: #f3f6fb; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
          .platform-live-shell { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px; height: 100%; }
          .platform-live-heading { display: flex; align-items: center; justify-content: space-between; min-height: 58px; }
          .platform-live-heading h1 { margin: 0; font-size: 28px; font-weight: 750; letter-spacing: 0; }
          .platform-live-heading span { padding: 7px 12px; border: 1px solid #b9d3ff; border-radius: 6px; color: #1559b3; background: #eaf2ff; font-size: 14px; font-weight: 700; }
          .platform-live-screenshot { min-height: 0; overflow: hidden; border: 1px solid #cbd8e8; border-radius: 6px; background: #fff; box-shadow: 0 12px 30px rgba(16,35,63,.12); }
          .platform-live-screenshot img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center top; }
          .platform-live-footer { display: flex; align-items: center; justify-content: space-between; min-height: 50px; padding: 0 4px; color: #4a6079; font-size: 15px; }
          .platform-live-footer strong { color: #16865a; }
        </style>
      </head>
      <body>
        <main class="platform-live-shell">
          <header class="platform-live-heading"><h1>${platform.name} · 在线运行证据</h1><span>SynapXnet 企业上下文</span></header>
          <section class="platform-live-screenshot"><img src="${imageSource}" alt="${platform.name} 在线平台截图"></section>
          <footer class="platform-live-footer"><span>${platform.detail}</span><strong>HTTPS · 已认证</strong></footer>
        </main>
      </body>
    </html>`;
}

/** 捕获单个真实平台画面，并把截图来源和场景顺序写入视频清单。 */
async function capturePlatformFrame(context, scenario, platformKey, frameDirectory, frames) {
  const platform = PLATFORM_SCREENSHOTS[platformKey];
  assert.ok(platform, `未知平台截图类型：${platformKey}`);
  const screenshotPath = path.join(context.platformScreenshotRoot, platform.fileName);
  assert.ok(existsSync(screenshotPath), `缺少真实平台截图：${screenshotPath}`);
  const platformWindow = new BrowserWindow({
    show: true,
    x: -10_000,
    y: -10_000,
    width: 1_784,
    height: 952,
    skipTaskbar: true,
    backgroundColor: "#f3f6fb",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    const html = buildPlatformFrameHtml(platform, readFileSync(screenshotPath));
    await withTimeout(
      platformWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`),
      20_000,
      `${platform.name} 截图页加载`,
    );
    await captureFrame(platformWindow, frameDirectory, frames, {
      selector: ".platform-live-screenshot",
      slug: `live-${platformKey}`,
      title: `${frames.length + 1}. ${platform.name} 真实页面`,
      detail: `${scenario.title} 的平台侧变化在真实 HTTPS 页面中可核验，并与 OpenXnet Trace、Evidence ID 和审计回执关联。`,
      badge: "真实在线平台截图",
      durationSeconds: 6,
      sourceState: `authenticated-live-${platformKey}-snapshot`,
    });
  } finally {
    if (!platformWindow.isDestroyed()) platformWindow.destroy();
  }
}

/** 精确滚动到目标元素并返回可用于像素合成的 DOM 边界。 */
async function measureFrameTarget(window, options) {
  const result = await window.webContents.executeJavaScript(`
    (() => {
      try {
        document.querySelectorAll('.goai-video-annotation').forEach((item) => item.remove());
        const selector = ${JSON.stringify(options.selector)};
        const fallbackText = ${JSON.stringify(options.fallbackText || "")};
        const target = document.querySelector(selector) || (fallbackText
          ? Array.from(document.querySelectorAll('section, aside, div')).find((item) => {
            const heading = item.querySelector(':scope > .competition-section-heading h3, :scope > h3');
            return heading && String(heading.textContent || '').includes(fallbackText);
          })
          : null);
        if (!target) throw new Error('录制目标不存在：' + selector);
        target.scrollIntoView({ block: ${JSON.stringify(options.scrollBlock || "start")}, inline: 'nearest', behavior: 'instant' });
        const rect = target.getBoundingClientRect();
        const margin = 6;
        const top = Math.max(66, rect.top - margin);
        const left = Math.max(4, rect.left - margin);
        const right = Math.min(window.innerWidth - 4, rect.right + margin);
        const bottom = Math.min(window.innerHeight - 44, rect.bottom + margin);
        return {
          selector,
          x: Math.round(left),
          y: Math.round(top),
          width: Math.round(right - left),
          height: Math.round(bottom - top),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      } catch (error) {
        return { error: String(error?.message || error), stack: String(error?.stack || '') };
      }
    })()
  `, true);
  if (result?.error) throw new Error(`录制目标测量失败：${result.error}\n${result.stack}`);
  return result;
}

/** 转义写入 SVG 文本节点的内容，防止标题或说明破坏合成文档。 */
function escapeSvgText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  }[character]));
}

/** 按中英文混排宽度把说明拆成最多三行，确保字幕不会超出画面。 */
function wrapOverlayText(value, maximumUnits = 54, maximumLines = 3) {
  const lines = [];
  let current = "";
  let units = 0;
  for (const character of Array.from(String(value || ""))) {
    const weight = character.charCodeAt(0) <= 0x7f ? 0.55 : 1;
    if (current && units + weight > maximumUnits) {
      lines.push(current);
      current = "";
      units = 0;
    }
    current += character;
    units += weight;
  }
  if (current) lines.push(current);
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[maximumLines - 1] = `${visible[maximumLines - 1].replace(/[。；，,.!?！？]?$/, "")}…`;
  return visible;
}

/** 返回复用的静态标注窗口，把动态页面截图与标注渲染过程完全隔离。 */
function getAnnotationWindow() {
  if (annotationWindow && !annotationWindow.isDestroyed()) return annotationWindow;
  annotationWindow = new BrowserWindow({
    show: true,
    x: -10_000,
    y: -10_000,
    width: 1_784,
    height: 952,
    frame: false,
    useContentSize: true,
    skipTaskbar: true,
    backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  return annotationWindow;
}

/** 把红框、分镜标题与证据说明直接渲染到静态截图页，消除动态 DOM 标注丢帧。 */
async function composeAnnotatedFrame(imageBuffer, bounds, options) {
  const frameWindow = getAnnotationWindow();
  const left = Math.max(0.2, (Number(bounds.x || 0) / Math.max(1, Number(bounds.viewportWidth || 1))) * 100);
  const top = Math.max(0.2, (Number(bounds.y || 0) / Math.max(1, Number(bounds.viewportHeight || 1))) * 100);
  const width = Math.min(99.4 - left, (Number(bounds.width || 1) / Math.max(1, Number(bounds.viewportWidth || 1))) * 100);
  const height = Math.min(99.4 - top, (Number(bounds.height || 1) / Math.max(1, Number(bounds.viewportHeight || 1))) * 100);
  const title = escapeSvgText(options.title);
  const badge = escapeSvgText(options.badge || "真实 Live 审计回放");
  const detailLines = wrapOverlayText(options.detail || "").map(escapeSvgText);
  const detailHtml = detailLines.map((line) => `<span>${line}</span>`).join("");
  const html = `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
          body { position: relative; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
          .base { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
          .box { position: absolute; left: ${left}%; top: ${top}%; width: ${width}%; height: ${height}%; border: 5px solid #ef233c; border-radius: 8px; box-shadow: 0 0 0 2px rgba(255,255,255,.92), 0 10px 30px rgba(239,35,60,.24); }
          .label { position: absolute; left: ${left}%; top: max(8px, calc(${top}% - 42px)); min-width: 210px; max-width: 560px; height: 40px; padding: 7px 15px; overflow: hidden; color: #fff; background: #ef233c; border-radius: 6px; font-size: 20px; line-height: 26px; font-weight: 700; white-space: nowrap; }
          .caption { position: absolute; right: 28px; bottom: 58px; width: min(840px, calc(100vw - 560px)); padding: 13px 20px 15px; color: #f8fafc; background: rgba(15,23,42,.95); border: 1px solid #475569; border-radius: 8px; box-shadow: 0 12px 35px rgba(0,0,0,.3); }
          .caption strong { display: block; margin-bottom: 5px; color: #facc15; font-size: 17px; line-height: 23px; }
          .caption span { display: block; font-size: 17px; line-height: 25px; letter-spacing: 0; }
        </style>
      </head>
      <body>
        <img class="base" src="data:image/png;base64,${imageBuffer.toString("base64")}" alt="">
        <div class="box"></div>
        <div class="label">${title}</div>
        <div class="caption"><strong>${badge}</strong>${detailHtml}</div>
      </body>
    </html>`;
  await withTimeout(
    frameWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`),
    20_000,
    `${options.slug} 标注页加载`,
  );
  await frameWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const image = document.querySelector('.base');
      if (image?.complete) return resolve(true);
      image?.addEventListener('load', () => resolve(true), { once: true });
      window.setTimeout(() => resolve(false), 5000);
    })
  `, true);
  await settleCaptureCompositor(frameWindow);
  const annotated = await frameWindow.capturePage();
  assert.ok(!annotated.isEmpty(), `红框静态合成失败：${options.slug}`);
  return annotated.toPNG();
}

/** 等待目标区域真正进入可见合成层，避免页面切换后截图滞后一帧。 */
async function waitForVisibleCaptureTarget(window, selector, timeoutMs = 8_000) {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + ${Number(timeoutMs)};
      const inspect = () => {
        const target = document.querySelector(${JSON.stringify(selector)});
        if (target) {
          const rect = target.getBoundingClientRect();
          const style = window.getComputedStyle(target);
          const visible = rect.width > 20 && rect.height > 20
            && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
            && target.offsetParent !== null;
          if (visible) return resolve({ visible: true, width: rect.width, height: rect.height });
        }
        if (Date.now() >= deadline) return resolve({ visible: false });
        window.setTimeout(inspect, 80);
      };
      inspect();
    })
  `, true);
  if (!result?.visible) throw new Error(`录制目标未进入可见合成层：${selector}`);
  await new Promise((resolve) => setTimeout(resolve, 320));
  return result;
}

/** 在每帧前重新固定企业事件中心，抵消启动期认证恢复任务的延迟覆盖。 */
async function ensureCompetitionCaptureView(window) {
  await window.webContents.executeJavaScript(`
    (() => {
      openxnetApp.authState.status = 'signed_in_premium';
      openxnetApp.authState.enterpriseAccess = true;
      openxnetApp.authState.profile = { ...openxnetApp.authState.profile, id: 'goai-live-replay', name: 'GOAI 企业账号' };
      openxnetApp.activeMenu = 'enterprise';
      openxnetApp.enterpriseTab = 'competition';
      return true;
    })()
  `, true);
  await new Promise((resolve) => setTimeout(resolve, 220));
}

/** 强制离屏窗口完成布局与三轮合成器预热，避免截图落后一帧。 */
async function settleCaptureCompositor(window) {
  await window.webContents.executeJavaScript("document.body.getBoundingClientRect().height", true);
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let warmup = 0; warmup < 3; warmup += 1) {
    await window.capturePage();
    window.webContents.invalidate();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

/** 捕获一个带精确红框的完整窗口画面并登记持续时间。 */
async function captureFrame(window, frameDirectory, frames, options) {
  const isCompetitionFrame = String(options.selector || "").startsWith(".competition");
  const isEnterpriseFrame = String(options.selector || "").startsWith(".enterprise-sandbox");
  if (isCompetitionFrame) {
    await ensureCompetitionCaptureView(window);
  }
  if (isEnterpriseFrame) {
    const enterpriseView = options.selector.includes("audit")
      ? "audit"
      : (options.selector.includes("work-view") ? "work" : "chat");
    await setEnterpriseSandboxCaptureView(window, enterpriseView);
  }
  await waitForVisibleCaptureTarget(window, options.selector);
  let bounds = await measureFrameTarget(window, options);
  await settleCaptureCompositor(window);
  let image = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    image = await window.capturePage();
    if (!image.isEmpty()) break;
    window.webContents.invalidate();
    await new Promise((resolve) => setTimeout(resolve, attempt * 120));
  }
  if (!image || image.isEmpty()) throw new Error(`截图为空：${options.slug}`);
  const number = String(frames.length + 1).padStart(3, "0");
  const destination = path.join(frameDirectory, `${number}-${options.slug}.png`);
  const outputBuffer = options.skipAnnotation === true
    ? image.toPNG()
    : await composeAnnotatedFrame(image.toPNG(), bounds, options);
  writeFileSync(destination, outputBuffer);
  frames.push({
    index: frames.length + 1,
    path: destination,
    durationSeconds: options.durationSeconds,
    title: options.title,
    detail: options.detail,
    badge: options.badge || "真实 Live 审计回放",
    sourceState: options.sourceState,
    bounds,
  });
  logProgress("frame-captured", { scenario: path.basename(frameDirectory), frame: frames.length, file: destination });
  return destination;
}

/** 丢弃一次跨页面截图周期，让 Windows 合成器提交新页面后再保存正式分镜。 */
async function primeCaptureTransition(window, frameDirectory, options) {
  const primeDirectory = path.join(frameDirectory, ".transition-prime");
  rmSync(primeDirectory, { recursive: true, force: true });
  mkdirSync(primeDirectory, { recursive: true });
  try {
    await captureFrame(window, primeDirectory, [], {
      ...options,
      slug: "discarded-transition",
      title: "页面切换准备",
      detail: "",
      durationSeconds: 0,
      sourceState: "discarded-render-transition",
      skipAnnotation: true,
    });
  } finally {
    rmSync(primeDirectory, { recursive: true, force: true });
  }
}

/** 展开 Matrix 原始事件明细以展示 AgentTeams 原始传输上下文。 */
async function expandMatrixEvents(window) {
  await window.webContents.executeJavaScript(`
    (() => document.querySelectorAll('.competition-agent-events').forEach((item, index) => { item.open = index === 0; }))()
  `, true);
  await new Promise((resolve) => setTimeout(resolve, 180));
}

/** 读取录制时的最小 Renderer 状态，定位延迟覆盖或条件渲染问题。 */
async function inspectRendererState(window) {
  return window.webContents.executeJavaScript(`
    (() => ({
      activeMenu: openxnetApp.activeMenu,
      enterpriseTab: openxnetApp.enterpriseTab,
      incidents: openxnetApp.competitionSnapshot?.incidents?.length || 0,
      taskGraphs: openxnetApp.competitionSnapshot?.taskGraphs?.length || 0,
      activeIncidentId: openxnetApp.getCompetitionActiveIncident()?.incidentId || null,
      activeTaskGraph: Boolean(openxnetApp.getCompetitionActiveTaskGraph?.()),
      taskGraphElement: Boolean(document.querySelector('.competition-task-graph')),
      bodyText: String(document.body.innerText || '').slice(0, 240),
    }))()
  `, true);
}

/** 从 Memory 物化清单中返回指定场景的真实 V3 记录。 */
function findMemoryRecord(memorySummary, scenarioType) {
  return (memorySummary.items || []).find((item) => item.scenarioType === scenarioType)?.record || null;
}

/** 生成单个 Demo 的完整回放分镜和 PNG 证据。 */
async function captureScenarioFrames(window, context, scenario) {
  const incidentId = context.selection.successes.get(scenario.scenarioType);
  const finalSnapshot = selectIncidentSnapshot(context.controlPlane, incidentId);
  const approvalSnapshot = buildReplayPhaseSnapshot(finalSnapshot, "approval");
  const action = finalSnapshot.actions[0];
  assert.ok(action?.steps?.length, `Incident ${incidentId} 缺少完整执行步骤。`);
  const midpoint = Math.max(1, Math.floor((action?.steps?.length || 1) / 2));
  const progressSnapshot = buildReplayPhaseSnapshot(finalSnapshot, "execution", midpoint);
  const verificationSnapshot = buildReplayPhaseSnapshot(finalSnapshot, "verification");
  const failureSnapshot = selectIncidentSnapshot(context.controlPlane, context.selection.failure);
  const memoryRecord = findMemoryRecord(context.memorySummary, scenario.scenarioType);
  const frameDirectory = path.join(context.outputRoot, "frames", scenario.scenarioType);
  rmSync(frameDirectory, { recursive: true, force: true });
  mkdirSync(frameDirectory, { recursive: true });
  const frames = [];
  logProgress("scenario-capture-start", { scenario: scenario.scenarioType, incidentId });

  await renderEnterpriseChat(window, finalSnapshot, scenario);
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".enterprise-sandbox-panel--chat",
  });
  await setEnterpriseSandboxCaptureView(window, "work");
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".enterprise-sandbox-work-view",
  });
  await setEnterpriseSandboxCaptureView(window, "audit");
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".enterprise-sandbox-audit-view",
  });
  await setEnterpriseSandboxCaptureView(window, "chat");
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".enterprise-sandbox-panel--chat",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".enterprise-sandbox-panel--chat",
    slug: "enterprise-chat",
    title: "1. 企业项目群协作",
    detail: "负责人在项目群下达任务，Evidence Agent、Incident Commander 与 Verification Agent 的上下文、工具、Skill 和风险等级连续可见。",
    durationSeconds: 7,
    sourceState: "project-chat-projected-from-live-agentteams-events",
  });
  await setEnterpriseSandboxCaptureView(window, "work");
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".enterprise-sandbox-work-view",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".enterprise-sandbox-work-view",
    slug: "enterprise-work",
    title: "2. 企业沙盘工作安排",
    detail: "工作视图按 Agent 展示阶段、任务状态、工具调用和结果，使协同执行进度可追踪。",
    durationSeconds: 6,
    sourceState: "enterprise-work-view-from-live-control-plane",
  });
  await setEnterpriseSandboxCaptureView(window, "audit");
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".enterprise-sandbox-audit-view",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".enterprise-sandbox-audit-view",
    slug: "enterprise-audit",
    title: "3. 企业沙盘审计",
    detail: "审计视图统一呈现 AgentTeams 原始事件、人工审批、执行回执、证据等级与完成门禁。",
    durationSeconds: 6,
    sourceState: "enterprise-audit-view-from-live-control-plane",
  });

  await renderCompetition(window, approvalSnapshot, null, null);
  await primeCaptureTransition(window, frameDirectory, {
    selector: ".competition-incident-pane",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-incident-pane",
    slug: "enterprise-task",
    title: "4. 企业任务输入",
    detail: `${scenario.title} · 企业告警/数据事件/项目群任务进入同一 Incident 与 Trace，后续协同和操作均绑定该标识。`,
    durationSeconds: 6,
    sourceState: "audit-reconstructed-enterprise-task-input",
  });

  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-kpi-strip",
    slug: "runtime-overview",
    title: "5. AgentTeams + Live 运行态",
    detail: `Incident ${incidentId} · 三个平台在线 · 三角色职责快照已绑定。`,
    durationSeconds: 5,
    sourceState: "audit-reconstructed-awaiting-approval",
  });
  await ensureCompetitionCaptureView(window);
  logProgress("renderer-state-before-task-graph", await inspectRendererState(window));
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-task-graph",
    fallbackText: "动态任务图",
    slug: "task-graph",
    title: "6. 任务图与工具进度",
    detail: "取证、推理、审批、执行、验证与结晶节点可追踪；每个工具节点保留结果、Evidence ID 和错误边界。",
    durationSeconds: 6,
    sourceState: "audit-reconstructed-awaiting-approval",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-context-flow",
    slug: "agentteams-context",
    title: "7. AgentTeams 上下文交接",
    detail: "Worker -> Leader -> Verifier 的输入/输出摘要、证据引用、工具清单、Matrix 身份与原始事件均可核验。",
    durationSeconds: 7,
    sourceState: "exact-agentteams-events-before-verification",
  });
  await expandMatrixEvents(window);
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-agent-events",
    fallbackText: "Matrix 原始事件",
    slug: "agentteams-matrix-events",
    title: "8. Matrix 原始事件",
    detail: "展示 TASK/ROUTE 请求与响应、发送者、接收者、Room ID、Event ID、脱敏正文和连续账本摘要。",
    durationSeconds: 7,
    sourceState: "exact-agentteams-matrix-events",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-action-pane",
    slug: "human-approval",
    title: "9. 人工审批控制点",
    detail: `计划 ${finalSnapshot.approvals[0]?.planId} · 审批范围 ${finalSnapshot.approvals[0]?.scopes?.length || 0} 项 · 审批人与执行人、Verifier 职责分离。`,
    badge: "根据真实审批审计事件重建",
    durationSeconds: 7,
    sourceState: "audit-reconstructed-pending-approval",
  });

  await renderCompetition(window, progressSnapshot, null, null);
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-plan-flow",
    slug: "execution-progress",
    title: `10. 受控执行进度 ${midpoint}/${action.steps.length}`,
    detail: "逐步显示 Agent 执行阶段、调用工具、资源版本、工具回执与 Evidence ID；未完成步骤保持 PENDING。",
    badge: "根据真实工具回执时间线重建",
    durationSeconds: 7,
    sourceState: "audit-reconstructed-execution-progress",
  });

  await renderCompetition(window, verificationSnapshot, null, null);
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-plan-flow",
    slug: "execution-complete",
    title: `11. 执行完成 ${action.steps.length}/${action.steps.length}`,
    detail: "全部计划步骤已成功，但 Incident 尚未关闭；必须进入独立 Verifier 门禁。",
    badge: "根据真实验证前状态重建",
    durationSeconds: 6,
    sourceState: "audit-reconstructed-before-verification",
  });

  await renderCompetition(window, finalSnapshot, memoryRecord, context.memorySummary.status);
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-evidence-grid",
    slug: "platform-evidence",
    title: "12. OpenXnet 三平台证据链",
    detail: "XnetAIOps、XnetDataOps、XnetMLOps 的工具结果、资源版本、观测时间及神经符号候选评分统一关联到同一 Trace。",
    durationSeconds: 7,
    sourceState: "exact-live-terminal-state",
  });
  for (const platformKey of scenario.platformOrder) {
    await capturePlatformFrame(context, scenario, platformKey, frameDirectory, frames);
  }
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-assurance-grid",
    slug: "completion-gates",
    title: "16. 客观完成门禁",
    detail: "只有上下文、职责分离、执行回执、场景阈值、Verifier 结论、审计与回滚准备全部通过，任务才允许关闭。",
    durationSeconds: 7,
    sourceState: "exact-live-terminal-state",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-memory-skill",
    slug: "memory-skill",
    title: "17. Memory V3 与 Skill 沉淀",
    detail: "真实 V3 长期记忆保存 Skill 版本、共享权限和 SHA-256 审计链；四轮测试者/开发者/Verifier 进化过程可追溯。",
    durationSeconds: 7,
    sourceState: "exact-memory-v3-record-and-live-skill-evolution",
  });

  await renderCompetition(window, failureSnapshot, null, context.memorySummary.status);
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-plan-flow__compensation",
    slug: "failure-compensation",
    title: "18. 异常拒绝关闭与自动补偿",
    detail: `共用真实 Live 失败链 ${context.selection.failure}：Verifier 返回 ROLLBACK_REQUIRED，补偿成功，失败事件禁止结晶 Skill。`,
    badge: "真实 Live 失败补偿链",
    durationSeconds: 8,
    sourceState: "exact-live-failure-state",
  });
  await captureFrame(window, frameDirectory, frames, {
    selector: ".competition-completion-gates",
    slug: "failure-gates",
    title: "19. 失败门禁保持关闭",
    detail: "Incident/Action 明确标记 FAILED；即使补偿成功也不伪报 RESOLVED，审计证据继续保留。",
    badge: "真实 Live 失败补偿链",
    durationSeconds: 6,
    sourceState: "exact-live-failure-state",
  });

  return { scenario, incidentId, frames };
}

/** 转义 FFmpeg concat 清单中的 Windows 绝对路径。 */
function escapeConcatPath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

/** 从已构建的 Memory Feature Pack 中定位 FFmpeg 可执行文件。 */
function resolveFfmpeg() {
  const configured = String(process.env.OPENXNET_VIDEO_FFMPEG || "").trim();
  const candidates = [
    configured,
    path.resolve(__dirname, "../artifacts/feature-packs/bundled/memory/runtime/_internal/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"),
    path.resolve(__dirname, "../.venv/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"),
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("未找到 FFmpeg，无法生成 Demo 视频。");
  return executable;
}

/** 将有持续时间的 PNG 分镜编码为无音轨 1080p MP4。 */
function encodeVideo(ffmpeg, result, outputRoot) {
  const manifestPath = path.join(outputRoot, "frames", result.scenario.scenarioType, "concat.txt");
  const lines = [];
  for (const frame of result.frames) {
    lines.push(`file '${escapeConcatPath(frame.path)}'`);
    lines.push(`duration ${frame.durationSeconds.toFixed(3)}`);
  }
  lines.push(`file '${escapeConcatPath(result.frames.at(-1).path)}'`);
  writeFileSync(manifestPath, `${lines.join("\n")}\n`, "utf8");
  const destination = path.join(outputRoot, "videos", result.scenario.fileName);
  mkdirSync(path.dirname(destination), { recursive: true });
  logProgress("video-encode-start", { scenario: result.scenario.scenarioType, destination });
  execFileSync(ffmpeg, [
    "-y", "-f", "concat", "-safe", "0", "-i", manifestPath,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.0",
    "-movflags", "+faststart", "-map_metadata", "-1", destination,
  ], { stdio: "inherit" });
  logProgress("video-encode-complete", { scenario: result.scenario.scenarioType, destination });
  return destination;
}

/** 执行三场景 Renderer 回放、视频编码和公开清单生成。 */
async function run() {
  const dataRoot = resolveDirectory("OPENXNET_GOAI_VIDEO_DATA_ROOT", DEFAULT_DATA_ROOT);
  const outputRoot = resolveDirectory("OPENXNET_GOAI_VIDEO_OUTPUT_ROOT", DEFAULT_OUTPUT_ROOT);
  const memorySummaryPath = path.resolve(process.env.OPENXNET_GOAI_VIDEO_MEMORY_SUMMARY || DEFAULT_MEMORY_SUMMARY);
  const platformScreenshotRoot = resolveDirectory(
    "OPENXNET_GOAI_PLATFORM_SCREENSHOT_ROOT",
    DEFAULT_PLATFORM_SCREENSHOT_ROOT,
  );
  mkdirSync(path.join(outputRoot, "frames"), { recursive: true });
  mkdirSync(path.join(outputRoot, "videos"), { recursive: true });
  progressLogPath = path.join(outputRoot, "render-progress.jsonl");
  writeFileSync(progressLogPath, "", "utf8");
  const controlPlane = readJson(path.join(dataRoot, "competition", "control-plane.v1.json"));
  const manifest = readJson(path.join(dataRoot, "competition", "evaluations", "live-evidence-manifest.json"));
  const memorySummary = readJson(memorySummaryPath);
  const selection = resolveEvidenceSelection(manifest);
  const scenarios = resolveVideoScenarios();
  const staticRoot = path.resolve(__dirname, "../static");
  logProgress("inputs-ready", { dataRoot, outputRoot, memorySummaryPath });
  const { gateway, origin } = await withTimeout(startUiGateway(staticRoot), 20_000, "UI Gateway 启动");
  logProgress("gateway-ready", { origin });
  let window = null;
  try {
    window = new BrowserWindow({
      show: true,
      x: -10_000,
      y: -10_000,
      width: 1_784,
      height: 952,
      minWidth: 1_024,
      minHeight: 720,
      skipTaskbar: true,
      backgroundColor: "#f6f8fb",
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    logProgress("window-created");
    await withTimeout(window.loadURL(origin), 30_000, "Renderer 页面加载");
    logProgress("window-loaded");
    await withTimeout(waitForRenderer(window), 25_000, "Renderer Vue 挂载");
    logProgress("renderer-mounted");
    await withTimeout(prepareRenderer(window), 15_000, "Renderer 企业态准备");
    logProgress("renderer-prepared");
    const context = {
      dataRoot,
      outputRoot,
      platformScreenshotRoot,
      controlPlane,
      manifest,
      memorySummary,
      selection,
    };
    const results = [];
    for (const scenario of scenarios) {
      const captured = await withTimeout(
        captureScenarioFrames(window, context, scenario),
        180_000,
        `${scenario.scenarioType} 分镜捕获`,
      );
      captured.videoPath = encodeVideo(resolveFfmpeg(), captured, outputRoot);
      results.push(captured);
    }
    const publicManifest = {
      schema: "openxnet.goai-live-replay-videos.v1",
      version: "1.2.0",
      environmentClaim: "goai-staging",
      replayDisclosure: "终态为真实 Live 快照；待审批和执行中画面由同一 Incident 的审计事件与工具回执时间线重建。",
      failureIncidentId: selection.failure,
      videos: results.map((result) => ({
        scenarioType: result.scenario.scenarioType,
        incidentId: result.incidentId,
        path: result.videoPath,
        frameCount: result.frames.length,
        durationSeconds: result.frames.reduce((total, frame) => total + frame.durationSeconds, 0),
        frames: result.frames,
      })),
    };
    const manifestPath = path.join(outputRoot, "video-replay-manifest.json");
    writeFileSync(manifestPath, `${JSON.stringify(publicManifest, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({
      success: true,
      outputRoot,
      manifestPath,
      videos: publicManifest.videos.map((item) => ({
        scenarioType: item.scenarioType,
        incidentId: item.incidentId,
        frameCount: item.frameCount,
        durationSeconds: item.durationSeconds,
        path: item.path,
      })),
    })}\n`);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    if (annotationWindow && !annotationWindow.isDestroyed()) annotationWindow.destroy();
    annotationWindow = null;
    await gateway.stop();
  }
}

const userDataRoot = path.join(resolveDirectory("OPENXNET_GOAI_VIDEO_OUTPUT_ROOT", DEFAULT_OUTPUT_ROOT), "electron-user-data");
mkdirSync(userDataRoot, { recursive: true });
app.setPath("userData", userDataRoot);
app.whenReady()
  .then(run)
  .then(() => app.exit(0))
  .catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    app.exit(1);
  });
