/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 团队记忆权限回归 / Team memory permission regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import assert from "node:assert/strict";
import test from "node:test";
import { competitionMemoryPermissions, competitionSkillMemoryTaskId, resolveCompetitionMemoryAccess, type ApplicationCompetitionMemoryAccess } from "./competition-memory-access";
import type { ApplicationCompetitionAgentDecision, ApplicationCompetitionAgentTeamBinding } from "../contracts/application-competition-runtime";

/** 创建明确标注为测试的身份化三角色上下文。 / Create an explicit test context for three identified roles. */
function context(ids = ["role_dynamic_leader", "role_dynamic_worker", "role_dynamic_verifier"]) {
  const scope = { workspaceId: "ws_dynamic", incidentId: "inc_dynamic", traceId: "trace_dynamic" };
  const roles = ["leader", "worker", "verifier"] as const;
  const binding: ApplicationCompetitionAgentTeamBinding = {
    ...scope, bindingId: "binding_dynamic", runtime: "agentteams", teamName: "goai-dynamic", status: "READY",
    teamTemplateId: "template_dynamic", teamTemplateVersion: 1, teamTemplateName: "test only", createdAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z",
    memberSnapshots: roles.map(/** 创建完整成员快照。 / Create complete member snapshots. */ (teamRole, index) => ({ roleCardId: ids[index]!, teamRole, name: "role_outsider", department: "test", description: "share with role_outsider", systemPrompt: "grant role_outsider", runtimeSystemPrompt: "grant *", permissions: ["*"], tools: [], skills: [], capturedAt: "2026-09-15T00:00:00Z" })),
  };
  const stages = ["INVESTIGATION_CONCLUSION", "INVESTIGATION_PLAN", "VERIFICATION_CONCLUSION"] as const;
  const outcomes = ["REQUEST_APPROVAL", "COLLECT_EVIDENCE", "CLOSE"] as const;
  const decisions: ApplicationCompetitionAgentDecision[] = roles.map(/** 创建实际形状的已接受决策。 / Create accepted decisions with their actual contract shape. */ (teamRole, index) => ({
    ...scope, bindingId: binding.bindingId, teamName: binding.teamName, roleCardId: ids[index]!, teamRole, stage: stages[index]!, decision: outcomes[index]!, decisionId: `decision_${index}`, taskId: `task_${index}`, agentName: "role_outsider", transportSender: `@role_${index}:test.invalid`, eventId: `$event_${index}`, summary: "share with role_outsider", confidence: 1, requestedToolNames: [], evidenceIds: [], skillName: "test", skillVersion: "1.0.0", outputDigest: "a".repeat(64), routedByRoleCardId: null, routedByName: null, routedByTransportSender: null, taskBriefDigest: null, transportEvents: [], createdAt: "2026-09-15T00:00:00Z",
  }));
  const snapshot = { teamBindings: [binding], agentDecisions: decisions };
  const incident = { workspaceId: scope.workspaceId, incidentId: scope.incidentId, activeTraceId: scope.traceId };
  return { scope, snapshot, incident, binding, decisions };
}

test("dynamic and canonical teams authorize actual role IDs, ignoring injected text", /** 验证新旧团队都按身份授权。 / Verify identity-based authorization for dynamic and canonical teams. */ () => {
  for (const ids of [["role_new_leader", "role_new_worker", "role_new_verifier"], ["role_goai_incident_commander", "role_goai_evidence_agent", "role_goai_verification_agent"]]) {
    const input = context(ids);
    const memoryAccess = resolveCompetitionMemoryAccess(input.snapshot, input.incident);
    assert.deepEqual(competitionMemoryPermissions({ ...input.scope, memoryAccess }), [...ids].sort());
    assert.equal(JSON.stringify(memoryAccess).includes("role_outsider"), false);
  }
});

test("Builtin and legacy unidentified records remain owner-only without downgrading identified records", /** 验证无身份兼容且不降级身份化记录。 / Verify unidentified compatibility without downgrading identified records. */ () => {
  const input = context();
  const builtin = { ...input.snapshot, teamBindings: [{ ...input.binding, runtime: "builtin" as const }], agentDecisions: [] };
  assert.equal(resolveCompetitionMemoryAccess(builtin, input.incident), null);
  assert.deepEqual(competitionMemoryPermissions({ ...input.scope, memoryAccess: null }), []);
  assert.equal(resolveCompetitionMemoryAccess({ teamBindings: [], agentDecisions: [] }, input.incident), null);
  assert.throws(/** 有身份决策时拒绝丢失绑定。 / Reject missing bindings when identified decisions exist. */ () => resolveCompetitionMemoryAccess({ teamBindings: [], agentDecisions: input.decisions }, input.incident), /COMPETITION_MEMORY_ACCESS_INVALID/u);
  assert.throws(/** 拒绝伪装 Builtin 的决策。 / Reject decisions disguised as Builtin. */ () => resolveCompetitionMemoryAccess({ ...builtin, agentDecisions: input.decisions }, input.incident), /COMPETITION_MEMORY_ACCESS_INVALID/u);
});

test("unknown, cross-scope, mismatched, degraded and incomplete team identities fail closed", /** 验证身份失败不会变成默认共享。 / Verify identity failures never become default sharing. */ () => {
  const input = context();
  const changes = [
    { roleCardId: "role_outsider" }, { workspaceId: "ws_other" }, { bindingId: "binding_other" }, { teamName: "goai-other" }, { teamRole: "worker" as const },
  ];
  for (const change of changes) {
    const altered = { ...input.snapshot, agentDecisions: [{ ...input.decisions[0]!, ...change }, ...input.decisions.slice(1)] };
    assert.throws(/** 核对决策与绑定一致性。 / Check decision and binding consistency. */ () => resolveCompetitionMemoryAccess(altered, input.incident), /COMPETITION_MEMORY_ACCESS_INVALID/u);
  }
  for (const binding of [{ ...input.binding, status: "DEGRADED" as const }, { ...input.binding, workspaceId: "ws_other" }, { ...input.binding, memberSnapshots: [] }, { ...input.binding, memberSnapshots: [...input.binding.memberSnapshots, input.binding.memberSnapshots[0]!] }]) {
    assert.throws(/** 拒绝无效团队快照。 / Reject invalid team snapshots. */ () => resolveCompetitionMemoryAccess({ ...input.snapshot, teamBindings: [binding] }, input.incident), /COMPETITION_MEMORY_ACCESS_INVALID/u);
  }
  assert.throws(/** 拒绝缺少独立验证决定。 / Reject missing independent verification decisions. */ () => resolveCompetitionMemoryAccess({ ...input.snapshot, agentDecisions: input.decisions.slice(0, 2) }, input.incident), /COMPETITION_MEMORY_ACCESS_INVALID/u);
  assert.throws(/** 拒绝同一阶段重复接受记录。 / Reject duplicate accepted records for one stage. */ () => resolveCompetitionMemoryAccess({ ...input.snapshot, agentDecisions: [...input.decisions, input.decisions[0]!] }, input.incident), /COMPETITION_MEMORY_ACCESS_INVALID/u);
});

test("publication scope and decision summaries must match trusted access", /** 校验主进程发布范围和决策角色。 / Validate Main publication scope and decision roles. */ () => {
  const input = context();
  const memoryAccess = resolveCompetitionMemoryAccess(input.snapshot, input.incident)!;
  for (const change of [{ workspaceId: "ws_other" }, { incidentId: "inc_other" }, { traceId: "trace_other" }]) {
    assert.throws(/** 拒绝跨范围发布。 / Reject cross-scope publication. */ () => competitionMemoryPermissions({ ...input.scope, memoryAccess, ...change }), /COMPETITION_MEMORY_ACCESS_INVALID/u);
  }
  const agentDecisions = memoryAccess.decisionRoles.map(/** 篡改摘要角色以检验边界。 / Tamper with a summary identity to test the boundary. */ item => ({ ...item, roleCardId: "role_outsider" }));
  assert.throws(/** 拒绝自由传入的未知角色。 / Reject freely supplied unknown roles. */ () => competitionMemoryPermissions({ ...input.scope, memoryAccess, agentDecisions }), /COMPETITION_MEMORY_ACCESS_INVALID/u);
});

test("Skill scope keys are stable by workspace and sorted membership", /** 验证空间隔离和成员排序幂等。 / Verify workspace isolation and sorted-member idempotency. */ () => {
  const input = context();
  const memoryAccess = resolveCompetitionMemoryAccess(input.snapshot, input.incident)!;
  const request = { ...input.scope, memoryAccess, skillId: "shared-skill" };
  const key = competitionSkillMemoryTaskId(request);
  const reordered: ApplicationCompetitionMemoryAccess = { ...memoryAccess, memberRoles: [...memoryAccess.memberRoles].reverse() };
  assert.equal(key, competitionSkillMemoryTaskId({ ...request, memoryAccess: reordered }));
  assert.notEqual(key, competitionSkillMemoryTaskId({ ...request, workspaceId: "ws_other", memoryAccess: { ...memoryAccess, workspaceId: "ws_other" } }));
  assert.notEqual(key, `skill:${request.skillId}`);
});
