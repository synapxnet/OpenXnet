#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * SPDX-License-Identifier: AGPL-3.0-only
 * 加密独立会话存储维护来源 / Maintained encrypted isolated-session store.
 * Author: maoyo (maintenance metadata) | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.2 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Copied from the deployed 1.1.1-workerlease.6 application; existing authorship and license are retained.
 * LICENSE and THIRD_PARTY_NOTICES.md remain unchanged; this header does not relicense the original source.
 */
"use strict";

const { createCipheriv, createDecipheriv, randomBytes, randomUUID } = require("node:crypto");
const { lstat, mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");

const ENVELOPE_SCHEMA = "openxnet.agentteams.credentials.aesgcm.v1";
const MAXIMUM_CREDENTIAL_FILE_BYTES = 128 * 1024;

/** 以 AES-256-GCM 加密保存独立 AgentTeams 会话，不与 OpenXnet 登录库共享。 */
class EncryptedCredentialStore {
  /** 创建凭据存储；输入固定文件路径和 32 字节密钥，不立即访问磁盘。 */
  constructor(filePath, encryptionKey) {
    this.filePath = path.resolve(filePath);
    this.encryptionKey = Buffer.from(encryptionKey);
    if (this.encryptionKey.length !== 32) throw new Error("Credential encryption key must contain 32 bytes.");
  }

  /** 读取并解密会话；无输入，返回会话或 null，损坏文件时抛错。 */
  async read() {
    try {
      const info = await lstat(this.filePath);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAXIMUM_CREDENTIAL_FILE_BYTES) {
        throw new Error("AgentTeams credential file is invalid.");
      }
      const envelope = JSON.parse(await readFile(this.filePath, "utf8"));
      if (
        typeof envelope !== "object"
        || envelope === null
        || envelope.schema !== ENVELOPE_SCHEMA
        || typeof envelope.iv !== "string"
        || typeof envelope.tag !== "string"
        || typeof envelope.ciphertext !== "string"
      ) {
        throw new Error("AgentTeams credential envelope is invalid.");
      }
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, Buffer.from(envelope.iv, "base64url"));
      decipher.setAAD(Buffer.from(ENVELOPE_SCHEMA, "utf8"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      const credentials = JSON.parse(plaintext);
      if (
        typeof credentials !== "object"
        || credentials === null
        || typeof credentials.controllerUrl !== "string"
        || typeof credentials.authToken !== "string"
        || typeof credentials.updatedAt !== "string"
      ) {
        throw new Error("AgentTeams decrypted credentials are invalid.");
      }
      return { ...credentials };
    } catch (error) {
      if (error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  /** 加密并原子保存会话；输入已校验凭据，无返回，临时文件失败时清理。 */
  async write(credentials) {
    const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
    if (plaintext.length > 96 * 1024) throw new Error("AgentTeams credentials exceed their byte budget.");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(ENVELOPE_SCHEMA, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = {
      schema: ENVELOPE_SCHEMA,
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    };
    const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  /** 清除加密会话；无输入和返回，文件缺失时忽略。 */
  async clear() {
    await rm(this.filePath, { force: true });
  }
}

module.exports = { EncryptedCredentialStore };
