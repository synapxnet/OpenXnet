import {
  APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS,
  type ApplicationImageHostCredentialSnapshot,
} from "../contracts/application-image-host-credentials";
import type { ApplicationImageHostCredentialService } from "../storage/application-image-host-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose image-host credential metadata and writes. */
export interface RegisterApplicationImageHostCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly imageHostCredentials: Pick<ApplicationImageHostCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized image-host credential IPC boundary. */
export function registerApplicationImageHostCredentialsIpc(
  options: RegisterApplicationImageHostCredentialsIpcOptions,
): () => void {
  const { ipcMain, imageHostCredentials, authorizeEvent } = options;

  /** Return one authorized redacted image-host credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationImageHostCredentialSnapshot {
    authorizeEvent(event);
    return imageHostCredentials.getSnapshot();
  }

  /** Apply one authorized image-host credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationImageHostCredentialSnapshot {
    authorizeEvent(event);
    return imageHostCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every image-host credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
