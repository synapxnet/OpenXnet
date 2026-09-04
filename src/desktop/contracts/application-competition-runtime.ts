/** OpenXnet 竞赛控制面的授权 IPC 通道。 */
export const APPLICATION_COMPETITION_RUNTIME_CHANNELS = Object.freeze({
  getUiProfile: "openxnet:application-competition-runtime:get-ui-profile",
  getSnapshot: "openxnet:application-competition-runtime:get-snapshot",
  resetDemoData: "openxnet:application-competition-runtime:reset-demo-data",
  startEnterpriseTask: "openxnet:application-competition-runtime:start-enterprise-task",
  createIncident: "openxnet:application-competition-runtime:create-incident",
  runInvestigation: "openxnet:application-competition-runtime:run-investigation",
  decideApproval: "openxnet:application-competition-runtime:decide-approval",
  executeRollback: "openxnet:application-competition-runtime:execute-rollback",
  verifyRemediation: "openxnet:application-competition-runtime:verify-remediation",
  readResource: "openxnet:application-competition-runtime:read-resource",
  exportRetrospective: "openxnet:application-competition-runtime:export-retrospective",
  exportEvaluation: "openxnet:application-competition-runtime:export-evaluation",
  setAdapterMode: "openxnet:application-competition-runtime:set-adapter-mode",
});

/** 重置竞赛演示数据时必须提交的固定确认标记。 */
export const APPLICATION_COMPETITION_RESET_CONFIRMATION = "RESET_DEMO_DATA" as const;

/** 竞赛控制面公开快照的协议标识。 */
export const APPLICATION_COMPETITION_RUNTIME_SCHEMA = "openxnet.competition-runtime.v1" as const;

/** 事件中心支持的发布配置。 */
export const APPLICATION_COMPETITION_RELEASE_PROFILES = ["production", "goai-staging"] as const;

/** 事件中心发布配置。 */
export type ApplicationCompetitionReleaseProfile =
  (typeof APPLICATION_COMPETITION_RELEASE_PROFILES)[number];

/** Renderer 可读取的不含凭据的事件中心界面能力。 */
export interface ApplicationCompetitionUiProfile {
  readonly releaseProfile: ApplicationCompetitionReleaseProfile;
  readonly rehearsalEnabled: boolean;
}

/** 解析事件中心发布配置；输入包配置和环境覆盖，返回有界且不含凭据的界面能力。 */
export function resolveApplicationCompetitionUiProfile(
  releaseProfileValue: unknown,
  rehearsalOverrideValue: unknown,
): ApplicationCompetitionUiProfile {
  const releaseProfile = releaseProfileValue === "goai-staging" ? "goai-staging" : "production";
  const explicit = typeof rehearsalOverrideValue === "string" ? rehearsalOverrideValue.trim() : "";
  return Object.freeze({
    releaseProfile,
    rehearsalEnabled: explicit === "1" || (explicit !== "0" && releaseProfile === "goai-staging"),
  });
}

/** 竞赛演示支持的南向适配模式。 */
export const APPLICATION_COMPETITION_ADAPTER_MODES = ["fixture", "live"] as const;

/** 事件严重等级。 */
export const APPLICATION_COMPETITION_SEVERITIES = ["P0", "P1", "P2", "P3"] as const;

/** 事件生命周期状态。 */
export const APPLICATION_COMPETITION_INCIDENT_STATUSES = [
  "OPEN",
  "INVESTIGATING",
  "AWAITING_APPROVAL",
  "MITIGATING",
  "VERIFYING",
  "RESOLVED",
  "FAILED",
] as const;

/** 审批生命周期状态。 */
export const APPLICATION_COMPETITION_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

/** 工具调用生命周期状态。 */
export const APPLICATION_COMPETITION_INVOCATION_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED"] as const;

/** 部署动作生命周期状态。 */
export const APPLICATION_COMPETITION_ACTION_STATUSES = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"] as const;

/** 竞赛演示依赖的平台名称。 */
export const APPLICATION_COMPETITION_PLATFORMS = ["aiops", "dataops", "mlops"] as const;

/** 竞赛工作台内置的三类端到端场景。 */
export const APPLICATION_COMPETITION_SCENARIO_TYPES = [
  "recommendation-capacity",
  "quantitative-iteration",
  "feature-drift",
] as const;

/** 南向适配器模式。 */
export type ApplicationCompetitionAdapterMode =
  (typeof APPLICATION_COMPETITION_ADAPTER_MODES)[number];

/** 事件严重等级。 */
export type ApplicationCompetitionSeverity =
  (typeof APPLICATION_COMPETITION_SEVERITIES)[number];

/** 事件状态。 */
export type ApplicationCompetitionIncidentStatus =
  (typeof APPLICATION_COMPETITION_INCIDENT_STATUSES)[number];

/** 审批状态。 */
export type ApplicationCompetitionApprovalStatus =
  (typeof APPLICATION_COMPETITION_APPROVAL_STATUSES)[number];

/** 工具调用状态。 */
export type ApplicationCompetitionInvocationStatus =
  (typeof APPLICATION_COMPETITION_INVOCATION_STATUSES)[number];

/** 部署动作状态。 */
export type ApplicationCompetitionActionStatus =
  (typeof APPLICATION_COMPETITION_ACTION_STATUSES)[number];

/** 平台标识。 */
export type ApplicationCompetitionPlatform =
  (typeof APPLICATION_COMPETITION_PLATFORMS)[number];

/** 竞赛端到端场景类型。 */
export type ApplicationCompetitionScenarioType =
  (typeof APPLICATION_COMPETITION_SCENARIO_TYPES)[number];

/** 竞赛固定演示场景使用的跨平台资源引用。 */
export interface ApplicationCompetitionScenarioContext {
  readonly scenarioType: ApplicationCompetitionScenarioType;
  readonly alertUid: string;
  readonly serviceUid: string;
  readonly clusterId: string;
  readonly namespace: string;
  readonly workloadName: string;
  readonly reportUid: string;
  readonly assetUid: string;
  readonly workflowInstanceUid: string;
  readonly deploymentUid: string;
  readonly failingRevision: number;
  readonly targetRevision: number;
  readonly rollbackRevision?: number;
  readonly expectedResourceVersion: string;
  readonly testDatasetRef: string;
}

/** 事件领域记录。 */
export interface ApplicationCompetitionIncident {
  readonly incidentId: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly severity: ApplicationCompetitionSeverity;
  readonly status: ApplicationCompetitionIncidentStatus;
  readonly scenario: ApplicationCompetitionScenarioContext;
  readonly activeTraceId: string | null;
  readonly activeApprovalId: string | null;
  readonly activeActionId: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
}

/** 一次跨域编排 Trace。 */
export interface ApplicationCompetitionTrace {
  readonly traceId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly status: "RUNNING" | "AWAITING_APPROVAL" | "VERIFYING" | "SUCCEEDED" | "FAILED";
  readonly invocationIds: readonly string[];
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

/** 工具调用在全局 Trace 中的有界记录。 */
export interface ApplicationCompetitionToolInvocation {
  readonly invocationId: string;
  readonly requestId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly toolName: string;
  readonly platform: ApplicationCompetitionPlatform;
  readonly status: ApplicationCompetitionInvocationStatus;
  readonly argumentsDigest: string;
  readonly evidenceId: string | null;
  readonly actionId: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

/** 跨域取证结果。 */
export interface ApplicationCompetitionEvidence {
  readonly evidenceId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly toolName: string;
  readonly platform: ApplicationCompetitionPlatform;
  readonly summary: string;
  readonly resourceVersion: string;
  readonly observedAt: string;
  readonly contentDigest: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** 高风险操作的持久化审批。 */
export interface ApplicationCompetitionApprovalScope {
  readonly stepId: string;
  readonly toolName: string;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly argumentsDigest: string;
  readonly compensation: boolean;
}

/** 高风险操作的持久化审批。 */
export interface ApplicationCompetitionApproval {
  readonly approvalId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly toolName: string;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly argumentsDigest: string;
  readonly planId: string;
  readonly planDigest: string;
  readonly scopes: readonly ApplicationCompetitionApprovalScope[];
  readonly reason: string;
  readonly status: ApplicationCompetitionApprovalStatus;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly decisionReason: string | null;
}

/** 多步骤处置中的单个执行步骤。 */
export interface ApplicationCompetitionExecutionStep {
  readonly stepId: string;
  readonly sequence: number;
  readonly title: string;
  readonly description: string;
  readonly phase: "MITIGATION" | "REPAIR" | "RELEASE" | "CONVERGENCE" | "COMPENSATION";
  readonly kind: "WRITE" | "QUALITY_GATE";
  readonly toolName: string;
  readonly platform: ApplicationCompetitionPlatform;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly argumentsDigest: string;
  readonly status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
  readonly invocationId: string | null;
  readonly evidenceId: string | null;
  readonly remoteActionId: string | null;
  readonly resourceVersionBefore: string;
  readonly resourceVersionAfter: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorCode: string | null;
}

/** 场景处置计划及独立验证状态。 */
export interface ApplicationCompetitionDeploymentAction {
  readonly actionId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly approvalId: string;
  readonly toolName: string;
  readonly resourceId: string;
  readonly planId: string;
  readonly planTitle: string;
  readonly planDigest: string;
  readonly deploymentUid: string;
  readonly fromRevision: number;
  readonly targetRevision: number;
  readonly idempotencyKey: string;
  readonly status: ApplicationCompetitionActionStatus;
  readonly stage: "ACCEPTED" | "ROLLING_BACK" | "EXECUTING" | "VERIFYING" | "COMPLETED" | "FAILED";
  readonly executedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly steps: readonly ApplicationCompetitionExecutionStep[];
  readonly compensationSteps: readonly ApplicationCompetitionExecutionStep[];
  readonly compensationStatus: "NOT_REQUIRED" | "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  readonly verificationEvidenceIds: readonly string[];
  readonly errorCode: string | null;
}

/** 不可歧义的写操作审计回执。 */
export interface ApplicationCompetitionAuditReceipt {
  readonly receiptId: string;
  readonly requestId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly toolName: string;
  readonly actorId: string;
  readonly approvalId: string;
  readonly idempotencyKey: string;
  readonly resourceVersionBefore: string;
  readonly resourceVersionAfter: string;
  readonly outcome: "ACCEPTED" | "SUCCEEDED" | "FAILED";
  readonly recordedAt: string;
}

/** Incident 启动取证时固化的企业角色卡快照。 */
export interface ApplicationCompetitionAgentRoleSnapshot {
  readonly roleCardId: string;
  readonly name: string;
  readonly department: string;
  readonly description: string;
  readonly teamRole: "leader" | "worker" | "verifier";
  readonly systemPrompt: string;
  readonly runtimeSystemPrompt: string;
  readonly permissions: readonly string[];
  readonly tools: readonly string[];
  readonly skills: readonly string[];
  readonly capturedAt: string;
}

/** Incident 与可替换 Agent Team Runtime 的关联。 */
export interface ApplicationCompetitionAgentTeamBinding {
  readonly bindingId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly runtime: "builtin" | "agentteams";
  readonly teamName: string;
  readonly status: "PLANNED" | "READY" | "DEGRADED";
  readonly teamTemplateId: string | null;
  readonly teamTemplateVersion: number | null;
  readonly teamTemplateName: string;
  readonly memberSnapshots: readonly ApplicationCompetitionAgentRoleSnapshot[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** AgentTeams 通过真实 Matrix 身份产生的阶段决策。 */
export interface ApplicationCompetitionAgentDecision {
  readonly decisionId: string;
  readonly taskId: string;
  readonly bindingId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly stage: "INVESTIGATION_PLAN" | "INVESTIGATION_CONCLUSION" | "VERIFICATION_CONCLUSION";
  readonly teamName: string;
  readonly roleCardId: string;
  readonly agentName: string;
  readonly teamRole: "leader" | "worker" | "verifier";
  readonly transportSender: string;
  readonly eventId: string;
  readonly decision: "COLLECT_EVIDENCE" | "REQUEST_APPROVAL" | "HALT" | "CLOSE" | "ROLLBACK_REQUIRED";
  readonly summary: string;
  readonly confidence: number;
  readonly requestedToolNames: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly skillName: string;
  readonly skillVersion: string;
  readonly outputDigest: string;
  readonly routedByRoleCardId: string | null;
  readonly routedByName: string | null;
  readonly routedByTransportSender: string | null;
  readonly taskBriefDigest: string | null;
  readonly transportEvents: readonly ApplicationCompetitionAgentTransportEvent[];
  readonly createdAt: string;
}

/** 进入不可变决策账本的 Matrix 事件，正文已脱敏且由连续摘要保护。 */
export interface ApplicationCompetitionAgentTransportEvent {
  readonly sequence: number;
  readonly kind: "ROUTE_REQUEST" | "ROUTE_RESPONSE" | "TASK_REQUEST" | "TASK_RESPONSE" | "CORRECTION_REQUEST";
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly roomId: string;
  readonly eventId: string;
  readonly sender: string;
  readonly recipient: string;
  readonly originServerTs: number | null;
  readonly observedAt: string;
  readonly redactedBody: string;
  readonly bodyDigest: string;
  readonly previousLedgerDigest: string;
  readonly ledgerDigest: string;
}

/** 场景 Skill 在一次 Incident 中的匹配和复用证据。 */
export interface ApplicationCompetitionSkillUsage {
  readonly usageId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly skillId: string;
  readonly sourceIncidentId: string | null;
  readonly status: "BASELINE" | "REUSED" | "LOOKUP_FAILED";
  readonly problemFingerprint: string;
  readonly matchReason: string;
  readonly recordedAt: string;
}

/** 动态 Task Graph 中单个可追踪节点。 */
export interface ApplicationCompetitionTaskGraphNode {
  readonly nodeId: string;
  readonly lane: "ROUTING" | "RETRIEVAL" | "EVIDENCE" | "REASONING" | "APPROVAL" | "EXECUTION" | "VERIFICATION" | "CRYSTALLIZATION";
  readonly title: string;
  readonly nodeType: "AGENT_TASK" | "SKILL_RETRIEVAL" | "TOOL_CALL" | "EVIDENCE_FUSION" | "POLICY_DECISION" | "HUMAN_GATE" | "QUALITY_GATE" | "SKILL_WRITE";
  readonly toolName: string | null;
  readonly dependsOn: readonly string[];
  readonly parallelGroup: string | null;
  readonly timeoutMs: number;
  readonly maximumAttempts: number;
  readonly assignedRoleCardId: string | null;
  readonly assignedAgentName: string;
  readonly assignmentMode: "CAPABILITY_MATCH" | "ROLE_FALLBACK" | "REASSIGNMENT" | "CONTROL_PLANE" | "HUMAN";
  readonly status: "PENDING" | "READY" | "RUNNING" | "AWAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "BLOCKED" | "SKIPPED";
  readonly evidenceIds: readonly string[];
}

/** Task Graph 在分配、检查点和异常恢复过程中产生的不可变协同事件。 */
export interface ApplicationCompetitionTaskGraphEvent {
  readonly eventId: string;
  readonly eventType: "TASK_ASSIGNED" | "CHECKPOINT_SAVED" | "WORKER_TIMEOUT" | "TASK_FAILED" | "TASK_REASSIGNED" | "RESOURCE_CONFLICT_DETECTED" | "TRACE_RESUMED";
  readonly nodeId: string | null;
  readonly attempt: number;
  readonly fromRoleCardId: string | null;
  readonly toRoleCardId: string | null;
  readonly reasonCode: string;
  readonly evidenceIds: readonly string[];
  readonly checkpointDigest: string;
  readonly createdAt: string;
}

/** Incident 每次重规划生成的动态 Task Graph。 */
export interface ApplicationCompetitionTaskGraph {
  readonly graphId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly revision: number;
  readonly status: "ACTIVE" | "AWAITING_APPROVAL" | "SUCCEEDED" | "FAILED";
  readonly replanReason: string | null;
  readonly conflictPolicies: readonly string[];
  readonly nodes: readonly ApplicationCompetitionTaskGraphNode[];
  readonly events: readonly ApplicationCompetitionTaskGraphEvent[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly crystallizedAt: string | null;
}

/** 测试者、开发者和 Verifier 在一次 Skill 结晶中的有证据轮次。 */
export interface ApplicationCompetitionSkillEvolutionRound {
  readonly round: number;
  readonly role: "TESTER" | "DEVELOPER" | "VERIFIER";
  readonly stage: "PROBLEM_REPRODUCTION" | "STRATEGY_COMPARISON" | "PROGRESSIVE_CHALLENGE" | "INDEPENDENT_CERTIFICATION";
  readonly question: string;
  readonly outcome: "PASSED" | "FAILED" | "PENDING";
  readonly evidenceIds: readonly string[];
  readonly outputDigest: string;
  readonly createdAt: string;
}

/** 已解决事件派生出的 Skill 进化记录，默认不直接获得企业执行权。 */
export interface ApplicationCompetitionSkillEvolutionRun {
  readonly evolutionId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly skillId: string;
  readonly familyId: string;
  readonly status: "CANDIDATE" | "READY_FOR_CERTIFICATION" | "VERIFIED" | "REJECTED";
  readonly selectedStrategyId: string | null;
  readonly rejectedStrategyIds: readonly string[];
  readonly rounds: readonly ApplicationCompetitionSkillEvolutionRound[];
  readonly hallucinationGuards: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 神经符号在线裁决中的单个 Skill 或计划候选。 */
export interface ApplicationCompetitionReasoningCandidate {
  readonly candidateId: string;
  readonly candidateType: "SKILL" | "PLAN";
  readonly title: string;
  readonly skillId: string | null;
  readonly strategyId: string | null;
  readonly semanticScore: number;
  readonly graphScore: number;
  readonly evidenceScore: number;
  readonly safetyScore: number;
  readonly totalScore: number;
  readonly eligible: boolean;
  readonly authorityLevel: "NSX-0" | "NSX-1" | "NSX-2" | "NSX-3" | "NSX-4" | "NSX-5";
  readonly riskClass: "RK-0" | "RK-1" | "RK-2" | "RK-3";
  readonly evidenceGrade: "EV-0" | "EV-1" | "EV-2" | "EV-3";
  readonly policyDecision: "ALLOW" | "APPROVAL_REQUIRED" | "ABSTAIN" | "DENY";
  readonly ruleCodes: readonly string[];
  readonly ruleReasons: readonly string[];
}

/** 在线 RAG、图谱检索与符号硬门共同形成的可解释裁决。 */
export interface ApplicationCompetitionReasoningDecision {
  readonly reasoningId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly decisionType: "SKILL_SELECTION" | "PLAN_SELECTION";
  readonly retrievalMode: "ONLINE_HYBRID_RAG_KG" | "CATALOG_FALLBACK";
  readonly query: string;
  readonly knowledgeRefs: readonly {
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
    readonly confidence: number;
  }[];
  readonly candidates: readonly ApplicationCompetitionReasoningCandidate[];
  readonly selectedCandidateId: string;
  readonly explanation: string;
  readonly createdAt: string;
}

/** Renderer 和 MCP Resources 共用的竞赛控制面快照。 */
export interface ApplicationCompetitionSnapshot {
  readonly schema: typeof APPLICATION_COMPETITION_RUNTIME_SCHEMA;
  readonly adapterMode: ApplicationCompetitionAdapterMode;
  readonly incidents: readonly ApplicationCompetitionIncident[];
  readonly traces: readonly ApplicationCompetitionTrace[];
  readonly invocations: readonly ApplicationCompetitionToolInvocation[];
  readonly evidence: readonly ApplicationCompetitionEvidence[];
  readonly approvals: readonly ApplicationCompetitionApproval[];
  readonly actions: readonly ApplicationCompetitionDeploymentAction[];
  readonly auditReceipts: readonly ApplicationCompetitionAuditReceipt[];
  readonly teamBindings: readonly ApplicationCompetitionAgentTeamBinding[];
  readonly agentDecisions: readonly ApplicationCompetitionAgentDecision[];
  readonly skillUsages: readonly ApplicationCompetitionSkillUsage[];
  readonly taskGraphs: readonly ApplicationCompetitionTaskGraph[];
  readonly reasoningDecisions: readonly ApplicationCompetitionReasoningDecision[];
  readonly skillEvolutionRuns: readonly ApplicationCompetitionSkillEvolutionRun[];
  readonly updatedAt: string;
}

/** 创建事件的请求。 */
export interface CreateApplicationCompetitionIncidentRequest {
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly severity: ApplicationCompetitionSeverity;
  readonly actorId: string;
  readonly scenario: ApplicationCompetitionScenarioContext;
}

/** 从企业协作群发起主 Demo 任务的受限请求。 */
export interface StartApplicationCompetitionEnterpriseTaskRequest {
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly recipientIds: readonly string[];
  readonly content: string;
  readonly scenarioType: ApplicationCompetitionScenarioType;
  readonly teamRuntime: "builtin" | "agentteams";
  readonly teamTemplateId: string | null;
}

/** 对既有事件执行跨域取证的请求。 */
export interface RunApplicationCompetitionInvestigationRequest {
  readonly incidentId: string;
  readonly actorId: string;
  readonly teamRuntime: "builtin" | "agentteams";
  readonly teamTemplateId: string | null;
}

/** 人工审批决策请求。 */
export interface DecideApplicationCompetitionApprovalRequest {
  readonly approvalId: string;
  readonly decision: "APPROVED" | "REJECTED";
  readonly actorId: string;
  readonly reason: string;
  readonly executionMode: "step" | "automatic";
}

/** 执行已经审批的 MLOps 回滚请求。 */
export interface ExecuteApplicationCompetitionRollbackRequest {
  readonly approvalId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly dryRun: boolean;
}

/** 独立验证一个回滚动作的请求。 */
export interface VerifyApplicationCompetitionRemediationRequest {
  readonly actionId: string;
  readonly actorId: string;
}

/** 读取竞赛资源的请求。 */
export interface ReadApplicationCompetitionResourceRequest {
  readonly uri: string;
}

/** 导出复盘 Skill 的请求。 */
export interface ExportApplicationCompetitionRetrospectiveRequest {
  readonly incidentId: string;
}

/** 切换 Fixture 或 Live Adapter 的请求。 */
export interface SetApplicationCompetitionAdapterModeRequest {
  readonly mode: ApplicationCompetitionAdapterMode;
}

/** 重置竞赛演示控制面数据的确认请求。 */
export interface ResetApplicationCompetitionDemoDataRequest {
  readonly confirmation: typeof APPLICATION_COMPETITION_RESET_CONFIRMATION;
}

/** 竞赛领域写操作的统一结果。 */
export interface ApplicationCompetitionMutationResult {
  readonly snapshot: ApplicationCompetitionSnapshot;
  readonly incidentId: string;
  readonly traceId: string | null;
  readonly approvalId: string | null;
  readonly actionId: string | null;
  readonly retrospectivePath: string | null;
  readonly retrospectiveSkillId: string | null;
}

/** 竞赛 Resource 的有界返回包络。 */
export interface ApplicationCompetitionResourceResult {
  readonly uri: string;
  readonly mimeType: "application/json" | "text/markdown";
  readonly text: string;
}

/** 复赛评测报告和 OTLP 风格遥测导出结果。 */
export interface ApplicationCompetitionEvaluationExportResult {
  readonly schema: "openxnet.competition-evaluation-export.v1";
  readonly incidentId: string;
  readonly reportPath: string;
  readonly telemetryPath: string;
  readonly agentTeamsEventsPath: string;
  readonly outcome: "RESOLVED" | "FAILED";
  readonly skillUsageStatus: "BASELINE" | "REUSED" | "LOOKUP_FAILED";
}

/** 判断未知值是否为普通对象；输入未知值，返回类型守卫，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验对象精确字段；输入对象、字段和标签，无返回，字段不一致时抛出 TypeError。 */
function requireFields(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new TypeError(`${label} fields are invalid.`);
  }
}

/** 读取有界非空文本；输入值、标签和长度上限，返回规范文本，无效时抛出 TypeError。 */
function requireText(value: unknown, label: string, maximumLength = 256): string {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid.`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength || normalized.includes("\u0000")) {
    throw new TypeError(`${label} is invalid.`);
  }
  return normalized;
}

/** 读取正整数；输入未知值和标签，返回整数，无效时抛出 TypeError。 */
function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1_000_000) {
    throw new TypeError(`${label} is invalid.`);
  }
  return Number(value);
}

/** 读取固定联合值；输入未知值、白名单和标签，返回联合成员，无效时抛出 TypeError。 */
function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.some((candidate) => candidate === value)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value as T;
}

/** 解析固定演示场景；输入未知对象，返回有界资源引用，额外字段或非法值时抛错。 */
function parseScenario(value: unknown): ApplicationCompetitionScenarioContext {
  if (!isRecord(value)) throw new TypeError("Competition scenario is invalid.");
  const hasScenarioType = Object.hasOwn(value, "scenarioType");
  const hasRollbackRevision = Object.hasOwn(value, "rollbackRevision");
  requireFields(value, [
    ...(hasScenarioType ? ["scenarioType"] : []),
    "alertUid", "serviceUid", "clusterId", "namespace", "workloadName", "reportUid", "assetUid",
    "workflowInstanceUid", "deploymentUid", "failingRevision", "targetRevision", "expectedResourceVersion",
    ...(hasRollbackRevision ? ["rollbackRevision"] : []),
    "testDatasetRef",
  ], "Competition scenario");
  return {
    scenarioType: hasScenarioType
      ? requireEnum(value.scenarioType, APPLICATION_COMPETITION_SCENARIO_TYPES, "Competition scenario type")
      : "feature-drift",
    alertUid: requireText(value.alertUid, "Scenario alert UID"),
    serviceUid: requireText(value.serviceUid, "Scenario service UID"),
    clusterId: requireText(value.clusterId, "Scenario cluster ID"),
    namespace: requireText(value.namespace, "Scenario namespace"),
    workloadName: requireText(value.workloadName, "Scenario workload name"),
    reportUid: requireText(value.reportUid, "Scenario report UID"),
    assetUid: requireText(value.assetUid, "Scenario asset UID"),
    workflowInstanceUid: requireText(value.workflowInstanceUid, "Scenario workflow instance UID"),
    deploymentUid: requireText(value.deploymentUid, "Scenario deployment UID"),
    failingRevision: requirePositiveInteger(value.failingRevision, "Scenario failing revision"),
    targetRevision: requirePositiveInteger(value.targetRevision, "Scenario target revision"),
    ...(hasRollbackRevision
      ? { rollbackRevision: requirePositiveInteger(value.rollbackRevision, "Scenario rollback revision") }
      : {}),
    expectedResourceVersion: requireText(value.expectedResourceVersion, "Scenario resource version", 128),
    testDatasetRef: requireText(value.testDatasetRef, "Scenario test dataset reference", 512),
  };
}

/** 解析创建事件请求；输入 IPC 未知值，返回安全副本，字段或预算无效时抛出 TypeError。 */
export function parseCreateApplicationCompetitionIncidentRequest(
  value: unknown,
): CreateApplicationCompetitionIncidentRequest {
  if (!isRecord(value)) throw new TypeError("Competition incident request is invalid.");
  const hasProjectId = Object.hasOwn(value, "projectId");
  requireFields(
    value,
    ["workspaceId", ...(hasProjectId ? ["projectId"] : []), "title", "summary", "severity", "actorId", "scenario"],
    "Competition incident request",
  );
  const request: CreateApplicationCompetitionIncidentRequest = {
    workspaceId: requireText(value.workspaceId, "Workspace ID", 128),
    projectId: value.projectId === null || value.projectId === undefined
      ? null
      : requireText(value.projectId, "Project ID", 128),
    title: requireText(value.title, "Incident title", 256),
    summary: requireText(value.summary, "Incident summary", 4096),
    severity: requireEnum(value.severity, APPLICATION_COMPETITION_SEVERITIES, "Incident severity"),
    actorId: requireText(value.actorId, "Actor ID", 128),
    scenario: parseScenario(value.scenario),
  };
  if (Buffer.byteLength(JSON.stringify(request), "utf8") > 32 * 1024) {
    throw new TypeError("Competition incident request exceeds its byte budget.");
  }
  return request;
}

/** 解析企业群主 Demo 任务；输入 Renderer 未知值，返回固定场景和有界协同参数。 */
export function parseStartApplicationCompetitionEnterpriseTaskRequest(
  value: unknown,
): StartApplicationCompetitionEnterpriseTaskRequest {
  if (!isRecord(value)) throw new TypeError("Competition enterprise task request is invalid.");
  requireFields(value, [
    "workspaceId",
    "projectId",
    "recipientIds",
    "content",
    "scenarioType",
    "teamRuntime",
    "teamTemplateId",
  ], "Competition enterprise task request");
  if (!Array.isArray(value.recipientIds) || value.recipientIds.length > 64) {
    throw new TypeError("Competition enterprise task recipients are invalid.");
  }
  const recipientIds = value.recipientIds.map((item) => requireText(item, "Recipient ID", 128));
  if (new Set(recipientIds).size !== recipientIds.length) {
    throw new TypeError("Competition enterprise task recipients are invalid.");
  }
  const scenarioType = requireEnum(
    value.scenarioType,
    APPLICATION_COMPETITION_SCENARIO_TYPES,
    "Competition enterprise task scenario type",
  );
  return {
    workspaceId: requireText(value.workspaceId, "Workspace ID", 128),
    projectId: value.projectId === null ? null : requireText(value.projectId, "Project ID", 128),
    recipientIds,
    content: requireText(value.content, "Enterprise task content", 4096),
    scenarioType,
    teamRuntime: requireEnum(value.teamRuntime, ["builtin", "agentteams"] as const, "Team runtime"),
    teamTemplateId: value.teamTemplateId === null
      ? null
      : requireText(value.teamTemplateId, "Team template ID", 128),
  };
}

/** 解析取证请求；输入 IPC 未知值，兼容旧请求并把缺失模板归一化为 null，无效时抛出 TypeError。 */
export function parseRunApplicationCompetitionInvestigationRequest(
  value: unknown,
): RunApplicationCompetitionInvestigationRequest {
  if (!isRecord(value)) throw new TypeError("Competition investigation request is invalid.");
  const hasTeamTemplateId = Object.hasOwn(value, "teamTemplateId");
  requireFields(
    value,
    hasTeamTemplateId
      ? ["incidentId", "actorId", "teamRuntime", "teamTemplateId"]
      : ["incidentId", "actorId", "teamRuntime"],
    "Competition investigation request",
  );
  return {
    incidentId: requireText(value.incidentId, "Incident ID", 128),
    actorId: requireText(value.actorId, "Actor ID", 128),
    teamRuntime: requireEnum(value.teamRuntime, ["builtin", "agentteams"] as const, "Team runtime"),
    teamTemplateId: value.teamTemplateId === null || value.teamTemplateId === undefined
      ? null
      : requireText(value.teamTemplateId, "Team template ID", 128),
  };
}

/** 解析审批决策；输入 IPC 未知值，返回有界决策，无效时抛出 TypeError。 */
export function parseDecideApplicationCompetitionApprovalRequest(
  value: unknown,
): DecideApplicationCompetitionApprovalRequest {
  if (!isRecord(value)) throw new TypeError("Competition approval decision is invalid.");
  const hasExecutionMode = Object.hasOwn(value, "executionMode");
  requireFields(
    value,
    ["approvalId", "decision", "actorId", "reason", ...(hasExecutionMode ? ["executionMode"] : [])],
    "Competition approval decision",
  );
  return {
    approvalId: requireText(value.approvalId, "Approval ID", 128),
    decision: requireEnum(value.decision, ["APPROVED", "REJECTED"] as const, "Approval decision"),
    actorId: requireText(value.actorId, "Actor ID", 128),
    reason: requireText(value.reason, "Approval reason", 2048),
    executionMode: hasExecutionMode
      ? requireEnum(value.executionMode, ["step", "automatic"] as const, "Approval execution mode")
      : "step",
  };
}

/** 解析回滚执行请求；输入 IPC 未知值，返回治理字段，无效时抛出 TypeError。 */
export function parseExecuteApplicationCompetitionRollbackRequest(
  value: unknown,
): ExecuteApplicationCompetitionRollbackRequest {
  if (!isRecord(value)) throw new TypeError("Competition rollback request is invalid.");
  requireFields(value, ["approvalId", "actorId", "idempotencyKey", "dryRun"], "Competition rollback request");
  if (typeof value.dryRun !== "boolean") throw new TypeError("Rollback dry-run flag is invalid.");
  return {
    approvalId: requireText(value.approvalId, "Approval ID", 128),
    actorId: requireText(value.actorId, "Actor ID", 128),
    idempotencyKey: requireText(value.idempotencyKey, "Idempotency key", 128),
    dryRun: value.dryRun,
  };
}

/** 解析独立验证请求；输入 IPC 未知值，返回动作和操作者，无效时抛出 TypeError。 */
export function parseVerifyApplicationCompetitionRemediationRequest(
  value: unknown,
): VerifyApplicationCompetitionRemediationRequest {
  if (!isRecord(value)) throw new TypeError("Competition verification request is invalid.");
  requireFields(value, ["actionId", "actorId"], "Competition verification request");
  return {
    actionId: requireText(value.actionId, "Action ID", 128),
    actorId: requireText(value.actorId, "Actor ID", 128),
  };
}

/** 解析 Resource 读取请求；输入 IPC 未知值，返回 openxnet URI，无效时抛出 TypeError。 */
export function parseReadApplicationCompetitionResourceRequest(
  value: unknown,
): ReadApplicationCompetitionResourceRequest {
  if (!isRecord(value)) throw new TypeError("Competition resource request is invalid.");
  requireFields(value, ["uri"], "Competition resource request");
  const uri = requireText(value.uri, "Competition resource URI", 2048);
  if (!uri.startsWith("openxnet://workspaces/")) throw new TypeError("Competition resource URI is invalid.");
  return { uri };
}

/** 解析复盘导出请求；输入 IPC 未知值，返回事件 ID，无效时抛出 TypeError。 */
export function parseExportApplicationCompetitionRetrospectiveRequest(
  value: unknown,
): ExportApplicationCompetitionRetrospectiveRequest {
  if (!isRecord(value)) throw new TypeError("Competition retrospective request is invalid.");
  requireFields(value, ["incidentId"], "Competition retrospective request");
  return { incidentId: requireText(value.incidentId, "Incident ID", 128) };
}

/** 解析适配器模式请求；输入 IPC 未知值，返回 Fixture 或 Live，无效时抛出 TypeError。 */
export function parseSetApplicationCompetitionAdapterModeRequest(
  value: unknown,
): SetApplicationCompetitionAdapterModeRequest {
  if (!isRecord(value)) throw new TypeError("Competition adapter mode request is invalid.");
  requireFields(value, ["mode"], "Competition adapter mode request");
  return { mode: requireEnum(value.mode, APPLICATION_COMPETITION_ADAPTER_MODES, "Adapter mode") };
}

/** 解析演示数据重置请求；输入 IPC 未知值，确认标记不匹配时拒绝危险操作。 */
export function parseResetApplicationCompetitionDemoDataRequest(
  value: unknown,
): ResetApplicationCompetitionDemoDataRequest {
  if (!isRecord(value)) throw new TypeError("Competition reset request is invalid.");
  requireFields(value, ["confirmation"], "Competition reset request");
  if (value.confirmation !== APPLICATION_COMPETITION_RESET_CONFIRMATION) {
    throw new TypeError("Competition reset confirmation is invalid.");
  }
  return { confirmation: APPLICATION_COMPETITION_RESET_CONFIRMATION };
}
