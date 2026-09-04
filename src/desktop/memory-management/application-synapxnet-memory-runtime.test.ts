import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ApplicationSynapxnetMemoryRuntimeService } from "./application-synapxnet-memory-runtime";

const digest = "a".repeat(64);

test("SynapXnet Memory Runtime validates requests and routes V3 worker methods", async () => {
  const calls: Array<{ readonly method: string; readonly payload: unknown }> = [];
  const runtime = new ApplicationSynapxnetMemoryRuntimeService({
    core: { ensureCapability: async () => ({} as never) },
    supervisor: {
      request: async (_capability, method, payload) => {
        calls.push({ method, payload });
        if (method === "memory.v3.status") {
          return {
            schema: "openxnet.synapxnet-memory-runtime.v1",
            frameworkVersion: "0.3.0",
            tiers: {
              longTerm: { memories: 0, versions: 0, committedVersions: 0 },
              activeNative: { sessions: 0 },
              shortTerm: { events: 0 },
            },
            sharedVersions: 0,
            ownerAgents: 0,
            auditEvents: 0,
            auditHealthy: true,
          };
        }
        return { schema: "openxnet.synapxnet-memory-runtime.v1", items: [], count: 0 };
      },
    },
  });

  assert.equal((await runtime.status()).frameworkVersion, "0.3.0");
  assert.equal((await runtime.list({
    requesterAgent: "agent-owner",
    query: "release",
    ownerAgent: "",
    includeRetired: false,
    limit: 20,
  })).count, 0);
  assert.deepEqual(calls.map((call) => call.method), ["memory.v3.status", "memory.v3.list"]);
  await assert.rejects(
    runtime.history({ memoryId: digest, requesterAgent: "agent-owner", path: "outside" }),
    /fields are invalid/i,
  );
  assert.equal(calls.length, 2);
});

test("SynapXnet Memory Runtime enforces transfer response schema and byte boundary", async () => {
  const runtime = new ApplicationSynapxnetMemoryRuntimeService({
    core: { ensureCapability: async () => ({} as never) },
    supervisor: {
      request: async () => ({
        schema: "openxnet.synapxnet-memory-transfer.v1",
        exportedAtUtc: "2026-09-01T00:00:00+00:00",
        exportedByAgent: "agent-owner",
        entries: [],
        manifestSha256: digest,
      }),
    },
  });
  const document = await runtime.export({ requesterAgent: "agent-owner", memoryIds: [digest] });
  assert.equal(document.manifestSha256, digest);
});

test("SynapXnet Memory Runtime restores a publisher-locked bundle once", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "openxnet-memory-recovery-"));
  const transferPath = path.join(directory, "bootstrap.json");
  await writeFile(transferPath, JSON.stringify({
    schema: "openxnet.synapxnet-memory-transfer.v1",
    manifestSha256: digest,
    entries: [],
  }), "utf8");
  let imported = false;
  let importCalls = 0;
  let reconcileCalls = 0;
  const emptyStatus = {
    schema: "openxnet.synapxnet-memory-runtime.v1",
    frameworkVersion: "0.3.0",
    tiers: {
      longTerm: { memories: 0, versions: 0, committedVersions: 0 },
      activeNative: { sessions: 0 },
      shortTerm: { events: 0 },
    },
    sharedVersions: 0,
    ownerAgents: 0,
    auditEvents: 0,
    auditHealthy: true,
  } as const;
  const restoredStatus = {
    ...emptyStatus,
    tiers: { ...emptyStatus.tiers, longTerm: { memories: 1, versions: 1, committedVersions: 1 } },
    sharedVersions: 1,
    ownerAgents: 1,
    auditEvents: 2,
  } as const;
  const runtime = new ApplicationSynapxnetMemoryRuntimeService({
    core: { ensureCapability: async () => ({} as never) },
    supervisor: {
      request: async (_capability, method) => {
        if (method === "memory.v3.status") return imported ? restoredStatus : emptyStatus;
        if (method === "memory.v3.import") {
          imported = true;
          importCalls += 1;
          return {
            schema: "openxnet.synapxnet-memory-runtime.v1",
            manifestSha256: digest,
            imported: [{}],
            skipped: 0,
          };
        }
        if (method === "memory.v3.verify") {
          return {
            schema: "openxnet.synapxnet-memory-runtime.v1",
            checkedVersions: 1,
            failures: [],
            recordChainHealthy: true,
            auditChainHealthy: true,
            healthy: true,
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    },
    reconcileTrustedHistory: async () => {
      reconcileCalls += 1;
      return 0;
    },
    bootstrapTransfer: {
      path: transferPath,
      expectedManifestSha256: digest,
    },
  });

  try {
    const recovered = await runtime.recover({ actorAgent: "agent-owner" });
    assert.equal(recovered.source, "bundled-transfer");
    assert.equal(recovered.importedVersions, 1);
    assert.equal(recovered.integrity?.healthy, true);
    const existing = await runtime.recover({ actorAgent: "agent-owner" });
    assert.equal(existing.source, "existing");
    assert.equal(importCalls, 1);
    assert.equal(reconcileCalls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("SynapXnet Memory Runtime incrementally upgrades an existing library once", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "openxnet-memory-upgrade-"));
  const transferPath = path.join(directory, "bootstrap.json");
  await writeFile(transferPath, JSON.stringify({
    schema: "openxnet.synapxnet-memory-transfer.v1",
    manifestSha256: digest,
    entries: [],
  }), "utf8");
  let upgraded = false;
  let importCalls = 0;
  const existingStatus = {
    schema: "openxnet.synapxnet-memory-runtime.v1",
    frameworkVersion: "0.3.0",
    tiers: {
      longTerm: { memories: 3, versions: 3, committedVersions: 3 },
      activeNative: { sessions: 0 },
      shortTerm: { events: 0 },
    },
    sharedVersions: 3,
    ownerAgents: 1,
    auditEvents: 4,
    auditHealthy: true,
  } as const;
  const upgradedStatus = {
    ...existingStatus,
    tiers: { ...existingStatus.tiers, longTerm: { memories: 12, versions: 15, committedVersions: 15 } },
    sharedVersions: 15,
    auditEvents: 17,
  } as const;
  const runtime = new ApplicationSynapxnetMemoryRuntimeService({
    core: { ensureCapability: async () => ({} as never) },
    supervisor: {
      request: async (_capability, method) => {
        if (method === "memory.v3.status") return upgraded ? upgradedStatus : existingStatus;
        if (method === "memory.v3.import") {
          upgraded = true;
          importCalls += 1;
          return {
            schema: "openxnet.synapxnet-memory-runtime.v1",
            manifestSha256: digest,
            imported: Array.from({ length: 12 }, () => ({})),
            skipped: 0,
          };
        }
        if (method === "memory.v3.verify") {
          return {
            schema: "openxnet.synapxnet-memory-runtime.v1",
            checkedVersions: 15,
            failures: [],
            recordChainHealthy: true,
            auditChainHealthy: true,
            healthy: true,
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    },
    bootstrapTransfer: {
      path: transferPath,
      expectedManifestSha256: digest,
    },
  });

  try {
    const recovered = await runtime.recover({ actorAgent: "agent-owner" });
    assert.equal(recovered.source, "bundled-transfer");
    assert.equal(recovered.status.tiers.longTerm.memories, 12);
    const repeated = await runtime.recover({ actorAgent: "agent-owner" });
    assert.equal(repeated.source, "existing");
    assert.equal(importCalls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
