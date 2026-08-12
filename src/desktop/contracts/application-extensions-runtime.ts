/** Extension Runtime 的 Main IPC 通道。 */
export const APPLICATION_EXTENSION_RUNTIME_CHANNELS = Object.freeze({
  list: "openxnet:application-extensions:list",
  listRemote: "openxnet:application-extensions:list-remote",
  installRepository: "openxnet:application-extensions:install-repository",
  importArchive: "openxnet:application-extensions:import-archive",
  update: "openxnet:application-extensions:update",
  remove: "openxnet:application-extensions:remove",
  start: "openxnet:application-extensions:start",
  stop: "openxnet:application-extensions:stop",
});

/** Extension Runtime 的公开响应 schema。 */
export const APPLICATION_EXTENSION_RUNTIME_SCHEMA = "openxnet.extensions.v1" as const;

/** Renderer 可提交给 preload 的最小 File 能力。 */
export interface RendererApplicationExtensionArchiveFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** preload 从真实 File 提取的本机 ZIP 路径。 */
export interface ApplicationExtensionArchivePathEntry {
  readonly source: "path";
  readonly path: string;
  readonly originalName: string;
}

/** preload 为无本机路径 File 提供的有界 ZIP 字节。 */
export interface ApplicationExtensionArchiveBytesEntry {
  readonly source: "bytes";
  readonly originalName: string;
  readonly bytes: Uint8Array;
}

/** Main Runtime 接收的扩展 ZIP 导入请求。 */
export interface ImportApplicationExtensionArchiveRequest {
  readonly entry: ApplicationExtensionArchivePathEntry | ApplicationExtensionArchiveBytesEntry;
}

/** Renderer 调用 preload 时使用的扩展 ZIP 导入请求。 */
export interface RendererImportApplicationExtensionArchiveRequest {
  readonly file: RendererApplicationExtensionArchiveFile;
}

/** 从固定仓库主机安装扩展的请求。 */
export interface InstallApplicationExtensionRepositoryRequest {
  readonly repository: string;
  readonly backupRepository?: string;
}

/** 对单个已安装扩展执行操作的请求。 */
export interface ApplicationExtensionIdRequest {
  readonly extensionId: string;
}

/** Renderer 可见的扩展元数据。 */
export interface ApplicationExtensionRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author: string;
  readonly systemPrompt: string;
  readonly repository: string;
  readonly backupRepository: string;
  readonly category: string;
  readonly transparent: boolean;
  readonly width: number;
  readonly height: number;
  readonly enableVrmWindowSize: boolean;
  readonly hasStaticEntry: boolean;
  readonly hasNodeEntry: boolean;
}

/** 本机扩展目录快照。 */
export interface ApplicationExtensionCatalog {
  readonly schema: typeof APPLICATION_EXTENSION_RUNTIME_SCHEMA;
  readonly success: true;
  readonly extensions: readonly ApplicationExtensionRecord[];
}

/** 固定远程目录中的扩展条目。 */
export interface ApplicationRemoteExtensionRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly version: string;
  readonly category: string;
  readonly repository: string;
  readonly backupRepository: string;
  readonly installed: boolean;
}

/** 固定远程扩展目录响应。 */
export interface ApplicationRemoteExtensionCatalog {
  readonly schema: typeof APPLICATION_EXTENSION_RUNTIME_SCHEMA;
  readonly success: true;
  readonly plugins: readonly ApplicationRemoteExtensionRecord[];
}

/** 扩展安装或更新结果。 */
export interface ApplicationExtensionWriteResult {
  readonly schema: typeof APPLICATION_EXTENSION_RUNTIME_SCHEMA;
  readonly success: true;
  readonly operation: "installed" | "updated";
  readonly extension: ApplicationExtensionRecord;
}

/** 扩展删除或停止结果。 */
export interface ApplicationExtensionMutationResult {
  readonly schema: typeof APPLICATION_EXTENSION_RUNTIME_SCHEMA;
  readonly success: true;
  readonly operation: "removed" | "stopped";
  readonly extensionId: string;
}

/** 扩展页面启动结果；URL 始终指向独立回环 Origin。 */
export interface ApplicationExtensionStartResult {
  readonly schema: typeof APPLICATION_EXTENSION_RUNTIME_SCHEMA;
  readonly success: true;
  readonly extensionId: string;
  readonly mode: "static" | "node";
  readonly url: string;
}

/** preload 内联扩展 ZIP 的最大字节数。 */
export const MAX_INLINE_EXTENSION_ARCHIVE_BYTES = 32 * 1024 * 1024;
