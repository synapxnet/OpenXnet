import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ApplicationMemoryManagementRuntimeService } from "./application-memory-management-runtime";

test("Memory Management Runtime avoids Worker activation for missing collections", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-memory-management-missing-"));
  let activations = 0;
  let requests = 0;
  const runtime = new ApplicationMemoryManagementRuntimeService({
    userDataDirectory: root,
    core: { ensureCapability: async () => { activations += 1; return {} as never; } },
    supervisor: { request: async () => { requests += 1; return {}; } },
  });
  try {
    assert.deepEqual(await runtime.listRecords({ memoryId: "memory123" }), {
      schema: "openxnet.application-memory-management.v1",
      memoryId: "memory123",
      records: [],
    });
    assert.equal((await runtime.removeCollection({ memoryId: "memory123" })).action, "removed");
    assert.equal(activations, 0);
    assert.equal(requests, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Memory Management Runtime validates and forwards stable Worker operations", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-memory-management-runtime-"));
  mkdirSync(path.join(root, "memory_cache", "memory123"), { recursive: true });
  const calls: Array<{ readonly method: string; readonly payload: unknown }> = [];
  let activations = 0;
  const runtime = new ApplicationMemoryManagementRuntimeService({
    userDataDirectory: root,
    core: { ensureCapability: async () => { activations += 1; return {} as never; } },
    supervisor: {
      request: async (_capability, method, payload) => {
        calls.push({ method, payload });
        if (method === "memory.collection.list") {
          return {
            memoryId: "memory123",
            records: [{ recordId: "record1", index: 0, text: "记忆", createdAt: "created", updatedAt: "updated" }],
          };
        }
        const action = method === "memory.collection.update"
          ? "updated"
          : (method === "memory.collection.delete-record" ? "deleted" : "removed");
        return {
          memoryId: "memory123",
          recordId: action === "removed" ? "" : "record1",
          action,
        };
      },
    },
  });
  try {
    assert.equal((await runtime.listRecords({ memoryId: "memory123" })).records[0]?.recordId, "record1");
    assert.equal((await runtime.updateRecord({ memoryId: "memory123", recordId: "record1", text: "新记忆" })).action, "updated");
    assert.equal((await runtime.deleteRecord({ memoryId: "memory123", recordId: "record1" })).action, "deleted");
    assert.equal((await runtime.removeCollection({ memoryId: "memory123" })).action, "removed");
    assert.deepEqual(calls.map((call) => call.method), [
      "memory.collection.list",
      "memory.collection.update",
      "memory.collection.delete-record",
      "memory.collection.remove",
    ]);
    assert.equal(activations, 4);
    await assert.rejects(
      runtime.deleteRecord({ memoryId: "memory123", recordId: "record1", index: 0 }),
      /fields are invalid/i,
    );
    assert.equal(calls.length, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
