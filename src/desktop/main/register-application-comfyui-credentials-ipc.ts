import {
  APPLICATION_COMFYUI_CREDENTIAL_CHANNELS,
  type ApplicationComfyUiCredentialSnapshot,
} from "../contracts/application-comfyui-credentials";
import type { ApplicationComfyUiCredentialService } from "../storage/application-comfyui-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose ComfyUI credential metadata and writes. */
export interface RegisterApplicationComfyUiCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly comfyUiCredentials: Pick<ApplicationComfyUiCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized ComfyUI credential IPC boundary. */
export function registerApplicationComfyUiCredentialsIpc(
  options: RegisterApplicationComfyUiCredentialsIpcOptions,
): () => void {
  const { ipcMain, comfyUiCredentials, authorizeEvent } = options;

  /** Return one authorized redacted ComfyUI credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationComfyUiCredentialSnapshot {
    authorizeEvent(event);
    return comfyUiCredentials.getSnapshot();
  }

  /** Apply one authorized ComfyUI credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationComfyUiCredentialSnapshot {
    authorizeEvent(event);
    return comfyUiCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_COMFYUI_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_COMFYUI_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_COMFYUI_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every ComfyUI credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
