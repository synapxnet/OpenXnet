/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Live 网关协议与审批边界测试 / Live gateway protocol and approval boundary tests.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ReadableStream } from "node:stream/web";
import type { ApplicationCompetitionApproval } from "../contracts/application-competition-runtime";
import { HttpCompetitionApprovalPublisher } from "./competition-approval-publisher";
import { HttpCompetitionToolAdapter, type CompetitionToolAdapterRequest } from "./competition-tool-adapter";

const ACCESS_CODE = `oxlive_${"a".repeat(64)}`;
const REQUEST: CompetitionToolAdapterRequest = {
  requestId: "req-live-read", workspaceId: "workspace-live", incidentId: "incident-live", traceId: "trace-live",
  actorId: "evidence-worker", toolName: "aiops.service.health", arguments: { serviceUid: "service-live" }, governance: null,
};

/** 构造同一执行上下文的公共工具响应。 / Build a public tool response for the same execution context. */
function toolResponse(request: CompetitionToolAdapterRequest = REQUEST): Record<string, unknown> {
  return {
    success: true, data: { status: "HEALTHY" }, error: null, auditReceipt: null,
    meta: { requestId: request.requestId, workspaceId: request.workspaceId, incidentId: request.incidentId,
      traceId: request.traceId, toolName: request.toolName, contractVersion: "1.0.0", durationMs: 3,
      source: "real-platform", observedAt: "2026-09-17T00:00:00Z", resourceVersion: "43", summary: "健康 / Healthy" },
  };
}

/** 用注入网络检查真正的网关路径，禁止退回平台直连。 / Inspect real gateway paths with injected network and prohibit direct platform fallback. */
function adapter(fetchResource: typeof fetch, accessCode = ACCESS_CODE): HttpCompetitionToolAdapter {
  return new HttpCompetitionToolAdapter({
    /** 网关启用时不得读取旧平台地址。 / The gateway must never read a legacy platform endpoint. */
    async resolveEndpoint() { throw new Error("Unexpected direct platform endpoint"); },
    /** 网关启用时不得读取平台原始委托。 / The gateway must never read a raw platform delegation. */
    async resolveDelegationToken() { throw new Error("Unexpected platform credential"); },
    gateway: {
      /** 保留部署在子目录内的网关地址。 / Preserve a gateway deployed under a path prefix. */
      async resolveEndpoint() { return "https://gateway.example/nested/adapter"; },
      /** 返回测试用限权授权，不接触真实秘密。 / Return a scoped test authorization without real secrets. */
      async resolveAccessCode() { return accessCode; },
    }, fetchResource,
  });
}

test("gateway invoke preserves prefix context and read-only governance with a scoped credential",
  /** 检查完整只读请求和限权认证。 / Inspect the complete read-only request and scoped authentication. */
  async () => {
    let calls = 0;
    const instance = adapter(
      /** 校验网络请求并返回已关联平台结果。 / Verify the network request and return the correlated platform result. */
      async (url, init) => {
        calls++;
        assert.equal(String(url), "https://gateway.example/nested/adapter/api/v1/live/tools/invoke");
        assert.equal(init?.method, "POST");
        assert.equal(init?.redirect, "manual");
        assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${ACCESS_CODE}`);
        assert.deepEqual(JSON.parse(String(init?.body)), REQUEST);
        return new Response(JSON.stringify(toolResponse()));
      });
    const result = await instance.invoke(REQUEST);
    assert.equal(result.success, true);
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes(ACCESS_CODE), false);
  });

test("gateway mode rejects Fixture and raw issuer credentials before any network access",
  /** 模式隔离不能由服务地址替换绕过。 / Endpoint replacement cannot bypass mode isolation. */
  async () => {
    for (const code of [`oxdemo_${"a".repeat(64)}`, "raw-issuer-secret-with-more-than-thirty-two-characters"]) {
      let calls = 0;
      const instance = adapter(
        /** 记录任何不应发生的网络调用。 / Record network calls that must never happen. */
        async () => { calls++; return new Response("{}"); }, code);
      await assert.rejects(instance.invoke(REQUEST), /Live access is invalid/);
      assert.equal(calls, 0);
    }
  });

test("gateway cannot accept a successful response from another workspace",
  /** 服务器成功标记不能替代上下文关联。 / A server success flag cannot replace context correlation. */
  async () => {
    const instance = adapter(
      /** 故意返回其他工作空间的响应。 / Deliberately return a response for another workspace. */
      async () => new Response(JSON.stringify(toolResponse({ ...REQUEST, workspaceId: "other-workspace" }))));
    await assert.rejects(instance.invoke(REQUEST), /context is inconsistent/);
  });

test("gateway still rejects missing or mismatched governed write receipts",
  /** 成功写入必须有匹配的审批和版本回执。 / Successful writes require a matching approval and version receipt. */
  async () => {
    const request: CompetitionToolAdapterRequest = { ...REQUEST, toolName: "mlops.feature.fallback.apply",
      arguments: { deploymentUid: "deploy-live", featureSetUid: "features-live", reasonCode: "drift-recovery" },
      governance: { approvalId: "approval-live", planId: "plan-live", planDigest: "a".repeat(64), stepId: "step-live",
        resourceId: "resource-live", targetRevision: 2, expectedResourceVersion: "42", argumentsDigest: "b".repeat(64),
        compensation: false, reason: "人工批准 / Human approved", dryRun: false, idempotencyKey: "idem-live" } };
    const value = toolResponse(request);
    const instance = adapter(
      /** 返回表面成功但缺失回执的结果。 / Return apparent success without a governed receipt. */
      async () => new Response(JSON.stringify(value)));
    await assert.rejects(instance.invoke(request), /governed receipt is missing/);
    value.auditReceipt = { requestId: request.requestId, workspaceId: "wrong-workspace", incidentId: request.incidentId,
      traceId: request.traceId, toolName: request.toolName, actorId: request.actorId, approvalId: request.governance?.approvalId,
      requestDigest: request.governance?.argumentsDigest, beforeResourceVersion: "42", afterResourceVersion: "43",
      approverId: "human-approver", actionStatus: "SUCCEEDED" };
    await assert.rejects(instance.invoke(request), /receipt does not match/);
    (value.auditReceipt as Record<string, unknown>).workspaceId = request.workspaceId;
    assert.equal((await instance.invoke(request)).success, true);
  });

test("gateway action polling sends full context to the fixed read route",
  /** 异步状态读取保留同一工作空间和原请求。 / Async status reads retain the original request and workspace. */
  async () => {
    const instance = adapter(
      /** 检查只读动作请求，模拟已完成状态。 / Check the read-only action request and simulate completion. */
      async (url, init) => {
        assert.equal(String(url), "https://gateway.example/nested/adapter/api/v1/live/actions/read");
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init?.body)), { request: REQUEST, actionId: "act_12345678" });
        return new Response(JSON.stringify({ actionId: "act_12345678", status: "SUCCEEDED", stage: "DONE", errorCode: null, errorMessage: null }));
      });
    assert.equal((await instance.waitForAction(REQUEST, "act_12345678")).status, "SUCCEEDED");
    await assert.rejects(instance.waitForAction(REQUEST, "../../other"), /action ID is invalid/);
  });

test("gateway rejects redirects and cancels oversized streams",
  /** 限制网络重定向和流式响应预算。 / Bound redirects and streaming response budgets. */
  async () => {
    const redirect = adapter(
      /** 模拟跳转到另一个主机。 / Simulate a redirect to another host. */
      async () => new Response(null, { status: 307, headers: { location: "https://other.example" } }));
    await assert.rejects(redirect.invoke(REQUEST), /redirects are not allowed/);
    let cancelled = false;
    const overlong = adapter(
      /** 模拟无限超大响应。 / Simulate an unbounded oversized response. */
      async () => new Response(new ReadableStream<Uint8Array>({
        /** 发送大数据块以触发预算。 / Emit large chunks to exceed the budget. */
        pull(controller): void { controller.enqueue(new Uint8Array(1024 * 1024)); },
        /** 记录预算耗尽后的取消。 / Record cancellation when the budget is exhausted. */
        cancel(): void { cancelled = true; },
      })));
    await assert.rejects(overlong.invoke(REQUEST), /response is too large/);
    assert.equal(cancelled, true);
  });

/** 创建已人工批准且作用域固定的审批记录。 / Create a human-approved record with a fixed scope. */
function approval(): ApplicationCompetitionApproval {
  return { approvalId: "approval-live", workspaceId: "workspace-live", incidentId: "incident-live", traceId: "trace-live",
    toolName: "mlops.feature.fallback.apply", resourceId: "resource-live", targetRevision: 2, expectedResourceVersion: "42",
    argumentsDigest: "a".repeat(64), planId: "plan-live", planDigest: "b".repeat(64),
    scopes: [{ stepId: "step-live", toolName: "mlops.feature.fallback.apply", resourceId: "resource-live", targetRevision: 2,
      expectedResourceVersion: "42", argumentsDigest: "a".repeat(64), compensation: false }],
    reason: "修复 / Repair", status: "APPROVED", requestedBy: "worker", requestedAt: "2026-09-17T00:00:00Z",
    decidedBy: "human", decidedAt: "2026-09-17T00:01:00Z", decisionReason: "批准 / Approved" };
}

test("gateway approval publishes approved scope without exposing a signing secret",
  /** 检查固定网关路径和短期审批内容。 / Verify the fixed gateway path and short-lived approval content. */
  async () => {
    let calls = 0;
    const publisher = new HttpCompetitionApprovalPublisher({ gatewayMode: true,
      /** 提供带前缀的执行服务地址。 / Supply an execution service address with a prefix. */
      async resolveEndpoint() { return "https://gateway.example/nested/adapter/"; },
      /** 仅提供限权测试凭证。 / Provide only a scoped test credential. */
      async resolveIssuerToken() { return ACCESS_CODE; },
      /** 固定测试时间以验证过期逻辑。 / Fix test time for expiry validation. */
      now: () => new Date("2026-09-17T00:02:00Z"),
      /** 检查审批发布内容。 / Inspect approval publication content. */
      async fetchResource(url, init) {
        calls++;
        assert.equal(String(url), "https://gateway.example/nested/adapter/api/v1/live/approvals/approval-live");
        assert.equal(init?.method, "PUT");
        assert.equal(init?.redirect, "manual");
        assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${ACCESS_CODE}`);
        const payload = JSON.parse(String(init?.body));
        assert.equal(payload.workspaceId, "workspace-live");
        assert.equal(payload.approverId, "human");
        assert.deepEqual(payload.scopes, approval().scopes);
        assert.equal(String(init?.body).includes(ACCESS_CODE), false);
        return new Response("{}");
      },
    });
    await publisher.publish(approval());
    await assert.rejects(publisher.publish({ ...approval(), status: "PENDING" }), /has not been approved/);
    assert.equal(calls, 1);
  });
