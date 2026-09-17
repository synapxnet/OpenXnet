/*
 * #!/usr/bin/env node
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 安装版协同接入与系统加密存储 / Installed collaboration setup and OS-encrypted storage.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * Maintainer: maoyo | Email: synapxnet@gmail.com
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ApplicationCompetitionConnectionAccess,
  ApplicationCompetitionConnectionCode,
  ApplicationCompetitionConnectionResult,
  ApplicationCompetitionConnectionSnapshot,
} from "../contracts/application-competition-connection";
import type { SafeStorageLike } from "../storage/safe-storage-credential-store";

const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 8_000;
const ACCESS_CODE_PATTERN = /^oxdemo_[a-f0-9]{64}$/u;
const WORKSPACE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/u;

/** Main 内部配置，严禁通过 IPC 返回。 / Main-only connection containing a credential, never returned through IPC. */
export interface ApplicationCompetitionSavedConnection {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly workspaceId: string;
  readonly accessCode: string;
  readonly access: ApplicationCompetitionConnectionAccess;
}

interface StoredConnection extends ApplicationCompetitionSavedConnection {
  readonly schema: "openxnet.desktop.agentteams-connection.v1";
  readonly ownerId: string;
}

/** 服务依赖；账号身份必须来自已认证 Main。 / Dependencies resolve account ownership from authenticated Main state. */
export interface ApplicationCompetitionConnectionServiceOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
  readonly fetchResource?: typeof fetch;
  readonly assertCanChange?: () => Promise<void>;
  readonly resolveOwnerId: () => string;
  readonly readDeployment?: () => { enabled: boolean; endpoint: string; credentialConfigured: boolean } | undefined;
  readonly now?: () => number;
}

/** 仅内部使用的固定错误。 / Internal error carrying only an allowlisted code. */
class ConnectionError extends Error {
  /** 保存固定错误码。 / Store the fixed error code. */
  public constructor(public readonly code: ApplicationCompetitionConnectionCode) { super(code); }
}

/** 识别简单对象。 / Identify an inspectable object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 限制地址协议和敏感 URL 字段，保留服务路径。 / Bound URL protocols and sensitive fields while preserving the service path. */
function normalizeEndpoint(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u0020]/u.test(value.trim())) {
    throw new ConnectionError("INVALID_ENDPOINT");
  }
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new ConnectionError("INVALID_ENDPOINT"); }
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/u.test(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
      || url.username || url.password || url.search || url.hash) {
    throw new ConnectionError("INVALID_ENDPOINT");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/`;
  return url.toString();
}

/** 只投影规定字段并验证授权协议。 / Project only declared fields and validate the authorization protocol. */
function parseAccess(value: unknown): ApplicationCompetitionConnectionAccess {
  if (!isRecord(value) || value.schema !== "openxnet.agentteams.access.v1"
      || typeof value.grantId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/u.test(value.grantId)
      || typeof value.label !== "string" || value.label.length > 160 || /[\u0000-\u001f]/u.test(value.label)
      || !(value.workspaceId === null || (typeof value.workspaceId === "string" && WORKSPACE_PATTERN.test(value.workspaceId)))
      || typeof value.expiresAt !== "string" || value.expiresAt.length > 40 || !Number.isFinite(Date.parse(value.expiresAt))
      || !Number.isSafeInteger(value.remainingRequests) || (value.remainingRequests as number) < 0
      || !Array.isArray(value.modes) || value.modes.length !== 1 || value.modes[0] !== "fixture"
      || typeof value.serviceReady !== "boolean") {
    throw new ConnectionError("INVALID_RESPONSE");
  }
  return Object.freeze({
    schema: "openxnet.agentteams.access.v1", grantId: value.grantId, label: value.label,
    workspaceId: value.workspaceId, expiresAt: value.expiresAt, remainingRequests: value.remainingRequests as number,
    modes: Object.freeze(["fixture"] as const), serviceReady: value.serviceReady,
  });
}

/** 当前账号独享的接入服务；网络测试只读，保存使用系统加密。 / Account-bound connection service with read-only probes and OS-encrypted persistence. */
export class ApplicationCompetitionConnectionService {
  private readonly filePath: string;
  private readonly fetchResource: typeof fetch;
  private readonly now: () => number;
  private inFlight = false;

  /** 接收可替换依赖，不提前访问网络或系统加密。 / Accept injectable dependencies without eager network or encryption access. */
  public constructor(private readonly options: ApplicationCompetitionConnectionServiceOptions) {
    this.filePath = path.resolve(options.filePath);
    this.fetchResource = options.fetchResource ?? fetch;
    this.now = options.now ?? Date.now;
  }

  /** 检查真正可用的系统加密，拒绝 basic_text。 / Check real OS encryption and reject basic_text. */
  public isAvailable(): boolean {
    try {
      return this.options.safeStorage.isEncryptionAvailable()
        && this.options.safeStorage.getSelectedStorageBackend?.() !== "basic_text";
    } catch { return false; }
  }

  /** 同步读取公开配置，损坏或不可解密时返回明确状态。 / Read public status synchronously and report corruption without throwing. */
  public getSnapshot(): ApplicationCompetitionConnectionSnapshot {
    const storageAvailable = this.isAvailable();
    let storageError: "STORAGE_UNAVAILABLE" | "STORAGE_READ_FAILED" | undefined;
    try {
      const stored = this.readStored();
      if (stored) return Object.freeze({
        enabled: stored.enabled, endpoint: stored.endpoint, workspaceId: stored.workspaceId,
        credentialConfigured: true, storageAvailable, source: "saved", access: stored.access,
      });
    } catch (error) {
      storageError = error instanceof ConnectionError && error.code === "STORAGE_UNAVAILABLE"
        ? "STORAGE_UNAVAILABLE" : "STORAGE_READ_FAILED";
    }
    let deployment: ReturnType<NonNullable<ApplicationCompetitionConnectionServiceOptions["readDeployment"]>> | undefined;
    try { deployment = this.options.readDeployment?.(); } catch { deployment = undefined; }
    let endpoint = "";
    try { if (deployment?.endpoint) endpoint = normalizeEndpoint(deployment.endpoint); } catch { endpoint = ""; }
    return Object.freeze({
      enabled: deployment?.enabled === true, endpoint, workspaceId: "",
      credentialConfigured: deployment?.credentialConfigured === true,
      storageAvailable, source: deployment ? "deployment" : "none", access: null,
      ...(storageError ? { storageError } : {}),
    });
  }

  /** 仅供 Main 请求签发路径使用，绝不通过 IPC 调用。 / Return owner-bound credentials only to Main request dispatch, never IPC. */
  public getSavedConnection(): ApplicationCompetitionSavedConnection | null {
    try {
      const stored = this.readStored();
      if (!stored) return null;
      return Object.freeze({
        enabled: stored.enabled, endpoint: stored.endpoint, workspaceId: stored.workspaceId,
        accessCode: stored.accessCode, access: stored.access,
      });
    } catch { return null; }
  }

  /** 只验证服务和访问范围，不绑定工作空间、不落盘。 / Validate service and scope without workspace binding or persistence. */
  public async test(request: unknown): Promise<ApplicationCompetitionConnectionResult> {
    if (this.inFlight) return this.failure("CONNECTION_BUSY");
    this.inFlight = true;
    try {
      const ownerId = this.requireOwner();
      const parsed = this.parseRequest(request, ownerId, false);
      const access = await this.probe(parsed, false);
      this.assertOwner(ownerId);
      return { ok: true, snapshot: this.getSnapshot(), access };
    } catch (error) { return this.failure(this.publicCode(error)); }
    finally { this.inFlight = false; }
  }

  /** 验证并绑定授权，在运行互锁和账号复查后原子加密保存。 / Validate and bind authorization, then atomically encrypt after runtime and account checks. */
  public async save(request: unknown): Promise<ApplicationCompetitionConnectionResult> {
    if (this.inFlight) return this.failure("CONNECTION_BUSY");
    this.inFlight = true;
    try {
      const ownerId = this.requireOwner();
      if (!this.isAvailable()) throw new ConnectionError("STORAGE_UNAVAILABLE");
      const parsed = this.parseRequest(request, ownerId, true);
      await this.assertCanChange();
      this.assertOwner(ownerId);
      const access = await this.probe(parsed, true);
      await this.assertCanChange();
      this.assertOwner(ownerId);
      this.writeStored({ schema: "openxnet.desktop.agentteams-connection.v1", ownerId, ...parsed, access });
      return { ok: true, snapshot: this.getSnapshot(), access };
    } catch (error) { return this.failure(this.publicCode(error)); }
    finally { this.inFlight = false; }
  }

  /** 只删除当前账号的本机配置；不撤销服务器授权。 / Remove only the current account's local config without revoking server access. */
  public async clear(): Promise<ApplicationCompetitionConnectionResult> {
    if (this.inFlight) return this.failure("CONNECTION_BUSY");
    this.inFlight = true;
    try {
      const ownerId = this.requireOwner();
      await this.assertCanChange();
      this.assertOwner(ownerId);
      if (this.readStored()) {
        try { rmSync(this.filePath, { force: true }); } catch { throw new ConnectionError("STORAGE_WRITE_FAILED"); }
      }
      return { ok: true, snapshot: this.getSnapshot() };
    } catch (error) { return this.failure(this.publicCode(error)); }
    finally { this.inFlight = false; }
  }

  /** 读取已认证的稳定账号标识。 / Read a stable authenticated account identifier. */
  private requireOwner(): string {
    let ownerId = "";
    try { ownerId = this.options.resolveOwnerId(); } catch { /* 固定错误；固定错误不含上游信息。 / Keep upstream errors private. */ }
    if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 256) throw new ConnectionError("AUTH_REQUIRED");
    return ownerId;
  }

  /** 防止异步请求完成时把其他账号的授权写入当前账号。 / Prevent async completion from persisting another account's authorization. */
  private assertOwner(expected: string): void {
    if (this.requireOwner() !== expected) throw new ConnectionError("ACCOUNT_CHANGED");
  }

  /** 将运行中任务等宿主拒绝统一为公开互锁错误。 / Translate host runtime interlocks into a fixed public error. */
  private async assertCanChange(): Promise<void> {
    try { await this.options.assertCanChange?.(); } catch { throw new ConnectionError("CHANGE_BLOCKED"); }
  }

  /** 验证输入且只在目标和账号完全相同时复用保存码。 / Validate input and reuse a saved code only for the identical target and owner. */
  private parseRequest(value: unknown, ownerId: string, saving: boolean): Omit<ApplicationCompetitionSavedConnection, "access"> {
    if (!isRecord(value) || (saving && typeof value.enabled !== "boolean")) throw new ConnectionError("INVALID_REQUEST");
    const endpoint = normalizeEndpoint(value.endpoint);
    const workspaceId = typeof value.workspaceId === "string" ? value.workspaceId.trim() : "";
    if ((saving && !workspaceId) || (workspaceId && !WORKSPACE_PATTERN.test(workspaceId))) throw new ConnectionError("WORKSPACE_REQUIRED");
    if (value.accessCode !== undefined && typeof value.accessCode !== "string") throw new ConnectionError("INVALID_ACCESS_CODE");
    let accessCode = typeof value.accessCode === "string" ? value.accessCode.trim() : "";
    if (!accessCode) {
      const stored = this.readStored();
      if (stored && stored.ownerId === ownerId && stored.endpoint === endpoint && stored.workspaceId === workspaceId) accessCode = stored.accessCode;
    }
    if (!accessCode) throw new ConnectionError("ACCESS_CODE_REQUIRED");
    if (!ACCESS_CODE_PATTERN.test(accessCode)) throw new ConnectionError("INVALID_ACCESS_CODE");
    return { endpoint, workspaceId, accessCode, enabled: value.enabled === true };
  }

  /** 先验证公开服务身份再提交访问码；测试不调用 connect。 / Verify public service identity before sending a code; tests never call connect. */
  private async probe(request: Omit<ApplicationCompetitionSavedConnection, "access">, connect: boolean): Promise<ApplicationCompetitionConnectionAccess> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const health = await this.requestJson(new URL("health", request.endpoint), { method: "GET", signal: controller.signal });
      if (!isRecord(health) || health.schema !== "openxnet.agentteams-adapter.health.v1" || health.status !== "ok") throw new ConnectionError("WRONG_SERVICE");
      if (!isRecord(health.capabilities) || health.capabilities.demoAccessCodes !== true) throw new ConnectionError("UNSUPPORTED_SERVICE");
      const value = await this.requestJson(new URL(`api/v1/access/${connect ? "connect" : "check"}`, request.endpoint), {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${request.accessCode}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ workspaceId: request.workspaceId || null }),
      });
      const access = parseAccess(value);
      if (Date.parse(access.expiresAt) <= this.now()) throw new ConnectionError("ACCESS_EXPIRED");
      if (access.remainingRequests < 1) throw new ConnectionError("ACCESS_QUOTA_EXHAUSTED");
      if ((access.workspaceId && request.workspaceId && access.workspaceId !== request.workspaceId)
          || (connect && access.workspaceId !== request.workspaceId)) throw new ConnectionError("ACCESS_SCOPE_MISMATCH");
      if (connect && !access.serviceReady) throw new ConnectionError("SERVICE_NOT_READY");
      return access;
    } catch (error) {
      if (controller.signal.aborted) throw new ConnectionError("TIMEOUT");
      if (error instanceof ConnectionError) throw error;
      throw new ConnectionError("NETWORK_ERROR");
    } finally { clearTimeout(timeout); }
  }

  /** 在流式字节预算和禁止重定向约束下读取 JSON。 / Read JSON under a streaming byte budget and a no-redirect policy. */
  private async requestJson(url: URL, init: RequestInit): Promise<unknown> {
    const response = await this.fetchResource(url, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new ConnectionError("REDIRECT_REJECTED");
    }
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES) { await response.body?.cancel(); throw new ConnectionError("RESPONSE_TOO_LARGE"); }
    const reader = response.body?.getReader();
    if (!reader) throw new ConnectionError("INVALID_RESPONSE");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_BYTES) { await reader.cancel(); throw new ConnectionError("RESPONSE_TOO_LARGE"); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new ConnectionError(response.ok ? "INVALID_RESPONSE" : "ACCESS_REJECTED"); }
    if (!response.ok) {
      const record = isRecord(value) && isRecord(value.error) ? value.error : value;
      const code = isRecord(record) ? record.code : undefined;
      if (code === "ACCESS_EXPIRED" || code === "ACCESS_REVOKED" || code === "ACCESS_SCOPE_MISMATCH" || code === "ACCESS_QUOTA_EXHAUSTED" || code === "SERVICE_NOT_READY") throw new ConnectionError(code);
      if (code === "ACCESS_WORKSPACE_MISMATCH") throw new ConnectionError("ACCESS_SCOPE_MISMATCH");
      if (code === "ACCESS_INVALID") throw new ConnectionError("INVALID_ACCESS_CODE");
      throw new ConnectionError("ACCESS_REJECTED");
    }
    return value;
  }

  /** 有界解密并校验持有者；其他账号不能读到配置。 / Decrypt a bounded file and enforce owner isolation. */
  private readStored(): StoredConnection | null {
    let ownerId: string;
    try { ownerId = this.requireOwner(); } catch { return null; }
    if (!existsSync(this.filePath)) return null;
    if (!this.isAvailable()) throw new ConnectionError("STORAGE_UNAVAILABLE");
    try {
      const stats = statSync(this.filePath);
      if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_BYTES) throw new Error("Invalid file");
      const value: unknown = JSON.parse(this.options.safeStorage.decryptString(readFileSync(this.filePath)));
      if (!isRecord(value) || value.schema !== "openxnet.desktop.agentteams-connection.v1" || typeof value.ownerId !== "string") throw new Error("Invalid schema");
      if (value.ownerId !== ownerId) return null;
      if (typeof value.enabled !== "boolean" || typeof value.accessCode !== "string" || !ACCESS_CODE_PATTERN.test(value.accessCode)
          || typeof value.workspaceId !== "string" || !WORKSPACE_PATTERN.test(value.workspaceId)) throw new Error("Invalid fields");
      const endpoint = normalizeEndpoint(value.endpoint);
      const access = parseAccess(value.access);
      if (access.workspaceId !== value.workspaceId) throw new Error("Invalid scope");
      return { schema: "openxnet.desktop.agentteams-connection.v1", ownerId, enabled: value.enabled, endpoint,
        workspaceId: value.workspaceId, accessCode: value.accessCode, access };
    } catch { throw new ConnectionError("STORAGE_READ_FAILED"); }
  }

  /** 原子替换加密文件，失败时保留旧配置。 / Atomically replace encrypted storage while preserving the previous config on failure. */
  private writeStored(value: StoredConnection): void {
    if (!this.isAvailable()) throw new ConnectionError("STORAGE_UNAVAILABLE");
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      const encrypted = this.options.safeStorage.encryptString(JSON.stringify(value));
      if (encrypted.byteLength <= 0 || encrypted.byteLength > MAX_BYTES) throw new Error("Invalid encrypted size");
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      writeFileSync(temporaryPath, encrypted, { mode: 0o600, flag: "wx" });
      renameSync(temporaryPath, this.filePath);
    } catch { throw new ConnectionError("STORAGE_WRITE_FAILED"); }
    finally { try { rmSync(temporaryPath, { force: true }); } catch { /* 清理失败不暴露路径。 / Do not expose paths on cleanup failure. */ } }
  }

  /** 将未知内部异常归一到固定错误。 / Normalize unknown internal exceptions to a fixed error. */
  private publicCode(error: unknown): ApplicationCompetitionConnectionCode {
    return error instanceof ConnectionError ? error.code : "NETWORK_ERROR";
  }

  /** 返回不含上游异常文本的错误快照。 / Return a failure snapshot without upstream exception text. */
  private failure(code: ApplicationCompetitionConnectionCode): ApplicationCompetitionConnectionResult {
    return { ok: false, code, snapshot: this.getSnapshot() };
  }
}
