/** Kernel Runtime 的唯一 Main IPC 通道。 */
export const APPLICATION_KERNEL_RUNTIME_CHANNELS = Object.freeze({
  invoke: "openxnet:application-kernel-runtime:invoke",
});

/** Kernel Runtime 私有响应 schema。 */
export const APPLICATION_KERNEL_RUNTIME_SCHEMA = "openxnet.kernel-runtime.v1" as const;

/** Renderer 可以调用的固定 Kernel 操作。 */
export const APPLICATION_KERNEL_OPERATIONS = Object.freeze([
  "status",
  "runtime",
  "control-board",
  "action-queue",
  "event-status",
  "plan-control",
  "plan-timeline",
  "plan-runs",
  "plan-resume",
  "runtime-mode",
  "approvals-pending",
  "approvals-history",
  "approval-resolve",
  "audit",
  "traces",
  "trace-detail",
  "trace-recovery",
  "trace-retry",
  "world",
  "plan",
  "plans-recent",
  "plan-step-contract",
  "plan-step-recovery",
  "plan-step-execute",
  "skill-lifecycle",
  "skill-sleep-cycle",
  "skill-change-proposals",
  "skill-change-proposal-resolve",
  "skill-select",
  "skill-transition",
  "guidance-list",
  "guidance-add",
  "config-intent",
  "config-apply",
] as const);

/** 固定 Kernel 操作名称。 */
export type ApplicationKernelOperation = typeof APPLICATION_KERNEL_OPERATIONS[number];

/** Renderer 发往 Main 的 Kernel 命令。 */
export interface ApplicationKernelCommandRequest {
  readonly operation: ApplicationKernelOperation;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Main 返回 Renderer 的 Kernel 命令结果。 */
export interface ApplicationKernelCommandResult {
  readonly schema: typeof APPLICATION_KERNEL_RUNTIME_SCHEMA;
  readonly success: true;
  readonly operation: ApplicationKernelOperation;
  readonly data: unknown;
}

const KERNEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const KERNEL_RUNTIME_MODES = new Set(["off", "shadow", "dual_write", "kernel", "degraded"]);
const KERNEL_APPROVAL_RESOLUTIONS = new Set(["approved", "denied"]);

/**
 * 解析一个 Kernel 命令；输入不可信 IPC 值，返回字段完整且有界的命令；未知操作、额外字段或越界值会抛出 TypeError，且不会产生副作用。
 */
export function parseApplicationKernelCommandRequest(value: unknown): ApplicationKernelCommandRequest {
  const request = requireRecord(value, ["operation", "payload"], "Kernel command");
  const operation = requireOperation(request.operation);
  const payload = parseOperationPayload(operation, request.payload);
  return { operation, payload };
}

/**
 * 解析一个操作载荷；输入固定操作和不可信值，返回规范字段；结构不匹配时抛出 TypeError，不修改输入对象。
 */
function parseOperationPayload(
  operation: ApplicationKernelOperation,
  value: unknown,
): Readonly<Record<string, unknown>> {
  switch (operation) {
    case "status":
    case "runtime":
    case "skill-sleep-cycle":
      return requireRecord(value, [], `${operation} payload`);
    case "control-board":
      return parseControlBoardPayload(value);
    case "action-queue":
      return parseActionQueuePayload(value);
    case "event-status":
    case "approvals-pending":
    case "audit":
    case "traces":
    case "skill-lifecycle":
    case "skill-change-proposals":
      return parseBoundedListPayload(operation, value);
    case "plan-control":
      return parsePlanControlPayload(value);
    case "plan-timeline":
      return parsePlanTimelinePayload(value);
    case "plan-runs":
      return parsePlanRunsPayload(value);
    case "plan-resume":
      return parsePlanResumePayload(value);
    case "runtime-mode":
      return parseRuntimeModePayload(value);
    case "approvals-history":
      return parseApprovalHistoryPayload(value);
    case "approval-resolve":
      return parseApprovalResolvePayload(value);
    case "trace-detail":
    case "trace-recovery":
      return parseSingleIdPayload(value, "traceId", "Trace id");
    case "trace-retry":
      return parseTraceRetryPayload(value);
    case "world":
      return parseWorldPayload(value);
    case "plan":
      return parsePlanPayload(value);
    case "plans-recent":
      return parsePlansRecentPayload(value);
    case "plan-step-contract":
    case "plan-step-recovery":
      return parsePlanStepPayload(value);
    case "plan-step-execute":
      return parsePlanStepExecutePayload(value);
    case "skill-transition":
      return parseSkillTransitionPayload(value);
    case "skill-change-proposal-resolve":
      return parseSkillProposalResolvePayload(value);
    case "skill-select":
      return parseSkillSelectPayload(value);
    case "guidance-list":
      return parseGuidanceListPayload(value);
    case "guidance-add":
      return parseGuidanceAddPayload(value);
    case "config-intent":
      return parseConfigIntentPayload(value);
    case "config-apply":
      return parseConfigApplyPayload(value);
  }
}

/** 解析控制板参数；输入未知值，返回有界筛选条件；非法字段或范围会抛出 TypeError。 */
function parseControlBoardPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["limit", "status", "source", "allowLowRisk", "maxSteps"], "control board payload");
  return {
    limit: requireInteger(payload.limit, "Control board limit", 1, 50),
    status: requireText(payload.status, "Control board status", 80),
    source: requireText(payload.source, "Control board source", 80),
    allowLowRisk: requireBoolean(payload.allowLowRisk, "Control board allowLowRisk"),
    maxSteps: requireInteger(payload.maxSteps, "Control board maxSteps", 1, 10),
  };
}

/** 解析动作队列参数；输入未知值，返回有界筛选和排序条件；额外字段或越界值会抛出 TypeError。 */
function parseActionQueuePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, [
    "limit", "status", "source", "allowLowRisk", "maxSteps", "includeComplete", "actionType", "queueStatus", "sort",
  ], "action queue payload");
  return {
    limit: requireInteger(payload.limit, "Action queue limit", 1, 50),
    status: requireText(payload.status, "Action queue status", 80),
    source: requireText(payload.source, "Action queue source", 80),
    allowLowRisk: requireBoolean(payload.allowLowRisk, "Action queue allowLowRisk"),
    maxSteps: requireInteger(payload.maxSteps, "Action queue maxSteps", 1, 10),
    includeComplete: requireBoolean(payload.includeComplete, "Action queue includeComplete"),
    actionType: requireText(payload.actionType, "Action queue actionType", 80),
    queueStatus: requireText(payload.queueStatus, "Action queue queueStatus", 80),
    sort: requireText(payload.sort, "Action queue sort", 32),
  };
}

/** 解析通用有界列表参数；输入操作和未知值，返回该操作允许的字段；非法值会抛出 TypeError。 */
function parseBoundedListPayload(
  operation: "event-status" | "approvals-pending" | "audit" | "traces" | "skill-lifecycle" | "skill-change-proposals",
  value: unknown,
): Readonly<Record<string, unknown>> {
  const extraField = operation === "audit"
    ? "eventType"
    : operation === "traces" || operation === "skill-lifecycle" || operation === "skill-change-proposals"
      ? "status"
      : "";
  const fields = extraField ? ["limit", extraField] : ["limit"];
  const payload = requireRecord(value, fields, `${operation} payload`);
  const maximum = operation === "event-status" ? 100 : 200;
  return extraField
    ? { limit: requireInteger(payload.limit, `${operation} limit`, 1, maximum), [extraField]: requireText(payload[extraField], `${operation} ${extraField}`, 120) }
    : { limit: requireInteger(payload.limit, `${operation} limit`, 1, maximum) };
}

/** 解析计划控制参数；输入未知值，返回计划 ID 和执行范围；非法 ID 或范围会抛出 TypeError。 */
function parsePlanControlPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["planId", "allowLowRisk", "maxSteps"], "plan control payload");
  return {
    planId: requireId(payload.planId, "Plan id"),
    allowLowRisk: requireBoolean(payload.allowLowRisk, "Plan control allowLowRisk"),
    maxSteps: requireInteger(payload.maxSteps, "Plan control maxSteps", 1, 10),
  };
}

/** 解析计划时间线参数；输入未知值，返回有界查询；非法字段、ID 或范围会抛出 TypeError。 */
function parsePlanTimelinePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["planId", "limit", "status", "includePlan"], "plan timeline payload");
  return {
    planId: requireId(payload.planId, "Plan id"),
    limit: requireInteger(payload.limit, "Plan timeline limit", 1, 200),
    status: requireText(payload.status, "Plan timeline status", 80),
    includePlan: requireBoolean(payload.includePlan, "Plan timeline includePlan"),
  };
}

/** 解析计划运行记录参数；输入未知值，返回计划 ID 和数量；非法字段、ID 或范围会抛出 TypeError。 */
function parsePlanRunsPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["planId", "limit"], "plan runs payload");
  return { planId: requireId(payload.planId, "Plan id"), limit: requireInteger(payload.limit, "Plan runs limit", 1, 100) };
}

/** 解析计划恢复参数；输入未知值，返回固定执行约束；非法字段、ID 或范围会抛出 TypeError。 */
function parsePlanResumePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["planId", "dryRun", "allowLowRisk", "maxSteps", "reason", "runId"], "plan resume payload");
  return {
    planId: requireId(payload.planId, "Plan id"),
    dryRun: requireBoolean(payload.dryRun, "Plan resume dryRun"),
    allowLowRisk: requireBoolean(payload.allowLowRisk, "Plan resume allowLowRisk"),
    maxSteps: requireInteger(payload.maxSteps, "Plan resume maxSteps", 1, 10),
    reason: requireText(payload.reason, "Plan resume reason", 256),
    runId: requireOptionalId(payload.runId, "Plan run id"),
  };
}

/** 解析运行模式切换参数；输入未知值，返回明确的持久化和确认策略；未知模式或非法字段会抛出 TypeError。 */
function parseRuntimeModePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["mode", "reason", "persist", "confirmed", "applyProfile"], "runtime mode payload");
  const mode = requireText(payload.mode, "Kernel runtime mode", 32);
  if (!KERNEL_RUNTIME_MODES.has(mode)) throw new TypeError("Kernel runtime mode is invalid.");
  return {
    mode,
    reason: requireText(payload.reason, "Kernel runtime reason", 256),
    persist: requireBoolean(payload.persist, "Kernel runtime persist"),
    confirmed: requireBoolean(payload.confirmed, "Kernel runtime confirmed"),
    applyProfile: requireBoolean(payload.applyProfile, "Kernel runtime applyProfile"),
  };
}

/** 解析审批历史参数；输入未知值，返回有界数量和状态；非法字段或范围会抛出 TypeError。 */
function parseApprovalHistoryPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["limit", "status"], "approval history payload");
  return {
    limit: requireInteger(payload.limit, "Approval history limit", 1, 200),
    status: requireText(payload.status, "Approval history status", 80),
  };
}

/** 解析审批决议；输入未知值，返回稳定 ID、决议和原因；未知决议或非法字段会抛出 TypeError。 */
function parseApprovalResolvePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["approvalId", "resolution", "reason", "consume"], "approval resolve payload");
  const resolution = requireText(payload.resolution, "Approval resolution", 32);
  if (!KERNEL_APPROVAL_RESOLUTIONS.has(resolution)) throw new TypeError("Approval resolution is invalid.");
  return {
    approvalId: requireId(payload.approvalId, "Approval id"),
    resolution,
    reason: requireText(payload.reason, "Approval reason", 512),
    consume: requireBoolean(payload.consume, "Approval consume"),
  };
}

/** 解析单 ID 参数；输入未知值、字段名和标签，返回稳定 ID；额外字段或非法 ID 会抛出 TypeError。 */
function parseSingleIdPayload(value: unknown, field: string, label: string): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, [field], `${field} payload`);
  return { [field]: requireId(payload[field], label) };
}

/** 解析追踪重试参数；输入未知值，返回固定重试合同；非法 ID、工具参数或额外字段会抛出 TypeError。 */
function parseTraceRetryPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["traceId", "toolName", "toolParams", "approvalId", "reason"], "trace retry payload");
  return {
    traceId: requireId(payload.traceId, "Trace id"),
    toolName: requireText(payload.toolName, "Trace tool name", 256),
    toolParams: requireJsonRecord(payload.toolParams, "Trace tool params"),
    approvalId: requireOptionalId(payload.approvalId, "Approval id"),
    reason: requireText(payload.reason, "Trace retry reason", 256),
  };
}

/** 解析世界状态请求；输入未知值，返回有界消息、模型和最近状态开关；非法消息或字段会抛出 TypeError。 */
function parseWorldPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["messages", "model", "includeRecent"], "world payload");
  return {
    messages: requireMessages(payload.messages),
    model: requireText(payload.model, "World model", 256),
    includeRecent: requireBoolean(payload.includeRecent, "World includeRecent"),
  };
}

/** 解析计划生成请求；输入未知值，返回有界目标、消息和候选工具；非法 JSON 或额外字段会抛出 TypeError。 */
function parsePlanPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["goal", "messages", "model", "candidateTools", "includeWorld"], "plan payload");
  return {
    goal: requireText(payload.goal, "Plan goal", 32_000),
    messages: requireMessages(payload.messages),
    model: requireText(payload.model, "Plan model", 256),
    candidateTools: requireJsonArray(payload.candidateTools, "Plan candidate tools", 200),
    includeWorld: requireBoolean(payload.includeWorld, "Plan includeWorld"),
  };
}

/** 解析最近计划参数；输入未知值，返回有界数量和筛选条件；非法字段或范围会抛出 TypeError。 */
function parsePlansRecentPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["limit", "status", "source"], "recent plans payload");
  return {
    limit: requireInteger(payload.limit, "Recent plans limit", 1, 100),
    status: requireText(payload.status, "Recent plans status", 80),
    source: requireText(payload.source, "Recent plans source", 80),
  };
}

/** 解析计划步骤定位参数；输入未知值，返回计划和步骤 ID；额外字段或非法 ID 会抛出 TypeError。 */
function parsePlanStepPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["planId", "stepId"], "plan step payload");
  return { planId: requireId(payload.planId, "Plan id"), stepId: requireId(payload.stepId, "Plan step id") };
}

/** 解析计划步骤执行参数；输入未知值，返回治理确认和工具参数；非法 ID、JSON 或字段会抛出 TypeError。 */
function parsePlanStepExecutePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["planId", "stepId", "toolParams", "approvalId", "reason", "confirmed"], "plan step execute payload");
  return {
    planId: requireId(payload.planId, "Plan id"),
    stepId: requireId(payload.stepId, "Plan step id"),
    toolParams: requireJsonRecord(payload.toolParams, "Plan step tool params"),
    approvalId: requireOptionalId(payload.approvalId, "Approval id"),
    reason: requireText(payload.reason, "Plan step reason", 256),
    confirmed: requireBoolean(payload.confirmed, "Plan step confirmed"),
  };
}

/** 解析技能生命周期切换；输入未知值，返回稳定技能 ID 和目标状态；非法字段或 ID 会抛出 TypeError。 */
function parseSkillTransitionPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["skillId", "status", "reason", "actor", "sync"], "skill transition payload");
  return {
    skillId: requireId(payload.skillId, "Skill id"),
    status: requireText(payload.status, "Skill status", 80),
    reason: requireText(payload.reason, "Skill transition reason", 256),
    actor: requireText(payload.actor, "Skill transition actor", 80),
    sync: requireBoolean(payload.sync, "Skill transition sync"),
  };
}

/** 解析 Skill 变更提案审批；输入未知值，返回稳定提案 ID 和明确决议。 */
function parseSkillProposalResolvePayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(
    value,
    ["proposalId", "approved", "actor", "reason"],
    "skill proposal resolve payload",
  );
  return {
    proposalId: requireId(payload.proposalId, "Skill proposal id"),
    approved: requireBoolean(payload.approved, "Skill proposal approved"),
    actor: requireText(payload.actor, "Skill proposal actor", 80),
    reason: requireText(payload.reason, "Skill proposal reason", 512),
  };
}

/** 解析 Skill 选择上下文；输入未知值，返回环境边界、能力白名单和结果数量。 */
function parseSkillSelectPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(
    value,
    ["query", "environmentScope", "environmentFingerprint", "availableCapabilities", "topK"],
    "skill select payload",
  );
  const scopes = new Set(["synthetic", "simulation", "staging", "shadow", "canary", "production", "legacy"]);
  const environmentScope = requireText(payload.environmentScope, "Skill environment scope", 32);
  if (!scopes.has(environmentScope)) throw new TypeError("Skill environment scope is invalid.");
  const capabilities = requireJsonArray(payload.availableCapabilities, "Skill available capabilities", 200)
    .map((item) => requireText(item, "Skill available capability", 256));
  return {
    query: requireText(payload.query, "Skill selection query", 32_000),
    environmentScope,
    environmentFingerprint: requireText(payload.environmentFingerprint, "Skill environment fingerprint", 256),
    availableCapabilities: capabilities,
    topK: requireInteger(payload.topK, "Skill selection topK", 1, 50),
  };
}

/** 解析指导列表参数；输入未知值，返回可选会话 ID；控制字符或额外字段会抛出 TypeError。 */
function parseGuidanceListPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["conversationId"], "guidance list payload");
  return { conversationId: requireText(payload.conversationId, "Guidance conversation id", 256) };
}

/** 解析新增指导参数；输入未知值，返回有界文本、关联 ID、模式和优先级；非法字段会抛出 TypeError。 */
function parseGuidanceAddPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["text", "conversationId", "turnId", "traceId", "mode", "priority"], "guidance add payload");
  return {
    text: requireText(payload.text, "Guidance text", 16_000),
    conversationId: requireText(payload.conversationId, "Guidance conversation id", 256),
    turnId: requireText(payload.turnId, "Guidance turn id", 256),
    traceId: requireText(payload.traceId, "Guidance trace id", 256),
    mode: requireText(payload.mode, "Guidance mode", 32),
    priority: requireInteger(payload.priority, "Guidance priority", -100, 100),
  };
}

/** 解析配置意图文本；输入未知值，返回有界文本；额外字段或控制字符会抛出 TypeError。 */
function parseConfigIntentPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["text"], "config intent payload");
  return { text: requireText(payload.text, "Config intent text", 16_000) };
}

/** 解析配置应用参数；输入未知值，返回有界意图、确认开关和确认文本；非法 JSON 或字段会抛出 TypeError。 */
function parseConfigApplyPayload(value: unknown): Readonly<Record<string, unknown>> {
  const payload = requireRecord(value, ["intent", "confirmed", "confirmationText"], "config apply payload");
  return {
    intent: requireJsonRecord(payload.intent, "Config intent"),
    confirmed: requireBoolean(payload.confirmed, "Config confirmed"),
    confirmationText: requireText(payload.confirmationText, "Config confirmation text", 2_000),
  };
}

/** 校验操作名；输入未知值，返回固定操作；未知操作会抛出 TypeError。 */
function requireOperation(value: unknown): ApplicationKernelOperation {
  if (typeof value !== "string" || !APPLICATION_KERNEL_OPERATIONS.some((item) => item === value)) {
    throw new TypeError("Kernel operation is invalid.");
  }
  return value as ApplicationKernelOperation;
}

/** 校验普通对象和允许字段；输入值、字段及标签，返回记录；原型异常或额外字段会抛出 TypeError。 */
function requireRecord(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label} is invalid.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} prototype is invalid.`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((field) => !fields.includes(field))) throw new TypeError(`${label} fields are invalid.`);
  return record;
}

/** 校验稳定 ID；输入未知值和标签，返回 ID；空值、路径字符或超长值会抛出 TypeError。 */
function requireId(value: unknown, label: string): string {
  const text = requireText(value, label, 192);
  if (!KERNEL_ID_PATTERN.test(text)) throw new TypeError(`${label} is invalid.`);
  return text;
}

/** 校验可选稳定 ID；输入未知值和标签，返回空串或 ID；非空非法值会抛出 TypeError。 */
function requireOptionalId(value: unknown, label: string): string {
  const text = requireText(value, label, 192);
  return text ? requireId(text, label) : "";
}

/** 校验文本；输入未知值、标签和长度，返回去首尾空格文本；类型、长度或控制字符无效时抛出 TypeError。 */
function requireText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || value.length > maximumLength || /[\u0000\u007F]/.test(value)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value.trim();
}

/** 校验布尔值；输入未知值和标签，返回布尔值；类型不匹配时抛出 TypeError。 */
function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} is invalid.`);
  return value;
}

/** 校验有界整数；输入未知值、标签和范围，返回整数；类型或范围无效时抛出 TypeError。 */
function requireInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

/** 校验消息数组；输入未知值，返回只含 role/content 的消息；超量、超长或额外字段会抛出 TypeError。 */
function requireMessages(value: unknown): readonly Readonly<Record<string, string>>[] {
  if (!Array.isArray(value) || value.length > 200) throw new TypeError("Kernel messages are invalid.");
  return value.map((item) => {
    const message = requireRecord(item, ["role", "content"], "Kernel message");
    return {
      role: requireText(message.role, "Kernel message role", 32),
      content: requireText(message.content, "Kernel message content", 32_000),
    };
  });
}

/** 校验 JSON 普通对象；输入未知值和标签，返回无危险原型的副本；超深、超量或非法值会抛出 TypeError。 */
function requireJsonRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  const result = requireJsonValue(value, label, 0);
  if (typeof result !== "object" || result === null || Array.isArray(result)) throw new TypeError(`${label} is invalid.`);
  return result as Readonly<Record<string, unknown>>;
}

/** 校验 JSON 数组；输入未知值、标签和数量上限，返回安全副本；超量或非法成员会抛出 TypeError。 */
function requireJsonArray(value: unknown, label: string, maximumItems: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new TypeError(`${label} is invalid.`);
  return value.map((item) => requireJsonValue(item, label, 0));
}

/** 递归复制 JSON 值；输入值、标签和深度，返回安全值；危险键、非有限数、超深或超量结构会抛出 TypeError。 */
function requireJsonValue(value: unknown, label: string, depth: number): unknown {
  if (depth > 8) throw new TypeError(`${label} is too deep.`);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains an invalid number.`);
    return value;
  }
  if (typeof value === "string") return requireText(value, label, 32_000);
  if (Array.isArray(value)) {
    if (value.length > 256) throw new TypeError(`${label} contains too many items.`);
    return value.map((item) => requireJsonValue(item, label, depth + 1));
  }
  const record = requireRecord(value, Object.keys((value ?? {}) as object), label);
  const entries = Object.entries(record);
  if (entries.length > 256) throw new TypeError(`${label} contains too many fields.`);
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, item] of entries) {
    if (!key || key.length > 128 || key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new TypeError(`${label} contains an invalid field.`);
    }
    result[key] = requireJsonValue(item, label, depth + 1);
  }
  return result;
}
