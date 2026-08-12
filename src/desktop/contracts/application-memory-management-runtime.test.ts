import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationMemoryCollectionRequest,
  parseApplicationMemoryRecordRequest,
  parseUpdateApplicationMemoryRecordRequest,
} from "./application-memory-management-runtime";

test("Memory Management contract accepts stable IDs and bounded text", () => {
  assert.deepEqual(parseApplicationMemoryCollectionRequest({ memoryId: "memory_123" }), {
    memoryId: "memory_123",
  });
  assert.deepEqual(
    parseApplicationMemoryRecordRequest({ memoryId: "memory_123", recordId: "record-456" }),
    { memoryId: "memory_123", recordId: "record-456" },
  );
  assert.deepEqual(
    parseUpdateApplicationMemoryRecordRequest({
      memoryId: "memory_123",
      recordId: "record-456",
      text: "更新后的记忆",
    }),
    { memoryId: "memory_123", recordId: "record-456", text: "更新后的记忆" },
  );
});

test("Memory Management contract rejects indexes, paths and request drift", () => {
  assert.throws(() => parseApplicationMemoryCollectionRequest({ memoryId: "../outside" }), /invalid/i);
  assert.throws(
    () => parseApplicationMemoryRecordRequest({ memoryId: "memory", recordId: "record", index: 0 }),
    /fields are invalid/i,
  );
  assert.throws(
    () => parseUpdateApplicationMemoryRecordRequest({ memoryId: "memory", recordId: "record", text: "" }),
    /required/i,
  );
});
