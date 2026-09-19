#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 隔离真实演练环境准备 / Isolated real staging environment preparation.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const { readFile } = require("node:fs/promises");
const { PublicError } = require("./contracts");
const { digest, canonical, identifier } = require("./live-access-store");

/** 只返回稳定错误，不传播服务密钥或内部响应。 / Return a stable error without service credentials or upstream bodies. */
function failure(code, status = 502) { return new PublicError(status, code, "The isolated feature-drift runtime is not ready."); }

/** 为真实 Staging 场景准备固定资源；GET 永不初始化。 / Prepare fixed resources for real staging; GET never initializes them. */
class FeatureDriftPreparation {
  /** 固定服务地址和初始化凭据文件。 / Bind a fixed service address and initializer credential file. */
  constructor(config, transport = fetch) {
    this.config = config;
    this.fetch = transport;
    let base;
    try { base = new URL(config.baseUrl); } catch { throw failure("DRIFT_CONFIGURATION_INVALID", 503); }
    if (!["https:", "http:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/"
      || base.protocol === "http:" && config.allowHttp !== true) throw failure("DRIFT_CONFIGURATION_INVALID", 503);
    if (typeof config.tokenFile !== "string" || !config.tokenFile) throw failure("DRIFT_CONFIGURATION_INVALID", 503);
    this.base = base;
  }

  /** 请求限定大小的JSON，拒绝重定向及原始错误泄露。 / Request bounded JSON and reject redirects or raw error disclosure. */
  async request(route, method, body) {
    let token;
    try { token = (await readFile(this.config.tokenFile, "utf8")).trim(); } catch { throw failure("DRIFT_CREDENTIAL_UNAVAILABLE", 503); }
    if (token.length < 32 || token.length > 4096 || /\s/u.test(token)) throw failure("DRIFT_CREDENTIAL_UNAVAILABLE", 503);
    const controller = new AbortController();
    const timeout = setTimeout(/** 取消超时准备请求。 / Cancel a timed-out preparation request. */ () => controller.abort(), 60000);
    try {
      const response = await this.fetch(new URL(route, this.base), { method, redirect: "manual", signal: controller.signal,
        headers: { "X-Feature-Drift-Token": token, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (response.status === 404 && method === "GET") return null;
      if (!response.ok) throw failure("DRIFT_PREPARATION_REJECTED");
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body || []) {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) { controller.abort(); throw failure("DRIFT_RESPONSE_TOO_LARGE"); }
        chunks.push(chunk);
      }
      try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw failure("DRIFT_RESPONSE_INVALID"); }
    } catch (error) {
      if (error instanceof PublicError) throw error;
      throw failure("DRIFT_RUNTIME_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }

  /** 核对事件与固定资源身份，禁止误接旧运行或其他工作空间。 / Verify incident and resource identity to prevent cross-run or cross-workspace attachment. */
  validate(payload, request) {
    const data = payload?.data;
    const scenario = request.context.incident.scenario;
    if (!data || data.workspaceId !== request.workspaceId || data.incidentId !== request.incidentId || data.traceId !== request.traceId
      || data.sourceMode !== "REAL_CPU_SYNTHETIC_STAGING" || data.synthetic !== true
      || data.deployment?.deploymentUid !== scenario.deploymentUid) throw failure("DRIFT_PREPARATION_SCOPE_MISMATCH");
    return data;
  }

  /** 仅读取管理员预置的精确事件故障计划，模型无权指定。 / Read only an operator-provisioned exact-incident fault plan that models cannot select. */
  async failureMode(request) {
    if (!this.config.faultPlanFile) return "none";
    let plans;
    try {
      const raw = await readFile(this.config.faultPlanFile, "utf8");
      if (raw.length > 32768) throw new Error("limit");
      plans = JSON.parse(raw);
    } catch { throw failure("DRIFT_FAULT_PLAN_INVALID", 503); }
    if (!Array.isArray(plans) || plans.length > 100 || plans.some(item => !item || typeof item.workspaceId !== "string" || typeof item.incidentId !== "string"
      || item.failureMode !== "post_release_contract" || Object.keys(item).some(key => !["workspaceId", "incidentId", "failureMode"].includes(key)))) throw failure("DRIFT_FAULT_PLAN_INVALID", 503);
    const matches = plans.filter(item => item.workspaceId === request.workspaceId && item.incidentId === request.incidentId);
    if (matches.length > 1) throw failure("DRIFT_FAULT_PLAN_INVALID", 503);
    return matches.length === 1 ? "post_release_contract" : "none";
  }

  /** 初次调查显式创建隔离数据，重复请求只读复用，绝不重置。 / Explicitly create isolated data for first investigation and reuse existing data without reset. */
  async ensure(request) {
    const scenario = request.context.incident.scenario;
    for (const key of ["workspaceId", "incidentId", "traceId"]) identifier(request[key]);
    if (scenario.scenarioType !== "feature-drift" || scenario.deploymentUid !== "deploy_risk_prod" || scenario.assetUid !== "asset_risk_features_prod") throw failure("DRIFT_RESOURCE_FORBIDDEN", 403);
    const route = `v1/incidents/${encodeURIComponent(request.incidentId)}`;
    const existing = await this.request(`${route}?workspaceId=${encodeURIComponent(request.workspaceId)}`, "GET");
    if (existing) return this.validate(existing, request);
    const args = { failureMode: await this.failureMode(request), initialResourceVersion: Number(scenario.expectedResourceVersion),
      deploymentUid: scenario.deploymentUid, assetUid: scenario.assetUid, targetRevision: scenario.targetRevision,
      baselineRevision: scenario.failingRevision, rollbackRevision: scenario.rollbackRevision ?? scenario.failingRevision };
    if (!Number.isSafeInteger(args.initialResourceVersion) || args.initialResourceVersion < 0) throw failure("DRIFT_RESOURCE_VERSION_INVALID", 400);
    const key = `initialize-${digest(canonical({ workspaceId: request.workspaceId, incidentId: request.incidentId, traceId: request.traceId })).slice(0, 40)}`;
    const prepared = await this.request(`${route}/actions/initialize`, "POST", { requestId: key, idempotencyKey: key,
      workspaceId: request.workspaceId, incidentId: request.incidentId, traceId: request.traceId, actorId: "openxnet-staging-initializer", arguments: args });
    return this.validate(prepared, request);
  }
}

module.exports = { FeatureDriftPreparation };
