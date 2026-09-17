/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话文件预览与原生操作边界 / Conversation file preview and native action boundary.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import type { IpcMainLike } from "./register-core-ipc";

export const CONVERSATION_FILE_CHANNELS = Object.freeze({
  read: "openxnet:conversation-files:read",
  editors: "openxnet:conversation-files:editors",
  act: "openxnet:conversation-files:act",
  select: "openxnet:conversation-files:select",
});
export const CONVERSATION_FILE_PREVIEW_BYTES = 1024 * 1024;
const DEFAULT_OPEN_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".rtf"]);
const TEXT_EXTENSIONS = new Set(["", ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl", ".jsonc", ".log", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml", ".html", ".htm", ".svg", ".css", ".scss", ".less", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".py", ".pyi", ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd", ".c", ".h", ".cpp", ".hpp", ".cs", ".java", ".go", ".rs", ".rb", ".php", ".sql", ".r", ".swift", ".kt", ".gitignore", ".env", ".lock", ".diff", ".patch"]);

export interface ConversationFilePreview {
  readonly path: string;
  readonly content: string | null;
  readonly binary: boolean;
  readonly truncated: boolean;
  readonly sizeBytes: number;
  readonly sha256: string | null;
  readonly source: "workspace" | "selected-file";
  readonly canOpenDefault: boolean;
  readonly grantId?: string;
}
export interface ConversationFileEditor { readonly id: string; readonly label: string; }
interface InstalledEditor extends ConversationFileEditor { readonly executable: string; }
export interface ConversationFileActionResult { readonly success: boolean; readonly canceled?: boolean; }
export interface ConversationFileOptions {
  readonly ipcMain: IpcMainLike;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWorkspacePath: () => unknown;
  readonly chooseFile: (suggestedPath?: string) => Promise<string | null>;
  readonly chooseSavePath: (sourcePath: string) => Promise<string | null>;
  readonly openDefault: (file: string) => Promise<string>;
  readonly reveal: (file: string) => void;
  readonly platform?: NodeJS.Platform;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly launchEditor?: (executable: string, arguments_: readonly string[]) => Promise<void>;
}
interface AuthorizedFile { readonly path: string; readonly root: string | null; readonly grantId?: string; }

/** 检查IPC字段与类型，拒绝任意参数扩展。 / Validate IPC fields and types without accepting arbitrary options. */
function requestRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("文件请求格式无效 / Invalid file request.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(/** 拒绝非契约字段。 / Reject fields outside the contract. */ key => !fields.includes(key))) throw new Error("文件请求包含未知字段 / Unsupported file request fields.");
  return record;
}

/** 拒绝设备、流、控制字符和Windows保留文件名。 / Reject devices, streams, control characters, and reserved Windows filenames. */
function safePath(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value) || /^[\\/]{2}[?.][\\/]/.test(value)) throw new Error("文件路径无效 / Invalid file path.");
  const withoutDrive = /^[a-z]:[\\/]/i.test(value) ? value.slice(2) : value;
  if (withoutDrive.includes(":") || value.split(/[\\/]/).some(/** 阻止设备别名与有歧义的尾部字符。 / Block device aliases and ambiguous trailing characters. */ part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || /[. ]$/.test(part) && part !== "." && part !== "..")) throw new Error("不支持设备或数据流路径 / Device and stream paths are unsupported.");
  return value;
}

/** 比较规范路径，Windows下忽略大小写。 / Compare canonical paths case-insensitively on Windows. */
function samePath(left: string, right: string): boolean { return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right; }

/** 验证文件严格位于工作区内。 / Require a file to be strictly inside the workspace. */
function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return !!relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** 仅启动已检测编辑器，文件路径作为独立参数且禁用shell。 / Launch only a detected editor with separate path arguments and no shell. */
function launchInstalledEditor(executable: string, arguments_: readonly string[]): Promise<void> {
  return new Promise(/** 等待真实spawn结果，不等待编辑器关闭。 / Wait for actual spawn success without waiting for editor exit. */ (resolve, reject) => {
    const child = spawn(executable, [...arguments_], { shell: false, windowsHide: true, detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", /** 编辑器独立运行。 / Let the editor run independently. */ () => { child.unref(); resolve(); });
  });
}

/** 注册有工作区与精确文件授权约束的原生会话文件服务。 / Register native conversation file services constrained by workspace or exact-file grants. */
export function registerConversationFilesIpc(options: ConversationFileOptions): () => void {
  const grants = new Map<string, string>();
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;

  /** 根据Main当前工作区或原生选择结果授权一个真实普通文件。 / Authorize one regular file against Main's current workspace or a native selection. */
  async function authorizeFile(request: Record<string, unknown>): Promise<AuthorizedFile> {
    const candidate = safePath(request.path);
    if (request.grantId !== undefined) {
      if (typeof request.grantId !== "string" || !grants.has(request.grantId)) throw new Error("文件授权已失效，请重新选择 / File grant expired; select the file again.");
      const expected = grants.get(request.grantId)!;
      const actual = await realpath(candidate);
      if (!samePath(actual, expected) || !samePath(path.resolve(candidate), expected)) throw new Error("授权仅适用于已选择文件 / The grant applies only to the selected file.");
      if (!(await stat(actual)).isFile()) throw new Error("请选择普通文件 / Select a regular file.");
      return { path: actual, root: null, grantId: request.grantId };
    }
    const configured = safePath(options.getWorkspacePath());
    const root = await realpath(configured);
    if (!(await stat(root)).isDirectory()) throw new Error("当前工作区不可用 / Current workspace is unavailable.");
    if (request.workspacePath !== undefined && (!samePath(await realpath(safePath(request.workspacePath)), root))) throw new Error("工作区已切换，请重新打开文件 / Workspace changed; reopen the file.");
    const lexical = path.resolve(root, candidate);
    if (!isInside(root, lexical)) throw new Error("文件位于当前工作区外，请手动选择 / File is outside the current workspace; select it manually.");
    const actual = await realpath(lexical);
    if (!isInside(root, actual)) throw new Error("文件链接指向工作区外 / File link escapes the workspace.");
    if (!(await stat(actual)).isFile()) throw new Error("请选择普通文件 / Select a regular file.");
    return { path: actual, root };
  }

  /** 重新核验路径与当前授权，防止对话框期间工作区或链接被替换。 / Recheck paths and grants after dialogs to catch workspace or link changes. */
  async function revalidate(request: Record<string, unknown>, expected: AuthorizedFile): Promise<AuthorizedFile> {
    const current = await authorizeFile(request);
    if (!samePath(current.path, expected.path) || current.root !== expected.root) throw new Error("文件位置或工作区已变化 / File location or workspace changed.");
    return current;
  }

  /** 有界读取真实文本，二进制与截断文件不伪造完整哈希。 / Read bounded real text without inventing full hashes for truncated files. */
  async function readAuthorized(request: Record<string, unknown>): Promise<ConversationFilePreview> {
    const authorized = await authorizeFile(request);
    const handle = await open(authorized.path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const initial = await handle.stat();
      if (!initial.isFile()) throw new Error("请选择普通文件 / Select a regular file.");
      await revalidate(request, authorized);
      const target = await stat(authorized.path);
      if (target.dev !== initial.dev || target.ino !== initial.ino) throw new Error("读取期间文件已替换 / File was replaced during reading.");
      const bytes = Buffer.alloc(Math.min(initial.size, CONVERSATION_FILE_PREVIEW_BYTES) + 1);
      let bytesRead = 0;
      while (bytesRead < bytes.length) {
        const chunk = await handle.read(bytes, bytesRead, bytes.length - bytesRead, bytesRead);
        if (!chunk.bytesRead) break;
        bytesRead += chunk.bytesRead;
      }
      const truncated = initial.size > CONVERSATION_FILE_PREVIEW_BYTES || bytesRead > CONVERSATION_FILE_PREVIEW_BYTES;
      const contentBytes = bytes.subarray(0, Math.min(bytesRead, CONVERSATION_FILE_PREVIEW_BYTES));
      const final = await handle.stat();
      if (initial.size !== final.size || initial.mtimeMs !== final.mtimeMs || contentBytes.length < Math.min(initial.size, CONVERSATION_FILE_PREVIEW_BYTES)) throw new Error("读取期间文件已变化，请重试 / File changed during reading; retry.");
      await revalidate(request, authorized);
      const current = await stat(authorized.path);
      if (current.dev !== final.dev || current.ino !== final.ino || current.size !== final.size || current.mtimeMs !== final.mtimeMs) throw new Error("读取期间文件已替换或变化 / File was replaced or changed during reading.");
      let content: string | null = null;
      let binary = !TEXT_EXTENSIONS.has(path.extname(authorized.path).toLowerCase()) || contentBytes.includes(0);
      if (!binary) {
        try { content = new TextDecoder("utf-8", { fatal: true }).decode(contentBytes, { stream: truncated }); }
        catch { binary = true; }
      }
      return {
        path: authorized.path, content, binary, truncated, sizeBytes: initial.size,
        sha256: truncated ? null : createHash("sha256").update(contentBytes).digest("hex"),
        source: authorized.grantId ? "selected-file" : "workspace",
        canOpenDefault: DEFAULT_OPEN_EXTENSIONS.has(path.extname(authorized.path).toLowerCase()),
        ...(authorized.grantId ? { grantId: authorized.grantId } : {}),
      };
    } finally { await handle.close(); }
  }

  /** 检测固定安装目录中的实际编辑器，不查询用户文件或执行PATH命令。 / Detect real editors in fixed install locations without probing user files or executing PATH commands. */
  async function detectEditors(): Promise<InstalledEditor[]> {
    const candidates: InstalledEditor[] = [];
    /** 追加有真实安装根目录的固定编辑器候选。 / Add a fixed editor candidate only when its install root is known. */
    function add(id: string, label: string, root: string | undefined, ...segments: string[]): void {
      if (root && path.isAbsolute(root)) candidates.push({ id, label, executable: path.join(root, ...segments) });
    }
    if (platform === "win32") {
      for (const root of [environment.LOCALAPPDATA && path.join(environment.LOCALAPPDATA, "Programs"), environment.ProgramFiles, environment["ProgramFiles(x86)"]]) {
        add("vscode", "Visual Studio Code", root, "Microsoft VS Code", "Code.exe");
        add("cursor", "Cursor", root, "Cursor", "Cursor.exe");
        add("vscodium", "VSCodium", root, "VSCodium", "VSCodium.exe");
        add("notepad-plus-plus", "Notepad++", root, "Notepad++", "notepad++.exe");
      }
      add("notepad", "记事本 / Notepad", environment.SystemRoot, "System32", "notepad.exe");
    } else if (platform === "darwin") {
      add("vscode", "Visual Studio Code", "/Applications", "Visual Studio Code.app", "Contents", "MacOS", "Electron");
      add("cursor", "Cursor", "/Applications", "Cursor.app", "Contents", "MacOS", "Cursor");
    } else {
      add("vscode", "Visual Studio Code", "/usr/bin", "code");
      add("vscodium", "VSCodium", "/usr/bin", "codium");
    }
    const found = new Map<string, InstalledEditor>();
    for (const candidate of candidates) {
      if (found.has(candidate.id)) continue;
      try {
        const executable = await realpath(candidate.executable);
        if ((await stat(executable)).isFile()) found.set(candidate.id, { ...candidate, executable });
      } catch { /* 未安装的编辑器不显示。 / Editors that are not installed stay absent. */ }
    }
    return [...found.values()];
  }

  /** 校验来源后读取当前文件。 / Read the current file after validating its sender. */
  async function handleRead(event: unknown, value: unknown): Promise<ConversationFilePreview> {
    options.authorizeEvent(event);
    return readAuthorized(requestRecord(value, ["workspacePath", "path", "grantId"]));
  }

  /** 仅返回已检测编辑器的固定ID与名称。 / Return only detected editors' fixed IDs and names. */
  async function handleEditors(event: unknown): Promise<ConversationFileEditor[]> {
    options.authorizeEvent(event);
    return (await detectEditors()).map(/** 可执行文件路径留在Main。 / Keep executable paths in Main. */ ({ id, label }) => ({ id, label }));
  }

  /** 原生选择只授权一个精确文件，不扩大为目录权限。 / Native selection grants one exact file and never grants its directory. */
  async function handleSelect(event: unknown, value: unknown = {}): Promise<ConversationFilePreview | { canceled: true }> {
    options.authorizeEvent(event);
    const request = requestRecord(value, ["path"]);
    const suggested = request.path === undefined ? undefined : safePath(request.path);
    const selected = await options.chooseFile(suggested);
    if (!selected) return { canceled: true };
    const canonical = await realpath(safePath(selected));
    if (!(await stat(canonical)).isFile()) throw new Error("请选择普通文件 / Select a regular file.");
    const grantId = randomUUID();
    grants.set(grantId, canonical);
    if (grants.size > 256) grants.delete(grants.keys().next().value!);
    try { return await readAuthorized({ path: canonical, grantId }); }
    catch (error) { grants.delete(grantId); throw error; }
  }

  /** 只分派显式原生操作，另存为目标只能来自系统对话框。 / Dispatch only explicit native actions and accept save targets only from the system dialog. */
  async function handleAct(event: unknown, value: unknown): Promise<ConversationFileActionResult> {
    options.authorizeEvent(event);
    const request = requestRecord(value, ["workspacePath", "path", "grantId", "action", "editorId"]);
    if (!["open-default", "reveal", "save-as", "open-editor"].includes(String(request.action))) throw new Error("不支持的文件操作 / Unsupported file action.");
    const file = await authorizeFile(request);
    if (request.action === "open-default") {
      if (!DEFAULT_OPEN_EXTENSIONS.has(path.extname(file.path).toLowerCase())) throw new Error("此文件请使用编辑器打开，不能直接执行 / Open this file in an editor; direct execution is unavailable.");
      await revalidate(request, file);
      const error = await options.openDefault(file.path);
      if (error) throw new Error(error);
    } else if (request.action === "reveal") {
      await revalidate(request, file); options.reveal(file.path);
    } else if (request.action === "open-editor") {
      const editor = (await detectEditors()).find(/** ID必须对应实际检测结果。 / Require the ID to match a real detected editor. */ item => item.id === request.editorId);
      if (!editor) throw new Error("编辑器未安装或已不可用 / Editor is not installed or is unavailable.");
      await revalidate(request, file);
      await (options.launchEditor ?? launchInstalledEditor)(editor.executable, [file.path]);
    } else {
      const destination = await options.chooseSavePath(file.path);
      if (!destination) return { success: false, canceled: true };
      const selected = path.resolve(safePath(destination));
      const parent = await realpath(path.dirname(selected));
      const target = path.join(parent, path.basename(selected));
      await revalidate(request, file);
      if (samePath(target, file.path)) throw new Error("请选择新副本位置 / Select a new copy location.");
      await copyFile(file.path, target, constants.COPYFILE_EXCL);
    }
    return { success: true };
  }

  const channels = Object.values(CONVERSATION_FILE_CHANNELS);
  for (const channel of channels) options.ipcMain.removeHandler(channel);
  options.ipcMain.handle(CONVERSATION_FILE_CHANNELS.read, handleRead);
  options.ipcMain.handle(CONVERSATION_FILE_CHANNELS.editors, handleEditors);
  options.ipcMain.handle(CONVERSATION_FILE_CHANNELS.act, handleAct);
  options.ipcMain.handle(CONVERSATION_FILE_CHANNELS.select, handleSelect);
  /** 关闭全部文件接口并清除临时单文件授权。 / Close all file interfaces and clear temporary exact-file grants. */
  return function cleanup(): void {
    for (const channel of channels) options.ipcMain.removeHandler(channel);
    grants.clear();
  };
}
