"use strict"

const assert = require("node:assert/strict")
const { execFile } = require("node:child_process")
const { promisify } = require("node:util")
const { readFile } = require("node:fs/promises")
const path = require("node:path")

const executeFile = promisify(execFile)
const SKILL_NAMES = Object.freeze([
  "goai-evidence-collect",
  "goai-change-execute",
  "goai-service-verify",
])

/** 读取 UTF-8 JSON 文件；输入路径，返回解析值。 */
async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

/** 从工具名中提取平台前缀；输入工具名数组，返回去重后的平台集合。 */
function collectToolPlatforms(toolNames) {
  return new Set(toolNames.map((toolName) => toolName.split(".", 1)[0]))
}

/** 校验 JSON Schema 使用通用受限工具名，而不是遗留的固定三工具枚举。 */
function validateGenericToolSchema(toolSchema) {
  assert.equal(toolSchema.type, "string")
  assert.equal(typeof toolSchema.pattern, "string")
  assert.equal(toolSchema.enum, undefined)
}

/** 校验一个 GOAI Skill 的结构、Schema、示例和可执行验证器；输入 Skill 根目录，无返回。 */
async function validateSkill(skillRoot) {
  const skillName = path.basename(skillRoot)
  const markdown = await readFile(path.join(skillRoot, "SKILL.md"), "utf8")
  assert.match(markdown, new RegExp(`name: ${skillName}`, "u"))
  assert.match(markdown, /Version: `1\.1\.0`/u)
  assert.doesNotMatch(markdown, /TODO/u)
  const inputSchema = await readJson(path.join(skillRoot, "schemas", "input.schema.json"))
  const outputSchema = await readJson(path.join(skillRoot, "schemas", "output.schema.json"))
  const inputExample = await readJson(path.join(skillRoot, "references", "input.example.json"))
  const outputExample = await readJson(path.join(skillRoot, "references", "output.example.json"))
  assert.match(inputSchema.$id, /\/1\.1\.0\/input\.schema\.json$/u)
  assert.match(outputSchema.$id, /\/1\.1\.0\/output\.schema\.json$/u)
  if (skillName === "goai-evidence-collect") {
    validateGenericToolSchema(inputSchema.properties.availableTools.items)
    validateGenericToolSchema(inputSchema.properties.approvalRequiredTools.items)
    assert.deepEqual(inputExample.requiredPlatforms, ["aiops", "dataops", "mlops"])
    assert.deepEqual(collectToolPlatforms(inputExample.availableTools), new Set(["aiops", "dataops", "mlops"]))
    assert.ok(inputExample.approvalRequiredTools.length >= 3)
    assert.equal(outputExample.requestedToolNames.some((toolName) => inputExample.approvalRequiredTools.includes(toolName)), false)
  } else if (skillName === "goai-change-execute") {
    const proposedPlan = inputSchema.properties.proposedPlan
    assert.deepEqual(proposedPlan.required, ["planId", "planDigest", "steps", "compensationSteps"])
    validateGenericToolSchema(inputSchema.$defs.planStep.properties.toolName)
    assert.ok(inputExample.proposedPlan.steps.length >= 2)
    assert.ok(inputExample.proposedPlan.compensationSteps.length >= 1)
    assert.match(inputExample.proposedPlan.planDigest, /^[a-f0-9]{64}$/u)
    assert.deepEqual(outputExample.requestedToolNames, [])
  } else if (skillName === "goai-service-verify") {
    const actionSchema = inputSchema.properties.action
    assert.deepEqual(actionSchema.required, [
      "actionId",
      "planId",
      "planDigest",
      "toolName",
      "resourceVersionAfter",
      "completedStepCount",
      "compensationPlanReady",
      "outcome",
    ])
    validateGenericToolSchema(actionSchema.properties.toolName)
    validateGenericToolSchema(inputSchema.properties.evidence.items.properties.toolName)
    validateGenericToolSchema(inputSchema.properties.policy.properties.requiredVerificationTools.items)
    assert.deepEqual(collectToolPlatforms(inputExample.policy.requiredVerificationTools), new Set(["aiops", "dataops", "mlops"]))
    assert.equal(inputExample.action.compensationPlanReady, true)
    assert.ok(inputExample.action.completedStepCount >= 1)
    assert.deepEqual(outputExample.requestedToolNames, [])
  }
  const validator = path.join(skillRoot, "scripts", "validate.mjs")
  for (const mode of ["input", "output"]) {
    const example = path.join(skillRoot, "references", `${mode}.example.json`)
    const result = await executeFile(process.execPath, [validator, mode, example], { encoding: "utf8" })
    assert.match(result.stdout, new RegExp(`${skillName} ${mode} contract is valid\\.`, "u"))
  }
}

/** 校验三个比赛 Skill 源包；无输入，失败时返回非零退出码。 */
async function main() {
  const root = path.resolve(__dirname, "..", ".agent", "skills")
  for (const skillName of SKILL_NAMES) await validateSkill(path.join(root, skillName))
  process.stdout.write(`Validated ${SKILL_NAMES.length} GOAI competition skills.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
