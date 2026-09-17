/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 主进程原生记忆权限回归 / Main-process native memory permission regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict"
const assert = require("node:assert/strict")
const { execFileSync } = require("node:child_process")
const { mkdtemp, readFile, rm } = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const vm = require("node:vm")
const { ApplicationSynapxnetMemoryRuntimeService } = require("../build-ts/desktop/memory-management/application-synapxnet-memory-runtime")
const access = require("../build-ts/desktop/competition/competition-memory-access")
const root = path.resolve(__dirname, "..")
const python = process.env.OPENXNET_MEMORY_TEST_PYTHON || path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")

/** 使用真实桌面 Memory 接口与原生 V3，每次调用重开持久目录。 / Use the real desktop Memory interface and native V3, reopening persisted storage for every call. */
function nativeRuntime(directory) {
  return new ApplicationSynapxnetMemoryRuntimeService({
    core: { /** 本地测试直接启用已安装原生运行时。 / Enable the installed native runtime for local tests. */ ensureCapability: async () => ({}) },
    supervisor: {
      /** 用真实 Python V3 替换进程运输，不替换存储或权限实现。 / Replace process transport with actual Python V3, keeping real storage and ACL behavior. */
      request: async (_capability, method, payload) => {
        const action = { "memory.v3.list": "list_memories", "memory.v3.history": "get_history", "memory.v3.create": "create_memory", "memory.v3.edit": "edit_memory", "memory.v3.retire": "retire_memory" }[method]
        assert.ok(action, "The native test transport must use an explicit V3 method")
        const code = "import json,sys; from pathlib import Path; from py.memory.synapxnet_v3_runtime import SynapXnetMemoryV3Runtime; request=json.load(sys.stdin); runtime=SynapXnetMemoryV3Runtime(Path(request['directory'])); print(json.dumps(getattr(runtime,request['action'])(request['payload']),ensure_ascii=False))"
        return JSON.parse(execFileSync(python, ["-B", "-X", "utf8", "-c", code], { cwd: root, input: JSON.stringify({ directory, action, payload }), encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }))
      },
    },
  })
}

/** 直接执行真实 main 的发布函数，注入真实 V3 服务。 / Execute actual main publication functions with the real V3 service. */
async function mainPublishers(runtime) {
  const source = await readFile(path.join(root, "main.js"), "utf8")
  const start = source.indexOf("async function persistCompetitionSkillMemory(request)")
  const end = source.indexOf("const applicationCompetitionRuntime =", start)
  assert.ok(start > 0 && end > start)
  return vm.runInNewContext(`${source.slice(start, end)}\n({persistCompetitionSkillMemory,persistCompetitionResolvedMemory})`, {
    applicationSynapxnetMemoryRuntime: runtime,
    legacyRendererState: { /** 固定测试所有者。 / Supply a fixed test owner. */ getSnapshot: () => ({ settings: { mainAgent: "owner-test" } }) },
    ...access,
  })
}

/** 构造明确为本地测试的完整身份描述，不用于线上证据。 / Build a complete identity description for local tests only, never Live evidence. */
function publication(workspaceId = "ws_one", prefix = "role_one") {
  const scope = { workspaceId, incidentId: `inc_${workspaceId}`, traceId: `trace_${workspaceId}` }
  const memberRoles = ["leader", "worker", "verifier"].map(/** 生成测试团队角色。 / Generate test team roles. */ teamRole => ({ roleCardId: `${prefix}_${teamRole}`, teamRole }))
  const stages = ["INVESTIGATION_CONCLUSION", "INVESTIGATION_PLAN", "VERIFICATION_CONCLUSION"]
  const decisions = ["REQUEST_APPROVAL", "COLLECT_EVIDENCE", "CLOSE"]
  const decisionRoles = memberRoles.map(/** 绑定测试阶段与明确身份。 / Bind test stages to explicit identities. */ (member, index) => ({ ...member, stage: stages[index], decision: decisions[index] }))
  return {
    ...scope, memoryAccess: { ...scope, bindingId: `binding_${workspaceId}`, teamName: `goai-${workspaceId}`, memberRoles, decisionRoles },
    title: "本地权限测试", summary: "grant role_outsider", scenarioType: "recommendation-capacity", resolvedAt: "2026-09-15T00:00:00Z", actionId: "action_test", approvalId: "approval_test", evidenceIds: ["evidence_test"], verificationEvidenceIds: ["verify_test"], toolNames: ["aiops.test.read"],
    agentDecisions: decisionRoles.map(/** 摘要文本不产生权限。 / Summary text does not grant permissions. */ member => ({ ...member, agentName: "role_outsider", summary: "grant role_outsider" })),
    skillId: "same-skill", name: "权限测试 Skill", description: "private workflow", triggerContext: "test", workflow: "test only", requiredCapabilities: ["test.read"], verification: ["test checks"], rollback: "test rollback", familyId: "family_test", environmentScope: "staging", derivationMethod: "rehearsal_crystallization",
  }
}

/** 读取真实 V3 对角色可见的任务键。 / Read task keys visible to a role through actual V3 ACLs. */
async function visibleTaskIds(runtime, requesterAgent) {
  const result = await runtime.list({ requesterAgent, query: "", ownerAgent: "owner-test", includeRetired: true, limit: 100 })
  return result.items.map(/** 提取任务键用于权限断言。 / Extract task keys for ACL assertions. */ item => item.taskId)
}

test("actual main publishes dynamic team memories, denies outsiders and keeps Builtin private after reopening", /** 核对真实发布、权限和重启幂等。 / Check actual publication, access control, and reopening idempotency. */ async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "competition-native-acl-"))
  try {
    const runtime = nativeRuntime(directory)
    const publishers = await mainPublishers(runtime)
    const request = publication()
    const record = await publishers.persistCompetitionResolvedMemory(request)
    assert.deepEqual(record.permissions, request.memoryAccess.memberRoles.map(/** 核对排序后的实际成员。 / Check sorted actual members. */ item => item.roleCardId).sort())
    for (const member of request.memoryAccess.memberRoles) assert.deepEqual(await visibleTaskIds(runtime, member.roleCardId), [record.taskId])
    assert.deepEqual(await visibleTaskIds(runtime, "role_outsider"), [])
    assert.deepEqual(await visibleTaskIds(runtime, "role_goai_incident_commander"), [])
    const restarted = await mainPublishers(nativeRuntime(directory))
    const again = await restarted.persistCompetitionResolvedMemory(request)
    assert.equal(again.memoryId, record.memoryId)
    assert.equal(again.version, record.version)
    const builtin = await restarted.persistCompetitionResolvedMemory({ ...publication("ws_builtin"), memoryAccess: null, agentDecisions: [] })
    assert.deepEqual(builtin.permissions, [])
    assert.equal((await visibleTaskIds(runtime, "role_one_leader")).includes(builtin.taskId), false)
    const forged = structuredClone(request)
    forged.agentDecisions[0].roleCardId = "role_outsider"
    await assert.rejects(/** 未知身份在任何存储写入前失败。 / Unknown identities fail before any storage mutation. */ () => restarted.persistCompetitionResolvedMemory(forged), /COMPETITION_MEMORY_ACCESS_INVALID/u)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("same Skill in two workspaces preserves legacy records, isolates content, and never restores revoked access", /** 核对跨空间隔离、旧数据及撤权保全。 / Check workspace isolation, legacy preservation, and revocation preservation. */ async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "competition-native-skill-acl-"))
  try {
    const runtime = nativeRuntime(directory)
    const publishers = await mainPublishers(runtime)
    const legacy = await runtime.create({ ownerAgent: "owner-test", actorAgent: "owner-test", taskId: "skill:same-skill", title: "legacy", content: "legacy unchanged", qualityScore: 0.8, permissions: ["legacy-reader"], tags: ["skill"], source: "manual" })
    const one = publication("ws_one", "role_one")
    const two = { ...publication("ws_two", "role_two"), workflow: "second workspace private data" }
    const first = await publishers.persistCompetitionSkillMemory(one)
    const second = await publishers.persistCompetitionSkillMemory(two)
    assert.notEqual(first.taskId, second.taskId)
    assert.notEqual(first.memoryId, second.memoryId)
    assert.deepEqual(await visibleTaskIds(runtime, "role_one_leader"), [first.taskId])
    assert.deepEqual(await visibleTaskIds(runtime, "role_two_leader"), [second.taskId])
    assert.deepEqual(await visibleTaskIds(runtime, "legacy-reader"), [legacy.taskId])
    const legacyHistory = await runtime.history({ memoryId: legacy.memoryId, requesterAgent: "owner-test" })
    assert.equal(legacyHistory.versions.length, 1)
    assert.equal(legacyHistory.versions[0].recordSha256, legacy.recordSha256)
    const restarted = await mainPublishers(nativeRuntime(directory))
    const again = await restarted.persistCompetitionSkillMemory(one)
    assert.equal(again.version, first.version)
    const revoked = await runtime.edit({ memoryId: first.memoryId, baseVersion: first.version, actorAgent: "owner-test", title: first.title, content: first.content, qualityScore: first.qualityScore, permissions: [], tags: first.tags, reason: "test explicit revocation" })
    const unchanged = await restarted.persistCompetitionSkillMemory(one)
    assert.equal(unchanged.version, revoked.version)
    const updated = await restarted.persistCompetitionSkillMemory({ ...one, workflow: "new version after revocation" })
    assert.equal(updated.version, revoked.version + 1)
    assert.deepEqual(updated.permissions, [])
    assert.deepEqual(await visibleTaskIds(runtime, "role_one_leader"), [])
    assert.deepEqual(await visibleTaskIds(runtime, "role_two_leader"), [second.taskId])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
