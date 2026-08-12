import assert from "node:assert/strict";
import { createWriteStream, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import archiver from "archiver";

import { ApplicationExtensionRuntimeService } from "./application-extension-runtime";

interface ZipFixtureEntry {
  readonly name: string;
  readonly content: string;
  readonly mode?: number;
}

/** 创建测试 ZIP；输入目标和条目，返回完成 Promise，归档写入失败时拒绝。 */
function createZipFixture(destination: string, entries: readonly ZipFixtureEntry[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = archiver("zip", { zlib: { level: 0 } });
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    for (const entry of entries) archive.append(entry.content, { name: entry.name, mode: entry.mode });
    void archive.finalize();
  });
}

/** 把测试 ZIP 的指定中央目录条目标记为 Unix 符号链接；输入 ZIP 和名称，无返回，条目缺失时抛错。 */
function markZipEntryAsSymbolicLink(destination: string, entryName: string): void {
  const archive = readFileSync(destination);
  const expectedName = Buffer.from(entryName, "utf8");
  for (let offset = 0; offset <= archive.length - 46; offset += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength);
    if (!name.equals(expectedName)) continue;
    archive.writeUInt16LE(0x0314, offset + 4);
    archive.writeUInt32LE((0o120777 << 16) >>> 0, offset + 38);
    writeFileSync(destination, archive);
    return;
  }
  throw new Error(`ZIP fixture entry was not found: ${entryName}`);
}

test("Extension Runtime serves isolated static and supervised Node extensions without Python", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-extension-runtime-"));
  const extensionRoot = path.join(root, "ext");
  const staticRoot = path.join(extensionRoot, "static-demo");
  const nodeRoot = path.join(extensionRoot, "node-demo");
  mkdirSync(staticRoot, { recursive: true });
  mkdirSync(nodeRoot, { recursive: true });
  writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><title>static runtime</title>", "utf8");
  writeFileSync(path.join(staticRoot, "package.json"), JSON.stringify({ name: "Static Demo", version: "2.0.0" }), "utf8");
  writeFileSync(path.join(nodeRoot, "package.json"), JSON.stringify({ name: "Node Demo", dependencies: {} }), "utf8");
  writeFileSync(
    path.join(nodeRoot, "index.js"),
    [
      "const http = require('node:http');",
      "const port = Number(process.argv[2]);",
      "http.createServer((_request, response) => {",
      "  response.end(process.env.OPENXNET_TEST_SECRET ? 'secret-leaked' : 'node-runtime');",
      "}).listen(port, '127.0.0.1');",
      "",
    ].join("\n"),
    "utf8",
  );
  process.env.OPENXNET_TEST_SECRET = "must-not-leak";
  const runtime = new ApplicationExtensionRuntimeService({
    extensionRoot,
    nodeExecutable: process.execPath,
    npmCliPath: process.execPath,
  });
  try {
    const catalog = await runtime.listExtensions();
    assert.deepEqual(catalog.extensions.map((item) => item.id), ["node-demo", "static-demo"]);
    const staticResult = await runtime.startExtension({ extensionId: "static-demo" });
    assert.equal(staticResult.mode, "static");
    assert.equal(await (await fetch(staticResult.url)).text(), "<!doctype html><title>static runtime</title>");
    assert.notEqual(new URL(staticResult.url).origin, "http://127.0.0.1:3456");

    const nodeResult = await runtime.startExtension({ extensionId: "node-demo" });
    assert.equal(nodeResult.mode, "node");
    assert.equal(await (await fetch(nodeResult.url)).text(), "node-runtime");
    await runtime.stopExtension({ extensionId: "node-demo" });
    assert.equal((await fetch(nodeResult.url)).status, 404);
  } finally {
    delete process.env.OPENXNET_TEST_SECRET;
    await runtime.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Extension Runtime imports bounded ZIP files and rejects symbolic links", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-extension-archive-"));
  const extensionRoot = path.join(root, "ext");
  mkdirSync(extensionRoot, { recursive: true });
  const validArchive = path.join(root, "本机扩展.zip");
  const linkedArchive = path.join(root, "linked.zip");
  await createZipFixture(validArchive, [
    { name: "index.html", content: "<!doctype html><title>本机扩展</title>" },
    { name: "package.json", content: JSON.stringify({ name: "本机扩展", repository: "https://github.com/demo/local" }) },
  ]);
  await createZipFixture(linkedArchive, [
    { name: "index.html", content: "<!doctype html>" },
    { name: "unsafe-link", content: "index.html", mode: 0o120777 },
  ]);
  markZipEntryAsSymbolicLink(linkedArchive, "unsafe-link");
  const runtime = new ApplicationExtensionRuntimeService({
    extensionRoot,
    nodeExecutable: process.execPath,
    npmCliPath: process.execPath,
  });
  try {
    const installed = await runtime.importArchive({
      entry: { source: "path", path: validArchive, originalName: "本机扩展.zip" },
    });
    assert.equal(installed.extension.id, "本机扩展");
    assert.equal(installed.extension.name, "本机扩展");
    await assert.rejects(
      runtime.importArchive({ entry: { source: "path", path: linkedArchive, originalName: "linked.zip" } }),
      /symbolic links/i,
    );
    assert.throws(
      () => runtime.installFromRepository({ repository: "https://attacker.example.test/demo/ext" }),
      /host is not allowed/i,
    );
    await runtime.removeExtension({ extensionId: "本机扩展" });
    assert.equal((await runtime.listExtensions()).extensions.some((item) => item.id === "本机扩展"), false);
  } finally {
    await runtime.close();
    rmSync(root, { recursive: true, force: true });
  }
});
