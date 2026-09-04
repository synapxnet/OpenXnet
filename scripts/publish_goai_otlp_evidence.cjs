"use strict"

const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const path = require("node:path")
const { readFile, writeFile } = require("node:fs/promises")

const RECEIPT_ID_PATTERN = /^otlp_[a-f0-9]{32}$/u
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

/** 读取必需环境变量；输入变量名和最小长度，返回去除首尾空白后的值。 */
function requireEnvironment(name, minimumLength = 1) {
  const value = String(process.env[name] || "").trim()
  if (value.length < minimumLength) throw new Error(`${name} is not configured.`)
  return value
}

/** 校验 OTLP 后端必须为 HTTPS；输入环境地址，返回带目录结尾的 URL。 */
function requireOtlpEndpoint() {
  const endpoint = new URL(requireEnvironment("OPENXNET_GOAI_OTLP_BASE_URL"))
  if (endpoint.protocol !== "https:") throw new Error("OTLP evidence endpoint must use HTTPS.")
  if (!endpoint.pathname.endsWith("/")) endpoint.pathname += "/"
  endpoint.username = ""
  endpoint.password = ""
  endpoint.search = ""
  endpoint.hash = ""
  return endpoint
}

/** 校验 Live 数据目录位于 E 盘；无输入，返回证据清单所在根目录。 */
function requireDataDirectory() {
  const value = String(
    process.env.OPENXNET_GOAI_SMOKE_DATA_DIR
      || "E:\\openxnet-temp\\openxnet-goai-live-preserved",
  ).trim()
  const resolved = path.resolve(value)
  if (!resolved.toLocaleLowerCase().startsWith("e:\\")) {
    throw new Error("Live evidence data directory must stay on drive E.")
  }
  return resolved
}

/** 计算字节内容的十六进制 SHA-256；输入 Buffer 或字符串，返回固定摘要。 */
function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

/** 读取并解析严格 UTF-8 JSON；输入文件路径，返回解析后的对象。 */
async function readUtf8JSON(filePath) {
  const bytes = await readFile(filePath)
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
}

/** 从清单条目解析指定证据文件；输入条目和文件名，校验摘要后返回路径及字节。 */
async function readManifestArtifact(entry, fileName) {
  const artifact = entry.files.find((item) => path.basename(item.path) === fileName)
  if (!artifact || !SHA256_PATTERN.test(String(artifact.sha256 || ""))) {
    throw new Error(`Manifest artifact ${fileName} is missing or invalid.`)
  }
  const bytes = await readFile(artifact.path)
  if (digest(bytes) !== artifact.sha256) throw new Error(`Manifest artifact ${fileName} digest mismatch.`)
  return { path: artifact.path, bytes }
}

/** 读取有限大小的 JSON 响应；输入 Fetch Response，返回对象并拒绝超大正文。 */
async function readBoundedResponse(response) {
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 128 * 1024) throw new Error("OTLP backend response is too large.")
  return bytes.length === 0
    ? {}
    : JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
}

/** 向 OTLP 后端投递单类信号并回读服务端回执；输入范围和载荷，返回已核验摘要。 */
async function deliverSignal(endpoint, token, incidentId, traceId, signal, payload) {
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8")
  const payloadSha256 = digest(payloadBytes)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  let response
  try {
    response = await fetch(new URL(`v1/${signal}`, endpoint), {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
        "X-OpenXnet-Incident-Id": incidentId,
        "X-OpenXnet-Trace-Id": traceId,
      },
      body: payloadBytes,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok || (response.status >= 300 && response.status < 400)) {
    throw new Error(`OTLP backend rejected ${signal} with HTTP ${response.status}.`)
  }
  await readBoundedResponse(response)
  const receiptId = String(response.headers.get("X-OpenXnet-Receipt-Id") || "")
  const acceptedDigest = String(response.headers.get("X-OpenXnet-Payload-SHA256") || "")
  if (!RECEIPT_ID_PATTERN.test(receiptId) || acceptedDigest !== payloadSha256) {
    throw new Error(`OTLP backend returned an invalid ${signal} receipt.`)
  }
  const verification = await fetch(new URL(`api/v1/receipts/${receiptId}`, endpoint), {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  })
  if (!verification.ok || (verification.status >= 300 && verification.status < 400)) {
    throw new Error(`OTLP backend receipt ${receiptId} cannot be verified.`)
  }
  const receipt = await readBoundedResponse(verification)
  assert.equal(receipt.schema, "openxnet.otlp-delivery-receipt.v1")
  assert.equal(receipt.receiptId, receiptId)
  assert.equal(receipt.incidentId, incidentId)
  assert.equal(receipt.traceId, traceId)
  assert.equal(receipt.signal, signal)
  assert.equal(receipt.payloadSha256, payloadSha256)
  assert.equal(receipt.payloadBytes, payloadBytes.length)
  return receipt
}

/** 投递正式清单中的四条 Live 遥测并生成不含凭据的服务端回执清单。 */
async function main() {
  const dataDirectory = requireDataDirectory()
  const endpoint = requireOtlpEndpoint()
  const token = requireEnvironment("OPENXNET_GOAI_OTLP_INGEST_TOKEN", 32)
  const manifestPath = path.join(dataDirectory, "competition", "evaluations", "live-evidence-manifest.json")
  const manifest = await readUtf8JSON(manifestPath)
  assert.equal(manifest.schema, "openxnet.goai-live-evidence-manifest.v1")
  assert.equal(manifest.incidentCount, 4)
  const deliveries = []
  for (const entry of manifest.exports) {
    const reportArtifact = await readManifestArtifact(entry, "evaluation-report.json")
    const telemetryArtifact = await readManifestArtifact(entry, "otel-telemetry.json")
    const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(reportArtifact.bytes))
    const telemetry = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(telemetryArtifact.bytes))
    assert.equal(report.incident.incidentId, entry.incidentId)
    assert.equal(telemetry.schema, "openxnet.otlp-evidence.v1")
    const traceId = report.incident.traceId
    assert.equal(typeof traceId, "string")
    const receipts = await Promise.all([
      deliverSignal(endpoint, token, entry.incidentId, traceId, "traces", {
        resourceSpans: telemetry.resourceSpans,
      }),
      deliverSignal(endpoint, token, entry.incidentId, traceId, "metrics", {
        resourceMetrics: telemetry.resourceMetrics,
      }),
    ])
    deliveries.push({
      incidentId: entry.incidentId,
      traceId,
      scenarioType: entry.scenarioType,
      outcome: entry.outcome,
      receipts,
    })
  }
  const receiptManifest = {
    schema: "openxnet.goai-otlp-delivery-manifest.v1",
    version: "1.2.0",
    environmentClaim: "staging",
    backend: {
      protocol: "OTLP/HTTP JSON",
      authority: endpoint.host,
      basePath: endpoint.pathname,
    },
    generatedAt: new Date().toISOString(),
    incidentCount: deliveries.length,
    signalReceiptCount: deliveries.reduce((total, item) => total + item.receipts.length, 0),
    deliveries,
  }
  const receiptPath = path.join(dataDirectory, "competition", "evaluations", "otlp-delivery-receipts.json")
  const receiptBytes = Buffer.from(`${JSON.stringify(receiptManifest, null, 2)}\n`, "utf8")
  await writeFile(receiptPath, receiptBytes)
  const updatedManifest = {
    ...manifest,
    observabilityDelivery: {
      protocol: "OTLP/HTTP JSON",
      backendAuthority: endpoint.host,
      receiptPath,
      receiptSha256: digest(receiptBytes),
      signalReceiptCount: receiptManifest.signalReceiptCount,
    },
  }
  await writeFile(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({
    success: true,
    receiptPath,
    incidentCount: receiptManifest.incidentCount,
    signalReceiptCount: receiptManifest.signalReceiptCount,
    backendAuthority: endpoint.host,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
