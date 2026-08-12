import { createHash } from "node:crypto";
import path from "node:path";

/** IPC channels owned by the Desktop terminal-delivery credential boundary. */
export const APPLICATION_DELIVERY_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-delivery-credentials:get-snapshot",
  save: "openxnet:application-delivery-credentials:save",
});

/** Stable schema returned for redacted terminal-delivery credential snapshots. */
export const APPLICATION_DELIVERY_CREDENTIAL_SCHEMA =
  "openxnet.delivery-credentials.v1" as const;

/** Terminal targets whose inline configuration can contain independent secrets. */
export const APPLICATION_DELIVERY_CREDENTIAL_TARGETS = Object.freeze([
  "webhook",
  "discord",
] as const);

/** Exact scalar secret fields accepted by the delivery boundary. */
export const APPLICATION_DELIVERY_CREDENTIAL_FIELDS = Object.freeze([
  "url",
  "webhook_url",
] as const);

/** Maximum number of scoped task delivery entries retained by Main. */
export const MAX_APPLICATION_DELIVERY_CREDENTIAL_SCOPES = 512;

/** Maximum number of encrypted headers retained for one webhook scope. */
export const MAX_APPLICATION_DELIVERY_CREDENTIAL_HEADERS = 64;

/** Maximum length accepted for one delivery credential value. */
export const MAX_APPLICATION_DELIVERY_CREDENTIAL_LENGTH = 64 * 1024;

/** Maximum serialized credential bytes retained for one request-deliverable scope. */
export const MAX_APPLICATION_DELIVERY_CREDENTIAL_SCOPE_BYTES = 192 * 1024;

/** Transport-owned headers that user delivery credentials must never override. */
const BLOCKED_APPLICATION_DELIVERY_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Delivery target with independent task-scoped credentials. */
export type ApplicationDeliveryCredentialTarget =
  (typeof APPLICATION_DELIVERY_CREDENTIAL_TARGETS)[number];

/** Scalar delivery credential field accepted by the strict contract. */
export type ApplicationDeliveryCredentialField =
  (typeof APPLICATION_DELIVERY_CREDENTIAL_FIELDS)[number];

/** Stable compound scope used to isolate one task delivery target. */
export interface ApplicationDeliveryCredentialScope {
  readonly workspacePath: string;
  readonly taskId: string;
  readonly target: ApplicationDeliveryCredentialTarget;
}

/** Secret values stored for one exact task delivery target. */
export interface ApplicationDeliveryCredentialValues {
  readonly url?: string;
  readonly webhook_url?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** One encrypted entry with its non-secret lookup scope. */
export interface ApplicationDeliveryCredentialEntry {
  readonly scope: ApplicationDeliveryCredentialScope;
  readonly credentials: ApplicationDeliveryCredentialValues;
}

/** Complete Main-owned delivery credential map keyed by deterministic scope ID. */
export type ApplicationDeliveryCredentials = Readonly<
  Record<string, ApplicationDeliveryCredentialEntry>
>;

/** Configured-only projection for one delivery credential scope. */
export interface ApplicationDeliveryCredentialConfiguredEntry {
  readonly scopeId: string;
  readonly workspacePath: string;
  readonly taskId: string;
  readonly target: ApplicationDeliveryCredentialTarget;
  readonly fields: readonly ApplicationDeliveryCredentialField[];
  readonly headers: readonly string[];
}

/** Redacted delivery credential state returned through authorized IPC. */
export interface ApplicationDeliveryCredentialSnapshot {
  readonly schema: typeof APPLICATION_DELIVERY_CREDENTIAL_SCHEMA;
  readonly configured: readonly ApplicationDeliveryCredentialConfiguredEntry[];
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact replacement or clear operation for one compound delivery scope. */
export interface SaveApplicationDeliveryCredentialsRequest {
  readonly scope: ApplicationDeliveryCredentialScope;
  readonly credentials?: ApplicationDeliveryCredentialValues;
  readonly clear?: true;
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject control characters from one bounded non-empty string. */
function parseBoundedText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid.`);
  const normalized = value.trim();
  if (
    normalized.length === 0
    || normalized.length > maximumLength
    || /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new TypeError(`${label} is invalid.`);
  }
  return normalized;
}

/** Return whether one host is an explicit loopback address. */
function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return normalized === "localhost"
    || normalized === "::1"
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

/** Parse one protected webhook URL with HTTPS required outside loopback. */
export function parseApplicationDeliveryCredentialUrl(value: unknown): string {
  const normalized = parseBoundedText(value, "Delivery credential URL", 4_096);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError("Delivery credential URL is invalid.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol)
    || !parsed.hostname
    || parsed.username
    || parsed.password
    || parsed.hash
    || (parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname))
  ) {
    throw new TypeError("Delivery credential URL is invalid.");
  }
  return parsed.href;
}

/** Parse one portable RFC token header name. */
export function parseApplicationDeliveryCredentialHeaderName(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$/.test(value)
  ) {
    throw new TypeError("Delivery credential header name is invalid.");
  }
  const normalized = value.toLowerCase();
  if (BLOCKED_APPLICATION_DELIVERY_HEADERS.has(normalized)) {
    throw new TypeError("Delivery credential header name is invalid.");
  }
  return normalized;
}

/** Parse one bounded single-line delivery header value. */
export function parseApplicationDeliveryCredentialSecret(value: unknown): string {
  return parseBoundedText(
    value,
    "Delivery credential value",
    MAX_APPLICATION_DELIVERY_CREDENTIAL_LENGTH,
  );
}

/** Normalize one workspace, task, and target compound scope. */
export function parseApplicationDeliveryCredentialScope(
  value: unknown,
): ApplicationDeliveryCredentialScope {
  if (
    !isRecord(value)
    || Object.keys(value).some((key) => !["workspacePath", "taskId", "target"].includes(key))
  ) {
    throw new TypeError("Delivery credential scope is invalid.");
  }
  const workspacePath = path.resolve(parseBoundedText(
    value.workspacePath,
    "Delivery credential workspacePath",
    32_768,
  ));
  const taskId = parseBoundedText(value.taskId, "Delivery credential taskId", 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(taskId)) {
    throw new TypeError("Delivery credential taskId is invalid.");
  }
  if (
    typeof value.target !== "string"
    || !APPLICATION_DELIVERY_CREDENTIAL_TARGETS.some((target) => target === value.target)
  ) {
    throw new TypeError("Delivery credential target is invalid.");
  }
  return {
    workspacePath,
    taskId,
    target: value.target as ApplicationDeliveryCredentialTarget,
  };
}

/** Derive one deterministic non-secret identifier for a compound delivery scope. */
export function createApplicationDeliveryCredentialScopeId(
  value: ApplicationDeliveryCredentialScope,
): string {
  const scope = parseApplicationDeliveryCredentialScope(value);
  const workspaceFingerprint = process.platform === "win32"
    ? scope.workspacePath.toLowerCase()
    : scope.workspacePath;
  return createHash("sha256")
    .update(JSON.stringify([workspaceFingerprint, scope.taskId, scope.target]), "utf8")
    .digest("hex");
}

/** Parse exact credentials for one target and reject cross-target fields. */
export function parseApplicationDeliveryCredentialValues(
  value: unknown,
  target: ApplicationDeliveryCredentialTarget,
): ApplicationDeliveryCredentialValues {
  if (!isRecord(value)) throw new TypeError("Delivery credentials must be an object.");
  const allowed = target === "webhook" ? ["url", "headers"] : ["webhook_url"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new TypeError("Delivery credential field is invalid.");
  }
  const credentials: {
    url?: string;
    webhook_url?: string;
    headers?: Record<string, string>;
  } = {};
  if (value.url !== undefined) credentials.url = parseApplicationDeliveryCredentialUrl(value.url);
  if (value.webhook_url !== undefined) {
    credentials.webhook_url = parseApplicationDeliveryCredentialUrl(value.webhook_url);
  }
  if (value.headers !== undefined) {
    if (!isRecord(value.headers) || Object.keys(value.headers).length > MAX_APPLICATION_DELIVERY_CREDENTIAL_HEADERS) {
      throw new TypeError("Delivery credential headers are invalid.");
    }
    const headers: Record<string, string> = {};
    for (const [rawName, rawSecret] of Object.entries(value.headers)) {
      const name = parseApplicationDeliveryCredentialHeaderName(rawName);
      if (Object.prototype.hasOwnProperty.call(headers, name)) {
        throw new TypeError("Delivery credential header name is invalid.");
      }
      headers[name] = parseApplicationDeliveryCredentialSecret(rawSecret);
    }
    if (Object.keys(headers).length > 0) credentials.headers = headers;
  }
  if (Object.keys(credentials).length === 0) {
    throw new TypeError("At least one delivery credential is required.");
  }
  if (
    Buffer.byteLength(JSON.stringify(credentials), "utf8")
    > MAX_APPLICATION_DELIVERY_CREDENTIAL_SCOPE_BYTES
  ) {
    throw new TypeError("Delivery credentials exceed the scope byte budget.");
  }
  return credentials;
}

/** Parse the complete encrypted delivery credential map from storage. */
export function parseApplicationDeliveryCredentials(value: unknown): ApplicationDeliveryCredentials {
  if (!isRecord(value) || Object.keys(value).length > MAX_APPLICATION_DELIVERY_CREDENTIAL_SCOPES) {
    throw new TypeError("Delivery credential store is invalid.");
  }
  const entries: Record<string, ApplicationDeliveryCredentialEntry> = {};
  for (const [scopeId, rawEntry] of Object.entries(value)) {
    if (
      !/^[a-f0-9]{64}$/.test(scopeId)
      || !isRecord(rawEntry)
      || Object.keys(rawEntry).some((key) => !["scope", "credentials"].includes(key))
    ) {
      throw new TypeError("Delivery credential store entry is invalid.");
    }
    const scope = parseApplicationDeliveryCredentialScope(rawEntry.scope);
    if (createApplicationDeliveryCredentialScopeId(scope) !== scopeId) {
      throw new TypeError("Delivery credential scope identifier is invalid.");
    }
    entries[scopeId] = {
      scope,
      credentials: parseApplicationDeliveryCredentialValues(rawEntry.credentials, scope.target),
    };
  }
  return entries;
}

/** Create a configured-only projection without exposing delivery secrets. */
export function createApplicationDeliveryCredentialConfigured(
  entries: ApplicationDeliveryCredentials,
): readonly ApplicationDeliveryCredentialConfiguredEntry[] {
  return Object.entries(entries).map(([scopeId, entry]) => ({
    scopeId,
    ...entry.scope,
    fields: APPLICATION_DELIVERY_CREDENTIAL_FIELDS.filter(
      (field) => Boolean(entry.credentials[field]),
    ),
    headers: Object.keys(entry.credentials.headers ?? {}).sort(),
  })).sort((left, right) => left.scopeId.localeCompare(right.scopeId));
}

/** Parse one exact scope replacement or explicit whole-scope clear request. */
export function parseSaveApplicationDeliveryCredentialsRequest(
  value: unknown,
): SaveApplicationDeliveryCredentialsRequest {
  if (
    !isRecord(value)
    || Object.keys(value).some((key) => !["scope", "credentials", "clear"].includes(key))
  ) {
    throw new TypeError("Delivery credential save request is invalid.");
  }
  const scope = parseApplicationDeliveryCredentialScope(value.scope);
  const hasCredentials = value.credentials !== undefined;
  const clear = value.clear === true;
  if (hasCredentials === clear) {
    throw new TypeError("Delivery credentials require one replacement or clear operation.");
  }
  return clear
    ? { scope, clear: true }
    : {
        scope,
        credentials: parseApplicationDeliveryCredentialValues(value.credentials, scope.target),
      };
}
