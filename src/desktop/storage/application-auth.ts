import path from "node:path";

import {
  APPLICATION_AUTH_DOCUMENT_KEY,
  APPLICATION_AUTH_SCHEMA,
  DEFAULT_APPLICATION_AUTH_SESSION,
  DEFAULT_APPLICATION_AUTH_SECRET_SESSION,
  DEFAULT_APPLICATION_AUTH_STATE,
  normalizeApplicationAuthState,
  normalizeApplicationGatewayCredentialBootstrap,
  parseSaveApplicationAuthSessionRequest,
  redactApplicationGatewayBootstrap,
  type ApplicationAuthCredentials,
  type ApplicationAuthMetadata,
  type ApplicationAuthSecretSession,
  type ApplicationAuthSnapshot,
  type ApplicationAuthState,
  type ApplicationGatewayCredentialBootstrap,
} from "../contracts/application-auth";
import {
  APPLICATION_DATABASE_FILENAME,
  ApplicationStore,
} from "./application-store";
import {
  SafeStorageCredentialStore,
  type ApplicationCredentialStore,
  type SafeStorageLike,
} from "./safe-storage-credential-store";

/** Filename containing only operating-system-encrypted authentication credentials. */
export const APPLICATION_AUTH_CREDENTIAL_FILENAME = "auth-credentials.bin";

/** Options used to bootstrap the Desktop authentication boundary. */
export interface BootstrapApplicationAuthOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly databasePath?: string;
  readonly credentialPath?: string;
}

/** Dependencies used to create one application authentication service. */
export interface ApplicationAuthServiceOptions {
  readonly store: ApplicationStore;
  readonly credentials: ApplicationCredentialStore;
}

/** Listener notified after account metadata or encrypted credentials change. */
export type ApplicationAuthChangedListener = (snapshot: ApplicationAuthSnapshot) => void;

/** Determine whether an unknown remote payload exposes inspectable fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return one future ISO timestamp from a bounded lifetime in seconds. */
function computeFutureTimestamp(value: unknown, fallback: string): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 365 * 24 * 60 * 60) {
    return fallback;
  }
  return new Date(Date.now() + Math.trunc(seconds * 1_000)).toISOString();
}

/** Return a detached default guest state safe for IPC serialization. */
function createGuestState(): ApplicationAuthState {
  return normalizeApplicationAuthState(DEFAULT_APPLICATION_AUTH_STATE);
}

/** Return a complete guest authentication snapshot. */
function createGuestSnapshot(secureStorage: "desktop-safe-storage" | "unavailable"): ApplicationAuthSnapshot {
  return {
    schema: APPLICATION_AUTH_SCHEMA,
    revision: 0,
    authState: createGuestState(),
    authSession: { ...DEFAULT_APPLICATION_AUTH_SESSION },
    updatedAt: null,
    secureStorage,
  };
}

/** Desktop Core authentication boundary over SQLite metadata and encrypted credentials. */
export class ApplicationAuthService {
  private readonly listeners = new Set<ApplicationAuthChangedListener>();
  private closed = false;

  /**
   * Create an authentication service over initialized storage dependencies.
   *
   * @param options Open application and credential stores.
   */
  public constructor(private readonly options: ApplicationAuthServiceOptions) {}

  /** Return the reconstructed redacted authentication session for Renderer. */
  public getSession(): ApplicationAuthSnapshot {
    this.assertOpen();
    const secureStorage = this.options.credentials.isAvailable()
      ? "desktop-safe-storage"
      : "unavailable";
    const document = this.options.store.getDocument<ApplicationAuthMetadata>(
      APPLICATION_AUTH_DOCUMENT_KEY,
    );
    if (document === null || secureStorage === "unavailable") {
      return createGuestSnapshot(secureStorage);
    }
    let credentials: ApplicationAuthCredentials | null;
    try {
      credentials = this.options.credentials.read();
    } catch {
      return createGuestSnapshot(secureStorage);
    }
    if (credentials === null || (!credentials.accessToken && !credentials.refreshToken)) {
      return createGuestSnapshot(secureStorage);
    }
    const state = normalizeApplicationAuthState({
      ...document.value.state,
      gatewayBootstrap: redactApplicationGatewayBootstrap(credentials.gatewayBootstrap),
    });
    if (state.status === "guest") {
      return createGuestSnapshot(secureStorage);
    }
    return {
      schema: APPLICATION_AUTH_SCHEMA,
      revision: document.revision,
      authState: state,
      authSession: {
        accessTokenConfigured: Boolean(credentials.accessToken),
        refreshTokenConfigured: Boolean(credentials.refreshToken),
        expiresAt: document.value.expiresAt,
        refreshExpiresAt: document.value.refreshExpiresAt,
      },
      updatedAt: document.updatedAt,
      secureStorage,
    };
  }

  /**
   * Validate and persist one complete authentication session replacement.
   *
   * @param request Untrusted Renderer request.
   * @returns Reconstructed persisted authentication snapshot.
   */
  public saveSession(request: unknown): ApplicationAuthSnapshot {
    this.assertOpen();
    const parsed = parseSaveApplicationAuthSessionRequest(request);
    if (
      parsed.authState.status === "guest"
      || (!parsed.authSession.accessToken && !parsed.authSession.refreshToken)
    ) {
      return this.clearSession();
    }
    const { gatewayBootstrap, ...nonSecretState } = parsed.authState;
    return this.persistSession(
      normalizeApplicationAuthState(nonSecretState),
      parsed.authSession,
      gatewayBootstrap,
    );
  }

  /** Return Main-only token material without crossing an IPC boundary. */
  public getInternalSession(): ApplicationAuthSecretSession {
    this.assertOpen();
    const document = this.options.store.getDocument<ApplicationAuthMetadata>(
      APPLICATION_AUTH_DOCUMENT_KEY,
    );
    const credentials = this.readCredentials();
    if (document === null || credentials === null) {
      return { ...DEFAULT_APPLICATION_AUTH_SECRET_SESSION };
    }
    return {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: document.value.expiresAt,
      refreshExpiresAt: document.value.refreshExpiresAt,
    };
  }

  /** Return a detached Main-only gateway credential bootstrap. */
  public getGatewayCredentialBootstrap(): ApplicationGatewayCredentialBootstrap | null {
    this.assertOpen();
    const credentials = this.readCredentials();
    return credentials?.gatewayBootstrap
      ? { ...credentials.gatewayBootstrap, model_scopes: [...credentials.gatewayBootstrap.model_scopes] }
      : null;
  }

  /**
   * Capture one successful remote login or profile response inside Main.
   *
   * @param value Untrusted JSON payload returned by the account service.
   * @returns Updated redacted Renderer snapshot.
   */
  public applyRemoteSession(value: unknown): ApplicationAuthSnapshot {
    this.assertOpen();
    if (!isRecord(value)) {
      return this.getSession();
    }
    const currentSnapshot = this.getSession();
    const currentSession = this.getInternalSession();
    const currentGateway = this.getGatewayCredentialBootstrap();
    const profile = isRecord(value.profile) ? value.profile : {};
    const entitlement = isRecord(value.entitlement) ? value.entitlement : {};
    const gatewayUsage = isRecord(value.gateway_usage) ? value.gateway_usage : {};
    const activePlanCode = String(
      entitlement.active_plan_code ?? currentSnapshot.authState.activePlanCode ?? "",
    ).trim();
    const availablePlanCodes = Array.isArray(entitlement.premium_plan_codes)
      ? entitlement.premium_plan_codes
      : currentSnapshot.authState.availablePlanCodes;
    const hasRemoteIdentity = Object.keys(profile).length > 0
      || typeof value.access_token === "string"
      || typeof value.refresh_token === "string";
    const gatewayBootstrap = Object.prototype.hasOwnProperty.call(value, "gateway_bootstrap")
      ? normalizeApplicationGatewayCredentialBootstrap(value.gateway_bootstrap)
      : currentGateway;
    const premiumModelAccess = entitlement.premium_model_access === true
      || (Object.keys(entitlement).length === 0 && currentSnapshot.authState.premiumModelAccess);
    const state = normalizeApplicationAuthState({
      ...currentSnapshot.authState,
      status: activePlanCode || premiumModelAccess
        ? "signed_in_premium"
        : (hasRemoteIdentity || currentSnapshot.authState.status !== "guest" ? "signed_in_basic" : "guest"),
      profile: {
        name: profile.nickname ?? profile.phone ?? profile.email ?? currentSnapshot.authState.profile.name,
        id: profile.id ?? profile.email ?? profile.phone ?? currentSnapshot.authState.profile.id,
        phone: profile.phone ?? currentSnapshot.authState.profile.phone,
        email: profile.email ?? currentSnapshot.authState.profile.email,
        avatarUrl: profile.avatar_url ?? currentSnapshot.authState.profile.avatarUrl,
        vipLevel: profile.vip_level ?? currentSnapshot.authState.profile.vipLevel,
      },
      premiumPlanCodes: activePlanCode ? [activePlanCode] : [],
      availablePlanCodes,
      lastPlanCode: activePlanCode || currentSnapshot.authState.lastPlanCode,
      subscriptionStatus: entitlement.subscription_status
        ?? currentSnapshot.authState.subscriptionStatus,
      activePlanCode,
      activePlanName: entitlement.active_plan_name ?? currentSnapshot.authState.activePlanName,
      pendingOrderNo: entitlement.pending_order_no ?? currentSnapshot.authState.pendingOrderNo,
      vipExpireAt: entitlement.vip_expire_at ?? currentSnapshot.authState.vipExpireAt,
      enterpriseAccess: entitlement.enterprise_access === true
        || (Object.keys(entitlement).length === 0 && currentSnapshot.authState.enterpriseAccess),
      premiumModelAccess,
      gatewayBootstrap: redactApplicationGatewayBootstrap(gatewayBootstrap),
      gatewayUsage: Object.keys(gatewayUsage).length > 0
        ? gatewayUsage
        : currentSnapshot.authState.gatewayUsage,
    });
    const session: ApplicationAuthSecretSession = {
      accessToken: typeof value.access_token === "string"
        ? value.access_token.trim()
        : currentSession.accessToken,
      refreshToken: typeof value.refresh_token === "string"
        ? value.refresh_token.trim()
        : currentSession.refreshToken,
      expiresAt: computeFutureTimestamp(value.expires_in, currentSession.expiresAt),
      refreshExpiresAt: computeFutureTimestamp(
        value.refresh_expires_in,
        currentSession.refreshExpiresAt,
      ),
    };
    if (state.status === "guest" || (!session.accessToken && !session.refreshToken)) {
      return this.clearSession();
    }
    return this.persistSession(state, session, gatewayBootstrap);
  }

  /** Subscribe to committed authentication changes. */
  public subscribe(listener: ApplicationAuthChangedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Persist normalized metadata and credentials, then notify observers once. */
  private persistSession(
    state: ApplicationAuthState,
    session: ApplicationAuthSecretSession,
    gatewayBootstrap: ApplicationGatewayCredentialBootstrap | null,
  ): ApplicationAuthSnapshot {
    const { gatewayBootstrap: _publicGateway, ...nonSecretState } = state;
    const metadata: ApplicationAuthMetadata = {
      state: nonSecretState,
      expiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      credentialReference: "desktop-safe-storage",
    };
    const credentials: ApplicationAuthCredentials = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      gatewayBootstrap,
    };
    const currentDocument = this.options.store.getDocument<ApplicationAuthMetadata>(
      APPLICATION_AUTH_DOCUMENT_KEY,
    );
    const currentCredentials = this.options.credentials.read();
    const metadataUnchanged = currentDocument !== null
      && JSON.stringify(currentDocument.value) === JSON.stringify(metadata);
    const credentialsUnchanged = JSON.stringify(currentCredentials) === JSON.stringify(credentials);
    if (!credentialsUnchanged) {
      this.options.credentials.write(credentials);
    }
    if (!metadataUnchanged) {
      this.options.store.setDocument(APPLICATION_AUTH_DOCUMENT_KEY, metadata);
    }
    const snapshot = this.getSession();
    if (!metadataUnchanged || !credentialsUnchanged) {
      for (const listener of this.listeners) listener(snapshot);
    }
    return snapshot;
  }

  /** Clear encrypted credentials before removing non-secret authentication metadata. */
  public clearSession(): ApplicationAuthSnapshot {
    this.assertOpen();
    const hadMetadata = this.options.store.getDocument<ApplicationAuthMetadata>(
      APPLICATION_AUTH_DOCUMENT_KEY,
    ) !== null;
    const hadCredentials = this.readCredentials() !== null;
    this.options.credentials.clear();
    this.options.store.deleteDocument(APPLICATION_AUTH_DOCUMENT_KEY);
    const snapshot = createGuestSnapshot(
      this.options.credentials.isAvailable() ? "desktop-safe-storage" : "unavailable",
    );
    if (hadMetadata || hadCredentials) {
      for (const listener of this.listeners) listener(snapshot);
    }
    return snapshot;
  }

  /** Close the authentication database handle once application shutdown begins. */
  public close(): void {
    if (this.closed) {
      return;
    }
    this.listeners.clear();
    this.options.store.close();
    this.closed = true;
  }

  /** Reject authentication operations after the service has closed. */
  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Application authentication service is closed.");
    }
  }

  /** Read encrypted credentials while treating corruption as a signed-out state. */
  private readCredentials(): ApplicationAuthCredentials | null {
    if (!this.options.credentials.isAvailable()) {
      return null;
    }
    try {
      return this.options.credentials.read();
    } catch {
      return null;
    }
  }
}

/**
 * Bootstrap Desktop authentication over the shared Core database and OS encryption.
 *
 * @param options User data root, safeStorage implementation, and optional paths.
 * @returns Ready authentication service.
 */
export function bootstrapApplicationAuth(
  options: BootstrapApplicationAuthOptions,
): ApplicationAuthService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const store = new ApplicationStore({
    databasePath: options.databasePath
      ?? path.join(userDataDirectory, APPLICATION_DATABASE_FILENAME),
  });
  const credentials = new SafeStorageCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_AUTH_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationAuthService({ store, credentials });
}
