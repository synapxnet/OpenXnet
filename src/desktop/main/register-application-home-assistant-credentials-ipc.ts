import {
  APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS,
  type ApplicationHomeAssistantCredentialSnapshot,
} from "../contracts/application-home-assistant-credentials";
import type { ApplicationHomeAssistantCredentialService } from "../storage/application-home-assistant-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose Home Assistant credential metadata and writes. */
export interface RegisterApplicationHomeAssistantCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly homeAssistantCredentials: Pick<
    ApplicationHomeAssistantCredentialService,
    "getSnapshot" | "save"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized Home Assistant credential IPC boundary. */
export function registerApplicationHomeAssistantCredentialsIpc(
  options: RegisterApplicationHomeAssistantCredentialsIpcOptions,
): () => void {
  const { ipcMain, homeAssistantCredentials, authorizeEvent } = options;

  /** Return one authorized redacted Home Assistant credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationHomeAssistantCredentialSnapshot {
    authorizeEvent(event);
    return homeAssistantCredentials.getSnapshot();
  }

  /** Apply one authorized Home Assistant credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationHomeAssistantCredentialSnapshot {
    authorizeEvent(event);
    return homeAssistantCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every Home Assistant credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
