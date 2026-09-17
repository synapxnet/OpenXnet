/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 控制面落盘与完整失败分支回归 / Control-plane persistence and full failure-path regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.3.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ApplicationCompetitionRuntimeError, ApplicationCompetitionRuntimeService } from "./application-competition-runtime";
import { CompetitionStore, CompetitionStoreWriteError } from "./competition-store";
import { FixtureCompetitionToolAdapter, type CompetitionToolAdapter, type CompetitionToolAdapterRequest } from "./competition-tool-adapter";

/** 返回测试专属控制面路径。 / Resolve the control-plane path inside an isolated test directory. */
function storePath(directory: string): string {
  return path.join(directory, "competition", "control-plane.v1.json");
}

/** 使用真实 Windows 只读句柄制造可控的替换冲突。 / Create a controlled replacement conflict with a real Windows read handle. */
async function holdReadLock(file: string, durationMs?: number): Promise<{ done: Promise<void>; release: () => void }> {
  const wait = durationMs === undefined ? "[Console]::ReadLine() | Out-Null" : `Start-Sleep -Milliseconds ${durationMs}`;
  const child = spawn("powershell.exe", ["-NoProfile", "-Command",
    `$stream=[System.IO.File]::Open($env:OPENXNET_PERSISTENCE_TEST_FILE,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read); try { [Console]::WriteLine('LOCKED'); ${wait} } finally { $stream.Dispose() }`,
  ], { windowsHide: true, env: { ...process.env, OPENXNET_PERSISTENCE_TEST_FILE: file }, stdio: ["pipe", "pipe", "pipe"] });
  const done = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Lock helper exited with ${code}.`)));
  });
  const ready = new Promise<void>((resolve, reject) => {
    child.stdout.once("data", (data: Buffer) => String(data).includes("LOCKED") ? resolve() : reject(new Error("Lock handshake failed.")));
    child.once("error", reject);
    child.once("close", () => reject(new Error("Lock helper closed before readiness.")));
  });
  await ready;
  return { done, release: () => child.stdin.end("\n") };
}

/** 创建与安装版故障一致的场景参数。 / Create the exact scenario parameters observed in the installed-build failure. */
function incidentRequest(failingVerification: boolean) {
  return {
    workspaceId: "ws_isolated_persistence_regression", title: "跨域特征漂移恢复", severity: "P1", actorId: "incident-commander",
    summary: "仅隔离测试：验证落盘、完整执行与独立验证。",
    scenario: {
      scenarioType: "feature-drift", alertUid: "alert_risk_error_rate", serviceUid: "service_risk_inference",
      clusterId: "3", namespace: "risk-prod", workloadName: "risk-inference", reportUid: "qr_risk_features_120",
      assetUid: "asset_risk_features_prod", workflowInstanceUid: "task_risk_features_latest", deploymentUid: "deploy_risk_prod",
      failingRevision: 18, targetRevision: 19, rollbackRevision: 17, expectedResourceVersion: "42",
      testDatasetRef: failingVerification ? "fixture://goai/verification-failure-v1" : "fixture://goai/risk-120-v1",
    },
  };
}

/** 走取证、独立人工审批与 DryRun，禁止绕过审批。 / Perform investigation, separate human approval and DryRun without bypassing governance. */
async function prepareApprovedPlan(runtime: ApplicationCompetitionRuntimeService, failure: boolean): Promise<string> {
  const created = await runtime.createIncident(incidentRequest(failure));
  const investigated = await runtime.runInvestigation({ incidentId: created.incidentId, actorId: "incident-commander", teamRuntime: "builtin" });
  assert.ok(investigated.approvalId);
  await runtime.decideApproval({ approvalId: investigated.approvalId, decision: "APPROVED", actorId: "human-reviewer", reason: "隔离测试批准固定计划，仍由独立验证决定最终结果。" });
  const dryRun = await runtime.executeRollback({ approvalId: investigated.approvalId, actorId: "controlled-executor", idempotencyKey: "regression-dry-run", dryRun: true });
  assert.equal(dryRun.snapshot.actions.length, 0);
  return investigated.approvalId;
}

test("Windows transient read lock retries one atomic snapshot without repeating mutation", { skip: process.platform !== "win32", timeout: 15_000 },
  /** 短暂占用恢复后只提交一次。 / A transient lock resolves with a single computed update. */
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-store-transient-"));
    try {
      const store = new CompetitionStore({ userDataDirectory: directory });
      await store.reset();
      const lock = await holdReadLock(storePath(directory), 400);
      let mutations = 0;
      try {
        const result = await store.update((snapshot) => { mutations += 1; return { ...snapshot, updatedAt: "2026-09-17T10:00:00.000Z" }; });
        assert.equal(result.updatedAt, "2026-09-17T10:00:00.000Z");
        assert.equal(mutations, 1);
      } finally { await lock.done; }
      assert.equal((await store.read()).updatedAt, "2026-09-17T10:00:00.000Z");
      assert.deepEqual(await readdir(path.dirname(storePath(directory))), ["control-plane.v1.json"]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

test("Windows persistent read lock preserves previous snapshot and reports safe persistence error", { skip: process.platform !== "win32", timeout: 15_000 },
  /** 持续占用不伪报成功，也不破坏旧文件。 / A persistent lock neither reports success nor damages the previous file. */
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-store-persistent-"));
    try {
      const store = new CompetitionStore({ userDataDirectory: directory });
      await store.reset();
      const before = await readFile(storePath(directory), "utf8");
      const lock = await holdReadLock(storePath(directory));
      try {
        await assert.rejects(store.update((snapshot) => ({ ...snapshot, updatedAt: "never-persisted" })), (error: unknown) => {
          assert.ok(error instanceof CompetitionStoreWriteError);
          assert.equal(error.code, "CONTROL_PLANE_PERSISTENCE_FAILED");
          assert.equal(error.retryable, false);
          assert.ok(["EPERM", "EACCES", "EBUSY"].includes(error.systemCode));
          assert.equal(error.message.includes(directory), false);
          return true;
        });
        assert.equal(await readFile(storePath(directory), "utf8"), before);
        assert.deepEqual(await readdir(path.dirname(storePath(directory))), ["control-plane.v1.json"]);
      } finally { lock.release(); await lock.done; }
      const recovered = await store.update((snapshot) => ({ ...snapshot, updatedAt: "2026-09-17T10:01:00.000Z" }));
      assert.equal(recovered.updatedAt, "2026-09-17T10:01:00.000Z");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

for (const failingVerification of [false, true]) {
  test(`full target 19 Fixture with DryRun ${failingVerification ? "survives evaluation save lock then compensates failed verification" : "passes independent verification and publishes memory"}`,
    { skip: failingVerification && process.platform !== "win32", timeout: 30_000 },
    /** 验证精确场景全链，并确保文件锁不重跑第五步工具。 / Verify the exact full scenario and ensure a save lock never repeats the fifth tool. */
    async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-full-persistence-"));
      const locks: { done: Promise<void> }[] = [];
      try {
        const fixture = new FixtureCompetitionToolAdapter();
        let evaluations = 0;
        let publishedMemories = 0;
        const adapter: CompetitionToolAdapter = {
          /** 在真实工具返回后锁住落盘目标。 / Lock the persistence target after the real Fixture tool returns. */
          async invoke(request) {
            const response = await fixture.invoke(request);
            if (request.toolName === "mlops.model.evaluation.run") {
              evaluations += 1;
              if (failingVerification) locks.push(await holdReadLock(storePath(directory), 400));
            }
            return response;
          },
        };
        const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: adapter, liveAdapter: adapter,
          /** 仅统计隔离成功记忆发布。 / Count isolated success-memory publication only. */
          persistResolvedIncidentMemory: async () => { publishedMemories += 1; },
        });
        const approvalId = await prepareApprovedPlan(runtime, failingVerification);
        const approved = (await runtime.getSnapshot()).approvals;
        const executed = await runtime.executeRollback({ approvalId, actorId: "controlled-executor", idempotencyKey: "regression-execution", dryRun: false });
        assert.ok(executed.actionId);
        assert.equal(evaluations, 1);
        assert.equal(executed.snapshot.actions[0]?.steps.length, 9);
        assert.ok(executed.snapshot.actions[0]?.steps.every((step) => step.status === "SUCCEEDED"));
        if (failingVerification) {
          await assert.rejects(runtime.verifyRemediation({ actionId: executed.actionId, actorId: "independent-verifier" }),
            (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "VERIFICATION_FAILED");
        } else {
          await runtime.verifyRemediation({ actionId: executed.actionId, actorId: "independent-verifier" });
        }
        const snapshot = await runtime.getSnapshot();
        assert.equal(snapshot.incidents[0]?.status, failingVerification ? "FAILED" : "RESOLVED");
        assert.equal(snapshot.actions[0]?.compensationStatus, failingVerification ? "SUCCEEDED" : "NOT_REQUIRED");
        assert.equal(publishedMemories, failingVerification ? 0 : 1);
        assert.deepEqual(snapshot.approvals, approved);
        if (failingVerification) {
          assert.equal(snapshot.actions[0]?.errorCode, "VERIFICATION_FAILED");
          assert.equal(snapshot.actions[0]?.compensationSteps.length, 2);
          assert.ok(snapshot.actions[0]?.compensationSteps.every((step) => step.status === "SUCCEEDED"));
          assert.equal(snapshot.auditReceipts.find((receipt) => receipt.toolName === "openxnet.remediation.verify")?.verification?.decision, "ROLLBACK_REQUIRED");
        }
        const restarted = new CompetitionStore({ userDataDirectory: directory });
        assert.equal((await restarted.read()).incidents[0]?.status, snapshot.incidents[0]?.status);
      } finally {
        await Promise.all(locks.map((lock) => lock.done));
        await rm(directory, { recursive: true, force: true });
      }
    });
}

test("early persistence failure never rewrites approved compensation versions or claims recovery", { timeout: 30_000 },
  /** 模拟第五步落盘失败，冻结审批版本不允许自动重绑。 / Simulate a fifth-step persistence failure without rebinding frozen approved versions. */
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-early-persistence-"));
    try {
      const fixture = new FixtureCompetitionToolAdapter();
      const rollbackCalls: CompetitionToolAdapterRequest[] = [];
      const adapter: CompetitionToolAdapter = {
        /** 注入独立存储错误并记录补偿授权版本。 / Inject a distinct storage error and record the approved compensation version. */
        async invoke(request) {
          if (request.toolName === "mlops.model.evaluation.run") throw new CompetitionStoreWriteError({ code: "EPERM" });
          if (request.governance?.compensation) rollbackCalls.push(request);
          return fixture.invoke(request);
        },
      };
      const runtime = new ApplicationCompetitionRuntimeService({ userDataDirectory: directory, fixtureAdapter: adapter, liveAdapter: adapter });
      const approvalId = await prepareApprovedPlan(runtime, true);
      const approved = (await runtime.getSnapshot()).approvals;
      await assert.rejects(runtime.executeRollback({ approvalId, actorId: "controlled-executor", idempotencyKey: "regression-early-failure", dryRun: false }),
        (error: unknown) => error instanceof ApplicationCompetitionRuntimeError && error.code === "CONTROL_PLANE_PERSISTENCE_FAILED" && !error.retryable);
      const snapshot = await runtime.getSnapshot();
      assert.deepEqual(snapshot.approvals, approved);
      assert.equal(rollbackCalls.length, 1);
      assert.equal(rollbackCalls[0]?.governance?.expectedResourceVersion, "44");
      assert.equal(snapshot.actions[0]?.compensationStatus, "FAILED");
      assert.equal(snapshot.actions[0]?.compensationSteps[0]?.errorCode, "RESOURCE_VERSION_CONFLICT");
      assert.equal(snapshot.actions[0]?.steps[4]?.errorCode, "CONTROL_PLANE_PERSISTENCE_FAILED");
      assert.equal(snapshot.actions[0]?.errorCode, "CONTROL_PLANE_PERSISTENCE_FAILED");
      assert.equal(snapshot.incidents[0]?.status, "FAILED");
      assert.equal(snapshot.actions[0]?.verificationEvidenceIds.length, 0);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
