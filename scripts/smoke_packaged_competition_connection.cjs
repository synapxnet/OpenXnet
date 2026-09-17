#!/usr/bin/env node
// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 安装产物冷启动及接入 IPC 验收 / Packaged desktop cold-start and connection IPC smoke.
// Author: maoyo | Department: 研发部 | Date: 2026-09-17
// Version: 1.3.0 | Security Level: INTERNAL
// __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
// __maintainer__: maoyo | __email__: synapxnet@gmail.com
'use strict';

const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setTimeout: pause } = require('node:timers/promises');
const { checkStartupBudget } = require('./check_startup_budget.cjs');

const TEMP_PREFIX = 'openxnet-packaged-connection-smoke-';
const METHODS = ['getApplicationCompetitionConnection', 'testApplicationCompetitionConnection', 'saveApplicationCompetitionConnection', 'clearApplicationCompetitionConnection'];

/** 发行包允许可选能力尚未安装，但冷启动不得启动这些 Worker。 / Packaged builds may omit optional features, but cold startup must not start their workers. */
function validatePackagedCapabilities(report) {
  assert.equal(report.legacyBackendProcessActive, false);
  const capabilities = report.core?.capabilities || [];
  for (const id of ['legacy-backend', 'execution-engine', 'voice', 'connectors', 'live', 'mcp', 'agentteams', 'desktop-control']) {
    const capability = capabilities.find(/** 查找已声明的能力状态。 / Find the declared capability state. */ item => item.id === id);
    assert.ok(capability, `Missing capability: ${id}`);
    assert.ok(['stopped', 'unavailable'].includes(capability.state), `Unexpected active or failed capability: ${id}=${capability.state}`);
  }
  assert.ok(report.renderer?.milestones?.some(/** 确认历史状态通过 IPC 完成初始化。 / Confirm legacy state initialization completed through IPC. */ item => item.name === 'legacy-renderer-state-ready'));
  for (const name of ['server-port-check', 'auto-update-checks', 'chat-services']) {
    const task = report.renderer?.deferredTasks?.find(/** 查找稳定启动阶段任务。 / Find the settled startup task. */ item => item.name === name);
    assert.ok(task, `Missing startup task: ${name}`);
    assert.ok(['scheduled', 'running', 'completed'].includes(task.status), `Failed startup task: ${name}`);
  }
}

/** 只结束本次验收创建的进程树，不按名称操作用户软件。 / Stop only the process tree created by this smoke, never matching user processes by name. */
function stopOwnedProcess(child) {
  if (!child || child.exitCode !== null || !Number.isInteger(child.pid)) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5_000, stdio: 'ignore' });
  else child.kill('SIGKILL');
}

/** 为自己的调试目标建立有界 RPC 会话。 / Establish a bounded RPC session for this smoke's own debug target. */
async function connectTarget(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', /** 按请求编号解析受控调试响应。 / Match controlled debug responses by request identifier. */ event => {
    const value = JSON.parse(event.data);
    const waiting = pending.get(value.id);
    if (!waiting) return;
    pending.delete(value.id); clearTimeout(waiting.timer);
    if (value.error) waiting.reject(new Error(value.error.message));
    else waiting.resolve(value.result);
  });
  await new Promise(/** 等待本机目标连接就绪。 / Wait for the loopback target connection. */ (resolve, reject) => {
    const timer = setTimeout(/** 关闭超时连接。 / Close a timed-out connection. */ () => { socket.close(); reject(new Error('Debug target connection timed out')); }, 5_000);
    socket.addEventListener('open', /** 清理连接计时器。 / Release the connection timer. */ () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', /** 返回固定连接错误。 / Return a fixed connection error. */ () => { clearTimeout(timer); reject(new Error('Debug target connection failed')); }, { once: true });
  });
  return {
    /** 执行有期限的单次调试请求。 / Execute one deadline-bound debug request. */
    send(method, params = {}) {
      return new Promise(/** 保存此请求的完成状态。 / Store completion state for this request. */ (resolve, reject) => {
        const id = nextId++;
        const timer = setTimeout(/** 清除过期的请求。 / Remove an expired request. */ () => { pending.delete(id); reject(new Error(`Debug request timed out: ${method}`)); }, 8_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    /** 关闭仅属于本轮的连接。 / Close only the connection owned by this run. */
    close() { socket.close(); },
  };
}

/** 从独立用户目录解析临时调试地址。 / Resolve the temporary debug address from the isolated user-data directory. */
function readDebugPort(userDataDirectory, output) {
  const activePortPath = path.join(userDataDirectory, 'DevToolsActivePort');
  const match = output.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//u);
  const port = Number(existsSync(activePortPath) ? readFileSync(activePortPath, 'utf8').split(/\r?\n/u)[0] : match?.[1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/** 验证产物真实 Renderer 桥接和 Main 授权拒绝，不登录或触发网络业务。 / Verify the real packaged renderer bridge and Main authorization rejection without login or business requests. */
async function probeConnectionIpc(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2_000) });
  const targets = await response.json();
  for (const target of targets) {
    if (target.type !== 'page' || !target.webSocketDebuggerUrl || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+\//u.test(target.url)) continue;
    const session = await connectTarget(target.webSocketDebuggerUrl);
    try {
      const evaluated = await session.send('Runtime.evaluate', {
        expression: `/** 访客调用必须在 Main 授权处拒绝。 / Guest calls must be rejected by Main authorization. */ (async () => {
          const names = ${JSON.stringify(METHODS)};
          const api = window.openxnetDesktop;
          if (!api || names.some(name => typeof api[name] !== 'function')) return null;
          const results = [];
          for (const name of names) results.push({ name, result: await api[name]({}) });
          return { results, startup: window.openxnetStartup?.snapshot?.(), hasCredentialReader: typeof api.getSavedConnection !== 'undefined' };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || 'Packaged IPC raised an exception');
      const value = evaluated.result?.value;
      if (!value) continue;
      assert.equal(value.hasCredentialReader, false);
      assert.deepEqual(value.results.map(/** 只保留已调用操作名。 / Project only invoked operation names. */ item => item.name), METHODS);
      for (const item of value.results) assert.deepEqual(item.result, { ok: false, code: 'AUTH_REQUIRED' }, `${item.name} did not reach the authorized Main handler`);
      return { methods: value.results, credentialReaderExposed: false, rendererBridgePresent: true };
    } finally { session.close(); }
  }
  return null;
}

/** 用真实安装产物运行独立冷启动，复用已有报告钩子并保留脱敏验收证据。 / Cold-start the actual packaged app in isolation using existing report hooks and retain redacted evidence. */
async function runSmoke() {
  assert.ok(process.argv[2], 'Usage: node scripts/smoke_packaged_competition_connection.cjs <packaged executable>');
  const executable = path.resolve(process.argv[2]);
  assert.ok(existsSync(executable), 'Packaged executable does not exist');
  const root = mkdtempSync(path.join(tmpdir(), TEMP_PREFIX));
  const userDataDirectory = path.join(root, 'user-data');
  const reportPath = path.join(root, 'startup-report.json');
  mkdirSync(userDataDirectory, { recursive: true });
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (key.startsWith('OPENXNET_') || key === 'ELECTRON_RUN_AS_NODE') delete environment[key];
  Object.assign(environment, {
    OPENXNET_USER_DATA_DIR: userDataDirectory,
    OPENXNET_STARTUP_REPORT: reportPath,
    OPENXNET_STARTUP_REPORT_SETTLE_MS: '15000',
    OPENXNET_EXIT_AFTER_STARTUP_REPORT: '1',
    OPENXNET_SKIP_UTF8_CONSOLE: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
  });
  const child = spawn(executable, ['--hidden', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'], { cwd: path.dirname(executable), env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let closed = false;
  let exitCode;
  let spawnError;
  child.stdout.on('data', /** 收集有界启动诊断，不保留用户数据。 / Collect bounded startup diagnostics without retaining user data. */ chunk => { output = (output + chunk).slice(-1024 * 1024); });
  child.stderr.on('data', /** 收集有界引擎诊断。 / Collect bounded engine diagnostics. */ chunk => { output = (output + chunk).slice(-1024 * 1024); });
  child.once('close', /** 记录本次进程的最终状态。 / Record final state for this process only. */ code => { closed = true; exitCode = code; });
  child.once('error', /** 记录启动失败。 / Record a launch failure. */ error => { spawnError = error; });
  let ipc;
  let lastProbeError = '';
  try {
    const deadline = Date.now() + 75_000;
    while (!closed && Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (!ipc) {
        const port = readDebugPort(userDataDirectory, output);
        if (port) {
          try { ipc = await probeConnectionIpc(port); }
          catch (error) { lastProbeError = String(error?.message || error); }
        }
      }
      await pause(200);
    }
    assert.equal(closed, true, 'Packaged application did not finish its bounded cold-start report');
    assert.equal(exitCode, 0, `Packaged startup failed: ${output.slice(-12000)}`);
    assert.ok(existsSync(reportPath), `Main did not write its startup report: ${output.slice(-12000)}`);
    assert.ok(ipc, `Packaged renderer did not expose the four connection IPC operations: ${lastProbeError}`);
    assert.doesNotMatch(output, /ReferenceError:|SyntaxError:|Cannot find module|UnhandledPromiseRejection|uncaught exception|FATAL:/iu);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    checkStartupBudget(report, 30_000, 10_000);
    validatePackagedCapabilities(report);
    const result = { ok: true, verifiedAt: new Date().toISOString(), executable, isolatedProfile: true, processElapsedMs: report.processElapsedMs, workspaceElapsedMs: report.workspaceElapsedMs, legacyBackendProcessActive: report.legacyBackendProcessActive, workspaceReady: true, fatalStartupError: false, ipc, startup: report };
    const outputPath = path.resolve(__dirname, '../artifacts/access-final-review/packaged-connection-smoke.json');
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ ok: true, outputPath, processElapsedMs: report.processElapsedMs, workspaceElapsedMs: report.workspaceElapsedMs, authenticatedConnectionChannels: ipc.methods.length })}\n`);
  } finally {
    stopOwnedProcess(child);
    for (let attempt = 0; !closed && attempt < 20; attempt++) await pause(100);
    assert.equal(path.dirname(path.resolve(root)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(root).startsWith(TEMP_PREFIX));
    try { rmSync(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
    catch { process.stderr.write(`Temporary smoke directory remains: ${root}\n`); }
  }
}

void runSmoke().catch(/** 保留失败退出码并输出可定位诊断。 / Preserve a failing exit code and actionable diagnostics. */ error => { console.error(error?.stack || error); process.exitCode = 1; });
