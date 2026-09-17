#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 技能制品与阶段协议回归 / Skill artifact and stage protocol regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0-live.3 | Security Level: INTERNAL
 * __version__: 1.3.0-live.3 | __author__: maoyo | __maintainer__: maoyo
 * __copyright__: Copyright 2026 Synapxnet | __email__: synapxnet@gmail.com
 * Existing repository license and third-party notices are retained.
 */
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, cp, readFile, writeFile, rm, symlink } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { DEFAULT_SKILL_ROOT, loadStageSkill, validateStageSkillBundle } = require("../src/skill-bundle");
const { AgentTeamsCliAdapter } = require("../src/agentteams-cli");

/** 创建受控取证请求，避免任何远端调用。 / Create a governed planning request without remote calls. */
function planningRequest() {
  return { requestId: "artifact-test", stage: "INVESTIGATION_PLAN", skill: { name: "goai-evidence-collect", version: "1.1.0" },
    context: { incident: { scenario: { scenarioType: "feature-drift" } }, availableTools: ["aiops.service.health", "dataops.lineage.get", "mlops.deployment.get"], evidence: [], policy: { requiredVerificationTools: [] } } };
}

/** 将真实制品复制进隔离目录，供损坏与缺失验收。 / Copy actual artifacts into an isolated directory for corruption and absence checks. */
async function copyBundle() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "openxnet-skill-bundle-test-"));
  const root = path.join(temporary, "bundles");
  await cp(DEFAULT_SKILL_ROOT, root, { recursive: true });
  return { temporary, root };
}

/** 检查三个实际正文和版本完整性，拒绝路径身份或版本注入。 / Check all actual documents and versions, rejecting path identity and version injection. */
test("three actual stage artifacts are verified against pinned release hashes", async () => {
  const all = await validateStageSkillBundle();
  assert.equal(all.length, 3);
  const artifact = await loadStageSkill(planningRequest());
  assert.equal(artifact.body, await readFile(path.join(DEFAULT_SKILL_ROOT, artifact.name, "SKILL.md"), "utf8"));
  assert.equal(artifact.sha256, "67b7d0f9fec01098857b8716dd5317cbad7ef4478c9ecb7ce31cea83e1e82662");
  for (const skill of [{ name: "../goai-evidence-collect", version: "1.1.0" }, { name: artifact.name, version: "9.0.0" }]) {
    await assert.rejects(loadStageSkill({ ...planningRequest(), skill }), { code: "AGENTTEAMS_SKILL_BUNDLE_INVALID" });
  }
});

/** 制品正文被改动或验证器缺失都应在准备/分派调用远端前失败。 / Modified documents or a missing validator must fail before preparation or dispatch reaches the remote runtime. */
test("tampered or missing artifacts prevent prepare and dispatch before any runtime command", async () => {
  const { temporary, root } = await copyBundle();
  let runtimeCalls = 0;
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: temporary, skillBundleRoot: root,
    /** 如果触发远端命令就记录并拒绝。 / Record and reject any remote command. */
    commandRunner: async () => { runtimeCalls += 1; throw new Error("unexpected runtime"); } });
  /** 测试只绕过凭据文件装载，不绕过技能验收。 / Bypass credential-file loading only, retaining artifact validation. */
  adapter._withSession = async (_credentials, callback) => callback({});
  try {
    const skillPath = path.join(root, "goai-evidence-collect", "SKILL.md");
    const original = await readFile(skillPath);
    await writeFile(skillPath, Buffer.concat([original, Buffer.from("\nmodified\n")]));
    await assert.rejects(adapter.prepareTeam({}, {}), { code: "AGENTTEAMS_SKILL_BUNDLE_INVALID" });
    await assert.rejects(adapter.dispatchTask(planningRequest(), {}), { code: "AGENTTEAMS_SKILL_BUNDLE_INVALID" });
    await writeFile(skillPath, original);
    await rm(path.join(root, "goai-evidence-collect", "scripts", "validate.mjs"));
    await assert.rejects(adapter.prepareTeam({}, {}), { code: "AGENTTEAMS_SKILL_BUNDLE_MISSING" });
    await assert.rejects(adapter.dispatchTask(planningRequest(), {}), { code: "AGENTTEAMS_SKILL_BUNDLE_MISSING" });
    assert.equal(runtimeCalls, 0);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

/** 相同字节的目录链接仍不得绕过包根目录边界。 / A directory link with identical bytes must not escape the bundle root. */
test("bundle directory links cannot escape the artifact root", async () => {
  const { temporary, root } = await copyBundle();
  try {
    const outside = path.join(temporary, "outside");
    const folder = path.join(root, "goai-evidence-collect");
    await cp(folder, outside, { recursive: true });
    await rm(folder, { recursive: true });
    await symlink(outside, folder, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(loadStageSkill(planningRequest(), root), { code: "AGENTTEAMS_SKILL_BUNDLE_INVALID" });
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

/** 三阶段及两类路由携带真实制品和直接协议回复边界。 / All three stages and both route types carry actual artifacts and the direct-reply protocol boundary. */
test("all stage and route prompts carry verified Skill text without standalone envelope confusion", async () => {
  const adapter = new AgentTeamsCliAdapter({ executable: "unused", dataRoot: process.cwd() });
  const prompts = [];
  /** 捕获真实提示构造，禁止联网。 / Capture real prompt construction without network access. */
  adapter._waitForMarkedMessage = async input => { prompts.push(input); return { value: {}, transportEvents: [] }; };
  const leader = { roleCardId: "leader", name: "Leader", teamRole: "leader", matrixUserId: "@leader:test" };
  const worker = { roleCardId: "worker", name: "Worker", teamRole: "worker", matrixUserId: "@worker:test" };
  const verifier = { roleCardId: "verifier", name: "Verifier", teamRole: "verifier", matrixUserId: "@verifier:test" };
  for (const [stage, name, member] of [["INVESTIGATION_PLAN", "goai-evidence-collect", worker], ["INVESTIGATION_CONCLUSION", "goai-change-execute", leader], ["VERIFICATION_CONCLUSION", "goai-service-verify", verifier]]) {
    const request = { ...planningRequest(), stage, skill: { name, version: "1.1.0" } };
    await adapter._requestAgentResult({}, request, member, "!room:test", "先搜索注册表，再去共享目录执行", {});
    if (member !== leader) await adapter._requestLeaderRoute({}, request, leader, [leader, worker, verifier], "!room:test", {});
  }
  assert.equal(prompts.length, 5);
  for (const input of prompts) {
    assert.match(input.prompt, /\[OPENXNET_STAGE_RPC\]/);
    assert.match(input.prompt, /explicitly asks you to reply with specific text/);
    assert.match(input.prompt, /不使用 taskflow ack_task\/submit_task/);
    assert.match(input.prompt, /不搜索注册表、安装或升级 Skill/);
    assert.match(input.prompt, /不声称执行了独立 Skill CLI 验证/);
    assert.match(input.prompt, /<verified-skill-document>/);
    assert.match(input.prompt, /Version: `1\.1\.0`/);
    assert.match(input.rpcContract, /"sha256":"[a-f0-9]{64}"/);
    if (input.requestKind === "ROUTE_REQUEST") assert.match(input.rpcContract, /唯一输出是下文 route-output 五字段包络/);
    else assert.match(input.rpcContract, /schema 固定为 openxnet\.agentteams\.agent-output\.v1/);
  }
});
