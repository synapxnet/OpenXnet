import {
  APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS,
  type ApplicationLivePlatformCredentialSnapshot,
} from "../contracts/application-live-platform-credentials";
import type { ApplicationLivePlatformCredentialService } from "../storage/application-live-platform-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose live-platform credential metadata and writes. */
export interface RegisterApplicationLivePlatformCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly livePlatformCredentials: Pick<
    ApplicationLivePlatformCredentialService,
    "getSnapshot" | "save"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized live-platform credential IPC boundary. */
export function registerApplicationLivePlatformCredentialsIpc(
  options: RegisterApplicationLivePlatformCredentialsIpcOptions,
): () => void {
  const { ipcMain, livePlatformCredentials, authorizeEvent } = options;

  /** Return one authorized redacted live-platform credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationLivePlatformCredentialSnapshot {
    authorizeEvent(event);
    return livePlatformCredentials.getSnapshot();
  }

  /** Apply one authorized live-platform credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationLivePlatformCredentialSnapshot {
    authorizeEvent(event);
    return livePlatformCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every live-platform credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
