/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 独立验证结果核对 / Independent verification result validation.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import type { ApplicationCompetitionIncident, ApplicationCompetitionSnapshot } from "../contracts/application-competition-runtime";
import { getCompetitionScenarioProfile } from "./competition-scenario-registry";

/** 只依赖真实回执与本轮证据核对结果，不从事件终态推导结论。 / Validate actual receipts and current-run evidence without deriving conclusions from incident status. */
export function resolveIndependentVerification(snapshot: ApplicationCompetitionSnapshot, incident: ApplicationCompetitionIncident) {
  /** 严格核对当前事件与运行归属。 / Match the current incident and run scope exactly. */
  const inScope = (item: { workspaceId: string; incidentId: string; traceId: string }) => item.workspaceId === incident.workspaceId
    && item.incidentId === incident.incidentId && item.traceId === incident.activeTraceId;
  const action = snapshot.actions.find(/** 只接受事件明确绑定的当前动作。 / Accept only the action explicitly bound to the incident. */ (item) => inScope(item) && item.actionId === incident.activeActionId);
  const receipt = [...snapshot.auditReceipts].reverse().find(/** 选择当前动作的独立验证回执。 / Select an independently issued verification receipt for this action. */ (item) => inScope(item)
    && item.toolName === "openxnet.remediation.verify" && item.verification?.actionId === action?.actionId
    && item.approvalId === action?.approvalId && Boolean(item.actorId?.trim()) && Boolean(action?.executedBy?.trim()) && item.actorId !== action?.executedBy);
  const detail = receipt?.verification;
  const binding = [...snapshot.teamBindings].reverse().find(inScope);
  const decision = [...snapshot.agentDecisions].reverse().find(/** 校验同团队的独立模型裁决。 / Match the independent model decision to this team. */ (item) => inScope(item)
    && item.stage === "VERIFICATION_CONCLUSION" && item.teamRole === "verifier" && item.bindingId === binding?.bindingId);
  const evidenceIds = detail?.evidenceIds ?? [];
  const evidence = snapshot.evidence.filter(/** 只核对回执实际引用的本次证据。 / Validate only evidence referenced by this receipt in the current run. */ (item) => inScope(item) && evidenceIds.includes(item.evidenceId));
  const requiredTools = getCompetitionScenarioProfile(incident.scenario).verificationCalls.map(/** 提取场景必需的独立探针。 / Read the scenario's required independent probes. */ (item) => item.toolName);
  const evidenceComplete = evidenceIds.length > 0 && new Set(evidenceIds).size === evidenceIds.length
    && evidence.length === evidenceIds.length
    && action?.verificationEvidenceIds.length === evidenceIds.length
    && new Set(action.verificationEvidenceIds).size === evidenceIds.length
    && action.verificationEvidenceIds.every(/** 动作与回执必须引用相同证据集。 / Action and receipt must reference identical evidence sets. */ (id) => evidenceIds.includes(id))
    && requiredTools.every(/** 每个必需探针都要有独立证据。 / Every required probe needs independent evidence. */ (tool) => evidence.some((item) => item.toolName === tool))
    && evidence.every(/** 证据必须来自同验证身份的成功只读调用。 / Evidence must come from successful calls by the same verifier. */ (item) => snapshot.invocations.some((call) => inScope(call) && call.evidenceId === item.evidenceId
      && call.toolName === item.toolName && call.actorId === receipt?.actorId && call.status === "SUCCEEDED"));
  const matchingRuntime = detail !== undefined && binding?.runtime === detail.runtime;
  const independentAgent = detail?.runtime === "builtin" || (decision?.decision === "CLOSE"
    && receipt?.actorId === `agentteams:${decision.roleCardId}`
    && binding?.memberSnapshots.some(/** 核对绑定快照中的实际Verifier成员。 / Match the actual Verifier in the immutable binding. */ (member) => member.teamRole === "verifier" && member.roleCardId === decision.roleCardId));
  const passed = matchingRuntime && detail?.decision === "CLOSE" && detail.errorCode === null
    && receipt?.outcome === "SUCCEEDED" && evidenceComplete && independentAgent;
  const failed = matchingRuntime && (detail?.decision === "ROLLBACK_REQUIRED" || receipt?.outcome === "FAILED");
  return { status: passed ? "PASSED" as const : failed ? "FAILED" as const : "PENDING" as const,
    runtime: detail?.runtime ?? binding?.runtime ?? null, receiptId: receipt?.receiptId ?? null,
    decisionId: decision?.decisionId ?? null, evidenceIds, errorCode: detail?.errorCode ?? null };
}
