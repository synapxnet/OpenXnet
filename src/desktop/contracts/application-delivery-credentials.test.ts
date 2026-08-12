import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createApplicationDeliveryCredentialScopeId,
  parseApplicationDeliveryCredentialScope,
  parseApplicationDeliveryCredentialUrl,
  parseApplicationDeliveryCredentialValues,
  parseSaveApplicationDeliveryCredentialsRequest,
} from "./application-delivery-credentials";

test("delivery credential contract accepts HTTPS and loopback HTTP URLs", () => {
  assert.equal(
    parseApplicationDeliveryCredentialUrl("https://hooks.example.test/delivery?tenant=1"),
    "https://hooks.example.test/delivery?tenant=1",
  );
  assert.equal(
    parseApplicationDeliveryCredentialUrl("http://127.0.0.1:8080/hook"),
    "http://127.0.0.1:8080/hook",
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialUrl("http://hooks.example.test/insecure"),
    /URL is invalid/,
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialUrl("https://user:secret@example.test/hook"),
    /URL is invalid/,
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialUrl("https://example.test/hook#secret"),
    /URL is invalid/,
  );
});

test("delivery credential contract isolates workspace task and target scopes", () => {
  const scope = parseApplicationDeliveryCredentialScope({
    workspacePath: ".",
    taskId: "task:delivery-1",
    target: "webhook",
  });
  assert.equal(scope.workspacePath, path.resolve("."));
  assert.match(createApplicationDeliveryCredentialScopeId(scope), /^[a-f0-9]{64}$/);
  assert.notEqual(
    createApplicationDeliveryCredentialScopeId(scope),
    createApplicationDeliveryCredentialScopeId({ ...scope, target: "discord" }),
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialScope({ ...scope, target: "telegram" }),
    /target is invalid/,
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialScope({ ...scope, extra: true }),
    /scope is invalid/,
  );
});

test("delivery credential contract rejects cross-target fields and ambiguous writes", () => {
  assert.deepEqual(
    parseApplicationDeliveryCredentialValues({
      url: "https://hooks.example.test/delivery",
      headers: { Authorization: "Bearer delivery-secret" },
    }, "webhook"),
    {
      url: "https://hooks.example.test/delivery",
      headers: { authorization: "Bearer delivery-secret" },
    },
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialValues({ webhook_url: "https://discord.test/hook" }, "webhook"),
    /field is invalid/,
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialValues({ url: "https://example.test/hook" }, "discord"),
    /field is invalid/,
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialValues({
      url: "https://example.test/hook",
      headers: { Host: "attacker.example.test" },
    }, "webhook"),
    /header name is invalid/,
  );
  assert.throws(
    () => parseApplicationDeliveryCredentialValues({
      url: "https://example.test/hook",
      headers: Object.fromEntries(Array.from({ length: 3 }, (_, index) => (
        [`X-Large-${index}`, "s".repeat(64 * 1024)]
      ))),
    }, "webhook"),
    /scope byte budget/,
  );
  const scope = { workspacePath: ".", taskId: "task-1", target: "webhook" } as const;
  assert.throws(
    () => parseSaveApplicationDeliveryCredentialsRequest({ scope, clear: true, credentials: {
      url: "https://example.test/hook",
    } }),
    /one replacement or clear operation/,
  );
});
