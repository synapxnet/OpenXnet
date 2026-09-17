#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapter HTTP 回归测试维护来源 / Maintained Adapter HTTP regression tests.
 * Author: maoyo (maintenance metadata) | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.2 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Copied from the deployed 1.1.1-workerlease.6 application; existing authorship and license are retained.
 * LICENSE and THIRD_PARTY_NOTICES.md remain unchanged; this header does not relicense the original source.
 */
"use strict";

const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const test = require("node:test");
const { createApplication } = require("../src/server");

const PROVISIONING_TOKEN = "provisioning-token-with-at-least-thirty-two-characters";
const DELEGATION_SECRET = "delegation-secret-with-at-least-thirty-two-characters";

/** 构建三成员 Prepare HTTP 请求；无输入，返回协议对象。 */
function prepareRequest() {
  /** 创建单个 HTTP 测试成员；输入角色标识和 Team 职责，返回固定快照。 */
  const member = (roleCardId, teamRole) => ({
    roleCardId,
    name: roleCardId,
    department: "Engineering",
    description: "role identity",
    teamRole,
    systemPrompt: "system",
    runtimeSystemPrompt: "runtime",
    permissions: ["read"],
    tools: [],
    skills: ["openxnet.evidence"],
  });
  return {
    schema: "openxnet.agentteams.prepare.v1",
    requestId: "req_prepare_1",
    workspaceId: "ws_goai_demo",
    incidentId: "inc_goai_demo",
    traceId: "trace_goai_demo",
    teamTemplateId: "team_goai_demo",
    teamTemplateVersion: 2,
    teamTemplateName: "GOAI Team",
    members: [member("role_leader", "leader"), member("role_worker", "worker"), member("role_verifier", "verifier")],
  };
}

/** 签发与 Prepare 请求完全绑定的测试委托；输入请求，返回 JWT。 */
function signPrepareToken(request) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "openxnet-desktop",
    aud: "openxnet-agentteams-adapter",
    sub: "enterprise-user",
    iat: 1_785_744_000,
    exp: 1_785_744_300,
    scopes: ["agentteams:team:prepare"],
    request_id: request.requestId,
    workspace_id: request.workspaceId,
    incident_id: request.incidentId,
    trace_id: request.traceId,
    team_template_id: request.teamTemplateId,
    team_template_version: request.teamTemplateVersion,
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", DELEGATION_SECRET).update(`${header}.${payload}`, "utf8").digest("base64url");
  return `${header}.${payload}.${signature}`;
}

test("isolated service separates provisioning identity from delegated team execution", async () => {
  let credentials = null;
  let preparedCredentials = null;
  const credentialStore = {
    /** 读取测试会话；无输入，返回当前内存值。 */
    async read() { return credentials; },
    /** 保存测试会话；输入值，无返回。 */
    async write(value) { credentials = { ...value }; },
    /** 清除测试会话；无输入和返回。 */
    async clear() { credentials = null; },
  };
  const agentTeams = {
    /** 验证测试会话；输入会话，返回脱敏状态。 */
    async probeSession() { return { controllerVersion: "v1.2.3", kubeMode: "native" }; },
    /** 准备测试 Team；输入请求和会话，返回固定状态。 */
    async prepareTeam(_request, value) {
      preparedCredentials = value;
      return {
        teamName: "goai-test-team",
        status: "READY",
        phase: "Ready",
        leaderName: "leader",
        readyWorkers: 3,
        totalWorkers: 3,
        workerNames: ["leader", "worker", "verifier"],
      };
    },
  };
  const application = createApplication({
    provisioningToken: PROVISIONING_TOKEN,
    delegationSecret: DELEGATION_SECRET,
    credentialStore,
    agentTeams,
    now: () => new Date("2026-08-03T08:00:00.000Z"),
    logger: {
      /** 接收测试信息日志；无输出，避免污染测试结果。 */
      info() {},
      /** 接收测试错误日志；无输出，避免污染测试结果。 */
      error() {},
    },
  });
  await new Promise((resolve) => application.listen(0, "127.0.0.1", resolve));
  const address = application.address();
  assert.equal(typeof address, "object");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const unauthorized = await fetch(`${origin}/api/v1/session`);
    assert.equal(unauthorized.status, 401);

    const rejectedInsecureController = await fetch(`${origin}/api/v1/session`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${PROVISIONING_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        controllerUrl: "http://untrusted-controller.example.test:8090",
        authToken: "isolated-agentteams-token",
      }),
    });
    assert.equal(rejectedInsecureController.status, 400);

    const provisioned = await fetch(`${origin}/api/v1/session`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${PROVISIONING_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        controllerUrl: "http://agentteams-controller:8090",
        authToken: "isolated-agentteams-token",
        matrixUrl: "http://agentteams-controller:6167",
        matrixAccessToken: "isolated-matrix-test-token",
        matrixUserId: "@tester:matrix-local.agentteams.io",
      }),
    });
    assert.equal(provisioned.status, 200);
    assert.equal((await provisioned.text()).includes("isolated-agentteams-token"), false);

    const request = prepareRequest();
    const provisioningCannotPrepare = await fetch(`${origin}/api/v1/teams/prepare`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROVISIONING_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    assert.equal(provisioningCannotPrepare.status, 401);

    const prepared = await fetch(`${origin}/api/v1/teams/prepare`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${signPrepareToken(request)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    assert.equal(prepared.status, 200);
    const result = await prepared.json();
    assert.equal(result.status, "READY");
    assert.equal(result.teamTemplateId, "team_goai_demo");
    assert.equal(preparedCredentials.authToken, "isolated-agentteams-token");
  } finally {
    await new Promise((resolve) => application.close(resolve));
  }
});
