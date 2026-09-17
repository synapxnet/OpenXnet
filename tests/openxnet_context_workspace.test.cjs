const test = require('node:test');
const assert = require('node:assert/strict');

const TASK_ID = '9e245a40-d6e5-4a55-9fe8-500873ca2ec8';
const WORKSPACE = 'E:\\SynapXnet\\openxnet-source';
const create = async (host, api = {}) => {
  const { createContextWorkspaceBridge } = await import('../frontend/ops-vite/src/context-workspace.js');
  return createContextWorkspaceBridge({ getHost: () => host, getDesktopApi: () => api });
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const baseHost = () => ({
  CLISettings: { cc_path: WORKSPACE },
  conversationId: 'live',
  conversations: [
    { id: 'live', title: 'Current', messages: [{ role: 'user', content: 'old live copy' }] },
    { id: 'history', title: 'History', messages: [{ id: 'h1', role: 'user', content: 'saved transcript' }] },
    { id: 'unloaded', title: 'Unavailable history' },
    { id: 'placeholder', isPlaceholder: true, messages: [] },
  ],
  messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'live transcript' }, { type: 'image', url: 'private' }] }],
  mainAgent: 'custom-agent', agents: { 'custom-agent': { name: 'Configured agent', apiKey: 'do-not-project' } },
  taskList: [],
});

test('snapshot projects detached resident text; local selectors never switch the running session', async () => {
  const host = baseHost();
  host.loadConversation = host.saveSettings = () => assert.fail('business action called');
  host.getPrototypeConversationItems = () => assert.fail('snapshot must read resident state directly');
  const before = JSON.stringify(host);
  const bridge = await create(host, new Proxy({}, { get: () => assert.fail('snapshot or selector called an API') }));
  const live = bridge.snapshot();
  assert.equal(live.session.messages[0].content, 'live transcript');
  assert.equal(live.sessions.length, 3);
  assert.equal(live.workspace.directory, WORKSPACE);
  assert.equal(live.workspace.enterpriseWorkspaceId, '');
  live.session.messages[0].content = 'edit snapshot';
  live.agents[0].name = 'edit agent';
  assert.equal(bridge.snapshot().session.messages[0].content, 'live transcript');
  assert.equal(bridge.selectSession('history').session.messages[0].content, 'saved transcript');
  assert.equal(bridge.selectSession('unloaded').session.availability, 'unavailable');
  bridge.selectAgent('custom-agent');
  assert.equal(host.conversationId, 'live');
  assert.equal(JSON.stringify(host), before);
  assert.deepEqual(bridge.snapshot().measurement, { tokenCount: null, assembledInputAvailable: false, kind: 'unknown' });
  assert.doesNotMatch(JSON.stringify(bridge.snapshot()), /apiKey|do-not-project|private/);
});

test('missing readers and rejected readers preserve available content with explicit availability', async () => {
  const host = baseHost();
  const missing = await create(host);
  const missingSnapshot = await missing.refresh();
  assert.equal(missingSnapshot.recall.availability, 'unavailable');
  assert.equal(missingSnapshot.taskCatalog.availability, 'unavailable');
  assert.equal(missingSnapshot.session.availability, 'available');
  const denied = await create(host, {
    listTasks: async () => { throw new Error('Task access denied'); },
    getApplicationRecallBootstrap: async () => { throw new Error('Recall unavailable'); },
  });
  const result = await denied.refresh();
  assert.equal(result.loading, false);
  assert.equal(result.taskCatalog.availability, 'error');
  assert.equal(result.recall.availability, 'error');
  assert.match(result.error, /Task access denied/);
  assert.equal(result.session.messages[0].content, 'live transcript');
});

test('ordinary tasks use typed read APIs and real legacy recall ids without invoking reconciliation', async () => {
  const host = baseHost();
  const requests = [];
  const task = {
    id: TASK_ID, legacyTaskId: 'worker-task-7', workspaceId: 'core-workspace', workspacePath: WORKSPACE,
    title: 'Review changes', description: 'Inspect the patch', status: 'running', resultSummary: 'Two findings',
    details: { members: [{ id: 'reviewer', name: 'Review Agent', role: 'reviewer', apiKey: 'private' }] },
    artifacts: [{ artifactId: 'artifact-1', label: 'Patch input' }],
  };
  const api = {
    listTasks: async (request) => { requests.push(['list', request]); return { tasks: [task] }; },
    getTaskExecution: async (request) => {
      requests.push(['detail', request]);
      return { task, events: [{ id: 'event-1', type: 'started', message: 'Review started', createdAt: '2026-09-13', agentId: 'reviewer', private: 'hidden' }], childTasks: [], consensusContent: '' };
    },
    getApplicationRecallBootstrap: async () => ({ overview: { workspace: WORKSPACE, recent_sessions: [{ session_id: 'live', title: 'Current', summary: 'Saved summary', apiKey: 'private' }] }, interrupted: [] }),
    getApplicationRecallObservations: async (request) => { requests.push(['observations', request]); return { workspace: WORKSPACE, observations: [{ id: 'obs', summary: 'Review observation', rawToolResult: { secret: 'private' } }] }; },
    getApplicationRecallTimeline: async () => ({ workspace: WORKSPACE, timeline: [] }),
    refreshTaskExecutions: () => assert.fail('reconciliation is not a read'),
  };
  const bridge = await create(host, api);
  await bridge.refresh();
  bridge.selectTask(`task:${TASK_ID}`);
  const result = await bridge.refresh();
  assert.deepEqual(requests.find(([name]) => name === 'list')[1], { workspacePath: WORKSPACE });
  assert.deepEqual(requests.find(([name]) => name === 'detail')[1], { taskId: TASK_ID });
  assert.equal(requests.filter(([name]) => name === 'observations').at(-1)[1].taskId, 'worker-task-7');
  assert.equal(result.task.detailAvailability, 'available');
  assert.equal(result.task.goal, 'Inspect the patch');
  assert.deepEqual(result.task.members, [{ id: 'reviewer', name: 'Review Agent', role: 'reviewer' }]);
  assert.deepEqual(result.task.events[0], { id: 'event-1', title: 'started', summary: 'Review started', timestamp: '2026-09-13', agentId: 'reviewer', status: '' });
  assert.doesNotMatch(JSON.stringify(result), /rawToolResult|apiKey|private|hidden/);
  assert.equal(bridge.selectAgent('reviewer').task.events.length, 1);
  assert.equal(bridge.snapshot().task.detailAvailability, 'available');
  assert.equal(bridge.selectAgent('another-agent').task.events.length, 0);
});

test('late responses cannot replace a new local session selection or a newer refresh', async () => {
  const host = baseHost();
  const old = deferred();
  let calls = 0;
  const bridge = await create(host, {
    getApplicationRecallBootstrap: async () => ++calls === 1 ? old.promise : { overview: { workspace: WORKSPACE, recent_sessions: [{ id: 'new', title: 'New scope' }] } },
  });
  const firstRefresh = bridge.refresh();
  assert.equal(bridge.snapshot().loading, true);
  bridge.selectSession('history');
  assert.equal(bridge.snapshot().loading, false);
  const second = await bridge.refresh();
  assert.equal(second.recall.sessions[0].id, 'new');
  old.resolve({ overview: { workspace: WORKSPACE, recent_sessions: [{ id: 'old', title: 'Old scope' }] } });
  const afterOld = await firstRefresh;
  assert.equal(afterOld.scope.sessionId, 'history');
  assert.equal(afterOld.recall.sessions[0].id, 'new');
  assert.equal(afterOld.session.messages[0].content, 'saved transcript');
});

test('workspace changes invalidate both in-flight responses and previously read caches', async () => {
  const host = baseHost();
  const delayed = deferred();
  const bridge = await create(host, { listTasks: () => delayed.promise });
  const pending = bridge.refresh();
  host.CLISettings.cc_path = 'E:\\OtherProject';
  delayed.resolve({ tasks: [{ id: TASK_ID, workspacePath: WORKSPACE, title: 'Old workspace task' }] });
  const result = await pending;
  assert.equal(result.workspace.directory, 'E:\\OtherProject');
  assert.equal(result.tasks.length, 0);
  assert.equal(result.loading, false);
  const mismatch = await create(host, {
    getApplicationRecallBootstrap: async () => ({ overview: { workspace: WORKSPACE, recent_sessions: [{ id: 'wrong' }] } }),
    getApplicationRecallObservations: async () => ({ workspace: WORKSPACE, observations: [{ id: 'wrong' }] }),
  });
  const mismatchResult = await mismatch.refresh();
  assert.equal(mismatchResult.recall.availability, 'error');
  assert.equal(mismatchResult.recall.sessions.length, 0);
  assert.equal(mismatchResult.recall.observations.length, 0);
});

test('legacy task IDs remain resident projections rather than invalid Core detail requests', async () => {
  const host = baseHost();
  host.taskList = [{ task_id: 'legacy-task', title: 'Legacy task', goal: 'Keep the original task', status: 'pending', recent_trace_excerpt: 'Recorded worker output' }];
  const bridge = await create(host, { getTask: () => assert.fail('legacy ID sent to UUID API') });
  bridge.selectTask('task:legacy-task');
  const result = await bridge.refresh();
  assert.equal(result.task.title, 'Legacy task');
  assert.equal(result.task.availability, 'available');
  assert.equal(result.task.detailAvailability, 'unavailable');
  assert.equal(result.task.events[0].summary, 'Recorded worker output');
});

test('production defaults do not activate the optional incident reader', async () => {
  const host = baseHost();
  host.competitionReleaseProfile = 'production';
  host.competitionRehearsalAvailable = false;
  host.competitionSnapshot = { incidents: [], updatedAt: '' };
  const bridge = await create(host, {
    getApplicationCompetitionUiProfile: async () => ({ releaseProfile: 'production', rehearsalEnabled: false }),
    getApplicationCompetitionSnapshot: () => assert.fail('unconfigured incident reader called'),
  });
  const result = await bridge.refresh();
  assert.equal(result.extensions.rehearsalEnabled, false);
  assert.equal(result.incidentCatalog.availability, 'unavailable');
  assert.deepEqual(result.tasks, []);
});

test('configured incidents share the task list and expose only actual active-trace members and handoffs', async () => {
  const host = baseHost();
  host.sandboxCurrentWs = 'enterprise-workspace';
  host.sandboxCurrentProject = 'project-1';
  host.enterpriseWorkspaces = [{ id: 'enterprise-workspace', name: 'Enterprise space' }];
  host.enterpriseProjects = [{ id: 'project-1', workspaceId: 'enterprise-workspace', name: 'Existing project' }];
  const incident = { incidentId: TASK_ID, title: 'Existing incident', summary: 'Investigate actual evidence', workspaceId: 'enterprise-workspace', projectId: 'project-1', activeTraceId: 'trace-current' };
  const current = { incidentId: TASK_ID, workspaceId: 'enterprise-workspace', traceId: 'trace-current' };
  const old = { ...current, traceId: 'trace-old' };
  const competition = {
    incidents: [incident, { ...incident, incidentId: 'another-project', projectId: 'project-2' }],
    teamBindings: [
      { ...current, memberSnapshots: [{ roleCardId: 'configured-worker', name: 'Actual worker', teamRole: 'worker', systemPrompt: 'not-a-current-prompt' }] },
      { ...old, memberSnapshots: [{ roleCardId: 'old-worker', name: 'Old worker' }] },
    ],
    agentDecisions: [
      { ...current, decisionId: 'decision-current', roleCardId: 'configured-worker', summary: 'Real decision', transportEvents: [{ eventId: 'handoff', kind: 'TASK_RESPONSE', redactedBody: 'Recorded handoff', bodyDigest: 'not-projected' }] },
      { ...old, decisionId: 'old-decision', summary: 'Old decision' },
    ],
    taskGraphs: [],
    evidence: [{ ...current, evidenceId: 'evidence-current', summary: 'Verified record', resourceVersion: 'r1', data: { secret: 'do-not-project' } }],
  };
  // Existing enterprise incidents remain visible under the main production profile.
  host.competitionSnapshot = competition;
  const bridge = await create(host, {
    listTasks: async () => ({ tasks: [{ id: TASK_ID, title: 'Ordinary task', workspacePath: WORKSPACE }] }),
    getApplicationCompetitionUiProfile: async () => ({ releaseProfile: 'production', rehearsalEnabled: false }),
    getApplicationCompetitionSnapshot: async () => competition,
  });
  await bridge.refresh();
  const result = bridge.selectTask(`incident:${TASK_ID}`);
  assert.deepEqual(result.tasks.map((task) => task.id), [`task:${TASK_ID}`, `incident:${TASK_ID}`]);
  assert.equal(result.extensions.rehearsalEnabled, false);
  assert.equal(result.workspace.name, 'openxnet-source');
  assert.equal(result.workspace.enterpriseWorkspaceName, 'Enterprise space');
  assert.equal(result.workspace.projectName, 'Existing project');
  assert.deepEqual(result.task.members, [{ id: 'configured-worker', name: 'Actual worker', role: 'worker' }]);
  assert.deepEqual(result.task.events.map((event) => event.id), ['decision-current', 'handoff']);
  assert.equal(result.task.evidenceRefs[0].resourceVersion, 'r1');
  assert.doesNotMatch(JSON.stringify(result.task), /old-worker|Old decision|systemPrompt|bodyDigest|secret|do-not-project/);
  assert.equal(bridge.selectAgent('missing-agent').task.events.length, 0);
  assert.equal(bridge.selectAgent('configured-worker').task.events.length, 2);
  assert.equal(host.sandboxCurrentWs, 'enterprise-workspace');
});
