import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  APPLICATION_AUTH_DOCUMENT_KEY,
  type ApplicationAuthCredentials,
} from "../contracts/application-auth";
import { ApplicationAuthService } from "./application-auth";
import { ApplicationStore } from "./application-store";
import type { ApplicationCredentialStore } from "./safe-storage-credential-store";

/** In-memory credential boundary used to inspect Core metadata separation. */
class TestCredentialStore implements ApplicationCredentialStore {
  public credentials: ApplicationAuthCredentials | null = null;

  /** Report secure storage availability for the test service. */
  public isAvailable(): boolean {
    return true;
  }

  /** Return the current detached credential payload. */
  public read(): ApplicationAuthCredentials | null {
    return this.credentials === null ? null : structuredClone(this.credentials);
  }

  /** Replace the current detached credential payload. */
  public write(credentials: ApplicationAuthCredentials): void {
    this.credentials = structuredClone(credentials);
  }

  /** Clear the in-memory credential payload. */
  public clear(): void {
    this.credentials = null;
  }
}

/** Create one complete signed-in request fixture. */
function createSignedInRequest() {
  return {
    authState: {
      status: "signed_in_premium",
      profile: {
        name: "Ada",
        id: "user-1",
        phone: "13800138000",
        email: "ada@example.test",
        avatarUrl: "https://example.test/avatar.png",
        vipLevel: "pro",
      },
      premiumPlanCodes: ["pro"],
      availablePlanCodes: ["pro", "enterprise"],
      lastPlanCode: "pro",
      subscriptionStatus: "active",
      activePlanCode: "pro",
      activePlanName: "Pro",
      pendingOrderNo: "",
      vipExpireAt: "2027-01-01T00:00:00.000Z",
      enterpriseAccess: true,
      premiumModelAccess: true,
      gatewayBootstrap: {
        provider_name: "OpenXnet Gateway",
        vendor: "OpenAI",
        wire_api: "responses",
        requires_openai_auth: true,
        base_url: "https://gateway.example.test/v1",
        api_key: "gateway-secret",
        model_scopes: ["model-a"],
        plan_code: "pro",
      },
      gatewayUsage: {
        syncStatus: "ready",
        available: true,
        quota: 100,
        usedQuota: 20,
        remainingQuota: 80,
        usageRatio: 0.2,
        requestCount: 4,
        group: "pro",
        gatewayUid: 12,
        gatewayUsername: "ada",
        planId: 3,
        error: "",
      },
    },
    authSession: {
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2026-07-24T00:00:00.000Z",
      refreshExpiresAt: "2026-08-24T00:00:00.000Z",
    },
  };
}

test("ApplicationAuthService separates SQLite metadata from secure credentials", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-application-auth-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestCredentialStore();
  const service = new ApplicationAuthService({ store, credentials });
  try {
    const first = service.saveSession(createSignedInRequest());
    assert.equal(first.revision, 1);
    assert.equal(first.authState.profile.name, "Ada");
    assert.equal(first.authSession.accessTokenConfigured, true);
    assert.equal(first.authSession.refreshTokenConfigured, true);
    assert.equal(first.authState.gatewayBootstrap?.api_key_configured, true);
    assert.equal(JSON.stringify(first).includes("access-secret"), false);
    assert.equal(JSON.stringify(first).includes("refresh-secret"), false);
    assert.equal(JSON.stringify(first).includes("gateway-secret"), false);
    assert.equal(service.getInternalSession().accessToken, "access-secret");
    assert.equal(service.getGatewayCredentialBootstrap()?.api_key, "gateway-secret");

    const metadata = store.getDocument(APPLICATION_AUTH_DOCUMENT_KEY);
    const serializedMetadata = JSON.stringify(metadata?.value);
    assert.equal(serializedMetadata.includes("access-secret"), false);
    assert.equal(serializedMetadata.includes("refresh-secret"), false);
    assert.equal(serializedMetadata.includes("gateway-secret"), false);

    const unchanged = service.saveSession(createSignedInRequest());
    assert.equal(unchanged.revision, 1);
    const guest = service.clearSession();
    assert.equal(guest.revision, 0);
    assert.equal(guest.authState.status, "guest");
    assert.equal(store.getDocument(APPLICATION_AUTH_DOCUMENT_KEY), null);
    assert.equal(credentials.read(), null);
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationAuthService captures remote sessions and returns only redacted metadata", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-remote-auth-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestCredentialStore();
  const service = new ApplicationAuthService({ store, credentials });
  try {
    const snapshot = service.applyRemoteSession({
      access_token: "remote-access",
      refresh_token: "remote-refresh",
      expires_in: 3_600,
      refresh_expires_in: 86_400,
      profile: {
        id: "",
        nickname: "Grace",
        email: "grace@example.test",
      },
      entitlement: {
        active_plan_code: "pro",
        active_plan_name: "Pro",
        subscription_status: "active",
        premium_plan_codes: ["pro"],
        premium_model_access: true,
      },
      gateway_bootstrap: {
        provider_name: "OpenXnet Gateway",
        vendor: "OpenAI",
        wire_api: "responses",
        base_url: "https://gateway.example.test/v1",
        api_key: "remote-gateway-key",
        model_scopes: ["model-a"],
        plan_code: "pro",
      },
    });
    assert.equal(snapshot.authState.profile.name, "Grace");
    assert.equal(snapshot.authState.profile.id, "grace@example.test");
    assert.equal(snapshot.authState.status, "signed_in_premium");
    assert.equal(snapshot.authSession.accessTokenConfigured, true);
    assert.equal(snapshot.authState.gatewayBootstrap?.api_key_configured, true);
    assert.equal(JSON.stringify(snapshot).includes("remote-access"), false);
    assert.equal(JSON.stringify(snapshot).includes("remote-refresh"), false);
    assert.equal(JSON.stringify(snapshot).includes("remote-gateway-key"), false);
    assert.equal(service.getInternalSession().accessToken, "remote-access");
    assert.equal(service.getGatewayCredentialBootstrap()?.api_key, "remote-gateway-key");

    const refreshed = service.applyRemoteSession({
      access_token: "rotated-access",
      expires_in: 1_800,
    });
    assert.equal(refreshed.authState.profile.name, "Grace");
    assert.equal(service.getInternalSession().refreshToken, "remote-refresh");
    assert.equal(service.getGatewayCredentialBootstrap()?.api_key, "remote-gateway-key");
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
