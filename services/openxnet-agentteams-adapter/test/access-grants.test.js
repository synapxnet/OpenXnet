#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 安装版演示授权边界测试 / Installed-desktop demo authorization boundary tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { once } = require("node:events");
const { AccessGrantStore } = require("../src/access-grant-store");
const { createApplication } = require("../src/server");
const { compileTeam, teamName } = require("../src/agentteams-cli");
const { PublicError } = require("../src/contracts");
const NOW = new Date("2026-09-17T10:00:00.000Z");
const ADMIN = "test-only-provisioning-value-not-a-deployed-secret";

/** 创建独立账本并在测试结束清理。 / Create an isolated ledger and clean it after the test. */
async function storeFixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ox-demo-grants-"));
  t.after(/** 仅清理本测试生成的临时目录。 / Remove only this test's generated temporary directory. */ () => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "grants.json");
  return { filename, store: new AccessGrantStore(filename, { now: () => NOW, ...options }) };
}

/** 构造严格准备团队请求。 / Build a strictly shaped team preparation request. */
function prepareFixture() {
  return { schema: "openxnet.agentteams.prepare.v1", requestId: "request-one", workspaceId: "workspace-one", incidentId: "incident-one", traceId: "trace-one", teamTemplateId: "template-one", teamTemplateVersion: 1, teamTemplateName: "Demo team",
    members: ["leader", "worker", "verifier"].map(/** 为三个职责建立固定角色快照。 / Create fixed role snapshots for three responsibilities. */ role => ({ roleCardId: `role-${role}`, name: role, department: "Demo", description: "Bounded demo role", teamRole: role, systemPrompt: "Use supplied evidence", runtimeSystemPrompt: "Use supplied evidence", permissions: ["read"], tools: [], skills: [] })) };
}

/** 构造三平台演练阶段请求。 / Build a three-platform fixture stage request. */
function taskFixture(grantId) {
  const task = { schema: "openxnet.agentteams.task.v1", requestId: "task-one", workspaceId: "workspace-one", incidentId: "incident-one", traceId: "trace-one", teamTemplateId: "template-one", teamTemplateVersion: 1, teamName: "unused", stage: "INVESTIGATION_PLAN", skill: { name: "goai-evidence-collect", version: "1.1.0" }, context: {
    incident: { title: "跨域特征漂移恢复", summary: "待取证", severity: "P1", scenario: { scenarioType: "feature-drift", alertUid: "alert-one", serviceUid: "service-one", clusterId: "cluster-one", namespace: "risk", workloadName: "risk", reportUid: "report-one", assetUid: "asset-one", workflowInstanceUid: "workflow-one", deploymentUid: "deploy-one", expectedResourceVersion: "1", testDatasetRef: "fixture://goai/risk-120-v1", failingRevision: 18, targetRevision: 17 } },
    availableTools: ["aiops.service.health", "dataops.schema.snapshot.get", "mlops.deployment.get"], evidence: [], proposedPlan: null, action: null,
    policy: { approvalRequiredTools: ["mlops.deployments.rollback"], maxErrorRate: 0.05, maxP95Ms: 300, requireHealthyService: true, requireReadyReplicas: false, requiredVerificationTools: [] } } };
  task.teamName = teamName({ ...task, accessGrantId: grantId });
  task.context.residentContexts = ["aiops", "dataops", "mlops"].map(/** 各平台保持相同演练来源和独立只读工具。 / Keep shared fixture provenance and separate read-only tools. */ (platform, index) => ({ workspaceId: task.workspaceId, environment: "staging", source: "SIMULATION", runId: `run-${task.traceId}`, incidentId: task.incidentId, traceId: task.traceId, agentId: `agt-${platform}-resident-v130`, platform, contextVersion: "ctx-1", contextTtl: new Date(NOW.getTime() + 900000).toISOString(), evidenceRefs: [], allowedTools: [task.context.availableTools[index]] }));
  return task;
}

/** 错误码匹配不依赖敏感错误内容。 / Match error codes without depending on sensitive messages. */
function errorCode(code) { return error => error instanceof PublicError && error.code === code; }

test("grant checks never bind, first connect binds atomically, and disk contains only credential digests", /** 验证首次连接与凭据落盘边界。 / Verify first connection and credential persistence boundaries. */ async t => {
  const { store, filename } = await storeFixture(t);
  const grant = await store.issue({ label: "评委演示", maximumRequests: 4 });
  assert.match(grant.accessCode, /^oxdemo_[a-f0-9]{64}$/u);
  assert.equal((await store.inspect(grant.accessCode, "workspace-a", false, true)).serviceReady, true);
  assert.equal((await store.inspect(grant.accessCode, "workspace-b", false, true)).workspaceId, "workspace-b");
  const results = await Promise.allSettled([store.inspect(grant.accessCode, "workspace-a", true, true), store.inspect(grant.accessCode, "workspace-b", true, true)]);
  assert.equal(results.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(results.find(value => value.status === "rejected").reason.code, "ACCESS_WORKSPACE_MISMATCH");
  const restored = new AccessGrantStore(filename, { now: () => NOW });
  const metadata = await restored.inspect(grant.accessCode, "workspace-a", false, true);
  assert.equal(metadata.remainingRequests, 4);
  assert.equal(JSON.stringify(metadata).includes(grant.accessCode), false);
  assert.equal((await readFile(filename, "utf8")).includes(grant.accessCode), false);
});

test("grants enforce expiry, revocation, bounded issuance and exact workspace scope", /** 验证授权生命周期和预绑定范围。 / Verify grant lifecycle and prebound scope. */ async t => {
  let time = NOW;
  const { store } = await storeFixture(t, { now: () => time });
  const grant = await store.issue({ label: "Scoped", workspaceId: "workspace-one", expiresInSeconds: 60 });
  await assert.rejects(store.inspect(grant.accessCode, "workspace-other", false, true), errorCode("ACCESS_WORKSPACE_MISMATCH"));
  time = new Date(NOW.getTime() + 60000);
  await assert.rejects(store.inspect(grant.accessCode, "workspace-one", false, true), errorCode("ACCESS_EXPIRED"));
  time = NOW;
  await store.revoke(grant.grantId);
  await assert.rejects(store.inspect(grant.accessCode, "workspace-one", false, true), errorCode("ACCESS_REVOKED"));
  await assert.rejects(store.inspect(`oxdemo_${"0".repeat(64)}`, "workspace-one", false, true), errorCode("ACCESS_INVALID"));
  assert.throws(() => store.issue({ label: "Too long", expiresInSeconds: 604801 }), errorCode("ACCESS_INVALID_REQUEST"));
  assert.throws(() => store.issue({ label: "Too much", maximumRequests: 201 }), errorCode("ACCESS_INVALID_REQUEST"));
});

test("team readiness retries reuse the same quota reservation and can eventually complete", /** 未就绪是可重试等待，不能永久缓存成失败。 / Readiness waits are retryable and must not be cached as permanent failures. */ async t => {
  const { store } = await storeFixture(t);
  const grant = await store.issue({ label: "Readiness", workspaceId: "workspace-one", maximumRequests: 1 });
  let calls = 0;
  /** 第一次团队未就绪，第二次完成。 / The team is not ready on the first call and completes on the second. */
  const prepare = async () => { calls++; if (calls === 1) throw new PublicError(503, "AGENTTEAMS_TEAM_NOT_READY", "Team is still becoming ready."); return { ready: true }; };
  await assert.rejects(store.execute(grant.accessCode, "fixture", "prepare", prepareFixture(), prepare), errorCode("AGENTTEAMS_TEAM_NOT_READY"));
  assert.deepEqual(await store.execute(grant.accessCode, "fixture", "prepare", prepareFixture(), prepare), { ready: true });
  assert.deepEqual(await store.execute(grant.accessCode, "fixture", "prepare", prepareFixture(), prepare), { ready: true });
  assert.equal(calls, 2);
  assert.equal((await store.inspect(grant.accessCode, null, false, true)).remainingRequests, 0);
});

test("request quota, restart-safe replay, changed bodies, and per-grant concurrency are enforced", /** 验证配额、重放和并发边界。 / Verify quota, replay, and concurrency boundaries. */ async t => {
  const { store, filename } = await storeFixture(t);
  const grant = await store.issue({ label: "Quota", workspaceId: "workspace-one", maximumRequests: 1 });
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let executions = 0;
  const body = prepareFixture();
  const running = store.execute(grant.accessCode, "fixture", "prepare", body, async () => { executions++; entered(); await gate; return { status: "READY" }; });
  await started;
  await assert.rejects(store.execute(grant.accessCode, "fixture", "prepare", body, async () => ({})), errorCode("ACCESS_REQUEST_BUSY"));
  await assert.rejects(store.execute(grant.accessCode, "fixture", "prepare", { ...body, requestId: "other" }, async () => ({})), errorCode("ACCESS_REQUEST_BUSY"));
  await assert.rejects(store.execute(grant.accessCode, "fixture", "prepare", { ...body, teamTemplateName: "changed" }, async () => ({})), errorCode("ACCESS_REQUEST_CONFLICT"));
  release();
  assert.deepEqual(await running, { status: "READY" });
  const restored = new AccessGrantStore(filename, { now: () => NOW });
  assert.deepEqual(await restored.execute(grant.accessCode, "fixture", "prepare", body, async () => { executions++; return {}; }), { status: "READY" });
  assert.equal(executions, 1);
  assert.equal((await restored.inspect(grant.accessCode, "workspace-one", false, true)).remainingRequests, 0);
  await assert.rejects(restored.execute(grant.accessCode, "fixture", "prepare", { ...body, requestId: "new" }, async () => ({})), errorCode("ACCESS_QUOTA_EXHAUSTED"));
});

test("failed requests remain replayable without retrying side effects or leaking private errors", /** 失败回执不重放副作用也不暴露内部异常。 / Failed receipts neither replay side effects nor expose private exceptions. */ async t => {
  const { store, filename } = await storeFixture(t);
  const grant = await store.issue({ label: "Failure", workspaceId: "workspace-one" });
  let runs = 0;
  const work = async () => { runs++; throw new Error("private-value-that-must-not-be-returned"); };
  await assert.rejects(store.execute(grant.accessCode, "fixture", "prepare", prepareFixture(), work), errorCode("INTERNAL_ERROR"));
  await assert.rejects(store.execute(grant.accessCode, "fixture", "prepare", prepareFixture(), work), errorCode("INTERNAL_ERROR"));
  assert.equal(runs, 1);
  assert.equal((await readFile(filename, "utf8")).includes("private-value-that-must-not-be-returned"), false);
});

test("grant names isolate equal role IDs across grants, workspaces and templates while legacy names stay unchanged", /** 验证新路径命名隔离且不改变旧映射。 / Verify isolation of new names without changing legacy mappings. */ () => {
  const configuration = { leaderModel: "qwen", workerModel: "qwen", leaderRuntime: "copaw", workerRuntime: "copaw", heartbeatEvery: "5m" };
  const legacy = compileTeam(prepareFixture(), configuration);
  const scoped = { ...prepareFixture(), accessGrantId: "grant-one" };
  const first = compileTeam(scoped, configuration);
  assert.notEqual(first.name, legacy.name);
  for (const request of [{ ...scoped, accessGrantId: "grant-two" }, { ...scoped, workspaceId: "workspace-two" }, { ...scoped, teamTemplateId: "template-two" }]) {
    const changed = compileTeam(request, configuration);
    assert.notEqual(changed.name, first.name);
    for (let i = 0; i < first.members.length; i++) assert.notEqual(changed.members[i].name, first.members[i].name);
  }
  assert.deepEqual(compileTeam(prepareFixture(), configuration), legacy);
});

test("HTTP access codes cannot manage service, cross workspace, omit fixture provenance or call Live", /** 通过真实HTTP路径验证授权和业务之间的边界。 / Verify authorization/business boundaries through real HTTP paths. */ async t => {
  const { store } = await storeFixture(t);
  const invoked = [];
  const logs = [];
  const server = createApplication({ provisioningToken: ADMIN, delegationSecret: "test-only-delegation-secret-not-deployed", accessGrantStore: store, now: () => NOW,
    credentialStore: { read: async () => ({ matrixUrl: "http://unused", matrixAccessToken: "test-session", matrixUserId: "@test:unused" }) },
    agentTeams: { prepareTeam: async request => { invoked.push(request); return { teamName: teamName(request), status: "READY", phase: "Active", leaderName: "leader", readyWorkers: 3, totalWorkers: 3, workerNames: ["a", "b", "c"] }; }, dispatchTask: async request => { invoked.push(request); return { taskId: "test-task", route: null, result: {}, transportEvents: [] }; } },
    logger: { info: value => logs.push(value), warn: value => logs.push(value), error: value => logs.push(value) } });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(/** 关闭隔离HTTP服务。 / Close the isolated HTTP service. */ () => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  /** 发送测试请求并保留响应状态和公开JSON。 / Send a test request and retain status and public JSON. */
  async function send(route, token, body, mode = "fixture", method = "POST") {
    const response = await fetch(`${origin}${route}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(mode ? { "X-OpenXnet-Execution-Mode": mode } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, value: await response.json() };
  }
  assert.equal((await (await fetch(`${origin}/health`)).json()).capabilities.demoAccessCodes, true);
  const issued = await send("/api/v1/access/grants", ADMIN, { label: "HTTP test", maximumRequests: 12 });
  assert.equal(issued.status, 201);
  const code = issued.value.accessCode;
  assert.equal((await send("/api/v1/access/check", code, { workspaceId: "workspace-one" })).value.serviceReady, true);
  assert.equal((await send("/api/v1/teams/prepare", code, prepareFixture())).value.error.code, "ACCESS_NOT_CONNECTED");
  assert.equal((await send("/api/v1/access/connect", code, { workspaceId: "workspace-one" })).status, 200);
  for (const route of ["/api/v1/access/grants", "/api/v1/session"]) assert.equal((await send(route, code, { label: "forbidden" })).status, 401);
  assert.equal((await send(`/api/v1/access/grants/${issued.value.grantId}`, code, null, "fixture", "DELETE")).status, 401);
  assert.equal((await send("/api/v1/teams/prepare", code, prepareFixture(), "live")).value.error.code, "ACCESS_MODE_FORBIDDEN");
  assert.equal((await send("/api/v1/teams/prepare", code, { ...prepareFixture(), workspaceId: "another" })).value.error.code, "ACCESS_WORKSPACE_MISMATCH");
  assert.equal(invoked.length, 0);
  assert.equal((await send("/api/v1/teams/prepare", code, prepareFixture())).status, 200);
  assert.equal((await send("/api/v1/teams/prepare", code, prepareFixture())).status, 200);
  assert.equal(invoked.length, 1);
  const task = taskFixture(issued.value.grantId);
  const missing = structuredClone(task); delete missing.context.residentContexts;
  assert.equal((await send("/api/v1/tasks/dispatch", code, missing)).value.error.code, "ACCESS_MODE_FORBIDDEN");
  const partial = structuredClone(task); partial.context.residentContexts.pop();
  assert.equal((await send("/api/v1/tasks/dispatch", code, partial)).value.error.code, "ACCESS_MODE_FORBIDDEN");
  for (const change of [{ environment: "production" }, { source: "LIVE-STAGING" }]) {
    const live = structuredClone(task); live.context.residentContexts.forEach(item => Object.assign(item, change));
    assert.equal((await send("/api/v1/tasks/dispatch", code, live)).value.error.code, "ACCESS_MODE_FORBIDDEN");
  }
  const foreign = structuredClone(task); foreign.requestId = "foreign-team"; foreign.teamName = "goai-unrelated";
  assert.equal((await send("/api/v1/tasks/dispatch", code, foreign)).value.error.code, "ACCESS_TEAM_MISMATCH");
  assert.equal((await send("/api/v1/tasks/dispatch", code, task)).status, 200);
  assert.equal(invoked.length, 2);
  assert.equal(invoked[1].accessGrantId, issued.value.grantId);
  assert.equal((await send(`/api/v1/access/grants/${issued.value.grantId}`, ADMIN, null, "fixture", "DELETE")).status, 200);
  assert.equal((await send("/api/v1/tasks/dispatch", code, task)).value.error.code, "ACCESS_REVOKED");
  assert.equal(JSON.stringify(logs).includes(code), false);
});
