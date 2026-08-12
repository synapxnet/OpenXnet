import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { ApplicationEnterpriseInsightsRuntimeService } from "./application-enterprise-insights-runtime";

/** 创建兼容用量数据库；输入文件路径，写入两条确定性记录，失败时抛错。 */
function seedUsageDatabase(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE usage_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        conversation_id TEXT,
        user_id TEXT,
        model TEXT,
        provider TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_tokens INTEGER,
        cache_creation_tokens INTEGER,
        total_tokens INTEGER,
        cost_usd REAL,
        duration_ms INTEGER,
        engine TEXT,
        request_type TEXT,
        success INTEGER
      );
      INSERT INTO usage_records VALUES
        ('one', '2026-07-28 10:00:00', 'c1', 'alice', 'model-a', 'provider-a', 10, 5, 2, 1, 15, 0.01, 120, 'local', 'chat', 1),
        ('two', '2026-07-29 11:00:00', 'c2', 'bob', 'model-b', 'provider-b', 20, 8, 3, 0, 28, 0.02, 180, 'local', 'chat', 0);
    `);
  } finally {
    database.close();
  }
}

/** 启动确定性私有洞察引擎；输入 token，返回 origin、请求记录和关闭函数，绑定失败时抛错。 */
async function startInsightsEngine(token: string): Promise<{
  readonly origin: string;
  readonly requests: Array<{ readonly path: string; readonly authorization: string; readonly body: unknown }>;
  readonly close: () => Promise<void>;
}> {
  const requests: Array<{ path: string; authorization: string; body: unknown }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    const requestPath = String(request.url || "");
    requests.push({
      path: requestPath,
      authorization: String(request.headers.authorization || ""),
      body,
    });
    let payload: unknown;
    if (requestPath.endsWith("/neuro/dashboard")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        stats: { totalSymbols: 1, uniqueEntities: 1, avgSuccessRate: 0.9, competitionSymbols: 0, operatorDistribution: { CausalInfer: 1 } },
        symbols: [{
          id: "symbol-one",
          operator: "CausalInfer",
          label: "架构迁移",
          K: { entities: ["OpenXnet"] },
          metadata: {
            sourceType: "",
            recordType: "",
            workspaceId: "",
            incidentId: "",
            traceId: "",
            stage: "",
            decision: "",
            teamRole: "",
            agentName: "",
            skillName: "",
            skillVersion: "",
            confidence: 0,
          },
          createdAt: 1_700_000_000,
          successRate: 0.9,
          activationCount: 2,
        }],
        total: 1,
        rules: [{
          id: "rule-one",
          name: "Rule",
          domain: "test",
          description: "测试规则",
          bound_operator: "CausalInfer",
          enabled: true,
        }],
      };
    } else if (requestPath.endsWith("/neuro/search")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        symbols: [{
          id: "symbol-one",
          operator: "CausalInfer",
          label: "架构迁移",
          K: { entities: ["OpenXnet"] },
          metadata: {
            sourceType: "",
            recordType: "",
            workspaceId: "",
            incidentId: "",
            traceId: "",
            stage: "",
            decision: "",
            teamRole: "",
            agentName: "",
            skillName: "",
            skillVersion: "",
            confidence: 0,
          },
          createdAt: 1_700_000_000,
          successRate: 0.9,
          activationCount: 2,
        }],
        total: 1,
      };
    } else if (requestPath.endsWith("/neuro/remove")) {
      payload = { schema: "openxnet.enterprise-insights.v1", success: true, symbolId: body.symbol_id };
    } else if (requestPath.endsWith("/neuro/maintenance")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        result: { decayed: 1, pruned: 0, protected: 0, remaining: 1, timestamp: "2026-07-29T12:00:00" },
      };
    } else if (requestPath.endsWith("/kg/dashboard")) {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        stats: {
          entities: 2,
          triples: 1,
          active_triples: 1,
          expired_triples: 0,
          competition_triples: 0,
          active_competition_triples: 0,
        },
        graph: {
          nodes: [
            { id: "openxnet", label: "OpenXnet", type: "product", degree: 1 },
            { id: "electron", label: "Electron", type: "runtime", degree: 1 },
          ],
          edges: [{ id: "edge-one", source: "openxnet", target: "electron", label: "uses", confidence: 0.95, current: true, source_type: "manual" }],
        },
      };
    } else if (requestPath.includes("/competition/")) {
      payload = {
        schema: "openxnet.competition-knowledge.v1",
        success: true,
        symbols: requestPath.endsWith("/sync") ? 1 : 0,
        activeFacts: requestPath.endsWith("/sync") ? 8 : 0,
        invalidatedFacts: requestPath.endsWith("/purge") ? 8 : 0,
      };
    } else {
      payload = {
        schema: "openxnet.enterprise-insights.v1",
        success: true,
        subject: body.subject,
        facts: [{
          direction: "outgoing",
          subject: "OpenXnet",
          predicate: "uses",
          object: "Electron",
          valid_from: "",
          valid_to: "",
          confidence: 0.95,
          current: true,
          source_type: "manual",
        }],
      };
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": encoded.length });
    response.end(encoded);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Insights test engine did not bind.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("Enterprise Insights reads Usage in Main without activating Python", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-usage-"));
  seedUsageDatabase(path.join(root, "usage_tracking.db"));
  let acquisitions = 0;
  const runtime = new ApplicationEnterpriseInsightsRuntimeService({
    userDataDirectory: root,
    token: "enterprise-insights-test-token",
    acquireEngine: async () => {
      acquisitions += 1;
      throw new Error("Usage must not activate the engine.");
    },
  });
  try {
    const dashboard = await runtime.loadUsageDashboard({ groupBy: "day", limit: 14 });
    assert.equal(dashboard.summary.total_requests, 2);
    assert.equal(dashboard.summary.total_tokens, 43);
    assert.equal(dashboard.trend.length, 2);
    assert.equal(dashboard.models[0]?.model, "model-b");
    assert.equal(dashboard.users[0]?.user_id, "bob");
    assert.equal(acquisitions, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Enterprise Insights validates and forwards Neuro and KG through request leases", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-enterprise-insights-"));
  const token = "enterprise-insights-test-token";
  const engine = await startInsightsEngine(token);
  let acquisitions = 0;
  let releases = 0;
  const runtime = new ApplicationEnterpriseInsightsRuntimeService({
    userDataDirectory: root,
    token,
    acquireEngine: async () => {
      acquisitions += 1;
      return { origin: engine.origin, release: () => { releases += 1; } };
    },
  });
  try {
    assert.equal((await runtime.loadNeuroDashboard({ limit: 100 })).stats.totalSymbols, 1);
    assert.equal((await runtime.searchNeuroSymbols({ query: "架构", operator: "CausalInfer", limit: 50 })).total, 1);
    assert.equal((await runtime.removeNeuroSymbol({ symbolId: "symbol-one" })).symbolId, "symbol-one");
    assert.equal((await runtime.runNeuroMaintenance()).result.decayed, 1);
    assert.equal((await runtime.loadKnowledgeGraph({ limit: 200 })).graph.edges[0]?.label, "uses");
    assert.equal((await runtime.queryKnowledgeGraphEntity({ subject: "OpenXnet", limit: 50 })).facts[0]?.object, "Electron");
    const projection = {
      schema: "openxnet.competition-knowledge.v1",
      projectedAt: "2026-08-05T10:00:00.000Z",
      incident: {
        incidentId: "inc-one",
        workspaceId: "ws-one",
        title: "测试事件",
        summary: "测试摘要",
        severity: "HIGH",
      status: "OPEN",
      scenarioType: "feature-drift",
        serviceUid: "service-one",
        assetUid: "asset-one",
        workflowInstanceUid: "workflow-one",
        deploymentUid: "deployment-one",
        failingRevision: 18,
        targetRevision: 17,
        createdAt: "2026-08-05T10:00:00.000Z",
        updatedAt: "2026-08-05T10:00:00.000Z",
        resolvedAt: null,
      },
      traces: [],
      teams: [],
      decisions: [],
      invocations: [],
      evidence: [],
      approvals: [],
      actions: [],
      receipts: [],
      retrospective: null,
    } as const;
    assert.equal((await runtime.synchronizeCompetitionKnowledge(projection)).activeFacts, 8);
    assert.equal((await runtime.purgeCompetitionKnowledge({
      schema: "openxnet.competition-knowledge.v1",
      projections: [{ workspaceId: "ws-one", incidentId: "inc-one" }],
    })).invalidatedFacts, 8);
    assert.equal(acquisitions, 8);
    assert.equal(releases, 8);
    assert.ok(engine.requests.every((request) => request.authorization === `Bearer ${token}`));
    assert.deepEqual(engine.requests.map((request) => request.path), [
      "/v1/desktop/enterprise-insights/neuro/dashboard",
      "/v1/desktop/enterprise-insights/neuro/search",
      "/v1/desktop/enterprise-insights/neuro/remove",
      "/v1/desktop/enterprise-insights/neuro/maintenance",
      "/v1/desktop/enterprise-insights/kg/dashboard",
      "/v1/desktop/enterprise-insights/kg/query",
      "/v1/desktop/enterprise-insights/competition/sync",
      "/v1/desktop/enterprise-insights/competition/purge",
    ]);
  } finally {
    await engine.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Enterprise Insights rejects malformed requests before engine activation", async () => {
  let acquisitions = 0;
  const runtime = new ApplicationEnterpriseInsightsRuntimeService({
    userDataDirectory: os.tmpdir(),
    token: "enterprise-insights-test-token",
    acquireEngine: async () => {
      acquisitions += 1;
      throw new Error("must not activate");
    },
  });
  await assert.rejects(runtime.searchNeuroSymbols({ query: "x", operator: "", limit: 1, path: "C:\\private" }), /fields/i);
  await assert.rejects(runtime.removeNeuroSymbol({ symbolId: "rule-temporal-knowledge-v1" }), /invalid/i);
  await assert.rejects(runtime.queryKnowledgeGraphEntity({ subject: "", limit: 50 }), /required/i);
  assert.equal(acquisitions, 0);
});
