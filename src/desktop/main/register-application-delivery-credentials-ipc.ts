import {
  APPLICATION_DELIVERY_CREDENTIAL_CHANNELS,
  type ApplicationDeliveryCredentialSnapshot,
} from "../contracts/application-delivery-credentials";
import type { ApplicationDeliveryCredentialService } from "../storage/application-delivery-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose configured delivery metadata and scoped writes. */
export interface RegisterApplicationDeliveryCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly deliveryCredentials: Pick<ApplicationDeliveryCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized terminal-delivery credential IPC boundary. */
export function registerApplicationDeliveryCredentialsIpc(
  options: RegisterApplicationDeliveryCredentialsIpcOptions,
): () => void {
  const { ipcMain, deliveryCredentials, authorizeEvent } = options;

  /** Return one authorized configured-only terminal-delivery credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationDeliveryCredentialSnapshot {
    authorizeEvent(event);
    return deliveryCredentials.getSnapshot();
  }

  /** Apply one authorized compound-scope terminal-delivery credential mutation. */
  function handleSave(event: unknown, request: unknown): ApplicationDeliveryCredentialSnapshot {
    authorizeEvent(event);
    return deliveryCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_DELIVERY_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_DELIVERY_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_DELIVERY_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every terminal-delivery credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
