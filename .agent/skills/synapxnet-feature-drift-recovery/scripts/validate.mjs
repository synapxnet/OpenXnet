import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_NAME = "synapxnet-feature-drift-recovery";
const STEP_IDS = Object.freeze([
  "fallback-feature-apply", "feature-history-backfill", "repaired-dataset-gate",
  "risk-model-retrain", "risk-model-evaluation", "risk-model-register",
  "risk-canary-release", "risk-full-promotion", "fallback-feature-remove",
]);
const COMPENSATION_STEP_IDS = Object.freeze(["risk-deployment-rollback", "risk-fallback-preserve"]);
const REQUIRED_TOOLS = Object.freeze([
  "mlops.feature.fallback.apply", "dataops.feature.backfill.start", "dataops.dataset.validation.get",
  "mlops.training.search.start", "mlops.model.evaluation.run", "mlops.model.register",
  "mlops.deployment.canary.apply", "mlops.deployment.promote", "mlops.feature.fallback.remove",
]);

/** 判断未知值是否为普通对象；输入未知值，返回布尔值。 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验对象字段完全一致；输入对象、字段和标签，无返回。 */
function requireExactFields(value, fields, label) {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new Error(`${label} fields are invalid.`);
  }
}

/** 校验有界非空文本；输入值、标签和长度，无返回。 */
function requireText(value, label, maximumLength = 16 * 1024) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximumLength || value.includes("\u0000")) {
    throw new Error(`${label} is invalid.`);
  }
}

/** 校验唯一文本数组；输入值、标签和项数边界，无返回。 */
function requireTextArray(value, label, minimumItems, maximumItems = 64) {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) throw new Error(`${label} is invalid.`);
  value.forEach((item) => requireText(item, label, 256));
  if (new Set(value).size !== value.length) throw new Error(`${label} must be unique.`);
}

/** 校验数组与治理计划集合完全一致；输入实际数组、预期数组和标签，无返回。 */
function requireExactSet(value, expected, label) {
  requireTextArray(value, label, expected.length, expected.length);
  if (expected.some((item) => !value.includes(item))) throw new Error(`${label} does not match the governed plan.`);
}

/** 校验输入合同；输入未知 JSON，无返回。 */
function validateInput(value) {
  if (!isRecord(value)) throw new Error("Skill input must be an object.");
  requireExactFields(value, ["schema", "workspaceId", "incidentId", "traceId", "scenarioType", "environmentScope", "evidenceIds", "expectedResourceVersion", "approvalId", "planDigest", "approvedStepIds", "compensationStepIds", "allowedTools"], "Skill input");
  if (value.schema !== "synapxnet.skill.feature-drift.input.v1" || value.scenarioType !== "feature-drift") throw new Error("Skill input schema or scenario is invalid.");
  ["workspaceId", "incidentId", "traceId", "expectedResourceVersion", "approvalId"].forEach((field) => requireText(value[field], field, 128));
  if (!["simulation", "staging", "shadow", "canary", "production"].includes(value.environmentScope)) throw new Error("environmentScope is invalid.");
  requireTextArray(value.evidenceIds, "evidenceIds", 9);
  if (typeof value.planDigest !== "string" || !/^[a-f0-9]{64}$/u.test(value.planDigest)) throw new Error("planDigest is invalid.");
  requireExactSet(value.approvedStepIds, STEP_IDS, "approvedStepIds");
  requireExactSet(value.compensationStepIds, COMPENSATION_STEP_IDS, "compensationStepIds");
  requireTextArray(value.allowedTools, "allowedTools", REQUIRED_TOOLS.length, 32);
  if (REQUIRED_TOOLS.some((toolName) => !value.allowedTools.includes(toolName))) throw new Error("allowedTools does not cover the governed plan.");
}

/** 校验输出合同；输入未知 JSON，无返回。 */
function validateOutput(value) {
  if (!isRecord(value)) throw new Error("Skill output must be an object.");
  requireExactFields(value, ["schema", "outcome", "actionId", "completedStepIds", "verificationEvidenceIds", "finalResourceVersion", "retrospectiveSkillId", "summary"], "Skill output");
  if (value.schema !== "synapxnet.skill.feature-drift.output.v1" || !["SUCCEEDED", "ROLLBACK_REQUIRED", "HALT"].includes(value.outcome)) throw new Error("Skill output schema or outcome is invalid.");
  requireText(value.actionId, "actionId", 128);
  requireText(value.finalResourceVersion, "finalResourceVersion", 128);
  requireText(value.summary, "summary");
  if (value.retrospectiveSkillId !== SKILL_NAME) throw new Error("retrospectiveSkillId is invalid.");
  requireTextArray(value.completedStepIds, "completedStepIds", value.outcome === "SUCCEEDED" ? STEP_IDS.length : 0, STEP_IDS.length);
  if (value.completedStepIds.some((stepId) => !STEP_IDS.includes(stepId))) throw new Error("completedStepIds is invalid.");
  if (value.outcome === "SUCCEEDED") requireExactSet(value.completedStepIds, STEP_IDS, "completedStepIds");
  requireTextArray(value.verificationEvidenceIds, "verificationEvidenceIds", value.outcome === "SUCCEEDED" ? 5 : 0, 64);
}

/** 读取 UTF-8 JSON 并执行指定合同校验；输入命令行参数，成功时输出固定摘要。 */
async function main() {
  const [mode, filePath] = process.argv.slice(2);
  if (!["input", "output"].includes(mode) || !filePath) throw new Error("Usage: node scripts/validate.mjs <input|output> <json-file>");
  const value = JSON.parse(await readFile(path.resolve(filePath), "utf8"));
  if (mode === "input") validateInput(value);
  else validateOutput(value);
  process.stdout.write(`${SKILL_NAME} ${mode} contract is valid.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
