# -*- coding: utf-8 -*-
"""将 GOAI Competition 控制面快照投影为神经符号和时序知识图谱。"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from py.neuro_bridge_api import NeuroSymbol, SymbolK, SymbolQ, SymbolVector


COMPETITION_KNOWLEDGE_SCHEMA = "openxnet.competition-knowledge.v1"


class ProjectionModel(BaseModel):
    """为全部投影输入启用严格字段校验。"""

    model_config = {"extra": "forbid", "populate_by_name": True}


class ProjectionIncident(ProjectionModel):
    """描述允许进入知识层的事件摘要。"""

    incidentId: str = Field(min_length=1, max_length=128)
    workspaceId: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=512)
    summary: str = Field(max_length=4096)
    severity: str = Field(min_length=1, max_length=32)
    status: str = Field(min_length=1, max_length=64)
    scenarioType: str = Field(default="feature-drift", min_length=1, max_length=64)
    serviceUid: str = Field(min_length=1, max_length=256)
    assetUid: str = Field(min_length=1, max_length=256)
    workflowInstanceUid: str = Field(min_length=1, max_length=256)
    deploymentUid: str = Field(min_length=1, max_length=256)
    failingRevision: int = Field(ge=0)
    targetRevision: int = Field(ge=0)
    createdAt: str = Field(min_length=1, max_length=64)
    updatedAt: str = Field(min_length=1, max_length=64)
    resolvedAt: Optional[str] = Field(default=None, max_length=64)


class ProjectionTrace(ProjectionModel):
    """描述一次编排 Trace 的公开状态。"""

    traceId: str = Field(min_length=1, max_length=128)
    status: str = Field(min_length=1, max_length=64)
    startedAt: str = Field(min_length=1, max_length=64)
    completedAt: Optional[str] = Field(default=None, max_length=64)


class ProjectionTeamMember(ProjectionModel):
    """描述不含 Prompt 和权限明细的团队成员。"""

    roleCardId: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    department: str = Field(max_length=256)
    teamRole: Literal["leader", "worker", "verifier"]


class ProjectionTeam(ProjectionModel):
    """描述 Incident 与 AgentTeams 团队的绑定。"""

    bindingId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    runtime: Literal["builtin", "agentteams"]
    teamName: str = Field(min_length=1, max_length=256)
    status: str = Field(min_length=1, max_length=64)
    teamTemplateId: Optional[str] = Field(default=None, max_length=128)
    teamTemplateVersion: Optional[int] = Field(default=None, ge=1)
    members: List[ProjectionTeamMember] = Field(default_factory=list, max_length=20)


class ProjectionDecision(ProjectionModel):
    """描述 AgentTeams 身份化阶段决策及其证据引用。"""

    decisionId: str = Field(min_length=1, max_length=128)
    taskId: str = Field(min_length=1, max_length=128)
    bindingId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    stage: str = Field(min_length=1, max_length=64)
    teamName: str = Field(min_length=1, max_length=256)
    roleCardId: str = Field(min_length=1, max_length=128)
    agentName: str = Field(min_length=1, max_length=256)
    teamRole: Literal["leader", "worker", "verifier"]
    decision: str = Field(min_length=1, max_length=64)
    summary: str = Field(max_length=4096)
    confidence: float = Field(ge=0, le=1)
    requestedToolNames: List[str] = Field(default_factory=list, max_length=100)
    evidenceIds: List[str] = Field(default_factory=list, max_length=500)
    skillName: str = Field(min_length=1, max_length=128)
    skillVersion: str = Field(min_length=1, max_length=64)
    outputDigest: str = Field(min_length=1, max_length=256)
    routedByRoleCardId: Optional[str] = Field(default=None, max_length=128)
    routedByName: Optional[str] = Field(default=None, max_length=256)
    createdAt: str = Field(min_length=1, max_length=64)


class ProjectionInvocation(ProjectionModel):
    """描述不含参数和错误原文的工具调用。"""

    invocationId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    actorId: str = Field(min_length=1, max_length=256)
    toolName: str = Field(min_length=1, max_length=256)
    platform: str = Field(min_length=1, max_length=64)
    status: str = Field(min_length=1, max_length=64)
    evidenceId: Optional[str] = Field(default=None, max_length=128)
    actionId: Optional[str] = Field(default=None, max_length=128)
    errorCode: Optional[str] = Field(default=None, max_length=128)
    startedAt: str = Field(min_length=1, max_length=64)
    completedAt: Optional[str] = Field(default=None, max_length=64)


class ProjectionEvidence(ProjectionModel):
    """描述 Evidence 的可检索索引，不接收原始 data。"""

    evidenceId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    toolName: str = Field(min_length=1, max_length=256)
    platform: str = Field(min_length=1, max_length=64)
    summary: str = Field(max_length=4096)
    resourceVersion: str = Field(max_length=256)
    observedAt: str = Field(min_length=1, max_length=64)
    contentDigest: str = Field(min_length=1, max_length=256)


class ProjectionApproval(ProjectionModel):
    """描述人工审批的状态和职责分离身份。"""

    approvalId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    toolName: str = Field(min_length=1, max_length=256)
    resourceId: str = Field(min_length=1, max_length=256)
    targetRevision: int = Field(ge=0)
    expectedResourceVersion: str = Field(max_length=256)
    planId: str = Field(default="legacy-single-remediation", min_length=1, max_length=128)
    planDigest: str = Field(default="", max_length=256)
    scopes: List["ProjectionApprovalScope"] = Field(default_factory=list, max_length=100)
    status: str = Field(min_length=1, max_length=64)
    requestedBy: str = Field(min_length=1, max_length=256)
    requestedAt: str = Field(min_length=1, max_length=64)
    decidedBy: Optional[str] = Field(default=None, max_length=256)
    decidedAt: Optional[str] = Field(default=None, max_length=64)


class ProjectionApprovalScope(ProjectionModel):
    """描述计划级审批中的单个工具步骤范围。"""

    stepId: str = Field(min_length=1, max_length=128)
    toolName: str = Field(min_length=1, max_length=256)
    resourceId: str = Field(min_length=1, max_length=256)
    targetRevision: int = Field(ge=0)
    expectedResourceVersion: str = Field(max_length=256)
    compensation: bool


class ProjectionActionStep(ProjectionModel):
    """描述主计划或补偿计划中的可审计执行步骤。"""

    stepId: str = Field(min_length=1, max_length=128)
    sequence: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=512)
    phase: Optional[str] = Field(default=None, max_length=64)
    toolName: str = Field(min_length=1, max_length=256)
    platform: str = Field(min_length=1, max_length=64)
    status: str = Field(min_length=1, max_length=64)
    evidenceId: Optional[str] = Field(default=None, max_length=128)
    resourceVersionBefore: str = Field(default="", max_length=256)
    resourceVersionAfter: str = Field(default="", max_length=256)


class ProjectionAction(ProjectionModel):
    """描述受控变更动作和独立验证引用。"""

    actionId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    approvalId: str = Field(min_length=1, max_length=128)
    toolName: str = Field(default="mlops.deployment.rollback", min_length=1, max_length=256)
    resourceId: str = Field(default="legacy-deployment", min_length=1, max_length=256)
    planId: str = Field(default="legacy-single-remediation", min_length=1, max_length=128)
    planTitle: str = Field(default="旧版单步骤处置", min_length=1, max_length=512)
    planDigest: str = Field(default="", max_length=256)
    deploymentUid: str = Field(min_length=1, max_length=256)
    fromRevision: int = Field(ge=0)
    targetRevision: int = Field(ge=0)
    status: str = Field(min_length=1, max_length=64)
    stage: str = Field(min_length=1, max_length=64)
    executedBy: str = Field(min_length=1, max_length=256)
    steps: List[ProjectionActionStep] = Field(default_factory=list, max_length=100)
    compensationStatus: str = Field(default="NOT_REQUIRED", min_length=1, max_length=64)
    compensationSteps: List[ProjectionActionStep] = Field(default_factory=list, max_length=100)
    verificationEvidenceIds: List[str] = Field(default_factory=list, max_length=500)
    errorCode: Optional[str] = Field(default=None, max_length=128)
    createdAt: str = Field(min_length=1, max_length=64)
    completedAt: Optional[str] = Field(default=None, max_length=64)


class ProjectionReceipt(ProjectionModel):
    """描述可追溯的审计回执。"""

    receiptId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    toolName: str = Field(min_length=1, max_length=256)
    actorId: str = Field(min_length=1, max_length=256)
    approvalId: str = Field(min_length=1, max_length=128)
    resourceVersionBefore: str = Field(max_length=256)
    resourceVersionAfter: str = Field(max_length=256)
    outcome: str = Field(min_length=1, max_length=64)
    recordedAt: str = Field(min_length=1, max_length=64)


class ProjectionTaskGraphNode(ProjectionModel):
    """描述动态 Task Graph 的单个节点。"""

    nodeId: str = Field(min_length=1, max_length=256)
    lane: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=512)
    nodeType: str = Field(min_length=1, max_length=64)
    toolName: Optional[str] = Field(default=None, max_length=256)
    dependsOn: List[str] = Field(default_factory=list, max_length=50)
    parallelGroup: Optional[str] = Field(default=None, max_length=128)
    timeoutMs: int = Field(ge=1, le=86_400_000)
    maximumAttempts: int = Field(ge=1, le=10)
    assignedRoleCardId: Optional[str] = Field(default=None, max_length=128)
    assignedAgentName: str = Field(default="", max_length=256)
    assignmentMode: Optional[Literal["CAPABILITY_MATCH", "ROLE_FALLBACK", "CONTROL_PLANE", "HUMAN"]] = None
    status: str = Field(min_length=1, max_length=64)
    evidenceIds: List[str] = Field(default_factory=list, max_length=100)


class ProjectionTaskGraph(ProjectionModel):
    """描述一次 Trace 的动态任务图和重规划状态。"""

    graphId: str = Field(min_length=1, max_length=128)
    workspaceId: str = Field(min_length=1, max_length=128)
    incidentId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    revision: int = Field(ge=1)
    status: str = Field(min_length=1, max_length=64)
    replanReason: Optional[str] = Field(default=None, max_length=4096)
    conflictPolicies: List[str] = Field(default_factory=list, max_length=20)
    nodes: List[ProjectionTaskGraphNode] = Field(default_factory=list, max_length=200)
    createdAt: str = Field(min_length=1, max_length=64)
    updatedAt: str = Field(min_length=1, max_length=64)
    completedAt: Optional[str] = Field(default=None, max_length=64)
    crystallizedAt: Optional[str] = Field(default=None, max_length=64)


class ProjectionReasoningKnowledgeRef(ProjectionModel):
    """描述在线图谱检索返回的有界事实引用。"""

    subject: str = Field(min_length=1, max_length=256)
    predicate: str = Field(min_length=1, max_length=256)
    object: str = Field(min_length=1, max_length=256)
    confidence: float = Field(ge=0, le=1)


class ProjectionReasoningCandidate(ProjectionModel):
    """描述进入神经符号硬门的 Skill 或计划候选。"""

    candidateId: str = Field(min_length=1, max_length=256)
    candidateType: Literal["SKILL", "PLAN"]
    title: str = Field(min_length=1, max_length=512)
    skillId: Optional[str] = Field(default=None, max_length=128)
    strategyId: Optional[str] = Field(default=None, max_length=128)
    semanticScore: float = Field(ge=0, le=1)
    graphScore: float = Field(ge=0, le=1)
    evidenceScore: float = Field(ge=0, le=1)
    safetyScore: float = Field(ge=0, le=1)
    totalScore: float = Field(ge=0, le=1)
    eligible: bool
    authorityLevel: str = Field(min_length=1, max_length=32)
    riskClass: str = Field(min_length=1, max_length=32)
    evidenceGrade: str = Field(min_length=1, max_length=32)
    policyDecision: str = Field(min_length=1, max_length=64)
    ruleCodes: List[str] = Field(default_factory=list, max_length=50)
    ruleReasons: List[str] = Field(default_factory=list, max_length=50)


class ProjectionReasoningDecision(ProjectionModel):
    """描述在线 RAG、图谱检索和符号规则形成的最终裁决。"""

    reasoningId: str = Field(min_length=1, max_length=128)
    workspaceId: str = Field(min_length=1, max_length=128)
    incidentId: str = Field(min_length=1, max_length=128)
    traceId: str = Field(min_length=1, max_length=128)
    decisionType: Literal["SKILL_SELECTION", "PLAN_SELECTION"]
    retrievalMode: Literal["ONLINE_HYBRID_RAG_KG", "CATALOG_FALLBACK"]
    query: str = Field(min_length=1, max_length=2048)
    knowledgeRefs: List[ProjectionReasoningKnowledgeRef] = Field(default_factory=list, max_length=100)
    candidates: List[ProjectionReasoningCandidate] = Field(default_factory=list, max_length=20)
    selectedCandidateId: str = Field(min_length=1, max_length=256)
    explanation: str = Field(min_length=1, max_length=4096)
    createdAt: str = Field(min_length=1, max_length=64)


class ProjectionRetrospective(ProjectionModel):
    """描述已导出的复盘 Skill。"""

    name: str = Field(min_length=1, max_length=128)
    exportedAt: str = Field(min_length=1, max_length=64)


class CompetitionKnowledgeProjectionRequest(ProjectionModel):
    """接收一个 Incident 的完整、脱敏、可重放投影。"""

    contract_schema: Literal[COMPETITION_KNOWLEDGE_SCHEMA] = Field(alias="schema")
    projectedAt: str = Field(min_length=1, max_length=64)
    incident: ProjectionIncident
    traces: List[ProjectionTrace] = Field(default_factory=list, max_length=100)
    teams: List[ProjectionTeam] = Field(default_factory=list, max_length=100)
    decisions: List[ProjectionDecision] = Field(default_factory=list, max_length=500)
    invocations: List[ProjectionInvocation] = Field(default_factory=list, max_length=2000)
    evidence: List[ProjectionEvidence] = Field(default_factory=list, max_length=2000)
    approvals: List[ProjectionApproval] = Field(default_factory=list, max_length=500)
    actions: List[ProjectionAction] = Field(default_factory=list, max_length=500)
    receipts: List[ProjectionReceipt] = Field(default_factory=list, max_length=1000)
    taskGraphs: List[ProjectionTaskGraph] = Field(default_factory=list, max_length=20)
    reasoningDecisions: List[ProjectionReasoningDecision] = Field(default_factory=list, max_length=100)
    retrospective: Optional[ProjectionRetrospective] = None


class ProjectionReference(ProjectionModel):
    """定位一个可清理的比赛知识投影。"""

    workspaceId: str = Field(min_length=1, max_length=128)
    incidentId: str = Field(min_length=1, max_length=128)


class CompetitionKnowledgePurgeRequest(ProjectionModel):
    """接收演示重置时需要清理的投影引用。"""

    contract_schema: Literal[COMPETITION_KNOWLEDGE_SCHEMA] = Field(alias="schema")
    projections: List[ProjectionReference] = Field(default_factory=list, max_length=1000)


class CompetitionKnowledgeProjector:
    """以 Competition Store 为事实源维护神经符号和时序图谱投影。"""

    def __init__(self, symbol_store: Any, temporal_graph: Any) -> None:
        """创建投影器；输入单写者符号库和时序图谱，不立即修改数据。"""

        self._symbol_store = symbol_store
        self._temporal_graph = temporal_graph

    def synchronize(self, request: CompetitionKnowledgeProjectionRequest) -> Dict[str, int]:
        """同步一个事件；输入完整投影，返回符号和事实计数，重复调用保持幂等。"""

        prefix = projection_prefix(request.incident.workspaceId, request.incident.incidentId)
        symbols = self._build_symbols(request, prefix)
        entities, facts = self._build_graph(request, prefix)
        graph_result = self._temporal_graph.sync_source_facts(
            source_prefix=prefix,
            entities=entities,
            facts=facts,
            observed_at=request.projectedAt,
            project_version=COMPETITION_KNOWLEDGE_SCHEMA,
        )
        self._symbol_store.replace_by_prefix(prefix, symbols)
        return {
            "symbols": len(symbols),
            "active_facts": int(graph_result.get("active", 0)),
            "invalidated_facts": int(graph_result.get("invalidated", 0)),
        }

    def purge(self, request: CompetitionKnowledgePurgeRequest) -> Dict[str, int]:
        """清理指定演示事件；输入投影引用，返回删除符号和事实数量。"""

        removed_symbols = 0
        removed_facts = 0
        seen: set[str] = set()
        for reference in request.projections:
            prefix = projection_prefix(reference.workspaceId, reference.incidentId)
            if prefix in seen:
                continue
            seen.add(prefix)
            removed_symbols += int(self._symbol_store.remove_by_prefix(prefix))
            removed_facts += int(self._temporal_graph.purge_source_facts(prefix))
        return {
            "symbols": removed_symbols,
            "active_facts": 0,
            "invalidated_facts": removed_facts,
        }

    def _build_symbols(
        self,
        request: CompetitionKnowledgeProjectionRequest,
        prefix: str,
    ) -> List[NeuroSymbol]:
        """构建可查询符号；输入事件投影和稳定前缀，返回完整替换集合。"""

        incident = request.incident
        incident_symbol_id = f"{prefix}incident"
        child_symbols: List[NeuroSymbol] = []
        for decision in request.decisions:
            symbol_id = f"{prefix}decision-{stable_suffix(decision.decisionId)}"
            entities = [
                entity_name("Incident", incident.incidentId),
                entity_name("Decision", decision.decisionId),
                entity_name("Agent", decision.roleCardId),
                entity_name("Role", decision.teamRole),
                entity_name("Skill", f"{decision.skillName}@{decision.skillVersion}"),
                *[entity_name("Tool", item) for item in decision.requestedToolNames],
                *[entity_name("Evidence", item) for item in decision.evidenceIds],
            ]
            child_symbols.append(NeuroSymbol(
                id=symbol_id,
                operator=decision_operator(decision.stage),
                label=(
                    f"AgentTeams {decision.agentName}（{decision.teamRole}）在 "
                    f"{decision.stage} 阶段做出 {decision.decision}：{decision.summary}"
                )[:2000],
                Q=SymbolQ(
                    ruleIds=["rule-temporal-knowledge-v1"],
                    constraints=[
                        "AGENT_IDENTITY_BOUND",
                        "EVIDENCE_REFERENCES_REQUIRED",
                        f"STAGE:{decision.stage}",
                    ],
                ),
                K=SymbolK(
                    entities=unique_text(entities, 100),
                    relations=[
                        f"{entity_name('Decision', decision.decisionId)}→{entity_name('Agent', decision.roleCardId)}",
                        f"{entity_name('Decision', decision.decisionId)}→{entity_name('Skill', f'{decision.skillName}@{decision.skillVersion}')}",
                    ],
                    factIds=list(decision.evidenceIds[:500]),
                    externalRefs=[
                        f"openxnet://workspaces/{incident.workspaceId}/incidents/{incident.incidentId}",
                        f"openxnet://workspaces/{incident.workspaceId}/traces/{decision.traceId}",
                    ],
                ),
                z=[
                    SymbolVector(type="weight", key="decision_confidence", value=decision.confidence),
                    SymbolVector(
                        type="weight",
                        key="evidence_coverage",
                        value=min(1.0, len(decision.evidenceIds) / 10.0),
                    ),
                ],
                createdAt=parse_timestamp(decision.createdAt),
                successRate=decision.confidence,
                delegationTarget="agentteams",
                parentSymbol=incident_symbol_id,
                metadata=competition_metadata(
                    incident,
                    "agent_decision",
                    trace_id=decision.traceId,
                    stage=decision.stage,
                    decision=decision.decision,
                    team_role=decision.teamRole,
                    agent_name=decision.agentName,
                    skill_name=decision.skillName,
                    skill_version=decision.skillVersion,
                    confidence=decision.confidence,
                ),
            ))

        for approval in request.approvals:
            child_symbols.append(NeuroSymbol(
                id=f"{prefix}approval-{stable_suffix(approval.approvalId)}",
                operator="ApplyLogicRules",
                label=f"人工审批 {approval.approvalId} 对 {approval.toolName} 的决策为 {approval.status}",
                Q=SymbolQ(
                    ruleIds=["rule-temporal-knowledge-v1"],
                    constraints=["HUMAN_APPROVAL_REQUIRED", "SEPARATION_OF_DUTIES"],
                ),
                K=SymbolK(entities=[
                    entity_name("Incident", incident.incidentId),
                    entity_name("Approval", approval.approvalId),
                    entity_name("Tool", approval.toolName),
                    entity_name("Actor", approval.requestedBy),
                    *([entity_name("Actor", approval.decidedBy)] if approval.decidedBy else []),
                ]),
                createdAt=parse_timestamp(approval.requestedAt),
                successRate=1.0 if approval.status == "APPROVED" else 0.5,
                parentSymbol=incident_symbol_id,
                metadata=competition_metadata(
                    incident,
                    "approval",
                    trace_id=approval.traceId,
                    decision=approval.status,
                ),
            ))

        for action in request.actions:
            child_symbols.append(NeuroSymbol(
                id=f"{prefix}action-{stable_suffix(action.actionId)}",
                operator="ToolChainExec",
                label=(
                    f"受控动作 {action.actionId} 通过 {action.toolName} 将资源变更到目标 "
                    f"{action.targetRevision}，当前状态 {action.status}/{action.stage}"
                ),
                Q=SymbolQ(
                    ruleIds=["rule-temporal-knowledge-v1"],
                    constraints=["APPROVAL_SCOPE_BOUND", "IDEMPOTENT_EXECUTION", "INDEPENDENT_VERIFICATION"],
                ),
                K=SymbolK(
                    entities=[
                        entity_name("Incident", incident.incidentId),
                        entity_name("Action", action.actionId),
                        entity_name("Approval", action.approvalId),
                        entity_name("Tool", action.toolName),
                        entity_name("Resource", action.resourceId),
                        entity_name("Deployment", action.deploymentUid),
                        *[entity_name("Evidence", item) for item in action.verificationEvidenceIds],
                    ],
                    factIds=list(action.verificationEvidenceIds[:500]),
                ),
                createdAt=parse_timestamp(action.createdAt),
                successRate=1.0 if action.status == "SUCCEEDED" else (0.0 if action.status == "FAILED" else 0.75),
                delegationTarget=platform_name(action.toolName.split(".", 1)[0]),
                parentSymbol=incident_symbol_id,
                metadata=competition_metadata(
                    incident,
                    "action",
                    trace_id=action.traceId,
                    decision=action.status,
                ),
            ))

        for task_graph in request.taskGraphs:
            child_symbols.append(NeuroSymbol(
                id=f"{prefix}task-graph-{stable_suffix(task_graph.graphId)}",
                operator="PlanDecompose",
                label=(
                    f"动态 Task Graph {task_graph.graphId} 修订 {task_graph.revision}，"
                    f"包含 {len(task_graph.nodes)} 个节点，当前状态 {task_graph.status}"
                ),
                Q=SymbolQ(
                    ruleIds=["rule-temporal-knowledge-v1"],
                    constraints=unique_text([
                        "DEPENDENCY_ORDER_REQUIRED",
                        "PARALLEL_GROUP_BOUNDED",
                        *task_graph.conflictPolicies,
                    ], 100),
                ),
                K=SymbolK(entities=[
                    entity_name("Incident", incident.incidentId),
                    entity_name("Trace", task_graph.traceId),
                    entity_name("TaskGraph", task_graph.graphId),
                    *[entity_name("TaskNode", f"{task_graph.graphId}:{node.nodeId}") for node in task_graph.nodes],
                    *[entity_name("Agent", node.assignedRoleCardId) for node in task_graph.nodes if node.assignedRoleCardId],
                ]),
                createdAt=parse_timestamp(task_graph.createdAt),
                successRate=1.0 if task_graph.status == "SUCCEEDED" else (0.0 if task_graph.status == "FAILED" else 0.75),
                parentSymbol=incident_symbol_id,
                metadata=competition_metadata(
                    incident,
                    "task_graph",
                    trace_id=task_graph.traceId,
                    stage=f"REVISION_{task_graph.revision}",
                    decision=task_graph.status,
                ),
            ))

        for reasoning in request.reasoningDecisions:
            selected = next(
                (candidate for candidate in reasoning.candidates if candidate.candidateId == reasoning.selectedCandidateId),
                None,
            )
            child_symbols.append(NeuroSymbol(
                id=f"{prefix}reasoning-{stable_suffix(reasoning.reasoningId)}",
                operator="RetrieveKnowledge" if reasoning.decisionType == "SKILL_SELECTION" else "ApplyLogicRules",
                label=(
                    f"{reasoning.decisionType} 从 {len(reasoning.candidates)} 个候选中选择 "
                    f"{reasoning.selectedCandidateId}：{reasoning.explanation}"
                )[:2000],
                Q=SymbolQ(
                    ruleIds=["rule-temporal-knowledge-v1"],
                    constraints=unique_text([
                        "MULTI_CANDIDATE_REQUIRED",
                        "SYMBOLIC_HARD_GATE_REQUIRED",
                        *(selected.ruleCodes if selected is not None else []),
                    ], 100),
                ),
                K=SymbolK(entities=[
                    entity_name("Incident", incident.incidentId),
                    entity_name("Trace", reasoning.traceId),
                    entity_name("Reasoning", reasoning.reasoningId),
                    *[entity_name("Candidate", candidate.candidateId) for candidate in reasoning.candidates],
                    *[entity_name("Skill", candidate.skillId) for candidate in reasoning.candidates if candidate.skillId],
                ]),
                z=[
                    SymbolVector(type="weight", key="selected_score", value=selected.totalScore if selected is not None else 0.0),
                    SymbolVector(type="weight", key="knowledge_coverage", value=min(1.0, len(reasoning.knowledgeRefs) / 10.0)),
                ],
                createdAt=parse_timestamp(reasoning.createdAt),
                successRate=selected.totalScore if selected is not None else 0.0,
                parentSymbol=incident_symbol_id,
                metadata=competition_metadata(
                    incident,
                    "reasoning_decision",
                    trace_id=reasoning.traceId,
                    stage=reasoning.decisionType,
                    decision=selected.policyDecision if selected is not None else "ABSTAIN",
                    skill_name=selected.skillId if selected is not None and selected.skillId else "",
                    confidence=selected.totalScore if selected is not None else 0.0,
                ),
            ))

        if request.retrospective is not None:
            child_symbols.append(NeuroSymbol(
                id=f"{prefix}retrospective",
                operator="SkillCrystallize",
                label=f"事件 {incident.incidentId} 已沉淀为可复用 Skill：{request.retrospective.name}",
                Q=SymbolQ(
                    ruleIds=["rule-temporal-knowledge-v1"],
                    constraints=["TRACEABLE_EVIDENCE_REQUIRED", "REUSABLE_SKILL_CONTRACT"],
                ),
                K=SymbolK(entities=[
                    entity_name("Incident", incident.incidentId),
                    entity_name("Skill", request.retrospective.name),
                ]),
                createdAt=parse_timestamp(request.retrospective.exportedAt),
                successRate=1.0,
                parentSymbol=incident_symbol_id,
                metadata=competition_metadata(incident, "retrospective_skill"),
            ))

        incident_entities = [
            entity_name("Incident", incident.incidentId),
            entity_name("Workspace", incident.workspaceId),
            entity_name("Service", incident.serviceUid),
            entity_name("DataAsset", incident.assetUid),
            entity_name("Workflow", incident.workflowInstanceUid),
            entity_name("Deployment", incident.deploymentUid),
            *[entity_name("Trace", trace.traceId) for trace in request.traces],
        ]
        incident_symbol = NeuroSymbol(
            id=incident_symbol_id,
            operator="ConsolidateKnowledge" if incident.status == "RESOLVED" else "TemporalReason",
            label=f"事件 {incident.title}（{incident.incidentId}）当前状态 {incident.status}：{incident.summary}"[:2000],
            Q=SymbolQ(
                ruleIds=["rule-temporal-knowledge-v1"],
                constraints=["MULTI_SOURCE_EVIDENCE", "AUDITABLE_DECISION_CHAIN", f"SEVERITY:{incident.severity}"],
            ),
            K=SymbolK(
                entities=unique_text(incident_entities, 100),
                factIds=[item.evidenceId for item in request.evidence[:500]],
                externalRefs=[f"openxnet://workspaces/{incident.workspaceId}/incidents/{incident.incidentId}"],
            ),
            z=[
                SymbolVector(
                    type="weight",
                    key="evidence_coverage",
                    value=min(1.0, len(request.evidence) / 14.0),
                ),
                SymbolVector(
                    type="weight",
                    key="agent_decision_coverage",
                    value=min(1.0, len(request.decisions) / 3.0),
                ),
            ],
            createdAt=parse_timestamp(incident.createdAt),
            successRate=1.0 if incident.status == "RESOLVED" else (0.0 if incident.status == "FAILED" else 0.75),
            childSymbols=[symbol.id for symbol in child_symbols],
            metadata=competition_metadata(incident, "incident"),
        )
        return [incident_symbol, *child_symbols]

    def _build_graph(
        self,
        request: CompetitionKnowledgeProjectionRequest,
        prefix: str,
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """构建完整关系集合；输入事件投影和符号前缀，返回实体与带来源事实。"""

        incident = request.incident
        entities: Dict[str, Dict[str, Any]] = {}
        facts: List[Dict[str, Any]] = []
        incident_node = entity_name("Incident", incident.incidentId)
        incident_source = f"{prefix}incident"

        def add_relation(
            subject: str,
            subject_type: str,
            predicate: str,
            obj: str,
            object_type: str,
            source_symbol: str = incident_source,
            confidence: float = 1.0,
        ) -> None:
            """登记一条有类型关系；输入两端实体和来源符号，去重工作交给图谱同步器。"""

            entities[subject] = {"name": subject, "type": subject_type, "properties": {}}
            entities[obj] = {"name": obj, "type": object_type, "properties": {}}
            facts.append({
                "subject": subject,
                "predicate": predicate,
                "object": obj,
                "confidence": confidence,
                "source_symbol": source_symbol,
            })

        add_relation(incident_node, "incident", "belongs_to_workspace", entity_name("Workspace", incident.workspaceId), "workspace")
        add_relation(incident_node, "incident", "has_status", entity_name("Status", incident.status), "status")
        add_relation(incident_node, "incident", "has_severity", entity_name("Severity", incident.severity), "severity")
        add_relation(incident_node, "incident", "affects_service", entity_name("Service", incident.serviceUid), "service")
        add_relation(incident_node, "incident", "uses_scenario", entity_name("Scenario", incident.scenarioType), "scenario")
        add_relation(incident_node, "incident", "depends_on_data_asset", entity_name("DataAsset", incident.assetUid), "data_asset")
        add_relation(incident_node, "incident", "involves_workflow", entity_name("Workflow", incident.workflowInstanceUid), "workflow")
        add_relation(incident_node, "incident", "affects_deployment", entity_name("Deployment", incident.deploymentUid), "deployment")
        add_relation(entity_name("Deployment", incident.deploymentUid), "deployment", "failing_revision", entity_name("Revision", str(incident.failingRevision)), "revision")
        add_relation(entity_name("Deployment", incident.deploymentUid), "deployment", "target_revision", entity_name("Revision", str(incident.targetRevision)), "revision")

        for trace in request.traces:
            trace_node = entity_name("Trace", trace.traceId)
            add_relation(incident_node, "incident", "has_trace", trace_node, "trace")
            add_relation(trace_node, "trace", "has_status", entity_name("Status", trace.status), "status")

        for team in request.teams:
            team_node = entity_name("Team", team.bindingId)
            add_relation(entity_name("Trace", team.traceId), "trace", "bound_to_team", team_node, "agent_team")
            add_relation(team_node, "agent_team", "uses_runtime", entity_name("Runtime", team.runtime), "runtime")
            add_relation(team_node, "agent_team", "has_status", entity_name("Status", team.status), "status")
            for member in team.members:
                agent_node = entity_name("Agent", member.roleCardId)
                add_relation(team_node, "agent_team", "has_member", agent_node, "agent")
                add_relation(agent_node, "agent", "has_role", entity_name("Role", member.teamRole), "agent_role")

        for decision in request.decisions:
            source_symbol = f"{prefix}decision-{stable_suffix(decision.decisionId)}"
            decision_node = entity_name("Decision", decision.decisionId)
            add_relation(incident_node, "incident", "has_decision", decision_node, "agent_decision", source_symbol, decision.confidence)
            add_relation(entity_name("Trace", decision.traceId), "trace", "has_decision", decision_node, "agent_decision", source_symbol, decision.confidence)
            add_relation(decision_node, "agent_decision", "made_by", entity_name("Agent", decision.roleCardId), "agent", source_symbol, decision.confidence)
            add_relation(decision_node, "agent_decision", "has_stage", entity_name("Stage", decision.stage), "decision_stage", source_symbol, decision.confidence)
            add_relation(decision_node, "agent_decision", "concluded_as", entity_name("DecisionResult", decision.decision), "decision_result", source_symbol, decision.confidence)
            add_relation(decision_node, "agent_decision", "uses_skill", entity_name("Skill", f"{decision.skillName}@{decision.skillVersion}"), "skill", source_symbol, decision.confidence)
            if decision.routedByRoleCardId:
                add_relation(decision_node, "agent_decision", "routed_by", entity_name("Agent", decision.routedByRoleCardId), "agent", source_symbol, decision.confidence)
            for tool_name in decision.requestedToolNames:
                add_relation(decision_node, "agent_decision", "requests_tool", entity_name("Tool", tool_name), "tool", source_symbol, decision.confidence)
            for evidence_id in decision.evidenceIds:
                add_relation(decision_node, "agent_decision", "based_on_evidence", entity_name("Evidence", evidence_id), "evidence", source_symbol, decision.confidence)

        for invocation in request.invocations:
            invocation_node = entity_name("Invocation", invocation.invocationId)
            add_relation(entity_name("Trace", invocation.traceId), "trace", "has_invocation", invocation_node, "tool_invocation")
            add_relation(invocation_node, "tool_invocation", "calls_tool", entity_name("Tool", invocation.toolName), "tool")
            add_relation(invocation_node, "tool_invocation", "executed_by", entity_name("Actor", invocation.actorId), "actor")
            add_relation(invocation_node, "tool_invocation", "has_status", entity_name("Status", invocation.status), "status")
            if invocation.evidenceId:
                add_relation(invocation_node, "tool_invocation", "produced_evidence", entity_name("Evidence", invocation.evidenceId), "evidence")

        for evidence in request.evidence:
            evidence_node = entity_name("Evidence", evidence.evidenceId)
            add_relation(entity_name("Trace", evidence.traceId), "trace", "has_evidence", evidence_node, "evidence")
            add_relation(evidence_node, "evidence", "produced_by_tool", entity_name("Tool", evidence.toolName), "tool")
            add_relation(evidence_node, "evidence", "collected_from", entity_name("Platform", platform_name(evidence.platform)), "platform")
            if evidence.resourceVersion:
                add_relation(evidence_node, "evidence", "observed_version", entity_name("ResourceVersion", evidence.resourceVersion), "resource_version")

        for approval in request.approvals:
            source_symbol = f"{prefix}approval-{stable_suffix(approval.approvalId)}"
            approval_node = entity_name("Approval", approval.approvalId)
            add_relation(incident_node, "incident", "requires_approval", approval_node, "approval", source_symbol)
            add_relation(approval_node, "approval", "has_status", entity_name("Status", approval.status), "status", source_symbol)
            add_relation(approval_node, "approval", "requested_by", entity_name("Actor", approval.requestedBy), "actor", source_symbol)
            add_relation(approval_node, "approval", "governs_tool", entity_name("Tool", approval.toolName), "tool", source_symbol)
            plan_node = entity_name("Plan", approval.planId)
            add_relation(approval_node, "approval", "authorizes_plan", plan_node, "execution_plan", source_symbol)
            for scope in approval.scopes:
                scope_node = entity_name("PlanStep", f"{approval.planId}:{scope.stepId}")
                add_relation(plan_node, "execution_plan", "contains_step", scope_node, "plan_step", source_symbol)
                add_relation(scope_node, "plan_step", "invokes_tool", entity_name("Tool", scope.toolName), "tool", source_symbol)
                add_relation(scope_node, "plan_step", "targets_resource", entity_name("Resource", scope.resourceId), "resource", source_symbol)
                add_relation(
                    scope_node,
                    "plan_step",
                    "has_step_kind",
                    entity_name("StepKind", "COMPENSATION" if scope.compensation else "PRIMARY"),
                    "step_kind",
                    source_symbol,
                )
            if approval.decidedBy:
                add_relation(approval_node, "approval", "decided_by", entity_name("Actor", approval.decidedBy), "actor", source_symbol)

        for action in request.actions:
            source_symbol = f"{prefix}action-{stable_suffix(action.actionId)}"
            action_node = entity_name("Action", action.actionId)
            add_relation(incident_node, "incident", "has_action", action_node, "action", source_symbol)
            add_relation(action_node, "action", "authorized_by", entity_name("Approval", action.approvalId), "approval", source_symbol)
            add_relation(action_node, "action", "executed_by", entity_name("Actor", action.executedBy), "actor", source_symbol)
            add_relation(action_node, "action", "executes_tool", entity_name("Tool", action.toolName), "tool", source_symbol)
            add_relation(action_node, "action", "changes_resource", entity_name("Resource", action.resourceId), "resource", source_symbol)
            add_relation(action_node, "action", "changes_deployment", entity_name("Deployment", action.deploymentUid), "deployment", source_symbol)
            add_relation(action_node, "action", "has_status", entity_name("Status", action.status), "status", source_symbol)
            add_relation(action_node, "action", "executes_plan", entity_name("Plan", action.planId), "execution_plan", source_symbol)
            add_relation(
                action_node,
                "action",
                "has_compensation_status",
                entity_name("CompensationStatus", action.compensationStatus),
                "compensation_status",
                source_symbol,
            )
            for step in [*action.steps, *action.compensationSteps]:
                step_node = entity_name("ExecutionStep", f"{action.actionId}:{step.stepId}")
                add_relation(action_node, "action", "has_execution_step", step_node, "execution_step", source_symbol)
                add_relation(step_node, "execution_step", "invokes_tool", entity_name("Tool", step.toolName), "tool", source_symbol)
                add_relation(step_node, "execution_step", "has_status", entity_name("Status", step.status), "status", source_symbol)
                add_relation(step_node, "execution_step", "runs_on_platform", entity_name("Platform", platform_name(step.platform)), "platform", source_symbol)
                if step.evidenceId:
                    add_relation(step_node, "execution_step", "produced_evidence", entity_name("Evidence", step.evidenceId), "evidence", source_symbol)
            for evidence_id in action.verificationEvidenceIds:
                add_relation(action_node, "action", "verified_by_evidence", entity_name("Evidence", evidence_id), "evidence", source_symbol)

        for task_graph in request.taskGraphs:
            source_symbol = f"{prefix}task-graph-{stable_suffix(task_graph.graphId)}"
            graph_node = entity_name("TaskGraph", task_graph.graphId)
            add_relation(incident_node, "incident", "has_task_graph", graph_node, "task_graph", source_symbol)
            add_relation(entity_name("Trace", task_graph.traceId), "trace", "uses_task_graph", graph_node, "task_graph", source_symbol)
            add_relation(graph_node, "task_graph", "has_status", entity_name("Status", task_graph.status), "status", source_symbol)
            add_relation(graph_node, "task_graph", "has_revision", entity_name("Revision", str(task_graph.revision)), "revision", source_symbol)
            for node in task_graph.nodes:
                node_entity = entity_name("TaskNode", f"{task_graph.graphId}:{node.nodeId}")
                add_relation(graph_node, "task_graph", "contains_task_node", node_entity, "task_node", source_symbol)
                add_relation(node_entity, "task_node", "has_status", entity_name("Status", node.status), "status", source_symbol)
                add_relation(node_entity, "task_node", "has_lane", entity_name("TaskLane", node.lane), "task_lane", source_symbol)
                if node.toolName:
                    add_relation(node_entity, "task_node", "invokes_tool", entity_name("Tool", node.toolName), "tool", source_symbol)
                if node.parallelGroup:
                    add_relation(node_entity, "task_node", "belongs_to_parallel_group", entity_name("ParallelGroup", node.parallelGroup), "parallel_group", source_symbol)
                if node.assignedRoleCardId:
                    add_relation(node_entity, "task_node", "assigned_to_agent", entity_name("Agent", node.assignedRoleCardId), "agent", source_symbol)
                elif node.assignedAgentName:
                    owner_type = "human" if node.assignmentMode == "HUMAN" else "control_plane"
                    add_relation(node_entity, "task_node", "assigned_to_owner", entity_name("Owner", node.assignedAgentName), owner_type, source_symbol)
                for dependency in node.dependsOn:
                    add_relation(
                        node_entity,
                        "task_node",
                        "depends_on_task_node",
                        entity_name("TaskNode", f"{task_graph.graphId}:{dependency}"),
                        "task_node",
                        source_symbol,
                    )

        for reasoning in request.reasoningDecisions:
            source_symbol = f"{prefix}reasoning-{stable_suffix(reasoning.reasoningId)}"
            reasoning_node = entity_name("Reasoning", reasoning.reasoningId)
            add_relation(incident_node, "incident", "has_reasoning_decision", reasoning_node, "reasoning_decision", source_symbol)
            add_relation(entity_name("Trace", reasoning.traceId), "trace", "has_reasoning_decision", reasoning_node, "reasoning_decision", source_symbol)
            add_relation(reasoning_node, "reasoning_decision", "uses_retrieval_mode", entity_name("RetrievalMode", reasoning.retrievalMode), "retrieval_mode", source_symbol)
            for candidate in reasoning.candidates:
                candidate_node = entity_name("Candidate", candidate.candidateId)
                predicate = "selected_candidate" if candidate.candidateId == reasoning.selectedCandidateId else "considered_candidate"
                add_relation(reasoning_node, "reasoning_decision", predicate, candidate_node, "reasoning_candidate", source_symbol, candidate.totalScore)
                add_relation(candidate_node, "reasoning_candidate", "policy_decision", entity_name("PolicyDecision", candidate.policyDecision), "policy_decision", source_symbol)
                if candidate.skillId:
                    add_relation(candidate_node, "reasoning_candidate", "uses_skill", entity_name("Skill", candidate.skillId), "skill", source_symbol)
                for rule_code in candidate.ruleCodes:
                    add_relation(candidate_node, "reasoning_candidate", "evaluated_by_rule", entity_name("Rule", rule_code), "symbolic_rule", source_symbol)

        for receipt in request.receipts:
            receipt_node = entity_name("AuditReceipt", receipt.receiptId)
            add_relation(incident_node, "incident", "has_audit_receipt", receipt_node, "audit_receipt")
            add_relation(receipt_node, "audit_receipt", "records_actor", entity_name("Actor", receipt.actorId), "actor")
            add_relation(receipt_node, "audit_receipt", "records_outcome", entity_name("Outcome", receipt.outcome), "outcome")

        if request.retrospective is not None:
            source_symbol = f"{prefix}retrospective"
            add_relation(
                incident_node,
                "incident",
                "crystallized_as_skill",
                entity_name("Skill", request.retrospective.name),
                "skill",
                source_symbol,
            )

        return list(entities.values()), facts


def projection_prefix(workspace_id: str, incident_id: str) -> str:
    """生成不可注入的固定来源前缀；输入 Workspace 和 Incident ID，返回短哈希标识。"""

    workspace_hash = hashlib.sha256(workspace_id.encode("utf-8")).hexdigest()[:12]
    incident_hash = hashlib.sha256(incident_id.encode("utf-8")).hexdigest()[:12]
    return f"goai-comp-w{workspace_hash}-i{incident_hash}-"


def stable_suffix(value: str) -> str:
    """压缩外部记录 ID；输入稳定文本，返回固定长度哈希后缀。"""

    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def entity_name(kind: str, value: str) -> str:
    """生成可检索实体名称；输入实体类型和值，返回不含歧义的限定名称。"""

    return f"{kind}:{value}"


def parse_timestamp(value: str) -> float:
    """解析 ISO 时间；输入受约束字符串，返回 Unix 秒，格式无效时返回零。"""

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError, OverflowError):
        return 0.0


def decision_operator(stage: str) -> str:
    """映射协同阶段到认知算子；输入阶段，返回稳定算子。"""

    return {
        "INVESTIGATION_PLAN": "PlanDecompose",
        "INVESTIGATION_CONCLUSION": "CausalInfer",
        "VERIFICATION_CONCLUSION": "ValidateOutput",
    }.get(stage, "MetaCognize")


def platform_name(platform: str) -> str:
    """映射平台标识到产品名；输入短标识，返回 SynapXnet 产品名称。"""

    return {
        "aiops": "XnetAIOps",
        "dataops": "XnetDataOps",
        "mlops": "XnetMLOps",
    }.get(platform.casefold(), platform)


def unique_text(values: List[str], limit: int) -> List[str]:
    """稳定去重文本；输入列表和上限，返回保持首现顺序的有界结果。"""

    output: List[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
        if len(output) >= limit:
            break
    return output


def competition_metadata(
    incident: ProjectionIncident,
    record_type: str,
    *,
    trace_id: str = "",
    stage: str = "",
    decision: str = "",
    team_role: str = "",
    agent_name: str = "",
    skill_name: str = "",
    skill_version: str = "",
    confidence: float = 0.0,
) -> Dict[str, Any]:
    """构建公开符号元数据；输入事件和决策字段，返回不含凭据与原始证据的固定字典。"""

    return {
        "sourceType": "competition",
        "recordType": record_type,
        "workspaceId": incident.workspaceId,
        "incidentId": incident.incidentId,
        "traceId": trace_id,
        "stage": stage,
        "decision": decision,
        "teamRole": team_role,
        "agentName": agent_name,
        "skillName": skill_name,
        "skillVersion": skill_version,
        "confidence": max(0.0, min(1.0, confidence)),
    }
