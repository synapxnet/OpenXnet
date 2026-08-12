/** Competition 到神经符号和时序知识图谱的投影协议版本。 */
export const APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA = "openxnet.competition-knowledge.v1" as const;

/** 投影中的事件摘要，不携带平台原始证据。 */
export interface ApplicationCompetitionKnowledgeIncident {
  readonly incidentId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly summary: string;
  readonly severity: string;
  readonly status: string;
  readonly scenarioType: string;
  readonly serviceUid: string;
  readonly assetUid: string;
  readonly workflowInstanceUid: string;
  readonly deploymentUid: string;
  readonly failingRevision: number;
  readonly targetRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
}

/** 投影中的 Trace 状态。 */
export interface ApplicationCompetitionKnowledgeTrace {
  readonly traceId: string;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

/** 投影中的 AgentTeams 绑定摘要，不携带角色系统提示。 */
export interface ApplicationCompetitionKnowledgeTeam {
  readonly bindingId: string;
  readonly traceId: string;
  readonly runtime: "builtin" | "agentteams";
  readonly teamName: string;
  readonly status: string;
  readonly teamTemplateId: string | null;
  readonly teamTemplateVersion: number | null;
  readonly members: readonly {
    readonly roleCardId: string;
    readonly name: string;
    readonly department: string;
    readonly teamRole: "leader" | "worker" | "verifier";
  }[];
}

/** 投影中的 AgentTeams 身份化决策。 */
export interface ApplicationCompetitionKnowledgeDecision {
  readonly decisionId: string;
  readonly taskId: string;
  readonly bindingId: string;
  readonly traceId: string;
  readonly stage: string;
  readonly teamName: string;
  readonly roleCardId: string;
  readonly agentName: string;
  readonly teamRole: "leader" | "worker" | "verifier";
  readonly decision: string;
  readonly summary: string;
  readonly confidence: number;
  readonly requestedToolNames: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly skillName: string;
  readonly skillVersion: string;
  readonly outputDigest: string;
  readonly routedByRoleCardId: string | null;
  readonly routedByName: string | null;
  readonly createdAt: string;
}

/** 投影中的工具调用摘要，不携带参数和错误原文。 */
export interface ApplicationCompetitionKnowledgeInvocation {
  readonly invocationId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly toolName: string;
  readonly platform: string;
  readonly status: string;
  readonly evidenceId: string | null;
  readonly actionId: string | null;
  readonly errorCode: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

/** 投影中的结构化证据索引，不携带 Evidence data。 */
export interface ApplicationCompetitionKnowledgeEvidence {
  readonly evidenceId: string;
  readonly traceId: string;
  readonly toolName: string;
  readonly platform: string;
  readonly summary: string;
  readonly resourceVersion: string;
  readonly observedAt: string;
  readonly contentDigest: string;
}

/** 投影中的审批步骤范围摘要。 */
export interface ApplicationCompetitionKnowledgeApprovalScope {
  readonly stepId: string;
  readonly toolName: string;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly compensation: boolean;
}

/** 投影中的人工审批摘要。 */
export interface ApplicationCompetitionKnowledgeApproval {
  readonly approvalId: string;
  readonly traceId: string;
  readonly toolName: string;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly planId: string;
  readonly planDigest: string;
  readonly scopes: readonly ApplicationCompetitionKnowledgeApprovalScope[];
  readonly status: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
}

/** 投影中的计划执行步骤摘要。 */
export interface ApplicationCompetitionKnowledgeActionStep {
  readonly stepId: string;
  readonly sequence: number;
  readonly title: string;
  readonly phase?: string;
  readonly toolName: string;
  readonly platform: string;
  readonly status: string;
  readonly evidenceId: string | null;
  readonly resourceVersionBefore?: string;
  readonly resourceVersionAfter?: string;
}

/** 投影中的受控变更动作摘要。 */
export interface ApplicationCompetitionKnowledgeAction {
  readonly actionId: string;
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
  readonly status: string;
  readonly stage: string;
  readonly executedBy: string;
  readonly steps: readonly ApplicationCompetitionKnowledgeActionStep[];
  readonly compensationStatus: string;
  readonly compensationSteps: readonly ApplicationCompetitionKnowledgeActionStep[];
  readonly verificationEvidenceIds: readonly string[];
  readonly errorCode: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

/** 投影中的不可歧义审计回执。 */
export interface ApplicationCompetitionKnowledgeReceipt {
  readonly receiptId: string;
  readonly traceId: string;
  readonly toolName: string;
  readonly actorId: string;
  readonly approvalId: string;
  readonly resourceVersionBefore: string;
  readonly resourceVersionAfter: string;
  readonly outcome: string;
  readonly recordedAt: string;
}

/** 已导出的复盘 Skill 摘要，不携带本地绝对路径。 */
export interface ApplicationCompetitionKnowledgeRetrospective {
  readonly name: string;
  readonly exportedAt: string;
}

/** 单个 Incident 的完整可重放知识投影。 */
export interface ApplicationCompetitionKnowledgeProjectionRequest {
  readonly schema: typeof APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA;
  readonly projectedAt: string;
  readonly incident: ApplicationCompetitionKnowledgeIncident;
  readonly traces: readonly ApplicationCompetitionKnowledgeTrace[];
  readonly teams: readonly ApplicationCompetitionKnowledgeTeam[];
  readonly decisions: readonly ApplicationCompetitionKnowledgeDecision[];
  readonly invocations: readonly ApplicationCompetitionKnowledgeInvocation[];
  readonly evidence: readonly ApplicationCompetitionKnowledgeEvidence[];
  readonly approvals: readonly ApplicationCompetitionKnowledgeApproval[];
  readonly actions: readonly ApplicationCompetitionKnowledgeAction[];
  readonly receipts: readonly ApplicationCompetitionKnowledgeReceipt[];
  readonly retrospective: ApplicationCompetitionKnowledgeRetrospective | null;
}

/** 演示重置时需要清理的知识投影引用。 */
export interface ApplicationCompetitionKnowledgeProjectionRef {
  readonly workspaceId: string;
  readonly incidentId: string;
}

/** 演示重置使用的有界投影清理请求。 */
export interface ApplicationCompetitionKnowledgePurgeRequest {
  readonly schema: typeof APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA;
  readonly projections: readonly ApplicationCompetitionKnowledgeProjectionRef[];
}

/** 私有投影 API 返回的幂等同步计数。 */
export interface ApplicationCompetitionKnowledgeProjectionResult {
  readonly schema: typeof APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA;
  readonly success: true;
  readonly symbols: number;
  readonly activeFacts: number;
  readonly invalidatedFacts: number;
}
