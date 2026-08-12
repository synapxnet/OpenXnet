import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationRecallRuntimeService } from "./application-recall-runtime";

/** 创建含调用轨迹的 Recall Runtime；无输入，返回服务和测试记录。 */
function createFixture() {
  const methods: string[] = [];
  const payloads: Readonly<Record<string, unknown>>[] = [];
  const ensured: string[] = [];
  const published: unknown[] = [];
  const responses: Record<string, Readonly<Record<string, unknown>>> = {
    "recall.bootstrap": {
      interrupted: [],
      turns: [],
      checkpoints: [],
      decisions: [],
      versions: [],
      overview: { workspace: "C:/workspace", stats: {} },
    },
    "recall.search": {
      query: "decision",
      results: [{ text: "remembered", score: 1 }],
      count: 1,
      sources: ["session_memory"],
    },
  };
  const service = new ApplicationRecallRuntimeService({
    core: {
      /** 记录能力激活；输入 capability ID，返回无关测试值。 */
      async ensureCapability(capabilityId) {
        ensured.push(capabilityId);
        return {} as never;
      },
    },
    supervisor: {
      /** 记录 Worker 请求；输入能力、方法和 payload，返回按方法配置的测试响应。 */
      async request(_capability, method, payload) {
        methods.push(method);
        payloads.push(payload ?? {});
        const response = responses[method];
        if (response === undefined) throw new Error("Missing test response.");
        return response;
      },
    },
    getScope: () => ({ workspaceDirectory: "C:/workspace", providerName: "session_store" }),
    publishObservationFocus: (request) => {
      published.push(request);
      return 2;
    },
  });
  return { service, methods, payloads, ensured, published, responses };
}

test("Recall Runtime injects Main-owned scope and returns typed bounded results", async () => {
  const { service, methods, payloads, ensured } = createFixture();
  const bootstrap = await service.bootstrap();
  const searched = await service.search({ query: "decision", topK: 8, origin: "" });

  assert.equal(bootstrap.schema, "openxnet.recall-bootstrap.v1");
  assert.equal(searched.results[0]?.text, "remembered");
  assert.deepEqual(methods, ["recall.bootstrap", "recall.search"]);
  assert.deepEqual(ensured, ["memory", "memory"]);
  assert.deepEqual(payloads[1], {
    workspaceDirectory: "C:/workspace",
    providerName: "session_store",
    query: "decision",
    topK: 8,
    origin: "",
  });
});

test("Recall Runtime rejects private Worker fields and publishes focus without Python activation", async () => {
  const { service, responses, ensured, published } = createFixture();
  responses["recall.search"] = {
    query: "decision",
    results: [{ text: "remembered", snapshot_path: "C:/private/snapshot" }],
    count: 1,
    sources: [],
  };
  await assert.rejects(
    service.search({ query: "decision", topK: 8, origin: "" }),
    /private field/,
  );
  ensured.length = 0;
  const result = service.publishObservationFocus({
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
    observations: [{ task_id: "task-one" }],
  });

  assert.equal(result.delivered, 2);
  assert.equal(published.length, 1);
  assert.deepEqual(ensured, []);
});
