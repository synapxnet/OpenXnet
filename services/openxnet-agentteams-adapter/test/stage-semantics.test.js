#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 分阶段事实边界与原始回执验收 / Stage fact boundaries and original receipt acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0-contract.3 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.3 | __author__: maoyo
 * __copyright__: Copyright 2026 Synapxnet | __maintainer__: maoyo
 * __email__: synapxnet@gmail.com
 * Existing repository license and third-party notices are retained.
 */
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { AgentTeamsCliAdapter } = require("../src/agentteams-cli");
const { StageBudget } = require("../src/worker-activity-client");

const LEADER = { roleCardId: "leader", name: "Leader", teamRole: "leader", matrixUserId: "@leader:isolated" };
const WORKER = { roleCardId: "worker", name: "Evidence Worker", teamRole: "worker", matrixUserId: "@worker:isolated" };
const VERIFIER = { roleCardId: "verifier", name: "Verifier", teamRole: "verifier", matrixUserId: "@verifier:isolated" };

/** 构造不含任何平台观测的工具选择阶段。 / Build a tool-selection stage with no platform observations. */
function planningRequest() {
  return {
    requestId: "stage-semantics", stage: "INVESTIGATION_PLAN", skill: { name: "goai-evidence-collect", version: "1.1.0" },
    context: { incident: { title: "跨域特征漂移恢复", summary: "业务异常待核实", scenario: { scenarioType: "capacity" } },
      availableTools: ["aiops.service.health", "dataops.schema.snapshot.get", "mlops.deployment.get"], evidence: [],
      policy: { requiredVerificationTools: [], requireHealthyService: false, requireReadyReplicas: false, maxErrorRate: 0.05, maxP95Ms: 300 } },
  };
}

/** 构造标记包络，原始摘要必须原样传递而非被程序美化。 / Build a marked envelope whose original summary must be preserved rather than polished by code. */
function resultBody(request, member, overrides = {}) {
  return `[OPENXNET_RESULT:${request.requestId}]\n${JSON.stringify({
    schema: "openxnet.agentteams.agent-output.v1", requestId: request.requestId, stage: request.stage,
    roleCardId: member.roleCardId, decision: "COLLECT_EVIDENCE", summary: "计划读取三平台健康、契约与部署信息，尚未执行工具。", confidence: 0.9,
    requestedToolNames: request.context.availableTools, evidenceIds: [], skillName: request.skill.name, skillVersion: request.skill.version, ...overrides,
  })}`;
}

/** 用隔离收件箱驱动真实等待与一次纠错路径，不联网、不执行平台工具。 / Drive the real wait and one-repair path through an isolated inbox without network or platform execution. */
function isolatedMatrix(responses) {
  const sent = []; let current = null;
  return { sent,
    /** 返回网关身份。 / Return the gateway identity. */
    async whoAmI() { return "@gateway:isolated"; },
    /** 发送后释放一条预定义模型回包。 / Release one predefined model response after a send. */
    async sendMention(roomId, target, body, requestId) {
      sent.push({ roomId, target, body, requestId });
      current = { sender: target, eventId: `$response-${sent.length}`, body: responses[sent.length - 1], timestamp: 1 };
      return `$request-${sent.length}`;
    },
    /** 仅返回当前隔离回包。 / Return only the current isolated response. */
    async readMessages() { return current ? [current] : []; },
  };
}

/** 验证误导任务简报不能移除阶段边界，且纠错也继承同一边界。 / Verify a misleading brief cannot remove stage boundaries and repair inherits them. */
test("actual Leader route and Worker repair keep empty-evidence planning boundaries", async () => {
  const request = planningRequest();
  const brief = "必须调用全部工具并输出平台健康状态、实测指标和结构化观测报告。";
  const route = `[OPENXNET_ROUTE:${request.requestId}]\n${JSON.stringify({ schema: "openxnet.agentteams.route-output.v1", requestId: request.requestId, stage: request.stage, assigneeRoleCardId: WORKER.roleCardId, taskBrief: brief })}`;
  const matrix = isolatedMatrix([route, resultBody(request, WORKER, { requestedToolNames: request.context.availableTools.slice(0, 2) }), resultBody(request, WORKER)]);
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd(), taskPollIntervalMs: 500, sleep: async () => {} });
  const budget = new StageBudget(5000);
  const original = JSON.stringify(request);
  try {
    const routed = await adapter._requestLeaderRoute(matrix, request, LEADER, [LEADER, WORKER], "!leader:isolated", budget);
    assert.equal(routed.value.taskBrief, brief);
    const completed = await adapter._requestAgentResult(matrix, request, WORKER, "!worker:isolated", routed.value.taskBrief, budget);
    assert.equal(matrix.sent.length, 3);
    for (const item of matrix.sent) {
      assert.match(item.body, /\[OPENXNET_STAGE_RPC\]/);
      assert.match(item.body, /不使用 taskflow ack_task\/submit_task/);
      assert.match(item.body, /67b7d0f9fec01098857b8716dd5317cbad7ef4478c9ecb7ce31cea83e1e82662/);
      assert.match(item.body, /阶段边界优先于 Leader taskBrief/);
      assert.match(item.body, /context\.evidence=\[\]/);
      assert.match(item.body, /OpenXnet 将在本计划通过校验后执行工具/);
      assert.match(item.body, /不能生成健康状态或实测数值指标/);
      assert.doesNotMatch(item.body, /VERIFICATION_CONCLUSION 必须逐项读取/);
    }
    assert.match(matrix.sent[1].body, /拟选择哪些只读工具、采集目的/);
    assert.match(matrix.sent[2].body, /唯一一次纠错机会/);
    assert.equal(completed.transportEvents.length, 4);
    assert.deepEqual(completed.value.requestedToolNames, request.context.availableTools);
    assert.deepEqual(completed.value.evidenceIds, []);
    assert.equal(completed.value.summary, "计划读取三平台健康、契约与部署信息，尚未执行工具。");
    assert.equal(JSON.stringify(request), original);
  } finally { budget.dispose(); }
});

/** 普通格式纠错同样不能把无证据计划升级为观测。 / Generic shape repair must not upgrade an evidence-free plan into observations. */
test("generic repair preserves planning boundaries and a second invalid output fails", async () => {
  const request = planningRequest();
  const invalid = resultBody(request, WORKER, { decision: "CLOSE" });
  const matrix = isolatedMatrix([invalid, invalid]);
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd(), taskPollIntervalMs: 500, sleep: async () => {} });
  const budget = new StageBudget(5000);
  try {
    await assert.rejects(adapter._requestAgentResult(matrix, request, WORKER, "!worker:isolated", "提交完整指标", budget), { code: "AGENTTEAMS_AGENT_OUTPUT_INVALID" });
    assert.equal(matrix.sent.length, 2);
    assert.match(matrix.sent[1].body, /上一个输出未通过固定契约校验/);
    assert.match(matrix.sent[1].body, /尚未执行任何平台工具/);
    assert.match(matrix.sent[1].body, /evidenceIds 必须为空/);
  } finally { budget.dispose(); }
});

/** 调查与复验只能引用各自请求中的事实，调查不应混入复验关闭门槛。 / Investigation and verification cite their own facts without mixing closure gates into investigation. */
test("conclusion and verification prompts retain distinct evidence semantics", async () => {
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd() });
  const prompts = [];
  /** 捕获实际构造的任务，不发送任何消息。 / Capture constructed tasks without sending messages. */
  adapter._waitForMarkedMessage = async (input) => { prompts.push(input.prompt); return { value: {}, transportEvents: [] }; };
  const request = planningRequest();
  request.stage = "INVESTIGATION_CONCLUSION";
  request.skill = { name: "goai-change-execute", version: "1.1.0" };
  request.context.evidence = [{ evidenceId: "actual-investigation", toolName: "aiops.service.health", signals: { healthy: true } }];
  await adapter._requestAgentResult({}, request, LEADER, "!leader:isolated", adapter._defaultTaskBrief(request), {});
  assert.match(prompts[0], /summary 中每个事实必须由所引用 evidenceIds 支撑/);
  assert.match(prompts[0], /缺失字段保持未知/);
  assert.doesNotMatch(prompts[0], /VERIFICATION_CONCLUSION 必须逐项读取|context\.evidence=\[\]/);
  request.stage = "VERIFICATION_CONCLUSION";
  request.skill = { name: "goai-service-verify", version: "1.1.0" };
  request.context.evidence = [{ evidenceId: "actual-verification", toolName: "aiops.service.health", signals: { healthy: true } }];
  await adapter._requestAgentResult({}, request, VERIFIER, "!verifier:isolated", adapter._defaultTaskBrief(request), {});
  assert.match(prompts[1], /执行成功回执、调查证据、规划摘要和历史记忆不能替代当前验证证据/);
  assert.match(prompts[1], /VERIFICATION_CONCLUSION 必须逐项读取/);
  assert.match(prompts[1], /actual-verification/);
  assert.doesNotMatch(prompts[1], /actual-investigation/);
});

/** 保留模型不可靠摘要用于审计，不能把关键词过滤冒充完整语义校验。 / Preserve unreliable model summaries for audit rather than pretending keyword filtering is semantic validation. */
test("output parsing preserves original model text while rejecting fabricated evidence references", () => {
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd() });
  const request = planningRequest();
  const marker = `[OPENXNET_RESULT:${request.requestId}]`;
  const originalClaim = "原始错误声明：已完成工具调用，healthy=false。";
  const output = adapter._parseAgentOutput(resultBody(request, WORKER, { summary: originalClaim }), marker, request, WORKER);
  assert.equal(output.summary, originalClaim);
  assert.deepEqual(output.evidenceIds, []);
  assert.throws(() => adapter._parseAgentOutput(resultBody(request, WORKER, { evidenceIds: ["invented-evidence"] }), marker, request, WORKER), { code: "AGENTTEAMS_AGENT_OUTPUT_INVALID" });
});

/** 构造路由包络，允许复现真实模型的多字段错误。 / Build a route envelope that can reproduce the observed extra-field model failure. */
function routeBody(request, overrides = {}) {
  return `[OPENXNET_ROUTE:${request.requestId}]\n${JSON.stringify({
    schema: "openxnet.agentteams.route-output.v1", requestId: request.requestId, stage: request.stage,
    assigneeRoleCardId: WORKER.roleCardId, taskBrief: "选择本次必需只读工具，尚未执行工具，不提交观测结果。", ...overrides,
  })}`;
}

/** 实际故障的四个结果字段必须由模型自行纠正，系统保留原始回包。 / The model must correct the four observed result fields itself while the system preserves original replies. */
test("Leader route repairs observed result-field contamination without normalizing model output", async () => {
  const request = planningRequest();
  const invalid = routeBody(request, { requestedToolNames: request.context.availableTools, evidenceIds: [], summary: "工具计划", confidence: 0.9 });
  const matrix = isolatedMatrix([invalid, routeBody(request)]);
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd(), taskPollIntervalMs: 500, sleep: async () => {} });
  const budget = new StageBudget(5000);
  try {
    const route = await adapter._requestLeaderRoute(matrix, request, LEADER, [LEADER, WORKER], "!leader:isolated", budget);
    assert.equal(matrix.sent.length, 2);
    assert.equal(route.value.assigneeRoleCardId, WORKER.roleCardId);
    assert.equal(route.transportEvents.length, 4);
    assert.equal(route.transportEvents[1].redactedBody, invalid);
    for (const message of matrix.sent) {
      assert.match(message.body, /恰好包含 schema、requestId、stage、assigneeRoleCardId、taskBrief 五个字段/);
      assert.match(message.body, /不得在路由顶层添加 requestedToolNames、evidenceIds、summary、confidence/);
      assert.match(message.body, /唯一允许的候选身份/);
      assert.match(message.body, /"roleCardId":"worker"/);
      assert.match(message.body, /"requestId":"stage-semantics"/);
      assert.doesNotMatch(message.body, /requestedToolNames 必须选择|evidenceIds 必须为空|confidence 仅表示/);
    }
    assert.match(matrix.sent[1].body, /唯一一次纠错机会/);
  } finally { budget.dispose(); }
});

/** 连续错误仍停止且不隐式分派，也不删除额外字段。 / Repeated malformed output still stops without implicit assignment or dropping extra fields. */
test("Leader route rejects a second contaminated output and all scope substitutions", async () => {
  const request = planningRequest();
  const invalid = routeBody(request, { summary: "必须拒绝的额外字段" });
  const matrix = isolatedMatrix([invalid, invalid]);
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd(), taskPollIntervalMs: 500, sleep: async () => {} });
  const budget = new StageBudget(5000);
  try {
    await assert.rejects(adapter._requestLeaderRoute(matrix, request, LEADER, [LEADER, WORKER], "!leader:isolated", budget), { code: "AGENTTEAMS_AGENT_OUTPUT_INVALID" });
    assert.equal(matrix.sent.length, 2);
  } finally { budget.dispose(); }
  for (const override of [
    { assigneeRoleCardId: "outside-workspace" }, { requestId: "other-run" },
    { stage: "VERIFICATION_CONCLUSION" }, { schema: "openxnet.agentteams.agent-output.v1" },
  ]) {
    assert.throws(() => adapter._parseRouteOutput(routeBody(request, override), `[OPENXNET_ROUTE:${request.requestId}]`, request, [WORKER]), { code: "AGENTTEAMS_ROUTE_INVALID" });
  }
  for (const override of [{ requestedToolNames: [] }, { evidenceIds: [] }, { summary: "extra" }, { confidence: 0.9 }]) {
    assert.throws(() => adapter._parseRouteOutput(routeBody(request, override), `[OPENXNET_ROUTE:${request.requestId}]`, request, [WORKER]), { code: "AGENTTEAMS_AGENT_OUTPUT_INVALID" });
  }
});

/** 验证者路由保留独立证据门禁，仍只输出五字段路由包络。 / Verifier routing retains independent-evidence gates while emitting only the five-field route envelope. */
test("Verifier routing uses the same strict envelope without emitting verification result fields", async () => {
  const request = planningRequest();
  request.stage = "VERIFICATION_CONCLUSION";
  request.skill = { name: "goai-service-verify", version: "1.1.0" };
  request.context.evidence = [{ evidenceId: "new-verification-evidence", toolName: "aiops.service.health", signals: { healthy: false } }];
  const valid = routeBody(request, { assigneeRoleCardId: VERIFIER.roleCardId });
  const invalid = routeBody(request, { assigneeRoleCardId: VERIFIER.roleCardId, evidenceIds: ["new-verification-evidence"], summary: "extra" });
  const matrix = isolatedMatrix([invalid, valid]);
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd(), taskPollIntervalMs: 500, sleep: async () => {} });
  const budget = new StageBudget(5000);
  try {
    const route = await adapter._requestLeaderRoute(matrix, request, LEADER, [LEADER, VERIFIER], "!leader:isolated", budget);
    assert.equal(route.value.assigneeRoleCardId, VERIFIER.roleCardId);
    for (const message of matrix.sent) {
      assert.match(message.body, /本次独立验证证据/);
      assert.match(message.body, /执行成功回执、调查证据和历史记忆不能替代独立验证/);
      assert.match(message.body, /客观阈值失败时不得要求关闭/);
      assert.match(message.body, /"roleCardId":"verifier"/);
      assert.doesNotMatch(message.body, /summary 必须说明|"roleCardId":"worker"/);
    }
  } finally { budget.dispose(); }
});
