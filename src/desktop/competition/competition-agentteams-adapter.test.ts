import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationEnterpriseResolvedTeamTemplate } from "../contracts/application-enterprise-runtime";
import type {
  ApplicationCompetitionAgentTeamBinding,
  ApplicationCompetitionIncident,
} from "../contracts/application-competition-runtime";
import { HttpCompetitionAgentTeamsAdapter } from "./competition-agentteams-adapter";

/** 创建测试 Incident；无输入，返回最小完整领域记录。 */
function incident(): ApplicationCompetitionIncident {
  return {
    incidentId: "inc_goai_demo",
    workspaceId: "ws_goai_demo",
    title: "Test",
    summary: "Test incident",
    severity: "P1",
    status: "OPEN",
    scenario: {
      scenarioType: "feature-drift",
      alertUid: "alert", serviceUid: "service", clusterId: "cluster", namespace: "default",
      workloadName: "workload", reportUid: "report", assetUid: "asset", workflowInstanceUid: "workflow",
      deploymentUid: "deployment", failingRevision: 2, targetRevision: 1, expectedResourceVersion: "1",
      testDatasetRef: "fixture://test",
    },
    createdBy: "user",
    createdAt: "2026-08-03T08:00:00.000Z",
    updatedAt: "2026-08-03T08:00:00.000Z",
    resolvedAt: null,
    activeTraceId: null,
    activeApprovalId: null,
    activeActionId: null,
  };
}

/** 创建三个角色的已解析团队模板；无输入，返回完整企业记录。 */
function resolvedTemplate(): ApplicationEnterpriseResolvedTeamTemplate {
  /** 创建单个测试角色卡；输入角色标识和名称，返回满足企业契约的固定记录。 */
  const card = (id: string, name: string) => ({
    id, name, description: `${name} description`, system_prompt: `${name} prompt`, permissions: ["read"], tools: [],
    enabled: true, department: "Engineering", icon: "", skills: ["openxnet.evidence"], skill_ids: [],
    assignedWorkspace: "", projectId: "", templateId: "", category: "", categoryZh: "", categoryEn: "",
    summaryZh: "", summaryEn: "", accent: [], runtime_system_prompt: `${name} runtime`, agent_name: name,
    role_scope: "enterprise", syncSource: "enterprise", bodyType: "default", position3D: null,
    created_at: "2026-08-03 08:00:00", updated_at: "2026-08-03 08:00:00",
  });
  const roleCards = [card("role_leader", "Leader"), card("role_worker", "Worker"), card("role_verifier", "Verifier")];
  return {
    teamTemplate: {
      id: "team_goai_demo",
      schemaVersion: 1,
      version: 2,
      name: "GOAI Team",
      description: "Team",
      workspaceId: "ws_goai_demo",
      enabled: true,
      members: [
        { roleCardId: "role_leader", teamRole: "leader" },
        { roleCardId: "role_worker", teamRole: "worker" },
        { roleCardId: "role_verifier", teamRole: "verifier" },
      ],
      created_at: "2026-08-03 08:00:00",
      updated_at: "2026-08-03 08:00:00",
    },
    roleCards,
  };
}

/** 创建 READY 的 AgentTeams Binding；输入 Incident，返回三角色固定快照。 */
function agentTeamBinding(sourceIncident: ApplicationCompetitionIncident): ApplicationCompetitionAgentTeamBinding {
  const template = resolvedTemplate();
  return {
    bindingId: "binding_goai_demo",
    workspaceId: sourceIncident.workspaceId,
    incidentId: sourceIncident.incidentId,
    traceId: "trace_goai_demo",
    runtime: "agentteams",
    teamName: "goai-1234567890abcdef",
    status: "READY",
    teamTemplateId: "team_goai_demo",
    teamTemplateVersion: 2,
    teamTemplateName: "GOAI Team",
    memberSnapshots: template.teamTemplate.members.map((member, index) => ({
      roleCardId: member.roleCardId,
      name: template.roleCards[index]?.name ?? member.roleCardId,
      department: "Engineering",
      description: "role",
      teamRole: member.teamRole,
      systemPrompt: "system",
      runtimeSystemPrompt: "runtime",
      permissions: ["read"],
      tools: [],
      skills: ["goai-evidence-collect"],
      capturedAt: "2026-08-03T08:00:00.000Z",
    })),
    createdAt: "2026-08-03T08:00:00.000Z",
    updatedAt: "2026-08-03T08:00:00.000Z",
  };
}

test("HTTP AgentTeams adapter sends a scoped snapshot and accepts only matching READY results", async () => {
  let capturedAuthorization = "";
  let capturedBody: Record<string, unknown> = {};
  const adapter = new HttpCompetitionAgentTeamsAdapter({
    resolveEndpoint: async () => "https://goai.example.test/agentteams-adapter/",
    resolveDelegationToken: async () => "delegation.jwt.token.with.at.least.sixty.four.characters.1234567890",
    fetchResource: async (input, init) => {
      capturedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        schema: "openxnet.agentteams.prepare-result.v1",
        success: true,
        requestId: capturedBody.requestId,
        workspaceId: capturedBody.workspaceId,
        incidentId: capturedBody.incidentId,
        traceId: capturedBody.traceId,
        teamTemplateId: capturedBody.teamTemplateId,
        teamTemplateVersion: capturedBody.teamTemplateVersion,
        teamName: "goai-1234567890abcdef",
        status: "READY",
      }), { status: 200 });
    },
  });
  const result = await adapter.prepare(incident(), "trace_goai_demo", resolvedTemplate());
  assert.equal(result.status, "READY");
  assert.match(capturedAuthorization, /^Bearer /u);
  assert.equal(capturedBody.teamTemplateId, "team_goai_demo");
  assert.equal((capturedBody.members as readonly unknown[]).length, 3);
  assert.equal(JSON.stringify(capturedBody).includes("authToken"), false);
});

test("HTTP AgentTeams adapter dispatches a scoped Skill task and validates Matrix identity", async () => {
  let capturedBody: Record<string, unknown> = {};
  let delegatedStage = "";
  const adapter = new HttpCompetitionAgentTeamsAdapter({
    resolveEndpoint: async () => "https://goai.example.test/agentteams-adapter/",
    resolveDelegationToken: async (context) => {
      delegatedStage = context.stage ?? "";
      return "delegation.jwt.token.with.at.least.sixty.four.characters.1234567890";
    },
    fetchResource: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        schema: "openxnet.agentteams.task-result.v1",
        success: true,
        requestId: capturedBody.requestId,
        workspaceId: capturedBody.workspaceId,
        incidentId: capturedBody.incidentId,
        traceId: capturedBody.traceId,
        teamTemplateId: capturedBody.teamTemplateId,
        teamTemplateVersion: capturedBody.teamTemplateVersion,
        teamName: capturedBody.teamName,
        stage: capturedBody.stage,
        taskId: "task-investigation-plan",
        status: "COMPLETED",
        route: {
          leaderRoleCardId: "role_leader",
          leaderName: "Leader",
          transportSender: "@leader:agentteams.test",
          assigneeRoleCardId: "role_worker",
          taskBriefDigest: "a".repeat(64),
        },
        result: {
          roleCardId: "role_worker",
          agentName: "Worker",
          teamRole: "worker",
          transportSender: "@worker:agentteams.test",
          eventId: "$worker-event",
          decision: "COLLECT_EVIDENCE",
          summary: "读取跨平台证据。",
          confidence: 0.94,
          requestedToolNames: ["aiops.alert.get", "dataops.schema.snapshot.get", "mlops.deployment.get"],
          evidenceIds: [],
          skillName: "goai-evidence-collect",
          skillVersion: "1.1.0",
          outputDigest: "b".repeat(64),
        },
        completedAt: "2026-08-03T08:01:00.000Z",
      }), { status: 200 });
    },
  });
  const sourceIncident = incident();
  const binding = agentTeamBinding(sourceIncident);
  const result = await adapter.dispatch({
    incident: sourceIncident,
    traceId: binding.traceId,
    binding,
    stage: "INVESTIGATION_PLAN",
    skill: { name: "goai-evidence-collect", version: "1.1.0" },
    availableToolNames: ["aiops.alert.get", "dataops.schema.snapshot.get", "mlops.deployment.get"],
    evidence: [],
    proposedPlan: null,
    action: null,
  });
  assert.equal(delegatedStage, "INVESTIGATION_PLAN");
  assert.equal(result.result.transportSender, "@worker:agentteams.test");
  assert.equal(result.route?.leaderRoleCardId, "role_leader");
  assert.equal((capturedBody.skill as Record<string, unknown>).version, "1.1.0");
  const context = capturedBody.context as Record<string, unknown>;
  const policy = context.policy as Record<string, unknown>;
  const approvalRequiredTools = policy.approvalRequiredTools as readonly string[];
  assert.ok(approvalRequiredTools.length > 3);
  assert.ok(approvalRequiredTools.includes("aiops.inference.capacity.apply"));
  assert.ok(approvalRequiredTools.includes("dataops.feature.backfill.start"));
  assert.ok(approvalRequiredTools.includes("mlops.deployment.rollback"));
  assert.equal(JSON.stringify(capturedBody).includes("systemPrompt"), false);
});

test("HTTP AgentTeams adapter gives unversioned evidence an immutable content reference", async () => {
  let capturedBody: Record<string, unknown> = {};
  const sourceIncident = incident();
  const binding = agentTeamBinding(sourceIncident);
  const evidenceId = "evidence_workflow_instance";
  const contentDigest = "c".repeat(64);
  const adapter = new HttpCompetitionAgentTeamsAdapter({
    resolveEndpoint: async () => "https://goai.example.test/agentteams-adapter/",
    resolveDelegationToken: async () => "delegation.jwt.token.with.at.least.sixty.four.characters.1234567890",
    fetchResource: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        schema: "openxnet.agentteams.task-result.v1",
        success: true,
        requestId: capturedBody.requestId,
        workspaceId: capturedBody.workspaceId,
        incidentId: capturedBody.incidentId,
        traceId: capturedBody.traceId,
        teamTemplateId: capturedBody.teamTemplateId,
        teamTemplateVersion: capturedBody.teamTemplateVersion,
        teamName: capturedBody.teamName,
        stage: capturedBody.stage,
        taskId: "task-investigation-conclusion",
        status: "COMPLETED",
        route: null,
        result: {
          roleCardId: "role_leader",
          agentName: "Leader",
          teamRole: "leader",
          transportSender: "@leader:agentteams.test",
          eventId: "$leader-event",
          decision: "REQUEST_APPROVAL",
          summary: "证据充分，申请人工审批。",
          confidence: 0.93,
          requestedToolNames: [],
          evidenceIds: [evidenceId],
          skillName: "goai-change-execute",
          skillVersion: "1.1.0",
          outputDigest: "d".repeat(64),
        },
        completedAt: "2026-08-03T08:02:00.000Z",
      }), { status: 200 });
    },
  });
  await adapter.dispatch({
    incident: sourceIncident,
    traceId: binding.traceId,
    binding,
    stage: "INVESTIGATION_CONCLUSION",
    skill: { name: "goai-change-execute", version: "1.1.0" },
    availableToolNames: ["mlops.deployment.rollback"],
    evidence: [{
      evidenceId,
      workspaceId: sourceIncident.workspaceId,
      incidentId: sourceIncident.incidentId,
      traceId: binding.traceId,
      toolName: "dataops.workflow.instance.get",
      platform: "dataops",
      summary: "工作流实例读取成功。",
      resourceVersion: "",
      observedAt: "2026-08-03T08:01:00.000Z",
      contentDigest,
      data: {
        status: "READY",
        passed: true,
        errorRate: 0.002,
        internalToken: "must-not-project",
        nestedPayload: { secret: true },
      },
    }],
    proposedPlan: {
      planId: "feature-drift-full-recovery-v2",
      planDigest: "e".repeat(64),
      steps: [{
        stepId: "fallback-feature-apply",
        toolName: "mlops.deployment.rollback",
        resourceId: "deployment",
        targetRevision: 1,
        expectedResourceVersion: "1",
        argumentsDigest: "f".repeat(64),
        dependsOn: [],
      }],
      compensationSteps: [{
        stepId: "deployment-rollback",
        toolName: "mlops.deployment.rollback",
        resourceId: "deployment",
        targetRevision: 1,
        expectedResourceVersion: "2",
        argumentsDigest: "a".repeat(64),
        dependsOn: [],
      }],
    },
    action: null,
  });
  const context = capturedBody.context as Record<string, unknown>;
  const evidence = context.evidence as readonly Record<string, unknown>[];
  assert.equal(evidence[0]?.resourceVersion, `unversioned-sha256:${contentDigest}`);
  assert.deepEqual(evidence[0]?.signals, { status: "READY", passed: true, errorRate: 0.002 });
  assert.equal(JSON.stringify(evidence[0]?.signals).includes("internalToken"), false);
  assert.equal((context.proposedPlan as Record<string, unknown>).planDigest, "e".repeat(64));
});
