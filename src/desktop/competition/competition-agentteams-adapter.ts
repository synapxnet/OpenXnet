import { createHash } from "node:crypto";

import type {
  ApplicationEnterpriseResolvedTeamTemplate,
  ApplicationEnterpriseRoleCard,
} from "../contracts/application-enterprise-runtime";
import type {
  ApplicationCompetitionAgentTeamBinding,
  ApplicationCompetitionAuditReceipt,
  ApplicationCompetitionEvidence,
  ApplicationCompetitionIncident,
} from "../contracts/application-competition-runtime";
import type { ApplicationCompetitionTeamPreparationResult } from "./application-competition-runtime";
import { COMPETITION_TOOL_REGISTRY, type CompetitionToolName } from "./competition-tool-registry";

const PREPARE_REQUEST_SCHEMA = "openxnet.agentteams.prepare.v1" as const;
const PREPARE_RESULT_SCHEMA = "openxnet.agentteams.prepare-result.v1" as const;
const TASK_REQUEST_SCHEMA = "openxnet.agentteams.task.v1" as const;
const TASK_RESULT_SCHEMA = "openxnet.agentteams.task-result.v1" as const;
const DEFAULT_AGENTTEAMS_REQUEST_TIMEOUT_MS = 330_000;
const RESOURCE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const MATRIX_USER_ID_PATTERN = /^@[^:\s]{1,255}:[^\s]{1,255}$/u;
const MATRIX_ROOM_ID_PATTERN = /^![^:\s]{1,255}:[^\s]{1,255}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TRANSPORT_EVENT_KINDS = Object.freeze([
  "ROUTE_REQUEST", "ROUTE_RESPONSE", "TASK_REQUEST", "TASK_RESPONSE", "CORRECTION_REQUEST",
] as const);
const EVIDENCE_SIGNAL_FIELDS = Object.freeze([
  "status", "passed", "valid", "healthy", "ready", "recovered",
  "businessKpiRecovered", "queueAwareAutoscaling", "errorRate", "p95Ms", "p99Ms",
  "successRate", "batchQueueSize", "activeRevision", "trafficPercent",
  "readyReplicas", "desiredReplicas", "informationCoefficient",
  "informationCoefficientThreshold", "sharpeImprovement", "maximumDrawdownIncrease",
  "trainingCompleted", "evaluationPassed", "modelRegistered", "canaryPassed",
  "rollbackReady", "inputContractStatus", "algorithmId", "productVersion", "candidateCount",
  "contractStatus", "modelDigestSha256",
] as const);

/** 投影 AgentTeams 可见的验证信号；输入完整证据，仅返回固定白名单中的标量字段。 */
function projectEvidenceSignals(evidence: ApplicationCompetitionEvidence): Readonly<Record<string, string | number | boolean>> {
  const result: Record<string, string | number | boolean> = {};
  for (const field of EVIDENCE_SIGNAL_FIELDS) {
    const value = evidence.data[field];
    if (typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      result[field] = value;
    }
  }
  return Object.freeze(result);
}

/** 生成 Agent 可引用的证据版本；输入平台版本和内容摘要，返回平台版本或明确标记的不可变摘要。 */
function evidenceResourceReference(resourceVersion: string, contentDigest: string): string {
  const normalized = resourceVersion.trim();
  return normalized || `unversioned-sha256:${contentDigest}`;
}

/** AgentTeams 参与竞赛闭环的三个阶段。 */
export type CompetitionAgentTeamsTaskStage =
  | "INVESTIGATION_PLAN"
  | "INVESTIGATION_CONCLUSION"
  | "VERIFICATION_CONCLUSION";

/** OpenXnet 提交给 AgentTeams 的版本化 Skill 引用。 */
export interface CompetitionAgentTeamsSkillReference {
  readonly name: string;
  readonly version: string;
}

/** AgentTeams 任务使用的完整计划步骤引用。 */
export interface CompetitionAgentTeamsPlanStepReference {
  readonly stepId: string;
  readonly toolName: CompetitionToolName;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly argumentsDigest: string;
  readonly dependsOn: readonly string[];
}

/** Leader 决策使用的固定主计划与补偿计划。 */
export interface CompetitionAgentTeamsPlanReference {
  readonly planId: string;
  readonly planDigest: string;
  readonly steps: readonly CompetitionAgentTeamsPlanStepReference[];
  readonly compensationSteps: readonly CompetitionAgentTeamsPlanStepReference[];
}

/** AgentTeams 验证任务使用的完整动作引用。 */
export interface CompetitionAgentTeamsActionReference {
  readonly actionId: string;
  readonly planId: string;
  readonly planDigest: string;
  readonly toolName: string;
  readonly resourceVersionAfter: string;
  readonly completedStepCount: number;
  readonly compensationPlanReady: true;
  readonly outcome: ApplicationCompetitionAuditReceipt["outcome"];
}

/** 派发 AgentTeams 阶段任务所需的领域上下文。 */
export interface CompetitionAgentTeamsTaskInput {
  readonly incident: ApplicationCompetitionIncident;
  readonly traceId: string;
  readonly binding: ApplicationCompetitionAgentTeamBinding;
  readonly stage: CompetitionAgentTeamsTaskStage;
  readonly skill: CompetitionAgentTeamsSkillReference;
  readonly availableToolNames: readonly CompetitionToolName[];
  readonly evidence: readonly ApplicationCompetitionEvidence[];
  readonly proposedPlan: CompetitionAgentTeamsPlanReference | null;
  readonly action: CompetitionAgentTeamsActionReference | null;
}

/** Leader 路由产生的可审计摘要。 */
export interface CompetitionAgentTeamsRouteResult {
  readonly leaderRoleCardId: string;
  readonly leaderName: string;
  readonly transportSender: string;
  readonly assigneeRoleCardId: string;
  readonly taskBriefDigest: string;
}

/** 目标 Agent 的身份化阶段输出。 */
export interface CompetitionAgentTeamsAgentResult {
  readonly roleCardId: string;
  readonly agentName: string;
  readonly teamRole: "leader" | "worker" | "verifier";
  readonly transportSender: string;
  readonly eventId: string;
  readonly decision: "COLLECT_EVIDENCE" | "REQUEST_APPROVAL" | "HALT" | "CLOSE" | "ROLLBACK_REQUIRED";
  readonly summary: string;
  readonly confidence: number;
  readonly requestedToolNames: readonly CompetitionToolName[];
  readonly evidenceIds: readonly string[];
  readonly skillName: string;
  readonly skillVersion: string;
  readonly outputDigest: string;
}

/** 独立 Adapter 返回的脱敏 Matrix 原始事件包络。 */
export interface CompetitionAgentTeamsTransportEvent {
  readonly kind: (typeof TRANSPORT_EVENT_KINDS)[number];
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly roomId: string;
  readonly eventId: string;
  readonly sender: string;
  readonly recipient: string;
  readonly originServerTs: number | null;
  readonly observedAt: string;
  readonly redactedBody: string;
  readonly bodyDigest: string;
}

/** AgentTeams 阶段任务的完整回执。 */
export interface CompetitionAgentTeamsTaskResult {
  readonly taskId: string;
  readonly stage: CompetitionAgentTeamsTaskStage;
  readonly route: CompetitionAgentTeamsRouteResult | null;
  readonly result: CompetitionAgentTeamsAgentResult;
  readonly transportEvents: readonly CompetitionAgentTeamsTransportEvent[];
  readonly completedAt: string;
}

/** AgentTeams 委托令牌所绑定的完整请求上下文。 */
export interface CompetitionAgentTeamsDelegationContext {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly teamTemplateId: string;
  readonly teamTemplateVersion: number;
  readonly teamName?: string;
  readonly stage?: CompetitionAgentTeamsTaskStage;
}

/** 隔离 AgentTeams HTTP Adapter 的依赖和安全预算。 */
export interface HttpCompetitionAgentTeamsAdapterOptions {
  readonly resolveEndpoint: () => Promise<string>;
  readonly resolveDelegationToken: (context: CompetitionAgentTeamsDelegationContext) => Promise<string>;
  readonly fetchResource?: typeof fetch;
  readonly timeoutMs?: number;
  readonly prepareRetryDelayMs?: number;
  readonly maxResponseBytes?: number;
  readonly taskTimeoutMs?: number;
}

/** 通过独立登录域和 HTTP 服务准备 AgentTeams Team，不读取桌面通用 AgentTeams 会话。 */
export class HttpCompetitionAgentTeamsAdapter {
  private readonly fetchResource: typeof fetch;
  private readonly timeoutMs: number;
  private readonly prepareRetryDelayMs: number;
  private readonly maxResponseBytes: number;
  private readonly taskTimeoutMs: number;

  /** 创建隔离 Adapter；输入端点、委托解析和网络依赖，不提前访问服务。 */
  public constructor(private readonly options: HttpCompetitionAgentTeamsAdapterOptions) {
    this.fetchResource = options.fetchResource ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_AGENTTEAMS_REQUEST_TIMEOUT_MS;
    this.prepareRetryDelayMs = options.prepareRetryDelayMs ?? 2_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 256 * 1024;
    this.taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_AGENTTEAMS_REQUEST_TIMEOUT_MS;
  }

  /** 准备一个模板团队；输入 Incident、Trace 和已解析模板，返回 READY 或抛出脱敏异常。 */
  public async prepare(
    incident: ApplicationCompetitionIncident,
    traceId: string,
    resolvedTemplate: ApplicationEnterpriseResolvedTeamTemplate,
  ): Promise<ApplicationCompetitionTeamPreparationResult> {
    const requestId = this.createRequestId(traceId, resolvedTemplate.teamTemplate.id, resolvedTemplate.teamTemplate.version);
    const context: CompetitionAgentTeamsDelegationContext = {
      requestId,
      workspaceId: incident.workspaceId,
      incidentId: incident.incidentId,
      traceId,
      teamTemplateId: resolvedTemplate.teamTemplate.id,
      teamTemplateVersion: resolvedTemplate.teamTemplate.version,
    };
    const endpoint = this.requireEndpoint(await this.options.resolveEndpoint());
    const token = (await this.options.resolveDelegationToken(context)).trim();
    if (token.length < 64) throw new Error("AgentTeams delegation token is not configured.");
    const cardsById = new Map(resolvedTemplate.roleCards.map((card) => [card.id, card] as const));
    const body = {
      schema: PREPARE_REQUEST_SCHEMA,
      ...context,
      teamTemplateName: resolvedTemplate.teamTemplate.name,
      members: resolvedTemplate.teamTemplate.members.map((member) => {
        const roleCard = cardsById.get(member.roleCardId);
        if (roleCard === undefined) throw new Error("AgentTeams team-template member resolution is invalid.");
        return this.projectMember(roleCard, member.teamRole);
      }),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      while (true) {
        const response = await this.fetchResource(new URL("api/v1/teams/prepare", endpoint), {
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
            "Idempotency-Key": requestId,
            "X-OpenXnet-Workspace-Id": incident.workspaceId,
            "X-OpenXnet-Incident-Id": incident.incidentId,
            "X-OpenXnet-Trace-Id": traceId,
          },
          body: JSON.stringify(body),
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > this.maxResponseBytes) throw new Error("AgentTeams isolated response is too large.");
        if (!response.ok || (response.status >= 300 && response.status < 400)) {
          const retryable = response.status === 503
            && parseAgentTeamsPublicErrorCode(bytes) === "AGENTTEAMS_TEAM_NOT_READY"
            && !controller.signal.aborted;
          if (!retryable) {
            throw new Error(`AgentTeams isolated service rejected the request with HTTP ${response.status}.`);
          }
          await new Promise((resolve) => setTimeout(resolve, this.prepareRetryDelayMs));
          continue;
        }
        const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
        return this.parseResponse(value, context);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  /** 派发真实 AgentTeams 阶段任务；输入事件、Binding、Skill 和证据上下文，返回身份化结果。 */
  public async dispatch(input: CompetitionAgentTeamsTaskInput): Promise<CompetitionAgentTeamsTaskResult> {
    if (
      input.binding.runtime !== "agentteams"
      || input.binding.status !== "READY"
      || input.binding.teamTemplateId === null
      || input.binding.teamTemplateVersion === null
    ) {
      throw new Error("AgentTeams binding is not ready for task dispatch.");
    }
    const requestId = this.createTaskRequestId(input);
    const context: CompetitionAgentTeamsDelegationContext = {
      requestId,
      workspaceId: input.incident.workspaceId,
      incidentId: input.incident.incidentId,
      traceId: input.traceId,
      teamTemplateId: input.binding.teamTemplateId,
      teamTemplateVersion: input.binding.teamTemplateVersion,
      teamName: input.binding.teamName,
      stage: input.stage,
    };
    const body = {
      schema: TASK_REQUEST_SCHEMA,
      ...context,
      teamName: input.binding.teamName,
      stage: input.stage,
      skill: input.skill,
      context: {
        incident: {
          title: input.incident.title,
          summary: input.incident.summary,
          severity: input.incident.severity,
          scenario: input.incident.scenario,
        },
        availableTools: [...input.availableToolNames],
        evidence: input.evidence.map((item) => ({
          evidenceId: item.evidenceId,
          toolName: item.toolName,
          summary: item.summary,
          resourceVersion: evidenceResourceReference(item.resourceVersion, item.contentDigest),
          contentDigest: item.contentDigest,
          signals: projectEvidenceSignals(item),
        })),
        proposedPlan: input.proposedPlan,
        action: input.action,
        policy: {
          approvalRequiredTools: COMPETITION_TOOL_REGISTRY
            .filter((tool) => tool.requiresApproval)
            .map((tool) => tool.name),
          maxErrorRate: 0.05,
          maxP95Ms: 300,
          requireHealthyService: input.availableToolNames.includes("aiops.service.health"),
          requireReadyReplicas: input.availableToolNames.includes("aiops.k8s.workload.get"),
          requiredVerificationTools: input.stage === "VERIFICATION_CONCLUSION"
            ? [...input.availableToolNames]
            : [],
        },
      },
    };
    const endpoint = this.requireEndpoint(await this.options.resolveEndpoint());
    const token = (await this.options.resolveDelegationToken(context)).trim();
    if (token.length < 64) throw new Error("AgentTeams delegation token is not configured.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.taskTimeoutMs);
    try {
      const response = await this.fetchResource(new URL("api/v1/tasks/dispatch", endpoint), {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
          "Idempotency-Key": requestId,
          "X-OpenXnet-Workspace-Id": input.incident.workspaceId,
          "X-OpenXnet-Incident-Id": input.incident.incidentId,
          "X-OpenXnet-Trace-Id": input.traceId,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok || (response.status >= 300 && response.status < 400)) {
        throw new Error(`AgentTeams isolated service rejected the task with HTTP ${response.status}.`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > this.maxResponseBytes) throw new Error("AgentTeams task response is too large.");
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
      return this.parseTaskResponse(value, context, input);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** 投影角色卡；输入角色卡和团队职责，返回无路径、无凭据的服务请求成员。 */
  private projectMember(
    roleCard: ApplicationEnterpriseRoleCard,
    teamRole: "leader" | "worker" | "verifier",
  ): Readonly<Record<string, unknown>> {
    return {
      roleCardId: roleCard.id,
      name: roleCard.name,
      department: roleCard.department,
      description: roleCard.description,
      teamRole,
      systemPrompt: roleCard.system_prompt,
      runtimeSystemPrompt: roleCard.runtime_system_prompt,
      permissions: [...roleCard.permissions],
      tools: [...roleCard.tools],
      skills: [...roleCard.skills],
    };
  }

  /** 解析隔离服务响应；输入未知 JSON 和请求范围，返回严格匹配的 Team 状态。 */
  private parseResponse(
    value: unknown,
    context: CompetitionAgentTeamsDelegationContext,
  ): ApplicationCompetitionTeamPreparationResult {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("AgentTeams isolated response is invalid.");
    }
    const response = value as Record<string, unknown>;
    if (
      response.schema !== PREPARE_RESULT_SCHEMA
      || response.success !== true
      || response.status !== "READY"
      || response.requestId !== context.requestId
      || response.workspaceId !== context.workspaceId
      || response.incidentId !== context.incidentId
      || response.traceId !== context.traceId
      || response.teamTemplateId !== context.teamTemplateId
      || response.teamTemplateVersion !== context.teamTemplateVersion
      || typeof response.teamName !== "string"
      || !RESOURCE_NAME_PATTERN.test(response.teamName)
    ) {
      throw new Error("AgentTeams isolated response scope is invalid.");
    }
    return { teamName: response.teamName, status: "READY" };
  }

  /** 解析任务服务响应；输入未知 JSON、请求范围和阶段输入，返回严格身份化结果。 */
  private parseTaskResponse(
    value: unknown,
    context: CompetitionAgentTeamsDelegationContext,
    input: CompetitionAgentTeamsTaskInput,
  ): CompetitionAgentTeamsTaskResult {
    if (!isRecord(value)) throw new Error("AgentTeams task response is invalid.");
    const response = value;
    const result = isRecord(response.result) ? response.result : null;
    const route = response.route === null ? null : isRecord(response.route) ? response.route : undefined;
    const transportEvents = Array.isArray(response.transportEvents)
      ? response.transportEvents.map((item) => this.parseTransportEvent(item))
      : null;
    const expectedRole = input.stage === "INVESTIGATION_PLAN"
      ? "worker"
      : input.stage === "INVESTIGATION_CONCLUSION" ? "leader" : "verifier";
    const allowedDecisions = input.stage === "INVESTIGATION_PLAN"
      ? ["COLLECT_EVIDENCE"]
      : input.stage === "INVESTIGATION_CONCLUSION" ? ["REQUEST_APPROVAL", "HALT"] : ["CLOSE", "ROLLBACK_REQUIRED"];
    if (
      response.schema !== TASK_RESULT_SCHEMA
      || response.success !== true
      || response.status !== "COMPLETED"
      || response.requestId !== context.requestId
      || response.workspaceId !== context.workspaceId
      || response.incidentId !== context.incidentId
      || response.traceId !== context.traceId
      || response.teamTemplateId !== context.teamTemplateId
      || response.teamTemplateVersion !== context.teamTemplateVersion
      || response.teamName !== context.teamName
      || response.stage !== input.stage
      || typeof response.taskId !== "string"
      || response.taskId.length < 1
      || response.taskId.length > 128
      || typeof response.completedAt !== "string"
      || response.completedAt.length < 1
      || response.completedAt.length > 128
      || result === null
      || typeof result.roleCardId !== "string"
      || typeof result.agentName !== "string"
      || result.teamRole !== expectedRole
      || typeof result.transportSender !== "string"
      || !MATRIX_USER_ID_PATTERN.test(result.transportSender)
      || typeof result.eventId !== "string"
      || result.eventId.length < 1
      || result.eventId.length > 512
      || typeof result.decision !== "string"
      || !allowedDecisions.includes(result.decision)
      || typeof result.summary !== "string"
      || result.summary.length < 1
      || result.summary.length > 16 * 1024
      || typeof result.confidence !== "number"
      || !Number.isFinite(result.confidence)
      || result.confidence < 0
      || result.confidence > 1
      || !Array.isArray(result.requestedToolNames)
      || !Array.isArray(result.evidenceIds)
      || result.skillName !== input.skill.name
      || result.skillVersion !== input.skill.version
      || typeof result.outputDigest !== "string"
      || !SHA256_PATTERN.test(result.outputDigest)
      || route === undefined
      || transportEvents === null
    ) {
      throw new Error("AgentTeams task response scope is invalid.");
    }
    const member = input.binding.memberSnapshots.find((item) => item.roleCardId === result.roleCardId);
    const toolNames = result.requestedToolNames as unknown[];
    const evidenceIds = result.evidenceIds as unknown[];
    if (
      member?.teamRole !== expectedRole
      || toolNames.length > 32
      || toolNames.some((item) => typeof item !== "string" || !input.availableToolNames.includes(item as CompetitionToolName))
      || new Set(toolNames).size !== toolNames.length
      || evidenceIds.length > 64
      || evidenceIds.some((item) => typeof item !== "string" || !input.evidence.some((evidence) => evidence.evidenceId === item))
      || new Set(evidenceIds).size !== evidenceIds.length
      || (input.stage === "INVESTIGATION_PLAN" && toolNames.length === 0)
      || (input.stage !== "INVESTIGATION_PLAN" && toolNames.length !== 0)
      || (input.stage !== "INVESTIGATION_PLAN" && evidenceIds.length === 0)
      || ((expectedRole === "worker" || expectedRole === "verifier") && route === null)
      || (expectedRole === "leader" && route !== null)
      || !transportEvents.some((event) => event.kind === "TASK_REQUEST" && event.direction === "OUTBOUND")
      || !transportEvents.some((event) => (
        event.kind === "TASK_RESPONSE"
        && event.direction === "INBOUND"
        && event.eventId === result.eventId
        && event.sender === result.transportSender
      ))
      || (expectedRole !== "leader" && !transportEvents.some((event) => event.kind === "ROUTE_REQUEST"))
      || (expectedRole !== "leader" && !transportEvents.some((event) => event.kind === "ROUTE_RESPONSE"))
      || (expectedRole === "leader" && transportEvents.some((event) => event.kind.startsWith("ROUTE_")))
    ) {
      throw new Error("AgentTeams task result exceeded its authorized context.");
    }
    const parsedRoute = route === null ? null : this.parseTaskRoute(route, input, result.roleCardId);
    return {
      taskId: response.taskId,
      stage: input.stage,
      route: parsedRoute,
      result: {
        roleCardId: result.roleCardId,
        agentName: result.agentName.slice(0, 160),
        teamRole: expectedRole,
        transportSender: result.transportSender,
        eventId: result.eventId,
        decision: result.decision as CompetitionAgentTeamsAgentResult["decision"],
        summary: result.summary,
        confidence: result.confidence,
        requestedToolNames: toolNames as CompetitionToolName[],
        evidenceIds: evidenceIds as string[],
        skillName: input.skill.name,
        skillVersion: input.skill.version,
        outputDigest: result.outputDigest,
      },
      transportEvents,
      completedAt: response.completedAt,
    };
  }

  /** 解析单个 Matrix 事件；输入未知事件，返回有界脱敏包络，字段或摘要不合法时拒绝。 */
  private parseTransportEvent(value: unknown): CompetitionAgentTeamsTransportEvent {
    if (!isRecord(value)) throw new Error("AgentTeams transport event is invalid.");
    if (
      !TRANSPORT_EVENT_KINDS.some((kind) => kind === value.kind)
      || (value.direction !== "OUTBOUND" && value.direction !== "INBOUND")
      || typeof value.roomId !== "string"
      || !MATRIX_ROOM_ID_PATTERN.test(value.roomId)
      || typeof value.eventId !== "string"
      || value.eventId.length < 1
      || value.eventId.length > 512
      || typeof value.sender !== "string"
      || !MATRIX_USER_ID_PATTERN.test(value.sender)
      || typeof value.recipient !== "string"
      || !MATRIX_USER_ID_PATTERN.test(value.recipient)
      || (value.originServerTs !== null && (!Number.isSafeInteger(value.originServerTs) || Number(value.originServerTs) < 1))
      || typeof value.observedAt !== "string"
      || value.observedAt.length < 1
      || value.observedAt.length > 128
      || typeof value.redactedBody !== "string"
      || value.redactedBody.length < 1
      || value.redactedBody.length > 64 * 1024
      || typeof value.bodyDigest !== "string"
      || !SHA256_PATTERN.test(value.bodyDigest)
    ) {
      throw new Error("AgentTeams transport event is invalid.");
    }
    return {
      kind: value.kind as CompetitionAgentTeamsTransportEvent["kind"],
      direction: value.direction,
      roomId: value.roomId,
      eventId: value.eventId,
      sender: value.sender,
      recipient: value.recipient,
      originServerTs: value.originServerTs as number | null,
      observedAt: value.observedAt,
      redactedBody: value.redactedBody,
      bodyDigest: value.bodyDigest,
    };
  }

  /** 解析 Leader 路由回执；输入路由对象、任务和目标角色，返回固定审计字段。 */
  private parseTaskRoute(
    route: Record<string, unknown>,
    input: CompetitionAgentTeamsTaskInput,
    assigneeRoleCardId: string,
  ): CompetitionAgentTeamsRouteResult {
    const leader = input.binding.memberSnapshots.find((item) => item.teamRole === "leader");
    if (
      leader === undefined
      || route.leaderRoleCardId !== leader.roleCardId
      || typeof route.leaderName !== "string"
      || typeof route.transportSender !== "string"
      || !MATRIX_USER_ID_PATTERN.test(route.transportSender)
      || route.assigneeRoleCardId !== assigneeRoleCardId
      || typeof route.taskBriefDigest !== "string"
      || !SHA256_PATTERN.test(route.taskBriefDigest)
    ) {
      throw new Error("AgentTeams Leader route is invalid.");
    }
    return {
      leaderRoleCardId: leader.roleCardId,
      leaderName: route.leaderName.slice(0, 160),
      transportSender: route.transportSender,
      assigneeRoleCardId,
      taskBriefDigest: route.taskBriefDigest,
    };
  }

  /** 校验隔离服务根地址；输入配置值，返回保留路径前缀的 HTTPS URL。 */
  private requireEndpoint(value: string): URL {
    const endpoint = new URL(value.trim().replace(/\/?$/u, "/"));
    const hostname = endpoint.hostname.toLowerCase();
    const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
    if (
      endpoint.username
      || endpoint.password
      || endpoint.search
      || endpoint.hash
      || (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopback))
    ) {
      throw new Error("AgentTeams isolated endpoint is not allowed.");
    }
    return endpoint;
  }

  /** 创建稳定幂等请求 ID；输入 Trace、模板和版本，返回固定哈希标识。 */
  private createRequestId(traceId: string, teamTemplateId: string, version: number): string {
    const digest = createHash("sha256")
      .update(`${traceId}:${teamTemplateId}:${version}`, "utf8")
      .digest("hex")
      .slice(0, 32);
    return `agt_${digest}`;
  }

  /** 创建阶段任务幂等 ID；输入任务上下文，返回包含阶段和证据边界的固定哈希。 */
  private createTaskRequestId(input: CompetitionAgentTeamsTaskInput): string {
    const digest = createHash("sha256")
      .update(JSON.stringify({
        traceId: input.traceId,
        teamName: input.binding.teamName,
        stage: input.stage,
        skill: input.skill,
        evidenceIds: input.evidence.map((item) => item.evidenceId),
        planDigest: input.proposedPlan?.planDigest ?? input.action?.planDigest ?? null,
        actionId: input.action?.actionId ?? null,
      }), "utf8")
      .digest("hex")
      .slice(0, 32);
    return `agttask_${digest}`;
  }
}

/** 判断未知值是否为普通对象；输入未知 JSON，返回类型守卫。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取隔离服务公开错误码；输入有界响应字节，返回可用于重试判定的错误码。 */
function parseAgentTeamsPublicErrorCode(bytes: Buffer): string | null {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    if (!isRecord(value) || !isRecord(value.error) || typeof value.error.code !== "string") return null;
    return value.error.code;
  } catch {
    return null;
  }
}
