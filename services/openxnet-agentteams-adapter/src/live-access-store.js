#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Live 范围授权与持久审计 / Scoped Live grants and persistent audit.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { AccessGrantStore } = require("./access-grant-store");
const { PublicError } = require("./contracts");
const catalog = require("./live-tool-catalog");
const LIVE_CODE_PATTERN = /^oxlive_[a-f0-9]{64}$/u;
const SCHEMA = "openxnet.agentteams.live-access.v1";
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const RESOURCE_FIELDS = new Set(["alertId", "alertUid", "serviceUid", "clusterId", "namespace", "name", "nodePool", "reportUid", "assetUid", "instanceUid", "workflowInstanceUid", "datasetUid", "outputDatasetUid", "deploymentUid", "testDatasetRef", "datasetRef", "pipelineUid", "experimentUid", "modelCardUid", "featureSetUid", "targetRevision"]);

/** 返回固定公开错误，不回显授权内容。 / Return a fixed public error without echoing credentials. */
function reject(code, status = 403) { throw new PublicError(status, code, "Live access is unavailable for this request."); }

/** 规范序列化，保留数组顺序并排序对象键。 / Canonicalize with ordered arrays and sorted object keys. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(/** 规范对象键。 / Canonicalize an object key. */ key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** 生成凭据或请求不可逆摘要。 / Hash a credential or request irreversibly. */
function digest(value) { return createHash("sha256").update(value).digest("hex"); }

/** 读取有界稳定标识。 / Read a bounded stable identifier. */
function identifier(value) { if (typeof value !== "string" || !ID.test(value)) reject("LIVE_INVALID_REQUEST", 400); return value; }

/** 校验非空去重列表。 / Validate a nonempty distinct list. */
function list(value, maximum = 64) {
  if (!Array.isArray(value) || !value.length || value.length > maximum || new Set(value).size !== value.length) reject("LIVE_INVALID_REQUEST", 400);
  return value.map(identifier);
}

/** 读取严格 JSON 对象。 / Read an exact JSON object. */
function exact(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) reject("LIVE_INVALID_REQUEST", 400);
  return value;
}

/** 解析服务检查请求，不允许客户端指定上游。 / Parse a readiness request without client-selected upstreams. */
function parseLiveAccessRequest(value) { exact(value, ["workspaceId"]); return { workspaceId: identifier(value.workspaceId) }; }

/** 复用原子文件事务，独立保管 Live 授权和执行账本。 / Reuse atomic transactions for an independent Live grant ledger. */
class LiveAccessGrantStore extends AccessGrantStore {
  /** 解析独立 Live 凭证并校验生命周期。 / Resolve an independent Live credential and its lifetime. */
  authorized(document, code) {
    if (typeof code !== "string" || !LIVE_CODE_PATTERN.test(code)) reject("LIVE_ACCESS_INVALID", 401);
    const grant = document.grants.find(/** 仅通过摘要寻找授权。 / Resolve a grant by its digest only. */ item => item.kind === "live" && item.tokenDigest === digest(code));
    if (!grant) reject("LIVE_ACCESS_INVALID", 401);
    if (grant.revokedAt) reject("LIVE_ACCESS_REVOKED");
    if (!Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= this.now().getTime()) reject("LIVE_ACCESS_EXPIRED");
    return grant;
  }

  /** 返回可公开范围，不返回平台或审批凭证。 / Project public scope without platform or approval credentials. */
  project(grant) {
    return { schema: SCHEMA, grantId: grant.id, label: grant.label, workspaceId: grant.workspaceId,
      expiresAt: grant.expiresAt, remainingRequests: Math.max(0, grant.maximumRequests - Object.keys(grant.requests).length),
      modes: ["live"], allowedTools: [...grant.allowedTools], allowedScenarios: [...grant.allowedScenarios], requiredTeamRuntime: "agentteams" };
  }

  /** 管理员显式签发精确资源、角色和工作空间授权。 / Issue explicit administrator-selected resource, role and workspace scope. */
  issue(value) {
    exact(value, ["label", "workspaceId", "expiresInSeconds", "maximumRequests", "actorIds", "approverIds", "allowedTools", "allowedScenarios", "resourceConstraints"]);
    if (typeof value.label !== "string" || !value.label.trim() || value.label.length > 120 || /[\u0000-\u001f]/u.test(value.label)) reject("LIVE_INVALID_REQUEST", 400);
    const workspaceId = identifier(value.workspaceId);
    const actorIds = list(value.actorIds), approverIds = list(value.approverIds, 16), allowedTools = list(value.allowedTools), allowedScenarios = list(value.allowedScenarios, 3);
    if (actorIds.some(/** 审批人与执行身份必须分离。 / Separate approval and execution identities. */ actor => approverIds.includes(actor))
      || allowedTools.some(/** 只接受固定目录。 / Accept only fixed catalogue entries. */ name => !catalog.some(tool => tool.name === name))
      || allowedScenarios.some(/** 场景不能由模型扩展。 / Models cannot expand scenarios. */ name => !["feature-drift", "recommendation-capacity", "quantitative-iteration"].includes(name))) reject("LIVE_INVALID_REQUEST", 400);
    if (!Number.isInteger(value.expiresInSeconds) || value.expiresInSeconds < 60 || value.expiresInSeconds > 7 * 86400
      || !Number.isInteger(value.maximumRequests) || value.maximumRequests < 1 || value.maximumRequests > 2000) reject("LIVE_INVALID_REQUEST", 400);
    const constraints = value.resourceConstraints;
    if (!constraints || typeof constraints !== "object" || Array.isArray(constraints) || !Object.keys(constraints).length || Object.keys(constraints).some(/** 仅允许固定资源字段。 / Allow only fixed resource fields. */ key => !RESOURCE_FIELDS.has(key))) reject("LIVE_INVALID_REQUEST", 400);
    for (const values of Object.values(constraints)) if (!Array.isArray(values) || !values.length || values.length > 64 || new Set(values).size !== values.length || values.some(/** 拒绝通配资源和控制字符。 / Reject wildcard resources and control characters. */ item => typeof item !== "string" || !item || item.length > 512 || /[\u0000-\u001f*]/u.test(item))) reject("LIVE_INVALID_REQUEST", 400);
    return this.transaction(/** 在原子事务中保存摘要和限定范围。 / Persist the digest and bounded scope atomically. */ document => {
      const accessCode = `oxlive_${randomBytes(32).toString("hex")}`;
      const grant = { kind: "live", id: `live_${randomUUID()}`, tokenDigest: digest(accessCode), label: value.label.trim(), workspaceId,
        actorIds, approverIds, allowedTools, allowedScenarios, resourceConstraints: JSON.parse(JSON.stringify(constraints)),
        expiresAt: new Date(this.now().getTime() + value.expiresInSeconds * 1000).toISOString(), maximumRequests: value.maximumRequests,
        connectedAt: null, revokedAt: null, requests: {}, runs: {}, approvals: {}, actions: {}, idempotency: {} };
      document.grants.push(grant);
      return { write: true, value: { ...this.project(grant), accessCode } };
    });
  }

  /** 只在绑定工作空间内检查或启用授权。 / Inspect or activate only inside the pre-bound workspace. */
  inspect(code, workspaceId, connect = false) {
    identifier(workspaceId);
    return this.transaction(/** 检查不会隐式绑定新空间。 / A check never binds a different workspace. */ document => {
      const grant = this.authorized(document, code);
      if (grant.workspaceId !== workspaceId) reject("LIVE_WORKSPACE_MISMATCH");
      const changed = connect && !grant.connectedAt;
      if (changed) grant.connectedAt = this.now().toISOString();
      return { write: changed, value: this.project(grant) };
    });
  }

  /** 校验已激活授权与当前请求归属。 / Validate activation and request ownership. */
  scope(grant, request) {
    if (!grant.connectedAt) reject("LIVE_NOT_CONNECTED");
    if (request.workspaceId !== grant.workspaceId) reject("LIVE_WORKSPACE_MISMATCH");
    for (const key of ["incidentId", "traceId"]) identifier(request[key]);
  }

  /** 验证准备过的事件、Trace 与成员绑定。 / Validate a prepared incident, trace and member binding. */
  run(grant, request) {
    const run = grant.runs[request.traceId];
    if (!run || run.incidentId !== request.incidentId) reject("LIVE_RUN_NOT_PREPARED");
    return run;
  }

  /** 精确验证所有资源参数，禁止同工具访问另一资源。 / Validate every resource argument to prevent cross-resource calls. */
  resources(grant, args) {
    const keys = Object.keys(args).filter(/** 识别工具领域资源参数。 / Identify domain resource arguments. */ key => RESOURCE_FIELDS.has(key));
    if (!keys.length || keys.some(/** 全部资源必须位于显式白名单。 / Every resource must belong to its explicit allowlist. */ key => !grant.resourceConstraints[key]?.includes(String(args[key])))) reject("LIVE_RESOURCE_FORBIDDEN");
  }

  /** 校验一次工具调用与已发布审批，不替代平台内省。 / Validate a tool call and published approval without replacing platform introspection. */
  authorizeTool(grant, request, tool) {
    this.scope(grant, request);
    const run = this.run(grant, request);
    if (!run.scenario || !grant.allowedScenarios.includes(run.scenario)) reject("LIVE_SCENARIO_FORBIDDEN");
    if (!grant.actorIds.includes(request.actorId)) reject("LIVE_ACTOR_FORBIDDEN");
    if (!grant.allowedTools.includes(tool.name)) reject("LIVE_TOOL_FORBIDDEN");
    this.resources(grant, request.arguments);
    if (!tool.requiresApproval) {
      if (request.governance !== null) reject("LIVE_INVALID_REQUEST", 400);
      return;
    }
    const governance = request.governance;
    const approval = governance && grant.approvals[governance.approvalId];
    if (!approval || Date.parse(approval.expiresAt) <= this.now().getTime()) reject("LIVE_APPROVAL_REQUIRED");
    if (approval.workspaceId !== request.workspaceId || approval.incidentId !== request.incidentId || approval.traceId !== request.traceId
      || approval.approverId === request.actorId || approval.requesterId === request.actorId || approval.planId !== governance.planId || approval.planDigest !== governance.planDigest) reject("LIVE_APPROVAL_SCOPE_MISMATCH");
    if (digest(canonical(request.arguments)) !== governance.argumentsDigest) reject("LIVE_ARGUMENTS_DIGEST_MISMATCH");
    const scope = approval.scopes.find(/** 精确匹配补偿及正常步骤。 / Match normal and compensation steps exactly. */ item => item.stepId === governance.stepId);
    if (!scope || ["resourceId", "targetRevision", "expectedResourceVersion", "argumentsDigest", "compensation"].some(/** 禁止篡改已审批步骤。 / Reject changed approved steps. */ key => scope[key] !== governance[key]) || scope.toolName !== tool.name) reject("LIVE_APPROVAL_SCOPE_MISMATCH");
  }

  /** 幂等执行持久请求；中断后不盲目重放写入。 / Execute a durable idempotent request without blindly replaying interrupted writes. */
  async execute(code, operationName, request, authorize, operation, commit) {
    const requestId = identifier(request.requestId ?? request.approvalId);
    const requestKey = `${operationName}:${requestId}`;
    const requestDigest = digest(canonical({ operationName, request }));
    const reservation = await this.transaction(/** 先校验授权再写入操作预留。 / Authorize before recording an operation reservation. */ document => {
      const grant = this.authorized(document, code);
      this.scope(grant, request);
      authorize(grant);
      const previous = grant.requests[requestKey];
      if (previous && previous.digest !== requestDigest) reject("LIVE_REQUEST_CONFLICT", 409);
      if (previous?.status === "COMPLETED" || previous?.status === "FAILED") return { write: false, value: { cached: previous } };
      if (previous?.status === "PENDING") reject(this.active.has(`${grant.id}:${requestKey}`) ? "LIVE_REQUEST_BUSY" : "LIVE_REQUEST_INTERRUPTED", 409);
      if (!previous && Object.keys(grant.requests).length >= grant.maximumRequests) reject("LIVE_QUOTA_EXHAUSTED", 429);
      if (operationName === "invoke") {
        const key = `${request.toolName}:${request.governance?.idempotencyKey || requestId}`;
        if (grant.idempotency[key] && grant.idempotency[key] !== requestDigest) reject("LIVE_REQUEST_CONFLICT", 409);
        grant.idempotency[key] = requestDigest;
      }
      grant.requests[requestKey] = { digest: requestDigest, status: "PENDING", traceId: request.traceId, incidentId: request.incidentId, createdAt: this.now().toISOString() };
      return { write: true, value: { grantId: grant.id } };
    });
    if (reservation.cached) {
      if (reservation.cached.status === "FAILED") reject(reservation.cached.error.code, reservation.cached.error.status);
      return reservation.cached.result;
    }
    const activeKey = `${reservation.grantId}:${requestKey}`;
    this.active.add(activeKey);
    try {
      let result, failure;
      try { result = await operation(reservation.grantId); }
      catch (error) { failure = error instanceof PublicError ? error : new PublicError(502, "LIVE_UPSTREAM_UNAVAILABLE", "Live upstream is unavailable."); }
      await this.transaction(/** 回执与关联审计同时持久化。 / Persist receipts and linked audit records together. */ document => {
        const grant = document.grants.find(/** 选择本次预留授权。 / Select this reservation's grant. */ item => item.id === reservation.grantId);
        const entry = grant.requests[requestKey];
        if (failure) Object.assign(entry, { status: operationName === "prepare" && failure.code === "AGENTTEAMS_TEAM_NOT_READY" ? "RETRYABLE" : "FAILED", error: { status: failure.status, code: failure.code } });
        else {
          if (commit) commit(grant, result);
          delete entry.error;
          Object.assign(entry, { status: "COMPLETED", result });
        }
        entry.completedAt = this.now().toISOString();
        return { write: true };
      });
      if (failure) throw failure;
      return result;
    } finally { this.active.delete(activeKey); }
  }

  /** 不缓存异步轮询，仍然每次校验授权和动作归属。 / Poll uncached actions while rechecking grant and action ownership each time. */
  async readAction(code, request, actionId, operation) {
    await this.transaction(/** 动作只能来自本授权、本次运行回执。 / Actions must originate from this grant and run receipt. */ document => {
      const grant = this.authorized(document, code);
      this.scope(grant, request);
      const action = grant.actions[actionId];
      if (!action || action.workspaceId !== request.workspaceId || action.incidentId !== request.incidentId || action.traceId !== request.traceId || action.toolName !== request.toolName || action.actorId !== request.actorId || action.requestDigest !== digest(canonical(request))) reject("LIVE_ACTION_FORBIDDEN");
      return { write: false };
    });
    return operation();
  }
}

module.exports = { LiveAccessGrantStore, LIVE_CODE_PATTERN, SCHEMA, RESOURCE_FIELDS, parseLiveAccessRequest, exact, identifier, canonical, digest, reject };
