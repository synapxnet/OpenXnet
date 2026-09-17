// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
/**
 * AgentTeams 请求契约与真实资源版本映射 / AgentTeams request contracts and actual resource version maps.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-16 | Version: 1.3.0-contract.2
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 * __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * -*- coding: utf-8 -*- | __version__: 1.3.0-contract.2
 * Existing repository license and third-party notices are retained.
 */
"use strict";

const SESSION_SCHEMA = "openxnet.agentteams.session.v2";
const PREPARE_REQUEST_SCHEMA = "openxnet.agentteams.prepare.v1";
const PREPARE_RESULT_SCHEMA = "openxnet.agentteams.prepare-result.v1";
const TASK_REQUEST_SCHEMA = "openxnet.agentteams.task.v1";
const TASK_RESULT_SCHEMA = "openxnet.agentteams.task-result.v1";
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const TEAM_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){1,7}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MATRIX_USER_ID_PATTERN = /^@[^:\s]{1,255}:[^\s]{1,255}$/u;
const TEAM_ROLES = new Set(["leader", "worker", "verifier"]);
const TASK_STAGES = new Set(["INVESTIGATION_PLAN", "INVESTIGATION_CONCLUSION", "VERIFICATION_CONCLUSION"]);
const SCENARIO_TYPES = new Set(["recommendation-capacity", "quantitative-iteration", "feature-drift"]);
const EVIDENCE_SIGNAL_FIELDS = new Set([
  "status", "passed", "valid", "healthy", "ready", "recovered",
  "businessKpiRecovered", "queueAwareAutoscaling", "errorRate", "p95Ms", "p99Ms",
  "successRate", "batchQueueSize", "activeRevision", "trafficPercent",
  "readyReplicas", "desiredReplicas", "informationCoefficient",
  "informationCoefficientThreshold", "sharpeImprovement", "maximumDrawdownIncrease",
  "trainingCompleted", "evaluationPassed", "modelRegistered", "canaryPassed",
  "rollbackReady", "inputContractStatus", "algorithmId", "productVersion", "candidateCount",
  "contractStatus", "modelDigestSha256",
]);
const STAGE_SKILLS = Object.freeze({
  INVESTIGATION_PLAN: Object.freeze({ name: "goai-evidence-collect", version: "1.1.0" }),
  INVESTIGATION_CONCLUSION: Object.freeze({ name: "goai-change-execute", version: "1.1.0" }),
  VERIFICATION_CONCLUSION: Object.freeze({ name: "goai-service-verify", version: "1.1.0" }),
});

/** 表示可以安全返回给 HTTP 客户端的固定错误。 */
class PublicError extends Error {
  /** 创建公开错误；输入状态码、错误码和文案，不保留内部异常。 */
  constructor(status, code, message) {
    super(message);
    this.name = "PublicError";
    this.status = status;
    this.code = code;
  }
}

/** 判断未知值是否为普通对象；输入未知值，返回布尔值。 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验对象字段完全一致；输入对象、字段和标签，无返回，字段漂移时抛错。 */
function requireFields(value, fields, label) {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} fields are invalid.`);
  }
}

/** 读取有界文本；输入值、标签、长度和必填标记，返回规范文本。 */
function requireText(value, label, maximumLength, required = true) {
  if (typeof value !== "string" || value.length > maximumLength || value.includes("\u0000")) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  const normalized = value.trim();
  if (required && normalized.length === 0) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is required.`);
  }
  return normalized;
}

/** 读取稳定资源 ID；输入未知值和标签，返回规范 ID。 */
function requireResourceId(value, label) {
  const normalized = requireText(value, label, 128);
  if (!RESOURCE_ID_PATTERN.test(normalized)) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  return normalized;
}

/** 读取有界唯一文本列表；输入值和标签，返回防御性数组。 */
function requireTextList(value, label) {
  if (!Array.isArray(value) || value.length > 64) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  const result = value.map((item) => requireText(item, label, 256));
  if (new Set(result).size !== result.length) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} must be unique.`);
  }
  return result;
}

/** 读取有界工具名称列表；输入未知数组和标签，返回去重后的稳定名称。 */
function requireToolList(value, label, maximumItems = 32) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  const result = value.map((item) => requireText(item, label, 160));
  if (new Set(result).size !== result.length || result.some((item) => !TOOL_NAME_PATTERN.test(item))) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  return result;
}

/** 读取有限数值；输入未知值、标签和边界，返回合法有限数。 */
function requireNumber(value, label, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  return value;
}

/** 校验 AgentTeams Controller URL；输入未知值，返回 HTTPS、回环或官方容器内网根地址。 */
function requireControllerUrl(value) {
  const normalized = requireText(value, "controllerUrl", 2048);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new PublicError(400, "INVALID_ARGUMENT", "controllerUrl is invalid.");
  }
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname.toLowerCase());
  const embeddedController = parsed.hostname.toLowerCase() === "agentteams-controller" && parsed.port === "8090";
  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== "/" && parsed.pathname !== "")
    || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && (loopback || embeddedController)))
  ) {
    throw new PublicError(400, "INVALID_ARGUMENT", "controllerUrl is not allowed.");
  }
  return parsed.toString().replace(/\/$/u, "");
}

/** 解析 AgentTeams 会话写入请求；输入未知 JSON，返回控制器和不透明令牌。 */
function parseSessionRequest(value) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Session request is invalid.");
  requireFields(value, ["controllerUrl", "authToken", "matrixUrl", "matrixAccessToken", "matrixUserId"], "Session request");
  const matrixUserId = requireText(value.matrixUserId, "matrixUserId", 512);
  if (!MATRIX_USER_ID_PATTERN.test(matrixUserId)) {
    throw new PublicError(400, "INVALID_ARGUMENT", "matrixUserId is invalid.");
  }
  return {
    controllerUrl: requireControllerUrl(value.controllerUrl),
    authToken: requireText(value.authToken, "authToken", 64 * 1024),
    matrixUrl: requireText(value.matrixUrl, "matrixUrl", 2048),
    matrixAccessToken: requireText(value.matrixAccessToken, "matrixAccessToken", 64 * 1024),
    matrixUserId,
  };
}

/** 解析单个角色快照；输入未知值和索引，返回 Team 编译所需的有界字段。 */
function parseMember(value, index) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", `members[${index}] is invalid.`);
  requireFields(value, [
    "roleCardId", "name", "department", "description", "teamRole", "systemPrompt",
    "runtimeSystemPrompt", "permissions", "tools", "skills",
  ], `members[${index}]`);
  if (typeof value.teamRole !== "string" || !TEAM_ROLES.has(value.teamRole)) {
    throw new PublicError(400, "INVALID_ARGUMENT", `members[${index}].teamRole is invalid.`);
  }
  return {
    roleCardId: requireResourceId(value.roleCardId, `members[${index}].roleCardId`),
    name: requireText(value.name, `members[${index}].name`, 160),
    department: requireText(value.department, `members[${index}].department`, 160, false),
    description: requireText(value.description, `members[${index}].description`, 16 * 1024, false),
    teamRole: value.teamRole,
    systemPrompt: requireText(value.systemPrompt, `members[${index}].systemPrompt`, 32 * 1024, false),
    runtimeSystemPrompt: requireText(value.runtimeSystemPrompt, `members[${index}].runtimeSystemPrompt`, 32 * 1024, false),
    permissions: requireTextList(value.permissions, `members[${index}].permissions`),
    tools: requireTextList(value.tools, `members[${index}].tools`),
    skills: requireTextList(value.skills, `members[${index}].skills`),
  };
}

/** 解析 Team Prepare 请求；输入未知 JSON，返回与委托声明可逐项匹配的结构。 */
function parsePrepareRequest(value) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Prepare request is invalid.");
  requireFields(value, [
    "schema", "requestId", "workspaceId", "incidentId", "traceId", "teamTemplateId",
    "teamTemplateVersion", "teamTemplateName", "members",
  ], "Prepare request");
  if (value.schema !== PREPARE_REQUEST_SCHEMA) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Prepare request schema is invalid.");
  }
  if (!Number.isInteger(value.teamTemplateVersion) || value.teamTemplateVersion < 1 || value.teamTemplateVersion > 1_000_000_000) {
    throw new PublicError(400, "INVALID_ARGUMENT", "teamTemplateVersion is invalid.");
  }
  if (!Array.isArray(value.members) || value.members.length < 3 || value.members.length > 16) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Team must contain between 3 and 16 members.");
  }
  const members = value.members.map(parseMember);
  if (new Set(members.map((member) => member.roleCardId)).size !== members.length) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Team members must be unique.");
  }
  if (members.filter((member) => member.teamRole === "leader").length !== 1) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Team must contain exactly one leader.");
  }
  return {
    schema: PREPARE_REQUEST_SCHEMA,
    requestId: requireResourceId(value.requestId, "requestId"),
    workspaceId: requireResourceId(value.workspaceId, "workspaceId"),
    incidentId: requireResourceId(value.incidentId, "incidentId"),
    traceId: requireResourceId(value.traceId, "traceId"),
    teamTemplateId: requireResourceId(value.teamTemplateId, "teamTemplateId"),
    teamTemplateVersion: value.teamTemplateVersion,
    teamTemplateName: requireText(value.teamTemplateName, "teamTemplateName", 160),
    members,
  };
}

/** 严格复制本轮调查的完整平台资源版本，不转换或回退。 / Strictly copy current investigation platform resource versions without coercion or fallback. */
function parseGovernedResourceVersions(value) {
  const label = "scenario.governedResourceVersions";
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  const result = {};
  let entries = 0;
  for (const [platform, versions] of Object.entries(value)) {
    if (!["aiops", "dataops", "mlops"].includes(platform) || !isRecord(versions)) {
      throw new PublicError(400, "INVALID_ARGUMENT", `${label} platform scope is invalid.`);
    }
    const platformVersions = {};
    for (const [resourceId, version] of Object.entries(versions)) {
      entries += 1;
      if (entries > 512 || resourceId.length > 512
        || !/^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$/u.test(resourceId)
        || ["constructor", "prototype", "__proto__"].includes(resourceId)) {
        throw new PublicError(400, "INVALID_ARGUMENT", `${label} resource scope is invalid.`);
      }
      if (typeof version !== "string" || !/^[1-9][0-9]{0,15}$/u.test(version)) {
        throw new PublicError(400, "INVALID_ARGUMENT", `${label} version is invalid.`);
      }
      const numeric = Number(version);
      if (!Number.isSafeInteger(numeric) || numeric > Number.MAX_SAFE_INTEGER - 1024) {
        throw new PublicError(400, "INVALID_ARGUMENT", `${label} version exceeds the safe plan budget.`);
      }
      platformVersions[resourceId] = version;
    }
    result[platform] = platformVersions;
  }
  return result;
}

/** 解析任务场景并保留可选的本轮资源版本。 / Parse task scenarios while retaining optional current investigation resource versions. */
function parseScenario(value) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Task incident scenario is invalid.");
  const hasScenarioType = Object.hasOwn(value, "scenarioType");
  const hasRollbackRevision = Object.hasOwn(value, "rollbackRevision");
  const hasGovernedResourceVersions = Object.hasOwn(value, "governedResourceVersions");
  const textFields = [
    "alertUid", "serviceUid", "clusterId", "namespace", "workloadName", "reportUid", "assetUid",
    "workflowInstanceUid", "deploymentUid", "expectedResourceVersion", "testDatasetRef",
  ];
  requireFields(value, [
    ...(hasScenarioType ? ["scenarioType"] : []),
    ...textFields,
    "failingRevision",
    "targetRevision",
    ...(hasRollbackRevision ? ["rollbackRevision"] : []),
    ...(hasGovernedResourceVersions ? ["governedResourceVersions"] : []),
  ], "Task incident scenario");
  const scenarioType = hasScenarioType ? requireText(value.scenarioType, "scenario.scenarioType", 64) : "feature-drift";
  if (!SCENARIO_TYPES.has(scenarioType)) {
    throw new PublicError(400, "INVALID_ARGUMENT", "scenario.scenarioType is invalid.");
  }
  const result = { scenarioType };
  for (const field of textFields) result[field] = requireText(value[field], `scenario.${field}`, 2048);
  for (const field of ["failingRevision", "targetRevision"]) {
    if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 1_000_000_000) {
      throw new PublicError(400, "INVALID_ARGUMENT", `scenario.${field} is invalid.`);
    }
    result[field] = value[field];
  }
  if (hasRollbackRevision) {
    if (!Number.isInteger(value.rollbackRevision) || value.rollbackRevision < 1 || value.rollbackRevision > 1_000_000_000) {
      throw new PublicError(400, "INVALID_ARGUMENT", "scenario.rollbackRevision is invalid.");
    }
    result.rollbackRevision = value.rollbackRevision;
  }
  if (hasGovernedResourceVersions) {
    result.governedResourceVersions = parseGovernedResourceVersions(value.governedResourceVersions);
  }
  return result;
}

/** 解析任务事件摘要；输入未知对象，返回无凭据的 Incident Context。 */
function parseTaskIncident(value) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Task incident is invalid.");
  requireFields(value, ["title", "summary", "severity", "scenario"], "Task incident");
  if (!["P0", "P1", "P2", "P3"].includes(value.severity)) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task incident severity is invalid.");
  }
  return {
    title: requireText(value.title, "incident.title", 512),
    summary: requireText(value.summary, "incident.summary", 16 * 1024),
    severity: value.severity,
    scenario: parseScenario(value.scenario),
  };
}

/** 解析单条证据摘要；输入未知对象和索引，返回不含原始敏感载荷的证据引用。 */
function parseEvidenceReference(value, index) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", `evidence[${index}] is invalid.`);
  requireFields(value, ["evidenceId", "toolName", "summary", "resourceVersion", "contentDigest", "signals"], `evidence[${index}]`);
  const toolName = requireText(value.toolName, `evidence[${index}].toolName`, 160);
  if (!TOOL_NAME_PATTERN.test(toolName)) {
    throw new PublicError(400, "INVALID_ARGUMENT", `evidence[${index}].toolName is invalid.`);
  }
  return {
    evidenceId: requireResourceId(value.evidenceId, `evidence[${index}].evidenceId`),
    toolName,
    summary: requireText(value.summary, `evidence[${index}].summary`, 4096),
    resourceVersion: requireText(value.resourceVersion, `evidence[${index}].resourceVersion`, 512),
    contentDigest: requireText(value.contentDigest, `evidence[${index}].contentDigest`, 128),
    signals: parseEvidenceSignals(value.signals, index),
  };
}

/** 校验证据验证信号；输入未知对象和证据索引，返回固定白名单内的有界标量。 */
function parseEvidenceSignals(value, index) {
  if (!isRecord(value) || Object.keys(value).length > EVIDENCE_SIGNAL_FIELDS.size) {
    throw new PublicError(400, "INVALID_ARGUMENT", `evidence[${index}].signals is invalid.`);
  }
  const result = {};
  for (const [field, signal] of Object.entries(value)) {
    const validScalar = typeof signal === "boolean"
      || (typeof signal === "number" && Number.isFinite(signal))
      || (typeof signal === "string" && signal.length <= 512 && !signal.includes("\u0000"));
    if (!EVIDENCE_SIGNAL_FIELDS.has(field) || !validScalar) {
      throw new PublicError(400, "INVALID_ARGUMENT", `evidence[${index}].signals is invalid.`);
    }
    result[field] = signal;
  }
  return result;
}

/** 读取 SHA-256 摘要；输入未知值和标签，返回规范小写摘要。 */
function requireDigest(value, label) {
  const normalized = requireText(value, label, 64);
  if (!SHA256_PATTERN.test(normalized)) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  }
  return normalized;
}

/** 解析计划中的单个步骤；输入未知对象和标签，返回固定治理范围。 */
function parsePlanStep(value, label) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", `${label} is invalid.`);
  requireFields(value, [
    "stepId", "toolName", "resourceId", "targetRevision", "expectedResourceVersion", "argumentsDigest", "dependsOn",
  ], label);
  const toolName = requireText(value.toolName, `${label}.toolName`, 160);
  if (
    !TOOL_NAME_PATTERN.test(toolName)
    || !Number.isInteger(value.targetRevision)
    || value.targetRevision < 1
    || value.targetRevision > 1_000_000_000
  ) {
    throw new PublicError(400, "INVALID_ARGUMENT", `${label} scope is invalid.`);
  }
  const dependsOn = requireTextList(value.dependsOn, `${label}.dependsOn`);
  if (dependsOn.length > 16) throw new PublicError(400, "INVALID_ARGUMENT", `${label}.dependsOn is invalid.`);
  return {
    stepId: requireResourceId(value.stepId, `${label}.stepId`),
    toolName,
    resourceId: requireText(value.resourceId, `${label}.resourceId`, 512),
    targetRevision: value.targetRevision,
    expectedResourceVersion: requireText(value.expectedResourceVersion, `${label}.expectedResourceVersion`, 128),
    argumentsDigest: requireDigest(value.argumentsDigest, `${label}.argumentsDigest`),
    dependsOn,
  };
}

/** 解析 Leader 使用的完整主计划与补偿计划；输入 null 或未知对象，返回严格计划引用。 */
function parseProposedPlan(value) {
  if (value === null) return null;
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Task proposedPlan is invalid.");
  requireFields(value, ["planId", "planDigest", "steps", "compensationSteps"], "Task proposedPlan");
  if (
    !Array.isArray(value.steps)
    || value.steps.length < 1
    || value.steps.length > 16
    || !Array.isArray(value.compensationSteps)
    || value.compensationSteps.length < 1
    || value.compensationSteps.length > 8
  ) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task proposedPlan steps are invalid.");
  }
  const steps = value.steps.map((step, index) => parsePlanStep(step, `proposedPlan.steps[${index}]`));
  const compensationSteps = value.compensationSteps
    .map((step, index) => parsePlanStep(step, `proposedPlan.compensationSteps[${index}]`));
  const allStepIds = new Set([...steps, ...compensationSteps].map((step) => step.stepId));
  if (allStepIds.size !== steps.length + compensationSteps.length) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task proposedPlan step IDs must be unique.");
  }
  for (const step of [...steps, ...compensationSteps]) {
    if (step.dependsOn.some((dependency) => !allStepIds.has(dependency) || dependency === step.stepId)) {
      throw new PublicError(400, "INVALID_ARGUMENT", "Task proposedPlan dependency is invalid.");
    }
  }
  return {
    planId: requireResourceId(value.planId, "proposedPlan.planId"),
    planDigest: requireDigest(value.planDigest, "proposedPlan.planDigest"),
    steps,
    compensationSteps,
  };
}

/** 解析已执行动作摘要；输入 null 或未知对象，返回可供验证 Agent 使用的完整计划上下文。 */
function parseActionReference(value) {
  if (value === null) return null;
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Task action is invalid.");
  requireFields(value, [
    "actionId", "planId", "planDigest", "toolName", "resourceVersionAfter",
    "completedStepCount", "compensationPlanReady", "outcome",
  ], "Task action");
  const toolName = requireText(value.toolName, "action.toolName", 160);
  if (
    !TOOL_NAME_PATTERN.test(toolName)
    || !["ACCEPTED", "SUCCEEDED"].includes(value.outcome)
    || !Number.isInteger(value.completedStepCount)
    || value.completedStepCount < 1
    || value.completedStepCount > 32
    || value.compensationPlanReady !== true
  ) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task action is invalid.");
  }
  return {
    actionId: requireResourceId(value.actionId, "action.actionId"),
    planId: requireResourceId(value.planId, "action.planId"),
    planDigest: requireDigest(value.planDigest, "action.planDigest"),
    toolName,
    resourceVersionAfter: requireText(value.resourceVersionAfter, "action.resourceVersionAfter", 512),
    completedStepCount: value.completedStepCount,
    compensationPlanReady: true,
    outcome: value.outcome,
  };
}

/** 解析任务治理策略；输入未知对象，返回审批边界和恢复阈值。 */
function parseTaskPolicy(value) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Task policy is invalid.");
  const extendedFields = ["requireHealthyService", "requireReadyReplicas", "requiredVerificationTools"];
  const hasExtendedPolicy = extendedFields.some((field) => Object.hasOwn(value, field));
  requireFields(value, [
    "approvalRequiredTools",
    "maxErrorRate",
    "maxP95Ms",
    ...(hasExtendedPolicy ? extendedFields : []),
  ], "Task policy");
  if (hasExtendedPolicy && (
    typeof value.requireHealthyService !== "boolean"
    || typeof value.requireReadyReplicas !== "boolean"
  )) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task verification policy is invalid.");
  }
  return {
    approvalRequiredTools: requireToolList(value.approvalRequiredTools, "policy.approvalRequiredTools", 32),
    maxErrorRate: requireNumber(value.maxErrorRate, "policy.maxErrorRate", 0, 1),
    maxP95Ms: requireNumber(value.maxP95Ms, "policy.maxP95Ms", 1, 1_000_000),
    requireHealthyService: hasExtendedPolicy ? value.requireHealthyService : false,
    requireReadyReplicas: hasExtendedPolicy ? value.requireReadyReplicas : false,
    requiredVerificationTools: hasExtendedPolicy
      ? requireToolList(value.requiredVerificationTools, "policy.requiredVerificationTools", 32)
      : [],
  };
}

/** 解析任务并验证可选驻场上下文的完整范围。 / Parse a task and validate complete scopes of optional resident contexts. */
function parseTaskRequest(value, now = new Date()) {
  if (!isRecord(value)) throw new PublicError(400, "INVALID_ARGUMENT", "Task request is invalid.");
  requireFields(value, [
    "schema", "requestId", "workspaceId", "incidentId", "traceId", "teamTemplateId",
    "teamTemplateVersion", "teamName", "stage", "skill", "context",
  ], "Task request");
  if (value.schema !== TASK_REQUEST_SCHEMA || !TASK_STAGES.has(value.stage)) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task request schema or stage is invalid.");
  }
  if (!Number.isInteger(value.teamTemplateVersion) || value.teamTemplateVersion < 1 || value.teamTemplateVersion > 1_000_000_000) {
    throw new PublicError(400, "INVALID_ARGUMENT", "teamTemplateVersion is invalid.");
  }
  const teamName = requireText(value.teamName, "teamName", 63);
  if (!TEAM_NAME_PATTERN.test(teamName)) throw new PublicError(400, "INVALID_ARGUMENT", "teamName is invalid.");
  if (!isRecord(value.skill)) throw new PublicError(400, "INVALID_ARGUMENT", "Task skill is invalid.");
  requireFields(value.skill, ["name", "version"], "Task skill");
  const expectedSkill = STAGE_SKILLS[value.stage];
  if (value.skill.name !== expectedSkill.name || value.skill.version !== expectedSkill.version) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task stage Skill is invalid.");
  }
  if (!isRecord(value.context)) throw new PublicError(400, "INVALID_ARGUMENT", "Task context is invalid.");
  const hasResidentContexts = Object.hasOwn(value.context, "residentContexts");
  requireFields(value.context, ["incident", "availableTools", "evidence", "proposedPlan", "action", "policy", ...(hasResidentContexts ? ["residentContexts"] : [])], "Task context");
  if (!Array.isArray(value.context.evidence) || value.context.evidence.length > 64) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Task evidence is invalid.");
  }
  const result = {
    schema: TASK_REQUEST_SCHEMA,
    requestId: requireResourceId(value.requestId, "requestId"),
    workspaceId: requireResourceId(value.workspaceId, "workspaceId"),
    incidentId: requireResourceId(value.incidentId, "incidentId"),
    traceId: requireResourceId(value.traceId, "traceId"),
    teamTemplateId: requireResourceId(value.teamTemplateId, "teamTemplateId"),
    teamTemplateVersion: value.teamTemplateVersion,
    teamName,
    stage: value.stage,
    skill: {
      name: requireResourceId(value.skill.name, "skill.name"),
      version: requireText(value.skill.version, "skill.version", 64),
    },
    context: {
      incident: parseTaskIncident(value.context.incident),
      availableTools: requireToolList(value.context.availableTools, "context.availableTools"),
      evidence: value.context.evidence.map(parseEvidenceReference),
      proposedPlan: parseProposedPlan(value.context.proposedPlan),
      action: parseActionReference(value.context.action),
      policy: parseTaskPolicy(value.context.policy),
    },
  };
  if (hasResidentContexts) result.context.residentContexts = parseResidentContexts(value.context.residentContexts, result, now);
  if (value.stage === "INVESTIGATION_PLAN" && (
    result.context.evidence.length !== 0
    || result.context.proposedPlan !== null
    || result.context.action !== null
  )) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Investigation plan context is invalid.");
  }
  if (value.stage === "INVESTIGATION_CONCLUSION" && (
    result.context.evidence.length === 0
    || result.context.proposedPlan === null
    || result.context.action !== null
  )) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Investigation conclusion context is invalid.");
  }
  if (value.stage === "VERIFICATION_CONCLUSION" && (
    result.context.evidence.length === 0
    || result.context.proposedPlan !== null
    || result.context.action === null
  )) {
    throw new PublicError(400, "INVALID_ARGUMENT", "Verification conclusion context is invalid.");
  }
  return result;
}

/** 校验驻场上下文的完整范围、只读能力和可引用证据。 / Validate complete resident scope, read-only capabilities and attributable evidence. */
function parseResidentContexts(value, task, now = new Date()) {
  const permissions = {
    aiops: ["aiops.alert.get", "aiops.service.health", "aiops.k8s.workload.get", "aiops.inference.metrics.get", "aiops.inference.recovery.status"],
    dataops: ["dataops.quality.report.get", "dataops.schema.snapshot.get", "dataops.lineage.get", "dataops.workflow.instance.get", "dataops.dataset.validation.get"],
    mlops: ["mlops.deployment.get", "mlops.attribution.report.get", "mlops.inference.probe", "mlops.release.validation.get"],
  };
  /** 仅返回固定错误，不回显请求正文或身份密钥。 / Return fixed errors without echoing request contents or credentials. */
  const reject = (code = "RESIDENT_CONTEXT_INVALID") => { throw new PublicError(400, code, "Resident task context is invalid or outside its authorized scope."); };
  if (!Array.isArray(value) || value.length < 1 || value.length > 3 || Buffer.byteLength(JSON.stringify(value), "utf8") > 65_536) reject();
  const seenPlatforms = new Set();
  const evidence = new Map(task.context.evidence.map(/** 为证据引用建立唯一索引。 / Build a unique evidence-reference index. */ (item) => [item.evidenceId, item]));
  if (evidence.size !== task.context.evidence.length) reject("RESIDENT_EVIDENCE_INVALID");
  const timestamp = now.getTime();
  let runSource = null;
  let runEnvironment = null;
  return value.map(/** 每个平台保留隔离且有界的公开上下文。 / Preserve an isolated bounded public context per platform. */ (item) => {
    if (!isRecord(item)) reject();
    requireFields(item, ["workspaceId", "environment", "source", "runId", "incidentId", "traceId", "agentId", "platform", "contextVersion", "contextTtl", "evidenceRefs", "allowedTools"], "Resident context");
    if (item.workspaceId !== task.workspaceId || item.incidentId !== task.incidentId || item.traceId !== task.traceId
      || item.runId !== `run-${task.traceId}` || typeof item.platform !== "string" || !Object.hasOwn(permissions, item.platform)
      || item.agentId !== `agt-${item.platform}-resident-v130` || seenPlatforms.has(item.platform)) reject("RESIDENT_CONTEXT_SCOPE_MISMATCH");
    if (!["staging", "production"].includes(item.environment) || !["LIVE-STAGING", "REPLAY", "SIMULATION"].includes(item.source)
      || runSource && item.source !== runSource || runEnvironment && item.environment !== runEnvironment) reject("RESIDENT_CONTEXT_SCOPE_MISMATCH");
    if (typeof item.contextVersion !== "string" || !/^ctx-[1-9][0-9]{0,8}$/u.test(item.contextVersion)) reject();
    if (typeof item.contextTtl !== "string" || item.contextTtl.length > 40) reject("RESIDENT_CONTEXT_EXPIRED");
    const expiry = Date.parse(item.contextTtl);
    if (!Number.isFinite(timestamp) || !Number.isFinite(expiry) || expiry <= timestamp || expiry > timestamp + 30 * 60_000) reject("RESIDENT_CONTEXT_EXPIRED");
    const allowedTools = requireToolList(item.allowedTools, "Resident allowedTools", 16);
    if (!allowedTools.length || allowedTools.some(/** 仅接受固定平台只读白名单。 / Accept only fixed read-only tools owned by this platform. */ (tool) => !permissions[item.platform].includes(tool))) reject("RESIDENT_TOOL_FORBIDDEN");
    const evidenceRefs = requireTextList(item.evidenceRefs, "Resident evidenceRefs");
    if (evidenceRefs.some(/** 每个引用必须指向本次任务同平台的真实证据。 / Every reference must address same-platform evidence in this task. */ (id) => {
      const record = evidence.get(id);
      return !record || !record.toolName.startsWith(`${item.platform}.`) || !allowedTools.includes(record.toolName);
    })) reject("RESIDENT_EVIDENCE_INVALID");
    seenPlatforms.add(item.platform);
    runSource = item.source;
    runEnvironment = item.environment;
    return { workspaceId: task.workspaceId, environment: item.environment, source: item.source, runId: item.runId,
      incidentId: task.incidentId, traceId: task.traceId, agentId: item.agentId, platform: item.platform,
      contextVersion: item.contextVersion, contextTtl: item.contextTtl, evidenceRefs, allowedTools };
  });
}

/** 排队或模型往返后再次确认上下文未过期。 / Recheck context validity after queuing or model round trips. */
function assertResidentContextsCurrent(request, now = new Date()) {
  if (request.context.residentContexts !== undefined) parseResidentContexts(request.context.residentContexts, request, now);
}

module.exports = {
  PREPARE_REQUEST_SCHEMA,
  PREPARE_RESULT_SCHEMA,
  PublicError,
  SESSION_SCHEMA,
  TASK_REQUEST_SCHEMA,
  TASK_RESULT_SCHEMA,
  parsePrepareRequest,
  parseSessionRequest,
  parseTaskRequest,
  parseResidentContexts,
  assertResidentContextsCurrent,
};
