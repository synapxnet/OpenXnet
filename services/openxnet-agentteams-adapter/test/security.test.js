#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * SPDX-License-Identifier: AGPL-3.0-only
 * 委托授权回归测试维护来源 / Maintained delegation authorization regression tests.
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
const { authorizePrepareScope, verifyDelegation } = require("../src/security");

const SECRET = "delegation-secret-with-at-least-thirty-two-characters";

/** 签发测试委托 JWT；输入覆盖声明，返回 HS256 文本。 */
function signToken(overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "openxnet-desktop",
    aud: "openxnet-agentteams-adapter",
    sub: "enterprise-user",
    iat: 1_785_744_000,
    exp: 1_785_744_300,
    scopes: ["agentteams:team:prepare"],
    request_id: "req_prepare_1",
    workspace_id: "ws_goai_demo",
    incident_id: "inc_goai_demo",
    trace_id: "trace_goai_demo",
    team_template_id: "team_goai_demo",
    team_template_version: 2,
    ...overrides,
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`, "utf8").digest("base64url");
  return `${header}.${payload}.${signature}`;
}

test("delegation verification binds the exact AgentTeams prepare scope", () => {
  const claims = verifyDelegation(
    `Bearer ${signToken()}`,
    SECRET,
    new Date("2026-08-03T08:00:00.000Z"),
  );
  assert.doesNotThrow(() => authorizePrepareScope(claims, {
    requestId: "req_prepare_1",
    workspaceId: "ws_goai_demo",
    incidentId: "inc_goai_demo",
    traceId: "trace_goai_demo",
    teamTemplateId: "team_goai_demo",
    teamTemplateVersion: 2,
  }));
  assert.throws(() => authorizePrepareScope(claims, {
    requestId: "req_prepare_1",
    workspaceId: "ws_other",
    incidentId: "inc_goai_demo",
    traceId: "trace_goai_demo",
    teamTemplateId: "team_goai_demo",
    teamTemplateVersion: 2,
  }), /scope does not match/i);
  assert.throws(() => verifyDelegation(
    `Bearer ${signToken({ aud: "openxnet-agent-adapter" })}`,
    SECRET,
    new Date("2026-08-03T08:00:00.000Z"),
  ), /claims are invalid/i);
});

module.exports = { signToken };
