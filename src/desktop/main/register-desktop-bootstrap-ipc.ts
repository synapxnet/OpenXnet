import {
  DESKTOP_BOOTSTRAP_CHANNEL,
  DESKTOP_BOOTSTRAP_SCHEMA,
  type DesktopBootstrapApplication,
  type DesktopBootstrapSnapshot,
} from "../contracts/desktop-bootstrap";
import type { DesktopCore } from "../core/desktop-core";
import type { ApplicationSettingsService } from "../storage/application-settings-bootstrap";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies used to create the atomic Renderer bootstrap snapshot. */
export interface RegisterDesktopBootstrapIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly core: Pick<DesktopCore, "getSnapshot">;
  readonly settings: Pick<ApplicationSettingsService, "getSystemSettings" | "getRuntimeSettings">;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getApplication: () => DesktopBootstrapApplication;
  readonly now?: () => Date;
}

/**
 * Register one authorized IPC request that returns all first-frame Core state.
 *
 * @param options Core, settings, metadata, and IPC dependencies.
 * @returns Cleanup function that removes the bootstrap handler.
 */
export function registerDesktopBootstrapIpc(
  options: RegisterDesktopBootstrapIpcOptions,
): () => void {
  const { ipcMain, core, settings, authorizeEvent, getApplication } = options;
  const now = options.now ?? (() => new Date());

  /** Create a consistent non-secret startup snapshot for an authorized Renderer. */
  function handleGetBootstrap(event: unknown): DesktopBootstrapSnapshot {
    authorizeEvent(event);
    return {
      schema: DESKTOP_BOOTSTRAP_SCHEMA,
      generatedAt: now().toISOString(),
      application: getApplication(),
      core: core.getSnapshot(),
      systemSettings: settings.getSystemSettings(),
      runtimeSettings: settings.getRuntimeSettings(),
    };
  }

  ipcMain.removeHandler(DESKTOP_BOOTSTRAP_CHANNEL);
  ipcMain.handle(DESKTOP_BOOTSTRAP_CHANNEL, handleGetBootstrap);

  /** Remove the bootstrap IPC handler registered by this adapter. */
  function cleanup(): void {
    ipcMain.removeHandler(DESKTOP_BOOTSTRAP_CHANNEL);
  }

  return cleanup;
}
