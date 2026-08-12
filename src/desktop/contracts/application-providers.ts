/** IPC channels owned by the application provider-settings boundary. */
export const APPLICATION_PROVIDER_CHANNELS = {
  getSnapshot: "openxnet:application-providers:get-snapshot",
  saveProviders: "openxnet:application-providers:save",
  validateProvider: "openxnet:application-providers:validate",
  probeEmbedding: "openxnet:application-providers:probe-embedding",
} as const;

/** Stable schema returned for provider metadata snapshots. */
export const APPLICATION_PROVIDER_SCHEMA = "openxnet.application-providers.v1" as const;

/** Stable Core document key containing non-secret provider metadata. */
export const APPLICATION_PROVIDER_DOCUMENT_KEY = "application-providers";

/** Maximum number of model providers accepted from one Renderer request. */
export const MAX_APPLICATION_PROVIDER_COUNT = 128;

/** Non-secret provider metadata safe to expose to Renderer. */
export interface ApplicationProviderMetadata {
  readonly id: string;
  readonly vendor: string;
  readonly url: string;
  readonly modelId: string;
  readonly models: readonly string[];
  readonly name: string;
  readonly managedBy: string;
  readonly source: string;
  readonly disabled: boolean;
  readonly apiKeyConfigured: boolean;
}

/** Provider draft accepted from an authorized Renderer save. */
export interface ApplicationProviderDraft extends ApplicationProviderMetadata {
  readonly apiKey?: string;
  readonly clearApiKey?: boolean;
}

/** Serialized provider metadata snapshot returned through typed IPC. */
export interface ApplicationProviderSnapshot {
  readonly schema: typeof APPLICATION_PROVIDER_SCHEMA;
  readonly revision: number;
  readonly providers: readonly ApplicationProviderMetadata[];
  readonly updatedAt: string | null;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact batch replacement request for application provider metadata. */
export interface SaveApplicationProvidersRequest {
  readonly providers: readonly ApplicationProviderDraft[];
}

/** Exact provider validation request that may contain one newly entered secret. */
export interface ValidateApplicationProviderRequest {
  readonly providerId?: string;
  readonly vendor: string;
  readonly url: string;
  readonly modelId: string;
  readonly apiKey?: string;
}

/** One bounded validation check returned without provider credentials. */
export interface ApplicationProviderValidationCheck {
  readonly id: string;
  readonly status: "ready" | "warning" | "blocked" | "info";
  readonly summary: string;
  readonly detail: string;
}

/** Provider validation result safe to return to Renderer. */
export interface ApplicationProviderValidationResult {
  readonly status: "ready" | "warning" | "blocked";
  readonly message: string;
  readonly vendor: string;
  readonly url: string;
  readonly modelId: string;
  readonly apiKeyConfigured: boolean;
  readonly apiKeyOptional: boolean;
  readonly matchedModel: boolean;
  readonly models: readonly string[];
  readonly checks: readonly ApplicationProviderValidationCheck[];
}

/** 由 Renderer 提交的精确向量维度探测请求，仅允许引用已保存的 Provider。 */
export interface ProbeApplicationProviderEmbeddingRequest {
  readonly providerId: string;
}

/** Main 使用安全凭据完成向量探测后返回的无密钥结果。 */
export interface ApplicationProviderEmbeddingProbeResult {
  readonly providerId: string;
  readonly modelId: string;
  readonly dimensions: number;
}

const PROVIDER_DRAFT_FIELDS = new Set([
  "id",
  "vendor",
  "url",
  "modelId",
  "models",
  "name",
  "managedBy",
  "source",
  "disabled",
  "apiKeyConfigured",
  "apiKey",
  "clearApiKey",
]);

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize one bounded provider string while rejecting control characters. */
function normalizeText(value: unknown, maximumLength: number, label: string): string {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  if (
    normalized.length > maximumLength
    || /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new TypeError(`Application provider ${label} is invalid.`);
  }
  return normalized;
}

/** Normalize and validate one HTTP provider base URL. */
function normalizeProviderUrl(value: unknown): string {
  const normalized = normalizeText(value, 2_048, "url");
  if (!normalized) return "";
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError("Application provider url is invalid.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol)
    || parsed.username
    || parsed.password
  ) {
    throw new TypeError("Application provider url is invalid.");
  }
  return normalized.replace(/\/+$/, "");
}

/** Normalize one provider model list into unique bounded identifiers. */
function normalizeModels(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 256) {
    throw new TypeError("Application provider models are invalid.");
  }
  const models: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const model = normalizeText(candidate, 512, "model");
    if (model && !seen.has(model)) {
      seen.add(model);
      models.push(model);
    }
  }
  return models;
}

/** Parse one exact provider draft from an untrusted IPC or migration payload. */
export function parseApplicationProviderDraft(value: unknown): ApplicationProviderDraft {
  if (!isRecord(value) || Object.keys(value).some((key) => !PROVIDER_DRAFT_FIELDS.has(key))) {
    throw new TypeError("Application provider fields are invalid.");
  }
  const id = normalizeText(value.id, 128, "id");
  if (!id) throw new TypeError("Application provider id is required.");
  const modelId = normalizeText(value.modelId, 512, "modelId");
  const models = normalizeModels(value.models ?? (modelId ? [modelId] : []));
  const apiKey = normalizeText(value.apiKey, 65_536, "apiKey");
  return {
    id,
    vendor: normalizeText(value.vendor, 128, "vendor") || "OpenAI",
    url: normalizeProviderUrl(value.url),
    modelId,
    models,
    name: normalizeText(value.name, 256, "name"),
    managedBy: normalizeText(value.managedBy, 128, "managedBy"),
    source: normalizeText(value.source, 128, "source"),
    disabled: value.disabled === true,
    apiKeyConfigured: value.apiKeyConfigured === true || Boolean(apiKey),
    ...(apiKey ? { apiKey } : {}),
    ...(value.clearApiKey === true ? { clearApiKey: true } : {}),
  };
}

/** Parse one exact provider batch replacement request. */
export function parseSaveApplicationProvidersRequest(value: unknown): SaveApplicationProvidersRequest {
  if (
    !isRecord(value)
    || Object.keys(value).length !== 1
    || !Array.isArray(value.providers)
    || value.providers.length > MAX_APPLICATION_PROVIDER_COUNT
  ) {
    throw new TypeError("Application provider save request is invalid.");
  }
  const providers = value.providers.map(parseApplicationProviderDraft);
  const ids = new Set(providers.map((provider) => provider.id));
  if (ids.size !== providers.length) {
    throw new TypeError("Application provider ids must be unique.");
  }
  return { providers };
}

/** Parse one exact provider connectivity validation request. */
export function parseValidateApplicationProviderRequest(
  value: unknown,
): ValidateApplicationProviderRequest {
  const allowedFields = new Set(["providerId", "vendor", "url", "modelId", "apiKey"]);
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedFields.has(key))) {
    throw new TypeError("Application provider validation request is invalid.");
  }
  const providerId = normalizeText(value.providerId, 128, "providerId");
  const apiKey = normalizeText(value.apiKey, 65_536, "apiKey");
  return {
    ...(providerId ? { providerId } : {}),
    vendor: normalizeText(value.vendor, 128, "vendor") || "OpenAI",
    url: normalizeProviderUrl(value.url),
    modelId: normalizeText(value.modelId, 512, "modelId"),
    ...(apiKey ? { apiKey } : {}),
  };
}

/**
 * 解析向量维度探测请求；输入为不可信 IPC 值，输出仅含规范化 Provider ID。
 * 本函数无副作用，字段漂移、空 ID 或控制字符会以 TypeError 失败。
 */
export function parseProbeApplicationProviderEmbeddingRequest(
  value: unknown,
): ProbeApplicationProviderEmbeddingRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new TypeError("Application provider embedding probe request is invalid.");
  }
  const providerId = normalizeText(value.providerId, 128, "providerId");
  if (!providerId) {
    throw new TypeError("Application provider embedding probe providerId is required.");
  }
  return { providerId };
}
