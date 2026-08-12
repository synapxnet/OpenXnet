/** Agent 与 A2A 管理边界使用的固定 IPC channel。 */
export const APPLICATION_AGENT_RUNTIME_CHANNELS = Object.freeze({
  createAgent: "openxnet:application-agent-runtime:create-agent",
  removeAgent: "openxnet:application-agent-runtime:remove-agent",
  inspectA2a: "openxnet:application-agent-runtime:inspect-a2a",
});

/** Agent Runtime 公开结果 schema。 */
export const APPLICATION_AGENT_RUNTIME_SCHEMA = "openxnet.application-agent-runtime.v1" as const;

/** Renderer 创建 Agent 时允许提交的精确字段。 */
export interface CreateApplicationAgentRequest {
  readonly name: string;
  readonly systemPrompt: string;
}

/** Renderer 删除 Agent 时允许提交的稳定 ID。 */
export interface RemoveApplicationAgentRequest {
  readonly agentId: string;
}

/** Renderer 探测 A2A Agent Card 时允许提交的端点。 */
export interface InspectApplicationA2aRequest {
  readonly url: string;
}

/** 不包含 Main 私有快照路径的 Agent 公开元数据。 */
export interface ApplicationAgentMetadata {
  readonly id: string;
  readonly name: string;
  readonly systemPrompt: string;
  readonly enabled: boolean;
}

/** Agent 创建或删除完成后的固定结果。 */
export interface ApplicationAgentMutationResult {
  readonly schema: typeof APPLICATION_AGENT_RUNTIME_SCHEMA;
  readonly action: "created" | "removed";
  readonly agentId: string;
  readonly agent: ApplicationAgentMetadata | null;
}

/** A2A 卡片中可公开展示的单个技能。 */
export interface ApplicationA2aSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly examples: readonly string[];
}

/** A2A 探测返回的有界公开卡片。 */
export interface ApplicationA2aInspectionResult {
  readonly schema: typeof APPLICATION_AGENT_RUNTIME_SCHEMA;
  readonly url: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly skills: readonly ApplicationA2aSkill[];
  readonly status: "ready";
  readonly enabled: true;
}

/**
 * 解析 Agent 创建请求；输入不可信 IPC 值，输出规范化名称和提示词。
 * 本函数无副作用，缺失、超限、控制字符或额外字段会以 TypeError 失败。
 */
export function parseCreateApplicationAgentRequest(value: unknown): CreateApplicationAgentRequest {
  const record = requireExactRecord(value, ["name", "systemPrompt"], "create request");
  return {
    name: requireText(record.name, "name", 256, false),
    systemPrompt: requireText(record.systemPrompt, "systemPrompt", 128 * 1024, true),
  };
}

/**
 * 解析 Agent 删除请求；输入不可信 IPC 值，输出稳定 ID。
 * 本函数无副作用，非法 ID 或额外字段会以 TypeError 失败。
 */
export function parseRemoveApplicationAgentRequest(value: unknown): RemoveApplicationAgentRequest {
  const record = requireExactRecord(value, ["agentId"], "remove request");
  const agentId = requireText(record.agentId, "agentId", 128, false);
  if (!/^[A-Za-z0-9_-]+$/.test(agentId)) {
    throw new TypeError("Application Agent field 'agentId' is invalid.");
  }
  return { agentId };
}

/**
 * 解析 A2A 探测请求；输入不可信 IPC 值，输出无凭据规范化 URL。
 * 本函数无副作用，非 HTTPS 的远程地址、凭据、查询、片段或额外字段会以 TypeError 失败。
 */
export function parseInspectApplicationA2aRequest(value: unknown): InspectApplicationA2aRequest {
  const record = requireExactRecord(value, ["url"], "A2A inspect request");
  const rawUrl = requireText(record.url, "url", 2_048, false);
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new TypeError("Application A2A URL is invalid.", { cause: error });
  }
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new TypeError("Application A2A URL is not allowed.");
  }
  return { url: parsed.toString().replace(/\/+$/, "") };
}

/** 校验精确对象；输入未知值、字段和标签，输出记录，类型或字段漂移时抛出 TypeError。 */
function requireExactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Application Agent ${label} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw new TypeError(`Application Agent ${label} fields are invalid.`);
  }
  return record;
}

/** 校验文本；输入未知值、字段、长度和可空标记，输出规范文本，非法时抛出 TypeError。 */
function requireText(
  value: unknown,
  field: string,
  maximumLength: number,
  allowEmpty: boolean,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`Application Agent field '${field}' must be text.`);
  }
  const normalized = value.trim();
  if (
    (!allowEmpty && !normalized)
    || normalized.length > maximumLength
    || /[\u0000\u007F]/.test(normalized)
  ) {
    throw new TypeError(`Application Agent field '${field}' is invalid.`);
  }
  return normalized;
}
