"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PROJECT_ROOT = path.resolve(__dirname, "..");

/** 验证桌面主进程只使用受维护的直接 ZIP 依赖，避免安装包缺模块或重新引入已知漏洞。 */
test("packaged main-process ZIP dependencies are direct and maintained", () => {
  const packageDocument = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  const archiveSource = readFileSync(
    path.join(PROJECT_ROOT, "src/desktop/package-management/safe-package-archive.ts"),
    "utf8",
  );
  assert.equal(packageDocument.dependencies?.["extract-zip"], undefined);
  assert.equal(packageDocument.dependencies?.yauzl, "2.10.0");
  assert.equal(archiveSource.includes('from "extract-zip"'), false);
  assert.doesNotThrow(() => require.resolve("yauzl/package.json", { paths: [PROJECT_ROOT] }));
});

/** 验证 Windows 发布入口先生成内置 Memory Pack，并把稳定目录复制到安装资源。 */
test("Windows release includes the bundled Memory feature pack", () => {
  const packageDocument = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  assert.match(
    packageDocument.scripts?.["build:win"] ?? "",
    /build:feature-pack:memory:bundled/,
  );
  assert.equal(
    packageDocument.scripts?.["build:feature-pack:memory:bundled"],
    ".\\.venv\\Scripts\\python.exe scripts\\build_memory_feature_pack.py --output artifacts\\feature-packs\\bundled\\memory",
  );
  const bundledResource = packageDocument.build?.extraResources?.find(
    (item) => item?.to === "feature-packs/memory",
  );
  assert.equal(bundledResource?.from, "artifacts/feature-packs/bundled/memory/");
  assert.deepEqual(bundledResource?.filter, ["**/*"]);
});

/** 验证复赛发行版携带固定摘要的真实记忆迁移包，而不是未审计的初始化样例。 */
test("GOAI staging release includes its publisher-locked Memory transfer", () => {
  const packageDocument = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  const transfer = JSON.parse(
    readFileSync(path.join(PROJECT_ROOT, "data/goai-staging-memory-transfer.v1.json"), "utf8"),
  );
  const mainSource = readFileSync(path.join(PROJECT_ROOT, "main.js"), "utf8");
  const bundledResource = packageDocument.build?.extraResources?.find(
    (item) => item?.to === "bootstrap/goai-staging-memory-transfer.v1.json",
  );

  assert.equal(packageDocument.openxnet?.releaseProfile, "goai-staging");
  assert.equal(bundledResource?.from, "data/goai-staging-memory-transfer.v1.json");
  assert.equal(transfer.schema, "openxnet.synapxnet-memory-transfer.v1");
  assert.equal(transfer.entries?.length, 12);
  assert.equal(transfer.entries.every((entry) => entry.tags?.includes("goai-staging")), true);
  const memoryTypes = transfer.entries.map((entry) => (
    entry.tags.find((tag) => tag.startsWith("memory-type:"))?.slice("memory-type:".length)
  ));
  const payloads = transfer.entries.map((entry) => (
    JSON.parse(Buffer.from(entry.payloadBase64, "base64").toString("utf8"))
  ));
  assert.deepEqual([...new Set(memoryTypes)].sort(), ["collaboration", "decision", "incident", "skill"]);
  assert.equal(payloads.every((payload) => /[\u3400-\u9fff]/u.test(payload.title)), true);
  assert.equal(payloads.every((payload) => !payload.content.includes("\uFFFD")), true);
  assert.match(mainSource, new RegExp(transfer.manifestSha256, "u"));
});
