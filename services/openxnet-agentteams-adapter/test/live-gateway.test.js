#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Live 网关权限和恢复验收 / Live gateway authorization and recovery acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { LiveAccessGrantStore, canonical, digest } = require("../src/live-access-store");
const { AccessGrantStore } = require("../src/access-grant-store");
const { LiveGateway, createLiveGateway, planScopes } = require("../src/live-gateway");
const { createApplication } = require("../src/server");
const { teamName } = require("../src/agentteams-cli");
const catalog = require("../src/live-tool-catalog");
const now = new Date("2026-09-17T09:00:00Z");
const SIGNING = "test-server-signing-key-32-characters-only";
const ISSUER = "test-approval-issuer-key-32-characters-only";

/** 创建精确范围测试授权，所有资源均为本地假数据。 / Build a precisely scoped grant using local fake resources only. */
function grantSpec() {
  return { label: "Local isolated acceptance", workspaceId: "workspace-1", expiresInSeconds: 3600, maximumRequests: 80,
    actorIds: ["agentteams:leader", "agentteams:worker", "agentteams:verifier", "operator"], approverIds: ["human-approver"],
    allowedTools: ["aiops.service.health", "mlops.deployment.get", "mlops.feature.fallback.apply", "mlops.feature.fallback.remove"],
    allowedScenarios: ["feature-drift"], resourceConstraints: { serviceUid: ["service-1"], deploymentUid: ["deploy-1"], featureSetUid: ["feature-1"] } };
}

/** 建立隔离账本与假上游网络。 / Create an isolated ledger and fake upstream transport. */
async function fixture(t, changes = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "openxnet-live-"));
  t.after(/** 清理唯一临时测试目录。 / Remove only the unique temporary test directory. */ () => rm(directory, { recursive: true, force: true }));
  const store = new LiveAccessGrantStore(path.join(directory, "grants.json"), { now: () => now });
  const grant = await store.issue({ ...grantSpec(), ...changes });
  await store.inspect(grant.accessCode, grant.workspaceId, true);
  const calls = [];
  const platforms = Object.fromEntries(["aiops", "dataops", "mlops"].map(/** 固定每个平台的假域名。 / Fix a fake hostname per platform. */ platform => [platform, { baseUrl: `https://${platform}.invalid/`, secret: SIGNING }]));
  const gateway = new LiveGateway({ store, platforms, approval: { baseUrl: "https://approval.invalid/", token: ISSUER }, now: () => now,
    /** 只在内存中响应固定工具，无真实网络和业务写入。 / Respond in memory to fixed tools without real network or business writes. */ fetch: async (url, options) => {
      url = new URL(url); calls.push({ url, options });
      if (url.hostname === "approval.invalid") return Response.json({ status: "ok" });
      if (url.pathname === "/") return new Response(`<title>Xnet${url.hostname.startsWith("aiops") ? "AIOps" : url.hostname.startsWith("dataops") ? "DataOps" : "MLOps"}</title>`);
      if (url.pathname.startsWith("/api/agent/v1/actions/")) return Response.json({ success: true, data: { actionId: url.pathname.split("/").at(-1), status: "SUCCEEDED" } });
      const body = JSON.parse(options.body);
      return Response.json({ success: true, data: { value: 1, actionId: body.toolName === "mlops.feature.fallback.apply" ? "act_12345678" : undefined }, error: null,
        meta: { requestId: body.requestId, workspaceId: options.headers["X-OpenXnet-Workspace-Id"], incidentId: options.headers["X-OpenXnet-Incident-Id"], traceId: options.headers["X-OpenXnet-Trace-Id"], toolName: body.toolName, contractVersion: "1.0.0", resourceVersion: "43", source: `Xnet${url.hostname.split(".")[0]}/local-fixture`, durationMs: 0, observedAt: now.toISOString(), summary: "Local fake upstream" } });
    } });
  return { directory, store, grant, gateway, calls };
}

/** 模拟已有 Team Prepare 的已解析形状。 / Model the parsed shape of existing Team Prepare. */
function prepareRequest() {
  return { requestId: "prepare-1", workspaceId: "workspace-1", incidentId: "incident-1", traceId: "trace-1", teamTemplateId: "template-1", teamTemplateVersion: 1,
    members: ["leader", "worker", "verifier"].map(/** 创建职责分离成员。 / Create members with separated duties. */ role => ({ roleCardId: role, teamRole: role, tools: [] })) };
}

/** 模拟阶段请求中已解析的最小范围。 / Model the minimum parsed scope of a stage request. */
function dispatchRequest(grant, stage = "INVESTIGATION_PLAN", plan = null) {
  return { ...prepareRequest(), requestId: stage, teamName: teamName({ ...prepareRequest(), accessGrantId: grant.grantId }), stage,
    context: { incident: { scenario: { scenarioType: "feature-drift" } }, availableTools: ["aiops.service.health"], proposedPlan: plan,
      residentContexts: ["aiops", "dataops", "mlops"].map(/** 保留真实演练源标记。 / Preserve real staging source markers. */ platform => ({ platform, source: "LIVE-STAGING", environment: "staging" })) } };
}

/** 完成不写平台的团队准备与场景绑定。 / Prepare a team and bind a scenario without platform writes. */
async function prepare(f) {
  await f.gateway.executeTeam(f.grant.accessCode, "live", "prepare", prepareRequest(), async scoped => ({ teamName: teamName(scoped) }));
  await f.gateway.executeTeam(f.grant.accessCode, "live", "dispatch", dispatchRequest(f.grant), async () => ({ result: { decision: "COLLECT_EVIDENCE", roleCardId: "worker" } }));
}

/** 创建范围固定的只读工具调用。 / Create a scoped read-only tool invocation. */
function readRequest(requestId = "read-1") {
  return { requestId, workspaceId: "workspace-1", incidentId: "incident-1", traceId: "trace-1", actorId: "agentteams:worker", toolName: "aiops.service.health", arguments: { serviceUid: "service-1" }, governance: null };
}

/** 创建被审批的写参数和精确治理字段。 / Create approved write arguments and exact governance fields. */
function writeRequest() {
  const args = { deploymentUid: "deploy-1", featureSetUid: "feature-1", reasonCode: "CONTRACT_DRIFT" };
  return { ...readRequest("write-1"), actorId: "operator", toolName: "mlops.feature.fallback.apply", arguments: args,
    governance: { approvalId: "approval-1", planId: "plan-1", planDigest: "a".repeat(64), stepId: "step-1", resourceId: "feature-set:deploy-1", targetRevision: 19, expectedResourceVersion: "42", argumentsDigest: digest(canonical(args)), compensation: false, reason: "Approved local test", dryRun: false, idempotencyKey: "idem-1" } };
}

/** 构建与真实 Runtime 投影规则相同的计划和审批。 / Build a plan and approval using the real runtime's projection rules. */
function approvalFixture() {
  const request = writeRequest(), g = request.governance;
  const step = { stepId: g.stepId, toolName: request.toolName, resourceId: g.resourceId, targetRevision: g.targetRevision, expectedResourceVersion: g.expectedResourceVersion, argumentsDigest: g.argumentsDigest, dependsOn: [] };
  const plan = { planId: g.planId, planDigest: g.planDigest, steps: [step, { ...step, stepId: "read-release", toolName: "mlops.deployment.get" }], compensationSteps: [{ ...step, stepId: "compensate-1", toolName: "mlops.feature.fallback.remove" }] };
  const approval = { approvalId: g.approvalId, status: "APPROVED", expiresAt: new Date(now.getTime() + 900000).toISOString(), workspaceId: request.workspaceId, incidentId: request.incidentId, traceId: request.traceId,
    toolName: request.toolName, resourceId: g.resourceId, targetRevision: g.targetRevision, expectedResourceVersion: g.expectedResourceVersion, planId: g.planId, planDigest: g.planDigest,
    scopes: planScopes(plan), requesterId: "agentteams:leader", approverId: "human-approver" };
  return { plan, approval, request };
}

/** 完成 Leader 明确请求审批阶段。 / Complete the stage in which the Leader explicitly requests approval. */
async function acceptPlan(f, plan) {
  return f.gateway.executeTeam(f.grant.accessCode, "live", "dispatch", dispatchRequest(f.grant, "INVESTIGATION_CONCLUSION", plan), async () => ({ result: { decision: "REQUEST_APPROVAL", roleCardId: "leader" } }));
}

test("Live is disabled by default and never auto-issues a grant", /** 默认关闭且不发凭证。 / Remain disabled without issuing credentials. */ () => {
  assert.equal(createLiveGateway({}, {}), null);
});

test("catalogue matches the deployed fixed tool contract", /** 校验打包目录没有漂移。 / Verify catalogue parity with the deployed registry. */ () => {
  const deployed = require("../../platform-resident-agent/vendor/competition-tool-registry").COMPETITION_TOOL_REGISTRY;
  assert.deepEqual(catalog, deployed.map(/** 只比较网关实际使用字段。 / Compare the fields actually consumed by the gateway. */ ({ name, platform, path: route, requiresApproval, timeoutMs, inputSchema }) => ({ name, platform, path: route, requiresApproval, timeoutMs, inputSchema })));
});

test("real desktop frozen plan projects to exact approval scopes in all three scenarios", /** 用真实桌面计划证明审批投影兼容。 / Prove approval projection compatibility using actual desktop plans. */ async t => {
  const { ApplicationCompetitionRuntimeService } = require("../../../build-ts/desktop/competition/application-competition-runtime");
  const f = await fixture(t);
  const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: f.directory });
  for (const scenarioType of ["feature-drift", "recommendation-capacity", "quantitative-iteration"]) {
    const created = await runtime.createIncident({ workspaceId: "workspace-1", actorId: "agentteams:leader", title: "Isolated contract", summary: "Local contract projection only", severity: "P1",
      scenario: { scenarioType, alertUid: "alert_risk_error_rate", serviceUid: "service_risk_inference", clusterId: "3", namespace: "risk-prod", workloadName: "risk-inference", reportUid: "qr_risk_features_120", assetUid: "asset_risk_features_prod", workflowInstanceUid: "task_risk_features_latest", deploymentUid: "deploy_risk_prod", failingRevision: 18, targetRevision: 17, expectedResourceVersion: "42", testDatasetRef: "fixture://goai/risk-120-v1" } });
    const incident = created.snapshot.incidents.find(item => item.incidentId === created.incidentId);
    const approval = runtime.createRemediationApproval(incident, "trace-contract", "agentteams:leader");
    const plan = runtime.createAgentTeamsPlanReference(incident, approval.planDigest);
    assert.deepEqual(planScopes(plan), approval.scopes);
    assert.equal(plan.planId, approval.planId); assert.equal(plan.planDigest, approval.planDigest);
  }
});

test("broad reusable role metadata does not expand a narrow grant", /** 复用角色能力不得扩大运行授权。 / Reusable role capability metadata must not expand runtime authorization. */ async t => {
  const f = await fixture(t);
  const request = prepareRequest(); request.members[0].tools = ["mlops.model.register"];
  await f.gateway.executeTeam(f.grant.accessCode, "live", "prepare", request, async scoped => ({ teamName: teamName(scoped) }));
  const task = dispatchRequest(f.grant); task.context.availableTools = ["mlops.model.register"];
  await assert.rejects(f.gateway.executeTeam(f.grant.accessCode, "live", "dispatch", task, async () => ({})), { code: "LIVE_TOOL_FORBIDDEN" });
});

test("credentials are hashed, pre-bound, scoped and separate from Fixture", /** 凭证不明文持久化且严格绑定空间。 / Hash credentials and bind the workspace strictly. */ async t => {
  const f = await fixture(t);
  const snapshot = await f.store.inspect(f.grant.accessCode, "workspace-1");
  assert.deepEqual(snapshot.modes, ["live"]); assert.equal(snapshot.requiredTeamRuntime, "agentteams");
  assert.equal((await readFile(f.store.filename, "utf8")).includes(f.grant.accessCode), false);
  await assert.rejects(f.store.inspect(f.grant.accessCode, "workspace-2"), { code: "LIVE_WORKSPACE_MISMATCH" });
  await assert.rejects(f.store.inspect(`oxdemo_${"a".repeat(64)}`, "workspace-1"), { code: "LIVE_ACCESS_INVALID" });
  assert.throws(() => f.store.issue({ ...grantSpec(), workspaceId: "" }), { code: "LIVE_INVALID_REQUEST" });
  assert.throws(() => f.store.issue({ ...grantSpec(), approverIds: ["operator"] }), { code: "LIVE_INVALID_REQUEST" });
  assert.throws(() => f.store.issue({ ...grantSpec(), resourceConstraints: {} }), { code: "LIVE_INVALID_REQUEST" });
});

test("readiness distinguishes missing configuration, wrong platform and ready services", /** 独立报告配置、身份与审批状态。 / Report configuration, identity and approval readiness separately. */ async t => {
  const f = await fixture(t);
  let result = await f.gateway.readiness(true);
  assert.equal(result.serviceReady, true); assert.equal(result.platforms.length, 3);
  f.gateway.platforms.dataops.baseUrl = "https://mlops.invalid";
  result = await f.gateway.readiness(true);
  assert.equal(result.serviceReady, false); assert.equal(result.checks.find(item => item.id === "dataops").code, "IDENTITY_MISMATCH");
  f.gateway.platforms.aiops.secret = "";
  result = await f.gateway.readiness(true);
  assert.equal(result.checks.find(item => item.id === "aiops").code, "NOT_CONFIGURED");
  assert.equal(f.calls.some(call => call.options.method === "POST" || call.options.method === "PUT"), false);
});

test("Live reads require prepared run, exact actor, resource and workspace", /** 阻断未准备或越界取证。 / Block unprepared and out-of-scope evidence reads. */ async t => {
  const f = await fixture(t);
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, readRequest()), { code: "LIVE_RUN_NOT_PREPARED" });
  await prepare(f);
  for (const [request, code] of [
    [{ ...readRequest(), actorId: "attacker" }, "LIVE_ACTOR_FORBIDDEN"],
    [{ ...readRequest(), arguments: { serviceUid: "other-service" } }, "LIVE_RESOURCE_FORBIDDEN"],
    [{ ...readRequest(), workspaceId: "other-workspace" }, "LIVE_WORKSPACE_MISMATCH"],
    [{ ...readRequest(), traceId: "other-trace" }, "LIVE_RUN_NOT_PREPARED"],
  ]) await assert.rejects(f.gateway.invoke(f.grant.accessCode, request), { code });
  assert.equal(f.calls.length, 0);
  const result = await f.gateway.invoke(f.grant.accessCode, readRequest()); assert.equal(result.success, true);
  const token = f.calls.at(-1).options.headers.Authorization.slice(7);
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
  assert.deepEqual(claims.tools, ["aiops.service.health"]); assert.equal(claims.workspace_id, "workspace-1"); assert.equal(claims.exp - claims.iat, 300);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("same request replays once and changed request or idempotency key is rejected", /** 阻断重放篡改和二次执行。 / Reject replay mutation and duplicate execution. */ async t => {
  const f = await fixture(t); await prepare(f);
  const first = await f.gateway.invoke(f.grant.accessCode, readRequest());
  assert.deepEqual(await f.gateway.invoke(f.grant.accessCode, readRequest()), first); assert.equal(f.calls.length, 1);
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, { ...readRequest(), arguments: { serviceUid: "service-1", windowMinutes: 5 } }), { code: "LIVE_REQUEST_CONFLICT" });
});

test("canonical three-platform metadata works without inventing a platform field", /** 正式三平台元数据不带 platform，来源及请求边界仍须核验。 / Canonical metadata omits platform while source and request boundaries remain verified. */ async t => {
  const f = await fixture(t, { allowedTools: [...grantSpec().allowedTools, "dataops.quality.report.get"],
    resourceConstraints: { ...grantSpec().resourceConstraints, reportUid: ["report-1"] } });
  await prepare(f);
  for (const [toolName, args] of [["aiops.service.health", { serviceUid: "service-1" }], ["dataops.quality.report.get", { reportUid: "report-1" }], ["mlops.deployment.get", { deploymentUid: "deploy-1" }]]) {
    const request = { ...readRequest(`canonical-${toolName}`), toolName, arguments: args };
    const response = await f.gateway.invoke(f.grant.accessCode, request);
    assert.equal(response.success, true);
    assert.equal(Object.hasOwn(response.meta, "platform"), false);
    assert.equal(response.meta.source, `Xnet${toolName.split(".")[0]}/local-fixture`);
  }
});

test("canonical response source and every explicit ownership field remain fail closed", /** 不因省略扩展字段而接受伪平台、伪来源或跨运行回包。 / Omission of an extension never admits forged platforms, sources, or cross-run responses. */ async t => {
  const f = await fixture(t); await prepare(f);
  const originalFetch = f.gateway.fetch;
  const bad = [
    { platform: "mlops" }, { platform: null }, { platform: "" },
    { source: "XnetMLOps/mon" }, { source: "XnetAIops-evil/mon" }, { source: "XnetAIops/" },
    { source: "XnetAIops/mon\nXnetDataops/dqm" }, { source: "XnetAIops/mon/XnetDataops" },
    { source: "agent-contract" }, { source: "" }, { source: null },
    ...["requestId", "workspaceId", "incidentId", "traceId", "toolName", "contractVersion"].map(/** 每个关联字段独立篡改。 / Mutate each linkage field independently. */ key => ({ [key]: "wrong" })),
  ];
  for (const [index, change] of bad.entries()) {
    /** 保留真实假上游结构，仅替换受测元数据。 / Retain the fake upstream shape while changing only the metadata under test. */
    f.gateway.fetch = async (url, options) => { const value = await (await originalFetch(url, options)).json(); return Response.json({ ...value, meta: { ...value.meta, ...change } }); };
    await assert.rejects(f.gateway.invoke(f.grant.accessCode, readRequest(`bad-meta-${index}`)), { code: "LIVE_UPSTREAM_SCOPE_MISMATCH" });
  }
  /** 一个明确且匹配的 platform 扩展可被原样保留。 / Preserve an explicit matching platform extension. */
  f.gateway.fetch = async (url, options) => { const value = await (await originalFetch(url, options)).json(); return Response.json({ ...value, meta: { ...value.meta, platform: "aiops" } }); };
  assert.equal((await f.gateway.invoke(f.grant.accessCode, readRequest("matching-extension"))).meta.platform, "aiops");
});

test("canonical contract rejection remains a failure and cannot become successful evidence", /** 正式契约拒绝原样保留，不能变为成功证据。 / Preserve canonical contract rejection without converting it to successful evidence. */ async t => {
  const f = await fixture(t); await prepare(f);
  const originalFetch = f.gateway.fetch;
  /** 构造具有完整关联但明确失败的正式错误包络。 / Build a canonically linked envelope with an explicit failed outcome. */
  f.gateway.fetch = async (url, options) => {
    const value = await (await originalFetch(url, options)).json();
    return Response.json({ ...value, success: false, data: null, error: { code: "RESOURCE_CHANGED", message: "Resource version changed", retryable: false }, meta: { ...value.meta, source: "agent-contract" } });
  };
  const response = await f.gateway.invoke(f.grant.accessCode, readRequest("contract-failure"));
  assert.equal(response.success, false);
  assert.equal(response.error.code, "RESOURCE_CHANGED");
  assert.equal(response.meta.source, "agent-contract");
});

test("parallel independent evidence calls work while duplicate pending calls stay blocked", /** 支持并行取证但拒绝同请求并发。 / Support parallel evidence while rejecting duplicate in-flight requests. */ async t => {
  const f = await fixture(t); await prepare(f);
  await Promise.all([f.gateway.invoke(f.grant.accessCode, readRequest("parallel-1")), f.gateway.invoke(f.grant.accessCode, readRequest("parallel-2"))]);
  assert.equal(f.calls.length, 2);
  let release;
  const completion = new Promise(resolve => { release = resolve; });
  const request = { ...prepareRequest(), requestId: "blocking" };
  const first = f.store.execute(f.grant.accessCode, "custom", request, () => {}, () => completion);
  await f.store.queue;
  await assert.rejects(f.store.execute(f.grant.accessCode, "custom", request, () => {}, async () => ({})), { code: "LIVE_REQUEST_BUSY" });
  release({ success: true }); await first;
});

test("write requires explicit published approval, exact digest and separate executor", /** 没有审批、参数篡改或职责重叠都拒绝。 / Reject missing approval, changed arguments and overlapping duties. */ async t => {
  const f = await fixture(t); await prepare(f); const { plan, approval, request } = approvalFixture();
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, request), { code: "LIVE_APPROVAL_REQUIRED" });
  await assert.rejects(f.gateway.publishApproval(f.grant.accessCode, approval.approvalId, approval), { code: "LIVE_APPROVAL_PLAN_MISMATCH" });
  await acceptPlan(f, plan);
  await assert.rejects(f.gateway.publishApproval(f.grant.accessCode, approval.approvalId, { ...approval, approverId: "operator" }), { code: "LIVE_APPROVER_FORBIDDEN" });
  await assert.rejects(f.gateway.publishApproval(f.grant.accessCode, approval.approvalId, { ...approval, scopes: approval.scopes.slice(0, 1) }), { code: "LIVE_APPROVAL_PLAN_MISMATCH" });
  await f.gateway.publishApproval(f.grant.accessCode, approval.approvalId, approval);
  assert.equal(f.calls.at(-1).options.headers.Authorization, `Bearer ${ISSUER}`);
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, { ...request, arguments: { ...request.arguments, reasonCode: "OTHER" } }), { code: "LIVE_ARGUMENTS_DIGEST_MISMATCH" });
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, { ...request, actorId: "agentteams:leader" }), { code: "LIVE_APPROVAL_SCOPE_MISMATCH" });
  const result = await f.gateway.invoke(f.grant.accessCode, request); assert.equal(result.success, true);
  assert.deepEqual(await f.gateway.invoke(f.grant.accessCode, request), result);
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, { ...request, requestId: "write-2" }), { code: "LIVE_REQUEST_CONFLICT" });
  assert.equal(f.calls.filter(call => call.options.method === "POST").length, 1);
});

test("actions belong to the exact originating request and remain pollable", /** 异步动作必须关联原请求。 / Asynchronous actions must belong to the original request. */ async t => {
  const f = await fixture(t); await prepare(f); const { plan, approval, request } = approvalFixture();
  await acceptPlan(f, plan); await f.gateway.publishApproval(f.grant.accessCode, approval.approvalId, approval); await f.gateway.invoke(f.grant.accessCode, request);
  const value = { request, actionId: "act_12345678" };
  assert.equal((await f.gateway.readAction(f.grant.accessCode, value)).data.status, "SUCCEEDED");
  await f.gateway.readAction(f.grant.accessCode, value);
  await assert.rejects(f.gateway.readAction(f.grant.accessCode, { ...value, request: { ...request, traceId: "another-trace" } }), { code: "LIVE_ACTION_FORBIDDEN" });
  await assert.rejects(f.gateway.readAction(f.grant.accessCode, { ...value, actionId: "act_unknown1" }), { code: "LIVE_ACTION_FORBIDDEN" });
});

test("expiry and revocation prevent even cached calls", /** 到期和撤销阻断缓存操作。 / Expiry and revocation block even cached calls. */ async t => {
  const f = await fixture(t); await prepare(f); await f.gateway.invoke(f.grant.accessCode, readRequest());
  await f.store.revoke(f.grant.grantId);
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, readRequest()), { code: "LIVE_ACCESS_REVOKED" });
  const second = await fixture(t); second.store.now = () => new Date(now.getTime() + 3600001);
  await assert.rejects(second.store.inspect(second.grant.accessCode, "workspace-1"), { code: "LIVE_ACCESS_EXPIRED" });
});

test("quota and interrupted writes fail closed", /** 配额和不确定中断都失败关闭。 / Fail closed on quota exhaustion and uncertain interruption. */ async t => {
  const f = await fixture(t, { maximumRequests: 2 }); await prepare(f);
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, readRequest()), { code: "LIVE_QUOTA_EXHAUSTED" });
  const g = await fixture(t); await prepare(g);
  const request = readRequest();
  await g.store.transaction(document => { const grant = document.grants[0]; grant.requests["invoke:read-1"] = { digest: digest(canonical({ operationName: "invoke", request })), status: "PENDING" }; return { write: true }; });
  await assert.rejects(g.gateway.invoke(g.grant.accessCode, request), { code: "LIVE_REQUEST_INTERRUPTED" });
  assert.equal(g.calls.length, 0);
});

test("redirects, wrong response ownership and upstream secrets are contained", /** 拒绝重定向和错配回执，并隐藏密钥。 / Reject redirects and mismatched receipts while hiding secrets. */ async t => {
  const f = await fixture(t); await prepare(f);
  f.gateway.fetch = async () => new Response("", { status: 302, headers: { Location: "https://other.invalid" } });
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, readRequest()), { code: "LIVE_UPSTREAM_REDIRECT" });
  f.gateway.fetch = async () => Response.json({ success: true, meta: { workspaceId: "wrong" } });
  await assert.rejects(f.gateway.invoke(f.grant.accessCode, readRequest("read-2")), { code: "LIVE_UPSTREAM_SCOPE_MISMATCH" });
  f.gateway.fetch = async () => Response.json({ status: "ok", text: `${SIGNING} ${ISSUER} Bearer reflected-platform-token`, nested: { apiKey: "other-upstream-key", authorization: "Bearer another-token" } });
  const scrubbed = await f.gateway.fetchJson(new URL("https://aiops.invalid"), {});
  assert.equal(JSON.stringify(scrubbed).includes(SIGNING), false); assert.equal(JSON.stringify(scrubbed).includes(ISSUER), false);
  assert.equal(JSON.stringify(scrubbed).includes("reflected-platform-token"), false); assert.equal(scrubbed.nested.apiKey, "[REDACTED]"); assert.equal(scrubbed.nested.authorization, "[REDACTED]");
});

test("HTTP routes require Live identity, exact workspace and ready server configuration", /** 接口不接受Fixture凭证且不自动连接未就绪服务。 / Reject Fixture credentials and do not activate unready services. */ async t => {
  const f = await fixture(t);
  const server = createApplication({ liveGateway: f.gateway, credentialStore: { read: async () => ({ matrixUrl: "https://matrix.invalid", matrixAccessToken: "private", matrixUserId: "@user:invalid" }) }, logger: { warn() {}, error() {} } });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(`${base}/health`)).json(); assert.equal(health.capabilities.liveAccessCodes, true);
  const check = await fetch(`${base}/api/v1/live-access/check`, { method: "POST", headers: { Authorization: `Bearer ${f.grant.accessCode}` }, body: JSON.stringify({ workspaceId: "workspace-1" }) });
  const body = await check.json(); assert.equal(check.status, 200); assert.equal(body.serviceReady, true); assert.equal(body.requiredTeamRuntime, "agentteams");
  const fixtureCode = await fetch(`${base}/api/v1/live-access/check`, { method: "POST", headers: { Authorization: `Bearer oxdemo_${"f".repeat(64)}` }, body: JSON.stringify({ workspaceId: "workspace-1" }) });
  assert.equal(fixtureCode.status, 401);
  f.gateway.approval.token = "";
  const connect = await fetch(`${base}/api/v1/live-access/connect`, { method: "POST", headers: { Authorization: `Bearer ${f.grant.accessCode}` }, body: JSON.stringify({ workspaceId: "workspace-1" }) });
  assert.equal(connect.status, 503); assert.equal((await connect.json()).error.code, "LIVE_SERVICE_NOT_READY");
});

test("existing Fixture check, connect and prepare remain isolated and idempotent", /** 保留原Fixture接入、配额与幂等语义。 / Preserve the original Fixture connection, quota and idempotency semantics. */ async t => {
  const f = await fixture(t);
  const accessGrantStore = new AccessGrantStore(path.join(f.directory, "fixture.json"));
  const grant = await accessGrantStore.issue({ label: "Fixture compatibility", maximumRequests: 5 });
  let prepared = 0;
  const server = createApplication({ liveGateway: f.gateway, accessGrantStore, credentialStore: { read: async () => ({ matrixUrl: "https://matrix.invalid", matrixAccessToken: "private", matrixUserId: "@user:invalid" }) },
    agentTeams: { prepareTeam: async request => { prepared++; return { teamName: teamName(request), status: "READY", phase: "Ready", leaderName: "leader", readyWorkers: 2, totalWorkers: 2, workerNames: ["worker", "verifier"] }; } },
    logger: { info() {}, warn() {}, error() {} } });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${grant.accessCode}`, "Content-Type": "application/json" };
  const checked = await fetch(`${base}/api/v1/access/check`, { method: "POST", headers, body: JSON.stringify({ workspaceId: null }) });
  const state = await checked.json(); assert.equal(state.schema, "openxnet.agentteams.access.v1"); assert.deepEqual(state.modes, ["fixture"]);
  const connected = await fetch(`${base}/api/v1/access/connect`, { method: "POST", headers, body: JSON.stringify({ workspaceId: "workspace-1" }) }); assert.equal(connected.status, 200);
  const input = { schema: "openxnet.agentteams.prepare.v1", ...prepareRequest(), teamTemplateName: "Fixture regression", members: prepareRequest().members.map(member => ({ ...member, name: member.teamRole, department: "", description: "", systemPrompt: "", runtimeSystemPrompt: "", permissions: [], skills: [] })) };
  const call = async mode => fetch(`${base}/api/v1/teams/prepare`, { method: "POST", headers: { ...headers, "X-OpenXnet-Execution-Mode": mode }, body: JSON.stringify(input) });
  const blocked = await call("live"); assert.equal(blocked.status, 403); assert.equal((await blocked.json()).error.code, "ACCESS_MODE_FORBIDDEN");
  const first = await call("fixture"), second = await call("fixture");
  assert.equal(first.status, 200); assert.equal(second.status, 200); assert.deepEqual(await first.json(), await second.json()); assert.equal(prepared, 1);
  const final = await accessGrantStore.inspect(grant.accessCode, "workspace-1", false, true); assert.equal(final.remainingRequests, 4);
});
