/** IPC channels owned by the Desktop code-sandbox credential boundary. */
export const APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-code-sandbox-credentials:get-snapshot",
  save: "openxnet:application-code-sandbox-credentials:save",
});

/** Stable schema returned for redacted code-sandbox credential snapshots. */
export const APPLICATION_CODE_SANDBOX_CREDENTIAL_SCHEMA =
  "openxnet.code-sandbox-credentials.v1" as const;

/** Exact code-sandbox secret fields accepted by the Desktop contract. */
export const APPLICATION_CODE_SANDBOX_CREDENTIAL_FIELDS = Object.freeze([
  "e2b_api_key",
] as const);

/** Code-sandbox credential field accepted by the strict Desktop contract. */
export type ApplicationCodeSandboxCredentialField =
  (typeof APPLICATION_CODE_SANDBOX_CREDENTIAL_FIELDS)[number];

/** Maximum length accepted for one code-sandbox credential. */
export const MAX_APPLICATION_CODE_SANDBOX_CREDENTIAL_LENGTH = 64 * 1024;

/** Main-owned code-sandbox credentials stored outside compatibility settings. */
export type ApplicationCodeSandboxCredentials = Readonly<
  Partial<Record<ApplicationCodeSandboxCredentialField, string>>
>;

/** Redacted code-sandbox credential state returned through authorized IPC. */
export interface ApplicationCodeSandboxCredentialSnapshot {
  readonly schema: typeof APPLICATION_CODE_SANDBOX_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationCodeSandboxCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact code-sandbox credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationCodeSandboxCredentialsRequest {
  readonly credentials?: ApplicationCodeSandboxCredentials;
  readonly clear?: readonly ApplicationCodeSandboxCredentialField[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact code-sandbox credential field. */
export function isApplicationCodeSandboxCredentialField(
  value: unknown,
): value is ApplicationCodeSandboxCredentialField {
  return typeof value === "string"
    && APPLICATION_CODE_SANDBOX_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse one bounded single-line code-sandbox credential value. */
export function parseApplicationCodeSandboxCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Code-sandbox credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_CODE_SANDBOX_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("Code-sandbox credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact code-sandbox credential map from storage or IPC. */
export function parseApplicationCodeSandboxCredentials(
  value: unknown,
): ApplicationCodeSandboxCredentials {
  if (!isRecord(value)) throw new TypeError("Code-sandbox credentials must be an object.");
  const credentials: Partial<Record<ApplicationCodeSandboxCredentialField, string>> = {};
  for (const [rawField, rawSecret] of Object.entries(value)) {
    if (!isApplicationCodeSandboxCredentialField(rawField)) {
      throw new TypeError("Code-sandbox credential field is invalid.");
    }
    credentials[rawField] = parseApplicationCodeSandboxCredentialSecret(rawSecret);
  }
  return credentials;
}

/** Create configured field-name projections without returning code-sandbox secrets. */
export function createApplicationCodeSandboxCredentialConfigured(
  credentials: ApplicationCodeSandboxCredentials,
): readonly ApplicationCodeSandboxCredentialField[] {
  return APPLICATION_CODE_SANDBOX_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** Parse one exact code-sandbox credential update and explicit clear list. */
export function parseSaveApplicationCodeSandboxCredentialsRequest(
  value: unknown,
): SaveApplicationCodeSandboxCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Code-sandbox credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationCodeSandboxCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_CODE_SANDBOX_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationCodeSandboxCredentialField(field))
  ) {
    throw new TypeError("Code-sandbox credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationCodeSandboxCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("Code-sandbox credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
