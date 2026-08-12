import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPETITION_MCP_PROTOCOL_VERSION,
  CompetitionMcpGateway,
} from "./competition-mcp-gateway";

const TEST_TOKEN = "competition-mcp-test-token-00000000";

/** 构建现代 MCP 请求元数据；无输入，返回固定协议版本和客户端能力。 */
function requestMeta(): Readonly<Record<string, unknown>> {
  return {
    "io.modelcontextprotocol/protocolVersion": COMPETITION_MCP_PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientInfo": { name: "gateway-test", version: "1.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
}

/** 发送一次 MCP JSON-RPC；输入 origin、token、method、params 和可选 Header，返回 Fetch Response。 */
function requestMcp(
  origin: string,
  token: string,
  method: string,
  params: Readonly<Record<string, unknown>>,
  headers: Readonly<Record<string, string>> = {},
): Promise<Response> {
  return fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": COMPETITION_MCP_PROTOCOL_VERSION,
      "Mcp-Method": method,
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: `${method}-1`, method, params: { ...params, _meta: requestMeta() } }),
  });
}

test("competition MCP Gateway discovers, filters, calls and reads resources with strict headers", async () => {
  const toolCalls: unknown[] = [];
  const runtime = {
    callTool: async (request: unknown) => {
      toolCalls.push(request);
      if ((request as { toolName?: string }).toolName === "aiops.service.health") {
        throw Object.assign(new Error("Trace 不属于当前事件。"), { code: "TRACE_SCOPE_MISMATCH" });
      }
      return {
        incidentId: "inc-mcp-1",
        traceId: "trace-mcp-1",
        evidenceId: "ev-mcp-1",
        actionId: null,
        response: {
          success: true,
          data: { alertUid: "alert-risk", status: "FIRING" },
          error: null,
          meta: {
            requestId: "req-mcp-1",
            workspaceId: "ws_goai_demo",
            incidentId: "inc-mcp-1",
            traceId: "trace-mcp-1",
            toolName: "aiops.alert.get",
            contractVersion: "1.0.0",
            durationMs: 7,
            source: "XnetAIops/mon",
            evidenceId: "ev-mcp-1",
            platform: "aiops",
            resourceVersion: "18",
            observedAt: "2026-08-03T02:00:00.000Z",
            summary: "告警仍在触发。",
          },
        },
      };
    },
    getSnapshot: async () => ({
      schema: "openxnet.competition-runtime.v1",
      adapterMode: "fixture",
      incidents: [],
      traces: [],
      invocations: [],
      evidence: [],
      approvals: [],
      actions: [],
      auditReceipts: [],
      teamBindings: [],
      updatedAt: "2026-08-03T02:00:00.000Z",
    }),
    readResource: async ({ uri }: { uri: string }) => ({
      uri,
      mimeType: "application/json",
      text: "{\"status\":\"RUNNING\"}",
    }),
  };
  const gateway = new CompetitionMcpGateway({
    token: TEST_TOKEN,
    principal: {
      actorId: "mcp-test-actor",
      workspaceId: "ws_goai_demo",
      scopes: [
        "openxnet:mcp:discover",
        "openxnet:tools:list",
        "openxnet:resources:read",
        "aiops:evidence:read",
        "mlops:probe:execute",
      ],
    },
    runtime: runtime as never,
  });
  const origin = await gateway.start();
  try {
    const unauthorized = await requestMcp(origin, "wrong-token", "server/discover", {});
    assert.equal(unauthorized.status, 401);

    const discover = await requestMcp(origin, TEST_TOKEN, "server/discover", {});
    assert.equal(discover.status, 200);
    const discoverBody = await discover.json() as { result: { supportedVersions: readonly string[] } };
    assert.deepEqual(discoverBody.result.supportedVersions, [COMPETITION_MCP_PROTOCOL_VERSION]);

    const tools = await requestMcp(origin, TEST_TOKEN, "tools/list", {});
    assert.equal(tools.status, 200);
    const toolsBody = await tools.json() as { result: { tools: readonly { name: string }[] } };
    assert.deepEqual(toolsBody.result.tools.map((tool: { name: string }) => tool.name), [
      "aiops.alert.get",
      "aiops.inference.metrics.get",
      "aiops.inference.recovery.status",
      "aiops.k8s.workload.get",
      "aiops.service.health",
      "mlops.inference.probe",
    ]);
    assert.equal(toolsBody.result.tools.some((tool) => tool.name === "aiops.inference.capacity.apply"), false);
    assert.equal(toolsBody.result.tools.some((tool) => tool.name === "mlops.model.iteration.start"), false);

    const mismatch = await requestMcp(
      origin,
      TEST_TOKEN,
      "tools/call",
      { name: "aiops.alert.get", arguments: { alertUid: "alert-risk" } },
      { "Mcp-Name": "aiops.service.health" },
    );
    assert.equal(mismatch.status, 400);
    const mismatchBody = await mismatch.json() as { error: { code: number } };
    assert.equal(mismatchBody.error.code, -32020);

    const call = await requestMcp(
      origin,
      TEST_TOKEN,
      "tools/call",
      { name: "aiops.alert.get", arguments: { alertUid: "alert-risk" } },
      { "Mcp-Name": "aiops.alert.get" },
    );
    assert.equal(call.status, 200);
    const callBody = await call.json() as {
      result: {
        structuredContent: {
          success: boolean;
          data: unknown;
          meta: { contractVersion: string; durationMs: number; source: string; evidenceId: string };
        };
        content: readonly { type: string }[];
      };
    };
    assert.equal(callBody.result.structuredContent.success, true);
    assert.equal(callBody.result.structuredContent.meta.contractVersion, "1.0.0");
    assert.equal(callBody.result.structuredContent.meta.durationMs, 7);
    assert.equal(callBody.result.structuredContent.meta.source, "XnetAIops/mon");
    assert.equal(callBody.result.structuredContent.meta.evidenceId, "ev-mcp-1");
    assert.equal(callBody.result.content[1]?.type, "resource_link");
    assert.equal(toolCalls.length, 1);

    const domainError = await requestMcp(
      origin,
      TEST_TOKEN,
      "tools/call",
      { name: "aiops.service.health", arguments: { serviceUid: "svc-risk" } },
      { "Mcp-Name": "aiops.service.health" },
    );
    const domainErrorBody = await domainError.json() as {
      result: { structuredContent: { data: unknown; error: { code: string }; meta: { contractVersion: string } } };
    };
    assert.equal(domainErrorBody.result.structuredContent.data, null);
    assert.equal(domainErrorBody.result.structuredContent.error.code, "PERMISSION_DENIED");
    assert.equal(domainErrorBody.result.structuredContent.meta.contractVersion, "1.0.0");

    const templates = await requestMcp(origin, TEST_TOKEN, "resources/templates/list", {});
    const templatesBody = await templates.json() as {
      result: { resourceTemplates: readonly { uriTemplate: string }[] };
    };
    assert.equal(
      templatesBody.result.resourceTemplates[0]?.uriTemplate,
      "openxnet://workspaces/{workspaceId}/incidents/{incidentId}/traces/{traceId}",
    );

    const probe = await requestMcp(
      origin,
      TEST_TOKEN,
      "tools/call",
      {
        name: "mlops.inference.probe",
        arguments: {
          deploymentUid: "deployment-risk",
          testDatasetRef: "dataset://risk-smoke",
          sampleLimit: 10,
        },
      },
      { "Mcp-Name": "mlops.inference.probe", Accept: "text/event-stream" },
    );
    assert.equal(probe.status, 200);
    assert.match(probe.headers.get("content-type") ?? "", /^text\/event-stream/u);
    const probeBody = await probe.text();
    assert.match(probeBody, /"method":"notifications\/progress"/u);
    assert.match(probeBody, /"id":"tools\/call-1","result":/u);

    const uri = "openxnet://workspaces/ws_goai_demo/actions/action-mcp-1";
    const resource = await requestMcp(
      origin,
      TEST_TOKEN,
      "resources/read",
      { uri },
      { "Mcp-Name": uri },
    );
    assert.equal(resource.status, 200);
    const resourceBody = await resource.json() as { result: { contents: readonly { text: string }[] } };
    assert.equal(resourceBody.result.contents[0]?.text, "{\"status\":\"RUNNING\"}");
  } finally {
    await gateway.stop();
  }
});

test("competition MCP Gateway projects the canonical plan-level audit receipt", async () => {
  const runtime = {
    callTool: async () => ({
      incidentId: "inc-mcp-write",
      traceId: "trace-mcp-write",
      evidenceId: "ev-mcp-write",
      actionId: "action-mcp-write",
      response: {
        success: true,
        data: { actionId: "action-mcp-write", status: "SUCCEEDED" },
        error: null,
        meta: {
          requestId: "req-mcp-write",
          workspaceId: "ws_goai_demo",
          incidentId: "inc-mcp-write",
          traceId: "trace-mcp-write",
          toolName: "mlops.deployment.rollback",
          contractVersion: "1.0.0",
          durationMs: 11,
          source: "XnetMLops/model-lifecycle",
          evidenceId: "ev-mcp-write",
          platform: "mlops",
          resourceVersion: "43",
          observedAt: "2026-08-03T02:00:01.000Z",
          summary: "预先审批的部署回滚已执行。",
        },
      },
    }),
    getSnapshot: async () => ({
      approvals: [{
        approvalId: "apr-mcp-write",
        argumentsDigest: "b".repeat(64),
        requestedBy: "leader",
        decidedBy: "approver",
      }],
      actions: [{
        actionId: "action-mcp-write",
        incidentId: "inc-mcp-write",
        approvalId: "apr-mcp-write",
        idempotencyKey: "idem-mcp-write",
        resourceId: "deploy_risk_prod",
        toolName: "mlops.deployment.rollback",
        status: "SUCCEEDED",
        verificationEvidenceIds: ["ev-mcp-write"],
        createdAt: "2026-08-03T02:00:00.000Z",
      }],
      auditReceipts: [{
        receiptId: "receipt-mcp-write",
        requestId: "req-mcp-write",
        workspaceId: "ws_goai_demo",
        incidentId: "inc-mcp-write",
        traceId: "trace-mcp-write",
        toolName: "mlops.deployment.rollback",
        actorId: "operator",
        approvalId: "apr-mcp-write",
        idempotencyKey: "idem-mcp-write",
        resourceVersionBefore: "42",
        resourceVersionAfter: "43",
        outcome: "SUCCEEDED",
        recordedAt: "2026-08-03T02:00:01.000Z",
      }],
    }),
    readResource: async () => { throw new Error("Resource reads are not expected."); },
  };
  const gateway = new CompetitionMcpGateway({
    token: TEST_TOKEN,
    principal: {
      actorId: "operator",
      workspaceId: "ws_goai_demo",
      scopes: ["mlops:deployment:rollback"],
    },
    runtime: runtime as never,
  });
  const origin = await gateway.start();
  try {
    const response = await requestMcp(
      origin,
      TEST_TOKEN,
      "tools/call",
      {
        name: "mlops.deployment.rollback",
        arguments: {
          deploymentUid: "deploy_risk_prod",
          targetRevision: 17,
          verificationPolicy: { maxErrorRate: 0.02, maxP95Ms: 500 },
          governance: {
            approvalId: "apr-mcp-write",
            planId: "feature-drift-full-recovery-v2",
            planDigest: "a".repeat(64),
            stepId: "deployment-rollback",
            resourceId: "deploy_risk_prod",
            targetRevision: 17,
            expectedResourceVersion: "42",
            argumentsDigest: "b".repeat(64),
            compensation: true,
            reason: "独立验证未通过，执行预先审批的部署回滚。",
            dryRun: false,
            idempotencyKey: "idem-mcp-write",
          },
        },
      },
      { "Mcp-Name": "mlops.deployment.rollback" },
    );
    assert.equal(response.status, 200);
    const body = await response.json() as {
      result: { structuredContent: { auditReceipt: Record<string, unknown> } };
    };
    const receipt = body.result.structuredContent.auditReceipt;
    assert.equal(receipt.approverId, "approver");
    assert.equal(receipt.actionId, "action-mcp-write");
    assert.equal(receipt.actionStatus, "SUCCEEDED");
    assert.equal(receipt.beforeResourceVersion, "42");
    assert.equal(receipt.afterResourceVersion, "43");
    assert.equal(Object.hasOwn(receipt, "riskLevel"), false);
    assert.equal(Object.hasOwn(receipt, "targetResource"), false);
  } finally {
    await gateway.stop();
  }
});
