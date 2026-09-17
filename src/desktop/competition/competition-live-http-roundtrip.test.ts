/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 桌面与 Live 服务本机 HTTP 对接验收 / Desktop and Live service local HTTP contract acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import test from "node:test";
import type { ApplicationCompetitionApproval } from "../contracts/application-competition-runtime";
import { ApplicationCompetitionLiveConnectionService } from "./application-competition-live-connection";
import { HttpCompetitionApprovalPublisher } from "./competition-approval-publisher";
import { HttpCompetitionToolAdapter, type CompetitionToolAdapterRequest } from "./competition-tool-adapter";

const servicePath = path.join(process.cwd(), "services/openxnet-agentteams-adapter/src");
const { LiveAccessGrantStore, canonical, digest } = require(path.join(servicePath, "live-access-store"));
const { LiveGateway, planScopes } = require(path.join(servicePath, "live-gateway"));
const { createApplication } = require(path.join(servicePath, "server"));
const { teamName } = require(path.join(servicePath, "agentteams-cli"));

test("desktop connection tool approval and action adapters roundtrip through the real local HTTP gateway",
  /** 使用真实服务路由和桌面类，所有平台与团队结果仅为隔离测试。 / Use actual server routes and desktop classes with isolated platform and team results only. */
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), "openxnet-live-http-"));
    t.after(/** 只清除此测试唯一临时目录。 / Remove only this test's unique temporary directory. */ () => rm(directory, { recursive: true, force: true }));
    const now = new Date("2026-09-17T09:00:00Z");
    const store = new LiveAccessGrantStore(path.join(directory, "grants.json"), {
      /** 固定服务时间便于核对期限。 / Fix server time for expiry checks. */ now: () => now,
    });
    const grant = await store.issue({ label: "Local HTTP contract", workspaceId: "workspace-1", expiresInSeconds: 3600, maximumRequests: 80,
      actorIds: ["agentteams:leader", "agentteams:worker", "agentteams:verifier", "operator"], approverIds: ["human-approver"],
      allowedTools: ["aiops.service.health", "mlops.feature.fallback.apply", "mlops.feature.fallback.remove"], allowedScenarios: ["feature-drift"],
      resourceConstraints: { serviceUid: ["service-1"], deploymentUid: ["deploy-1"], featureSetUid: ["feature-1"] } });
    const signingSecret = "isolated-server-signing-secret-at-least-32-characters";
    const issuerToken = "isolated-approval-issuer-at-least-32-characters";
    const platforms = Object.fromEntries(["aiops", "dataops", "mlops"].map(
      /** 仅注册不可路由测试域名，网络由下方依赖接管。 / Register non-routable test hosts handled entirely by the injected dependency. */
      (platform) => [platform, { baseUrl: `https://${platform}.invalid/`, secret: signingSecret }]));
    let businessWrites = 0;
    let approvalWrites = 0;
    const gateway = new LiveGateway({ store, platforms, approval: { baseUrl: "https://approval.invalid/", token: issuerToken },
      /** 与授权账本共用测试时间。 / Share test time with the authorization ledger. */ now: () => now,
      /** 模拟平台协议，不联系线上平台、不修改真实资源。 / Simulate platform protocols without reaching online systems or changing real resources. */
      async fetch(input: URL | string, init: RequestInit = {}) {
        const url = new URL(String(input));
        if (url.hostname === "approval.invalid") {
          if (init.method === "PUT") { approvalWrites++; assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${issuerToken}`); }
          return Response.json({ status: "ok" });
        }
        if (url.pathname === "/") return Response.json({ platform: url.hostname.split(".")[0] });
        if (url.pathname.startsWith("/api/agent/v1/actions/")) return Response.json({ actionId: "act_12345678", status: "SUCCEEDED", stage: "DONE", errorCode: null, errorMessage: null });
        const headers = new Headers(init.headers), body = JSON.parse(String(init.body));
        assert.notEqual(headers.get("authorization"), `Bearer ${grant.accessCode}`);
        const writing = body.toolName === "mlops.feature.fallback.apply";
        if (writing) businessWrites++;
        const context = { requestId: body.requestId, workspaceId: headers.get("X-OpenXnet-Workspace-Id"), incidentId: headers.get("X-OpenXnet-Incident-Id"), traceId: headers.get("X-OpenXnet-Trace-Id"), toolName: body.toolName };
        return Response.json({ success: true, data: writing ? { actionId: "act_12345678", status: "SUCCEEDED" } : { status: "HEALTHY" }, error: null,
          auditReceipt: writing ? { ...context, actorId: headers.get("X-OpenXnet-Actor-Id"), approvalId: body.approvalId, requestDigest: body.argumentsDigest,
            beforeResourceVersion: "42", afterResourceVersion: "43", approverId: "human-approver", actionStatus: "SUCCEEDED" } : null,
          meta: { ...context, platform: url.hostname.split(".")[0], contractVersion: "1.0.0", resourceVersion: "43", source: "local-contract-fixture", durationMs: 0, observedAt: now.toISOString(), summary: "Local contract only" } });
      },
    });
    const server: Server = createApplication({ liveGateway: gateway,
      credentialStore: { /** 提供隔离团队会话状态，不进行模型调用。 / Supply isolated team session status without model calls. */ async read() { return { matrixUrl: "https://matrix.invalid", matrixAccessToken: "isolated-session", matrixUserId: "@user:invalid" }; } },
      logger: { /** 测试错误不得输出凭据。 / Test errors must not print credentials. */ warn() {}, /** 丢弃隔离测试的服务器日志。 / Discard isolated server logs. */ error() {} },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(/** 关闭本次本机服务。 / Close this local test service. */ () => new Promise<void>(
      /** 等待服务释放端口。 / Wait for the server to release its port. */ (resolve) => { server.closeAllConnections(); server.close(() => resolve()); }));
    const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    const key = randomBytes(32);
    const filePath = path.join(directory, "desktop.enc");
    const connection = new ApplicationCompetitionLiveConnectionService({ filePath,
      /** 固定桌面登录持有者。 / Fix the authenticated desktop owner. */ resolveOwnerId: () => "account-1",
      /** 与服务端共用测试时钟。 / Share the test clock with the server. */ now: () => now.getTime(),
      safeStorage: {
        /** 此测试用临时密钥模拟已可用系统加密。 / Simulate available OS encryption with an ephemeral test key. */ isEncryptionAvailable: () => true,
        /** 对临时文件执行真实加密。 / Actually encrypt the temporary file. */ encryptString(value) { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv); const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
        /** 只解密本测试生成的文件。 / Decrypt only files produced by this test. */ decryptString(value) { const cipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12)); cipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString("utf8"); },
      },
    });
    const request = { endpoint, workspaceId: "workspace-1", accessCode: grant.accessCode, enabled: true };
    const checked = await connection.test(request);
    assert.equal(checked.ok, true, checked.code);
    assert.equal(checked.access?.requiredTeamRuntime, "agentteams");
    assert.equal(checked.access?.serviceReady, true);
    assert.equal(checked.access?.remainingRequests, 80);
    assert.equal(existsSync(filePath), false);
    assert.equal(businessWrites, 0); assert.equal(approvalWrites, 0);
    assert.equal((await connection.save(request)).ok, true);
    assert.equal(businessWrites, 0); assert.equal(approvalWrites, 0);
    assert.equal((await connection.test({ ...request, workspaceId: "other" })).code, "ACCESS_SCOPE_MISMATCH");

    const prepare = { requestId: "prepare-1", workspaceId: "workspace-1", incidentId: "incident-1", traceId: "trace-1", teamTemplateId: "template-1", teamTemplateVersion: 1,
      members: ["leader", "worker", "verifier"].map(/** 构造角色分离的测试团队。 / Build a separated-role test team. */ (role) => ({ roleCardId: role, teamRole: role, tools: [] })) };
    await gateway.executeTeam(grant.accessCode, "live", "prepare", prepare,
      /** 模拟团队已准备，不联系 AgentTeams 控制器。 / Simulate team preparation without contacting an AgentTeams controller. */ async (scoped: unknown) => ({ teamName: teamName(scoped) }));
    const dispatch = { ...prepare, requestId: "investigation-plan", teamName: teamName({ ...prepare, accessGrantId: grant.grantId }), stage: "INVESTIGATION_PLAN",
      context: { incident: { scenario: { scenarioType: "feature-drift" } }, availableTools: ["aiops.service.health"], proposedPlan: null,
        residentContexts: ["aiops", "dataops", "mlops"].map(/** 标记隔离的 Live 合同来源。 / Mark isolated Live contract origins. */ (platform) => ({ platform, source: "LIVE-STAGING", environment: "staging" })) } };
    await gateway.executeTeam(grant.accessCode, "live", "dispatch", dispatch,
      /** 模拟 Worker 请求取证。 / Simulate a Worker requesting evidence. */ async () => ({ result: { decision: "COLLECT_EVIDENCE", roleCardId: "worker" } }));
    const readRequest: CompetitionToolAdapterRequest = { requestId: "read-1", workspaceId: "workspace-1", incidentId: "incident-1", traceId: "trace-1", actorId: "agentteams:worker", toolName: "aiops.service.health", arguments: { serviceUid: "service-1" }, governance: null };
    const transport = new HttpCompetitionToolAdapter({
      /** 禁止网关模式绕过服务端。 / Prohibit bypassing the server in gateway mode. */ async resolveEndpoint() { throw new Error("Legacy transport is forbidden"); },
      gateway: {
        /** 使用真实本机 HTTP 入口。 / Use the actual local HTTP entry point. */ async resolveEndpoint() { return endpoint; },
        /** 由真实桌面服务复核本次范围。 / Recheck request scope with the actual desktop service. */ async resolveAccessCode(value) { return connection.requireRuntimeConnection(value.workspaceId, { toolName: value.toolName }).accessCode; },
      },
    });
    assert.equal((await transport.invoke(readRequest)).success, true);
    const args = { deploymentUid: "deploy-1", featureSetUid: "feature-1", reasonCode: "CONTRACT_DRIFT" };
    const writeRequest: CompetitionToolAdapterRequest = { ...readRequest, requestId: "write-1", actorId: "operator", toolName: "mlops.feature.fallback.apply", arguments: args,
      governance: { approvalId: "approval-1", planId: "plan-1", planDigest: "a".repeat(64), stepId: "step-1", resourceId: "feature-set:deploy-1", targetRevision: 19,
        expectedResourceVersion: "42", argumentsDigest: digest(canonical(args)), compensation: false, reason: "Isolated approval", dryRun: false, idempotencyKey: "idem-1" } };
    const g = writeRequest.governance!;
    const step = { stepId: g.stepId, toolName: writeRequest.toolName, resourceId: g.resourceId, targetRevision: g.targetRevision, expectedResourceVersion: g.expectedResourceVersion, argumentsDigest: g.argumentsDigest, dependsOn: [] };
    const plan = { planId: g.planId, planDigest: g.planDigest, steps: [step], compensationSteps: [{ ...step, stepId: "compensate-1", toolName: "mlops.feature.fallback.remove" }] };
    await gateway.executeTeam(grant.accessCode, "live", "dispatch", { ...dispatch, requestId: "investigation-conclusion", stage: "INVESTIGATION_CONCLUSION", context: { ...dispatch.context, proposedPlan: plan } },
      /** 模拟 Leader 对已冻结计划申请审批。 / Simulate a Leader requesting approval for the frozen plan. */ async () => ({ result: { decision: "REQUEST_APPROVAL", roleCardId: "leader" } }));
    const approved: ApplicationCompetitionApproval = { approvalId: g.approvalId, workspaceId: writeRequest.workspaceId, incidentId: writeRequest.incidentId, traceId: writeRequest.traceId,
      toolName: writeRequest.toolName, resourceId: g.resourceId, targetRevision: g.targetRevision, expectedResourceVersion: g.expectedResourceVersion, argumentsDigest: g.argumentsDigest,
      planId: g.planId, planDigest: g.planDigest, scopes: planScopes(plan), reason: "Isolated approval", status: "APPROVED", requestedBy: "agentteams:leader", requestedAt: now.toISOString(),
      decidedBy: "human-approver", decidedAt: now.toISOString(), decisionReason: "Local protocol test" };
    const publisher = new HttpCompetitionApprovalPublisher({ gatewayMode: true,
      /** 冻结同一接入地址。 / Freeze the same connection endpoint. */ async resolveEndpoint() { return endpoint; },
      /** 客户端只使用限权授权。 / The client uses only scoped authorization. */ async resolveIssuerToken() { return grant.accessCode; },
      /** 固定审批时钟。 / Fix approval time. */ now: () => now,
    });
    await publisher.publish(approved);
    assert.equal(approvalWrites, 1);
    assert.equal((await transport.invoke(writeRequest)).success, true);
    assert.equal(businessWrites, 1);
    assert.equal((await transport.waitForAction(writeRequest, "act_12345678")).status, "SUCCEEDED");
    await store.revoke(grant.grantId);
    assert.equal((await connection.test({ endpoint, workspaceId: "workspace-1" })).code, "ACCESS_REVOKED");
    assert.equal((await connection.getSnapshot()).enabled, true);
    await assert.rejects(transport.invoke({ ...readRequest, requestId: "after-revocation" }));
    assert.equal(businessWrites, 1);
  });
