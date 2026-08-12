"use strict"

const fs = require("node:fs")
const path = require("node:path")

const VERIFIED_LICENSE_FALLBACKS = new Map([
  ["qrcode-terminal@0.12.0", "Apache-2.0"],
])

/** 把普通值编码为 RFC 4180 兼容 CSV 单元格。 */
function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

/** 从 package-lock 的 node_modules 路径解析实际包名，支持作用域包和嵌套依赖。 */
function packageNameFromLockPath(lockPath, entry) {
  if (typeof entry.name === "string" && entry.name.trim()) return entry.name.trim()
  const marker = "node_modules/"
  const index = lockPath.lastIndexOf(marker)
  const relative = index >= 0 ? lockPath.slice(index + marker.length) : lockPath
  const segments = relative.split("/").filter(Boolean)
  if (segments[0]?.startsWith("@")) return segments.slice(0, 2).join("/")
  return segments[0] || "UNKNOWN"
}

/** 解析锁文件许可证，并为已核验但锁文件缺字段的内置依赖提供离线回退值。 */
function licenseFromLockEntry(name, version, entry) {
  const declared = String(entry.license || "").trim()
  if (declared) return declared
  return VERIFIED_LICENSE_FALLBACKS.get(`${name}@${version}`) || "UNKNOWN"
}

/** 将 package-lock 依赖转换为稳定排序的许可证记录并保留未知项。 */
function collectInventory(lock) {
  const records = []
  for (const [lockPath, entry] of Object.entries(lock.packages || {})) {
    if (!lockPath.includes("node_modules/") || typeof entry !== "object" || entry === null) continue
    const name = packageNameFromLockPath(lockPath, entry)
    const version = String(entry.version || "UNKNOWN")
    records.push({
      name,
      version,
      license: licenseFromLockEntry(name, version, entry),
      developmentOnly: Boolean(entry.dev),
      resolved: String(entry.resolved || ""),
    })
  }
  records.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version))
  return records
}

/** 把许可证记录写成 UTF-8 无 BOM CSV，并统一使用 LF 换行。 */
function writeInventory(outputPath, records) {
  const rows = [
    ["module name", "version", "license", "development only", "resolved"],
    ...records.map((record) => [
      record.name,
      record.version,
      record.license,
      record.developmentOnly ? "true" : "false",
      record.resolved,
    ]),
  ]
  const csv = `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, csv, "utf8")
}

/** 读取锁文件、生成清单并输出总依赖数和未知许可证数。 */
function main() {
  const projectRoot = path.resolve(__dirname, "..")
  const lockPath = path.join(projectRoot, "package-lock.json")
  const outputPath = path.join(projectRoot, "LICENSE-third-party", "node_licenses.csv")
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
  const records = collectInventory(lock)
  writeInventory(outputPath, records)
  const unknown = records.filter((record) => record.license === "UNKNOWN").length
  console.log(JSON.stringify({ outputPath, packages: records.length, unknownLicenses: unknown }))
}

main()
