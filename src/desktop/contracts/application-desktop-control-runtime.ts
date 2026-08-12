/** Desktop Control Runtime IPC channels。 */
export const APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS = Object.freeze({
  listWindows: "openxnet:application-desktop-control-runtime:list-windows",
  listMonitors: "openxnet:application-desktop-control-runtime:list-monitors",
  getActiveWindow: "openxnet:application-desktop-control-runtime:get-active-window",
  listHistory: "openxnet:application-desktop-control-runtime:list-history",
  executeAction: "openxnet:application-desktop-control-runtime:execute-action",
});

/** Desktop 窗口列表响应 schema。 */
export const APPLICATION_DESKTOP_CONTROL_WINDOWS_SCHEMA = "openxnet.desktop-control-windows.v1" as const;

/** Desktop 显示器列表响应 schema。 */
export const APPLICATION_DESKTOP_CONTROL_MONITORS_SCHEMA = "openxnet.desktop-control-monitors.v1" as const;

/** Desktop 活动窗口响应 schema。 */
export const APPLICATION_DESKTOP_CONTROL_ACTIVE_WINDOW_SCHEMA = "openxnet.desktop-control-active-window.v1" as const;

/** Desktop 窗口控制历史响应 schema。 */
export const APPLICATION_DESKTOP_CONTROL_HISTORY_SCHEMA = "openxnet.desktop-control-history.v1" as const;

/** Desktop 窗口动作响应 schema。 */
export const APPLICATION_DESKTOP_CONTROL_ACTION_SCHEMA = "openxnet.desktop-control-action.v1" as const;

/** Renderer 可请求的窗口动作。 */
export type ApplicationDesktopControlAction =
  | "focus"
  | "minimize"
  | "topmost"
  | "move"
  | "resize"
  | "snap"
  | "move_to_monitor"
  | "move_to_previous_monitor"
  | "move_to_next_monitor";

/** 有界窗口列表请求。 */
export interface ApplicationDesktopControlWindowListRequest {
  readonly titleQuery: string;
  readonly includeHidden: boolean;
  readonly includeMinimized: boolean;
  readonly limit: number;
}

/** 有界动作历史请求。 */
export interface ApplicationDesktopControlHistoryRequest {
  readonly limit: number;
}

/** 精确窗口动作请求。 */
export interface ApplicationDesktopControlActionRequest {
  readonly action: ApplicationDesktopControlAction;
  readonly hwnd: number;
  readonly payload: Readonly<Record<string, boolean | number | string | null>>;
}

/** Desktop 公开矩形。 */
export interface ApplicationDesktopControlRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Desktop 公开窗口元数据，不包含进程路径。 */
export interface ApplicationDesktopControlWindow {
  readonly hwnd: number;
  readonly title: string;
  readonly className: string;
  readonly processId: number;
  readonly processName: string;
  readonly visible: boolean;
  readonly minimized: boolean;
  readonly maximized: boolean;
  readonly isActive: boolean;
  readonly alwaysOnTop: boolean;
  readonly rect: ApplicationDesktopControlRect;
}

/** Desktop 公开显示器元数据。 */
export interface ApplicationDesktopControlMonitor {
  readonly handle: number;
  readonly index: number;
  readonly deviceName: string;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly bounds: ApplicationDesktopControlRect;
  readonly workArea: ApplicationDesktopControlRect;
}

/** Renderer 可见的窗口列表。 */
export interface ApplicationDesktopControlWindowListResult {
  readonly schema: typeof APPLICATION_DESKTOP_CONTROL_WINDOWS_SCHEMA;
  readonly count: number;
  readonly windows: readonly ApplicationDesktopControlWindow[];
}

/** Renderer 可见的显示器列表。 */
export interface ApplicationDesktopControlMonitorListResult {
  readonly schema: typeof APPLICATION_DESKTOP_CONTROL_MONITORS_SCHEMA;
  readonly count: number;
  readonly monitors: readonly ApplicationDesktopControlMonitor[];
}

/** Renderer 可见的活动窗口状态。 */
export interface ApplicationDesktopControlActiveWindowResult {
  readonly schema: typeof APPLICATION_DESKTOP_CONTROL_ACTIVE_WINDOW_SCHEMA;
  readonly found: boolean;
  readonly supported: boolean;
  readonly detectedAt: string;
  readonly reason: string;
  readonly window: ApplicationDesktopControlWindow | null;
}

/** 一条有界窗口动作历史。 */
export interface ApplicationDesktopControlHistoryItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "completed" | "failed";
  readonly statusLabel: string;
  readonly action: ApplicationDesktopControlAction;
  readonly actionLabel: string;
  readonly hwnd: number;
  readonly window: ApplicationDesktopControlWindow | null;
  readonly monitor: ApplicationDesktopControlMonitor | null;
  readonly position: string;
  readonly timestamp: string;
}

/** Renderer 可见的窗口动作历史。 */
export interface ApplicationDesktopControlHistoryResult {
  readonly schema: typeof APPLICATION_DESKTOP_CONTROL_HISTORY_SCHEMA;
  readonly count: number;
  readonly items: readonly ApplicationDesktopControlHistoryItem[];
  readonly generatedAt: string;
}

/** Renderer 可见的窗口动作结果。 */
export interface ApplicationDesktopControlActionResult {
  readonly schema: typeof APPLICATION_DESKTOP_CONTROL_ACTION_SCHEMA;
  readonly success: true;
  readonly action: ApplicationDesktopControlAction;
  readonly window: ApplicationDesktopControlWindow;
  readonly monitor: ApplicationDesktopControlMonitor | null;
  readonly position: string;
}

const DESKTOP_CONTROL_ACTIONS = new Set<ApplicationDesktopControlAction>([
  "focus",
  "minimize",
  "topmost",
  "move",
  "resize",
  "snap",
  "move_to_monitor",
  "move_to_previous_monitor",
  "move_to_next_monitor",
]);
const SNAP_POSITIONS = new Set([
  "maximize",
  "left",
  "right",
  "top",
  "bottom",
  "center",
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
  "left_third",
  "center_third",
  "right_third",
]);

/** 解析窗口列表请求；输入未知值，返回填充默认值的精确请求，字段无效时抛出 TypeError。 */
export function parseApplicationDesktopControlWindowListRequest(
  value: unknown,
): ApplicationDesktopControlWindowListRequest {
  const record = requireOptionalExactRecord(
    value,
    ["titleQuery", "includeHidden", "includeMinimized", "limit"],
    "window list request",
  );
  const titleQuery = record.titleQuery === undefined
    ? ""
    : requireBoundedText(record.titleQuery, "titleQuery", 256);
  return {
    titleQuery,
    includeHidden: requireOptionalBoolean(record.includeHidden, false, "includeHidden"),
    includeMinimized: requireOptionalBoolean(record.includeMinimized, true, "includeMinimized"),
    limit: requireInteger(record.limit ?? 20, "limit", 1, 100),
  };
}

/** 解析动作历史请求；输入未知值，返回有界数量，字段无效时抛出 TypeError。 */
export function parseApplicationDesktopControlHistoryRequest(
  value: unknown,
): ApplicationDesktopControlHistoryRequest {
  const record = requireOptionalExactRecord(value, ["limit"], "history request");
  return { limit: requireInteger(record.limit ?? 8, "limit", 1, 40) };
}

/** 解析窗口动作；输入未知值，返回按动作精确校验的请求，未知动作或额外字段时抛出 TypeError。 */
export function parseApplicationDesktopControlActionRequest(
  value: unknown,
): ApplicationDesktopControlActionRequest {
  const record = requireExactRecord(value, ["action", "hwnd", "payload"], "action request");
  if (typeof record.action !== "string" || !DESKTOP_CONTROL_ACTIONS.has(record.action as ApplicationDesktopControlAction)) {
    throw new TypeError("Desktop control action is invalid.");
  }
  const action = record.action as ApplicationDesktopControlAction;
  const hwnd = requireInteger(record.hwnd, "hwnd", 1, Number.MAX_SAFE_INTEGER);
  const payload = parseActionPayload(action, record.payload);
  return { action, hwnd, payload };
}

/** 解析动作载荷；输入动作和未知值，返回精确标量对象，字段或范围无效时抛出 TypeError。 */
function parseActionPayload(
  action: ApplicationDesktopControlAction,
  value: unknown,
): Readonly<Record<string, boolean | number | string | null>> {
  if (["focus", "minimize"].includes(action)) {
    requireExactRecord(value, [], `${action} payload`);
    return {};
  }
  if (action === "topmost") {
    const record = requireOptionalExactRecord(value, ["enabled"], "topmost payload");
    if (record.enabled !== undefined && typeof record.enabled !== "boolean") {
      throw new TypeError("Desktop control topmost enabled state is invalid.");
    }
    return record.enabled === undefined ? {} : { enabled: record.enabled };
  }
  if (action === "move") {
    const record = requireExactRecord(value, ["x", "y"], "move payload");
    return {
      x: requireInteger(record.x, "x", -100_000, 100_000),
      y: requireInteger(record.y, "y", -100_000, 100_000),
    };
  }
  if (action === "resize") {
    const record = requireExactRecord(value, ["width", "height"], "resize payload");
    return {
      width: requireInteger(record.width, "width", 1, 32_768),
      height: requireInteger(record.height, "height", 1, 32_768),
    };
  }
  if (action === "snap") {
    const record = requireOptionalExactRecord(
      value,
      ["position", "monitorIndex", "useWorkArea"],
      "snap payload",
    );
    const position = requireBoundedText(record.position, "position", 32);
    if (!SNAP_POSITIONS.has(position)) throw new TypeError("Desktop control snap position is invalid.");
    const monitorIndex = record.monitorIndex === undefined || record.monitorIndex === null
      ? null
      : requireInteger(record.monitorIndex, "monitorIndex", 0, 64);
    return {
      position,
      monitorIndex,
      useWorkArea: requireOptionalBoolean(record.useWorkArea, true, "useWorkArea"),
    };
  }
  if (action === "move_to_monitor") {
    const record = requireOptionalExactRecord(
      value,
      ["monitorIndex", "useWorkArea"],
      "move-to-monitor payload",
    );
    return {
      monitorIndex: requireInteger(record.monitorIndex, "monitorIndex", 0, 64),
      useWorkArea: requireOptionalBoolean(record.useWorkArea, true, "useWorkArea"),
    };
  }
  const record = requireOptionalExactRecord(value, ["useWorkArea"], "adjacent-monitor payload");
  return { useWorkArea: requireOptionalBoolean(record.useWorkArea, true, "useWorkArea") };
}

/** 校验有界文本；输入未知值、字段和长度，返回去空白文本，类型或超限时抛出 TypeError。 */
function requireBoundedText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") throw new TypeError(`Desktop control field '${field}' is invalid.`);
  const normalized = value.trim();
  if (normalized.length > maximumLength) throw new TypeError(`Desktop control field '${field}' is invalid.`);
  return normalized;
}

/** 校验可选布尔值；输入未知值、默认值和字段，返回布尔值，类型错误时抛出 TypeError。 */
function requireOptionalBoolean(value: unknown, fallback: boolean, field: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new TypeError(`Desktop control field '${field}' is invalid.`);
  return value;
}

/** 校验安全整数范围；输入未知值、字段和上下界，返回整数，超界时抛出 TypeError。 */
function requireInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new TypeError(`Desktop control field '${field}' is invalid.`);
  }
  return Number(value);
}

/** 校验精确对象；输入未知值、键和标签，返回记录，缺失或额外字段时抛出 TypeError。 */
function requireExactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  const record = requireOptionalExactRecord(value, keys, label);
  if (Object.keys(record).length !== keys.length) {
    throw new TypeError(`Desktop control ${label} fields are invalid.`);
  }
  return record;
}

/** 校验可选字段对象；输入未知值、允许键和标签，返回记录，类型或额外字段时抛出 TypeError。 */
function requireOptionalExactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (value === undefined && keys.length > 0) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Desktop control ${label} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) {
    throw new TypeError(`Desktop control ${label} fields are invalid.`);
  }
  return record;
}
