const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { parse } = require("@babel/parser");

/** 读取仓库内 UTF-8 文本；输入相对路径，返回文件内容。 */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

// 验证 GOAI 控制台只通过类型化 Main IPC 访问竞赛运行时。
test("competition workbench uses typed Main IPC without Python or fetch fallback", () => {
  const html = readProjectFile("static/index.html");
  const competitionCss = readProjectFile("static/css/competition-workbench-v2.css");
  const data = readProjectFile("static/js/vue_data.js");
  const methods = readProjectFile("static/js/vue_methods.js");
  const preload = readProjectFile("static/js/preload.js");
  const main = readProjectFile("main.js");
  const methodBoundary = methods.slice(
    methods.indexOf("getApplicationCompetitionRuntime()"),
    methods.indexOf("async openEnterpriseTab(tab)"),
  );

  assert.match(html, /enterpriseTab === 'competition'/u);
  assert.match(html, /competition-workbench/u);
  assert.ok(
    html.indexOf("competition-workbench-v2.css") > html.indexOf("competition-workbench.css"),
    "V2 competition styles must load after the legacy competition stylesheet",
  );
  assert.match(html, /enterpriseTab === 'team-templates'/u);
  assert.match(html, /competitionTeamTemplateId/u);
  assert.match(html, /AgentTeams 使用独立登录域/u);
  assert.match(html, /事件治理中心/u);
  assert.match(html, /比赛 Staging 演练/u);
  assert.match(html, /项目群任务/u);
  assert.match(html, /创建新演示事件/u);
  assert.match(html, /重置演练数据/u);
  assert.match(html, /competition-icon-button--danger/u);
  assert.match(html, /getCompetitionActiveIncident\(\)\.status === 'RESOLVED'[\s\S]*?@click="openCompetitionNewIncidentDraft"/u);
  assert.match(html, /competition-kpi-strip/u);
  assert.match(html, /xnetServices\.aiops\.status/u);
  assert.match(html, /xnetServices\.dataops\.status/u);
  assert.match(html, /xnetServices\.mlops\.status/u);
  assert.match(html, /AgentTeams[\s\S]*?Agents/u);
  assert.match(html, /人工控制点/u);
  assert.match(html, /跨平台证据链/u);
  assert.match(html, /协同决策链/u);
  assert.match(html, /神经符号与知识图谱/u);
  assert.match(html, /失败即停止，不自动回退/u);
  assert.match(html, /验证失败/u);
  assert.match(html, /沉淀候选 Skill/u);
  assert.match(html, /enterpriseTab === 'enterprise-skills'/u);
  assert.match(data, /competitionSnapshot/u);
  assert.match(data, /agentDecisions/u);
  assert.match(data, /competitionDemoScenarioMode/u);
  assert.match(data, /competitionDemoScenarioType: 'feature-drift'/u);
  assert.match(data, /enterpriseSkillBindings/u);
  assert.match(methodBoundary, /createApplicationCompetitionIncident/u);
  assert.match(methodBoundary, /resetApplicationCompetitionDemoData/u);
  assert.match(methodBoundary, /confirmation: 'RESET_DEMO_DATA'/u);
  assert.match(methodBoundary, /this\.\$confirm/u);
  assert.match(methodBoundary, /runApplicationCompetitionInvestigation/u);
  assert.match(methodBoundary, /teamTemplateId: this\.competitionTeamTemplateId \|\| null/u);
  assert.match(methodBoundary, /getApplicationCompetitionUiProfile/u);
  assert.match(methodBoundary, /startApplicationCompetitionEnterpriseTask/u);
  assert.match(methodBoundary, /decideApplicationCompetitionApproval/u);
  assert.match(methodBoundary, /executeApplicationCompetitionRollback/u);
  assert.match(methodBoundary, /verifyApplicationCompetitionRemediation/u);
  assert.match(methodBoundary, /exportApplicationCompetitionEvaluation/u);
  assert.match(methodBoundary, /async loadCompetitionMemoryArtifacts\(notifyOnError = false\)/u);
  assert.match(methodBoundary, /getSynapxnetMemoryStatus/u);
  assert.match(methodBoundary, /listSynapxnetMemories/u);
  assert.match(methodBoundary, /getCompetitionActiveTaskGraph\(\)/u);
  assert.match(methodBoundary, /getCompetitionTaskGraphLanes\(taskGraph = null\)/u);
  assert.match(methodBoundary, /getCompetitionTaskGraphEvents\(taskGraph = null\)/u);
  assert.match(methodBoundary, /getCompetitionContextTransfers\(\)/u);
  assert.match(methodBoundary, /getCompetitionCompletionGates\(\)/u);
  assert.match(methodBoundary, /getCompetitionCompletionSummary\(\)/u);
  assert.match(methodBoundary, /getCompetitionPrimaryReasoningDecision\(\)/u);
  assert.match(methodBoundary, /getCompetitionDemoScenarioTemplates/u);
  assert.match(methodBoundary, /推荐服务扩容/u);
  assert.match(methodBoundary, /量化模型迭代/u);
  assert.match(methodBoundary, /跨域特征漂移/u);
  assert.match(methodBoundary, /loadEnterpriseSkills/u);
  assert.match(methodBoundary, /setApplicationEnterpriseSkillBinding/u);
  assert.doesNotMatch(methodBoundary, /fetch\(/u);
  assert.match(preload, /openxnet:application-competition-runtime:get-snapshot/u);
  assert.match(preload, /openxnet:application-agentteams-runtime:status/u);
  assert.match(preload, /openxnet:application-enterprise:list-team-templates/u);
  assert.match(preload, /openxnet:application-enterprise:list-skill-bindings/u);
  assert.match(main, /ApplicationCompetitionRuntimeService/u);
  assert.match(main, /CompetitionMcpGateway/u);
  assert.match(main, /resolveTeamTemplate: \(teamTemplateId\)/u);
  assert.match(main, /HttpCompetitionAgentTeamsAdapter/u);
  assert.match(main, /agentteams:team:prepare/u);
  assert.match(main, /agentteams:task:dispatch/u);
  assert.match(main, /dispatchAgentTeamTask/u);
  assert.match(main, /OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED/u);
  assert.match(main, /OPENXNET_AGENTTEAMS_DELEGATION_SECRET/u);
  assert.match(main, /resolveCompetitionDelegationToken[\s\S]*?OPENXNET_AGENT_DELEGATION_SECRET[\s\S]*?aud: 'openxnet-agent-adapter'/u);
  assert.match(main, /resolveCompetitionAgentTeamsDelegationToken[\s\S]*?OPENXNET_AGENTTEAMS_DELEGATION_SECRET[\s\S]*?aud: 'openxnet-agentteams-adapter'/u);
  assert.doesNotMatch(main, /incident-leader/u);
  assert.match(main, /capability: 'agentteams'/u);
  assert.match(main, /publishRetrospectiveSkill/u);
  assert.match(main, /persistResolvedIncidentMemory: \(request\)/u);
  assert.match(main, /applicationSynapxnetMemoryRuntime\.create/u);
  assert.match(main, /applicationSkillRuntime\.crystallizeSkill/u);
  assert.match(main, /applicationEnterpriseRuntime\.setSkillBinding/u);
  assert.match(competitionCss, /grid-template-columns:\s*clamp\(168px, 16vw, 196px\)\s+minmax\(360px, 1fr\)\s+clamp\(268px, 24vw, 300px\)/u);
  assert.match(competitionCss, /\.oxe-rebuilt \.oxe-content:has\(> \.competition-workbench\)[\s\S]*?container-name:\s*competition-host/u);
  assert.match(competitionCss, /@container competition-host \(max-width: 960px\)/u);
  assert.match(competitionCss, /@container competition-host \(max-width: 820px\)/u);
  assert.doesNotMatch(competitionCss, /container:\s*competition-workbench/u);
  assert.doesNotMatch(competitionCss, /@container competition-host \(max-width: 960px\)[\s\S]*?\.competition-agent-flow__content dl[\s\S]*?repeat\(2/u);
  assert.match(competitionCss, /\.competition-table-scroll[\s\S]*?overflow-y:\s*hidden/u);
  assert.match(competitionCss, /\.competition-trace-list[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible/u);
  assert.match(competitionCss, /\.competition-agent-flow__list > li/u);
  assert.match(competitionCss, /\.competition-agent-events > ol > li[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(competitionCss, /\.competition-agent-events > ol > li > pre[\s\S]*?white-space:\s*pre-wrap/u);
  assert.match(competitionCss, /\.competition-task-graph\s*\{[\s\S]*?grid-row:\s*6/u);
  assert.match(competitionCss, /\.competition-context-flow > ol > li\s*\{/u);
  assert.match(competitionCss, /\.competition-assurance-grid\s*\{[\s\S]*?grid-row:\s*7/u);
  assert.match(competitionCss, /\.competition-completion-gates > ol > li\s*\{/u);
  assert.match(competitionCss, /\.competition-memory-record\s*\{/u);
  assert.match(competitionCss, /\.competition-evidence-grid\s*\{[\s\S]*?grid-row:\s*8/u);
  assert.match(competitionCss, /\.competition-secondary-grid\s*\{[\s\S]*?grid-row:\s*9/u);
  assert.doesNotMatch(competitionCss, /\.competition-agent-flow__list li,/u);
});

/** 运行指挥台的步骤条与内容区必须跨越工作台外层列，避免被挤成窄竖栏。 / Operations control stepper and panels span the host grid to prevent narrow collapsed columns. */
test("operations control layout spans the competition workbench host grid", () => {
  const css = readProjectFile("static/css/competition-workbench-v2.css");
  assert.match(css, /\.ops-control-stepper\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u);
  assert.match(css, /\.ops-control-grid\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u);
});

/** GOAI 前置检查必须进入独立配置页，不能把三类配置错误地送回运行指挥台。 */
test("competition preflight configuration has dedicated destinations", () => {
  const html = readProjectFile("static/index.html");
  const methods = readProjectFile("static/js/vue_methods.js");
  assert.match(html, /competition-runtime-config-page/u);
  assert.match(html, /@click="openCompetitionPreflightConfiguration\(check\)"/u);
  assert.match(methods, /platforms:\s*\{\s*tab:\s*'competition-runtime-config',\s*section:\s*'platforms'/u);
  assert.match(methods, /'agentteams-connection':\s*\{\s*tab:\s*'competition-runtime-config',\s*section:\s*'agentteams'/u);
  assert.match(methods, /'live-execution':\s*\{\s*tab:\s*'competition-runtime-config',\s*section:\s*'live'/u);
  assert.doesNotMatch(methods.slice(methods.indexOf("getCompetitionPreflightConfigurationTarget"), methods.indexOf("selectCompetitionDemoWorkspace")), /tab:\s*'ops-control'/u);
});

/** 部分配置应保留每项真实状态，公开资料不得携带配置原值。 / Partial setup preserves each flag without exposing configuration values. */
test('competition setup exposes independent flags without returning endpoint or credentials', async () => {
  const source = readProjectFile('main.js');
  const declaration = parse(source, { sourceType: 'script', allowReturnOutsideFunction: true }).program.body
    .filter(/** 查找注册声明。 / Find registration declarations. */ node => node.type === 'VariableDeclaration')
    .flatMap(/** 展开声明项。 / Flatten declaration entries. */ node => node.declarations)
    .find(/** 定位竞赛 IPC。 / Locate competition IPC. */ node => node.id.name === 'unregisterApplicationCompetitionRuntimeIpc');
  const callback = declaration.init.arguments[0].properties.find(/** 定位实际公开投影。 / Locate the actual public projection. */ node => node.key.name === 'readUiProfile').value;
  const env = { OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL: 'https://private.example.test/adapter/', OPENXNET_AGENTTEAMS_DELEGATION_SECRET: 'synthetic-private-value-'.repeat(3) };
  const configuration = parse(source, { sourceType: 'script', allowReturnOutsideFunction: true }).program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'readCompetitionAgentTeamsConfiguration');
  const readProfile = vm.runInNewContext(`${source.slice(configuration.start, configuration.end)}; (${source.slice(callback.start, callback.end)})`, {
    applicationCompetitionConnection: { getSnapshot: () => ({ enabled: env.OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED === '1', endpoint: env.OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL || '', credentialConfigured: Boolean(env.OPENXNET_AGENTTEAMS_DELEGATION_SECRET), source: 'deployment', access: null }) },
    applicationCompetitionRuntime: { readCollaborationConfigurationContext: async () => ({ adapterMode: 'fixture' }) },
    applicationCompetitionLiveConnection: { hasLocalConfiguration: () => false, getSnapshot: () => ({ enabled: false, source: 'none' }) },
    hasCompetitionLiveGatewayConnection: () => false,
    process: { env }, applicationPackage: { openxnet: { releaseProfile: 'goai-staging' } },
    /** 隔离发布配置，不替换被验证的状态投影。 / Isolate release settings without replacing the status projection. */
    resolveApplicationCompetitionUiProfile: () => ({ releaseProfile: 'goai-staging', rehearsalEnabled: true }),
  });
  let profile = await readProfile();
  assert.equal(profile.agentTeamsConfigured, false);
  assert.equal(profile.agentTeamsEnabled, false);
  assert.equal(profile.agentTeamsEndpointConfigured, true);
  assert.equal(profile.agentTeamsDelegationConfigured, true);
  env.OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED = '1';
  assert.equal((await readProfile()).agentTeamsConfigured, true);
  env.OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL = '';
  profile = await readProfile();
  assert.equal(profile.agentTeamsConfigured, false);
  assert.equal(profile.agentTeamsEnabled, true);
  assert.equal(profile.agentTeamsEndpointConfigured, false);
  assert.equal(profile.agentTeamsDelegationConfigured, true);
  delete env.OPENXNET_AGENTTEAMS_DELEGATION_SECRET;
  assert.equal((await readProfile()).agentTeamsDelegationConfigured, false);
  assert.doesNotMatch(JSON.stringify(profile), /synthetic-private-value|private\.example\.test/);
});

/** 执行实际 Main 路由声明，隔离网络和凭据存储。 / Execute actual Main routing declarations with isolated network and credential storage. */
function createLiveMainRoutingHarness() {
  const source = readProjectFile('main.js');
  const program = parse(source, { sourceType: 'script', allowReturnOutsideFunction: true }).program;
  const names = ['readCompetitionAgentTeamsConfiguration', 'resolveCompetitionAgentTeamsEndpoint', 'resolveCompetitionAgentTeamsDelegationToken', 'hasCompetitionLiveGatewayConnection'];
  const declarations = program.body.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name));
  const registration = program.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === 'unregisterApplicationCompetitionRuntimeIpc');
  const profile = registration.init.arguments[0].properties.find(node => node.key.name === 'readUiProfile').value;
  const state = { mode: 'live', snapshot: { source: 'none', enabled: false }, runtimeCalls: [], fixture: { source: 'saved', enabled: true, endpoint: 'https://fixture.example.test/', credentialConfigured: true, access: { expiresAt: '2099-01-01T00:00:00Z' } } };
  const env = { OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED: '1', OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL: 'https://legacy.example.test/', OPENXNET_AGENTTEAMS_DELEGATION_SECRET: 's'.repeat(40), OPENXNET_AGENT_DELEGATION_SECRET: 'd'.repeat(40), OPENXNET_COMPETITION_APPROVAL_BASE_URL: 'https://approval.example.test/', OPENXNET_APPROVAL_ISSUER_TOKEN: 'a'.repeat(40) };
  const context = vm.createContext({ process: { env }, Date, Buffer, createHmac: require('node:crypto').createHmac,
    applicationPackage: { openxnet: { releaseProfile: 'goai-staging' } },
    resolveApplicationCompetitionUiProfile: () => ({ releaseProfile: 'goai-staging', rehearsalEnabled: true }),
    requireCompetitionSubject: () => 'test-subject',
    applicationCompetitionRuntime: { readCollaborationConfigurationContext: async () => ({ adapterMode: state.mode }) },
    applicationCompetitionConnection: { getSnapshot: () => state.fixture, getSavedConnection: () => ({ ...state.fixture, workspaceId: 'fixture-space', accessCode: 'fixture-code' }) },
    applicationCompetitionLiveConnection: { getSnapshot: () => state.snapshot, hasLocalConfiguration: () => state.localExists || state.snapshot.source === 'saved',
      /** 只接受指定工作空间；精确记录 Main 实际传入的范围。 / Accept the fixed workspace and record the exact scope provided by Main. */
      requireRuntimeConnection: (workspaceId) => {
        state.runtimeCalls.push(workspaceId);
        if (workspaceId !== 'live-space' || !state.snapshot.enabled || state.snapshot.storageError) throw new Error('LIVE_SCOPE_BLOCKED');
        return { accessCode: 'live-code' };
      },
    },
  });
  const functions = vm.runInContext(`${declarations.map(node => source.slice(node.start, node.end)).join('\n')}; ({${names.join(',')}, readProfile: (${source.slice(profile.start, profile.end)})})`, context);
  return { state, env, ...functions };
}

/** 当前模式决定凭据来源；失效保存项不能借用部署权限。 / Current mode determines credential routing and invalid saved state cannot borrow deployment authority. */
test('Main isolates Fixture and Live credentials and reports fail-closed saved states', async () => {
  const host = createLiveMainRoutingHarness();
  assert.equal(await host.resolveCompetitionAgentTeamsEndpoint(), 'https://legacy.example.test/');
  const legacyToken = await host.resolveCompetitionAgentTeamsDelegationToken({ workspaceId: 'legacy-space' });
  assert.equal(JSON.parse(Buffer.from(legacyToken.split('.')[1], 'base64url')).workspace_id, 'legacy-space');
  assert.equal((await host.readProfile()).liveExecutionConfigured, true);
  host.state.snapshot = { source: 'saved', enabled: true, endpoint: 'https://live.example.test/', workspaceId: 'live-space', credentialConfigured: true,
    access: { serviceReady: true, expiresAt: '2099-01-01T00:00:00Z', remainingRequests: 10 } };
  assert.equal(await host.resolveCompetitionAgentTeamsEndpoint(), 'https://live.example.test/');
  assert.equal(await host.resolveCompetitionAgentTeamsDelegationToken({ workspaceId: 'live-space' }), 'live-code');
  await assert.rejects(host.resolveCompetitionAgentTeamsDelegationToken({ workspaceId: 'fixture-space' }), /LIVE_SCOPE_BLOCKED/);
  assert.equal((await host.readProfile()).liveRequiredTeamRuntime, 'agentteams');
  for (const mutation of [{ enabled: false }, { storageError: 'STORAGE_READ_FAILED' }, { access: { serviceReady: true, expiresAt: '2000-01-01T00:00:00Z', remainingRequests: 10 } }, { access: { serviceReady: true, expiresAt: '2099-01-01T00:00:00Z', remainingRequests: 0 } }]) {
    const original = host.state.snapshot;
    host.state.snapshot = { ...original, ...mutation };
    assert.equal(host.hasCompetitionLiveGatewayConnection(), true);
    const profile = await host.readProfile();
    assert.equal(profile.liveExecutionConfigured, false);
    assert.equal(profile.agentTeamsConfigured, false);
    assert.doesNotMatch(JSON.stringify(profile), /live-code|legacy\.example|live\.example/);
    host.state.snapshot = original;
  }
  const savedSnapshot = host.state.snapshot;
  host.state.snapshot = { source: 'none', enabled: false }; host.state.localExists = true;
  assert.equal(host.hasCompetitionLiveGatewayConnection(), true);
  assert.equal((await host.readProfile()).liveExecutionConfigured, false);
  await assert.rejects(host.resolveCompetitionAgentTeamsEndpoint());
  await assert.rejects(host.resolveCompetitionAgentTeamsDelegationToken({ workspaceId: 'live-space' }), /LIVE_SCOPE_BLOCKED/);
  host.state.snapshot = savedSnapshot;
  host.state.mode = 'fixture';
  assert.equal(await host.resolveCompetitionAgentTeamsEndpoint(), 'https://fixture.example.test/');
  assert.equal(await host.resolveCompetitionAgentTeamsDelegationToken({ workspaceId: 'fixture-space' }), 'fixture-code');
  await assert.rejects(host.resolveCompetitionAgentTeamsDelegationToken({ workspaceId: 'live-space' }));
});

/** 满宽总览必须包含padding，正式页保留内容断点且右栏文字不能撑出列宽。 / Full-width overviews must include padding, preserve formal-page content breakpoints and keep right-column text within its track. */
test('operations overview uses bounded box sizing and live content-width breakpoints for the approval column', () => {
  const css = readProjectFile('static/css/competition-workbench-v2.css');
  const enterpriseCss = readProjectFile('static/css/openxnet-enterprise-workspaces.css');
  assert.match(css, /\.ops-control-workbench,\s*\.ops-control-workbench \*,\s*\.ops-control-workbench \*::before,\s*\.ops-control-workbench \*::after\s*\{[^}]*box-sizing:\s*border-box/u);
  assert.match(css, /\.ops-control-grid\s*\{[^}]*width:\s*100%;[^}]*padding:\s*20px/u);
  for (const selector of ['ops-control-aside', 'ops-control-platforms', 'ops-control-platform']) {
    const rule = css.match(new RegExp('\\.' + selector + '\\s*\\{([^}]+)\\}')); assert.ok(rule, selector);
    assert.match(rule[1], /grid-template-columns:\s*minmax\(0, 1fr\)/u); assert.match(rule[1], /min-width:\s*0/u);
  }
  assert.match(css, /\.ops-control-platform button\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/u);
  assert.match(css, /\.ops-control-platform button\s*\{[^}]*background:\s*var\(--ox-bg-surface\);[^}]*font:\s*inherit;/u);
  assert.match(css, /\.ops-control-platform button:hover\s*\{[^}]*background:\s*var\(--ox-accent-soft\)/u);
  assert.match(css, /\.ops-control-platform button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ox-accent\)/u);
  assert.match(css, /\.ops-control-panel \.competition-section-heading > div\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/u);
  assert.match(enterpriseCss, /#app \.oxe-rebuilt \.oxe-content\[data-tab="ops-control"\]\s*\{[^}]*container-name:\s*enterprise-workspace competition-host/u);
  assert.match(css, /@container competition-host \(max-width: 850px\)\s*\{\s*\.ops-control-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
});

// 验证比赛决策在神经符号和知识图谱界面中具备明确、可筛选的展示契约。
test("competition knowledge is visible in NeuroSymbol and Knowledge Graph surfaces", () => {
  const html = readProjectFile("static/index.html");
  const data = readProjectFile("static/js/vue_data.js");
  const methods = readProjectFile("static/js/vue_methods.js");
  const main = readProjectFile("main.js");

  assert.match(html, /neuroData\.stats\?\.competitionSymbols/u);
  assert.match(html, /row\.metadata\?\.sourceType === 'competition'/u);
  assert.match(html, /row\.metadata\.agentName/u);
  assert.match(html, /row\.metadata\.stage/u);
  assert.match(html, /row\.metadata\.decision/u);
  assert.match(html, /row\.metadata\.skillName/u);
  assert.match(html, /kgData\.stats\?\.active_competition_triples/u);
  assert.match(html, /v-model="kgSourceFilter"/u);
  assert.match(html, /v-model="kgShowHistory"/u);
  assert.match(html, /getKnowledgeSourceLabel\(row\.source_type\)/u);
  assert.match(data, /neuroSourceFilter: 'all'/u);
  assert.match(data, /kgSourceFilter: 'all'/u);
  assert.match(data, /kgShowHistory: false/u);
  assert.match(methods, /getVisibleNeuroSymbols\(\)/u);
  assert.match(methods, /edge\.source_type === this\.kgSourceFilter/u);
  assert.match(methods, /this\.kgShowHistory \|\| edge\.current !== false/u);
  assert.match(main, /synchronizeKnowledge: \(projection\)/u);
  assert.match(main, /purgeKnowledge: \(request\)/u);
});

/** 加载真实宿主方法，所有接口回执均在内存中控制。 / Load actual host methods while controlling every API receipt in memory. */
function competitionHostFixture(runtime = {}, extraMethods = []) {
  const source = readProjectFile('static/js/vue_methods.js');
  const declarations = parse(source, { sourceType: 'script' }).program.body.filter(/** 选择宿主声明。 / Select host declarations. */ node => node.type === 'VariableDeclaration');
  const methods = declarations.flatMap(/** 展开声明项。 / Flatten declared items. */ node => node.declarations).find(/** 找到真实方法表。 / Find the actual method table. */ node => node.id.name === 'vue_methods').init.properties;
  const notices = []; const calls = [];
  const context = vm.createContext({ showNotification: (...args) => notices.push(args), console: { error() {}, warn() {} }, window: { openxnetDesktop: runtime } });
  const incident = { incidentId: 'incident-a', workspaceId: 'workspace-a', activeTraceId: 'trace-a', activeApprovalId: 'approval-a', status: 'AWAITING_APPROVAL', updatedAt: '2026-09-14T01:00:00Z' };
  const approval = { approvalId: 'approval-a', incidentId: incident.incidentId, workspaceId: incident.workspaceId, traceId: incident.activeTraceId, planId: 'review-plan', planDigest: 'a'.repeat(64), status: 'PENDING', scopes: [
    { stepId: 'capacity-apply', toolName: 'aiops.inference.capacity.apply', resourceId: 'workload-a', targetRevision: 2, expectedResourceVersion: 'rv-1', argumentsDigest: 'b'.repeat(64), compensation: false, arguments: { password: 'private-secret' }, privateResponse: 'private-response' },
    { stepId: 'restore-model', toolName: 'mlops.deployments.rollback', resourceId: 'deployment-a', targetRevision: 1, expectedResourceVersion: 'rv-2', argumentsDigest: 'c'.repeat(64), compensation: true },
  ] };
  const host = { notices, calls, incident, approval, competitionBusyAction: '', competitionExecutionMode: 'automatic', competitionApprovalReason: 'Reviewed original scopes',
    competitionSelectedIncidentId: '', competitionApprovalDrafts: {}, competitionRollbackKeys: {}, competitionMemoryGeneration: 0,
    competitionRehearsalAvailable: true, competitionRehearsalVisible: true, competitionAdapterMode: 'fixture', competitionDemoScenarioMode: 'recovery', competitionDemoForm: { workspaceId: 'workspace-a', projectId: 'project-a' },
    canUseEnterprise: true, enterpriseSkillWorkspaceId: 'workspace-a',
    competitionSnapshot: { incidents: [incident], approvals: [approval], actions: [], evidence: [], invocations: [], teamBindings: [], taskGraphs: [{ incidentId: incident.incidentId, workspaceId: incident.workspaceId, traceId: incident.activeTraceId, revision: 1, nodes: [{ nodeId: 'human-approval', title: 'Human approval', dependsOn: [] }, { nodeId: 'execute:capacity-apply', title: 'Apply reviewed capacity', toolName: 'aiops.inference.capacity.apply', dependsOn: ['human-approval'] }] }] },
    /** 固定测试语言。 / Fix the test language. */
    isCurrentLanguageZh: () => true,
    /** 隔离真实类型化接口。 / Isolate the actual typed API boundary. */
    getApplicationCompetitionRuntime: () => runtime,
    /** 隔离企业技能绑定接口。 / Isolate the enterprise skill-binding API. */
    getApplicationEnterpriseRuntime: () => runtime,
    /** 记录只读刷新。 / Record read-only refreshes. */
    loadCompetitionSnapshot: async () => { calls.push('refresh'); },
    /** 自动结束后刷新实际记忆记录。 / Refresh actual memory records after automatic completion. */
    loadCompetitionMemoryArtifacts: async () => { calls.push('memory'); },
    /** 记录技能目录刷新。 / Record skill catalog refreshes. */
    fetchSkills: async () => { calls.push('skills'); },
    /** 记录企业绑定刷新。 / Record enterprise binding refreshes. */
    loadEnterpriseSkills: async () => { calls.push('bindings'); },
  };
  for (const name of ['applyOperationsRuntimeSnapshot', 'scheduleOperationsRuntimePoll', 'getCompetitionResolvedWorkspaceId', 'getEnterpriseWorkspaceNameById', 'getOperationsWorkspaceLabel', 'getCompetitionStatusLabel', 'getCompetitionActiveIncident', 'getCompetitionActiveApproval', 'getCompetitionActiveTaskGraph', 'getCompetitionApprovalPublicText', 'getCompetitionApprovalPlan', 'decideCompetitionApproval', 'exportCompetitionRetrospective', 'getCompetitionIncidentOptions', 'selectCompetitionIncident', 'openEnterpriseAuditIncidentCenter', 'setEnterpriseSkillEnabled', 'getCompetitionActiveAction', 'getCompetitionActiveEvidence', 'getCompetitionActiveInvocations', 'getCompetitionTaskNodeResult', 'getCompetitionActiveTeamBinding', 'getCompetitionRuntimeLabel', 'getCompetitionDemoScenarioTemplates', 'selectCompetitionDemoScenario', 'canUseCompetitionVerificationFailure', 'selectCompetitionDemoPath', 'openCompetitionNewIncidentDraft', 'createCompetitionDemoIncident', ...extraMethods]) {
    const method = methods.find(/** 提取所测实际函数。 / Extract the actual function under test. */ node => node.key.name === name);
    host[name] = vm.runInContext(`({${source.slice(method.start, method.end)}})[${JSON.stringify(name)}]`, context);
  }
  return host;
}

/** 刷新失败保留成功快照并明确标记过期，不修改 Live 模式或重放任务。 / Failed refresh keeps the last snapshot with an error flag, never changing Live mode or replaying tasks. */
test('setup refresh distinguishes partial and unavailable configuration without switching modes', async () => {
  let fail = false; let reads = 0;
  const runtime = {
    /** 返回部分配置，随后模拟桥接失败。 / Return partial setup, then simulate a failed bridge read. */
    getApplicationCompetitionUiProfile: async () => {
      reads += 1;
      if (fail) throw new Error('synthetic-private-transport-error');
      return { releaseProfile: 'goai-staging', rehearsalEnabled: true, agentTeamsConfigured: false, agentTeamsEnabled: true, agentTeamsEndpointConfigured: true, agentTeamsDelegationConfigured: false };
    },
  };
  const host = competitionHostFixture(runtime, ['loadCompetitionUiProfile', 'refreshCompetitionRuntimeConfiguration']);
  host.competitionAdapterMode = 'live';
  assert.equal(await host.refreshCompetitionRuntimeConfiguration(), true);
  assert.equal(host.competitionRuntimeReadiness.agentTeamsSetup.enabled, true);
  assert.equal(host.competitionRuntimeReadiness.agentTeamsSetup.endpointConfigured, true);
  assert.equal(host.competitionRuntimeReadiness.agentTeamsSetup.delegationConfigured, false);
  const before = JSON.stringify(host.competitionRuntimeReadiness);
  const checkedAt = host.competitionRuntimeConfigCheckedAt;
  fail = true;
  assert.equal(await host.refreshCompetitionRuntimeConfiguration(), false);
  assert.equal(host.competitionRuntimeConfigReadError, true);
  assert.equal(JSON.stringify(host.competitionRuntimeReadiness), before);
  assert.equal(host.competitionRuntimeConfigCheckedAt, checkedAt);
  assert.equal(host.competitionAdapterMode, 'live');
  assert.equal(host.competitionLoading, false);
  assert.equal(reads, 2);
  assert.deepEqual(host.calls, []);
  assert.doesNotMatch(JSON.stringify(host.notices), /synthetic-private-transport-error/);
  host.competitionLoading = true;
  assert.equal(await host.refreshCompetitionRuntimeConfiguration(), false);
  assert.equal(reads, 2);
});

/** 保存成功只更新接入并清空密码输入，不偷偷切换 Live 或发起任务。 / Saving updates connection state and clears password input without changing Live mode or starting work. */
test('in-app connection save clears temporary code and preserves execution mode', async () => {
  const submitted = [];
  const snapshot = { enabled: true, endpoint: 'https://demo.example.test/', workspaceId: 'workspace-a', credentialConfigured: true, storageAvailable: true, source: 'saved', access: { serviceReady: true } };
  const bridge = {
    getApplicationCompetitionConnection: async () => ({ ok: true, snapshot }),
    testApplicationCompetitionConnection: async () => ({ ok: true, access: snapshot.access }),
    saveApplicationCompetitionConnection: async request => { submitted.push(request); return { ok: true, snapshot }; },
    clearApplicationCompetitionConnection: async () => ({ ok: true }),
  };
  const host = competitionHostFixture(bridge, ['getCompetitionConnectionBridge', 'saveCompetitionConnection']);
  host.competitionConnectionBusy = '';
  host.competitionConnectionForm = { enabled: true, endpoint: snapshot.endpoint, workspaceId: snapshot.workspaceId };
  host.$refs = { competitionAccessCodeInput: { value: 'synthetic-demo-access-code' } };
  host.competitionAdapterMode = 'live';
  host.loadCompetitionUiProfile = async () => undefined;
  assert.equal(await host.saveCompetitionConnection(), true);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].accessCode, 'synthetic-demo-access-code');
  assert.equal(host.$refs.competitionAccessCodeInput.value, '');
  assert.equal(host.competitionAdapterMode, 'live');
  assert.equal(host.competitionConnectionSnapshot, snapshot);
  assert.doesNotMatch(JSON.stringify(host.competitionConnectionResult), /synthetic-demo-access-code/);
  assert.deepEqual(host.calls, []);
});

/** 测试只触发检查；保存失败不删除旧配置，原始异常不回显。 / Testing only probes; failed saves retain settings and hide internal errors. */
test('in-app connection testing and failure do not save or leak input', async () => {
  let saves = 0; let tests = 0;
  const bridge = {
    getApplicationCompetitionConnection: async () => ({ ok: true }),
    testApplicationCompetitionConnection: async () => { tests++; return { ok: true, access: { serviceReady: true } }; },
    saveApplicationCompetitionConnection: async () => { saves++; throw new Error('private-access-code'); },
    clearApplicationCompetitionConnection: async () => ({ ok: true }),
  };
  const host = competitionHostFixture(bridge, ['getCompetitionConnectionBridge', 'testCompetitionConnection', 'saveCompetitionConnection', 'invalidateCompetitionConnectionTest']);
  host.competitionConnectionBusy = '';
  host.competitionConnectionForm = { enabled: true, endpoint: 'https://demo.example.test/', workspaceId: 'workspace-a' };
  host.$refs = { competitionAccessCodeInput: { value: 'private-access-code' } };
  const previous = { enabled: true, credentialConfigured: true };
  host.competitionConnectionSnapshot = previous;
  assert.equal(await host.testCompetitionConnection(), true);
  assert.equal(tests, 1); assert.equal(saves, 0);
  host.invalidateCompetitionConnectionTest();
  assert.equal(host.competitionConnectionResult, null);
  assert.equal(await host.saveCompetitionConnection(), false);
  assert.equal(host.competitionConnectionSnapshot, previous);
  assert.doesNotMatch(JSON.stringify(host.competitionConnectionResult), /private-access-code/);
  assert.deepEqual(host.calls, []);
});

/** 自动模式只能显式传给Main，Renderer不自行执行后续动作。 / Automatic mode must be explicitly sent to Main; the Renderer never executes follow-up actions itself. */
test('actual approval handler sends selected execution mode once and rejection always stays step', async () => {
  for (const [selection, decision, expected] of [['automatic', 'APPROVED', 'automatic'], ['step', 'APPROVED', 'step'], ['unexpected', 'APPROVED', 'step'], ['automatic', 'REJECTED', 'step']]) {
    const requests = [];
    const host = competitionHostFixture({
      /** 接收明确审批请求，未模拟闭环成功。 / Receive explicit approval without simulating closure success. */
      decideApplicationCompetitionApproval: async request => { requests.push(JSON.parse(JSON.stringify(request))); return { snapshot: host.competitionSnapshot }; },
    });
    host.competitionExecutionMode = selection;
    await host.decideCompetitionApproval(decision);
    assert.deepEqual(requests, [{ approvalId: 'approval-a', decision, reason: 'Reviewed original scopes', executionMode: expected }]);
    assert.equal(host.competitionBusyAction, '');
    assert.deepEqual(host.calls, expected === 'automatic' ? ['memory'] : []);
  }
});

/** 审批锁、异常和非法状态不能触发第二条执行链。 / Approval locks, exceptions and invalid states cannot start another execution chain. */
test('actual approval handler blocks duplicates and refreshes failure without replaying execution', async () => {
  let reject; let writes = 0;
  const host = competitionHostFixture({ decideApplicationCompetitionApproval: () => { writes += 1; return new Promise((resolve, rejectPromise) => { reject = rejectPromise; }); } });
  const pending = host.decideCompetitionApproval('APPROVED');
  await host.decideCompetitionApproval('APPROVED'); await host.decideCompetitionApproval('REJECTED'); assert.equal(writes, 1);
  reject(new Error('Automatic verification rejected closure')); await pending;
  assert.equal(host.competitionBusyAction, ''); assert.deepEqual(host.calls, ['refresh']); assert.equal(host.notices.at(-1)[1], 'error');
  host.approval.status = 'APPROVED'; await host.decideCompetitionApproval('APPROVED'); host.approval.status = 'PENDING'; await host.decideCompetitionApproval('INVALID'); assert.equal(writes, 1);
});

/** 候选保存不能显示已启用或触发启用接口。 / Saving a candidate cannot claim enablement or call an enablement API. */
test('actual retrospective handler reports a saved candidate and only refreshes catalogs', async () => {
  const requests = []; const host = competitionHostFixture({ exportApplicationCompetitionRetrospective: async request => { requests.push(request); return { retrospectiveSkillId: 'candidate-a' }; } });
  await host.exportCompetitionRetrospective(); assert.equal(requests[0].incidentId, 'incident-a'); assert.deepEqual(host.calls, ['skills', 'bindings']);
  assert.match(host.notices.at(-1)[0], /候选.*待测试认证/); assert.doesNotMatch(host.notices.at(-1)[0], /已保存并启用/);
});

/** 审批前即可读取完整授权摘要，保持真实补偿与依赖。 / Complete authorization summaries are readable before execution, preserving real compensation scopes and dependencies. */
test('approval plan projection exposes public original scopes without needing an action', () => {
  const host = competitionHostFixture(); const before = JSON.stringify(host.competitionSnapshot); const plan = host.getCompetitionApprovalPlan();
  assert.equal(plan.scopes.length, 2); assert.equal(plan.primaryCount, 1); assert.equal(plan.compensationCount, 1); assert.equal(plan.planDigest, 'a'.repeat(64));
  assert.deepEqual(JSON.parse(JSON.stringify(plan.scopes[0].dependencies)), [{ id: 'human-approval', title: 'Human approval' }]);
  assert.equal(plan.scopes[0].argumentsDigest, 'b'.repeat(64)); assert.equal(plan.scopes[0].expectedResourceVersion, 'rv-1');
  assert.equal(plan.scopes[1].compensation, true); assert.equal(plan.scopes[1].dependenciesKnown, false); assert.equal(plan.scopes[1].dependencies.length, 0);
  assert.doesNotMatch(JSON.stringify(plan), /private-secret|private-response|"arguments":/); assert.equal(JSON.stringify(host.competitionSnapshot), before);
  host.competitionSnapshot.taskGraphs[0].traceId = 'old-trace'; assert.equal(host.getCompetitionApprovalPlan().scopes[0].dependenciesKnown, false);
  host.approval.traceId = 'foreign-trace'; assert.equal(host.getCompetitionApprovalPlan(), null);
});

/** 公开摘要仍过滤误放入元数据的凭据，不伪造缺失值。 / Public summaries filter credentials misplaced in metadata without inventing missing values. */
test('approval plan projection redacts sensitive metadata and keeps unavailable scope fields explicit', () => {
  const host = competitionHostFixture(); host.approval.scopes[0].resourceId = 'https://user:pass@example.test/resource?token=private-query Authorization: Bearer private-bearer api_key="private-key"';
  host.approval.scopes[0].targetRevision = '2'; host.approval.scopes[0].expectedResourceVersion = undefined;
  const scope = host.getCompetitionApprovalPlan().scopes[0]; assert.match(scope.resourceId, /https:\/\/example.test\/resource/); assert.doesNotMatch(scope.resourceId, /user:pass|private-query|private-bearer|private-key/); assert.equal(scope.targetRevision, null); assert.equal(scope.expectedResourceVersion, '');
});

/** 待审批模板不依赖Action，提供详情、补偿和资源摘要。 / The pending-approval template does not require an Action and exposes detail, compensation and resource summaries. */
test('pending approval template exposes complete scope review before execution with theme-aware wrapping', () => {
  const html = readProjectFile('static/index.html'); const start = html.indexOf('<details v-if="getCompetitionApprovalPlan()'); const end = html.indexOf('</details>', start); const block = html.slice(start, end);
  assert.ok(start > 0); assert.match(block, /PENDING/); assert.doesNotMatch(block, /getCompetitionActiveAction/);
  for (const field of ['scopes', 'planDigest', 'argumentsDigest', 'expectedResourceVersion', 'resourceId', 'targetRevision', 'dependencies', 'compensation']) assert.ok(block.includes(field), field);
  assert.doesNotMatch(block, /v-html|JSON\.stringify|scope\.arguments\b/);
  const css = readProjectFile('static/css/competition-workbench-v2.css'); assert.match(css, /\.competition-approval-plan[\s\S]*var\(--ox-bg-surface\)/); assert.match(css, /\.competition-approval-plan__metadata dd[^}]*overflow-wrap: anywhere/);
});

/** 启用和停用必须保留原始来源，缺失来源也不能关联最新事件。 / Enablement and disablement preserve the original source and never infer the latest incident. */
test('actual skill binding handler preserves source across newer incidents and missing provenance', async () => {
  const requests = [];
  const host = competitionHostFixture({ setApplicationEnterpriseSkillBinding: async request => { requests.push(JSON.parse(JSON.stringify(request))); } });
  host.competitionSnapshot.incidents.push({ ...host.incident, incidentId: 'incident-newer', updatedAt: '2026-09-14T02:00:00Z' });
  assert.equal(host.getCompetitionActiveIncident().incidentId, 'incident-newer');
  const skill = { id: 'skill-a', sourceIncidentId: 'incident-a', enterpriseEnabled: false };
  assert.equal(await host.setEnterpriseSkillEnabled(skill, true), true);
  assert.equal(await host.setEnterpriseSkillEnabled(skill, false), true);
  assert.equal(await host.setEnterpriseSkillEnabled({ id: 'skill-no-source' }, true), true);
  assert.deepEqual(requests, [
    { workspaceId: 'workspace-a', skillId: 'skill-a', enabled: true, sourceIncidentId: 'incident-a' },
    { workspaceId: 'workspace-a', skillId: 'skill-a', enabled: false, sourceIncidentId: 'incident-a' },
    { workspaceId: 'workspace-a', skillId: 'skill-no-source', enabled: true, sourceIncidentId: null },
  ]);
  assert.equal(skill.enterpriseBusy, false); assert.deepEqual(host.calls, ['bindings', 'bindings', 'bindings']);
});

/** 绑定失败或重复点击不能伪装启用成功。 / Failed bindings and duplicate clicks cannot pretend enablement succeeded. */
test('actual skill binding handler does not optimistically enable after failure or duplicate requests', async () => {
  let reject; let writes = 0;
  const host = competitionHostFixture({ setApplicationEnterpriseSkillBinding: () => { writes += 1; return new Promise((resolve, failure) => { reject = failure; }); } });
  const skill = { id: 'skill-a', sourceIncidentId: 'incident-a', enterpriseEnabled: false };
  const pending = host.setEnterpriseSkillEnabled(skill, true);
  assert.equal(await host.setEnterpriseSkillEnabled(skill, true), false); assert.equal(writes, 1);
  reject(new Error('Binding rejected')); assert.equal(await pending, false);
  assert.equal(skill.enterpriseEnabled, false); assert.equal(skill.enterpriseBusy, false); assert.equal(skill.sourceIncidentId, 'incident-a'); assert.deepEqual(host.calls, []);
  host.canUseEnterprise = false; assert.equal(await host.setEnterpriseSkillEnabled(skill, true), false); assert.equal(writes, 1);
});

/** 明确选择后，排序变化或条目消失均不能暗中更换审批对象。 / Explicit selection never changes approval targets due to sorting or removal. */
test('real incident selector pins approval targets and isolates drafts and idempotency keys', async () => {
  const host = competitionHostFixture(); const other = { ...host.incident, incidentId: 'incident-b', activeApprovalId: 'approval-b', title: 'Other incident', updatedAt: '2026-09-14T00:00:00Z' };
  host.competitionSnapshot.incidents.push(other); host.competitionRollbackIdempotencyKey = 'rollback-a';
  assert.equal(await host.selectCompetitionIncident('incident-a'), true);
  assert.equal(await host.selectCompetitionIncident('incident-b'), true); assert.equal(host.competitionApprovalReason, ''); assert.equal(host.competitionRollbackIdempotencyKey, '');
  host.competitionApprovalReason = 'Review B'; host.competitionRollbackIdempotencyKey = 'rollback-b';
  assert.equal(await host.selectCompetitionIncident('incident-a'), true); assert.equal(host.competitionApprovalReason, 'Reviewed original scopes'); assert.equal(host.competitionRollbackIdempotencyKey, 'rollback-a');
  other.updatedAt = '2026-09-14T03:00:00Z'; assert.equal(host.getCompetitionActiveIncident().incidentId, 'incident-a');
  assert.deepEqual(Array.from(host.getCompetitionIncidentOptions(), item => item.incidentId), ['incident-b', 'incident-a']);
  assert.equal(await host.selectCompetitionIncident('unknown'), false); assert.equal(host.getCompetitionActiveIncident().incidentId, 'incident-a');
  host.competitionBusyAction = 'approve'; assert.equal(await host.selectCompetitionIncident('incident-b'), false); host.competitionBusyAction = '';
  assert.equal(await host.selectCompetitionIncident('incident-b'), true); assert.equal(host.competitionApprovalReason, 'Review B'); assert.equal(host.competitionRollbackIdempotencyKey, 'rollback-b');
  host.competitionSnapshot.incidents = [host.incident]; assert.equal(host.getCompetitionActiveIncident(), null); assert.equal(host.getCompetitionActiveApproval(), null);
});

/** 项目群入口绑定当前范围的原事件，并在异步等待后再核对范围。 / The group entry binds the original scoped incident and rechecks scope after awaiting. */
test('project audit opens the selected real incident and rejects foreign or changed group scope', async () => {
  const host = competitionHostFixture(); const other = { ...host.incident, incidentId: 'incident-b', updatedAt: '2026-09-14T03:00:00Z' };
  host.competitionSnapshot.incidents.push(other); host.getEnterpriseAuditIncident = () => host.incident;
  host.getEnterpriseSandboxIncidents = () => [host.incident]; host.openEnterpriseTab = async tab => { host.calls.push(tab); };
  assert.equal(await host.openEnterpriseAuditIncidentCenter(), true); assert.equal(host.getCompetitionActiveIncident().incidentId, 'incident-a'); assert.deepEqual(host.calls, ['memory', 'ops-control']);
  host.getEnterpriseSandboxIncidents = () => [other]; assert.equal(await host.openEnterpriseAuditIncidentCenter(), false); assert.deepEqual(host.calls, ['memory', 'ops-control']);
  host.getEnterpriseSandboxIncidents = () => [host.incident]; host.competitionSelectedIncidentId = 'incident-b';
  host.loadCompetitionMemoryArtifacts = async () => { host.getEnterpriseSandboxIncidents = () => [other]; };
  assert.equal(await host.openEnterpriseAuditIncidentCenter(), false); assert.deepEqual(host.calls, ['memory', 'ops-control']);
});

/** 异步记忆仅更新对应事件及最新请求，旧错误也不能清空新结果。 / Async memory updates only its incident and newest request; stale errors cannot clear newer data. */
test('real memory reads ignore stale successes and failures after incident switching', async () => {
  const pending = [];
  const host = competitionHostFixture({
    getSynapxnetMemoryStatus: async () => ({ available: true }),
    listSynapxnetMemories: request => new Promise((resolve, reject) => { pending.push({ request, resolve, reject }); }),
  }, ['loadCompetitionMemoryArtifacts']);
  const other = { ...host.incident, incidentId: 'incident-b', updatedAt: '2026-09-14T00:00:00Z' }; host.competitionSnapshot.incidents.push(other);
  const first = host.loadCompetitionMemoryArtifacts(true); const switched = host.selectCompetitionIncident('incident-b');
  assert.equal(pending[0].request.query, 'incident-a'); assert.equal(pending[1].request.query, 'incident-b');
  pending[0].resolve({ items: [{ taskId: 'incident:incident-a', id: 'old' }] }); await first; assert.equal(host.competitionMemoryLoading, true); assert.deepEqual(Array.from(host.competitionMemoryRecords), []);
  pending[1].resolve({ items: [{ taskId: 'incident:incident-b', id: 'current' }, { taskId: 'incident:incident-a', id: 'foreign' }] }); await switched;
  assert.deepEqual(Array.from(host.competitionMemoryRecords, item => item.id), ['current']); assert.equal(host.competitionMemoryLoading, false);
  const oldFailure = host.loadCompetitionMemoryArtifacts(true); const newer = host.loadCompetitionMemoryArtifacts(false);
  pending[3].resolve({ items: [{ taskId: 'incident:incident-b', id: 'newest' }] }); await newer;
  pending[2].reject(new Error('Old failed response')); await oldFailure;
  assert.deepEqual(Array.from(host.competitionMemoryRecords, item => item.id), ['newest']); assert.equal(host.competitionMemoryError, ''); assert.deepEqual(host.notices, []);
  host.competitionSelectedIncidentId = 'removed'; await host.loadCompetitionMemoryArtifacts(); assert.equal(pending.length, 4); assert.deepEqual(Array.from(host.competitionMemoryRecords), []);
});

/** 新快照保持明确选择，原生键盘入口连接同一个宿主方法。 / Fresh snapshots preserve explicit selection and native keyboard controls call the same host methods. */
test('snapshot refresh preserves incident selection and template connects both real navigation controls', async () => {
  let snapshot;
  const host = competitionHostFixture({ getApplicationCompetitionSnapshot: async () => snapshot, getApplicationCompetitionUiProfile: async () => ({ releaseProfile: 'goai-staging', rehearsalEnabled: true }) }, ['loadCompetitionSnapshot']);
  snapshot = host.competitionSnapshot; await host.loadCompetitionSnapshot(); assert.equal(host.competitionSelectedIncidentId, 'incident-a');
  snapshot = { ...snapshot, incidents: [{ ...host.incident, incidentId: 'newest' }] }; await host.loadCompetitionSnapshot(); assert.equal(host.competitionSelectedIncidentId, 'incident-a'); assert.equal(host.getCompetitionActiveIncident(), null);
  const html = readProjectFile('static/index.html'); assert.match(html, /<select[^>]*:aria-label=[^>]*@change="selectCompetitionIncident\(\$event\.target\.value\)"/);
  assert.match(html, /<button[^>]*:disabled="Boolean\(competitionBusyAction\)"[^>]*@click="openEnterpriseAuditIncidentCenter\(\)"/);
});

/** 调查和验证共用工具时，验证只能展示其原始证据引用。 / When investigation and verification share tools, verification shows only its own original evidence references. */
test('task nodes never borrow same-tool investigation receipts for pending verification', () => {
  const host = competitionHostFixture(); const graph = host.competitionSnapshot.taskGraphs[0]; const toolName = 'mlops.inference.probe';
  const scope = { incidentId: host.incident.incidentId, workspaceId: host.incident.workspaceId, traceId: host.incident.activeTraceId };
  const investigate = { nodeId: 'evidence:probe', lane: 'EVIDENCE', nodeType: 'TOOL_CALL', toolName, status: 'SUCCEEDED', evidenceIds: ['investigation-evidence'] };
  const verify = { nodeId: 'verify:probe', lane: 'VERIFICATION', nodeType: 'TOOL_CALL', toolName, status: 'PENDING', evidenceIds: [] };
  graph.nodes = [investigate, verify];
  host.competitionSnapshot.evidence = [{ ...scope, evidenceId: 'investigation-evidence', summary: 'Investigation result', observedAt: '2026-09-14T01:00:00Z' }];
  host.competitionSnapshot.invocations = [{ ...scope, toolName, invocationId: 'investigation-call', evidenceId: 'investigation-evidence', status: 'SUCCEEDED', startedAt: '2026-09-14T01:00:00Z' }];
  assert.equal(host.getCompetitionTaskNodeResult(investigate).summary, 'Investigation result'); assert.equal(host.getCompetitionTaskNodeResult(verify), null);
  verify.status = 'SUCCEEDED'; assert.equal(host.getCompetitionTaskNodeResult(verify), null);
  host.incident.activeActionId = 'action-a'; host.competitionSnapshot.actions = [{ ...scope, actionId: 'action-a', verificationEvidenceIds: ['verification-evidence'], steps: [] }];
  verify.evidenceIds = ['investigation-evidence']; assert.equal(host.getCompetitionTaskNodeResult(verify), null);
  verify.evidenceIds = ['verification-evidence'];
  host.competitionSnapshot.evidence.push({ ...scope, evidenceId: 'verification-evidence', summary: 'Independent verification result', observedAt: '2026-09-14T02:00:00Z' });
  assert.equal(host.getCompetitionTaskNodeResult(verify).summary, 'Independent verification result');
  host.competitionSnapshot.evidence[1].traceId = 'old-trace'; assert.equal(host.getCompetitionTaskNodeResult(verify), null);
  host.competitionSnapshot.evidence[1].traceId = scope.traceId; host.competitionSnapshot.evidence[1].workspaceId = 'other-workspace'; assert.equal(host.getCompetitionTaskNodeResult(verify), null);
});

/** 无Evidence的执行失败仍可通过步骤原invocationId展示，不能借同工具后续成功。 / Execution failures without evidence remain visible by original step invocation ID, without borrowing later same-tool success. */
test('execution node results use exact action step invocation IDs and reject stale traces', () => {
  const host = competitionHostFixture(); const graph = host.competitionSnapshot.taskGraphs[0]; const toolName = 'aiops.inference.capacity.apply';
  const scope = { incidentId: host.incident.incidentId, workspaceId: host.incident.workspaceId, traceId: host.incident.activeTraceId };
  const node = { nodeId: 'execute:capacity-apply', lane: 'EXECUTION', nodeType: 'TOOL_CALL', toolName, status: 'FAILED', evidenceIds: [] }; graph.nodes = [node];
  host.incident.activeActionId = 'action-a'; host.competitionSnapshot.actions = [{ ...scope, actionId: 'action-a', steps: [{ stepId: 'capacity-apply', toolName, invocationId: 'failed-original', evidenceId: null }] }];
  host.competitionSnapshot.invocations = [
    { ...scope, toolName, invocationId: 'failed-original', evidenceId: null, status: 'FAILED', errorMessage: 'Resource version changed', errorCode: 'STALE_VERSION', startedAt: '2026-09-14T01:00:00Z' },
    { ...scope, toolName, invocationId: 'unrelated-success', evidenceId: 'unrelated', status: 'SUCCEEDED', startedAt: '2026-09-14T02:00:00Z' },
  ];
  assert.equal(host.getCompetitionTaskNodeResult(node).status, 'FAILED'); assert.equal(host.getCompetitionTaskNodeResult(node).errorCode, 'STALE_VERSION');
  host.competitionSnapshot.invocations[0].traceId = 'old-trace'; assert.equal(host.getCompetitionTaskNodeResult(node), null);
  host.competitionSnapshot.invocations[0].traceId = scope.traceId; graph.traceId = 'old-trace'; assert.equal(host.getCompetitionTaskNodeResult(node), null);
});

/** 聚合及裁决不得把单项成功指标作为失败结论，也不能借用旧Trace决策。 / Aggregates and decisions cannot present one successful metric as a failed verdict or borrow old-trace decisions. */
test('decision nodes use real scoped conclusions or evidence counts without borrowing individual metrics', () => {
  const host = competitionHostFixture(); const graph = host.competitionSnapshot.taskGraphs[0];
  const scope = { incidentId: host.incident.incidentId, workspaceId: host.incident.workspaceId, traceId: host.incident.activeTraceId };
  const verifier = { nodeId: 'verifier-conclusion', nodeType: 'POLICY_DECISION', lane: 'VERIFICATION', status: 'FAILED', evidenceIds: ['verified-a', 'verified-b'] };
  const plan = { nodeId: 'select-governed-plan', nodeType: 'POLICY_DECISION', lane: 'REASONING', status: 'SUCCEEDED', evidenceIds: ['investigated-a'] };
  const fusion = { nodeId: 'fuse-cross-platform-evidence', nodeType: 'EVIDENCE_FUSION', lane: 'REASONING', status: 'SUCCEEDED', evidenceIds: ['investigated-a'] };
  graph.nodes = [verifier, plan, fusion]; host.incident.activeActionId = 'action-a';
  host.competitionSnapshot.actions = [{ ...scope, actionId: 'action-a', verificationEvidenceIds: ['verified-a', 'verified-b'], steps: [] }];
  host.competitionSnapshot.evidence = [
    { ...scope, evidenceId: 'investigated-a', summary: 'Unrelated first investigation error metric' },
    { ...scope, evidenceId: 'verified-a', summary: 'One healthy metric does not allow closure' },
    { ...scope, evidenceId: 'verified-b', summary: 'Business verification failed' },
  ];
  const before = JSON.stringify(host.competitionSnapshot);
  assert.equal(host.getCompetitionTaskNodeResult(verifier).summary, '2 条关联证据');
  assert.equal(host.getCompetitionTaskNodeResult(verifier).status, 'FAILED');
  assert.equal(host.getCompetitionTaskNodeResult(plan).summary, '1 条关联证据');
  assert.equal(host.getCompetitionTaskNodeResult(fusion).summary, '1 条关联证据');
  assert.equal(JSON.stringify(host.competitionSnapshot), before);
  host.competitionSnapshot.agentDecisions = [
    { ...scope, stage: 'VERIFICATION_CONCLUSION', decision: 'ROLLBACK_REQUIRED', summary: 'Business thresholds failed; rollback required' },
    { ...scope, traceId: 'old-trace', stage: 'VERIFICATION_CONCLUSION', decision: 'CLOSE', summary: 'Old trace succeeded' },
  ];
  host.competitionSnapshot.reasoningDecisions = [
    { ...scope, decisionType: 'PLAN_SELECTION', selectedCandidateId: 'plan-a', explanation: 'Original policy explanation', candidates: [{ candidateId: 'plan-a', title: 'Governed recovery', policyDecision: 'APPROVAL_REQUIRED' }] },
    { ...scope, workspaceId: 'foreign-workspace', decisionType: 'PLAN_SELECTION', explanation: 'Foreign policy explanation' },
  ];
  assert.equal(host.getCompetitionTaskNodeResult(verifier).summary, 'ROLLBACK_REQUIRED · Business thresholds failed; rollback required');
  assert.equal(host.getCompetitionTaskNodeResult(verifier).evidenceId, null);
  assert.equal(host.getCompetitionTaskNodeResult(plan).summary, 'Governed recovery · APPROVAL_REQUIRED · Original policy explanation');
  host.competitionSnapshot.agentDecisions[0].workspaceId = 'foreign-workspace';
  assert.equal(host.getCompetitionTaskNodeResult(verifier).summary, '2 条关联证据');
  host.competitionSnapshot.evidence[2].traceId = 'old-trace';
  assert.equal(host.getCompetitionTaskNodeResult(verifier).summary, '1 条关联证据');
});

/** 失败时间线必须区分审批、执行和验证，旧范围不能推动阶段。 / Failed workflow progress distinguishes approval, execution and verification without advancing from stale-scope records. */
test('failed timeline follows the actual scoped stage and marks failure instead of pending approval', () => {
  const host = competitionHostFixture({}, ['getCompetitionStageIndex', 'getCompetitionStageClass']);
  const scope = { incidentId: host.incident.incidentId, workspaceId: host.incident.workspaceId, traceId: host.incident.activeTraceId };
  host.incident.status = 'FAILED'; host.approval.status = 'REJECTED';
  assert.equal(host.getCompetitionStageIndex('FAILED'), 2); assert.equal(host.getCompetitionStageClass(2), 'is-failed');
  host.approval.status = 'APPROVED'; host.incident.activeActionId = 'action-a';
  host.competitionSnapshot.actions = [{ ...scope, actionId: 'action-a', status: 'FAILED', stage: 'FAILED', verificationEvidenceIds: [], steps: [{ status: 'FAILED' }] }];
  assert.equal(host.getCompetitionStageIndex('FAILED'), 3); assert.equal(host.getCompetitionStageClass(3), 'is-failed');
  host.competitionSnapshot.actions[0].verificationEvidenceIds = ['verified-a'];
  host.competitionSnapshot.evidence = [{ ...scope, evidenceId: 'verified-a', summary: 'Original verifier metric' }];
  assert.equal(host.getCompetitionStageIndex('FAILED'), 4); assert.equal(host.getCompetitionStageClass(4), 'is-failed');
  assert.equal(host.getCompetitionStageClass(2), 'is-complete'); assert.equal(host.getCompetitionStageClass(5), 'is-pending');
  host.competitionSnapshot.evidence[0].traceId = 'old-trace'; assert.equal(host.getCompetitionStageIndex('FAILED'), 3);
  host.competitionSnapshot.actions[0].steps[0].status = 'SUCCEEDED'; assert.equal(host.getCompetitionStageIndex('FAILED'), -1);
  host.competitionSnapshot.actions[0].steps[0].status = 'FAILED';
  host.competitionSnapshot.agentDecisions = [{ ...scope, stage: 'VERIFICATION_CONCLUSION', decision: 'ROLLBACK_REQUIRED' }];
  assert.equal(host.getCompetitionStageIndex('FAILED'), 4);
  host.competitionSnapshot.agentDecisions[0].workspaceId = 'foreign-workspace'; assert.equal(host.getCompetitionStageIndex('FAILED'), 3);
  host.competitionSnapshot.actions[0].traceId = 'old-trace'; assert.equal(host.getCompetitionStageIndex('FAILED'), 2);
  host.approval.traceId = 'old-trace'; assert.equal(host.getCompetitionStageIndex('FAILED'), 1);
  host.competitionSnapshot.taskGraphs[0].nodes = [{ nodeId: 'route-agent-team', status: 'FAILED' }]; assert.equal(host.getCompetitionStageIndex('FAILED'), 0);
  host.incident.activeTraceId = null; assert.equal(host.getCompetitionStageIndex('FAILED'), -1); assert.equal(host.getCompetitionStageClass(0), 'is-pending');
  host.incident.status = 'RESOLVED'; assert.equal(host.getCompetitionStageClass(5), 'is-current');
  assert.match(readProjectFile('static/index.html'), /本阶段未通过/);
  assert.match(readProjectFile('static/css/competition-workbench-v2.css'), /\.competition-stage\.is-failed\s*\{/);
});

/** 实际绑定优先于草稿，标题和指标共用同一真实运行标签。 / Actual bindings take precedence over drafts; titles and metrics share the same factual runtime label. */
test('incident runtime labels follow the current trace binding independently of the task draft', () => {
  const host = competitionHostFixture(); host.competitionTeamRuntime = 'agentteams';
  host.competitionSnapshot.teamBindings = [
    { incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a', runtime: 'builtin', createdAt: '2026-09-14T01:00:00Z' },
    { incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'old-trace', runtime: 'agentteams', createdAt: '2026-09-14T02:00:00Z' },
  ];
  assert.equal(host.getCompetitionRuntimeLabel(), 'Builtin');
  host.competitionSnapshot.teamBindings[0].runtime = 'agentteams'; host.competitionTeamRuntime = 'builtin'; assert.equal(host.getCompetitionRuntimeLabel(), 'AgentTeams');
  host.competitionSnapshot.teamBindings[0].workspaceId = 'other-workspace'; assert.equal(host.getCompetitionRuntimeLabel(), '尚未绑定');
  const html = readProjectFile('static/index.html'); assert.match(html, /competition-eyebrow[^\n]+getCompetitionActiveIncident\(\)\.severity[^\n]+getCompetitionRuntimeLabel\(\)/);
  assert.doesNotMatch(html, /getCompetitionActiveTeamBinding\(\)\?\.runtime === 'agentteams' \|\| competitionTeamRuntime/);
});

/** 下一场景草稿独立于当前事件，新建后旧事件及审批草稿仍可恢复。 / The next scenario draft is independent of the active incident; older incidents and approval drafts remain recoverable after creation. */
test('new rehearsal drafts preserve current approval and create consecutive incidents without resetting evidence', async () => {
  const requests = [];
  const host = competitionHostFixture({
    /** 返回包含原记录的新增真实形状回执，不执行reset。 / Return an append-only receipt shape without invoking reset. */
    createApplicationCompetitionIncident: async request => { requests.push(JSON.parse(JSON.stringify(request))); const incident = { ...request, incidentId: `created-${requests.length}`, activeApprovalId: null, activeTraceId: null, status: 'OPEN', updatedAt: '2026-09-14T03:00:00Z' }; return { incidentId: incident.incidentId, snapshot: { ...host.competitionSnapshot, incidents: [...host.competitionSnapshot.incidents, incident] } }; },
  });
  host.competitionSelectedIncidentId = host.incident.incidentId; host.competitionRollbackIdempotencyKey = 'original-key';
  const original = JSON.stringify(host.competitionSnapshot);
  assert.equal(host.selectCompetitionDemoScenario('quantitative-iteration'), true);
  assert.equal(JSON.stringify(host.competitionSnapshot), original); assert.equal(host.competitionApprovalReason, 'Reviewed original scopes'); assert.equal(host.competitionRollbackIdempotencyKey, 'original-key'); assert.equal(host.competitionSelectedIncidentId, 'incident-a');
  assert.equal(await host.createCompetitionDemoIncident(), true); assert.equal(host.competitionSnapshot.incidents.length, 2);
  assert.equal(host.enterpriseTab, 'ops-control'); assert.equal(host.operationsDetailVisible, true);
  host.competitionRehearsalVisible = true; // 用户再次打开演练草稿。 / User reopens the rehearsal draft.
  assert.equal(host.selectCompetitionDemoScenario('feature-drift'), true); assert.equal(host.selectCompetitionDemoPath('verification-failure'), true);
  assert.equal(await host.createCompetitionDemoIncident(), true); assert.equal(host.competitionSnapshot.incidents.length, 3);
  assert.equal(requests[0].scenario.scenarioType, 'quantitative-iteration'); assert.equal(requests[0].projectId, 'project-a');
  assert.equal(requests[1].scenario.testDatasetRef, 'fixture://goai/verification-failure-v1'); assert.notEqual(host.competitionDemoForm.scenario.testDatasetRef, 'fixture://goai/verification-failure-v1');
  assert.equal(await host.selectCompetitionIncident('incident-a'), true); assert.equal(host.competitionApprovalReason, 'Reviewed original scopes'); assert.equal(host.competitionRollbackIdempotencyKey, 'original-key');
  assert.equal(JSON.stringify(host.competitionSnapshot.incidents[0]), JSON.stringify(JSON.parse(original).incidents[0])); assert.deepEqual(host.competitionSnapshot.approvals, [host.approval]);
  assert.equal(host.calls.includes('refresh'), false);
});

/** 宿主再次拦截Live和不支持的失败路径，防止绕过禁用按钮。 / The host blocks Live and unsupported failure paths again, preventing disabled-button bypasses. */
test('rehearsal creation rejects Live failure injection and unsupported scenarios before calling the runtime', async () => {
  let requests = 0; const host = competitionHostFixture({ createApplicationCompetitionIncident: async () => { requests += 1; } });
  host.selectCompetitionDemoScenario('feature-drift'); host.selectCompetitionDemoPath('verification-failure'); host.competitionAdapterMode = 'live';
  assert.equal(await host.createCompetitionDemoIncident(), false); assert.equal(host.selectCompetitionDemoPath('verification-failure'), false);
  host.competitionDemoScenarioMode = 'recovery'; host.competitionDemoForm.scenario.testDatasetRef = 'fixture://goai/verification-failure-v1'; assert.equal(await host.createCompetitionDemoIncident(), false);
  host.competitionAdapterMode = 'fixture'; host.selectCompetitionDemoScenario('recommendation-capacity'); assert.equal(host.canUseCompetitionVerificationFailure(), false); assert.equal(host.selectCompetitionDemoPath('verification-failure'), false);
  host.competitionDemoScenarioMode = 'verification-failure'; assert.equal(await host.createCompetitionDemoIncident(), false);
  host.selectCompetitionDemoScenario('feature-drift'); host.competitionRehearsalAvailable = false; assert.equal(await host.createCompetitionDemoIncident(), false);
  assert.equal(requests, 0); assert.equal(host.competitionSnapshot.incidents.length, 1);
});

/** 新建失败与重复点击保留当前事件和新草稿。 / Creation failures and duplicate clicks preserve the current incident and new draft. */
test('failed or duplicated rehearsal creation retains incident and draft without clearing history', async () => {
  let reject; let requests = 0; const host = competitionHostFixture({ createApplicationCompetitionIncident: () => { requests += 1; return new Promise((resolve, failure) => { reject = failure; }); } });
  host.selectCompetitionDemoScenario('quantitative-iteration'); const before = JSON.stringify(host.competitionSnapshot); const draft = JSON.stringify(host.competitionDemoForm);
  const pending = host.createCompetitionDemoIncident(); assert.equal(await host.createCompetitionDemoIncident(), false); assert.equal(host.selectCompetitionDemoScenario('feature-drift'), false);
  reject(new Error('Creation failed')); assert.equal(await pending, false); assert.equal(requests, 1); assert.equal(JSON.stringify(host.competitionSnapshot), before); assert.equal(JSON.stringify(host.competitionDemoForm), draft); assert.equal(host.competitionApprovalReason, 'Reviewed original scopes'); assert.equal(host.competitionBusyAction, '');
});

/** 已解决区域的新建按钮只定位配置，唯一创建入口始终处于演练面板内。 / The resolved-area button only focuses configuration; the sole creation control always lives inside the rehearsal panel. */
test('new incident shortcut opens a shared keyboard-accessible draft without creating or resetting incidents', async () => {
  const host = competitionHostFixture(); host.competitionRehearsalVisible = false;
  host.openCompetitionRehearsal = async () => { host.competitionRehearsalVisible = true; host.calls.push('open'); };
  host.$nextTick = async () => {};
  host.$refs = { competitionNewIncidentDraft: { scrollIntoView: () => host.calls.push('scroll'), focus: () => host.calls.push('focus') } };
  const before = JSON.stringify(host.competitionSnapshot); assert.equal(await host.openCompetitionNewIncidentDraft(), true); assert.deepEqual(host.calls, ['open', 'scroll', 'focus']); assert.equal(JSON.stringify(host.competitionSnapshot), before);
  const html = readProjectFile('static/index.html'); const panelStart = html.indexOf('class="competition-rehearsal-panel">'); const headerEnd = html.indexOf('</header>', panelStart); const panel = html.slice(panelStart, headerEnd);
  assert.match(panel, /ref="competitionNewIncidentDraft"[^>]*tabindex="-1"/); assert.match(panel, /新事件的业务场景/); assert.match(panel, /新事件的演示路径/); assert.match(panel, /@click="createCompetitionDemoIncident"/); assert.equal((html.match(/@click="createCompetitionDemoIncident"/g) || []).length, 1);
  assert.match(panel, /!canUseCompetitionVerificationFailure\(\)/); assert.match(html, /@click="openCompetitionNewIncidentDraft"/);
});

/** 全局队列不能借用其他空间、旧Trace或旧审批；所有匹配运行可访问。 / The global queue must reject foreign scopes, old traces and stale approvals while exposing every matching run. */
test('operations lists all runs and exact pending approvals across three workspaces', () => {
  const host = competitionHostFixture({}, ['getOperationsWorkspaceOptions', 'matchesOperationsScope', 'getOperationsRuns', 'getOperationsPendingApprovals']);
  host.enterpriseWorkspaces = ['a', 'b', 'c'].map(id => ({ id: `workspace-${id}`, name: `Space ${id}` }));
  host.competitionSnapshot.incidents = Array.from({ length: 12 }, (_, index) => ({ ...host.incident, incidentId: `run-${index}`, title: `Task ${index}`, workspaceId: `workspace-${['a', 'b', 'c'][index % 3]}`, activeTraceId: `trace-${index}`, activeApprovalId: `approval-${index}`, status: index === 11 ? 'RESOLVED' : 'AWAITING_APPROVAL' }));
  host.competitionSnapshot.approvals = host.competitionSnapshot.incidents.map(item => ({ ...host.approval, approvalId: item.activeApprovalId, incidentId: item.incidentId, workspaceId: item.workspaceId, traceId: item.activeTraceId }));
  host.competitionSnapshot.approvals[0].workspaceId = 'workspace-c';
  host.competitionSnapshot.approvals[1].traceId = 'old-trace';
  host.competitionSnapshot.approvals[2].approvalId = 'old-approval';
  host.competitionSnapshot.approvals[11].status = 'APPROVED';
  assert.equal(host.getOperationsRuns().length, 12);
  assert.equal(host.getOperationsPendingApprovals().length, 8);
  host.operationsWorkspaceFilter = 'workspace-a';
  assert.equal(host.getOperationsRuns().length, 4);
  assert.equal(host.getOperationsPendingApprovals().length, 3);
  assert.ok(host.getOperationsPendingApprovals().every(row => row.approval.workspaceId === 'workspace-a'));
  host.operationsSearch = 'Task 6'; assert.equal(host.getOperationsRuns()[0].incidentId, 'run-6'); assert.equal(host.getOperationsPendingApprovals().length, 1);
  host.operationsSearch = ''; host.operationsWorkspaceFilter = 'all'; host.operationsStatusFilter = 'completed';
  assert.equal(host.getOperationsRuns().length, 1); assert.equal(host.getOperationsRuns()[0].status, 'RESOLVED');
  assert.equal(host.getOperationsPendingApprovals().length, 8, 'The approval queue remains independent of the run-status filter');
});

/** 正式详情保留筛选且仅导航；失效审批不能打开其他对象。 / Formal details preserve filters and only navigate; stale approvals cannot target a replacement. */
test('operations navigation preserves filters and rejects stale approval targets', async () => {
  const host = competitionHostFixture({}, ['matchesOperationsScope', 'getOperationsPendingApprovals', 'openOperationsRun', 'closeOperationsRun']);
  host.enterpriseTab = 'ops-control'; host.operationsWorkspaceFilter = 'workspace-a'; host.operationsSearch = 'Task'; host.incident.title = 'Task A';
  assert.equal(await host.openOperationsRun('incident-a', 'approval-a'), true);
  assert.equal(host.operationsDetailVisible, true); assert.equal(host.competitionRehearsalVisible, false);
  host.closeOperationsRun(); assert.equal(host.operationsDetailVisible, false); assert.equal(host.operationsWorkspaceFilter, 'workspace-a'); assert.equal(host.operationsSearch, 'Task');
  assert.equal(await host.openOperationsRun('incident-a', 'expired-approval'), false); assert.equal(host.operationsDetailVisible, false);
  host.approval.workspaceId = 'workspace-b'; assert.equal(host.getCompetitionActiveApproval(), null);
  assert.equal(await host.openOperationsRun('incident-a', 'approval-a'), false);
  assert.deepEqual(host.calls, []);
});

/** 前置条件必须来自同空间成员与实际协同绑定，不能用模板计数冒充已运行。 / Prerequisites must use scoped staff and actual runtime bindings, never template counts as proof of execution. */
test('operations prerequisites require scoped staff assignments and an actual AgentTeams binding', () => {
  const host = competitionHostFixture({}, ['getCompetitionPrerequisiteSteps']);
  host.enterpriseWorkspaces = [{ id: 'workspace-a', name: 'Risk governance' }];
  host.enterpriseRoleCards = ['leader', 'worker', 'verifier'].map(id => ({ id, enabled: true, assignedWorkspace: 'workspace-a' }));
  host.enterpriseTeamTemplates = [{ id: 'team-a', enabled: true, workspaceId: 'workspace-a', members: ['leader', 'worker', 'verifier'].map(id => ({ roleCardId: id, teamRole: id })) }];
  host.competitionTeamTemplateId = 'team-a';
  let steps = host.getCompetitionPrerequisiteSteps();
  assert.deepEqual(Array.from(steps, step => step.id), ['sandbox', 'workspace', 'staff', 'team', 'assignment', 'template', 'incident', 'agentteams']);
  assert.equal(steps.find(step => step.id === 'assignment').done, true); assert.equal(steps.at(-1).done, false);
  host.competitionSnapshot.teamBindings = [{ incidentId: host.incident.incidentId, workspaceId: host.incident.workspaceId, traceId: host.incident.activeTraceId, runtime: 'agentteams', memberSnapshots: [{ role: 'leader' }] }];
  assert.equal(host.getCompetitionPrerequisiteSteps().at(-1).done, true);
  host.enterpriseRoleCards[2].assignedWorkspace = 'foreign-space';
  assert.equal(host.getCompetitionPrerequisiteSteps().find(step => step.id === 'assignment').done, false);
  host.operationsWorkspaceFilter = 'foreign-space';
  steps = host.getCompetitionPrerequisiteSteps(); assert.equal(steps.find(step => step.id === 'workspace').done, false); assert.equal(steps.at(-1).done, false);
});

/** HUD首次加载不打扰，变化才发布公开摘要，同状态刷新不重复。 / The HUD stays quiet on initial load, publishes only public state changes and ignores repeated states. */
test('enterprise HUD publishes state transitions after a quiet baseline without exposing payloads', async () => {
  const notices = [];
  const host = competitionHostFixture({ publishCompletionNotice: async notice => { notices.push(JSON.parse(JSON.stringify(notice))); } });
  host.enterpriseWorkspaces = [{ id: 'workspace-a', name: 'Risk workspace' }];
  host.applyOperationsRuntimeSnapshot(host.competitionSnapshot); await Promise.resolve(); assert.equal(notices.length, 0);
  host.incident.status = 'INVESTIGATING'; host.incident.title = 'Business recovery'; host.incident.summary = 'password=secret';
  host.applyOperationsRuntimeSnapshot(host.competitionSnapshot); await Promise.resolve();
  assert.equal(notices.length, 1); assert.equal(notices[0].status, 'running'); assert.equal(notices[0].source, 'enterprise_run');
  assert.equal(notices[0].workspaceId, 'workspace-a'); assert.equal(notices[0].incidentId, 'incident-a'); assert.equal(notices[0].traceId, 'trace-a'); assert.ok(!JSON.stringify(notices).includes('password'));
  host.applyOperationsRuntimeSnapshot(host.competitionSnapshot); await Promise.resolve(); assert.equal(notices.length, 1);
  host.incident.status = 'AWAITING_APPROVAL'; host.applyOperationsRuntimeSnapshot(host.competitionSnapshot); await Promise.resolve(); assert.equal(notices[1].status, 'action_required');
  host.incident.status = 'RESOLVED'; host.applyOperationsRuntimeSnapshot(host.competitionSnapshot); await Promise.resolve(); assert.equal(notices[2].status, 'completed');
});

/** HUD深链必须重新核对空间与活动Trace，不能打开旧运行或执行审批。 / HUD links must recheck workspace and active trace without opening old runs or executing approvals. */
test('enterprise HUD navigation rejects stale identities and rechecks after asynchronous loading', async () => {
  const host = competitionHostFixture({ getApplicationCompetitionSnapshot: async () => host.competitionSnapshot }, ['openOperationsNoticeTarget']);
  const target = { source: 'enterprise_run', resultId: 'result-a', incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a' };
  host.openOperationsRun = async id => { host.calls.push(id); return true; };
  assert.equal(await host.openOperationsNoticeTarget({ ...target, workspaceId: 'foreign' }), false); assert.deepEqual(host.calls, []);
  assert.equal(await host.openOperationsNoticeTarget({ ...target, traceId: 'stale' }), false); assert.deepEqual(host.calls, []);
  assert.equal(await host.openOperationsNoticeTarget(target), true); assert.equal(host.activeMenu, 'enterprise');
  host.openOperationsRun = async () => { host.incident.activeTraceId = 'new-trace'; return true; };
  assert.equal(await host.openOperationsNoticeTarget(target), false); assert.equal(host.operationsDetailVisible, false);
});

/** 演练草稿B不得被当前事件A的模板覆盖，正式详情仍按事件空间读取。 / Draft B must not inherit event A's template; formal details continue to use their event scope. */
test('rehearsal template reload follows draft scope while run detail follows its incident', async () => {
  const teams = [{ id: 'team-a', workspaceId: 'workspace-a', enabled: true }, { id: 'team-b', workspaceId: 'workspace-b', enabled: true }];
  const host = competitionHostFixture({ listApplicationEnterpriseTeamTemplates: async () => ({ teamTemplates: teams }) }, ['loadEnterpriseTeamTemplates', 'getCompetitionAvailableTeamTemplates', 'selectCompetitionDemoWorkspace']);
  /** 本例只验证模板作用域，员工读取保持只读空实现。 / This scope test keeps the employee read inert. */
  host.loadEnterpriseRoleCards = async () => {};
  host.enterpriseWorkspaces = [{ id: 'workspace-a', name: 'A' }, { id: 'workspace-b', name: 'B' }];
  host.enterpriseProjects = [{ id: 'project-a', workspaceId: 'workspace-a' }];
  host.enterpriseTab = 'competition'; host.competitionDemoForm.workspaceId = 'workspace-b'; host.competitionTeamTemplateId = 'team-b';
  await host.loadEnterpriseTeamTemplates(); assert.equal(host.competitionTeamTemplateId, 'team-b');
  host.competitionTeamTemplateId = 'team-a'; await host.loadEnterpriseTeamTemplates(); assert.equal(host.competitionTeamTemplateId, 'team-b');
  assert.equal(host.selectCompetitionDemoWorkspace('workspace-b'), true); assert.equal(host.competitionDemoForm.projectId, undefined);
  assert.equal(host.selectCompetitionDemoWorkspace('missing'), false); assert.equal(host.competitionDemoForm.workspaceId, 'workspace-b');
  host.enterpriseTab = 'ops-control'; await host.loadEnterpriseTeamTemplates(); assert.equal(host.competitionTeamTemplateId, 'team-a');
  assert.equal(host.getCompetitionActiveIncident().incidentId, 'incident-a');
});

/** 检测授权先于保存可见，编辑和失败不会把旧授权误标为新工作空间。 / Show tested access before saving without relabeling stale access after edits or failures. */
test('connection access receipt distinguishes tested and saved scopes and invalidates edits', () => {
  const host = competitionHostFixture({}, ['getCompetitionConnectionAccessReceipt', 'invalidateCompetitionConnectionTest']);
  host.enterpriseWorkspaces = [{ id: 'workspace-a', name: '空间 A' }, { id: 'workspace-b', name: '空间 B' }];
  const saved = { workspaceId: 'workspace-a', label: 'Saved A', expiresAt: '2026-09-23T00:00:00Z', remainingRequests: 12 };
  const tested = { workspaceId: 'workspace-b', label: 'Test B', expiresAt: '2026-09-24T00:00:00Z', remainingRequests: 60 };
  host.competitionConnectionSnapshot = null;
  assert.equal(host.getCompetitionConnectionAccessReceipt(), null);
  host.competitionConnectionResult = { action: 'test', ok: true, access: tested };
  assert.equal(host.getCompetitionConnectionAccessReceipt().access, tested);
  assert.equal(host.getCompetitionConnectionAccessReceipt().source, 'test');
  assert.equal(host.getCompetitionConnectionAccessReceipt().workspaceName, '空间 B');
  host.competitionConnectionSnapshot = { access: saved };
  assert.equal(host.getCompetitionConnectionAccessReceipt().access, tested);
  host.invalidateCompetitionConnectionTest();
  assert.equal(host.getCompetitionConnectionAccessReceipt().access, saved);
  assert.equal(host.getCompetitionConnectionAccessReceipt().source, 'saved');
  assert.equal(host.getCompetitionConnectionAccessReceipt().workspaceName, '空间 A');
  host.competitionConnectionResult = { action: 'test', ok: false, code: 'ACCESS_INVALID', access: tested };
  assert.equal(host.getCompetitionConnectionAccessReceipt().access, saved);
  host.competitionConnectionSnapshot = null;
  assert.equal(host.getCompetitionConnectionAccessReceipt(), null);
});

/** 驻场概览归入独立整行容器，不再与固定工作流网格同层自动落位。 / Resident summaries belong to a full-row container rather than auto-placing alongside fixed workflow cells. */
test('resident summary and status strip share an isolated row above the unchanged workflow grid', () => {
  const tree = require('parse5').parse(readProjectFile('static/index.html'));
  const nodes = [];
  /** 包含template内容的真实DOM遍历。 / Traverse actual DOM nodes including template content. */
  function visit(node) { nodes.push(node); for (const child of node.childNodes || []) visit(child); if (node.content) visit(node.content); }
  visit(tree);
  /** 按原始class找到唯一布局节点。 / Locate a unique layout node by its original class. */
  const byClass = name => nodes.find(node => node.attrs?.some(attribute => attribute.name === 'class' && attribute.value.split(/\s+/).includes(name)));
  const overview = byClass('competition-runtime-overview');
  assert.ok(overview); assert.equal(byClass('competition-resident-strip').parentNode, overview); assert.equal(byClass('competition-kpi-strip').parentNode, overview);
  assert.equal(byClass('competition-stage-rail').parentNode, overview.parentNode);
  const css = readProjectFile('static/css/competition-workbench-v2.css');
  assert.match(css, /\.competition-runtime-overview\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;/u);
  assert.match(css, /\.ops-demo-launcher \.competition-segmented--scenarios\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
});

/** 历史来源不能随全局演练开关变化，外空间上下文与冲突来源不被冒用。 / Historical sources cannot follow the global rehearsal switch or borrow foreign or conflicting contexts. */
test('run source labels use frozen scoped contexts and mark unstarted draft modes explicitly', () => {
  const host = competitionHostFixture({}, ['getOperationsRunSourceLabel']);
  host.competitionAdapterMode = 'live';
  assert.equal(host.getOperationsRunSourceLabel(), '本次来源未确认');
  host.competitionSnapshot.residentContexts = [{ incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a', source: 'SIMULATION' }, { incidentId: 'incident-a', workspaceId: 'workspace-b', traceId: 'trace-a', source: 'LIVE-STAGING' }];
  assert.equal(host.getOperationsRunSourceLabel(), '本地模拟 (Fixture)');
  host.competitionSnapshot.residentContexts[0].source = 'LIVE-STAGING'; host.competitionAdapterMode = 'fixture';
  assert.equal(host.getOperationsRunSourceLabel(), 'Live 现场');
  host.competitionSnapshot.residentContexts.push({ ...host.competitionSnapshot.residentContexts[0], source: 'SIMULATION' });
  assert.equal(host.getOperationsRunSourceLabel(), '本次来源未确认');
  host.incident.activeTraceId = null;
  assert.equal(host.getOperationsRunSourceLabel(), '尚未开始 · 下一次使用本地模拟 (Fixture)');
  host.competitionAdapterMode = 'live'; assert.equal(host.getOperationsRunSourceLabel(), '尚未开始 · 下一次使用 Live 现场');
});

/** 构造独立验证的完整真实记录形状，用于检查闭环。 / Build complete verification record shapes to test actual closure requirements. */
function verificationHostFixture(runtime = 'builtin') {
  const host = competitionHostFixture({}, ['getCompetitionVerificationRequiredTools', 'getCompetitionVerificationConclusion', 'getCompetitionCompletionGates']);
  host.incident.status = 'RESOLVED'; host.incident.scenario = { scenarioType: 'feature-drift' }; host.incident.activeActionId = 'action-a'; host.approval.status = 'APPROVED';
  const scope = { incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a' };
  const actorId = runtime === 'builtin' ? 'builtin:verifier' : 'agentteams:verifier-card';
  const tools = host.getCompetitionVerificationRequiredTools();
  const ids = Array.from(tools, /** 每项必需探针拥有独立证据引用。 / Give each required probe its own evidence identity. */ (_, index) => `verify-evidence-${index}`);
  host.competitionSnapshot.actions = [{ ...scope, actionId: 'action-a', approvalId: 'approval-a', executedBy: 'executor-a', status: 'SUCCEEDED', verificationEvidenceIds: ids }];
  host.competitionSnapshot.teamBindings = [{ ...scope, bindingId: 'binding-a', runtime, status: 'READY', memberSnapshots: [{ teamRole: 'verifier', roleCardId: 'verifier-card' }] }];
  host.competitionSnapshot.evidence = Array.from(tools, /** 保留工具与作用域的原始对应。 / Preserve original tool and scope associations. */ (toolName, index) => ({ ...scope, toolName, evidenceId: ids[index] }));
  host.competitionSnapshot.invocations = host.competitionSnapshot.evidence.map(/** 独立身份调用与证据一一关联。 / Associate independent invocations with each evidence item. */ item => ({ ...item, invocationId: `call-${item.evidenceId}`, actorId, status: 'SUCCEEDED' }));
  host.competitionSnapshot.auditReceipts = [{ ...scope, receiptId: 'receipt-a', toolName: 'openxnet.remediation.verify', approvalId: 'approval-a', actorId, outcome: 'SUCCEEDED', verification: { runtime, actionId: 'action-a', decision: 'CLOSE', evidenceIds: [...ids], errorCode: null } }];
  host.competitionSnapshot.agentDecisions = runtime === 'agentteams' ? [{ ...scope, bindingId: 'binding-a', stage: 'VERIFICATION_CONCLUSION', teamRole: 'verifier', roleCardId: 'verifier-card', decision: 'CLOSE' }] : [];
  host.competitionSnapshot.taskGraphs[0].status = 'SUCCEEDED'; host.competitionSnapshot.taskGraphs[0].nodes = [];
  /** 其余门禁采用明确已通过裁决，隔离验证门禁。 / Supply an explicit eligible plan to isolate the verification gate. */
  host.getCompetitionPrimaryReasoningDecision = () => ({ selectedCandidateId: 'plan-a', candidates: [{ candidateId: 'plan-a', eligible: true, policyDecision: 'APPROVAL_REQUIRED' }] });
  return host;
}

/** Builtin须依赖真实独立复验回执；RESOLVED本身不等于通过。 / Builtin needs actual independent receipts; RESOLVED alone is not proof. */
test('Builtin closure uses complete independent receipts and keeps historical missing receipts pending', () => {
  const host = verificationHostFixture(); const before = JSON.stringify(host.competitionSnapshot); const result = host.getCompetitionVerificationConclusion();
  assert.equal(result.status, 'PASSED'); assert.equal(result.label, '内置独立验证'); assert.equal(result.evidenceCount, 5);
  assert.ok(host.getCompetitionCompletionGates().every(/** 核验门禁满足真实条件。 / Check that actual gate conditions are met. */ item => item.status === 'PASSED'));
  assert.equal(JSON.stringify(host.competitionSnapshot), before);
  host.incident.status = 'VERIFYING'; assert.equal(host.getCompetitionCompletionGates().at(-1).status, 'PENDING');
  host.incident.status = 'RESOLVED'; host.competitionSnapshot.auditReceipts = [];
  assert.equal(host.getCompetitionVerificationConclusion().status, 'PENDING'); assert.equal(host.getCompetitionCompletionGates().at(-1).status, 'PENDING');
});

/** 外部范围、旧动作及自验记录不得被用于关闭事件。 / Foreign scopes, stale actions and self-verification cannot close incidents. */
test('verification rejects foreign scope action approval runtime and executor identities', () => {
  for (const [collection, field, value] of [
    ['auditReceipts', 'workspaceId', 'foreign-workspace'], ['auditReceipts', 'traceId', 'old-trace'], ['auditReceipts', 'incidentId', 'foreign-incident'],
    ['auditReceipts', 'approvalId', 'old-approval'], ['auditReceipts', 'actorId', 'executor-a'], ['auditReceipts', 'actorId', ''],
    ['actions', 'workspaceId', 'foreign-workspace'], ['actions', 'traceId', 'old-trace'], ['actions', 'actionId', 'old-action'], ['actions', 'executedBy', ''],
    ['teamBindings', 'workspaceId', 'foreign-workspace'], ['teamBindings', 'traceId', 'old-trace'], ['teamBindings', 'runtime', 'agentteams'],
  ]) {
    const host = verificationHostFixture(); host.competitionSnapshot[collection][0][field] = value;
    assert.equal(host.getCompetitionVerificationConclusion().status, 'PENDING', `${collection}.${field}=${value}`);
  }
  const host = verificationHostFixture(); host.competitionSnapshot.auditReceipts[0].verification.actionId = 'other-action';
  assert.equal(host.getCompetitionVerificationConclusion().status, 'PENDING');
});

/** 丢失或伪造证据、工具和调用身份均必须阻止验证通过。 / Missing or mismatched evidence, tools and invocation identities must block verification success. */
test('verification requires the exact complete action evidence set and successful independent probes', () => {
  for (const mutation of ['missing-evidence', 'foreign-evidence', 'missing-invocation', 'failed-invocation', 'wrong-actor', 'wrong-tool', 'old-invocation', 'duplicate-receipt-id', 'duplicate-action-id', 'action-set-mismatch', 'required-tool-missing', 'empty-evidence']) {
    const host = verificationHostFixture(); const snapshot = host.competitionSnapshot;
    if (mutation === 'missing-evidence') snapshot.evidence.pop();
    if (mutation === 'foreign-evidence') snapshot.evidence[0].workspaceId = 'foreign';
    if (mutation === 'missing-invocation') snapshot.invocations.pop();
    if (mutation === 'failed-invocation') snapshot.invocations[0].status = 'FAILED';
    if (mutation === 'wrong-actor') snapshot.invocations[0].actorId = 'executor-a';
    if (mutation === 'wrong-tool') snapshot.invocations[0].toolName = 'unrelated.tool';
    if (mutation === 'old-invocation') snapshot.invocations[0].traceId = 'old-trace';
    if (mutation === 'duplicate-receipt-id') snapshot.auditReceipts[0].verification.evidenceIds[0] = snapshot.auditReceipts[0].verification.evidenceIds[1];
    if (mutation === 'duplicate-action-id') snapshot.actions[0].verificationEvidenceIds[0] = snapshot.actions[0].verificationEvidenceIds[1];
    if (mutation === 'action-set-mismatch') snapshot.actions[0].verificationEvidenceIds[0] = 'unrelated-evidence';
    if (mutation === 'required-tool-missing') { snapshot.evidence[0].toolName = 'unrelated.tool'; snapshot.invocations[0].toolName = 'unrelated.tool'; }
    if (mutation === 'empty-evidence') { snapshot.auditReceipts[0].verification.evidenceIds = []; snapshot.actions[0].verificationEvidenceIds = []; }
    assert.equal(host.getCompetitionVerificationConclusion().status, 'PENDING', mutation);
  }
});

/** 已记录失败即明确显示失败，部分探针无证据不能掩盖补偿要求。 / Recorded failures stay explicit; incomplete probe evidence cannot hide compensation requirements. */
test('failed independent receipts remain failed even when verification probes did not complete', () => {
  for (const runtime of ['builtin', 'agentteams']) {
    const host = verificationHostFixture(runtime); const receipt = host.competitionSnapshot.auditReceipts[0];
    receipt.outcome = 'FAILED'; receipt.verification.decision = 'ROLLBACK_REQUIRED'; receipt.verification.errorCode = 'BUSINESS_THRESHOLD_FAILED';
    receipt.verification.evidenceIds = []; host.competitionSnapshot.actions[0].verificationEvidenceIds = [];
    host.competitionSnapshot.agentDecisions = []; host.incident.status = 'FAILED';
    assert.equal(host.getCompetitionVerificationConclusion().status, 'FAILED'); assert.equal(host.getCompetitionVerificationConclusion().errorCode, 'BUSINESS_THRESHOLD_FAILED');
    assert.equal(host.getCompetitionCompletionGates().at(-1).status, 'FAILED');
    receipt.traceId = 'old-trace'; assert.equal(host.getCompetitionVerificationConclusion().status, 'PENDING');
  }
});

/** AgentTeams额外要求冻结团队中Verifier的真实CLOSE。 / AgentTeams additionally needs an actual CLOSE from its frozen verifier. */
test('AgentTeams verification requires the actual bound verifier CLOSE decision', () => {
  const passing = verificationHostFixture('agentteams'); assert.equal(passing.getCompetitionVerificationConclusion().status, 'PASSED'); assert.equal(passing.getCompetitionVerificationConclusion().label, 'AgentTeams Verifier');
  for (const [field, value] of [['workspaceId', 'foreign'], ['traceId', 'old-trace'], ['bindingId', 'foreign-binding'], ['teamRole', 'leader'], ['roleCardId', 'other-verifier'], ['decision', 'ROLLBACK_REQUIRED']]) {
    const host = verificationHostFixture('agentteams'); host.competitionSnapshot.agentDecisions[0][field] = value;
    assert.equal(host.getCompetitionVerificationConclusion().status, 'PENDING', `decision.${field}=${value}`);
  }
  const missing = verificationHostFixture('agentteams'); missing.competitionSnapshot.agentDecisions = []; assert.equal(missing.getCompetitionVerificationConclusion().status, 'PENDING');
  const roleMismatch = verificationHostFixture('agentteams'); roleMismatch.competitionSnapshot.teamBindings[0].memberSnapshots[0].teamRole = 'leader'; assert.equal(roleMismatch.getCompetitionVerificationConclusion().status, 'PENDING');
});

/** 驻场证据计数只取当前范围的唯一上下文引用，不能显示历史取证事件次数。 / Resident evidence counts only unique scoped context references, never historical collection-event counts. */
test('resident evidence count isolates workspace incident trace and platform and deduplicates references', () => {
  const host = competitionHostFixture({}, ['getCompetitionResidentEvidenceCount']); const agent = { agentId: 'resident-a', platform: 'aiops' };
  const context = { workspaceId: 'workspace-a', incidentId: 'incident-a', traceId: 'trace-a', ...agent, evidenceRefs: ['evidence-a', 'evidence-b', '', null] };
  host.competitionSnapshot.residentContexts = [context, { ...context, evidenceRefs: ['evidence-b', 'evidence-c'] },
    { ...context, workspaceId: 'foreign', evidenceRefs: ['foreign'] }, { ...context, incidentId: 'foreign', evidenceRefs: ['foreign'] },
    { ...context, traceId: 'old-trace', evidenceRefs: ['foreign'] }, { ...context, agentId: 'foreign', evidenceRefs: ['foreign'] },
    { ...context, platform: 'mlops', evidenceRefs: ['foreign'] }];
  host.competitionSnapshot.residentEvents = Array.from({ length: 20 }, /** 历史批次不参与上下文证据数。 / Historical batches do not contribute to context evidence counts. */ () => ({ agentId: agent.agentId, eventType: 'EVIDENCE_COLLECTED' }));
  const before = JSON.stringify(host.competitionSnapshot);
  assert.equal(host.getCompetitionResidentEvidenceCount(agent), 3); assert.equal(host.getCompetitionResidentEvidenceCount({ ...agent, agentId: 'unbound' }), 0);
  assert.equal(JSON.stringify(host.competitionSnapshot), before);
  host.incident.activeTraceId = null; assert.equal(host.getCompetitionResidentEvidenceCount(agent), 0);
  assert.match(readProjectFile('static/index.html'), /上下文证据[\s\S]{0,80}getCompetitionResidentEvidenceCount\(agent\)/);
});

/** 模型空证据规划不能把自述完成与健康指标升级为实际观测。 / A model plan without evidence cannot promote claimed completion or health metrics into observations. */
test('investigation plan summaries derive from requested tools while raw claims remain audit-only', () => {
  const host = competitionHostFixture({}, ['getCompetitionAgentDecisionSummary', 'getCompetitionContextTransfers', 'getCompetitionActiveAgentDecisions', 'getCompetitionAgentStageLabel']);
  const decision = { decisionId: 'plan-a', incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a', stage: 'INVESTIGATION_PLAN', agentName: 'Evidence Worker', decision: 'COLLECT', evidenceIds: [], requestedToolNames: ['aiops.service.health', 'dataops.dataset.validation.get', 'aiops.service.health', '', null], summary: '完成9项调用，healthy=false，所有服务不健康', createdAt: '2026-09-16T10:00:00Z' };
  host.competitionSnapshot.agentDecisions = [decision]; const before = JSON.stringify(host.competitionSnapshot);
  assert.equal(host.getCompetitionAgentDecisionSummary(decision), '已选择 2 项只读工具，等待采集证据');
  const transfer = host.getCompetitionContextTransfers()[0];
  assert.equal(transfer.summary, '已选择 2 项只读工具，等待采集证据'); assert.equal(transfer.rawPlanningSummary, decision.summary);
  assert.doesNotMatch(transfer.summary, /healthy|完成9|不健康/); assert.equal(JSON.stringify(host.competitionSnapshot), before);
  decision.requestedToolNames = []; assert.equal(host.getCompetitionAgentDecisionSummary(decision), '已选择 0 项只读工具，等待采集证据');
});

/** 只有本轮被选择工具的实际结束调用能更新采集提示，外范围及排队调用不算已采集。 / Only actual finished selected-tool invocations in this run can advance collection wording, excluding foreign scopes and queued calls. */
test('planning progress uses scoped invocation records rather than model summary or foreign tool results', () => {
  const host = competitionHostFixture({}, ['getCompetitionAgentDecisionSummary']);
  const decision = { incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a', stage: 'INVESTIGATION_PLAN', requestedToolNames: ['aiops.service.health'], summary: '已完成全部取证' };
  const call = { ...decision, invocationId: 'call-a', toolName: 'aiops.service.health', status: 'SUCCEEDED' };
  for (const [field, value] of [['workspaceId', 'foreign'], ['incidentId', 'foreign'], ['traceId', 'old-trace'], ['toolName', 'unrelated.tool'], ['invocationId', ''], ['status', 'PENDING'], ['status', 'RUNNING']]) {
    host.competitionSnapshot.invocations = [{ ...call, [field]: value }];
    assert.equal(host.getCompetitionAgentDecisionSummary(decision), '已选择 1 项只读工具，等待采集证据', `${field}=${value}`);
  }
  host.competitionSnapshot.invocations = [call]; assert.equal(host.getCompetitionAgentDecisionSummary(decision), '已选择 1 项只读工具，实际采集结果见证据');
  call.status = 'FAILED'; assert.equal(host.getCompetitionAgentDecisionSummary(decision), '已选择 1 项只读工具，实际采集结果见证据');
  host.incident.activeTraceId = 'new-trace'; assert.equal(host.getCompetitionAgentDecisionSummary(decision), '已选择 1 项只读工具，等待采集证据');
});

/** 其他阶段保留真实摘要，两个规划审计区默认折叠并明确标注非观测。 / Other stages retain their original summaries; both planning audit disclosures start collapsed and explicitly disclaim observation status. */
test('other decision stages retain summaries and both planning descriptions stay in collapsed audit disclosures', () => {
  const host = competitionHostFixture({}, ['getCompetitionAgentDecisionSummary', 'getCompetitionContextTransfers', 'getCompetitionActiveAgentDecisions', 'getCompetitionAgentStageLabel']);
  const scope = { incidentId: 'incident-a', workspaceId: 'workspace-a', traceId: 'trace-a' };
  host.competitionSnapshot.agentDecisions = [
    { ...scope, decisionId: 'investigation-a', stage: 'INVESTIGATION_CONCLUSION', summary: '真实采集结果：基础设施健康，业务预测退化', createdAt: '2026-09-16T10:00:00Z' },
    { ...scope, decisionId: 'verifier-a', stage: 'VERIFICATION_CONCLUSION', summary: '独立验证仍未达到业务阈值', createdAt: '2026-09-16T10:01:00Z' },
  ];
  const transfers = host.getCompetitionContextTransfers();
  for (const [index, decision] of host.competitionSnapshot.agentDecisions.entries()) {
    assert.equal(host.getCompetitionAgentDecisionSummary(decision), decision.summary); assert.equal(transfers[index].summary, decision.summary); assert.equal(transfers[index].rawPlanningSummary, '');
  }
  const html = readProjectFile('static/index.html');
  const disclosures = [...html.matchAll(/<details\b([^>]*class="competition-planning-audit"[^>]*)>([\s\S]*?)<\/details>/g)];
  assert.equal(disclosures.length, 2);
  for (const disclosure of disclosures) { assert.doesNotMatch(disclosure[1], /(?:^|\s)open(?:\s|=|$)/); assert.match(disclosure[2], /模型原始规划说明（不作为观测证据）/); assert.doesNotMatch(disclosure[2], /v-html/); }
  assert.match(html, /<p>\{\{ getCompetitionAgentDecisionSummary\(item\) \}\}<\/p>/);
});
