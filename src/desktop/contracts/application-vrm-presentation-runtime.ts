/** Desktop VRM 展示状态、事件发布和 Main 广播使用的固定 IPC 通道。 */
export const APPLICATION_VRM_PRESENTATION_CHANNELS = {
  status: "openxnet:application-vrm-presentation:status",
  publish: "openxnet:application-vrm-presentation:publish",
  configuration: "openxnet:application-vrm-presentation:configuration",
  event: "openxnet:application-vrm-presentation:event",
} as const;

/** Renderer 可发布的固定 VRM TTS 展示事件类型。 */
export type ApplicationVrmPresentationEventType =
  | "ttsStarted"
  | "omniStreaming"
  | "startSpeaking"
  | "stopSpeaking"
  | "pauseSpeaking"
  | "resumeSpeaking"
  | "chunkEnded"
  | "allChunksCompleted";

/** Renderer 发布的一条有界 VRM 展示事件，不允许自定义频道或时间戳。 */
export interface ApplicationVrmPresentationPublishRequest {
  readonly type: ApplicationVrmPresentationEventType;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Main 广播给 VRM 窗口的规范事件，时间戳由 Main 生成。 */
export interface ApplicationVrmPresentationEvent {
  readonly type: ApplicationVrmPresentationEventType;
  readonly data: Readonly<Record<string, unknown>>;
  readonly timestamp: number;
}

/** Main 返回的 VRM 窗口连接数，不触发后端或 Worker。 */
export interface ApplicationVrmPresentationStatus {
  readonly connections: number;
}

/** Main 返回的一次展示事件投递数量。 */
export interface ApplicationVrmPresentationPublishResult {
  readonly delivered: number;
}

/** Main 返回给受信任 VRM 窗口的语言和公开资产配置快照。 */
export interface ApplicationVrmPresentationConfiguration {
  readonly language: string;
  readonly vrmConfig: Readonly<Record<string, unknown>>;
}

/** Renderer 订阅 VRM 展示事件时使用的回调。 */
export type ApplicationVrmPresentationListener = (
  event: ApplicationVrmPresentationEvent,
) => void;
