#!/usr/bin/env node
// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 桌面与服务端真实 HTTP 接入契约 / Real HTTP desktop-to-service connection contract.
// Author: maoyo | Department: 研发部 | Date: 2026-09-17
// Version: 1.3.0 | Security Level: INTERNAL | Maintainer: maoyo
// Email: synapxnet@gmail.com
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync, readFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { ApplicationCompetitionConnectionService } = require('../build-ts/desktop/competition/application-competition-connection');
const { AccessGrantStore } = require('../services/openxnet-agentteams-adapter/src/access-grant-store');
const { createApplication } = require('../services/openxnet-agentteams-adapter/src/server');

/** 测试系统加密替身；真正 Windows 加密在 Electron 验收覆盖。 / Encryption substitute for Node tests; Electron acceptance covers actual Windows encryption. */
function encryptedStorage() {
  const key = randomBytes(32);
  return {
    /** 返回测试可用状态。 / Return test availability. */
    isEncryptionAvailable: () => true,
    /** 使用临时进程密钥加密测试数据。 / Encrypt test data with an ephemeral process key. */
    encryptString(value) {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    /** 解密测试目录里的字节。 / Decrypt bytes from the test directory. */
    decryptString(value) {
      const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}

test('installed connection uses the actual access-code HTTP protocol, persists and rejects revoked scope', /** 跨组件验证真实协议而非分别伪造回包。 / Verify the real cross-component protocol rather than separate response mocks. */ async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'openxnet-connection-http-'));
  const store = new AccessGrantStore(path.join(directory, 'grants.json'));
  let businessCalls = 0;
  const server = createApplication({
    provisioningToken: 'test-admin-credential-'.repeat(3), delegationSecret: 'test-delegation-secret-'.repeat(3), accessGrantStore: store,
    credentialStore: { /** 提供固定测试会话，不访问任何真实模型。 / Provide a test session without accessing real models. */ read: async () => ({ matrixUrl: 'https://matrix.test', matrixAccessToken: 'test-session', matrixUserId: '@test:matrix.test' }) },
    agentTeams: { /** 接入测试不得准备团队。 / Connection checks must not prepare teams. */ prepareTeam: async () => { businessCalls++; throw new Error('Unexpected business call'); }, /** 接入测试不得派发任务。 / Connection checks must not dispatch tasks. */ dispatchTask: async () => { businessCalls++; throw new Error('Unexpected business call'); } },
    logger: { /** 不记录测试凭据。 / Do not log test credentials. */ info() {}, /** 不记录测试凭据。 / Do not log test credentials. */ warn() {}, /** 不记录测试凭据。 / Do not log test credentials. */ error() {} },
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(/** 关闭隔离服务器并清理测试目录。 / Close the isolated server and remove test data. */ async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true, force: true }); });
  const endpoint = `http://127.0.0.1:${server.address().port}/`;
  const grant = await store.issue({ label: 'HTTP integration', maximumRequests: 4 });
  const filePath = path.join(directory, 'desktop.enc');
  const options = { filePath, safeStorage: encryptedStorage(), resolveOwnerId: () => 'test-account' };
  const connection = new ApplicationCompetitionConnectionService(options);
  const request = { endpoint, workspaceId: 'workspace-test', accessCode: grant.accessCode };
  assert.equal((await connection.test(request)).ok, true);
  assert.equal(existsSync(filePath), false, 'Testing must not save');
  assert.equal((await store.inspect(grant.accessCode, null, false, true)).workspaceId, null, 'Testing must not bind');
  const saved = await connection.save({ ...request, enabled: true });
  assert.equal(saved.ok, true);
  assert.equal(saved.snapshot.source, 'saved');
  assert.equal(saved.snapshot.workspaceId, 'workspace-test');
  assert.equal(readFileSync(filePath).includes(Buffer.from(grant.accessCode)), false);
  assert.equal(JSON.stringify(saved).includes(grant.accessCode), false);
  const restored = new ApplicationCompetitionConnectionService(options);
  assert.equal(restored.getSnapshot().enabled, true);
  assert.equal((await restored.test({ endpoint, workspaceId: 'workspace-test' })).ok, true);
  assert.equal((await restored.test({ endpoint, workspaceId: 'workspace-other', accessCode: grant.accessCode })).code, 'ACCESS_SCOPE_MISMATCH');
  const before = readFileSync(filePath);
  await store.revoke(grant.grantId);
  assert.equal((await restored.test({ endpoint, workspaceId: 'workspace-test' })).code, 'ACCESS_REVOKED');
  assert.deepEqual(readFileSync(filePath), before, 'Failed checks must preserve settings');
  assert.equal(businessCalls, 0);
});
