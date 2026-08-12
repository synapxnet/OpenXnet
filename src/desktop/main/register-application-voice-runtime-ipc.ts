import {
  APPLICATION_VOICE_RUNTIME_CHANNELS,
  type ApplicationVoiceCatalogResult,
  type ApplicationVoiceReferenceResult,
  type ApplicationVoiceSynthesisResult,
  type ApplicationVoiceTranscriptionResult,
  type RemoveApplicationVoiceReferenceResult,
} from "../contracts/application-voice-runtime";
import type { ApplicationVoiceRuntimeService } from "../voice/application-voice-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 暴露 Application Voice Runtime IPC 所需的依赖。 */
export interface RegisterApplicationVoiceRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationVoiceRuntimeService,
    | "transcribe"
    | "synthesize"
    | "listSystemVoices"
    | "listProviderVoices"
    | "importReference"
    | "removeReference"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册经过 sender 授权的单一桌面语音转写 IPC，并返回清理函数。 */
export function registerApplicationVoiceRuntimeIpc(
  options: RegisterApplicationVoiceRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 授权 Renderer 后把未知请求交给运行时边界校验。 */
  async function handleTranscribe(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationVoiceTranscriptionResult> {
    authorizeEvent(event);
    return runtime.transcribe(request);
  }

  /** 授权 Renderer 后把未知合成请求交给运行时边界校验。 */
  async function handleSynthesize(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationVoiceSynthesisResult> {
    authorizeEvent(event);
    return runtime.synthesize(request);
  }

  /** 授权 Renderer 后读取公开系统音色目录，调用时才允许 Worker 激活。 */
  async function handleListSystemVoices(event: unknown): Promise<ApplicationVoiceCatalogResult> {
    authorizeEvent(event);
    return runtime.listSystemVoices();
  }

  /** 授权 Renderer 后把固定供应商目录请求交给运行时边界校验。 */
  async function handleListProviderVoices(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationVoiceCatalogResult> {
    authorizeEvent(event);
    return runtime.listProviderVoices(request);
  }

  /** 授权 Renderer 后导入 preload 已收敛的参考音频，不激活 Voice Worker。 */
  async function handleImportReference(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationVoiceReferenceResult> {
    authorizeEvent(event);
    return runtime.importReference(request);
  }

  /** 授权 Renderer 后删除一个 Main 生成的参考音频存储名。 */
  async function handleRemoveReference(
    event: unknown,
    request: unknown,
  ): Promise<RemoveApplicationVoiceReferenceResult> {
    authorizeEvent(event);
    return runtime.removeReference(request);
  }

  ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe);
  ipcMain.handle(APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe, handleTranscribe);
  ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize);
  ipcMain.handle(APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize, handleSynthesize);
  ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices);
  ipcMain.handle(APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices, handleListSystemVoices);
  ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.listProviderVoices);
  ipcMain.handle(APPLICATION_VOICE_RUNTIME_CHANNELS.listProviderVoices, handleListProviderVoices);
  ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.importReference);
  ipcMain.handle(APPLICATION_VOICE_RUNTIME_CHANNELS.importReference, handleImportReference);
  ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.removeReference);
  ipcMain.handle(APPLICATION_VOICE_RUNTIME_CHANNELS.removeReference, handleRemoveReference);

  /** 删除本 adapter 注册的精确 IPC handler。 */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe);
    ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize);
    ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices);
    ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.listProviderVoices);
    ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.importReference);
    ipcMain.removeHandler(APPLICATION_VOICE_RUNTIME_CHANNELS.removeReference);
  }
  return cleanup;
}
