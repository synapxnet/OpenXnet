/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 团队记忆权限边界 / Team memory permission boundary.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import { createHash } from "node:crypto";
import type {
  ApplicationCompetitionAgentDecision,
  ApplicationCompetitionIncident,
  ApplicationCompetitionSnapshot,
} from "../contracts/application-competition-runtime";

/** 已验证团队的最小身份投影，不包含可授权的自由文本。 / Minimal verified team identity projection without authorizing free text. */
export interface ApplicationCompetitionMemoryAccess {
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly bindingId: string;
  readonly teamName: string;
  readonly memberRoles: readonly {
    readonly roleCardId: string;
    readonly teamRole: ApplicationCompetitionAgentDecision["teamRole"];
  }[];
  readonly decisionRoles: readonly {
    readonly roleCardId: string;
    readonly teamRole: ApplicationCompetitionAgentDecision["teamRole"];
    readonly stage: ApplicationCompetitionAgentDecision["stage"];
    readonly decision: ApplicationCompetitionAgentDecision["decision"];
  }[];
}

/** 主进程持有的发布范围，Builtin 明确没有团队授权。 / Main-owned publication scope with explicit absent authorization for Builtin. */
export interface CompetitionMemoryScope {
  readonly workspaceId: string;
  readonly incidentId: string;
  readonly traceId: string;
  readonly memoryAccess: ApplicationCompetitionMemoryAccess | null;
  readonly agentDecisions?: ApplicationCompetitionMemoryAccess["decisionRoles"];
}

/** 拒绝不完整或跨范围身份，避免从文本推导权限。 / Reject incomplete or cross-scope identities without deriving permissions from text. */
function rejectAccess(): never {
  throw new Error("COMPETITION_MEMORY_ACCESS_INVALID");
}

/** 校验存储身份格式，拒绝通配符和自由文本。 / Validate stored identity format and reject wildcards and free text. */
function validIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/u.test(value);
}

/** 从匹配范围的受信任团队投影计算权限；不读取姓名、提示词或摘要。 / Derive ACL from the trusted scoped team projection, never names, prompts, or summaries. */
export function competitionMemoryPermissions(request: CompetitionMemoryScope): readonly string[] {
  const access = request.memoryAccess;
  if (access === null) {
    if ((request.agentDecisions?.length ?? 0) !== 0) rejectAccess();
    return [];
  }
  if (access === undefined || !validIdentity(request.workspaceId) || !validIdentity(request.incidentId)
    || !validIdentity(request.traceId) || access.workspaceId !== request.workspaceId
    || access.incidentId !== request.incidentId || access.traceId !== request.traceId
    || !validIdentity(access.bindingId) || !validIdentity(access.teamName)
    || !Array.isArray(access.memberRoles) || access.memberRoles.length < 3 || access.memberRoles.length > 128
    || !Array.isArray(access.decisionRoles)) rejectAccess();
  const members = new Map<string, string>();
  for (const member of access.memberRoles) {
    if (member === null || !validIdentity(member.roleCardId) || members.has(member.roleCardId)
      || !["leader", "worker", "verifier"].includes(member.teamRole)) rejectAccess();
    members.set(member.roleCardId, member.teamRole);
  }
  for (const role of ["leader", "verifier"]) {
    if (access.memberRoles.filter(/** 要求唯一受控主控及独立验证者。 / Require one governed leader and one independent verifier. */ member => member.teamRole === role).length !== 1) rejectAccess();
  }
  const stages = new Set<string>();
  const expectations: Readonly<Record<string, readonly string[]>> = {
    INVESTIGATION_PLAN: ["worker", "COLLECT_EVIDENCE"],
    INVESTIGATION_CONCLUSION: ["leader", "REQUEST_APPROVAL"],
    VERIFICATION_CONCLUSION: ["verifier", "CLOSE"],
  };
  for (const decision of access.decisionRoles) {
    if (decision === null || members.get(decision.roleCardId) !== decision.teamRole) rejectAccess();
    const expected = expectations[decision.stage];
    if (expected === undefined || expected[0] !== decision.teamRole || expected[1] !== decision.decision
      || stages.has(decision.stage)) rejectAccess();
    stages.add(decision.stage);
  }
  if (stages.size !== 3) rejectAccess();
  if (request.agentDecisions !== undefined) {
    /** 使用明确角色及阶段比较摘要身份，文本不参与授权。 / Compare explicit summary identities and stages without authorizing text. */
    const identityKey = (item: ApplicationCompetitionMemoryAccess["decisionRoles"][number]): string => JSON.stringify([item.roleCardId, item.teamRole, item.stage, item.decision]);
    if (JSON.stringify(request.agentDecisions.map(identityKey).sort()) !== JSON.stringify(access.decisionRoles.map(identityKey).sort())) rejectAccess();
  }
  return [...members.keys()].sort();
}

/** 从实际持久绑定及已接受决策生成权限描述；Builtin 保持私有。 / Build authorization from persisted bindings and accepted decisions; keep Builtin private. */
export function resolveCompetitionMemoryAccess(
  snapshot: Pick<ApplicationCompetitionSnapshot, "teamBindings" | "agentDecisions">,
  incident: Pick<ApplicationCompetitionIncident, "workspaceId" | "incidentId" | "activeTraceId">,
): ApplicationCompetitionMemoryAccess | null {
  const traceId = incident.activeTraceId;
  if (traceId === null) rejectAccess();
  const bindings = snapshot.teamBindings.filter(/** 选择当前事件追踪，随后严格核对空间。 / Select the current incident trace, then strictly check the workspace. */ item => item.incidentId === incident.incidentId && item.traceId === traceId);
  const decisions = snapshot.agentDecisions.filter(/** 只接受当前事件追踪的已记录决策。 / Select recorded decisions for the current incident trace only. */ item => item.incidentId === incident.incidentId && item.traceId === traceId);
  if (bindings.length === 0 && decisions.length === 0) return null;
  if (bindings.length !== 1) rejectAccess();
  const binding = bindings[0]!;
  if (binding.workspaceId !== incident.workspaceId) rejectAccess();
  if (binding.runtime === "builtin") {
    if (decisions.length !== 0) rejectAccess();
    return null;
  }
  if (binding.runtime !== "agentteams" || binding.status !== "READY") rejectAccess();
  for (const decision of decisions) {
    if (decision.workspaceId !== incident.workspaceId || decision.bindingId !== binding.bindingId
      || decision.teamName !== binding.teamName) rejectAccess();
  }
  const access: ApplicationCompetitionMemoryAccess = {
    workspaceId: incident.workspaceId,
    incidentId: incident.incidentId,
    traceId,
    bindingId: binding.bindingId,
    teamName: binding.teamName,
    memberRoles: binding.memberSnapshots.map(/** 投影真实角色标识，不投影自由文本授权。 / Project actual role identities without free-text authorization. */ member => ({ roleCardId: member.roleCardId, teamRole: member.teamRole })),
    decisionRoles: decisions.map(/** 保留已验证角色和阶段结论。 / Preserve verified identities and stage conclusions. */ decision => ({ roleCardId: decision.roleCardId, teamRole: decision.teamRole, stage: decision.stage, decision: decision.decision })),
  };
  competitionMemoryPermissions({ ...incident, traceId, memoryAccess: access });
  return access;
}

/** 按空间和排序后的实际成员生成稳定 Skill 记忆键，隔离旧全局记录。 / Derive a stable Skill memory key from workspace and sorted actual members, preserving legacy records. */
export function competitionSkillMemoryTaskId(request: CompetitionMemoryScope & { readonly skillId: string }): string {
  if (!validIdentity(request.workspaceId) || !validIdentity(request.skillId)) rejectAccess();
  const memberIds = competitionMemoryPermissions(request);
  const scopeDigest = createHash("sha256").update(JSON.stringify({ workspaceId: request.workspaceId, memberIds }), "utf8").digest("hex");
  return `skill:${request.skillId}:scope:${scopeDigest}`;
}
