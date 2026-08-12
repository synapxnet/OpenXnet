import {
  LEGACY_RENDERER_STATE_CHANNELS,
  type LegacyRendererStateSnapshot,
} from "../contracts/legacy-renderer-state";
import type { LegacyRendererStateService } from "../storage/legacy-renderer-state";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

/** Dependencies required by the legacy Renderer-state IPC adapter. */
export interface RegisterLegacyRendererStateIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly state: Pick<
    LegacyRendererStateService,
    "getSnapshot" | "saveSettings" | "saveConversations" | "saveVrmConfig" | "subscribe"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWebContents: () => readonly WebContentsLike[];
}

/** Register the authorized compatibility state handlers and change publisher. */
export function registerLegacyRendererStateIpc(options: RegisterLegacyRendererStateIpcOptions): () => void {
  const { ipcMain, state, authorizeEvent } = options;

  /** Return one authorized bounded compatibility snapshot. */
  function handleGetSnapshot(event: unknown): LegacyRendererStateSnapshot {
    authorizeEvent(event);
    return state.getSnapshot();
  }

  /** Persist one authorized settings replacement. */
  function handleSaveSettings(event: unknown, request: unknown): LegacyRendererStateSnapshot {
    authorizeEvent(event);
    return state.saveSettings(request);
  }

  /** Persist one authorized conversations replacement. */
  function handleSaveConversations(event: unknown, request: unknown): LegacyRendererStateSnapshot {
    authorizeEvent(event);
    return state.saveConversations(request);
  }

  /** Persist one authorized VRM configuration replacement. */
  function handleSaveVrmConfig(event: unknown, request: unknown): LegacyRendererStateSnapshot {
    authorizeEvent(event);
    return state.saveVrmConfig(request);
  }

  const requestChannels = [
    LEGACY_RENDERER_STATE_CHANNELS.getSnapshot,
    LEGACY_RENDERER_STATE_CHANNELS.saveSettings,
    LEGACY_RENDERER_STATE_CHANNELS.saveConversations,
    LEGACY_RENDERER_STATE_CHANNELS.saveVrmConfig,
  ];
  for (const channel of requestChannels) ipcMain.removeHandler(channel);
  ipcMain.handle(LEGACY_RENDERER_STATE_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(LEGACY_RENDERER_STATE_CHANNELS.saveSettings, handleSaveSettings);
  ipcMain.handle(LEGACY_RENDERER_STATE_CHANNELS.saveConversations, handleSaveConversations);
  ipcMain.handle(LEGACY_RENDERER_STATE_CHANNELS.saveVrmConfig, handleSaveVrmConfig);

  const unsubscribe = state.subscribe((changedEvent) => {
    for (const webContents of options.getWebContents()) {
      if (!webContents.isDestroyed()) {
        webContents.send(LEGACY_RENDERER_STATE_CHANNELS.changed, changedEvent);
      }
    }
  });

  /** Remove all compatibility handlers and the state subscription. */
  function cleanup(): void {
    unsubscribe();
    for (const channel of requestChannels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
