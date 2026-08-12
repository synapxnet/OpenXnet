import {
  APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS,
  type ApplicationHttpToolCredentialSnapshot,
} from "../contracts/application-http-tool-credentials";
import type { ApplicationHttpToolCredentialService } from "../storage/application-http-tool-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose custom HTTP credential metadata and writes. */
export interface RegisterApplicationHttpToolCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly httpToolCredentials: Pick<ApplicationHttpToolCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized custom HTTP credential IPC boundary. */
export function registerApplicationHttpToolCredentialsIpc(
  options: RegisterApplicationHttpToolCredentialsIpcOptions,
): () => void {
  const { ipcMain, httpToolCredentials, authorizeEvent } = options;

  /** Return one authorized redacted custom HTTP credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationHttpToolCredentialSnapshot {
    authorizeEvent(event);
    return httpToolCredentials.getSnapshot();
  }

  /** Apply one authorized custom HTTP credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationHttpToolCredentialSnapshot {
    authorizeEvent(event);
    return httpToolCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every custom HTTP credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
