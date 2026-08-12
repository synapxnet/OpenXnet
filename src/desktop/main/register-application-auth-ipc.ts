import {
  APPLICATION_AUTH_CHANNELS,
  type ApplicationAuthSnapshot,
} from "../contracts/application-auth";
import type { ApplicationAuthService } from "../storage/application-auth";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose authentication through Electron IPC. */
export interface RegisterApplicationAuthIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly auth: Pick<ApplicationAuthService, "getSession" | "saveSession" | "clearSession">;
  readonly authorizeEvent: (event: unknown) => void;
}

/**
 * Register the minimal authorized application-authentication IPC boundary.
 *
 * @param options IPC implementation, authentication service, and sender authorizer.
 * @returns Cleanup function that removes every authentication handler.
 */
export function registerApplicationAuthIpc(
  options: RegisterApplicationAuthIpcOptions,
): () => void {
  const { ipcMain, auth, authorizeEvent } = options;

  /** Return the current reconstructed authentication session. */
  function handleGetSession(event: unknown): ApplicationAuthSnapshot {
    authorizeEvent(event);
    return auth.getSession();
  }

  /** Validate and persist one authentication session replacement. */
  function handleSaveSession(event: unknown, request: unknown): ApplicationAuthSnapshot {
    authorizeEvent(event);
    return auth.saveSession(request);
  }

  /** Clear account metadata and encrypted credentials. */
  function handleClearSession(event: unknown): ApplicationAuthSnapshot {
    authorizeEvent(event);
    return auth.clearSession();
  }

  ipcMain.removeHandler(APPLICATION_AUTH_CHANNELS.getSession);
  ipcMain.removeHandler(APPLICATION_AUTH_CHANNELS.saveSession);
  ipcMain.removeHandler(APPLICATION_AUTH_CHANNELS.clearSession);
  ipcMain.handle(APPLICATION_AUTH_CHANNELS.getSession, handleGetSession);
  ipcMain.handle(APPLICATION_AUTH_CHANNELS.saveSession, handleSaveSession);
  ipcMain.handle(APPLICATION_AUTH_CHANNELS.clearSession, handleClearSession);

  /** Remove every authentication IPC handler registered by this adapter. */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_AUTH_CHANNELS.getSession);
    ipcMain.removeHandler(APPLICATION_AUTH_CHANNELS.saveSession);
    ipcMain.removeHandler(APPLICATION_AUTH_CHANNELS.clearSession);
  }

  return cleanup;
}
