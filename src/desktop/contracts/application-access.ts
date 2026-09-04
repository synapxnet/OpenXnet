import type { ApplicationAuthSnapshot } from "./application-auth";

/** IPC channels owned by the Main-process account access gateway. */
export const APPLICATION_ACCESS_CHANNELS = Object.freeze({
  request: "openxnet:application-access:request",
});

/** Stable schema returned for one account gateway result. */
export const APPLICATION_ACCESS_SCHEMA = "openxnet.application-access.v1" as const;

/** Maximum serialized request body accepted from Renderer. */
export const MAX_APPLICATION_ACCESS_REQUEST_BYTES = 64 * 1024;

/** Maximum response body accepted from the remote account service. */
export const MAX_APPLICATION_ACCESS_RESPONSE_BYTES = 1024 * 1024;

/** Methods exposed by the account access gateway. */
export type ApplicationAccessMethod = "GET" | "POST" | "PUT";

/** Authentication behavior attached to one allow-listed remote route. */
export type ApplicationAccessAuthMode = "none" | "optional" | "required" | "refresh";

/** Session mutation applied after one successful remote response. */
export type ApplicationAccessSessionAction = "none" | "capture" | "clear";

/** Renderer request for one allow-listed account or subscription operation. */
export interface ApplicationAccessRequest {
  readonly path: string;
  readonly method?: ApplicationAccessMethod;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
}

/** Validated route and bounded request data used only inside Main. */
export interface ParsedApplicationAccessRequest {
  readonly path: string;
  readonly targetPath: string;
  readonly method: ApplicationAccessMethod;
  readonly body: Readonly<Record<string, unknown>> | null;
  readonly timeoutMs: number;
  readonly authMode: ApplicationAccessAuthMode;
  readonly sessionAction: ApplicationAccessSessionAction;
}

/** Sanitized account gateway error safe to expose to Renderer. */
export interface ApplicationAccessError {
  readonly code: string;
  readonly message: string;
}

/** Tagged account gateway result returned without throwing remote details through IPC. */
export type ApplicationAccessResult = {
  readonly schema: typeof APPLICATION_ACCESS_SCHEMA;
  readonly ok: true;
  readonly status: number;
  readonly payload: unknown;
  readonly authSnapshot: ApplicationAuthSnapshot;
} | {
  readonly schema: typeof APPLICATION_ACCESS_SCHEMA;
  readonly ok: false;
  readonly status: number;
  readonly error: ApplicationAccessError;
  readonly authSnapshot: ApplicationAuthSnapshot;
};

interface StaticApplicationAccessRoute {
  readonly method: ApplicationAccessMethod;
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly authMode: ApplicationAccessAuthMode;
  readonly sessionAction: ApplicationAccessSessionAction;
  readonly bodyFields: readonly string[];
}

const STATIC_APPLICATION_ACCESS_ROUTES: readonly StaticApplicationAccessRoute[] = Object.freeze([
  { method: "GET", sourcePath: "/v1/access/plans", targetPath: "/sub/plans", authMode: "optional", sessionAction: "none", bodyFields: [] },
  { method: "POST", sourcePath: "/v1/access/auth/sms/send", targetPath: "/auth/sms/send", authMode: "none", sessionAction: "none", bodyFields: ["phone", "purpose"] },
  { method: "POST", sourcePath: "/v1/access/auth/register", targetPath: "/auth/register", authMode: "none", sessionAction: "capture", bodyFields: ["phone", "code", "password", "nickname", "email", "terms_accepted", "privacy_accepted", "agreements_accepted", "agreements_locale"] },
  { method: "POST", sourcePath: "/v1/access/auth/login/password", targetPath: "/auth/login/password", authMode: "none", sessionAction: "capture", bodyFields: ["identity", "password", "terms_accepted", "privacy_accepted", "agreements_accepted", "agreements_locale"] },
  { method: "POST", sourcePath: "/v1/access/auth/password/reset", targetPath: "/auth/password/reset", authMode: "none", sessionAction: "capture", bodyFields: ["phone", "code", "new_password", "terms_accepted", "privacy_accepted", "agreements_accepted", "agreements_locale"] },
  { method: "POST", sourcePath: "/v1/access/auth/login/sms", targetPath: "/auth/login/sms", authMode: "none", sessionAction: "capture", bodyFields: ["phone", "code", "terms_accepted", "privacy_accepted", "agreements_accepted", "agreements_locale"] },
  { method: "POST", sourcePath: "/v1/access/auth/refresh", targetPath: "/auth/refresh", authMode: "refresh", sessionAction: "capture", bodyFields: [] },
  { method: "GET", sourcePath: "/v1/access/auth/me", targetPath: "/auth/me", authMode: "required", sessionAction: "capture", bodyFields: [] },
  { method: "PUT", sourcePath: "/v1/access/auth/me/update", targetPath: "/auth/me/update", authMode: "required", sessionAction: "capture", bodyFields: ["nickname", "email"] },
  { method: "POST", sourcePath: "/v1/access/auth/logout", targetPath: "/auth/logout", authMode: "required", sessionAction: "clear", bodyFields: [] },
  { method: "POST", sourcePath: "/v1/access/sub/purchase", targetPath: "/sub/purchase", authMode: "required", sessionAction: "none", bodyFields: ["plan_code", "billing_cycle", "pay_type", "return_url"] },
  { method: "POST", sourcePath: "/v1/access/sub/renew", targetPath: "/sub/renew", authMode: "required", sessionAction: "none", bodyFields: ["plan_code", "pay_type", "return_url"] },
  { method: "POST", sourcePath: "/v1/access/sub/upgrade", targetPath: "/sub/upgrade", authMode: "required", sessionAction: "none", bodyFields: ["plan_code", "pay_type", "return_url"] },
  { method: "POST", sourcePath: "/v1/access/sub/topup", targetPath: "/sub/topup", authMode: "required", sessionAction: "none", bodyFields: ["amount", "pay_type", "return_url"] },
  { method: "GET", sourcePath: "/v1/access/sub/credits", targetPath: "/sub/credits", authMode: "required", sessionAction: "none", bodyFields: [] },
  { method: "GET", sourcePath: "/v1/access/sub/expiry-status", targetPath: "/sub/expiry-status", authMode: "required", sessionAction: "none", bodyFields: [] },
]);

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize one bounded path segment after strict percent decoding. */
function normalizePathSegment(value: string, label: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new TypeError(`Application access ${label} is invalid.`);
  }
  if (!/^[A-Za-z0-9._:-]{1,256}$/.test(decoded)) {
    throw new TypeError(`Application access ${label} is invalid.`);
  }
  return encodeURIComponent(decoded);
}

/** Resolve one strict dynamic subscription route or return null. */
function resolveDynamicRoute(
  pathname: string,
  method: ApplicationAccessMethod,
): Omit<StaticApplicationAccessRoute, "sourcePath"> | null {
  const orderMatch = pathname.match(/^\/v1\/access\/sub\/orders\/([^/]+)$/);
  if (orderMatch?.[1] && method === "GET") {
    return {
      method,
      targetPath: `/sub/orders/${normalizePathSegment(orderMatch[1], "order number")}`,
      authMode: "required",
      sessionAction: "none",
      bodyFields: [],
    };
  }
  const cancelMatch = pathname.match(/^\/v1\/access\/sub\/orders\/([^/]+)\/cancel$/);
  if (cancelMatch?.[1] && method === "POST") {
    return {
      method,
      targetPath: `/sub/orders/${normalizePathSegment(cancelMatch[1], "order number")}/cancel`,
      authMode: "required",
      sessionAction: "none",
      bodyFields: [],
    };
  }
  return null;
}

/** Resolve the exact upgrade-preview query route or return null. */
function resolveUpgradePreviewRoute(
  url: URL,
  method: ApplicationAccessMethod,
): Omit<StaticApplicationAccessRoute, "sourcePath"> | null {
  if (url.pathname !== "/v1/access/sub/upgrade/preview" || method !== "GET") {
    return null;
  }
  if ([...url.searchParams.keys()].some((key) => key !== "new_plan_code")) {
    throw new TypeError("Application access query fields are invalid.");
  }
  const values = url.searchParams.getAll("new_plan_code");
  const planCode = values.length === 1 ? values[0]?.trim() ?? "" : "";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(planCode)) {
    throw new TypeError("Application access plan code is invalid.");
  }
  return {
    method,
    targetPath: `/sub/upgrade/preview?new_plan_code=${encodeURIComponent(planCode)}`,
    authMode: "required",
    sessionAction: "none",
    bodyFields: [],
  };
}

/** Normalize a bounded JSON request body and reject unexpected fields. */
function normalizeRequestBody(
  value: unknown,
  allowedFields: readonly string[],
): Readonly<Record<string, unknown>> | null {
  if (allowedFields.length === 0) {
    if (value !== undefined && value !== null && (!isRecord(value) || Object.keys(value).length > 0)) {
      throw new TypeError("Application access request body is not allowed.");
    }
    return null;
  }
  if (!isRecord(value)) {
    throw new TypeError("Application access request body is required.");
  }
  const allowed = new Set(allowedFields);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError("Application access request body fields are invalid.");
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError("Application access request body is not serializable.");
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_APPLICATION_ACCESS_REQUEST_BYTES) {
    throw new TypeError("Application access request body exceeds its byte budget.");
  }
  return JSON.parse(serialized) as Readonly<Record<string, unknown>>;
}

/** Parse one exact Renderer request against the account-route allow list. */
export function parseApplicationAccessRequest(value: unknown): ParsedApplicationAccessRequest {
  const allowedRequestFields = new Set(["path", "method", "body", "timeoutMs"]);
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedRequestFields.has(key))) {
    throw new TypeError("Application access request fields are invalid.");
  }
  const path = typeof value.path === "string" ? value.path.trim() : "";
  if (!path || path.length > 2_048 || /[\u0000-\u001F\u007F]/.test(path)) {
    throw new TypeError("Application access path is invalid.");
  }
  let url: URL;
  try {
    url = new URL(path, "https://desktop.openxnet.invalid");
  } catch {
    throw new TypeError("Application access path is invalid.");
  }
  if (url.origin !== "https://desktop.openxnet.invalid" || url.hash) {
    throw new TypeError("Application access path is invalid.");
  }
  const rawMethod = typeof value.method === "string" ? value.method.toUpperCase() : "GET";
  if (rawMethod !== "GET" && rawMethod !== "POST" && rawMethod !== "PUT") {
    throw new TypeError("Application access method is invalid.");
  }
  const method: ApplicationAccessMethod = rawMethod;
  const staticRoute = STATIC_APPLICATION_ACCESS_ROUTES.find(
    (candidate) => candidate.sourcePath === url.pathname && candidate.method === method,
  );
  const route = staticRoute
    ?? resolveUpgradePreviewRoute(url, method)
    ?? resolveDynamicRoute(url.pathname, method);
  if (!route) {
    throw new TypeError("Application access route is not allowed.");
  }
  if (url.search && !route.targetPath.includes("?")) {
    throw new TypeError("Application access query is not allowed.");
  }
  const requestedTimeout = Number(value.timeoutMs ?? 15_000);
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? Math.min(Math.max(Math.trunc(requestedTimeout), 1_000), 30_000)
    : 15_000;
  return {
    path: `${url.pathname}${url.search}`,
    targetPath: route.targetPath,
    method,
    body: normalizeRequestBody(value.body, route.bodyFields),
    timeoutMs,
    authMode: route.authMode,
    sessionAction: route.sessionAction,
  };
}
