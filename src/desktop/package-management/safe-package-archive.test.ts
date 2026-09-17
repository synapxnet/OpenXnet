import assert from "node:assert/strict";
import { createWriteStream } from "node:fs";
import fileSystem, { mkdtemp, readFile, rm, type FileHandle } from "node:fs/promises";
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

/** 创建指定压缩级别的普通文件ZIP；Create regular-file ZIP fixtures with the requested compression level. */
async function createRegularArchive(
  archivePath: string,
  level: 0 | 6 = 6,
  entries: readonly { readonly name: string; readonly content: string }[] = [
    { name: "nested/说明.txt", content: "OpenXnet 安全解压" },
  ],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath, { flags: "wx" });
    const archive = archiver("zip", { zlib: { level } });
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    for (const entry of entries) archive.append(entry.content, { name: entry.name });
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

/** 验证无压缩流、空文件和后续条目均结束；Verify stored streams, empty files, and later entries complete. */
test("extractValidatedZip extracts stored, empty and subsequent files", { timeout: 3000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-safe-zip-stored-"));
  try {
    const archivePath = path.join(root, "stored.zip");
    const destination = path.join(root, "output");
    const content = "OpenXnet 无压缩技能\n".repeat(8192);
    await createRegularArchive(archivePath, 0, [
      { name: "skill/SKILL.md", content },
      { name: "skill/empty.txt", content: "" },
      { name: "skill/last.txt", content: "last entry" },
    ]);
    await extractValidatedZip(archivePath, destination, TEST_BUDGET);
    assert.equal(await readFile(path.join(destination, "skill", "SKILL.md"), "utf8"), content);
    assert.equal((await readFile(path.join(destination, "skill", "empty.txt"))).length, 0);
    assert.equal(await readFile(path.join(destination, "skill", "last.txt"), "utf8"), "last entry");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 验证写入失败取消读取、关闭文件并清除半成品；Verify write failure cancels reading and cleans open files/output. */
test("extractValidatedZip cleans stored extraction after a write failure", { timeout: 3000 }, async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openxnet-safe-zip-write-failure-"));
  const destination = path.join(root, "output");
  const targetPath = path.join(destination, "skill", "SKILL.md");
  const originalOpen = fileSystem.open;
  let failedHandle: FileHandle | undefined;
  try {
    const archivePath = path.join(root, "stored.zip");
    const content = "OpenXnet stored skill\n".repeat(8192);
    await createRegularArchive(archivePath, 0, [{ name: "skill/SKILL.md", content }]);
    // 在真实文件句柄上模拟磁盘写入失败；Inject disk failure on a real file handle.
    context.mock.method(fileSystem, "open", async (...args: Parameters<typeof originalOpen>) => {
      const handle = await originalOpen(...args);
      if (args[0] === targetPath) {
        failedHandle = handle;
        context.mock.method(handle, "write", async () => { throw new Error("simulated disk write failure"); });
      }
      return handle;
    });
    await assert.rejects(extractValidatedZip(archivePath, destination, TEST_BUDGET), /simulated disk write failure/);
    assert.ok(failedHandle);
    assert.equal(failedHandle.fd, -1);
    await assert.rejects(fileSystem.stat(destination), { code: "ENOENT" });
    context.mock.restoreAll();
    await extractValidatedZip(archivePath, destination, TEST_BUDGET);
    assert.equal(await readFile(targetPath, "utf8"), content);
  } finally {
    context.mock.restoreAll();
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
