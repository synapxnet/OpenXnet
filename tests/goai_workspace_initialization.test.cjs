#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 比赛主机迁移与连接偏好回归 / Competition host migration and connection preference regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createWorkspaceDraft, resolveCloudHost } = require("../scripts/initialize_goai_enterprise_workspace.cjs");

test("GOAI new and old standard workspaces use the current server", /** 迁移已知旧主机，默认新建使用当前主机。 / Migrate the known old host and use the current host for new workspaces. */ () => {
  assert.equal(createWorkspaceDraft(null, {}).config.cloud.host, "150.109.52.248");
  assert.equal(resolveCloudHost("101.32.9.231", {}), "150.109.52.248");
});

test("GOAI migration preserves SSH and unrelated workspace preferences", /** 更换主机不清空连接字段或修改原对象。 / Changing a host neither clears connection fields nor mutates the original object. */ () => {
  const original = { id: "ws_goai_demo", role_card_id: "owner", config: { cloud: { host: "101.32.9.231", port: 2202, user: "operator", key_path: "E:/keys/fixture-only" }, local: { path: "E:/research", permission_mode: "readonly" } } };
  const draft = createWorkspaceDraft(original, {});
  assert.deepEqual(draft.config.cloud, { ...original.config.cloud, host: "150.109.52.248" });
  assert.deepEqual(draft.config.local, original.config.local);
  assert.equal(draft.role_card_id, "owner");
  assert.equal(original.config.cloud.host, "101.32.9.231");
  assert.deepEqual(createWorkspaceDraft(draft, {}), draft);
});

test("custom GOAI host changes only with an explicit valid override", /** 保留自定义主机并验证显式配置格式。 / Preserve custom hosts and validate explicit override syntax. */ () => {
  assert.equal(resolveCloudHost("staging.example.test", {}), "staging.example.test");
  assert.equal(resolveCloudHost("staging.example.test", { OPENXNET_GOAI_CLOUD_HOST: "150.109.52.248" }), "150.109.52.248");
  for (const value of ["https://staging.example.test", "user@staging.example.test", "host:22", "invalid host", "-invalid"]) {
    assert.throws(() => resolveCloudHost("", { OPENXNET_GOAI_CLOUD_HOST: value }), /hostname or IP/);
  }
});
