import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { APPLICATION_PROVIDER_DOCUMENT_KEY } from "../contracts/application-providers";
import {
  ApplicationProviderService,
  type ApplicationProviderFetch,
} from "./application-providers";
import { ApplicationStore } from "./application-store";
import type {
  ApplicationProviderCredentials,
  ApplicationProviderCredentialStore,
} from "./safe-storage-provider-credential-store";

/** In-memory encrypted-boundary substitute used to inspect provider separation. */
class TestProviderCredentialStore implements ApplicationProviderCredentialStore {
  public credentials: ApplicationProviderCredentials = {};
  public available = true;

  /** Report secure storage availability for provider tests. */
  public isAvailable(): boolean {
    return this.available;
  }

  /** Return a detached provider credential map. */
  public read(): ApplicationProviderCredentials {
    return structuredClone(this.credentials);
  }

  /** Replace the detached provider credential map. */
  public write(credentials: ApplicationProviderCredentials): void {
    this.credentials = structuredClone(credentials);
  }

  /** Clear all provider credentials. */
  public clear(): void {
    this.credentials = {};
  }
}

/** Create one strict provider draft for service tests. */
function createProvider(apiKey = "provider-secret") {
  return {
    id: "provider-a",
    vendor: "OpenAI",
    url: "https://provider.example.test/v1",
    modelId: "model-a",
    models: ["model-a"],
    name: "Provider A",
    managedBy: "",
    source: "test",
    disabled: false,
    apiKeyConfigured: Boolean(apiKey),
    ...(apiKey ? { apiKey } : {}),
  };
}

test("ApplicationProviderService migrates and redacts every selected provider key", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-application-providers-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestProviderCredentialStore();
  const service = new ApplicationProviderService({ store, credentials });
  try {
    const reconciled = service.reconcileLegacySettings({
      selectedProvider: "provider-a",
      api_key: "provider-secret",
      modelProviders: [{
        id: "provider-a",
        vendor: "OpenAI",
        url: "https://provider.example.test/v1",
        apiKey: "provider-secret",
        modelId: "model-a",
        models: ["model-a"],
      }],
      reasoner: {
        selectedProvider: "provider-a",
        api_key: "provider-secret",
      },
    });
    assert.equal(reconciled.persistSanitized, true);
    assert.equal(reconciled.settings.api_key, "");
    assert.equal((reconciled.settings.reasoner as Record<string, unknown>).api_key, "");
    const redactedProvider = (reconciled.settings.modelProviders as Record<string, unknown>[])[0];
    assert.equal(redactedProvider?.apiKey, "");
    assert.equal(redactedProvider?.apiKeyConfigured, true);
    assert.deepEqual(credentials.read(), { "provider-a": "provider-secret" });

    const metadata = store.getDocument(APPLICATION_PROVIDER_DOCUMENT_KEY);
    assert.equal(JSON.stringify(metadata?.value).includes("provider-secret"), false);
    const snapshot = service.getSnapshot();
    assert.equal(snapshot.providers[0]?.apiKeyConfigured, true);
    assert.equal(JSON.stringify(snapshot).includes("provider-secret"), false);

    service.saveProviders({ providers: [createProvider("")] });
    assert.deepEqual(credentials.read(), { "provider-a": "provider-secret" });
    service.saveProviders({ providers: [] });
    assert.deepEqual(credentials.read(), {});
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationProviderService validates with a stored key without returning it", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-validation-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestProviderCredentialStore();
  let authorization = "";
  let redirect = "";
  const fetchProvider: ApplicationProviderFetch = async (_url, init) => {
    authorization = init.headers.Authorization || "";
    redirect = init.redirect;
    const body = Buffer.from(JSON.stringify({ data: [{ id: "model-a" }] }));
    return {
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer,
    };
  };
  const service = new ApplicationProviderService({ store, credentials, fetch: fetchProvider });
  try {
    service.saveProviders({ providers: [createProvider()] });
    const validation = await service.validateProvider({
      providerId: "provider-a",
      vendor: "OpenAI",
      url: "https://provider.example.test/v1",
      modelId: "model-a",
    });
    assert.equal(authorization, "Bearer provider-secret");
    assert.equal(redirect, "error");
    assert.equal(validation.status, "ready");
    assert.equal(validation.matchedModel, true);
    assert.equal(JSON.stringify(validation).includes("provider-secret"), false);
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationProviderService binds stored keys to their configured provider URL", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-url-binding-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestProviderCredentialStore();
  let fetchCount = 0;
  const fetchProvider: ApplicationProviderFetch = async () => {
    fetchCount += 1;
    throw new Error("Bound credentials must not reach a different URL.");
  };
  const service = new ApplicationProviderService({ store, credentials, fetch: fetchProvider });
  try {
    service.saveProviders({ providers: [createProvider()] });
    assert.throws(
      () => service.saveProviders({
        providers: [{ ...createProvider(""), url: "https://attacker.example.test/v1" }],
      }),
      /must be re-entered/,
    );
    const validation = await service.validateProvider({
      providerId: "provider-a",
      vendor: "OpenAI",
      url: "https://attacker.example.test/v1",
      modelId: "model-a",
    });
    assert.equal(validation.status, "blocked");
    assert.equal(validation.apiKeyConfigured, true);
    assert.equal(fetchCount, 0);
    assert.deepEqual(credentials.read(), { "provider-a": "provider-secret" });
    credentials.available = false;
    assert.throws(
      () => service.saveProviders({ providers: [] }),
      /encryption is unavailable/,
    );
    assert.deepEqual(credentials.read(), { "provider-a": "provider-secret" });
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationProviderService probes embeddings with one stored credential", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-embedding-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestProviderCredentialStore();
  let requestUrl = "";
  let authorization = "";
  let method = "";
  let requestBody = "";
  const fetchProvider: ApplicationProviderFetch = async (url, init) => {
    requestUrl = url;
    authorization = init.headers.Authorization || "";
    method = init.method || "";
    requestBody = init.body || "";
    return jsonResponseForProvider({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
  };
  const service = new ApplicationProviderService({ store, credentials, fetch: fetchProvider });
  try {
    service.saveProviders({ providers: [createProvider()] });
    const result = await service.probeEmbeddingDimensions({ providerId: "provider-a" });

    assert.equal(requestUrl, "https://provider.example.test/v1/embeddings");
    assert.equal(authorization, "Bearer provider-secret");
    assert.equal(method, "POST");
    assert.deepEqual(JSON.parse(requestBody), { model: "model-a", input: "test" });
    assert.deepEqual(result, {
      providerId: "provider-a",
      modelId: "model-a",
      dimensions: 3,
    });
    assert.equal(JSON.stringify(result).includes("provider-secret"), false);
    await assert.rejects(
      service.probeEmbeddingDimensions({ providerId: "missing" }),
      /unavailable/,
    );
    await assert.rejects(
      service.probeEmbeddingDimensions({ providerId: "provider-a", modelId: "attacker" }),
      /request is invalid/,
    );
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationProviderService notifies subscribers when only a provider key rotates", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-rotation-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestProviderCredentialStore();
  const service = new ApplicationProviderService({ store, credentials });
  const snapshots: string[] = [];
  const unsubscribe = service.subscribe((snapshot) => {
    snapshots.push(JSON.stringify(snapshot));
  });
  try {
    service.saveProviders({ providers: [createProvider("provider-secret-a")] });
    const publicSnapshot = JSON.stringify(service.getSnapshot());
    service.saveProviders({ providers: [createProvider("provider-secret-b")] });

    assert.equal(snapshots.length, 2);
    assert.equal(JSON.stringify(service.getSnapshot()), publicSnapshot);
    assert.deepEqual(credentials.read(), { "provider-a": "provider-secret-b" });
    assert.equal(snapshots.some((snapshot) => snapshot.includes("provider-secret")), false);
  } finally {
    unsubscribe();
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationProviderService resolves managed gateway keys without copying them", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-provider-external-"));
  const store = new ApplicationStore({ databasePath: path.join(directory, "desktop-core.db") });
  const credentials = new TestProviderCredentialStore();
  credentials.credentials = { "openxnet-access-managed-provider": "copied-legacy-secret" };
  let gatewaySecret = "gateway-secret-a";
  let authorization = "";
  const service = new ApplicationProviderService({
    store,
    credentials,
    externalCredentials: {
      isManaged: (provider) => provider.managedBy === "openxnet-access",
      resolve: (provider) => provider.url === "https://gateway.example.test/v1"
        ? gatewaySecret
        : "",
    },
    fetch: async (_url, init) => {
      authorization = init.headers.Authorization || "";
      return jsonResponseForProvider({ data: [{ id: "model-a" }] });
    },
  });
  const snapshots: string[] = [];
  service.subscribe((snapshot) => snapshots.push(JSON.stringify(snapshot)));
  try {
    service.saveProviders({
      providers: [{
        id: "openxnet-access-managed-provider",
        vendor: "OpenAI",
        url: "https://gateway.example.test/v1",
        modelId: "model-a",
        models: ["model-a"],
        name: "OpenXnet Access",
        managedBy: "openxnet-access",
        source: "openxnet-access",
        disabled: false,
        apiKeyConfigured: true,
        apiKey: "renderer-copy-must-be-ignored",
      }],
    });
    assert.deepEqual(credentials.read(), {});
    assert.equal(service.getSnapshot().providers[0]?.apiKeyConfigured, true);
    const runtime = JSON.parse(
      Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"),
    ) as { credentials: Record<string, string> };
    assert.equal(runtime.credentials["openxnet-access-managed-provider"], "gateway-secret-a");

    await service.validateProvider({
      providerId: "openxnet-access-managed-provider",
      vendor: "OpenAI",
      url: "https://gateway.example.test/v1",
      modelId: "model-a",
    });
    assert.equal(authorization, "Bearer gateway-secret-a");

    gatewaySecret = "gateway-secret-b";
    service.synchronizeExternalCredentials();
    const rotatedRuntime = Buffer.from(
      service.getRuntimeCredentialBootstrap(),
      "base64",
    ).toString("utf8");
    assert.equal(rotatedRuntime.includes("gateway-secret-b"), true);
    assert.equal(snapshots.some((snapshot) => snapshot.includes("gateway-secret")), false);
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Create one provider-validation JSON response for external credential tests. */
function jsonResponseForProvider(value: unknown) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return {
    status: 200,
    headers: { get: () => null },
    arrayBuffer: async () => body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    ) as ArrayBuffer,
  };
}
