import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationRecallObservationFocusRequest,
  parseApplicationRecallObservationsRequest,
  parseApplicationRecallSearchRequest,
  parseApplicationRecallTimelineRequest,
} from "./application-recall-runtime";

test("Recall contract accepts exact bounded search and timeline requests", () => {
  assert.deepEqual(
    parseApplicationRecallSearchRequest({ query: "decision", topK: 8, origin: "manual" }),
    { query: "decision", topK: 8, origin: "manual" },
  );
  assert.deepEqual(
    parseApplicationRecallTimelineRequest({
      query: "",
      taskId: "task-one",
      sessionId: "",
      digest: "",
      depthBefore: 3,
      depthAfter: 4,
      limit: 18,
      origin: "",
    }),
    {
      query: "",
      taskId: "task-one",
      sessionId: "",
      digest: "",
      depthBefore: 3,
      depthAfter: 4,
      limit: 18,
      origin: "",
    },
  );
});

test("Recall contract rejects extra fields, empty observation targets, and focus count drift", () => {
  assert.throws(
    () => parseApplicationRecallSearchRequest({ query: "decision", topK: 8, origin: "", path: "C:/secret" }),
    /fields are invalid/,
  );
  assert.throws(
    () => parseApplicationRecallObservationsRequest({
      taskId: "",
      sessionId: "",
      digest: "",
      query: "",
      limit: 60,
      origin: "",
    }),
    /require one target/,
  );
  assert.throws(
    () => parseApplicationRecallObservationFocusRequest({
      clear: false,
      task_id: "task-one",
      session_id: "",
      digest: "",
      title: "Task one",
      task_title: "Task one",
      target: "recall_center",
      channel: "recall_center",
      summary: "summary",
      detail: "",
      status: "running",
      stage: "trace",
      event_type: "progress",
      source: "recall_center",
      focus_source: "recall_center",
      timestamp: "2026-07-29T00:00:00.000Z",
      observation_count: 2,
      privacy_mode: "public",
      private_segment_count: 0,
      observations: [{ task_id: "task-one" }],
    }),
    /count is invalid/,
  );
  assert.throws(
    () => parseApplicationRecallObservationFocusRequest({
      clear: false,
      task_id: "task-one",
      session_id: "",
      digest: "",
      title: "Task one",
      task_title: "Task one",
      target: "recall_center",
      channel: "recall_center",
      summary: "summary",
      detail: "",
      status: "running",
      stage: "trace",
      event_type: "progress",
      source: "recall_center",
      focus_source: "recall_center",
      timestamp: "2026-07-29T00:00:00.000Z",
      observation_count: 1,
      privacy_mode: "public",
      private_segment_count: 0,
      observations: [{ task_id: "task-one", api_key: "secret" }],
    }),
    /private field/,
  );
});
