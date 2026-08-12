import {
  APPLICATION_NEURO_SYMBOLIC_AUTHORITY_LEVELS,
  APPLICATION_NEURO_SYMBOLIC_EVIDENCE_GRADES,
  APPLICATION_NEURO_SYMBOLIC_OPERATION_PHASES,
  APPLICATION_NEURO_SYMBOLIC_POLICY_DECISIONS,
  APPLICATION_NEURO_SYMBOLIC_RISK_CLASSES,
  type ApplicationNeuroSymbolicAuthorityLevel,
  type ApplicationNeuroSymbolicOperationEvent,
  type ApplicationNeuroSymbolicPolicyInput,
  type ApplicationNeuroSymbolicPolicyResult,
} from "../contracts/application-neuro-symbolic-governance";

const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const RULE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,95}$/u;
const MAX_OPERATION_LIST_ITEMS = 64;

/** 将风险等级转换为可比较序号；输入稳定风险代码，返回零起始序号。 */
function riskRank(value: ApplicationNeuroSymbolicPolicyInput["riskClass"]): number {
  return APPLICATION_NEURO_SYMBOLIC_RISK_CLASSES.indexOf(value);
}

/** 将证据等级转换为可比较序号；输入稳定证据代码，返回零起始序号。 */
function evidenceRank(value: ApplicationNeuroSymbolicPolicyInput["evidenceGrade"]): number {
  return APPLICATION_NEURO_SYMBOLIC_EVIDENCE_GRADES.indexOf(value);
}

/** 创建不可变策略结果；输入判定字段，返回带原始风险和证据的统一结果。 */
function policyResult(
  input: ApplicationNeuroSymbolicPolicyInput,
  authorityLevel: ApplicationNeuroSymbolicAuthorityLevel,
  decision: ApplicationNeuroSymbolicPolicyResult["decision"],
  ruleCodes: readonly string[],
  ruleReasons: readonly string[],
  requiresIndependentVerification: boolean,
): ApplicationNeuroSymbolicPolicyResult {
  return Object.freeze({
    authorityLevel,
    riskClass: input.riskClass,
    evidenceGrade: input.evidenceGrade,
    decision,
    requiresApproval: decision === "APPROVAL_REQUIRED",
    requiresIndependentVerification,
    ruleCodes: Object.freeze([...ruleCodes]),
    ruleReasons: Object.freeze([...ruleReasons]),
  });
}

/** 评估 SynapXnet 神经符号行为授权；输入动作语义和硬边界，返回可解释且不可由模型自行提升的授权结果。 */
export function evaluateApplicationNeuroSymbolicPolicy(
  input: ApplicationNeuroSymbolicPolicyInput,
): ApplicationNeuroSymbolicPolicyResult {
  if (!input.permissionGranted) {
    return policyResult(input, "NSX-0", "DENY", ["PERMISSION_DENIED"], ["当前身份不具备目标操作权限。"], false);
  }
  if (input.operationKind === "observe") {
    return policyResult(input, "NSX-0", "ALLOW", ["READ_ONLY_OPERATION"], ["操作只读取证且不产生外部副作用。"], false);
  }
  if (input.operationKind === "advise") {
    return policyResult(input, "NSX-1", "ALLOW", ["ADVISORY_ONLY"], ["操作仅生成建议或变更草案，不执行外部写入。"], false);
  }
  if (input.operationKind === "rehearse") {
    if (!["sandbox", "staging"].includes(input.environment) || riskRank(input.riskClass) > 1 || !input.reversible) {
      return policyResult(
        input,
        "NSX-2",
        "DENY",
        ["REHEARSAL_BOUNDARY_VIOLATION"],
        ["演练操作必须位于隔离环境、风险不高于 RK-1 且能够回滚。"],
        false,
      );
    }
    if (evidenceRank(input.evidenceGrade) < 1) {
      return policyResult(input, "NSX-2", "ABSTAIN", ["EVIDENCE_INSUFFICIENT"], ["演练前至少需要单源可引用证据。"], false);
    }
    return policyResult(input, "NSX-2", "ALLOW", ["REHEARSAL_ALLOWED"], ["隔离演练满足风险、证据和可逆边界。"], false);
  }
  if (input.environment !== "production") {
    if (riskRank(input.riskClass) > 1 || !input.reversible || !input.hasRollbackPoint || !input.hasIdempotencyKey) {
      return policyResult(
        input,
        "NSX-3",
        "DENY",
        ["BOUNDED_EXECUTION_VIOLATION"],
        ["有界执行仅允许低风险、可逆且具备回滚点和幂等键的操作。"],
        true,
      );
    }
    if (evidenceRank(input.evidenceGrade) < 1) {
      return policyResult(input, "NSX-3", "ABSTAIN", ["EVIDENCE_INSUFFICIENT"], ["有界执行前至少需要单源可引用证据。"], true);
    }
    return policyResult(input, "NSX-3", "ALLOW", ["BOUNDED_EXECUTION_ALLOWED"], ["非生产写入位于可逆和幂等边界内。"], true);
  }
  if (riskRank(input.riskClass) >= 3) {
    return policyResult(
      input,
      input.delegatedAuthority ? "NSX-5" : "NSX-4",
      "DENY",
      ["CRITICAL_RISK_DENIED"],
      ["RK-3 不可逆或监管敏感动作不属于当前自动执行授权范围。"],
      true,
    );
  }
  if (evidenceRank(input.evidenceGrade) < 2) {
    return policyResult(
      input,
      input.delegatedAuthority ? "NSX-5" : "NSX-4",
      "ABSTAIN",
      ["EVIDENCE_INSUFFICIENT"],
      ["生产执行前必须形成至少 EV-2 的跨源互证。"],
      true,
    );
  }
  if (!input.reversible || !input.hasRollbackPoint || !input.hasResourceVersion || !input.hasIdempotencyKey) {
    return policyResult(
      input,
      input.delegatedAuthority ? "NSX-5" : "NSX-4",
      "DENY",
      ["PRODUCTION_GUARD_MISSING"],
      ["生产执行缺少可逆性、回滚点、资源版本或幂等控制。"],
      true,
    );
  }
  if (input.delegatedAuthority) {
    if (!input.certifiedSkill) {
      return policyResult(
        input,
        "NSX-5",
        "ABSTAIN",
        ["CERTIFIED_SKILL_REQUIRED"],
        ["委托自治只能使用已通过目标环境认证的 Skill。"],
        true,
      );
    }
    return policyResult(
      input,
      "NSX-5",
      "ALLOW",
      ["DELEGATED_POLICY_ALLOWED"],
      ["操作位于预授权策略、认证 Skill 和生产安全边界内。"],
      true,
    );
  }
  if (!input.approvalGranted) {
    return policyResult(
      input,
      "NSX-4",
      "APPROVAL_REQUIRED",
      ["HUMAN_APPROVAL_REQUIRED"],
      ["生产变更满足执行前置条件，但必须由独立人员完成单次审批。"],
      true,
    );
  }
  return policyResult(
    input,
    "NSX-4",
    "ALLOW",
    ["GOVERNED_EXECUTION_ALLOWED"],
    ["生产变更已经通过证据、审批、版本、幂等和回滚边界。"],
    true,
  );
}

/** 判断未知值是否为普通对象；输入未知值，返回类型守卫。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取有界字符串；输入未知值、标签和长度，返回去空格字符串，非法时抛错。 */
function requireText(value: unknown, label: string, maximumLength: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > maximumLength || /[\u0000\u007F]/u.test(value)) {
    throw new TypeError(`${label} is invalid.`);
  }
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new TypeError(`${label} is invalid.`);
  return normalized;
}

/** 读取可空字符串；输入未知值、标签和长度，返回字符串或 null。 */
function requireNullableText(value: unknown, label: string, maximumLength: number): string | null {
  return value === null ? null : requireText(value, label, maximumLength);
}

/** 读取固定枚举；输入未知值、候选集和标签，返回匹配成员，非法时抛错。 */
function requireEnum<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new TypeError(`${label} is invalid.`);
  return value as T;
}

/** 读取有界唯一字符串数组；输入未知值、标签和单项长度，返回不可变列表。 */
function requireTextList(value: unknown, label: string, maximumLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_OPERATION_LIST_ITEMS) throw new TypeError(`${label} is invalid.`);
  const normalized = value.map((item) => requireText(item, label, maximumLength));
  if (new Set(normalized).size !== normalized.length) throw new TypeError(`${label} contains duplicate values.`);
  return Object.freeze(normalized);
}

/** 解析持久化神经符号操作事件；输入未知 JSON，返回严格且有界的结构化事件。 */
export function parseApplicationNeuroSymbolicOperationEvent(value: unknown): ApplicationNeuroSymbolicOperationEvent {
  if (!isRecord(value)) throw new TypeError("Neuro-symbolic operation event is invalid.");
  const allowedFields = new Set([
    "operationId", "authorityLevel", "riskClass", "evidenceGrade", "decision", "phase", "title", "summary",
    "toolNames", "skillName", "targetResource", "actionDigest", "approvalId", "invocationIds", "evidenceIds",
    "ruleCodes", "ruleReasons", "verificationSummary",
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    throw new TypeError("Neuro-symbolic operation event contains unsupported fields.");
  }
  const operationId = requireText(value.operationId, "Operation id", 192);
  if (!OPERATION_ID_PATTERN.test(operationId)) throw new TypeError("Operation id is invalid.");
  const ruleCodes = requireTextList(value.ruleCodes, "Operation rule codes", 96);
  if (ruleCodes.some((item) => !RULE_CODE_PATTERN.test(item))) throw new TypeError("Operation rule code is invalid.");
  return Object.freeze({
    operationId,
    authorityLevel: requireEnum(value.authorityLevel, APPLICATION_NEURO_SYMBOLIC_AUTHORITY_LEVELS, "Authority level"),
    riskClass: requireEnum(value.riskClass, APPLICATION_NEURO_SYMBOLIC_RISK_CLASSES, "Risk class"),
    evidenceGrade: requireEnum(value.evidenceGrade, APPLICATION_NEURO_SYMBOLIC_EVIDENCE_GRADES, "Evidence grade"),
    decision: requireEnum(value.decision, APPLICATION_NEURO_SYMBOLIC_POLICY_DECISIONS, "Policy decision"),
    phase: requireEnum(value.phase, APPLICATION_NEURO_SYMBOLIC_OPERATION_PHASES, "Operation phase"),
    title: requireText(value.title, "Operation title", 256),
    summary: requireText(value.summary, "Operation summary", 4_096),
    toolNames: requireTextList(value.toolNames, "Operation tool names", 256),
    skillName: requireNullableText(value.skillName, "Operation skill name", 256),
    targetResource: requireNullableText(value.targetResource, "Operation target resource", 512),
    actionDigest: requireNullableText(value.actionDigest, "Operation action digest", 256),
    approvalId: requireNullableText(value.approvalId, "Operation approval id", 192),
    invocationIds: requireTextList(value.invocationIds, "Operation invocation ids", 192),
    evidenceIds: requireTextList(value.evidenceIds, "Operation evidence ids", 192),
    ruleCodes,
    ruleReasons: requireTextList(value.ruleReasons, "Operation rule reasons", 512),
    verificationSummary: requireNullableText(value.verificationSummary, "Operation verification summary", 2_048),
  });
}
