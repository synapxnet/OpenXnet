/** Maximum scoped tool credential owners accepted by one boundary. */
export const MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_COUNT = 128;

/** Maximum length accepted for a server or tool identifier. */
export const MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_LENGTH = 256;

/** Maximum credential entries accepted in one environment or header map. */
export const MAX_APPLICATION_TOOL_CREDENTIAL_ENTRY_COUNT = 128;

/** Maximum length accepted for one tool credential value. */
export const MAX_APPLICATION_TOOL_CREDENTIAL_LENGTH = 128 * 1024;

/** Placeholder values that must never be treated as configured credentials. */
export const APPLICATION_TOOL_CREDENTIAL_PLACEHOLDERS = new Set([
  "your_api_key",
  "your-api-key",
  "your_token",
  "your-token",
  "bearer your_api_key",
  "bearer your-api-key",
]);

/** Determine whether an unknown value exposes inspectable object fields. */
export function isToolCredentialRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse one exact bounded server or tool identifier. */
export function parseApplicationToolCredentialScope(value: unknown, label: string): string {
  if (typeof value !== "string" || value !== value.trim()) {
    throw new TypeError(`${label} credential scope is invalid.`);
  }
  if (
    !value
    || value.length > MAX_APPLICATION_TOOL_CREDENTIAL_SCOPE_LENGTH
    || /[\u0000-\u001F\u007F]/.test(value)
  ) {
    throw new TypeError(`${label} credential scope is invalid.`);
  }
  return value;
}

/** Parse one portable environment variable name. */
export function parseApplicationToolCredentialEnvironmentName(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(value)) {
    throw new TypeError("MCP credential environment name is invalid.");
  }
  return value;
}

/** Parse one RFC token-compatible HTTP header name. */
export function parseApplicationToolCredentialHeaderName(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$/.test(value)
  ) {
    throw new TypeError("Tool credential header name is invalid.");
  }
  return value;
}

/** Return whether one HTTP header name carries authentication material. */
export function isSensitiveApplicationToolHeaderName(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "authorization"
    || normalized === "proxy-authorization"
    || normalized === "cookie"
    || normalized === "set-cookie"
    || /(^|[-_])(api[-_]?key|token|secret|password|passwd|credential|auth)([-_]|$)/i.test(normalized);
}

/** Parse one bounded credential value with lane-specific newline rules. */
export function parseApplicationToolCredentialSecret(
  value: unknown,
  options: { readonly allowLineBreaks: boolean },
): string {
  if (typeof value !== "string") throw new TypeError("Tool credential value is invalid.");
  const secret = value.trim();
  const invalidCharacters = options.allowLineBreaks
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(secret)
    : /[\u0000-\u001F\u007F]/.test(secret);
  if (!secret || secret.length > MAX_APPLICATION_TOOL_CREDENTIAL_LENGTH || invalidCharacters) {
    throw new TypeError("Tool credential value is invalid.");
  }
  return secret;
}

/** Return whether one value is only a documentation placeholder. */
export function isApplicationToolCredentialPlaceholder(value: string): boolean {
  return APPLICATION_TOOL_CREDENTIAL_PLACEHOLDERS.has(value.trim().toLowerCase());
}
