import { APPLICATION_OLLAMA_RUNTIME_CHANNELS } from "../contracts/application-ollama-runtime";
import type { ApplicationOllamaRuntimeService } from "../ollama/application-ollama-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose Ollama discovery through authorized IPC. */
export interface RegisterApplicationOllamaRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<ApplicationOllamaRuntimeService, "discover">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the loopback-only Ollama discovery handler. 注册本机 Ollama 探测处理器。 */
export function registerApplicationOllamaRuntimeIpc(options: RegisterApplicationOllamaRuntimeIpcOptions): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;
  /** Discover local Ollama after validating the renderer sender. 鉴权后探测本地 Ollama。 */
  function handleDiscover(event: unknown, request?: unknown): ReturnType<typeof runtime.discover> {
    authorizeEvent(event);
    return runtime.discover(request);
  }
  ipcMain.removeHandler(APPLICATION_OLLAMA_RUNTIME_CHANNELS.discover);
  ipcMain.handle(APPLICATION_OLLAMA_RUNTIME_CHANNELS.discover, handleDiscover);
  return () => ipcMain.removeHandler(APPLICATION_OLLAMA_RUNTIME_CHANNELS.discover);
}
