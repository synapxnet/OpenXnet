/** IPC channels owned by the Desktop voice-credential boundary. */
export const APPLICATION_VOICE_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-voice-credentials:get-snapshot",
  save: "openxnet:application-voice-credentials:save",
});

/** Stable schema returned for redacted voice credential snapshots. */
export const APPLICATION_VOICE_CREDENTIAL_SCHEMA = "openxnet.voice-credentials.v1" as const;

/** Reserved scope containing credentials for the default TTS configuration. */
export const APPLICATION_VOICE_DEFAULT_SCOPE = "default" as const;

/** Exact vendor credential fields supported by the voice trust zone. */
export const APPLICATION_VOICE_CREDENTIAL_FIELDS = Object.freeze([
  "azureSpeechKey",
  "volcAppId",
  "volcAccessKey",
  "volcSecretKey",
  "volcAppKey",
  "baiduApiKey",
  "baiduSecretKey",
  "minimaxApiKey",
  "minimaxGroupId",
  "xunfeiAppId",
  "xunfeiApiKey",
  "xunfeiApiSecret",
  "fishApiKey",
  "googleServiceAccount",
  "elevenLabsApiKey",
] as const);

/** Voice vendor field accepted by the strict contract. */
export type ApplicationVoiceCredentialField = (typeof APPLICATION_VOICE_CREDENTIAL_FIELDS)[number];

/** Maximum named voice scopes accepted in addition to the default scope. */
export const MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_COUNT = 128;

/** Maximum length accepted for one named voice scope. */
export const MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_LENGTH = 256;

/** Maximum length accepted for one voice vendor credential. */
export const MAX_APPLICATION_VOICE_CREDENTIAL_LENGTH = 128 * 1024;

/** Secrets held by one default or named voice scope. */
export type ApplicationVoiceScopeCredentials = Readonly<
  Partial<Record<ApplicationVoiceCredentialField, string>>
>;

/** Voice secrets indexed by default or named voice scope. */
export type ApplicationVoiceCredentials = Readonly<Record<string, ApplicationVoiceScopeCredentials>>;

/** Complete configured flags for one voice scope. */
export type ApplicationVoiceScopeConfigured = Readonly<
  Record<ApplicationVoiceCredentialField, boolean>
>;

/** Renderer-safe configured flags indexed by voice scope. */
export type ApplicationVoiceCredentialConfigured = Readonly<
  Record<string, ApplicationVoiceScopeConfigured>
>;

/** Redacted voice credential state returned through authorized IPC. */
export interface ApplicationVoiceCredentialSnapshot {
  readonly schema: typeof APPLICATION_VOICE_CREDENTIAL_SCHEMA;
  readonly configured: ApplicationVoiceCredentialConfigured;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Explicit voice credential clear operation for one scope. */
export interface ClearApplicationVoiceCredentialsRequest {
  readonly scope: string;
  readonly fields?: readonly ApplicationVoiceCredentialField[];
}

/** Exact voice credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationVoiceCredentialsRequest {
  readonly credentials?: ApplicationVoiceCredentials;
  readonly clear?: readonly ClearApplicationVoiceCredentialsRequest[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is a supported voice vendor credential field. */
export function isApplicationVoiceCredentialField(
  value: unknown,
): value is ApplicationVoiceCredentialField {
  return typeof value === "string"
    && APPLICATION_VOICE_CREDENTIAL_FIELDS.some((candidate) => candidate === value);
}

/** Parse and normalize one default or named voice scope. */
export function parseApplicationVoiceCredentialScope(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim()) {
    throw new TypeError("Voice credential scope is invalid.");
  }
  if (
    !value
    || value.length > MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_LENGTH
    || /[\u0000-\u001F\u007F]/.test(value)
  ) {
    throw new TypeError("Voice credential scope is invalid.");
  }
  return value;
}

/** Parse one bounded vendor credential, including structured Google JSON. */
export function parseApplicationVoiceCredentialSecret(
  field: ApplicationVoiceCredentialField,
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new TypeError("Voice credential entry is invalid.");
  }
  const secret = value.trim();
  const invalidCharacters = field === "googleServiceAccount"
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(secret)
    : /[\u0000-\u001F\u007F]/.test(secret);
  if (!secret || secret.length > MAX_APPLICATION_VOICE_CREDENTIAL_LENGTH || invalidCharacters) {
    throw new TypeError("Voice credential entry is invalid.");
  }
  if (field === "googleServiceAccount") {
    let document: unknown;
    try {
      document = JSON.parse(secret);
    } catch {
      throw new TypeError("Google voice service-account credential is invalid.");
    }
    if (!isRecord(document)) {
      throw new TypeError("Google voice service-account credential is invalid.");
    }
  }
  return secret;
}

/** Parse one exact credential map while enforcing scope and field limits. */
export function parseApplicationVoiceCredentials(value: unknown): ApplicationVoiceCredentials {
  if (!isRecord(value)) throw new TypeError("Voice credentials must be an object.");
  const entries = Object.entries(value);
  const namedScopeCount = entries.filter(([scope]) => scope !== APPLICATION_VOICE_DEFAULT_SCOPE).length;
  if (namedScopeCount > MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_COUNT) {
    throw new TypeError("Voice credential scope count exceeds its limit.");
  }
  const credentials: Record<string, Partial<Record<ApplicationVoiceCredentialField, string>>> = {};
  for (const [rawScope, rawFields] of entries) {
    const scope = parseApplicationVoiceCredentialScope(rawScope);
    if (!isRecord(rawFields)) throw new TypeError("Voice credential scope entry is invalid.");
    const fields: Partial<Record<ApplicationVoiceCredentialField, string>> = {};
    for (const [rawField, rawSecret] of Object.entries(rawFields)) {
      if (!isApplicationVoiceCredentialField(rawField)) {
        throw new TypeError("Voice credential field is invalid.");
      }
      fields[rawField] = parseApplicationVoiceCredentialSecret(rawField, rawSecret);
    }
    if (Object.keys(fields).length > 0) credentials[scope] = fields;
  }
  return credentials;
}

/** Create complete configured flags from one scoped secret map. */
export function createApplicationVoiceCredentialConfigured(
  credentials: ApplicationVoiceCredentials,
): ApplicationVoiceCredentialConfigured {
  const scopes = new Set([APPLICATION_VOICE_DEFAULT_SCOPE, ...Object.keys(credentials)]);
  return Object.fromEntries(
    [...scopes].map((scope) => [
      scope,
      Object.fromEntries(
        APPLICATION_VOICE_CREDENTIAL_FIELDS.map((field) => [field, Boolean(credentials[scope]?.[field])]),
      ) as unknown as ApplicationVoiceScopeConfigured,
    ]),
  );
}

/** Parse one exact, bounded voice credential mutation request. */
export function parseSaveApplicationVoiceCredentialsRequest(
  value: unknown,
): SaveApplicationVoiceCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Voice credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationVoiceCredentials(value.credentials);
  const clearValue = value.clear === undefined ? [] : value.clear;
  if (!Array.isArray(clearValue) || clearValue.length > MAX_APPLICATION_VOICE_CREDENTIAL_SCOPE_COUNT + 1) {
    throw new TypeError("Voice credential clear list is invalid.");
  }
  const clear: ClearApplicationVoiceCredentialsRequest[] = clearValue.map((entry) => {
    if (!isRecord(entry) || Object.keys(entry).some((key) => !["scope", "fields"].includes(key))) {
      throw new TypeError("Voice credential clear entry is invalid.");
    }
    const scope = parseApplicationVoiceCredentialScope(entry.scope);
    if (entry.fields === undefined) return { scope };
    if (!Array.isArray(entry.fields) || entry.fields.some((field) => !isApplicationVoiceCredentialField(field))) {
      throw new TypeError("Voice credential clear fields are invalid.");
    }
    return { scope, fields: [...new Set(entry.fields as ApplicationVoiceCredentialField[])] };
  });
  for (const entry of clear) {
    if (entry.fields === undefined && credentials[entry.scope] !== undefined) {
      throw new TypeError("Voice credentials cannot be saved and cleared together.");
    }
    if (entry.fields?.some((field) => credentials[entry.scope]?.[field] !== undefined)) {
      throw new TypeError("Voice credentials cannot be saved and cleared together.");
    }
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
