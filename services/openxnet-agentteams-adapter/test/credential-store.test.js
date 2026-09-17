#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * SPDX-License-Identifier: AGPL-3.0-only
 * 加密存储回归测试维护来源 / Maintained encrypted-store regression tests.
 * Author: maoyo (maintenance metadata) | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0-contract.2 | Security Level: INTERNAL
 * __version__: 1.3.0-contract.2 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Copied from the deployed 1.1.1-workerlease.6 application; existing authorship and license are retained.
 * LICENSE and THIRD_PARTY_NOTICES.md remain unchanged; this header does not relicense the original source.
 */
"use strict";

const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { EncryptedCredentialStore } = require("../src/credential-store");

test("credential store encrypts, restores and clears the isolated AgentTeams session", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openxnet-agentteams-credentials-"));
  const filePath = path.join(directory, "credentials.enc.json");
  const store = new EncryptedCredentialStore(filePath, randomBytes(32));
  const credentials = {
    controllerUrl: "https://agentteams.example.test",
    authToken: "agentteams-secret-token-that-must-never-appear-in-the-envelope",
    updatedAt: "2026-08-03T08:00:00.000Z",
  };
  try {
    assert.equal(await store.read(), null);
    await store.write(credentials);
    const encrypted = await readFile(filePath, "utf8");
    assert.equal(encrypted.includes(credentials.authToken), false);
    assert.deepEqual(await store.read(), credentials);
    const rotated = { ...credentials, authToken: "rotated-agentteams-token", updatedAt: "2026-08-03T09:00:00.000Z" };
    await store.write(rotated);
    assert.deepEqual(await store.read(), rotated);
    await store.clear();
    assert.equal(await store.read(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
