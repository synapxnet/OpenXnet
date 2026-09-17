#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 驻场上下文边界验收 / Resident context boundary acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __author__: maoyo | __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const { parseTaskRequest, parseResidentContexts, PublicError } = require("../src/contracts");
const { AgentTeamsCliAdapter } = require("../src/agentteams-cli");
const { createApplication } = require("../src/server");
const NOW = new Date("2026-09-16T12:00:00.000Z");
const TEST_SECRET = "isolated-test-delegation-secret-never-a-deployed-key";

/** 构造与当前桌面格式一致的最小三平台任务。 / Build a minimal three-platform task matching the desktop wire format. */
function taskFixture() {
  const task = { schema: "openxnet.agentteams.task.v1", requestId: "request-acceptance", workspaceId: "workspace-one", incidentId: "incident-one", traceId: "trace-one", teamTemplateId: "template-one", teamTemplateVersion: 1, teamName: "acceptance-team", stage: "INVESTIGATION_PLAN", skill: { name: "goai-evidence-collect", version: "1.1.0" }, context: {
    incident: { title: "跨域特征漂移恢复", summary: "业务退化但服务健康", severity: "P1", scenario: { scenarioType: "feature-drift", alertUid: "alert-one", serviceUid: "service-one", clusterId: "cluster-one", namespace: "risk", workloadName: "risk", reportUid: "report-one", assetUid: "asset-one", workflowInstanceUid: "workflow-one", deploymentUid: "deploy-one", expectedResourceVersion: "1", testDatasetRef: "fixture://goai/risk-120-v1", failingRevision: 18, targetRevision: 17 } },
    availableTools: ["aiops.service.health", "dataops.schema.snapshot.get", "mlops.deployment.get"], evidence: [], proposedPlan: null, action: null,
    policy: { approvalRequiredTools: ["mlops.deployments.rollback"], maxErrorRate: 0.05, maxP95Ms: 300, requireHealthyService: true, requireReadyReplicas: false, requiredVerificationTools: [] },
  } };
  task.context.residentContexts = ["aiops", "dataops", "mlops"].map(/** 每个平台只持有本平台工具范围。 / Give each platform only its own tool scope. */ (platform, index) => ({
    workspaceId: task.workspaceId, environment: "staging", source: "SIMULATION", runId: `run-${task.traceId}`, incidentId: task.incidentId, traceId: task.traceId, agentId: `agt-${platform}-resident-v130`, platform, contextVersion: "ctx-1", contextTtl: new Date(NOW.getTime() + 15 * 60_000).toISOString(), evidenceRefs: [], allowedTools: [task.context.availableTools[index]],
  }));
  return task;
}

/** 校验新字段保真、隔离复制以及旧六字段请求继续有效。 / Verify new-field fidelity, copy isolation and continued support for legacy six-field contexts. */
test("native resident contexts survive task parsing while legacy requests remain compatible", () => {
  const source = taskFixture();
  const parsed = parseTaskRequest(source, NOW);
  assert.deepEqual(parsed.context.residentContexts, source.context.residentContexts);
  source.context.residentContexts[0].allowedTools.push("aiops.inference.capacity.apply");
  assert.equal(parsed.context.residentContexts[0].allowedTools.length, 1);
  const legacy = taskFixture();
  delete legacy.context.residentContexts;
  assert.equal(Object.hasOwn(parseTaskRequest(legacy, NOW).context, "residentContexts"), false);
});

/** 完整负向范围矩阵，每项拒绝后不产生真实模型任务。 / Exercise a negative scope matrix without creating real model tasks. */
test("resident scopes reject foreign identities, writes, expiry, duplicate platforms and untrusted references", () => {
  const mutations = [
    /** 更换工作空间。 / Substitute a workspace. */ (r) => { r.workspaceId = "foreign-space"; },
    /** 更换事件。 / Substitute an incident. */ (r) => { r.incidentId = "foreign-incident"; },
    /** 更换运行轨迹。 / Substitute a trace. */ (r) => { r.traceId = "foreign-trace"; },
    /** 更换运行标识。 / Substitute a run. */ (r) => { r.runId = "foreign-run"; },
    /** 冒充其他平台Agent。 / Impersonate another platform agent. */ (r) => { r.agentId = "agt-mlops-resident-v130"; },
    /** 以数组伪装平台字符串。 / Disguise a platform string as an array. */ (r) => { r.platform = ["aiops"]; },
    /** 扩展为平台写操作。 / Expand into platform writes. */ (r) => { r.allowedTools = ["aiops.inference.capacity.apply"]; },
    /** 跨平台读取。 / Read from another platform. */ (r) => { r.allowedTools = ["mlops.deployment.get"]; },
    /** 重复工具范围。 / Duplicate a tool scope. */ (r) => { r.allowedTools.push(r.allowedTools[0]); },
    /** 注入未知凭据字段。 / Inject an unknown credential field. */ (r) => { r.apiKey = "test-only"; },
    /** 过期上下文。 / Expire the context. */ (r) => { r.contextTtl = NOW.toISOString(); },
    /** 超长授权窗口。 / Extend the authorization window. */ (r) => { r.contextTtl = new Date(NOW.getTime() + 31 * 60_000).toISOString(); },
    /** 非法上下文版本。 / Supply an invalid context version. */ (r) => { r.contextVersion = "ctx-0"; },
    /** 伪造证据引用。 / Fabricate an evidence reference. */ (r) => { r.evidenceRefs = ["evidence-not-in-task"]; },
    /** 混用生产环境。 / Mix a production environment into the task. */ (r) => { r.environment = "production"; },
    /** 混用现场与模拟来源。 / Mix live and simulated provenance. */ (r) => { r.source = "LIVE-STAGING"; },
  ];
  for (const mutate of mutations) {
    const request = taskFixture(); mutate(request.context.residentContexts[0]);
    assert.throws(() => parseTaskRequest(request, NOW), PublicError);
  }
  for (const residents of [[], null, {}, [taskFixture().context.residentContexts[0], taskFixture().context.residentContexts[0]], Array(4).fill(taskFixture().context.residentContexts[0])]) {
    const request = taskFixture(); request.context.residentContexts = residents;
    assert.throws(() => parseTaskRequest(request, NOW), PublicError);
  }
  const request = taskFixture();
  request.context.evidence = [{ evidenceId: "current-mlops", toolName: "mlops.deployment.get" }];
  request.context.residentContexts[0].evidenceRefs = ["current-mlops"];
  assert.throws(() => parseResidentContexts(request.context.residentContexts, request, NOW), /outside its authorized scope/);
  request.context.residentContexts[0].evidenceRefs = [];
  request.context.residentContexts[2].evidenceRefs = ["current-mlops"];
  assert.equal(parseResidentContexts(request.context.residentContexts, request, NOW)[2].evidenceRefs[0], "current-mlops");
});

/** 经过真实提示词构造函数确认Leader和Worker都收到完整且受限的上下文。 / Verify actual prompt builders carry complete bounded contexts to Leader and Worker. */
test("real Leader and Worker prompt paths include native contexts and reject expiry before sending", async () => {
  let now = NOW;
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd(), now: () => now });
  const request = parseTaskRequest(taskFixture(), NOW);
  const prompts = [];
  /** 仅捕获消息构造结果，不连接Matrix或发消息。 / Capture message construction without connecting to Matrix or sending messages. */
  adapter._waitForMarkedMessage = async (options) => { prompts.push(options.prompt); return { value: {}, transportEvents: [] }; };
  const leader = { roleCardId: "leader", name: "Leader", teamRole: "leader", matrixUserId: "@leader:test" };
  const worker = { roleCardId: "worker", name: "Evidence Worker", teamRole: "worker", matrixUserId: "@worker:test" };
  await adapter._requestLeaderRoute({}, request, leader, [leader, worker], "!leader:test", {});
  await adapter._requestAgentResult({}, request, worker, "!worker:test", "只读取证", {});
  for (const prompt of prompts) {
    assert.match(prompt, /residentContexts/);
    assert.match(prompt, /agt-aiops-resident-v130/);
    assert.match(prompt, /contextVersion/);
    assert.match(prompt, /只读/);
    assert.ok(prompt.includes(JSON.stringify(request.context)));
  }
  now = new Date(NOW.getTime() + 16 * 60_000);
  await assert.rejects(adapter._requestAgentResult({}, request, worker, "!worker:test", "只读取证", {}), /outside its authorized scope/);
  assert.equal(prompts.length, 2);
  assert.throws(() => adapter.dispatchTask(request, {}), /outside its authorized scope/);
});

/** 签发仅用于隔离HTTP测试的精确范围委托。 / Sign an exact-scope delegation used only by isolated HTTP tests. */
function signTask(request) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "openxnet-desktop", aud: "openxnet-agentteams-adapter", sub: "test-user", iat: NOW.getTime() / 1000, exp: NOW.getTime() / 1000 + 300, scopes: ["agentteams:task:dispatch"], request_id: request.requestId, workspace_id: request.workspaceId, incident_id: request.incidentId, trace_id: request.traceId, team_template_id: request.teamTemplateId, team_template_version: request.teamTemplateVersion, team_name: request.teamName, stage: request.stage })).toString("base64url");
  return `${header}.${payload}.${createHmac("sha256", TEST_SECRET).update(`${header}.${payload}`).digest("base64url")}`;
}

/** 验证HTTP服务在派发之前拒绝非法上下文，并保留新旧请求兼容。 / Verify HTTP rejection precedes dispatch and preserves new and old request compatibility. */
test("HTTP contract advertises native support and rejects cross-scope contexts before dispatch", async () => {
  const dispatched = [];
  const application = createApplication({ provisioningToken: "test-provisioning-credential-at-least-32", delegationSecret: TEST_SECRET, now: () => NOW,
    credentialStore: { read: async () => ({ matrixAccessToken: "test-session" }) },
    agentTeams: { dispatchTask: async (request) => { dispatched.push(request); return { taskId: "isolated-task", route: null, result: {}, transportEvents: [] }; } }, logger: { info() {}, warn() {}, error() {} },
  });
  application.listen(0, "127.0.0.1"); await once(application, "listening");
  const base = `http://127.0.0.1:${application.address().port}`;
  /** 只向测试进程发送任务，凭据不会出现在返回日志。 / Send only to the isolated test process without logging credentials. */
  const send = (request) => fetch(`${base}/api/v1/tasks/dispatch`, { method: "POST", headers: { Authorization: `Bearer ${signTask(request)}`, "Content-Type": "application/json" }, body: JSON.stringify(request) });
  try {
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.version, require("../package.json").version);
    assert.equal(health.capabilities.residentContexts, true);
    const wrong = taskFixture(); wrong.context.residentContexts[0].workspaceId = "other-workspace";
    const denied = await send(wrong); assert.equal(denied.status, 400); assert.equal(dispatched.length, 0);
    const native = taskFixture(); assert.equal((await send(native)).status, 200);
    assert.deepEqual(dispatched[0].context.residentContexts, native.context.residentContexts);
    const legacy = taskFixture(); delete legacy.context.residentContexts;
    assert.equal((await send(legacy)).status, 200);
    assert.equal(dispatched.length, 2);
  } finally {
    await new Promise(/** 关闭本地隔离HTTP监听。 / Close the isolated local HTTP listener. */ (resolve) => application.close(resolve));
  }
});
