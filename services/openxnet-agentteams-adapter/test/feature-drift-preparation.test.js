#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 真实演练准备边界验收 / Real staging preparation boundary acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { FeatureDriftPreparation } = require("../src/feature-drift-preparation");
const { LiveGateway } = require("../src/live-gateway");
const { LiveAccessGrantStore } = require("../src/live-access-store");
const { teamName } = require("../src/agentteams-cli");

/** 构建固定演练资源请求。 / Construct a request for fixed staging resources. */
function request() {
  return { requestId: "request-drift", workspaceId: "workspace-drift", incidentId: "incident-drift", traceId: "trace-drift",
    context: { incident: { scenario: { scenarioType: "feature-drift", deploymentUid: "deploy_risk_prod", assetUid: "asset_risk_features_prod",
      expectedResourceVersion: "42", failingRevision: 18, targetRevision: 19, rollbackRevision: 17 } } } };
}

/** 为测试生成独立凭据文件与网络替身。 / Create an isolated credential file and network double for tests. */
async function fixture(t, respond) {
  const directory = await mkdtemp(path.join(tmpdir(), "drift-prepare-"));
  t.after(/** 删除本测试唯一临时目录。 / Remove only this test's unique temporary directory. */ () => rm(directory, { recursive: true, force: true }));
  const tokenFile = path.join(directory, "token");
  await writeFile(tokenFile, "test-only-initializer-credential-32-characters");
  const calls = [];
  const prep = new FeatureDriftPreparation({ baseUrl: "https://runtime.invalid/", tokenFile },
    /** 记录网络动作而不调用真实服务。 / Record requests without calling a real service. */ async (url, options) => { calls.push({ url, options }); return respond(url, options, calls.length); });
  return { prep, calls, directory };
}

/** 创建范围匹配的合成来源响应。 / Build a scope-matching synthetic-source response. */
function result(extra = {}) {
  const r = request();
  return { data: { workspaceId: r.workspaceId, incidentId: r.incidentId, traceId: r.traceId,
    sourceMode: "REAL_CPU_SYNTHETIC_STAGING", synthetic: true, deployment: { deploymentUid: "deploy_risk_prod" }, ...extra } };
}

test("preparation explicitly posts once after a missing read and preserves rollback revision", /** 不存在才明确初始化并传回滚点。 / Initialize explicitly only when absent and preserve the rollback point. */ async t => {
  const f = await fixture(t, (_url, _options, index) => index === 1 ? new Response("", { status: 404 }) : Response.json(result()));
  await f.prep.ensure(request());
  assert.deepEqual(f.calls.map(c => c.options.method), ["GET", "POST"]);
  const body = JSON.parse(f.calls[1].options.body);
  assert.equal(body.arguments.rollbackRevision, 17);
  assert.equal(body.arguments.failureMode, "none");
  assert.equal(body.workspaceId, request().workspaceId);
});

test("existing failure run is read without resetting fault, data or model", /** 已存在失败事件只读复用。 / Reuse an existing failure run without reset. */ async t => {
  const f = await fixture(t, () => Response.json(result({ failureMode: "post_release_contract" })));
  const data = await f.prep.ensure(request());
  assert.equal(data.failureMode, "post_release_contract"); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].options.method, "GET");
});

test("operator fault plan only affects the exact workspace and incident", /** 管理员故障计划只匹配指定事件。 / Operator fault plans match only the specified incident. */ async t => {
  const f = await fixture(t, () => Response.json(result()));
  const file = path.join(f.directory, "fault-plan.json"); f.prep.config.faultPlanFile = file;
  await writeFile(file, JSON.stringify([{ workspaceId: request().workspaceId, incidentId: request().incidentId, failureMode: "post_release_contract" }]));
  assert.equal(await f.prep.failureMode(request()), "post_release_contract");
  assert.equal(await f.prep.failureMode({ ...request(), incidentId: "other-incident" }), "none");
  assert.equal(await f.prep.failureMode({ ...request(), workspaceId: "other-workspace" }), "none");
  await writeFile(file, "invalid");
  await assert.rejects(f.prep.failureMode(request()), { code: "DRIFT_FAULT_PLAN_INVALID" });
});

test("cross-workspace or trace response blocks preparation", /** 拒绝跨空间或跨Trace响应。 / Reject responses from a different workspace or trace. */ async t => {
  for (const change of [{ workspaceId: "another-workspace" }, { traceId: "another-trace" }, { sourceMode: "SIMULATION" }]) {
    const f = await fixture(t, () => Response.json(result(change)));
    await assert.rejects(f.prep.ensure(request()), { code: "DRIFT_PREPARATION_SCOPE_MISMATCH" });
    assert.equal(f.calls.length, 1);
  }
});

test("upstream unavailable or redirect never becomes initialization success", /** 上游错误或跳转不得降级为成功。 / Never turn upstream failure or redirection into success. */ async t => {
  for (const status of [401, 403, 500, 302]) {
    const f = await fixture(t, () => new Response("private upstream details", { status }));
    await assert.rejects(f.prep.ensure(request()), { code: "DRIFT_PREPARATION_REJECTED" });
    assert.equal(f.calls.length, 1);
  }
});

test("resource mismatch is rejected before network access", /** 资源越界在发网络前被拒绝。 / Reject out-of-scope resources before network access. */ async t => {
  const f = await fixture(t, () => Response.json(result()));
  const r = request(); r.context.incident.scenario.deploymentUid = "deploy_other";
  await assert.rejects(f.prep.ensure(r), { code: "DRIFT_RESOURCE_FORBIDDEN" }); assert.equal(f.calls.length, 0);
});

test("gateway authorizes the grant before preparation and blocks model work on preparation failure", /** 先授权后准备，准备失败不得开始模型任务。 / Authorize before preparation and block model work on preparation failure. */ async t => {
  const f = await fixture(t, () => Response.json(result()));
  const store = new LiveAccessGrantStore(path.join(f.directory, "grants.json"));
  const spec = { label: "Isolated real staging test", workspaceId: "workspace-drift", expiresInSeconds: 3600, maximumRequests: 30,
    actorIds: ["agentteams:leader"], approverIds: ["human"], allowedTools: ["mlops.deployment.get"], allowedScenarios: ["feature-drift"],
    resourceConstraints: { deploymentUid: ["deploy_risk_prod"], assetUid: ["asset_risk_features_prod"] } };
  const grant = await store.issue(spec); await store.inspect(grant.accessCode, spec.workspaceId, true);
  let prepared = 0, modeled = 0;
  const gateway = new LiveGateway({ store, platforms: {}, featureDrift: { ensure: async () => { prepared++; throw new Error("not ready"); } } });
  const base = { ...request(), teamTemplateId: "template-drift", teamTemplateVersion: 1, members: [{ roleCardId: "leader", teamRole: "leader", tools: [] }] };
  await gateway.executeTeam(grant.accessCode, "live", "prepare", base, async scoped => ({ teamName: teamName(scoped) }));
  const dispatch = { ...base, requestId: "dispatch-drift", teamName: teamName({ ...base, accessGrantId: grant.grantId }), stage: "INVESTIGATION_PLAN",
    context: { ...base.context, availableTools: ["mlops.deployment.get"], residentContexts: ["aiops", "dataops", "mlops"].map(platform => ({ platform, source: "LIVE-STAGING", environment: "staging" })) } };
  assert.throws(() => gateway.executeTeam(grant.accessCode, "fixture", "dispatch", dispatch, async () => { modeled++; }), { code: "LIVE_MODE_FORBIDDEN" });
  assert.equal(prepared, 0);
  await assert.rejects(gateway.executeTeam(grant.accessCode, "live", "dispatch", dispatch, async () => { modeled++; }), { code: "LIVE_UPSTREAM_UNAVAILABLE" });
  assert.equal(prepared, 1); assert.equal(modeled, 0);
});
