/** SynapXnet 神经符号行为授权级别。 */
export const APPLICATION_NEURO_SYMBOLIC_AUTHORITY_LEVELS = [
  "NSX-0",
  "NSX-1",
  "NSX-2",
  "NSX-3",
  "NSX-4",
  "NSX-5",
] as const;

/** SynapXnet 操作风险类别。 */
export const APPLICATION_NEURO_SYMBOLIC_RISK_CLASSES = ["RK-0", "RK-1", "RK-2", "RK-3"] as const;

/** SynapXnet 证据充分度等级。 */
export const APPLICATION_NEURO_SYMBOLIC_EVIDENCE_GRADES = ["EV-0", "EV-1", "EV-2", "EV-3"] as const;

/** 神经符号策略最终决策。 */
export const APPLICATION_NEURO_SYMBOLIC_POLICY_DECISIONS = [
  "ALLOW",
  "APPROVAL_REQUIRED",
  "ABSTAIN",
  "DENY",
] as const;

/** 企业操作事件阶段。 */
export const APPLICATION_NEURO_SYMBOLIC_OPERATION_PHASES = [
  "PROPOSED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "REHEARSING",
  "EXECUTING",
  "VERIFYING",
  "SUCCEEDED",
  "FAILED",
  "ROLLED_BACK",
  "ABSTAINED",
  "DENIED",
] as const;

/** 策略判定使用的操作语义。 */
export const APPLICATION_NEURO_SYMBOLIC_OPERATION_KINDS = [
  "observe",
  "advise",
  "rehearse",
  "execute",
] as const;

/** 策略判定使用的环境边界。 */
export const APPLICATION_NEURO_SYMBOLIC_ENVIRONMENTS = [
  "local",
  "sandbox",
  "staging",
  "production",
] as const;

/** SynapXnet 神经符号行为授权级别类型。 */
export type ApplicationNeuroSymbolicAuthorityLevel =
  (typeof APPLICATION_NEURO_SYMBOLIC_AUTHORITY_LEVELS)[number];

/** SynapXnet 操作风险类别类型。 */
export type ApplicationNeuroSymbolicRiskClass =
  (typeof APPLICATION_NEURO_SYMBOLIC_RISK_CLASSES)[number];

/** SynapXnet 证据充分度类型。 */
export type ApplicationNeuroSymbolicEvidenceGrade =
  (typeof APPLICATION_NEURO_SYMBOLIC_EVIDENCE_GRADES)[number];

/** 神经符号策略决策类型。 */
export type ApplicationNeuroSymbolicPolicyDecision =
  (typeof APPLICATION_NEURO_SYMBOLIC_POLICY_DECISIONS)[number];

/** 企业操作事件阶段类型。 */
export type ApplicationNeuroSymbolicOperationPhase =
  (typeof APPLICATION_NEURO_SYMBOLIC_OPERATION_PHASES)[number];

/** 策略判定操作语义类型。 */
export type ApplicationNeuroSymbolicOperationKind =
  (typeof APPLICATION_NEURO_SYMBOLIC_OPERATION_KINDS)[number];

/** 策略判定环境边界类型。 */
export type ApplicationNeuroSymbolicEnvironment =
  (typeof APPLICATION_NEURO_SYMBOLIC_ENVIRONMENTS)[number];

/** 神经符号策略判定输入。 */
export interface ApplicationNeuroSymbolicPolicyInput {
  readonly operationKind: ApplicationNeuroSymbolicOperationKind;
  readonly environment: ApplicationNeuroSymbolicEnvironment;
  readonly riskClass: ApplicationNeuroSymbolicRiskClass;
  readonly evidenceGrade: ApplicationNeuroSymbolicEvidenceGrade;
  readonly permissionGranted: boolean;
  readonly reversible: boolean;
  readonly hasRollbackPoint: boolean;
  readonly hasResourceVersion: boolean;
  readonly hasIdempotencyKey: boolean;
  readonly certifiedSkill: boolean;
  readonly delegatedAuthority: boolean;
  readonly approvalGranted: boolean;
}

/** 神经符号策略判定输出。 */
export interface ApplicationNeuroSymbolicPolicyResult {
  readonly authorityLevel: ApplicationNeuroSymbolicAuthorityLevel;
  readonly riskClass: ApplicationNeuroSymbolicRiskClass;
  readonly evidenceGrade: ApplicationNeuroSymbolicEvidenceGrade;
  readonly decision: ApplicationNeuroSymbolicPolicyDecision;
  readonly requiresApproval: boolean;
  readonly requiresIndependentVerification: boolean;
  readonly ruleCodes: readonly string[];
  readonly ruleReasons: readonly string[];
}

/** 企业群聊中可审计的神经符号操作事件。 */
export interface ApplicationNeuroSymbolicOperationEvent {
  readonly operationId: string;
  readonly authorityLevel: ApplicationNeuroSymbolicAuthorityLevel;
  readonly riskClass: ApplicationNeuroSymbolicRiskClass;
  readonly evidenceGrade: ApplicationNeuroSymbolicEvidenceGrade;
  readonly decision: ApplicationNeuroSymbolicPolicyDecision;
  readonly phase: ApplicationNeuroSymbolicOperationPhase;
  readonly title: string;
  readonly summary: string;
  readonly toolNames: readonly string[];
  readonly skillName: string | null;
  readonly targetResource: string | null;
  readonly actionDigest: string | null;
  readonly approvalId: string | null;
  readonly invocationIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly ruleCodes: readonly string[];
  readonly ruleReasons: readonly string[];
  readonly verificationSummary: string | null;
}
