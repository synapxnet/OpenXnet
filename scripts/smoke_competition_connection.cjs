#!/usr/bin/env node
// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 安装版接入真实加密与沙箱桥接验收 / Installed connection OS encryption and sandbox bridge smoke.
// Author: maoyo | Department: 研发部 | Date: 2026-09-17
// Version: 1.3.0 | Security Level: INTERNAL
// __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
// __maintainer__: maoyo | __email__: synapxnet@gmail.com
'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const TEMP_PREFIX = 'openxnet-connection-electron-smoke-';
const RESULT_PREFIX = 'OPENXNET_CONNECTION_SMOKE_RESULT:';
const WORKSPACE = 'workspace-electron-smoke';

/** 限定临时目录，避免测试或清理触及真实用户数据。 / Constrain temporary storage so neither tests nor cleanup touch real user data. */
function requireTemporaryRoot(value) {
  const root = path.resolve(String(value || ''));
  assert.equal(path.dirname(root).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
  assert.ok(path.basename(root).startsWith(TEMP_PREFIX));
  return root;
}

/** 将仅用于本机临时服务的测试码注入子进程内存，输出只有脱敏结果。 / Inject a local-only temporary fixture code into child memory and return only redacted results. */
async function runElectronProcess(electronPath, root, mode, payload) {
  const environment = { ...process.env, OPENXNET_CONNECTION_SMOKE_CHILD: mode, OPENXNET_CONNECTION_SMOKE_ROOT: root, OPENXNET_CONNECTION_SMOKE_PAYLOAD: JSON.stringify(payload) };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath, [__filename], { env: environment, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const timer = setTimeout(/** 超时只结束此测试子进程。 / On timeout, terminate only this smoke subprocess. */ () => child.kill(), 45_000);
  child.stdout.on('data', /** 收集有界结果输出。 / Collect bounded result output. */ chunk => { stdout = (stdout + chunk).slice(-32_768); });
  child.stderr.on('data', /** 收集有界诊断输出。 / Collect bounded diagnostic output. */ chunk => { stderr = (stderr + chunk).slice(-16_384); });
  child.stdin.end();
  try {
    const [exitCode] = await once(child, 'close');
    assert.equal(exitCode, 0, `Electron ${mode} process failed: ${stderr}`);
    const line = stdout.split(/\r?\n/u).find(/** 仅解析固定标记的结果。 / Parse only the fixed result marker. */ item => item.startsWith(RESULT_PREFIX));
    assert.ok(line, `Electron ${mode} process omitted its result`);
    return JSON.parse(line.slice(RESULT_PREFIX.length));
  } finally { clearTimeout(timer); }
}

/** 在 Node 监督进程中顺序启动两个真实 Electron 实例并清理隔离数据。 / Supervise two sequential real Electron processes from Node and clean isolated data. */
async function runSupervisor() {
  const { AccessGrantStore } = require('../services/openxnet-agentteams-adapter/src/access-grant-store');
  const { createApplication } = require('../services/openxnet-agentteams-adapter/src/server');
  const root = requireTemporaryRoot(mkdtempSync(path.join(tmpdir(), TEMP_PREFIX)));
  const store = new AccessGrantStore(path.join(root, 'grants.json'));
  let businessCalls = 0;
  const server = createApplication({
    provisioningToken: 'isolated-smoke-admin-token-'.repeat(3),
    delegationSecret: 'isolated-smoke-delegation-token-'.repeat(3),
    accessGrantStore: store,
    credentialStore: {
      /** 提供健康检查元数据，不连接 Matrix 或模型。 / Provide health metadata without connecting to Matrix or a model. */
      async read() { return { matrixUrl: 'https://matrix.test', matrixAccessToken: 'isolated-test-session', matrixUserId: '@smoke:matrix.test' }; },
    },
    agentTeams: {
      /** 禁止接入验收创建业务团队。 / Prohibit business team creation during connection smoke. */
      async prepareTeam() { businessCalls++; throw new Error('Unexpected business call'); },
      /** 禁止接入验收调用模型或任务。 / Prohibit model or task calls during connection smoke. */
      async dispatchTask() { businessCalls++; throw new Error('Unexpected business call'); },
    },
    logger: {
      /** 静默处理测试日志，避免凭据输出。 / Silence test logs to avoid credential output. */
      info() {},
      /** 静默处理测试警告。 / Silence test warnings. */
      warn() {},
      /** 静默处理测试服务错误。 / Silence test server errors. */
      error() {},
    },
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const endpoint = `http://127.0.0.1:${server.address().port}/`;
    const grant = await store.issue({ label: 'Isolated Electron smoke', maximumRequests: 4 });
    const electronPath = require('electron');
    const written = await runElectronProcess(electronPath, root, 'write', { endpoint, workspaceId: WORKSPACE, accessCode: grant.accessCode });
    const encryptedPath = path.join(root, 'connection.enc');
    assert.equal(existsSync(encryptedPath), true);
    assert.equal(readFileSync(encryptedPath).includes(Buffer.from(grant.accessCode)), false, 'Credential must not be plaintext on disk');
    const restored = await runElectronProcess(electronPath, root, 'restore', { endpoint, workspaceId: WORKSPACE });
    assert.equal(existsSync(encryptedPath), false, 'Clearing through the preload must remove the saved configuration');
    assert.equal(businessCalls, 0);
    const result = { ok: true, verifiedAt: new Date().toISOString(), realElectronProcesses: 2, realOsEncryption: true, plaintextCredentialOnDisk: false, businessCalls, written, restored };
    assert.equal(JSON.stringify(result).includes(grant.accessCode), false);
    const output = path.resolve(__dirname, '../artifacts/access-final-review/connection-electron-smoke.json');
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise(/** 等待临时 HTTP 服务关闭。 / Wait for the temporary HTTP service to close. */ resolve => server.close(resolve));
    rmSync(requireTemporaryRoot(root), { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
}

/** 在真实沙箱窗口通过产品预加载调用四个授权 IPC 方法。 / Exercise the four authorized IPC methods through the actual product preload in a sandbox window. */
async function runElectronChild() {
  const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
  const { ApplicationCompetitionConnectionService } = require('../build-ts/desktop/competition/application-competition-connection');
  const { registerApplicationCompetitionConnectionIpc } = require('../build-ts/desktop/main/register-application-competition-connection-ipc');
  const root = requireTemporaryRoot(process.env.OPENXNET_CONNECTION_SMOKE_ROOT);
  const mode = process.env.OPENXNET_CONNECTION_SMOKE_CHILD;
  const profile = path.join(root, 'electron-profile');
  mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
  app.setPath('logs', path.join(root, 'electron-logs'));
  let window;
  let cleanupIpc;
  try {
    const input = process.env.OPENXNET_CONNECTION_SMOKE_PAYLOAD || '';
    delete process.env.OPENXNET_CONNECTION_SMOKE_PAYLOAD;
    assert.ok(input.length > 0 && input.length <= 4096);
    const request = JSON.parse(input);
    assert.ok(mode === 'write' || mode === 'restore');
    assert.equal(request.workspaceId, WORKSPACE);
    assert.equal(new URL(request.endpoint).hostname, '127.0.0.1');
    await app.whenReady();
    assert.equal(safeStorage.isEncryptionAvailable(), true, 'Real OS encryption must be available');
    const filePath = path.join(root, 'connection.enc');
    const service = new ApplicationCompetitionConnectionService({
      filePath, safeStorage,
      /** 两次进程使用相同隔离账号，永不读取真实账号。 / Use the same isolated owner across both processes without reading a real account. */
      resolveOwnerId: () => 'isolated-electron-smoke-account',
    });
    window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.resolve(__dirname, '../static/js/preload.js') } });
    cleanupIpc = registerApplicationCompetitionConnectionIpc({
      ipcMain, service,
      /** 只授权测试主窗口的主框架。 / Authorize only the main frame of this isolated test window. */
      authorizeEvent(event) { assert.equal(event.sender, window.webContents); assert.equal(event.senderFrame, window.webContents.mainFrame); },
    });
    await window.loadURL('data:text/html;charset=utf-8,<!doctype html><html><body>Isolated connection smoke</body></html>');
    const result = await window.webContents.executeJavaScript(`
      /** 从隔离 Renderer 验证实际接入方法。 / Verify the actual connection methods from the isolated renderer. */
      (async () => {
        const api = window.openxnetDesktop;
        const request = ${JSON.stringify(request)};
        const before = await api.getApplicationCompetitionConnection();
        const checked = await api.testApplicationCompetitionConnection(request);
        const changed = ${mode === 'write' ? 'await api.saveApplicationCompetitionConnection({ ...request, enabled: true })' : 'await api.clearApplicationCompetitionConnection()'};
        const after = await api.getApplicationCompetitionConnection();
        return { sandboxed: typeof window.require === 'undefined', credentialReaderExposed: typeof api.getSavedConnection !== 'undefined', before, checked, changed, after };
      })()
    `, true);
    assert.equal(result.sandboxed, true);
    assert.equal(result.credentialReaderExposed, false);
    for (const operation of ['before', 'checked', 'changed', 'after']) assert.equal(result[operation].ok, true, `${mode}:${operation} must succeed`);
    assert.equal(JSON.stringify(result).includes('oxdemo_'), false, 'IPC must never return a demo access code');
    if (mode === 'write') {
      assert.equal(result.before.snapshot.source, 'none');
      assert.equal(result.after.snapshot.enabled, true);
      assert.equal(result.after.snapshot.source, 'saved');
      assert.equal(result.after.snapshot.workspaceId, WORKSPACE);
    } else {
      assert.equal(result.before.snapshot.enabled, true, 'A new process must restore saved enablement');
      assert.equal(result.before.snapshot.credentialConfigured, true);
      assert.equal(result.before.snapshot.workspaceId, WORKSPACE);
      assert.equal(result.after.snapshot.source, 'none');
      assert.equal(result.after.snapshot.credentialConfigured, false);
    }
    process.stdout.write(`${RESULT_PREFIX}${JSON.stringify({ mode, ok: true, sandboxed: result.sandboxed, codeReturnedByIpc: false, savedBefore: result.before.snapshot.source === 'saved', savedAfter: result.after.snapshot.source === 'saved', networkCheckSucceeded: result.checked.ok })}\n`);
    cleanupIpc(); cleanupIpc = null;
    window.destroy(); window = null;
    app.exit(0);
  } catch (error) {
    if (cleanupIpc) cleanupIpc();
    if (window && !window.isDestroyed()) window.destroy();
    console.error(error?.stack || error);
    app.exit(1);
  }
}

if (process.versions.electron) {
  void runElectronChild();
} else {
  void runSupervisor().catch(/** 仅报告测试错误并使用失败退出码。 / Report only smoke errors and return a failing exit code. */ error => { console.error(error?.stack || error); process.exitCode = 1; });
}
