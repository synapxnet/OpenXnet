import {
  APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS,
  type ApplicationConnectorCredentialSnapshot,
} from "../contracts/application-connector-credentials";
import type { ApplicationConnectorCredentialService } from "../storage/application-connector-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose Connector Worker credential metadata and writes. */
export interface RegisterApplicationConnectorCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly connectorCredentials: Pick<ApplicationConnectorCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized Connector Worker credential IPC boundary. */
export function registerApplicationConnectorCredentialsIpc(
  options: RegisterApplicationConnectorCredentialsIpcOptions,
): () => void {
  const { ipcMain, connectorCredentials, authorizeEvent } = options;

  /** Return one authorized redacted Connector Worker credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationConnectorCredentialSnapshot {
    authorizeEvent(event);
    return connectorCredentials.getSnapshot();
  }

  /** Apply one authorized Connector Worker credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationConnectorCredentialSnapshot {
    authorizeEvent(event);
    return connectorCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every Connector Worker credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
