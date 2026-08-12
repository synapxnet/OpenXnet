"use strict";

const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { app, safeStorage } = require("electron");

const {
  APPLICATION_AUTH_DOCUMENT_KEY,
  bootstrapApplicationAuth,
} = require("../build-ts/desktop");

/** Create one bounded signed-in authentication fixture. */
function createAuthRequest() {
  return {
    authState: {
      status: "signed_in_premium",
      profile: {
        name: "Auth Smoke",
        id: "auth-smoke-user",
        phone: "13800138000",
        email: "auth-smoke@example.test",
        avatarUrl: "",
        vipLevel: "pro",
      },
      premiumPlanCodes: ["pro"],
      availablePlanCodes: ["pro"],
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
        api_key: "auth-smoke-gateway-secret",
        model_scopes: ["model-a"],
        plan_code: "pro",
      },
      gatewayUsage: {
        syncStatus: "ready",
        available: true,
        quota: 100,
        usedQuota: 10,
        remainingQuota: 90,
        usageRatio: 0.1,
        requestCount: 1,
        group: "pro",
        gatewayUid: 1,
        gatewayUsername: "auth-smoke",
        planId: 1,
        error: "",
      },
    },
    authSession: {
      accessToken: "auth-smoke-access-secret",
      refreshToken: "auth-smoke-refresh-secret",
      expiresAt: "2026-07-24T00:00:00.000Z",
      refreshExpiresAt: "2026-08-24T00:00:00.000Z",
    },
  };
}

/** Execute a real Electron safeStorage persistence and reopen smoke check. */
function runAuthSmoke() {
  assert.equal(safeStorage.isEncryptionAvailable(), true, "safeStorage encryption is unavailable");
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-auth-electron-smoke-"));
  const databasePath = path.join(directory, "desktop-core.db");
  const credentialPath = path.join(directory, "auth-credentials.bin");
  try {
    const first = bootstrapApplicationAuth({ userDataDirectory: directory, safeStorage });
    const saved = first.saveSession(createAuthRequest());
    assert.equal(saved.revision, 1);
    first.close();

    const reopened = bootstrapApplicationAuth({ userDataDirectory: directory, safeStorage });
    const restored = reopened.getSession();
    assert.equal(restored.authSession.accessTokenConfigured, true);
    assert.equal(restored.authSession.refreshTokenConfigured, true);
    assert.equal(restored.authState.gatewayBootstrap?.api_key_configured, true);
    assert.equal(JSON.stringify(restored).includes("auth-smoke-access-secret"), false);
    assert.equal(JSON.stringify(restored).includes("auth-smoke-refresh-secret"), false);
    assert.equal(JSON.stringify(restored).includes("auth-smoke-gateway-secret"), false);
    assert.equal(reopened.getInternalSession().accessToken, "auth-smoke-access-secret");
    assert.equal(reopened.getInternalSession().refreshToken, "auth-smoke-refresh-secret");
    assert.equal(
      reopened.getGatewayCredentialBootstrap()?.api_key,
      "auth-smoke-gateway-secret",
    );

    const database = new DatabaseSync(databasePath, { readOnly: true });
    const row = database.prepare(
      "SELECT payload FROM application_documents WHERE document_key = ?",
    ).get(APPLICATION_AUTH_DOCUMENT_KEY);
    database.close();
    const metadata = String(row?.payload || "");
    assert.equal(metadata.includes("auth-smoke-access-secret"), false);
    assert.equal(metadata.includes("auth-smoke-refresh-secret"), false);
    assert.equal(metadata.includes("auth-smoke-gateway-secret"), false);

    const encrypted = readFileSync(credentialPath).toString("utf8");
    assert.equal(encrypted.includes("auth-smoke-access-secret"), false);
    assert.equal(encrypted.includes("auth-smoke-refresh-secret"), false);
    assert.equal(encrypted.includes("auth-smoke-gateway-secret"), false);

    const guest = reopened.clearSession();
    assert.equal(guest.authState.status, "guest");
    reopened.close();
    process.stdout.write(`${JSON.stringify({ ok: true, schema: restored.schema })}\n`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Run the smoke after Electron initializes its operating-system encryption backend. */
async function main() {
  try {
    await app.whenReady();
    runAuthSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}

void main();
