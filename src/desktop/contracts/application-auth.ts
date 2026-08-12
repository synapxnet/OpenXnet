/** IPC channels owned by the Desktop Core authentication boundary. */
export const APPLICATION_AUTH_CHANNELS = Object.freeze({
  getSession: "openxnet:application-auth:get-session",
  saveSession: "openxnet:application-auth:save-session",
  clearSession: "openxnet:application-auth:clear-session",
});

/** Stable document key for non-secret authentication metadata. */
export const APPLICATION_AUTH_DOCUMENT_KEY = "auth-session-metadata";

/** Public schema returned for one Desktop authentication snapshot. */
export const APPLICATION_AUTH_SCHEMA = "openxnet.auth-session.v2" as const;

/** Supported local authentication presentation states. */
export type ApplicationAuthStatus = "guest" | "signed_in_basic" | "signed_in_premium";

/** Bounded account profile persisted without credentials. */
export interface ApplicationAuthProfile {
  readonly name: string;
  readonly id: string;
  readonly phone: string;
  readonly email: string;
  readonly avatarUrl: string;
  readonly vipLevel: string;
}

/** Bounded subscription gateway usage metadata. */
export interface ApplicationGatewayUsage {
  readonly syncStatus: string;
  readonly available: boolean;
  readonly quota: number;
  readonly usedQuota: number;
  readonly remainingQuota: number;
  readonly usageRatio: number;
  readonly requestCount: number;
  readonly group: string;
  readonly gatewayUid: number;
  readonly gatewayUsername: string;
  readonly planId: number;
  readonly error: string;
}

/** Non-secret subscription gateway bootstrap safe to expose to Renderer. */
export interface ApplicationGatewayBootstrap {
  readonly provider_name: string;
  readonly vendor: string;
  readonly wire_api: string;
  readonly requires_openai_auth: boolean;
  readonly base_url: string;
  readonly api_key_configured: boolean;
  readonly model_scopes: readonly string[];
  readonly plan_code: string;
}

/** Sensitive subscription gateway bootstrap stored only in Main safeStorage. */
export interface ApplicationGatewayCredentialBootstrap {
  readonly provider_name: string;
  readonly vendor: string;
  readonly wire_api: string;
  readonly requires_openai_auth: boolean;
  readonly base_url: string;
  readonly api_key: string;
  readonly model_scopes: readonly string[];
  readonly plan_code: string;
}

/** Renderer authentication state reconstructed from metadata and secure credentials. */
export interface ApplicationAuthState {
  readonly status: ApplicationAuthStatus;
  readonly profile: ApplicationAuthProfile;
  readonly premiumPlanCodes: readonly string[];
  readonly availablePlanCodes: readonly string[];
  readonly lastPlanCode: string;
  readonly subscriptionStatus: string;
  readonly activePlanCode: string;
  readonly activePlanName: string;
  readonly pendingOrderNo: string;
  readonly vipExpireAt: string;
  readonly enterpriseAccess: boolean;
  readonly premiumModelAccess: boolean;
  readonly gatewayBootstrap: ApplicationGatewayBootstrap | null;
  readonly gatewayUsage: ApplicationGatewayUsage;
}

/** Redacted token metadata safe to return to an authorized primary Renderer. */
export interface ApplicationAuthSession {
  readonly accessTokenConfigured: boolean;
  readonly refreshTokenConfigured: boolean;
  readonly expiresAt: string;
  readonly refreshExpiresAt: string;
}

/** Sensitive token material available only inside Electron Main. */
export interface ApplicationAuthSecretSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
  readonly refreshExpiresAt: string;
}

/** Non-secret authentication metadata stored in Desktop Core SQLite. */
export interface ApplicationAuthMetadata {
  readonly state: Omit<ApplicationAuthState, "gatewayBootstrap">;
  readonly expiresAt: string;
  readonly refreshExpiresAt: string;
  readonly credentialReference: "desktop-safe-storage";
}

/** Sensitive authentication fields persisted only through the credential store. */
export interface ApplicationAuthCredentials {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly gatewayBootstrap: ApplicationGatewayCredentialBootstrap | null;
}

/** Serialized authentication snapshot returned through authorized IPC. */
export interface ApplicationAuthSnapshot {
  readonly schema: typeof APPLICATION_AUTH_SCHEMA;
  readonly revision: number;
  readonly authState: ApplicationAuthState;
  readonly authSession: ApplicationAuthSession;
  readonly updatedAt: string | null;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Renderer request used to replace account metadata and encrypted credentials. */
export interface SaveApplicationAuthSessionRequest {
  readonly authState: Omit<ApplicationAuthState, "gatewayBootstrap"> & {
    readonly gatewayBootstrap: ApplicationGatewayCredentialBootstrap | null;
  };
  readonly authSession: ApplicationAuthSecretSession;
}

/** Default gateway usage returned for guest and incomplete sessions. */
export const DEFAULT_APPLICATION_GATEWAY_USAGE: ApplicationGatewayUsage = Object.freeze({
  syncStatus: "idle",
  available: false,
  quota: 0,
  usedQuota: 0,
  remainingQuota: 0,
  usageRatio: 0,
  requestCount: 0,
  group: "",
  gatewayUid: 0,
  gatewayUsername: "",
  planId: 0,
  error: "",
});

/** Default signed-out authentication state. */
export const DEFAULT_APPLICATION_AUTH_STATE: ApplicationAuthState = Object.freeze({
  status: "guest",
  profile: Object.freeze({
    name: "",
    id: "",
    phone: "",
    email: "",
    avatarUrl: "",
    vipLevel: "free",
  }),
  premiumPlanCodes: Object.freeze([]),
  availablePlanCodes: Object.freeze([]),
  lastPlanCode: "",
  subscriptionStatus: "free",
  activePlanCode: "",
  activePlanName: "",
  pendingOrderNo: "",
  vipExpireAt: "",
  enterpriseAccess: false,
  premiumModelAccess: false,
  gatewayBootstrap: null,
  gatewayUsage: DEFAULT_APPLICATION_GATEWAY_USAGE,
});

/** Default empty token session. */
export const DEFAULT_APPLICATION_AUTH_SESSION: ApplicationAuthSession = Object.freeze({
  accessTokenConfigured: false,
  refreshTokenConfigured: false,
  expiresAt: "",
  refreshExpiresAt: "",
});

/** Default empty Main-only token session. */
export const DEFAULT_APPLICATION_AUTH_SECRET_SESSION: ApplicationAuthSecretSession = Object.freeze({
  accessToken: "",
  refreshToken: "",
  expiresAt: "",
  refreshExpiresAt: "",
});

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize bounded text and reject control characters.
 *
 * @param value Candidate text.
 * @param maximumLength Maximum accepted UTF-16 length.
 * @param fallback Default text.
 * @returns Safe bounded text.
 */
function normalizeText(value: unknown, maximumLength: number, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    return fallback;
  }
  return normalized;
}

/**
 * Normalize a finite non-negative number with an upper bound.
 *
 * @param value Candidate numeric value.
 * @param maximum Maximum accepted value.
 * @returns Safe finite number.
 */
function normalizeNumber(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= maximum ? normalized : 0;
}

/**
 * Normalize a bounded unique string list.
 *
 * @param value Candidate array.
 * @param maximumItems Maximum accepted item count.
 * @param maximumLength Maximum length per item.
 * @returns Safe unique string list.
 */
function normalizeTextList(value: unknown, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = new Set<string>();
  for (const item of value.slice(0, maximumItems)) {
    const text = normalizeText(item, maximumLength);
    if (text) {
      normalized.add(text);
    }
  }
  return [...normalized];
}

/**
 * Normalize one sensitive subscription gateway bootstrap.
 *
 * @param value Candidate bootstrap object.
 * @returns Safe bootstrap or null when required fields are absent.
 */
export function normalizeApplicationGatewayCredentialBootstrap(
  value: unknown,
): ApplicationGatewayCredentialBootstrap | null {
  if (!isRecord(value)) {
    return null;
  }
  const baseUrl = normalizeText(value.base_url ?? value.baseUrl, 2_048);
  const apiKey = normalizeText(value.api_key ?? value.apiKey, 8_192);
  if (!baseUrl || !apiKey) {
    return null;
  }
  return {
    provider_name: normalizeText(value.provider_name ?? value.providerName, 128),
    vendor: normalizeText(value.vendor, 128),
    wire_api: normalizeText(value.wire_api ?? value.wireApi, 64),
    requires_openai_auth: value.requires_openai_auth === true || value.requiresOpenaiAuth === true,
    base_url: baseUrl,
    api_key: apiKey,
    model_scopes: normalizeTextList(value.model_scopes ?? value.modelScopes, 128, 256),
    plan_code: normalizeText(value.plan_code ?? value.planCode, 128),
  };
}

/**
 * Redact one sensitive gateway bootstrap for Renderer serialization.
 *
 * @param value Main-only gateway bootstrap.
 * @returns Non-secret bootstrap metadata or null.
 */
export function redactApplicationGatewayBootstrap(
  value: ApplicationGatewayCredentialBootstrap | null,
): ApplicationGatewayBootstrap | null {
  if (value === null) {
    return null;
  }
  const { api_key: apiKey, ...metadata } = value;
  return {
    ...metadata,
    model_scopes: [...metadata.model_scopes],
    api_key_configured: Boolean(apiKey),
  };
}

/**
 * Normalize public gateway metadata without accepting a Renderer-visible key.
 *
 * @param value Candidate public bootstrap object.
 * @returns Safe public bootstrap or null when its URL is absent.
 */
export function normalizeApplicationGatewayBootstrap(value: unknown): ApplicationGatewayBootstrap | null {
  if (!isRecord(value)) {
    return null;
  }
  const baseUrl = normalizeText(value.base_url ?? value.baseUrl, 2_048);
  if (!baseUrl) {
    return null;
  }
  return {
    provider_name: normalizeText(value.provider_name ?? value.providerName, 128),
    vendor: normalizeText(value.vendor, 128),
    wire_api: normalizeText(value.wire_api ?? value.wireApi, 64),
    requires_openai_auth: value.requires_openai_auth === true || value.requiresOpenaiAuth === true,
    base_url: baseUrl,
    api_key_configured: value.api_key_configured === true || value.apiKeyConfigured === true,
    model_scopes: normalizeTextList(value.model_scopes ?? value.modelScopes, 128, 256),
    plan_code: normalizeText(value.plan_code ?? value.planCode, 128),
  };
}

/**
 * 从公开账号资料中解析首个稳定且非空的身份标识。
 *
 * @param value 候选认证资料。
 * @returns 经过长度约束的账号标识；没有可用身份字段时返回空字符串。
 */
export function resolveApplicationAuthProfileSubject(value: unknown): string {
  const profile = isRecord(value) ? value : {};
  return normalizeText(profile.id, 256)
    || normalizeText(profile.email, 320)
    || normalizeText(profile.phone, 64);
}

/**
 * Normalize untrusted Renderer authentication state.
 *
 * @param value Candidate authentication state.
 * @returns Complete bounded authentication state.
 */
export function normalizeApplicationAuthState(value: unknown): ApplicationAuthState {
  const record = isRecord(value) ? value : {};
  const profile = isRecord(record.profile) ? record.profile : {};
  const usageValue = isRecord(record.gatewayUsage)
    ? record.gatewayUsage
    : (isRecord(record.gateway_usage) ? record.gateway_usage : {});
  const status: ApplicationAuthStatus = record.status === "signed_in_premium"
    ? "signed_in_premium"
    : (record.status === "signed_in_basic" ? "signed_in_basic" : "guest");
  return {
    status,
    profile: {
      name: normalizeText(profile.name, 256),
      id: resolveApplicationAuthProfileSubject(profile),
      phone: normalizeText(profile.phone, 64),
      email: normalizeText(profile.email, 320),
      avatarUrl: normalizeText(profile.avatarUrl ?? profile.avatar_url, 2_048),
      vipLevel: normalizeText(profile.vipLevel ?? profile.vip_level, 128, "free"),
    },
    premiumPlanCodes: normalizeTextList(record.premiumPlanCodes, 128, 128),
    availablePlanCodes: normalizeTextList(record.availablePlanCodes, 128, 128),
    lastPlanCode: normalizeText(record.lastPlanCode, 128),
    subscriptionStatus: normalizeText(record.subscriptionStatus, 128, "free"),
    activePlanCode: normalizeText(record.activePlanCode, 128),
    activePlanName: normalizeText(record.activePlanName, 256),
    pendingOrderNo: normalizeText(record.pendingOrderNo, 256),
    vipExpireAt: normalizeText(record.vipExpireAt, 128),
    enterpriseAccess: record.enterpriseAccess === true,
    premiumModelAccess: record.premiumModelAccess === true,
    gatewayBootstrap: normalizeApplicationGatewayBootstrap(record.gatewayBootstrap),
    gatewayUsage: {
      syncStatus: normalizeText(usageValue.syncStatus ?? usageValue.sync_status, 128, "idle"),
      available: usageValue.available === true,
      quota: normalizeNumber(usageValue.quota),
      usedQuota: normalizeNumber(usageValue.usedQuota ?? usageValue.used_quota),
      remainingQuota: normalizeNumber(usageValue.remainingQuota ?? usageValue.remaining_quota),
      usageRatio: normalizeNumber(usageValue.usageRatio ?? usageValue.usage_ratio, 1),
      requestCount: normalizeNumber(usageValue.requestCount ?? usageValue.request_count),
      group: normalizeText(usageValue.group, 256),
      gatewayUid: normalizeNumber(usageValue.gatewayUid ?? usageValue.gateway_uid),
      gatewayUsername: normalizeText(
        usageValue.gatewayUsername ?? usageValue.gateway_username,
        256,
      ),
      planId: normalizeNumber(usageValue.planId ?? usageValue.plan_id),
      error: normalizeText(usageValue.error, 1_024),
    },
  };
}

/**
 * Normalize untrusted Renderer token state.
 *
 * @param value Candidate authentication session.
 * @returns Complete bounded token state.
 */
export function normalizeApplicationAuthSecretSession(value: unknown): ApplicationAuthSecretSession {
  const record = isRecord(value) ? value : {};
  return {
    accessToken: normalizeText(record.accessToken, 32_768),
    refreshToken: normalizeText(record.refreshToken, 32_768),
    expiresAt: normalizeText(record.expiresAt, 128),
    refreshExpiresAt: normalizeText(record.refreshExpiresAt, 128),
  };
}

/**
 * Parse an exact Renderer authentication replacement request.
 *
 * @param value Unknown IPC request.
 * @returns Validated session replacement.
 */
export function parseSaveApplicationAuthSessionRequest(
  value: unknown,
): SaveApplicationAuthSessionRequest {
  if (
    !isRecord(value)
    || Object.keys(value).length !== 2
    || !isRecord(value.authState)
    || !isRecord(value.authSession)
  ) {
    throw new Error("Exact authState and authSession objects are required.");
  }
  return {
    authState: {
      ...normalizeApplicationAuthState(value.authState),
      gatewayBootstrap: normalizeApplicationGatewayCredentialBootstrap(value.authState.gatewayBootstrap),
    },
    authSession: normalizeApplicationAuthSecretSession(value.authSession),
  };
}
