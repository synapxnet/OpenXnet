#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 演示访问码的持久化授权与请求账本 / Persistent demo access grants and request ledger.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";

const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { PublicError } = require("./contracts");
const SCHEMA = "openxnet.agentteams.access.v1";
const CODE_PATTERN = /^oxdemo_[a-f0-9]{64}$/u;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/** 仅产生固定公开错误；不回显访问码。 / Produce fixed public errors without echoing access codes. */
function fail(status, code) { throw new PublicError(status, code, "AgentTeams demo access is unavailable for this request."); }

/** 稳定序列化请求以阻断修改后的重试。 / Canonically serialize requests to reject changed retries. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(/** 按键排序，不保留原始请求。 / Sort keys without retaining the original request. */ key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** 对凭据或请求生成不可逆摘要。 / Hash a credential or request irreversibly. */
function digest(value) { return createHash("sha256").update(value, "utf8").digest("hex"); }

/** 校验工作空间标识。 / Validate a workspace identifier. */
function workspace(value) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) fail(400, "ACCESS_INVALID_REQUEST");
  return value;
}

/** 校验连接请求恰好只包含工作空间。 / Accept exactly a workspace connection request. */
function parseAccessRequest(value, allowUnbound = false) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "workspaceId")) fail(400, "ACCESS_INVALID_REQUEST");
  return { workspaceId: allowUnbound && value.workspaceId === null ? null : workspace(value.workspaceId) };
}

/** 单个 Adapter 进程独占文件，通过串行原子替换实现授权事务。 / One adapter process owns this file and serializes atomic grant transactions. */
class AccessGrantStore {
  /** 初始化账本目录；不提前读取或签发凭据。 / Initialize the ledger without reading or issuing credentials. */
  constructor(filename, options = {}) {
    this.filename = path.resolve(filename);
    this.now = options.now || (() => new Date());
    this.queue = Promise.resolve();
    this.active = new Set();
  }

  /** 串行读取、修改并原子保存账本。 / Serialize reading, modification, and atomic ledger persistence. */
  transaction(operation) {
    const execute = async () => {
      let document;
      try { document = JSON.parse(await readFile(this.filename, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; document = { schema: "openxnet.agentteams.access-store.v1", grants: [] }; }
      if (document.schema !== "openxnet.agentteams.access-store.v1" || !Array.isArray(document.grants)) throw new Error("Access grant storage is invalid.");
      const result = await operation(document);
      if (result.write) {
        await mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
        const temporary = `${this.filename}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, `${JSON.stringify(document)}\n`, { flag: "wx", mode: 0o600 });
          await rename(temporary, this.filename);
        } finally { await rm(temporary, { force: true }); }
      }
      return result.value;
    };
    const result = this.queue.then(execute, execute);
    this.queue = result.then(/** 防止失败污染后续事务。 / Keep later transactions available after a failure. */ () => undefined, () => undefined);
    return result;
  }

  /** 解析访问码并校验撤销与到期。 / Resolve a code and enforce revocation and expiration. */
  authorized(document, code) {
    if (typeof code !== "string" || !CODE_PATTERN.test(code)) fail(401, "ACCESS_INVALID");
    const grant = document.grants.find(/** 摘要匹配不存储明文码。 / Match digests without storing plaintext codes. */ item => item.tokenDigest === digest(code));
    if (!grant) fail(401, "ACCESS_INVALID");
    if (grant.revokedAt) fail(403, "ACCESS_REVOKED");
    if (Date.parse(grant.expiresAt) <= this.now().getTime()) fail(403, "ACCESS_EXPIRED");
    return grant;
  }

  /** 投影可返回给桌面的非敏感授权范围。 / Project public authorization metadata for the desktop. */
  project(grant, workspaceId, serviceReady) {
    return { schema: SCHEMA, grantId: grant.id, label: grant.label, workspaceId: grant.workspaceId || workspaceId || null,
      expiresAt: grant.expiresAt, remainingRequests: Math.max(0, grant.maximumRequests - Object.keys(grant.requests).length),
      modes: ["fixture"], serviceReady: serviceReady === true };
  }

  /** 运维签发最多七天且有配额的访问码；只返回一次原码。 / Issue a quota-limited grant for at most seven days and return its code once. */
  issue(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(/** 拒绝未知管理字段。 / Reject unknown management fields. */ key => !["label", "workspaceId", "expiresInSeconds", "maximumRequests"].includes(key))) fail(400, "ACCESS_INVALID_REQUEST");
    if (typeof value.label !== "string" || !value.label.trim() || value.label.length > 120 || /[\u0000-\u001f]/u.test(value.label)) fail(400, "ACCESS_INVALID_REQUEST");
    const ttl = value.expiresInSeconds ?? 86400;
    const limit = value.maximumRequests ?? 40;
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 7 * 86400 || !Number.isInteger(limit) || limit < 1 || limit > 200) fail(400, "ACCESS_INVALID_REQUEST");
    const workspaceId = value.workspaceId == null || value.workspaceId === "" ? null : workspace(value.workspaceId);
    return this.transaction(/** 在一个事务中生成并持久化摘要。 / Generate and persist the digest in one transaction. */ document => {
      const accessCode = `oxdemo_${randomBytes(32).toString("hex")}`;
      const grant = { id: `grant_${randomUUID()}`, tokenDigest: digest(accessCode), label: value.label.trim(), workspaceId,
        expiresAt: new Date(this.now().getTime() + ttl * 1000).toISOString(), maximumRequests: limit, requests: {}, revokedAt: null };
      document.grants.push(grant);
      return { write: true, value: { ...this.project(grant, "", false), accessCode } };
    });
  }

  /** 撤销授权；不删除请求审计账本。 / Revoke a grant without deleting its request ledger. */
  revoke(id) {
    return this.transaction(/** 原子更新撤销标记。 / Atomically mark a grant revoked. */ document => {
      const grant = document.grants.find(item => item.id === id);
      if (!grant) fail(404, "ACCESS_NOT_FOUND");
      grant.revokedAt = this.now().toISOString();
      return { write: true, value: { schema: SCHEMA, grantId: grant.id, revoked: true } };
    });
  }

  /** 检查不绑定；连接时原子绑定首次工作空间。 / Checks never bind; connecting atomically binds the first workspace. */
  inspect(code, workspaceId, connect, serviceReady) {
    if (connect || workspaceId !== null) workspace(workspaceId);
    return this.transaction(/** 在同一事务内校验并可选绑定。 / Validate and optionally bind in one transaction. */ document => {
      const grant = this.authorized(document, code);
      if (workspaceId && grant.workspaceId && grant.workspaceId !== workspaceId) fail(403, "ACCESS_WORKSPACE_MISMATCH");
      const bind = connect && !grant.workspaceId;
      if (bind) grant.workspaceId = workspaceId;
      return { write: bind, value: this.project(grant, workspaceId, serviceReady) };
    });
  }

  /** 校验演练边界并预留幂等请求，所有权限验证先于业务执行。 / Enforce fixture boundaries and reserve an idempotent request before execution. */
  async execute(code, mode, operationName, request, operation) {
    if (mode !== "fixture") fail(403, "ACCESS_MODE_FORBIDDEN");
    if (operationName === "dispatch") {
      const contexts = request.context.residentContexts;
      if (!Array.isArray(contexts) || contexts.length !== 3 || new Set(contexts.map(item => item.platform)).size !== 3
        || contexts.some(item => item.environment !== "staging" || !["SIMULATION", "REPLAY"].includes(item.source))) fail(403, "ACCESS_MODE_FORBIDDEN");
    }
    const requestDigest = digest(canonical({ operationName, request }));
    const reservation = await this.transaction(/** 先持久化请求摘要和扣费，阻止并发或重放篡改。 / Persist the digest and quota reservation before rejecting concurrent or changed replays. */ document => {
      const grant = this.authorized(document, code);
      if (!grant.workspaceId) fail(403, "ACCESS_NOT_CONNECTED");
      if (grant.workspaceId !== request.workspaceId) fail(403, "ACCESS_WORKSPACE_MISMATCH");
      const entry = Object.hasOwn(grant.requests, request.requestId) ? grant.requests[request.requestId] : null;
      if (entry && entry.digest !== requestDigest) fail(409, "ACCESS_REQUEST_CONFLICT");
      if (entry?.status === "COMPLETED" || entry?.status === "FAILED") return { write: false, value: { cached: entry } };
      if (entry && entry.status !== "RETRYABLE") fail(409, this.active.has(grant.id) ? "ACCESS_REQUEST_BUSY" : "ACCESS_REQUEST_INTERRUPTED");
      if (this.active.has(grant.id)) fail(409, "ACCESS_REQUEST_BUSY");
      if (Object.values(grant.requests).some(item => item.status === "PENDING")) fail(409, "ACCESS_REQUEST_INTERRUPTED");
      if (!entry && Object.keys(grant.requests).length >= grant.maximumRequests) fail(429, "ACCESS_QUOTA_EXHAUSTED");
      grant.requests[request.requestId] = { digest: requestDigest, status: "PENDING", createdAt: this.now().toISOString() };
      return { write: true, value: { grantId: grant.id } };
    });
    if (reservation.cached) {
      if (reservation.cached.status === "FAILED") throw new PublicError(reservation.cached.error.status, reservation.cached.error.code, reservation.cached.error.message);
      return reservation.cached.result;
    }
    this.active.add(reservation.grantId);
    try {
      let result;
      let failure;
      try { result = await operation(reservation.grantId); }
      catch (error) { failure = error instanceof PublicError ? error : new PublicError(500, "INTERNAL_ERROR", "AgentTeams adapter request failed."); }
      await this.transaction(/** 持久化结果后才回应，重试不会再次执行或扣费。 / Persist completion before replying so retries neither execute nor charge again. */ document => {
        const grant = document.grants.find(item => item.id === reservation.grantId);
        const entry = grant.requests[request.requestId];
        if (failure) Object.assign(entry, { status: operationName === "prepare" && failure.code === "AGENTTEAMS_TEAM_NOT_READY" ? "RETRYABLE" : "FAILED", error: { status: failure.status, code: failure.code, message: failure.message } });
        else Object.assign(entry, { status: "COMPLETED", result });
        return { write: true };
      });
      if (failure) throw failure;
      return result;
    } finally { this.active.delete(reservation.grantId); }
  }
}

module.exports = { AccessGrantStore, parseAccessRequest, CODE_PATTERN };
