import type {
  SystemSettingsSnapshot,
} from "../contracts/application-settings";
import { APPLICATION_SETTINGS_CHANNELS } from "../contracts/application-settings";
import type { ApplicationSettingsService } from "../storage/application-settings-bootstrap";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose application settings through Electron IPC. */
export interface RegisterApplicationSettingsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly settings: Pick<ApplicationSettingsService, "getSystemSettings" | "saveSystemSettings">;
  readonly authorizeEvent: (event: unknown) => void;
}

/**
 * Register the minimal authorized application-settings IPC boundary.
 *
 * @param options IPC implementation, settings service, and sender authorizer.
 * @returns Cleanup function that removes both handlers.
 */
export function registerApplicationSettingsIpc(
  options: RegisterApplicationSettingsIpcOptions,
): () => void {
  const { ipcMain, settings, authorizeEvent } = options;

  /** Return the current bounded settings snapshot to an authorized Renderer. */
  function handleGetSystemSettings(event: unknown): SystemSettingsSnapshot {
    authorizeEvent(event);
    return settings.getSystemSettings();
  }

  /** Validate and persist a complete settings replacement from an authorized Renderer. */
  function handleSaveSystemSettings(event: unknown, request: unknown): SystemSettingsSnapshot {
    authorizeEvent(event);
    return settings.saveSystemSettings(request);
  }

  ipcMain.removeHandler(APPLICATION_SETTINGS_CHANNELS.getSystemSettings);
  ipcMain.removeHandler(APPLICATION_SETTINGS_CHANNELS.saveSystemSettings);
  ipcMain.handle(APPLICATION_SETTINGS_CHANNELS.getSystemSettings, handleGetSystemSettings);
  ipcMain.handle(APPLICATION_SETTINGS_CHANNELS.saveSystemSettings, handleSaveSystemSettings);

  /** Remove every application-settings IPC handler registered by this adapter. */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_SETTINGS_CHANNELS.getSystemSettings);
    ipcMain.removeHandler(APPLICATION_SETTINGS_CHANNELS.saveSystemSettings);
  }

  return cleanup;
}
