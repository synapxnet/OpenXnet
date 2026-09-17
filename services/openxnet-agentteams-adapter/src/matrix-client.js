#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Matrix 协同客户端维护来源 / Maintained Matrix collaboration client.
 * Author: maoyo (maintenance metadata) | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.2 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Copied from the deployed 1.1.1-workerlease.6 application; existing authorship and license are retained.
 * LICENSE and THIRD_PARTY_NOTICES.md remain unchanged; this header does not relicense the original source.
 */
"use strict";

const { randomUUID } = require("node:crypto");
const { PublicError } = require("./contracts");

const MAXIMUM_MATRIX_RESPONSE_BYTES = 512 * 1024;

/** 校验 Matrix Client 根地址；输入配置文本，返回 HTTPS 或隔离网络内 HTTP 地址。 */
function requireMatrixUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim().replace(/\/?$/u, "/"));
  } catch {
    throw new PublicError(400, "INVALID_ARGUMENT", "matrixUrl is invalid.");
  }
  const hostname = parsed.hostname.toLowerCase();
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
  const embeddedHomeserver = hostname === "agentteams-controller" && parsed.port === "6167";
  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && (loopback || embeddedHomeserver)))
  ) {
    throw new PublicError(400, "INVALID_ARGUMENT", "matrixUrl is not allowed.");
  }
  return parsed.toString();
}

/** 判断未知值是否为普通对象；输入未知 JSON，返回类型判断结果。 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 为 AgentTeams 隔离任务提供有界 Matrix Client API。 */
class MatrixClient {
  /** 创建 Matrix Client；输入根地址、Access Token 和可替换网络实现，不立即联网。 */
  constructor(options) {
    this.baseUrl = new URL(requireMatrixUrl(options.baseUrl));
    this.accessToken = String(options.accessToken || "").trim();
    if (this.accessToken.length < 32) {
      throw new PublicError(400, "INVALID_ARGUMENT", "matrixAccessToken is invalid.");
    }
    this.fetchResource = options.fetchResource || fetch;
    this.timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 15_000;
    this.signal = options.signal;
  }

  /** 查询当前 Matrix Token 身份；无输入，返回经过校验的完整用户 ID。 */
  async whoAmI() {
    const value = await this._requestJson("GET", "_matrix/client/v3/account/whoami", null);
    if (typeof value.user_id !== "string" || !/^@[^:\s]+:[^\s]+$/u.test(value.user_id)) {
      throw new PublicError(503, "AGENTTEAMS_MATRIX_INVALID_RESPONSE", "AgentTeams Matrix returned an invalid identity.");
    }
    return value.user_id;
  }

  /** 读取房间最近文本消息；输入 Room ID 和数量，返回从新到旧的有界消息。 */
  async readMessages(roomId, limit = 50) {
    const normalizedLimit = Number.isInteger(limit) ? Math.min(100, Math.max(1, limit)) : 50;
    const path = `_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${normalizedLimit}`;
    const value = await this._requestJson("GET", path, null);
    if (!Array.isArray(value.chunk)) {
      throw new PublicError(503, "AGENTTEAMS_MATRIX_INVALID_RESPONSE", "AgentTeams Matrix returned invalid room messages.");
    }
    return value.chunk
      .filter((event) => isRecord(event) && event.type === "m.room.message" && isRecord(event.content))
      .map((event) => ({
        eventId: typeof event.event_id === "string" ? event.event_id.slice(0, 512) : "",
        sender: typeof event.sender === "string" ? event.sender.slice(0, 512) : "",
        body: typeof event.content.body === "string" ? event.content.body.slice(0, 128 * 1024) : "",
        timestamp: Number.isSafeInteger(event.origin_server_ts) ? event.origin_server_ts : 0,
      }))
      .filter((event) => event.eventId && event.sender && event.body);
  }

  /** 发送带显式 Matrix mention 的任务；输入房间、目标身份、正文和幂等种子，返回事件 ID。 */
  async sendMention(roomId, targetUserId, body, transactionSeed) {
    const transactionId = `${String(transactionSeed || "openxnet").replace(/[^A-Za-z0-9._-]/gu, "-").slice(0, 96)}-${randomUUID()}`;
    const path = `_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(transactionId)}`;
    const value = await this._requestJson("PUT", path, {
      msgtype: "m.text",
      body: `${targetUserId} ${body}`,
      "m.mentions": { user_ids: [targetUserId] },
    });
    if (typeof value.event_id !== "string" || value.event_id.length === 0) {
      throw new PublicError(503, "AGENTTEAMS_MATRIX_INVALID_RESPONSE", "AgentTeams Matrix did not acknowledge the task message.");
    }
    return value.event_id.slice(0, 512);
  }

  /** 调用 Matrix JSON API；输入方法、相对路径和可选正文，返回有界普通对象。 */
  async _requestJson(method, relativePath, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchResource(new URL(relativePath, this.baseUrl), {
        method,
        redirect: "manual",
        signal: this.signal ? AbortSignal.any([controller.signal, this.signal]) : controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.accessToken}`,
          ...(body === null ? {} : { "Content-Type": "application/json; charset=utf-8" }),
        },
        ...(body === null ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok || (response.status >= 300 && response.status < 400)) {
        throw new PublicError(503, "AGENTTEAMS_MATRIX_UNAVAILABLE", "AgentTeams Matrix is unavailable.");
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAXIMUM_MATRIX_RESPONSE_BYTES) {
        throw new PublicError(503, "AGENTTEAMS_MATRIX_INVALID_RESPONSE", "AgentTeams Matrix response is too large.");
      }
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!isRecord(value)) throw new Error("Matrix response is not an object.");
      return value;
    } catch (error) {
      if (error instanceof PublicError) throw error;
      throw new PublicError(503, "AGENTTEAMS_MATRIX_UNAVAILABLE", "AgentTeams Matrix is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { MatrixClient, requireMatrixUrl };
