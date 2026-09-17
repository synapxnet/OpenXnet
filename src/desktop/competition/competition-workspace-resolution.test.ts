/*
#!/usr/bin/env node
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
运行范围校准验收 / Runtime workspace reconciliation acceptance
Author: maoyo
Department: 研发部
Date: 2026-09-16
Version: 1.3.0
Security Level: INTERNAL
Maintainer: maoyo
Email: synapxnet@gmail.com
*/
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ApplicationCompetitionRuntimeService } from "./application-competition-runtime";
import { FixtureCompetitionToolAdapter } from "./competition-tool-adapter";
import { ApplicationEnterpriseRuntimeService } from "../enterprise/application-enterprise-runtime";

/** 构造隔离漂移事件，不向线上平台写入。 / Construct an isolated feature-drift event without online writes. */
function incidentDraft(workspaceId = "ws_goai_demo") {
  return { workspaceId, title: "跨域特征漂移恢复", summary: "验证工作空间范围一致性", severity: "P1", actorId: "acceptance-user",
    scenario: { alertUid: "alert_risk_error_rate", serviceUid: "service_risk_inference", clusterId: "3", namespace: "risk-prod", workloadName: "risk-inference", reportUid: "qr_risk_features_120", assetUid: "asset_risk_features_prod", workflowInstanceUid: "task_risk_features_latest", deploymentUid: "deploy_risk_prod", failingRevision: 18, targetRevision: 17, expectedResourceVersion: "42", testDatasetRef: "fixture://goai/risk-120-v1" },
  };
}

/** 使用同一隔离存储模拟老包升级，保留真实运行时状态机。 / Simulate an upgrade using the same isolated store and actual runtime state machine. */
function runtimeFor(root: string, resolveWorkspaceId?: (id: string) => Promise<string>) {
  return new ApplicationCompetitionRuntimeService({ userDataDirectory: root, fixtureAdapter: new FixtureCompetitionToolAdapter(), liveAdapter: new FixtureCompetitionToolAdapter(), ...(resolveWorkspaceId ? { resolveWorkspaceId } : {}) });
}

/** 验证新事件及尚未取证的老事件都冻结真实范围。 / Verify canonical scope for new incidents and legacy incidents that have not begun investigation. */
test("new incidents and pristine legacy demos resolve to a real workspace before investigation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-scope-upgrade-"));
  try {
    const legacy = runtimeFor(root);
    const old = await legacy.createIncident(incidentDraft());
    const upgraded = runtimeFor(root, async (id) => id === "ws_goai_demo" ? "uuid-real-workspace" : id);
    const restored = await upgraded.getSnapshot();
    assert.equal(restored.incidents[0]?.workspaceId, "uuid-real-workspace");
    const created = await upgraded.createIncident(incidentDraft());
    assert.equal(created.snapshot.incidents.find((incident) => incident.incidentId === created.incidentId)?.workspaceId, "uuid-real-workspace");
    const investigated = await upgraded.runInvestigation({ incidentId: old.incidentId, actorId: "acceptance-user", teamRuntime: "builtin" });
    assert.equal(investigated.snapshot.incidents[0]?.workspaceId, "uuid-real-workspace");
    assert.ok(investigated.snapshot.traces.length > 0);
    assert.ok(investigated.snapshot.invocations.length > 0);
    for (const records of [investigated.snapshot.traces, investigated.snapshot.evidence, investigated.snapshot.approvals, investigated.snapshot.teamBindings]) {
      assert.ok(records.every((record) => record.workspaceId === "uuid-real-workspace"));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 已有证据、审批和调用保持原范围，升级不能改写审计历史。 / Existing evidence, approvals and invocations retain their scope across an upgrade. */
test("workspace reconciliation preserves recorded runs and rejects ambiguous new scopes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-scope-history-"));
  try {
    const legacy = runtimeFor(root);
    const old = await legacy.createIncident(incidentDraft());
    const original = await legacy.runInvestigation({ incidentId: old.incidentId, actorId: "acceptance-user", teamRuntime: "builtin" });
    const upgraded = runtimeFor(root, async (id) => id === "ws_goai_demo" ? "uuid-real-workspace" : id);
    const restored = await upgraded.getSnapshot();
    assert.equal(restored.incidents[0]?.workspaceId, "ws_goai_demo");
    assert.deepEqual(restored.approvals, original.snapshot.approvals);
    assert.deepEqual(restored.evidence, original.snapshot.evidence);
    assert.deepEqual(restored.invocations, original.snapshot.invocations);
    await assert.rejects(upgraded.runInvestigation({ incidentId: old.incidentId, actorId: "acceptance-user", teamRuntime: "builtin" }), /历史事件已有运行记录/);
    const ambiguous = runtimeFor(root, async () => { throw new Error("explicit workspace required"); });
    await assert.rejects(ambiguous.createIncident(incidentDraft()), /explicit workspace required/);
    assert.equal((await ambiguous.getSnapshot()).incidents.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 同一运行时维护三个真实空间，验证成功、补偿失败和待审批互相隔离并可重启恢复。 / Verify three real workspace records isolate success, compensated failure and pending approval across restart. */
test("three workspace runs retain separate approvals, evidence, failure and persisted outcomes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-three-workspaces-"));
  const enterprise = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
  try {
    const workspaces: string[] = [];
    for (const name of ["验收成功空间", "验收失败补偿空间", "验收待审批空间"]) {
      const saved = await enterprise.saveWorkspace({ workspace: { name, type: "local", config: {
        local: { path: "E:\\acceptance", permission_mode: "default" }, docker: { image: "ubuntu:22.04", daemon_url: "", container_id: "" }, cloud: { host: "", port: 22, user: "root", key_path: "" }, sandbox: { image: "openxnet/sandbox:latest", ttl_hours: 24 },
      } } });
      workspaces.push(saved.workspace.id);
    }
    assert.equal(new Set(workspaces).size, 3);
    const runtime = runtimeFor(root, (id) => enterprise.resolveWorkspaceId(id));
    const runs: Array<{ incidentId: string; approvalId: string; workspaceId: string }> = [];
    for (const [index, workspaceId] of workspaces.entries()) {
      const draft = incidentDraft(workspaceId);
      if (index === 1) draft.scenario.testDatasetRef = "fixture://goai/verification-failure-v1";
      const created = await runtime.createIncident(draft);
      const investigated = await runtime.runInvestigation({ incidentId: created.incidentId, actorId: "investigator", teamRuntime: "builtin" });
      assert.ok(investigated.approvalId);
      runs.push({ incidentId: created.incidentId, approvalId: investigated.approvalId, workspaceId });
      await assert.rejects(runtime.decideApproval({ approvalId: investigated.approvalId, decision: "APPROVED", actorId: "investigator", reason: "禁止自行审批" }), /审批人不能是审批申请人/);
    }
    const success = runs[0]!;
    const failure = runs[1]!;
    const pending = runs[2]!;
    const before = await runtime.getSnapshot();
    for (const [index, run] of [success, failure].entries()) {
      await runtime.decideApproval({ approvalId: run.approvalId, decision: "APPROVED", actorId: "human-approver", reason: "审阅本事件范围后批准" });
      if (index === 1) {
        await assert.rejects(runtime.executeRollback({ approvalId: run.approvalId, actorId: "controlled-executor", idempotencyKey: "acceptance-space-0", dryRun: false }), /幂等|idempotenc/i);
      }
      const executed = await runtime.executeRollback({ approvalId: run.approvalId, actorId: "controlled-executor", idempotencyKey: `acceptance-space-${index}`, dryRun: false });
      assert.ok(executed.actionId);
      await assert.rejects(runtime.verifyRemediation({ actionId: executed.actionId, actorId: "controlled-executor" }), /验证|职责/);
      if (index === 0) await runtime.verifyRemediation({ actionId: executed.actionId, actorId: "independent-verifier" });
      else await assert.rejects(runtime.verifyRemediation({ actionId: executed.actionId, actorId: "independent-verifier" }), /验证/);
    }
    const snapshot = await runtime.getSnapshot();
    assert.equal(snapshot.incidents.find((incident) => incident.incidentId === success.incidentId)?.status, "RESOLVED");
    assert.equal(snapshot.incidents.find((incident) => incident.incidentId === failure.incidentId)?.status, "FAILED");
    assert.equal(snapshot.actions.find((action) => action.incidentId === failure.incidentId)?.compensationStatus, "SUCCEEDED");
    assert.equal(snapshot.incidents.find((incident) => incident.incidentId === pending.incidentId)?.status, "AWAITING_APPROVAL");
    assert.equal(snapshot.approvals.filter((approval) => approval.status === "PENDING").length, 1);
    assert.deepEqual(snapshot.approvals.find((approval) => approval.approvalId === pending.approvalId), before.approvals.find((approval) => approval.approvalId === pending.approvalId));
    assert.deepEqual(snapshot.evidence.filter((record) => record.incidentId === pending.incidentId), before.evidence.filter((record) => record.incidentId === pending.incidentId));
    for (const run of runs) {
      for (const collection of [snapshot.traces, snapshot.evidence, snapshot.approvals, snapshot.actions, snapshot.invocations, snapshot.teamBindings, snapshot.auditReceipts]) {
        assert.ok(collection.filter((record) => record.incidentId === run.incidentId).every((record) => record.workspaceId === run.workspaceId));
      }
    }
    await assert.rejects(runtime.readResource({ uri: `openxnet://workspaces/${failure.workspaceId}/incidents/${success.incidentId}` }), /范围|Workspace|工作空间/);
    const restarted = runtimeFor(root, (id) => enterprise.resolveWorkspaceId(id));
    const restored = await restarted.getSnapshot();
    assert.deepEqual(restored, snapshot);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 群聊入口使用新建事件已冻结的实际空间，避免会话和审计各用一个范围。 / Group-chat creation uses the incident's canonical workspace so conversation and audit share one scope. */
test("enterprise task conversation inherits the incident canonical workspace", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-chat-scope-"));
  const conversations: string[] = [];
  try {
    const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: root, fixtureAdapter: new FixtureCompetitionToolAdapter(), liveAdapter: new FixtureCompetitionToolAdapter(), resolveWorkspaceId: async () => "actual-workspace", recordEnterpriseTaskConversation: async (input) => { conversations.push(input.workspaceId); } });
    const result = await runtime.startEnterpriseTask({ workspaceId: "ws_goai_demo", projectId: "project-test", content: "处理跨域特征漂移", scenarioType: "feature-drift", recipientIds: [], teamRuntime: "builtin", teamTemplateId: null }, "trusted-investigator");
    assert.deepEqual(conversations, ["actual-workspace"]);
    assert.equal(result.snapshot.incidents[0]?.workspaceId, "actual-workspace");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
