import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DesktopCore } from "../core/desktop-core";
import type {
  ApplicationVoiceReferenceResult,
  ApplicationVoiceCatalogItem,
  ApplicationVoiceCatalogResult,
  ApplicationVoiceProviderCatalogRequest,
  ApplicationVoiceSynthesisRequest,
  ApplicationVoiceSynthesisResult,
  ApplicationVoiceTranscriptionRequest,
  ApplicationVoiceTranscriptionResult,
  RemoveApplicationVoiceReferenceResult,
} from "../contracts/application-voice-runtime";
import { parseApplicationVoiceCredentialScope } from "../contracts/application-voice-credentials";
import type { WorkerSupervisor } from "../workers/worker-supervisor";

/** 桌面语音请求允许的音频格式集合。 */
const APPLICATION_VOICE_FORMATS = new Set([
  "wav",
  "mp3",
  "flac",
  "ogg",
  "m4a",
  "opus",
  "aac",
]);

/** Voice Worker 允许返回给 Renderer 的音频格式与标准媒体类型。 */
const APPLICATION_VOICE_SYNTHESIS_MEDIA_TYPES: ReadonlyMap<string, string> = new Map([
  ["mp3", "audio/mpeg"],
  ["opus", "audio/ogg"],
  ["wav", "audio/wav"],
  ["aac", "audio/aac"],
  ["flac", "audio/flac"],
] as const);

/** Desktop 音色目录允许访问的固定供应商集合。 */
const APPLICATION_VOICE_CATALOG_PROVIDERS = new Set([
  "azure",
  "volcengine",
  "baidu",
  "minimax",
  "xunfei",
  "fish",
  "google",
]);

/** Main-owned 参考音频允许的固定扩展名集合。 */
const APPLICATION_VOICE_REFERENCE_EXTENSIONS = new Set([
  "wav",
  "mp3",
  "flac",
  "ogg",
  "m4a",
  "opus",
  "aac",
]);

/** Main-owned 参考音频存储名格式，只接受 UUID 与固定音频扩展名。 */
const APPLICATION_VOICE_REFERENCE_STORAGE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(wav|mp3|flac|ogg|m4a|opus|aac)$/i;

/** Application Voice Runtime 的依赖和资源预算。 */
export interface ApplicationVoiceRuntimeOptions {
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly exchangeRoot: string;
  readonly referenceRoot: string;
  readonly readAsrSettings: () => Readonly<Record<string, unknown>>;
  readonly readTtsSettings: () => Readonly<Record<string, unknown>>;
  readonly maxAudioBytes?: number;
  readonly maxSettingsBytes?: number;
  readonly maxSynthesisBytes?: number;
  readonly maxReferenceBytes?: number;
}

/** 经过运行时校验后的独立音频副本。 */
interface ParsedVoiceRequest {
  readonly audio: Buffer;
  readonly format: string;
}

/** 校验后可发送给 Voice Worker 的无设置语音合成参数。 */
interface ParsedVoiceSynthesisRequest {
  readonly text: string;
  readonly voice: string;
  readonly index: number;
  readonly mobileOptimized: boolean;
}

/** 校验后可由 Main 导入的路径或内联参考音频。 */
interface ParsedVoiceReferenceRequest {
  readonly originalName: string;
  readonly extension: string;
  readonly sourcePath?: string;
  readonly bytes?: Buffer;
}

/** 将桌面 Renderer 的一次性录音安全委托给独立 Voice Worker。 */
export class ApplicationVoiceRuntimeService {
  private readonly exchangeRoot: string;
  private readonly referenceRoot: string;
  private readonly maxAudioBytes: number;
  private readonly maxSettingsBytes: number;
  private readonly maxSynthesisBytes: number;
  private readonly maxReferenceBytes: number;

  /** 创建不启动 Worker 的语音服务；首次真实请求才激活 voice capability。 */
  public constructor(private readonly options: ApplicationVoiceRuntimeOptions) {
    this.exchangeRoot = path.resolve(options.exchangeRoot);
    this.referenceRoot = path.resolve(options.referenceRoot);
    this.maxAudioBytes = options.maxAudioBytes ?? 25 * 1024 * 1024;
    this.maxSettingsBytes = options.maxSettingsBytes ?? 2 * 1024 * 1024;
    this.maxSynthesisBytes = options.maxSynthesisBytes ?? 25 * 1024 * 1024;
    this.maxReferenceBytes = options.maxReferenceBytes ?? 25 * 1024 * 1024;
  }

  /** 校验 Renderer 音频、写入私有 artifact、请求转写并始终删除临时文件。 */
  public async transcribe(request: unknown): Promise<ApplicationVoiceTranscriptionResult> {
    const parsed = this.parseRequest(request);
    await mkdir(this.exchangeRoot, { recursive: true, mode: 0o700 });
    const artifactPath = path.join(
      this.exchangeRoot,
      `renderer-input-${randomUUID()}.${parsed.format}`,
    );
    await writeFile(artifactPath, parsed.audio, { flag: "wx", mode: 0o600 });
    try {
      const settings = this.readSettings(this.options.readAsrSettings, "ASR");
      await this.options.core.ensureCapability("voice");
      const response = await this.options.supervisor.request(
        "voice",
        "voice.transcribe-configured",
        {
          artifactPath,
          format: parsed.format,
          settings,
        },
      );
      return this.parseResponse(response);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw error;
      }
      throw new Error("Desktop voice transcription is unavailable.");
    } finally {
      await unlink(artifactPath).catch(() => undefined);
    }
  }

  /** 校验合成参数、注入 Main 持有的 TTS 设置，并以内存音频返回一次 Worker 结果。 */
  public async synthesize(request: unknown): Promise<ApplicationVoiceSynthesisResult> {
    const parsed = this.parseSynthesisRequest(request);
    let artifactPath = "";
    try {
      const settings = this.readSettings(this.options.readTtsSettings, "TTS");
      await this.options.core.ensureCapability("voice");
      const response = await this.options.supervisor.request(
        "voice",
        "voice.synthesize",
        {
          ...parsed,
          format: parsed.mobileOptimized ? "opus" : "mp3",
          settings,
        },
      );
      artifactPath = this.parseSynthesisArtifactPath(response);
      return await this.readSynthesisArtifact(response, artifactPath);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw error;
      }
      throw new Error("Desktop voice synthesis is unavailable.");
    } finally {
      if (artifactPath) {
        await unlink(artifactPath).catch(() => undefined);
      }
    }
  }

  /** 显式激活 Voice Worker 并返回有界系统音色目录；调用前不导入 pyttsx3。 */
  public async listSystemVoices(): Promise<ApplicationVoiceCatalogResult> {
    return this.requestVoiceCatalog("voice.list-system-voices", {});
  }

  /** 校验固定供应商与凭据作用域，并返回 Worker 投影后的公开音色目录。 */
  public async listProviderVoices(request: unknown): Promise<ApplicationVoiceCatalogResult> {
    const parsed = this.parseProviderCatalogRequest(request);
    const settings = this.readSettings(this.options.readTtsSettings, "TTS");
    return this.requestVoiceCatalog("voice.list-provider-voices", {
      ...parsed,
      settings,
    });
  }

  /** 导入一条 preload 授权的参考音频；原子写入固定目录且不激活 Voice Worker。 */
  public async importReference(request: unknown): Promise<ApplicationVoiceReferenceResult> {
    const parsed = this.parseReferenceImportRequest(request);
    let temporaryPath = "";
    try {
      const audio = parsed.bytes ?? await this.readReferenceSource(parsed.sourcePath ?? "");
      if (audio.length < 1 || audio.length > this.maxReferenceBytes) {
        throw new RangeError("Desktop voice reference exceeds its size budget.");
      }
      await mkdir(this.referenceRoot, { recursive: true, mode: 0o700 });
      const storageName = `${randomUUID()}.${parsed.extension}`;
      const destinationPath = path.join(this.referenceRoot, storageName);
      temporaryPath = path.join(this.referenceRoot, `.${storageName}.${randomUUID()}.tmp`);
      await writeFile(temporaryPath, audio, { flag: "wx", mode: 0o600 });
      await rename(temporaryPath, destinationPath);
      temporaryPath = "";
      return {
        storageName,
        originalName: parsed.originalName,
        sizeBytes: audio.length,
      };
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw error;
      }
      throw new Error("Desktop voice reference import is unavailable.");
    } finally {
      if (temporaryPath) {
        await unlink(temporaryPath).catch(() => undefined);
      }
    }
  }

  /** 删除一个固定 UUID 存储名对应的参考音频；文件缺失时返回幂等未删除结果。 */
  public async removeReference(request: unknown): Promise<RemoveApplicationVoiceReferenceResult> {
    const storageName = this.parseReferenceStorageNameRequest(request);
    const filePath = path.join(this.referenceRoot, storageName);
    try {
      const metadata = await lstat(filePath);
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error("Desktop voice reference is invalid.");
      }
      await unlink(filePath);
      return { storageName, removed: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return { storageName, removed: false };
      }
      throw new Error("Desktop voice reference removal is unavailable.");
    }
  }

  /** 解析精确请求字段并复制音频，拒绝空数据、超限数据和未知格式。 */
  private parseRequest(request: unknown): ParsedVoiceRequest {
    if (!this.isRecord(request) || !this.hasExactFields(request, ["audio", "format"])) {
      throw new TypeError("Desktop voice request is invalid.");
    }
    const format = typeof request.format === "string" ? request.format.trim().toLowerCase() : "";
    if (!APPLICATION_VOICE_FORMATS.has(format)) {
      throw new TypeError("Desktop voice request format is invalid.");
    }
    let audio: Buffer;
    if (request.audio instanceof ArrayBuffer) {
      audio = Buffer.from(request.audio.slice(0));
    } else if (ArrayBuffer.isView(request.audio)) {
      const view = request.audio;
      audio = Buffer.from(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    } else {
      throw new TypeError("Desktop voice request audio is invalid.");
    }
    if (audio.length < 1 || audio.length > this.maxAudioBytes) {
      throw new RangeError("Desktop voice request audio exceeds its size budget.");
    }
    return { audio, format };
  }

  /** 解析精确合成请求，拒绝空文本、控制字符、超长 voice 和越界索引。 */
  private parseSynthesisRequest(request: unknown): ParsedVoiceSynthesisRequest {
    if (
      !this.isRecord(request)
      || !this.hasExactFields(request, ["text", "voice", "index", "mobileOptimized"])
    ) {
      throw new TypeError("Desktop voice synthesis request is invalid.");
    }
    const text = typeof request.text === "string" ? request.text.trim() : "";
    const voice = typeof request.voice === "string" ? request.voice.trim() : "";
    if (
      !text
      || text.length > 20_000
      || [...text].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    ) {
      throw new TypeError("Desktop voice synthesis text is invalid.");
    }
    if (
      !voice
      || voice.length > 128
      || [...voice].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    ) {
      throw new TypeError("Desktop voice synthesis voice is invalid.");
    }
    if (
      typeof request.index !== "number"
      || !Number.isInteger(request.index)
      || request.index < 0
      || request.index > 10_000
    ) {
      throw new RangeError("Desktop voice synthesis index is invalid.");
    }
    if (typeof request.mobileOptimized !== "boolean") {
      throw new TypeError("Desktop voice synthesis mobile flag is invalid.");
    }
    return { text, voice, index: request.index, mobileOptimized: request.mobileOptimized };
  }

  /** 解析精确供应商目录请求；拒绝未知 Provider、额外字段和无效凭据作用域。 */
  private parseProviderCatalogRequest(request: unknown): ApplicationVoiceProviderCatalogRequest {
    if (!this.isRecord(request) || !this.hasExactFields(request, ["provider", "credentialScope"])) {
      throw new TypeError("Desktop voice catalog request is invalid.");
    }
    const provider = typeof request.provider === "string" ? request.provider.trim().toLowerCase() : "";
    if (!APPLICATION_VOICE_CATALOG_PROVIDERS.has(provider)) {
      throw new TypeError("Desktop voice catalog provider is invalid.");
    }
    return {
      provider: provider as ApplicationVoiceProviderCatalogRequest["provider"],
      credentialScope: parseApplicationVoiceCredentialScope(request.credentialScope),
    };
  }

  /** 解析 preload 所有权参考音频请求；拒绝额外字段、非音频扩展和超限内联字节。 */
  private parseReferenceImportRequest(request: unknown): ParsedVoiceReferenceRequest {
    if (!this.isRecord(request) || !this.hasExactFields(request, ["entry"]) || !this.isRecord(request.entry)) {
      throw new TypeError("Desktop voice reference request is invalid.");
    }
    const entry = request.entry;
    const originalName = this.parseReferenceOriginalName(entry.originalName);
    const extension = path.extname(originalName).slice(1).toLowerCase();
    if (!APPLICATION_VOICE_REFERENCE_EXTENSIONS.has(extension)) {
      throw new TypeError("Desktop voice reference format is invalid.");
    }
    if (entry.source === "path") {
      if (!this.hasExactFields(entry, ["source", "path", "originalName"])) {
        throw new TypeError("Desktop voice reference path request is invalid.");
      }
      const sourcePath = typeof entry.path === "string" ? entry.path.trim() : "";
      if (
        !sourcePath
        || !path.isAbsolute(sourcePath)
        || sourcePath.length > 32_768
        || /[\u0000-\u001F\u007F]/.test(sourcePath)
      ) {
        throw new TypeError("Desktop voice reference source path is invalid.");
      }
      return { originalName, extension, sourcePath: path.resolve(sourcePath) };
    }
    if (entry.source === "bytes") {
      if (
        !this.hasExactFields(entry, ["source", "bytes", "originalName"])
        || !(entry.bytes instanceof Uint8Array)
      ) {
        throw new TypeError("Desktop voice reference bytes request is invalid.");
      }
      if (entry.bytes.byteLength < 1 || entry.bytes.byteLength > this.maxReferenceBytes) {
        throw new RangeError("Desktop voice reference exceeds its size budget.");
      }
      return {
        originalName,
        extension,
        bytes: Buffer.from(entry.bytes.buffer.slice(
          entry.bytes.byteOffset,
          entry.bytes.byteOffset + entry.bytes.byteLength,
        )),
      };
    }
    throw new TypeError("Desktop voice reference source is invalid.");
  }

  /** 读取 preload 授权的普通文件并复核大小；符号链接、目录和读取期间变化均失败。 */
  private async readReferenceSource(sourcePath: string): Promise<Buffer> {
    const metadata = await lstat(sourcePath);
    if (
      !metadata.isFile()
      || metadata.isSymbolicLink()
      || metadata.size < 1
      || metadata.size > this.maxReferenceBytes
    ) {
      throw new RangeError("Desktop voice reference source exceeds its size budget.");
    }
    const bytes = await readFile(sourcePath);
    if (bytes.length !== metadata.size) {
      throw new Error("Desktop voice reference source changed while reading.");
    }
    return bytes;
  }

  /** 规范参考音频原始文件名；禁止目录分隔符、控制字符和超长名称。 */
  private parseReferenceOriginalName(value: unknown): string {
    if (typeof value !== "string") {
      throw new TypeError("Desktop voice reference original name is invalid.");
    }
    const originalName = value.trim();
    if (
      !originalName
      || originalName.length > 255
      || originalName === "."
      || originalName === ".."
      || /[\\/\u0000-\u001F\u007F]/.test(originalName)
    ) {
      throw new TypeError("Desktop voice reference original name is invalid.");
    }
    return originalName;
  }

  /** 解析精确删除请求并只接受 Main 生成的 UUID 音频存储名。 */
  private parseReferenceStorageNameRequest(request: unknown): string {
    if (!this.isRecord(request) || !this.hasExactFields(request, ["storageName"])) {
      throw new TypeError("Desktop voice reference removal request is invalid.");
    }
    const storageName = typeof request.storageName === "string" ? request.storageName.trim() : "";
    if (!APPLICATION_VOICE_REFERENCE_STORAGE_PATTERN.test(storageName)) {
      throw new TypeError("Desktop voice reference storage name is invalid.");
    }
    return storageName;
  }

  /** 复制 Main 的无密钥 ASR 设置，并对序列化大小实施独立预算。 */
  private readSettings(
    reader: () => Readonly<Record<string, unknown>>,
    label: string,
  ): Record<string, unknown> {
    const settings = reader();
    if (!this.isRecord(settings)) {
      throw new TypeError(`Desktop voice ${label} settings are invalid.`);
    }
    const serialized = JSON.stringify(settings);
    if (Buffer.byteLength(serialized, "utf8") > this.maxSettingsBytes) {
      throw new RangeError(`Desktop voice ${label} settings exceed their size budget.`);
    }
    const detached = JSON.parse(serialized) as unknown;
    if (!this.isRecord(detached)) {
      throw new TypeError(`Desktop voice ${label} settings are invalid.`);
    }
    return detached;
  }

  /** 校验 Worker 输出路径只位于 Voice 交换目录；失败时不删除或读取目录外目标。 */
  private parseSynthesisArtifactPath(response: Readonly<Record<string, unknown>>): string {
    const value = response.artifactPath;
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Desktop voice synthesis response is invalid.");
    }
    const artifactPath = path.resolve(value);
    const relativePath = path.relative(this.exchangeRoot, artifactPath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Desktop voice synthesis artifact is outside its exchange root.");
    }
    return artifactPath;
  }

  /** 读取并校验一次性 Worker 音频，返回独立 ArrayBuffer；调用方负责最终删除文件。 */
  private async readSynthesisArtifact(
    response: Readonly<Record<string, unknown>>,
    artifactPath: string,
  ): Promise<ApplicationVoiceSynthesisResult> {
    const format = response.format;
    const mediaType = response.mediaType;
    const byteLength = response.byteLength;
    if (
      typeof format !== "string"
      || !APPLICATION_VOICE_SYNTHESIS_MEDIA_TYPES.has(format)
      || typeof mediaType !== "string"
      || APPLICATION_VOICE_SYNTHESIS_MEDIA_TYPES.get(format) !== mediaType
      || typeof byteLength !== "number"
      || !Number.isInteger(byteLength)
      || byteLength < 1
      || byteLength > this.maxSynthesisBytes
    ) {
      throw new Error("Desktop voice synthesis response is invalid.");
    }
    const metadata = await lstat(artifactPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== byteLength) {
      throw new Error("Desktop voice synthesis artifact is invalid.");
    }
    const audio = await readFile(artifactPath);
    if (audio.length !== byteLength) {
      throw new Error("Desktop voice synthesis artifact changed while reading.");
    }
    const detachedAudio = audio.buffer.slice(
      audio.byteOffset,
      audio.byteOffset + audio.byteLength,
    ) as ArrayBuffer;
    return {
      audio: detachedAudio,
      mediaType,
      format: format as ApplicationVoiceSynthesisResult["format"],
    };
  }

  /** 调用一个固定 Voice 目录方法并统一隐藏 Worker、依赖和供应商错误。 */
  private async requestVoiceCatalog(
    method: "voice.list-system-voices" | "voice.list-provider-voices",
    payload: Readonly<Record<string, unknown>>,
  ): Promise<ApplicationVoiceCatalogResult> {
    try {
      await this.options.core.ensureCapability("voice");
      const response = await this.options.supervisor.request("voice", method, payload);
      return this.parseVoiceCatalogResponse(response);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        throw error;
      }
      throw new Error("Desktop voice catalog is unavailable.");
    }
  }

  /** 把 Worker 异构目录再次投影为固定公开字段，并限制条目数和总 UTF-8 大小。 */
  private parseVoiceCatalogResponse(
    response: Readonly<Record<string, unknown>>,
  ): ApplicationVoiceCatalogResult {
    if (!Array.isArray(response.voices) || response.voices.length > 512) {
      throw new Error("Desktop voice catalog response is invalid.");
    }
    const voices = response.voices.map((value): ApplicationVoiceCatalogItem => {
      if (!this.isRecord(value)) {
        throw new Error("Desktop voice catalog item is invalid.");
      }
      const item: {
        id: string;
        name: string;
        displayName?: string;
        shortName?: string;
        locale?: string;
        description?: string;
        originalName?: string;
        lang?: string;
        gender?: string;
        premium?: boolean;
      } = {
        id: this.parseCatalogText(value.id, "id"),
        name: this.parseCatalogText(value.name, "name"),
      };
      for (const field of [
        "displayName",
        "shortName",
        "locale",
        "description",
        "originalName",
        "lang",
        "gender",
      ] as const) {
        if (value[field] !== undefined) {
          item[field] = this.parseCatalogText(value[field], field);
        }
      }
      if (value.premium !== undefined) {
        if (typeof value.premium !== "boolean") {
          throw new Error("Desktop voice catalog premium flag is invalid.");
        }
        item.premium = value.premium;
      }
      return item;
    });
    if (Buffer.byteLength(JSON.stringify(voices), "utf8") > 1024 * 1024) {
      throw new Error("Desktop voice catalog response exceeds its size budget.");
    }
    return { voices };
  }

  /** 读取一个公开目录字符串并限制为 512 字符；失败时不回显 Worker 原值。 */
  private parseCatalogText(value: unknown, fieldName: string): string {
    if (typeof value !== "string") {
      throw new Error(`Desktop voice catalog ${fieldName} is invalid.`);
    }
    const normalized = value.trim();
    if (
      !normalized
      || normalized.length > 512
      || [...normalized].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    ) {
      throw new Error(`Desktop voice catalog ${fieldName} is invalid.`);
    }
    return normalized;
  }

  /** 校验 Worker 最终文本和引擎元数据，拒绝控制字符、超长文本和额外对象。 */
  private parseResponse(response: Readonly<Record<string, unknown>>): ApplicationVoiceTranscriptionResult {
    const text = response.text;
    const engine = response.engine;
    if (
      typeof text !== "string"
      || text.length > 100_000
      || text.includes("\u0000")
      || typeof engine !== "string"
      || !engine.trim()
      || engine.length > 64
    ) {
      throw new Error("Desktop voice transcription response is invalid.");
    }
    return { text: text.trim(), engine: engine.trim() };
  }

  /** 判断未知值是否为可检查的非数组对象。 */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /** 判断对象是否只包含完整的预期字段集合。 */
  private hasExactFields(value: Record<string, unknown>, expected: readonly string[]): boolean {
    const actual = Object.keys(value).sort();
    const sortedExpected = [...expected].sort();
    return actual.length === sortedExpected.length
      && actual.every((field, index) => field === sortedExpected[index]);
  }
}
