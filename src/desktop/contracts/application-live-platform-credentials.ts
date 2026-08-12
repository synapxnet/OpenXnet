/** IPC channels owned by the Desktop live-platform credential boundary. */
export const APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-live-platform-credentials:get-snapshot",
  save: "openxnet:application-live-platform-credentials:save",
});

/** Stable schema returned for redacted live-platform credential snapshots. */
export const APPLICATION_LIVE_PLATFORM_CREDENTIAL_SCHEMA =
  "openxnet.live-platform-credentials.v1" as const;

/** Exact live-platform secret fields accepted by the Desktop contract. */
export const APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS = Object.freeze([
  "bilibili_sessdata",
  "bilibili_ACCESS_KEY_SECRET",
  "bilibili_ROOM_OWNER_AUTH_CODE",
  "youtube_api_key",
  "twitch_access_token",
] as const);

/** Live-platform credential field accepted by the strict Desktop contract. */
export type ApplicationLivePlatformCredentialField =
  (typeof APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS)[number];

/** Maximum length accepted for one live-platform credential. */
export const MAX_APPLICATION_LIVE_PLATFORM_CREDENTIAL_LENGTH = 64 * 1024;

/** Main-owned live-platform credentials stored outside compatibility settings. */
export type ApplicationLivePlatformCredentials = Readonly<
  Partial<Record<ApplicationLivePlatformCredentialField, string>>
>;

/** Redacted live-platform credential state returned through authorized IPC. */
export interface ApplicationLivePlatformCredentialSnapshot {
  readonly schema: typeof APPLICATION_LIVE_PLATFORM_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationLivePlatformCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact live-platform credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationLivePlatformCredentialsRequest {
  readonly credentials?: ApplicationLivePlatformCredentials;
  readonly clear?: readonly ApplicationLivePlatformCredentialField[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact live-platform credential field. */
export function isApplicationLivePlatformCredentialField(
  value: unknown,
): value is ApplicationLivePlatformCredentialField {
  return typeof value === "string"
    && APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse one bounded single-line live-platform credential value. */
export function parseApplicationLivePlatformCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Live-platform credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_LIVE_PLATFORM_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("Live-platform credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact live-platform credential map from storage or IPC. */
export function parseApplicationLivePlatformCredentials(
  value: unknown,
): ApplicationLivePlatformCredentials {
  if (!isRecord(value)) throw new TypeError("Live-platform credentials must be an object.");
  const credentials: Partial<Record<ApplicationLivePlatformCredentialField, string>> = {};
  for (const [rawField, rawSecret] of Object.entries(value)) {
    if (!isApplicationLivePlatformCredentialField(rawField)) {
      throw new TypeError("Live-platform credential field is invalid.");
    }
    credentials[rawField] = parseApplicationLivePlatformCredentialSecret(rawSecret);
  }
  return credentials;
}

/** Create configured field-name projections without returning live-platform secrets. */
export function createApplicationLivePlatformCredentialConfigured(
  credentials: ApplicationLivePlatformCredentials,
): readonly ApplicationLivePlatformCredentialField[] {
  return APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** Parse one exact live-platform credential update and explicit clear list. */
export function parseSaveApplicationLivePlatformCredentialsRequest(
  value: unknown,
): SaveApplicationLivePlatformCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Live-platform credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationLivePlatformCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_LIVE_PLATFORM_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationLivePlatformCredentialField(field))
  ) {
    throw new TypeError("Live-platform credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationLivePlatformCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("Live-platform credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
