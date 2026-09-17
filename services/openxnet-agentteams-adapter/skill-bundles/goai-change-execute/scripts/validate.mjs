import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = path.basename(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const RULES = Object.freeze({
  "goai-evidence-collect": Object.freeze({
    inputSchema: "goai.skill.evidence-collect.input.v1.1",
    outputSchema: "goai.skill.evidence-collect.output.v1.1",
    inputFields: Object.freeze(["schema", "incidentId", "traceId", "availableTools", "requiredPlatforms", "approvalRequiredTools"]),
    decisions: Object.freeze(["COLLECT_EVIDENCE"]),
    inputEvidenceMinimum: 0,
    outputEvidenceMinimum: 0,
    outputToolMinimum: 3,
  }),
  "goai-change-execute": Object.freeze({
    inputSchema: "goai.skill.change-execute.input.v1.1",
    outputSchema: "goai.skill.change-execute.output.v1.1",
    inputFields: Object.freeze(["schema", "incidentId", "traceId", "evidence", "proposedPlan", "approvalRequired"]),
    decisions: Object.freeze(["REQUEST_APPROVAL", "HALT"]),
    inputEvidenceMinimum: 3,
    outputEvidenceMinimum: 1,
    outputToolMinimum: 0,
  }),
  "goai-service-verify": Object.freeze({
    inputSchema: "goai.skill.service-verify.input.v1.1",
    outputSchema: "goai.skill.service-verify.output.v1.1",
    inputFields: Object.freeze(["schema", "incidentId", "traceId", "action", "evidence", "policy"]),
    decisions: Object.freeze(["CLOSE", "ROLLBACK_REQUIRED"]),
    inputEvidenceMinimum: 3,
    outputEvidenceMinimum: 3,
    outputToolMinimum: 0,
  }),
});

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

/** 读取有界非空文本；输入值、标签和长度，无返回。 */
function requireText(value, label, maximumLength = 16 * 1024) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximumLength || value.includes("\u0000")) {
    throw new Error(`${label} is invalid.`);
  }
}

/** 校验唯一文本数组；输入值、标签、最小项和最大项，无返回。 */
function requireTextArray(value, label, minimumItems, maximumItems = 64) {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) {
    throw new Error(`${label} is invalid.`);
  }
  value.forEach((item) => requireText(item, label, 256));
  if (new Set(value).size !== value.length) throw new Error(`${label} must be unique.`);
}

/** 校验 SHA-256 摘要；输入未知值和标签，无返回。 */
function requireDigest(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

/** 校验完整变更计划；输入未知对象，无返回，拒绝缺失补偿或重复步骤。 */
function validateProposedPlan(value) {
  if (!isRecord(value)) throw new Error("proposedPlan is invalid.");
  requireExactFields(value, ["planId", "planDigest", "steps", "compensationSteps"], "proposedPlan");
  requireText(value.planId, "proposedPlan.planId", 128);
  requireDigest(value.planDigest, "proposedPlan.planDigest");
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 16
      || !Array.isArray(value.compensationSteps) || value.compensationSteps.length < 1 || value.compensationSteps.length > 8) {
    throw new Error("proposedPlan steps are invalid.");
  }
  const seen = new Set();
  for (const step of [...value.steps, ...value.compensationSteps]) {
    if (!isRecord(step)) throw new Error("proposedPlan step is invalid.");
    requireExactFields(step, ["stepId", "toolName", "resourceId", "targetRevision", "expectedResourceVersion", "argumentsDigest", "dependsOn"], "proposedPlan step");
    requireText(step.stepId, "stepId", 128);
    requireText(step.toolName, "toolName", 160);
    requireText(step.resourceId, "resourceId", 512);
    requireText(step.expectedResourceVersion, "expectedResourceVersion", 128);
    requireDigest(step.argumentsDigest, "argumentsDigest");
    requireTextArray(step.dependsOn, "dependsOn", 0, 16);
    if (!Number.isInteger(step.targetRevision) || step.targetRevision < 1 || seen.has(step.stepId)) {
      throw new Error("proposedPlan step scope is invalid.");
    }
    seen.add(step.stepId);
  }
}

/** 校验独立验证动作引用；输入未知对象，无返回。 */
function validateVerificationAction(value) {
  if (!isRecord(value)) throw new Error("action is invalid.");
  requireExactFields(value, ["actionId", "planId", "planDigest", "toolName", "resourceVersionAfter", "completedStepCount", "compensationPlanReady", "outcome"], "action");
  requireText(value.actionId, "actionId", 128);
  requireText(value.planId, "planId", 128);
  requireDigest(value.planDigest, "planDigest");
  requireText(value.toolName, "toolName", 160);
  requireText(value.resourceVersionAfter, "resourceVersionAfter", 128);
  if (!Number.isInteger(value.completedStepCount) || value.completedStepCount < 1 || value.completedStepCount > 32
      || value.compensationPlanReady !== true || !["ACCEPTED", "SUCCEEDED"].includes(value.outcome)) {
    throw new Error("action completion scope is invalid.");
  }
}

/** 校验 Skill 输入包络；输入未知 JSON 和规则，无返回。 */
function validateInput(value, rule) {
  if (!isRecord(value)) throw new Error("Skill input must be an object.");
  requireExactFields(value, rule.inputFields, "Skill input");
  if (value.schema !== rule.inputSchema) throw new Error("Skill input schema is invalid.");
  requireText(value.incidentId, "incidentId", 128);
  requireText(value.traceId, "traceId", 128);
  if ("evidence" in value) {
    if (!Array.isArray(value.evidence) || value.evidence.length < rule.inputEvidenceMinimum || value.evidence.length > 64) {
      throw new Error("evidence is invalid.");
    }
  }
  if ("availableTools" in value) requireTextArray(value.availableTools, "availableTools", 3, 32);
  if ("requiredPlatforms" in value) {
    requireTextArray(value.requiredPlatforms, "requiredPlatforms", 3, 3);
    if (!["aiops", "dataops", "mlops"].every((platform) => value.requiredPlatforms.includes(platform))) {
      throw new Error("requiredPlatforms must cover all three platforms.");
    }
  }
  if ("approvalRequiredTools" in value) requireTextArray(value.approvalRequiredTools, "approvalRequiredTools", 1, 32);
  if ("proposedPlan" in value) validateProposedPlan(value.proposedPlan);
  if ("action" in value) validateVerificationAction(value.action);
  if ("policy" in value) {
    if (!isRecord(value.policy)) throw new Error("policy is invalid.");
    requireTextArray(value.policy.requiredVerificationTools, "requiredVerificationTools", 3, 16);
  }
}

/** 校验 Skill 输出包络；输入未知 JSON 和规则，无返回。 */
function validateOutput(value, rule) {
  if (!isRecord(value)) throw new Error("Skill output must be an object.");
  requireExactFields(value, ["schema", "decision", "summary", "confidence", "requestedToolNames", "evidenceIds"], "Skill output");
  if (value.schema !== rule.outputSchema || !rule.decisions.includes(value.decision)) {
    throw new Error("Skill output schema or decision is invalid.");
  }
  requireText(value.summary, "summary");
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    throw new Error("confidence is invalid.");
  }
  requireTextArray(value.requestedToolNames, "requestedToolNames", rule.outputToolMinimum, 32);
  requireTextArray(value.evidenceIds, "evidenceIds", rule.outputEvidenceMinimum, 64);
}

/** 读取文件并执行输入或输出校验；输入命令行参数，成功时输出固定摘要。 */
async function main() {
  const [mode, filePath] = process.argv.slice(2);
  const rule = RULES[SKILL_NAME];
  if (!rule || !["input", "output"].includes(mode) || !filePath) {
    throw new Error("Usage: node scripts/validate.mjs <input|output> <json-file>");
  }
  const value = JSON.parse(await readFile(path.resolve(filePath), "utf8"));
  if (mode === "input") validateInput(value, rule);
  else validateOutput(value, rule);
  process.stdout.write(`${SKILL_NAME} ${mode} contract is valid.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
