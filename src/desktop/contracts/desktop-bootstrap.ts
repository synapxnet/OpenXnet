import type { SystemSettingsSnapshot, RuntimeSettings } from "./application-settings";
import type { DesktopCoreSnapshot } from "./capability";

/** Stable schema identifier for the Renderer startup snapshot. */
export const DESKTOP_BOOTSTRAP_SCHEMA = "openxnet.desktop-bootstrap.v1" as const;

/** IPC channel owned by the Desktop bootstrap boundary. */
export const DESKTOP_BOOTSTRAP_CHANNEL = "openxnet:desktop-bootstrap:get";

/** Non-secret application metadata required by the local Renderer shell. */
export interface DesktopBootstrapApplication {
  readonly version: string;
  readonly platform: string;
  readonly architecture: string;
  readonly locale: string;
  readonly packaged: boolean;
}

/** One consistent startup snapshot fetched before the legacy Renderer mounts. */
export interface DesktopBootstrapSnapshot {
  readonly schema: typeof DESKTOP_BOOTSTRAP_SCHEMA;
  readonly generatedAt: string;
  readonly application: DesktopBootstrapApplication;
  readonly core: DesktopCoreSnapshot;
  readonly systemSettings: SystemSettingsSnapshot;
  readonly runtimeSettings: RuntimeSettings;
}
