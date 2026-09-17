#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Worker 受控租约客户端 / Governed Worker activity client.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { PublicError } = require("./contracts");

/** 以固定锁和独立进程组运行本地桥接，超时杀死整个进程树。 / Run a local bridge with a fixed lock and isolated process group; kill the full process tree on timeout. */
async function runLockedBridge(root, script, cliArgs, environment, timeoutMs = 5000) {
  const lock = path.join(root, "worker-activity.lock");
  if (!fs.existsSync(lock) || !fs.lstatSync(lock).isFile() || fs.lstatSync(lock).isSymbolicLink() || fs.lstatSync(root).isSymbolicLink()) throw new PublicError(503, "AGENTTEAMS_ACTIVITY_UNAVAILABLE", "Worker activity protection is unavailable.");
  return new Promise(/** 等待整个桥接退出后才返回，禁止超时后的迟到写入。 / Return only after the bridge exits, preventing late writes after timeout. */ (resolve, reject) => {
    const args = ["--no-fork", "--exclusive", "--wait", String(Math.max(0.01, Math.min(4, timeoutMs / 1000))), lock, process.execPath, script, ...cliArgs];
    const child = spawn("/usr/bin/flock", args, { detached: true, env: { ...environment, AGENTTEAMS_WORKER_ACTIVITY_ROOT: root, OPENXNET_WORKER_ACTIVITY_LOCK_HELD: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = ""; let failed = false;
    /** 固定子进程拥有独立进程组，只终止本次桥接及其后代。 / The fixed child owns an isolated process group; terminate only this bridge and its descendants. */
    const terminate = () => { failed = true; if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") child.kill("SIGKILL"); } } };
    const timer = setTimeout(terminate, timeoutMs);
    child.stdout.on("data", /** 保持回执有界，超限终止整个桥接。 / Bound receipts and terminate the entire bridge on overflow. */ chunk => { output += chunk; if (output.length > 64 * 1024) terminate(); });
    child.stderr.resume();
    child.on("error", /** 保留固定公开错误，不暴露会话内容。 / Preserve a fixed public error without exposing session contents. */ () => { failed = true; });
    child.on("close", /** 仅接受正常结束的JSON回执。 / Accept only normally completed JSON receipts. */ code => {
      clearTimeout(timer);
      if (code !== 0 || failed) return reject(new PublicError(503, "AGENTTEAMS_ACTIVITY_UNAVAILABLE", "Worker activity protection could not be confirmed."));
      try { resolve(JSON.parse(output)); } catch { reject(new PublicError(503, "AGENTTEAMS_ACTIVITY_UNAVAILABLE", "Worker activity receipt is invalid.")); }
    });
  });
}

/** 为Controller和Matrix共用一个单调截止时间。 / Share one monotonic deadline across Controller and Matrix operations. */
class StageBudget {
  /** 在排队前启动阶段预算，取消只终止当前请求。 / Start the stage budget before queuing; cancellation affects only this request. */
  constructor(timeoutMs, options = {}) {
    this.now = options.monotonicNow || (() => performance.now()); this.deadline = this.now() + timeoutMs;
    this.controller = new AbortController(); this.dispatched = false; this.lifecycleChanged = false; this.failure = null;
    this.timer = setTimeout(/** 截止时间到期只能失败。 / Deadline expiry can only fail the stage. */ () => this.cancel(new PublicError(504, "AGENTTEAMS_TASK_TIMEOUT", "AgentTeams task exceeded the shared stage time budget.")), timeoutMs);
    this.timer.unref?.();
    this.externalSignal = options.signal;
    this.cancelListener = () => this.cancel(new PublicError(499, "AGENTTEAMS_TASK_CANCELLED", "AgentTeams task was cancelled."));
    this.externalSignal?.addEventListener("abort", this.cancelListener, { once: true });
    if (this.externalSignal?.aborted) this.cancelListener();
  }
  /** 保留第一次真实失败，禁止后续成功覆盖。 / Preserve the first actual failure and reject later success. */
  cancel(error) { this.failure ||= error; if (!this.controller.signal.aborted) this.controller.abort(this.failure); }
  /** 返回剩余业务预算，不接受续约延长。 / Return remaining business budget without lease-based extensions. */
  remaining() { this.assert(); return Math.max(1, Math.ceil(this.deadline - this.now())); }
  /** 任何新动作和结果接收前验证预算。 / Check the budget before every new action and result acceptance. */
  assert() { if (this.now() >= this.deadline && !this.failure) this.cancel(new PublicError(504, "AGENTTEAMS_TASK_TIMEOUT", "AgentTeams task exceeded the shared stage time budget.")); if (this.failure) throw this.failure; }
  /** 在同一取消信号下等待操作，不把迟到结果视为成功。 / Await an operation under one cancellation signal without accepting late success. */
  async run(operation) {
    this.assert(); let listener;
    try {
      const value = await Promise.race([Promise.resolve().then(/** 微任务执行前再次检查同步取消。 / Recheck synchronous cancellation before executing the microtask. */ () => { this.assert(); return operation(); }), new Promise(/** 只中断当前等待。 / Interrupt only this wait. */ (_, reject) => { listener = () => reject(this.failure); this.controller.signal.addEventListener("abort", listener, { once: true }); })]);
      this.assert(); return value;
    } finally { if (listener) this.controller.signal.removeEventListener("abort", listener); }
  }
  /** 释放定时器和请求取消监听。 / Release timers and request cancellation listeners. */
  dispose() { clearTimeout(this.timer); this.externalSignal?.removeEventListener("abort", this.cancelListener); }
}

/** 通过固定flock子进程访问专用目录。 / Access the dedicated directory through a fixed flock child process. */
class WorkerActivityClient {
  /** 设置目录和可测试执行器，缺失配置仍失败关闭。 / Configure the directory and testable executor; missing configuration remains fail closed. */
  constructor(options = {}) { this.root = options.root ? path.resolve(options.root) : null; this.run = options.run || this._run.bind(this); this.renewIntervalMs = options.renewIntervalMs || 10_000; }

  /** 使用固定参数和最小会话环境执行受锁桥接。 / Execute the locked bridge using fixed arguments and the minimal session environment. */
  async _run(operation, request, environment, timeoutMs = 5000) {
    if (!this.root) throw new PublicError(503, "AGENTTEAMS_ACTIVITY_UNAVAILABLE", "Worker activity protection is not configured.");
    return runLockedBridge(this.root, path.join(__dirname, "worker-activity-cli.js"), [operation, Buffer.from(JSON.stringify(request)).toString("base64")], environment, timeoutMs);
  }

  /** 从已校验映射获得租约后才允许唤醒与派发。 / Acquire protection from a validated mapping before wake or dispatch. */
  async acquire(request, workers, environment, budget) {
    const scope = Object.fromEntries(["requestId", "workspaceId", "incidentId", "traceId", "stage", "teamName"].map(/** 只传递身份范围。 / Pass identity scope only. */ field => [field, request[field]]));
    let token = await budget.run(/** 获取有限期保护，配置应用必须独占。 / Acquire bounded protection; configuration apply requires exclusivity. */ () => this.run("acquire", { ...scope, workers, exclusive: request.stage === "TEAM_PREPARE", remainingMs: Math.min(300_000, budget.remaining()) }, environment, Math.min(5000, budget.remaining())));
    let closed = false; let renewal = null; let queue = Promise.resolve();
    /** 串行CAS更新，避免本请求续约与释放相互冲突。 / Serialize CAS updates to prevent renewal/release races within this request. */
    const mutate = (operation, extra = {}, allowExpiredBudget = false) => {
      const operationResult = queue.then(/** 使用最近的CAS令牌。 / Use the latest CAS token. */ async () => {
        if (!allowExpiredBudget) budget.assert();
        const result = await this.run(operation, { ...token, ...extra }, environment, allowExpiredBudget ? 5000 : Math.min(20_000, budget.remaining()));
        token = result; return result;
      });
      queue = operationResult.catch(/** 将租约失败送到同一阶段取消边界。 / Propagate lease failure to the same stage cancellation boundary. */ error => { budget.cancel(error); });
      return operationResult;
    };
    /** 只续期保护，绝不改变业务deadline。 / Renew protection without changing the business deadline. */
    const scheduleRenewal = () => {
      renewal = setTimeout(/** 续约失败后停止后续派发。 / Stop further dispatch after renewal failure. */ async () => { if (closed) return; try { await mutate("renew"); if (!closed) scheduleRenewal(); } catch {} }, this.renewIntervalMs);
      renewal.unref?.();
    };
    scheduleRenewal();
    return {
      /** 受控唤醒在共同锁下重置闲置起点。 / Governed wake resets idle origin under the shared lock. */
      wake: workerName => { budget.assert(); budget.lifecycleChanged = true; return mutate("wake", { workerName }); },
      /** 仅当前独占租约可执行配置重载休眠。 / Only this exclusive lease may sleep a worker for configuration reload. */
      reloadSleep: workerName => { budget.assert(); budget.lifecycleChanged = true; return mutate("reload-sleep", { workerName }); },
      /** 派发前记录Controller实际身份。 / Record actual Controller identity before dispatch. */
      observe: (workerName, controllerIdentityDigest, afterWake = false) => mutate("observe", { workerName, controllerIdentityDigest, afterWake }),
      /** 结束本请求保护，未观测终态时保留有限grace。 / End this request's protection, retaining bounded grace without an observed terminal result. */
      close: async outcome => { closed = true; clearTimeout(renewal); await queue; return mutate("release", { outcome, dispatched: budget.dispatched, lifecycleChanged: budget.lifecycleChanged }, true); },
    };
  }
}
module.exports = { WorkerActivityClient, StageBudget, runLockedBridge };
