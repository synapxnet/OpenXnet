/** IPC channels owned by the Desktop search-credential boundary. */
export const APPLICATION_SEARCH_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-search-credentials:get-snapshot",
  save: "openxnet:application-search-credentials:save",
});

/** Stable schema returned for redacted search credential snapshots. */
export const APPLICATION_SEARCH_CREDENTIAL_SCHEMA = "openxnet.search-credentials.v1" as const;

/** Stable identifiers for supported search and crawler credential classes. */
export const APPLICATION_SEARCH_CREDENTIAL_IDS = Object.freeze([
  "tavily",
  "jina",
  "crawl4ai",
  "bing",
  "google",
  "brave",
  "exa",
  "serper",
  "bochaai",
  "firecrawl",
] as const);

/** Search credential identifier accepted by the strict contract. */
export type ApplicationSearchCredentialId = (typeof APPLICATION_SEARCH_CREDENTIAL_IDS)[number];

/** Search secrets indexed by their stable credential identifier. */
export type ApplicationSearchCredentials = Readonly<Partial<Record<ApplicationSearchCredentialId, string>>>;

/** Renderer-safe configured flags for every supported credential. */
export type ApplicationSearchCredentialConfigured = Readonly<Record<ApplicationSearchCredentialId, boolean>>;

/** Redacted search credential state returned through authorized IPC. */
export interface ApplicationSearchCredentialSnapshot {
  readonly schema: typeof APPLICATION_SEARCH_CREDENTIAL_SCHEMA;
  readonly configured: ApplicationSearchCredentialConfigured;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact search credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationSearchCredentialsRequest {
  readonly credentials?: ApplicationSearchCredentials;
  readonly clear?: readonly ApplicationSearchCredentialId[];
}

/** Maximum length accepted for one search vendor credential. */
export const MAX_APPLICATION_SEARCH_CREDENTIAL_LENGTH = 16_384;

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is a supported search credential identifier. */
export function isApplicationSearchCredentialId(
  value: unknown,
): value is ApplicationSearchCredentialId {
  return typeof value === "string"
    && APPLICATION_SEARCH_CREDENTIAL_IDS.some((candidate) => candidate === value);
}

/** Create a complete configured-flag record from one secret map. */
export function createApplicationSearchCredentialConfigured(
  credentials: ApplicationSearchCredentials,
): ApplicationSearchCredentialConfigured {
  return Object.fromEntries(
    APPLICATION_SEARCH_CREDENTIAL_IDS.map((id) => [id, Boolean(credentials[id])]),
  ) as unknown as ApplicationSearchCredentialConfigured;
}

/** Parse one exact, bounded search credential mutation request. */
export function parseSaveApplicationSearchCredentialsRequest(
  value: unknown,
): SaveApplicationSearchCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Search credential save request fields are invalid.");
  }
  const credentialsValue = value.credentials === undefined ? {} : value.credentials;
  if (!isRecord(credentialsValue)) {
    throw new TypeError("Search credentials must be an object.");
  }
  const credentials: Partial<Record<ApplicationSearchCredentialId, string>> = {};
  for (const [rawId, rawSecret] of Object.entries(credentialsValue)) {
    if (!isApplicationSearchCredentialId(rawId) || typeof rawSecret !== "string") {
      throw new TypeError("Search credential entry is invalid.");
    }
    const secret = rawSecret.trim();
    if (
      !secret
      || secret.length > MAX_APPLICATION_SEARCH_CREDENTIAL_LENGTH
      || /[\u0000-\u001F\u007F]/.test(secret)
    ) {
      throw new TypeError("Search credential entry is invalid.");
    }
    credentials[rawId] = secret;
  }
  const clearValue = value.clear === undefined ? [] : value.clear;
  if (!Array.isArray(clearValue) || clearValue.some((id) => !isApplicationSearchCredentialId(id))) {
    throw new TypeError("Search credential clear list is invalid.");
  }
  const clear = [...new Set(clearValue as ApplicationSearchCredentialId[])];
  if (clear.some((id) => credentials[id] !== undefined)) {
    throw new TypeError("Search credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
