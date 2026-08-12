import {
  APPLICATION_ACCESS_SCHEMA,
  MAX_APPLICATION_ACCESS_RESPONSE_BYTES,
  parseApplicationAccessRequest,
  type ApplicationAccessResult,
  type ParsedApplicationAccessRequest,
} from "../contracts/application-access";
import type { ApplicationAuthService } from "../storage/application-auth";

/** Minimal remote response consumed by the Main-owned account gateway. */
export interface ApplicationAccessFetchResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Minimal fetch implementation injectable into account gateway tests. */
export type ApplicationAccessFetch = (
  url: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
    readonly redirect: "error";
    readonly signal: AbortSignal;
  },
) => Promise<ApplicationAccessFetchResponse>;

/** Diagnostics sink that must never receive account credentials. */
export interface ApplicationAccessLogger {
  warn(message: string, error?: unknown): void;
}

/** Dependencies and remote endpoint configuration for the account gateway. */
export interface ApplicationAccessGatewayOptions {
  readonly auth: Pick<
    ApplicationAuthService,
    "getSession" | "getInternalSession" | "applyRemoteSession" | "clearSession"
  >;
  readonly fetch: ApplicationAccessFetch;
  readonly serviceBaseUrl?: string;
  readonly apiPrefix?: string;
  readonly logger?: ApplicationAccessLogger;
}

interface RemoteApplicationAccessResult {
  readonly status: number;
  readonly payload: unknown;
}

interface RemoteApplicationAccessFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

type RemoteApplicationAccessOutcome = RemoteApplicationAccessResult | RemoteApplicationAccessFailure;

const DEFAULT_ACCESS_SERVICE_BASE_URL = "https://synapxnet.work";
const DEFAULT_ACCESS_API_PREFIX = "/api";

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Determine whether a configured hostname is an explicit loopback target. */
function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Normalize the fixed remote account-service origin without credentials or query data. */
function normalizeServiceBaseUrl(value: string | undefined): string {
  const configured = String(value || DEFAULT_ACCESS_SERVICE_BASE_URL).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new TypeError("OpenXnet account service URL is invalid.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname))
  ) {
    throw new TypeError("OpenXnet account service URL is invalid.");
  }
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const withoutLegacyPrefix = pathname.endsWith("/api") ? pathname.slice(0, -4) : pathname;
  return `${parsed.origin}${withoutLegacyPrefix}`;
}

/** Normalize the fixed account-service API prefix and reject traversal syntax. */
function normalizeApiPrefix(value: string | undefined): string {
  const configured = String(value || DEFAULT_ACCESS_API_PREFIX).trim();
  const normalized = `/${configured.replace(/^\/+|\/+$/g, "")}`;
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(normalized) || normalized.includes("..")) {
    throw new TypeError("OpenXnet account API prefix is invalid.");
  }
  return normalized === "/" ? "" : normalized;
}

/** Return whether one internal access token remains valid beyond the refresh skew. */
function isAccessTokenFresh(expiresAt: string): boolean {
  if (!expiresAt) {
    return true;
  }
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() + 90_000;
}

/** Recursively remove token and gateway-key fields from a remote JSON value. */
function redactRemotePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactRemotePayload);
  }
  if (!isRecord(value)) {
    return value;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (["access_token", "refreshtoken", "refresh_token", "accesstoken"].includes(normalizedKey)) {
      continue;
    }
    if (normalizedKey === "api_key" || normalizedKey === "apikey") {
      redacted.api_key_configured = typeof child === "string" && child.trim().length > 0;
      continue;
    }
    redacted[key] = redactRemotePayload(child);
  }
  return redacted;
}

/** Replace exact request credentials that a remote error may have reflected. */
function redactKnownSecrets(value: string, secrets: readonly string[]): string {
  let redacted = value;
  for (const secret of secrets) {
    if (secret.length >= 4) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }
  return redacted;
}

/** Extract one bounded error message without returning the full remote payload. */
function extractRemoteErrorMessage(
  payload: unknown,
  status: number,
  secrets: readonly string[],
): string {
  const candidates: unknown[] = [];
  if (isRecord(payload)) {
    candidates.push(payload.detail, payload.message);
    if (typeof payload.error === "string") {
      candidates.push(payload.error);
    } else if (isRecord(payload.error)) {
      candidates.push(payload.error.message, payload.error.detail);
    }
  } else {
    candidates.push(payload);
  }
  const selected = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (typeof selected !== "string") {
    return `Account service returned HTTP ${status}.`;
  }
  const normalized = redactKnownSecrets(selected, secrets)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .trim();
  return normalized.slice(0, 512) || `Account service returned HTTP ${status}.`;
}

/** Translate the legacy combined agreement flag into the remote account schema. */
function normalizeRemoteRequestBody(
  request: ParsedApplicationAccessRequest,
): Readonly<Record<string, unknown>> | null {
  if (request.body === null) {
    return null;
  }
  const body = { ...request.body };
  if (
    ["/auth/register", "/auth/login/password", "/auth/login/sms"].includes(request.targetPath)
    && body.agreements_accepted === true
  ) {
    body.terms_accepted = true;
    body.privacy_accepted = true;
    delete body.agreements_accepted;
  }
  return body;
}

/** Main-owned gateway for bounded account, authentication, and subscription requests. */
export class ApplicationAccessGateway {
  private readonly auth: ApplicationAccessGatewayOptions["auth"];
  private readonly fetchRemote: ApplicationAccessFetch;
  private readonly serviceBaseUrl: string;
  private readonly apiPrefix: string;
  private readonly logger: ApplicationAccessLogger;
  private refreshPromise: Promise<RemoteApplicationAccessOutcome> | null = null;

  /** Create one account gateway with a fixed remote service boundary. */
  public constructor(options: ApplicationAccessGatewayOptions) {
    this.auth = options.auth;
    this.fetchRemote = options.fetch;
    this.serviceBaseUrl = normalizeServiceBaseUrl(options.serviceBaseUrl);
    this.apiPrefix = normalizeApiPrefix(options.apiPrefix);
    this.logger = options.logger ?? console;
  }

  /** Execute one allow-listed Renderer request and return a sanitized tagged result. */
  public async request(value: unknown): Promise<ApplicationAccessResult> {
    const request = parseApplicationAccessRequest(value);
    if (request.authMode === "refresh") {
      const refreshed = await this.refreshSession();
      return this.toPublicResult(refreshed);
    }

    let accessToken = "";
    if (request.authMode === "required" || request.authMode === "optional") {
      accessToken = await this.ensureAccessToken();
      if (request.authMode === "required" && !accessToken) {
        return this.createFailure(401, "AUTH_REQUIRED", "Please sign in before continuing.");
      }
    }

    let outcome = await this.executeRemote(request, accessToken);
    if (
      outcome.status === 401
      && (request.authMode === "required" || (request.authMode === "optional" && Boolean(accessToken)))
    ) {
      const refreshed = await this.refreshSession();
      if ("payload" in refreshed && refreshed.status >= 200 && refreshed.status < 300) {
        accessToken = this.auth.getInternalSession().accessToken;
        outcome = await this.executeRemote(request, accessToken);
      } else if (request.authMode === "optional") {
        this.auth.clearSession();
        outcome = await this.executeRemote(request, "");
      } else {
        this.auth.clearSession();
        return this.createFailure(401, "AUTH_EXPIRED", "Your session has expired. Please sign in again.");
      }
    }

    if (!("payload" in outcome) || outcome.status < 200 || outcome.status >= 300) {
      if (outcome.status === 401 && request.authMode === "required") {
        this.auth.clearSession();
      }
      return this.toPublicResult(outcome);
    }

    if (request.sessionAction === "capture") {
      this.auth.applyRemoteSession(outcome.payload);
    } else if (request.sessionAction === "clear") {
      this.auth.clearSession();
    }
    return this.toPublicResult(outcome);
  }

  /** Return a fresh access token, refreshing it once through a shared promise when needed. */
  private async ensureAccessToken(): Promise<string> {
    const session = this.auth.getInternalSession();
    if (session.accessToken && isAccessTokenFresh(session.expiresAt)) {
      return session.accessToken;
    }
    if (session.refreshToken) {
      const refreshed = await this.refreshSession();
      if ("payload" in refreshed && refreshed.status >= 200 && refreshed.status < 300) {
        return this.auth.getInternalSession().accessToken;
      }
    }
    return session.accessToken && !session.expiresAt ? session.accessToken : "";
  }

  /** Refresh the Main-owned account session while coalescing concurrent requests. */
  private async refreshSession(): Promise<RemoteApplicationAccessOutcome> {
    if (this.refreshPromise !== null) {
      return this.refreshPromise;
    }
    const refreshToken = this.auth.getInternalSession().refreshToken;
    if (!refreshToken) {
      return { status: 401, code: "REFRESH_UNAVAILABLE", message: "No refresh session is available." };
    }
    const refreshRequest: ParsedApplicationAccessRequest = {
      path: "/v1/access/auth/refresh",
      targetPath: "/auth/refresh",
      method: "POST",
      body: { refresh_token: refreshToken },
      timeoutMs: 15_000,
      authMode: "none",
      sessionAction: "capture",
    };
    this.refreshPromise = this.executeRemote(refreshRequest, "")
      .then((outcome) => {
        if ("payload" in outcome && outcome.status >= 200 && outcome.status < 300) {
          this.auth.applyRemoteSession(outcome.payload);
        } else if (outcome.status === 400 || outcome.status === 401 || outcome.status === 403) {
          this.auth.clearSession();
        }
        return outcome;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  /** Execute one validated request against the fixed remote service. */
  private async executeRemote(
    request: ParsedApplicationAccessRequest,
    accessToken: string,
  ): Promise<RemoteApplicationAccessOutcome> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    const normalizedBody = normalizeRemoteRequestBody(request);
    const body = normalizedBody === null ? undefined : JSON.stringify(normalizedBody);
    try {
      const response = await this.fetchRemote(
        `${this.serviceBaseUrl}${this.apiPrefix}${request.targetPath}`,
        {
          method: request.method,
          headers: {
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          ...(body === undefined ? {} : { body }),
          redirect: "error",
          signal: controller.signal,
        },
      );
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_APPLICATION_ACCESS_RESPONSE_BYTES) {
        return {
          status: 502,
          code: "RESPONSE_TOO_LARGE",
          message: "Account service response exceeds its byte budget.",
        };
      }
      const responseBody = Buffer.from(await response.arrayBuffer());
      if (responseBody.byteLength > MAX_APPLICATION_ACCESS_RESPONSE_BYTES) {
        return {
          status: 502,
          code: "RESPONSE_TOO_LARGE",
          message: "Account service response exceeds its byte budget.",
        };
      }
      const responseText = responseBody.toString("utf8");
      let payload: unknown = null;
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as unknown;
        } catch {
          payload = response.status >= 200 && response.status < 300
            ? { success: true, data: responseText.slice(0, 4_096) }
            : responseText.slice(0, 512);
        }
      }
      if (response.status < 200 || response.status >= 300) {
        const secretFields = ["password", "code", "refresh_token"];
        const requestSecrets = secretFields
          .map((field) => normalizedBody?.[field])
          .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
        return {
          status: response.status,
          code: `REMOTE_HTTP_${response.status}`,
          message: extractRemoteErrorMessage(
            payload,
            response.status,
            [...requestSecrets, accessToken],
          ),
        };
      }
      return { status: response.status, payload };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      this.logger.warn(
        aborted ? "OpenXnet account request timed out." : "OpenXnet account request failed.",
      );
      return {
        status: aborted ? 504 : 502,
        code: aborted ? "REQUEST_TIMEOUT" : "REQUEST_FAILED",
        message: aborted
          ? "The account request timed out. Please try again."
          : "The account service is temporarily unavailable.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Convert one internal remote outcome into a redacted IPC result. */
  private toPublicResult(outcome: RemoteApplicationAccessOutcome): ApplicationAccessResult {
    if ("payload" in outcome && outcome.status >= 200 && outcome.status < 300) {
      return {
        schema: APPLICATION_ACCESS_SCHEMA,
        ok: true,
        status: outcome.status,
        payload: redactRemotePayload(outcome.payload),
        authSnapshot: this.auth.getSession(),
      };
    }
    const failure = "code" in outcome
      ? outcome
      : {
          status: outcome.status,
          code: `REMOTE_HTTP_${outcome.status}`,
          message: `Account service returned HTTP ${outcome.status}.`,
        };
    return this.createFailure(failure.status, failure.code, failure.message);
  }

  /** Build one sanitized failed IPC result with the latest redacted auth state. */
  private createFailure(status: number, code: string, message: string): ApplicationAccessResult {
    return {
      schema: APPLICATION_ACCESS_SCHEMA,
      ok: false,
      status,
      error: { code, message: message.slice(0, 512) },
      authSnapshot: this.auth.getSession(),
    };
  }
}
