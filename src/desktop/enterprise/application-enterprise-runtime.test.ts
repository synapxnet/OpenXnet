import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ApplicationEnterpriseRuntimeService } from "./application-enterprise-runtime";
import { evaluateApplicationNeuroSymbolicPolicy } from "../governance/application-neuro-symbolic-governance";
import type { ApplicationNeuroSymbolicPolicyInput } from "../contracts/application-neuro-symbolic-governance";

/** 返回完整测试工作区配置；无输入，生成四类兼容字段，无副作用。 */
function createWorkspaceConfig(): Record<string, unknown> {
  return {
    local: { path: "E:\\workspace", permission_mode: "default" },
    docker: { image: "ubuntu:22.04", daemon_url: "", container_id: "" },
    cloud: { host: "", port: 22, user: "root", key_path: "" },
    sandbox: { image: "openxnet/sandbox:latest", ttl_hours: 24 },
  };
}

test("Neuro-symbolic policy assigns six authority levels without allowing model-side privilege escalation", () => {
  const base: ApplicationNeuroSymbolicPolicyInput = {
    operationKind: "observe",
    environment: "production",
    riskClass: "RK-0",
    evidenceGrade: "EV-0",
    permissionGranted: true,
    reversible: true,
    hasRollbackPoint: true,
    hasResourceVersion: true,
    hasIdempotencyKey: true,
    certifiedSkill: false,
    delegatedAuthority: false,
    approvalGranted: false,
  };
  assert.equal(evaluateApplicationNeuroSymbolicPolicy(base).authorityLevel, "NSX-0");
  assert.equal(evaluateApplicationNeuroSymbolicPolicy({ ...base, operationKind: "advise" }).authorityLevel, "NSX-1");
  assert.equal(evaluateApplicationNeuroSymbolicPolicy({
    ...base,
    operationKind: "rehearse",
    environment: "sandbox",
    riskClass: "RK-1",
    evidenceGrade: "EV-1",
  }).authorityLevel, "NSX-2");
  assert.equal(evaluateApplicationNeuroSymbolicPolicy({
    ...base,
    operationKind: "execute",
    environment: "staging",
    riskClass: "RK-1",
    evidenceGrade: "EV-1",
  }).authorityLevel, "NSX-3");
  const governed = evaluateApplicationNeuroSymbolicPolicy({
    ...base,
    operationKind: "execute",
    riskClass: "RK-2",
    evidenceGrade: "EV-2",
  });
  assert.equal(governed.authorityLevel, "NSX-4");
  assert.equal(governed.decision, "APPROVAL_REQUIRED");
  const delegated = evaluateApplicationNeuroSymbolicPolicy({
    ...base,
    operationKind: "execute",
    riskClass: "RK-2",
    evidenceGrade: "EV-2",
    certifiedSkill: true,
    delegatedAuthority: true,
  });
  assert.equal(delegated.authorityLevel, "NSX-5");
  assert.equal(delegated.decision, "ALLOW");
  assert.equal(evaluateApplicationNeuroSymbolicPolicy({ ...base, permissionGranted: false }).decision, "DENY");
  assert.equal(evaluateApplicationNeuroSymbolicPolicy({
    ...base,
    operationKind: "execute",
    riskClass: "RK-3",
    evidenceGrade: "EV-3",
    approvalGranted: true,
  }).decision, "DENY");
});

test("Enterprise Runtime manages compatible local records and sandbox projection without Python", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-runtime-"));
  writeFileSync(path.join(root, "enterprise_role_cards.json"), JSON.stringify([{
    id: "legacy-role",
    name: "Legacy Role",
    description: "Imported",
    enabled: true,
    unknown_legacy_field: "ignored",
  }]), "utf8");
  const ids = ["role-created", "kb-created", "workspace-created"];
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: root,
    createId: () => ids.shift() ?? "generated-id",
    now: () => new Date("2026-07-29T12:00:00.000Z"),
  });
  try {
    const initialRoles = await runtime.listRoleCards();
    assert.equal(initialRoles.cards[0]?.id, "legacy-role");
    const role = await runtime.saveRoleCard({
      mode: "create",
      roleCard: {
        name: "研发负责人",
        department: "R&D",
        system_prompt: "负责技术路线。",
        skills: ["architecture", "architecture"],
        position3D: { x: 4, z: 8 },
      },
    });
    assert.equal(role.card.id, "role-created");
    assert.deepEqual(role.card.skills, ["architecture"]);
    const sandbox = await runtime.getSandboxState();
    const projected = sandbox.agents.find((agent) => agent.id === "role-created");
    assert.deepEqual(projected?.position, { x: 4, y: 0, z: 8 });

    const knowledgeBase = await runtime.saveKnowledgeBase({
      knowledgeBase: { name: "企业规范", description: "研发规范", category: "engineering" },
    });
    assert.equal(knowledgeBase.knowledgeBase.id, "kb-created");
    const versionRoot = path.join(root, "enterprise_kb_versions", "kb-created");
    mkdirSync(versionRoot, { recursive: true });
    writeFileSync(path.join(versionRoot, "v1.json"), JSON.stringify({
      version: 1,
      kb_name: "企业规范",
      doc_count: 3,
      created_at: "2026-07-29 12:00:00",
      snapshot_data: "must-not-return",
    }), "utf8");
    const versions = await runtime.listKnowledgeBaseVersions({ knowledgeBaseId: "kb-created" });
    assert.equal(versions.versions.length, 1);
    assert.equal(Object.hasOwn(versions.versions[0] ?? {}, "snapshot_data"), false);

    const workspace = await runtime.saveWorkspace({
      workspace: { name: "Local", type: "local", config: createWorkspaceConfig() },
    });
    assert.equal(workspace.workspace.id, "workspace-created");
    assert.equal((await runtime.listWorkspaces()).workspaces[0]?.config.local.path, "E:\\workspace");
    const binding = await runtime.setSkillBinding({
      workspaceId: "workspace-created",
      skillId: "synapxnet-feature-drift-recovery",
      enabled: true,
      sourceIncidentId: "inc-demo",
    });
    assert.equal(binding.binding.enabled, true);
    assert.equal((await runtime.listSkillBindings()).bindings[0]?.sourceIncidentId, "inc-demo");
    await runtime.removeWorkspace({ workspaceId: "workspace-created" });
    assert.equal((await runtime.listSkillBindings()).bindings.length, 0);
    await runtime.removeKnowledgeBase({ knowledgeBaseId: "kb-created" });
    await runtime.removeRoleCard({ roleCardId: "role-created" });
    assert.equal((await runtime.listRoleCards()).cards.some((item) => item.id === "role-created"), false);
    assert.equal(readFileSync(path.join(root, "enterprise_role_cards.json"), "utf8").includes("\r\n"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Enterprise Runtime bounds Xnet health checks and rejects request drift", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-xnet-"));
  const requests: Array<{ readonly url: string; readonly redirect: string; readonly method: string }> = [];
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: root,
    now: () => new Date("2026-07-29T12:00:00.000Z"),
    fetch: async (url, options) => {
      requests.push({ url, redirect: options.redirect, method: options.method });
      return { status: 204 };
    },
  });
  try {
    assert.throws(
      () => runtime.saveXnetService({ serviceKey: "dataops", url: "http://10.0.0.2:8080", autoConnect: true }),
      /not allowed/i,
    );
    const saved = await runtime.saveXnetService({
      serviceKey: "dataops",
      url: "https://dataops.example.test/health",
      autoConnect: true,
    });
    assert.equal(saved.service.status, "offline");
    assert.equal(requests.length, 0);
    const checked = await runtime.checkXnetService({ serviceKey: "dataops" });
    assert.equal(checked.service.status, "online");
    assert.deepEqual(requests, [{
      url: "https://dataops.example.test/health",
      redirect: "manual",
      method: "GET",
    }]);
    await runtime.checkAllXnetServices({ autoOnly: true });
    assert.equal(requests.length, 2);
    await assert.rejects(
      runtime.saveRoleCard({ mode: "create", roleCard: { name: "Role", command: "calc.exe" } }),
      /fields are invalid/i,
    );
    assert.throws(
      () => runtime.checkXnetService({ serviceKey: "unknown" }),
      /key is invalid/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Enterprise Runtime treats sandbox projection as rebuildable derived state", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-derived-sandbox-"));
  const warnings: string[] = [];
  mkdirSync(path.join(root, "sandbox_state.json"));
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: root,
    createId: () => "role-with-unavailable-sandbox",
    logger: {
      /** 记录派生沙盘写入诊断；输入消息和可选错误，无返回，不改变 Runtime 文件。 */
      warn(message) {
        warnings.push(message);
      },
    },
  });
  try {
    const saved = await runtime.saveRoleCard({
      mode: "create",
      roleCard: { name: "可恢复角色" },
    });
    assert.equal(saved.card.id, "role-with-unavailable-sandbox");
    assert.equal((await runtime.listRoleCards()).cards[0]?.name, "可恢复角色");
    assert.match(readFileSync(path.join(root, "enterprise_role_cards.json"), "utf8"), /可恢复角色/);
    assert.equal(warnings.some((message) => message.includes("will be rebuilt later")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Enterprise Runtime validates, versions and protects reusable team templates", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-teams-"));
  const identifiers = ["role-leader", "role-worker", "role-verifier", "role-disabled", "team-goai"];
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: root,
    createId: () => identifiers.shift() ?? "generated-id",
    now: () => new Date("2026-08-03T05:00:00.000Z"),
  });
  try {
    assert.deepEqual((await runtime.listTeamTemplates()).teamTemplates, []);
    const leader = (await runtime.saveRoleCard({
      mode: "create",
      roleCard: { name: "事件负责人", department: "SRE", system_prompt: "统一决策。", permissions: ["read"], skills: ["orchestrate"] },
    })).card;
    const worker = (await runtime.saveRoleCard({
      mode: "create",
      roleCard: { name: "取证工程师", department: "Data", system_prompt: "收集证据。", tools: ["dataops.quality.report.get"] },
    })).card;
    const verifier = (await runtime.saveRoleCard({
      mode: "create",
      roleCard: { name: "独立验证员", department: "QA", runtime_system_prompt: "独立验证结果。", skills: ["verify"] },
    })).card;
    const disabled = (await runtime.saveRoleCard({
      mode: "create",
      roleCard: { name: "停用成员", enabled: false },
    })).card;

    await assert.rejects(runtime.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "成员不足",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "worker" },
        ],
      },
    }), /between 3 and 20 members/i);
    await assert.rejects(runtime.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "重复成员",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "worker" },
          { roleCardId: worker.id, teamRole: "verifier" },
        ],
      },
    }), /unique/i);
    await assert.rejects(runtime.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "多个负责人",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "leader" },
          { roleCardId: verifier.id, teamRole: "verifier" },
        ],
      },
    }), /exactly one leader/i);
    await assert.rejects(runtime.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "停用成员",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "worker" },
          { roleCardId: disabled.id, teamRole: "verifier" },
        ],
      },
    }), /disabled/i);
    await assert.rejects(runtime.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "成员不存在",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "worker" },
          { roleCardId: "role-missing", teamRole: "verifier" },
        ],
      },
    }), /was not found/i);

    const created = await runtime.saveTeamTemplate({
      mode: "create",
      teamTemplate: {
        name: "GOAI 事件协作组",
        description: "跨域取证与独立验证。",
        workspaceId: "ws_goai_demo",
        members: [
          { roleCardId: leader.id, teamRole: "leader" },
          { roleCardId: worker.id, teamRole: "worker" },
          { roleCardId: verifier.id, teamRole: "verifier" },
        ],
      },
    });
    assert.equal(created.teamTemplate.id, "team-goai");
    assert.equal(created.teamTemplate.schemaVersion, 1);
    assert.equal(created.teamTemplate.version, 1);
    const updated = await runtime.saveTeamTemplate({
      mode: "update",
      teamTemplate: { ...created.teamTemplate, description: "更新后的团队说明。" },
    });
    assert.equal(updated.teamTemplate.version, 2);
    const resolved = await runtime.resolveTeamTemplate(created.teamTemplate.id);
    assert.deepEqual(resolved.roleCards.map((card) => card.id), [leader.id, worker.id, verifier.id]);
    await assert.rejects(runtime.removeRoleCard({ roleCardId: worker.id }), /referenced by a team template/i);
    await assert.rejects(runtime.saveRoleCard({
      mode: "update",
      roleCard: { ...worker, enabled: false },
    }), /referenced by a team template/i);
    await runtime.removeTeamTemplate({ teamTemplateId: created.teamTemplate.id });
    await runtime.removeRoleCard({ roleCardId: worker.id });
    assert.equal(readFileSync(path.join(root, "enterprise_team_templates.json"), "utf8").includes("\r\n"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Enterprise Runtime persists project floors and keeps enterprise chat identity auditable", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-collaboration-"));
  const identifiers = [
    "workspace-alpha", "project-alpha", "role-alpha", "message-leader", "message-agent",
    "message-regular", "workspace-beta", "role-beta",
  ];
  const runtime = new ApplicationEnterpriseRuntimeService({
    userDataDirectory: root,
    createId: () => identifiers.shift() ?? "generated-id",
    now: () => new Date("2026-08-10T08:30:00.000Z"),
    resolveLeaderIdentity: () => ({ id: "leader-account", name: "企业负责人" }),
  });
  try {
    const workspace = (await runtime.saveWorkspace({
      workspace: { name: "推荐平台", type: "local", config: createWorkspaceConfig() },
    })).workspace;
    const project = (await runtime.saveProject({
      project: {
        workspaceId: workspace.id,
        name: "在线推理",
        description: "GPU 推荐服务",
        color: "#4ecdc4",
        icon: "fa-solid fa-layer-group",
      },
    })).project;
    assert.equal(project.id, "project-alpha");
    assert.equal(project.floor, 1);

    const reloaded = new ApplicationEnterpriseRuntimeService({ userDataDirectory: root });
    assert.equal((await reloaded.listProjects()).projects[0]?.name, "在线推理");

    const role = (await runtime.saveRoleCard({
      mode: "create",
      roleCard: {
        name: "推理平台工程师",
        assignedWorkspace: workspace.id,
        projectId: project.id,
        enabled: true,
      },
    })).card;
    const leaderMessage = await runtime.postMessage({
      workspaceId: workspace.id,
      projectId: project.id,
      recipientIds: [role.id],
      content: "@推理平台工程师 请检查 GPU 队列。",
      taskId: null,
      traceId: "trace-capacity-001",
    });
    assert.equal(leaderMessage.message.senderType, "leader");
    assert.equal(leaderMessage.message.senderId, "leader-account");
    assert.deepEqual(leaderMessage.message.mentions, [{ roleCardId: role.id, name: role.name }]);

    const agentMessage = await runtime.recordTrustedMessage({
      workspaceId: workspace.id,
      projectId: project.id,
      taskId: "task-capacity-001",
      traceId: "trace-capacity-001",
      senderType: "agent",
      senderId: role.id,
      senderName: role.name,
      content: "已完成只读取证，GPU 队列持续积压。",
      operation: {
        operationId: "operation-capacity-evidence",
        authorityLevel: "NSX-0",
        riskClass: "RK-0",
        evidenceGrade: "EV-1",
        decision: "ALLOW",
        phase: "SUCCEEDED",
        title: "读取 GPU 队列证据",
        summary: "完成只读取证且没有产生外部写入。",
        toolNames: ["aiops.inference.metrics.get"],
        skillName: "capacity-evidence",
        targetResource: "deployment/recommendation",
        actionDigest: "a".repeat(64),
        approvalId: null,
        invocationIds: ["invocation-capacity-evidence"],
        evidenceIds: ["evidence-capacity-evidence"],
        ruleCodes: ["READ_ONLY_OPERATION"],
        ruleReasons: ["操作只读取证且不产生外部副作用。"],
        verificationSummary: null,
      },
    });
    assert.equal(agentMessage.message.id, "message-agent");
    assert.equal(agentMessage.message.kind, "operation");
    assert.equal(agentMessage.message.operation?.authorityLevel, "NSX-0");
    const messages = await runtime.listMessages({ workspaceId: workspace.id, projectId: project.id, limit: 50 });
    assert.deepEqual(messages.messages.map((message) => message.senderType), ["leader", "agent"]);
    assert.equal(messages.messages[1]?.taskId, "task-capacity-001");
    assert.equal(messages.messages[1]?.operation?.riskClass, "RK-0");
    const persistedMessages = await reloaded.listMessages({ workspaceId: workspace.id, projectId: project.id, limit: 50 });
    assert.equal(persistedMessages.messages[1]?.operation?.evidenceGrade, "EV-1");
    await runtime.postMessage({
      workspaceId: workspace.id,
      projectId: project.id,
      recipientIds: [],
      content: "这是需要保留的普通项目沟通。",
      taskId: null,
      traceId: null,
    });
    const purgedMessages = await runtime.purgeCompetitionMessages({
      incidentIds: [],
      traceIds: ["trace-capacity-001"],
    });
    assert.equal(purgedMessages, 2);
    const remainingMessages = await runtime.listMessages({ workspaceId: workspace.id, projectId: project.id, limit: 50 });
    assert.deepEqual(remainingMessages.messages.map((message) => message.content), ["这是需要保留的普通项目沟通。"]);

    const otherWorkspace = (await runtime.saveWorkspace({
      workspace: { name: "隔离空间", type: "local", config: createWorkspaceConfig() },
    })).workspace;
    const otherRole = (await runtime.saveRoleCard({
      mode: "create",
      roleCard: { name: "隔离员工", assignedWorkspace: otherWorkspace.id, enabled: true },
    })).card;
    await assert.rejects(runtime.postMessage({
      workspaceId: workspace.id,
      projectId: project.id,
      recipientIds: [otherRole.id],
      content: "越权 @员工",
      taskId: null,
      traceId: null,
    }), /outside the current scope/i);

    assert.throws(() => runtime.postMessage({
      workspaceId: workspace.id,
      projectId: project.id,
      recipientIds: [],
      content: "伪造员工消息",
      taskId: null,
      traceId: null,
      senderType: "agent",
    }), /fields are invalid/i);
    assert.equal(readFileSync(path.join(root, "enterprise_projects.json"), "utf8").includes("\r\n"), false);
    assert.equal(readFileSync(path.join(root, "enterprise_messages.json"), "utf8").includes("\r\n"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
