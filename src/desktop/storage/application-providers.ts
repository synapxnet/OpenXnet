import path from "node:path";

import {
  APPLICATION_PROVIDER_DOCUMENT_KEY,
  APPLICATION_PROVIDER_SCHEMA,
  MAX_APPLICATION_PROVIDER_COUNT,
  parseApplicationProviderDraft,
  parseProbeApplicationProviderEmbeddingRequest,
  parseSaveApplicationProvidersRequest,
  parseValidateApplicationProviderRequest,
  type ApplicationProviderEmbeddingProbeResult,
  type ApplicationProviderDraft,
  type ApplicationProviderMetadata,
  type ApplicationProviderSnapshot,
  type ApplicationProviderValidationCheck,
  type ApplicationProviderValidationResult,
} from "../contracts/application-providers";
import {
  APPLICATION_DATABASE_FILENAME,
  ApplicationStore,
} from "./application-store";
import {
  SafeStorageProviderCredentialStore,
  type ApplicationProviderCredentials,
  type ApplicationProviderCredentialStore,
} from "./safe-storage-provider-credential-store";
import type { SafeStorageLike } from "./safe-storage-credential-store";

/** Filename containing only OS-encrypted model provider credentials. */
export const APPLICATION_PROVIDER_CREDENTIAL_FILENAME = "provider-credentials.bin";

/** Maximum decoded provider credential bootstrap passed to one child process. */
export const MAX_PROVIDER_RUNTIME_BOOTSTRAP_BYTES = 20 * 1024;

interface ApplicationProviderDocument {
  readonly providers: readonly ApplicationProviderMetadata[];
}

/** Result of normalizing one legacy settings document. */
export interface ReconciledLegacyProviderSettings {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly persistSanitized: boolean;
}

/** Minimal fetch response consumed by provider validation. */
export interface ApplicationProviderFetchResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Minimal fetch implementation injectable into provider validation tests. */
export type ApplicationProviderFetch = (
  url: string,
  init: {
    readonly headers: Readonly<Record<string, string>>;
    readonly method?: "GET" | "POST";
    readonly body?: string;
    readonly redirect: "error";
    readonly signal: AbortSignal;
  },
) => Promise<ApplicationProviderFetchResponse>;

/** Optional provider service diagnostics sink. */
export interface ApplicationProviderLogger {
  warn(message: string, error?: unknown): void;
}

/** Main-only resolver for credentials owned by a different secure trust zone. */
export interface ApplicationExternalProviderCredentialResolver {
  isManaged(provider: ApplicationProviderMetadata): boolean;
  resolve(provider: ApplicationProviderMetadata): string;
}

/** Dependencies used to create one application provider service. */
export interface ApplicationProviderServiceOptions {
  readonly store: ApplicationStore;
  readonly credentials: ApplicationProviderCredentialStore;
  readonly fetch?: ApplicationProviderFetch;
  readonly logger?: ApplicationProviderLogger;
  readonly externalCredentials?: ApplicationExternalProviderCredentialResolver;
}

/** Paths and OS encryption required to bootstrap application providers. */
export interface BootstrapApplicationProvidersOptions {
  readonly userDataDirectory: string;
  readonly safeStorage: SafeStorageLike;
  readonly databasePath?: string;
  readonly credentialPath?: string;
  readonly fetch?: ApplicationProviderFetch;
  readonly logger?: ApplicationProviderLogger;
  readonly externalCredentials?: ApplicationExternalProviderCredentialResolver;
}

/** Listener notified after provider metadata or encrypted credentials change. */
export type ApplicationProviderChangedListener = (snapshot: ApplicationProviderSnapshot) => void;

const LOCAL_API_KEY_OPTIONAL_VENDORS = new Set([
  "ollama",
  "vllm",
  "lmstudio",
  "xinference",
  "localai",
]);

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return one detached JSON-compatible value. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Convert one strict provider draft to non-secret Core metadata. */
function toMetadata(provider: ApplicationProviderDraft): ApplicationProviderMetadata {
  return {
    id: provider.id,
    vendor: provider.vendor,
    url: provider.url,
    modelId: provider.modelId,
    models: [...provider.models],
    name: provider.name,
    managedBy: provider.managedBy,
    source: provider.source,
    disabled: provider.disabled,
    apiKeyConfigured: false,
  };
}

/** Coerce one legacy provider entry through the strict application contract. */
function parseLegacyProvider(value: unknown, index: number): ApplicationProviderDraft | null {
  if (!isRecord(value)) return null;
  try {
    return parseApplicationProviderDraft({
      id: value.id ?? `legacy-provider-${index + 1}`,
      vendor: value.vendor ?? "OpenAI",
      url: value.url ?? "",
      apiKey: value.apiKey ?? "",
      modelId: value.modelId ?? "",
      models: Array.isArray(value.models) ? value.models : [],
      name: value.name ?? "",
      managedBy: value.managedBy ?? "",
      source: value.source ?? "",
      disabled: value.disabled === true,
      apiKeyConfigured: value.apiKeyConfigured === true || value.hasApiKey === true,
    });
  } catch {
    return null;
  }
}

/** Build one public snapshot with configured flags derived from encrypted storage. */
function createSnapshot(
  revision: number,
  updatedAt: string | null,
  providers: readonly ApplicationProviderMetadata[],
  credentials: ApplicationProviderCredentials,
  secureStorage: ApplicationProviderSnapshot["secureStorage"],
): ApplicationProviderSnapshot {
  return {
    schema: APPLICATION_PROVIDER_SCHEMA,
    revision,
    providers: providers.map((provider) => ({
      ...provider,
      models: [...provider.models],
      apiKeyConfigured: Boolean(credentials[provider.id]),
    })),
    updatedAt,
    secureStorage,
  };
}

/** Core-owned provider metadata service with an OS-encrypted credential sidecar. */
export class ApplicationProviderService {
  private readonly listeners = new Set<ApplicationProviderChangedListener>();
  private readonly fetchProvider: ApplicationProviderFetch;
  private readonly logger: ApplicationProviderLogger;
  private externalCredentialFingerprint = "";
  private closed = false;

  /** Create a provider boundary over initialized metadata and credential stores. */
  public constructor(private readonly options: ApplicationProviderServiceOptions) {
    this.fetchProvider = options.fetch ?? (globalThis.fetch as ApplicationProviderFetch);
    this.logger = options.logger ?? console;
  }

  /** Return the current redacted provider metadata snapshot. */
  public getSnapshot(): ApplicationProviderSnapshot {
    this.assertOpen();
    const document = this.options.store.getDocument<ApplicationProviderDocument>(
      APPLICATION_PROVIDER_DOCUMENT_KEY,
    );
    const providers = Array.isArray(document?.value.providers) ? document.value.providers : [];
    const credentials = this.readEffectiveCredentials(providers);
    return createSnapshot(
      document?.revision ?? 0,
      document?.updatedAt ?? null,
      providers,
      credentials,
      this.options.credentials.isAvailable() ? "desktop-safe-storage" : "unavailable",
    );
  }

  /** Persist one exact provider batch while keeping secrets outside Core SQLite. */
  public saveProviders(value: unknown): ApplicationProviderSnapshot {
    this.assertOpen();
    const request = parseSaveApplicationProvidersRequest(value);
    return this.persistProviders(request.providers, {});
  }

  /**
   * Capture legacy provider keys, persist metadata, and return a redacted settings clone.
   *
   * @param value Legacy settings object read or received by Main.
   * @returns Redacted settings and whether the existing database may be rewritten safely.
   */
  public reconcileLegacySettings(
    value: Readonly<Record<string, unknown>>,
    options: { readonly requireSecureCapture?: boolean } = {},
  ): ReconciledLegacyProviderSettings {
    this.assertOpen();
    const settings = cloneJson(value) as Record<string, unknown>;
    const rawProviders = Array.isArray(settings.modelProviders) ? settings.modelProviders : [];
    const drafts = rawProviders
      .map(parseLegacyProvider)
      .filter((provider): provider is ApplicationProviderDraft => provider !== null)
      .slice(0, MAX_APPLICATION_PROVIDER_COUNT);
    const secretOverrides: Record<string, string> = {};
    for (const provider of drafts) {
      if (provider.apiKey) secretOverrides[provider.id] = provider.apiKey;
    }
    this.collectSelectedProviderSecrets(settings, secretOverrides);

    if (drafts.length === 0) {
      const selectedSecret = typeof settings.api_key === "string" ? settings.api_key.trim() : "";
      const selectedUrl = typeof settings.base_url === "string" ? settings.base_url.trim() : "";
      if (selectedSecret || selectedUrl) {
        const synthetic = parseApplicationProviderDraft({
          id: "legacy-default",
          vendor: "custom",
          url: selectedUrl,
          apiKey: selectedSecret,
          modelId: typeof settings.model === "string" ? settings.model : "",
          models: typeof settings.model === "string" && settings.model.trim() ? [settings.model] : [],
          name: "Legacy Provider",
          managedBy: "",
          source: "legacy-migration",
          disabled: false,
          apiKeyConfigured: Boolean(selectedSecret),
        });
        drafts.push(synthetic);
        settings.selectedProvider = synthetic.id;
        if (selectedSecret) secretOverrides[synthetic.id] = selectedSecret;
      }
    }

    const containsSecrets = Object.keys(secretOverrides).length > 0;
    let snapshot: ApplicationProviderSnapshot;
    let capturedSecurely = !containsSecrets;
    try {
      snapshot = this.persistProviders(
        drafts,
        secretOverrides,
        options.requireSecureCapture === true,
      );
      capturedSecurely = !containsSecrets || snapshot.secureStorage === "desktop-safe-storage";
    } catch (error) {
      if (options.requireSecureCapture === true && containsSecrets) throw error;
      this.logger.warn("Provider credentials could not be migrated into secure storage.", error);
      snapshot = createSnapshot(
        0,
        null,
        drafts.map(toMetadata),
        {},
        "unavailable",
      );
    }
    const redacted = this.redactSettings(settings, snapshot);
    return {
      settings: redacted,
      persistSanitized: capturedSecurely && JSON.stringify(redacted) !== JSON.stringify(value),
    };
  }

  /** Validate provider connectivity without returning or logging its credential. */
  public async validateProvider(value: unknown): Promise<ApplicationProviderValidationResult> {
    this.assertOpen();
    const request = parseValidateApplicationProviderRequest(value);
    const document = this.options.store.getDocument<ApplicationProviderDocument>(
      APPLICATION_PROVIDER_DOCUMENT_KEY,
    );
    const storedProviders = Array.isArray(document?.value.providers) ? document.value.providers : [];
    const credentials = this.readEffectiveCredentials(storedProviders);
    const storedProvider = request.providerId
      ? storedProviders.find((provider) => provider.id === request.providerId)
      : undefined;
    const storedApiKey = request.providerId ? credentials[request.providerId] || "" : "";
    const usesStoredApiKey = !request.apiKey && Boolean(storedApiKey);
    const apiKey = request.apiKey || storedApiKey;
    const vendorKey = request.vendor.toLowerCase();
    const apiKeyOptional = LOCAL_API_KEY_OPTIONAL_VENDORS.has(vendorKey)
      || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(request.url);
    const checks: ApplicationProviderValidationCheck[] = [];
    const addCheck = (
      id: string,
      status: ApplicationProviderValidationCheck["status"],
      summary: string,
      detail = "",
    ): void => {
      checks.push({ id, status, summary, detail });
    };

    if (!request.url) {
      addCheck("base_url", "blocked", "Provider URL is required.");
      return this.createValidationResult(request, apiKey, apiKeyOptional, [], checks);
    }
    addCheck("base_url", "ready", "Provider URL is configured.", request.url);
    if (usesStoredApiKey && (!storedProvider || storedProvider.url !== request.url)) {
      addCheck(
        "credential_scope",
        "blocked",
        "Stored provider credential is bound to its configured URL.",
      );
      return this.createValidationResult(request, apiKey, apiKeyOptional, [], checks);
    }
    if (apiKey) {
      addCheck("auth", "ready", "Provider credential is configured.");
    } else if (apiKeyOptional) {
      addCheck("auth", "ready", "This local provider may run without a credential.");
    } else {
      addCheck("auth", "warning", "Provider credential is not configured.");
    }

    const models: string[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchProvider(
        request.url.endsWith("/models") ? request.url : `${request.url}/models`,
        {
          headers: {
            Accept: "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          redirect: "error",
          signal: controller.signal,
        },
      );
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > 1024 * 1024) {
        throw new Error("Provider model response exceeds the byte budget.");
      }
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > 1024 * 1024) {
        throw new Error("Provider model response exceeds the byte budget.");
      }
      if (response.status >= 400) {
        addCheck(
          "connectivity",
          response.status === 401 || response.status === 403 ? "blocked" : "warning",
          response.status === 401 || response.status === 403
            ? "Provider authentication failed."
            : `Provider returned HTTP ${response.status}.`,
        );
      } else {
        const payload = JSON.parse(body.toString("utf8")) as unknown;
        const candidates = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
        const seen = new Set<string>();
        for (const candidate of candidates) {
          const model = isRecord(candidate) ? String(candidate.id || "").trim() : "";
          if (model && model.length <= 512 && !seen.has(model)) {
            seen.add(model);
            models.push(model);
            if (models.length >= 256) break;
          }
        }
        addCheck("connectivity", "ready", "Provider connection succeeded.", `${models.length} models returned.`);
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      addCheck(
        "connectivity",
        "blocked",
        aborted ? "Provider connection timed out." : "Provider connection failed.",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (request.modelId) {
      if (models.includes(request.modelId)) {
        addCheck("model", "ready", "Configured model was found.", request.modelId);
      } else if (models.length > 0) {
        addCheck("model", "warning", "Configured model was not returned.", request.modelId);
      } else {
        addCheck("model", "info", "Configured model could not be verified.", request.modelId);
      }
    } else {
      addCheck("model", "warning", "Provider model is not configured.");
    }
    return this.createValidationResult(request, apiKey, apiKeyOptional, models, checks);
  }

  /**
   * 探测已保存 Provider 的向量维度；输入仅含 Provider ID，输出模型 ID 与正整数维度。
   * 本函数会使用 Main 私有凭据发出一次有界网络请求；配置缺失、上游失败或响应异常时抛错，且不返回或记录密钥。
   */
  public async probeEmbeddingDimensions(
    value: unknown,
  ): Promise<ApplicationProviderEmbeddingProbeResult> {
    this.assertOpen();
    const request = parseProbeApplicationProviderEmbeddingRequest(value);
    const document = this.options.store.getDocument<ApplicationProviderDocument>(
      APPLICATION_PROVIDER_DOCUMENT_KEY,
    );
    const providers = Array.isArray(document?.value.providers) ? document.value.providers : [];
    const provider = providers.find((candidate) => candidate.id === request.providerId);
    if (!provider || provider.disabled) {
      throw new Error("Application provider embedding probe provider is unavailable.");
    }
    if (!provider.url || !provider.modelId) {
      throw new Error("Application provider embedding probe requires a URL and model.");
    }
    const credentials = this.readEffectiveCredentials(providers);
    const apiKey = credentials[provider.id] || "";
    const vendorKey = provider.vendor.toLowerCase();
    const apiKeyOptional = LOCAL_API_KEY_OPTIONAL_VENDORS.has(vendorKey)
      || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(provider.url);
    if (!apiKey && !apiKeyOptional) {
      throw new Error("Application provider embedding probe credential is unavailable.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchProvider(
        provider.url.endsWith("/embeddings") ? provider.url : `${provider.url}/embeddings`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ model: provider.modelId, input: "test" }),
          redirect: "error",
          signal: controller.signal,
        },
      );
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > 1024 * 1024) {
        throw new Error("Application provider embedding response exceeds the byte budget.");
      }
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > 1024 * 1024) {
        throw new Error("Application provider embedding response exceeds the byte budget.");
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Application provider embedding probe returned HTTP ${response.status}.`);
      }
      const payload = JSON.parse(body.toString("utf8")) as unknown;
      const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
      const first = data[0];
      const embedding = isRecord(first) && Array.isArray(first.embedding) ? first.embedding : [];
      if (embedding.length < 1 || embedding.length > 65_536) {
        throw new Error("Application provider embedding response is invalid.");
      }
      return {
        providerId: provider.id,
        modelId: provider.modelId,
        dimensions: embedding.length,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Application provider embedding probe timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Return a bounded Base64 credential envelope for one trusted child process. */
  public getRuntimeCredentialBootstrap(): string {
    this.assertOpen();
    const document = this.options.store.getDocument<ApplicationProviderDocument>(
      APPLICATION_PROVIDER_DOCUMENT_KEY,
    );
    const providers = Array.isArray(document?.value.providers) ? document.value.providers : [];
    const credentials = this.readEffectiveCredentials(providers);
    const serialized = JSON.stringify({
      schema: "openxnet.provider-credentials.runtime.v1",
      credentials,
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROVIDER_RUNTIME_BOOTSTRAP_BYTES) {
      throw new Error("Provider runtime credential bootstrap exceeds its byte budget.");
    }
    return Buffer.from(serialized, "utf8").toString("base64");
  }

  /** Subscribe to committed provider metadata or credential changes. */
  public subscribe(listener: ApplicationProviderChangedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Remove copied external credentials and notify runtime observers after auth changes. */
  public synchronizeExternalCredentials(): ApplicationProviderSnapshot {
    this.assertOpen();
    const document = this.options.store.getDocument<ApplicationProviderDocument>(
      APPLICATION_PROVIDER_DOCUMENT_KEY,
    );
    const providers = Array.isArray(document?.value.providers) ? document.value.providers : [];
    const previousCredentials = this.readCredentials();
    const credentials = { ...previousCredentials };
    for (const provider of providers) {
      if (this.isExternalCredentialProvider(provider)) {
        delete credentials[provider.id];
      }
    }
    const storedCredentialsChanged = JSON.stringify(previousCredentials) !== JSON.stringify(credentials);
    if (storedCredentialsChanged) {
      this.writeCredentials(credentials);
    }
    const effectiveCredentials = this.readEffectiveCredentials(providers);
    const nextExternalFingerprint = this.createExternalCredentialFingerprint(
      providers,
      effectiveCredentials,
    );
    const externalCredentialsChanged = this.externalCredentialFingerprint !== nextExternalFingerprint;
    this.externalCredentialFingerprint = nextExternalFingerprint;
    const snapshot = createSnapshot(
      document?.revision ?? 0,
      document?.updatedAt ?? null,
      providers,
      effectiveCredentials,
      this.options.credentials.isAvailable() ? "desktop-safe-storage" : "unavailable",
    );
    if (storedCredentialsChanged || externalCredentialsChanged) {
      for (const listener of this.listeners) listener(snapshot);
    }
    return snapshot;
  }

  /** Close the provider metadata database handle once. */
  public close(): void {
    if (this.closed) return;
    this.options.store.close();
    this.closed = true;
  }

  /** Persist normalized providers and notify observers only after a real change. */
  private persistProviders(
    drafts: readonly ApplicationProviderDraft[],
    secretOverrides: Readonly<Record<string, string>>,
    notify = true,
  ): ApplicationProviderSnapshot {
    if (!this.options.credentials.isAvailable()) {
      throw new Error("Operating-system provider credential encryption is unavailable.");
    }
    const previous = this.getSnapshot();
    const previousCredentials = this.readCredentials();
    const credentials = { ...previousCredentials };
    const previousProviders = new Map(previous.providers.map((provider) => [provider.id, provider]));
    const providerIds = new Set(drafts.map((provider) => provider.id));
    for (const credentialId of Object.keys(credentials)) {
      if (!providerIds.has(credentialId)) delete credentials[credentialId];
    }
    for (const provider of drafts) {
      const previousProvider = previousProviders.get(provider.id);
      if (this.isExternalCredentialProvider(toMetadata(provider))) {
        delete credentials[provider.id];
        continue;
      }
      if (
        previousCredentials[provider.id]
        && previousProvider
        && previousProvider.url !== provider.url
        && !provider.apiKey
        && provider.clearApiKey !== true
      ) {
        throw new Error("Provider credential must be re-entered when its URL changes.");
      }
      const nextSecret = provider.apiKey || secretOverrides[provider.id] || "";
      if (provider.clearApiKey === true) {
        delete credentials[provider.id];
      } else if (nextSecret) {
        credentials[provider.id] = nextSecret;
      }
    }
    this.writeCredentials(credentials);

    const providers = drafts.map(toMetadata);
    const currentDocument = this.options.store.getDocument<ApplicationProviderDocument>(
      APPLICATION_PROVIDER_DOCUMENT_KEY,
    );
    const fingerprint = JSON.stringify(providers);
    const document = currentDocument !== null
      && JSON.stringify(currentDocument.value.providers) === fingerprint
      ? currentDocument
      : this.options.store.setDocument(APPLICATION_PROVIDER_DOCUMENT_KEY, { providers });
    const effectiveCredentials = this.readEffectiveCredentials(providers, credentials);
    this.externalCredentialFingerprint = this.createExternalCredentialFingerprint(
      providers,
      effectiveCredentials,
    );
    const snapshot = createSnapshot(
      document.revision,
      document.updatedAt,
      providers,
      effectiveCredentials,
      this.options.credentials.isAvailable() ? "desktop-safe-storage" : "unavailable",
    );
    const credentialsChanged = JSON.stringify(previousCredentials) !== JSON.stringify(credentials);
    if (notify && (credentialsChanged || JSON.stringify(previous) !== JSON.stringify(snapshot))) {
      for (const listener of this.listeners) listener(snapshot);
    }
    return snapshot;
  }

  /** Collect copied provider keys from selected configuration nodes recursively. */
  private collectSelectedProviderSecrets(value: unknown, output: Record<string, string>): void {
    if (Array.isArray(value)) {
      for (const item of value) this.collectSelectedProviderSecrets(item, output);
      return;
    }
    if (!isRecord(value)) return;
    const providerId = typeof value.selectedProvider === "string" || typeof value.selectedProvider === "number"
      ? String(value.selectedProvider).trim()
      : "";
    const secret = typeof value.api_key === "string" ? value.api_key.trim() : "";
    if (providerId && secret && !output[providerId]) output[providerId] = secret;
    for (const child of Object.values(value)) this.collectSelectedProviderSecrets(child, output);
  }

  /** Replace provider secrets in one legacy settings tree with configured booleans. */
  private redactSettings(
    value: Readonly<Record<string, unknown>>,
    snapshot: ApplicationProviderSnapshot,
  ): Readonly<Record<string, unknown>> {
    const configured = new Map(snapshot.providers.map((provider) => [provider.id, provider.apiKeyConfigured]));
    const redactNode = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(redactNode);
      if (!isRecord(node)) return node;
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) result[key] = redactNode(child);
      const providerId = typeof result.selectedProvider === "string" || typeof result.selectedProvider === "number"
        ? String(result.selectedProvider).trim()
        : "";
      if (providerId && ("api_key" in result || configured.has(providerId))) {
        result.selectedProvider = providerId;
        result.api_key = "";
        result.api_key_configured = configured.get(providerId) === true;
      }
      return result;
    };
    const settings = redactNode(value) as Record<string, unknown>;
    settings.modelProviders = snapshot.providers.map((provider) => ({
      ...provider,
      apiKey: "",
    }));
    return settings;
  }

  /** Build one final validation result from bounded checks. */
  private createValidationResult(
    request: ReturnType<typeof parseValidateApplicationProviderRequest>,
    apiKey: string,
    apiKeyOptional: boolean,
    models: readonly string[],
    checks: readonly ApplicationProviderValidationCheck[],
  ): ApplicationProviderValidationResult {
    const hasBlocked = checks.some((check) => check.status === "blocked");
    const hasWarning = checks.some((check) => check.status === "warning");
    const status = hasBlocked ? "blocked" : (hasWarning ? "warning" : "ready");
    const primary = checks.find((check) => check.status === status);
    return {
      status,
      message: primary?.detail || primary?.summary || "Provider validation completed.",
      vendor: request.vendor,
      url: request.url,
      modelId: request.modelId,
      apiKeyConfigured: Boolean(apiKey),
      apiKeyOptional,
      matchedModel: Boolean(request.modelId && models.includes(request.modelId)),
      models: models.slice(0, 20),
      checks: checks.map((check) => ({ ...check })),
    };
  }

  /** Read provider credentials without allowing storage failures to expose data. */
  private readCredentials(): ApplicationProviderCredentials {
    if (!this.options.credentials.isAvailable()) return {};
    try {
      return this.options.credentials.read();
    } catch (error) {
      this.logger.warn("Encrypted provider credentials could not be read.", error);
      return {};
    }
  }

  /** Merge ordinary encrypted credentials with Main-only external credential resolvers. */
  private readEffectiveCredentials(
    providers: readonly ApplicationProviderMetadata[],
    storedCredentials = this.readCredentials(),
  ): ApplicationProviderCredentials {
    const credentials = { ...storedCredentials };
    for (const provider of providers) {
      if (!this.isExternalCredentialProvider(provider)) continue;
      delete credentials[provider.id];
      try {
        const secret = String(this.options.externalCredentials?.resolve(provider) || "").trim();
        if (secret) credentials[provider.id] = secret;
      } catch (error) {
        this.logger.warn("External provider credential could not be resolved.", error);
      }
    }
    return credentials;
  }

  /** Return whether one provider is owned by the configured external credential boundary. */
  private isExternalCredentialProvider(provider: ApplicationProviderMetadata): boolean {
    try {
      return this.options.externalCredentials?.isManaged(provider) === true;
    } catch (error) {
      this.logger.warn("External provider ownership could not be resolved.", error);
      return false;
    }
  }

  /** Build a private change fingerprint for externally resolved credentials. */
  private createExternalCredentialFingerprint(
    providers: readonly ApplicationProviderMetadata[],
    credentials: ApplicationProviderCredentials,
  ): string {
    return JSON.stringify(
      providers
        .filter((provider) => this.isExternalCredentialProvider(provider))
        .map((provider) => [provider.id, provider.url, credentials[provider.id] || ""]),
    );
  }

  /** Replace or clear the ordinary provider credential sidecar. */
  private writeCredentials(credentials: ApplicationProviderCredentials): void {
    if (Object.keys(credentials).length > 0) {
      this.options.credentials.write(credentials);
    } else {
      this.options.credentials.clear();
    }
  }

  /** Reject provider operations after the service has closed. */
  private assertOpen(): void {
    if (this.closed) throw new Error("Application provider service is closed.");
  }
}

/** Bootstrap provider metadata and encrypted credentials over the shared Core database. */
export function bootstrapApplicationProviders(
  options: BootstrapApplicationProvidersOptions,
): ApplicationProviderService {
  const userDataDirectory = path.resolve(options.userDataDirectory);
  const store = new ApplicationStore({
    databasePath: options.databasePath
      ?? path.join(userDataDirectory, APPLICATION_DATABASE_FILENAME),
  });
  const credentials = new SafeStorageProviderCredentialStore({
    filePath: options.credentialPath
      ?? path.join(userDataDirectory, APPLICATION_PROVIDER_CREDENTIAL_FILENAME),
    safeStorage: options.safeStorage,
  });
  return new ApplicationProviderService({
    store,
    credentials,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
    ...(options.externalCredentials ? { externalCredentials: options.externalCredentials } : {}),
  });
}
