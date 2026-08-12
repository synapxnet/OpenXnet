/** Desktop 系统设置应用、固定目录打开和网络地址读取使用的 IPC 通道。 */
export const APPLICATION_SYSTEM_RUNTIME_CHANNELS = {
  applyProxy: "openxnet:application-system-runtime:apply-proxy",
  revealDirectory: "openxnet:application-system-runtime:reveal-directory",
  networkAddress: "openxnet:application-system-runtime:network-address",
} as const;

/** Renderer 可请求打开的固定应用目录，不允许提交本机路径。 */
export type ApplicationSystemDirectory = "user-data" | "logs" | "extensions";

/** Renderer 请求打开一个 Main-owned 固定目录时提交的精确结构。 */
export interface RevealApplicationSystemDirectoryRequest {
  readonly directory: ApplicationSystemDirectory;
}

/** Main 成功交给操作系统打开目录后的无路径结果。 */
export interface RevealApplicationSystemDirectoryResult {
  readonly opened: true;
}

/** Main 应用当前代理设置后返回的无代理值摘要。 */
export interface ApplyApplicationSystemProxyResult {
  readonly success: true;
  readonly mode: "system" | "manual" | "none";
  readonly chinaMirror: boolean;
}

/** Main 返回的有界 IPv4 地址；没有可用网卡时使用 loopback。 */
export interface ApplicationSystemNetworkAddressResult {
  readonly address: string;
}

/** 判断未知值是否为可检查的非数组对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验固定目录打开请求；输入未知 IPC 值，返回规范枚举，结构漂移时抛错。 */
export function parseRevealApplicationSystemDirectoryRequest(
  value: unknown,
): RevealApplicationSystemDirectoryRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new TypeError("Desktop system directory request is invalid.");
  }
  if (!["user-data", "logs", "extensions"].includes(String(value.directory))) {
    throw new TypeError("Desktop system directory is invalid.");
  }
  return { directory: value.directory as ApplicationSystemDirectory };
}
