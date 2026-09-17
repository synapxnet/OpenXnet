/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Live 接入隔离与加密存储测试 / Live access isolation and encrypted storage tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ReadableStream } from "node:stream/web";
import type { SafeStorageLike } from "../storage/safe-storage-credential-store";
import { ApplicationCompetitionLiveConnectionService, type ApplicationCompetitionLiveConnectionServiceOptions } from "./application-competition-live-connection";

const ACCESS_CODE = `oxlive_${"a".repeat(64)}`;
const NOW = Date.parse("2026-09-17T00:00:00Z");
const REQUEST = { endpoint: "https://demo.example/adapter", workspaceId: "workspace-demo", accessCode: ACCESS_CODE, enabled: true };
const HEALTH = { schema: "openxnet.agentteams-adapter.health.v1", status: "ok", capabilities: { liveAccessCodes: true } };
const ACCESS = {
  schema: "openxnet.agentteams.live-access.v1", grantId: "grant_123", label: "Demo access", workspaceId: "workspace-demo",
  expiresAt: "2026-09-18T00:00:00Z", remainingRequests: 50, modes: ["live"], serviceReady: true,
  requiredTeamRuntime: "agentteams",
  allowedTools: ["aiops.service.health", "mlops.feature.fallback.apply"], allowedScenarios: ["feature-drift"], approvalReady: true,
  platforms: ["aiops", "dataops", "mlops"].map(/** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ (platform) => ({ platform, configured: true, reachable: true, identityMatched: true })),
  checks: [{ id: "approval", label: "Approval service", ready: true, code: "READY" }],
};

/** 使用临时测试密钥模拟系统加密，不接触真实凭据。 / Simulate OS encryption with an ephemeral key, never real credentials. */
class TestSafeStorage implements SafeStorageLike {
  private readonly key = randomBytes(32);
  public available = true;
  public backend = "test";
  /** 提供可控的加密可用状态。 / Provide a controllable encryption status. */
  public isEncryptionAvailable(): boolean { return this.available; }
  /** 模拟受保护或不安全的后端。 / Simulate protected or unsafe backends. */
  public getSelectedStorageBackend(): string { return this.backend; }
  /** 真实加密测试内容，便于检查未泄漏明文。 / Encrypt test data to detect accidental plaintext persistence. */
  public encryptString(plaintext: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }
  /** 解密当前测试实例写入的内容。 / Decrypt content written by the current test instance. */
  public decryptString(encrypted: Buffer): string {
    const decipher = createDecipheriv("aes-256-gcm", this.key, encrypted.subarray(0, 12));
    decipher.setAuthTag(encrypted.subarray(12, 28));
    return Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString("utf8");
  }
}

/** 构造 JSON HTTP 响应。 / Build a JSON HTTP response. */
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

/** 建立账号可切换的临时目录和受控 HTTP 服务。 / Create a temporary store with switchable owners and a controlled HTTP service. */
function harness(t: TestContext, overrides: Partial<ApplicationCompetitionLiveConnectionServiceOptions> = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "openxnet-connection-"));
  t.after(/** 删除本测试的临时文件。 / Remove this test’s temporary files. */ () => rmSync(directory, { force: true, recursive: true }));
  const filePath = path.join(directory, "connection.enc");
  const safeStorage = new TestSafeStorage();
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let owner = "account-a";
  const options: ApplicationCompetitionLiveConnectionServiceOptions = {
    filePath, safeStorage, now: /** 提供可控测试时间。 / Supply controllable test time. */ () => NOW, resolveOwnerId: /** 读取本测试当前账号。 / Read the current test account. */ () => owner,
    fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url, init) => {
      calls.push({ url: String(url), init });
      return json(String(url).endsWith("/health") ? HEALTH : ACCESS);
    },
    ...overrides,
  };
  return { service: new ApplicationCompetitionLiveConnectionService(options), options, filePath, safeStorage, calls,
    /** 模拟已认证账号切换。 / Simulate an authenticated account change. */
    setOwner(value: string): void { owner = value; },
  };
}

test("read-only check does not connect or persist and strips undeclared server fields", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  const result = await h.service.test(REQUEST);
  assert.equal(result.ok, true);
  assert.equal(result.access?.workspaceId, REQUEST.workspaceId);
  assert.equal(existsSync(h.filePath), false);
  assert.deepEqual(h.calls.map(/** 提取实际请求地址。 / Extract an actual request URL. */ (call) => call.url), ["https://demo.example/adapter/health", "https://demo.example/adapter/api/v1/live-access/check"]);
  assert.equal(h.calls[0]?.init?.headers, undefined);
  assert.equal(h.calls[1]?.init?.redirect, "manual");
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
});

test("save survives a service restart and never writes or returns plaintext credentials", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  const result = await h.service.save(REQUEST);
  assert.equal(result.ok, true);
  assert.equal(h.calls.at(-1)?.url.endsWith("/live-access/connect"), true);
  assert.equal(readFileSync(h.filePath).includes(Buffer.from(ACCESS_CODE)), false);
  assert.equal(readFileSync(h.filePath).includes(Buffer.from("account-a")), false);
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  const restarted = new ApplicationCompetitionLiveConnectionService(h.options);
  assert.equal(restarted.getSnapshot().source, "saved");
  assert.equal(restarted.getSnapshot().endpoint, "https://demo.example/adapter/");
  assert.equal(restarted.getSavedConnection()?.accessCode, ACCESS_CODE);
  const reused = await restarted.test({ endpoint: REQUEST.endpoint, workspaceId: REQUEST.workspaceId });
  assert.equal(reused.ok, true);
});

test("an account switch cannot read, reuse or delete another account's credential", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  assert.equal((await h.service.save(REQUEST)).ok, true);
  h.setOwner("account-b");
  assert.equal(h.service.hasLocalConfiguration(), true);
  assert.equal(h.service.getSavedConnection(), null);
  assert.equal(h.service.getSnapshot().credentialConfigured, false);
  assert.equal((await h.service.test({ ...REQUEST, accessCode: "" })).code, "ACCESS_CODE_REQUIRED");
  assert.equal((await h.service.clear()).ok, true);
  assert.equal(existsSync(h.filePath), true);
  h.setOwner("account-a");
  assert.equal((await h.service.clear()).ok, true);
  assert.equal(existsSync(h.filePath), false);
  assert.equal(h.service.hasLocalConfiguration(), false);
});

test("blank codes cannot follow edited destinations or workspaces", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  await h.service.save(REQUEST);
  h.calls.length = 0;
  assert.equal((await h.service.test({ ...REQUEST, endpoint: "https://other.example", accessCode: "" })).code, "ACCESS_CODE_REQUIRED");
  assert.equal((await h.service.test({ ...REQUEST, workspaceId: "workspace-other", accessCode: "" })).code, "ACCESS_CODE_REQUIRED");
  assert.equal(h.calls.length, 0);
});

test("untrusted URLs and raw signing secrets are rejected before network access", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  for (const endpoint of ["http://example.com", "https://user:password@example.com", "https://example.com/?key=value", "https://example.com/#fragment", "file:///tmp/demo", "https://example.com\\evil"]) {
    assert.equal((await h.service.test({ ...REQUEST, endpoint })).code, "INVALID_ENDPOINT");
  }
  assert.equal((await h.service.test({ ...REQUEST, accessCode: "a".repeat(64) })).code, "INVALID_ACCESS_CODE");
  assert.equal(h.calls.length, 0);
  assert.equal((await h.service.test({ ...REQUEST, endpoint: "http://127.0.0.1:8765" })).ok, true);
});

test("wrong service identity and old capabilities never receive the access code", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  let calls = 0;
  const wrong = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async () => { calls++; return json({ schema: "another-service" }); } });
  assert.equal((await wrong.service.test(REQUEST)).code, "WRONG_SERVICE");
  assert.equal(calls, 1);
  const old = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async () => json({ ...HEALTH, capabilities: {} }) });
  assert.equal((await old.service.test(REQUEST)).code, "UNSUPPORTED_SERVICE");
});

test("check reports missing dependencies without saving or accepting an unbound workspace", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url) => json(String(url).endsWith("/health") ? HEALTH : { ...ACCESS, serviceReady: false, approvalReady: false, unexpectedSecret: ACCESS_CODE, checks: [{ id: "approval", label: "Approval service", ready: false, code: "NOT_CONFIGURED" }] }) });
  const check = await h.service.test(REQUEST);
  assert.equal(check.ok, true);
  assert.equal(check.access?.workspaceId, REQUEST.workspaceId);
  assert.equal(check.access?.serviceReady, false);
  assert.equal(check.access?.approvalReady, false);
  assert.equal(JSON.stringify(check).includes(ACCESS_CODE), false);
  assert.equal((await h.service.test({ ...REQUEST, workspaceId: "" })).code, "WORKSPACE_REQUIRED");
  assert.equal((await h.service.save({ ...REQUEST, workspaceId: "" })).code, "WORKSPACE_REQUIRED");
  assert.equal((await h.service.save(REQUEST)).code, "SERVICE_NOT_READY");
  assert.equal(existsSync(h.filePath), false);
});

test("expired, exhausted, cross-workspace, unbound and unavailable grants cannot save", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  for (const [fields, code] of [
    [{ expiresAt: "2026-09-16T00:00:00Z" }, "ACCESS_EXPIRED"],
    [{ remainingRequests: 0 }, "ACCESS_QUOTA_EXHAUSTED"],
    [{ workspaceId: "another-workspace" }, "ACCESS_SCOPE_MISMATCH"],
    [{ workspaceId: null }, "INVALID_RESPONSE"],
    [{ serviceReady: false }, "SERVICE_NOT_READY"],
    [{ modes: ["fixture", "live"] }, "INVALID_RESPONSE"],
  ] as const) {
    const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url) => json(String(url).endsWith("/health") ? HEALTH : { ...ACCESS, ...fields }) });
    assert.equal((await h.service.save(REQUEST)).code, code);
    assert.equal(existsSync(h.filePath), false);
  }
});

test("operating system encryption is mandatory and corruption is visible but nonthrowing", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  h.safeStorage.available = false;
  assert.equal((await h.service.save(REQUEST)).code, "STORAGE_UNAVAILABLE");
  h.safeStorage.available = true;
  h.safeStorage.backend = "basic_text";
  assert.equal((await h.service.save(REQUEST)).code, "STORAGE_UNAVAILABLE");
  assert.equal(h.calls.length, 0);
  h.safeStorage.backend = "test";
  writeFileSync(h.filePath, "broken ciphertext");
  assert.equal(h.service.getSnapshot().storageError, "STORAGE_READ_FAILED");
  assert.equal(h.service.getSavedConnection(), null);
  h.safeStorage.available = false;
  assert.equal(h.service.getSnapshot().storageError, "STORAGE_UNAVAILABLE");
});

test("runtime interlocks are checked before and after network I/O", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  let checks = 0;
  const h = harness(t, { assertCanChange: /** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ async () => { if (++checks === 2) throw new Error(`Private active run ${ACCESS_CODE}`); } });
  const result = await h.service.save(REQUEST);
  assert.equal(result.code, "CHANGE_BLOCKED");
  assert.equal(existsSync(h.filePath), false);
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  const blocked = harness(t, { assertCanChange: /** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ async () => { throw new Error("Private run"); } });
  assert.equal((await blocked.service.save(REQUEST)).code, "CHANGE_BLOCKED");
  assert.equal(blocked.calls.length, 0);
  assert.equal((await blocked.service.clear()).code, "CHANGE_BLOCKED");
});

test("in-flight mutations cannot overlap and an account switch aborts persistence", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  let resume: (() => void) | undefined;
  const gate = new Promise<void>(/** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ (resolve) => { resume = resolve; });
  const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url) => { await gate; return json(String(url).endsWith("/health") ? HEALTH : ACCESS); } });
  const pending = h.service.save(REQUEST);
  assert.equal((await h.service.clear()).code, "CONNECTION_BUSY");
  assert.equal((await h.service.test(REQUEST)).code, "CONNECTION_BUSY");
  h.setOwner("account-b");
  resume?.();
  assert.equal((await pending).code, "ACCOUNT_CHANGED");
  assert.equal(existsSync(h.filePath), false);
});

test("redirects are rejected and streamed over-budget responses are cancelled", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const redirect = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async () => new Response(null, { status: 307, headers: { location: "https://other.example" } }) });
  assert.equal((await redirect.service.test(REQUEST)).code, "REDIRECT_REJECTED");
  let cancelled = false;
  const overlong = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async () => new Response(new ReadableStream<Uint8Array>({
    /** 发送超过预算的数据块。 / Emit chunks exceeding the response budget. */
    pull(controller): void { controller.enqueue(new Uint8Array(40 * 1024)); },
    /** 记录消费者主动取消。 / Record consumer cancellation. */
    cancel(): void { cancelled = true; },
  })) });
  assert.equal((await overlong.service.test(REQUEST)).code, "RESPONSE_TOO_LARGE");
  assert.equal(cancelled, true);
});

test("public failures never expose upstream exception or response text", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async () => { throw new Error(`Bearer ${ACCESS_CODE}`); } });
  const result = await h.service.test(REQUEST);
  assert.equal(result.code, "NETWORK_ERROR");
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  const rejected = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url) => String(url).endsWith("/health") ? json(HEALTH) : json({ code: "EXCEPTION", message: ACCESS_CODE }, 500) });
  assert.equal((await rejected.service.test(REQUEST)).code, "ACCESS_REJECTED");
  h.setOwner("");
  assert.equal((await h.service.save(REQUEST)).code, "AUTH_REQUIRED");
});

test("an empty Live connection cannot inherit a Fixture or legacy authorization", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  const snapshot = h.service.getSnapshot();
  assert.equal(snapshot.source, "none");
  assert.equal(snapshot.endpoint, "");
  assert.equal(snapshot.credentialConfigured, false);
  assert.equal((await h.service.test({ ...REQUEST, accessCode: `oxdemo_${"a".repeat(64)}` })).code, "INVALID_ACCESS_CODE");
  assert.equal(h.calls.length, 0);
});

/** 模式、工具范围和就绪状态必须来自一致的服务器结果。 / Mode, tool scope and readiness must form a consistent server result. */
test("Live access rejects fixture grants, wildcard scopes and contradictory readiness", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  for (const fields of [
    { modes: ["fixture"] }, { allowedTools: ["*"] }, { allowedTools: [] }, { allowedScenarios: ["unknown"] },
    { requiredTeamRuntime: "builtin" }, { requiredTeamRuntime: undefined },
    { allowedTools: ["aiops.service.health", "aiops.service.health"] }, { approvalReady: false },
    { platforms: ACCESS.platforms.slice(0, 2) }, { platforms: [ACCESS.platforms[0], ACCESS.platforms[0], ACCESS.platforms[2]] },
    { platforms: ACCESS.platforms.map(/** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ (entry) => ({ ...entry, reachable: false })) },
    { checks: [{ id: "approval", label: "approval", ready: false, code: "MISSING" }] },
  ]) {
    const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url) => json(String(url).endsWith("/health") ? HEALTH : { ...ACCESS, ...fields }) });
    assert.equal((await h.service.save(REQUEST)).code, "INVALID_RESPONSE");
    assert.equal(existsSync(h.filePath), false);
  }
});

/** 运行授权在每次调用前重新检查过期、账号和范围。 / Runtime access rechecks expiry, ownership and scope before each call. */
test("runtime access refuses disabled expired wrong-workspace and unauthorized scopes", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  let now = NOW;
  const h = harness(t, { now: /** 提供可控测试时间。 / Supply controllable test time. */ () => now });
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection(REQUEST.workspaceId), /CONNECTION_DISABLED/);
  assert.equal((await h.service.save(REQUEST)).ok, true);
  assert.equal(h.service.requireRuntimeConnection(REQUEST.workspaceId, { scenario: "feature-drift", toolName: "aiops.service.health" }).accessCode, ACCESS_CODE);
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection("another"), /ACCESS_SCOPE_MISMATCH/);
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection(REQUEST.workspaceId, { scenario: "recommendation-capacity" }), /SCOPE_NOT_ALLOWED/);
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection(REQUEST.workspaceId, { toolName: "mlops.deployment.promote" }), /SCOPE_NOT_ALLOWED/);
  now = Date.parse(ACCESS.expiresAt);
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection(REQUEST.workspaceId), /ACCESS_EXPIRED/);
  now = NOW;
  assert.equal((await h.service.save({ ...REQUEST, enabled: false })).ok, true);
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection(REQUEST.workspaceId), /CONNECTION_DISABLED/);
  h.setOwner("account-b");
  assert.throws(/** 触发预期被拒绝的运行接入。 / Trigger runtime access expected to be rejected. */ () => h.service.requireRuntimeConnection(REQUEST.workspaceId), /CONNECTION_DISABLED/);
});

test("actual adapter nested errors retain only allowlisted actionable failure codes", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  for (const [serverCode, publicCode] of [
    ["ACCESS_EXPIRED", "ACCESS_EXPIRED"], ["ACCESS_REVOKED", "ACCESS_REVOKED"],
    ["ACCESS_WORKSPACE_MISMATCH", "ACCESS_SCOPE_MISMATCH"], ["ACCESS_INVALID", "INVALID_ACCESS_CODE"],
    ["INTERNAL_ERROR", "ACCESS_REJECTED"],
    ["LIVE_ACCESS_INVALID", "INVALID_ACCESS_CODE"], ["LIVE_ACCESS_EXPIRED", "ACCESS_EXPIRED"], ["LIVE_ACCESS_REVOKED", "ACCESS_REVOKED"],
    ["LIVE_WORKSPACE_MISMATCH", "ACCESS_SCOPE_MISMATCH"], ["LIVE_NOT_CONNECTED", "SERVICE_NOT_READY"],
    ["LIVE_SERVICE_NOT_READY", "SERVICE_NOT_READY"], ["LIVE_UNAVAILABLE", "SERVICE_NOT_READY"],
    ["LIVE_QUOTA_EXHAUSTED", "ACCESS_QUOTA_EXHAUSTED"], ["LIVE_MODE_FORBIDDEN", "ACCESS_MODE_MISMATCH"], ["LIVE_INVALID_REQUEST", "INVALID_REQUEST"],
  ]) {
    const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (url) => String(url).endsWith("/health") ? json(HEALTH) : json({ error: { code: serverCode, message: ACCESS_CODE } }, 403) });
    const result = await h.service.test(REQUEST);
    assert.equal(result.code, publicCode);
    assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  }
});

test("a failed encryption write preserves the previous usable configuration", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  const h = harness(t);
  assert.equal((await h.service.save(REQUEST)).ok, true);
  const previous = readFileSync(h.filePath);
  /** 模拟系统加密暂时失败。 / Simulate a transient OS encryption failure. */
  h.safeStorage.encryptString = (): Buffer => { throw new Error("Private encryption failure"); };
  assert.equal((await h.service.save({ ...REQUEST, enabled: false })).code, "STORAGE_WRITE_FAILED");
  assert.deepEqual(readFileSync(h.filePath), previous);
  assert.equal(h.service.getSnapshot().enabled, true);
});

test("network timeout aborts the request and returns a sanitized timeout", /** 验证本项 Live 接入行为与边界。 / Verify this Live access behavior and boundary. */ async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  const h = harness(t, { fetchResource: /** 模拟有界服务响应或网络故障。 / Simulate a bounded service response or network failure. */ async (_url, init) => new Promise<Response>(/** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ (_resolve, reject) => {
    init?.signal?.addEventListener("abort", /** 为隔离测试提供受控回调。 / Supply a controlled callback for an isolated test. */ () => { aborted = true; reject(new Error(ACCESS_CODE)); }, { once: true });
  }) });
  const pending = h.service.test(REQUEST);
  t.mock.timers.tick(8000);
  const result = await pending;
  assert.equal(aborted, true);
  assert.equal(result.code, "TIMEOUT");
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
});
