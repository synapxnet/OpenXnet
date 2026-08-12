import assert from "node:assert/strict";
import { createWriteStream, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import archiver from "archiver";

import type { LegacyRendererStateSnapshot } from "../contracts/legacy-renderer-state";
import {
  ApplicationSkillRuntimeService,
  type ApplicationSkillMlopsPublication,
} from "./application-skill-runtime";

interface ZipFixtureEntry {
  readonly name: string;
  readonly content: string;
  readonly mode?: number;
}

/** Skill Runtime 测试用 Main-owned 状态边界。 */
class TestSkillStateBoundary {
  /** 创建测试状态；输入工作区，仅保存路径，无磁盘副作用。 */
  public constructor(private readonly workspace: string) {}

  /** 读取测试状态；无输入，返回含当前工作区的独立快照，无副作用。 */
  public getSnapshot(): LegacyRendererStateSnapshot {
    return {
      schema: "openxnet.legacy-renderer-state.v1",
      settingsRevision: 0,
      conversationsRevision: 0,
      generatedAt: "2026-07-29T12:00:00.000Z",
      settings: { CLISettings: { cc_path: this.workspace } },
      conversations: [],
    };
  }
}

/** 创建技能测试 ZIP；输入目标和条目，返回完成 Promise，归档写入失败时拒绝。 */
function createZipFixture(destination: string, entries: readonly ZipFixtureEntry[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = archiver("zip", { zlib: { level: 0 } });
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    for (const entry of entries) archive.append(entry.content, { name: entry.name, mode: entry.mode });
    void archive.finalize();
  });
}

/** 把技能测试 ZIP 的指定中央目录条目标记为 Unix 符号链接；输入 ZIP 和名称，无返回，条目缺失时抛错。 */
function markZipEntryAsSymbolicLink(destination: string, entryName: string): void {
  const archive = readFileSync(destination);
  const expectedName = Buffer.from(entryName, "utf8");
  for (let offset = 0; offset <= archive.length - 46; offset += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength);
    if (!name.equals(expectedName)) continue;
    archive.writeUInt16LE(0x0314, offset + 4);
    archive.writeUInt32LE((0o120777 << 16) >>> 0, offset + 38);
    writeFileSync(destination, archive);
    return;
  }
  throw new Error(`ZIP fixture entry was not found: ${entryName}`);
}

test("Skill Runtime manages bundled, imported, crystallized and project skills without Python", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-skill-runtime-"));
  const globalSkillsRoot = path.join(root, "global", "skills");
  const bundledSkillsRoot = path.join(root, "bundled");
  const workspace = path.join(root, "workspace");
  const bundledSkill = path.join(bundledSkillsRoot, "bundled-skill");
  mkdirSync(bundledSkill, { recursive: true });
  mkdirSync(workspace, { recursive: true });
  writeFileSync(
    path.join(bundledSkill, "SKILL.md"),
    "---\nname: \"内置技能\"\ndescription: \"Bundled\"\nversion: \"1.0.0\"\n---\n\n# Bundled\n",
    "utf8",
  );
  const archivePath = path.join(root, "skills.zip");
  await createZipFixture(archivePath, [{
    name: "imported-skill/SKILL.md",
    content: "---\nname: \"导入技能\"\ndescription: \"Imported\"\nauthor: \"Tester\"\n---\n\n# Imported\n",
  }]);
  const uploadedPublications: ApplicationSkillMlopsPublication[] = [];
  const runtime = new ApplicationSkillRuntimeService({
    globalSkillsRoot,
    bundledSkillsRoot,
    state: new TestSkillStateBoundary(workspace),
    now: () => new Date("2026-07-29T12:00:00.000Z"),
    /** 记录 MLOps 上传包；输入候选包，返回固定草稿回执，不访问网络。 */
    publishToMlopsRepository: async (publication) => {
      uploadedPublications.push(publication);
      return { repositorySkillUid: "OX-REGRESSION-CHECK", repositoryStatus: "draft" };
    },
  });
  try {
    const initial = await runtime.listSkills();
    assert.equal(initial.skills[0]?.name, "内置技能");
    const imported = await runtime.importArchive({
      entry: { source: "path", path: archivePath, originalName: "skills.zip" },
    });
    assert.deepEqual(imported.installedIds, ["imported-skill"]);
    const content = await runtime.getSkillContent({ skillId: "imported-skill" });
    assert.match(content.content, /# Imported/);

    await runtime.syncProjectSkill({ skillId: "imported-skill", action: "install" });
    const projectStatus = await runtime.getProjectStatus();
    assert.equal(projectStatus.workspaceAvailable, true);
    assert.deepEqual(projectStatus.installedIds, ["imported-skill"]);
    assert.equal(existsSync(path.join(workspace, ".agent", "skills", "imported-skill", "SKILL.md")), true);

    const crystallized = await runtime.crystallizeSkill({
      name: "回归检查",
      skillId: "regression-check",
      description: "完成改动后执行回归检查",
      workflow: "运行专项测试\n执行冷启动 smoke",
      notes: "失败时停止发布",
      syncToProject: true,
    });
    assert.deepEqual(crystallized.installedIds, ["regression-check"]);
    const crystalContent = await runtime.getSkillContent({ skillId: "regression-check" });
    assert.match(crystalContent.content, /运行专项测试/);
    assert.match(crystalContent.content, /evidence_origin/);
    assert.equal(crystalContent.content.includes("\r\n"), false);
    const crystalManifest = JSON.parse(readFileSync(
      path.join(globalSkillsRoot, "regression-check", "openxnet.skill.json"),
      "utf8",
    )) as Record<string, unknown>;
    assert.equal(crystalManifest.schema, "openxnet.skill-engineering.v2");
    assert.equal(crystalManifest.evidence_origin, "work");
    const upload = await runtime.uploadSkillToMlops({
      skillId: "regression-check",
      workspaceId: "ws-goai-demo",
    });
    assert.equal(upload.repositorySkillUid, "OX-REGRESSION-CHECK");
    assert.equal(upload.repositoryStatus, "draft");
    assert.equal(uploadedPublications[0]?.workspaceId, "ws-goai-demo");
    assert.equal(uploadedPublications[0]?.skillId, "regression-check");
    assert.match(upload.artifactDigest, /^[a-f0-9]{64}$/u);

    await runtime.syncProjectSkill({ skillId: "imported-skill", action: "remove" });
    await runtime.removeSkill({ skillId: "imported-skill" });
    assert.equal((await runtime.listSkills()).skills.some((item) => item.id === "imported-skill"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Skill Runtime keeps rehearsal skills outside the project until production certification", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-skill-rehearsal-"));
  const globalSkillsRoot = path.join(root, "global", "skills");
  const bundledSkillsRoot = path.join(root, "bundled");
  const workspace = path.join(root, "workspace");
  mkdirSync(bundledSkillsRoot, { recursive: true });
  mkdirSync(workspace, { recursive: true });
  const runtime = new ApplicationSkillRuntimeService({
    globalSkillsRoot,
    bundledSkillsRoot,
    state: new TestSkillStateBoundary(workspace),
    now: () => new Date("2026-08-09T12:00:00.000Z"),
  });
  try {
    const result = await runtime.crystallizeSkill({
      name: "模拟故障恢复",
      skillId: "simulation-recovery",
      familyId: "family-simulation-recovery",
      problemFingerprint: "gpu-queue-overload-v1",
      source: "rehearsal",
      evidenceOrigin: "rehearsal",
      derivationMethod: "rehearsal_crystallization",
      environmentScope: "simulation",
      strategies: [{
        strategyId: "scale-first",
        workflow: ["读取队列", "扩容", "验证"],
        toolChain: ["metrics.read", "capacity.apply", "service.verify"],
        riskLevel: "medium",
        costScore: 0.3,
      }],
      certifications: [{ scope: "simulation", status: "verified" }],
    });
    assert.deepEqual(result.installedIds, ["simulation-recovery"]);
    const manifest = JSON.parse(readFileSync(
      path.join(globalSkillsRoot, "simulation-recovery", "openxnet.skill.json"),
      "utf8",
    )) as Record<string, unknown>;
    assert.equal(manifest.environment_scope, "simulation");
    await assert.rejects(
      runtime.crystallizeSkill({
        name: "禁止同步的模拟技能",
        skillId: "blocked-simulation-recovery",
        evidenceOrigin: "rehearsal",
        environmentScope: "simulation",
        syncToProject: true,
      }),
      /production certification/i,
    );
    assert.equal(existsSync(path.join(workspace, ".agent", "skills", "blocked-simulation-recovery")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Skill Runtime rejects ZIP symbolic links and ignores Renderer workspace paths", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-skill-security-"));
  const globalSkillsRoot = path.join(root, "global", "skills");
  const bundledSkillsRoot = path.join(root, "bundled");
  const workspace = path.join(root, "workspace");
  mkdirSync(globalSkillsRoot, { recursive: true });
  mkdirSync(bundledSkillsRoot, { recursive: true });
  mkdirSync(workspace, { recursive: true });
  const archivePath = path.join(root, "linked.zip");
  await createZipFixture(archivePath, [
    { name: "unsafe-skill/SKILL.md", content: "---\nname: Unsafe\n---\n" },
    { name: "unsafe-skill/link", content: "SKILL.md", mode: 0o120777 },
  ]);
  markZipEntryAsSymbolicLink(archivePath, "unsafe-skill/link");
  const runtime = new ApplicationSkillRuntimeService({
    globalSkillsRoot,
    bundledSkillsRoot,
    state: new TestSkillStateBoundary(workspace),
    authorizeWorkspaceDirectory: () => false,
  });
  try {
    await assert.rejects(
      runtime.importArchive({ entry: { source: "path", path: archivePath, originalName: "linked.zip" } }),
      /symbolic links/i,
    );
    assert.equal((await runtime.getProjectStatus()).workspaceAvailable, false);
    assert.throws(
      () => runtime.syncProjectSkill({ skillId: "missing", action: "install", projectPath: path.join(root, "attacker") }),
      /fields are invalid/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
