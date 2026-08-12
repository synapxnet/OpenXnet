/** IPC channels owned by the Desktop Home Assistant credential boundary. */
export const APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-home-assistant-credentials:get-snapshot",
  save: "openxnet:application-home-assistant-credentials:save",
});

/** Stable schema returned for redacted Home Assistant credential snapshots. */
export const APPLICATION_HOME_ASSISTANT_CREDENTIAL_SCHEMA =
  "openxnet.home-assistant-credentials.v1" as const;

/** Exact Home Assistant secret fields accepted by the Desktop contract. */
export const APPLICATION_HOME_ASSISTANT_CREDENTIAL_FIELDS = Object.freeze([
  "api_key",
] as const);

/** Home Assistant credential field accepted by the strict Desktop contract. */
export type ApplicationHomeAssistantCredentialField =
  (typeof APPLICATION_HOME_ASSISTANT_CREDENTIAL_FIELDS)[number];

/** Maximum length accepted for one Home Assistant credential. */
export const MAX_APPLICATION_HOME_ASSISTANT_CREDENTIAL_LENGTH = 64 * 1024;

/** Main-owned Home Assistant credentials stored outside compatibility settings. */
export type ApplicationHomeAssistantCredentials = Readonly<
  Partial<Record<ApplicationHomeAssistantCredentialField, string>>
>;

/** Redacted Home Assistant credential state returned through authorized IPC. */
export interface ApplicationHomeAssistantCredentialSnapshot {
  readonly schema: typeof APPLICATION_HOME_ASSISTANT_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationHomeAssistantCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact Home Assistant credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationHomeAssistantCredentialsRequest {
  readonly credentials?: ApplicationHomeAssistantCredentials;
  readonly clear?: readonly ApplicationHomeAssistantCredentialField[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact Home Assistant credential field. */
export function isApplicationHomeAssistantCredentialField(
  value: unknown,
): value is ApplicationHomeAssistantCredentialField {
  return typeof value === "string"
    && APPLICATION_HOME_ASSISTANT_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse one bounded single-line Home Assistant credential value. */
export function parseApplicationHomeAssistantCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Home Assistant credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_HOME_ASSISTANT_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("Home Assistant credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact Home Assistant credential map from storage or IPC. */
export function parseApplicationHomeAssistantCredentials(
  value: unknown,
): ApplicationHomeAssistantCredentials {
  if (!isRecord(value)) throw new TypeError("Home Assistant credentials must be an object.");
  const credentials: Partial<Record<ApplicationHomeAssistantCredentialField, string>> = {};
  for (const [rawField, rawSecret] of Object.entries(value)) {
    if (!isApplicationHomeAssistantCredentialField(rawField)) {
      throw new TypeError("Home Assistant credential field is invalid.");
    }
    credentials[rawField] = parseApplicationHomeAssistantCredentialSecret(rawSecret);
  }
  return credentials;
}

/** Create configured field-name projections without returning Home Assistant secrets. */
export function createApplicationHomeAssistantCredentialConfigured(
  credentials: ApplicationHomeAssistantCredentials,
): readonly ApplicationHomeAssistantCredentialField[] {
  return APPLICATION_HOME_ASSISTANT_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** Parse one exact Home Assistant credential update and explicit clear list. */
export function parseSaveApplicationHomeAssistantCredentialsRequest(
  value: unknown,
): SaveApplicationHomeAssistantCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Home Assistant credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationHomeAssistantCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_HOME_ASSISTANT_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationHomeAssistantCredentialField(field))
  ) {
    throw new TypeError("Home Assistant credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationHomeAssistantCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("Home Assistant credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
