/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 协同接入隔离与存储测试 / Collaboration access isolation and storage tests.
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
import { ApplicationCompetitionConnectionService, type ApplicationCompetitionConnectionServiceOptions } from "./application-competition-connection";

const ACCESS_CODE = `oxdemo_${"a".repeat(64)}`;
const NOW = Date.parse("2026-09-17T00:00:00Z");
const REQUEST = { endpoint: "https://demo.example/adapter", workspaceId: "workspace-demo", accessCode: ACCESS_CODE, enabled: true };
const HEALTH = { schema: "openxnet.agentteams-adapter.health.v1", status: "ok", capabilities: { demoAccessCodes: true } };
const ACCESS = {
  schema: "openxnet.agentteams.access.v1", grantId: "grant_123", label: "Demo access", workspaceId: "workspace-demo",
  expiresAt: "2026-09-18T00:00:00Z", remainingRequests: 50, modes: ["fixture"], serviceReady: true,
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
function harness(t: TestContext, overrides: Partial<ApplicationCompetitionConnectionServiceOptions> = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "openxnet-connection-"));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const filePath = path.join(directory, "connection.enc");
  const safeStorage = new TestSafeStorage();
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let owner = "account-a";
  const options: ApplicationCompetitionConnectionServiceOptions = {
    filePath, safeStorage, now: () => NOW, resolveOwnerId: () => owner,
    fetchResource: async (url, init) => {
      calls.push({ url: String(url), init });
      return json(String(url).endsWith("/health") ? HEALTH : ACCESS);
    },
    ...overrides,
  };
  return { service: new ApplicationCompetitionConnectionService(options), options, filePath, safeStorage, calls,
    /** 模拟已认证账号切换。 / Simulate an authenticated account change. */
    setOwner(value: string): void { owner = value; },
  };
}

test("read-only check does not connect or persist and strips undeclared server fields", async (t) => {
  const h = harness(t);
  const result = await h.service.test(REQUEST);
  assert.equal(result.ok, true);
  assert.equal(result.access?.workspaceId, REQUEST.workspaceId);
  assert.equal(existsSync(h.filePath), false);
  assert.deepEqual(h.calls.map((call) => call.url), ["https://demo.example/adapter/health", "https://demo.example/adapter/api/v1/access/check"]);
  assert.equal(h.calls[0]?.init?.headers, undefined);
  assert.equal(h.calls[1]?.init?.redirect, "manual");
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
});

test("save survives a service restart and never writes or returns plaintext credentials", async (t) => {
  const h = harness(t);
  const result = await h.service.save(REQUEST);
  assert.equal(result.ok, true);
  assert.equal(h.calls.at(-1)?.url.endsWith("/access/connect"), true);
  assert.equal(readFileSync(h.filePath).includes(Buffer.from(ACCESS_CODE)), false);
  assert.equal(readFileSync(h.filePath).includes(Buffer.from("account-a")), false);
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  const restarted = new ApplicationCompetitionConnectionService(h.options);
  assert.equal(restarted.getSnapshot().source, "saved");
  assert.equal(restarted.getSnapshot().endpoint, "https://demo.example/adapter/");
  assert.equal(restarted.getSavedConnection()?.accessCode, ACCESS_CODE);
  const reused = await restarted.test({ endpoint: REQUEST.endpoint, workspaceId: REQUEST.workspaceId });
  assert.equal(reused.ok, true);
});

test("an account switch cannot read, reuse or delete another account's credential", async (t) => {
  const h = harness(t);
  assert.equal((await h.service.save(REQUEST)).ok, true);
  h.setOwner("account-b");
  assert.equal(h.service.getSavedConnection(), null);
  assert.equal(h.service.getSnapshot().credentialConfigured, false);
  assert.equal((await h.service.test({ ...REQUEST, accessCode: "" })).code, "ACCESS_CODE_REQUIRED");
  assert.equal((await h.service.clear()).ok, true);
  assert.equal(existsSync(h.filePath), true);
  h.setOwner("account-a");
  assert.equal((await h.service.clear()).ok, true);
  assert.equal(existsSync(h.filePath), false);
});

test("blank codes cannot follow edited destinations or workspaces", async (t) => {
  const h = harness(t);
  await h.service.save(REQUEST);
  h.calls.length = 0;
  assert.equal((await h.service.test({ ...REQUEST, endpoint: "https://other.example", accessCode: "" })).code, "ACCESS_CODE_REQUIRED");
  assert.equal((await h.service.test({ ...REQUEST, workspaceId: "workspace-other", accessCode: "" })).code, "ACCESS_CODE_REQUIRED");
  assert.equal(h.calls.length, 0);
});

test("untrusted URLs and raw signing secrets are rejected before network access", async (t) => {
  const h = harness(t);
  for (const endpoint of ["http://example.com", "https://user:password@example.com", "https://example.com/?key=value", "https://example.com/#fragment", "file:///tmp/demo", "https://example.com\\evil"]) {
    assert.equal((await h.service.test({ ...REQUEST, endpoint })).code, "INVALID_ENDPOINT");
  }
  assert.equal((await h.service.test({ ...REQUEST, accessCode: "a".repeat(64) })).code, "INVALID_ACCESS_CODE");
  assert.equal(h.calls.length, 0);
  assert.equal((await h.service.test({ ...REQUEST, endpoint: "http://127.0.0.1:8765" })).ok, true);
});

test("wrong service identity and old capabilities never receive the access code", async (t) => {
  let calls = 0;
  const wrong = harness(t, { fetchResource: async () => { calls++; return json({ schema: "another-service" }); } });
  assert.equal((await wrong.service.test(REQUEST)).code, "WRONG_SERVICE");
  assert.equal(calls, 1);
  const old = harness(t, { fetchResource: async () => json({ ...HEALTH, capabilities: {} }) });
  assert.equal((await old.service.test(REQUEST)).code, "UNSUPPORTED_SERVICE");
});

test("check can discover a bound workspace or unbound grant without claiming service readiness", async (t) => {
  let workspaceId: string | null = "assigned-workspace";
  const h = harness(t, { fetchResource: async (url) => json(String(url).endsWith("/health") ? HEALTH : { ...ACCESS, workspaceId, serviceReady: false, unexpectedSecret: ACCESS_CODE }) });
  const check = await h.service.test({ ...REQUEST, workspaceId: "" });
  assert.equal(check.ok, true);
  assert.equal(check.access?.workspaceId, "assigned-workspace");
  assert.equal(check.access?.serviceReady, false);
  assert.equal(JSON.stringify(check).includes(ACCESS_CODE), false);
  workspaceId = null;
  assert.equal((await h.service.test({ ...REQUEST, workspaceId: "" })).access?.workspaceId, null);
  assert.equal((await h.service.save({ ...REQUEST, workspaceId: "" })).code, "WORKSPACE_REQUIRED");
});

test("expired, exhausted, cross-workspace, unbound and unavailable grants cannot save", async (t) => {
  for (const [fields, code] of [
    [{ expiresAt: "2026-09-16T00:00:00Z" }, "ACCESS_EXPIRED"],
    [{ remainingRequests: 0 }, "ACCESS_QUOTA_EXHAUSTED"],
    [{ workspaceId: "another-workspace" }, "ACCESS_SCOPE_MISMATCH"],
    [{ workspaceId: null }, "ACCESS_SCOPE_MISMATCH"],
    [{ serviceReady: false }, "SERVICE_NOT_READY"],
    [{ modes: ["fixture", "live"] }, "INVALID_RESPONSE"],
  ] as const) {
    const h = harness(t, { fetchResource: async (url) => json(String(url).endsWith("/health") ? HEALTH : { ...ACCESS, ...fields }) });
    assert.equal((await h.service.save(REQUEST)).code, code);
    assert.equal(existsSync(h.filePath), false);
  }
});

test("operating system encryption is mandatory and corruption is visible but nonthrowing", async (t) => {
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

test("runtime interlocks are checked before and after network I/O", async (t) => {
  let checks = 0;
  const h = harness(t, { assertCanChange: async () => { if (++checks === 2) throw new Error(`Private active run ${ACCESS_CODE}`); } });
  const result = await h.service.save(REQUEST);
  assert.equal(result.code, "CHANGE_BLOCKED");
  assert.equal(existsSync(h.filePath), false);
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  const blocked = harness(t, { assertCanChange: async () => { throw new Error("Private run"); } });
  assert.equal((await blocked.service.save(REQUEST)).code, "CHANGE_BLOCKED");
  assert.equal(blocked.calls.length, 0);
  assert.equal((await blocked.service.clear()).code, "CHANGE_BLOCKED");
});

test("in-flight mutations cannot overlap and an account switch aborts persistence", async (t) => {
  let resume: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  const h = harness(t, { fetchResource: async (url) => { await gate; return json(String(url).endsWith("/health") ? HEALTH : ACCESS); } });
  const pending = h.service.save(REQUEST);
  assert.equal((await h.service.clear()).code, "CONNECTION_BUSY");
  assert.equal((await h.service.test(REQUEST)).code, "CONNECTION_BUSY");
  h.setOwner("account-b");
  resume?.();
  assert.equal((await pending).code, "ACCOUNT_CHANGED");
  assert.equal(existsSync(h.filePath), false);
});

test("redirects are rejected and streamed over-budget responses are cancelled", async (t) => {
  const redirect = harness(t, { fetchResource: async () => new Response(null, { status: 307, headers: { location: "https://other.example" } }) });
  assert.equal((await redirect.service.test(REQUEST)).code, "REDIRECT_REJECTED");
  let cancelled = false;
  const overlong = harness(t, { fetchResource: async () => new Response(new ReadableStream<Uint8Array>({
    /** 发送超过预算的数据块。 / Emit chunks exceeding the response budget. */
    pull(controller): void { controller.enqueue(new Uint8Array(40 * 1024)); },
    /** 记录消费者主动取消。 / Record consumer cancellation. */
    cancel(): void { cancelled = true; },
  })) });
  assert.equal((await overlong.service.test(REQUEST)).code, "RESPONSE_TOO_LARGE");
  assert.equal(cancelled, true);
});

test("public failures never expose upstream exception or response text", async (t) => {
  const h = harness(t, { fetchResource: async () => { throw new Error(`Bearer ${ACCESS_CODE}`); } });
  const result = await h.service.test(REQUEST);
  assert.equal(result.code, "NETWORK_ERROR");
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  const rejected = harness(t, { fetchResource: async (url) => String(url).endsWith("/health") ? json(HEALTH) : json({ code: "EXCEPTION", message: ACCESS_CODE }, 500) });
  assert.equal((await rejected.service.test(REQUEST)).code, "ACCESS_REJECTED");
  h.setOwner("");
  assert.equal((await h.service.save(REQUEST)).code, "AUTH_REQUIRED");
});

test("legacy deployment status stays redacted and unsafe endpoint fields are omitted", (t) => {
  const h = harness(t, { readDeployment: () => ({ enabled: true, endpoint: "https://user:private@example.com", credentialConfigured: true }) });
  const snapshot = h.service.getSnapshot();
  assert.equal(snapshot.source, "deployment");
  assert.equal(snapshot.endpoint, "");
  assert.equal(snapshot.credentialConfigured, true);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
});

test("actual adapter nested errors retain only allowlisted actionable failure codes", async (t) => {
  for (const [serverCode, publicCode] of [
    ["ACCESS_EXPIRED", "ACCESS_EXPIRED"], ["ACCESS_REVOKED", "ACCESS_REVOKED"],
    ["ACCESS_WORKSPACE_MISMATCH", "ACCESS_SCOPE_MISMATCH"], ["ACCESS_INVALID", "INVALID_ACCESS_CODE"],
    ["INTERNAL_ERROR", "ACCESS_REJECTED"],
  ]) {
    const h = harness(t, { fetchResource: async (url) => String(url).endsWith("/health") ? json(HEALTH) : json({ error: { code: serverCode, message: ACCESS_CODE } }, 403) });
    const result = await h.service.test(REQUEST);
    assert.equal(result.code, publicCode);
    assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  }
});

test("a failed encryption write preserves the previous usable configuration", async (t) => {
  const h = harness(t);
  assert.equal((await h.service.save(REQUEST)).ok, true);
  const previous = readFileSync(h.filePath);
  /** 模拟系统加密暂时失败。 / Simulate a transient OS encryption failure. */
  h.safeStorage.encryptString = (): Buffer => { throw new Error("Private encryption failure"); };
  assert.equal((await h.service.save({ ...REQUEST, enabled: false })).code, "STORAGE_WRITE_FAILED");
  assert.deepEqual(readFileSync(h.filePath), previous);
  assert.equal(h.service.getSnapshot().enabled, true);
});

test("network timeout aborts the request and returns a sanitized timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  const h = harness(t, { fetchResource: async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error(ACCESS_CODE)); }, { once: true });
  }) });
  const pending = h.service.test(REQUEST);
  t.mock.timers.tick(8000);
  const result = await pending;
  assert.equal(aborted, true);
  assert.equal(result.code, "TIMEOUT");
  assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
});
