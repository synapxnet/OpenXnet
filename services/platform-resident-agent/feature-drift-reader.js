#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 真实演练只读证据代理 / Read-only evidence proxy for real staging execution.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const fs = require("node:fs/promises");
const SOURCE = "REAL_CPU_SYNTHETIC_STAGING";

/** 创建固定公共错误，不透传上游秘密。 / Create a fixed public error without upstream secrets. */
function failure(code, status = 502) { return Object.assign(new Error("暂时无法读取真实演练记录，请检查权限或稍后重试。"), { code, status }); }
/** 约束标识符，不把任意查询当URL。 / Bound identities without accepting arbitrary URLs. */
function identity(value) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw failure("FEATURE_DRIFT_INVALID_SCOPE", 400); return value; }
/** 屏蔽响应中误反射的凭据。 / Redact accidentally reflected credentials from responses. */
function redact(value, token) {
  if (Array.isArray(value)) return value.map(item => redact(item, token));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token|secret|password|api.?key|authorization/i.test(key) ? "[REDACTED]" : redact(item, token)]));
  return typeof value === "string" ? value.split(token).join("[REDACTED]").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]") : value;
}
/** 建立只读角色客户端，尚未配置时明确不可用。 / Create a read-only role client that stays unavailable when unconfigured. */
async function createFeatureDriftReader(config, dependencies = {}) {
  if (!config.featureDriftUrl) return { async list() { throw failure("FEATURE_DRIFT_NOT_CONFIGURED", 503); }, async detail() { throw failure("FEATURE_DRIFT_NOT_CONFIGURED", 503); } };
  const base = new URL(config.featureDriftUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("Invalid fixed feature-drift endpoint");
  const token = (await fs.readFile(config.featureDriftTokenFile, "utf8")).trim();
  if (token.length < 32 || token.length > 8192 || /[\r\n]/.test(token)) throw new Error("Feature-drift read credential unavailable");
  const request = dependencies.fetch || fetch;
  const allowed = [...new Set(config.workspaceIds.map(identity))];
  /** 检查部署授权空间，不能由浏览器扩大权限。 / Enforce deployed workspace authorization, never browser-supplied permission. */
  function requireWorkspace(workspaceId) { identity(workspaceId); if (!allowed.includes(workspaceId)) throw failure("FEATURE_DRIFT_WORKSPACE_FORBIDDEN", 403); return workspaceId; }
  /** 读取有界JSON并拒绝重定向与跨来源响应。 / Read bounded JSON while refusing redirects and mismatched sources. */
  async function read(endpoint) {
    let response;
    try { response = await request(new URL(endpoint, base), { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", "X-Feature-Drift-Token": token } }); }
    catch { throw failure("FEATURE_DRIFT_UNAVAILABLE", 503); }
    if (!response.ok) throw failure("FEATURE_DRIFT_UPSTREAM_REJECTED", response.status === 404 ? 404 : 502);
    const chunks = []; let length = 0;
    for await (const chunk of response.body || []) { length += chunk.length; if (length > 2 * 1024 * 1024) throw failure("FEATURE_DRIFT_RESPONSE_TOO_LARGE"); chunks.push(chunk); }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw failure("FEATURE_DRIFT_RESPONSE_INVALID"); }
    if (!value?.data || typeof value.data !== "object") throw failure("FEATURE_DRIFT_RESPONSE_INVALID");
    return redact(value.data, token);
  }
  /** 核对每条记录与请求的准确空间/事件。 / Match every record against the exact requested workspace and incident. */
  function verify(item, workspaceId, incidentId) {
    if (!item || item.workspaceId !== workspaceId || item.sourceMode !== SOURCE || (incidentId && item.incidentId !== incidentId)) throw failure("FEATURE_DRIFT_SCOPE_MISMATCH");
    identity(item.incidentId); return item;
  }
  /** 仅聚合授权空间内的现有记录，不初始化事件。 / Aggregate existing records only from authorized workspaces without initialization. */
  async function list(workspaceId) {
    const spaces = workspaceId ? [requireWorkspace(workspaceId)] : allowed;
    const results = await Promise.all(spaces.map(async space => {
      const data = await read(`/v1/incidents?workspaceId=${encodeURIComponent(space)}`);
      if (!Array.isArray(data.items) || data.items.length > 1000) throw failure("FEATURE_DRIFT_RESPONSE_INVALID");
      return data.items.map(item => verify(item, space));
    }));
    const items = results.flat().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return { items, total: items.length, sourceMode: SOURCE, platform: config.platform, workspaceIds: spaces };
  }
  /** 回读一个已授权事件的完整真实执行证据。 / Read complete real execution evidence for one authorized incident. */
  async function detail(workspaceId, incidentId) {
    requireWorkspace(workspaceId); identity(incidentId);
    return verify(await read(`/v1/incidents/${encodeURIComponent(incidentId)}?workspaceId=${encodeURIComponent(workspaceId)}`), workspaceId, incidentId);
  }
  return { list, detail };
}
module.exports = { createFeatureDriftReader };
