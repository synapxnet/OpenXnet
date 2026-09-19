#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 真实证据代理鉴权测试 / Authentication tests for the real evidence proxy.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createResidentService, configFromEnv } = require("./server");
const TOKEN = "readonly-runtime-test-role-credential-123456";
const UUID = "2c14a405-ce1c-45f2-9b5f-019deedf57de";
/** 建立真实HTTP测试边界，外部服务由只读夹具替代。 / Start a real HTTP boundary with isolated read-only upstream fixtures. */
async function fixture(t, mode = "normal") {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drift-reader-"));
  const tokenFile = path.join(directory, "readonly.key"); await fs.writeFile(tokenFile, TOKEN);
  const calls = [];
  const config = configFromEnv({ PLATFORM: "dataops", RESIDENT_DATA_DIR: directory, RESIDENT_USER_INFO_URL: "http://identity.test/info", RESIDENT_WORKSPACE_IDS: `ws_goai_demo,${UUID}`, RESIDENT_FEATURE_DRIFT_URL: "http://runtime.test/", RESIDENT_FEATURE_DRIFT_TOKEN_FILE: tokenFile });
  /** 只接受固定身份和runtime读取，记录请求方法与作用域。 / Accept only fixed identity and runtime reads, recording method and scope. */
  async function mockFetch(url, init) {
    const address = new URL(url);
    if (address.hostname === "identity.test") return Response.json({ code: 0, data: { userId: "1", userType: init.headers.Authorization === "Bearer admin" ? "admin" : "user" } });
    assert.equal(address.hostname, "runtime.test"); assert.equal(init.method, "GET"); assert.equal(init.redirect, "manual");
    assert.equal(init.headers["X-Feature-Drift-Token"], TOKEN); calls.push(address);
    if (mode === "unavailable") throw new Error(TOKEN);
    if (mode === "redirect") return new Response("", { status: 302, headers: { Location: "https://external.test/" } });
    const workspaceId = mode === "wrong-workspace" ? "ws_other" : address.searchParams.get("workspaceId");
    const item = { workspaceId, incidentId: mode === "wrong-incident" ? "inc_other" : "inc_sample", traceId: "trace_sample", sourceMode: "REAL_CPU_SYNTHETIC_STAGING", synthetic: true, updatedAt: "2026-09-18T01:00:00Z", dataset: { sourceDigest: "a".repeat(64) }, reflected: TOKEN, secret: TOKEN };
    return Response.json({ data: address.pathname === "/v1/incidents" ? { items: [item], total: 1 } : item });
  }
  const service = await createResidentService(config, { fetch: mockFetch });
  await new Promise(resolve => service.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await service.close(); await fs.rm(directory, { recursive: true, force: true }); });
  /** 调用公开平台接口，不注入隐藏应用状态。 / Call the public platform endpoint without injecting hidden application state. */
  async function api(suffix = "", token = "admin", method = "GET") {
    const response = await fetch(`http://127.0.0.1:${service.server.address().port}/api/resident/v1/feature-drift/runs${suffix}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json() };
  }
  return { api, calls };
}

test("native login, admin role, workspace and GET-only boundaries", async t => {
  const f = await fixture(t);
  assert.equal((await f.api("", "")).status, 401);
  assert.equal((await f.api("", "user")).status, 403);
  assert.equal((await f.api("", "admin", "POST")).status, 405);
  assert.equal((await f.api("?workspaceId=ws_other")).status, 403);
  assert.equal((await f.api("?url=https://external.test")).status, 400);
  assert.equal((await f.api("/inc_sample")).status, 400);
  assert.equal(f.calls.length, 0);
});

test("list aggregates only configured workspaces and preserves real source metadata", async t => {
  const f = await fixture(t); const result = await f.api();
  assert.equal(result.status, 200); assert.equal(result.body.data.total, 2);
  assert.deepEqual(f.calls.map(url => url.searchParams.get("workspaceId")), ["ws_goai_demo", UUID]);
  assert.equal(result.body.data.items[1].synthetic, true);
  assert.equal(JSON.stringify(result.body).includes(TOKEN), false);
});

test("detail preserves runtime evidence with an exact workspace and incident", async t => {
  const f = await fixture(t); const result = await f.api(`/inc_sample?workspaceId=${UUID}`);
  assert.equal(result.status, 200); assert.equal(result.body.data.incidentId, "inc_sample");
  assert.equal(result.body.data.workspaceId, UUID); assert.equal(result.body.data.dataset.sourceDigest, "a".repeat(64));
  assert.equal(f.calls[0].pathname, "/v1/incidents/inc_sample");
});

for (const mode of ["wrong-workspace", "wrong-incident", "unavailable", "redirect"]) {
  test(`fails closed for ${mode} without leaking secrets or returning fixture success`, async t => {
    const f = await fixture(t, mode); const result = await f.api(`/inc_sample?workspaceId=${UUID}`);
    assert.ok(result.status >= 400); assert.equal(JSON.stringify(result.body).includes(TOKEN), false);
    assert.equal(result.body.data, undefined);
  });
}
