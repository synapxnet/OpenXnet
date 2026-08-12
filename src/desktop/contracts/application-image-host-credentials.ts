/** IPC channels owned by the Desktop image-host credential boundary. */
export const APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-image-host-credentials:get-snapshot",
  save: "openxnet:application-image-host-credentials:save",
});

/** Stable schema returned for redacted image-host credential snapshots. */
export const APPLICATION_IMAGE_HOST_CREDENTIAL_SCHEMA = "openxnet.image-host-credentials.v1" as const;

/** Exact image-host credential fields accepted by the Desktop contract. */
export const APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS = Object.freeze([
  "SMMS_api_key",
  "EI2_api_key",
] as const);

/** Image-host credential field accepted by the strict Desktop contract. */
export type ApplicationImageHostCredentialField =
  (typeof APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS)[number];

/** Maximum length accepted for one image-host credential. */
export const MAX_APPLICATION_IMAGE_HOST_CREDENTIAL_LENGTH = 64 * 1024;

/** Main-owned image-host credentials stored outside compatibility settings. */
export type ApplicationImageHostCredentials = Readonly<
  Partial<Record<ApplicationImageHostCredentialField, string>>
>;

/** Redacted image-host credential state returned through authorized IPC. */
export interface ApplicationImageHostCredentialSnapshot {
  readonly schema: typeof APPLICATION_IMAGE_HOST_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationImageHostCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact image-host credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationImageHostCredentialsRequest {
  readonly credentials?: ApplicationImageHostCredentials;
  readonly clear?: readonly ApplicationImageHostCredentialField[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact image-host credential field. */
export function isApplicationImageHostCredentialField(
  value: unknown,
): value is ApplicationImageHostCredentialField {
  return typeof value === "string"
    && APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse one bounded single-line image-host credential value. */
export function parseApplicationImageHostCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Image-host credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_IMAGE_HOST_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("Image-host credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact image-host credential map from storage or IPC. */
export function parseApplicationImageHostCredentials(
  value: unknown,
): ApplicationImageHostCredentials {
  if (!isRecord(value)) throw new TypeError("Image-host credentials must be an object.");
  const credentials: Partial<Record<ApplicationImageHostCredentialField, string>> = {};
  for (const [rawField, rawSecret] of Object.entries(value)) {
    if (!isApplicationImageHostCredentialField(rawField)) {
      throw new TypeError("Image-host credential field is invalid.");
    }
    credentials[rawField] = parseApplicationImageHostCredentialSecret(rawSecret);
  }
  return credentials;
}

/** Create configured field-name projections without returning image-host secrets. */
export function createApplicationImageHostCredentialConfigured(
  credentials: ApplicationImageHostCredentials,
): readonly ApplicationImageHostCredentialField[] {
  return APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** Parse one exact image-host credential update and explicit clear list. */
export function parseSaveApplicationImageHostCredentialsRequest(
  value: unknown,
): SaveApplicationImageHostCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Image-host credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationImageHostCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_IMAGE_HOST_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationImageHostCredentialField(field))
  ) {
    throw new TypeError("Image-host credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationImageHostCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("Image-host credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
