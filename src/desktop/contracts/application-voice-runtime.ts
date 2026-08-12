/** 桌面 Renderer 请求一次性语音转写的唯一 IPC 通道。 */
export const APPLICATION_VOICE_RUNTIME_CHANNELS = {
  transcribe: "openxnet:application-voice-runtime:transcribe",
  synthesize: "openxnet:application-voice-runtime:synthesize",
  listSystemVoices: "openxnet:application-voice-runtime:list-system-voices",
  listProviderVoices: "openxnet:application-voice-runtime:list-provider-voices",
  importReference: "openxnet:application-voice-runtime:import-reference",
  removeReference: "openxnet:application-voice-runtime:remove-reference",
} as const;

/** Renderer 提交的有界音频和格式，不包含 ASR 设置或凭据。 */
export interface ApplicationVoiceTranscriptionRequest {
  readonly audio: ArrayBuffer;
  readonly format: "wav" | "mp3" | "flac" | "ogg" | "m4a" | "opus" | "aac";
}

/** Main 返回给 Renderer 的最终转写文本和实际引擎。 */
export interface ApplicationVoiceTranscriptionResult {
  readonly text: string;
  readonly engine: string;
}

/** Renderer 提交的有界语音合成参数，不包含 TTS 设置、Provider 配置或凭据。 */
export interface ApplicationVoiceSynthesisRequest {
  readonly text: string;
  readonly voice: string;
  readonly index: number;
  readonly mobileOptimized: boolean;
}

/** Main 返回给 Renderer 的内存音频和受限媒体元数据，不包含 Worker 文件路径。 */
export interface ApplicationVoiceSynthesisResult {
  readonly audio: ArrayBuffer;
  readonly mediaType: string;
  readonly format: "mp3" | "opus" | "wav" | "aac" | "flac";
}

/** Renderer 可请求的固定供应商目录和安全存储凭据作用域。 */
export interface ApplicationVoiceProviderCatalogRequest {
  readonly provider: "azure" | "volcengine" | "baidu" | "minimax" | "xunfei" | "fish" | "google";
  readonly credentialScope: string;
}

/** Main 投影的一条公开音色记录；所有供应商私有字段和原始响应均被丢弃。 */
export interface ApplicationVoiceCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
  readonly shortName?: string;
  readonly locale?: string;
  readonly description?: string;
  readonly originalName?: string;
  readonly lang?: string;
  readonly gender?: string;
  readonly premium?: boolean;
}

/** Main 返回的有界音色目录，不包含凭据、文件路径或上游响应。 */
export interface ApplicationVoiceCatalogResult {
  readonly voices: readonly ApplicationVoiceCatalogItem[];
}

/** contextBridge 可接收的最小参考音频 File 能力，避免 Desktop 合约依赖 DOM 类型库。 */
export interface RendererApplicationVoiceReferenceFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** preload 从真实 File 提取的本机参考音频路径，Renderer 不能直接构造该路径。 */
export interface ApplicationVoiceReferencePathEntry {
  readonly source: "path";
  readonly path: string;
  readonly originalName: string;
}

/** preload 为无本机路径音频生成的有界内联字节。 */
export interface ApplicationVoiceReferenceBytesEntry {
  readonly source: "bytes";
  readonly bytes: Uint8Array;
  readonly originalName: string;
}

/** preload 所有权边界提交的一条参考音频导入请求。 */
export interface ImportApplicationVoiceReferenceRequest {
  readonly entry: ApplicationVoiceReferencePathEntry | ApplicationVoiceReferenceBytesEntry;
}

/** Main 返回的固定目录参考音频元数据，不包含绝对路径。 */
export interface ApplicationVoiceReferenceResult {
  readonly storageName: string;
  readonly originalName: string;
  readonly sizeBytes: number;
}

/** Renderer 删除一条 Main-owned 参考音频时提交的固定存储名。 */
export interface RemoveApplicationVoiceReferenceRequest {
  readonly storageName: string;
}

/** Main 返回的幂等参考音频删除结果。 */
export interface RemoveApplicationVoiceReferenceResult {
  readonly storageName: string;
  readonly removed: boolean;
}
