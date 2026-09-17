/**
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 驻场 Agent 边界测试 / Resident agent boundary tests.
 * Author: maoyo
 * Department: 研发部
 * Date: 2026-09-15
 * Version: 1.3.0
 * Security Level: INTERNAL
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertResidentContext,
  assertResidentToolAccess,
  CompetitionResidentAgentError,
  createDefaultResidentAgents,
  createResidentCollaborationRequest,
  createResidentContext,
  parseResidentCapability,
  residentEventScope,
} from "./competition-resident-agents";
import { createEmptySnapshot, parseStoredSnapshot } from "./competition-store";
import { ApplicationCompetitionRuntimeService } from "./application-competition-runtime";
import { FixtureCompetitionToolAdapter } from "./competition-tool-adapter";
import type { ApplicationCompetitionResidentContext } from "../contracts/application-competition-runtime";

const TEST_NOW = "2026-09-15T08:00:00.000Z";

/** 创建不含凭据的 DataOps 上下文。 / Create a credential-free DataOps context. */
function contextForDataOps(): ApplicationCompetitionResidentContext {
  const agent = createDefaultResidentAgents()[1]!;
  return createResidentContext(agent, {
    workspaceId: "ws_goai_demo", environment: "staging", source: "SIMULATION",
    runId: "run-test-1", incidentId: "inc-test-1", traceId: "trace-test-1",
    contextTtl: "2026-09-15T08:15:00.000Z", evidenceRefs: ["ev-schema-1"],
  });
}

/** 判断稳定驻场错误码。 / Match a stable resident-agent error code. */
function hasCode(code: string): (error: unknown) => boolean {
  return /** 匹配预期领域错误。 / Match the expected domain error. */ (error) => error instanceof CompetitionResidentAgentError && error.code === code;
}

test("default residents have separate identities and exclusively local read tools", /** 验证三平台固定白名单且不宣称连接在线。 / Verify fixed local allowlists without claiming a live connection. */ () => {
  const agents = createDefaultResidentAgents();
  assert.deepEqual(agents.map(/** 读取平台归属。 / Read platform ownership. */ (agent) => agent.platform), ["aiops", "dataops", "mlops"]);
  assert.equal(new Set(agents.map(/** 读取唯一身份。 / Read unique identity. */ (agent) => agent.agentId)).size, 3);
  for (const agent of agents) {
    assert.equal(agent.status, "REGISTERED");
    assert.equal(agent.contractVersion, "finals-v1.3.0");
    assert.equal(agent.capabilities.length, 6);
    assert.ok(agent.allowedTools.every(/** 所有工具只能属于本平台。 / Every tool belongs to the local platform. */ (tool) => tool.startsWith(`${agent.platform}.`)));
  }
  (agents[0]!.allowedTools as string[]).push("mlops.deployment.rollback");
  assert.equal(createDefaultResidentAgents()[0]!.allowedTools.includes("mlops.deployment.rollback"), false);
});

test("residents reject cross-platform tools and high-risk writes", /** 拒绝跨平台读取和未审批写操作。 / Reject cross-platform reads and high-risk writes. */ () => {
  const agent = createDefaultResidentAgents()[1]!;
  assert.doesNotThrow(/** 允许本平台只读工具。 / Allow a local read-only tool. */ () => assertResidentToolAccess(agent, "dataops.schema.snapshot.get"));
  assert.throws(/** 拒绝别的平台。 / Reject another platform. */ () => assertResidentToolAccess(agent, "mlops.deployment.get"), hasCode("RESIDENT_TOOL_FORBIDDEN"));
  assert.throws(/** 拒绝本平台高风险写。 / Reject a local high-risk write. */ () => assertResidentToolAccess(agent, "dataops.feature.backfill.start"), hasCode("RESIDENT_TOOL_FORBIDDEN"));
});

test("resident contexts reject expiration, forged identity and tool expansion", /** 拒绝过期上下文、伪造身份和权限扩张。 / Reject expiry, identity forgery and permission expansion. */ () => {
  const context = contextForDataOps();
  assert.doesNotThrow(/** 当前上下文有效。 / Current context is valid. */ () => assertResidentContext(context, new Date(TEST_NOW)));
  assert.throws(/** TTL 到期即拒绝。 / Reject at TTL expiry. */ () => assertResidentContext(context, new Date(context.contextTtl)), hasCode("RESIDENT_CONTEXT_EXPIRED"));
  assert.throws(/** 不接受未知身份。 / Reject unknown identity. */ () => assertResidentContext({ ...context, agentId: "untrusted" }, new Date(TEST_NOW)), hasCode("RESIDENT_CONTEXT_SCOPE_MISMATCH"));
  assert.throws(/** 白名单不能扩张。 / Do not expand the allowlist. */ () => assertResidentContext({ ...context, allowedTools: ["mlops.deployment.get"] }, new Date(TEST_NOW)), hasCode("RESIDENT_TOOL_FORBIDDEN"));
});

test("collaboration requests carry the complete minimal Run context and no terminal-state authority", /** 协同升级保留上下文且不携带终态变更权。 / Preserve escalation context without terminal-state authority. */ () => {
  const context = contextForDataOps();
  const event = createResidentCollaborationRequest(context, createDefaultResidentAgents()[1]!, "特征契约影响模型，需要 Leader 协同。", TEST_NOW);
  assert.equal(event.scope, "CROSS_PLATFORM");
  assert.equal(event.eventType, "COLLABORATION_REQUESTED");
  assert.equal(event.runId, context.runId);
  assert.equal(event.incidentId, context.incidentId);
  assert.equal(event.traceId, context.traceId);
  assert.equal(event.contextVersion, context.contextVersion);
  assert.equal(event.contextTtl, context.contextTtl);
  assert.deepEqual(event.evidenceRefs, context.evidenceRefs);
  assert.equal(event.source, "SIMULATION");
  assert.equal(Object.hasOwn(event, "stateAfter"), false);
  assert.equal(residentEventScope("CHAT_RESPONDED"), "PLATFORM_LOCAL");
  assert.equal(parseResidentCapability("chat.respond"), "chat.respond");
  assert.throws(/** 聊天不能关闭事件。 / Chat cannot close an incident. */ () => parseResidentCapability("incident.close"), hasCode("RESIDENT_CAPABILITY_INVALID"));
});

test("legacy snapshots receive safe resident defaults without changing existing incidents", /** 旧快照迁移只补齐注册表和空事件。 / Migrate legacy snapshots with registry and empty events only. */ () => {
  const snapshot = createEmptySnapshot(TEST_NOW);
  const { residentAgents: _agents, residentContexts: _contexts, residentEvents: _events, ...legacy } = snapshot;
  const migrated = parseStoredSnapshot(legacy);
  assert.equal(migrated.residentAgents.length, 3);
  assert.deepEqual(migrated.residentContexts, []);
  assert.deepEqual(migrated.residentEvents, []);
  assert.deepEqual(migrated.incidents, legacy.incidents);
});

test("a new investigation persists three scoped contexts and local evidence without closing the incident", /** 验证真实控制面调查入口持久化上下文且保留审批门。 / Verify the real investigation entry persists contexts and retains the approval gate. */ async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-resident-integration-"));
  try {
    const now = /** 固定模拟时钟。 / Use a fixed simulation clock. */ () => new Date(TEST_NOW);
    const fixture = new FixtureCompetitionToolAdapter({ now });
    const runtime = new ApplicationCompetitionRuntimeService({
      userDataDirectory: directory, fixtureAdapter: fixture, liveAdapter: fixture, now,
      recordEnterpriseTaskConversation: /** 测试替身接收企业会话投影。 / Test double accepts enterprise conversation projection. */ async () => undefined,
    });
    const result = await runtime.startEnterpriseTask({
      workspaceId: "ws_goai_demo", projectId: "project-risk", recipientIds: ["role-leader"], content: "调查特征契约漂移并生成受控恢复计划。",
      scenarioType: "feature-drift", teamRuntime: "builtin", teamTemplateId: null,
    }, "trusted:investigator");
    assert.equal(result.snapshot.residentContexts.length, 3);
    assert.equal(result.snapshot.residentEvents.length, 3);
    assert.equal(result.snapshot.incidents[0]!.status, "AWAITING_APPROVAL");
    assert.equal(result.snapshot.actions.length, 0);
    for (const context of result.snapshot.residentContexts) {
      assertResidentContext(context, now());
      assert.equal(context.traceId, result.traceId);
      assert.equal(context.contextVersion, "ctx-2");
      assert.ok(context.evidenceRefs.length > 0);
      for (const reference of context.evidenceRefs) {
        const evidence = result.snapshot.evidence.find(/** 解引用本平台证据。 / Dereference local platform evidence. */ (item) => item.evidenceId === reference);
        assert.equal(evidence?.platform, context.platform);
      }
    }
    const restored = await new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: fixture, liveAdapter: fixture, now }).getSnapshot();
    assert.deepEqual(restored.residentContexts, result.snapshot.residentContexts);
    assert.deepEqual(restored.residentEvents, result.snapshot.residentEvents);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
