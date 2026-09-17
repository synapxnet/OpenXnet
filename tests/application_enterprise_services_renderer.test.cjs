/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 三平台配置状态回归 / Enterprise platform configuration state regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.0.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

/** 构造异步控制器以覆盖编辑中回包。 / Create a deferred result for responses arriving during edits. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

/** 创建隔离的真实 Renderer 方法实例。 / Create an isolated instance of the actual renderer methods. */
function createApp(runtime = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, "../static/js/vue_methods.js"), "utf8");
  const start = source.indexOf("  getXnetStatusType(status)");
  const end = source.indexOf("  saveKbFile()", start);
  assert.ok(start >= 0 && end > start);
  const notifications = [];
  const opened = [];
  const methods = vm.runInNewContext(`({${source.slice(start, end)}})`, {
    showNotification: (message, type) => notifications.push({ message, type }),
    window: { open: url => opened.push(url) },
    isElectron: false,
  });
  const app = {
    ...methods,
    xnetServices: {},
    xnetServiceDrafts: {},
    xnetServiceErrors: {},
    xnetServiceBusy: {},
    xnetServiceRequestVersions: {},
    xnetServicesLoadVersion: 0,
    xnetServicesLoading: false,
    xnetCheckingAll: false,
    $refs: {},
    t: () => "",
    isCurrentLanguageZh: () => true,
    getApplicationEnterpriseRuntime: () => runtime,
  };
  for (const key of ["dataops", "mlops", "aiops"]) {
    app.xnetServices[key] = record(key);
    app.xnetServiceDrafts[key] = { url: app.xnetServices[key].url, auto_connect: true };
    app.xnetServiceErrors[key] = "";
    app.xnetServiceBusy[key] = false;
    app.xnetServiceRequestVersions[key] = 0;
  }
  return { app, notifications, opened };
}

/** 创建真实契约形状的服务记录。 / Create a platform record using the actual response contract. */
function record(key, overrides = {}) {
  return {
    name: `Xnet ${key}`, url: `https://${key}.example.test/`, auto_connect: true,
    status: "online", connectionStatus: "reachable", identityStatus: "verified",
    identityPlatform: key, identitySource: "page-title", last_check: "2026-09-17T09:00:00Z",
    ...overrides,
  };
}

/** 草稿不导航已保存平台。 / Draft edits do not navigate the saved platform. */
test("editing an address preserves the saved preview and browser target until explicit save", () => {
  const { app, opened } = createApp();
  app.xnetServiceDrafts.dataops.url = "https://wrong-platform.example.test/";
  assert.equal(app.hasXnetServiceDraft("dataops"), true);
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "https://dataops.example.test/");
  app.openXnetServiceInBrowser("dataops");
  assert.deepEqual(opened, ["https://dataops.example.test/"]);
  app.resetXnetServiceDraft("dataops");
  assert.equal(app.hasXnetServiceDraft("dataops"), false);
});

/** 身份不符与旧版在线不能打开预览。 / Mismatched identities and legacy online flags cannot open previews. */
test("mismatched and missing identities never inherit online status or preview access", () => {
  const { app } = createApp();
  app.applyXnetServiceRecord("dataops", record("dataops", { identityStatus: "mismatch", identityPlatform: "mlops" }));
  assert.equal(app.xnetServices.dataops.connectionStatus, "reachable");
  assert.equal(app.xnetServices.dataops.identityPlatform, "mlops");
  assert.equal(app.xnetServices.dataops.status, "offline");
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "");
  assert.match(app.getXnetServicePreviewReason("dataops"), /其他平台/u);
  app.applyXnetServiceRecord("dataops", { url: "https://dataops.example.test/", status: "online" });
  assert.equal(app.xnetServices.dataops.identityStatus, "pending");
  assert.equal(app.xnetServices.dataops.status, "offline");
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "");
});

/** 矛盾身份回执不能显示已验证。 / Contradictory identity receipts cannot appear verified. */
test("verification requires a matching platform, reachable connection, source, and explicit online status", () => {
  const { app } = createApp();
  for (const invalid of [
    { identitySource: null },
    { identityPlatform: "mlops" },
    { connectionStatus: "unreachable" },
    { url: "" },
  ]) {
    app.applyXnetServiceRecord("dataops", record("dataops", invalid));
    assert.notEqual(app.xnetServices.dataops.identityStatus, "verified");
    assert.equal(app.xnetServices.dataops.status, "offline");
    assert.equal(app.getXnetServicePreviewUrl("dataops"), "");
  }
  app.applyXnetServiceRecord("dataops", record("dataops", { status: "offline" }));
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "");
});

/** 首次读取已有配置应填充空白初始草稿。 / Initial loading of saved settings fills the untouched empty draft. */
test("first load hydrates default saved URLs without treating initial blank inputs as user edits", async () => {
  const { app } = createApp({ listApplicationEnterpriseXnetServices: async () => ({ services: { dataops: record("dataops") } }) });
  app.xnetServices.dataops = record("dataops", { url: "", auto_connect: false, status: "offline", connectionStatus: "unchecked", identityStatus: "pending", identityPlatform: null, identitySource: null });
  app.xnetServiceDrafts.dataops = { url: "", auto_connect: false };
  assert.equal(await app.loadXnetServices(), true);
  assert.equal(app.xnetServiceDrafts.dataops.url, "https://dataops.example.test/");
  assert.equal(app.xnetServiceDrafts.dataops.auto_connect, true);
  assert.equal(app.hasXnetServiceDraft("dataops"), false);
});

/** 地址清空必须由显式保存生效。 / Clearing an address takes effect only after an explicit save. */
test("an empty draft remains editable across refresh and clearing save removes identity and preview", async () => {
  const { app } = createApp({
    listApplicationEnterpriseXnetServices: async () => ({ services: { dataops: record("dataops") } }),
    saveApplicationEnterpriseXnetService: async request => ({ success: true, service: record("dataops", { url: request.url, status: "offline", connectionStatus: "unchecked", identityStatus: "pending", identityPlatform: null, identitySource: null }) }),
  });
  app.xnetServiceDrafts.dataops.url = "";
  assert.equal(app.hasXnetServiceDraft("dataops"), true);
  assert.equal(await app.loadXnetServices(), true);
  assert.equal(app.xnetServiceDrafts.dataops.url, "");
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "https://dataops.example.test/");
  assert.equal(await app.saveXnetServiceConfig("dataops"), true);
  assert.equal(app.xnetServices.dataops.url, "");
  assert.equal(app.xnetServices.dataops.last_check, "");
  assert.equal(app.hasXnetServiceDraft("dataops"), false);
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "");
});

/** 地址规范化回填应结束未保存状态。 / Canonicalized saved URLs should clear the unsaved state. */
test("canonical save receipt replaces unchanged input and does not leave a false dirty state", async () => {
  const { app } = createApp({ saveApplicationEnterpriseXnetService: async () => ({ success: true, service: record("dataops", { url: "https://canonical.example.test/", connectionStatus: "unchecked", identityStatus: "pending", identityPlatform: null, identitySource: null }) }) });
  app.xnetServiceDrafts.dataops.url = "  https://canonical.example.test  ";
  assert.equal(await app.saveXnetServiceConfig("dataops"), true);
  assert.equal(app.xnetServiceDrafts.dataops.url, "https://canonical.example.test/");
  assert.equal(app.hasXnetServiceDraft("dataops"), false);
});

/** 检查只读取已保存配置。 / Checking only reads saved configuration. */
test("checking an unsaved draft does not save or make any network request", async () => {
  let calls = 0;
  const { app, notifications } = createApp({
    saveApplicationEnterpriseXnetService: () => { calls++; },
    checkApplicationEnterpriseXnetService: () => { calls++; },
  });
  app.xnetServiceDrafts.dataops.auto_connect = false;
  assert.equal(await app.connectXnetService("dataops"), false);
  assert.equal(calls, 0);
  assert.equal(notifications[0].type, "warning");
});

/** 读取刷新保留编辑草稿。 / Refreshing saved settings preserves edited drafts. */
test("list refresh preserves drafts while applying authoritative platform identity", async () => {
  const result = deferred();
  const { app } = createApp({ listApplicationEnterpriseXnetServices: () => result.promise });
  const loading = app.loadXnetServices();
  app.xnetServiceDrafts.dataops.url = "https://draft.example.test/";
  result.resolve({ services: { dataops: record("dataops", { identityStatus: "mismatch", identityPlatform: "mlops" }) } });
  assert.equal(await loading, true);
  assert.equal(app.xnetServiceDrafts.dataops.url, "https://draft.example.test/");
  assert.equal(app.xnetServices.dataops.identityStatus, "mismatch");
  assert.equal(app.xnetServices.dataops.status, "offline");
  assert.equal(app.xnetServicesLoading, false);
});

/** 保存期间的新编辑不能被旧提交覆盖。 / Edits made during saving cannot be overwritten by the submitted draft. */
test("save receipt normalizes the submitted record but preserves later URL and toggle edits", async () => {
  const result = deferred();
  const requests = [];
  const { app } = createApp({ saveApplicationEnterpriseXnetService: request => { requests.push(request); return result.promise; } });
  app.xnetServiceDrafts.dataops.url = "https://new.example.test";
  const saving = app.saveXnetServiceConfig("dataops");
  app.xnetServiceDrafts.dataops.url = "https://later.example.test/";
  app.xnetServiceDrafts.dataops.auto_connect = false;
  result.resolve({ success: true, service: record("dataops", { url: "https://new.example.test/", connectionStatus: "unchecked", identityStatus: "pending", identityPlatform: null }) });
  assert.equal(await saving, true);
  assert.equal(requests[0].url, "https://new.example.test");
  assert.equal(app.xnetServices.dataops.url, "https://new.example.test/");
  assert.equal(app.xnetServiceDrafts.dataops.url, "https://later.example.test/");
  assert.equal(app.xnetServiceDrafts.dataops.auto_connect, false);
  assert.equal(app.xnetServiceBusy.dataops, false);
  assert.equal(app.getXnetServicePreviewUrl("dataops"), "");
});

/** 保存失败明确反馈且不清除输入。 / Failed saves report an error and preserve input. */
test("failed and rejected saves preserve settings and drafts and never expose private errors", async () => {
  for (const response of ["throw", "reject"]) {
    const { app, notifications } = createApp({
      saveApplicationEnterpriseXnetService: async () => {
        if (response === "throw") throw new Error("private-secret");
        return { success: false };
      },
    });
    app.xnetServiceDrafts.dataops.url = "invalid-url";
    assert.equal(await app.saveXnetServiceConfig("dataops", true), false);
    assert.equal(app.xnetServiceDrafts.dataops.url, "invalid-url");
    assert.equal(app.xnetServices.dataops.url, "https://dataops.example.test/");
    assert.match(app.xnetServiceErrors.dataops, /配置未保存/u);
    assert.equal(notifications[0].type, "error");
    assert.doesNotMatch(JSON.stringify(notifications), /private-secret/u);
  }
});

/** 单平台检查回写完整身份及来源。 / A single-platform check applies full identity and source fields. */
test("single platform check merges all identity fields without touching new input", async () => {
  const result = deferred();
  const { app } = createApp({ checkApplicationEnterpriseXnetService: () => result.promise });
  const checking = app.connectXnetService("dataops");
  app.xnetServiceDrafts.dataops.url = "https://later.example.test/";
  result.resolve({ service: record("dataops", { identitySource: "manifest", last_check: "later" }) });
  assert.equal(await checking, true);
  assert.equal(app.xnetServices.dataops.identitySource, "manifest");
  assert.equal(app.xnetServices.dataops.last_check, "later");
  assert.equal(app.xnetServiceDrafts.dataops.url, "https://later.example.test/");
});

/** 过期回包不得覆盖已更改服务。 / Stale responses cannot overwrite a changed saved service. */
test("a stale health response cannot overwrite a newer saved address", async () => {
  const result = deferred();
  const { app, notifications } = createApp({ checkApplicationEnterpriseXnetService: () => result.promise });
  const checking = app.connectXnetService("dataops");
  app.xnetServices.dataops.url = "https://newer.example.test/";
  app.xnetServices.dataops.identityStatus = "pending";
  result.resolve({ service: record("dataops") });
  assert.equal(await checking, false);
  assert.equal(app.xnetServices.dataops.url, "https://newer.example.test/");
  assert.equal(app.xnetServices.dataops.identityStatus, "pending");
  assert.equal(notifications.length, 0);
});

/** 批量检查不能覆盖草稿且不误报全部在线。 / Bulk checks preserve drafts and do not claim all platforms are online. */
test("bulk health refresh merges mismatch status and preserves unsaved auto-check preferences", async () => {
  const { app, notifications } = createApp({ checkAllApplicationEnterpriseXnetServices: async () => ({ services: {
    dataops: record("dataops", { identityStatus: "mismatch", identityPlatform: "mlops" }),
    mlops: record("mlops"), aiops: record("aiops"),
  } }) });
  app.xnetServiceDrafts.dataops.auto_connect = false;
  assert.equal(await app.refreshAllXnetServices(false), true);
  assert.equal(app.xnetServiceDrafts.dataops.auto_connect, false);
  assert.equal(app.xnetServices.dataops.identityStatus, "mismatch");
  assert.equal(app.xnetServices.dataops.status, "offline");
  assert.equal(notifications[0].type, "info");
});

/** 互斥避免读写交叉回包。 / Mutual exclusion prevents crossing read and write receipts. */
test("a pending save prevents list and bulk refresh from racing its configuration receipt", async () => {
  const result = deferred();
  let reads = 0;
  const { app } = createApp({
    saveApplicationEnterpriseXnetService: () => result.promise,
    listApplicationEnterpriseXnetServices: () => { reads++; },
    checkAllApplicationEnterpriseXnetServices: () => { reads++; },
  });
  app.xnetServiceDrafts.dataops.auto_connect = false;
  const saving = app.saveXnetServiceConfig("dataops");
  assert.equal(await app.loadXnetServices(), false);
  assert.equal(await app.refreshAllXnetServices(), false);
  assert.equal(reads, 0);
  result.resolve({ success: true, service: record("dataops", { auto_connect: false }) });
  assert.equal(await saving, true);
  assert.equal(app.hasXnetServiceDraft("dataops"), false);
});

/** 失败回包不能被视为检查成功。 / Missing and failed response records cannot be reported as successful checks. */
test("malformed list and bulk receipts report failures instead of success", async () => {
  const { app, notifications } = createApp({
    listApplicationEnterpriseXnetServices: async () => ({}),
    checkAllApplicationEnterpriseXnetServices: async () => ({ success: false }),
  });
  assert.equal(await app.loadXnetServices(), false);
  assert.equal(await app.refreshAllXnetServices(), false);
  assert.equal(notifications.filter(item => item.type === "error").length, 2);
  assert.equal(app.xnetServicesLoading, false);
  assert.equal(app.xnetCheckingAll, false);
});
