/** IPC channels owned by the Desktop ComfyUI credential boundary. */
export const APPLICATION_COMFYUI_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-comfyui-credentials:get-snapshot",
  save: "openxnet:application-comfyui-credentials:save",
});

/** Stable schema returned for redacted ComfyUI credential snapshots. */
export const APPLICATION_COMFYUI_CREDENTIAL_SCHEMA =
  "openxnet.comfyui-credentials.v1" as const;

/** Exact ComfyUI secret fields accepted by the Desktop contract. */
export const APPLICATION_COMFYUI_CREDENTIAL_FIELDS = Object.freeze([
  "api_key",
] as const);

/** ComfyUI credential field accepted by the strict Desktop contract. */
export type ApplicationComfyUiCredentialField =
  (typeof APPLICATION_COMFYUI_CREDENTIAL_FIELDS)[number];

/** Maximum length accepted for one ComfyUI credential. */
export const MAX_APPLICATION_COMFYUI_CREDENTIAL_LENGTH = 64 * 1024;

/** Main-owned ComfyUI credentials stored outside compatibility settings. */
export type ApplicationComfyUiCredentials = Readonly<
  Partial<Record<ApplicationComfyUiCredentialField, string>>
>;

/** Redacted ComfyUI credential state returned through authorized IPC. */
export interface ApplicationComfyUiCredentialSnapshot {
  readonly schema: typeof APPLICATION_COMFYUI_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationComfyUiCredentialField[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact ComfyUI credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationComfyUiCredentialsRequest {
  readonly credentials?: ApplicationComfyUiCredentials;
  readonly clear?: readonly ApplicationComfyUiCredentialField[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact ComfyUI credential field. */
export function isApplicationComfyUiCredentialField(
  value: unknown,
): value is ApplicationComfyUiCredentialField {
  return typeof value === "string"
    && APPLICATION_COMFYUI_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse one bounded single-line ComfyUI credential value. */
export function parseApplicationComfyUiCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("ComfyUI credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_COMFYUI_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("ComfyUI credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact ComfyUI credential map from storage or IPC. */
export function parseApplicationComfyUiCredentials(
  value: unknown,
): ApplicationComfyUiCredentials {
  if (!isRecord(value)) throw new TypeError("ComfyUI credentials must be an object.");
  const credentials: Partial<Record<ApplicationComfyUiCredentialField, string>> = {};
  for (const [rawField, rawSecret] of Object.entries(value)) {
    if (!isApplicationComfyUiCredentialField(rawField)) {
      throw new TypeError("ComfyUI credential field is invalid.");
    }
    credentials[rawField] = parseApplicationComfyUiCredentialSecret(rawSecret);
  }
  return credentials;
}

/** Create configured field-name projections without returning ComfyUI secrets. */
export function createApplicationComfyUiCredentialConfigured(
  credentials: ApplicationComfyUiCredentials,
): readonly ApplicationComfyUiCredentialField[] {
  return APPLICATION_COMFYUI_CREDENTIAL_FIELDS.filter((field) => Boolean(credentials[field]));
}

/** Parse one exact ComfyUI credential update and explicit clear list. */
export function parseSaveApplicationComfyUiCredentialsRequest(
  value: unknown,
): SaveApplicationComfyUiCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("ComfyUI credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationComfyUiCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (
    !Array.isArray(rawClear)
    || rawClear.length > APPLICATION_COMFYUI_CREDENTIAL_FIELDS.length
    || rawClear.some((field) => !isApplicationComfyUiCredentialField(field))
  ) {
    throw new TypeError("ComfyUI credential clear list is invalid.");
  }
  const clear = [...new Set(rawClear as ApplicationComfyUiCredentialField[])];
  if (clear.some((field) => credentials[field] !== undefined)) {
    throw new TypeError("ComfyUI credentials cannot be saved and cleared together.");
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
