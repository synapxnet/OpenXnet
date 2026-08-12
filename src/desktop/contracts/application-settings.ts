/** IPC channels owned by the Desktop Core application-settings boundary. */
export const APPLICATION_SETTINGS_CHANNELS = Object.freeze({
  getSystemSettings: "openxnet:application-settings:get-system-settings",
  saveSystemSettings: "openxnet:application-settings:save-system-settings",
});

/** Stable document keys stored in the migration-managed application database. */
export const APPLICATION_DOCUMENT_KEYS = Object.freeze({
  systemSettings: "system-settings",
  runtimeSettings: "runtime-settings",
});

/** Public schema returned for one system-settings snapshot. */
export const SYSTEM_SETTINGS_SCHEMA = "openxnet.system-settings.v1" as const;

/** Themes currently supported by the legacy and Vite settings surfaces. */
const SYSTEM_THEMES = new Set([
  "party",
  "light",
  "dark",
  "midnight",
  "desert",
  "neon",
  "marshmallow",
  "ink",
  "rainbow",
]);

/** Supported date rendering formats. */
const DATE_FORMATS = new Set(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]);

/** Supported proxy selection modes. */
const PROXY_MODES = new Set(["system", "manual", "none"]);

/** Persisted desktop system settings owned by TypeScript Core. */
export interface SystemSettings {
  readonly language: string;
  readonly theme: string;
  readonly network: "local";
  readonly timezone: string;
  readonly dateFormat: string;
  readonly launchAtStartup: boolean;
  readonly startMinimized: boolean;
  readonly proxy: string;
  readonly proxyMode: string;
  readonly isChinaProxy: boolean;
}

/** Persisted Chromium MCP settings needed before the Renderer starts. */
export interface ChromeMcpRuntimeSettings {
  readonly enabled: boolean;
  readonly mcpName: "browser-mcp" | "playwright-mcp";
  readonly type: "external" | "internal";
  readonly CDPport: number;
}

/** Main-process runtime settings needed before Electron is ready. */
export interface RuntimeSettings {
  readonly networkVisible: "local";
  readonly chromeMCPSettings: ChromeMcpRuntimeSettings;
}

/** Serialized snapshot returned through application-settings IPC. */
export interface SystemSettingsSnapshot {
  readonly schema: typeof SYSTEM_SETTINGS_SCHEMA;
  readonly revision: number;
  readonly settings: SystemSettings;
  readonly updatedAt: string | null;
}

/** Renderer request used to replace the bounded system-settings document. */
export interface SaveSystemSettingsRequest {
  readonly settings: SystemSettings;
}

/** Default settings used before a legacy or Renderer-owned value exists. */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = Object.freeze({
  language: "auto",
  theme: "party",
  network: "local",
  timezone: "Asia/Shanghai",
  dateFormat: "YYYY-MM-DD",
  launchAtStartup: false,
  startMinimized: false,
  proxy: "http://127.0.0.1:7890",
  proxyMode: "system",
  isChinaProxy: false,
});

/** Default runtime settings applied when no legacy config exists. */
export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = Object.freeze({
  networkVisible: "local",
  chromeMCPSettings: Object.freeze({
    enabled: false,
    mcpName: "browser-mcp",
    type: "external",
    CDPport: 9222,
  }),
});

/**
 * Determine whether an unknown value exposes inspectable object fields.
 *
 * @param value Candidate value.
 * @returns True for non-array records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize a bounded text field while rejecting control characters.
 *
 * @param value Candidate text.
 * @param fallback Default text.
 * @param maximumLength Maximum accepted UTF-16 length.
 * @param pattern Optional complete-value allow-list pattern.
 * @returns Safe text value.
 */
function normalizeText(
  value: unknown,
  fallback: string,
  maximumLength: number,
  pattern?: RegExp,
): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (
    normalized.length === 0
    || normalized.length > maximumLength
    || /[\u0000-\u001F\u007F]/.test(normalized)
    || (pattern !== undefined && !pattern.test(normalized))
  ) {
    return fallback;
  }
  return normalized;
}

/**
 * Select an allow-listed string or return its default.
 *
 * @param value Candidate string.
 * @param allowed Allowed values.
 * @param fallback Default value.
 * @returns Allowed string.
 */
function normalizeChoice(value: unknown, allowed: ReadonlySet<string>, fallback: string): string {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

/**
 * Normalize untrusted or legacy system settings into the stable Core contract.
 *
 * @param value Candidate settings object.
 * @returns Complete bounded system settings.
 */
export function normalizeSystemSettings(value: unknown): SystemSettings {
  const record = isRecord(value) ? value : {};
  return {
    language: normalizeText(record.language, DEFAULT_SYSTEM_SETTINGS.language, 32, /^[A-Za-z0-9_-]+$/),
    theme: normalizeChoice(record.theme, SYSTEM_THEMES, DEFAULT_SYSTEM_SETTINGS.theme),
    network: "local",
    timezone: normalizeText(
      record.timezone,
      DEFAULT_SYSTEM_SETTINGS.timezone,
      128,
      /^[A-Za-z0-9_+./-]+$/,
    ),
    dateFormat: normalizeChoice(record.dateFormat, DATE_FORMATS, DEFAULT_SYSTEM_SETTINGS.dateFormat),
    launchAtStartup: record.launchAtStartup === true,
    startMinimized: record.startMinimized === true,
    proxy: normalizeText(record.proxy, DEFAULT_SYSTEM_SETTINGS.proxy, 2_048),
    proxyMode: normalizeChoice(record.proxyMode, PROXY_MODES, DEFAULT_SYSTEM_SETTINGS.proxyMode),
    isChinaProxy: record.isChinaProxy === true,
  };
}

/**
 * Normalize untrusted runtime settings required before Renderer startup.
 *
 * @param value Candidate runtime settings.
 * @returns Complete bounded runtime settings.
 */
export function normalizeRuntimeSettings(value: unknown): RuntimeSettings {
  const record = isRecord(value) ? value : {};
  const chrome = isRecord(record.chromeMCPSettings) ? record.chromeMCPSettings : {};
  const port = Number(chrome.CDPport);
  return {
    networkVisible: "local",
    chromeMCPSettings: {
      enabled: chrome.enabled === true,
      mcpName: chrome.mcpName === "playwright-mcp" ? "playwright-mcp" : "browser-mcp",
      type: chrome.type === "internal" ? "internal" : "external",
      CDPport: Number.isInteger(port) && port >= 1024 && port <= 65_535 ? port : 9222,
    },
  };
}

/**
 * Parse an exact Renderer system-settings replacement request.
 *
 * @param value Unknown IPC request.
 * @returns Validated settings replacement.
 */
export function parseSaveSystemSettingsRequest(value: unknown): SaveSystemSettingsRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !isRecord(value.settings)) {
    throw new Error("A system-settings object is required.");
  }
  return { settings: normalizeSystemSettings(value.settings) };
}
