import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FixtureCompetitionToolAdapter,
  type CompetitionToolAdapter,
} from "./competition-tool-adapter";
import {
  ApplicationCompetitionRuntimeError,
  ApplicationCompetitionRuntimeService,
  type ApplicationCompetitionEnterpriseTaskConversationInput,
  type ApplicationCompetitionResolvedMemoryPublicationRequest,
  type ApplicationCompetitionRetrospectiveSkillPublicationRequest,
} from "./application-competition-runtime";
import { ApplicationEnterpriseRuntimeService } from "../enterprise/application-enterprise-runtime";
import { ApplicationSkillRuntimeService } from "../skills/application-skill-runtime";
import { createEmptySnapshot, parseStoredSnapshot } from "./competition-store";
import type {
  CompetitionAgentTeamsTaskInput,
  CompetitionAgentTeamsTaskResult,
} from "./competition-agentteams-adapter";
import type {
  ApplicationCompetitionKnowledgeProjectionRequest,
  ApplicationCompetitionKnowledgePurgeRequest,
} from "../contracts/application-competition-knowledge";

/** 创建完整竞赛演示请求；输入 Workspace 和操作者，返回固定跨域场景。 */
function createIncidentRequest(workspaceId = "ws_goai_demo", actorId = "incident-commander") {
  return {
    workspaceId,
    title: "风控模型输入契约漂移",
    summary: "模型错误率升高，需要跨 AIOps、DataOps 和 MLOps 取证。",
    severity: "P1",
    actorId,
    scenario: {
      alertUid: "alert_risk_error_rate",
      serviceUid: "service_risk_inference",
      clusterId: "3",
      namespace: "risk-prod",
      workloadName: "risk-inference",
      reportUid: "qr_risk_features_120",
      assetUid: "asset_risk_features_prod",
      workflowInstanceUid: "task_risk_features_latest",
      deploymentUid: "deploy_risk_prod",
      failingRevision: 18,
      targetRevision: 17,
      expectedResourceVersion: "42",
      testDatasetRef: "fixture://goai/risk-120-v1",
    },
  };
}

/** 创建隔离 Runtime；输入临时目录，返回使用确定性 ID 和 Fixture Adapter 的服务。 */
function createRuntime(
  userDataDirectory: string,
  knowledge: {
    readonly synchronizeKnowledge?: (request: ApplicationCompetitionKnowledgeProjectionRequest) => Promise<unknown>;
    readonly purgeKnowledge?: (request: ApplicationCompetitionKnowledgePurgeRequest) => Promise<unknown>;
    readonly publishRetrospectiveSkill?: (
      request: ApplicationCompetitionRetrospectiveSkillPublicationRequest,
    ) => Promise<{ readonly skillId: string }>;
    readonly resolveEnabledEnterpriseSkill?: (
      workspaceId: string,
      skillId: string,
    ) => Promise<{
      readonly sourceIncidentId: string | null;
      readonly lifecycleStatus: "candidate" | "verified" | "active" | "deprecated" | "retired" | "legacy";
      readonly environmentScope: "synthetic" | "simulation" | "staging" | "shadow" | "canary" | "production" | "legacy";
      readonly productionEligible: boolean;
    } | null>;
    readonly retrieveCompetitionKnowledge?: (
      workspaceId: string,
      query: string,
    ) => Promise<readonly {
      readonly subject: string;
      readonly predicate: string;
      readonly object: string;
      readonly confidence: number;
    }[]>;
    readonly purgeEnterpriseTaskConversations?: (request: {
      readonly incidentIds: readonly string[];
      readonly traceIds: readonly string[];
    }) => Promise<unknown>;
    readonly persistResolvedIncidentMemory?: (
      request: ApplicationCompetitionResolvedMemoryPublicationRequest,
    ) => Promise<unknown>;
  } = {},
): ApplicationCompetitionRuntimeService {
  let sequence = 0;
  const fixture = new FixtureCompetitionToolAdapter({
    now: () => new Date("2026-08-03T02:00:00.000Z"),
  });
  return new ApplicationCompetitionRuntimeService({
    userDataDirectory,
    fixtureAdapter: fixture,
    liveAdapter: fixture,
    now: () => new Date("2026-08-03T02:00:00.000Z"),
    createId: () => `test${++sequence}`,
    ...knowledge,
  });
}

/** 创建通过固定身份和阶段约束的 AgentTeams 测试结果；输入任务上下文，返回可审计回执。 */
async function createAgentTeamsTaskResult(input: CompetitionAgentTeamsTaskInput): Promise<CompetitionAgentTeamsTaskResult> {
  const expectedRole = input.stage === "INVESTIGATION_PLAN"
    ? "worker"
    : input.stage === "INVESTIGATION_CONCLUSION" ? "leader" : "verifier";
  const member = input.binding.memberSnapshots.find((item) => item.teamRole === expectedRole);
  const leader = input.binding.memberSnapshots.find((item) => item.teamRole === "leader");
  if (member === undefined || leader === undefined) throw new Error("Test binding roles are incomplete.");
  const decision = input.stage === "INVESTIGATION_PLAN"
    ? "COLLECT_EVIDENCE"
    : input.stage === "INVESTIGATION_CONCLUSION" ? "REQUEST_APPROVAL" : "CLOSE";
  const taskEventId = `$${input.stage.toLowerCase()}`;
  const taskSender = `@${expectedRole}:agentteams.test`;
  const transportEvent = (
    kind: "ROUTE_REQUEST" | "ROUTE_RESPONSE" | "TASK_REQUEST" | "TASK_RESPONSE",
    direction: "OUTBOUND" | "INBOUND",
    eventId: string,
    sender: string,
    recipient: string,
  ) => ({
    kind,
    direction,
    roomId: "!goai-room:agentteams.test",
    eventId,
    sender,
    recipient,
    originServerTs: direction === "INBOUND" ? 1_786_000_000_000 : null,
    observedAt: "2026-08-03T02:00:00.000Z",
    redactedBody: `${kind} redacted body`,
    bodyDigest: "c".repeat(64),
  });
  return {
    taskId: `task-${input.stage.toLowerCase()}`,
    stage: input.stage,
    route: expectedRole === "leader" ? null : {
      leaderRoleCardId: leader.roleCardId,
      leaderName: leader.name,
      transportSender: "@leader:agentteams.test",
      assigneeRoleCardId: member.roleCardId,
      taskBriefDigest: "a".repeat(64),
    },
    result: {
      roleCardId: member.roleCardId,
      agentName: member.name,
      teamRole: expectedRole,
      transportSender: taskSender,
      eventId: taskEventId,
      decision,
      summary: input.stage === "INVESTIGATION_CONCLUSION"
        ? "结".repeat(496)
        : `AgentTeams ${input.stage} 已形成有证据支撑的结论。`,
      confidence: 0.95,
      requestedToolNames: input.stage === "INVESTIGATION_PLAN" ? [...input.availableToolNames] : [],
      evidenceIds: input.stage === "INVESTIGATION_PLAN" ? [] : input.evidence.map((item) => item.evidenceId),
      skillName: input.skill.name,
      skillVersion: input.skill.version,
      outputDigest: "b".repeat(64),
    },
    transportEvents: [
      ...(expectedRole === "leader" ? [] : [
        transportEvent("ROUTE_REQUEST", "OUTBOUND", `$route-request-${input.stage}`, "@gateway:agentteams.test", "@leader:agentteams.test"),
        transportEvent("ROUTE_RESPONSE", "INBOUND", `$route-response-${input.stage}`, "@leader:agentteams.test", "@gateway:agentteams.test"),
      ]),
      transportEvent("TASK_REQUEST", "OUTBOUND", `$task-request-${input.stage}`, "@gateway:agentteams.test", taskSender),
      transportEvent("TASK_RESPONSE", "INBOUND", taskEventId, taskSender, "@gateway:agentteams.test"),
    ],
    completedAt: "2026-08-03T02:00:00.000Z",
  };
}

test("competition runtime completes evidence, approval, full recovery plan, verification, resources and retrospective", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-"));
  try {
    const publications: ApplicationCompetitionRetrospectiveSkillPublicationRequest[] = [];
    const resolvedMemories: ApplicationCompetitionResolvedMemoryPublicationRequest[] = [];
    const runtime = createRuntime(directory, {
      publishRetrospectiveSkill: async (request) => {
        publications.push(request);
        return { skillId: request.skillId };
      },
      persistResolvedIncidentMemory: async (request) => {
        resolvedMemories.push(request);
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    assert.equal(created.snapshot.incidents.length, 1);
    assert.equal(created.snapshot.incidents[0]?.status, "OPEN");

    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    assert.equal(investigated.snapshot.evidence.length, 9);
    assert.equal(investigated.snapshot.invocations.every((item) => item.status === "SUCCEEDED"), true);
    assert.equal(investigated.snapshot.incidents[0]?.status, "AWAITING_APPROVAL");
    assert.equal(investigated.snapshot.reasoningDecisions.length, 2);
    assert.deepEqual(investigated.snapshot.reasoningDecisions.map((item) => item.decisionType), [
      "SKILL_SELECTION",
      "PLAN_SELECTION",
    ]);
    const planSelection = investigated.snapshot.reasoningDecisions[1];
    assert.equal(planSelection?.candidates.length, 3);
    assert.equal(planSelection?.selectedCandidateId, "plan:feature-drift-full-recovery-v2");
    assert.equal(planSelection?.candidates.find((item) => item.strategyId === "direct-write")?.policyDecision, "DENY");
    const taskGraph = investigated.snapshot.taskGraphs[0];
    assert.equal(taskGraph?.status, "AWAITING_APPROVAL");
    assert.equal(taskGraph?.nodes.filter((item) => item.parallelGroup === "parallel-evidence").length, 9);
    assert.equal(taskGraph?.nodes.find((item) => item.nodeId === "fuse-cross-platform-evidence")?.status, "SUCCEEDED");
    assert.equal(taskGraph?.nodes.find((item) => item.lane === "EVIDENCE")?.assignedAgentName, "Evidence Agent");
    assert.equal(taskGraph?.nodes.find((item) => item.lane === "EXECUTION")?.assignedAgentName, "OpenXnet Controlled Executor");
    const approvalId = assertNonNull(investigated.approvalId);
    const traceId = assertNonNull(investigated.snapshot.traces[0]?.traceId ?? null);
    const traceResource = await runtime.readResource({
      uri: `openxnet://workspaces/ws_goai_demo/incidents/${created.incidentId}/traces/${traceId}`,
    });
    assert.equal(JSON.parse(traceResource.text).traceId, traceId);
    await assert.rejects(
      runtime.readResource({ uri: `openxnet://workspaces/ws_goai_demo/traces/${traceId}` }),
      (error: unknown) => hasRuntimeCode(error, "RESOURCE_URI_INVALID"),
    );

    await assert.rejects(
      runtime.decideApproval({
        approvalId,
        decision: "APPROVED",
        actorId: "incident-commander",
        reason: "申请人尝试自行审批。",
      }),
      (error: unknown) => hasRuntimeCode(error, "SEPARATION_OF_DUTIES_REQUIRED"),
    );

    await runtime.decideApproval({
      approvalId,
      decision: "APPROVED",
      actorId: "change-reviewer",
      reason: "证据完整，批准回滚至稳定修订。",
    });
    await assert.rejects(
      runtime.executeRollback({
        approvalId,
        actorId: "change-reviewer",
        idempotencyKey: "idem-reviewer-conflict",
        dryRun: false,
      }),
      (error: unknown) => hasRuntimeCode(error, "SEPARATION_OF_DUTIES_REQUIRED"),
    );

    const dryRun = await runtime.executeRollback({
      approvalId,
      actorId: "deployment-operator",
      idempotencyKey: "idem-rollback-dry-run",
      dryRun: true,
    });
    assert.equal(dryRun.snapshot.actions.length, 0);
    assert.equal(dryRun.snapshot.auditReceipts.length, 0);

    const executed = await runtime.executeRollback({
      approvalId,
      actorId: "deployment-operator",
      idempotencyKey: "idem-rollback-001",
      dryRun: false,
    });
    const actionId = assertNonNull(executed.actionId);
    assert.equal(executed.snapshot.actions[0]?.status, "RUNNING");
    assert.equal(executed.snapshot.actions[0]?.planId, "feature-drift-full-recovery-v2");
    assert.equal(executed.snapshot.actions[0]?.steps.length, 9);
    assert.equal(executed.snapshot.actions[0]?.steps.every((step) => step.status === "SUCCEEDED"), true);
    assert.equal(executed.snapshot.actions[0]?.compensationSteps.length, 2);
    assert.equal(executed.snapshot.auditReceipts.length, 7);
    assert.equal(executed.snapshot.auditReceipts.every((receipt) => receipt.outcome === "SUCCEEDED"), true);

    const replayed = await runtime.executeRollback({
      approvalId,
      actorId: "deployment-operator",
      idempotencyKey: "idem-rollback-001",
      dryRun: false,
    });
    assert.equal(replayed.snapshot.actions.length, 1);

    await assert.rejects(
      runtime.verifyRemediation({ actionId, actorId: "deployment-operator" }),
      (error: unknown) => hasRuntimeCode(error, "SEPARATION_OF_DUTIES_REQUIRED"),
    );
    const verified = await runtime.verifyRemediation({
      actionId,
      actorId: "independent-verifier",
    });
    assert.equal(verified.snapshot.incidents[0]?.status, "RESOLVED");
    assert.equal(verified.snapshot.actions[0]?.status, "SUCCEEDED");
    assert.equal(verified.snapshot.actions[0]?.verificationEvidenceIds.length, 5);
    assert.equal(verified.snapshot.auditReceipts.at(-1)?.outcome, "SUCCEEDED");
    assert.equal(resolvedMemories.length, 1);
    assert.equal(resolvedMemories[0]?.incidentId, created.incidentId);
    assert.equal(resolvedMemories[0]?.traceId, traceId);
    assert.equal(resolvedMemories[0]?.scenarioType, "feature-drift");
    assert.equal(resolvedMemories[0]?.verificationEvidenceIds.length, 5);
    assert.equal(resolvedMemories[0]?.evidenceIds.length, 30);
    assert.equal(await runtime.reconcileResolvedMemories(), 1);
    assert.equal(resolvedMemories.length, 2);

    const resource = await runtime.readResource({
      uri: `openxnet://workspaces/ws_goai_demo/actions/${actionId}`,
    });
    assert.equal(resource.mimeType, "application/json");
    assert.equal(JSON.parse(resource.text).actionId, actionId);

    const retrospective = await runtime.exportRetrospective({ incidentId: created.incidentId });
    const retrospectivePath = assertNonNull(retrospective.retrospectivePath);
    const markdown = await readFile(retrospectivePath, "utf8");
    assert.match(markdown, /^---\nname: synapxnet-feature-drift-recovery/u);
    assert.match(markdown, /标准流程/u);
    assert.match(markdown, /dataops\.feature\.backfill\.start/u);
    assert.match(markdown, /mlops\.deployment\.promote/u);
    assert.equal(retrospective.retrospectiveSkillId, "synapxnet-feature-drift-recovery");
    assert.equal(retrospective.snapshot.taskGraphs[0]?.status, "SUCCEEDED");
    assert.equal(retrospective.snapshot.taskGraphs[0]?.nodes.find((item) => item.nodeId === "crystallize-retrospective-skill")?.status, "SUCCEEDED");
    const builtinEvolution = retrospective.snapshot.skillEvolutionRuns[0];
    assert.equal(builtinEvolution?.status, "CANDIDATE");
    assert.deepEqual(builtinEvolution?.rounds.map((round) => round.stage), [
      "PROBLEM_REPRODUCTION",
      "STRATEGY_COMPARISON",
      "PROGRESSIVE_CHALLENGE",
      "INDEPENDENT_CERTIFICATION",
    ]);
    assert.deepEqual(builtinEvolution?.rounds.map((round) => round.role), [
      "TESTER",
      "DEVELOPER",
      "TESTER",
      "VERIFIER",
    ]);
    assert.equal(builtinEvolution?.rounds.slice(0, 3).every((round) => round.outcome === "PASSED"), true);
    assert.equal(builtinEvolution?.rounds[3]?.outcome, "FAILED");
    assert.equal(builtinEvolution?.rounds.every((round) => /^[a-f0-9]{64}$/u.test(round.outputDigest)), true);
    assert.equal(publications[0]?.workspaceId, "ws_goai_demo");
    assert.equal(publications[0]?.sourceEventIds.includes(created.incidentId), true);

    const restarted = createRuntime(directory);
    const persisted = await restarted.getSnapshot();
    assert.equal(persisted.incidents[0]?.status, "RESOLVED");
    assert.equal(persisted.evidence.length, 30);

    await assert.rejects(
      runtime.resetDemoData({ confirmation: "WRONG_CONFIRMATION" }),
      TypeError,
    );
    assert.equal((await runtime.getSnapshot()).incidents.length, 1);
    await runtime.setAdapterMode({ mode: "live" });
    const reset = await runtime.resetDemoData({ confirmation: "RESET_DEMO_DATA" });
    assert.equal(reset.adapterMode, "fixture");
    for (const collection of [
      "incidents",
      "traces",
      "invocations",
      "evidence",
      "approvals",
      "actions",
      "auditReceipts",
      "teamBindings",
      "agentDecisions",
      "taskGraphs",
      "reasoningDecisions",
    ] as const) {
      assert.deepEqual(reset[collection], []);
    }
    assert.equal(await readFile(retrospectivePath, "utf8"), markdown);
    assert.equal((await restarted.getSnapshot()).incidents.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime records Workspace-scoped online graph retrieval in neuro-symbolic Skill selection", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-hybrid-retrieval-"));
  try {
    const runtime = createRuntime(directory, {
      retrieveCompetitionKnowledge: async (workspaceId, query) => {
        assert.equal(workspaceId, "ws_goai_demo");
        assert.match(query, /feature-drift|风控/u);
        return [{
          subject: "Incident:inc_source_resolved",
          predicate: "uses_scenario",
          object: "Scenario:feature-drift",
          confidence: 0.98,
        }, {
          subject: "Incident:inc_source_resolved",
          predicate: "crystallized_as_skill",
          object: "Skill:synapxnet-feature-drift-recovery",
          confidence: 1,
        }];
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
      teamTemplateId: null,
    });
    const selection = investigated.snapshot.reasoningDecisions.find((item) => item.decisionType === "SKILL_SELECTION");
    assert.equal(selection?.retrievalMode, "ONLINE_HYBRID_RAG_KG");
    assert.equal(selection?.knowledgeRefs.length, 2);
    assert.equal(selection?.candidates[0]?.skillId, "synapxnet-feature-drift-recovery");
    assert.equal(selection?.candidates[0]?.graphScore, 1);
    assert.equal(selection?.candidates.filter((item) => item.eligible).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime completes recommendation capacity and quantitative iteration scenarios", async () => {
  const cases = [
    {
      scenarioType: "recommendation-capacity",
      actionTool: "aiops.gpu.capacity.ensure",
      planId: "recommendation-capacity-recovery-v2",
      executionStepCount: 7,
      verificationEvidenceCount: 5,
      targetRevision: 20,
      title: "推荐服务 GPU 推理队列拥塞",
      overrides: {
        alertUid: "alert_rec_p99_spike",
        serviceUid: "service_rec_inference",
        namespace: "recommendation-prod",
        workloadName: "recommendation-inference",
        reportUid: "qr_rec_traffic_latest",
        assetUid: "asset_rec_features_prod",
        workflowInstanceUid: "task_rec_features_latest",
        deploymentUid: "deploy_recommendation_prod",
        failingRevision: 6,
        targetRevision: 20,
        testDatasetRef: "staging://goai/recommendation-dcn-v1/probe",
      },
    },
    {
      scenarioType: "quantitative-iteration",
      actionTool: "dataops.training.dataset.build",
      planId: "quantitative-ashare-model-iteration-v3",
      executionStepCount: 7,
      verificationEvidenceCount: 6,
      targetRevision: 2,
      title: "量化模型归因与受控迭代",
      overrides: {
        alertUid: "alert_quant_ic_degradation",
        serviceUid: "service_quant_signal",
        namespace: "quant-prod",
        workloadName: "quant-signal-inference",
        reportUid: "report_quant_a_share_v1",
        assetUid: "asset_quant_market_daily",
        workflowInstanceUid: "task_quant_a_share_eod_ready",
        deploymentUid: "deploy_quant_ashare_research",
        failingRevision: 1,
        targetRevision: 2,
        testDatasetRef: "quant://a-share-factor-demo-v1/test",
      },
    },
  ] as const;
  for (const item of cases) {
    const directory = await mkdtemp(path.join(os.tmpdir(), `openxnet-${item.scenarioType}-`));
    try {
      const runtime = createRuntime(directory);
      const base = createIncidentRequest();
      const created = await runtime.createIncident({
        ...base,
        title: item.title,
        scenario: { ...base.scenario, scenarioType: item.scenarioType, ...item.overrides },
      });
      const investigated = await runtime.runInvestigation({
        incidentId: created.incidentId,
        actorId: "incident-commander",
        teamRuntime: "builtin",
      });
      const approvalId = assertNonNull(investigated.approvalId);
      assert.equal(investigated.snapshot.approvals[0]?.toolName, item.actionTool);
      if (item.scenarioType === "recommendation-capacity") {
        const metrics = investigated.snapshot.evidence.find((entry) => entry.toolName === "aiops.inference.metrics.get");
        assert.equal(metrics?.data.p99Ms, 5000);
        assert.equal(metrics?.data.batchQueueSize, 1000);
      } else {
        const attribution = investigated.snapshot.evidence.find((entry) => entry.toolName === "mlops.attribution.report.get");
        assert.equal(attribution?.data.informationCoefficient, -0.00993273);
      }
      await runtime.decideApproval({
        approvalId,
        decision: "APPROVED",
        actorId: "change-reviewer",
        reason: "场景证据完整，批准执行受控处置。",
      });
      const executed = await runtime.executeRollback({
        approvalId,
        actorId: "change-operator",
        idempotencyKey: `idem-${item.scenarioType}`,
        dryRun: false,
      });
      const actionId = assertNonNull(executed.actionId);
      assert.equal(executed.snapshot.actions[0]?.toolName, item.actionTool);
      assert.equal(executed.snapshot.actions[0]?.planId, item.planId);
      assert.equal(executed.snapshot.actions[0]?.targetRevision, item.targetRevision);
      assert.equal(executed.snapshot.actions[0]?.steps.length, item.executionStepCount);
      assert.equal(executed.snapshot.actions[0]?.steps.every((step) => step.status === "SUCCEEDED"), true);
      assert.equal(
        executed.snapshot.auditReceipts.length,
        executed.snapshot.actions[0]?.steps.filter((step) => step.kind === "WRITE").length,
      );
      const verified = await runtime.verifyRemediation({ actionId, actorId: "independent-verifier" });
      assert.equal(verified.snapshot.incidents[0]?.status, "RESOLVED");
      assert.equal(verified.snapshot.actions[0]?.verificationEvidenceIds.length, item.verificationEvidenceCount);
      assert.equal(verified.snapshot.auditReceipts.at(-1)?.outcome, "SUCCEEDED");
      if (item.scenarioType === "recommendation-capacity") {
        const metrics = verified.snapshot.evidence.filter((entry) => entry.toolName === "aiops.inference.metrics.get").at(-1);
        const probe = verified.snapshot.evidence.filter((entry) => entry.toolName === "mlops.inference.probe").at(-1);
        assert.equal(metrics?.data.p99Ms, 80);
        assert.equal(probe?.data.algorithmId, "dcn_1");
        assert.equal(probe?.data.candidateCount, 8);
      } else {
        const attribution = verified.snapshot.evidence.filter((entry) => entry.toolName === "mlops.attribution.report.get").at(-1);
        assert.equal(attribution?.data.informationCoefficient, 0.25228567);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("resolved competition rehearsal publishes a scoped Candidate without enterprise execution rights", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-skill-"));
  try {
    const globalSkillsRoot = path.join(directory, "global-skills");
    const skillRuntime = new ApplicationSkillRuntimeService({
      globalSkillsRoot,
      bundledSkillsRoot: path.join(directory, "bundled-skills"),
      state: {
        /** 返回无项目同步路径的最小旧状态；无输入，不访问磁盘。 */
        getSnapshot: () => ({ settings: {} }),
      } as never,
      now: () => new Date("2026-08-03T02:00:00.000Z"),
    });
    const enterpriseRuntime = new ApplicationEnterpriseRuntimeService({
      userDataDirectory: directory,
      now: () => new Date("2026-08-03T02:00:00.000Z"),
    });
    const runtime = createRuntime(directory, {
      publishRetrospectiveSkill: async (request) => {
        const result = await skillRuntime.crystallizeSkill({
          name: request.name,
          skillId: request.skillId,
          description: request.description,
          triggerContext: request.triggerContext,
          workflow: request.workflow,
          notes: request.notes,
          requiredCapabilities: request.requiredCapabilities,
          verification: request.verification,
          rollback: request.rollback,
          sourceEventIds: request.sourceEventIds,
          status: "candidate",
          source: "rehearsal",
          familyId: request.familyId,
          problemFingerprint: request.problemFingerprint,
          evidenceOrigin: request.evidenceOrigin,
          derivationMethod: request.derivationMethod,
          environmentScope: request.environmentScope,
          strategies: [{
            strategyId: `retrospective-${request.skillId}`,
            workflow: request.workflow.split(/\r?\n/u).filter(Boolean),
            toolChain: request.requiredCapabilities,
            sourceEventIds: request.sourceEventIds,
          }],
          certifications: [{
            scope: request.environmentScope,
            status: "candidate",
            evidenceEventIds: request.sourceEventIds,
          }],
          syncToProject: false,
          overwrite: true,
        });
        const skillId = result.installedIds[0] ?? request.skillId;
        await enterpriseRuntime.setSkillBinding({
          workspaceId: request.workspaceId,
          skillId,
          enabled: false,
          sourceIncidentId: request.incidentId,
        });
        return { skillId };
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const approvalId = assertNonNull(investigated.approvalId);
    await runtime.decideApproval({
      approvalId,
      decision: "APPROVED",
      actorId: "change-reviewer",
      reason: "证据完整，批准受控处置。",
    });
    const executed = await runtime.executeRollback({
      approvalId,
      actorId: "change-operator",
      idempotencyKey: "idem-enterprise-skill",
      dryRun: false,
    });
    await runtime.verifyRemediation({
      actionId: assertNonNull(executed.actionId),
      actorId: "independent-verifier",
    });
    const published = await runtime.exportRetrospective({ incidentId: created.incidentId });
    assert.equal(published.retrospectiveSkillId, "synapxnet-feature-drift-recovery");
    assert.equal((await skillRuntime.listSkills()).skills.some((item) => item.id === published.retrospectiveSkillId), true);
    const binding = (await enterpriseRuntime.listSkillBindings()).bindings[0];
    assert.equal(binding?.workspaceId, "ws_goai_demo");
    assert.equal(binding?.skillId, published.retrospectiveSkillId);
    assert.equal(binding?.enabled, false);
    const skillMarkdown = await readFile(
      path.join(globalSkillsRoot, "synapxnet-feature-drift-recovery", "SKILL.md"),
      "utf8",
    );
    assert.match(skillMarkdown, /lifecycle_status: "candidate"/u);
    assert.match(skillMarkdown, /environment_scope: "simulation"/u);
    assert.match(skillMarkdown, /## Verification/u);
    const skillManifest = JSON.parse(await readFile(
      path.join(globalSkillsRoot, "synapxnet-feature-drift-recovery", "openxnet.skill.json"),
      "utf8",
    )) as Record<string, unknown>;
    assert.equal(skillManifest.evidence_origin, "rehearsal");
    assert.equal(skillManifest.environment_scope, "simulation");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime synchronizes sanitized knowledge and purges it before demo reset", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-knowledge-"));
  const projections: ApplicationCompetitionKnowledgeProjectionRequest[] = [];
  const purges: ApplicationCompetitionKnowledgePurgeRequest[] = [];
  const conversationPurges: Array<{ readonly incidentIds: readonly string[]; readonly traceIds: readonly string[] }> = [];
  try {
    const runtime = createRuntime(directory, {
      synchronizeKnowledge: async (request) => { projections.push(request); },
      purgeKnowledge: async (request) => { purges.push(request); },
      purgeEnterpriseTaskConversations: async (request) => { conversationPurges.push(request); },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    assert.equal(projections.length, 2);
    const projection = projections.at(-1);
    assert.ok(projection);
    assert.equal(projection.evidence.length, 9);
    assert.equal(projection.approvals.length, 1);
    assert.equal(projection.invocations.length, 9);
    const serialized = JSON.stringify(projection);
    assert.doesNotMatch(serialized, /systemPrompt|runtimeSystemPrompt|argumentsDigest|"data"/u);

    const reset = await runtime.resetDemoData({ confirmation: "RESET_DEMO_DATA" });
    assert.equal(reset.incidents.length, 0);
    assert.deepEqual(purges, [{
      schema: "openxnet.competition-knowledge.v1",
      projections: [{ workspaceId: "ws_goai_demo", incidentId: created.incidentId }],
    }]);
    assert.deepEqual(conversationPurges, [{
      incidentIds: [created.incidentId],
      traceIds: [assertNonNull(investigated.traceId)],
    }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime preserves state when knowledge sync fails and blocks an incomplete purge", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-knowledge-failure-"));
  try {
    const runtime = createRuntime(directory, {
      synchronizeKnowledge: async () => { throw new Error("private upstream detail"); },
      purgeKnowledge: async () => { throw new Error("private upstream detail"); },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    assert.equal(created.snapshot.incidents.length, 1);
    await assert.rejects(
      runtime.resetDemoData({ confirmation: "RESET_DEMO_DATA" }),
      (error: unknown) => hasRuntimeCode(error, "KNOWLEDGE_PROJECTION_UNAVAILABLE"),
    );
    assert.equal((await runtime.getSnapshot()).incidents.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime backfills persisted incidents when the workbench snapshot is opened", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-knowledge-backfill-"));
  const projections: ApplicationCompetitionKnowledgeProjectionRequest[] = [];
  try {
    const original = createRuntime(directory);
    const created = await original.createIncident(createIncidentRequest());
    const restarted = createRuntime(directory, {
      synchronizeKnowledge: async (request) => { projections.push(request); },
    });
    const snapshot = await restarted.getSnapshot();
    assert.equal(snapshot.incidents[0]?.incidentId, created.incidentId);
    assert.equal(projections.length, 1);
    assert.equal(projections[0]?.incident.incidentId, created.incidentId);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime records AgentTeams degradation and blocks false builtin fallback", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-team-"));
  try {
    const fixture = new FixtureCompetitionToolAdapter();
    let sequence = 0;
    const runtime = new ApplicationCompetitionRuntimeService({
      userDataDirectory: directory,
      fixtureAdapter: fixture,
      liveAdapter: fixture,
      createId: () => `team${++sequence}`,
      agentTeamsIsolatedServiceEnabled: false,
      prepareAgentTeam: async () => {
        throw new Error("AgentTeams unavailable");
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    await assert.rejects(runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "agentteams",
    }), (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "AGENTTEAMS_TASK_UNAVAILABLE");
    const snapshot = await runtime.getSnapshot();
    assert.equal(snapshot.teamBindings[0]?.runtime, "agentteams");
    assert.equal(snapshot.teamBindings[0]?.status, "DEGRADED");
    assert.equal(snapshot.evidence.length, 0);
    assert.equal(snapshot.incidents[0]?.status, "FAILED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime keeps a rejected approval closed to execution", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-rejected-"));
  try {
    const runtime = createRuntime(directory);
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const approvalId = assertNonNull(investigated.approvalId);
    const rejected = await runtime.decideApproval({
      approvalId,
      decision: "REJECTED",
      actorId: "change-reviewer",
      reason: "证据不足，拒绝生产回滚。",
    });
    assert.equal(rejected.snapshot.approvals[0]?.status, "REJECTED");
    assert.equal(rejected.snapshot.incidents[0]?.status, "FAILED");
    await assert.rejects(
      runtime.executeRollback({
        approvalId,
        actorId: "deployment-operator",
        idempotencyKey: "idem-rejected-approval",
        dryRun: false,
      }),
      (error: unknown) => hasRuntimeCode(error, "APPROVAL_INVALID"),
    );
    assert.equal((await runtime.getSnapshot()).actions.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime fails the action when independent verification does not recover", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-verification-failed-"));
  try {
    const adapter = new FixtureCompetitionToolAdapter();
    const resolvedMemories: ApplicationCompetitionResolvedMemoryPublicationRequest[] = [];
    const runtime = new ApplicationCompetitionRuntimeService({
      userDataDirectory: directory,
      fixtureAdapter: adapter,
      liveAdapter: adapter,
      persistResolvedIncidentMemory: async (request) => {
        resolvedMemories.push(request);
      },
    });
    const request = createIncidentRequest();
    request.scenario.testDatasetRef = "fixture://goai/verification-failure-v1";
    const created = await runtime.createIncident(request);
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const approvalId = assertNonNull(investigated.approvalId);
    await runtime.decideApproval({
      approvalId,
      decision: "APPROVED",
      actorId: "change-reviewer",
      reason: "批准执行，但必须由独立验证决定是否关闭事件。",
    });
    const executed = await runtime.executeRollback({
      approvalId,
      actorId: "deployment-operator",
      idempotencyKey: "idem-verification-failed",
      dryRun: false,
    });
    const actionId = assertNonNull(executed.actionId);
    await assert.rejects(
      runtime.verifyRemediation({ actionId, actorId: "independent-verifier" }),
      (error: unknown) => hasRuntimeCode(error, "VERIFICATION_FAILED"),
    );
    const failed = await runtime.getSnapshot();
    assert.equal(failed.actions[0]?.status, "FAILED");
    assert.equal(failed.actions[0]?.stage, "FAILED");
    assert.equal(failed.actions[0]?.errorCode, "VERIFICATION_FAILED");
    assert.equal(failed.incidents[0]?.status, "FAILED");
    assert.equal(failed.traces[0]?.status, "FAILED");
    assert.equal(failed.actions[0]?.compensationStatus, "SUCCEEDED");
    assert.equal(failed.actions[0]?.compensationSteps.length, 2);
    assert.equal(failed.actions[0]?.compensationSteps.every((step) => step.status === "SUCCEEDED"), true);
    assert.equal(failed.evidence.length, 25);
    assert.equal(resolvedMemories.length, 0);
    const exported = await runtime.exportEvaluation({ incidentId: created.incidentId });
    const report = JSON.parse(await readFile(exported.reportPath, "utf8")) as {
      readonly failurePath: { readonly compensationStatus: string };
    };
    assert.equal(exported.outcome, "FAILED");
    assert.equal(report.failurePath.compensationStatus, "SUCCEEDED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime persists immutable enterprise team-template role snapshots", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-template-"));
  try {
    const identifiers = ["role-leader", "role-worker", "role-verifier", "template-one"];
    const enterprise = new ApplicationEnterpriseRuntimeService({
      userDataDirectory: directory,
      createId: () => identifiers.shift() ?? "enterprise-id",
      now: () => new Date("2026-08-03T02:00:00.000Z"),
    });
    const leader = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "事件负责人", department: "SRE", system_prompt: "负责统一决策。", skills: ["orchestrate"] },
    })).card;
    const worker = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "数据取证员", department: "Data", runtime_system_prompt: "只收集只读证据。", tools: ["dataops.quality.report.get"] },
    })).card;
    const verifier = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "独立验证员", department: "QA", permissions: ["verify"] },
    })).card;
    const template = (await enterprise.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "GOAI 跨域调查组",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "worker" },
          { roleCardId: verifier.id, teamRole: "verifier" },
        ],
      },
    })).teamTemplate;
    let sequence = 0;
    let prepareCalls = 0;
    const fixture = new FixtureCompetitionToolAdapter();
    const runtime = new ApplicationCompetitionRuntimeService({
      userDataDirectory: directory,
      fixtureAdapter: fixture,
      liveAdapter: fixture,
      createId: () => `snapshot${++sequence}`,
      now: () => new Date("2026-08-03T02:00:00.000Z"),
      resolveTeamTemplate: (teamTemplateId) => enterprise.resolveTeamTemplate(teamTemplateId),
      agentTeamsIsolatedServiceEnabled: false,
      prepareAgentTeam: async () => {
        prepareCalls += 1;
        return { teamName: "must-not-run", status: "READY" };
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
      teamTemplateId: template.id,
    });
    const binding = investigated.snapshot.teamBindings[0];
    assert.equal(binding?.teamTemplateId, template.id);
    assert.equal(binding?.teamTemplateVersion, 1);
    assert.equal(binding?.teamTemplateName, "GOAI 跨域调查组");
    assert.deepEqual(binding?.memberSnapshots.map((item) => item.teamRole), ["leader", "worker", "verifier"]);
    assert.equal(binding?.memberSnapshots[1]?.runtimeSystemPrompt, "只收集只读证据。");

    await enterprise.saveRoleCard({
      mode: "update",
      roleCard: { ...worker, name: "已修改的数据取证员" },
    });
    const persisted = await runtime.getSnapshot();
    assert.equal(persisted.teamBindings[0]?.memberSnapshots[1]?.name, "数据取证员");

    const agentTeamsIncident = await runtime.createIncident(createIncidentRequest());
    await assert.rejects(runtime.runInvestigation({
      incidentId: agentTeamsIncident.incidentId,
      actorId: "incident-commander",
      teamRuntime: "agentteams",
      teamTemplateId: template.id,
    }), (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "AGENTTEAMS_TASK_UNAVAILABLE");
    const degradedBinding = (await runtime.getSnapshot()).teamBindings.at(-1);
    assert.equal(degradedBinding?.status, "DEGRADED");
    assert.equal(degradedBinding?.memberSnapshots.length, 3);
    assert.equal(prepareCalls, 0);

    let enabledSequence = 0;
    let enabledPrepareCalls = 0;
    const projectedConversationStages: string[] = [];
    const projectedOperationEvents: string[] = [];
    const enabledRuntime = new ApplicationCompetitionRuntimeService({
      userDataDirectory: directory,
      fixtureAdapter: fixture,
      liveAdapter: fixture,
      createId: () => `enabled${++enabledSequence}`,
      now: () => new Date("2026-08-03T02:00:00.000Z"),
      resolveTeamTemplate: (teamTemplateId) => enterprise.resolveTeamTemplate(teamTemplateId),
      agentTeamsIsolatedServiceEnabled: true,
      prepareAgentTeam: async (_incident, _traceId, resolved) => {
        enabledPrepareCalls += 1;
        assert.equal(resolved.teamTemplate.id, template.id);
        return { teamName: "goai-isolated-ready", status: "READY" };
      },
      dispatchAgentTeamTask: createAgentTeamsTaskResult,
      recordAgentTeamConversation: async (_input, task) => {
        projectedConversationStages.push(task.stage);
      },
      recordOperationConversation: async (event) => {
        projectedOperationEvents.push(event.eventType);
      },
    });
    const enabledIncident = await enabledRuntime.createIncident(createIncidentRequest());
    const ready = await enabledRuntime.runInvestigation({
      incidentId: enabledIncident.incidentId,
      actorId: "incident-commander",
      teamRuntime: "agentteams",
      teamTemplateId: template.id,
    });
    assert.equal(ready.snapshot.teamBindings.at(-1)?.status, "READY");
    assert.equal(ready.snapshot.teamBindings.at(-1)?.teamName, "goai-isolated-ready");
    assert.equal(enabledPrepareCalls, 1);
    assert.deepEqual(ready.snapshot.agentDecisions.map((item) => item.stage), ["INVESTIGATION_PLAN", "INVESTIGATION_CONCLUSION"]);
    assert.deepEqual(projectedConversationStages, ["INVESTIGATION_PLAN", "INVESTIGATION_CONCLUSION"]);
    assert.deepEqual(projectedOperationEvents, ["APPROVAL_REQUESTED"]);
    assert.equal(ready.snapshot.invocations
      .filter((item) => item.incidentId === enabledIncident.incidentId)
      .every((item) => item.actorId === `agentteams:${worker.id}`), true);
    assert.equal(ready.snapshot.approvals.at(-1)?.requestedBy, `agentteams:${leader.id}`);
    assert.equal(ready.snapshot.approvals.at(-1)?.reason.length, 496);
    const agentApprovalId = assertNonNull(ready.approvalId);
    await enabledRuntime.decideApproval({
      approvalId: agentApprovalId,
      decision: "APPROVED",
      actorId: "human-approver",
      reason: "批准受控回滚。",
    });
    const agentExecution = await enabledRuntime.executeRollback({
      approvalId: agentApprovalId,
      actorId: "deployment-operator",
      idempotencyKey: "agentteams-rollback-001",
      dryRun: false,
    });
    const agentActionId = assertNonNull(agentExecution.actionId);
    const agentVerified = await enabledRuntime.verifyRemediation({
      actionId: agentActionId,
      actorId: "human-verification-supervisor",
    });
    assert.equal(agentVerified.snapshot.incidents.find((item) => item.incidentId === enabledIncident.incidentId)?.status, "RESOLVED");
    assert.deepEqual(
      agentVerified.snapshot.agentDecisions
        .filter((item) => item.incidentId === enabledIncident.incidentId)
        .map((item) => item.teamRole),
      ["worker", "leader", "verifier"],
    );
    const transportEvents = agentVerified.snapshot.agentDecisions
      .filter((item) => item.incidentId === enabledIncident.incidentId)
      .flatMap((item) => item.transportEvents);
    assert.equal(transportEvents.length, 10);
    assert.deepEqual(transportEvents.map((item) => item.sequence), Array.from({ length: 10 }, (_item, index) => index + 1));
    assert.equal(transportEvents[0]?.previousLedgerDigest, "0".repeat(64));
    assert.equal(transportEvents.every((item) => /^[a-f0-9]{64}$/u.test(item.ledgerDigest)), true);
    assert.equal(transportEvents.slice(1).every((item, index) => (
      item.previousLedgerDigest === transportEvents[index]?.ledgerDigest
    )), true);
    const completedGraph = agentVerified.snapshot.taskGraphs.find((item) => item.incidentId === enabledIncident.incidentId);
    assert.equal(completedGraph?.events.some((item) => item.eventType === "TASK_ASSIGNED"), true);
    assert.equal(completedGraph?.events.some((item) => item.eventType === "CHECKPOINT_SAVED"), true);
    assert.equal(completedGraph?.events.every((item) => /^[a-f0-9]{64}$/u.test(item.checkpointDigest)), true);
    const crystallized = await enabledRuntime.exportRetrospective({ incidentId: enabledIncident.incidentId });
    const agentTeamsEvolution = crystallized.snapshot.skillEvolutionRuns.find((item) => (
      item.incidentId === enabledIncident.incidentId
    ));
    assert.equal(agentTeamsEvolution?.status, "READY_FOR_CERTIFICATION");
    assert.equal(agentTeamsEvolution?.rounds.length, 4);
    assert.equal(agentTeamsEvolution?.rounds.every((round) => round.outcome === "PASSED"), true);
    assert.equal(agentTeamsEvolution?.rejectedStrategyIds.length, 2);
    const agentTeamsEvaluation = await enabledRuntime.exportEvaluation({ incidentId: enabledIncident.incidentId });
    const agentTeamsReport = JSON.parse(await readFile(agentTeamsEvaluation.reportPath, "utf8")) as {
      readonly orchestration: {
        readonly taskGraph: { readonly checkpointCount: number; readonly coordinationEventCount: number } | null;
      };
      readonly skillEngineering: { readonly status: string; readonly roundCount: number } | null;
      readonly requirementCoverage: {
        readonly coordinationCheckpoints: boolean;
        readonly skillEvolutionTrail: boolean;
      };
    };
    const agentTeamsTelemetry = JSON.parse(await readFile(agentTeamsEvaluation.telemetryPath, "utf8")) as {
      readonly resourceSpans: readonly {
        readonly scopeSpans: readonly { readonly spans: readonly { readonly name: string }[] }[];
      }[];
      readonly resourceMetrics: readonly {
        readonly scopeMetrics: readonly { readonly metrics: readonly { readonly name: string }[] }[];
      }[];
    };
    const telemetrySpanNames = agentTeamsTelemetry.resourceSpans[0]?.scopeSpans[0]?.spans.map((item) => item.name) ?? [];
    const telemetryMetricNames = agentTeamsTelemetry.resourceMetrics[0]?.scopeMetrics[0]?.metrics.map((item) => item.name) ?? [];
    assert.equal(agentTeamsReport.orchestration.taskGraph?.checkpointCount && agentTeamsReport.orchestration.taskGraph.checkpointCount > 0, true);
    assert.equal(agentTeamsReport.orchestration.taskGraph?.coordinationEventCount && agentTeamsReport.orchestration.taskGraph.coordinationEventCount > 0, true);
    assert.equal(agentTeamsReport.skillEngineering?.status, "READY_FOR_CERTIFICATION");
    assert.equal(agentTeamsReport.skillEngineering?.roundCount, 4);
    assert.equal(agentTeamsReport.requirementCoverage.coordinationCheckpoints, true);
    assert.equal(agentTeamsReport.requirementCoverage.skillEvolutionTrail, true);
    assert.equal(telemetrySpanNames.some((name) => name.startsWith("openxnet.coordination.")), true);
    assert.equal(telemetrySpanNames.some((name) => name.startsWith("openxnet.skill_evolution.")), true);
    assert.equal(telemetryMetricNames.includes("openxnet.coordination.events"), true);
    assert.equal(telemetryMetricNames.includes("openxnet.skill_evolution.rounds"), true);
    const eventLedgerLines = (await readFile(agentTeamsEvaluation.agentTeamsEventsPath, "utf8")).trim().split("\n");
    const eventManifest = JSON.parse(eventLedgerLines[0] ?? "{}") as { eventCount?: number; finalLedgerDigest?: string };
    assert.equal(eventManifest.eventCount, 10);
    assert.equal(eventManifest.finalLedgerDigest, transportEvents.at(-1)?.ledgerDigest);
    assert.equal(eventLedgerLines.length, 11);
    assert.equal(agentVerified.snapshot.invocations
      .filter((item) => item.incidentId === enabledIncident.incidentId && item.toolName !== "mlops.deployment.rollback")
      .slice(-3)
      .every((item) => item.actorId === `agentteams:${verifier.id}`), true);
    assert.deepEqual(projectedConversationStages, [
      "INVESTIGATION_PLAN", "INVESTIGATION_CONCLUSION", "VERIFICATION_CONCLUSION",
    ]);
    assert.deepEqual(projectedOperationEvents, [
      "APPROVAL_REQUESTED",
      "APPROVAL_APPROVED",
      "ACTION_EXECUTING",
      ...Array.from({ length: 9 }, () => "ACTION_STEP_SUCCEEDED"),
      "VERIFICATION_SUCCEEDED",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition runtime resumes a failed Trace and reassigns the failed evidence node to another Worker", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-reassignment-"));
  try {
    const identifiers = ["role-leader", "role-worker-one", "role-worker-two", "role-verifier", "template-reassignment"];
    const enterprise = new ApplicationEnterpriseRuntimeService({
      userDataDirectory: directory,
      createId: () => identifiers.shift() ?? "enterprise-id",
      now: () => new Date("2026-08-03T02:00:00.000Z"),
    });
    const leader = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "事件负责人", department: "SRE", skills: ["orchestrate"] },
    })).card;
    const workerOne = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "数据取证员甲", department: "Data", tools: ["dataops.quality.report.get"] },
    })).card;
    const workerTwo = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "数据取证员乙", department: "Data", tools: ["dataops.quality.report.get"] },
    })).card;
    const verifier = (await enterprise.saveRoleCard({
      mode: "create",
      roleCard: { name: "独立验证员", department: "QA", permissions: ["verify"] },
    })).card;
    const template = (await enterprise.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "GOAI 异常恢复组",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: workerOne.id, teamRole: "worker" },
          { roleCardId: workerTwo.id, teamRole: "worker" },
          { roleCardId: verifier.id, teamRole: "verifier" },
        ],
      },
    })).teamTemplate;
    const fixture = new FixtureCompetitionToolAdapter({
      now: () => new Date("2026-08-03T02:00:00.000Z"),
    });
    let failFirstQualityRead = true;
    const flakyAdapter: CompetitionToolAdapter = {
      /** 首次质量报告读取返回可重试超时；其余请求转发到确定性 Fixture。 */
      invoke: async (request) => {
        const response = await fixture.invoke(request);
        if (failFirstQualityRead && request.toolName === "dataops.quality.report.get" && request.governance === null) {
          failFirstQualityRead = false;
          return {
            ...response,
            success: false,
            data: null,
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "测试注入的 Worker 超时。",
              retryable: true,
              details: {},
            },
            meta: { ...response.meta, summary: "测试注入的 Worker 超时。" },
          };
        }
        return response;
      },
      /** 清理测试 Adapter 的 Fixture 状态；无输入，无返回。 */
      resetDemoState: () => fixture.resetDemoState(),
    };
    let sequence = 0;
    const runtime = new ApplicationCompetitionRuntimeService({
      userDataDirectory: directory,
      fixtureAdapter: flakyAdapter,
      liveAdapter: flakyAdapter,
      createId: () => `reassign${++sequence}`,
      now: () => new Date("2026-08-03T02:00:00.000Z"),
      resolveTeamTemplate: (teamTemplateId) => enterprise.resolveTeamTemplate(teamTemplateId),
      agentTeamsIsolatedServiceEnabled: true,
      prepareAgentTeam: async () => ({ teamName: "goai-reassignment-ready", status: "READY" }),
      dispatchAgentTeamTask: createAgentTeamsTaskResult,
    });
    const created = await runtime.createIncident(createIncidentRequest());
    await assert.rejects(runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "agentteams",
      teamTemplateId: template.id,
    }), (error: unknown) => hasRuntimeCode(error, "UPSTREAM_UNAVAILABLE"));
    const failedSnapshot = await runtime.getSnapshot();
    const failedGraph = failedSnapshot.taskGraphs[0];
    const failedNode = failedGraph?.nodes.find((item) => item.toolName === "dataops.quality.report.get");
    assert.equal(failedGraph?.status, "FAILED");
    assert.equal(failedNode?.status, "FAILED");
    assert.equal(failedNode?.assignedRoleCardId, workerOne.id);
    assert.equal(failedGraph?.events.some((item) => item.eventType === "WORKER_TIMEOUT"), true);

    const resumed = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "agentteams",
      teamTemplateId: template.id,
    });
    const resumedGraph = resumed.snapshot.taskGraphs.at(-1);
    const resumedNode = resumedGraph?.nodes.find((item) => item.toolName === "dataops.quality.report.get");
    const reassignment = resumedGraph?.events.find((item) => (
      item.eventType === "TASK_REASSIGNED" && item.nodeId === resumedNode?.nodeId
    ));
    assert.equal(resumedGraph?.revision, 2);
    assert.equal(resumedGraph?.events.some((item) => item.eventType === "TRACE_RESUMED"), true);
    assert.equal(resumedNode?.assignedRoleCardId, workerTwo.id);
    assert.equal(resumedNode?.assignmentMode, "REASSIGNMENT");
    assert.equal(reassignment?.fromRoleCardId, workerOne.id);
    assert.equal(reassignment?.toRoleCardId, workerTwo.id);
    assert.equal(reassignment === undefined ? false : /^[a-f0-9]{64}$/u.test(reassignment.checkpointDigest), true);
    const reassignedInvocation = resumed.snapshot.invocations.find((item) => (
      item.traceId === resumedGraph?.traceId && item.toolName === "dataops.quality.report.get"
    ));
    assert.equal(reassignedInvocation?.actorId, `agentteams:${workerTwo.id}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("competition store migrates legacy team bindings without template fields", async () => {
  const snapshot = createEmptySnapshot("2026-08-03T02:00:00.000Z");
  const legacyBinding = {
    bindingId: "binding-legacy",
    workspaceId: "ws_goai_demo",
    incidentId: "incident-legacy",
    runtime: "builtin",
    teamName: "legacy-team",
    status: "READY",
    createdAt: "2026-08-03T02:00:00.000Z",
    updatedAt: "2026-08-03T02:00:00.000Z",
  };
  const migrated = parseStoredSnapshot({ ...snapshot, teamBindings: [legacyBinding] });
  assert.equal(migrated.teamBindings[0]?.teamTemplateId, null);
  assert.equal(migrated.teamBindings[0]?.teamTemplateVersion, null);
  assert.equal(migrated.teamBindings[0]?.teamTemplateName, "");
  assert.equal(migrated.teamBindings[0]?.traceId, "");
  assert.deepEqual(migrated.teamBindings[0]?.memberSnapshots, []);
  assert.deepEqual(migrated.agentDecisions, []);
});

test("enterprise group chat starts all fixed Demos with project-scoped traceability", async () => {
  const cases = [
    {
      scenarioType: "recommendation-capacity",
      title: "推荐服务 GPU 推理队列拥塞",
      severity: "P0",
      deploymentUid: "deploy_recommendation_prod",
    },
    {
      scenarioType: "quantitative-iteration",
      title: "量化模型归因与受控迭代",
      severity: "P1",
      deploymentUid: "deploy_quant_ashare_research",
    },
    {
      scenarioType: "feature-drift",
      title: "风控模型输入契约漂移",
      severity: "P1",
      deploymentUid: "deploy_risk_prod",
    },
  ] as const;
  for (const item of cases) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-enterprise-task-"));
    try {
      const fixture = new FixtureCompetitionToolAdapter({
        now: () => new Date("2026-08-03T02:00:00.000Z"),
      });
      const conversations: ApplicationCompetitionEnterpriseTaskConversationInput[] = [];
      let sequence = 0;
      const runtime = new ApplicationCompetitionRuntimeService({
        userDataDirectory: directory,
        fixtureAdapter: fixture,
        liveAdapter: fixture,
        now: () => new Date("2026-08-03T02:00:00.000Z"),
        createId: () => `enterprise${++sequence}`,
        recordEnterpriseTaskConversation: async (input) => {
          conversations.push(input);
        },
      });
      const content = `请执行${item.title}任务，并给出可审批、可回滚的恢复方案。`;
      const result = await runtime.startEnterpriseTask({
        workspaceId: "ws_goai_demo",
        projectId: "project_risk_control",
        recipientIds: ["role_leader", "role_worker", "role_verifier"],
        content,
        scenarioType: item.scenarioType,
        teamRuntime: "builtin",
        teamTemplateId: null,
      }, "trusted:investigator");
      const incident = result.snapshot.incidents.find((entry) => entry.incidentId === result.incidentId);
      assert.equal(incident?.projectId, "project_risk_control");
      assert.equal(incident?.createdBy, "trusted:investigator");
      assert.equal(incident?.title, item.title);
      assert.equal(incident?.severity, item.severity);
      assert.equal(incident?.scenario.scenarioType, item.scenarioType);
      assert.equal(incident?.scenario.deploymentUid, item.deploymentUid);
      assert.equal(result.snapshot.approvals.at(-1)?.status, "PENDING");
      assert.deepEqual(conversations, [{
        workspaceId: "ws_goai_demo",
        projectId: "project_risk_control",
        taskId: result.incidentId,
        recipientIds: ["role_leader", "role_worker", "role_verifier"],
        content,
      }]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("one human approval can complete execution, independent verification and Skill crystallization", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-automatic-approval-"));
  try {
    const publications: ApplicationCompetitionRetrospectiveSkillPublicationRequest[] = [];
    const runtime = createRuntime(directory, {
      publishRetrospectiveSkill: async (request) => {
        publications.push(request);
        return { skillId: request.skillId };
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const approvalId = assertNonNull(investigated.approvalId);
    await assert.rejects(
      runtime.decideApproval({
        approvalId,
        decision: "APPROVED",
        actorId: "human-approver",
        reason: "证据和补偿计划完整，批准自动闭环。",
        executionMode: "automatic",
      }),
      (error: unknown) => hasRuntimeCode(error, "AUTOMATION_ACTORS_UNAVAILABLE"),
    );
    assert.equal((await runtime.getSnapshot()).approvals.at(-1)?.status, "PENDING");
    const completed = await runtime.decideApproval({
      approvalId,
      decision: "APPROVED",
      actorId: "human-approver",
      reason: "证据和补偿计划完整，批准自动闭环。",
      executionMode: "automatic",
    }, {
      operatorId: "trusted:operator",
      verifierId: "trusted:verifier",
    });
    const incident = completed.snapshot.incidents.find((item) => item.incidentId === created.incidentId);
    const action = completed.snapshot.actions.find((item) => item.incidentId === created.incidentId);
    assert.equal(incident?.status, "RESOLVED");
    assert.equal(action?.status, "SUCCEEDED");
    assert.equal(action?.executedBy, "trusted:operator");
    assert.equal(completed.retrospectiveSkillId, "synapxnet-feature-drift-recovery");
    assert.equal(publications.length, 1);
    const evaluation = await runtime.exportEvaluation({ incidentId: created.incidentId });
    const report = JSON.parse(await readFile(evaluation.reportPath, "utf8")) as {
      readonly schema: string;
      readonly requirementCoverage: { readonly independentVerification: boolean };
    };
    const telemetry = JSON.parse(await readFile(evaluation.telemetryPath, "utf8")) as {
      readonly schema: string;
      readonly resourceSpans: readonly unknown[];
      readonly resourceMetrics: readonly unknown[];
    };
    assert.equal(report.schema, "openxnet.competition-evaluation.v1");
    assert.equal(report.requirementCoverage.independentVerification, true);
    assert.equal(telemetry.schema, "openxnet.otlp-evidence.v1");
    assert.equal(telemetry.resourceSpans.length, 1);
    assert.equal(telemetry.resourceMetrics.length, 1);
    await runtime.exportEvaluation({ incidentId: created.incidentId });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("enabled enterprise Skill produces traceable second-use evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-skill-reuse-"));
  try {
    const runtime = createRuntime(directory, {
      resolveEnabledEnterpriseSkill: async (workspaceId, skillId) => {
        assert.equal(workspaceId, "ws_goai_demo");
        assert.equal(skillId, "synapxnet-feature-drift-recovery");
        return {
          sourceIncidentId: "inc_source_resolved",
          lifecycleStatus: "verified",
          environmentScope: "simulation",
          productionEligible: false,
        };
      },
    });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const usage = investigated.snapshot.skillUsages.find((item) => item.incidentId === created.incidentId);
    assert.equal(usage?.status, "REUSED");
    assert.equal(usage?.sourceIncidentId, "inc_source_resolved");
    assert.equal(usage?.problemFingerprint, "feature-drift:service_risk_inference");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("live mode rejects a simulation-only enterprise Skill", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-skill-live-scope-"));
  try {
    const runtime = createRuntime(directory, {
      resolveEnabledEnterpriseSkill: async () => ({
        sourceIncidentId: "inc_simulation_source",
        lifecycleStatus: "verified",
        environmentScope: "simulation",
        productionEligible: false,
      }),
    });
    await runtime.setAdapterMode({ mode: "live" });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const usage = investigated.snapshot.skillUsages.find((item) => item.incidentId === created.incidentId);
    assert.equal(usage?.status, "BASELINE");
    assert.equal(usage?.sourceIncidentId, null);
    assert.match(usage?.matchReason ?? "", /环境认证不覆盖/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("live mode reuses a verified staging enterprise Skill", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-competition-skill-live-reuse-"));
  try {
    const runtime = createRuntime(directory, {
      resolveEnabledEnterpriseSkill: async () => ({
        sourceIncidentId: "inc_staging_source",
        lifecycleStatus: "verified",
        environmentScope: "staging",
        productionEligible: false,
      }),
    });
    await runtime.setAdapterMode({ mode: "live" });
    const created = await runtime.createIncident(createIncidentRequest());
    const investigated = await runtime.runInvestigation({
      incidentId: created.incidentId,
      actorId: "incident-commander",
      teamRuntime: "builtin",
    });
    const usage = investigated.snapshot.skillUsages.find((item) => item.incidentId === created.incidentId);
    assert.equal(usage?.status, "REUSED");
    assert.equal(usage?.sourceIncidentId, "inc_staging_source");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

/** 要求可空字符串存在；输入字符串，返回非空值，空值时让测试失败。 */
function assertNonNull(value: string | null): string {
  assert.notEqual(value, null);
  return value as string;
}

/** 判断未知错误是否为指定竞赛错误；输入错误和代码，返回布尔值。 */
function hasRuntimeCode(error: unknown, code: string): boolean {
  return error instanceof ApplicationCompetitionRuntimeError && error.code === code;
}
