#!/usr/bin/env node
// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 驻场持久化与加密配置 / Resident persistence and encrypted configuration
// Author: maoyo
// Department: 研发部
// Date: 2026-09-16
// Version: 1.3.0
// Security Level: INTERNAL
// __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
// __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createCipheriv, createDecipheriv, randomBytes, randomUUID } = require("node:crypto");

/** 有界读取 JSON，缺失返回默认值。 / Read bounded JSON with a missing-file default. */
async function readJson(file, fallback) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024) throw new Error("Invalid state file.");
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

/** 原子保存受限文件。 / Atomically save a restricted file. */
async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

/** 加载或生成本进程专属加密密钥。 / Load or create the process-specific encryption key. */
async function loadKey(file) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try { await fs.writeFile(file, randomBytes(32), { flag: "wx", mode: 0o600 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== 32) throw new Error("Encryption key must be a 32-byte regular file.");
  const key = await fs.readFile(file);
  return key;
}

/** 创建串行持久化存储和独立配置保险库。 / Create serialized persistence and an isolated configuration vault. */
async function createStore(directory, keyFile, platform) {
  const key = await loadKey(keyFile);
  const aad = Buffer.from(`openxnet.resident.${platform}.v1`);
  const stateFile = path.join(directory, "state.json");
  const modelFile = path.join(directory, "model.enc.json");
  const state = await readJson(stateFile, { version: 1, platform, conversations: [], tasks: [], escalations: [] });
  if (state.platform !== platform || state.version !== 1 || !Array.isArray(state.conversations) || !Array.isArray(state.tasks)) {
    throw new Error("Resident state belongs to another platform or version.");
  }
  let queue = Promise.resolve();
  /** 串行提交完整快照。 / Serialize complete state snapshots. */
  function save() {
    const snapshot = JSON.parse(JSON.stringify(state));
    queue = queue.catch(() => {}).then(() => atomicWrite(stateFile, snapshot));
    return queue;
  }
  /** 解密模型配置。 / Decrypt the model configuration. */
  async function readModel() {
    const envelope = await readJson(modelFile, null);
    if (!envelope) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]).toString("utf8"));
  }
  /** 加密并保存模型配置。 / Encrypt and save the model configuration. */
  async function writeModel(model) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(model), "utf8"), cipher.final()]);
    await atomicWrite(modelFile, { iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") });
  }
  return { state, save, readModel, writeModel };
}
module.exports = { createStore, readJson };
