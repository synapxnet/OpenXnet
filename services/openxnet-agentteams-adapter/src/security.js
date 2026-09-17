#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * SPDX-License-Identifier: AGPL-3.0-only
 * 受限委托与鉴权维护来源 / Maintained scoped delegation and authorization.
 * Author: maoyo (maintenance metadata) | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.2 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Copied from the deployed 1.1.1-workerlease.6 application; existing authorship and license are retained.
 * LICENSE and THIRD_PARTY_NOTICES.md remain unchanged; this header does not relicense the original source.
 */
"use strict";

const { createHmac, timingSafeEqual } = require("node:crypto");
const { PublicError } = require("./contracts");

/** 使用常量时间比较两个 UTF-8 文本；输入两个字符串，返回是否完全一致。 */
function safeTextEqual(left, right) {
  const leftBytes = Buffer.from(String(left), "utf8");
  const rightBytes = Buffer.from(String(right), "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

/** 从 Authorization 读取 Bearer 内容；输入请求头，返回令牌或抛出未认证错误。 */
function requireBearer(authorization) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    throw new PublicError(401, "UNAUTHENTICATED", "Bearer authentication is required.");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new PublicError(401, "UNAUTHENTICATED", "Bearer authentication is required.");
  return token;
}

/** 校验运维 provisioning token；输入 Authorization 和预期令牌，无返回。 */
function authorizeProvisioning(authorization, expectedToken) {
  const token = requireBearer(authorization);
  if (!safeTextEqual(token, expectedToken)) {
    throw new PublicError(401, "UNAUTHENTICATED", "Provisioning identity is invalid.");
  }
}

/** 解码 JWT JSON 段；输入 base64url 文本和标签，返回普通对象。 */
function decodeJwtPart(value, label) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new PublicError(401, "UNAUTHENTICATED", `${label} is invalid.`);
  }
}

/** 验证受众限定 HS256 委托 JWT；输入 Authorization、密钥和当前时间，返回已认证声明。 */
function verifyDelegation(authorization, secret, now) {
  const token = requireBearer(authorization);
  const parts = token.split(".");
  if (parts.length !== 3) throw new PublicError(401, "UNAUTHENTICATED", "Delegation token is invalid.");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtPart(encodedHeader, "Delegation header");
  const claims = decodeJwtPart(encodedPayload, "Delegation claims");
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new PublicError(401, "UNAUTHENTICATED", "Delegation algorithm is invalid.");
  }
  const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`, "utf8").digest();
  let received;
  try {
    received = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new PublicError(401, "UNAUTHENTICATED", "Delegation signature is invalid.");
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new PublicError(401, "UNAUTHENTICATED", "Delegation signature is invalid.");
  }
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (
    claims.iss !== "openxnet-desktop"
    || claims.aud !== "openxnet-agentteams-adapter"
    || typeof claims.sub !== "string"
    || claims.sub.length < 1
    || claims.sub.length > 128
    || !Number.isInteger(claims.iat)
    || !Number.isInteger(claims.exp)
    || claims.iat > nowSeconds + 30
    || claims.exp <= nowSeconds
    || claims.exp - claims.iat > 300
    || !Array.isArray(claims.scopes)
    || claims.scopes.length < 1
    || claims.scopes.length > 4
    || claims.scopes.some((scope) => !["agentteams:team:prepare", "agentteams:task:dispatch"].includes(scope))
  ) {
    throw new PublicError(401, "UNAUTHENTICATED", "Delegation claims are invalid.");
  }
  return claims;
}

/** 校验委托声明与请求上下文一致；输入声明和请求，无返回，范围不符时抛出 403。 */
function authorizePrepareScope(claims, request) {
  if (
    !claims.scopes.includes("agentteams:team:prepare")
    || claims.request_id !== request.requestId
    || claims.workspace_id !== request.workspaceId
    || claims.incident_id !== request.incidentId
    || claims.trace_id !== request.traceId
    || claims.team_template_id !== request.teamTemplateId
    || claims.team_template_version !== request.teamTemplateVersion
  ) {
    throw new PublicError(403, "SCOPE_MISMATCH", "Delegation scope does not match the prepare request.");
  }
}

/** 校验任务委托与 Team、阶段和模板上下文一致；输入声明和请求，无返回。 */
function authorizeTaskScope(claims, request) {
  if (
    !claims.scopes.includes("agentteams:task:dispatch")
    || claims.request_id !== request.requestId
    || claims.workspace_id !== request.workspaceId
    || claims.incident_id !== request.incidentId
    || claims.trace_id !== request.traceId
    || claims.team_template_id !== request.teamTemplateId
    || claims.team_template_version !== request.teamTemplateVersion
    || claims.team_name !== request.teamName
    || claims.stage !== request.stage
  ) {
    throw new PublicError(403, "SCOPE_MISMATCH", "Delegation scope does not match the task request.");
  }
}

/** 解析 32 字节 AES 密钥；输入 base64/base64url 文本，返回密钥缓冲区。 */
function parseEncryptionKey(value) {
  const normalized = String(value || "").trim();
  let key;
  try {
    key = Buffer.from(normalized, "base64url");
  } catch {
    throw new Error("OPENXNET_AGENTTEAMS_CREDENTIAL_KEY must be base64url encoded.");
  }
  if (key.length !== 32) throw new Error("OPENXNET_AGENTTEAMS_CREDENTIAL_KEY must decode to 32 bytes.");
  return key;
}

/** 读取至少 32 字符的必需密钥；输入环境对象和名称，返回去空格文本。 */
function requireSecret(environment, name) {
  const value = String(environment[name] || "").trim();
  if (value.length < 32) throw new Error(`${name} must contain at least 32 characters.`);
  return value;
}

module.exports = {
  authorizePrepareScope,
  authorizeProvisioning,
  authorizeTaskScope,
  parseEncryptionKey,
  requireSecret,
  verifyDelegation,
};
