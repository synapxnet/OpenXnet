import {
  MAX_APPLICATION_TOOL_CREDENTIAL_ENTRY_COUNT,
  MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT,
  isToolCredentialRecord,
  parseApplicationToolCredentialHeaderName,
  parseApplicationToolCredentialScope,
  parseApplicationToolCredentialSecret,
} from "./application-tool-credential-common";

/** IPC channels owned by the Desktop custom HTTP credential boundary. */
export const APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-http-tool-credentials:get-snapshot",
  save: "openxnet:application-http-tool-credentials:save",
});

/** Stable schema returned for redacted custom HTTP credential snapshots. */
export const APPLICATION_HTTP_TOOL_CREDENTIAL_SCHEMA = "openxnet.http-tool-credentials.v1" as const;

/** Sensitive headers indexed by stable custom HTTP tool identifier. */
export type ApplicationHttpToolCredentials = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

/** Renderer-safe configured header names indexed by custom HTTP tool ID. */
export type ApplicationHttpToolCredentialConfigured = Readonly<Record<string, readonly string[]>>;

/** Redacted custom HTTP credential state returned through authorized IPC. */
export interface ApplicationHttpToolCredentialSnapshot {
  readonly schema: typeof APPLICATION_HTTP_TOOL_CREDENTIAL_SCHEMA;
  readonly configured: ApplicationHttpToolCredentialConfigured;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Explicit custom HTTP credential clear operation for one tool. */
export interface ClearApplicationHttpToolCredentialsRequest {
  readonly toolId: string;
  readonly all?: boolean;
  readonly headers?: readonly string[];
}

/** Exact custom HTTP credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationHttpToolCredentialsRequest {
  readonly credentials?: ApplicationHttpToolCredentials;
  readonly clear?: readonly ClearApplicationHttpToolCredentialsRequest[];
}

/** Parse one exact custom HTTP credential map from storage or IPC. */
export function parseApplicationHttpToolCredentials(value: unknown): ApplicationHttpToolCredentials {
  if (!isToolCredentialRecord(value)) {
    throw new TypeError("Custom HTTP credentials must be an object.");
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT) {
    throw new TypeError("Custom HTTP credential tool count exceeds its limit.");
  }
  const credentials: Record<string, Record<string, string>> = {};
  for (const [rawToolId, rawHeaders] of entries) {
    const toolId = parseApplicationToolCredentialScope(rawToolId, "Custom HTTP");
    if (!isToolCredentialRecord(rawHeaders)) {
      throw new TypeError("Custom HTTP credential entry is invalid.");
    }
    const headerEntries = Object.entries(rawHeaders);
    if (headerEntries.length > MAX_APPLICATION_TOOL_CREDENTIAL_ENTRY_COUNT) {
      throw new TypeError("Custom HTTP credential headers exceed their entry limit.");
    }
    const headers: Record<string, string> = {};
    for (const [rawName, rawSecret] of headerEntries) {
      const name = parseApplicationToolCredentialHeaderName(rawName);
      headers[name] = parseApplicationToolCredentialSecret(rawSecret, { allowLineBreaks: false });
    }
    if (Object.keys(headers).length > 0) credentials[toolId] = headers;
  }
  return credentials;
}

/** Create configured header-name projections from one custom HTTP secret map. */
export function createApplicationHttpToolCredentialConfigured(
  credentials: ApplicationHttpToolCredentials,
): ApplicationHttpToolCredentialConfigured {
  return Object.fromEntries(
    Object.entries(credentials).map(([toolId, headers]) => [toolId, Object.keys(headers).sort()]),
  );
}

/** Parse one exact custom HTTP credential clear request. */
function parseClearRequest(value: unknown): ClearApplicationHttpToolCredentialsRequest {
  if (
    !isToolCredentialRecord(value)
    || Object.keys(value).some((key) => !["toolId", "all", "headers"].includes(key))
  ) {
    throw new TypeError("Custom HTTP credential clear entry is invalid.");
  }
  const toolId = parseApplicationToolCredentialScope(value.toolId, "Custom HTTP");
  const all = value.all === true;
  const headers = value.headers === undefined ? [] : value.headers;
  if (
    !Array.isArray(headers)
    || headers.some((name) => {
      try { parseApplicationToolCredentialHeaderName(name); return false; } catch { return true; }
    })
    || (all && headers.length > 0)
  ) {
    throw new TypeError("Custom HTTP credential clear entry is invalid.");
  }
  return {
    toolId,
    ...(all ? { all: true } : {}),
    ...(headers.length > 0 ? { headers: [...new Set(headers as string[])] } : {}),
  };
}

/** Parse one exact, bounded custom HTTP credential mutation request. */
export function parseSaveApplicationHttpToolCredentialsRequest(
  value: unknown,
): SaveApplicationHttpToolCredentialsRequest {
  if (
    !isToolCredentialRecord(value)
    || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))
  ) {
    throw new TypeError("Custom HTTP credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined
    ? {}
    : parseApplicationHttpToolCredentials(value.credentials);
  const clearValue = value.clear === undefined ? [] : value.clear;
  if (!Array.isArray(clearValue) || clearValue.length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT) {
    throw new TypeError("Custom HTTP credential clear list is invalid.");
  }
  const clear = clearValue.map(parseClearRequest);
  for (const entry of clear) {
    const saved = credentials[entry.toolId];
    if (entry.all && saved) {
      throw new TypeError("Custom HTTP credentials cannot be saved and cleared together.");
    }
    if (entry.headers?.some((name) => saved?.[name] !== undefined)) {
      throw new TypeError("Custom HTTP credentials cannot be saved and cleared together.");
    }
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
