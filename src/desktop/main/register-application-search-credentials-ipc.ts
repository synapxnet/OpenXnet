import {
  APPLICATION_SEARCH_CREDENTIAL_CHANNELS,
  type ApplicationSearchCredentialSnapshot,
} from "../contracts/application-search-credentials";
import type { ApplicationSearchCredentialService } from "../storage/application-search-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose search credential metadata and writes. */
export interface RegisterApplicationSearchCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly searchCredentials: Pick<ApplicationSearchCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized search credential IPC boundary. */
export function registerApplicationSearchCredentialsIpc(
  options: RegisterApplicationSearchCredentialsIpcOptions,
): () => void {
  const { ipcMain, searchCredentials, authorizeEvent } = options;

  /** Return one authorized redacted search credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationSearchCredentialSnapshot {
    authorizeEvent(event);
    return searchCredentials.getSnapshot();
  }

  /** Apply one authorized search credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationSearchCredentialSnapshot {
    authorizeEvent(event);
    return searchCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_SEARCH_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every search credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
