/** IPC channels owned by the temporary legacy Renderer-state bridge. */
export const LEGACY_RENDERER_STATE_CHANNELS = {
  getSnapshot: "openxnet:legacy-renderer-state:get-snapshot",
  saveSettings: "openxnet:legacy-renderer-state:save-settings",
  saveConversations: "openxnet:legacy-renderer-state:save-conversations",
  saveVrmConfig: "openxnet:legacy-renderer-state:save-vrm-config",
  changed: "openxnet:legacy-renderer-state:changed",
} as const;

/** Stable schema for the bounded compatibility snapshot. */
export const LEGACY_RENDERER_STATE_SCHEMA = "openxnet.legacy-renderer-state.v1" as const;

/** Stable schema for compatibility state change events. */
export const LEGACY_RENDERER_STATE_CHANGED_SCHEMA = "openxnet.legacy-renderer-state-changed.v1" as const;

/** Bounded legacy state loaded without starting a Python process. */
export interface LegacyRendererStateSnapshot {
  readonly schema: typeof LEGACY_RENDERER_STATE_SCHEMA;
  readonly settingsRevision: number;
  readonly conversationsRevision: number;
  readonly generatedAt: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly conversations: readonly Readonly<Record<string, unknown>>[];
}

/** Exact compatibility settings replacement request. */
export interface SaveLegacyRendererSettingsRequest {
  readonly settings: Readonly<Record<string, unknown>>;
}

/** Exact compatibility conversations replacement request. */
export interface SaveLegacyRendererConversationsRequest {
  readonly conversations: readonly Readonly<Record<string, unknown>>[];
}

/** Exact compatibility VRM settings replacement request. */
export interface SaveLegacyRendererVrmConfigRequest {
  readonly vrmConfig: Readonly<Record<string, unknown>>;
}

/** Notification emitted after one compatibility domain changes. */
export interface LegacyRendererStateChangedEvent {
  readonly schema: typeof LEGACY_RENDERER_STATE_CHANGED_SCHEMA;
  readonly domain: "settings" | "conversations";
  readonly snapshot: LegacyRendererStateSnapshot;
}

/** Listener used by Renderer windows observing compatibility state changes. */
export type LegacyRendererStateChangedListener = (event: LegacyRendererStateChangedEvent) => void;
