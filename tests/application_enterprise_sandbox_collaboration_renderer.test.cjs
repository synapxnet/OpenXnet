const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const THREE = require("../static/libs/three/build/three.cjs");

/** 读取仓库内 UTF-8 文本；输入相对路径，返回完整内容。 */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

function loadSandboxScene(globals = {}) {
  const context = { window: {}, ...globals };
  vm.runInNewContext(readProjectFile("static/js/enterprise3d.js"), context);
  return Object.assign(Object.create(context.window.Enterprise3DScene.prototype), { THREE });
}

function loadSandboxMethod(name, nextName, globals = {}) {
  const source = readProjectFile("static/js/vue_methods.js");
  const start = source.indexOf(`  ${name}(`);
  const end = source.indexOf(`  ${nextName}(`, start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(`({${source.slice(start, end)}})`, globals)[name.replace(/^async /, "")];
}

test("opening a project form from the compact directory reveals its stage and preserves workspace scope", () => {
  const open = loadSandboxMethod("openProjectForm", "getEnterpriseWorkspaceTypeLabel");
  const app = {
    sandboxNavigatorOpen: true,
    sandboxDetailsOpen: true,
    sandboxCurrentWs: "workspace-current",
    createEmptyProjectDraft: overrides => ({ name: "", ...overrides }),
  };
  open.call(app, null, "workspace-selected");
  assert.equal(app.sandboxNavigatorOpen, false);
  assert.equal(app.sandboxDetailsOpen, false);
  assert.equal(app.showProjectFloatPanel, true);
  assert.equal(app.newProject.workspaceId, "workspace-selected");
});

test("opening staff creation from fullscreen members reveals the form instead of the member view", () => {
  const open = loadSandboxMethod("openSandboxStaffForm", "zoomEnterpriseSandbox");
  for (const fullscreen of [true, false]) {
    const app = {
      sandboxNavigatorOpen: true,
      sandboxDetailsOpen: true,
      sandboxCurrentWs: "workspace-current",
      sandboxCurrentProject: "floor-current",
      enterprise3DScene: { _isFullscreen: fullscreen },
      createEmptyStaffRoleDraft: overrides => ({ ...overrides }),
    };
    open.call(app);
    assert.equal(app.sandboxNavigatorOpen, false);
    assert.equal(app.sandboxDetailsOpen, false);
    assert.equal(fullscreen ? app.showSandboxFloatPanel : app.showStaffRoleForm, true);
    assert.equal(app.newStaffRole.assignedWorkspace, "workspace-current");
    assert.equal(app.newStaffRole.projectId, "floor-current");
  }
});

test("opening enterprise chat from compact navigation reveals it before messages load", async () => {
  const open = loadSandboxMethod("async openEnterpriseChat", "closeEnterpriseChat", {
    document: { querySelector: () => null },
  });
  const app = {
    sandboxNavigatorOpen: true,
    sandboxDetailsOpen: true,
    enterpriseChatRecipientIds: [],
    enterpriseChatInput: "draft",
    getEnterpriseChatWorkspaceId: () => "workspace-current",
    getEnterpriseChatAvailableStaff: () => [{ id: "staff-one", name: "Alex" }],
    async loadEnterpriseMessages() {
      assert.equal(this.sandboxNavigatorOpen, false);
      assert.equal(this.sandboxDetailsOpen, false);
      assert.equal(this.showSandboxChatPanel, true);
    },
    startEnterpriseChatRefresh() {},
    $nextTick: callback => callback(),
  };
  await open.call(app, { id: "staff-one", name: "Alex" });
  assert.equal(app.selected3DAgent.id, "staff-one");
  assert.deepEqual(Array.from(app.enterpriseChatRecipientIds), ["staff-one"]);
  assert.equal(app.enterpriseChatInput, "@Alex draft");
});

test("leaving the sandbox releases its scene before switching enterprise modules", async () => {
  const panel = { scrollTop: 420 };
  const open = loadSandboxMethod("async openEnterpriseTab", "formatNumber", {
    document: {
      /** 定位内容面板，不允许定位或滚动整个外壳。 / Locate only the content panel, never the surrounding shell. */
      querySelector(selector) { assert.equal(selector, '.ox-enterprise-detail-content'); return panel; },
    },
  });
  const events = [];
  const app = {
    enterpriseTab: "enterprise-sandbox",
    canUseEnterprise: true,
    /** 模拟 Vue 渲染完成回调。 / Simulate Vue's render completion callback. */
    $nextTick(callback) { callback(); },
    dispose3DView() { events.push(`dispose:${this.enterpriseTab}`); },
    async loadWorkspaceEnvs() { events.push(`load:${this.enterpriseTab}`); },
  };
  await open.call(app, "enterprise-workspaces");
  assert.equal(panel.scrollTop, 0);
  assert.deepEqual(events, ["dispose:enterprise-sandbox", "load:enterprise-workspaces"]);
  await open.call(app, "enterprise-workspaces");
  assert.equal(events.filter(event => event.startsWith("dispose:")).length, 1);
});

test("sandbox initialization replaces a detached scene when its container is remounted", async () => {
  const container = { isConnected: true };
  let disposed = 0;
  const persisted = [];
  class Scene {
    constructor(target) { this.container = target; }
    onBuildingClick() {}
    onFloorClick() {}
    onAgentClick() {}
    onAgentDblClick() {}
    onAgentMove(callback) { this.moveAgent = callback; }
    onSelectedAgentPositionUpdate() {}
    onGhostClick() {}
    resize() {}
  }
  const init = loadSandboxMethod("async init3DView", "dispose3DView", {
    Enterprise3DScene: Scene,
    window: { Vue: { markRaw: value => value } },
    document: { getElementById: () => container },
    setTimeout() {},
    console,
  });
  const app = {
    enterprise3DScene: { container: {}, dispose() { disposed++; } },
    async ensureEnterprise3DDependencies() {},
    async waitForEnterprise3DContainer() {},
    isCurrentLanguageZh: () => true,
    syncEnterprise3DLevel() {},
    staffRoles: [{ id: "staff-robot", bodyType: "robot" }],
    async persistStaffRoleToEnterprise(role, options) {
      persisted.push(JSON.parse(JSON.stringify({ role, options })));
    },
  };
  await init.call(app);
  assert.equal(disposed, 1);
  assert.ok(app.enterprise3DScene instanceof Scene);
  assert.equal(app.enterprise3DScene.container, container);
  await app.enterprise3DScene.moveAgent({ id: "staff-robot" }, { x: 2.12345, z: -4.56789 });
  assert.deepEqual(persisted, [{
    role: { id: "staff-robot", bodyType: "robot", position3D: { x: 2.123, z: -4.568 } },
    options: { createAgent: false },
  }]);
});

test("staff appearance and finite coordinates survive repeated role-card normalization", () => {
  const normalize = loadSandboxMethod("normalizeStaffRoleRecord", "resolveStaffRoleSkillIds");
  const create = loadSandboxMethod("createEmptyStaffRoleDraft", "setStaffRoleIcon");
  const app = { createEmptyStaffRoleDraft: create };
  for (const bodyType of ["default", "engineer", "scholar", "captain", "ninja", "robot", "streamer", "geek"]) {
    const raw = { id: bodyType, name: bodyType, bodyType, position3D: { x: 0, z: -4.125 } };
    const once = normalize.call(app, raw);
    const twice = normalize.call(app, once);
    assert.equal(twice.bodyType, bodyType);
    assert.equal(twice.position3D.x, 0);
    assert.equal(twice.position3D.z, -4.125);
    assert.notEqual(once.position3D, raw.position3D);
    assert.notEqual(twice.position3D, once.position3D);
  }
  for (const position3D of [null, {}, [], { x: "0", z: 2 }, { x: NaN, z: 1 }, { x: 0, z: Infinity }]) {
    assert.equal(normalize.call(app, { bodyType: "unsupported", position3D }).position3D, null);
  }
  assert.equal(normalize.call(app, { bodyType: "unsupported" }).bodyType, "default");
});

test("saving and reloading a staff draft preserves its selected avatar and location", async () => {
  let stored = null;
  const runtime = {
    async saveApplicationEnterpriseRoleCard({ roleCard }) {
      stored = JSON.parse(JSON.stringify(roleCard));
      return { card: stored };
    },
    async listApplicationEnterpriseRoleCards() { return { cards: [stored] }; },
  };
  const app = {
    createEmptyStaffRoleDraft: loadSandboxMethod("createEmptyStaffRoleDraft", "setStaffRoleIcon"),
    normalizeStaffRoleRecord: loadSandboxMethod("normalizeStaffRoleRecord", "resolveStaffRoleSkillIds"),
    persistStaffRoleToEnterprise: loadSandboxMethod("async persistStaffRoleToEnterprise", "async loadEnterpriseRoleCards"),
    loadEnterpriseRoleCards: loadSandboxMethod("async loadEnterpriseRoleCards", "createEmptyEnterpriseTeamTemplateDraft", { console }),
    enterpriseRoleCards: [],
    staffRoles: [],
    resolveStaffRoleSkillIds: () => [],
    buildStaffRoleRuntimeSystemPrompt: () => "Design products.",
    getApplicationEnterpriseRuntime: () => runtime,
    async autoSaveSettings() {},
    _refreshSandbox() {},
    isCurrentLanguageZh: () => false,
  };
  app.newStaffRole = app.createEmptyStaffRoleDraft({ id: "designer", name: "Designer", bodyType: "robot", position3D: { x: 2.75, z: -1.5 } });
  const save = loadSandboxMethod("async saveStaffRole", "async saveWorkspace", { console, setTimeout() {}, showNotification() {} });
  await save.call(app);
  assert.equal(stored.bodyType, "robot");
  assert.deepEqual(stored.position3D, { x: 2.75, z: -1.5 });
  assert.equal(app.staffRoles[0].bodyType, "robot");
  assert.equal(app.staffRoles[0].position3D.x, 2.75);
  assert.equal(app.staffRoles[0].position3D.z, -1.5);
});

test("sandbox camera fits tall buildings in both landscape and portrait viewports", () => {
  const scene = loadSandboxScene();
  scene._viewBounds = new THREE.Box3(new THREE.Vector3(-6, 0, -5), new THREE.Vector3(6, 64, 5));
  for (const [width, height] of [[1200, 700], [390, 844]]) {
    scene._getContainerSize = () => ({ width, height });
    const view = scene._getDefaultCameraView();
    const target = new THREE.Vector3(view.target.x, view.target.y, view.target.z);
    scene.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    scene._applyCameraFrustum(view.distance, width, height);
    scene.camera.position.copy(target).add(new THREE.Vector3(1.25, 1.35, 1.65).normalize().multiplyScalar(view.distance * 3));
    scene.camera.lookAt(target);
    scene.camera.updateMatrixWorld();
    for (const x of [-6, 6]) {
      for (const y of [0, 64]) {
        for (const z of [-5, 5]) {
          const projected = new THREE.Vector3(x, y, z).project(scene.camera);
          assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, "scene corner was cropped");
        }
      }
    }
  }
});

test("sandbox resize retargets an in-flight camera transition", () => {
  let now = 0;
  let nextId = 1;
  const frames = new Map();
  const scene = loadSandboxScene({
    performance: { now: () => now },
    requestAnimationFrame: callback => { const id = nextId++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  let size = { width: 1200, height: 700 };
  scene._getContainerSize = () => size;
  scene._viewBounds = new THREE.Box3(new THREE.Vector3(-9, 0, -8), new THREE.Vector3(9, 4, 8));
  scene.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
  scene.camera.position.set(14, 16, 14);
  scene.renderer = { setSize() {} };
  const initialView = scene._getDefaultCameraView();
  scene._zoomCamera(initialView.distance, initialView.target);
  now = 100;
  size = { width: 390, height: 844 };
  scene.resize();
  assert.equal(frames.size, 1, "previous transition must be cancelled");
  now = 1000;
  for (const callback of [...frames.values()]) callback();
  assert.ok(Math.abs(scene.camera.top - scene._getDefaultCameraView().distance) < 0.001);
  assert.equal(scene._zoomFrame, null);
});

test("sandbox releases nested shared geometry, materials and textures exactly once", () => {
  const scene = loadSandboxScene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const group = new THREE.Group();
  const nested = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material), nested);
  nested.add(new THREE.Mesh(geometry, material));
  const disposed = { geometry: 0, texture: 0, material: 0 };
  geometry.addEventListener("dispose", () => disposed.geometry++);
  texture.addEventListener("dispose", () => disposed.texture++);
  material.addEventListener("dispose", () => disposed.material++);
  scene._disposeObjects([group]);
  assert.deepEqual(disposed, { geometry: 1, texture: 1, material: 1 });
});

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
  assert.match(chatBlock, /v-for="message in getEnterpriseVisibleMessages\(\)"/u);
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
  assert.match(chatBlock, /@keydown\.enter\.exact="handleEnterpriseComposerEnter"/u);
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
