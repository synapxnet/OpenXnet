/** Ollama 本机发现 IPC 通道。 Ollama local discovery IPC channels. */
export const APPLICATION_OLLAMA_RUNTIME_CHANNELS = Object.freeze({
  discover: "openxnet:application-ollama-runtime:discover",
});

/** Ollama 发现结果 schema。 Stable discovery result schema. */
export const APPLICATION_OLLAMA_DISCOVERY_SCHEMA = "openxnet.ollama-discovery.v1" as const;

export type ApplicationOllamaDiscoveryStatus = "ready" | "offline" | "blocked";

/** Renderer 可见的 Ollama 模型摘要，不包含路径或凭据。 Public Ollama model summary. */
export interface ApplicationOllamaModelSummary {
  readonly name: string;
  readonly sizeBytes: number | null;
  readonly modifiedAt: string | null;
  readonly digest: string | null;
}

/** Ollama 本机发现结果。 Ollama local discovery result. */
export interface ApplicationOllamaDiscoveryResult {
  readonly schema: typeof APPLICATION_OLLAMA_DISCOVERY_SCHEMA;
  readonly status: ApplicationOllamaDiscoveryStatus;
  readonly baseUrl: string;
  readonly version: string | null;
  readonly models: readonly ApplicationOllamaModelSummary[];
  readonly checkedAt: string;
}

/** 发现请求只允许 loopback 地址；省略时使用 Ollama 默认地址。 Discovery request limited to loopback. */
export interface ApplicationOllamaDiscoveryRequest {
  readonly baseUrl?: string;
}

const REQUEST_FIELDS = new Set(["baseUrl"]);

/** 解析 Ollama 发现请求；拒绝远程地址、凭据和额外字段。 Parse a safe loopback-only request. */
export function parseApplicationOllamaDiscoveryRequest(value: unknown): ApplicationOllamaDiscoveryRequest {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Ollama discovery request is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !REQUEST_FIELDS.has(key))) {
    throw new TypeError("Ollama discovery request fields are invalid.");
  }
  if (record.baseUrl === undefined) return {};
  if (typeof record.baseUrl !== "string" || record.baseUrl.length > 256 || /[\u0000-\u001F\u007F]/.test(record.baseUrl)) {
    throw new TypeError("Ollama discovery baseUrl is invalid.");
  }
  const baseUrl = record.baseUrl.trim().replace(/\/+$/, "");
  if (!isLoopbackUrl(baseUrl)) throw new TypeError("Ollama discovery only permits a loopback URL.");
  return { baseUrl };
}

/** Determine whether a URL targets a local Ollama listener. Determine a safe local endpoint. */
export function isLoopbackUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol)
      && !parsed.username
      && !parsed.password
      && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)
      && !parsed.pathname.includes("..")
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}
