/** IPC channels owned by the Desktop Connector Worker credential boundary. */
export const APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-connector-credentials:get-snapshot",
  save: "openxnet:application-connector-credentials:save",
});

/** Stable schema returned for redacted connector credential snapshots. */
export const APPLICATION_CONNECTOR_CREDENTIAL_SCHEMA = "openxnet.connector-credentials.v1" as const;

/** Exact Connector Worker platforms owned by this credential boundary. */
export const APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS = Object.freeze([
  "qq",
  "feishu",
  "dingtalk",
  "discord",
  "slack",
] as const);

/** Connector platform accepted by the strict Desktop contract. */
export type ApplicationConnectorCredentialPlatform =
  (typeof APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS)[number];

/** Exact secret fields accepted for each Connector Worker platform. */
export const APPLICATION_CONNECTOR_CREDENTIAL_FIELDS = Object.freeze({
  qq: Object.freeze(["secret"] as const),
  feishu: Object.freeze(["secret"] as const),
  dingtalk: Object.freeze(["appSecret"] as const),
  discord: Object.freeze(["token"] as const),
  slack: Object.freeze(["bot_token", "app_token"] as const),
});

/** Secret field accepted by at least one Connector Worker platform. */
export type ApplicationConnectorCredentialField =
  | "secret"
  | "appSecret"
  | "token"
  | "bot_token"
  | "app_token";

/** Maximum length accepted for one Connector Worker credential. */
export const MAX_APPLICATION_CONNECTOR_CREDENTIAL_LENGTH = 64 * 1024;

/** Connector secrets indexed by exact platform and field. */
export type ApplicationConnectorCredentials = Readonly<
  Partial<Record<
    ApplicationConnectorCredentialPlatform,
    Readonly<Partial<Record<ApplicationConnectorCredentialField, string>>>
  >>
>;

/** Renderer-safe configured field names for every Connector Worker platform. */
export type ApplicationConnectorCredentialConfigured = Readonly<
  Record<ApplicationConnectorCredentialPlatform, readonly ApplicationConnectorCredentialField[]>
>;

/** Redacted Connector Worker credential state returned through authorized IPC. */
export interface ApplicationConnectorCredentialSnapshot {
  readonly schema: typeof APPLICATION_CONNECTOR_CREDENTIAL_SCHEMA;
  readonly configured: ApplicationConnectorCredentialConfigured;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Explicit Connector Worker credential clear operation for one platform. */
export interface ClearApplicationConnectorCredentialsRequest {
  readonly platform: ApplicationConnectorCredentialPlatform;
  readonly fields?: readonly ApplicationConnectorCredentialField[];
}

/** Exact Connector Worker credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationConnectorCredentialsRequest {
  readonly credentials?: ApplicationConnectorCredentials;
  readonly clear?: readonly ClearApplicationConnectorCredentialsRequest[];
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether one value is an exact Connector Worker platform. */
export function isApplicationConnectorCredentialPlatform(
  value: unknown,
): value is ApplicationConnectorCredentialPlatform {
  return typeof value === "string"
    && APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS.some((candidate) => candidate === value);
}

/** Return the immutable credential field list for one Connector Worker platform. */
export function getApplicationConnectorCredentialFields(
  platform: ApplicationConnectorCredentialPlatform,
): readonly ApplicationConnectorCredentialField[] {
  return APPLICATION_CONNECTOR_CREDENTIAL_FIELDS[platform];
}

/** Return whether one field belongs to the selected Connector Worker platform. */
export function isApplicationConnectorCredentialField(
  platform: ApplicationConnectorCredentialPlatform,
  value: unknown,
): value is ApplicationConnectorCredentialField {
  return typeof value === "string"
    && getApplicationConnectorCredentialFields(platform).some((candidate) => candidate === value);
}

/** Parse one bounded single-line Connector Worker credential value. */
export function parseApplicationConnectorCredentialSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Connector credential entry is invalid.");
  }
  const secret = value.trim();
  if (
    secret.length < 4
    || secret.length > MAX_APPLICATION_CONNECTOR_CREDENTIAL_LENGTH
    || /[\u0000-\u001F\u007F]/.test(secret)
  ) {
    throw new TypeError("Connector credential entry is invalid.");
  }
  return secret;
}

/** Parse one exact Connector Worker credential map from storage or IPC. */
export function parseApplicationConnectorCredentials(value: unknown): ApplicationConnectorCredentials {
  if (!isRecord(value)) throw new TypeError("Connector credentials must be an object.");
  const credentials: Partial<Record<
    ApplicationConnectorCredentialPlatform,
    Partial<Record<ApplicationConnectorCredentialField, string>>
  >> = {};
  for (const [rawPlatform, rawFields] of Object.entries(value)) {
    if (!isApplicationConnectorCredentialPlatform(rawPlatform) || !isRecord(rawFields)) {
      throw new TypeError("Connector credential platform is invalid.");
    }
    const fields: Partial<Record<ApplicationConnectorCredentialField, string>> = {};
    for (const [rawField, rawSecret] of Object.entries(rawFields)) {
      if (!isApplicationConnectorCredentialField(rawPlatform, rawField)) {
        throw new TypeError("Connector credential field is invalid.");
      }
      fields[rawField] = parseApplicationConnectorCredentialSecret(rawSecret);
    }
    if (Object.keys(fields).length > 0) credentials[rawPlatform] = fields;
  }
  return credentials;
}

/** Create configured-name projections without returning Connector Worker secrets. */
export function createApplicationConnectorCredentialConfigured(
  credentials: ApplicationConnectorCredentials,
): ApplicationConnectorCredentialConfigured {
  return Object.fromEntries(
    APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS.map((platform) => [
      platform,
      getApplicationConnectorCredentialFields(platform)
        .filter((field) => Boolean(credentials[platform]?.[field])),
    ]),
  ) as unknown as ApplicationConnectorCredentialConfigured;
}

/** Parse one exact, bounded Connector Worker credential mutation request. */
export function parseSaveApplicationConnectorCredentialsRequest(
  value: unknown,
): SaveApplicationConnectorCredentialsRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))) {
    throw new TypeError("Connector credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationConnectorCredentials(value.credentials);
  const rawClear = value.clear === undefined ? [] : value.clear;
  if (!Array.isArray(rawClear) || rawClear.length > APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS.length) {
    throw new TypeError("Connector credential clear list is invalid.");
  }
  const clear: ClearApplicationConnectorCredentialsRequest[] = rawClear.map((entry) => {
    if (!isRecord(entry) || Object.keys(entry).some((key) => !["platform", "fields"].includes(key))) {
      throw new TypeError("Connector credential clear entry is invalid.");
    }
    if (!isApplicationConnectorCredentialPlatform(entry.platform)) {
      throw new TypeError("Connector credential clear platform is invalid.");
    }
    const platform = entry.platform;
    if (entry.fields === undefined) return { platform };
    if (
      !Array.isArray(entry.fields)
      || entry.fields.some((field) => !isApplicationConnectorCredentialField(platform, field))
    ) {
      throw new TypeError("Connector credential clear fields are invalid.");
    }
    return {
      platform,
      fields: [...new Set(entry.fields as ApplicationConnectorCredentialField[])],
    };
  });
  for (const entry of clear) {
    if (entry.fields === undefined && credentials[entry.platform] !== undefined) {
      throw new TypeError("Connector credentials cannot be saved and cleared together.");
    }
    if (entry.fields?.some((field) => credentials[entry.platform]?.[field] !== undefined)) {
      throw new TypeError("Connector credentials cannot be saved and cleared together.");
    }
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
