import {
  APPLICATION_VRM_PRESENTATION_CHANNELS,
  type ApplicationVrmPresentationEvent,
  type ApplicationVrmPresentationEventType,
  type ApplicationVrmPresentationConfiguration,
  type ApplicationVrmPresentationPublishResult,
  type ApplicationVrmPresentationStatus,
} from "../contracts/application-vrm-presentation-runtime";

/** Main 可接收 VRM 展示事件的最小 WebContents 能力。 */
export interface ApplicationVrmPresentationTarget {
  send(channel: string, event: ApplicationVrmPresentationEvent): void;
}

/** VRM Presentation Runtime 的窗口查询和时间依赖。 */
export interface ApplicationVrmPresentationRuntimeOptions {
  readonly getTargets: () => readonly ApplicationVrmPresentationTarget[];
  readonly readConfiguration?: () => Promise<unknown> | unknown;
  readonly now?: () => number;
}

/** 校验后可广播的 VRM 展示事件。 */
interface ParsedPresentationRequest {
  readonly type: ApplicationVrmPresentationEventType;
  readonly data: Readonly<Record<string, unknown>>;
}

/** 在 Main 内广播有界 TTS 展示事件，替代 Desktop Python WebSocket 中转。 */
export class ApplicationVrmPresentationRuntimeService {
  private readonly now: () => number;

  /** 创建不持有窗口引用的展示服务；每次调用都读取当前有效目标。 */
  public constructor(private readonly options: ApplicationVrmPresentationRuntimeOptions) {
    this.now = options.now ?? Date.now;
  }

  /** 返回当前 VRM 窗口数量；无输入、副作用或 Python 激活。 */
  public getStatus(): ApplicationVrmPresentationStatus {
    return { connections: this.options.getTargets().length };
  }

  /** 读取并复制 Main 组合的 VRM 配置；无配置源、结构漂移或超过 4 MiB 时失败。 */
  public async getConfiguration(): Promise<ApplicationVrmPresentationConfiguration> {
    if (typeof this.options.readConfiguration !== "function") {
      throw new Error("Desktop VRM configuration is unavailable.");
    }
    const value = await this.options.readConfiguration();
    if (!this.isRecord(value) || !this.hasExactFields(value, ["language", "vrmConfig"]) || !this.isRecord(value.vrmConfig)) {
      throw new TypeError("Desktop VRM configuration is invalid.");
    }
    const language = this.parsePublicText(value.language, 32, "language");
    const serialized = JSON.stringify(value.vrmConfig);
    if (Buffer.byteLength(serialized, "utf8") > 4 * 1024 * 1024) {
      throw new RangeError("Desktop VRM configuration exceeds its size budget.");
    }
    const vrmConfig = JSON.parse(serialized) as unknown;
    if (!this.isRecord(vrmConfig)) {
      throw new TypeError("Desktop VRM configuration is invalid.");
    }
    return { language, vrmConfig };
  }

  /** 校验并广播一条 TTS 展示事件；单个窗口失败不阻断其他窗口。 */
  public publish(request: unknown): ApplicationVrmPresentationPublishResult {
    const parsed = this.parseRequest(request);
    const event: ApplicationVrmPresentationEvent = {
      ...parsed,
      timestamp: this.now(),
    };
    let delivered = 0;
    for (const target of this.options.getTargets()) {
      try {
        target.send(APPLICATION_VRM_PRESENTATION_CHANNELS.event, event);
        delivered += 1;
      } catch {
        continue;
      }
    }
    return { delivered };
  }

  /** 解析精确事件请求，并按事件类型选择对应的固定数据结构。 */
  private parseRequest(request: unknown): ParsedPresentationRequest {
    if (!this.isRecord(request) || !this.hasExactFields(request, ["type", "data"]) || !this.isRecord(request.data)) {
      throw new TypeError("Desktop VRM presentation request is invalid.");
    }
    const type = request.type;
    if (typeof type !== "string" || !this.isEventType(type)) {
      throw new TypeError("Desktop VRM presentation type is invalid.");
    }
    if (["stopSpeaking", "pauseSpeaking", "resumeSpeaking", "allChunksCompleted"].includes(type)) {
      this.assertExactData(request.data, []);
      return { type, data: {} };
    }
    if (type === "ttsStarted") {
      this.assertAllowedData(request.data, ["totalChunks"]);
      const totalChunks = request.data.totalChunks;
      return totalChunks === undefined
        ? { type, data: {} }
        : { type, data: { totalChunks: this.parseIndex(totalChunks, "totalChunks") } };
    }
    if (type === "chunkEnded") {
      this.assertExactData(request.data, ["chunkIndex"]);
      return { type, data: { chunkIndex: this.parseIndex(request.data.chunkIndex, "chunkIndex") } };
    }
    if (type === "omniStreaming") {
      this.assertExactData(request.data, ["audioData", "text", "sampleRate", "timestamp"]);
      return {
        type,
        data: {
          audioData: this.parseAudioText(request.data.audioData, 8 * 1024 * 1024, "audioData"),
          text: this.parsePublicText(request.data.text, 100_000, "text", true),
          sampleRate: this.parseRange(request.data.sampleRate, 8_000, 192_000, "sampleRate"),
          timestamp: this.parseTimestamp(request.data.timestamp),
        },
      };
    }
    this.assertExactData(
      request.data,
      ["audioDataUrl", "chunkIndex", "totalChunks", "text", "expressions", "voice"],
    );
    const expressions = request.data.expressions;
    if (!Array.isArray(expressions) || expressions.length > 64) {
      throw new TypeError("Desktop VRM expressions are invalid.");
    }
    return {
      type,
      data: {
        audioDataUrl: this.parseAudioText(request.data.audioDataUrl, 36 * 1024 * 1024, "audioDataUrl"),
        chunkIndex: this.parseIndex(request.data.chunkIndex, "chunkIndex"),
        totalChunks: this.parseIndex(request.data.totalChunks, "totalChunks"),
        text: this.parsePublicText(request.data.text, 100_000, "text", true),
        expressions: expressions.map((value) => this.parsePublicText(value, 128, "expression")),
        voice: this.parsePublicText(request.data.voice, 128, "voice"),
      },
    };
  }

  /** 判断未知字符串是否为固定 VRM 展示事件类型。 */
  private isEventType(value: string): value is ApplicationVrmPresentationEventType {
    return [
      "ttsStarted",
      "omniStreaming",
      "startSpeaking",
      "stopSpeaking",
      "pauseSpeaking",
      "resumeSpeaking",
      "chunkEnded",
      "allChunksCompleted",
    ].includes(value);
  }

  /** 断言数据对象只包含指定字段，缺失或额外字段均失败。 */
  private assertExactData(value: Record<string, unknown>, fields: readonly string[]): void {
    if (!this.hasExactFields(value, fields)) {
      throw new TypeError("Desktop VRM presentation data is invalid.");
    }
  }

  /** 断言数据对象不包含白名单外字段，允许白名单字段缺省。 */
  private assertAllowedData(value: Record<string, unknown>, fields: readonly string[]): void {
    if (Object.keys(value).some((field) => !fields.includes(field))) {
      throw new TypeError("Desktop VRM presentation data is invalid.");
    }
  }

  /** 读取 0 到 10000 的整数索引或计数，布尔值与小数均失败。 */
  private parseIndex(value: unknown, fieldName: string): number {
    return this.parseRange(value, 0, 10_000, fieldName);
  }

  /** 读取指定闭区间的整数；失败时不回显原值。 */
  private parseRange(value: unknown, minimum: number, maximum: number, fieldName: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(`Desktop VRM ${fieldName} is invalid.`);
    }
    return value;
  }

  /** 读取合理的毫秒时间戳；只用于保留音频块原始调度时间。 */
  private parseTimestamp(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10 ** 16) {
      throw new RangeError("Desktop VRM timestamp is invalid.");
    }
    return value;
  }

  /** 读取有界音频字符串并拒绝控制字符；允许 Base64 或 data URL，不解析内容。 */
  private parseAudioText(value: unknown, maximumLength: number, fieldName: string): string {
    return this.parsePublicText(value, maximumLength, fieldName);
  }

  /** 读取有界公开文本；可选允许空文本，控制字符仅保留换行和制表符。 */
  private parsePublicText(
    value: unknown,
    maximumLength: number,
    fieldName: string,
    allowEmpty = false,
  ): string {
    if (typeof value !== "string") {
      throw new TypeError(`Desktop VRM ${fieldName} is invalid.`);
    }
    if (
      (!allowEmpty && !value)
      || value.length > maximumLength
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)
    ) {
      throw new TypeError(`Desktop VRM ${fieldName} is invalid.`);
    }
    return value;
  }

  /** 判断未知值是否为可检查的非数组对象。 */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /** 判断对象是否只包含完整的预期字段集合。 */
  private hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...fields].sort();
    return actual.length === expected.length
      && actual.every((field, index) => field === expected[index]);
  }
}
