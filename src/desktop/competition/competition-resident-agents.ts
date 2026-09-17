/**
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 驻场 Agent 权限与上下文 / Resident agent permissions and context.
 * Author: maoyo
 * Department: 研发部
 * Date: 2026-09-15
 * Version: 1.3.0
 * Security Level: INTERNAL
 */
import type {
  ApplicationCompetitionResidentAgent,
  ApplicationCompetitionResidentContext,
  ApplicationCompetitionResidentEvent,
  ApplicationCompetitionResidentCapability,
} from "../contracts/application-competition-runtime";
import { getCompetitionToolDescriptor, type CompetitionToolName } from "./competition-tool-registry";

/** 决赛驻场 Agent 契约版本；所有平台 Adapter 必须声明同一版本。 / Finals resident-agent contract version shared by all platform adapters. */
export const COMPETITION_RESIDENT_AGENT_CONTRACT_VERSION = "finals-v1.3.0" as const;

/** 驻场 Agent 的固定能力白名单；能力名称不可由模型动态扩展。 / Fixed resident-agent capability allowlist; models cannot extend it dynamically. */
export const COMPETITION_RESIDENT_AGENT_CAPABILITIES = Object.freeze([
  "health.preflight",
  "evidence.collect",
  "diagnosis.explain",
  "collaboration.request",
  "local.check",
  "chat.respond",
] as const);

/** 三个平台驻场 Agent 的固定身份；只读能力和平台边界在构建期冻结。 / Fixed identities with read-only capabilities and platform boundaries frozen at build time. */
const COMPETITION_RESIDENT_AGENT_DEFINITIONS: readonly ApplicationCompetitionResidentAgent[] = Object.freeze([
  {
    agentId: "agt-aiops-resident-v130",
    platform: "aiops",
    role: "AIOPS_RESIDENT_AGENT",
    displayName: "XnetAIOps Resident Agent",
    agentVersion: "1.3.0",
    contractVersion: COMPETITION_RESIDENT_AGENT_CONTRACT_VERSION,
    status: "REGISTERED",
    capabilities: COMPETITION_RESIDENT_AGENT_CAPABILITIES,
    allowedTools: Object.freeze([
      "aiops.alert.get",
      "aiops.service.health",
      "aiops.k8s.workload.get",
      "aiops.inference.metrics.get",
      "aiops.inference.recovery.status",
    ]) as readonly CompetitionToolName[],
  },
  {
    agentId: "agt-dataops-resident-v130",
    platform: "dataops",
    role: "DATAOPS_RESIDENT_AGENT",
    displayName: "XnetDataOps Resident Agent",
    agentVersion: "1.3.0",
    contractVersion: COMPETITION_RESIDENT_AGENT_CONTRACT_VERSION,
    status: "REGISTERED",
    capabilities: COMPETITION_RESIDENT_AGENT_CAPABILITIES,
    allowedTools: Object.freeze([
      "dataops.quality.report.get",
      "dataops.schema.snapshot.get",
      "dataops.lineage.get",
      "dataops.workflow.instance.get",
      "dataops.dataset.validation.get",
    ]) as readonly CompetitionToolName[],
  },
  {
    agentId: "agt-mlops-resident-v130",
    platform: "mlops",
    role: "MLOPS_RESIDENT_AGENT",
    displayName: "XnetMLOps Resident Agent",
    agentVersion: "1.3.0",
    contractVersion: COMPETITION_RESIDENT_AGENT_CONTRACT_VERSION,
    status: "REGISTERED",
    capabilities: COMPETITION_RESIDENT_AGENT_CAPABILITIES,
    allowedTools: Object.freeze([
      "mlops.deployment.get",
      "mlops.attribution.report.get",
      "mlops.inference.probe",
      "mlops.release.validation.get",
    ]) as readonly CompetitionToolName[],
  },
]);

/** 运行时驻场 Agent 错误；错误码稳定用于 UI 和审计，不泄漏平台凭据。 / Stable resident-agent error for UI and audit without leaking credentials. */
export class CompetitionResidentAgentError extends Error {
  /** 创建驻场 Agent 领域错误；输入固定错误码和消息，无外部副作用。 / Create a domain error from a stable code and message. */
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CompetitionResidentAgentError";
  }
}

/** 返回三平台默认驻场 Agent 的隔离副本；输入无，返回不可被调用方修改的身份列表。 / Return isolated default resident identities. */
export function createDefaultResidentAgents(): readonly ApplicationCompetitionResidentAgent[] {
  return COMPETITION_RESIDENT_AGENT_DEFINITIONS.map(/** 复制所有可变集合以隔离调用方。 / Copy mutable collections to isolate the caller. */ (agent) => ({
    ...agent,
    capabilities: [...agent.capabilities],
    allowedTools: [...agent.allowedTools],
  }));
}

/** 为一次 Run 生成驻场 Agent 最小上下文；输入运行标识和 TTL，返回不含密钥的上下文。 / Build the minimal credential-free context for one run. */
export function createResidentContext(
  agent: ApplicationCompetitionResidentAgent,
  input: {
    readonly workspaceId: string;
    readonly environment: "staging" | "production";
    readonly source: "LIVE-STAGING" | "REPLAY" | "SIMULATION";
    readonly runId: string;
    readonly incidentId: string;
    readonly traceId: string;
    readonly contextVersion?: string;
    readonly contextTtl: string;
    readonly evidenceRefs?: readonly string[];
  },
): ApplicationCompetitionResidentContext {
  const contextVersion = input.contextVersion ?? "ctx-1";
  const evidenceRefs = [...new Set(input.evidenceRefs ?? [])];
  const context: ApplicationCompetitionResidentContext = {
    workspaceId: input.workspaceId,
    environment: input.environment,
    source: input.source,
    runId: input.runId,
    incidentId: input.incidentId,
    traceId: input.traceId,
    agentId: agent.agentId,
    platform: agent.platform,
    contextVersion,
    contextTtl: input.contextTtl,
    evidenceRefs,
    allowedTools: [...agent.allowedTools],
  };
  return context;
}

/** 校验驻场上下文归属、TTL 和工具边界；过期或越权时抛出稳定领域错误。 / Validate ownership, TTL and tool scope, rejecting stale or cross-platform contexts. */
export function assertResidentContext(
  context: ApplicationCompetitionResidentContext,
  now: Date = new Date(),
): void {
  if (!context.runId || !context.incidentId || !context.traceId || !context.workspaceId) {
    throw new CompetitionResidentAgentError("RESIDENT_CONTEXT_INVALID", "驻场 Agent 上下文缺少 Run 归属字段。" );
  }
  const definition = COMPETITION_RESIDENT_AGENT_DEFINITIONS.find(/** 从可信注册表查找固定身份。 / Resolve a fixed identity from the trusted registry. */ (agent) => agent.agentId === context.agentId);
  if (definition === undefined || definition.platform !== context.platform
    || !["LIVE-STAGING", "REPLAY", "SIMULATION"].includes(context.source)
    || !["staging", "production"].includes(context.environment)
    || context.evidenceRefs.length > 512 || context.evidenceRefs.some(/** 限制引用格式和长度。 / Bound reference shape and length. */ (reference) => typeof reference !== "string" || !reference || reference.length > 256)) {
    throw new CompetitionResidentAgentError("RESIDENT_CONTEXT_SCOPE_MISMATCH", "驻场 Agent 的身份、平台或证据引用无效。");
  }
  const expiry = Date.parse(context.contextTtl);
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) {
    throw new CompetitionResidentAgentError("RESIDENT_CONTEXT_EXPIRED", "驻场 Agent 上下文已过期，必须重新取证。" );
  }
  if (!/^ctx-[1-9][0-9]*$/u.test(context.contextVersion)) {
    throw new CompetitionResidentAgentError("RESIDENT_CONTEXT_INVALID", "驻场 Agent 上下文版本无效。" );
  }
  const uniqueTools = new Set(context.allowedTools);
  if (uniqueTools.size !== context.allowedTools.length) {
    throw new CompetitionResidentAgentError("RESIDENT_SCOPE_INVALID", "驻场 Agent 工具白名单存在重复项。" );
  }
  for (const toolName of context.allowedTools) {
    if (!definition.allowedTools.includes(toolName)) {
      throw new CompetitionResidentAgentError("RESIDENT_TOOL_FORBIDDEN", "驻场 Agent 工具不在固定白名单内。");
    }
    const descriptor = getCompetitionToolDescriptor(toolName as CompetitionToolName);
    if (descriptor.platform !== context.platform || descriptor.requiresApproval) {
      throw new CompetitionResidentAgentError("RESIDENT_TOOL_FORBIDDEN", "驻场 Agent 只能调用本平台只读工具。" );
    }
  }
}

/** 检查驻场 Agent 是否可以调用指定工具；输入 Agent 和工具名，越权时抛出领域错误。 / Check whether a resident agent may invoke a tool. */
export function assertResidentToolAccess(
  agent: ApplicationCompetitionResidentAgent,
  toolName: CompetitionToolName,
): void {
  const definition = COMPETITION_RESIDENT_AGENT_DEFINITIONS.find(/** 以构建期身份约束传入 manifest。 / Constrain the supplied manifest with its build-time identity. */ (item) => item.agentId === agent.agentId);
  const descriptor = getCompetitionToolDescriptor(toolName);
  if (definition === undefined || definition.platform !== agent.platform || !definition.allowedTools.includes(toolName)
    || descriptor.platform !== agent.platform || descriptor.requiresApproval || !agent.allowedTools.includes(toolName)) {
    throw new CompetitionResidentAgentError("RESIDENT_TOOL_FORBIDDEN", `${agent.displayName} 无权调用该平台工具。`);
  }
}

/** 为跨平台因果或越权请求生成协同升级事件；本地事件不改变 Incident 终态。 / Create a collaboration escalation event without changing incident terminal state. */
export function createResidentCollaborationRequest(
  context: ApplicationCompetitionResidentContext,
  agent: ApplicationCompetitionResidentAgent,
  reason: string,
  now: string,
): ApplicationCompetitionResidentEvent {
  assertResidentContext(context, new Date(now));
  if (agent.agentId !== context.agentId || agent.platform !== context.platform) {
    throw new CompetitionResidentAgentError("RESIDENT_CONTEXT_SCOPE_MISMATCH", "驻场 Agent 与上下文平台不匹配。" );
  }
  const normalizedReason = reason.trim();
  if (!normalizedReason || normalizedReason.length > 2048) {
    throw new CompetitionResidentAgentError("RESIDENT_EVENT_INVALID", "协同请求原因无效。" );
  }
  return {
    eventId: `evt-${context.runId}-${agent.platform}-collaboration`,
    scope: "CROSS_PLATFORM",
    eventType: "COLLABORATION_REQUESTED",
    workspaceId: context.workspaceId,
    source: context.source,
    environment: context.environment,
    runId: context.runId,
    incidentId: context.incidentId,
    traceId: context.traceId,
    agentId: agent.agentId,
    platform: agent.platform,
    contextVersion: context.contextVersion,
    contextTtl: context.contextTtl,
    evidenceRefs: [...context.evidenceRefs],
    reason: normalizedReason,
    occurredAt: now,
  };
}

/** 将驻场事件标记为平台本地或跨平台；输入事件类型，返回审计 scope。 / Classify a resident event as local or cross-platform for the audit ledger. */
export function residentEventScope(eventType: ApplicationCompetitionResidentEvent["eventType"]): ApplicationCompetitionResidentEvent["scope"] {
  return eventType === "COLLABORATION_REQUESTED" ? "CROSS_PLATFORM" : "PLATFORM_LOCAL";
}

/** 将能力文本映射为固定能力类型；输入未知文本，返回允许值或抛出错误。 / Parse a capability into the fixed capability union. */
export function parseResidentCapability(value: unknown): ApplicationCompetitionResidentCapability {
  if (typeof value !== "string" || !(COMPETITION_RESIDENT_AGENT_CAPABILITIES as readonly string[]).includes(value)) {
    throw new CompetitionResidentAgentError("RESIDENT_CAPABILITY_INVALID", "驻场 Agent 能力不在决赛白名单内。" );
  }
  return value as ApplicationCompetitionResidentCapability;
}
