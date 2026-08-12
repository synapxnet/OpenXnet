import {
  APPLICATION_ACCESS_CHANNELS,
  type ApplicationAccessResult,
} from "../contracts/application-access";
import type { ApplicationAccessGateway } from "../gateway/application-access-gateway";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose the Main-owned account gateway through IPC. */
export interface RegisterApplicationAccessIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly access: Pick<ApplicationAccessGateway, "request">;
  readonly authorizeEvent: (event: unknown) => void;
}

/**
 * Register the single authorized account gateway IPC operation.
 *
 * @param options IPC implementation, account gateway, and sender authorizer.
 * @returns Cleanup function that removes the account gateway handler.
 */
export function registerApplicationAccessIpc(
  options: RegisterApplicationAccessIpcOptions,
): () => void {
  const { ipcMain, access, authorizeEvent } = options;

  /** Authorize and execute one allow-listed account request. */
  async function handleRequest(event: unknown, request: unknown): Promise<ApplicationAccessResult> {
    authorizeEvent(event);
    return access.request(request);
  }

  ipcMain.removeHandler(APPLICATION_ACCESS_CHANNELS.request);
  ipcMain.handle(APPLICATION_ACCESS_CHANNELS.request, handleRequest);

  /** Remove the account gateway IPC handler registered by this adapter. */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_ACCESS_CHANNELS.request);
  }

  return cleanup;
}
