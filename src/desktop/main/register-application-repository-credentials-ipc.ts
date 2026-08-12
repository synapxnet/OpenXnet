import {
  APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS,
  type ApplicationRepositoryCredentialSnapshot,
} from "../contracts/application-repository-credentials";
import type { ApplicationRepositoryCredentialService } from "../storage/application-repository-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose repository credential metadata and writes. */
export interface RegisterApplicationRepositoryCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly repositoryCredentials: Pick<
    ApplicationRepositoryCredentialService,
    "getSnapshot" | "save"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized repository credential IPC boundary. */
export function registerApplicationRepositoryCredentialsIpc(
  options: RegisterApplicationRepositoryCredentialsIpcOptions,
): () => void {
  const { ipcMain, repositoryCredentials, authorizeEvent } = options;

  /** Return one authorized redacted repository credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationRepositoryCredentialSnapshot {
    authorizeEvent(event);
    return repositoryCredentials.getSnapshot();
  }

  /** Apply one authorized repository credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationRepositoryCredentialSnapshot {
    authorizeEvent(event);
    return repositoryCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every repository credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
