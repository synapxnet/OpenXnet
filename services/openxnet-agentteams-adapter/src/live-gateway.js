#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 服务端 Live 工具与审批网关 / Server-side Live tool and approval gateway.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const { createHmac } = require("node:crypto");
const { PublicError } = require("./contracts");
const { teamName } = require("./agentteams-cli");
const { canonical, digest, exact, identifier, reject } = require("./live-access-store");
const catalog = require("./live-tool-catalog");
const PLATFORMS = ["aiops", "dataops", "mlops"];
const GOVERNANCE_FIELDS = ["approvalId", "planId", "planDigest", "stepId", "resourceId", "targetRevision", "expectedResourceVersion", "argumentsDigest", "compensation", "reason", "dryRun", "idempotencyKey"];
const SCOPE_FIELDS = ["stepId", "toolName", "resourceId", "targetRevision", "expectedResourceVersion", "argumentsDigest", "compensation"];

/** 按固定目录查工具，不接受外部URL或路径。 / Resolve a fixed tool without accepting external URLs or paths. */
function descriptor(name) { const tool = catalog.find(/** 比较固定工具名。 / Compare a fixed tool name. */ item => item.name === name); if (!tool) reject("LIVE_TOOL_FORBIDDEN"); return tool; }

/** 校验有界业务文本。 / Validate bounded business text. */
function plain(value, maximum = 512) { if (typeof value !== "string" || !value || value.length > maximum || /[\u0000-\u001f]/u.test(value)) reject("LIVE_INVALID_REQUEST", 400); return value; }

/** 清除上游可能反射的令牌、凭据字段和Bearer文本。 / Remove reflected upstream tokens, credential fields and Bearer text. */
function redactUpstream(value, depth = 0) {
  if (depth > 40) reject("LIVE_UPSTREAM_INVALID", 502);
  if (Array.isArray(value)) return value.map(/** 对数组内每项同样脱敏。 / Apply the same redaction to each array entry. */ item => redactUpstream(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(/** 凭据字段不参与对外响应。 / Exclude credential fields from public responses. */ ([key, item]) => [key, /authorization|password|secret|api.?key|access.?token|refresh.?token|delegation.?token|access.?code/iu.test(key) ? "[REDACTED]" : redactUpstream(item, depth + 1)]));
  if (typeof value !== "string") return value;
  return value.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/giu, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[REDACTED]")
    .replace(/\box(?:live|demo)_[a-f0-9]{64}\b/gu, "[REDACTED]");
}

/** 检查目录中的 JSON Schema 子集。 / Check the JSON Schema subset used by the fixed catalogue. */
function schemaValue(schema, value) {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) reject("LIVE_INVALID_REQUEST", 400);
    if (schema.additionalProperties === false && Object.keys(value).some(/** 拒绝未注册参数。 / Reject unregistered arguments. */ key => !Object.hasOwn(schema.properties || {}, key))) reject("LIVE_INVALID_REQUEST", 400);
    if ((schema.required || []).some(/** 检查必需参数。 / Check required arguments. */ key => !Object.hasOwn(value, key))) reject("LIVE_INVALID_REQUEST", 400);
    if (schema.oneOf && schema.oneOf.filter(/** 检查互斥参数组。 / Check exclusive argument groups. */ alternative => (alternative.required || []).every(key => Object.hasOwn(value, key))).length !== 1) reject("LIVE_INVALID_REQUEST", 400);
    for (const [key, field] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) schemaValue(field, value[key]);
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > (schema.maxItems || 64)) reject("LIVE_INVALID_REQUEST", 400);
    for (const item of value) schemaValue(schema.items || {}, item);
  } else if (schema.type === "string") {
    if (typeof value !== "string" || value.length < (schema.minLength || 0) || value.length > (schema.maxLength || 2048) || value.includes("\0")) reject("LIVE_INVALID_REQUEST", 400);
  } else if (schema.type === "integer" || schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || schema.type === "integer" && !Number.isInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) reject("LIVE_INVALID_REQUEST", 400);
  } else if (schema.type === "boolean" && typeof value !== "boolean") reject("LIVE_INVALID_REQUEST", 400);
  if (schema.enum && !schema.enum.includes(value)) reject("LIVE_INVALID_REQUEST", 400);
}

/** 验证一个已批准的步骤结构。 / Validate an approved step shape. */
function scopeShape(value) {
  exact(value, SCOPE_FIELDS);
  for (const key of ["stepId", "toolName"]) identifier(value[key]);
  for (const key of ["resourceId", "expectedResourceVersion"]) plain(value[key]);
  if (!Number.isSafeInteger(value.targetRevision) || value.targetRevision < 1 || !/^[a-f0-9]{64}$/u.test(value.argumentsDigest) || typeof value.compensation !== "boolean") reject("LIVE_INVALID_REQUEST", 400);
}

/** 验证原始桌面工具请求，拒绝额外透传字段。 / Validate the desktop tool request and reject additional forwarded fields. */
function parseToolRequest(value) {
  exact(value, ["requestId", "workspaceId", "incidentId", "traceId", "actorId", "toolName", "arguments", "governance"]);
  for (const key of ["requestId", "workspaceId", "incidentId", "traceId", "actorId", "toolName"]) identifier(value[key]);
  const tool = descriptor(value.toolName);
  schemaValue(tool.inputSchema, value.arguments);
  if (Buffer.byteLength(JSON.stringify(value.arguments)) > 65536) reject("LIVE_INVALID_REQUEST", 400);
  if (tool.requiresApproval) {
    exact(value.governance, GOVERNANCE_FIELDS);
    for (const key of ["approvalId", "planId", "stepId", "idempotencyKey"]) identifier(value.governance[key]);
    for (const key of ["planDigest", "argumentsDigest"]) if (!/^[a-f0-9]{64}$/u.test(value.governance[key])) reject("LIVE_INVALID_REQUEST", 400);
    for (const key of ["resourceId", "expectedResourceVersion", "reason"]) plain(value.governance[key], key === "reason" ? 4096 : 512);
    if (!Number.isSafeInteger(value.governance.targetRevision) || value.governance.targetRevision < 1 || typeof value.governance.compensation !== "boolean" || typeof value.governance.dryRun !== "boolean") reject("LIVE_INVALID_REQUEST", 400);
  } else if (value.governance !== null) reject("LIVE_INVALID_REQUEST", 400);
  return value;
}

/** 将已冻结计划转换为真正需要审批的步骤。 / Project a frozen plan into its approval-requiring steps. */
function planScopes(plan) {
  return [...plan.steps.map(/** 标识正常步骤。 / Mark normal steps. */ step => ({ step, compensation: false })),
    ...plan.compensationSteps.map(/** 标识补偿步骤。 / Mark compensation steps. */ step => ({ step, compensation: true }))]
    .filter(/** 只匹配真正需要审批的写操作。 / Match only writes that require approval. */ item => descriptor(item.step.toolName).requiresApproval)
    .map(/** 删除依赖字段，保留精确审批范围。 / Remove dependencies while preserving exact approval scope. */ ({ step, compensation }) => {
      const { dependsOn: _dependsOn, ...scope } = step;
      return { ...scope, compensation };
    });
}

/** 服务端固定地址验证；仅显式部署开关允许内网HTTP。 / Validate fixed server endpoints; permit internal HTTP only through a deployment switch. */
function endpoint(value, allowHttp = false) {
  if (!value) return null;
  let url;
  try { url = new URL(String(value).trim().replace(/\/?$/u, "/")); } catch { return null; }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && !loopback && !allowHttp) return null;
  return url;
}

/** 固定网关拥有上游密钥，客户端只持有范围凭证。 / A fixed gateway owns upstream secrets while clients hold only scoped credentials. */
class LiveGateway {
  /** 绑定授权账本、固定服务器配置和可注入网络。 / Bind the grant ledger, fixed server configuration and injectable transport. */
  constructor(options) {
    this.store = options.store;
    this.platforms = options.platforms;
    this.approval = options.approval;
    this.fetch = options.fetch || fetch;
    this.now = options.now || (() => new Date());
    this.allowHttp = options.allowHttp === true;
  }

  /** 有界读取响应，不跟随重定向也不泄漏上游错误体。 / Read bounded responses without redirects or leaked upstream error bodies. */
  async fetchText(url, options = {}, timeoutMs = 5000, maximum = 2 * 1024 * 1024) {
    const controller = new AbortController();
    const timer = setTimeout(/** 超时取消单个上游请求。 / Cancel this upstream request on timeout. */ () => controller.abort(), timeoutMs);
    try {
      const response = await this.fetch(url, { ...options, redirect: "manual", signal: controller.signal });
      if (response.status >= 300 && response.status < 400) reject("LIVE_UPSTREAM_REDIRECT", 502);
      if (!response.ok) reject("LIVE_UPSTREAM_REJECTED", 502);
      const chunks = [];
      let total = 0;
      for await (const chunk of response.body || []) {
        total += chunk.length;
        if (total > maximum) { controller.abort(); reject("LIVE_UPSTREAM_TOO_LARGE", 502); }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString("utf8");
    } catch (error) {
      if (error instanceof PublicError) throw error;
      reject("LIVE_UPSTREAM_UNAVAILABLE", 502);
    } finally { clearTimeout(timer); }
  }

  /** 请求有界 JSON，并屏蔽部署凭据。 / Request bounded JSON while protecting deployment credentials. */
  async fetchJson(url, options, timeoutMs, maximum) {
    const text = await this.fetchText(url, options, timeoutMs, maximum);
    const secrets = [...PLATFORMS.flatMap(/** 收集仅服务端存在的脱敏值。 / Gather server-only values for redaction. */ key => [this.platforms[key]?.secret, this.platforms[key]?.token]), this.approval?.token].filter(/** 忽略空配置。 / Ignore empty settings. */ value => typeof value === "string" && value.length >= 16);
    let clean = text;
    for (const secret of secrets) clean = clean.split(secret).join("[REDACTED]");
    try { return redactUpstream(JSON.parse(clean)); } catch { reject("LIVE_UPSTREAM_INVALID", 502); }
  }

  /** 只读检查平台标识与服务配置，绝不触发业务工具。 / Read platform identity and service configuration without invoking business tools. */
  async readiness(collaborationReady) {
    const platforms = await Promise.all(PLATFORMS.map(/** 分平台检查固定身份与凭据配置。 / Check fixed identity and credential configuration per platform. */ async platform => {
      const config = this.platforms[platform] || {};
      const base = endpoint(config.baseUrl, this.allowHttp);
      const identityUrl = endpoint(config.identityUrl || config.baseUrl, this.allowHttp);
      if (identityUrl && config.identityUrl) identityUrl.pathname = new URL(config.identityUrl).pathname;
      const configured = Boolean(base && identityUrl && (config.secret?.length >= 32 || config.token?.length >= 32));
      let reachable = false, identityMatched = false;
      if (configured) {
        try {
          const text = await this.fetchText(identityUrl, {}, 4000, 128 * 1024);
          reachable = true;
          let actual;
          try { const json = JSON.parse(text); actual = (json.data || json).platform; } catch {
            actual = /^Xnet(AIOps|DataOps|MLOps)(?:\s*(?:[-|·]|—).*)?$/iu.exec(/<title(?:\s[^>]*)?>([^<]*)<\/title>/iu.exec(text)?.[1]?.trim() || "")?.[1]?.toLowerCase();
          }
          identityMatched = actual === platform;
        } catch { /* 缺失身份保持未就绪。 / Missing identity stays not ready. */ }
      }
      return { platform, configured, reachable, identityMatched };
    }));
    let approvalReady = false;
    const approvalBase = endpoint(this.approval?.baseUrl, this.allowHttp);
    if (approvalBase && this.approval?.token?.length >= 32) {
      try {
        const health = await this.fetchJson(new URL("health", approvalBase), {}, 4000, 65536);
        approvalReady = ["ok", "healthy", "alive", "up"].includes(String((health.data || health).status).toLowerCase());
      } catch { /* 失败保持未就绪，不回传上游异常。 / Keep failures not ready without exposing upstream errors. */ }
    }
    const checks = [...platforms.map(/** 清楚区分未配置、不可达与身份不符。 / Distinguish missing configuration, unreachable endpoints and mismatched identity. */ item => ({ id: item.platform, label: `Xnet${item.platform === "aiops" ? "AIOps" : item.platform === "dataops" ? "DataOps" : "MLOps"} 服务与受限凭据`, ready: item.identityMatched,
      code: !item.configured ? "NOT_CONFIGURED" : !item.reachable ? "UNREACHABLE" : !item.identityMatched ? "IDENTITY_MISMATCH" : "CONFIGURED_IDENTITY_MATCHED" })),
      { id: "approval", label: "人工审批发布服务", ready: approvalReady, code: approvalReady ? "APPROVAL_SERVICE_READY" : "APPROVAL_SERVICE_NOT_READY" },
      { id: "agentteams", label: "AgentTeams 协作服务", ready: collaborationReady === true, code: collaborationReady ? "COLLABORATION_READY" : "COLLABORATION_NOT_READY" }];
    return { platforms, approvalReady, checks, serviceReady: checks.every(/** 所有前置检查必须通过。 / Require every prerequisite check. */ item => item.ready) };
  }

  /** 在服务器签发仅绑定当前工具与空间的短期委托。 / Sign a short-lived delegation bound to this tool and workspace on the server. */
  delegation(tool, request) {
    const config = this.platforms[tool.platform] || {};
    if (config.token?.length >= 32) return config.token;
    if (!config.secret || config.secret.length < 32) reject("LIVE_PLATFORM_NOT_CONFIGURED", 503);
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ sub: request.actorId, aud: "openxnet-agent-adapter", iat: issuedAt, exp: issuedAt + 300, workspace_id: request.workspaceId, tools: [tool.name] })).toString("base64url");
    const signature = createHmac("sha256", config.secret).update(`${header}.${claims}`).digest("base64url");
    return `${header}.${claims}.${signature}`;
  }

  /** 只向固定平台发送必要治理头。 / Send only required governance headers to a fixed platform. */
  headers(tool, request) {
    return { Accept: "application/json", "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${this.delegation(tool, request)}`,
      "X-OpenXnet-Workspace-Id": request.workspaceId, "X-OpenXnet-Incident-Id": request.incidentId,
      "X-OpenXnet-Trace-Id": request.traceId, "X-OpenXnet-Tool-Name": tool.name, "X-OpenXnet-Actor-Id": request.actorId,
      "Idempotency-Key": request.governance?.idempotencyKey || request.requestId };
  }

  /** 核对正式 1.0.0 元数据与来源归属；platform 扩展字段若出现也必须一致。 / Verify canonical 1.0.0 metadata and source ownership, also checking the optional platform extension when present. */
  validateToolResponse(payload, tool, request) {
    const meta = payload?.meta;
    const prefix = `xnet${tool.platform}/`;
    const source = meta?.source;
    const ownSource = typeof source === "string" && source.length <= 128
      && source.toLowerCase().startsWith(prefix) && source.length > prefix.length
      && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(source.slice(prefix.length));
    const contractFailure = payload?.success === false && source === "agent-contract" && payload.data === null
      && payload.error !== null && typeof payload.error === "object" && !Array.isArray(payload.error)
      && typeof payload.error.code === "string" && payload.error.code.trim().length > 0;
    if (!payload || typeof payload.success !== "boolean" || !meta
      || ["requestId", "workspaceId", "incidentId", "traceId", "toolName"].some(key => meta[key] !== request[key])
      || (Object.hasOwn(meta, "platform") && meta.platform !== tool.platform)
      || meta.contractVersion !== "1.0.0" || (!ownSource && !contractFailure)) {
      reject("LIVE_UPSTREAM_SCOPE_MISMATCH", 502);
    }
  }

  /** 代理原始统一工具请求，保留平台独立治理校验。 / Proxy a unified tool request while preserving independent platform governance. */
  async invoke(code, value) {
    const request = parseToolRequest(value), tool = descriptor(request.toolName);
    const base = endpoint(this.platforms[tool.platform]?.baseUrl, this.allowHttp);
    if (!base) reject("LIVE_PLATFORM_NOT_CONFIGURED", 503);
    return this.store.execute(code, "invoke", request,
      /** 执行前检查角色、资源和审批。 / Check role, resource and approval before execution. */ grant => this.store.authorizeTool(grant, request, tool),
      /** 仅转发固定协议包络，不含客户端网关凭证。 / Forward only the fixed envelope without the client gateway credential. */ async () => {
        const payload = await this.fetchJson(new URL(tool.path, base), { method: "POST", headers: this.headers(tool, request), body: JSON.stringify({ requestId: request.requestId, toolName: tool.name, arguments: request.arguments, dryRun: request.governance?.dryRun || false, ...(request.governance || {}) }) }, tool.timeoutMs);
        this.validateToolResponse(payload, tool, request);
        return payload;
      },
      /** 记录动作与其原始请求，防止跨运行轮询。 / Link returned actions to their original requests to prevent cross-run polling. */ (grant, result) => {
        const actionId = result.success && result.data?.actionId;
        if (typeof actionId === "string" && /^act_[A-Za-z0-9_-]{8,120}$/u.test(actionId)) grant.actions[actionId] = { workspaceId: request.workspaceId, incidentId: request.incidentId, traceId: request.traceId, toolName: tool.name, actorId: request.actorId, requestDigest: digest(canonical(request)) };
      });
  }

  /** 读取本授权产生的异步动作，不接受任意动作ID。 / Read asynchronous actions originating from this grant, never arbitrary IDs. */
  readAction(code, value) {
    exact(value, ["request", "actionId"]);
    const request = parseToolRequest(value.request), tool = descriptor(request.toolName);
    if (typeof value.actionId !== "string" || !/^act_[A-Za-z0-9_-]{8,120}$/u.test(value.actionId)) reject("LIVE_INVALID_REQUEST", 400);
    const base = endpoint(this.platforms[tool.platform]?.baseUrl, this.allowHttp);
    if (!base) reject("LIVE_PLATFORM_NOT_CONFIGURED", 503);
    return this.store.readAction(code, request, value.actionId,
      /** 仅使用账本确认过的动作路径。 / Use only the ledger-authorized action path. */ () => this.fetchJson(new URL(`/api/agent/v1/actions/${value.actionId}`, base), { headers: this.headers(tool, request) }, 3000, 128 * 1024));
  }

  /** 发布明确人工批准且匹配 Leader 冻结计划的审批。 / Publish explicit human approval matching the Leader's frozen plan. */
  publishApproval(code, approvalId, value) {
    exact(value, ["approvalId", "status", "expiresAt", "workspaceId", "incidentId", "traceId", "toolName", "resourceId", "targetRevision", "expectedResourceVersion", "planId", "planDigest", "scopes", "requesterId", "approverId"]);
    for (const key of ["approvalId", "workspaceId", "incidentId", "traceId", "toolName", "planId", "requesterId", "approverId"]) identifier(value[key]);
    if (value.approvalId !== approvalId || value.status !== "APPROVED" || !/^[a-f0-9]{64}$/u.test(value.planDigest)
      || !Array.isArray(value.scopes) || !value.scopes.length || value.scopes.length > 24 || new Set(value.scopes.map(scope => scope.stepId)).size !== value.scopes.length) reject("LIVE_INVALID_REQUEST", 400);
    value.scopes.forEach(scopeShape);
    const base = endpoint(this.approval?.baseUrl, this.allowHttp);
    if (!base || typeof this.approval?.token !== "string" || this.approval.token.length < 32) reject("LIVE_APPROVAL_NOT_CONFIGURED", 503);
    return this.store.execute(code, "approval", value,
      /** 核对审批人与计划每个写步骤，授权码本身不产生批准。 / Check the approver and every planned write; the grant itself does not approve. */ grant => {
        const run = this.store.run(grant, value);
        if (!grant.approverIds.includes(value.approverId) || !grant.actorIds.includes(value.requesterId) || value.approverId === value.requesterId) reject("LIVE_APPROVER_FORBIDDEN");
        const expiry = Date.parse(value.expiresAt);
        if (!Number.isFinite(expiry) || expiry <= this.now().getTime() || expiry > this.now().getTime() + 30 * 60000 || expiry > Date.parse(grant.expiresAt)) reject("LIVE_APPROVAL_EXPIRED");
        if (!run.plan || run.requesterId !== value.requesterId || run.plan.planId !== value.planId || run.plan.planDigest !== value.planDigest || canonical(planScopes(run.plan)) !== canonical(value.scopes)) reject("LIVE_APPROVAL_PLAN_MISMATCH");
        const primary = value.scopes.find(scope => !scope.compensation);
        if (!primary || ["toolName", "resourceId", "targetRevision", "expectedResourceVersion"].some(key => primary[key] !== value[key])) reject("LIVE_APPROVAL_SCOPE_MISMATCH");
      },
      /** 审批签发令牌仅添加到服务端上游请求。 / Add the approval issuer token only to the server-side upstream request. */ async () => {
        await this.fetchText(new URL(`api/v1/approvals/${approvalId}`, base), { method: "PUT", headers: { Authorization: `Bearer ${this.approval.token}`, "Content-Type": "application/json" }, body: JSON.stringify(value) }, 3000, 65536);
        return { schema: "openxnet.live.approval-result.v1", approvalId, published: true };
      },
      /** 只有上游确认后才保留可执行审批。 / Retain an executable approval only after upstream acknowledgment. */ grant => { grant.approvals[approvalId] = value; });
  }

  /** 对既有 AgentTeams 阶段应用 Live 授权和运行绑定。 / Apply Live authorization and run binding to existing AgentTeams stages. */
  executeTeam(code, mode, operationName, request, operation) {
    if (mode !== "live") reject("LIVE_MODE_FORBIDDEN");
    return this.store.execute(code, operationName, request,
      /** 在模型调用前锁定工作空间、团队和资源场景。 / Lock workspace, team and resource scenario before model calls. */ grant => {
        if (operationName === "prepare") {
          if (request.members.some(member => !grant.actorIds.includes(`agentteams:${member.roleCardId}`))) reject("LIVE_ACTOR_FORBIDDEN");
          const existing = grant.runs[request.traceId];
          if (existing && (existing.incidentId !== request.incidentId || existing.teamTemplateId !== request.teamTemplateId || existing.teamTemplateVersion !== request.teamTemplateVersion
            || existing.memberDigest !== digest(canonical(request.members)))) reject("LIVE_RUN_CONFLICT", 409);
        } else {
          const run = this.store.run(grant, request);
          if (request.teamName !== run.teamName || request.teamTemplateId !== run.teamTemplateId || request.teamTemplateVersion !== run.teamTemplateVersion) reject("LIVE_TEAM_MISMATCH");
          const scenario = request.context.incident.scenario.scenarioType;
          if (!grant.allowedScenarios.includes(scenario) || run.scenario && run.scenario !== scenario) reject("LIVE_SCENARIO_FORBIDDEN");
          if (request.context.availableTools.some(tool => !grant.allowedTools.includes(tool))) reject("LIVE_TOOL_FORBIDDEN");
          const contexts = request.context.residentContexts;
          if (!Array.isArray(contexts) || contexts.length !== 3 || contexts.some(item => item.source !== "LIVE-STAGING" || item.environment !== "staging")) reject("LIVE_MODE_FORBIDDEN");
          if (request.stage === "INVESTIGATION_CONCLUSION" && run.plan && canonical(run.plan) !== canonical(request.context.proposedPlan)) reject("LIVE_PLAN_CONFLICT", 409);
        }
      },
      /** 使用授权ID隔离团队名称，禁止客户端选择其他授权团队。 / Isolate team names by grant ID and prevent cross-grant team selection. */ grantId => operation({ ...request, accessGrantId: grantId }),
      /** 阶段成功后固化运行、场景和被接受的冻结计划。 / Persist the run, scenario and accepted frozen plan after a successful stage. */ (grant, result) => {
        if (operationName === "prepare") grant.runs[request.traceId] ||= { incidentId: request.incidentId, teamTemplateId: request.teamTemplateId, teamTemplateVersion: request.teamTemplateVersion,
          teamName: result.teamName || teamName({ ...request, accessGrantId: grant.id }), memberDigest: digest(canonical(request.members)), members: request.members.map(member => ({ roleCardId: member.roleCardId, teamRole: member.teamRole })) };
        else {
          const run = grant.runs[request.traceId];
          run.scenario = request.context.incident.scenario.scenarioType;
          if (request.stage === "INVESTIGATION_CONCLUSION" && result.result?.decision === "REQUEST_APPROVAL") {
            const leader = run.members.find(member => member.teamRole === "leader");
            if (!leader || result.result.roleCardId !== leader.roleCardId) reject("LIVE_LEADER_MISMATCH");
            run.plan = request.context.proposedPlan;
            run.requesterId = `agentteams:${leader.roleCardId}`;
          }
        }
      });
  }
}

/** 从服务器环境构造固定配置，不接收客户端上游地址。 / Build fixed configuration from server environment, never client upstream addresses. */
function createLiveGateway(environment, store) {
  if (environment.OPENXNET_LIVE_ENABLED !== "1") return null;
  const platforms = Object.fromEntries(PLATFORMS.map(/** 逐平台读取独立配置。 / Read independent configuration per platform. */ platform => {
    const prefix = `OPENXNET_LIVE_${platform.toUpperCase()}`;
    return [platform, { baseUrl: environment[`${prefix}_BASE_URL`] || "", identityUrl: environment[`${prefix}_IDENTITY_URL`] || "",
      secret: environment[`${prefix}_DELEGATION_SECRET`] || "", token: environment[`${prefix}_ADAPTER_TOKEN`] || "" }];
  }));
  return new LiveGateway({ store, platforms, approval: { baseUrl: environment.OPENXNET_LIVE_APPROVAL_BASE_URL || "", token: environment.OPENXNET_LIVE_APPROVAL_ISSUER_TOKEN || "" }, allowHttp: environment.OPENXNET_LIVE_ALLOW_HTTP_UPSTREAMS === "1" });
}

module.exports = { LiveGateway, createLiveGateway, parseToolRequest, planScopes, schemaValue, endpoint };
