import {
  APPLICATION_ARTIFACT_CHANNELS,
  parseImportApplicationArtifactsRequest,
  type ApplicationArtifactSnapshot,
  type ApplicationArtifactWriteResult,
  type DeleteApplicationArtifactsResult,
} from "../contracts/application-artifacts";
import type { ApplicationArtifactService } from "../storage/application-artifacts";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose artifact operations through Electron IPC. */
export interface RegisterApplicationArtifactsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly artifacts: Pick<
    ApplicationArtifactService,
    | "listArtifacts"
    | "importArtifacts"
    | "importRendererArtifacts"
    | "registerArtifacts"
    | "deleteArtifacts"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly authorizeImportPath: (event: unknown, filePath: string) => void;
}

/** 注册经过发送者校验的 Desktop Core Artifact IPC；输入依赖，返回清理函数，重复注册时先移除旧处理器。 */
export function registerApplicationArtifactsIpc(
  options: RegisterApplicationArtifactsIpcOptions,
): () => void {
  const { ipcMain, artifacts, authorizeEvent, authorizeImportPath } = options;

  /** Return the current artifact catalog to an authorized Renderer. */
  function handleList(event: unknown, request: unknown): Promise<ApplicationArtifactSnapshot> {
    authorizeEvent(event);
    return artifacts.listArtifacts(request);
  }

  /** Import only native file paths granted to the requesting Renderer. */
  function handleImport(event: unknown, request: unknown): Promise<ApplicationArtifactWriteResult> {
    authorizeEvent(event);
    const parsed = parseImportApplicationArtifactsRequest(request);
    for (const filePath of parsed.paths) {
      authorizeImportPath(event, filePath);
    }
    return artifacts.importArtifacts(parsed);
  }

  /**
   * 导入 preload 从真实 File 解析的本机路径或有界内联内容；输入为专用合约，返回写入结果，未授权发送者或非法内容会被拒绝。
   */
  function handleRendererImport(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationArtifactWriteResult> {
    authorizeEvent(event);
    return artifacts.importRendererArtifacts(request);
  }

  /** Register compatibility uploads already contained by the application artifact root. */
  function handleRegister(
    event: unknown,
    request: unknown,
  ): Promise<ApplicationArtifactWriteResult> {
    authorizeEvent(event);
    return artifacts.registerArtifacts(request);
  }

  /** Delete artifact binaries and retain stable metadata tombstones. */
  function handleDelete(
    event: unknown,
    request: unknown,
  ): Promise<DeleteApplicationArtifactsResult> {
    authorizeEvent(event);
    return artifacts.deleteArtifacts(request);
  }

  ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.list);
  ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.importFiles);
  ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.importRendererFiles);
  ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.registerFiles);
  ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.delete);
  ipcMain.handle(APPLICATION_ARTIFACT_CHANNELS.list, handleList);
  ipcMain.handle(APPLICATION_ARTIFACT_CHANNELS.importFiles, handleImport);
  ipcMain.handle(APPLICATION_ARTIFACT_CHANNELS.importRendererFiles, handleRendererImport);
  ipcMain.handle(APPLICATION_ARTIFACT_CHANNELS.registerFiles, handleRegister);
  ipcMain.handle(APPLICATION_ARTIFACT_CHANNELS.delete, handleDelete);

  /** Remove every artifact IPC handler registered by this adapter. */
  function cleanup(): void {
    ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.list);
    ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.importFiles);
    ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.importRendererFiles);
    ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.registerFiles);
    ipcMain.removeHandler(APPLICATION_ARTIFACT_CHANNELS.delete);
  }

  return cleanup;
}
