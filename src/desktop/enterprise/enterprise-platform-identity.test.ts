/*
#!/usr/bin/env node
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
平台身份及工作空间验收 / Platform identity and workspace acceptance
Author: maoyo
Department: 研发部
Date: 2026-09-16
Version: 1.3.0
Security Level: INTERNAL
Maintainer: maoyo
Email: synapxnet@gmail.com
*/
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ApplicationEnterpriseRuntimeService } from "./application-enterprise-runtime";

/** 使用真实运行时检查 HTTP 和产品身份，全部网络响应在隔离测试中控制。 / Check HTTP and product identity in the real runtime with isolated network responses. */
test("Xnet identity rejects wrong platforms, error pages, redirects and generic successful sites", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-identity-"));
  let response = { status: 200, text: "<html><title>XnetDataops</title></html>" };
  let unreachable = false;
  const runtime = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root, logger: { warn() {} },
    /** 记录生产检查的固定请求边界。 / Validate the production probe request boundary. */
    fetch: async (_url, options) => {
      assert.equal(options.redirect, "manual");
      if (unreachable) throw new Error("transport unavailable");
      return { status: response.status, text: async () => response.text };
    },
  });
  try {
    await runtime.saveXnetService({ serviceKey: "dataops", url: "https://platform.example.test/", autoConnect: true });
    const good = await runtime.checkXnetService({ serviceKey: "dataops" });
    assert.equal(good.service.status, "online");
    assert.equal(good.service.connectionStatus, "reachable");
    assert.equal(good.service.identityStatus, "verified");
    assert.equal(good.service.identitySource, "page-title");
    assert.equal((await runtime.listXnetServices()).services.dataops.identityPlatform, "dataops");
    response = { status: 200, text: "<title>XnetMLops</title>" };
    const wrong = await runtime.checkXnetService({ serviceKey: "dataops" });
    assert.equal(wrong.service.status, "offline");
    assert.equal(wrong.service.connectionStatus, "reachable");
    assert.equal(wrong.service.identityStatus, "mismatch");
    assert.equal(wrong.service.identityPlatform, "mlops");
    for (const status of [302, 401, 403, 404, 500]) {
      response = { status, text: "<title>XnetDataops</title>" };
      const checked = await runtime.checkXnetService({ serviceKey: "dataops" });
      assert.equal(checked.service.status, "offline");
      assert.equal(checked.service.identityStatus, "unavailable");
    }
    response = { status: 200, text: "<title>Unrelated service</title> XnetDataops" };
    assert.equal((await runtime.checkXnetService({ serviceKey: "dataops" })).service.identityStatus, "unverified");
    response = { status: 200, text: JSON.stringify({ platform: "dataops", agentVersion: "1.3.0", status: "ALIVE" }) };
    assert.equal((await runtime.checkXnetService({ serviceKey: "dataops" })).service.identitySource, "manifest");
    const changed = await runtime.saveXnetService({ serviceKey: "dataops", url: "https://other.example.test/", autoConnect: true });
    assert.equal(changed.service.identityStatus, "pending");
    assert.equal(changed.service.identityPlatform, null);
    assert.equal(changed.service.status, "offline");
    unreachable = true;
    const failed = await runtime.checkXnetService({ serviceKey: "dataops" });
    assert.equal(failed.service.connectionStatus, "unreachable");
    assert.equal(failed.service.identityStatus, "unavailable");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 用真实工作空间文件验证唯一解析和范围消失，不使用硬编码 UUID 映射。 / Verify unique resolution and deleted scopes against the actual workspace store. */
test("enterprise workspace resolution rejects missing and ambiguous demo scopes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-scope-"));
  const runtime = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
  const config = { local: { path: "E:\\demo", permission_mode: "default" }, docker: {}, cloud: {}, sandbox: {} };
  /** 写入独立测试工作空间，不触及真实企业数据。 / Write isolated workspace fixtures without touching enterprise data. */
  const writeWorkspaces = async (items: Array<{ id: string; name: string }>) => writeFile(path.join(root, "workspaces.json"), JSON.stringify(items.map((item) => ({ ...item, type: "local", config }))));
  try {
    await assert.rejects(runtime.resolveWorkspaceId("ws_goai_demo"), /明确选择/);
    await writeWorkspaces([{ id: "uuid-a", name: "Workspace A" }]);
    assert.equal(await runtime.resolveWorkspaceId("ws_goai_demo"), "uuid-a");
    await writeWorkspaces([{ id: "uuid-a", name: "Workspace A" }, { id: "uuid-b", name: "Workspace B" }]);
    await assert.rejects(runtime.resolveWorkspaceId("ws_goai_demo"), /明确选择/);
    assert.equal(await runtime.resolveWorkspaceId("uuid-b"), "uuid-b");
    await writeWorkspaces([{ id: "uuid-a", name: "Workspace A" }, { id: "uuid-b", name: "GOAI Competition Demo" }]);
    assert.equal(await runtime.resolveWorkspaceId("ws_goai_demo"), "uuid-b");
    await assert.rejects(runtime.resolveWorkspaceId("deleted-id"), /不存在/);
    await writeWorkspaces([{ id: "uuid-a", name: "GOAI Competition Demo" }, { id: "uuid-b", name: "GOAI Competition Demo" }]);
    await assert.rejects(runtime.resolveWorkspaceId("ws_goai_demo"), /明确选择/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid saved URLs cannot retain reachable or verified platform badges after restart", /** 配置读取必须使非法地址和矛盾的旧身份失效。 / Configuration reads must invalidate unsafe URLs and contradictory historical identity. */ async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-platform-state-"));
  const original = { url: "https://dataops.example.test/", status: "online", connectionStatus: "reachable", identityStatus: "verified", identityPlatform: "dataops", identitySource: "page-title", auto_connect: true, last_check: "2026-09-17T00:00:00.000Z" };
  try {
    for (const url of ["", "file:///private/config", "https://user:secret@example.test/", "http://external.example.test/"]) {
      await writeFile(path.join(root, "xnet_services.json"), JSON.stringify({ dataops: { ...original, url } }));
      const restarted = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
      const service = (await restarted.listXnetServices()).services.dataops;
      assert.equal(service.url, "");
      assert.equal(service.status, "offline");
      assert.equal(service.connectionStatus, "unchecked");
      assert.equal(service.identityStatus, "pending");
      assert.equal(service.identityPlatform, null);
      assert.equal(service.identitySource, null);
      assert.equal(service.last_check, "");
    }
    for (const [fields, identityStatus] of [
      [{ identityPlatform: "mlops" }, "mismatch"],
      [{ connectionStatus: "unreachable" }, "unavailable"],
      [{ connectionStatus: "unchecked" }, "pending"],
      [{ identitySource: null }, "unverified"],
    ] as const) {
      await writeFile(path.join(root, "xnet_services.json"), JSON.stringify({ dataops: { ...original, ...fields } }));
      const service = (await new ApplicationEnterpriseRuntimeService({ userDataDirectory: root }).listXnetServices()).services.dataops;
      assert.equal(service.status, "offline");
      assert.equal(service.identityStatus, identityStatus);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("batch probes start all platforms independently and a queued URL save invalidates old results", /** 三平台并行但存储仍按顺序提交，旧检查不能覆盖后来保存的地址。 / Probe three platforms concurrently while ordered writes prevent old checks from replacing a later URL save. */ async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-platform-batch-"));
  const keys = ["dataops", "mlops", "aiops"] as const;
  const requests: string[] = [];
  const release = new Map<string, () => void>();
  const gates = new Map(keys.map(/** 为每个平台创建独立延迟。 / Create an independent delay for each platform. */ key => [key, new Promise<void>(/** 允许测试单独释放各平台响应。 / Allow separate release of each platform response. */ resolve => { release.set(key, resolve); })]));
  let allStarted: (() => void) | undefined;
  const started = new Promise<void>(/** 等待三个请求均已真正开始。 / Wait until all three requests have actually started. */ resolve => { allStarted = resolve; });
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: root,
    logger: { /** 不输出受控网络失败。 / Suppress expected controlled network failures. */ warn() {} },
    /** 以互不依赖的响应检查实际探测并发。 / Check real probe concurrency using independent responses. */
    async fetch(url) {
      const key = keys.find(/** 从受控目标地址识别平台。 / Identify the platform from the controlled target URL. */ item => new URL(url).hostname.startsWith(item));
      assert.ok(key);
      requests.push(key);
      if (requests.length === 3) allStarted?.();
      await gates.get(key);
      if (key === "mlops") throw new Error("Expected isolated platform failure");
      return { status: 200, /** 返回平台自身的公开标题。 / Return this platform's own public title. */ text: async () => `<title>Xnet${key}</title>` };
    },
  });
  try {
    for (const key of keys) await runtime.saveXnetService({ serviceKey: key, url: `https://${key}.example.test/`, autoConnect: key !== "mlops" });
    const checking = runtime.checkAllXnetServices({ autoOnly: false });
    await started;
    assert.deepEqual(requests, keys);
    const saving = runtime.saveXnetService({ serviceKey: "dataops", url: "https://dataops-new.example.test/", autoConnect: true });
    for (const unblock of release.values()) unblock();
    const checked = await checking;
    assert.equal(checked.services.dataops.status, "online");
    assert.equal(checked.services.aiops.status, "online");
    assert.equal(checked.services.mlops.connectionStatus, "unreachable");
    assert.equal(checked.services.mlops.status, "offline");
    await saving;
    const reopened = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
    const persisted = (await reopened.listXnetServices()).services;
    assert.equal(persisted.dataops.url, "https://dataops-new.example.test/");
    assert.equal(persisted.dataops.status, "offline");
    assert.equal(persisted.dataops.identityStatus, "pending");
    assert.equal(persisted.dataops.last_check, "");
    assert.equal(persisted.aiops.identityStatus, "verified");
    requests.splice(0);
    await runtime.checkAllXnetServices({ autoOnly: true });
    assert.deepEqual(requests, ["dataops", "aiops"]);
  } finally {
    for (const unblock of release.values()) unblock();
    await rm(root, { recursive: true, force: true });
  }
});
