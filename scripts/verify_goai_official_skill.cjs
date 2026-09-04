"use strict"

const assert = require("node:assert/strict")
const path = require("node:path")
const { mkdir, writeFile } = require("node:fs/promises")

const {
  CompetitionPaiEasOfficialSkillBoundary,
} = require("../build-ts/desktop/competition/competition-official-skill-boundary")

/** 解析位于 E 盘的正式证据目录；无输入，返回可写的 evaluations 路径。 */
function resolveEvidenceDirectory() {
  const root = path.resolve(String(
    process.env.OPENXNET_GOAI_SMOKE_DATA_DIR
      || "E:\\openxnet-temp\\openxnet-goai-live-preserved",
  ).trim())
  if (!root.toLocaleLowerCase().startsWith("e:\\")) {
    throw new Error("Official Skill evidence directory must stay on drive E.")
  }
  return path.join(root, "competition", "evaluations")
}

/** 校验 PAI EAS 官方 Skill 供应链和只读边界，并输出不含凭据的证明文件。 */
async function main() {
  const boundary = new CompetitionPaiEasOfficialSkillBoundary({
    assetDirectory: path.resolve(".agent", "skills", "alibabacloud-pai-eas-service-diagnose"),
  })
  const snapshot = await boundary.inspect()
  assert.equal(snapshot.supplyChainVerified, true)
  assert.equal(snapshot.executionStatus, "NOT_CONFIGURED")
  assert.equal(snapshot.allowMutation, false)
  assert.equal(snapshot.allowCredentialReadback, false)
  assert.equal(snapshot.allowedOperations.length, 10)
  assert.equal(snapshot.allowedOperations.every((operation) => /^(?:Describe|List)/u.test(operation)), true)
  const attestation = {
    schema: "openxnet.goai-official-skill-attestation.v1",
    version: "1.2.0",
    generatedAt: new Date().toISOString(),
    environmentClaim: "staging",
    supplyChain: snapshot,
    cloudExecution: {
      status: "NOT_CONFIGURED",
      reason: "比赛环境未配置 Alibaba Cloud PAI EAS 账号和 Aliyun CLI 身份，因此禁止伪造云诊断结果。",
      productionEvidenceClaimed: false,
    },
  }
  const directory = resolveEvidenceDirectory()
  await mkdir(directory, { recursive: true })
  const outputPath = path.join(directory, "official-skill-readonly-attestation.json")
  await writeFile(outputPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({
    success: true,
    outputPath,
    skillId: snapshot.skillId,
    supplyChainVerified: snapshot.supplyChainVerified,
    executionStatus: snapshot.executionStatus,
    writeOperationCount: 0,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
