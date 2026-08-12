import {
  APPLICATION_PROVIDER_CHANNELS,
  type ApplicationProviderEmbeddingProbeResult,
  type ApplicationProviderSnapshot,
  type ApplicationProviderValidationResult,
} from "../contracts/application-providers";
import type { ApplicationProviderService } from "../storage/application-providers";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose application providers through Electron IPC. */
export interface RegisterApplicationProvidersIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly providers: Pick<
    ApplicationProviderService,
    "getSnapshot" | "saveProviders" | "validateProvider" | "probeEmbeddingDimensions"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register authorized provider metadata, save, and validation handlers. */
export function registerApplicationProvidersIpc(
  options: RegisterApplicationProvidersIpcOptions,
): () => void {
  const { ipcMain, providers, authorizeEvent } = options;

  /** Return one authorized redacted provider snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationProviderSnapshot {
    authorizeEvent(event);
    return providers.getSnapshot();
  }

  /** Persist one authorized provider metadata and credential replacement. */
  function handleSaveProviders(event: unknown, request: unknown): ApplicationProviderSnapshot {
    authorizeEvent(event);
    return providers.saveProviders(request);
  }

  /** Validate one provider through Main without returning its credential. */
  function handleValidateProvider(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationProviderValidationResult> {
    authorizeEvent(event);
    return providers.validateProvider(request);
  }

  /** 探测一个已保存 Provider 的向量维度；输入为不可信请求，返回无密钥结果，失败语义由服务层保留。 */
  function handleProbeEmbedding(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationProviderEmbeddingProbeResult> {
    authorizeEvent(event);
    return providers.probeEmbeddingDimensions(request);
  }

  const channels = Object.values(APPLICATION_PROVIDER_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_PROVIDER_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_PROVIDER_CHANNELS.saveProviders, handleSaveProviders);
  ipcMain.handle(APPLICATION_PROVIDER_CHANNELS.validateProvider, handleValidateProvider);
  ipcMain.handle(APPLICATION_PROVIDER_CHANNELS.probeEmbedding, handleProbeEmbedding);

  /** Remove every application-provider IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
