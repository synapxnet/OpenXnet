#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Worker 生命周期与租约共同锁 / Shared Worker lifecycle and lease lock.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { WorkerActivityStore, atomicJson, identifier, fail } = require("./worker-activity-store");
const { runLockedBridge } = require("./worker-activity-client");

/** 读取既有生命周期或任务状态，任何损坏阻止自动停止。 / Read existing lifecycle or task state; corruption prevents automatic stopping. */
function readState(file) {
  try { if (fs.lstatSync(file).isSymbolicLink()) fail("LIFECYCLE_STATE_INVALID"); const bytes = fs.readFileSync(file); if (bytes.length > 8 * 1024 * 1024) fail("LIFECYCLE_STATE_INVALID"); return JSON.parse(bytes); }
  catch { fail("LIFECYCLE_STATE_UNAVAILABLE"); }
}

/** 只在状态判断与最终变更时持共同锁，远程只读查询在锁外。 / Hold the shared lock only for state decisions and final mutations; query remote state outside it. */
class WorkerLifecycleController {
  /** 配置固定文件和受限Controller执行器。 / Configure fixed files and a bounded Controller runner. */
  constructor(options) {
    this.home = path.resolve(options.home); this.store = new WorkerActivityStore(options.root, { clock: options.clock });
    this.runner = options.runner || spawnSync; this.executable = options.executable || "agt";
    this.lifecycleFile = path.join(this.home, "worker-lifecycle.json"); this.taskFile = path.join(this.home, "state.json");
    this.withLock = options.withLock || this.executeLocked.bind(this);
  }

  /** 执行固定agt参数，输出错误不含Controller响应正文。 / Execute fixed agt arguments without exposing Controller response bodies on error. */
  command(args, json = false) {
    const result = this.runner(this.executable, args, { encoding: "utf8", timeout: args[0] === "get" ? 15_000 : 2500, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, windowsHide: true });
    if (result.status !== 0 || result.error) fail("LIFECYCLE_CONTROLLER_UNAVAILABLE");
    if (!json) return null;
    try { return JSON.parse(result.stdout); } catch { fail("LIFECYCLE_CONTROLLER_INVALID"); }
  }

  /** 读取仍活跃的finite任务，保持既有任务语义。 / Read active finite tasks while preserving existing task semantics. */
  finite(worker) {
    const tasks = readState(this.taskFile);
    if (!Array.isArray(tasks.active_tasks)) fail("LIFECYCLE_STATE_INVALID");
    return tasks.active_tasks.some(/** 只匹配原有限任务分配。 / Match the original finite task assignment only. */ task => task.assigned_to === worker && task.type === "finite");
  }

  /** 在同一锁中提交活动与生命周期两个原子文件。 / Commit both activity and lifecycle files atomically under the same lock. */
  save(state, lifecycle) { state.revision += 1; lifecycle.updated_at = new Date(this.store.clock().wallMs).toISOString(); atomicJson(this.store.file, state); atomicJson(this.lifecycleFile, lifecycle); }

  /** 在实际停止前再次校验同锁下的租约、代际和finite任务。 / Recheck leases, fencing generation and finite tasks under the same lock immediately before stopping. */
  stop(workerName, state, lifecycle, automatic) {
    const generation = state.workers[workerName]?.generation ?? 0;
    if (this.finite(workerName) || this.store.active(state, workerName).length) return { worker: workerName, status: "BUSY" };
    const fresh = this.store.load(); const now = this.store.clock(); this.store.reap(fresh, now);
    if ((fresh.workers[workerName]?.generation ?? 0) !== generation || this.store.active(fresh, workerName).length || this.finite(workerName)) return { worker: workerName, status: "BUSY" };
    this.store.audit(fresh, "STOP_REQUESTED", { workerName, workerGeneration: generation, automatic }, now);
    fresh.revision += 1; atomicJson(this.store.file, fresh);
    this.command(["update", "worker", "--name", workerName, "--state", "Sleeping"]);
    lifecycle.workers[workerName] ||= {}; lifecycle.workers[workerName].container_status = "sleeping";
    if (automatic) lifecycle.workers[workerName].auto_stopped_at = new Date(this.store.clock().wallMs).toISOString();
    this.store.audit(fresh, "STOP_REQUEST_ACCEPTED", { workerName, workerGeneration: generation, automatic }, this.store.clock());
    this.save(fresh, lifecycle); Object.assign(state, fresh);
    return { worker: workerName, status: "sleeping" };
  }

  /** 唤醒前固化新代际并清除旧idle，Controller运行不等于Matrix就绪。 / Persist a new generation and clear stale idle before wake; Controller running is not Matrix readiness. */
  start(workerName, state, lifecycle) {
    if (this.store.active(state, workerName).length) return { worker: workerName, status: "BUSY" };
    const now = this.store.clock(); this.store.idle(state, workerName, now); state.workers[workerName].generation += 1;
    lifecycle.workers[workerName] ||= {}; lifecycle.workers[workerName].idle_since = "";
    this.store.audit(state, "WAKE_REQUESTED", { workerName, workerGeneration: state.workers[workerName].generation }, now); this.save(state, lifecycle);
    this.command(["update", "worker", "--name", workerName, "--state", "Running"]);
    const completed = this.store.clock(); this.store.idle(state, workerName, completed);
    lifecycle.workers[workerName].last_started_at = new Date(completed.wallMs).toISOString(); lifecycle.workers[workerName].container_status = "pending";
    this.store.audit(state, "WAKE_REQUEST_ACCEPTED", { workerName, workerGeneration: state.workers[workerName].generation, readiness: "NOT_VERIFIED" }, completed); this.save(state, lifecycle);
    return { worker: workerName, status: "starting", container_status: "pending", matrixReady: false };
  }

  /** 对单个已观测Worker重读保护状态，最终停止仍持共同锁。 / Reread protection for one observed worker while retaining the shared lock through the final stop. */
  checkIdleWorker(name, current, state, lifecycle) {
    const timeout = lifecycle.idle_timeout_minutes ?? 720;
    if (!Number.isFinite(timeout) || timeout < 0) fail("LIFECYCLE_TIMEOUT_INVALID");
      if (current.state !== "Running") return { worker: name, status: "NOT_RUNNING" };
      const now = this.store.clock(); this.store.reap(state, now); lifecycle.workers[name] ||= {};
      if (this.finite(name) || this.store.active(state, name).length) {
        lifecycle.workers[name].idle_since = ""; this.store.idle(state, name, now); this.save(state, lifecycle); return { worker: name, status: "BUSY" };
      }
      if (!Number.isFinite(state.workers[name]?.idleTickMs) || state.workers[name].bootId !== now.bootId) this.store.idle(state, name, now);
      lifecycle.workers[name].idle_since = state.workers[name].idleSince;
      this.save(state, lifecycle);
      if (now.tickMs - state.workers[name].idleTickMs >= timeout * 60_000) return this.stop(name, state, lifecycle, true);
      return { worker: name, status: "idle", idleSince: state.workers[name].idleSince };
  }

  /** 保留原动作入口，并让任何状态读取失败阻止自动休眠。 / Preserve original action entry points and block automatic sleep on any failed state read. */
  executeLocked(action, workerName, current) {
    const state = this.store.load(); const now = this.store.clock(); this.store.reap(state, now);
    const lifecycle = readState(this.lifecycleFile);
    if (!lifecycle.workers || Array.isArray(lifecycle.workers)) fail("LIFECYCLE_STATE_INVALID");
    lifecycle.workers = Object.assign(Object.create(null), lifecycle.workers);
    if (action === "validate") { this.finite("validation-only"); return { status: "VALID" }; }
    const name = identifier(workerName);
    if (action === "check-worker") return this.checkIdleWorker(name, current, state, lifecycle);
    if (action === "sync-worker") { lifecycle.workers[name] ||= {}; lifecycle.workers[name].container_status = current.containerState || current.phase || "Pending"; this.save(state, lifecycle); return { worker: name, status: "SYNCED" }; }
    if (action === "start") return this.start(name, state, lifecycle);
    if (action === "stop") { this.save(state, lifecycle); return this.stop(name, state, lifecycle, false); }
    if (action === "ensure-ready") {
      if (current.state === "Running" && current.phase === "Running") { this.store.idle(state, name, now); lifecycle.workers[name] ||= {}; lifecycle.workers[name].idle_since = ""; this.save(state, lifecycle); return { worker: name, status: "ready", container_status: "running", readinessScope: "controller", matrixReady: false }; }
      return this.start(name, state, lifecycle);
    }
    if (action === "delete") {
      if (this.finite(name) || this.store.active(state, name).length) fail("LIFECYCLE_WORKER_BUSY");
      this.command(["delete", "worker", name]); delete lifecycle.workers[name]; delete state.workers[name]; this.save(state, lifecycle); return { worker: name, status: "deleted" };
    }
    fail("LIFECYCLE_ACTION_INVALID");
  }

  /** 锁外查询每个Controller对象，逐目标进入短临界区。 / Query each Controller object outside the lock and enter a short critical section per target. */
  async execute(action, workerName) {
    await this.withLock("validate");
    if (["check-idle", "sync-status"].includes(action)) {
      const listed = this.command(["get", "workers", "-o", "json"], true);
      if (!Array.isArray(listed.workers)) fail("LIFECYCLE_CONTROLLER_INVALID");
      const results = [];
      for (const entry of listed.workers) {
        const name = identifier(entry.name); const current = this.command(["get", "workers", name, "-o", "json"], true);
        results.push(await this.withLock(action === "check-idle" ? "check-worker" : "sync-worker", name, current));
      }
      return { status: action === "check-idle" ? "CHECKED" : "SYNCED", workers: results };
    }
    const name = identifier(workerName);
    const current = action === "ensure-ready" ? this.command(["get", "workers", name, "-o", "json"], true) : undefined;
    return this.withLock(action, name, current);
  }
}

/** 处理受共同锁保护的原固定参数。 / Process original fixed arguments protected by the shared lock. */
async function main() {
  const args = process.argv.slice(2); let action; let worker;
  const options = { root: process.env.AGENTTEAMS_WORKER_ACTIVITY_ROOT, home: process.env.HOME };
  if (args[0] === "--locked-operation") {
    if (process.env.OPENXNET_WORKER_ACTIVITY_LOCK_HELD !== "1" || args.length !== 2 || args[1].length > 32 * 1024) fail("ACTIVITY_LOCK_REQUIRED");
    const request = JSON.parse(Buffer.from(args[1], "base64").toString("utf8"));
    console.log(JSON.stringify(new WorkerLifecycleController(options).executeLocked(request.action, request.worker, request.current))); return;
  }
  for (let index = 0; index < args.length; index += 2) { if (args[index] === "--action") action = args[index + 1]; else if (args[index] === "--worker") worker = args[index + 1]; else fail("LIFECYCLE_ACTION_INVALID"); }
  if (!["check-idle", "sync-status", "start", "stop", "delete", "ensure-ready"].includes(action)) fail("LIFECYCLE_ACTION_INVALID");
  options.withLock = (lockedAction, name, observation) => runLockedBridge(options.root, __filename, ["--locked-operation", Buffer.from(JSON.stringify({ action: lockedAction, worker: name, current: observation })).toString("base64")], process.env, 8000);
  console.log(JSON.stringify(await new WorkerLifecycleController(options).execute(action, worker)));
}
if (require.main === module) main().catch(/** 仅返回固定公开失败码。 / Return a fixed public failure code only. */ error => { console.error(JSON.stringify({ code: error.code || "LIFECYCLE_OPERATION_FAILED" })); process.exitCode = 1; });
module.exports = { WorkerLifecycleController };
