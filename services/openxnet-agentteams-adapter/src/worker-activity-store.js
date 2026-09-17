#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Worker 活跃租约存储 / Worker activity lease storage.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const SCHEMA = "openxnet.worker-activity.v1";
const MAX_STAGE_MS = 300_000;
const LEASE_TTL_MS = 30_000;
const GRACE_MS = 30_000;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

/** 抛出不含任务正文的固定存储错误。 / Throw a fixed storage error without task contents. */
function fail(code) { const error = new Error(code); error.code = code; throw error; }

/** 获取跨进程共享的主机单调时钟。 / Read the host monotonic clock shared by processes. */
function systemClock() {
  return { wallMs: Date.now(), tickMs: Math.floor(os.uptime() * 1000), bootId: fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() };
}

/** 校验有界身份文本。 / Validate bounded identity text. */
function identifier(value) { if (typeof value !== "string" || !NAME.test(value)) fail("ACTIVITY_SCOPE_INVALID"); return value; }

/** 仅复制租约授权身份，不保存提示词或证据正文。 / Copy only lease authorization identities, excluding prompts and evidence contents. */
function scopeOf(value) {
  return Object.fromEntries(["workspaceId", "incidentId", "traceId", "stage", "requestId", "teamName"].map(/** 校验每个固定字段。 / Validate each fixed field. */ field => [field, identifier(value[field])]));
}

/** 校验完整持久状态，包括退休租约，防止损坏状态解除保护。 / Validate complete persisted state, including retired leases, so corruption cannot remove protection. */
function validateState(state) {
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
  const identity = value => typeof value === "string" && NAME.test(value);
  const timestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  if (!object(state) || state.schema !== SCHEMA || !integer(state.revision) || !integer(state.nextGeneration) || state.nextGeneration < 1 || !identity(state.bootId) || !object(state.workers) || !object(state.leases) || !Array.isArray(state.audit) || state.audit.length > 512) fail("ACTIVITY_STATE_INVALID");
  for (const [name, worker] of Object.entries(state.workers)) {
    if (!identity(name) || !object(worker) || !integer(worker.generation) || !integer(worker.activeCount) || !integer(worker.idleTickMs) || !timestamp(worker.idleSince) || !identity(worker.bootId) || (worker.identityDigest !== undefined && !digest(worker.identityDigest)) || (worker.controllerIdentityDigest !== undefined && !digest(worker.controllerIdentityDigest))) fail("ACTIVITY_STATE_INVALID");
  }
  for (const [key, lease] of Object.entries(state.leases)) {
    if (!object(lease) || !identity(key) || lease.leaseId !== key || !["ACTIVE", "GRACE", "EXPIRED", "RELEASED"].includes(lease.status) || !integer(lease.generation) || lease.generation < 1 || lease.generation >= state.nextGeneration || !integer(lease.resourceVersion) || lease.resourceVersion < 1 || !digest(lease.ownerKey) || typeof lease.exclusive !== "boolean" || !integer(lease.deadlineTickMs) || !integer(lease.maximumTickMs) || lease.maximumTickMs !== lease.deadlineTickMs + GRACE_MS || !integer(lease.expiresTickMs) || lease.expiresTickMs > lease.maximumTickMs || !timestamp(lease.expiresAt) || !Array.isArray(lease.workers) || lease.workers.length < 1 || lease.workers.length > 16 || !object(lease.controllerIdentities)) fail("ACTIVITY_STATE_INVALID");
    for (const field of ["workspaceId", "incidentId", "traceId", "stage", "requestId", "teamName"]) if (!identity(lease[field])) fail("ACTIVITY_STATE_INVALID");
    if (createHash("sha256").update(JSON.stringify(scopeOf(lease))).digest("hex") !== lease.ownerKey) fail("ACTIVITY_STATE_INVALID");
    const names = new Set();
    for (const worker of lease.workers) {
      if (!object(worker) || !identity(worker.name) || !digest(worker.identityDigest) || names.has(worker.name) || (["ACTIVE", "GRACE"].includes(lease.status) && !Object.hasOwn(state.workers, worker.name))) fail("ACTIVITY_STATE_INVALID");
      names.add(worker.name);
    }
    for (const [name, observed] of Object.entries(lease.controllerIdentities)) if (!names.has(name) || !object(observed) || !digest(observed.digest) || !integer(observed.generation)) fail("ACTIVITY_STATE_INVALID");
  }
  for (const entry of state.audit) if (!object(entry) || !identity(entry.event) || !timestamp(entry.observedAt)) fail("ACTIVITY_STATE_INVALID");
}

/** 原子保存常规文件并维持共享目录所属身份。 / Atomically save a regular file while preserving shared-directory ownership. */
function atomicJson(file, value) {
  const root = path.dirname(file); const owner = fs.statSync(root); const temporary = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd);
    if (typeof process.getuid === "function" && process.getuid() === 0) fs.fchownSync(fd, owner.uid, owner.gid);
  } finally { fs.closeSync(fd); }
  try { fs.renameSync(temporary, file); } catch (error) { fs.unlinkSync(temporary); throw error; }
}

/** 在调用方持有固定flock时操作活动状态。 / Operate activity state while the caller holds the fixed flock. */
class WorkerActivityStore {
  /** 配置专用目录和可替换时钟，不自动初始化缺失状态。 / Configure a dedicated directory and injectable clock without initializing missing state. */
  constructor(root, options = {}) {
    this.root = path.resolve(root); this.clock = options.clock || systemClock;
    const info = fs.lstatSync(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) fail("ACTIVITY_ROOT_INVALID");
    this.file = path.join(this.root, "worker-activity.json");
  }

  /** 仅在部署初始化阶段创建新存储。 / Create a store only during explicit deployment initialization. */
  initialize() {
    if (fs.existsSync(this.file)) fail("ACTIVITY_ALREADY_INITIALIZED");
    const now = this.clock();
    atomicJson(this.file, { schema: SCHEMA, revision: 0, nextGeneration: 1, bootId: now.bootId, workers: {}, leases: {}, audit: [] });
    return { status: "INITIALIZED", schema: SCHEMA };
  }

  /** 严格读取原状态，损坏时失败关闭。 / Strictly load existing state and fail closed on corruption. */
  load() {
    let state;
    try {
      if (fs.lstatSync(this.file).isSymbolicLink()) fail("ACTIVITY_STATE_INVALID");
      const bytes = fs.readFileSync(this.file); if (bytes.length > 4 * 1024 * 1024) fail("ACTIVITY_STATE_INVALID");
      state = JSON.parse(bytes);
    } catch { fail("ACTIVITY_STATE_UNAVAILABLE"); }
    validateState(state);
    state.workers = Object.assign(Object.create(null), state.workers);
    state.leases = Object.assign(Object.create(null), state.leases);
    return state;
  }

  /** 记录有界公开审计项，不含命令或模型内容。 / Record bounded public audit entries without commands or model contents. */
  audit(state, event, fields, now) {
    state.audit.push({ event, observedAt: new Date(now.wallMs).toISOString(), ...fields });
    state.audit = state.audit.slice(-512);
  }

  /** 读取当前有效租约，不把其他请求的租约视为当前请求。 / Read active leases without conflating different request owners. */
  active(state, worker) {
    return Object.values(state.leases).filter(/** 仅保留保护期内的真实成员。 / Retain actual members within their protection period. */ lease => ["ACTIVE", "GRACE"].includes(lease.status) && lease.workers.some(/** 精确匹配Worker名。 / Match the exact worker name. */ item => item.name === worker));
  }

  /** 更新空闲起点，不覆盖其他Worker字段。 / Update idle origin without overwriting other worker fields. */
  idle(state, name, now) {
    const worker = state.workers[name] ||= { generation: 0, activeCount: 0 };
    worker.idleTickMs = now.tickMs; worker.idleSince = new Date(now.wallMs).toISOString(); worker.bootId = now.bootId;
  }

  /** 到期和主机重启只能收回旧租约，不能延长业务期限。 / Expiry and host reboot retire old leases without extending business deadlines. */
  reap(state, now) {
    const rebooted = state.bootId !== now.bootId;
    for (const lease of Object.values(state.leases)) {
      if (!["ACTIVE", "GRACE"].includes(lease.status)) continue;
      if (!Number.isFinite(lease.expiresTickMs) || !Number.isFinite(lease.maximumTickMs) || !Array.isArray(lease.workers)) fail("ACTIVITY_STATE_INVALID");
      if (rebooted || now.tickMs >= Math.min(lease.expiresTickMs, lease.maximumTickMs)) {
        lease.status = "EXPIRED"; lease.resourceVersion += 1;
        this.audit(state, "LEASE_EXPIRED", { leaseId: lease.leaseId, generation: lease.generation }, now);
      }
    }
    if (rebooted) {
      state.bootId = now.bootId;
      for (const name of Object.keys(state.workers)) this.idle(state, name, now);
      this.audit(state, "HOST_BOOT_CHANGED", {}, now);
    }
    for (const [name, worker] of Object.entries(state.workers)) {
      const active = this.active(state, name).length;
      if (worker.activeCount > 0 && active === 0) this.idle(state, name, now);
      worker.activeCount = active;
    }
  }

  /** 按完整拥有者和代际版本执行CAS，拒绝迟到请求。 / Compare the complete owner, generation and version to reject stale requests. */
  requireLease(state, request) {
    const lease = state.leases[identifier(request.leaseId)];
    if (!lease || lease.requestId !== request.requestId || lease.generation !== request.generation || lease.resourceVersion !== request.resourceVersion || lease.status !== "ACTIVE") fail("ACTIVITY_LEASE_CONFLICT");
    for (const field of ["workspaceId", "incidentId", "traceId", "stage", "teamName"]) if (lease[field] !== request[field]) fail("ACTIVITY_SCOPE_INVALID");
    for (const worker of lease.workers) if (state.workers[worker.name]?.identityDigest !== worker.identityDigest) fail("ACTIVITY_WORKER_IDENTITY_CHANGED");
    for (const [name, observed] of Object.entries(lease.controllerIdentities || {})) if (state.workers[name]?.controllerIdentityDigest !== observed.digest || state.workers[name]?.generation !== observed.generation) fail("ACTIVITY_WORKER_IDENTITY_CHANGED");
    return lease;
  }

  /** 输出无正文的租约令牌。 / Return a lease token without task contents. */
  receipt(lease) {
    return { ...scopeOf(lease), leaseId: lease.leaseId, generation: lease.generation, resourceVersion: lease.resourceVersion, expiresAt: lease.expiresAt, workers: lease.workers, status: lease.status };
  }

  /** 获取当前范围租约，重试只复用完全相同的活跃代际。 / Acquire a scoped lease; retries reuse only the identical active generation. */
  acquire(state, request, now) {
    const scope = scopeOf(request);
    if (!Number.isSafeInteger(request.remainingMs) || request.remainingMs <= 0 || request.remainingMs > MAX_STAGE_MS) fail("ACTIVITY_DEADLINE_INVALID");
    if (!Array.isArray(request.workers) || request.workers.length < 1 || request.workers.length > 16) fail("ACTIVITY_SCOPE_INVALID");
    const workers = request.workers.map(/** 固定映射授权的Worker身份摘要。 / Pin worker identity digests authorized by the mapping. */ worker => {
      const name = identifier(worker.name); if (!/^[a-f0-9]{64}$/u.test(worker.identityDigest)) fail("ACTIVITY_SCOPE_INVALID");
      return { name, identityDigest: worker.identityDigest };
    }).sort(/** 稳定排序授权集合。 / Sort the authorized set deterministically. */ (a, b) => a.name.localeCompare(b.name));
    if (new Set(workers.map(/** 拒绝重复Worker。 / Reject duplicate workers. */ worker => worker.name)).size !== workers.length) fail("ACTIVITY_SCOPE_INVALID");
    const ownerKey = createHash("sha256").update(JSON.stringify(scope)).digest("hex");
    const previous = Object.values(state.leases).find(/** 相同请求只能复用同一有效租约。 / The same request can reuse only its current valid lease. */ lease => lease.ownerKey === ownerKey && lease.status === "ACTIVE");
    if (previous) {
      if (JSON.stringify(previous.workers) !== JSON.stringify(workers) || previous.exclusive !== (request.exclusive === true)) fail("ACTIVITY_SCOPE_INVALID");
      return this.receipt(previous);
    }
    for (const worker of workers) {
      const active = this.active(state, worker.name);
      if (active.some(/** 未观测终态的旧请求必须先收敛。 / An earlier request without an observed terminal state must settle first. */ lease => lease.status === "GRACE")) fail("ACTIVITY_WORKER_SETTLING");
      if ((request.exclusive === true && active.length > 0) || active.some(/** 已存在的独占配置也阻止普通派发。 / An existing exclusive preparation also blocks regular dispatch. */ lease => lease.exclusive)) fail("ACTIVITY_WORKER_BUSY");
      const existing = state.workers[worker.name];
      if (existing?.identityDigest && existing.identityDigest !== worker.identityDigest && active.length) fail("ACTIVITY_WORKER_IDENTITY_CHANGED");
      this.idle(state, worker.name, now); state.workers[worker.name].identityDigest = worker.identityDigest;
    }
    if (Object.values(state.leases).filter(/** 限制同时存在的保护范围。 / Bound simultaneously protected scopes. */ item => ["ACTIVE", "GRACE"].includes(item.status)).length >= 128) fail("ACTIVITY_CAPACITY_EXCEEDED");
    const retired = Object.values(state.leases).filter(/** 只裁剪已终止的旧记录。 / Prune only retired old records. */ item => !["ACTIVE", "GRACE"].includes(item.status)).sort(/** 按真实租约代际保留最近记录。 / Retain recent records by lease generation. */ (a, b) => b.generation - a.generation);
    for (const old of retired.slice(256)) delete state.leases[old.leaseId];
    const lease = { ...scope, ownerKey, workers, exclusive: request.exclusive === true, controllerIdentities: {}, leaseId: `lease-${randomUUID()}`, generation: state.nextGeneration++, resourceVersion: 1, status: "ACTIVE", deadlineTickMs: now.tickMs + request.remainingMs, maximumTickMs: now.tickMs + request.remainingMs + GRACE_MS, expiresTickMs: now.tickMs + Math.min(LEASE_TTL_MS, request.remainingMs + GRACE_MS), expiresAt: new Date(now.wallMs + Math.min(LEASE_TTL_MS, request.remainingMs + GRACE_MS)).toISOString() };
    state.leases[lease.leaseId] = lease;
    for (const worker of workers) state.workers[worker.name].activeCount = this.active(state, worker.name).length;
    this.audit(state, "LEASE_ACQUIRED", { leaseId: lease.leaseId, requestId: scope.requestId, generation: lease.generation, workerNames: workers.map(/** 仅记录Worker名。 / Record worker names only. */ worker => worker.name) }, now);
    return this.receipt(lease);
  }

  /** 续约不能越过原阶段deadline或改变范围。 / Renewal cannot exceed the original stage deadline or alter scope. */
  renew(state, request, now) {
    const lease = this.requireLease(state, request);
    if (now.tickMs >= lease.deadlineTickMs) fail("ACTIVITY_DEADLINE_EXCEEDED");
    lease.expiresTickMs = Math.min(now.tickMs + LEASE_TTL_MS, lease.maximumTickMs); lease.resourceVersion += 1;
    lease.expiresAt = new Date(now.wallMs + lease.expiresTickMs - now.tickMs).toISOString();
    return this.receipt(lease);
  }

  /** 只释放当前租约；未确认终态的失败使用一次有界grace。 / Release only this lease; failures without confirmed completion use one bounded grace period. */
  release(state, request, now) {
    const lease = this.requireLease(state, request);
    if (!["COMPLETED", "FAILED", "CANCELLED", "NOT_SENT"].includes(request.outcome)) fail("ACTIVITY_OUTCOME_INVALID");
    const grace = ["FAILED", "CANCELLED"].includes(request.outcome) && (request.dispatched === true || request.lifecycleChanged === true);
    lease.status = grace ? "GRACE" : "RELEASED"; lease.resourceVersion += 1;
    if (grace) { lease.expiresTickMs = Math.min(now.tickMs + GRACE_MS, lease.maximumTickMs); lease.expiresAt = new Date(now.wallMs + lease.expiresTickMs - now.tickMs).toISOString(); }
    for (const worker of lease.workers) { state.workers[worker.name].activeCount = this.active(state, worker.name).length; if (state.workers[worker.name].activeCount === 0) this.idle(state, worker.name, now); }
    this.audit(state, grace ? "LEASE_GRACE" : "LEASE_RELEASED", { leaseId: lease.leaseId, generation: lease.generation, outcome: request.outcome }, now);
    return { ...this.receipt(lease), remainingActiveLeaseCount: lease.workers.reduce(/** 汇总各Worker仍有效的租约。 / Count remaining active leases across workers. */ (sum, worker) => sum + this.active(state, worker.name).length, 0) };
  }

  /** 派发前核对Controller可观察身份，不冒充容器代际。 / Verify observable Controller identity before dispatch without claiming container-generation proof. */
  observe(state, request, now) {
    const lease = this.requireLease(state, request); const name = identifier(request.workerName);
    if (!lease.workers.some(/** 成员身份必须属于当前租约。 / Member identity must belong to this lease. */ worker => worker.name === name) || !/^[a-f0-9]{64}$/u.test(request.controllerIdentityDigest)) fail("ACTIVITY_SCOPE_INVALID");
    const worker = state.workers[name];
    if (worker.controllerIdentityDigest && worker.controllerIdentityDigest !== request.controllerIdentityDigest && !request.afterWake) fail("ACTIVITY_WORKER_IDENTITY_CHANGED");
    if (request.afterWake && this.active(state, name).some(/** 不覆盖其他仍活跃请求的代际。 / Do not overwrite another active request's generation. */ item => item.leaseId !== lease.leaseId)) fail("ACTIVITY_WORKER_BUSY");
    worker.controllerIdentityDigest = request.controllerIdentityDigest;
    lease.controllerIdentities[name] = { digest: request.controllerIdentityDigest, generation: worker.generation };
    lease.resourceVersion += 1;
    this.audit(state, "WORKER_IDENTITY_OBSERVED", { workerName: name, workerGeneration: worker.generation, leaseId: lease.leaseId, identityDigest: request.controllerIdentityDigest }, now);
    return this.receipt(lease);
  }

  /** 执行固定操作并原子提交，调用方必须持有共同锁。 / Execute a fixed operation and atomically commit while the caller holds the shared lock. */
  execute(operation, request) {
    const state = this.load(); const now = this.clock(); this.reap(state, now);
    let result;
    if (operation === "acquire") result = this.acquire(state, request, now);
    else if (operation === "renew") result = this.renew(state, request, now);
    else if (operation === "release") result = this.release(state, request, now);
    else if (operation === "observe") result = this.observe(state, request, now);
    else if (operation === "inspect") result = { status: "READY", revision: state.revision, workers: state.workers, leases: Object.values(state.leases).map(/** 只输出公开租约令牌。 / Return only public lease tokens. */ lease => this.receipt(lease)) };
    else fail("ACTIVITY_OPERATION_INVALID");
    state.revision += 1; atomicJson(this.file, state); return result;
  }
}
module.exports = { WorkerActivityStore, atomicJson, systemClock, MAX_STAGE_MS, LEASE_TTL_MS, GRACE_MS, identifier, fail };
