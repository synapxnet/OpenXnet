/** Live Runtime 生命周期和事件通道。 */
export const APPLICATION_LIVE_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-live-runtime:status",
  start: "openxnet:application-live-runtime:start",
  stop: "openxnet:application-live-runtime:stop",
  reload: "openxnet:application-live-runtime:reload",
  event: "openxnet:application-live-runtime:event",
});

/** Live Runtime 公开结果协议。 */
export const APPLICATION_LIVE_RUNTIME_SCHEMA = "openxnet.application-live-runtime.v1" as const;

/** Live Runtime 公开事件协议。 */
export const APPLICATION_LIVE_EVENT_SCHEMA = "openxnet.application-live-event.v1" as const;

/** Renderer 可提交的无密钥直播字段。 */
export const APPLICATION_LIVE_RUNTIME_CONFIGURATION_FIELDS = Object.freeze([
  "bilibili_enabled",
  "bilibili_type",
  "bilibili_room_id",
  "bilibili_ACCESS_KEY_ID",
  "bilibili_APP_ID",
  "youtube_enabled",
  "youtube_video_id",
  "twitch_enabled",
  "twitch_channel",
] as const);

/** Live Runtime 生命周期操作。 */
export type ApplicationLiveRuntimeOperation = "status" | "start" | "stop" | "reload";

/** Live Runtime 公开状态。 */
export type ApplicationLiveRuntimeState =
  | "unavailable"
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

/** 经过校验的无密钥直播配置。 */
export type ApplicationLiveRuntimeConfiguration = Readonly<Record<string, boolean | string>>;

/** 启动和重载请求。 */
export interface ApplicationLiveRuntimeMutationRequest {
  readonly configuration: ApplicationLiveRuntimeConfiguration;
}

/** 三个平台的无凭据运行标志。 */
export interface ApplicationLiveRuntimeDetails {
  readonly bilibili: boolean;
  readonly youtube: boolean;
  readonly twitch: boolean;
}

/** Renderer 可见的固定生命周期结果。 */
export interface ApplicationLiveRuntimeResult {
  readonly schema: typeof APPLICATION_LIVE_RUNTIME_SCHEMA;
  readonly operation: ApplicationLiveRuntimeOperation;
  readonly success: boolean;
  readonly isRunning: boolean;
  readonly status: ApplicationLiveRuntimeState;
  readonly details: ApplicationLiveRuntimeDetails;
  readonly errorCode: "LIVE_RUNTIME_UNAVAILABLE" | "LIVE_RUNTIME_FAILED" | null;
  readonly retryable: boolean;
}

/** Renderer 可见的有界直播事件。 */
export interface ApplicationLiveRuntimeEvent {
  readonly schema: typeof APPLICATION_LIVE_EVENT_SCHEMA;
  readonly id: string;
  readonly type: "message" | "error";
  readonly content: string;
  readonly danmuType: string;
  readonly platform: "bilibili" | "youtube" | "twitch";
}

/** Renderer 直播事件订阅函数。 */
export type ApplicationLiveRuntimeEventListener = (event: ApplicationLiveRuntimeEvent) => void;

/** 判断未知值是否为普通对象；输入未知值，返回布尔值，无副作用且不抛出异常。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取有界字符串；输入值、字段和长度，返回去空白文本，类型或超限时抛出 TypeError。 */
function requireBoundedText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") throw new TypeError(`Live Runtime field '${field}' is invalid.`);
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new TypeError(`Live Runtime field '${field}' is invalid.`);
  }
  return normalized;
}

/** 解析启动或重载配置；输入未知请求，返回无密钥副本，额外字段、错误类型或超预算时抛出 TypeError。 */
export function parseApplicationLiveRuntimeMutationRequest(
  value: unknown,
): ApplicationLiveRuntimeMutationRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !isRecord(value.configuration)) {
    throw new TypeError("Live Runtime mutation request is invalid.");
  }
  const configuration: Record<string, boolean | string> = {};
  for (const [field, candidate] of Object.entries(value.configuration)) {
    if (!APPLICATION_LIVE_RUNTIME_CONFIGURATION_FIELDS.some((allowed) => allowed === field)) {
      throw new TypeError("Live Runtime configuration fields are invalid.");
    }
    if (field.endsWith("_enabled")) {
      if (typeof candidate !== "boolean") {
        throw new TypeError("Live Runtime configuration value is invalid.");
      }
      configuration[field] = candidate;
      continue;
    }
    const text = requireBoundedText(candidate, field, 4_096);
    if (field === "bilibili_type" && !["web", "open"].includes(text)) {
      throw new TypeError("Live Runtime Bilibili type is invalid.");
    }
    configuration[field] = text;
  }
  if (Buffer.byteLength(JSON.stringify(configuration), "utf8") > 128 * 1024) {
    throw new TypeError("Live Runtime configuration exceeds its byte budget.");
  }
  return { configuration };
}

/** 解析 Worker 直播事件；输入不可信载荷，返回公开事件，字段缺失、额外或超限时抛出 TypeError。 */
export function parseApplicationLiveRuntimeEvent(
  value: unknown,
): ApplicationLiveRuntimeEvent {
  if (
    !isRecord(value)
    || Object.keys(value).some((field) => !["id", "type", "content", "danmu_type", "platform"].includes(field))
  ) {
    throw new TypeError("Live Runtime event fields are invalid.");
  }
  const id = requireBoundedText(value.id, "id", 128);
  const type = requireBoundedText(value.type, "type", 16);
  const content = requireBoundedText(value.content, "content", 16 * 1024);
  const danmuType = requireBoundedText(value.danmu_type, "danmu_type", 128);
  const platform = requireBoundedText(value.platform, "platform", 32);
  if (
    !id
    || !content
    || !["message", "error"].includes(type)
    || !["bilibili", "youtube", "twitch"].includes(platform)
  ) {
    throw new TypeError("Live Runtime event is invalid.");
  }
  return {
    schema: APPLICATION_LIVE_EVENT_SCHEMA,
    id,
    type: type as ApplicationLiveRuntimeEvent["type"],
    content,
    danmuType,
    platform: platform as ApplicationLiveRuntimeEvent["platform"],
  };
}
