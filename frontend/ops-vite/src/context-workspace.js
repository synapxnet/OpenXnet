const CURRENT_SESSION = 'session:current';
const CORE_TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const text = (value) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const list = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const unique = (items) => [...new Map(items.filter((item) => item.id).map((item) => [item.id, item])).values()];
const status = (availability = 'unavailable', error = '') => ({ availability, error });
const resultStatus = (result, available = false) => result?.availability === 'error'
  ? status('error', result.error)
  : status(result?.availability === 'available' || available ? 'available' : 'unavailable', result?.error || '');

function messageText(value) {
  if (typeof value === 'string') return value;
  return list(value).filter((part) => ['text', 'input_text', 'output_text'].includes(part.type))
    .map((part) => text(part.text)).filter(Boolean).join('\n');
}

function workspaceOf(host) {
  const directory = text(host?.CLISettings?.cc_path);
  const enterpriseWorkspaceId = text(host?.sandboxCurrentWs);
  const projectId = text(host?.sandboxCurrentProject);
  const enterpriseWorkspace = list(host?.enterpriseWorkspaces).find((item) => text(item.id) === enterpriseWorkspaceId);
  const project = list(host?.enterpriseProjects).find((item) => text(item.id) === projectId
    && (!enterpriseWorkspaceId || text(item.workspaceId) === enterpriseWorkspaceId));
  return {
    directory,
    name: directory.split(/[\\/]/).filter(Boolean).pop() || '',
    enterpriseWorkspaceId,
    enterpriseWorkspaceName: text(enterpriseWorkspace?.name),
    projectId,
    projectName: text(project?.name),
  };
}

function workspaceKey(host) {
  const workspace = workspaceOf(host);
  return JSON.stringify([workspace.directory, workspace.enterpriseWorkspaceId, workspace.projectId]);
}

function currentSessionId(host) {
  return host ? text(host.conversationId) || CURRENT_SESSION : '';
}

function sessionsOf(host, selectedId) {
  const currentId = currentSessionId(host);
  const conversations = list(host?.conversations).filter((item) => !item.isPlaceholder);
  if (currentId && !conversations.some((item) => text(item.id) === currentId)) {
    conversations.unshift({ id: currentId, title: text(host?.conversationTitle) });
  }
  return unique(conversations.map((item) => {
    const id = text(item.id);
    const isCurrent = id === currentId;
    const rawMessages = isCurrent && Array.isArray(host?.messages) ? host.messages : item.messages;
    const messages = (id === selectedId ? list(rawMessages) : []).map((message, index) => ({
      id: text(message.id) || `${id}:message:${index}`,
      role: text(message.role),
      content: messageText(message.pure_content || message.content),
      agentId: text(message.agentId || message.agent_id),
    }));
    const firstUser = !item.title && Array.isArray(rawMessages)
      ? rawMessages.find((message) => message?.role === 'user' && messageText(message.pure_content || message.content)) : null;
    return {
      id,
      title: text(item.title) || messageText(firstUser?.pure_content || firstUser?.content).slice(0, 48),
      isCurrent,
      contentAvailable: Array.isArray(rawMessages),
      messageCount: Array.isArray(rawMessages) ? rawMessages.length : null,
      messages,
    };
  }));
}

function taskItem(item, source = 'task') {
  const sourceId = text(source === 'incident' ? item.incidentId : item.id || item.task_id);
  return {
    id: sourceId ? `${source}:${sourceId}` : '',
    source,
    sourceId,
    title: text(item.title || item.goal),
    status: text(item.status),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspacePath: text(item.workspacePath || item.workspace_path),
    updatedAt: text(item.updatedAt || item.updated_at || item.createdAt || item.created_at || item.timestamp),
  };
}

function matchesWorkspace(item, workspace, enterprise = false) {
  if (enterprise) {
    return (!workspace.enterpriseWorkspaceId || text(item.workspaceId) === workspace.enterpriseWorkspaceId)
      && (!workspace.projectId || text(item.projectId) === workspace.projectId);
  }
  const path = text(item.workspacePath || item.workspace_path);
  return !path || !workspace.directory || path === workspace.directory;
}

function recallItem(item, index) {
  return {
    id: text(item.id || item.observation_id || item.session_id || item.sessionId || item.turn_id || item.digest) || `record:${index}`,
    title: text(item.title || item.task_title || item.event_type || item.stage),
    summary: text(item.summary || item.detail || item.content || item.description),
    source: text(item.source || item.channel || item.origin),
    timestamp: text(item.timestamp || item.updated_at || item.created_at || item.createdAt),
  };
}

function matchesRecall(item, scope, recallTaskId) {
  if (scope.kind === 'task') return !!recallTaskId && text(item.task_id || item.taskId) === recallTaskId;
  return !!scope.sessionId && scope.sessionId !== CURRENT_SESSION
    && text(item.session_id || item.sessionId) === scope.sessionId;
}

function memberItem(item) {
  return {
    id: text(item.roleCardId || item.id || item.agentId || item.agent_id),
    name: text(item.name || item.agentName || item.agent_name),
    role: text(item.teamRole || item.role || item.department),
  };
}

function ordinaryTask(item, detailResult, scope) {
  const detail = detailResult?.data;
  const raw = detail?.task || item;
  const base = taskItem(raw);
  const rawEvents = detail?.events || raw.events || raw.execution_trace || raw.recent_trace_excerpt;
  const eventRows = typeof rawEvents === 'string' && rawEvents ? [{ message: rawEvents }] : list(rawEvents);
  const events = eventRows.map((event, index) => ({
    id: text(event.id || event.eventId) || `${base.id}:event:${index}`,
    title: text(event.type || event.eventType || event.stage),
    summary: text(event.message || event.summary || event.content),
    timestamp: text(event.createdAt || event.timestamp || event.created_at),
    agentId: text(event.agentId || event.agent_id || event.roleCardId),
    status: text(event.nextStatus || event.status),
  }));
  return {
    ...base,
    ...resultStatus(detailResult, true),
    detailAvailability: detailResult?.availability === 'error' ? 'error' : detail ? 'available' : 'unavailable',
    goal: text(raw.description || raw.goal || raw.context?.goal),
    summary: text(raw.resultSummary || raw.result_summary || raw.summary || detail?.consensusContent),
    events: scope.agentId ? events.filter((event) => event.agentId === scope.agentId) : events,
    members: unique(list(raw.details?.members || raw.members).map(memberItem)),
    evidenceRefs: list(raw.artifacts).map((artifact) => ({
      id: text(artifact.artifactId), summary: text(artifact.label), resourceVersion: '', timestamp: '',
    })),
    childTasks: list(detail?.childTasks).map((task) => taskItem(task)),
  };
}

function incidentTask(incident, snapshot, scope) {
  const traceId = text(incident.activeTraceId);
  // Only records from the active execution are current task context.
  const belongs = (item) => text(item.incidentId) === text(incident.incidentId)
    && text(item.workspaceId) === text(incident.workspaceId)
    && !!traceId && text(item.traceId) === traceId;
  const bindings = list(snapshot.teamBindings).filter(belongs);
  const decisions = list(snapshot.agentDecisions).filter(belongs);
  const graphs = list(snapshot.taskGraphs).filter(belongs);
  const events = decisions.flatMap((decision) => [
    {
      id: text(decision.decisionId), title: text(decision.stage), summary: text(decision.summary),
      timestamp: text(decision.createdAt), agentId: text(decision.roleCardId), status: text(decision.decision),
    },
    ...list(decision.transportEvents).map((event) => ({
      id: text(event.eventId) || `${text(decision.decisionId)}:transport:${text(event.sequence)}`,
      title: text(event.kind), summary: text(event.redactedBody), timestamp: text(event.observedAt),
      agentId: text(decision.roleCardId), status: text(event.direction),
    })),
  ]).concat(graphs.flatMap((graph) => list(graph.events).map((event) => ({
    id: text(event.eventId), title: text(event.eventType), summary: text(event.reasonCode),
    timestamp: text(event.createdAt), agentId: text(event.toRoleCardId || event.fromRoleCardId), status: '',
  }))));
  return {
    ...taskItem(incident, 'incident'), ...status('available'), detailAvailability: 'available',
    goal: text(incident.summary), summary: text(incident.summary), traceId,
    events: unique(events).filter((event) => !scope.agentId || event.agentId === scope.agentId),
    members: unique(bindings.flatMap((binding) => list(binding.memberSnapshots).map(memberItem))),
    evidenceRefs: list(snapshot.evidence).filter(belongs).map((evidence) => ({
      id: text(evidence.evidenceId), summary: text(evidence.summary),
      resourceVersion: text(evidence.resourceVersion), timestamp: text(evidence.observedAt),
    })),
    childTasks: [],
  };
}

async function read(api, method, args, valid) {
  if (typeof api?.[method] !== 'function') return { ...status('unavailable'), data: null };
  try {
    const data = args === undefined ? await api[method]() : await api[method](args);
    if (!valid(data)) throw new Error(`${method}: response unavailable`);
    return { ...status('available'), data };
  } catch (error) {
    return { ...status('error', text(error?.message) || 'Context read failed'), data: null };
  }
}

/** Read-only context projection. Selecting a scope never changes the running conversation or task. */
export function createContextWorkspaceBridge({ getHost = () => null, getDesktopApi = () => null } = {}) {
  let selection = { kind: 'session', sessionId: null, taskId: '', agentId: '' };
  let generation = 0;
  let cached = null;
  let pending = null;

  function scopeOf(host) {
    return { ...selection, sessionId: selection.sessionId === null ? currentSessionId(host) : selection.sessionId };
  }

  function requestKey(host) {
    return JSON.stringify([workspaceKey(host), scopeOf(host)]);
  }

  function targetKey(host) {
    const scope = scopeOf(host);
    return JSON.stringify([workspaceKey(host), scope.kind, scope.sessionId, scope.taskId]);
  }

  function snapshot() {
    const host = getHost();
    const workspace = workspaceOf(host);
    const scope = scopeOf(host);
    const key = workspaceKey(host);
    const data = cached?.workspaceKey === key ? cached : null;
    const scoped = data?.targetKey === targetKey(host) ? data : null;
    const loading = pending?.generation === generation && pending.scopeKey === requestKey(host);
    const allSessions = sessionsOf(host, scope.sessionId);
    const selectedSession = allSessions.find((item) => item.id === scope.sessionId);
    const session = {
      id: scope.sessionId, title: selectedSession?.title || '',
      ...status(selectedSession?.contentAvailable ? 'available' : 'unavailable'),
      messages: selectedSession?.messages || [],
    };
    const residentCompetition = record(host?.competitionSnapshot);
    const competition = data?.competition?.data || residentCompetition;
    const taskRecords = data?.tasks?.data?.tasks || list(host?.taskList);
    const incidentRecords = list(competition.incidents).filter((item) => matchesWorkspace(item, workspace, true));
    const normalRecords = list(taskRecords).filter((item) => matchesWorkspace(item, workspace));
    const tasks = unique(normalRecords.map((item) => taskItem(item)).concat(incidentRecords.map((item) => taskItem(item, 'incident'))));
    const selectedTask = tasks.find((item) => item.id === scope.taskId);
    const rawTask = normalRecords.find((item) => taskItem(item).id === scope.taskId)
      || (scoped?.detail?.data?.task && taskItem(scoped.detail.data.task).id === scope.taskId ? scoped.detail.data.task : null);
    const rawIncident = incidentRecords.find((item) => taskItem(item, 'incident').id === scope.taskId);
    const residentDetail = host?.viewingTaskDetail;
    const matchingDetail = residentDetail && taskItem(residentDetail).id === scope.taskId ? { ...status('available'), data: { task: residentDetail } } : null;
    const task = rawIncident ? incidentTask(rawIncident, competition, scope)
      : rawTask ? ordinaryTask(rawTask, scoped?.detail || matchingDetail, scope)
        : { id: scope.taskId, source: '', sourceId: '', title: '', status: '', ...resultStatus(scoped?.detail), detailAvailability: 'unavailable', goal: '', summary: '', events: [], members: [], evidenceRefs: [], childTasks: [] };
    const recallTaskId = selectedTask?.source === 'task' ? text(rawTask?.legacyTaskId || rawTask?.task_id || selectedTask.sourceId) : '';
    const bootstrap = data?.bootstrap?.data;
    const overview = record(bootstrap?.overview);
    // Host Recall state belongs to its own recorded workspace, not automatically to the selected one.
    const residentRecallMatches = !!workspace.directory && text(host?.recallWorkspace) === workspace.directory;
    const residentSessions = residentRecallMatches ? list(host?.recallSessionSummaries) : [];
    const residentObservations = residentRecallMatches ? list(host?.recallObservationItems) : [];
    const recallSessions = list(overview.recent_sessions || residentSessions);
    const observationRows = scoped?.observations?.data?.observations
      || list(overview.recent_observations).concat(residentObservations).filter((item) => matchesRecall(item, scope, recallTaskId));
    const timelineRows = scoped?.timeline?.data?.timeline
      || (residentRecallMatches ? list(host?.recallTimeline).filter((item) => matchesRecall(item, scope, recallTaskId)) : []);
    const interrupted = list(bootstrap?.interrupted || (residentRecallMatches ? host?.recallInterruptedTurns : []))
      .filter((item) => matchesRecall(item, scope, recallTaskId));
    const recallError = [data?.bootstrap, scoped?.observations, scoped?.timeline].filter((item) => item?.error).map((item) => item.error).join('; ');
    const recallAvailable = !!bootstrap || observationRows.length > 0 || timelineRows.length > 0 || residentSessions.length > 0;
    const profile = data?.profile?.data;
    const releaseProfile = text(profile?.releaseProfile || host?.competitionReleaseProfile);
    const rehearsalEnabled = profile ? profile.rehearsalEnabled === true : host?.competitionRehearsalAvailable === true;
    const extensions = {
      releaseProfile, rehearsalEnabled,
      ...resultStatus(data?.profile, !!releaseProfile || typeof host?.competitionRehearsalAvailable === 'boolean'),
    };
    const agents = unique([
      ...(host?.mainAgent ? [{ id: text(host.mainAgent), name: text(host?.agents?.[host.mainAgent]?.name) || text(host.mainAgent) }] : []),
      ...Object.entries(record(host?.agents)).map(([id, agent]) => ({ id, name: text(agent?.name) || id })),
      ...list(host?.enterpriseRoleCards || host?.staffRoles).map((agent) => ({ id: text(agent.id), name: text(agent.name || agent.displayName) || text(agent.id) })),
      ...task.members.map((member) => ({ id: member.id, name: member.name || member.id })),
    ]);
    const errors = [data?.tasks, data?.competition, data?.profile, scoped?.detail].filter((item) => item?.error).map((item) => item.error);
    if (recallError) errors.push(recallError);
    return {
      scope, workspace, agents,
      sessions: allSessions.map(({ messages, ...item }) => item), tasks, session, task,
      taskCatalog: resultStatus(data?.tasks, normalRecords.length > 0),
      incidentCatalog: resultStatus(data?.competition, list(competition.incidents).length > 0),
      recall: {
        ...status(recallError ? 'error' : recallAvailable ? 'available' : 'unavailable', recallError),
        loading: !!loading, sessions: recallSessions.map(recallItem), observations: observationRows.map(recallItem),
        interrupted: interrupted.map(recallItem), timeline: timelineRows.map(recallItem),
        observationAvailability: scoped?.observations?.availability || (observationRows.length ? 'available' : 'unavailable'),
      },
      extensions,
      measurement: { tokenCount: null, assembledInputAvailable: false, kind: 'unknown' },
      loading: !!loading, error: [...new Set(errors)].join('; '),
    };
  }

  function select(patch) {
    selection = { ...selection, ...patch };
    generation += 1;
    return snapshot();
  }

  async function refresh() {
    const host = getHost();
    const api = getDesktopApi();
    const before = snapshot();
    const token = { generation: ++generation, scopeKey: requestKey(host), targetKey: targetKey(host), workspaceKey: workspaceKey(host) };
    pending = token;
    const normalTask = before.tasks.find((item) => item.id === before.scope.taskId && item.source === 'task');
    const taskId = normalTask?.sourceId || (before.scope.taskId.startsWith('task:') ? before.scope.taskId.slice(5) : '');
    const hostTask = list(host?.taskList).find((item) => taskItem(item).id === before.scope.taskId);
    const cachedTask = list(cached?.workspaceKey === token.workspaceKey ? cached?.tasks?.data?.tasks : []).find((item) => taskItem(item).id === before.scope.taskId);
    const recallTaskId = before.scope.kind === 'task' && taskId ? text(cachedTask?.legacyTaskId || hostTask?.legacyTaskId || hostTask?.task_id || taskId) : '';
    const sessionId = before.scope.kind === 'session' && before.scope.sessionId !== CURRENT_SESSION ? before.scope.sessionId : '';
    const recallTarget = { taskId: recallTaskId, sessionId, digest: '', query: '', limit: 60, origin: '' };
    const hasRecallTarget = !!(recallTaskId || sessionId);
    const skipped = { ...status('unavailable'), data: null };
    const profileRead = read(api, 'getApplicationCompetitionUiProfile', undefined,
      (value) => ['production', 'goai-staging'].includes(value?.releaseProfile) && typeof value?.rehearsalEnabled === 'boolean');
    const competitionRead = profileRead.then((profileResult) => {
      const profile = profileResult.data;
      const configured = profile
        ? profile.releaseProfile === 'goai-staging' || profile.rehearsalEnabled
        : host?.competitionReleaseProfile === 'goai-staging' || host?.competitionRehearsalAvailable === true;
      return configured || list(host?.competitionSnapshot?.incidents).length > 0
        ? read(api, 'getApplicationCompetitionSnapshot', undefined, (value) => Array.isArray(value?.incidents)) : skipped;
    });
    const reads = await Promise.all([
      read(api, 'listTasks', before.workspace.directory ? { workspacePath: before.workspace.directory } : {}, (value) => Array.isArray(value?.tasks)),
      read(api, 'getApplicationRecallBootstrap', undefined, (value) => !!value?.overview && typeof value.overview === 'object'),
      CORE_TASK_ID.test(taskId) ? read(api, typeof api?.getTaskExecution === 'function' ? 'getTaskExecution' : 'getTask', { taskId }, (value) => text(value?.task?.id) === taskId) : skipped,
      hasRecallTarget ? read(api, 'getApplicationRecallObservations', recallTarget, (value) => Array.isArray(value?.observations) && (!value.workspace || value.workspace === before.workspace.directory)) : skipped,
      hasRecallTarget ? read(api, 'getApplicationRecallTimeline', { ...recallTarget, limit: 40, depthBefore: 10, depthAfter: 10 }, (value) => Array.isArray(value?.timeline) && (!value.workspace || value.workspace === before.workspace.directory)) : skipped,
      profileRead, competitionRead,
    ]);
    if (generation === token.generation && requestKey(getHost()) === token.scopeKey) {
      const [tasks, bootstrap, detail, observations, timeline, profile, competition] = reads;
      // Bootstrap APIs derive their workspace in Main; reject a response scoped elsewhere.
      if (bootstrap.data?.overview?.workspace && bootstrap.data.overview.workspace !== before.workspace.directory) {
        bootstrap.data = null;
        Object.assign(bootstrap, status('error', 'Recall workspace does not match the selected directory'));
      }
      cached = { ...token, tasks, bootstrap, detail, observations, timeline, profile, competition };
    }
    if (pending === token) pending = null;
    return snapshot();
  }

  return {
    snapshot, refresh,
    selectSession: (id) => select({ kind: 'session', sessionId: text(id), taskId: '', agentId: '' }),
    selectTask: (id) => select({ kind: 'task', taskId: text(id), agentId: '' }),
    selectAgent: (id) => select({ agentId: text(id) }),
  };
}
