import {
  APPLICATION_OLLAMA_DISCOVERY_SCHEMA,
  isLoopbackUrl,
  parseApplicationOllamaDiscoveryRequest,
  type ApplicationOllamaDiscoveryResult,
  type ApplicationOllamaModelSummary,
} from "../contracts/application-ollama-runtime";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_MODELS = 256;

/** Minimal response surface used by the bounded Ollama probe. */
export interface ApplicationOllamaFetchResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Injectable fetch signature for deterministic runtime tests. */
export type ApplicationOllamaFetch = (
  url: string,
  init: { readonly headers: Readonly<Record<string, string>>; readonly redirect: "error"; readonly signal: AbortSignal },
) => Promise<ApplicationOllamaFetchResponse>;

/** Main-owned, loopback-only Ollama discovery service. 本机 Ollama 自动发现服务。 */
export class ApplicationOllamaRuntimeService {
  private readonly fetchOllama: ApplicationOllamaFetch;
  private readonly now: () => string;

  /** Create the probe service without network activity. 创建服务但不在构造时访问网络。 */
  public constructor(options: { readonly fetch?: ApplicationOllamaFetch; readonly now?: () => string } = {}) {
    this.fetchOllama = options.fetch ?? (globalThis.fetch as unknown as ApplicationOllamaFetch);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  /** Probe Ollama version and model tags; failures become a sanitized offline result. 探测版本和模型并脱敏失败。 */
  public async discover(value: unknown): Promise<ApplicationOllamaDiscoveryResult> {
    const request = parseApplicationOllamaDiscoveryRequest(value);
    const baseUrl = request.baseUrl || DEFAULT_OLLAMA_BASE_URL;
    if (!isLoopbackUrl(baseUrl)) throw new TypeError("Ollama discovery only permits a loopback URL.");
    const checkedAt = this.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const versionResponse = await this.request(baseUrl, "/api/version", controller.signal);
      const versionPayload = await this.readJson(versionResponse);
      const version = readBoundedString(versionPayload, "version", 128);
      const tagsResponse = await this.request(baseUrl, "/api/tags", controller.signal);
      const tagsPayload = await this.readJson(tagsResponse);
      const models = readModels(tagsPayload);
      return {
        schema: APPLICATION_OLLAMA_DISCOVERY_SCHEMA,
        status: "ready",
        baseUrl,
        version,
        models,
        checkedAt,
      };
    } catch (error) {
      const status = error instanceof Error && error.message === "Ollama discovery response was rejected." ? "blocked" : "offline";
      return {
        schema: APPLICATION_OLLAMA_DISCOVERY_SCHEMA,
        status,
        baseUrl,
        version: null,
        models: [],
        checkedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Issue one bounded GET against an already validated loopback URL. 发出有界本机请求。 */
  private async request(baseUrl: string, endpoint: string, signal: AbortSignal): Promise<ApplicationOllamaFetchResponse> {
    const response = await this.fetchOllama(`${baseUrl}${endpoint}`, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal,
    });
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES || response.status < 200 || response.status >= 300) {
      throw new Error("Ollama discovery response was rejected.");
    }
    return response;
  }

  /** Read one bounded JSON response. 读取有界 JSON 响应。 */
  private async readJson(response: ApplicationOllamaFetchResponse): Promise<unknown> {
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > MAX_RESPONSE_BYTES) throw new Error("Ollama discovery response was rejected.");
    try {
      return JSON.parse(body.toString("utf8")) as unknown;
    } catch {
      throw new Error("Ollama discovery response was rejected.");
    }
  }
}

/** Read a bounded version field from a JSON object. 读取版本字段。 */
function readBoundedString(value: unknown, field: string, maximum: number): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[field];
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  return normalized && normalized.length <= maximum && !/[\u0000-\u001F\u007F]/.test(normalized) ? normalized : null;
}

/** Parse and sanitize the Ollama tags model list. 解析并脱敏模型列表。 */
function readModels(value: unknown): readonly ApplicationOllamaModelSummary[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const rawModels = (value as Record<string, unknown>).models;
  if (!Array.isArray(rawModels)) return [];
  const models: ApplicationOllamaModelSummary[] = [];
  const seen = new Set<string>();
  for (const raw of rawModels.slice(0, MAX_MODELS)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name || name.length > 512 || /[\u0000-\u001F\u007F]/.test(name) || seen.has(name)) continue;
    seen.add(name);
    const sizeBytes = typeof record.size === "number" && Number.isSafeInteger(record.size) && record.size >= 0 ? record.size : null;
    const modifiedAt = typeof record.modified_at === "string" && record.modified_at.length <= 128 ? record.modified_at : null;
    const digest = typeof record.digest === "string" && /^[a-f0-9]{8,128}$/i.test(record.digest) ? record.digest : null;
    models.push({ name, sizeBytes, modifiedAt, digest });
  }
  return models;
}
