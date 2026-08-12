import type { DesktopCore } from "../core/desktop-core";
import {
  APPLICATION_DESKTOP_CONTROL_ACTION_SCHEMA,
  APPLICATION_DESKTOP_CONTROL_ACTIVE_WINDOW_SCHEMA,
  APPLICATION_DESKTOP_CONTROL_HISTORY_SCHEMA,
  APPLICATION_DESKTOP_CONTROL_MONITORS_SCHEMA,
  APPLICATION_DESKTOP_CONTROL_WINDOWS_SCHEMA,
  parseApplicationDesktopControlActionRequest,
  parseApplicationDesktopControlHistoryRequest,
  parseApplicationDesktopControlWindowListRequest,
  type ApplicationDesktopControlAction,
  type ApplicationDesktopControlActionResult,
  type ApplicationDesktopControlActiveWindowResult,
  type ApplicationDesktopControlHistoryItem,
  type ApplicationDesktopControlHistoryResult,
  type ApplicationDesktopControlMonitor,
  type ApplicationDesktopControlMonitorListResult,
  type ApplicationDesktopControlRect,
  type ApplicationDesktopControlWindow,
  type ApplicationDesktopControlWindowListResult,
} from "../contracts/application-desktop-control-runtime";
import type { WorkerSupervisor } from "../workers/worker-supervisor";

const MAX_DESKTOP_WINDOWS = 100;
const MAX_DESKTOP_MONITORS = 64;
const MAX_DESKTOP_HISTORY_ITEMS = 40;

/** Desktop Control Runtime 固定诊断接口。 */
export interface ApplicationDesktopControlRuntimeLogger {
  warn(message: string): void;
}

/** Desktop Control Runtime 服务依赖。 */
export interface ApplicationDesktopControlRuntimeServiceOptions {
  readonly core: Pick<DesktopCore, "ensureCapability">;
  readonly supervisor: Pick<WorkerSupervisor, "request">;
  readonly logger?: ApplicationDesktopControlRuntimeLogger;
}

/** Main 持有的 Desktop 窗口控制 Worker 边界。 */
export class ApplicationDesktopControlRuntimeService {
  private readonly logger: ApplicationDesktopControlRuntimeLogger;

  /** 创建 Runtime；输入 Core、Worker 和日志依赖，无返回，不提前激活 Worker。 */
  public constructor(private readonly options: ApplicationDesktopControlRuntimeServiceOptions) {
    this.logger = options.logger ?? console;
  }

  /** 列出窗口；输入有界筛选，返回脱敏窗口元数据，失败时抛出固定错误。 */
  public async listWindows(value: unknown = {}): Promise<ApplicationDesktopControlWindowListResult> {
    const request = parseApplicationDesktopControlWindowListRequest(value);
    const payload = await this.request("desktop_control.list_windows", {
      titleQuery: request.titleQuery,
      includeHidden: request.includeHidden,
      includeMinimized: request.includeMinimized,
      limit: request.limit,
    });
    return parseWindowListResult(payload);
  }

  /** 列出显示器；无输入，返回有界显示器元数据，失败时抛出固定错误。 */
  public async listMonitors(): Promise<ApplicationDesktopControlMonitorListResult> {
    return parseMonitorListResult(await this.request("desktop_control.list_monitors", {}));
  }

  /** 读取当前活动窗口；无输入，返回脱敏状态，失败时抛出固定错误。 */
  public async getActiveWindow(): Promise<ApplicationDesktopControlActiveWindowResult> {
    return parseActiveWindowResult(await this.request("desktop_control.get_active_window", {}));
  }

  /** 列出当前 Worker 的动作历史；输入有界数量，返回有界历史，失败时抛出固定错误。 */
  public async listHistory(value: unknown = {}): Promise<ApplicationDesktopControlHistoryResult> {
    const request = parseApplicationDesktopControlHistoryRequest(value);
    return parseHistoryResult(await this.request("desktop_control.list_history", { limit: request.limit }));
  }

  /** 执行窗口动作；输入精确动作请求，返回脱敏窗口结果，校验失败时不激活 Worker。 */
  public async executeAction(value: unknown): Promise<ApplicationDesktopControlActionResult> {
    const request = parseApplicationDesktopControlActionRequest(value);
    return parseActionResult(await this.request("desktop_control.execute_action", {
      action: request.action,
      hwnd: request.hwnd,
      payload: request.payload,
    }));
  }

  /** 请求 Desktop Control Worker；输入方法和载荷，返回未知响应，内部错误统一脱敏。 */
  private async request(
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    try {
      await this.options.core.ensureCapability("desktop-control");
      return await this.options.supervisor.request("desktop-control", method, payload);
    } catch {
      this.logger.warn(`Desktop Control Runtime request '${method}' failed with a private runtime error.`);
      throw new Error("Desktop control runtime is unavailable.");
    }
  }
}

/** 解析窗口列表响应；输入 Worker 载荷，返回有界脱敏列表，字段漂移时抛出固定错误。 */
function parseWindowListResult(value: unknown): ApplicationDesktopControlWindowListResult {
  const record = requireExactResponse(value, ["schema", "count", "windows"]);
  if (record.schema !== APPLICATION_DESKTOP_CONTROL_WINDOWS_SCHEMA || !Array.isArray(record.windows)) {
    throw new Error("Desktop control window list response is invalid.");
  }
  const windows = record.windows.slice(0, MAX_DESKTOP_WINDOWS).map(parseWindow);
  if (record.count !== windows.length || record.windows.length !== windows.length) {
    throw new Error("Desktop control window list count is invalid.");
  }
  return { schema: APPLICATION_DESKTOP_CONTROL_WINDOWS_SCHEMA, count: windows.length, windows };
}

/** 解析显示器列表响应；输入 Worker 载荷，返回有界列表，字段漂移时抛出固定错误。 */
function parseMonitorListResult(value: unknown): ApplicationDesktopControlMonitorListResult {
  const record = requireExactResponse(value, ["schema", "count", "monitors"]);
  if (record.schema !== APPLICATION_DESKTOP_CONTROL_MONITORS_SCHEMA || !Array.isArray(record.monitors)) {
    throw new Error("Desktop control monitor list response is invalid.");
  }
  const monitors = record.monitors.slice(0, MAX_DESKTOP_MONITORS).map(parseMonitor);
  if (record.count !== monitors.length || record.monitors.length !== monitors.length) {
    throw new Error("Desktop control monitor list count is invalid.");
  }
  return { schema: APPLICATION_DESKTOP_CONTROL_MONITORS_SCHEMA, count: monitors.length, monitors };
}

/** 解析活动窗口响应；输入 Worker 载荷，返回固定状态，路径或额外字段时抛出固定错误。 */
function parseActiveWindowResult(value: unknown): ApplicationDesktopControlActiveWindowResult {
  const record = requireExactResponse(
    value,
    ["schema", "found", "supported", "detectedAt", "reason", "window"],
  );
  if (
    record.schema !== APPLICATION_DESKTOP_CONTROL_ACTIVE_WINDOW_SCHEMA
    || typeof record.found !== "boolean"
    || typeof record.supported !== "boolean"
    || record.found !== (record.window !== null)
  ) {
    throw new Error("Desktop control active-window response is invalid.");
  }
  return {
    schema: APPLICATION_DESKTOP_CONTROL_ACTIVE_WINDOW_SCHEMA,
    found: record.found,
    supported: record.supported,
    detectedAt: requireText(record.detectedAt, "detectedAt", 128),
    reason: requireText(record.reason, "reason", 512, true),
    window: record.window === null ? null : parseWindow(record.window),
  };
}

/** 解析动作历史响应；输入 Worker 载荷，返回有界历史，计数或字段漂移时抛出固定错误。 */
function parseHistoryResult(value: unknown): ApplicationDesktopControlHistoryResult {
  const record = requireExactResponse(value, ["schema", "count", "items", "generatedAt"]);
  if (record.schema !== APPLICATION_DESKTOP_CONTROL_HISTORY_SCHEMA || !Array.isArray(record.items)) {
    throw new Error("Desktop control history response is invalid.");
  }
  const items = record.items.slice(0, MAX_DESKTOP_HISTORY_ITEMS).map(parseHistoryItem);
  if (record.count !== items.length || record.items.length !== items.length) {
    throw new Error("Desktop control history count is invalid.");
  }
  return {
    schema: APPLICATION_DESKTOP_CONTROL_HISTORY_SCHEMA,
    count: items.length,
    items,
    generatedAt: requireText(record.generatedAt, "generatedAt", 128),
  };
}

/** 解析动作响应；输入 Worker 载荷，返回固定动作结果，字段漂移时抛出固定错误。 */
function parseActionResult(value: unknown): ApplicationDesktopControlActionResult {
  const record = requireExactResponse(value, ["schema", "success", "action", "window", "monitor", "position"]);
  if (record.schema !== APPLICATION_DESKTOP_CONTROL_ACTION_SCHEMA || record.success !== true) {
    throw new Error("Desktop control action response is invalid.");
  }
  return {
    schema: APPLICATION_DESKTOP_CONTROL_ACTION_SCHEMA,
    success: true,
    action: parseAction(record.action),
    window: parseWindow(record.window),
    monitor: record.monitor === null ? null : parseMonitor(record.monitor),
    position: requireText(record.position, "position", 32, true),
  };
}

/** 解析历史项；输入未知值，返回固定公开记录，超长或额外字段时抛出固定错误。 */
function parseHistoryItem(value: unknown): ApplicationDesktopControlHistoryItem {
  const record = requireExactResponse(value, [
    "id",
    "title",
    "summary",
    "status",
    "statusLabel",
    "action",
    "actionLabel",
    "hwnd",
    "window",
    "monitor",
    "position",
    "timestamp",
  ]);
  if (!(["completed", "failed"] as const).includes(record.status as "completed" | "failed")) {
    throw new Error("Desktop control history status is invalid.");
  }
  return {
    id: requireText(record.id, "id", 256),
    title: requireText(record.title, "title", 512),
    summary: requireText(record.summary, "summary", 2_048),
    status: record.status as "completed" | "failed",
    statusLabel: requireText(record.statusLabel, "statusLabel", 64),
    action: parseAction(record.action),
    actionLabel: requireText(record.actionLabel, "actionLabel", 128),
    hwnd: requireInteger(record.hwnd, "hwnd", 1, Number.MAX_SAFE_INTEGER),
    window: record.window === null ? null : parseWindow(record.window),
    monitor: record.monitor === null ? null : parseMonitor(record.monitor),
    position: requireText(record.position, "position", 32, true),
    timestamp: requireText(record.timestamp, "timestamp", 128),
  };
}

/** 解析窗口元数据；输入未知值，返回无路径对象，字段缺失或超限时抛出固定错误。 */
function parseWindow(value: unknown): ApplicationDesktopControlWindow {
  const record = requireExactResponse(value, [
    "hwnd",
    "title",
    "className",
    "processId",
    "processName",
    "visible",
    "minimized",
    "maximized",
    "isActive",
    "alwaysOnTop",
    "rect",
  ]);
  for (const field of ["visible", "minimized", "maximized", "isActive", "alwaysOnTop"] as const) {
    if (typeof record[field] !== "boolean") throw new Error("Desktop control window state is invalid.");
  }
  return {
    hwnd: requireInteger(record.hwnd, "hwnd", 1, Number.MAX_SAFE_INTEGER),
    title: requireText(record.title, "title", 1_024, true),
    className: requireText(record.className, "className", 256, true),
    processId: requireInteger(record.processId, "processId", 0, Number.MAX_SAFE_INTEGER),
    processName: requireText(record.processName, "processName", 512, true),
    visible: record.visible as boolean,
    minimized: record.minimized as boolean,
    maximized: record.maximized as boolean,
    isActive: record.isActive as boolean,
    alwaysOnTop: record.alwaysOnTop as boolean,
    rect: parseRect(record.rect),
  };
}

/** 解析显示器元数据；输入未知值，返回有界对象，字段缺失或超限时抛出固定错误。 */
function parseMonitor(value: unknown): ApplicationDesktopControlMonitor {
  const record = requireExactResponse(
    value,
    ["handle", "index", "deviceName", "label", "isPrimary", "bounds", "workArea"],
  );
  if (typeof record.isPrimary !== "boolean") throw new Error("Desktop control monitor state is invalid.");
  return {
    handle: requireInteger(record.handle, "handle", 0, Number.MAX_SAFE_INTEGER),
    index: requireInteger(record.index, "index", 0, MAX_DESKTOP_MONITORS - 1),
    deviceName: requireText(record.deviceName, "deviceName", 256, true),
    label: requireText(record.label, "label", 512, true),
    isPrimary: record.isPrimary,
    bounds: parseRect(record.bounds),
    workArea: parseRect(record.workArea),
  };
}

/** 解析矩形；输入未知值，返回安全整数坐标，字段缺失或超界时抛出固定错误。 */
function parseRect(value: unknown): ApplicationDesktopControlRect {
  const record = requireExactResponse(value, ["left", "top", "right", "bottom", "width", "height"]);
  return {
    left: requireInteger(record.left, "left", -1_000_000, 1_000_000),
    top: requireInteger(record.top, "top", -1_000_000, 1_000_000),
    right: requireInteger(record.right, "right", -1_000_000, 1_000_000),
    bottom: requireInteger(record.bottom, "bottom", -1_000_000, 1_000_000),
    width: requireInteger(record.width, "width", 0, 1_000_000),
    height: requireInteger(record.height, "height", 0, 1_000_000),
  };
}

/** 解析动作名称；输入未知值，返回固定联合类型，未知动作时抛出固定错误。 */
function parseAction(value: unknown): ApplicationDesktopControlAction {
  const actions: readonly ApplicationDesktopControlAction[] = [
    "focus",
    "minimize",
    "topmost",
    "move",
    "resize",
    "snap",
    "move_to_monitor",
    "move_to_previous_monitor",
    "move_to_next_monitor",
  ];
  if (typeof value !== "string" || !actions.includes(value as ApplicationDesktopControlAction)) {
    throw new Error("Desktop control response action is invalid.");
  }
  return value as ApplicationDesktopControlAction;
}

/** 校验响应精确字段；输入未知值和允许键，返回记录，类型或字段漂移时抛出固定错误。 */
function requireExactResponse(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Desktop control response is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || Object.keys(record).some((key) => !keys.includes(key))) {
    throw new Error("Desktop control response fields are invalid.");
  }
  return record;
}

/** 校验响应文本；输入值、字段、长度和空值策略，返回文本，类型或超限时抛出固定错误。 */
function requireText(
  value: unknown,
  field: string,
  maximumLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || value.length > maximumLength || (!allowEmpty && !value)) {
    throw new Error(`Desktop control response field '${field}' is invalid.`);
  }
  return value;
}

/** 校验响应安全整数；输入值、字段和范围，返回整数，类型或超界时抛出固定错误。 */
function requireInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`Desktop control response field '${field}' is invalid.`);
  }
  return Number(value);
}
