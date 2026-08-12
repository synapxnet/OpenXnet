import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import extractZip from "extract-zip";
import yauzl, { type Entry, type ZipFile } from "yauzl";

/** 安全 ZIP 检查使用的资源预算。 */
export interface SafeZipArchiveBudget {
  readonly maximumArchiveBytes: number;
  readonly maximumExtractedBytes: number;
  readonly maximumEntries: number;
  readonly maximumEntryBytes: number;
}

/** 有界下载使用的最小响应头能力。 */
export interface ApplicationPackageFetchHeaders {
  get(name: string): string | null;
}

/** 有界下载使用的最小响应能力。 */
export interface ApplicationPackageFetchResponse {
  readonly status: number;
  readonly headers: ApplicationPackageFetchHeaders;
  readonly body: AsyncIterable<Uint8Array> | null;
}

/** Main Runtime 注入的最小 fetch 能力。 */
export type ApplicationPackageFetch = (
  url: string,
  options: { readonly redirect: "manual"; readonly signal: AbortSignal },
) => Promise<ApplicationPackageFetchResponse>;

/** 有界 HTTPS 下载策略。 */
export interface SafePackageDownloadOptions {
  readonly allowedHosts: ReadonlySet<string>;
  readonly maximumBytes: number;
  readonly timeoutMs?: number;
  readonly maximumRedirects?: number;
}

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;
const ZIP_DIRECTORY_MODE = 0o040000;
const ZIP_FILE_TYPE_MASK = 0o170000;
const ZIP_SYMBOLIC_LINK_MODE = 0o120000;

/** 判断未知值是否为普通对象；输入任意值，返回类型保护，无副作用。 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 要求对象只包含允许字段；输入未知值、字段和标签，返回普通对象，结构漂移时抛错。 */
export function requireExactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new Error(`${label} is invalid.`);
  const actualFields = Object.keys(value);
  if (actualFields.some((field) => !fields.includes(field))) throw new Error(`${label} fields are invalid.`);
  return value;
}

/** 校验稳定目录 ID；输入未知值和标签，返回规范 ID，路径字符、控制字符或超长时抛错。 */
export function requirePackageId(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 72
    || !/^[A-Za-z0-9\u3400-\u9FFF][A-Za-z0-9\u3400-\u9FFF._-]*$/u.test(normalized)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

/** 校验 ZIP 文件名；输入未知值，返回去空格名称，非 ZIP、路径字符、控制字符或超长时抛错。 */
export function requireZipFileName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Archive filename is invalid.");
  const normalized = value.trim();
  if (
    !normalized.toLowerCase().endsWith(".zip")
    || normalized.length > 255
    || normalized !== path.basename(normalized)
    || /[\\/\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new Error("Only a plain ZIP filename is supported.");
  }
  return normalized;
}

/** 创建 Runtime 私有临时目录；输入父目录和前缀，返回同卷目录，创建失败时抛错。 */
export async function createPrivateTemporaryDirectory(parent: string, prefix: string): Promise<string> {
  await mkdir(parent, { recursive: true });
  const directory = path.join(parent, `.${prefix}-${randomUUID()}`);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  return directory;
}

/** 把 preload 文件项写入受控 ZIP；输入路径或字节项、目标和预算，无返回，非法源或超限时清理目标并抛错。 */
export async function materializeArchiveEntry(
  value: unknown,
  destination: string,
  maximumBytes: number,
): Promise<string> {
  const entry = requireExactRecord(value, ["source", "path", "originalName", "bytes"], "archive entry");
  const originalName = requireZipFileName(entry.originalName);
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    if (entry.source === "path") {
      if (typeof entry.path !== "string" || !entry.path.trim() || entry.bytes !== undefined) {
        throw new Error("Archive path entry is invalid.");
      }
      const sourcePath = path.resolve(entry.path);
      const sourceInfo = await lstat(sourcePath);
      if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink() || sourceInfo.size <= 0 || sourceInfo.size > maximumBytes) {
        throw new Error("Archive file is invalid or exceeds its byte budget.");
      }
      await copyFile(sourcePath, destination);
      return originalName;
    }
    if (entry.source === "bytes") {
      if (entry.path !== undefined || !(entry.bytes instanceof Uint8Array)) {
        throw new Error("Archive byte entry is invalid.");
      }
      if (entry.bytes.byteLength <= 0 || entry.bytes.byteLength > maximumBytes) {
        throw new Error("Archive file is invalid or exceeds its byte budget.");
      }
      await writeFile(destination, entry.bytes, { flag: "wx", mode: 0o600 });
      return originalName;
    }
    throw new Error("Archive source is invalid.");
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
}

/** 下载固定主机上的有界 HTTPS 文件；输入 fetch、URL、目标和策略，返回最终 URL，重定向、状态或预算非法时清理文件并抛错。 */
export async function downloadBoundedHttpsFile(
  fetchResource: ApplicationPackageFetch,
  initialUrl: string,
  destination: string,
  options: SafePackageDownloadOptions,
): Promise<string> {
  const maximumRedirects = options.maximumRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 60_000;
  let currentUrl = requireAllowedHttpsUrl(initialUrl, options.allowedHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let redirectCount = 0; redirectCount <= maximumRedirects; redirectCount += 1) {
      const response = await fetchResource(currentUrl, { redirect: "manual", signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === maximumRedirects) throw new Error("Package download redirect is invalid.");
        currentUrl = requireAllowedHttpsUrl(new URL(location, currentUrl).toString(), options.allowedHosts);
        continue;
      }
      if (response.status !== 200 || response.body === null) {
        throw new Error(`Package download failed with status ${response.status}.`);
      }
      const declaredBytes = parseContentLength(response.headers.get("content-length"));
      if (declaredBytes !== null && (declaredBytes <= 0 || declaredBytes > options.maximumBytes)) {
        throw new Error("Package download exceeds its byte budget.");
      }
      await writeBoundedBody(response.body, destination, options.maximumBytes);
      return currentUrl;
    }
    throw new Error("Package download exceeded its redirect budget.");
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** 在解压前检查 ZIP 中全部条目；输入 ZIP 路径和预算，无返回，穿越、符号链接、加密或超限时抛错。 */
export async function inspectZipArchive(zipPath: string, budget: SafeZipArchiveBudget): Promise<void> {
  const archiveInfo = await lstat(zipPath);
  if (!archiveInfo.isFile() || archiveInfo.isSymbolicLink() || archiveInfo.size <= 0 || archiveInfo.size > budget.maximumArchiveBytes) {
    throw new Error("ZIP archive is invalid or exceeds its byte budget.");
  }
  const zipFile = await openZipFile(zipPath);
  await new Promise<void>((resolve, reject) => {
    let entries = 0;
    let extractedBytes = 0;
    const names = new Set<string>();
    let settled = false;

    /** 关闭 ZIP 并只结算一次检查 Promise；输入可选错误，无返回，不写入文件。 */
    function settle(error?: Error): void {
      if (settled) return;
      settled = true;
      zipFile.close();
      if (error) reject(error);
      else resolve();
    }

    /** 校验当前 ZIP 条目并继续读取；输入条目，无返回，非法条目会终止检查。 */
    function handleEntry(entry: Entry): void {
      try {
        entries += 1;
        if (entries > budget.maximumEntries) throw new Error("ZIP archive contains too many entries.");
        validateZipEntry(entry, names);
        if (entry.uncompressedSize > budget.maximumEntryBytes) throw new Error("ZIP entry exceeds its byte budget.");
        extractedBytes += entry.uncompressedSize;
        if (!Number.isSafeInteger(extractedBytes) || extractedBytes > budget.maximumExtractedBytes) {
          throw new Error("ZIP archive exceeds its extracted byte budget.");
        }
        zipFile.readEntry();
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)));
      }
    }

    zipFile.on("entry", handleEntry);
    zipFile.once("end", () => settle(entries === 0 ? new Error("ZIP archive is empty.") : undefined));
    zipFile.once("error", (error) => settle(error));
    zipFile.readEntry();
  });
}

/** 检查后解压 ZIP；输入 ZIP、目标和预算，无返回，失败时删除未完成目录并抛错。 */
export async function extractValidatedZip(
  zipPath: string,
  destination: string,
  budget: SafeZipArchiveBudget,
): Promise<void> {
  await inspectZipArchive(zipPath, budget);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true, mode: 0o700 });
  try {
    await extractZip(zipPath, { dir: path.resolve(destination) });
    await assertDirectoryTreeHasNoLinks(destination, budget.maximumEntries);
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

/** 查找只有一层包装目录的包根；输入解压目录和入口文件名，返回包根，结构不匹配时保留原目录。 */
export async function findSingleWrappedPackageRoot(
  extractedRoot: string,
  entryNames: readonly string[],
): Promise<string> {
  const entries = await (await import("node:fs/promises")).readdir(extractedRoot, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith(".") && entry.name !== "__MACOSX");
  if (visibleEntries.length !== 1 || !visibleEntries[0]?.isDirectory() || visibleEntries[0].isSymbolicLink()) {
    return extractedRoot;
  }
  const candidate = path.join(extractedRoot, visibleEntries[0].name);
  for (const entryName of entryNames) {
    try {
      const entryInfo = await lstat(path.join(candidate, entryName));
      if (entryInfo.isFile() && !entryInfo.isSymbolicLink()) return candidate;
    } catch {
      // 继续检查其余入口文件。
    }
  }
  return extractedRoot;
}

/** 计算 package.json 依赖指纹；输入文件路径，返回稳定哈希，文件缺失或 JSON 非法时返回 null。 */
export async function computePackageDependencyHash(packageJsonPath: string): Promise<string | null> {
  try {
    const info = await lstat(packageJsonPath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) return null;
    const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
    if (!isPlainRecord(parsed)) return null;
    const dependencyDocument = {
      dependencies: isPlainRecord(parsed.dependencies) ? parsed.dependencies : {},
      devDependencies: isPlainRecord(parsed.devDependencies) ? parsed.devDependencies : {},
      engines: isPlainRecord(parsed.engines) ? parsed.engines : {},
    };
    return createHash("sha256").update(JSON.stringify(dependencyDocument)).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

/** 读取有界 UTF-8 文本；输入文件、预算和标签，返回文本，符号链接、超限或非法 UTF-8 时抛错。 */
export async function readBoundedUtf8File(filePath: string, maximumBytes: number, label: string): Promise<string> {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximumBytes) throw new Error(`${label} is invalid.`);
  const bytes = await readFile(filePath);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** 判断候选路径是否位于根目录内；输入根目录和候选绝对路径，返回布尔值，无文件系统副作用。 */
export function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** 校验下载 URL 为固定主机 HTTPS；输入 URL 和主机集合，返回规范 URL，凭据、查询、片段或主机不符时抛错。 */
function requireAllowedHttpsUrl(value: string, allowedHosts: ReadonlySet<string>): string {
  if (typeof value !== "string" || value.length > 4096) throw new Error("Package download URL is invalid.");
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || !allowedHosts.has(host)
  ) {
    throw new Error("Package download URL is not allowed.");
  }
  return parsed.toString();
}

/** 解析 Content-Length；输入可空文本，返回非负安全整数，缺失时返回 null，非法时抛错。 */
function parseContentLength(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Package Content-Length is invalid.");
  return parsed;
}

/** 把异步响应体写入目标文件；输入字节流、目标和预算，无返回，空响应或超限时抛错。 */
async function writeBoundedBody(
  body: AsyncIterable<Uint8Array>,
  destination: string,
  maximumBytes: number,
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const handle = await open(destination, "wx", 0o600);
  let totalBytes = 0;
  try {
    for await (const chunk of body) {
      if (!(chunk instanceof Uint8Array)) throw new Error("Package response body is invalid.");
      totalBytes += chunk.byteLength;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumBytes) {
        throw new Error("Package download exceeds its byte budget.");
      }
      await handle.write(chunk);
    }
    if (totalBytes === 0) throw new Error("Package download is empty.");
  } finally {
    await handle.close();
  }
}

/** 打开 lazy-entry ZIP；输入 ZIP 路径，返回 ZipFile，格式或读取失败时拒绝。 */
function openZipFile(zipPath: string): Promise<ZipFile> {
  return new Promise<ZipFile>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (error, zipFile) => {
      if (error || !zipFile) reject(error ?? new Error("ZIP archive could not be opened."));
      else resolve(zipFile);
    });
  });
}

/** 校验单个 ZIP 条目名称和类型；输入条目与已见名称集合，无返回，路径穿越、重复、加密或符号链接时抛错。 */
function validateZipEntry(entry: Entry, names: Set<string>): void {
  const name = entry.fileName;
  if (
    !name
    || name.length > 1024
    || name.startsWith("/")
    || name.startsWith("\\")
    || WINDOWS_DRIVE_PATTERN.test(name)
    || /[\\\u0000-\u001F\u007F]/.test(name)
  ) {
    throw new Error("ZIP entry path is invalid.");
  }
  const isDirectory = name.endsWith("/");
  const segments = (isDirectory ? name.slice(0, -1) : name).split("/");
  if (segments.length === 0 || segments.length > 64 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("ZIP entry path is invalid.");
  }
  const collisionKey = segments.join("/").normalize("NFC").toLowerCase();
  if (names.has(collisionKey)) throw new Error("ZIP archive contains duplicate paths.");
  names.add(collisionKey);
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const fileType = unixMode & ZIP_FILE_TYPE_MASK;
  if (fileType === ZIP_SYMBOLIC_LINK_MODE) throw new Error("ZIP symbolic links are not allowed.");
  if (fileType !== 0 && fileType !== ZIP_DIRECTORY_MODE && fileType !== 0o100000) {
    throw new Error("ZIP special files are not allowed.");
  }
  if ((entry.generalPurposeBitFlag & 0x1) !== 0) throw new Error("Encrypted ZIP entries are not allowed.");
}

/** 解压后再次拒绝目录树中的符号链接；输入根目录和条目预算，无返回，链接或条目过多时抛错。 */
async function assertDirectoryTreeHasNoLinks(root: string, maximumEntries: number): Promise<void> {
  const canonicalRoot = await realpath(root);
  const pending = [canonicalRoot];
  let count = 0;
  while (pending.length > 0) {
    const current = pending.shift()!;
    const entries = await (await import("node:fs/promises")).readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      count += 1;
      if (count > maximumEntries) throw new Error("Extracted archive contains too many entries.");
      const candidate = path.join(current, entry.name);
      const info = await lstat(candidate);
      if (info.isSymbolicLink() || !isPathInside(canonicalRoot, candidate)) throw new Error("Extracted archive contains links.");
      if (info.isDirectory()) pending.push(candidate);
      else if (!info.isFile()) throw new Error("Extracted archive contains special files.");
    }
  }
}

/** 计算文件 SHA-256；输入普通文件路径，返回十六进制哈希，读取失败时抛错。 */
export async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

/** 读取普通文件大小；输入文件路径，返回字节数，非普通文件或符号链接时抛错。 */
export async function requireRegularFileSize(filePath: string): Promise<number> {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Package file is invalid.");
  return info.size;
}

/** 判断路径是否存在；输入路径，返回布尔值，仅吞掉缺失错误。 */
export async function pathExists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}
