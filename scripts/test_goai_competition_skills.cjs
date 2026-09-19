#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 六项复赛 Skill 制品契约校验 / Six semifinal Skill artifact contract checks.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const skills = ["goai-evidence-collect", "goai-change-execute", "goai-service-verify", "synapxnet-recommendation-capacity-recovery", "synapxnet-quantitative-model-iteration", "synapxnet-feature-drift-recovery"];
const verificationCounts = { "synapxnet-recommendation-capacity-recovery": 5, "synapxnet-quantitative-model-iteration": 6, "synapxnet-feature-drift-recovery": 5 };

/** 调用制品自己的校验器，不运行工具或联网。 / Invoke the artifact's own validator without tools or network calls. */
function validate(skill, mode, value) {
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, "openxnet-skill-contract-"));
  const filename = path.join(directory, "contract.json");
  try {
    fs.writeFileSync(filename, JSON.stringify(value), "utf8");
    try {
      execFileSync(process.execPath, [path.resolve(__dirname, "../.agent/skills", skill, "scripts/validate.mjs"), mode, filename], { timeout: 5000, stdio: "pipe", windowsHide: true });
      return true;
    } catch (error) {
      // 只接受明确的合同拒绝，不把启动错误或超时算作反例通过。 / Count only explicit contract rejection, never startup failures or timeouts.
      if (error.status !== 1 || /Cannot find module|SyntaxError|ENOENT/.test(String(error.stderr))) throw error;
      return false;
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), parent);
    assert.ok(path.basename(directory).startsWith("openxnet-skill-contract-"));
    fs.rmSync(directory, { recursive: true });
  }
}

/** 读取随制品发布的公开合同示例。 / Read the public contract example shipped with the artifact. */
function example(skill, mode) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.agent/skills", skill, "references", `${mode}.example.json`), "utf8"));
}

for (const skill of skills) {
  for (const mode of ["input", "output"]) {
    test(`${skill} ${mode}: shipped example passes and wrong schema is rejected`, /** 验证正例与跨契约拒绝。 / Verify the accepted example and rejection of a foreign contract. */ () => {
      const value = example(skill, mode);
      assert.equal(validate(skill, mode, value), true);
      assert.equal(validate(skill, mode, { ...value, schema: "foreign.contract.v1" }), false);
    });
  }
  test(`${skill}: governance boundary cannot be omitted`, /** 验证各职能的必要治理边界。 / Verify each role's mandatory governance boundary. */ () => {
    const input = example(skill, "input");
    if (skill === "goai-evidence-collect") input.requiredPlatforms = ["aiops", "mlops"];
    else if (skill === "goai-change-execute") input.approvalRequired = false;
    else if (skill === "goai-service-verify") input.action.compensationPlanReady = false;
    else input.approvedStepIds.pop();
    assert.equal(validate(skill, "input", input), false);
  });
  if (verificationCounts[skill]) {
    test(`${skill}: success requires the current independent verification count`, /** 拒绝比复赛实际阈值少的独立验证。 / Reject fewer independent verifications than the semifinal baseline requires. */ () => {
      const output = example(skill, "output");
      output.verificationEvidenceIds = Array.from({ length: verificationCounts[skill] - 1 }, (_, index) => `verification-${index}`);
      assert.equal(validate(skill, "output", output), false);
      output.verificationEvidenceIds.push("verification-final");
      assert.equal(validate(skill, "output", output), true);
    });
  }
}
