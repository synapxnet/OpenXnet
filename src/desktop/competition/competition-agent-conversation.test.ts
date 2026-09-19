/**
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 企业 Agent 群聊来源和恢复验收。 / Enterprise Agent conversation provenance and recovery acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18 | Version: 1.0.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCompetitionAgentConversation, redactAgentConversationSummary } from "./competition-agent-conversation";
import { ApplicationCompetitionRuntimeService } from "./application-competition-runtime";
import { ApplicationEnterpriseRuntimeService } from "../enterprise/application-enterprise-runtime";
import { CompetitionStore } from "./competition-store";
import { FixtureCompetitionToolAdapter } from "./competition-tool-adapter";
import type { ApplicationCompetitionAgentDecision, ApplicationCompetitionAgentRoleSnapshot } from "../contracts/application-competition-runtime";

/** 使用真实Fixture生成已落盘事件、Run、证据；身份化决策是明确隔离的测试替身。 / Generate persisted incident/Run/evidence using the real fixture; identified decisions are isolated test doubles. */
async function seedConversation(directory: string) {
  const fixture = new FixtureCompetitionToolAdapter();
  const store = new CompetitionStore({ userDataDirectory: directory });
  const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: fixture, liveAdapter: fixture, store });
  const created = await runtime.createIncident({ workspaceId: "workspace-one", projectId: "project-one", title: "漂移恢复", summary: "业务通过率下降", severity: "P1", actorId: "human",
    scenario: { alertUid: "alert_risk_error_rate", serviceUid: "service_risk_inference", clusterId: "3", namespace: "risk-prod", workloadName: "risk-inference",
      reportUid: "qr_risk_features_120", assetUid: "asset_risk_features_prod", workflowInstanceUid: "task_risk_features_latest", deploymentUid: "deploy_risk_prod",
      failingRevision: 18, targetRevision: 17, expectedResourceVersion: "42", testDatasetRef: "fixture://goai/risk-120-v1" } });
  const run = await runtime.runInvestigation({ incidentId: created.incidentId, actorId: "human", teamRuntime: "builtin" });
  const names = ["GOAI Leader", "GOAI Evidence Worker", "GOAI Independent Verifier"];
  const roles = ["leader", "worker", "verifier"] as const;
  const members: ApplicationCompetitionAgentRoleSnapshot[] = roles.map(/** 创建带不可展示提示词的运行快照。 / Create a run snapshot containing prompts that must never be displayed. */ (teamRole, index) => ({ roleCardId: `role-${teamRole}`, name: names[index]!, teamRole, department: "GOAI", description: "test", systemPrompt: "PRIVATE_SYSTEM_PROMPT", runtimeSystemPrompt: "PRIVATE_RUNTIME_PROMPT", permissions: [], tools: [], skills: [], capturedAt: run.snapshot.updatedAt }));
  const binding = { ...run.snapshot.teamBindings[0]!, runtime: "agentteams" as const, teamName: "goai-test-team", memberSnapshots: members };
  const stages = ["INVESTIGATION_CONCLUSION", "INVESTIGATION_PLAN", "VERIFICATION_CONCLUSION"] as const;
  const decisions: ApplicationCompetitionAgentDecision[] = roles.map(/** 创建可核对三种实际阶段身份的测试回执。 / Create test receipts for all three verifiable stage identities. */ (teamRole, index) => ({
    decisionId: `decision-${index}`, taskId: `task-${index}`, bindingId: binding.bindingId, workspaceId: binding.workspaceId, incidentId: binding.incidentId, traceId: binding.traceId,
    stage: stages[index]!, teamName: binding.teamName, roleCardId: `role-${teamRole}`, agentName: "Untrusted Display Name", teamRole,
    transportSender: `@${teamRole}:test.invalid`, eventId: `$result-${index}`, decision: index === 0 ? "REQUEST_APPROVAL" : index === 1 ? "COLLECT_EVIDENCE" : "ROLLBACK_REQUIRED",
    summary: "同 Run 的阶段结构化结论", confidence: 0.9, requestedToolNames: ["dataops.quality.report.get"], evidenceIds: run.snapshot.evidence.map(/** 使用本Run真实Fixture证据。 / Use actual fixture evidence from this Run. */ item => item.evidenceId),
    skillName: "test-skill", skillVersion: "1.0.0", outputDigest: "a".repeat(64), routedByRoleCardId: index === 0 ? null : "role-leader",
    routedByName: index === 0 ? null : "Untrusted Router Name", routedByTransportSender: index === 0 ? null : "@leader:test.invalid", taskBriefDigest: index === 0 ? null : "b".repeat(64), transportEvents: [], createdAt: run.snapshot.updatedAt,
  }));
  const snapshot = await store.update(/** 为隔离测试保存身份化阶段事实。 / Persist identified stage facts for this isolated test. */ current => ({ ...current, teamBindings: [binding], agentDecisions: decisions }));
  return { snapshot, decisions, store, fixture };
}

/** 创建群聊范围，不依赖已删除或停用的当前员工卡。 / Create group scopes independently of deleted or disabled current employee cards. */
async function seedGroups(directory: string): Promise<void> {
  await writeFile(path.join(directory, "workspaces.json"), JSON.stringify([{ id: "workspace-one", name: "企业一", type: "local", status: "stopped" }, { id: "workspace-two", name: "企业二", type: "local", status: "stopped" }]));
  await writeFile(path.join(directory, "enterprise_projects.json"), JSON.stringify([
    { id: "project-one", workspaceId: "workspace-one", name: "项目一", floor: 1, color: "#00b4dd", icon: "briefcase" },
    { id: "project-two", workspaceId: "workspace-one", name: "项目二", floor: 2, color: "#00b4dd", icon: "briefcase" },
  ]));
}

test("Actual roles and handoffs use immutable binding names without leaking prompts or transport bodies", /** 验证真实角色映射和安全摘要。 / Verify actual role mapping and safe summaries. */ async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-chat-provenance-"));
  try {
    const { snapshot, decisions } = await seedConversation(directory);
    const messages = decisions.flatMap(/** 投影三个真实阶段。 / Project all three actual stages. */ decision => buildCompetitionAgentConversation(snapshot, decision));
    assert.deepEqual(messages.filter(/** 筛选阶段输出。 / Select stage outputs. */ item => item.collaboration?.kind === "result").map(/** 获取固定姓名。 / Get immutable names. */ item => item.senderName), ["GOAI Leader", "GOAI Evidence Worker", "GOAI Independent Verifier"]);
    assert.equal(messages.filter(/** 筛选真实路由。 / Select actual handoffs. */ item => item.collaboration?.kind === "handoff").length, 2);
    assert.equal(messages.every(/** 已落盘消息均已送达。 / Persisted messages are all delivered. */ item => item.status === "delivered"), true);
    assert.doesNotMatch(JSON.stringify(messages), /PRIVATE_|Untrusted/u);
    for (const changed of [{ workspaceId: "workspace-two" }, { traceId: "trace-other" }, { roleCardId: "role-outsider" }, { teamRole: "worker" as const }, { taskBriefDigest: "invalid", routedByRoleCardId: "role-leader" }, { evidenceIds: ["evidence-other-run"] }]) {
      assert.throws(/** 拒绝篡改来源和跨范围引用。 / Reject tampered provenance and cross-scope references. */ () => buildCompetitionAgentConversation(snapshot, { ...decisions[0]!, ...changed }), /AGENT_CONVERSATION_/u);
    }
    const wrongTrace = { ...snapshot, traces: snapshot.traces.map(/** 模拟跨事件追踪。 / Simulate a cross-incident trace. */ item => ({ ...item, incidentId: "incident-other" })) };
    assert.throws(/** 不能将运行挂到别的事件。 / A Run cannot be attached to another incident. */ () => buildCompetitionAgentConversation(wrongTrace, decisions[0]!), /TRACE_INVALID/u);
    assert.match(redactAgentConversationSummary("<think>private thoughts</think>ok"), /内部内容/u);
    assert.doesNotMatch(redactAgentConversationSummary(`api_key=secret-value Bearer secret-access oxdemo_${"a".repeat(64)} oxlive_${"b".repeat(32)}`), /secret-value|secret-access|oxdemo_|oxlive_/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Opening a group recovers history after a failed projection and stays idempotent across refresh/restart", /** 验证持久恢复、项目隔离和公开API身份边界。 / Verify persisted recovery, project isolation and public API identity boundaries. */ async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-chat-recovery-"));
  try {
    const { store, fixture, snapshot } = await seedConversation(directory);
    await seedGroups(directory);
    let failProjection = true;
    let enterprise: ApplicationEnterpriseRuntimeService;
    const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: fixture, liveAdapter: fixture, store,
      logger: { /** 静默保存隔离测试诊断。 / Silence isolated test diagnostics. */ warn() {} },
      /** 模拟投影故障后恢复，故障不能重新执行平台工具。 / Simulate projection recovery without re-executing platform tools. */ async recordAgentConversationProjection(messages) { if (failProjection) throw new Error("injected failure"); return enterprise.recordAgentConversationProjection(messages); },
    });
    /** 重建企业服务以模拟进程重启。 / Recreate the enterprise service to simulate process restart. */
    function newEnterprise(): ApplicationEnterpriseRuntimeService { return new ApplicationEnterpriseRuntimeService({ userDataDirectory: directory,
      /** 每次只同步已经授权的当前群。 / Reconcile only the authorized current group. */ reconcileAgentConversations: scope => runtime.reconcileAgentConversations(scope) }); }
    enterprise = newEnterprise();
    const scope = { workspaceId: "workspace-one", projectId: "project-one", limit: 100 };
    assert.match((await enterprise.listMessages(scope)).projectionWarning ?? "", /尚未同步/u);
    assert.deepEqual((await store.read()).incidents, snapshot.incidents);
    failProjection = false;
    const recovered = await enterprise.listMessages(scope);
    assert.equal(recovered.projectionWarning, undefined);
    assert.equal(recovered.messages.length, 5);
    const [refreshOne, refreshTwo] = await Promise.all([enterprise.listMessages(scope), enterprise.listMessages(scope)]);
    assert.equal(refreshOne.messages.length, 5);
    assert.equal(refreshTwo.messages.length, 5);
    enterprise = newEnterprise();
    assert.deepEqual((await enterprise.listMessages(scope)).messages.map(/** 复核重启后的稳定消息标识。 / Verify stable message IDs after restart. */ item => item.id), recovered.messages.map(/** 读取恢复时的标识。 / Read the recovered IDs. */ item => item.id));
    assert.equal((await enterprise.listMessages({ ...scope, projectId: "project-two" })).messages.length, 0);
    assert.equal((await enterprise.listMessages({ ...scope, workspaceId: "workspace-two", projectId: null })).messages.length, 0);
    const publicMessage = { workspaceId: scope.workspaceId, projectId: scope.projectId, content: "人工群留言", recipientIds: [], taskId: null, traceId: null };
    assert.equal((await enterprise.postMessage(publicMessage)).message.senderType, "leader");
    for (const forged of [{ senderType: "agent" }, { senderId: "role-leader" }, { collaboration: recovered.messages[0]!.collaboration }]) {
      assert.throws(/** Renderer不能注入Agent身份或运行来源。 / Renderers cannot inject an Agent identity or run provenance. */ () => enterprise.postMessage({ ...publicMessage, ...forged }), /fields are invalid/u);
    }
    assert.deepEqual((await store.read()).approvals, snapshot.approvals);
    assert.deepEqual((await store.read()).invocations, snapshot.invocations);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("One invalid source cannot hide valid history and legacy same-source receipts are replaced once", /** 验证单条错误隔离与旧回执迁移幂等。 / Verify per-source error isolation and idempotent legacy receipt migration. */ async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-chat-partial-"));
  try {
    const { store, fixture, snapshot, decisions } = await seedConversation(directory);
    await seedGroups(directory);
    const leaderMessage = buildCompetitionAgentConversation(snapshot, decisions[0]!)[0]!;
    const { collaboration: _source, ...legacy } = leaderMessage;
    await writeFile(path.join(directory, "enterprise_messages.json"), JSON.stringify([{ ...legacy, id: "legacy-leader-result", content: `[Matrix TASK_RESPONSE · ${decisions[0]!.eventId}]\nold raw receipt` }]));
    await store.update(/** 注入单条损坏来源，其他角色保持合法。 / Inject one invalid source while preserving other valid roles. */ current => ({ ...current, agentDecisions: current.agentDecisions.map(/** 仅破坏Verifier身份。 / Corrupt only the Verifier identity. */ item => item.teamRole === "verifier" ? { ...item, roleCardId: "role-outside" } : item) }));
    const enterprise = new ApplicationEnterpriseRuntimeService({ userDataDirectory: directory });
    const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: fixture, liveAdapter: fixture, store,
      logger: { /** 不输出测试注入故障。 / Silence injected test failures. */ warn() {} },
      /** 批次由受信任运行投影写入。 / Persist batches from the trusted run projection. */ recordAgentConversationProjection: messages => enterprise.recordAgentConversationProjection(messages),
    });
    const scope = { workspaceId: "workspace-one", projectId: "project-one" };
    const first = await runtime.reconcileAgentConversations(scope);
    assert.deepEqual(first, { projected: 3, failed: 1 });
    const messages = (await enterprise.listMessages({ ...scope, limit: 100 })).messages;
    assert.equal(messages.length, 3);
    assert.equal(messages.some(/** 旧同源明细已替换成安全投影。 / Legacy same-source details have been replaced with a safe projection. */ item => item.id === "legacy-leader-result"), false);
    assert.equal(messages.some(/** 合法Worker结果不被吞掉。 / The valid Worker result remains visible. */ item => item.senderName === "GOAI Evidence Worker"), true);
    assert.deepEqual(await runtime.reconcileAgentConversations(scope), { projected: 0, failed: 1 });
    const groupBefore = JSON.stringify(messages);
    await assert.rejects(/** 防止后一个非法收件人造成半批次写入。 / Prevent a later invalid recipient from partially committing a batch. */ enterprise.recordAgentConversationProjection([
      ...buildCompetitionAgentConversation(snapshot, decisions[2]!).slice(0, 1),
      { ...buildCompetitionAgentConversation(snapshot, decisions[2]!)[1]!, recipientIds: ["bad/id"] },
    ]), /invalid/u);
    assert.equal(JSON.stringify((await enterprise.listMessages({ ...scope, limit: 100 })).messages), groupBefore);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
