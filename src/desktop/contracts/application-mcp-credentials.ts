import {
  MAX_APPLICATION_TOOL_CREDENTIAL_ENTRY_COUNT,
  MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT,
  isToolCredentialRecord,
  parseApplicationToolCredentialEnvironmentName,
  parseApplicationToolCredentialHeaderName,
  parseApplicationToolCredentialScope,
  parseApplicationToolCredentialSecret,
} from "./application-tool-credential-common";

/** IPC channels owned by the Desktop MCP credential boundary. */
export const APPLICATION_MCP_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-mcp-credentials:get-snapshot",
  save: "openxnet:application-mcp-credentials:save",
});

/** Stable schema returned for redacted MCP credential snapshots. */
export const APPLICATION_MCP_CREDENTIAL_SCHEMA = "openxnet.mcp-credentials.v1" as const;

/** Secret process environment and transport headers for one MCP server. */
export interface ApplicationMcpServerCredentials {
  readonly env?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
}

/** MCP credentials indexed by stable server identifier. */
export type ApplicationMcpCredentials = Readonly<Record<string, ApplicationMcpServerCredentials>>;

/** Renderer-safe configured credential names for one MCP server. */
export interface ApplicationMcpServerCredentialConfigured {
  readonly env: readonly string[];
  readonly headers: readonly string[];
}

/** Renderer-safe configured names indexed by MCP server identifier. */
export type ApplicationMcpCredentialConfigured = Readonly<
  Record<string, ApplicationMcpServerCredentialConfigured>
>;

/** Redacted MCP credential state returned through authorized IPC. */
export interface ApplicationMcpCredentialSnapshot {
  readonly schema: typeof APPLICATION_MCP_CREDENTIAL_SCHEMA;
  readonly configured: ApplicationMcpCredentialConfigured;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Explicit MCP credential clear operation for one server. */
export interface ClearApplicationMcpCredentialsRequest {
  readonly serverId: string;
  readonly all?: boolean;
  readonly env?: readonly string[];
  readonly headers?: readonly string[];
}

/** Exact MCP credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationMcpCredentialsRequest {
  readonly credentials?: ApplicationMcpCredentials;
  readonly clear?: readonly ClearApplicationMcpCredentialsRequest[];
}

/** Parse one credential-name map using the exact lane validator. */
function parseCredentialMap(
  value: unknown,
  lane: "env" | "headers",
): Readonly<Record<string, string>> {
  if (!isToolCredentialRecord(value)) throw new TypeError("MCP credential lane is invalid.");
  const entries = Object.entries(value);
  if (entries.length > MAX_APPLICATION_TOOL_CREDENTIAL_ENTRY_COUNT) {
    throw new TypeError("MCP credential lane exceeds its entry limit.");
  }
  const credentials: Record<string, string> = {};
  for (const [rawName, rawSecret] of entries) {
    const name = lane === "env"
      ? parseApplicationToolCredentialEnvironmentName(rawName)
      : parseApplicationToolCredentialHeaderName(rawName);
    credentials[name] = parseApplicationToolCredentialSecret(rawSecret, {
      allowLineBreaks: lane === "env",
    });
  }
  return credentials;
}

/** Parse one exact MCP credential map from storage or IPC. */
export function parseApplicationMcpCredentials(value: unknown): ApplicationMcpCredentials {
  if (!isToolCredentialRecord(value)) throw new TypeError("MCP credentials must be an object.");
  const entries = Object.entries(value);
  if (entries.length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT) {
    throw new TypeError("MCP credential server count exceeds its limit.");
  }
  const credentials: Record<string, ApplicationMcpServerCredentials> = {};
  for (const [rawServerId, rawLanes] of entries) {
    const serverId = parseApplicationToolCredentialScope(rawServerId, "MCP");
    if (
      !isToolCredentialRecord(rawLanes)
      || Object.keys(rawLanes).some((key) => !["env", "headers"].includes(key))
    ) {
      throw new TypeError("MCP credential server entry is invalid.");
    }
    const env = rawLanes.env === undefined ? {} : parseCredentialMap(rawLanes.env, "env");
    const headers = rawLanes.headers === undefined
      ? {}
      : parseCredentialMap(rawLanes.headers, "headers");
    if (Object.keys(env).length > 0 || Object.keys(headers).length > 0) {
      credentials[serverId] = {
        ...(Object.keys(env).length > 0 ? { env } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      };
    }
  }
  return credentials;
}

/** Create configured-name projections from one MCP secret map. */
export function createApplicationMcpCredentialConfigured(
  credentials: ApplicationMcpCredentials,
): ApplicationMcpCredentialConfigured {
  return Object.fromEntries(
    Object.entries(credentials).map(([serverId, lanes]) => [serverId, {
      env: Object.keys(lanes.env || {}).sort(),
      headers: Object.keys(lanes.headers || {}).sort(),
    }]),
  );
}

/** Parse one exact MCP credential clear request. */
function parseClearRequest(value: unknown): ClearApplicationMcpCredentialsRequest {
  if (
    !isToolCredentialRecord(value)
    || Object.keys(value).some((key) => !["serverId", "all", "env", "headers"].includes(key))
  ) {
    throw new TypeError("MCP credential clear entry is invalid.");
  }
  const serverId = parseApplicationToolCredentialScope(value.serverId, "MCP");
  const all = value.all === true;
  const env = value.env === undefined ? [] : value.env;
  const headers = value.headers === undefined ? [] : value.headers;
  if (
    !Array.isArray(env)
    || env.some((name) => {
      try { parseApplicationToolCredentialEnvironmentName(name); return false; } catch { return true; }
    })
    || !Array.isArray(headers)
    || headers.some((name) => {
      try { parseApplicationToolCredentialHeaderName(name); return false; } catch { return true; }
    })
    || (all && (env.length > 0 || headers.length > 0))
  ) {
    throw new TypeError("MCP credential clear entry is invalid.");
  }
  return {
    serverId,
    ...(all ? { all: true } : {}),
    ...(env.length > 0 ? { env: [...new Set(env as string[])] } : {}),
    ...(headers.length > 0 ? { headers: [...new Set(headers as string[])] } : {}),
  };
}

/** Parse one exact, bounded MCP credential mutation request. */
export function parseSaveApplicationMcpCredentialsRequest(
  value: unknown,
): SaveApplicationMcpCredentialsRequest {
  if (
    !isToolCredentialRecord(value)
    || Object.keys(value).some((key) => !["credentials", "clear"].includes(key))
  ) {
    throw new TypeError("MCP credential save request fields are invalid.");
  }
  const credentials = value.credentials === undefined ? {} : parseApplicationMcpCredentials(value.credentials);
  const clearValue = value.clear === undefined ? [] : value.clear;
  if (!Array.isArray(clearValue) || clearValue.length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT) {
    throw new TypeError("MCP credential clear list is invalid.");
  }
  const clear = clearValue.map(parseClearRequest);
  for (const entry of clear) {
    const saved = credentials[entry.serverId];
    if (entry.all && saved) throw new TypeError("MCP credentials cannot be saved and cleared together.");
    if (entry.env?.some((name) => saved?.env?.[name] !== undefined)) {
      throw new TypeError("MCP credentials cannot be saved and cleared together.");
    }
    if (entry.headers?.some((name) => saved?.headers?.[name] !== undefined)) {
      throw new TypeError("MCP credentials cannot be saved and cleared together.");
    }
  }
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(clear.length > 0 ? { clear } : {}),
  };
}
