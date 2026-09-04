const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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
  assert.match(html, /getCompetitionActiveIncident\(\)\.status === 'RESOLVED'[\s\S]*?@click="createCompetitionDemoIncident"/u);
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
