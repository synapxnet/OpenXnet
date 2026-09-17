/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 独立AgentTeams服务与驻场上下文入口 / Isolated AgentTeams service and resident-context endpoint.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.2 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Existing repository license and third-party notices are retained.
 */
"use strict";

const http = require("node:http");
const path = require("node:path");
const { AgentTeamsCliAdapter, teamName } = require("./agentteams-cli");
const { AccessGrantStore, parseAccessRequest } = require("./access-grant-store");
const { LiveAccessGrantStore, LIVE_CODE_PATTERN, parseLiveAccessRequest } = require("./live-access-store");
const { createLiveGateway } = require("./live-gateway");
const { EncryptedCredentialStore } = require("./credential-store");
const {
  PREPARE_RESULT_SCHEMA,
  PublicError,
  SESSION_SCHEMA,
  TASK_RESULT_SCHEMA,
  parsePrepareRequest,
  parseSessionRequest,
  parseTaskRequest,
} = require("./contracts");
const {
  authorizePrepareScope,
  authorizeProvisioning,
  authorizeTaskScope,
  parseEncryptionKey,
  requireSecret,
  verifyDelegation,
} = require("./security");

const MAXIMUM_BODY_BYTES = 512 * 1024;
const ADAPTER_VERSION = require("../package.json").version;

/** 读取有界单个 JSON 对象；输入请求，返回解析值，超限或非法时抛出公开错误。 */
async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAXIMUM_BODY_BYTES) {
      throw new PublicError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds its byte budget.");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PublicError(400, "INVALID_ARGUMENT", "Request body must be valid JSON.");
  }
}

/** 写入禁止缓存的 UTF-8 JSON；输入响应、状态和对象，无返回。 */
function writeJson(response, status, value) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": String(body.length),
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

/** 写入固定错误包络；输入响应和公开错误，无返回且不暴露内部异常。 */
function writePublicError(response, error) {
  writeJson(response, error.status, {
    error: { code: error.code, message: error.message },
  });
}

/** 返回不含凭据的会话状态；输入加密存储，无输入副作用，输出仅包含配置元数据。 */
async function sessionStatus(store) {
  const credentials = await store.read();
  const collaborationConfigured = Boolean(
    credentials?.matrixUrl
    && credentials?.matrixAccessToken
    && credentials?.matrixUserId,
  );
  return {
    schema: SESSION_SCHEMA,
    configured: credentials !== null && collaborationConfigured,
    collaborationConfigured,
    controllerUrl: credentials?.controllerUrl || "",
    matrixUserId: credentials?.matrixUserId || "",
    updatedAt: credentials?.updatedAt || "",
  };
}

/** 创建隔离 AgentTeams HTTP 应用；输入安全配置和依赖，返回可监听服务器。 */
function createApplication(options) {
  const now = options.now || (() => new Date());
  const logger = options.logger || console;
  /** 同时支持受控部署委托与限定演练访问码。 / Support deployment delegation and bounded demo access codes. */
  async function executeAuthorized(request, parsed, operationName, operation) {
    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer oxlive_")) {
      if (!options.liveGateway) throw new PublicError(503, "LIVE_UNAVAILABLE", "Live access is not enabled.");
      return options.liveGateway.executeTeam(authorization.slice(7), request.headers["x-openxnet-execution-mode"], operationName, parsed, operation);
    }
    if (typeof authorization === "string" && authorization.startsWith("Bearer oxdemo_")) {
      if (!options.accessGrantStore) throw new PublicError(503, "ACCESS_UNAVAILABLE", "Demo access is not available.");
      return options.accessGrantStore.execute(authorization.slice(7), request.headers["x-openxnet-execution-mode"], operationName, parsed,
        /** 仅服务端注入授权范围，用户不能自选授权身份。 / Inject grant scope only on the server; users cannot choose it. */ async grantId => {
          const scoped = { ...parsed, accessGrantId: grantId };
          if (operationName === "dispatch" && scoped.teamName !== teamName(scoped)) throw new PublicError(403, "ACCESS_TEAM_MISMATCH", "The team is outside this demo grant.");
          return operation(scoped);
        });
    }
    const claims = verifyDelegation(authorization, options.delegationSecret, now());
    if (operationName === "prepare") authorizePrepareScope(claims, parsed);
    else authorizeTaskScope(claims, parsed);
    return operation(parsed);
  }
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, {
          schema: "openxnet.agentteams-adapter.health.v1",
          status: "ok",
          version: ADAPTER_VERSION,
          capabilities: { residentContexts: true, demoAccessCodes: Boolean(options.accessGrantStore), liveAccessCodes: Boolean(options.liveGateway) },
        });
        return;
      }
      if (url.pathname.startsWith("/api/v1/live-access/") || url.pathname.startsWith("/api/v1/live/")) {
        if (!options.liveGateway) throw new PublicError(503, "LIVE_UNAVAILABLE", "Live access is not enabled.");
        const store = options.liveGateway.store;
        if (url.pathname === "/api/v1/live-access/grants" || url.pathname.startsWith("/api/v1/live-access/grants/")) {
          authorizeProvisioning(request.headers.authorization, options.provisioningToken);
          if (request.method === "POST" && url.pathname === "/api/v1/live-access/grants") {
            writeJson(response, 201, await store.issue(await readJson(request)));
            return;
          }
          if (request.method === "DELETE" && /^\/api\/v1\/live-access\/grants\/live_[a-f0-9-]{36}$/u.test(url.pathname)) {
            writeJson(response, 200, await store.revoke(url.pathname.split("/").at(-1)));
            return;
          }
          throw new PublicError(404, "NOT_FOUND", "Route was not found.");
        }
        const authorization = request.headers.authorization;
        if (typeof authorization !== "string" || !authorization.startsWith("Bearer ") || !LIVE_CODE_PATTERN.test(authorization.slice(7))) throw new PublicError(401, "LIVE_ACCESS_INVALID", "A scoped Live access credential is required.");
        const code = authorization.slice(7);
        if (request.method === "POST" && ["/api/v1/live-access/check", "/api/v1/live-access/connect"].includes(url.pathname)) {
          const parsed = parseLiveAccessRequest(await readJson(request));
          const access = await store.inspect(code, parsed.workspaceId);
          const readiness = await options.liveGateway.readiness((await sessionStatus(options.credentialStore)).configured);
          if (url.pathname.endsWith("/connect")) {
            if (!readiness.serviceReady) throw new PublicError(503, "LIVE_SERVICE_NOT_READY", "Live prerequisites are not ready.");
            await store.inspect(code, parsed.workspaceId, true);
          }
          writeJson(response, 200, { ...access, ...readiness });
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/v1/live/tools/invoke") {
          writeJson(response, 200, await options.liveGateway.invoke(code, await readJson(request)));
          return;
        }
        if (request.method === "POST" && url.pathname === "/api/v1/live/actions/read") {
          writeJson(response, 200, await options.liveGateway.readAction(code, await readJson(request)));
          return;
        }
        if (request.method === "PUT" && /^\/api\/v1\/live\/approvals\/[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(url.pathname)) {
          writeJson(response, 200, await options.liveGateway.publishApproval(code, url.pathname.split("/").at(-1), await readJson(request)));
          return;
        }
        throw new PublicError(404, "NOT_FOUND", "Route was not found.");
      }
      if (url.pathname === "/api/v1/access/grants" || url.pathname.startsWith("/api/v1/access/grants/")) {
        authorizeProvisioning(request.headers.authorization, options.provisioningToken);
        if (!options.accessGrantStore) throw new PublicError(503, "ACCESS_UNAVAILABLE", "Demo access is not available.");
        if (request.method === "POST" && url.pathname === "/api/v1/access/grants") {
          writeJson(response, 201, await options.accessGrantStore.issue(await readJson(request)));
          return;
        }
        if (request.method === "DELETE" && /^\/api\/v1\/access\/grants\/grant_[a-f0-9-]{36}$/u.test(url.pathname)) {
          writeJson(response, 200, await options.accessGrantStore.revoke(url.pathname.split("/").at(-1)));
          return;
        }
      }
      if (request.method === "POST" && ["/api/v1/access/check", "/api/v1/access/connect"].includes(url.pathname)) {
        if (!options.accessGrantStore) throw new PublicError(503, "ACCESS_UNAVAILABLE", "Demo access is not available.");
        const authorization = request.headers.authorization;
        if (typeof authorization !== "string" || !authorization.startsWith("Bearer oxdemo_")) throw new PublicError(401, "ACCESS_INVALID", "A demo access code is required.");
        const connect = url.pathname.endsWith("/connect");
        const parsed = parseAccessRequest(await readJson(request), !connect);
        const service = await sessionStatus(options.credentialStore);
        if (connect && !service.configured) throw new PublicError(503, "SERVICE_NOT_READY", "Collaboration session is not configured.");
        writeJson(response, 200, await options.accessGrantStore.inspect(authorization.slice(7), parsed.workspaceId, connect, service.configured));
        return;
      }
      if (url.pathname === "/api/v1/session") {
        authorizeProvisioning(request.headers.authorization, options.provisioningToken);
        if (request.method === "GET") {
          writeJson(response, 200, await sessionStatus(options.credentialStore));
          return;
        }
        if (request.method === "PUT") {
          const session = parseSessionRequest(await readJson(request));
          const probe = await options.agentTeams.probeSession(session);
          const credentials = { ...session, updatedAt: now().toISOString() };
          await options.credentialStore.write(credentials);
          logger.info("AgentTeams isolated session was provisioned.");
          writeJson(response, 200, {
            ...(await sessionStatus(options.credentialStore)),
            controllerVersion: probe.controllerVersion,
            kubeMode: probe.kubeMode,
          });
          return;
        }
        if (request.method === "DELETE") {
          await options.credentialStore.clear();
          logger.info("AgentTeams isolated session was cleared.");
          writeJson(response, 200, await sessionStatus(options.credentialStore));
          return;
        }
      }
      if (request.method === "POST" && url.pathname === "/api/v1/teams/prepare") {
        const prepareRequest = parsePrepareRequest(await readJson(request));
        const payload = await executeAuthorized(request, prepareRequest, "prepare", /** 按已授权范围准备团队并缓存公开回执。 / Prepare a scoped team and cache its public receipt. */ async scopedRequest => {
        const credentials = await options.credentialStore.read();
        if (credentials === null) {
          throw new PublicError(503, "AGENTTEAMS_SESSION_REQUIRED", "AgentTeams session is not configured.");
        }
        const result = await options.agentTeams.prepareTeam(scopedRequest, credentials);
        logger.info(`AgentTeams team prepared for request ${prepareRequest.requestId}.`);
        return {
          schema: PREPARE_RESULT_SCHEMA,
          success: true,
          requestId: prepareRequest.requestId,
          workspaceId: prepareRequest.workspaceId,
          incidentId: prepareRequest.incidentId,
          traceId: prepareRequest.traceId,
          teamTemplateId: prepareRequest.teamTemplateId,
          teamTemplateVersion: prepareRequest.teamTemplateVersion,
          teamName: result.teamName,
          status: result.status,
          phase: result.phase,
          leaderName: result.leaderName,
          readyWorkers: result.readyWorkers,
          totalWorkers: result.totalWorkers,
          workerNames: result.workerNames,
          preparedAt: now().toISOString(),
        };
        });
        writeJson(response, 200, payload);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks/dispatch") {
        const taskRequest = parseTaskRequest(await readJson(request), now());
        const payload = await executeAuthorized(request, taskRequest, "dispatch", /** 执行身份限定阶段并保存幂等公开回执。 / Execute an identity-bound stage and retain its idempotent public receipt. */ async scopedRequest => {
        const credentials = await options.credentialStore.read();
        if (credentials === null || !credentials.matrixAccessToken) {
          throw new PublicError(503, "AGENTTEAMS_SESSION_REQUIRED", "AgentTeams collaboration session is not configured.");
        }
        const taskCancellation = new AbortController();
        /** 客户端断开只取消本阶段，不影响其他串行任务。 / Client disconnect cancels only this stage, leaving other serialized tasks intact. */
        const cancelTask = () => { if (!response.writableEnded) taskCancellation.abort(); };
        response.once("close", cancelTask);
        let result;
        try { result = await options.agentTeams.dispatchTask(scopedRequest, credentials, { signal: taskCancellation.signal }); }
        finally { response.removeListener("close", cancelTask); }
        logger.info(`AgentTeams task completed for request ${taskRequest.requestId}.`);
        return {
          schema: TASK_RESULT_SCHEMA,
          success: true,
          requestId: taskRequest.requestId,
          workspaceId: taskRequest.workspaceId,
          incidentId: taskRequest.incidentId,
          traceId: taskRequest.traceId,
          teamTemplateId: taskRequest.teamTemplateId,
          teamTemplateVersion: taskRequest.teamTemplateVersion,
          teamName: taskRequest.teamName,
          stage: taskRequest.stage,
          taskId: result.taskId,
          status: "COMPLETED",
          route: result.route,
          result: result.result,
          transportEvents: result.transportEvents,
          completedAt: now().toISOString(),
        };
        });
        writeJson(response, 200, payload);
        return;
      }
      throw new PublicError(404, "NOT_FOUND", "Route was not found.");
    } catch (error) {
      if (error instanceof PublicError) {
        logger.warn?.(`AgentTeams adapter request rejected: code=${error.code} status=${error.status} message=${error.message}`);
        writePublicError(response, error);
        return;
      }
      logger.error("AgentTeams adapter request failed with a private error.");
      writePublicError(response, new PublicError(500, "INTERNAL_ERROR", "AgentTeams adapter request failed."));
    }
  });
}

/** 从环境构建服务依赖；输入环境对象，返回已校验配置，不访问网络。 */
function createOptionsFromEnvironment(environment) {
  const dataRoot = path.resolve(environment.AGENTTEAMS_DATA_ROOT || "/data");
  const provisioningToken = requireSecret(environment, "OPENXNET_AGENTTEAMS_PROVISIONING_TOKEN");
  const delegationSecret = requireSecret(environment, "OPENXNET_AGENTTEAMS_DELEGATION_SECRET");
  const encryptionKey = parseEncryptionKey(environment.OPENXNET_AGENTTEAMS_CREDENTIAL_KEY);
  const credentialStore = new EncryptedCredentialStore(path.join(dataRoot, "credentials.enc.json"), encryptionKey);
  const accessGrantStore = new AccessGrantStore(path.join(dataRoot, "demo-access-grants.json"));
  const liveAccessGrantStore = new LiveAccessGrantStore(path.join(dataRoot, "live-access-grants.json"));
  const liveGateway = createLiveGateway(environment, liveAccessGrantStore);
  const agentTeams = new AgentTeamsCliAdapter({
    executable: environment.AGENTTEAMS_CLI || "/usr/local/bin/agt",
    dataRoot,
    temporaryRoot: environment.AGENTTEAMS_TEMP_ROOT || "/tmp",
    leaderModel: environment.AGENTTEAMS_LEADER_MODEL,
    workerModel: environment.AGENTTEAMS_WORKER_MODEL,
    leaderRuntime: environment.AGENTTEAMS_LEADER_RUNTIME,
    workerRuntime: environment.AGENTTEAMS_WORKER_RUNTIME,
    heartbeatEvery: environment.AGENTTEAMS_HEARTBEAT_EVERY,
    readyTimeoutMs: environment.AGENTTEAMS_TEAM_READY_TIMEOUT_MS,
    pollIntervalMs: environment.AGENTTEAMS_TEAM_POLL_INTERVAL_MS,
    taskTimeoutMs: environment.AGENTTEAMS_TASK_TIMEOUT_MS,
    taskPollIntervalMs: environment.AGENTTEAMS_TASK_POLL_INTERVAL_MS,
    workerActivityRoot: environment.AGENTTEAMS_WORKER_ACTIVITY_ROOT,
  });
  return { provisioningToken, delegationSecret, credentialStore, accessGrantStore, liveGateway, agentTeams };
}

/** 解析服务端口；输入环境文本，返回 1 到 65535 的端口。 */
function readPort(value) {
  if (!value) return 8080;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");
  return port;
}

/** 启动独立 AgentTeams 服务；无输入，配置非法时失败关闭。 */
function main() {
  const port = readPort(process.env.PORT);
  const application = createApplication(createOptionsFromEnvironment(process.env));
  application.headersTimeout = 5_000;
  application.requestTimeout = 330_000;
  application.keepAliveTimeout = 30_000;
  application.listen(port, "0.0.0.0", () => {
    console.info(`OpenXnet AgentTeams adapter listening on port ${port}.`);
  });
}

if (require.main === module) main();

module.exports = {
  createApplication,
  createOptionsFromEnvironment,
  readJson,
  readPort,
  sessionStatus,
};
