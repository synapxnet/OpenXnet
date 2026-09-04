import assert from "node:assert/strict";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import archiver from "archiver";

import { extractValidatedZip, type SafeZipArchiveBudget } from "./safe-package-archive";

const TEST_BUDGET: SafeZipArchiveBudget = {
  maximumArchiveBytes: 2 * 1024 * 1024,
  maximumExtractedBytes: 4 * 1024 * 1024,
  maximumEntries: 32,
  maximumEntryBytes: 1024 * 1024,
};

/** 创建包含普通 UTF-8 文件的 ZIP；输入目标路径，文件完全写入后完成。 */
async function createRegularArchive(archivePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath, { flags: "wx" });
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    archive.append("OpenXnet 安全解压", { name: "nested/说明.txt" });
    void archive.finalize();
  });
}

/** 创建带目录逃逸目标的符号链接 ZIP；输入目标路径，归档完全写入后完成。 */
async function createSymlinkArchive(archivePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath, { flags: "wx" });
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    archive.symlink("nested/escape-link", "../../outside.txt");
    void archive.finalize();
  });
}

/** 验证受控解压保留 UTF-8 文件内容并创建必要目录。 */
test("extractValidatedZip extracts a bounded regular archive", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-safe-zip-"));
  try {
    const archivePath = path.join(root, "regular.zip");
    const destination = path.join(root, "output");
    await createRegularArchive(archivePath);
    await extractValidatedZip(archivePath, destination, TEST_BUDGET);
    assert.equal(await readFile(path.join(destination, "nested", "说明.txt"), "utf8"), "OpenXnet 安全解压");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 验证符号链接归档在写入前被拒绝，且不会在目标目录外创建文件。 */
test("extractValidatedZip rejects symbolic links before extraction", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-safe-zip-link-"));
  try {
    const archivePath = path.join(root, "symlink.zip");
    const destination = path.join(root, "output");
    await createSymlinkArchive(archivePath);
    await assert.rejects(
      extractValidatedZip(archivePath, destination, TEST_BUDGET),
      /symbolic links are not allowed/,
    );
    await assert.rejects(readFile(path.join(root, "outside.txt")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
