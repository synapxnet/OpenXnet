/** IPC channels owned by the Desktop repository credential boundary. */
export const APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-repository-credentials:get-snapshot",
  save: "openxnet:application-repository-credentials:save",
});

/** Stable schema returned for redacted repository credential snapshots. */
export const APPLICATION_REPOSITORY_CREDENTIAL_SCHEMA =
  "openxnet.repository-credentials.v1" as const;

/** Exact repository credential fields accepted by the Desktop contract. */
export const APPLICATION_REPOSITORY_CREDENTIAL_FIELDS = Object.freeze([
  "gitee_token",
  "github_token",
] as const);

/** Repository credential field accepted by the strict Desktop contract. */
export type ApplicationRepositoryCredentialField =
  (typeof APPLICATION_REPOSITORY_CREDENTIAL_FIELDS)[number];

/** Maximum length accepted for one repository credential. */
export const MAX_APPLICATION_REPOSITORY_CREDENTIAL_LENGTH = 64 * 1024;

/** Main-owned repository credentials stored outside compatibility settings. */
export type ApplicationRepositoryCredentials = Readonly<
  Partial<Record<ApplicationRepositoryCredentialField, string>>
>;

/** Redacted repository credential state returned through authorized IPC. */
export interface ApplicationRepositoryCredentialSnapshot {
  readonly schema: typeof APPLICATION_REPOSITORY_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationRepositoryCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact repository credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationRepositoryCredentialsRequest {
  readonly credentials?: ApplicationRepositoryCredentials;
  readonly clear?: readonly ApplicationRepositoryCredentialField[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact repository credential field. */
export function isApplicationRepositoryCredentialField(
  value: unknown,
): value is ApplicationRepositoryCredentialField {
  return typeof value === "string"
    && APPLICATION_REPOSITORY_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse one bounded single-line repository credential value. */
export function parseApplicationRepositoryCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Repository credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_REPOSITORY_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("Repository credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact repository credential map from storage or IPC. */
export function parseApplicationRepositoryCredentials(
  value: unknown,
): ApplicationRepositoryCredentials {
  if (!isRecord(value)) throw new TypeError("Repository credentials must be an object.");
  const credentials: Partial<Record<ApplicationRepositoryCredentialField, string>> = {};
  for (const [rawField, rawSecret] of Object.entries(value)) {
    if (!isApplicationRepositoryCredentialField(rawField)) {
      throw new TypeError("Repository credential field is invalid.");
    }
    credentials[rawField] = parseApplicationRepositoryCredentialSecret(rawSecret);
  }
  return credentials;
}

/** Create configured field-name projections without returning repository secrets. */
export function createApplicationRepositoryCredentialConfigured(
  credentials: ApplicationRepositoryCredentials,
): readonly ApplicationRepositoryCredentialField[] {
  return APPLICATION_REPOSITORY_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** Parse one exact repository credential update and explicit clear list. */
export function parseSaveApplicationRepositoryCredentialsRequest(
  value: unknown,
): SaveApplicationRepositoryCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Repository credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationRepositoryCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_REPOSITORY_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationRepositoryCredentialField(field))
  ) {
    throw new TypeError("Repository credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationRepositoryCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("Repository credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
