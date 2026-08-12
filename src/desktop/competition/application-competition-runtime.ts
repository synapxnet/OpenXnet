import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseCreateApplicationCompetitionIncidentRequest,
  parseDecideApplicationCompetitionApprovalRequest,
  parseExecuteApplicationCompetitionRollbackRequest,
  parseExportApplicationCompetitionRetrospectiveRequest,
  parseReadApplicationCompetitionResourceRequest,
  parseResetApplicationCompetitionDemoDataRequest,
  parseRunApplicationCompetitionInvestigationRequest,
  parseSetApplicationCompetitionAdapterModeRequest,
  parseVerifyApplicationCompetitionRemediationRequest,
  type ApplicationCompetitionAdapterMode,
  type ApplicationCompetitionAgentDecision,
  type ApplicationCompetitionAgentRoleSnapshot,
  type ApplicationCompetitionAgentTeamBinding,
  type ApplicationCompetitionApproval,
  type ApplicationCompetitionAuditReceipt,
  type ApplicationCompetitionDeploymentAction,
  type ApplicationCompetitionEvidence,
  type ApplicationCompetitionExecutionStep,
  type ApplicationCompetitionIncident,
  type ApplicationCompetitionMutationResult,
  type ApplicationCompetitionResourceResult,
  type ApplicationCompetitionSnapshot,
  type ApplicationCompetitionToolInvocation,
  type ApplicationCompetitionTrace,
  type ExecuteApplicationCompetitionRollbackRequest,
} from "../contracts/application-competition-runtime";
import type { ApplicationEnterpriseResolvedTeamTemplate } from "../contracts/application-enterprise-runtime";
import {
  APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA,
  type ApplicationCompetitionKnowledgeProjectionRequest,
  type ApplicationCompetitionKnowledgePurgeRequest,
} from "../contracts/application-competition-knowledge";
import type {
  CompetitionAgentTeamsPlanReference,
  CompetitionAgentTeamsTaskInput,
  CompetitionAgentTeamsTaskResult,
} from "./competition-agentteams-adapter";
import type {
  CompetitionToolAdapter,
  CompetitionToolAdapterRequest,
  CompetitionToolAdapterResponse,
  CompetitionToolGovernance,
} from "./competition-tool-adapter";
import { CompetitionStore } from "./competition-store";
import {
  getCompetitionScenarioProfile,
  type CompetitionScenarioExecutionStep,
} from "./competition-scenario-registry";
import {
  getCompetitionToolDescriptor,
  parseCompetitionToolArguments,
  type CompetitionToolName,
} from "./competition-tool-registry";

const COMPETITION_AGENT_SKILLS = Object.freeze({
  evidence: Object.freeze({ name: "goai-evidence-collect", version: "1.1.0" }),
  change: Object.freeze({ name: "goai-change-execute", version: "1.1.0" }),
  verification: Object.freeze({ name: "goai-service-verify", version: "1.1.0" }),
});

/** 将 AgentTeams 客户端异常转换为不含 URL、请求体和凭据的诊断；输入未知错误，返回固定安全原因。 */
function describeAgentTeamsDispatchFailure(error: unknown): string {
  if (!(error instanceof Error)) return "未分类客户端错误";
  if (error.name === "AbortError") return "任务请求超时";
  const message = error.message.trim();
  const fixedMessages = new Set([
    "AgentTeams binding is not ready for task dispatch.",
    "AgentTeams delegation token is not configured.",
    "AgentTeams task response is too large.",
    "AgentTeams task response is invalid.",
    "AgentTeams task response scope is invalid.",
    "AgentTeams task result exceeded its authorized context.",
    "AgentTeams Leader route is invalid.",
    "AgentTeams isolated endpoint is not allowed.",
    "fetch failed",
  ]);
  if (fixedMessages.has(message)) return message;
  const httpStatus = /^AgentTeams isolated service rejected the task with HTTP ([1-5][0-9]{2})\.$/u.exec(message);
  return httpStatus === null ? "未分类客户端错误" : `隔离服务返回 HTTP ${httpStatus[1]}`;
}

/** Renderer 可安全显示的竞赛 Runtime 错误。 */
export class ApplicationCompetitionRuntimeError extends Error {
  /** 创建固定领域错误；输入错误码、文案和重试标记，无外部副作用。 */
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ApplicationCompetitionRuntimeError";
  }
}

/** Agent Team 插件准备结果。 */
export interface ApplicationCompetitionTeamPreparationResult {
  readonly teamName: string;
  readonly status: "READY" | "DEGRADED";
}

/** 竞赛执行链向通用企业群聊投影的治理事件类型。 */
export type ApplicationCompetitionOperationConversationEventType =
  | "APPROVAL_REQUESTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "REHEARSAL_SUCCEEDED"
  | "ACTION_EXECUTING"
  | "ACTION_STEP_SUCCEEDED"
  | "COMPENSATION_EXECUTING"
  | "COMPENSATION_SUCCEEDED"
  | "VERIFICATION_SUCCEEDED"
  | "VERIFICATION_FAILED";

/** 竞赛适配层提供给通用企业群聊的最小操作投影。 */
export interface ApplicationCompetitionOperationConversationEvent {
  readonly eventType: ApplicationCompetitionOperationConversationEventType;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly operationId: string;
  readonly approvalId: string | null;
  readonly actionId: string | null;
  readonly toolName: string;
  readonly targetResource: string;
  readonly evidenceIds: readonly string[];
  readonly summary: string;
}

/** 竞赛 Runtime 的依赖。 */
export interface ApplicationCompetitionRuntimeServiceOptions {
  readonly userDataDirectory: string;
  readonly fixtureAdapter: CompetitionToolAdapter;
  readonly liveAdapter: CompetitionToolAdapter;
  readonly store?: CompetitionStore;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly publishApproval?: (approval: ApplicationCompetitionApproval) => Promise<void>;
  readonly prepareAgentTeam?: (
    incident: ApplicationCompetitionIncident,
    traceId: string,
    teamTemplate: ApplicationEnterpriseResolvedTeamTemplate,
  ) => Promise<ApplicationCompetitionTeamPreparationResult>;
  readonly dispatchAgentTeamTask?: (input: CompetitionAgentTeamsTaskInput) => Promise<CompetitionAgentTeamsTaskResult>;
  readonly recordAgentTeamConversation?: (
    input: CompetitionAgentTeamsTaskInput,
    task: CompetitionAgentTeamsTaskResult,
  ) => Promise<void>;
  readonly recordOperationConversation?: (
    event: ApplicationCompetitionOperationConversationEvent,
  ) => Promise<void>;
  readonly resolveTeamTemplate?: (teamTemplateId: string) => Promise<ApplicationEnterpriseResolvedTeamTemplate>;
  readonly agentTeamsIsolatedServiceEnabled?: boolean;
  readonly synchronizeKnowledge?: (request: ApplicationCompetitionKnowledgeProjectionRequest) => Promise<unknown>;
  readonly purgeKnowledge?: (request: ApplicationCompetitionKnowledgePurgeRequest) => Promise<unknown>;
  readonly publishRetrospectiveSkill?: (
    request: ApplicationCompetitionRetrospectiveSkillPublicationRequest,
  ) => Promise<ApplicationCompetitionRetrospectiveSkillPublicationResult>;
  readonly logger?: { warn(message: string): void };
}

/** 复盘 Skill 发布到 OpenXnet 技能目录和企业空间所需的有界字段。 */
export interface ApplicationCompetitionRetrospectiveSkillPublicationRequest {
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly skillId: string;
  readonly name: string;
  readonly description: string;
  readonly triggerContext: string;
  readonly workflow: string;
  readonly notes: string;
  readonly requiredCapabilities: readonly string[];
  readonly verification: readonly string[];
  readonly rollback: string;
  readonly sourceEventIds: readonly string[];
  readonly familyId: string;
  readonly problemFingerprint: string;
  readonly evidenceOrigin: "rehearsal";
  readonly derivationMethod: "rehearsal_crystallization";
  readonly environmentScope: "simulation" | "staging";
}

/** OpenXnet 技能目录完成发布后的最小结果。 */
export interface ApplicationCompetitionRetrospectiveSkillPublicationResult {
  readonly skillId: string;
}

/** 单次工具调用的内部结果。 */
interface RecordedToolResult {
  readonly response: CompetitionToolAdapterResponse;
  readonly invocationId: string;
  readonly evidenceId: string;
  readonly adapterRequest: CompetitionToolAdapterRequest;
}

/** 北向 MCP Gateway 使用的已认证工具请求。 */
export interface ApplicationCompetitionToolCallRequest {
  readonly workspaceId: string;
  readonly incidentId: string | null;
  readonly traceId: string | null;
  readonly actorId: string;
  readonly toolName: CompetitionToolName;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly governance: CompetitionToolGovernance | null;
}

/** 北向 MCP Gateway 使用的工具结果。 */
export interface ApplicationCompetitionToolCallResult {
  readonly incidentId: string;
  readonly traceId: string;
  readonly evidenceId: string | null;
  readonly actionId: string | null;
  readonly response: CompetitionToolAdapterResponse;
}

/** OpenXnet 竞赛事件、审批、Trace 和跨平台动作的唯一控制面。 */
export class ApplicationCompetitionRuntimeService {
  private readonly store: CompetitionStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly retrospectiveRoot: string;
  private readonly logger: { warn(message: string): void };

  /** 创建竞赛控制面；输入 Store、Fixture/Live Adapter 和可选 Agent Team 插件，不提前访问平台。 */
  public constructor(private readonly options: ApplicationCompetitionRuntimeServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.store = options.store ?? new CompetitionStore({
      userDataDirectory: options.userDataDirectory,
      now: this.now,
    });
    this.retrospectiveRoot = path.join(options.userDataDirectory, "competition", "retrospectives");
    this.logger = options.logger ?? console;
  }

  /** 读取完整竞赛快照；无输入，返回 Store 安全副本并有界修复历史知识投影，不访问三平台。 */
  public async getSnapshot(): Promise<ApplicationCompetitionSnapshot> {
    const snapshot = await this.store.read();
    const incidents = snapshot.incidents.slice(-3);
    const synchronizations: Promise<void>[] = [];
    for (const incident of incidents) {
      synchronizations.push(this.synchronizeIncidentKnowledge(snapshot, incident.incidentId));
    }
    await Promise.all(synchronizations);
    return snapshot;
  }

  /** 重置竞赛演示控制面；输入固定确认标记，清除事件链路但保留已导出的复盘 Skill。 */
  public async resetDemoData(value: unknown): Promise<ApplicationCompetitionSnapshot> {
    parseResetApplicationCompetitionDemoDataRequest(value);
    const current = await this.store.read();
    await this.options.fixtureAdapter.resetDemoState?.();
    if (this.options.purgeKnowledge !== undefined && current.incidents.length > 0) {
      try {
        await this.options.purgeKnowledge({
          schema: APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA,
          projections: current.incidents.map((incident) => ({
            workspaceId: incident.workspaceId,
            incidentId: incident.incidentId,
          })),
        });
      } catch {
        throw new ApplicationCompetitionRuntimeError(
          "KNOWLEDGE_PROJECTION_UNAVAILABLE",
          "比赛知识投影清理失败，演示数据尚未重置，请重试。",
          true,
        );
      }
    }
    return this.store.reset();
  }

  /** 执行已认证的北向工具调用；输入 Workspace 上下文和固定工具，返回写入 Trace 后的结构化结果。 */
  public async callTool(
    request: ApplicationCompetitionToolCallRequest,
  ): Promise<ApplicationCompetitionToolCallResult> {
    const descriptor = getCompetitionToolDescriptor(request.toolName);
    const argumentsValue = parseCompetitionToolArguments(descriptor, request.arguments);
    if (descriptor.requiresApproval && (request.incidentId === null || request.traceId === null)) {
      throw new ApplicationCompetitionRuntimeError(
        "APPROVAL_SCOPE_MISMATCH",
        "MCP 高风险写操作必须显式引用已有 Incident 和 Trace。",
      );
    }
    const context = await this.ensureGatewayContext(request, argumentsValue);
    if (descriptor.requiresApproval) {
      if (request.governance === null) {
        throw new ApplicationCompetitionRuntimeError("APPROVAL_REQUIRED", "MCP 高风险处置请求缺少治理字段。");
      }
      const approval = requireApproval(await this.store.read(), request.governance.approvalId);
      if (
        approval.incidentId !== context.incident.incidentId
        || approval.traceId !== context.traceId
        || approval.toolName !== request.toolName
      ) {
        throw new ApplicationCompetitionRuntimeError("APPROVAL_SCOPE_MISMATCH", "MCP 处置审批不属于当前 Incident/Trace。");
      }
      if (request.governance.expectedResourceVersion !== approval.expectedResourceVersion) {
        throw new ApplicationCompetitionRuntimeError("RESOURCE_VERSION_CONFLICT", "MCP 治理字段中的资源版本与审批不一致。");
      }
      if (digestJson(argumentsValue) !== approval.argumentsDigest) {
        throw new ApplicationCompetitionRuntimeError("APPROVAL_SCOPE_MISMATCH", "MCP 处置参数与审批范围不一致。");
      }
      const mutation = await this.executeRollback({
        approvalId: request.governance.approvalId,
        actorId: request.actorId,
        idempotencyKey: request.governance.idempotencyKey,
        dryRun: request.governance.dryRun,
      });
      const action = mutation.actionId === null
        ? null
        : mutation.snapshot.actions.find((item) => item.actionId === mutation.actionId) ?? null;
      const data = action === null
        ? { dryRun: true, approvalId: approval.approvalId }
        : {
            actionId: action.actionId,
            status: action.status,
            stage: action.stage,
            actionResourceUri: `openxnet://workspaces/${action.workspaceId}/actions/${action.actionId}`,
          };
      return {
        incidentId: context.incident.incidentId,
        traceId: context.traceId,
        evidenceId: null,
        actionId: action?.actionId ?? null,
        response: {
          success: true,
          data,
          error: null,
          meta: {
            requestId: this.id("req"),
            workspaceId: context.incident.workspaceId,
            incidentId: context.incident.incidentId,
            traceId: context.traceId,
            toolName: request.toolName,
            contractVersion: "1.0.0",
            durationMs: 0,
            source: "OpenXnetDesktop/orchestrator",
            platform: "mlops",
            resourceVersion: request.governance.dryRun
              ? approval.expectedResourceVersion
              : String(approval.targetRevision),
            observedAt: this.now().toISOString(),
            summary: request.governance.dryRun ? "处置预检通过。" : "处置动作已受理。",
          },
        },
      };
    }
    const recorded = await this.invokeAndRecord({
      incident: context.incident,
      traceId: context.traceId,
      actorId: request.actorId,
      toolName: request.toolName,
      arguments: argumentsValue,
      governance: null,
    });
    await this.synchronizeIncidentKnowledge(await this.store.read(), context.incident.incidentId);
    return {
      incidentId: context.incident.incidentId,
      traceId: context.traceId,
      evidenceId: recorded.evidenceId,
      actionId: null,
      response: recorded.response,
    };
  }

  /** 创建待调查事件；输入未知 Renderer 请求，返回新事件和最新快照。 */
  public async createIncident(value: unknown): Promise<ApplicationCompetitionMutationResult> {
    const request = parseCreateApplicationCompetitionIncidentRequest(value);
    const timestamp = this.now().toISOString();
    const incidentId = this.id("inc");
    const incident: ApplicationCompetitionIncident = {
      incidentId,
      workspaceId: request.workspaceId,
      title: request.title,
      summary: request.summary,
      severity: request.severity,
      status: "OPEN",
      scenario: request.scenario,
      activeTraceId: null,
      activeApprovalId: null,
      activeActionId: null,
      createdBy: request.actorId,
      createdAt: timestamp,
      updatedAt: timestamp,
      resolvedAt: null,
    };
    const snapshot = await this.store.update((current) => ({
      ...current,
      incidents: [...current.incidents, incident],
      updatedAt: timestamp,
    }));
    await this.synchronizeIncidentKnowledge(snapshot, incidentId);
    return this.mutationResult(snapshot, incidentId);
  }

  /** 执行跨 AIOps、DataOps 和 MLOps 取证；输入事件、操作者和 Team Runtime，返回待审批状态。 */
  public async runInvestigation(value: unknown): Promise<ApplicationCompetitionMutationResult> {
    const request = parseRunApplicationCompetitionInvestigationRequest(value);
    const current = await this.store.read();
    const incident = requireIncident(current, request.incidentId);
    if (!["OPEN", "FAILED"].includes(incident.status)) {
      throw new ApplicationCompetitionRuntimeError("INCIDENT_STATE_INVALID", "当前事件状态不能重新开始取证。");
    }
    const timestamp = this.now().toISOString();
    const traceId = this.id("trace");
    const trace: ApplicationCompetitionTrace = {
      traceId,
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      status: "RUNNING",
      invocationIds: [],
      startedAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    const binding = await this.prepareTeamBinding(
      incident,
      traceId,
      request.teamRuntime,
      request.teamTemplateId,
      timestamp,
    );
    await this.store.update((snapshot) => ({
      ...snapshot,
      incidents: replaceIncident(snapshot.incidents, incident.incidentId, {
        ...incident,
        status: "INVESTIGATING",
        activeTraceId: traceId,
        activeApprovalId: null,
        activeActionId: null,
        updatedAt: timestamp,
        resolvedAt: null,
      }),
      traces: [...snapshot.traces, trace],
      teamBindings: [...snapshot.teamBindings, binding],
      updatedAt: timestamp,
    }));

    try {
      const availableCalls = this.investigationCalls(incident);
      let selectedCalls = availableCalls;
      let evidenceActorId = request.actorId;
      if (request.teamRuntime === "agentteams") {
        this.assertAgentTeamReady(binding);
        const plan = await this.dispatchAgentTask({
          incident,
          traceId,
          binding,
          stage: "INVESTIGATION_PLAN",
          skill: COMPETITION_AGENT_SKILLS.evidence,
          availableToolNames: availableCalls.map((item) => item.toolName),
          evidence: [],
          proposedPlan: null,
          action: null,
        });
        await this.recordAgentDecision(incident, binding, plan);
        selectedCalls = this.selectAgentInvestigationCalls(availableCalls, plan);
        evidenceActorId = this.agentActorId(plan.result.roleCardId);
      }
      const recordedEvidence = await Promise.all(selectedCalls.map(({ toolName, arguments: argumentsValue }) =>
        this.invokeAndRecord({
          incident,
          traceId,
          actorId: evidenceActorId,
          toolName,
          arguments: argumentsValue,
          governance: null,
        })));
      let approvalRequester = request.actorId;
      let approvalReason: string | undefined;
      if (request.teamRuntime === "agentteams") {
        const snapshot = await this.store.read();
        const evidenceIds = new Set(recordedEvidence.map((item) => item.evidenceId));
        const evidence = snapshot.evidence.filter((item) => evidenceIds.has(item.evidenceId));
        const profile = getCompetitionScenarioProfile(incident.scenario);
        const governedTools = [...new Set([
          ...profile.executionPlan.steps,
          ...profile.executionPlan.compensationSteps,
        ].filter((step) => step.kind === "WRITE").map((step) => step.toolName))];
        const proposedApproval = this.createRemediationApproval(incident, traceId, request.actorId);
        const conclusion = await this.dispatchAgentTask({
          incident,
          traceId,
          binding,
          stage: "INVESTIGATION_CONCLUSION",
          skill: COMPETITION_AGENT_SKILLS.change,
          availableToolNames: governedTools,
          evidence,
          proposedPlan: this.createAgentTeamsPlanReference(incident, proposedApproval.planDigest),
          action: null,
        });
        await this.recordAgentDecision(incident, binding, conclusion);
        if (conclusion.result.decision !== "REQUEST_APPROVAL") {
          throw new ApplicationCompetitionRuntimeError("AGENT_DECISION_HALTED", "AgentTeams Leader 未授权创建处置审批。", true);
        }
        approvalRequester = this.agentActorId(conclusion.result.roleCardId);
        approvalReason = conclusion.result.summary;
      }
      const approval = this.createRemediationApproval(incident, traceId, approvalRequester, approvalReason);
      const completedAt = this.now().toISOString();
      const snapshot = await this.store.update((state) => ({
        ...state,
        incidents: replaceIncident(state.incidents, incident.incidentId, {
          ...requireIncident(state, incident.incidentId),
          status: "AWAITING_APPROVAL",
          activeApprovalId: approval.approvalId,
          updatedAt: completedAt,
        }),
        traces: replaceTrace(state.traces, traceId, {
          ...requireTrace(state, traceId),
          status: "AWAITING_APPROVAL",
          updatedAt: completedAt,
        }),
        approvals: [...state.approvals, approval],
        updatedAt: completedAt,
      }));
      await this.projectOperationConversation({
        eventType: "APPROVAL_REQUESTED",
        workspaceId: incident.workspaceId,
        incidentId: incident.incidentId,
        traceId,
        actorId: approval.requestedBy,
        operationId: approval.approvalId,
        approvalId: approval.approvalId,
        actionId: null,
        toolName: approval.toolName,
        targetResource: approval.resourceId,
        evidenceIds: recordedEvidence.map((item) => item.evidenceId),
        summary: approval.reason,
      });
      await this.synchronizeIncidentKnowledge(snapshot, incident.incidentId);
      return this.mutationResult(snapshot, incident.incidentId);
    } catch (error) {
      await this.markTraceFailed(incident.incidentId, traceId);
      await this.synchronizeIncidentKnowledge(await this.store.read(), incident.incidentId);
      throw error;
    }
  }

  /** 提交人工审批决策；输入审批、决策人和原因，返回职责分离后的最新状态。 */
  public async decideApproval(value: unknown): Promise<ApplicationCompetitionMutationResult> {
    const request = parseDecideApplicationCompetitionApprovalRequest(value);
    const timestamp = this.now().toISOString();
    const snapshot = await this.store.update((current) => {
      const approval = requireApproval(current, request.approvalId);
      if (approval.status !== "PENDING") {
        throw new ApplicationCompetitionRuntimeError("APPROVAL_STATE_INVALID", "该审批已经完成决策。");
      }
      if (approval.requestedBy === request.actorId) {
        throw new ApplicationCompetitionRuntimeError("SEPARATION_OF_DUTIES_REQUIRED", "审批人不能是审批申请人。");
      }
      const incident = requireIncident(current, approval.incidentId);
      const nextApproval: ApplicationCompetitionApproval = {
        ...approval,
        status: request.decision,
        decidedBy: request.actorId,
        decidedAt: timestamp,
        decisionReason: request.reason,
      };
      return {
        ...current,
        approvals: replaceApproval(current.approvals, approval.approvalId, nextApproval),
        incidents: replaceIncident(current.incidents, incident.incidentId, {
          ...incident,
          status: request.decision === "APPROVED" ? "AWAITING_APPROVAL" : "FAILED",
          updatedAt: timestamp,
        }),
        updatedAt: timestamp,
      };
    });
    const approval = requireApproval(snapshot, request.approvalId);
    await this.projectOperationConversation({
      eventType: approval.status === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      workspaceId: approval.workspaceId,
      incidentId: approval.incidentId,
      traceId: approval.traceId,
      actorId: approval.decidedBy ?? request.actorId,
      operationId: approval.approvalId,
      approvalId: approval.approvalId,
      actionId: null,
      toolName: approval.toolName,
      targetResource: approval.resourceId,
      evidenceIds: [],
      summary: approval.decisionReason ?? request.reason,
    });
    await this.synchronizeIncidentKnowledge(snapshot, approval.incidentId);
    return this.mutationResult(snapshot, approval.incidentId);
  }

  /** 执行审批后的场景处置；输入审批、执行人、幂等键和 dry-run，返回动作及审计回执。 */
  public async executeRollback(value: unknown): Promise<ApplicationCompetitionMutationResult> {
    const request = parseExecuteApplicationCompetitionRollbackRequest(value);
    const before = await this.store.read();
    const approval = requireApproval(before, request.approvalId);
    const incident = requireIncident(before, approval.incidentId);
    this.assertRemediationAuthorized(before, request, approval, incident);
    const existing = before.actions.find((action) => action.idempotencyKey === request.idempotencyKey);
    if (existing !== undefined) return this.handleExistingIdempotentAction(before, existing, request);
    const profile = getCompetitionScenarioProfile(incident.scenario);
    this.assertApprovalPlanMatches(approval, profile.executionPlan.steps, profile.executionPlan.compensationSteps);
    if (before.adapterMode === "live") {
      if (this.options.publishApproval === undefined) {
        throw new ApplicationCompetitionRuntimeError("UPSTREAM_UNAVAILABLE", "审批发布服务未配置，处置已拒绝。", true);
      }
      try {
        await this.options.publishApproval(approval);
      } catch {
        throw new ApplicationCompetitionRuntimeError("UPSTREAM_UNAVAILABLE", "审批发布失败，处置已拒绝。", true);
      }
    }
    if (request.dryRun) {
      const rehearsalEvidenceIds: string[] = [];
      for (const step of profile.executionPlan.steps.filter((item) => item.kind === "WRITE")) {
        const recorded = await this.invokeAndRecord({
          incident,
          traceId: approval.traceId,
          actorId: request.actorId,
          toolName: step.toolName,
          arguments: step.arguments,
          governance: this.stepGovernance(approval, request, step, true),
        });
        rehearsalEvidenceIds.push(recorded.evidenceId);
      }
      const snapshot = await this.store.read();
      await this.projectOperationConversation({
        eventType: "REHEARSAL_SUCCEEDED",
        workspaceId: incident.workspaceId,
        incidentId: incident.incidentId,
        traceId: approval.traceId,
        actorId: request.actorId,
        operationId: `${approval.approvalId}:rehearsal`,
        approvalId: approval.approvalId,
        actionId: null,
        toolName: "openxnet.scenario.plan.rehearse",
        targetResource: profile.executionPlan.planId,
        evidenceIds: rehearsalEvidenceIds,
        summary: `完整计划 ${profile.executionPlan.title} 的 ${rehearsalEvidenceIds.length} 个写步骤预检通过，未写入目标资源。`,
      });
      await this.synchronizeIncidentKnowledge(snapshot, incident.incidentId);
      return this.mutationResult(snapshot, incident.incidentId);
    }
    const timestamp = this.now().toISOString();
    const actionId = this.id("action");
    const steps = profile.executionPlan.steps.map((step, index) => this.createExecutionStep(step, index + 1));
    const compensationSteps = profile.executionPlan.compensationSteps
      .map((step, index) => this.createExecutionStep(step, index + 1));
    const action: ApplicationCompetitionDeploymentAction = {
      actionId,
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      traceId: approval.traceId,
      approvalId: approval.approvalId,
      toolName: approval.toolName,
      resourceId: approval.resourceId,
      planId: profile.executionPlan.planId,
      planTitle: profile.executionPlan.title,
      planDigest: approval.planDigest,
      deploymentUid: incident.scenario.deploymentUid,
      fromRevision: incident.scenario.failingRevision,
      targetRevision: incident.scenario.targetRevision,
      idempotencyKey: request.idempotencyKey,
      status: "RUNNING",
      stage: "EXECUTING",
      executedBy: request.actorId,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      steps,
      compensationSteps,
      compensationStatus: "NOT_REQUIRED",
      verificationEvidenceIds: [],
      errorCode: null,
    };
    await this.store.update((current) => ({
      ...current,
      incidents: replaceIncident(current.incidents, incident.incidentId, {
        ...requireIncident(current, incident.incidentId),
        status: "MITIGATING",
        activeActionId: actionId,
        updatedAt: timestamp,
      }),
      actions: [...current.actions, action],
      updatedAt: timestamp,
    }));
    await this.projectOperationConversation({
      eventType: "ACTION_EXECUTING",
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      traceId: approval.traceId,
      actorId: request.actorId,
      operationId: action.actionId,
      approvalId: approval.approvalId,
      actionId: action.actionId,
      toolName: "openxnet.scenario.plan.execute",
      targetResource: action.planId,
      evidenceIds: [],
      summary: `审批范围内的完整处置计划已启动，共 ${steps.length} 个执行步骤。`,
    });
    try {
      for (const step of profile.executionPlan.steps) {
        await this.executePlanStep({
          mode: before.adapterMode,
          incident,
          approval,
          actionId,
          actorId: request.actorId,
          baseIdempotencyKey: request.idempotencyKey,
          step,
          compensation: false,
        });
      }
      const completed = await this.store.read();
      await this.synchronizeIncidentKnowledge(completed, incident.incidentId);
      return this.mutationResult(completed, incident.incidentId);
    } catch (error) {
      await this.runCompensationPlan({
        mode: before.adapterMode,
        incident,
        approval,
        actionId,
        actorId: request.actorId,
        baseIdempotencyKey: request.idempotencyKey,
        steps: profile.executionPlan.compensationSteps,
      });
      await this.markActionFailed(actionId, incident.incidentId, approval.traceId, error);
      await this.synchronizeIncidentKnowledge(await this.store.read(), incident.incidentId);
      throw error;
    }
  }

  /** 通过场景专属只读证据独立验证处置；输入动作与验证人，返回最终事件状态。 */
  public async verifyRemediation(value: unknown): Promise<ApplicationCompetitionMutationResult> {
    const request = parseVerifyApplicationCompetitionRemediationRequest(value);
    const before = await this.store.read();
    const action = requireAction(before, request.actionId);
    const incident = requireIncident(before, action.incidentId);
    if (action.status !== "RUNNING" || !["ROLLING_BACK", "EXECUTING"].includes(action.stage)) {
      throw new ApplicationCompetitionRuntimeError("ACTION_STATE_INVALID", "当前动作状态不能开始独立验证。");
    }
    if (action.executedBy === request.actorId) {
      throw new ApplicationCompetitionRuntimeError("SEPARATION_OF_DUTIES_REQUIRED", "独立验证人不能是处置执行人。");
    }
    const binding = [...before.teamBindings].reverse().find((item) => (
      item.incidentId === incident.incidentId && item.traceId === action.traceId
    ));
    if (binding?.runtime === "agentteams") this.assertAgentTeamReady(binding);
    const verifier = binding?.runtime === "agentteams"
      ? binding.memberSnapshots.find((item) => item.teamRole === "verifier")
      : undefined;
    if (binding?.runtime === "agentteams" && verifier === undefined) {
      throw new ApplicationCompetitionRuntimeError("AGENTTEAMS_ROLE_INVALID", "AgentTeams Binding 缺少独立 Verifier。", true);
    }
    const verificationActorId = verifier === undefined ? request.actorId : this.agentActorId(verifier.roleCardId);
    const startedAt = this.now().toISOString();
    await this.store.update((current) => ({
      ...current,
      incidents: replaceIncident(current.incidents, incident.incidentId, {
        ...requireIncident(current, incident.incidentId),
        status: "VERIFYING",
        updatedAt: startedAt,
      }),
      traces: replaceTrace(current.traces, action.traceId, {
        ...requireTrace(current, action.traceId),
        status: "VERIFYING",
        updatedAt: startedAt,
      }),
      actions: replaceAction(current.actions, action.actionId, {
        ...action,
        stage: "VERIFYING",
        updatedAt: startedAt,
      }),
      updatedAt: startedAt,
    }));
    try {
      const results = await Promise.all(this.verificationCalls(incident).map(({ toolName, arguments: argumentsValue }) =>
        this.invokeAndRecord({
          incident,
          traceId: action.traceId,
          actorId: verificationActorId,
          toolName,
          arguments: argumentsValue,
          governance: null,
        })));
      const verificationEvidenceIds = results.map((result) => result.evidenceId);
      await this.store.update((current) => ({
        ...current,
        actions: replaceAction(current.actions, action.actionId, {
          ...requireAction(current, action.actionId),
          verificationEvidenceIds,
          updatedAt: this.now().toISOString(),
        }),
        updatedAt: this.now().toISOString(),
      }));
      let objectiveFailure: ApplicationCompetitionRuntimeError | null = null;
      try {
        this.assertVerificationPassed(results, incident);
      } catch (error) {
        objectiveFailure = normalizeRuntimeError(error);
      }
      if (binding?.runtime === "agentteams") {
        const snapshot = await this.store.read();
        const evidenceIds = new Set(results.map((item) => item.evidenceId));
        const evidence = snapshot.evidence.filter((item) => evidenceIds.has(item.evidenceId));
        const receipt = before.auditReceipts.find((item) => (
          item.incidentId === incident.incidentId
          && item.traceId === action.traceId
          && item.toolName === action.toolName
          && item.approvalId === action.approvalId
        ));
        const conclusion = await this.dispatchAgentTask({
          incident,
          traceId: action.traceId,
          binding,
          stage: "VERIFICATION_CONCLUSION",
          skill: COMPETITION_AGENT_SKILLS.verification,
          availableToolNames: this.verificationCalls(incident).map((item) => item.toolName),
          evidence,
          proposedPlan: null,
          action: {
            actionId: action.actionId,
            planId: action.planId,
            planDigest: action.planDigest,
            toolName: action.toolName,
            resourceVersionAfter: [...action.steps].reverse().find((step) => step.status === "SUCCEEDED")
              ?.resourceVersionAfter || receipt?.resourceVersionAfter || String(action.targetRevision),
            completedStepCount: action.steps.filter((step) => step.status === "SUCCEEDED").length,
            compensationPlanReady: true,
            outcome: action.steps.every((step) => step.status === "SUCCEEDED") ? "SUCCEEDED" : "ACCEPTED",
          },
        });
        await this.recordAgentDecision(incident, binding, conclusion);
        if (conclusion.result.decision !== "CLOSE") {
          if (objectiveFailure !== null) throw objectiveFailure;
          throw new ApplicationCompetitionRuntimeError("AGENT_VERIFICATION_REJECTED", "AgentTeams Verifier 判定恢复未通过。", true);
        }
      }
      if (objectiveFailure !== null) throw objectiveFailure;
      const completedAt = this.now().toISOString();
      const evidenceIds = verificationEvidenceIds;
      const receipt = this.createAuditReceipt({
        requestId: this.id("req"),
        incident,
        traceId: action.traceId,
        toolName: "openxnet.remediation.verify",
        actorId: verificationActorId,
        approvalId: action.approvalId,
        idempotencyKey: `${action.idempotencyKey}:verify`,
        resourceVersionBefore: String(action.targetRevision),
        resourceVersionAfter: String(action.targetRevision),
        outcome: "SUCCEEDED",
      });
      const snapshot = await this.store.update((current) => ({
        ...current,
        incidents: replaceIncident(current.incidents, incident.incidentId, {
          ...requireIncident(current, incident.incidentId),
          status: "RESOLVED",
          updatedAt: completedAt,
          resolvedAt: completedAt,
        }),
        traces: replaceTrace(current.traces, action.traceId, {
          ...requireTrace(current, action.traceId),
          status: "SUCCEEDED",
          updatedAt: completedAt,
          completedAt,
        }),
        actions: replaceAction(current.actions, action.actionId, {
          ...requireAction(current, action.actionId),
          status: "SUCCEEDED",
          stage: "COMPLETED",
          updatedAt: completedAt,
          completedAt,
          verificationEvidenceIds: evidenceIds,
        }),
        auditReceipts: [...current.auditReceipts, receipt],
        updatedAt: completedAt,
      }));
      await this.projectOperationConversation({
        eventType: "VERIFICATION_SUCCEEDED",
        workspaceId: incident.workspaceId,
        incidentId: incident.incidentId,
        traceId: action.traceId,
        actorId: verificationActorId,
        operationId: action.actionId,
        approvalId: action.approvalId,
        actionId: action.actionId,
        toolName: action.toolName,
        targetResource: action.resourceId,
        evidenceIds,
        summary: "独立验证已经通过，业务与技术恢复阈值满足关闭条件。",
      });
      await this.synchronizeIncidentKnowledge(snapshot, incident.incidentId);
      return this.mutationResult(snapshot, incident.incidentId);
    } catch (error) {
      const approval = requireApproval(await this.store.read(), action.approvalId);
      const profile = getCompetitionScenarioProfile(incident.scenario);
      await this.runCompensationPlan({
        mode: before.adapterMode,
        incident,
        approval,
        actionId: action.actionId,
        actorId: action.executedBy,
        baseIdempotencyKey: `${action.idempotencyKey}:verification-failed`.slice(0, 128),
        steps: profile.executionPlan.compensationSteps,
      });
      await this.markActionFailed(action.actionId, incident.incidentId, action.traceId, error);
      await this.projectOperationConversation({
        eventType: "VERIFICATION_FAILED",
        workspaceId: incident.workspaceId,
        incidentId: incident.incidentId,
        traceId: action.traceId,
        actorId: request.actorId,
        operationId: action.actionId,
        approvalId: action.approvalId,
        actionId: action.actionId,
        toolName: action.toolName,
        targetResource: action.resourceId,
        evidenceIds: [],
        summary: "独立验证未通过，当前操作不能关闭并需要进入回滚或继续处置。",
      });
      await this.synchronizeIncidentKnowledge(await this.store.read(), incident.incidentId);
      throw error;
    }
  }

  /** 读取 Trace、Evidence、Action、Incident 或审计回执 Resource；输入 openxnet URI，返回 JSON 文本。 */
  public async readResource(value: unknown): Promise<ApplicationCompetitionResourceResult> {
    const request = parseReadApplicationCompetitionResourceRequest(value);
    const parsed = parseResourceUri(request.uri);
    const snapshot = await this.store.read();
    const record = findResourceRecord(snapshot, parsed.kind, parsed.resourceId);
    if (
      record === undefined
      || record.workspaceId !== parsed.workspaceId
      || (parsed.incidentId !== undefined && record.incidentId !== parsed.incidentId)
    ) {
      throw new ApplicationCompetitionRuntimeError("RESOURCE_NOT_FOUND", "竞赛资源不存在或不属于当前 Workspace。");
    }
    return {
      uri: request.uri,
      mimeType: "application/json",
      text: JSON.stringify(record, null, 2),
    };
  }

  /** 导出可复用复盘 Skill；输入事件 ID，写入 UTF-8 SKILL.md 并返回绝对路径。 */
  public async exportRetrospective(value: unknown): Promise<ApplicationCompetitionMutationResult> {
    const request = parseExportApplicationCompetitionRetrospectiveRequest(value);
    const snapshot = await this.store.read();
    const incident = requireIncident(snapshot, request.incidentId);
    if (incident.status !== "RESOLVED") {
      throw new ApplicationCompetitionRuntimeError("INCIDENT_NOT_RESOLVED", "只有已解决事件可以导出复盘 Skill。");
    }
    const directory = path.join(this.retrospectiveRoot, incident.incidentId);
    const destination = path.join(directory, "SKILL.md");
    const content = this.buildRetrospectiveSkill(snapshot, incident);
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, destination);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
    const exportedAt = this.now().toISOString();
    const publication = this.options.publishRetrospectiveSkill === undefined
      ? null
      : await this.options.publishRetrospectiveSkill(
        this.buildRetrospectiveSkillPublication(snapshot, incident),
      );
    await this.synchronizeIncidentKnowledge(snapshot, incident.incidentId, {
      name: publication?.skillId ?? `retrospective-${incident.incidentId}`,
      exportedAt,
    });
    return {
      ...this.mutationResult(snapshot, incident.incidentId),
      retrospectivePath: destination,
      retrospectiveSkillId: publication?.skillId ?? null,
    };
  }

  /** 切换 Fixture 或 Live Adapter；输入未知模式请求，持久化后返回最新快照。 */
  public async setAdapterMode(value: unknown): Promise<ApplicationCompetitionSnapshot> {
    const request = parseSetApplicationCompetitionAdapterModeRequest(value);
    const timestamp = this.now().toISOString();
    return this.store.update((current) => ({ ...current, adapterMode: request.mode, updatedAt: timestamp }));
  }

  /** 构建固定取证工具调用；输入事件，返回九个只读跨域请求。 */
  private investigationCalls(incident: ApplicationCompetitionIncident): readonly {
    toolName: CompetitionToolName;
    arguments: Readonly<Record<string, unknown>>;
  }[] {
    return getCompetitionScenarioProfile(incident.scenario).investigationCalls;
  }

  /** 确保 MCP 调用具有持久 Incident/Trace；输入请求和参数，返回经 Workspace 校验的上下文。 */
  private async ensureGatewayContext(
    request: ApplicationCompetitionToolCallRequest,
    argumentsValue: Readonly<Record<string, unknown>>,
  ): Promise<{ incident: ApplicationCompetitionIncident; traceId: string }> {
    let snapshot = await this.store.read();
    let incident = request.incidentId === null ? undefined : snapshot.incidents.find((item) => item.incidentId === request.incidentId);
    if (request.incidentId !== null && incident === undefined) {
      throw new ApplicationCompetitionRuntimeError("INCIDENT_NOT_FOUND", "MCP 请求引用的事件不存在。");
    }
    if (incident !== undefined && incident.workspaceId !== request.workspaceId) {
      throw new ApplicationCompetitionRuntimeError("WORKSPACE_ACCESS_DENIED", "MCP 请求不能访问其他 Workspace 的事件。");
    }
    if (incident === undefined) {
      const timestamp = this.now().toISOString();
      incident = this.createGatewayIncident(request, argumentsValue, timestamp);
      snapshot = await this.store.update((current) => ({
        ...current,
        incidents: [...current.incidents, incident as ApplicationCompetitionIncident],
        updatedAt: timestamp,
      }));
      incident = requireIncident(snapshot, incident.incidentId);
    }
    let trace = request.traceId === null ? undefined : snapshot.traces.find((item) => item.traceId === request.traceId);
    if (request.traceId !== null && trace === undefined) {
      throw new ApplicationCompetitionRuntimeError("TRACE_NOT_FOUND", "MCP 请求引用的 Trace 不存在。");
    }
    if (trace !== undefined && (trace.workspaceId !== request.workspaceId || trace.incidentId !== incident.incidentId)) {
      throw new ApplicationCompetitionRuntimeError("TRACE_SCOPE_MISMATCH", "MCP Trace 不属于当前 Workspace/Incident。");
    }
    if (trace === undefined) {
      const timestamp = this.now().toISOString();
      trace = {
        traceId: this.id("trace"),
        workspaceId: request.workspaceId,
        incidentId: incident.incidentId,
        status: "RUNNING",
        invocationIds: [],
        startedAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
      };
      const traceToPersist = trace;
      const incidentToPersist = incident;
      snapshot = await this.store.update((current) => ({
        ...current,
        incidents: replaceIncident(current.incidents, incidentToPersist.incidentId, {
          ...requireIncident(current, incidentToPersist.incidentId),
          activeTraceId: traceToPersist.traceId,
          updatedAt: timestamp,
        }),
        traces: [...current.traces, traceToPersist],
        updatedAt: timestamp,
      }));
      incident = requireIncident(snapshot, incident.incidentId);
    }
    return { incident, traceId: trace.traceId };
  }

  /** 创建无显式 Incident 的 MCP 调用事件；输入请求、参数和时间，返回有界默认场景。 */
  private createGatewayIncident(
    request: ApplicationCompetitionToolCallRequest,
    argumentsValue: Readonly<Record<string, unknown>>,
    timestamp: string,
  ): ApplicationCompetitionIncident {
    const deploymentUid = textArgument(argumentsValue.deploymentUid, "mcp-deployment");
    const targetRevision = integerArgument(argumentsValue.targetRevision, 1);
    const incidentId = this.id("inc");
    return {
      incidentId,
      workspaceId: request.workspaceId,
      title: `MCP 工具调用：${request.toolName}`,
      summary: "由北向 MCP Gateway 创建的受审计工具调用上下文。",
      severity: "P2",
      status: "OPEN",
      scenario: {
        scenarioType: "feature-drift",
        alertUid: textArgument(argumentsValue.alertUid ?? argumentsValue.alertId, "mcp-alert"),
        serviceUid: textArgument(argumentsValue.serviceUid, "mcp-service"),
        clusterId: textArgument(argumentsValue.clusterId, "mcp-cluster"),
        namespace: textArgument(argumentsValue.namespace, "default"),
        workloadName: textArgument(argumentsValue.name, "mcp-workload"),
        reportUid: textArgument(argumentsValue.reportUid, "mcp-report"),
        assetUid: textArgument(argumentsValue.assetUid, "mcp-asset"),
        workflowInstanceUid: textArgument(argumentsValue.instanceUid, "mcp-workflow"),
        deploymentUid,
        failingRevision: Math.max(targetRevision + 1, 2),
        targetRevision,
        expectedResourceVersion: String(Math.max(targetRevision + 1, 2)),
        testDatasetRef: textArgument(argumentsValue.testDatasetRef, "dataset://mcp-probe"),
      },
      activeTraceId: null,
      activeApprovalId: null,
      activeActionId: null,
      createdBy: request.actorId,
      createdAt: timestamp,
      updatedAt: timestamp,
      resolvedAt: null,
    };
  }

  /** 构建回滚后的独立验证调用；输入事件，返回探针、服务和工作负载三项验证。 */
  private verificationCalls(incident: ApplicationCompetitionIncident): readonly {
    toolName: CompetitionToolName;
    arguments: Readonly<Record<string, unknown>>;
  }[] {
    return getCompetitionScenarioProfile(incident.scenario).verificationCalls;
  }

  /** 调用当前 Adapter 并记录 invocation/evidence；输入调用上下文，返回响应和记录 ID。 */
  private async invokeAndRecord(input: {
    incident: ApplicationCompetitionIncident;
    traceId: string;
    actorId: string;
    toolName: CompetitionToolName;
    arguments: Readonly<Record<string, unknown>>;
    governance: CompetitionToolGovernance | null;
  }): Promise<RecordedToolResult> {
    const descriptor = getCompetitionToolDescriptor(input.toolName);
    const argumentsValue = parseCompetitionToolArguments(descriptor, input.arguments);
    const invocationId = this.id("invoke");
    const requestId = this.id("req");
    const startedAt = this.now().toISOString();
    const invocation: ApplicationCompetitionToolInvocation = {
      invocationId,
      requestId,
      workspaceId: input.incident.workspaceId,
      incidentId: input.incident.incidentId,
      traceId: input.traceId,
      actorId: input.actorId,
      toolName: input.toolName,
      platform: descriptor.platform,
      status: "RUNNING",
      argumentsDigest: digestJson(argumentsValue),
      evidenceId: null,
      actionId: null,
      errorCode: null,
      errorMessage: null,
      startedAt,
      completedAt: null,
    };
    await this.store.update((current) => ({
      ...current,
      invocations: [...current.invocations, invocation],
      traces: replaceTrace(current.traces, input.traceId, {
        ...requireTrace(current, input.traceId),
        invocationIds: [...requireTrace(current, input.traceId).invocationIds, invocationId],
        updatedAt: startedAt,
      }),
      updatedAt: startedAt,
    }));
    const adapterRequest: CompetitionToolAdapterRequest = {
      requestId,
      workspaceId: input.incident.workspaceId,
      incidentId: input.incident.incidentId,
      traceId: input.traceId,
      actorId: input.actorId,
      toolName: input.toolName,
      arguments: argumentsValue,
      governance: input.governance,
    };
    try {
      const mode = (await this.store.read()).adapterMode;
      const response = await this.adapterFor(mode).invoke(adapterRequest);
      if (!response.success) {
        throw new ApplicationCompetitionRuntimeError(
          response.error?.code ?? "TOOL_EXECUTION_FAILED",
          response.error?.message ?? "平台工具调用失败。",
          response.error?.retryable ?? false,
        );
      }
      if (response.data === null) {
        throw new ApplicationCompetitionRuntimeError("INTERNAL_ERROR", "平台成功响应缺少结构化数据。");
      }
      const evidenceId = response.meta.evidenceId ?? this.id("ev");
      const evidence: ApplicationCompetitionEvidence = {
        evidenceId,
        workspaceId: input.incident.workspaceId,
        incidentId: input.incident.incidentId,
        traceId: input.traceId,
        toolName: input.toolName,
        platform: descriptor.platform,
        summary: response.meta.summary,
        resourceVersion: response.meta.resourceVersion,
        observedAt: response.meta.observedAt,
        contentDigest: digestJson(response.data),
        data: cloneRecord(response.data, 2 * 1024 * 1024),
      };
      const completedAt = this.now().toISOString();
      await this.store.update((current) => ({
        ...current,
        invocations: replaceInvocation(current.invocations, invocationId, {
          ...requireInvocation(current, invocationId),
          status: "SUCCEEDED",
          evidenceId,
          completedAt,
        }),
        evidence: [...current.evidence, evidence],
        updatedAt: completedAt,
      }));
      return { response, invocationId, evidenceId, adapterRequest };
    } catch (error) {
      const normalized = normalizeRuntimeError(error);
      const completedAt = this.now().toISOString();
      await this.store.update((current) => ({
        ...current,
        invocations: replaceInvocation(current.invocations, invocationId, {
          ...requireInvocation(current, invocationId),
          status: "FAILED",
          errorCode: normalized.code,
          errorMessage: normalized.message,
          completedAt,
        }),
        updatedAt: completedAt,
      }));
      throw normalized;
    }
  }

  /** 返回当前持久模式对应 Adapter；输入模式，返回 Fixture 或 Live 实例。 */
  private adapterFor(mode: ApplicationCompetitionAdapterMode): CompetitionToolAdapter {
    return mode === "live" ? this.options.liveAdapter : this.options.fixtureAdapter;
  }

  /** 等待 Live 平台异步处置完成；输入模式和已受理响应，无返回，失败时阻止验证。 */
  private async waitForAcceptedAction(
    mode: ApplicationCompetitionAdapterMode,
    recorded: RecordedToolResult,
  ): Promise<void> {
    if (mode !== "live") return;
    const status = String(recorded.response.data?.status ?? "").toUpperCase();
    if (["SUCCEEDED", "COMPLETED", "APPLIED"].includes(status)) return;
    const actionId = recorded.response.data?.actionId;
    if (typeof actionId !== "string" || !actionId) {
      throw new ApplicationCompetitionRuntimeError("UPSTREAM_UNAVAILABLE", "Live 平台未返回完成状态或可轮询动作 ID。", true);
    }
    const adapter = this.adapterFor(mode);
    if (adapter.waitForAction === undefined) {
      throw new ApplicationCompetitionRuntimeError("UPSTREAM_UNAVAILABLE", "MLOps 动作状态轮询未配置。", true);
    }
    try {
      await adapter.waitForAction(recorded.adapterRequest, actionId);
    } catch {
      throw new ApplicationCompetitionRuntimeError("UPSTREAM_UNAVAILABLE", "Live 平台步骤未成功完成。", true);
    }
  }

  /** 断言 AgentTeams Binding 可真实驱动任务；输入 Binding，无返回，禁止静默降级。 */
  private assertAgentTeamReady(binding: ApplicationCompetitionAgentTeamBinding): void {
    if (
      binding.runtime !== "agentteams"
      || binding.status !== "READY"
      || this.options.agentTeamsIsolatedServiceEnabled !== true
      || this.options.dispatchAgentTeamTask === undefined
    ) {
      throw new ApplicationCompetitionRuntimeError(
        "AGENTTEAMS_TASK_UNAVAILABLE",
        "AgentTeams 团队或真实任务通道未就绪，已停止本次协同流程。",
        true,
      );
    }
  }

  /** 调用隔离 AgentTeams 任务通道；输入阶段上下文，返回经身份和阶段校验的结果。 */
  private async dispatchAgentTask(input: CompetitionAgentTeamsTaskInput): Promise<CompetitionAgentTeamsTaskResult> {
    this.assertAgentTeamReady(input.binding);
    try {
      const result = await this.options.dispatchAgentTeamTask?.(input);
      const member = result === undefined
        ? undefined
        : input.binding.memberSnapshots.find((item) => item.roleCardId === result.result.roleCardId);
      if (result === undefined || result.stage !== input.stage || member?.teamRole !== result.result.teamRole) {
        throw new Error("AgentTeams result scope is invalid.");
      }
      try {
        await this.options.recordAgentTeamConversation?.(input, result);
      } catch {
        this.logger.warn("AgentTeams enterprise conversation projection failed; the accepted task result remains unchanged.");
      }
      return result;
    } catch (error) {
      if (error instanceof ApplicationCompetitionRuntimeError) throw error;
      const diagnostic = describeAgentTeamsDispatchFailure(error);
      throw new ApplicationCompetitionRuntimeError(
        "AGENTTEAMS_TASK_FAILED",
        `AgentTeams 未返回符合契约的身份化结果：${diagnostic}。`,
        true,
      );
    }
  }

  /** 将治理事件投影到企业协作轨迹；输入结构化事件，无返回，投影失败不改变受控执行结果。 */
  private async projectOperationConversation(event: ApplicationCompetitionOperationConversationEvent): Promise<void> {
    try {
      await this.options.recordOperationConversation?.(event);
    } catch {
      this.logger.warn("Enterprise operation conversation projection failed; the governed result remains unchanged.");
    }
  }

  /** 把 AgentTeams 阶段结果写入统一 Trace；输入事件、Binding 和任务结果，返回持久记录。 */
  private async recordAgentDecision(
    incident: ApplicationCompetitionIncident,
    binding: ApplicationCompetitionAgentTeamBinding,
    task: CompetitionAgentTeamsTaskResult,
  ): Promise<ApplicationCompetitionAgentDecision> {
    const timestamp = this.now().toISOString();
    const decision: ApplicationCompetitionAgentDecision = {
      decisionId: this.id("decision"),
      taskId: task.taskId,
      bindingId: binding.bindingId,
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      traceId: binding.traceId,
      stage: task.stage,
      teamName: binding.teamName,
      roleCardId: task.result.roleCardId,
      agentName: task.result.agentName,
      teamRole: task.result.teamRole,
      transportSender: task.result.transportSender,
      eventId: task.result.eventId,
      decision: task.result.decision,
      summary: task.result.summary,
      confidence: task.result.confidence,
      requestedToolNames: [...task.result.requestedToolNames],
      evidenceIds: [...task.result.evidenceIds],
      skillName: task.result.skillName,
      skillVersion: task.result.skillVersion,
      outputDigest: task.result.outputDigest,
      routedByRoleCardId: task.route?.leaderRoleCardId ?? null,
      routedByName: task.route?.leaderName ?? null,
      routedByTransportSender: task.route?.transportSender ?? null,
      taskBriefDigest: task.route?.taskBriefDigest ?? null,
      createdAt: timestamp,
    };
    await this.store.update((current) => ({
      ...current,
      agentDecisions: [...current.agentDecisions, decision],
      updatedAt: timestamp,
    }));
    return decision;
  }

  /** 根据 Evidence Agent 结果筛选工具调用；输入允许调用和任务结果，返回覆盖三平台的只读调用。 */
  private selectAgentInvestigationCalls(
    availableCalls: readonly { readonly toolName: CompetitionToolName; readonly arguments: Readonly<Record<string, unknown>> }[],
    task: CompetitionAgentTeamsTaskResult,
  ): readonly { readonly toolName: CompetitionToolName; readonly arguments: Readonly<Record<string, unknown>> }[] {
    if (task.result.decision !== "COLLECT_EVIDENCE" || task.result.teamRole !== "worker") {
      throw new ApplicationCompetitionRuntimeError("AGENT_DECISION_INVALID", "Evidence Agent 未返回有效取证计划。", true);
    }
    const requested = new Set(task.result.requestedToolNames);
    const selected = availableCalls.filter((item) => requested.has(item.toolName));
    const platforms = new Set(selected.map((item) => getCompetitionToolDescriptor(item.toolName).platform));
    if (selected.length !== requested.size || selected.length !== availableCalls.length || platforms.size !== 3) {
      throw new ApplicationCompetitionRuntimeError(
        "AGENT_DECISION_INVALID",
        "Evidence Agent 的工具计划必须完整覆盖本场景允许的 AIOps、DataOps 和 MLOps 只读证据。",
        true,
      );
    }
    return selected;
  }

  /** 将角色卡 ID 转换为稳定审计 Actor；输入角色 ID，返回不含凭据的身份文本。 */
  private agentActorId(roleCardId: string): string {
    return `agentteams:${roleCardId}`;
  }

  /** 创建 Incident 到 Team Runtime 的绑定；输入事件、Trace、Runtime、模板和时间，固化角色快照并返回隔离服务状态。 */
  private async prepareTeamBinding(
    incident: ApplicationCompetitionIncident,
    traceId: string,
    runtime: "builtin" | "agentteams",
    teamTemplateId: string | null,
    timestamp: string,
  ): Promise<ApplicationCompetitionAgentTeamBinding> {
    let teamName = `incident-${incident.incidentId.slice(-12).toLowerCase()}`.replace(/[^a-z0-9-]/gu, "-");
    let resolvedTemplate: ApplicationEnterpriseResolvedTeamTemplate | null = null;
    let memberSnapshots: readonly ApplicationCompetitionAgentRoleSnapshot[] = [];
    if (teamTemplateId !== null) {
      if (this.options.resolveTeamTemplate === undefined) {
        throw new ApplicationCompetitionRuntimeError("TEAM_TEMPLATE_UNAVAILABLE", "企业团队模板解析服务未配置。");
      }
      try {
        resolvedTemplate = await this.options.resolveTeamTemplate(teamTemplateId);
      } catch {
        throw new ApplicationCompetitionRuntimeError("TEAM_TEMPLATE_UNAVAILABLE", "所选企业团队模板不存在、已停用或成员不可用。");
      }
      if (resolvedTemplate.teamTemplate.workspaceId !== incident.workspaceId) {
        throw new ApplicationCompetitionRuntimeError("TEAM_TEMPLATE_WORKSPACE_MISMATCH", "所选企业团队模板不属于当前 Incident Workspace。");
      }
      teamName = resolvedTemplate.teamTemplate.name;
      memberSnapshots = resolvedTemplate.teamTemplate.members.map((member, index) => {
        const roleCard = resolvedTemplate?.roleCards[index];
        if (roleCard === undefined || roleCard.id !== member.roleCardId) {
          throw new ApplicationCompetitionRuntimeError("TEAM_TEMPLATE_UNAVAILABLE", "企业团队模板角色解析顺序无效。");
        }
        return {
          roleCardId: roleCard.id,
          name: roleCard.name,
          department: roleCard.department,
          description: roleCard.description,
          teamRole: member.teamRole,
          systemPrompt: roleCard.system_prompt,
          runtimeSystemPrompt: roleCard.runtime_system_prompt,
          permissions: [...roleCard.permissions],
          tools: [...roleCard.tools],
          skills: [...roleCard.skills],
          capturedAt: timestamp,
        };
      });
    }
    let status: ApplicationCompetitionAgentTeamBinding["status"] = runtime === "builtin" ? "READY" : "DEGRADED";
    if (
      runtime === "agentteams"
      && resolvedTemplate !== null
      && this.options.agentTeamsIsolatedServiceEnabled === true
      && this.options.prepareAgentTeam !== undefined
    ) {
      try {
        const prepared = await this.options.prepareAgentTeam(incident, traceId, resolvedTemplate);
        teamName = prepared.teamName;
        status = prepared.status;
      } catch {
        status = "DEGRADED";
      }
    }
    return {
      bindingId: this.id("binding"),
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      traceId,
      runtime,
      teamName,
      status,
      teamTemplateId: resolvedTemplate?.teamTemplate.id ?? null,
      teamTemplateVersion: resolvedTemplate?.teamTemplate.version ?? null,
      teamTemplateName: resolvedTemplate?.teamTemplate.name ?? "",
      memberSnapshots,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  /** 创建固定范围的场景处置审批；输入事件、Trace 和申请人，返回 PENDING 记录。 */
  private createRemediationApproval(
    incident: ApplicationCompetitionIncident,
    traceId: string,
    actorId: string,
    agentReason?: string,
  ): ApplicationCompetitionApproval {
    const timestamp = this.now().toISOString();
    const profile = getCompetitionScenarioProfile(incident.scenario);
    const writeSteps = profile.executionPlan.steps.filter((step) => step.kind === "WRITE");
    const primaryStep = writeSteps[0];
    if (primaryStep === undefined) {
      throw new ApplicationCompetitionRuntimeError("SCENARIO_PLAN_INVALID", "场景执行计划缺少受审批写步骤。");
    }
    const scopes = [
      ...writeSteps.map((step) => ({ step, compensation: false })),
      ...profile.executionPlan.compensationSteps
        .filter((step) => step.kind === "WRITE")
        .map((step) => ({ step, compensation: true })),
    ].map(({ step, compensation }) => ({
      stepId: step.stepId,
      toolName: step.toolName,
      resourceId: step.resourceId,
      targetRevision: step.targetRevision,
      expectedResourceVersion: step.expectedResourceVersion,
      argumentsDigest: digestJson(step.arguments),
      compensation,
    }));
    const planDigest = digestJson({
      planId: profile.executionPlan.planId,
      scopes,
      orderedSteps: profile.executionPlan.steps.map((step) => step.stepId),
      compensationSteps: profile.executionPlan.compensationSteps.map((step) => step.stepId),
    });
    return {
      approvalId: this.id("apr"),
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      traceId,
      toolName: primaryStep.toolName,
      resourceId: primaryStep.resourceId,
      targetRevision: primaryStep.targetRevision,
      expectedResourceVersion: primaryStep.expectedResourceVersion,
      argumentsDigest: planDigest,
      planId: profile.executionPlan.planId,
      planDigest,
      scopes,
      reason: agentReason?.trim().slice(0, 4096)
        || profile.executionPlan.summary,
      status: "PENDING",
      requestedBy: actorId,
      requestedAt: timestamp,
      decidedBy: null,
      decidedAt: null,
      decisionReason: null,
    };
  }

  /** 投影 AgentTeams Leader 所需的完整计划；输入事件和审批摘要，返回固定步骤、依赖与参数摘要。 */
  private createAgentTeamsPlanReference(
    incident: ApplicationCompetitionIncident,
    planDigest: string,
  ): CompetitionAgentTeamsPlanReference {
    const executionPlan = getCompetitionScenarioProfile(incident.scenario).executionPlan;
    /** 投影单个执行步骤；输入场景步骤，返回不含明文参数的 AgentTeams 计划引用。 */
    const projectStep = (step: CompetitionScenarioExecutionStep) => ({
      stepId: step.stepId,
      toolName: step.toolName,
      resourceId: step.resourceId,
      targetRevision: step.targetRevision,
      expectedResourceVersion: step.expectedResourceVersion,
      argumentsDigest: digestJson(step.arguments),
      dependsOn: [...step.dependsOn],
    });
    return {
      planId: executionPlan.planId,
      planDigest,
      steps: executionPlan.steps.map(projectStep),
      compensationSteps: executionPlan.compensationSteps.map(projectStep),
    };
  }

  /** 校验审批与当前有序执行计划完全一致；输入审批、主步骤和补偿步骤，无返回，不匹配时拒绝执行。 */
  private assertApprovalPlanMatches(
    approval: ApplicationCompetitionApproval,
    steps: readonly CompetitionScenarioExecutionStep[],
    compensationSteps: readonly CompetitionScenarioExecutionStep[],
  ): void {
    const scopes = [
      ...steps.filter((step) => step.kind === "WRITE").map((step) => ({ step, compensation: false })),
      ...compensationSteps.filter((step) => step.kind === "WRITE").map((step) => ({ step, compensation: true })),
    ].map(({ step, compensation }) => ({
      stepId: step.stepId,
      toolName: step.toolName,
      resourceId: step.resourceId,
      targetRevision: step.targetRevision,
      expectedResourceVersion: step.expectedResourceVersion,
      argumentsDigest: digestJson(step.arguments),
      compensation,
    }));
    const expectedDigest = digestJson({
      planId: approval.planId,
      scopes,
      orderedSteps: steps.map((step) => step.stepId),
      compensationSteps: compensationSteps.map((step) => step.stepId),
    });
    if (
      approval.planDigest !== expectedDigest
      || approval.argumentsDigest !== expectedDigest
      || digestJson(approval.scopes) !== digestJson(scopes)
    ) {
      throw new ApplicationCompetitionRuntimeError("APPROVAL_SCOPE_MISMATCH", "审批步骤范围与当前执行计划不一致。");
    }
  }

  /** 构建单个步骤的治理包络；输入审批、执行请求、步骤、演练和补偿标记，返回精确幂等范围。 */
  private stepGovernance(
    approval: ApplicationCompetitionApproval,
    request: ExecuteApplicationCompetitionRollbackRequest,
    step: CompetitionScenarioExecutionStep,
    dryRun: boolean,
    compensation = false,
  ): CompetitionToolGovernance {
    return {
      approvalId: approval.approvalId,
      planId: approval.planId,
      planDigest: approval.planDigest,
      stepId: step.stepId,
      resourceId: step.resourceId,
      targetRevision: step.targetRevision,
      expectedResourceVersion: step.expectedResourceVersion,
      argumentsDigest: digestJson(step.arguments),
      compensation,
      reason: this.buildStepGovernanceReason(approval.reason, step.stepId),
      dryRun,
      idempotencyKey: `${request.idempotencyKey}:${step.stepId}`.slice(0, 128),
    };
  }

  /**
   * 构建符合三平台 512 字符上限的步骤说明，并优先保留用于审计定位的步骤 ID。
   *
   * @param approvalReason Agent 或人工形成的审批说明
   * @param stepId 当前执行步骤标识
   * @return 可直接写入治理包络的有界说明
   */
  private buildStepGovernanceReason(approvalReason: string, stepId: string): string {
    const suffix = ` [${stepId}]`;
    const reasonBudget = Math.max(0, 512 - suffix.length);
    return `${approvalReason.trim().slice(0, reasonBudget)}${suffix}`;
  }

  /** 创建待执行步骤记录；输入固定步骤和序号，返回不含原始参数的持久化记录。 */
  private createExecutionStep(
    step: CompetitionScenarioExecutionStep,
    sequence: number,
  ): ApplicationCompetitionExecutionStep {
    return {
      stepId: step.stepId,
      sequence,
      title: step.title,
      description: step.description,
      phase: step.phase,
      kind: step.kind,
      toolName: step.toolName,
      platform: getCompetitionToolDescriptor(step.toolName).platform,
      resourceId: step.resourceId,
      targetRevision: step.targetRevision,
      expectedResourceVersion: step.expectedResourceVersion,
      argumentsDigest: digestJson(step.arguments),
      status: "PENDING",
      invocationId: null,
      evidenceId: null,
      remoteActionId: null,
      resourceVersionBefore: step.expectedResourceVersion,
      resourceVersionAfter: "",
      startedAt: null,
      completedAt: null,
      errorCode: null,
    };
  }

  /** 执行并持久化一个计划步骤；输入模式、治理上下文和步骤，成功时记录证据与审计回执。 */
  private async executePlanStep(input: {
    readonly mode: ApplicationCompetitionAdapterMode;
    readonly incident: ApplicationCompetitionIncident;
    readonly approval: ApplicationCompetitionApproval;
    readonly actionId: string;
    readonly actorId: string;
    readonly baseIdempotencyKey: string;
    readonly step: CompetitionScenarioExecutionStep;
    readonly compensation: boolean;
  }): Promise<void> {
    const startedAt = this.now().toISOString();
    await this.store.update((current) => {
      const action = requireAction(current, input.actionId);
      const collection = input.compensation ? action.compensationSteps : action.steps;
      for (const dependency of input.step.dependsOn) {
        if (collection.find((step) => step.stepId === dependency)?.status !== "SUCCEEDED") {
          throw new ApplicationCompetitionRuntimeError("PLAN_DEPENDENCY_INVALID", `步骤 ${input.step.stepId} 的前置步骤未完成。`);
        }
      }
      const nextCollection = replaceExecutionStep(collection, input.step.stepId, {
        ...requireExecutionStep(collection, input.step.stepId),
        status: "RUNNING",
        startedAt,
      });
      return {
        ...current,
        actions: replaceAction(current.actions, action.actionId, {
          ...action,
          ...(input.compensation ? { compensationSteps: nextCollection } : { steps: nextCollection }),
          updatedAt: startedAt,
        }),
        updatedAt: startedAt,
      };
    });
    const request: ExecuteApplicationCompetitionRollbackRequest = {
      approvalId: input.approval.approvalId,
      actorId: input.actorId,
      idempotencyKey: input.baseIdempotencyKey,
      dryRun: false,
    };
    try {
      const recorded = await this.invokeAndRecord({
        incident: input.incident,
        traceId: input.approval.traceId,
        actorId: input.actorId,
        toolName: input.step.toolName,
        arguments: input.step.arguments,
        governance: input.step.kind === "WRITE"
          ? this.stepGovernance(input.approval, request, input.step, false, input.compensation)
          : null,
      });
      if (input.step.kind === "WRITE") await this.waitForAcceptedAction(input.mode, recorded);
      this.assertExecutionGatePassed(input.step, recorded.response);
      const completedAt = this.now().toISOString();
      const remoteActionId = typeof recorded.response.data?.actionId === "string"
        ? recorded.response.data.actionId
        : null;
      const resourceVersionAfter = recorded.response.meta.resourceVersion || String(input.step.targetRevision);
      const receipt = input.step.kind === "WRITE" ? this.createAuditReceipt({
        requestId: recorded.response.meta.requestId,
        incident: input.incident,
        traceId: input.approval.traceId,
        toolName: input.step.toolName,
        actorId: input.actorId,
        approvalId: input.approval.approvalId,
        idempotencyKey: `${input.baseIdempotencyKey}:${input.step.stepId}`.slice(0, 128),
        resourceVersionBefore: input.step.expectedResourceVersion,
        resourceVersionAfter,
        outcome: "SUCCEEDED",
      }) : null;
      await this.store.update((current) => {
        const action = requireAction(current, input.actionId);
        const collection = input.compensation ? action.compensationSteps : action.steps;
        const nextCollection = replaceExecutionStep(collection, input.step.stepId, {
          ...requireExecutionStep(collection, input.step.stepId),
          status: "SUCCEEDED",
          invocationId: recorded.invocationId,
          evidenceId: recorded.evidenceId,
          remoteActionId,
          resourceVersionAfter,
          completedAt,
        });
        return {
          ...current,
          invocations: replaceInvocation(current.invocations, recorded.invocationId, {
            ...requireInvocation(current, recorded.invocationId),
            actionId: input.actionId,
          }),
          actions: replaceAction(current.actions, action.actionId, {
            ...action,
            ...(input.compensation ? { compensationSteps: nextCollection } : { steps: nextCollection }),
            updatedAt: completedAt,
          }),
          auditReceipts: receipt === null ? current.auditReceipts : [...current.auditReceipts, receipt],
          updatedAt: completedAt,
        };
      });
      await this.projectOperationConversation({
        eventType: input.compensation ? "COMPENSATION_EXECUTING" : "ACTION_STEP_SUCCEEDED",
        workspaceId: input.incident.workspaceId,
        incidentId: input.incident.incidentId,
        traceId: input.approval.traceId,
        actorId: input.actorId,
        operationId: `${input.actionId}:${input.step.stepId}`,
        approvalId: input.approval.approvalId,
        actionId: input.actionId,
        toolName: input.step.toolName,
        targetResource: input.step.resourceId,
        evidenceIds: [recorded.evidenceId],
        summary: `${input.step.title}已完成。`,
      });
    } catch (error) {
      const failedAt = this.now().toISOString();
      const normalized = normalizeRuntimeError(error);
      await this.store.update((current) => {
        const action = requireAction(current, input.actionId);
        const collection = input.compensation ? action.compensationSteps : action.steps;
        const nextCollection = replaceExecutionStep(collection, input.step.stepId, {
          ...requireExecutionStep(collection, input.step.stepId),
          status: "FAILED",
          completedAt: failedAt,
          errorCode: normalized.code,
        });
        return {
          ...current,
          actions: replaceAction(current.actions, action.actionId, {
            ...action,
            ...(input.compensation ? { compensationSteps: nextCollection } : { steps: nextCollection }),
            updatedAt: failedAt,
          }),
          updatedAt: failedAt,
        };
      });
      throw normalized;
    }
  }

  /** 校验执行中的质量门结果；输入步骤和平台响应，无返回，显式失败时阻止后续步骤。 */
  private assertExecutionGatePassed(
    step: CompetitionScenarioExecutionStep,
    response: CompetitionToolAdapterResponse,
  ): void {
    if (step.kind !== "QUALITY_GATE") return;
    const data = response.data ?? {};
    const failed = data.passed === false
      || data.valid === false
      || ["FAILED", "REJECTED", "INVALID"].includes(String(data.status ?? "").toUpperCase());
    if (failed) {
      throw new ApplicationCompetitionRuntimeError("QUALITY_GATE_FAILED", `质量门 ${step.title} 未通过。`, true);
    }
  }

  /** 执行预先审批的补偿计划；输入失败动作上下文，按顺序回滚并持久化结果，不覆盖原始错误。 */
  private async runCompensationPlan(input: {
    readonly mode: ApplicationCompetitionAdapterMode;
    readonly incident: ApplicationCompetitionIncident;
    readonly approval: ApplicationCompetitionApproval;
    readonly actionId: string;
    readonly actorId: string;
    readonly baseIdempotencyKey: string;
    readonly steps: readonly CompetitionScenarioExecutionStep[];
  }): Promise<void> {
    if (input.steps.length === 0) return;
    const startedAt = this.now().toISOString();
    await this.store.update((current) => {
      const action = requireAction(current, input.actionId);
      return {
        ...current,
        actions: replaceAction(current.actions, action.actionId, {
          ...action,
          compensationStatus: "RUNNING",
          updatedAt: startedAt,
        }),
        updatedAt: startedAt,
      };
    });
    try {
      for (const step of input.steps) {
        await this.executePlanStep({ ...input, step, compensation: true });
      }
      const completedAt = this.now().toISOString();
      await this.store.update((current) => {
        const action = requireAction(current, input.actionId);
        return {
          ...current,
          actions: replaceAction(current.actions, action.actionId, {
            ...action,
            compensationStatus: "SUCCEEDED",
            updatedAt: completedAt,
          }),
          updatedAt: completedAt,
        };
      });
      await this.projectOperationConversation({
        eventType: "COMPENSATION_SUCCEEDED",
        workspaceId: input.incident.workspaceId,
        incidentId: input.incident.incidentId,
        traceId: input.approval.traceId,
        actorId: input.actorId,
        operationId: `${input.actionId}:compensation`,
        approvalId: input.approval.approvalId,
        actionId: input.actionId,
        toolName: "openxnet.scenario.plan.compensate",
        targetResource: input.actionId,
        evidenceIds: [],
        summary: "预先审批的补偿计划已完成。",
      });
    } catch {
      const failedAt = this.now().toISOString();
      await this.store.update((current) => {
        const action = requireAction(current, input.actionId);
        return {
          ...current,
          actions: replaceAction(current.actions, action.actionId, {
            ...action,
            compensationStatus: "FAILED",
            updatedAt: failedAt,
          }),
          updatedAt: failedAt,
        };
      });
    }
  }

  /** 校验处置审批、职责分离和事件范围；输入快照、请求、审批和事件，无返回，失败时抛出领域错误。 */
  private assertRemediationAuthorized(
    snapshot: ApplicationCompetitionSnapshot,
    request: ExecuteApplicationCompetitionRollbackRequest,
    approval: ApplicationCompetitionApproval,
    incident: ApplicationCompetitionIncident,
  ): void {
    const profile = getCompetitionScenarioProfile(incident.scenario);
    const primaryStep = profile.executionPlan.steps.find((step) => step.kind === "WRITE");
    if (approval.status !== "APPROVED" || approval.decidedBy === null) {
      throw new ApplicationCompetitionRuntimeError("APPROVAL_INVALID", "处置审批尚未通过。");
    }
    if (approval.decidedBy === request.actorId || approval.requestedBy === request.actorId) {
      throw new ApplicationCompetitionRuntimeError("SEPARATION_OF_DUTIES_REQUIRED", "处置执行人不能是申请人或审批人。");
    }
    if (incident.activeApprovalId !== approval.approvalId || incident.activeTraceId !== approval.traceId) {
      throw new ApplicationCompetitionRuntimeError("APPROVAL_SCOPE_MISMATCH", "审批不属于事件的当前 Trace。");
    }
    if (
      primaryStep === undefined
      || approval.planId !== profile.executionPlan.planId
      || approval.toolName !== primaryStep.toolName
      || approval.resourceId !== primaryStep.resourceId
    ) {
      throw new ApplicationCompetitionRuntimeError("APPROVAL_SCOPE_MISMATCH", "审批计划或主资源与当前场景不一致。");
    }
    const conflicting = snapshot.actions.find((action) =>
      action.approvalId === approval.approvalId && action.idempotencyKey !== request.idempotencyKey);
    if (conflicting !== undefined && conflicting.status !== "FAILED") {
      throw new ApplicationCompetitionRuntimeError("APPROVAL_ALREADY_CONSUMED", "该审批已经用于其他处置动作。");
    }
  }

  /** 处理重复幂等键；输入快照、既有动作和请求，返回原动作或抛出冲突。 */
  private handleExistingIdempotentAction(
    snapshot: ApplicationCompetitionSnapshot,
    existing: ApplicationCompetitionDeploymentAction,
    request: ExecuteApplicationCompetitionRollbackRequest,
  ): ApplicationCompetitionMutationResult {
    if (existing.approvalId !== request.approvalId || existing.executedBy !== request.actorId || request.dryRun) {
      throw new ApplicationCompetitionRuntimeError("IDEMPOTENCY_CONFLICT", "幂等键已被不同处置请求占用。");
    }
    return this.mutationResult(snapshot, existing.incidentId);
  }

  /** 校验场景专属独立验证结果；输入已记录结果和事件，无返回，不满足阈值时抛出领域错误。 */
  private assertVerificationPassed(
    results: readonly RecordedToolResult[],
    incident: ApplicationCompetitionIncident,
  ): void {
    /** 按工具名读取必需证据；输入工具名，返回数据或 null。 */
    const dataFor = (toolName: CompetitionToolName): Readonly<Record<string, unknown>> | null =>
      results.find((result) => result.adapterRequest.toolName === toolName)?.response.data ?? null;
    const scenarioType = incident.scenario.scenarioType;
    let passed = false;
    if (scenarioType === "recommendation-capacity") {
      const metrics = dataFor("aiops.inference.metrics.get");
      const recovery = dataFor("aiops.inference.recovery.status");
      const workflow = dataFor("dataops.workflow.instance.get");
      const deployment = dataFor("mlops.deployment.get");
      passed = metrics !== null
        && typeof metrics.p99Ms === "number" && metrics.p99Ms <= 300
        && typeof metrics.batchQueueSize === "number" && metrics.batchQueueSize <= 10
        && typeof metrics.successRate === "number" && metrics.successRate >= 0.999
        && recovery?.recovered === true
        && recovery.queueAwareAutoscaling === true
        && recovery.businessKpiRecovered === true
        && workflow?.status === "SUCCEEDED"
        && deployment !== null;
    } else if (scenarioType === "quantitative-iteration") {
      const health = dataFor("aiops.service.health");
      const dataset = dataFor("dataops.dataset.validation.get");
      const attribution = dataFor("mlops.attribution.report.get");
      const deployment = dataFor("mlops.deployment.get");
      const release = dataFor("mlops.release.validation.get");
      const probe = dataFor("mlops.inference.probe");
      passed = (health?.health === "HEALTHY" || health?.conclusion === "HEALTHY")
        && dataset?.passed === true
        && typeof attribution?.informationCoefficient === "number"
        && typeof attribution.informationCoefficientThreshold === "number"
        && attribution.informationCoefficient >= attribution.informationCoefficientThreshold
        && typeof attribution.sharpeImprovement === "number" && attribution.sharpeImprovement >= 0.05
        && deployment?.activeRevision === incident.scenario.targetRevision
        && release?.passed === true
        && release.trafficPercent === 100
        && probe?.passed === true;
    } else {
      const recovery = dataFor("aiops.inference.recovery.status");
      const dataset = dataFor("dataops.dataset.validation.get");
      const probe = dataFor("mlops.inference.probe");
      const deployment = dataFor("mlops.deployment.get");
      const release = dataFor("mlops.release.validation.get");
      passed = recovery?.businessKpiRecovered === true
        && dataset?.passed === true
        && probe?.passed === true
        && typeof probe.errorRate === "number" && probe.errorRate <= 0.05
        && typeof probe.p95Ms === "number" && probe.p95Ms <= 300
        && deployment?.activeRevision === incident.scenario.targetRevision
        && release?.passed === true
        && release.trafficPercent === 100;
    }
    if (!passed) {
      throw new ApplicationCompetitionRuntimeError("VERIFICATION_FAILED", "场景处置后的独立验证未通过。", true);
    }
  }

  /** 创建本地不可歧义审计回执；输入治理上下文，返回不可变回执。 */
  private createAuditReceipt(input: {
    requestId: string;
    incident: ApplicationCompetitionIncident;
    traceId: string;
    toolName: string;
    actorId: string;
    approvalId: string;
    idempotencyKey: string;
    resourceVersionBefore: string;
    resourceVersionAfter: string;
    outcome: ApplicationCompetitionAuditReceipt["outcome"];
  }): ApplicationCompetitionAuditReceipt {
    return {
      receiptId: this.id("receipt"),
      requestId: input.requestId,
      workspaceId: input.incident.workspaceId,
      incidentId: input.incident.incidentId,
      traceId: input.traceId,
      toolName: input.toolName,
      actorId: input.actorId,
      approvalId: input.approvalId,
      idempotencyKey: input.idempotencyKey,
      resourceVersionBefore: input.resourceVersionBefore,
      resourceVersionAfter: input.resourceVersionAfter,
      outcome: input.outcome,
      recordedAt: this.now().toISOString(),
    };
  }

  /** 标记 Trace 和事件失败；输入事件与 Trace ID，无返回，保留已获取证据。 */
  private async markTraceFailed(incidentId: string, traceId: string): Promise<void> {
    const timestamp = this.now().toISOString();
    await this.store.update((current) => ({
      ...current,
      incidents: replaceIncident(current.incidents, incidentId, {
        ...requireIncident(current, incidentId),
        status: "FAILED",
        updatedAt: timestamp,
      }),
      traces: replaceTrace(current.traces, traceId, {
        ...requireTrace(current, traceId),
        status: "FAILED",
        updatedAt: timestamp,
        completedAt: timestamp,
      }),
      updatedAt: timestamp,
    }));
  }

  /** 标记处置动作、Trace 和事件失败；输入相关 ID 与错误，无返回，保留审计上下文。 */
  private async markActionFailed(
    actionId: string,
    incidentId: string,
    traceId: string,
    error: unknown,
  ): Promise<void> {
    const timestamp = this.now().toISOString();
    const normalized = normalizeRuntimeError(error);
    await this.store.update((current) => ({
      ...current,
      actions: replaceAction(current.actions, actionId, {
        ...requireAction(current, actionId),
        status: "FAILED",
        stage: "FAILED",
        updatedAt: timestamp,
        completedAt: timestamp,
        errorCode: normalized.code,
      }),
      incidents: replaceIncident(current.incidents, incidentId, {
        ...requireIncident(current, incidentId),
        status: "FAILED",
        updatedAt: timestamp,
      }),
      traces: replaceTrace(current.traces, traceId, {
        ...requireTrace(current, traceId),
        status: "FAILED",
        updatedAt: timestamp,
        completedAt: timestamp,
      }),
      updatedAt: timestamp,
    }));
  }

  /** 构建复盘 Skill 文档；输入快照和事件，返回 UTF-8 Markdown。 */
  private buildRetrospectiveSkill(
    snapshot: ApplicationCompetitionSnapshot,
    incident: ApplicationCompetitionIncident,
  ): string {
    const evidence = snapshot.evidence.filter((item) => item.incidentId === incident.incidentId);
    const receipts = snapshot.auditReceipts.filter((item) => item.incidentId === incident.incidentId);
    const decisions = snapshot.agentDecisions.filter((item) => item.incidentId === incident.incidentId);
    const actions = snapshot.actions.filter((item) => item.incidentId === incident.incidentId);
    const evidenceLines = evidence.map((item) =>
      `- ${item.toolName}: ${item.summary} (evidence: ${item.evidenceId}, version: ${item.resourceVersion})`).join("\n");
    const receiptLines = receipts.map((item) =>
      `- ${item.toolName}: ${item.outcome} (receipt: ${item.receiptId}, actor: ${item.actorId})`).join("\n");
    const decisionLines = decisions.map((item) =>
      `- ${item.stage}: ${item.decision} / ${item.agentName} (${item.teamRole}, ${item.skillName}@${item.skillVersion}, event: ${item.eventId})`).join("\n");
    const actionLines = actions.flatMap((action) => action.steps.map((step) =>
      `- ${step.sequence}. ${step.title}: ${step.status} (${step.toolName}, evidence: ${step.evidenceId ?? "none"})`)).join("\n");
    const skill = getCompetitionScenarioProfile(incident.scenario).skill;
    return [
      "---",
      `name: ${skill.skillId}`,
      `description: ${skill.description}`,
      "---",
      "",
      `# ${incident.title}`,
      "",
      "## 适用条件",
      "",
      skill.triggerContext,
      "",
      "## 标准流程",
      "",
      ...skill.workflow.map((step, index) => `${index + 1}. ${step}`),
      "",
      "## 安全边界",
      "",
      skill.guardrails,
      "",
      "## 本次证据",
      "",
      evidenceLines || "- 无证据。",
      "",
      "## 审计回执",
      "",
      receiptLines || "- 无回执。",
      "",
      "## 完整执行步骤",
      "",
      actionLines || "- 无执行步骤。",
      "",
      "## AgentTeams 身份化决策",
      "",
      decisionLines || "- 本事件未使用 AgentTeams 任务通道。",
      "",
    ].join("\n");
  }

  /** 构建 OpenXnet 企业 Skill 发布请求；输入已解决事件，返回可复用流程、边界和证据来源。 */
  private buildRetrospectiveSkillPublication(
    snapshot: ApplicationCompetitionSnapshot,
    incident: ApplicationCompetitionIncident,
  ): ApplicationCompetitionRetrospectiveSkillPublicationRequest {
    const evidence = snapshot.evidence.filter((item) => item.incidentId === incident.incidentId);
    const skill = getCompetitionScenarioProfile(incident.scenario).skill;
    return {
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      skillId: skill.skillId,
      name: skill.name,
      description: skill.description,
      triggerContext: skill.triggerContext,
      workflow: skill.workflow.join("\n"),
      notes: skill.guardrails,
      requiredCapabilities: skill.requiredCapabilities,
      verification: skill.verification,
      rollback: skill.rollback,
      sourceEventIds: [
        incident.incidentId,
        ...evidence.map((item) => item.evidenceId),
      ].slice(0, 200),
      familyId: `family-${skill.skillId}`,
      problemFingerprint: `${incident.scenario.scenarioType}:${incident.scenario.serviceUid}`,
      evidenceOrigin: "rehearsal",
      derivationMethod: "rehearsal_crystallization",
      environmentScope: snapshot.adapterMode === "fixture" ? "simulation" : "staging",
    };
  }

  /** 同步一个 Incident 的知识投影；输入快照、事件和可选复盘 Skill，失败时保留控制面结果并记录固定诊断。 */
  private async synchronizeIncidentKnowledge(
    snapshot: ApplicationCompetitionSnapshot,
    incidentId: string,
    retrospective: { readonly name: string; readonly exportedAt: string } | null = null,
  ): Promise<void> {
    if (this.options.synchronizeKnowledge === undefined) return;
    try {
      await this.options.synchronizeKnowledge(this.buildKnowledgeProjection(snapshot, incidentId, retrospective));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown projection failure.";
      this.logger.warn(
        `Competition knowledge projection is temporarily unavailable; the control-plane result was preserved. Cause: ${reason}`,
      );
    }
  }

  /** 构建脱敏比赛知识快照；输入控制面状态和事件 ID，返回不含原始 Evidence、Prompt 与凭据的投影。 */
  private buildKnowledgeProjection(
    snapshot: ApplicationCompetitionSnapshot,
    incidentId: string,
    retrospective: { readonly name: string; readonly exportedAt: string } | null,
  ): ApplicationCompetitionKnowledgeProjectionRequest {
    const incident = requireIncident(snapshot, incidentId);
    /** 判断记录是否属于目标事件；输入带 Workspace/Incident 的记录，返回布尔值。 */
    const belongsToIncident = <T extends { readonly incidentId: string; readonly workspaceId: string }>(item: T): boolean => (
      item.incidentId === incident.incidentId && item.workspaceId === incident.workspaceId
    );
    return {
      schema: APPLICATION_COMPETITION_KNOWLEDGE_SCHEMA,
      projectedAt: retrospective?.exportedAt ?? snapshot.updatedAt,
      incident: {
        incidentId: incident.incidentId,
        workspaceId: incident.workspaceId,
        title: incident.title,
        summary: incident.summary,
        severity: incident.severity,
        status: incident.status,
        scenarioType: incident.scenario.scenarioType,
        serviceUid: incident.scenario.serviceUid,
        assetUid: incident.scenario.assetUid,
        workflowInstanceUid: incident.scenario.workflowInstanceUid,
        deploymentUid: incident.scenario.deploymentUid,
        failingRevision: incident.scenario.failingRevision,
        targetRevision: incident.scenario.targetRevision,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        resolvedAt: incident.resolvedAt,
      },
      traces: snapshot.traces.filter(belongsToIncident).slice(-100).map((trace) => ({
        traceId: trace.traceId,
        status: trace.status,
        startedAt: trace.startedAt,
        completedAt: trace.completedAt,
      })),
      teams: snapshot.teamBindings.filter(belongsToIncident).slice(-100).map((binding) => ({
        bindingId: binding.bindingId,
        traceId: binding.traceId,
        runtime: binding.runtime,
        teamName: binding.teamName,
        status: binding.status,
        teamTemplateId: binding.teamTemplateId,
        teamTemplateVersion: binding.teamTemplateVersion,
        members: binding.memberSnapshots.slice(0, 20).map((member) => ({
          roleCardId: member.roleCardId,
          name: member.name,
          department: member.department,
          teamRole: member.teamRole,
        })),
      })),
      decisions: snapshot.agentDecisions.filter(belongsToIncident).slice(-500).map((decision) => ({
        decisionId: decision.decisionId,
        taskId: decision.taskId,
        bindingId: decision.bindingId,
        traceId: decision.traceId,
        stage: decision.stage,
        teamName: decision.teamName,
        roleCardId: decision.roleCardId,
        agentName: decision.agentName,
        teamRole: decision.teamRole,
        decision: decision.decision,
        summary: decision.summary,
        confidence: decision.confidence,
        requestedToolNames: decision.requestedToolNames.slice(0, 100),
        evidenceIds: decision.evidenceIds.slice(0, 500),
        skillName: decision.skillName,
        skillVersion: decision.skillVersion,
        outputDigest: decision.outputDigest,
        routedByRoleCardId: decision.routedByRoleCardId,
        routedByName: decision.routedByName,
        createdAt: decision.createdAt,
      })),
      invocations: snapshot.invocations.filter(belongsToIncident).slice(-2000).map((invocation) => ({
        invocationId: invocation.invocationId,
        traceId: invocation.traceId,
        actorId: invocation.actorId,
        toolName: invocation.toolName,
        platform: invocation.platform,
        status: invocation.status,
        evidenceId: invocation.evidenceId,
        actionId: invocation.actionId,
        errorCode: invocation.errorCode,
        startedAt: invocation.startedAt,
        completedAt: invocation.completedAt,
      })),
      evidence: snapshot.evidence.filter(belongsToIncident).slice(-2000).map((evidence) => ({
        evidenceId: evidence.evidenceId,
        traceId: evidence.traceId,
        toolName: evidence.toolName,
        platform: evidence.platform,
        summary: evidence.summary,
        resourceVersion: evidence.resourceVersion,
        observedAt: evidence.observedAt,
        contentDigest: evidence.contentDigest,
      })),
      approvals: snapshot.approvals.filter(belongsToIncident).slice(-500).map((approval) => ({
        approvalId: approval.approvalId,
        traceId: approval.traceId,
        toolName: approval.toolName,
        resourceId: approval.resourceId,
        targetRevision: approval.targetRevision,
        expectedResourceVersion: approval.expectedResourceVersion,
        planId: approval.planId,
        planDigest: approval.planDigest,
        scopes: approval.scopes.map((scope) => ({
          stepId: scope.stepId,
          toolName: scope.toolName,
          resourceId: scope.resourceId,
          targetRevision: scope.targetRevision,
          expectedResourceVersion: scope.expectedResourceVersion,
          compensation: scope.compensation,
        })),
        status: approval.status,
        requestedBy: approval.requestedBy,
        requestedAt: approval.requestedAt,
        decidedBy: approval.decidedBy,
        decidedAt: approval.decidedAt,
      })),
      actions: snapshot.actions.filter(belongsToIncident).slice(-500).map((action) => ({
        actionId: action.actionId,
        traceId: action.traceId,
        approvalId: action.approvalId,
        toolName: action.toolName,
        resourceId: action.resourceId,
        planId: action.planId,
        planTitle: action.planTitle,
        planDigest: action.planDigest,
        deploymentUid: action.deploymentUid,
        fromRevision: action.fromRevision,
        targetRevision: action.targetRevision,
        status: action.status,
        stage: action.stage,
        executedBy: action.executedBy,
        steps: action.steps.map((step) => ({
          stepId: step.stepId,
          sequence: step.sequence,
          title: step.title,
          phase: step.phase,
          toolName: step.toolName,
          platform: step.platform,
          status: step.status,
          evidenceId: step.evidenceId,
          resourceVersionBefore: step.resourceVersionBefore,
          resourceVersionAfter: step.resourceVersionAfter,
        })),
        compensationStatus: action.compensationStatus,
        compensationSteps: action.compensationSteps.map((step) => ({
          stepId: step.stepId,
          sequence: step.sequence,
          title: step.title,
          toolName: step.toolName,
          platform: step.platform,
          status: step.status,
          evidenceId: step.evidenceId,
        })),
        verificationEvidenceIds: action.verificationEvidenceIds.slice(0, 500),
        errorCode: action.errorCode,
        createdAt: action.createdAt,
        completedAt: action.completedAt,
      })),
      receipts: snapshot.auditReceipts.filter(belongsToIncident).slice(-1000).map((receipt) => ({
        receiptId: receipt.receiptId,
        traceId: receipt.traceId,
        toolName: receipt.toolName,
        actorId: receipt.actorId,
        approvalId: receipt.approvalId,
        resourceVersionBefore: receipt.resourceVersionBefore,
        resourceVersionAfter: receipt.resourceVersionAfter,
        outcome: receipt.outcome,
        recordedAt: receipt.recordedAt,
      })),
      retrospective,
    };
  }

  /** 创建带前缀的稳定内部 ID；输入前缀，返回不含路径分隔符的标识。 */
  private id(prefix: string): string {
    const value = this.createId().replace(/[^A-Za-z0-9_-]/gu, "");
    if (!value) throw new Error("Competition ID generator returned an invalid value.");
    return `${prefix}_${value}`;
  }

  /** 从快照构建统一变更结果；输入快照和事件 ID，返回当前关联 ID。 */
  private mutationResult(
    snapshot: ApplicationCompetitionSnapshot,
    incidentId: string,
  ): ApplicationCompetitionMutationResult {
    const incident = requireIncident(snapshot, incidentId);
    return {
      snapshot,
      incidentId,
      traceId: incident.activeTraceId,
      approvalId: incident.activeApprovalId,
      actionId: incident.activeActionId,
      retrospectivePath: null,
      retrospectiveSkillId: null,
    };
  }
}

/** 规范化未知异常；输入未知错误，返回 Renderer 安全文案和错误码。 */
function normalizeRuntimeError(error: unknown): ApplicationCompetitionRuntimeError {
  if (error instanceof ApplicationCompetitionRuntimeError) return error;
  return new ApplicationCompetitionRuntimeError("UPSTREAM_UNAVAILABLE", "竞赛平台工具暂时不可用。", true);
}

/** 生成 JSON 的稳定 SHA-256；输入结构化值，返回十六进制摘要。 */
function digestJson(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value), "utf8").digest("hex");
}

/** 对 JSON 值执行确定性序列化；输入未知值，返回按对象键排序的 JSON 文本。 */
function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** 深拷贝有界 JSON 对象；输入普通对象和字节上限，返回副本，超限时抛错。 */
function cloneRecord(value: Readonly<Record<string, unknown>>, maximumBytes: number): Readonly<Record<string, unknown>> {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new ApplicationCompetitionRuntimeError("EVIDENCE_TOO_LARGE", "平台证据超过本地存储预算。");
  }
  return JSON.parse(serialized) as Readonly<Record<string, unknown>>;
}

/** 读取工具参数文本或默认值；输入未知参数和默认值，返回有界文本。 */
function textArgument(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 512) : fallback;
}

/** 读取工具参数正整数或默认值；输入未知参数和默认值，返回正整数。 */
function integerArgument(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

/** 从快照读取事件；输入快照和 ID，返回记录，不存在时抛出领域错误。 */
function requireIncident(snapshot: ApplicationCompetitionSnapshot, incidentId: string): ApplicationCompetitionIncident {
  const result = snapshot.incidents.find((item) => item.incidentId === incidentId);
  if (result === undefined) throw new ApplicationCompetitionRuntimeError("INCIDENT_NOT_FOUND", "竞赛事件不存在。");
  return result;
}

/** 从快照读取 Trace；输入快照和 ID，返回记录，不存在时抛出领域错误。 */
function requireTrace(snapshot: ApplicationCompetitionSnapshot, traceId: string): ApplicationCompetitionTrace {
  const result = snapshot.traces.find((item) => item.traceId === traceId);
  if (result === undefined) throw new ApplicationCompetitionRuntimeError("TRACE_NOT_FOUND", "竞赛 Trace 不存在。");
  return result;
}

/** 从快照读取审批；输入快照和 ID，返回记录，不存在时抛出领域错误。 */
function requireApproval(snapshot: ApplicationCompetitionSnapshot, approvalId: string): ApplicationCompetitionApproval {
  const result = snapshot.approvals.find((item) => item.approvalId === approvalId);
  if (result === undefined) throw new ApplicationCompetitionRuntimeError("APPROVAL_NOT_FOUND", "竞赛审批不存在。");
  return result;
}

/** 从快照读取动作；输入快照和 ID，返回记录，不存在时抛出领域错误。 */
function requireAction(snapshot: ApplicationCompetitionSnapshot, actionId: string): ApplicationCompetitionDeploymentAction {
  const result = snapshot.actions.find((item) => item.actionId === actionId);
  if (result === undefined) throw new ApplicationCompetitionRuntimeError("ACTION_NOT_FOUND", "竞赛处置动作不存在。");
  return result;
}

/** 从动作步骤集合读取一项；输入集合和步骤 ID，返回记录，不存在时抛出领域错误。 */
function requireExecutionStep(
  steps: readonly ApplicationCompetitionExecutionStep[],
  stepId: string,
): ApplicationCompetitionExecutionStep {
  const result = steps.find((item) => item.stepId === stepId);
  if (result === undefined) throw new ApplicationCompetitionRuntimeError("ACTION_STEP_NOT_FOUND", "竞赛处置步骤不存在。");
  return result;
}

/** 从快照读取工具调用；输入快照和 ID，返回记录，不存在时抛出领域错误。 */
function requireInvocation(
  snapshot: ApplicationCompetitionSnapshot,
  invocationId: string,
): ApplicationCompetitionToolInvocation {
  const result = snapshot.invocations.find((item) => item.invocationId === invocationId);
  if (result === undefined) throw new ApplicationCompetitionRuntimeError("INVOCATION_NOT_FOUND", "竞赛工具调用不存在。");
  return result;
}

/** 替换事件集合中的一项；输入集合、ID 和记录，返回保持顺序的新数组。 */
function replaceIncident(
  items: readonly ApplicationCompetitionIncident[],
  id: string,
  value: ApplicationCompetitionIncident,
): readonly ApplicationCompetitionIncident[] {
  return replaceRecord(items, (item) => item.incidentId === id, value);
}

/** 替换 Trace 集合中的一项；输入集合、ID 和记录，返回保持顺序的新数组。 */
function replaceTrace(
  items: readonly ApplicationCompetitionTrace[],
  id: string,
  value: ApplicationCompetitionTrace,
): readonly ApplicationCompetitionTrace[] {
  return replaceRecord(items, (item) => item.traceId === id, value);
}

/** 替换审批集合中的一项；输入集合、ID 和记录，返回保持顺序的新数组。 */
function replaceApproval(
  items: readonly ApplicationCompetitionApproval[],
  id: string,
  value: ApplicationCompetitionApproval,
): readonly ApplicationCompetitionApproval[] {
  return replaceRecord(items, (item) => item.approvalId === id, value);
}

/** 替换动作集合中的一项；输入集合、ID 和记录，返回保持顺序的新数组。 */
function replaceAction(
  items: readonly ApplicationCompetitionDeploymentAction[],
  id: string,
  value: ApplicationCompetitionDeploymentAction,
): readonly ApplicationCompetitionDeploymentAction[] {
  return replaceRecord(items, (item) => item.actionId === id, value);
}

/** 替换执行步骤集合中的一项；输入集合、步骤 ID 和记录，返回保持顺序的新数组。 */
function replaceExecutionStep(
  items: readonly ApplicationCompetitionExecutionStep[],
  id: string,
  value: ApplicationCompetitionExecutionStep,
): readonly ApplicationCompetitionExecutionStep[] {
  return replaceRecord(items, (item) => item.stepId === id, value);
}

/** 替换工具调用集合中的一项；输入集合、ID 和记录，返回保持顺序的新数组。 */
function replaceInvocation(
  items: readonly ApplicationCompetitionToolInvocation[],
  id: string,
  value: ApplicationCompetitionToolInvocation,
): readonly ApplicationCompetitionToolInvocation[] {
  return replaceRecord(items, (item) => item.invocationId === id, value);
}

/** 以断言替换不可变集合中的一项；输入集合、匹配函数和新记录，返回新数组。 */
function replaceRecord<T>(items: readonly T[], predicate: (item: T) => boolean, value: T): readonly T[] {
  let replaced = false;
  const result = items.map((item) => {
    if (!predicate(item)) return item;
    replaced = true;
    return value;
  });
  if (!replaced) throw new Error("Competition record replacement target does not exist.");
  return result;
}

/** 解析竞赛 Resource URI；输入 URI，返回 Workspace、资源类型和 ID，无效时抛出领域错误。 */
function parseResourceUri(uri: string): { workspaceId: string; kind: string; resourceId: string; incidentId?: string } {
  const parsed = new URL(uri);
  const segments = parsed.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (parsed.protocol !== "openxnet:" || parsed.hostname !== "workspaces") {
    throw new ApplicationCompetitionRuntimeError("RESOURCE_URI_INVALID", "竞赛 Resource URI 格式无效。");
  }
  if (segments.length === 5) {
    const [workspaceId, incidentKind, incidentId, traceKind, traceId] = segments;
    if (workspaceId && incidentKind === "incidents" && incidentId && traceKind === "traces" && traceId) {
      return { workspaceId, kind: "traces", resourceId: traceId, incidentId };
    }
    throw new ApplicationCompetitionRuntimeError("RESOURCE_URI_INVALID", "竞赛 Trace Resource URI 格式无效。");
  }
  if (segments.length !== 3) {
    throw new ApplicationCompetitionRuntimeError("RESOURCE_URI_INVALID", "竞赛 Resource URI 格式无效。");
  }
  const [workspaceId, kind, resourceId] = segments;
  if (!workspaceId || !kind || !resourceId || !["incidents", "evidence", "actions", "audit-receipts", "agent-decisions"].includes(kind)) {
    throw new ApplicationCompetitionRuntimeError("RESOURCE_URI_INVALID", "竞赛 Resource URI 格式无效。");
  }
  return { workspaceId, kind, resourceId };
}

/** 在快照中定位 Resource；输入快照、资源类型和 ID，返回记录或 undefined。 */
function findResourceRecord(
  snapshot: ApplicationCompetitionSnapshot,
  kind: string,
  resourceId: string,
): (ApplicationCompetitionIncident | ApplicationCompetitionTrace | ApplicationCompetitionEvidence
  | ApplicationCompetitionDeploymentAction | ApplicationCompetitionAuditReceipt | ApplicationCompetitionAgentDecision) | undefined {
  switch (kind) {
    case "incidents": return snapshot.incidents.find((item) => item.incidentId === resourceId);
    case "traces": return snapshot.traces.find((item) => item.traceId === resourceId);
    case "evidence": return snapshot.evidence.find((item) => item.evidenceId === resourceId);
    case "actions": return snapshot.actions.find((item) => item.actionId === resourceId);
    case "audit-receipts": return snapshot.auditReceipts.find((item) => item.receiptId === resourceId);
    case "agent-decisions": return snapshot.agentDecisions.find((item) => item.decisionId === resourceId);
    default: return undefined;
  }
}
