import {
  APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS,
  isApplicationConnectorCredentialPlatform,
} from "./application-connector-credentials";

/** Schema returned by the Main-owned Connector Runtime control boundary. */
export const APPLICATION_CONNECTOR_RUNTIME_SCHEMA = "openxnet.application-connector-runtime.v1";

/** Authorized IPC channels for Connector Worker runtime operations. */
export const APPLICATION_CONNECTOR_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-connector-runtime:status",
  start: "openxnet:application-connector-runtime:start",
  stop: "openxnet:application-connector-runtime:stop",
  reload: "openxnet:application-connector-runtime:reload",
  update: "openxnet:application-connector-runtime:update",
});

/** Connector Runtime operations exposed to the Desktop Renderer. */
export const APPLICATION_CONNECTOR_RUNTIME_OPERATIONS = [
  "status",
  "start",
  "stop",
  "reload",
  "update",
] as const;

/** Public Connector Runtime lifecycle states. */
export const APPLICATION_CONNECTOR_RUNTIME_STATES = [
  "unavailable",
  "stopped",
  "starting",
  "running",
  "stopping",
  "error",
] as const;

/** Maximum encoded metadata configuration accepted from Renderer. */
export const MAX_APPLICATION_CONNECTOR_RUNTIME_CONFIGURATION_BYTES = 128 * 1024;

const MAX_APPLICATION_CONNECTOR_RUNTIME_DEPTH = 8;
const MAX_APPLICATION_CONNECTOR_RUNTIME_FIELDS = 512;
const MAX_APPLICATION_CONNECTOR_RUNTIME_ARRAY_ITEMS = 256;
const MAX_APPLICATION_CONNECTOR_RUNTIME_STRING_LENGTH = 16 * 1024;

/** Runtime operation name returned in one Connector result. */
export type ApplicationConnectorRuntimeOperation = (
  typeof APPLICATION_CONNECTOR_RUNTIME_OPERATIONS
)[number];

/** Public lifecycle state returned without SDK diagnostics. */
export type ApplicationConnectorRuntimeState = (
  typeof APPLICATION_CONNECTOR_RUNTIME_STATES
)[number];

/** Bounded non-secret JSON configuration sent to Connector Worker. */
export type ApplicationConnectorRuntimeConfiguration = Readonly<Record<string, unknown>>;

/** Exact platforms controlled by Connector Worker, including separately credentialed Telegram. */
export const APPLICATION_CONNECTOR_RUNTIME_PLATFORMS = Object.freeze([
  ...APPLICATION_CONNECTOR_CREDENTIAL_PLATFORMS,
  "telegram",
] as const);

/** Platform accepted by the Connector Runtime lifecycle boundary. */
export type ApplicationConnectorRuntimePlatform =
  (typeof APPLICATION_CONNECTOR_RUNTIME_PLATFORMS)[number];

/** Exact status or stop request accepted from an authorized Renderer. */
export interface ApplicationConnectorRuntimePlatformRequest {
  readonly platform: ApplicationConnectorRuntimePlatform;
}

/** Exact start or reload request accepted from an authorized Renderer. */
export interface ApplicationConnectorRuntimeMutationRequest {
  readonly platform: ApplicationConnectorRuntimePlatform;
  readonly configuration: ApplicationConnectorRuntimeConfiguration;
}

/** Credential-free result returned for every Connector Runtime operation. */
export interface ApplicationConnectorRuntimeResult {
  readonly schema: typeof APPLICATION_CONNECTOR_RUNTIME_SCHEMA;
  readonly operation: ApplicationConnectorRuntimeOperation;
  readonly platform: ApplicationConnectorRuntimePlatform;
  readonly success: boolean;
  readonly isRunning: boolean;
  readonly status: ApplicationConnectorRuntimeState;
  readonly errorCode: "CONNECTOR_RUNTIME_UNAVAILABLE" | "CONNECTOR_RUNTIME_FAILED" | null;
  readonly retryable: boolean;
}

const APPLICATION_CONNECTOR_RUNTIME_CONFIGURATION_FIELDS: Readonly<
  Record<ApplicationConnectorRuntimePlatform, readonly string[]>
> = Object.freeze({
  qq: Object.freeze([
    "QQAgent",
    "memoryLimit",
    "appid",
    "separators",
    "reasoningVisible",
    "quickRestart",
    "is_sandbox",
    "toolMemorandumEnabled",
  ]),
  feishu: Object.freeze([
    "FeishuAgent",
    "memoryLimit",
    "appid",
    "separators",
    "reasoningVisible",
    "quickRestart",
    "enableTTS",
    "wakeWord",
    "behaviorSettings",
    "behaviorTargetChatIds",
    "toolMemorandumEnabled",
  ]),
  dingtalk: Object.freeze([
    "DingtalkAgent",
    "memoryLimit",
    "appKey",
    "separators",
    "reasoningVisible",
    "quickRestart",
    "enableTTS",
    "wakeWord",
    "behaviorSettings",
    "behaviorTargetChatIds",
    "toolMemorandumEnabled",
  ]),
  discord: Object.freeze([
    "llm_model",
    "memory_limit",
    "separators",
    "reasoning_visible",
    "quick_restart",
    "enable_tts",
    "wakeWord",
    "behaviorSettings",
    "behaviorTargetChatIds",
    "toolMemorandumEnabled",
  ]),
  slack: Object.freeze([
    "llm_model",
    "memory_limit",
    "separators",
    "reasoning_visible",
    "quick_restart",
    "enable_tts",
    "wakeWord",
    "behaviorSettings",
    "behaviorTargetChatIds",
    "toolMemorandumEnabled",
  ]),
  telegram: Object.freeze([
    "TelegramAgent",
    "memoryLimit",
    "separators",
    "reasoningVisible",
    "quickRestart",
    "enableTTS",
    "wakeWord",
    "behaviorSettings",
    "behaviorTargetChatIds",
    "toolMemorandumEnabled",
  ]),
});

/** 判断未知值是否为精确运行时平台；输入未知值，返回布尔值，无副作用且不抛出异常。 */
export function isApplicationConnectorRuntimePlatform(
  value: unknown,
): value is ApplicationConnectorRuntimePlatform {
  return isApplicationConnectorCredentialPlatform(value) || value === "telegram";
}

/** 判断未知值是否为可安全遍历的普通对象；返回布尔值，无副作用且不抛出异常。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 判断字段名是否可能承载凭据；输入字段名，返回布尔值，无副作用且不抛出异常。 */
function isSensitiveRuntimeFieldName(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ["secret", "token", "password", "credential"].some((marker) => normalized.includes(marker));
}

/** 深拷贝有界 JSON 元数据；输入值、深度和预算，返回副本，越界或疑似凭据字段时抛出 TypeError。 */
function cloneRuntimeValue(
  value: unknown,
  depth: number,
  fieldBudget: { count: number },
): unknown {
  if (depth > MAX_APPLICATION_CONNECTOR_RUNTIME_DEPTH) {
    throw new TypeError("Connector Runtime configuration nesting is invalid.");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Connector Runtime configuration number is invalid.");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > MAX_APPLICATION_CONNECTOR_RUNTIME_STRING_LENGTH) {
      throw new TypeError("Connector Runtime configuration text is too long.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_APPLICATION_CONNECTOR_RUNTIME_ARRAY_ITEMS) {
      throw new TypeError("Connector Runtime configuration array is too large.");
    }
    return value.map((item) => cloneRuntimeValue(item, depth + 1, fieldBudget));
  }
  if (!isRecord(value)) throw new TypeError("Connector Runtime configuration value is invalid.");
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    fieldBudget.count += 1;
    if (
      fieldBudget.count > MAX_APPLICATION_CONNECTOR_RUNTIME_FIELDS
      || !key
      || key.length > 128
      || ["__proto__", "prototype", "constructor"].includes(key)
      || isSensitiveRuntimeFieldName(key)
    ) {
      throw new TypeError("Connector Runtime configuration fields are invalid.");
    }
    result[key] = cloneRuntimeValue(child, depth + 1, fieldBudget);
  }
  return result;
}

/** 解析仅含平台的精确请求；输入未知值，返回规范对象，字段多余或平台无效时抛出 TypeError。 */
export function parseApplicationConnectorRuntimePlatformRequest(
  value: unknown,
): ApplicationConnectorRuntimePlatformRequest {
  if (
    !isRecord(value)
    || Object.keys(value).length !== 1
    || !isApplicationConnectorRuntimePlatform(value.platform)
  ) {
    throw new TypeError("Connector Runtime platform request is invalid.");
  }
  return { platform: value.platform };
}

/** 解析启动或重载请求；返回无密钥有界配置，字段、类型或字节预算无效时抛出 TypeError。 */
export function parseApplicationConnectorRuntimeMutationRequest(
  value: unknown,
): ApplicationConnectorRuntimeMutationRequest {
  if (
    !isRecord(value)
    || Object.keys(value).length !== 2
    || !isApplicationConnectorRuntimePlatform(value.platform)
    || !isRecord(value.configuration)
  ) {
    throw new TypeError("Connector Runtime mutation request is invalid.");
  }
  const platform = value.platform;
  const allowedFields = APPLICATION_CONNECTOR_RUNTIME_CONFIGURATION_FIELDS[platform];
  if (Object.keys(value.configuration).some((key) => !allowedFields.includes(key))) {
    throw new TypeError("Connector Runtime configuration fields are invalid.");
  }
  const configuration = cloneRuntimeValue(
    value.configuration,
    0,
    { count: 0 },
  ) as Record<string, unknown>;
  const serialized = JSON.stringify(configuration);
  if (Buffer.byteLength(serialized, "utf8") > MAX_APPLICATION_CONNECTOR_RUNTIME_CONFIGURATION_BYTES) {
    throw new TypeError("Connector Runtime configuration exceeds its byte budget.");
  }
  return { platform, configuration };
}
