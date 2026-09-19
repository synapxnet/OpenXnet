/**
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 真实 Agent 决策的企业群聊投影。 / Enterprise conversation projection of actual Agent decisions.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18 | Version: 1.0.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 */
import { createHash } from "node:crypto";
import type { ApplicationEnterpriseMessage } from "../contracts/application-enterprise-runtime";
import type { ApplicationCompetitionAgentDecision, ApplicationCompetitionSnapshot } from "../contracts/application-competition-runtime";

const STAGES = {
  INVESTIGATION_PLAN: { title: "跨域取证安排", role: "worker" },
  INVESTIGATION_CONCLUSION: { title: "证据汇总与恢复方案", role: "leader" },
  VERIFICATION_CONCLUSION: { title: "独立结果验证", role: "verifier" },
} as const;
const DECISIONS: Readonly<Record<string, string>> = {
  COLLECT_EVIDENCE: "请求跨域取证", REQUEST_APPROVAL: "提交人工审批", HALT: "暂停并补充依据",
  CLOSE: "独立验证通过", ROLLBACK_REQUIRED: "验证未通过，需要补偿或回滚",
};

/** 只保留有界公开摘要，拒绝提示词或推理块并隐藏常见凭据。 / Keep bounded public summaries, reject prompt/reasoning blocks and redact common credentials. */
export function redactAgentConversationSummary(value: string): string {
  if (/(?:<\/?(?:think|analysis|reasoning|system)\b|\b(?:system_prompt|system\s+prompt|runtimeSystemPrompt|chain_of_thought|reasoning_content)\s*[:=：]|系统提示词\s*[:：]|BEGIN [A-Z ]*PRIVATE KEY)/iu.test(value)) {
    return "结构化阶段结果已保存；原始输出包含内部内容，群聊仅展示结论与证据引用。";
  }
  return value.slice(0, 6000)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/giu, "Bearer [已隐藏]")
    .replace(/\b(?:sk|api|token)-[A-Za-z0-9_-]{12,}/giu, "[已隐藏]")
    .replace(/\b(?:oxdemo|oxlive)_[A-Za-z0-9_-]{24,}/giu, "[已隐藏]")
    .replace(/((?:api[_-]?key|access[_-]?token|authorization|password|secret|密码|密钥)\s*["']?\s*[:=：]\s*["']?)[^\s,;"'}]+/giu, "$1[已隐藏]")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu, "$1[已隐藏]@");
}

/** 从已保存的同范围决策构造真实身份消息；不读取或公开传输正文。 / Build identified messages from saved scoped decisions without reading or exposing transport bodies. */
export function buildCompetitionAgentConversation(
  snapshot: ApplicationCompetitionSnapshot,
  decision: ApplicationCompetitionAgentDecision,
): readonly ApplicationEnterpriseMessage[] {
  const incident = snapshot.incidents.find(/** 匹配不可变事件。 / Match the immutable incident. */ item => item.incidentId === decision.incidentId);
  const binding = snapshot.teamBindings.find(/** 匹配实际绑定。 / Match the actual binding. */ item => item.bindingId === decision.bindingId);
  const member = binding?.memberSnapshots.find(/** 根据角色标识取姓名。 / Resolve the name through the role identity. */ item => item.roleCardId === decision.roleCardId);
  const stage = STAGES[decision.stage];
  if (!incident || !binding || binding.runtime !== "agentteams" || !member || !stage
    || incident.workspaceId !== decision.workspaceId || binding.workspaceId !== decision.workspaceId
    || binding.incidentId !== decision.incidentId || binding.traceId !== decision.traceId
    || binding.teamName !== decision.teamName || member.teamRole !== decision.teamRole || member.teamRole !== stage.role
    || !decision.taskId || !decision.eventId || !decision.transportSender || !/^[a-f0-9]{64}$/iu.test(decision.outputDigest)
    || !Number.isFinite(Date.parse(decision.createdAt))) throw new Error("AGENT_CONVERSATION_SOURCE_INVALID");
  if (!snapshot.traces.some(/** 历史Run可不是当前activeTrace，但必须有同事件持久追踪。 / A historical Run need not be active, but requires its own persisted incident trace. */ item => item.traceId === decision.traceId && item.incidentId === decision.incidentId && item.workspaceId === decision.workspaceId)) throw new Error("AGENT_CONVERSATION_TRACE_INVALID");
  const inboundResults = decision.transportEvents.filter(/** 有传输账本时核对实际结果回执。 / Verify actual result receipts when a transport ledger is present. */ item => item.kind === "TASK_RESPONSE" && item.direction === "INBOUND");
  if (inboundResults.length && !inboundResults.some(/** 结果事件与发送方必须一致。 / Result event and sender must match. */ item => item.eventId === decision.eventId && item.sender === decision.transportSender)) throw new Error("AGENT_CONVERSATION_EVENT_INVALID");
  const scopedEvidence = new Set(snapshot.evidence.filter(/** 证据必须属于当前 Run。 / Evidence must belong to this Run. */ item => item.workspaceId === decision.workspaceId && item.incidentId === decision.incidentId && item.traceId === decision.traceId).map(/** 提取证据标识。 / Extract evidence identifiers. */ item => item.evidenceId));
  if (decision.evidenceIds.some(/** 拒绝跨范围证据。 / Reject cross-scope evidence. */ id => !scopedEvidence.has(id))) throw new Error("AGENT_CONVERSATION_EVIDENCE_INVALID");
  const messages: ApplicationEnterpriseMessage[] = [];
  /** 创建有稳定来源标识的消息。 / Create a message with a stable source identity. */
  function make(kind: "handoff" | "result", sender: typeof member, content: string, eventId: string | null, recipient: typeof member | null): ApplicationEnterpriseMessage {
    const id = `agentmsg_${createHash("sha256").update(JSON.stringify([decision.workspaceId, incident!.projectId, decision.incidentId, decision.traceId, decision.taskId, decision.decisionId, kind])).digest("hex")}`;
    return {
      id, workspaceId: decision.workspaceId, projectId: incident!.projectId, taskId: decision.taskId, traceId: decision.traceId,
      senderType: "agent", senderId: sender!.roleCardId, senderName: sender!.name, recipientIds: recipient ? [recipient.roleCardId] : [],
      mentions: recipient ? [{ roleCardId: recipient.roleCardId, name: recipient.name }] : [], kind: "text", content,
      operation: null, status: "delivered", createdAt: decision.createdAt,
      collaboration: { kind, incidentId: decision.incidentId, bindingId: decision.bindingId, decisionId: decision.decisionId,
        stage: decision.stage, teamRole: sender!.teamRole, decision: decision.decision, evidenceIds: kind === "result" ? [...decision.evidenceIds] : [],
        toolNames: kind === "result" ? [...decision.requestedToolNames] : [], eventId, outputDigest: kind === "handoff" ? decision.taskBriefDigest! : decision.outputDigest },
    };
  }
  if (decision.routedByRoleCardId !== null) {
    const leader = binding.memberSnapshots.find(/** 只接受绑定中的 Leader。 / Accept the Leader in the binding only. */ item => item.roleCardId === decision.routedByRoleCardId && item.teamRole === "leader");
    if (!leader || !decision.routedByTransportSender || !/^[a-f0-9]{64}$/iu.test(decision.taskBriefDigest ?? "")) throw new Error("AGENT_CONVERSATION_ROUTE_INVALID");
    const routeEvent = decision.transportEvents.find(/** 只引用 Leader 的真实路由回执。 / Reference only the Leader's actual route receipt. */ item => item.kind === "ROUTE_RESPONSE" && item.direction === "INBOUND" && item.sender === decision.routedByTransportSender);
    if (decision.transportEvents.some(/** 有路由账本就要求其身份匹配。 / Require matching identities whenever a route ledger exists. */ item => item.kind === "ROUTE_RESPONSE") && !routeEvent) throw new Error("AGENT_CONVERSATION_ROUTE_EVENT_INVALID");
    messages.push(make("handoff", leader, `已将「${stage.title}」交接给 ${member.name}。\n任务输入已按当前事件和运行范围交付。`, routeEvent?.eventId ?? null, member));
  }
  const summary = redactAgentConversationSummary(decision.summary).trim();
  messages.push(make("result", member, `${stage.title} · ${DECISIONS[decision.decision] ?? "阶段结果"}\n${summary || "已提交结构化阶段结果。"}`, decision.eventId, null));
  return messages;
}
