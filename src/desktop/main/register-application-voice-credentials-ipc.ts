import {
  APPLICATION_VOICE_CREDENTIAL_CHANNELS,
  type ApplicationVoiceCredentialSnapshot,
} from "../contracts/application-voice-credentials";
import type { ApplicationVoiceCredentialService } from "../storage/application-voice-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose voice credential metadata and writes. */
export interface RegisterApplicationVoiceCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly voiceCredentials: Pick<ApplicationVoiceCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized voice credential IPC boundary. */
export function registerApplicationVoiceCredentialsIpc(
  options: RegisterApplicationVoiceCredentialsIpcOptions,
): () => void {
  const { ipcMain, voiceCredentials, authorizeEvent } = options;

  /** Return one authorized redacted voice credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationVoiceCredentialSnapshot {
    authorizeEvent(event);
    return voiceCredentials.getSnapshot();
  }

  /** Apply one authorized voice credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationVoiceCredentialSnapshot {
    authorizeEvent(event);
    return voiceCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_VOICE_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_VOICE_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_VOICE_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every voice credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
