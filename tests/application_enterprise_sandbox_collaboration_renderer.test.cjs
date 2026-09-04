const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 读取仓库内 UTF-8 文本；输入相对路径，返回完整内容。 */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

/** 验证项目楼层和企业群聊只通过 Main-owned 契约工作，且不复用普通聊天状态。 */
test("enterprise sandbox persists project floors and isolates auditable group chat", () => {
  const html = readProjectFile("static/index.html");
  const data = readProjectFile("static/js/vue_data.js");
  const methods = readProjectFile("static/js/vue_methods.js");
  const scene = readProjectFile("static/js/enterprise3d.js");
  const preload = readProjectFile("static/js/preload.js");
  const renderer = readProjectFile("static/js/renderer.js");
  const main = readProjectFile("main.js");
  const styles = readProjectFile("static/css/openxnet-ui-redesign.css");
  const initializer = readProjectFile("scripts/initialize_goai_enterprise_workspace.cjs");
  const chatBlock = html.slice(
    html.indexOf("<!-- ===== 浮窗：沙盘对话 ===== -->"),
    html.indexOf("<!-- ═══════ 悬浮在员工头顶的对话界面 ═══════ -->"),
  );
  const emptyProjectBlock = html.slice(
    html.indexOf("<!-- ===== Level 1 空状态：工作空间内无项目楼层 ===== -->"),
    html.indexOf("<!-- ===== Level 2 空状态：楼层内无员工 ===== -->"),
  );
  const sandboxBlock = html.slice(
    html.indexOf("<!-- ========== 企业沙盘 (3D Sandbox) ========== -->"),
    html.indexOf("<!-- ========== 知识库上传对话框 ========== -->"),
  );

  assert.match(methods, /async loadEnterpriseProjects\(\)/u);
  assert.match(methods, /打开项目楼层表单/u);
  assert.match(methods, /saveApplicationEnterpriseProject/u);
  assert.match(methods, /removeApplicationEnterpriseProject/u);
  assert.match(methods, /listApplicationEnterpriseMessages/u);
  assert.match(methods, /postApplicationEnterpriseMessage/u);
  assert.match(methods, /async startEnterpriseCompetitionTask\(\)/u);
  assert.match(methods, /startApplicationCompetitionEnterpriseTask/u);
  assert.match(methods, /scenarioType: this\.enterpriseCompetitionScenarioType/u);
  assert.match(methods, /teamTemplateId: this\.competitionTeamRuntime === 'agentteams'/u);
  assert.match(methods, /recipientIds: \[\.\.\.this\.enterpriseChatRecipientIds\]/u);
  assert.match(data, /enterpriseMessages: \[\]/u);
  assert.match(data, /enterpriseChatInput: ''/u);
  assert.match(data, /enterpriseChatTaskStarting: false/u);
  assert.match(html, /class="enterprise-sandbox-chat-launcher"/u);
  assert.match(emptyProjectBlock, /enterprise-sandbox-empty__card--action/u);
  assert.match(emptyProjectBlock, /@click\.stop="openProjectForm\(null, sandboxCurrentWs\)"/u);
  assert.doesNotMatch(emptyProjectBlock, /newProject\.workspaceId\s*=/u);
  assert.match(styles, /enterprise-sandbox-empty__card--action/u);
  assert.match(initializer, /const PROJECT_ID = "project_goai_enterprise_ai_governance"/u);
  assert.match(initializer, /async function ensureProject\(runtime\)/u);
  assert.match(initializer, /projectId: PROJECT_ID/u);
  assert.match(initializer, /offlineServices/u);
  assert.doesNotMatch(initializer, /Object\.values\(services\)\.every/u);
  assert.match(chatBlock, /v-for="role in getEnterpriseChatAvailableStaff\(\)"/u);
  assert.match(chatBlock, /@click="toggleEnterpriseChatRecipient\(role\)"/u);
  assert.match(chatBlock, /v-for="message in enterpriseMessages"/u);
  assert.match(chatBlock, /message\.taskId/u);
  assert.match(chatBlock, /message\.traceId/u);
  assert.match(chatBlock, /v-if="!message\.operation"/u);
  assert.match(chatBlock, /class="enterprise-sandbox-operation"/u);
  assert.match(chatBlock, /message\.operation\.authorityLevel/u);
  assert.match(chatBlock, /message\.operation\.riskClass/u);
  assert.match(chatBlock, /message\.operation\.evidenceGrade/u);
  assert.match(chatBlock, /getEnterpriseOperationDecisionLabel\(message\.operation\.decision\)/u);
  assert.match(chatBlock, /message\.operation\.toolNames/u);
  assert.match(chatBlock, /message\.operation\.evidenceIds/u);
  assert.match(chatBlock, /@keydown\.enter\.exact\.prevent="sendEnterpriseMessage\(\)"/u);
  assert.match(chatBlock, /@click="startEnterpriseCompetitionTask\(\)"/u);
  assert.doesNotMatch(chatBlock, /v-for="\(message, index\) in messages"/u);
  assert.doesNotMatch(chatBlock, /v-model="userInput"/u);
  assert.doesNotMatch(chatBlock, /@click="sendMessage"/u);
  assert.match(preload, /openxnet:application-enterprise:list-projects/u);
  assert.match(preload, /openxnet:application-enterprise:post-message/u);
  assert.match(renderer, /beforeUnmount\(\)[\s\S]*?this\.closeEnterpriseChat\?\.\(\)/u);
  assert.match(methods, /getEnterpriseOperationRiskClass\(operation\)/u);
  assert.match(methods, /getEnterpriseOperationPhaseLabel\(phase\)/u);
  assert.match(methods, /getEnterpriseOperationPhaseIcon\(phase\)/u);
  assert.match(methods, /getEnterpriseOperationDecisionLabel\(decision\)/u);
  assert.match(methods, /syncEnterpriseAuditIncidentSelection\(\)/u);
  assert.match(methods, /setEnterpriseSandboxWorkView\(view\)/u);
  assert.match(methods, /selectEnterpriseAuditIncident\(incidentId\)/u);
  assert.match(methods, /getEnterpriseSandboxIncidents\(\)/u);
  assert.match(methods, /getEnterpriseAuditTaskGraphLanes\(\)/u);
  assert.match(methods, /getEnterpriseAuditEvidence\(\)/u);
  assert.match(methods, /getEnterpriseAuditInvocations\(\)/u);
  assert.match(methods, /getEnterpriseAuditApprovals\(\)/u);
  assert.match(methods, /getEnterpriseAuditReceipts\(\)/u);
  assert.match(methods, /getEnterpriseAuditTransportEvents\(\)/u);
  assert.match(methods, /getEnterpriseMessageInvocations\(message\)/u);
  assert.match(methods, /getEnterpriseInvocationEvidence\(invocation\)/u);
  assert.match(methods, /getEnterpriseInvocationReceipt\(invocation\)/u);
  assert.match(methods, /getSandboxWorkspaceProjects\(workspaceId = ''\)/u);
  assert.match(methods, /getSandboxVisibleStaff\(\)/u);
  assert.match(methods, /async reconcileEnterpriseTeamScopes\(\)/u);
  assert.match(methods, /storedWorkspaceId === 'ws_goai_demo'/u);
  assert.match(methods, /assignedWorkspace: shouldAssign \? workspaceId : ''/u);
  assert.match(methods, /projectId: proj\.id/u);
  assert.match(methods, /openSandboxProjectFloor\(projectId\)/u);
  assert.match(methods, /zoomEnterpriseSandbox\(direction\)/u);
  assert.match(methods, /resetEnterpriseSandboxCamera\(\)/u);
  assert.match(sandboxBlock, /class="enterprise-sandbox-workbench"/u);
  assert.match(sandboxBlock, /class="enterprise-sandbox-navigator"/u);
  assert.match(sandboxBlock, /class="enterprise-sandbox-inspector"/u);
  assert.match(sandboxBlock, /class="enterprise-sandbox-view-tools"/u);
  assert.match(sandboxBlock, /@click="openSandboxProjectFloor\(project\.id\)"/u);
  assert.match(sandboxBlock, /@click="openEnterpriseChat\(role\)"/u);
  assert.match(html, /v-for="workspace in enterpriseWorkspaces"/u);
  assert.doesNotMatch(html, /v-model\.trim="newEnterpriseTeamTemplate\.workspaceId" type="text"/u);
  assert.doesNotMatch(sandboxBlock, /enterprise-sandbox-footer/u);
  assert.match(scene, /zoomIn\(\)/u);
  assert.match(scene, /zoomOut\(\)/u);
  assert.match(scene, /resetView\(\)/u);
  assert.match(scene, /_getDefaultCameraView\(\)/u);
  assert.match(scene, /enterprise-3d-label__title/u);
  assert.doesNotMatch(scene, /ghostLabel\.innerHTML = '<i class="fa-solid fa-plus"><\/i> 添加项目楼层'/u);
  assert.match(main, /evaluateApplicationNeuroSymbolicPolicy/u);
  assert.match(main, /recordOperationConversation: \(event\)/u);
  assert.match(main, /const displayPolicy = rejected[\s\S]*?decision: 'DENY'[\s\S]*?ruleCodes: \[\], ruleReasons: \[\]/u);
  assert.match(styles, /\.enterprise-sandbox-panel--chat[\s\S]*?overflow: hidden/u);
  assert.match(styles, /\.enterprise-sandbox-chat-messages[\s\S]*?overflow-y: auto/u);
  assert.match(styles, /\.enterprise-sandbox-operation\.is-rk-0[\s\S]*?var\(--ox-success\)/u);
  assert.match(styles, /\.enterprise-sandbox-operation\.is-rk-2[\s\S]*?var\(--ox-amber\)/u);
  assert.match(styles, /\.enterprise-sandbox-operation\.is-rk-3[\s\S]*?var\(--ox-danger\)/u);
  assert.match(styles, /\.enterprise-sandbox-workbench[\s\S]*?grid-template-columns: 208px minmax\(440px, 1fr\) 260px/u);
  assert.match(styles, /\.enterprise-sandbox-workbench\.is-chat-mode[\s\S]*?\.enterprise-3d-label-overlay[\s\S]*?calc\(100% - min\(460px, 55%\)\)/u);
  assert.match(styles, /\.enterprise-sandbox-staff-row/u);
  assert.match(styles, /\.enterprise-3d-label/u);
});
