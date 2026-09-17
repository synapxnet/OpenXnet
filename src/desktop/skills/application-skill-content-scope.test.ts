/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 用途：技能正文来源与工作区边界回归。 Purpose: Skill content scope and workspace boundary regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { LegacyRendererStateSnapshot } from "../contracts/legacy-renderer-state";
import { ApplicationSkillRuntimeService } from "./application-skill-runtime";

/** 创建隔离的全局与工作区目录。 Create isolated global and workspace directories. */
function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-skill-scope-"));
  const workspace = path.join(root, "workspace");
  const globalSkillsRoot = path.join(root, "global");
  const projectSkills = path.join(workspace, ".agent", "skills");
  mkdirSync(projectSkills, { recursive: true });
  mkdirSync(globalSkillsRoot, { recursive: true });
  /** 提供由Main拥有的工作区设置。 Supply the Main-owned workspace setting. */
  function getSnapshot(): LegacyRendererStateSnapshot {
    return {
      schema: "openxnet.legacy-renderer-state.v1", settingsRevision: 0,
      conversationsRevision: 0, generatedAt: "2026-09-14T00:00:00.000Z",
      settings: { CLISettings: { cc_path: workspace } }, conversations: [],
    };
  }
  const options = { globalSkillsRoot, bundledSkillsRoot: path.join(root, "bundled"), state: { getSnapshot } };
  return { root, workspace, globalSkillsRoot, projectSkills, options, runtime: new ApplicationSkillRuntimeService(options) };
}

/** 写入独立的技能正文。 Write an independent skill document. */
function writeSkill(directory: string, skillId: string, content: string): void {
  mkdirSync(path.join(directory, skillId), { recursive: true });
  writeFileSync(path.join(directory, skillId, "SKILL.md"), content, "utf8");
}

/** 同名技能与项目独有技能必须读取准确来源。 Read the exact scope for duplicate and project-only skills. */
test("content scope reads project-only skills and never falls back across same-name sources", async () => {
  const fixture = createFixture();
  try {
    writeSkill(fixture.globalSkillsRoot, "shared", "# Global version");
    writeSkill(fixture.projectSkills, "shared", "# Project version");
    writeSkill(fixture.projectSkills, "project-only", "# Project only");
    writeSkill(fixture.globalSkillsRoot, "global-only", "# Global only");
    assert.equal((await fixture.runtime.getSkillContent({ skillId: "shared" })).content, "# Global version");
    assert.equal((await fixture.runtime.getSkillContent({ skillId: "shared", source: "project" })).content, "# Project version");
    assert.equal((await fixture.runtime.getSkillContent({ skillId: "project-only", source: "project" })).content, "# Project only");
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "global-only", source: "project" }), /unavailable/i);
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "project-only" }), /unavailable/i);
    writeSkill(fixture.projectSkills, "oversized", "x".repeat(1024 * 1024 + 1));
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "oversized", source: "project" }), /Skill metadata is invalid/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

/** 拒绝调用端路径、非法来源和未授权工作区。 Reject caller paths, invalid scopes and unauthorized workspaces. */
test("content scope accepts no renderer paths and respects Main workspace authorization", async () => {
  const fixture = createFixture();
  try {
    for (const request of [
      { skillId: "shared", source: "other" }, { skillId: "shared", source: null },
      { skillId: "../outside", source: "project" },
      { skillId: "shared", source: "project", projectPath: fixture.root },
    ]) await assert.rejects(fixture.runtime.getSkillContent(request));
    const denied = new ApplicationSkillRuntimeService({
      ...fixture.options,
      /** 模拟未授权工作区。 Simulate an unauthorized workspace. */
      authorizeWorkspaceDirectory: () => false,
    });
    await assert.rejects(denied.getSkillContent({ skillId: "shared", source: "project" }), /workspace is unavailable/i);
    rmSync(fixture.workspace, { recursive: true, force: true });
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "shared", source: "project" }), /workspace is unavailable/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

/** 各级目录链接不能绕过工作区边界。 Directory links at every level must not bypass workspace boundaries. */
test("content scope rejects linked project parents and linked skill directories", async () => {
  const fixture = createFixture();
  try {
    const outside = path.join(fixture.root, "outside");
    writeSkill(outside, "secret", "# Outside document");
    const linkKind = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(path.join(outside, "secret"), path.join(fixture.projectSkills, "linked"), linkKind);
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "linked", source: "project" }), /linked/i);
    rmSync(fixture.projectSkills, { recursive: true, force: true });
    symlinkSync(outside, fixture.projectSkills, linkKind);
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "secret", source: "project" }), /linked/i);
    rmSync(fixture.projectSkills);
    const agentDirectory = path.join(fixture.workspace, ".agent");
    rmSync(agentDirectory, { recursive: true, force: true });
    symlinkSync(outside, agentDirectory, linkKind);
    await assert.rejects(fixture.runtime.getSkillContent({ skillId: "secret", source: "project" }), /linked/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
