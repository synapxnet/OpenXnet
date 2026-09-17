/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
企业会话并发、头像与投影行为验证 / Enterprise conversation concurrency, portrait and projection behavior tests.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { parse } = require('@babel/parser');
const experience = require('../static/js/openxnet-enterprise-chat-experience.js');
const model = require('../static/js/openxnet-conversation-model.js');
const { ApplicationEnterpriseRuntimeService } = require('../build-ts/desktop/enterprise/application-enterprise-runtime.js');
const source = fs.readFileSync(path.join(__dirname, '../static/js/vue_methods.js'), 'utf8');
const ast = parse(source, { sourceType: 'script' });
const declaration = ast.program.body.find(/** 查找真实宿主方法表。 Find the real host method table. */ node => node.type === 'VariableDeclaration' && node.declarations.some(/** 识别宿主变量。 Identify the host variable. */ item => item.id.name === 'vue_methods'));
const methods = declaration.declarations.find(/** 返回宿主声明。 Return the host declaration. */ item => item.id.name === 'vue_methods').init.properties;

/** 创建不会发送实际消息的隔离宿主。 Create an isolated host that cannot send real messages. */
function createHost(overrides = {}, browser = {}) {
  const window = { OpenXnetConversationModel: model, ...browser };
  const context = vm.createContext({ window, console: { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ error() {}, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ warn() {} }, document: { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ querySelector() { return null; } }, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ showNotification() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/openxnet-enterprise-chat-experience.js'), 'utf8'), context);
  const ui = window.OpenXnetEnterpriseChatExperience;
  const host = { ...ui.createState(), ...ui.methods, sandboxCurrentWs: 'workspace-a', sandboxCurrentProject: null,
    enterpriseMessages: [], enterpriseChatInput: '', enterpriseChatRecipientIds: [], enterpriseChatLoading: false, enterpriseChatSending: false, enterpriseChatTaskStarting: false,
    enterpriseWorkspaces: [], enterpriseProjects: [], staffRoles: [], competitionSnapshot: {}, competitionTeamRuntime: 'builtin',
    enterpriseCompetitionScenarioType: 'feature-drift',
    /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ isCurrentLanguageZh() { return true; }, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ $nextTick(callback) { if (callback) callback(); },
  };
  for (const name of ['getEnterpriseChatWorkspaceId', 'getEnterpriseChatProjectId', 'loadEnterpriseMessages', 'scrollEnterpriseChatToBottom', 'sendEnterpriseMessage', 'startEnterpriseCompetitionTask', 'getEnterpriseMessageInvocations', 'getEnterpriseSandboxIncidents', 'getEnterpriseInvocationActorLabel', 'getEnterpriseInvocationEvidence', 'getEnterpriseInvocationReceipt', 'getEnterpriseInvocationDuration']) {
    const node = methods.find(/** 查找需要测试的真实方法。 Find the actual method under test. */ item => item.key?.name === name);
    host[name] = vm.runInContext(`({${source.slice(node.start, node.end)}})`, context)[name];
  }
  Object.assign(host, overrides);
  host.ensureEnterpriseChatScope();
  return host;
}

/** 控制请求完成顺序以复现真实竞争。 Control completion order to reproduce real request races. */
function deferred() {
  let resolve; let reject;
  const promise = new Promise(/** 暴露测试专用回调。 Expose test-only completion callbacks. */ (yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** 生成有明确范围的消息夹具。 Build a message fixture with an explicit scope. */
function message(id, workspaceId = 'workspace-a', projectId = null, extras = {}) {
  return { id, workspaceId, projectId, senderId: 'staff-one', senderType: 'agent', senderName: 'Evidence', content: `Message ${id}`, operation: null, ...extras };
}

/** 创建正式结构的只读响应。 Create a read-only response with the production envelope. */
function listed(messages) { return { schema: 'openxnet.enterprise.v1', success: true, messages }; }

/** 将跨 VM 数值复制成当前环境对象。 Copy cross-VM values into this context. */
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('late reads and failures cannot replace a new workspace or its loading state', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const a = deferred(); const b = deferred();
  const host = createHost({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationEnterpriseRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ listApplicationEnterpriseMessages(request) { return request.workspaceId === 'workspace-a' ? a.promise : b.promise; } }; } });
  host.enterpriseChatInput = 'Draft A';
  const first = host.loadEnterpriseMessages();
  host.sandboxCurrentWs = 'workspace-b';
  const second = host.loadEnterpriseMessages();
  assert.equal(host.enterpriseChatInput, '');
  host.enterpriseChatInput = 'Draft B';
  a.reject(new Error('private A failure'));
  await first;
  assert.equal(host.enterpriseChatLoading, true);
  assert.equal(host.enterpriseChatLoadError, '');
  b.resolve(listed([message('b', 'workspace-b'), message('leaked-a')]));
  await second;
  assert.deepEqual(plain(host.enterpriseMessages.map(/** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ item => item.id)), ['b']);
  assert.equal(host.enterpriseChatInput, 'Draft B');
  host.sandboxCurrentWs = 'workspace-a'; host.ensureEnterpriseChatScope();
  assert.equal(host.enterpriseChatInput, 'Draft A');
  assert.equal(host.enterpriseMessages.length, 0);
});

test('newer same-scope reads win and silent failures preserve records and action errors', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const old = deferred(); const next = deferred(); let calls = 0;
  const host = createHost({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationEnterpriseRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ listApplicationEnterpriseMessages() { return ++calls === 1 ? old.promise : next.promise; } }; } });
  const first = host.loadEnterpriseMessages(); const second = host.loadEnterpriseMessages({ silent: true });
  next.resolve(listed([message('new')])); await second;
  old.resolve(listed([message('old')])); await first;
  assert.equal(host.enterpriseMessages[0].id, 'new');
  host.enterpriseChatActionError = 'Send failed';
  host.getApplicationEnterpriseRuntime = /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => ({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async listApplicationEnterpriseMessages() { throw new Error('Offline'); } });
  await host.loadEnterpriseMessages({ silent: true });
  assert.equal(host.enterpriseChatLoadError, 'Offline');
  assert.equal(host.enterpriseMessages[0].id, 'new');
  host.getApplicationEnterpriseRuntime = /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => ({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async listApplicationEnterpriseMessages() { return listed([]); } });
  await host.loadEnterpriseMessages();
  assert.equal(host.enterpriseChatLoadError, '');
  assert.equal(host.enterpriseChatActionError, 'Send failed');
});

test('project views include workspace announcements but exclude other projects immediately', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => {
  const host = createHost({ sandboxCurrentProject: 'project-a' });
  host.enterpriseMessages = [message('common'), message('own', 'workspace-a', 'project-a'), message('other', 'workspace-a', 'project-b'), message('foreign', 'workspace-b')];
  assert.deepEqual(plain(host.getEnterpriseVisibleMessages().map(/** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ item => item.id)), ['common', 'own']);
  host.sandboxCurrentProject = null;
  assert.deepEqual(plain(host.getEnterpriseVisibleMessages().map(/** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ item => item.id)), ['common']);
});

test('sending retains edits, suppresses duplicates and never starts an investigation', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const pending = deferred(); let sent = 0;
  const host = createHost({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationEnterpriseRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ postApplicationEnterpriseMessage(request) { sent += 1; assert.equal(request.content, 'Original'); return pending.promise; } }; }, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationCompetitionRuntime() { throw new Error('Must not start task'); } });
  host.enterpriseChatInput = 'Original';
  const send = host.sendEnterpriseMessage();
  host.enterpriseChatInput = 'New draft';
  await host.sendEnterpriseMessage();
  host.enterpriseMessages = [message('posted')];
  pending.resolve({ success: true, message: message('posted') });
  await send;
  assert.equal(sent, 1);
  assert.equal(host.enterpriseChatInput, 'New draft');
  assert.equal(host.enterpriseMessages.length, 1);
});

test('confirming Chinese IME composition never submits the enterprise draft', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => {
  let sent = 0; let prevented = 0;
  const host = createHost();
  host.sendEnterpriseMessage = /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => { sent += 1; };
  host.handleEnterpriseComposerEnter({ isComposing: true, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ preventDefault() { prevented += 1; } });
  host.handleEnterpriseComposerEnter({ keyCode: 229, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ preventDefault() { prevented += 1; } });
  assert.equal(sent, 0); assert.equal(prevented, 0);
  host.handleEnterpriseComposerEnter({ isComposing: false, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ preventDefault() { prevented += 1; } });
  assert.equal(sent, 1); assert.equal(prevented, 1);
});

test('a late send cannot erase another scope draft and its failure stays with the origin', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const pending = deferred();
  const host = createHost({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationEnterpriseRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ postApplicationEnterpriseMessage() { return pending.promise; } }; } });
  host.enterpriseChatInput = 'Draft A';
  const sending = host.sendEnterpriseMessage();
  host.sandboxCurrentWs = 'workspace-b'; host.ensureEnterpriseChatScope(); host.enterpriseChatInput = 'Draft B';
  pending.reject(new Error('Origin send failed')); await sending;
  assert.equal(host.enterpriseChatInput, 'Draft B');
  assert.equal(host.enterpriseChatActionError, '');
  host.sandboxCurrentWs = 'workspace-a'; host.ensureEnterpriseChatScope();
  assert.equal(host.enterpriseChatInput, 'Draft A');
  assert.equal(host.enterpriseChatActionError, 'Origin send failed');
});

test('a task reply after a scope change cannot replace the current competition snapshot', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const pending = deferred();
  const snapshot = { incidents: [] };
  const host = createHost({ competitionSnapshot: snapshot, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationCompetitionRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ startApplicationCompetitionEnterpriseTask() { return pending.promise; } }; } });
  host.enterpriseChatInput = 'Investigate A';
  const starting = host.startEnterpriseCompetitionTask();
  host.sandboxCurrentWs = 'workspace-b'; host.ensureEnterpriseChatScope(); host.enterpriseChatInput = 'Private B';
  pending.resolve({ success: true, incidentId: 'a', snapshot: { incidents: [{ incidentId: 'a', workspaceId: 'workspace-a', projectId: null }] } });
  await starting;
  assert.equal(host.competitionSnapshot, snapshot);
  assert.equal(host.enterpriseChatInput, 'Private B');
  assert.equal(host.enterpriseChatTaskStarting, false);
});

test('receipts require request, trace, incident and workspace; same tool names never prove success', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => {
  const call = { requestId: 'request-a', traceId: 'trace-a', workspaceId: 'workspace-a', incidentId: 'incident-a', toolName: 'same-tool' };
  const host = createHost({ competitionSnapshot: { auditReceipts: [
    { ...call, receiptId: 'wrong-request', requestId: 'request-b' }, { ...call, receiptId: 'wrong-trace', traceId: 'trace-b' },
    { ...call, receiptId: 'wrong-workspace', workspaceId: 'workspace-b' }, { ...call, receiptId: 'wrong-incident', incidentId: 'incident-b' },
  ] } });
  assert.equal(host.getEnterpriseInvocationReceipt(call), null);
  host.competitionSnapshot.auditReceipts.push({ ...call, receiptId: 'exact' });
  assert.equal(host.getEnterpriseInvocationReceipt(call).receiptId, 'exact');
});

test('the real competition result envelope updates only the verified incident without inventing completion', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const snapshot = { incidents: [{ incidentId: 'incident-a', workspaceId: 'workspace-a', projectId: null, status: 'AWAITING_APPROVAL' }] };
  const host = createHost({ /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationCompetitionRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async startApplicationCompetitionEnterpriseTask() { return { snapshot, incidentId: 'incident-a', traceId: 'trace-a', approvalId: 'approval-a', actionId: null, retrospectivePath: null, retrospectiveSkillId: null }; } }; }, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationEnterpriseRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async listApplicationEnterpriseMessages() { return listed([message('task-a')]); } }; } });
  host.enterpriseChatInput = 'Investigate'; await host.startEnterpriseCompetitionTask();
  assert.equal(host.competitionSnapshot, snapshot); assert.equal(host.enterpriseAuditIncidentId, 'incident-a');
  assert.equal(host.enterpriseChatInput, ''); assert.equal(host.enterpriseChatActionError, '');
  assert.equal(host.competitionSnapshot.incidents[0].status, 'AWAITING_APPROVAL');
});

test('invocations and subagents use explicit IDs and matching workspace, trace and task', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => {
  const call = { invocationId: 'call-a', workspaceId: 'workspace-a', traceId: 'trace-a', incidentId: 'incident-a', startedAt: '' };
  const decision = { decisionId: 'decision-a', workspaceId: 'workspace-a', traceId: 'trace-a', taskId: 'task-a' };
  const host = createHost({ competitionSnapshot: { incidents: [{ incidentId: 'incident-a', workspaceId: 'workspace-a', projectId: null }], invocations: [call, { ...call, workspaceId: 'workspace-b' }, { ...call, traceId: 'trace-b' }], agentDecisions: [decision, { ...decision, taskId: 'task-b' }, { ...decision, workspaceId: 'workspace-b' }] } });
  const msg = message('operation', 'workspace-a', null, { taskId: 'task-a', traceId: 'trace-a', operation: { invocationIds: ['call-a'] } });
  assert.equal(host.getEnterpriseMessageInvocations(msg).length, 1);
  assert.equal(host.getEnterpriseMessageAgents(msg).length, 1);
  assert.equal(host.getEnterpriseMessageInvocations({ ...msg, traceId: null }).length, 0);
});

test('new messages preserve reading position until the user returns to latest', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const element = { scrollTop: 100, scrollHeight: 1000, clientHeight: 300 };
  const host = createHost({ $refs: { enterpriseChatMessages: element }, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ getApplicationEnterpriseRuntime() { return { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async listApplicationEnterpriseMessages() { return listed([message('old'), message('new')]); } }; } });
  host.enterpriseMessages = [message('old')]; host.onEnterpriseChatScroll({ target: element });
  await host.loadEnterpriseMessages({ silent: true });
  assert.equal(element.scrollTop, 100);
  assert.equal(host.enterpriseChatNewCount, 1);
  await host.loadEnterpriseMessages({ silent: true });
  assert.equal(host.enterpriseChatNewCount, 1);
  host.scrollEnterpriseChatToBottom();
  assert.equal(element.scrollTop, 1000); assert.equal(host.enterpriseChatNewCount, 0); assert.equal(host.enterpriseChatPinned, true);
});

test('portrait persistence survives restart and rejects remote, script and traversal sources', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openxnet-enterprise-portrait-'));
  try {
    const runtime = new ApplicationEnterpriseRuntimeService({ userDataDirectory: directory });
    const saved = (await runtime.saveRoleCard({ mode: 'create', roleCard: { id: 'portrait-role', name: 'Evidence', enabled: false, avatarUrl: '/uploaded_files/portrait-a.png', skill_ids: ['read-evidence'], tools: ['tool-a'] } })).card;
    assert.equal(saved.enabled, false);
    assert.equal((await new ApplicationEnterpriseRuntimeService({ userDataDirectory: directory }).listRoleCards()).cards[0].avatarUrl, '/uploaded_files/portrait-a.png');
    for (const avatarUrl of ['https://example.com/a.png', 'data:image/png;base64,eA==', 'file:///a.png', '/uploaded_files/../a.png', '/uploaded_files/%2e%2e/a.png', '/uploaded_files/a.svg', '/uploaded_files/a.png?x=1', '/uploaded_files/a..png']) {
      assert.equal(experience.safeAvatarUrl(avatarUrl), '');
      await assert.rejects(runtime.saveRoleCard({ mode: 'update', roleCard: { ...saved, avatarUrl } }), /avatar/);
    }
    assert.equal((await runtime.listRoleCards()).cards[0].avatarUrl, saved.avatarUrl);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('portrait import uses the existing artifact boundary and preserves the disabled employee', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async () => {
  let saved; let createAgent;
  const host = createHost({ staffRoles: [{ id: 'staff-one', name: 'Evidence', enabled: false, skill_ids: ['read'] }], selected3DAgent: { id: 'staff-one' }, /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async persistStaffRoleToEnterprise(role, options) { saved = role; createAgent = options.createAgent; } }, { openxnetDesktop: { /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ async importSelectedArtifacts(files) { assert.equal(files.length, 1); return { artifacts: [{ kind: 'image', status: 'available', storageName: 'artifact-a.png' }] }; } } });
  await host.importEnterpriseStaffAvatar({ target: { value: 'file', files: [{ type: 'image/png', size: 123 }] } });
  assert.equal(saved.avatarUrl, '/uploaded_files/artifact-a.png'); assert.equal(saved.enabled, false); assert.equal(createAgent, false);
  assert.deepEqual(plain(saved.skill_ids), ['read']);
  saved = null;
  await host.importEnterpriseStaffAvatar({ target: { files: [{ type: 'image/svg+xml', size: 123 }] } });
  assert.equal(saved, null); assert.match(host.enterpriseChatActionError, /PNG/);
});

test('VR projection keeps stable identity and parent announcements while excluding private payloads', /** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ () => {
  const host = createHost({ sandboxCurrentProject: 'project-a', staffRoles: [{ id: 'staff-one', avatarUrl: '/uploaded_files/a.png' }], selected3DAgent: { id: 'different-staff', name: 'Wrong identity' } });
  host.enterpriseMessages = [message('common', 'workspace-a', null, { content: 'Public announcement', memoryContext: [{ text: 'PRIVATE_MEMORY' }], tool_input: 'PRIVATE_TOOL' }), message('own', 'workspace-a', 'project-a'), message('foreign', 'workspace-b')];
  const safe = host.getEnterpriseConversationProjection();
  assert.deepEqual(plain(safe.messages.map(/** 隔离测试夹具与断言回调。 Isolated test fixture or assertion callback. */ item => item.id)), ['common', 'own']);
  assert.equal(safe.messages[0].identity.name, 'Evidence'); assert.equal(safe.messages[0].identity.image, '/uploaded_files/a.png');
  assert.doesNotMatch(JSON.stringify(safe), /Public announcement|PRIVATE|Wrong identity/);
  assert.equal(host.getEnterpriseConversationProjection({ includeTextPreview: true }).messages[0].textPreview, 'Public announcement');
});
