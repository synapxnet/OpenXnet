import {
  APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS,
  type ApplicationCodeSandboxCredentialSnapshot,
} from "../contracts/application-code-sandbox-credentials";
import type { ApplicationCodeSandboxCredentialService } from "../storage/application-code-sandbox-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose code-sandbox credential metadata and writes. */
export interface RegisterApplicationCodeSandboxCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly codeSandboxCredentials: Pick<
    ApplicationCodeSandboxCredentialService,
    "getSnapshot" | "save"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized code-sandbox credential IPC boundary. */
export function registerApplicationCodeSandboxCredentialsIpc(
  options: RegisterApplicationCodeSandboxCredentialsIpcOptions,
): () => void {
  const { ipcMain, codeSandboxCredentials, authorizeEvent } = options;

  /** Return one authorized redacted code-sandbox credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationCodeSandboxCredentialSnapshot {
    authorizeEvent(event);
    return codeSandboxCredentials.getSnapshot();
  }

  /** Apply one authorized code-sandbox credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationCodeSandboxCredentialSnapshot {
    authorizeEvent(event);
    return codeSandboxCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every code-sandbox credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
