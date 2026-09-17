import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export const APPEARANCE_PREFERENCES_CHANNELS = Object.freeze({
  read: "openxnet:appearance-preferences:read",
  write: "openxnet:appearance-preferences:write",
});
export const MAX_APPEARANCE_PREFERENCES_BYTES = 2 * 1024 * 1024;

export type AppearancePreferencesResult = { readonly ok: true; readonly value: string | null } | { readonly ok: false; readonly error: string };
export type AppearanceValidationResult = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string };
export interface AppearanceSyncEvent { returnValue?: AppearancePreferencesResult; }
export type AppearanceSyncListener = (event: AppearanceSyncEvent, ...arguments_: readonly unknown[]) => void;
export interface AppearanceIpcMainLike {
  on(channel: string, listener: AppearanceSyncListener): unknown;
  removeListener(channel: string, listener: AppearanceSyncListener): unknown;
}

/** File operations are injectable for atomic-write failure tests only. */
export interface AppearanceFileSystem {
  size(file: string): number;
  read(file: string): string;
  mkdir(directory: string): void;
  writeExclusive(file: string, serialized: string): void;
  rename(source: string, destination: string): void;
  unlink(file: string): void;
}
export const APPEARANCE_FILE_SYSTEM: AppearanceFileSystem = Object.freeze({
  size: (file: string) => statSync(file).size,
  read: (file: string) => readFileSync(file, "utf8"),
  mkdir: (directory: string) => { mkdirSync(directory, { recursive: true, mode: 0o700 }); },
  writeExclusive: (file: string, serialized: string) => {
    const descriptor = openSync(file, "wx", 0o600);
    try { writeFileSync(descriptor, serialized, "utf8"); fsyncSync(descriptor); }
    finally { closeSync(descriptor); }
  },
  rename: (source: string, destination: string) => { renameSync(source, destination); },
  unlink: (file: string) => { unlinkSync(file); },
});

export interface RegisterAppearancePreferencesIpcOptions {
  readonly ipcMain: AppearanceIpcMainLike;
  readonly userDataDirectory: string;
  readonly authorizeEvent: (event: unknown) => void;
  readonly authorizeReader?: (event: unknown) => void;
  readonly onDidChange?: () => void;
  readonly validateSerialized: (serialized: string) => AppearanceValidationResult;
  readonly fileSystem?: AppearanceFileSystem;
}

/**
 * Persist a bounded, validated skin library independently of the local UI origin.
 * Renderer callers can supply only serialized data, never a filesystem path.
 */
export function registerAppearancePreferencesIpc(options: RegisterAppearancePreferencesIpcOptions): () => void {
  const { ipcMain, authorizeEvent, validateSerialized } = options;
  const files = options.fileSystem ?? APPEARANCE_FILE_SYSTEM;
  const directory = path.resolve(options.userDataDirectory, "appearance");
  const destination = path.join(directory, "skins.v1.json");
  let cache: string | null | undefined;

  /** 验证皮肤文本的格式与体积。 Validate the skin text format and byte budget. */
  function validate(serialized: unknown): AppearanceValidationResult {
    if (typeof serialized !== "string" || serialized.length > MAX_APPEARANCE_PREFERENCES_BYTES || Buffer.byteLength(serialized, "utf8") > MAX_APPEARANCE_PREFERENCES_BYTES) {
      return { ok: false, error: "皮肤库必须是 2 MiB 以内的 JSON 文本。" };
    }
    try {
      const result = validateSerialized(serialized);
      if (!result.ok) return result;
      if (typeof result.value !== "string" || result.value.length > MAX_APPEARANCE_PREFERENCES_BYTES || Buffer.byteLength(result.value, "utf8") > MAX_APPEARANCE_PREFERENCES_BYTES) {
        return { ok: false, error: "皮肤库超出本地保存大小限制。" };
      }
      return result;
    } catch (_) { return { ok: false, error: "皮肤库内容或版本无效，原有皮肤未被修改。" }; }
  }

  /** 读取并缓存经过验证的皮肤库。 Read and cache the validated skin library. */
  function read(): AppearancePreferencesResult {
    if (cache !== undefined) return { ok: true, value: cache };
    try {
      if (files.size(destination) > MAX_APPEARANCE_PREFERENCES_BYTES) return { ok: false, error: "本地皮肤文件过大，原文件已保留。" };
      const result = validate(files.read(destination));
      if (!result.ok) return { ok: false, error: "本地皮肤文件损坏或版本不支持，原文件已保留。" };
      cache = result.value;
      return { ok: true, value: cache };
    } catch (cause) {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") { cache = null; return { ok: true, value: null }; }
      return { ok: false, error: "无法读取本地皮肤文件，请检查用户目录权限。" };
    }
  }

  /** 原子保存有效皮肤并保留失败前版本。 Save valid skins atomically, retaining the previous version on failure. */
  function write(serialized: unknown): AppearancePreferencesResult {
    const result = validate(serialized);
    if (!result.ok) return result;
    const existing = read();
    if (!existing.ok) return existing;
    const temporary = path.join(directory, ".skins.v1." + process.pid + "." + randomUUID() + ".tmp");
    try {
      files.mkdir(directory);
      files.writeExclusive(temporary, result.value);
      files.rename(temporary, destination);
      cache = result.value;
      return { ok: true, value: cache };
    } catch (_) {
      return { ok: false, error: "皮肤保存失败，请检查磁盘空间或目录权限；之前的皮肤未被修改。" };
    } finally {
      try { files.unlink(temporary); } catch (_) { /* The atomic rename consumes a successful temporary file. */ }
    }
  }

  /** 创建校验来源与参数的读写监听器。 Create a read/write listener that validates the caller and arguments. */
  function listener(operation: "read" | "write"): AppearanceSyncListener {
    return (event, ...arguments_) => {
      try { (operation === "read" ? options.authorizeReader ?? authorizeEvent : authorizeEvent)(event); }
      catch (_) { event.returnValue = { ok: false, error: "当前窗口无权访问本地皮肤设置。" }; return; }
      if (arguments_.length !== (operation === "read" ? 0 : 1)) {
        event.returnValue = { ok: false, error: "皮肤设置请求参数无效。" }; return;
      }
      const result = operation === "read" ? read() : write(arguments_[0]);
      // 原生returnValue是回复setter，不可作为结果缓存回读。 / Native returnValue is a reply setter, not a readable result cache.
      event.returnValue = result;
      if (operation === "write" && result.ok) {
        try { options.onDidChange?.(); } catch { /* 保存已完成，关闭的伴随窗口不影响结果。 / Saved preferences remain successful if a companion has closed. */ }
      }
    };
  }

  const readListener = listener("read"), writeListener = listener("write");
  ipcMain.on(APPEARANCE_PREFERENCES_CHANNELS.read, readListener);
  ipcMain.on(APPEARANCE_PREFERENCES_CHANNELS.write, writeListener);
  return () => {
    ipcMain.removeListener(APPEARANCE_PREFERENCES_CHANNELS.read, readListener);
    ipcMain.removeListener(APPEARANCE_PREFERENCES_CHANNELS.write, writeListener);
  };
}
