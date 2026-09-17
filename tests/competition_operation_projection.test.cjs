#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 企业治理聊天卡片合同验收 / Enterprise governance conversation card contract acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const governance = require("../build-ts/desktop/governance/application-neuro-symbolic-governance.js");

/** 加载 Main 的真实纯投影函数，不执行 Electron 启动。 / Load Main's actual pure projection functions without starting Electron. */
function loadProjection() {
  const source = fs.readFileSync(path.join(__dirname, "../main.js"), "utf8").replace(/\r\n?/gu, "\n");
  const factoryStart = source.indexOf("function createEnterpriseOperationEvent(");
  const factoryEnd = source.indexOf("/** 将 AgentTeams 阶段结果", factoryStart);
  const projectionStart = source.indexOf("function buildCompetitionGovernanceOperation(");
  const projectionEnd = source.indexOf("/**\n * 将 Matrix 事件", projectionStart);
  assert.ok(factoryStart >= 0 && factoryEnd > factoryStart, "Main operation factory is available");
  assert.ok(projectionStart >= 0 && projectionEnd > projectionStart, "Main governance projection is available");
  const scope = { evaluateApplicationNeuroSymbolicPolicy: governance.evaluateApplicationNeuroSymbolicPolicy };
  vm.createContext(scope);
  vm.runInContext(source.slice(factoryStart, factoryEnd) + "\n" + source.slice(projectionStart, projectionEnd), scope);
  return scope.buildCompetitionGovernanceOperation;
}

const project = loadProjection();
const expected = [
  ["APPROVAL_REQUESTED", "AWAITING_APPROVAL", "等待生产变更审批"],
  ["APPROVAL_APPROVED", "APPROVED", "生产变更审批已通过"],
  ["APPROVAL_REJECTED", "REJECTED", "生产变更审批已拒绝"],
  ["REHEARSAL_SUCCEEDED", "SUCCEEDED", "隔离预检已完成"],
  ["ACTION_EXECUTING", "EXECUTING", "生产变更正在执行"],
  ["ACTION_STEP_SUCCEEDED", "SUCCEEDED", "执行步骤已完成"],
  ["COMPENSATION_EXECUTING", "EXECUTING", "正在执行补偿"],
  ["COMPENSATION_SUCCEEDED", "SUCCEEDED", "补偿已完成"],
  ["VERIFICATION_SUCCEEDED", "SUCCEEDED", "独立验证已经通过"],
  ["VERIFICATION_FAILED", "FAILED", "独立验证未通过"],
];

test("acceptance covers every declared governance conversation event", /** 对齐合同全集，新增事件必须补充验收。 / Match the full contract so new events require acceptance coverage. */ () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/desktop/competition/application-competition-runtime.ts"), "utf8");
  const declaration = source.match(/export type ApplicationCompetitionOperationConversationEventType\s*=([\s\S]*?);/u);
  assert.ok(declaration, "Competition event declaration is available");
  const declared = Array.from(declaration[1].matchAll(/"([A-Z_]+)"/gu), /** 提取稳定事件名。 / Extract stable event names. */ match => match[1]);
  assert.deepEqual(expected.map(/** 获取验收事件名。 / Get each accepted event name. */ row => row[0]).sort(), declared.sort());
});

for (const [eventType, phase, title] of expected) {
  test(`Main projects ${eventType} into a valid enterprise operation card`, /** 用合成事件执行实际合同，保留审批与证据引用。 / Run the real contract with synthetic events and retain approval/evidence references. */ () => {
    const event = {
      eventType, operationId: "operation-acceptance-synthetic", summary: "Synthetic projection acceptance",
      toolName: "dataops.feature.backfill", targetResource: "acceptance-synthetic-resource",
      approvalId: "approval-acceptance-synthetic", evidenceIds: ["evidence-acceptance-synthetic"],
    };
    const parsed = governance.parseApplicationNeuroSymbolicOperationEvent(project(event));
    assert.equal(parsed.phase, phase);
    assert.equal(parsed.title, title);
    assert.equal(parsed.operationId, event.operationId);
    assert.equal(parsed.summary, event.summary);
    assert.equal(parsed.approvalId, event.approvalId);
    assert.deepEqual(Array.from(parsed.evidenceIds), event.evidenceIds);
    assert.deepEqual(Array.from(parsed.toolNames), [event.toolName]);
    assert.equal(parsed.targetResource, event.targetResource);
  });
}
