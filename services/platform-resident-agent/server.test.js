#!/usr/bin/env node
// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 驻场服务安全与运行测试 / Resident service security and runtime tests
// Author: maoyo
// Department: 研发部
// Date: 2026-09-16
// Version: 1.3.0
// Security Level: INTERNAL
// __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
// __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHmac } = require("node:crypto");
const { createResidentService, configFromEnv } = require("./server");
const KEY = "sk-test-model-credential-do-not-expose";
const SECRET = "test-platform-delegation-secret-1234567890";

/** 创建具有真实 HTTP 边界的隔离测试服务。 / Create an isolated test service with real HTTP boundaries. */
async function fixture(t, options = {}) {
  const directory = options.directory || await fs.mkdtemp(path.join(os.tmpdir(), "resident-test-"));
  await fs.writeFile(path.join(directory, "delegation.key"), SECRET);
  const config = configFromEnv({ PLATFORM: options.platform || "aiops", RESIDENT_DATA_DIR: directory, RESIDENT_USER_INFO_URL: "http://identity.test/user/info", RESIDENT_TOOL_BASE_URL: "http://127.0.0.1:18000", RESIDENT_DELEGATION_SECRET_FILE: path.join(directory, "delegation.key"), RESIDENT_WORKSPACE_IDS: "ws_goai_demo", RESIDENT_MODEL_ALLOWED_HOSTS: "model.test", RESIDENT_ADMIN_USER_IDS: options.adminUserIds || "" });
  const calls = [];
  let modelCalls = 0;
  /** 模拟可信身份、模型和平台证据，记录出站调用。 / Mock trusted identity, model and evidence while recording outbound calls. */
  async function mockFetch(url, init = {}) {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("http://identity.test")) {
      const token = init.headers.Authorization;
      if (token === "Bearer invalid") return Response.json({ code: 401 }, { status: 401 });
      const userId = token === "Bearer admin" ? "admin-id" : token === "Bearer operator" ? "operator-id" : "user-id";
      return Response.json({ code: 0, data: { userId, userType: token === "Bearer admin" ? "admin" : "user", roles: [] } });
    }
    if (String(url).startsWith("https://model.test")) {
      modelCalls++;
      if (options.model) return options.model(modelCalls, url, init);
      return Response.json({ choices: [{ message: { role: "assistant", content: "Read-only analysis complete." } }] });
    }
    if (String(url).startsWith("http://127.0.0.1:18000")) {
      const input = JSON.parse(init.body);
      const [header, payload, signature] = init.headers.Authorization.slice(7).split(".");
      assert.equal(signature, createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url"));
      const claims = JSON.parse(Buffer.from(payload, "base64url"));
      assert.deepEqual(claims.tools, [input.toolName]);
      assert.equal(claims.workspace_id, "ws_goai_demo");
      assert.equal(claims.exp - claims.iat, 300);
      return Response.json({ success: true, data: { status: "HEALTHY", apiKey: KEY }, error: null, auditReceipt: null, meta: { requestId: input.requestId, workspaceId: init.headers["X-OpenXnet-Workspace-Id"], incidentId: init.headers["X-OpenXnet-Incident-Id"], traceId: init.headers["X-OpenXnet-Trace-Id"], toolName: input.toolName, contractVersion: "1.0.0", durationMs: 1, observedAt: new Date().toISOString(), source: "LIVE-STAGING", evidenceId: "ev-health-1", resourceVersion: "18", summary: "Live health evidence" } });
    }
    throw new Error("Unexpected destination");
  }
  const service = await createResidentService(config, { fetch: mockFetch });
  await new Promise(resolve => service.server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${service.server.address().port}`;
  let closed = false;
  /** 关闭测试实例。 / Close the test instance. */
  async function close() { if (!closed) { closed = true; await service.close(); } }
  t.after(async () => { await close(); if (!options.keep) await fs.rm(directory, { recursive: true, force: true }); });
  /** 调用公开 API。 / Call the public API. */
  async function api(route, method = "GET", data, token = "admin") {
    const response = await fetch(origin + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, ...(await response.json()) };
  }
  /** 配置模型并创建个人会话。 / Configure a model and create a personal conversation. */
  async function conversation(token = "admin") {
    assert.equal((await api("/api/resident/v1/model", "PUT", { baseUrl: "https://model.test/v1", model: "test-model", apiKey: KEY })).status, 200);
    const result = await api("/api/resident/v1/conversations", "POST", {}, token);
    return result.data;
  }
  /** 轮询异步任务直到终态。 / Poll an asynchronous task to its terminal status. */
  async function terminal(id, token = "admin") {
    for (let attempt = 0; attempt < 100; attempt++) {
      const task = (await api(`/api/resident/v1/tasks/${id}`, "GET", undefined, token)).data;
      if (!["QUEUED", "RUNNING"].includes(task.status)) return task;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error("Task did not finish");
  }
  return { api, conversation, terminal, calls, directory, service, close };
}

test("authentication, explicit resident ownership and personal scope are enforced", async t => {
  const f = await fixture(t, { adminUserIds: "operator-id" });
  assert.equal((await f.api("/health", "GET", undefined, "")).status, 200);
  assert.equal((await f.api("/api/resident/v1/status", "GET", undefined, "")).status, 401);
  assert.equal((await f.api("/api/resident/v1/status", "GET", undefined, "invalid")).status, 401);
  assert.equal((await f.api("/api/resident/v1/model", "PUT", { baseUrl: "https://model.test/v1", model: "m", apiKey: KEY }, "operator")).status, 200);
  assert.equal((await f.api("/api/resident/v1/model", "GET", undefined, "user")).status, 403);
  assert.equal((await f.api("/api/resident/v1/conversations", "POST", { workspaceId: "ws_other" })).status, 403);
  assert.equal((await f.api("/api/resident/v1/conversations", "POST", { workspaceId: "ws_goai_demo" }, "user")).status, 403);
  const conversation = await f.conversation();
  assert.equal((await f.api(`/api/resident/v1/conversations/${conversation.id}`, "GET", undefined, "user")).status, 404);
  assert.deepEqual((await f.api("/api/resident/v1/conversations", "GET", undefined, "user")).data, []);
});

test("model keys are encrypted, redacted and preserved by a blank update", async t => {
  const f = await fixture(t);
  await f.conversation();
  const updated = await f.api("/api/resident/v1/model", "PUT", { model: "updated", apiKey: "" });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.apiKeyConfigured, true);
  assert.equal(JSON.stringify(updated).includes(KEY), false);
  assert.equal((await fs.readFile(path.join(f.directory, "model.enc.json"), "utf8")).includes(KEY), false);
  assert.equal((await f.service.store.readModel()).apiKey, KEY);
  assert.equal((await f.api("/api/resident/v1/model", "PUT", { baseUrl: "https://evil.test/v1" })).status, 403);
});

test("model tool loop only calls signed local reads and persists evidence", async t => {
  const f = await fixture(t, { model: async count => Response.json({ choices: [{ message: count === 1 ? { role: "assistant", content: null, tool_calls: [
    { id: "write-call", type: "function", function: { name: "aiops_gpu_capacity_ensure", arguments: "{}" } },
    { id: "cross-call", type: "function", function: { name: "dataops_lineage_get", arguments: "{}" } },
    { id: "read-call", type: "function", function: { name: "aiops_service_health", arguments: '{"serviceUid":"risk-service"}' } },
  ] } : { role: "assistant", content: `Evidence ev-health-1 is healthy. ${KEY}` } }] }) });
  const conversation = await f.conversation();
  const posted = await f.api(`/api/resident/v1/conversations/${conversation.id}/messages`, "POST", { content: "Check service", clientMessageId: "one" });
  assert.equal(posted.status, 202);
  assert.equal((await f.terminal(posted.data.taskId)).status, "SUCCEEDED");
  const result = (await f.api(`/api/resident/v1/conversations/${conversation.id}`)).data;
  assert.equal(result.events.filter(item => item.type === "tool.failed").length, 2);
  assert.equal(result.events.filter(item => item.type === "tool.completed").length, 1);
  assert.deepEqual(result.messages.at(-1).evidenceRefs, ["ev-health-1"]);
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(f.calls.filter(call => call.url.startsWith("http://127.0.0.1:18000")).length, 1);
  const duplicate = await f.api(`/api/resident/v1/conversations/${conversation.id}/messages`, "POST", { content: "Check service", clientMessageId: "one" });
  assert.equal(duplicate.data.taskId, posted.data.taskId);
  const escalation = await f.api(`/api/resident/v1/conversations/${conversation.id}/escalations`, "POST", { reason: "Cross-platform review" });
  assert.equal(escalation.data.status, "PENDING_HANDOFF");
  assert.equal(escalation.data.runId, null);
});

test("non-admin chat receives no platform tools and task cannot be read by another user", async t => {
  const f = await fixture(t);
  const conversation = await f.conversation("user");
  const posted = await f.api(`/api/resident/v1/conversations/${conversation.id}/messages`, "POST", { content: "Explain data contracts" }, "user");
  assert.equal((await f.terminal(posted.data.taskId, "user")).status, "SUCCEEDED");
  const model = f.calls.find(call => call.url.startsWith("https://model.test"));
  assert.equal(JSON.parse(model.init.body).tools, undefined);
  assert.equal((await f.api(`/api/resident/v1/tasks/${posted.data.taskId}`)).status, 404);
});

test("process restart preserves chats and marks unfinished work resumable", async t => {
  const f = await fixture(t, { keep: true });
  const conversation = await f.conversation();
  const taskId = require("node:crypto").randomUUID();
  f.service.store.state.tasks.push({ id: taskId, conversationId: conversation.id, userId: "admin-id", status: "RUNNING", createdAt: new Date().toISOString() });
  f.service.store.state.conversations[0].messages.push({ id: "message", role: "user", content: "Resume this analysis", taskId });
  await f.service.store.save();
  await f.close();
  const next = await fixture(t, { directory: f.directory });
  assert.equal((await next.api(`/api/resident/v1/tasks/${taskId}`)).data.status, "INTERRUPTED");
  assert.equal((await next.api(`/api/resident/v1/tasks/${taskId}/resume`, "POST")).status, 202);
  assert.equal((await next.terminal(taskId)).status, "SUCCEEDED");
  assert.equal((await next.api(`/api/resident/v1/conversations/${conversation.id}`)).data.messages.length, 2);
});

test("platform volumes cannot be reused by another platform", async t => {
  const f = await fixture(t);
  const config = { ...f.service.config, platform: "dataops" };
  await assert.rejects(createResidentService(config), /another platform/);
});
