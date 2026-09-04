import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_ACCESS_SCHEMA,
  parseApplicationAccessRequest,
} from "../contracts/application-access";
import {
  APPLICATION_AUTH_SCHEMA,
  DEFAULT_APPLICATION_AUTH_STATE,
  type ApplicationAuthSecretSession,
  type ApplicationAuthSnapshot,
} from "../contracts/application-auth";
import {
  ApplicationAccessGateway,
  type ApplicationAccessFetchResponse,
} from "./application-access-gateway";

/** Create one minimal JSON fetch response for gateway tests. */
function jsonResponse(status: number, value: unknown): ApplicationAccessFetchResponse {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return {
    status,
    headers: { get: (name) => name.toLowerCase() === "content-length" ? String(body.length) : null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

/** Create one redacted authentication snapshot from a test secret session. */
function createSnapshot(session: ApplicationAuthSecretSession): ApplicationAuthSnapshot {
  return {
    schema: APPLICATION_AUTH_SCHEMA,
    revision: session.accessToken || session.refreshToken ? 1 : 0,
    authState: {
      ...DEFAULT_APPLICATION_AUTH_STATE,
      status: session.accessToken || session.refreshToken ? "signed_in_basic" : "guest",
    },
    authSession: {
      accessTokenConfigured: Boolean(session.accessToken),
      refreshTokenConfigured: Boolean(session.refreshToken),
      expiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
    },
    updatedAt: null,
    secureStorage: "desktop-safe-storage",
  };
}

test("parseApplicationAccessRequest enforces exact routes, methods, and queries", () => {
  assert.equal(
    parseApplicationAccessRequest({
      path: "/v1/access/sub/upgrade/preview?new_plan_code=pro",
      method: "GET",
    }).targetPath,
    "/sub/upgrade/preview?new_plan_code=pro",
  );
  assert.equal(
    parseApplicationAccessRequest({
      path: "/v1/access/sub/orders/order-1/cancel",
      method: "POST",
    }).targetPath,
    "/sub/orders/order-1/cancel",
  );
  const resetRequest = parseApplicationAccessRequest({
    path: "/v1/access/auth/password/reset",
    method: "POST",
    body: {
      phone: "18800000000",
      code: "123456",
      new_password: "new-password-123",
      terms_accepted: true,
      privacy_accepted: true,
      agreements_locale: "zh-CN",
    },
  });
  assert.equal(resetRequest.targetPath, "/auth/password/reset");
  assert.equal(resetRequest.sessionAction, "capture");
  assert.throws(
    () => parseApplicationAccessRequest({ path: "https://evil.test/v1/access/plans" }),
    /path is invalid/,
  );
  assert.throws(
    () => parseApplicationAccessRequest({ path: "/v1/access/auth/me", method: "POST" }),
    /route is not allowed/,
  );
  assert.throws(
    () => parseApplicationAccessRequest({
      path: "/v1/access/auth/login/password",
      method: "POST",
      body: { identity: "ada", password: "secret", unexpected: true },
    }),
    /body fields are invalid/,
  );
  assert.throws(
    () => parseApplicationAccessRequest({
      path: "/v1/access/auth/password/reset",
      method: "POST",
      body: { phone: "18800000000", code: "123456", password: "not-allowed" },
    }),
    /body fields are invalid/,
  );
});

test("ApplicationAccessGateway refreshes a 401 in Main and never returns credentials", async () => {
  let session: ApplicationAuthSecretSession = {
    accessToken: "old-access",
    refreshToken: "refresh-secret",
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
  const calls: Array<{ url: string; authorization: string; body: string }> = [];
  let profileAttempts = 0;
  const gateway = new ApplicationAccessGateway({
    auth: {
      getSession: () => createSnapshot(session),
      getInternalSession: () => ({ ...session }),
      applyRemoteSession: (payload: unknown) => {
        const record = payload as Record<string, unknown>;
        session = {
          ...session,
          accessToken: typeof record.access_token === "string" ? record.access_token : session.accessToken,
          refreshToken: typeof record.refresh_token === "string" ? record.refresh_token : session.refreshToken,
        };
        return createSnapshot(session);
      },
      clearSession: () => {
        session = { accessToken: "", refreshToken: "", expiresAt: "", refreshExpiresAt: "" };
        return createSnapshot(session);
      },
    },
    fetch: async (url, init) => {
      calls.push({
        url,
        authorization: init.headers.Authorization || "",
        body: init.body || "",
      });
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, {
          access_token: "new-access",
          refresh_token: "new-refresh",
          gateway_bootstrap: {
            base_url: "https://gateway.example.test/v1",
            api_key: "gateway-secret",
          },
        });
      }
      profileAttempts += 1;
      return profileAttempts === 1
        ? jsonResponse(401, { detail: "expired" })
        : jsonResponse(200, { profile: { nickname: "Ada" } });
    },
  });
  const result = await gateway.request({ path: "/v1/access/auth/me" });
  assert.equal(result.schema, APPLICATION_ACCESS_SCHEMA);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.authorization, "Bearer old-access");
  assert.equal(calls[1]?.authorization, "");
  assert.match(calls[1]?.body || "", /refresh-secret/);
  assert.equal(calls[2]?.authorization, "Bearer new-access");
  assert.equal(JSON.stringify(result).includes("new-access"), false);
  assert.equal(JSON.stringify(result).includes("new-refresh"), false);
  assert.equal(JSON.stringify(result).includes("gateway-secret"), false);
});

test("ApplicationAccessGateway blocks redirects and bounds transport errors", async () => {
  const emptySession: ApplicationAuthSecretSession = {
    accessToken: "",
    refreshToken: "",
    expiresAt: "",
    refreshExpiresAt: "",
  };
  const gateway = new ApplicationAccessGateway({
    auth: {
      getSession: () => createSnapshot(emptySession),
      getInternalSession: () => ({ ...emptySession }),
      applyRemoteSession: () => createSnapshot(emptySession),
      clearSession: () => createSnapshot(emptySession),
    },
    fetch: async (_url, init) => {
      assert.equal(init.redirect, "error");
      throw new Error("network failed with secret-like remote detail");
    },
    logger: { warn: () => undefined },
  });
  const result = await gateway.request({ path: "/v1/access/plans" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 502);
    assert.equal(result.error.code, "REQUEST_FAILED");
    assert.equal(result.error.message, "The account service is temporarily unavailable.");
  }
});

test("ApplicationAccessGateway removes reflected form credentials from remote errors", async () => {
  const emptySession: ApplicationAuthSecretSession = {
    accessToken: "",
    refreshToken: "",
    expiresAt: "",
    refreshExpiresAt: "",
  };
  const gateway = new ApplicationAccessGateway({
    auth: {
      getSession: () => createSnapshot(emptySession),
      getInternalSession: () => ({ ...emptySession }),
      applyRemoteSession: () => createSnapshot(emptySession),
      clearSession: () => createSnapshot(emptySession),
    },
    fetch: async () => jsonResponse(400, { detail: "Password reflected-secret is invalid." }),
  });
  const result = await gateway.request({
    path: "/v1/access/auth/login/password",
    method: "POST",
    body: { identity: "ada", password: "reflected-secret" },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.message.includes("reflected-secret"), false);
    assert.match(result.error.message, /\[redacted\]/);
  }
});
