/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 版本化阶段技能制品装载 / Versioned stage Skill artifact loading.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0-live.3 | Security Level: INTERNAL
 * __version__: 1.3.0-live.3 | __author__: maoyo | __maintainer__: maoyo
 * __copyright__: Copyright 2026 Synapxnet | __email__: synapxnet@gmail.com
 * Existing repository license and third-party notices are retained.
 */
"use strict";

const { createHash } = require("node:crypto");
const { readFile, realpath, stat } = require("node:fs/promises");
const path = require("node:path");
const { PublicError } = require("./contracts");
const manifest = require("../skill-bundles/manifest.json");
const DEFAULT_SKILL_ROOT = path.resolve(__dirname, "../skill-bundles");
const STAGE_SKILLS = Object.freeze({
  INVESTIGATION_PLAN: "goai-evidence-collect",
  INVESTIGATION_CONCLUSION: "goai-change-execute",
  VERIFICATION_CONCLUSION: "goai-service-verify",
});
const BUNDLE_FILES = Object.freeze(["SKILL.md", "schemas/input.schema.json", "schemas/output.schema.json", "scripts/validate.mjs"]);

/** 读取固定包内文件，拒绝链接逃逸与超长制品。 / Read a fixed bundle file, rejecting link escapes and oversized artifacts. */
async function readBundleFile(root, name, relative) {
  try {
    const absoluteRoot = await realpath(root);
    const target = await realpath(path.join(absoluteRoot, name, relative));
    const inside = path.relative(absoluteRoot, target);
    if (inside.startsWith(`..${path.sep}`) || inside === ".." || path.isAbsolute(inside)) {
      throw new PublicError(503, "AGENTTEAMS_SKILL_BUNDLE_INVALID", "Stage Skill artifact escaped its bundle directory.");
    }
    const info = await stat(target);
    if (!info.isFile() || info.size < 1 || info.size > 64 * 1024) {
      throw new PublicError(503, "AGENTTEAMS_SKILL_BUNDLE_INVALID", "Stage Skill artifact size is invalid.");
    }
    return await readFile(target);
  } catch (error) {
    if (error instanceof PublicError) throw error;
    throw new PublicError(503, "AGENTTEAMS_SKILL_BUNDLE_MISSING", "Required versioned stage Skill artifact is unavailable.");
  }
}

/** 按固定身份和随包哈希验证实际技能正文与独立契约制品。 / Verify actual Skill text and standalone contracts against fixed identity and bundled hashes. */
async function loadStageSkill(request, root = DEFAULT_SKILL_ROOT) {
  const name = STAGE_SKILLS[request.stage];
  const expected = manifest.skills[name];
  if (!expected || request.skill?.name !== name || request.skill?.version !== expected.version) {
    throw new PublicError(503, "AGENTTEAMS_SKILL_BUNDLE_INVALID", "Stage Skill name or version does not match the governed stage.");
  }
  let body = "";
  for (const relative of BUNDLE_FILES) {
    const bytes = await readBundleFile(root, name, relative);
    if (createHash("sha256").update(bytes).digest("hex") !== expected.files[relative]) {
      throw new PublicError(503, "AGENTTEAMS_SKILL_BUNDLE_INVALID", "Stage Skill artifact checksum does not match the release manifest.");
    }
    if (relative === "SKILL.md") body = bytes.toString("utf8");
  }
  if (!body.includes(`name: ${name}`) || !body.includes(`Version: \`${expected.version}\``)) {
    throw new PublicError(503, "AGENTTEAMS_SKILL_BUNDLE_INVALID", "Stage Skill document identity is invalid.");
  }
  return Object.freeze({ name, version: expected.version, source: expected.source, sha256: expected.files["SKILL.md"], files: { ...expected.files }, body });
}

/** 准备团队前确认三个受控阶段都有完整版本制品。 / Confirm all governed stages have complete versioned artifacts before team preparation. */
async function validateStageSkillBundle(root = DEFAULT_SKILL_ROOT) {
  const artifacts = [];
  for (const [stage, name] of Object.entries(STAGE_SKILLS)) {
    artifacts.push(await loadStageSkill({ stage, skill: { name, version: manifest.skills[name].version } }, root));
  }
  return artifacts.map(({ body, ...metadata }) => metadata);
}

/** 将真实制品及适配模式契约交给模型，不冒充模型已执行独立 CLI 校验。 / Supply the actual artifact and adapter-mode contract without claiming the model ran standalone CLI validation. */
function stageRpcContract(artifact, route = false) {
  const metadata = { name: artifact.name, version: artifact.version, source: artifact.source, sha256: artifact.sha256, files: artifact.files };
  return [
    "[OPENXNET_STAGE_RPC] 本消息是给定完整输入的受控阶段协议请求，明确要求你在当前 Matrix 房间直接回复指定 Marker 和一个 JSON。这符合现有 AGENTS 对 explicitly asks you to reply with specific text 的直接回复例外。",
    "当前不是 AgentTeams 文件任务：不使用 taskflow ack_task/submit_task，不查找或创建 shared/tasks，不调用 filesync，不搜索注册表、安装或升级 Skill，不执行 shell、不写文件或运行校验脚本。此边界只适用于本次阶段 RPC，不改变其他常规任务规则。",
    "版本化 Skill 正文已由 Adapter 从随包真实制品读取并按发布清单校验 SHA-256，完整内容如下。无需在 Worker 文件系统重复寻找。",
    `制品来源与校验信息：${JSON.stringify(metadata)}`,
    "<verified-skill-document>", artifact.body, "</verified-skill-document>",
    "适配模式：上述 Skill 的 schemas/* 与 scripts/validate.mjs 是独立 CLI 使用契约。当前完整 context 和阶段 RPC 使用 OpenXnet 已有请求解析器及结果解析器校验，不声称执行了独立 Skill CLI 验证。Skill 的阶段职责与安全边界保持有效。",
    route
      ? "当前你只路由该 Skill 的下游任务。唯一输出是下文 route-output 五字段包络，不输出 Skill 六字段业务结果，也不输出 agent-output 十一字段结果。"
      : "当前将 Skill 的 decision、summary、confidence、requestedToolNames、evidenceIds 业务结果放入下文 agent-output 十一字段顶层包络；schema 固定为 openxnet.agentteams.agent-output.v1，另保留 requestId、stage、roleCardId、skillName、skillVersion。不得改成 Skill 独立六字段 schema，也不得新增字段。",
    "直接在当前房间生成最终包络；工具执行、结果保存和审批均由 OpenXnet 治理流程负责。",
  ].join("\n");
}

module.exports = { DEFAULT_SKILL_ROOT, loadStageSkill, validateStageSkillBundle, stageRpcContract };
