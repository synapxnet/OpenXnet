#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Worker 活动固定CLI桥接 / Fixed Worker activity CLI bridge.
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

/** 在共同锁内执行固定Controller状态变更。 / Execute a fixed Controller state change while holding the shared lock. */
function controlledWorkerCommand(store, request, command, runner = spawnSync) {
  const state = store.load(); const now = store.clock(); store.reap(state, now);
  const lease = store.requireLease(state, request); const workerName = identifier(request.workerName);
  if (!lease.workers.some(/** Worker必须属于本租约。 / The worker must belong to this lease. */ worker => worker.name === workerName)) fail("ACTIVITY_SCOPE_INVALID");
  if (store.active(state, workerName).some(/** 其他租约存在时不得改变会话状态。 / Never alter a session protected by another lease. */ item => item.leaseId !== lease.leaseId)) fail("ACTIVITY_WORKER_BUSY");
  if (now.tickMs >= lease.deadlineTickMs) fail("ACTIVITY_DEADLINE_EXCEEDED");
  const worker = state.workers[workerName];
  worker.generation += 1; store.idle(state, workerName, now);
  delete lease.controllerIdentities[workerName];
  store.audit(state, command === "wake" ? "WAKE_REQUESTED" : "RELOAD_SLEEP_REQUESTED", { workerName, workerGeneration: worker.generation, leaseId: lease.leaseId }, now);
  state.revision += 1; atomicJson(store.file, state);
  const result = runner(process.env.AGENTTEAMS_CLI || "/usr/local/bin/agt", ["update", "worker", "--name", workerName, "--state", command === "wake" ? "Running" : "Sleeping"], { encoding: "utf8", timeout: Math.max(1, Math.min(2500, lease.deadlineTickMs - now.tickMs)), killSignal: "SIGKILL", maxBuffer: 1024 * 1024, windowsHide: true, env: process.env });
  if (result.status !== 0 || result.error) {
    store.audit(state, "WORKER_STATE_REQUEST_FAILED", { workerName, workerGeneration: worker.generation }, store.clock()); state.revision += 1; atomicJson(store.file, state); fail("ACTIVITY_CONTROLLER_UNAVAILABLE");
  }
  const completed = store.clock(); store.idle(state, workerName, completed);
  store.audit(state, command === "wake" ? "WAKE_REQUEST_ACCEPTED" : "RELOAD_SLEEP_ACCEPTED", { workerName, workerGeneration: worker.generation, leaseId: lease.leaseId, readiness: "NOT_VERIFIED" }, completed);
  lease.resourceVersion += 1; state.revision += 1; atomicJson(store.file, state);
  return store.receipt(lease);
}

/** 固定参数入口只能在flock子进程中执行，不暴露网络接口。 / Fixed argument entry executes only beneath flock and exposes no network interface. */
function main() {
  const [operation, encoded] = process.argv.slice(2);
  const root = process.env.AGENTTEAMS_WORKER_ACTIVITY_ROOT;
  if (!root || process.env.OPENXNET_WORKER_ACTIVITY_LOCK_HELD !== "1") fail("ACTIVITY_LOCK_REQUIRED");
  const lock = path.join(path.resolve(root), "worker-activity.lock");
  if (!fs.existsSync(lock) || fs.lstatSync(lock).isSymbolicLink()) fail("ACTIVITY_LOCK_INVALID");
  if (typeof encoded !== "string" || encoded.length > 32 * 1024) fail("ACTIVITY_SCOPE_INVALID");
  const request = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const store = new WorkerActivityStore(root);
  const result = operation === "initialize" ? store.initialize() : ["wake", "reload-sleep"].includes(operation) ? controlledWorkerCommand(store, request, operation) : store.execute(operation, request);
  console.log(JSON.stringify(result));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(JSON.stringify({ code: error.code || "ACTIVITY_OPERATION_FAILED" })); process.exitCode = 1; }
}
module.exports = { controlledWorkerCommand };
