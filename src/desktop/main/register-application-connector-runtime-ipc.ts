import {
  APPLICATION_CONNECTOR_RUNTIME_CHANNELS,
  type ApplicationConnectorRuntimeResult,
} from "../contracts/application-connector-runtime";
import type { ApplicationConnectorRuntimeService } from "../connectors/application-connector-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose Connector Runtime controls through Main. */
export interface RegisterApplicationConnectorRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationConnectorRuntimeService,
    "status" | "start" | "stop" | "reload" | "update"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register sender-authorized Connector Runtime IPC handlers. */
export function registerApplicationConnectorRuntimeIpc(
  options: RegisterApplicationConnectorRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** Return one platform status without activating its Worker. */
  async function handleStatus(event: unknown, request: unknown): Promise<ApplicationConnectorRuntimeResult> {
    authorizeEvent(event);
    return runtime.status(request);
  }

  /** Start one platform through the Main-owned Worker boundary. */
  async function handleStart(event: unknown, request: unknown): Promise<ApplicationConnectorRuntimeResult> {
    authorizeEvent(event);
    return runtime.start(request);
  }

  /** Stop one platform through the Main-owned Worker boundary. */
  async function handleStop(event: unknown, request: unknown): Promise<ApplicationConnectorRuntimeResult> {
    authorizeEvent(event);
    return runtime.stop(request);
  }

  /** Reload one platform through the Main-owned Worker boundary. */
  async function handleReload(event: unknown, request: unknown): Promise<ApplicationConnectorRuntimeResult> {
    authorizeEvent(event);
    return runtime.reload(request);
  }

  /** 热更新一个已运行平台，且不激活已停止的 Connector Worker。 */
  async function handleUpdate(event: unknown, request: unknown): Promise<ApplicationConnectorRuntimeResult> {
    authorizeEvent(event);
    return runtime.update(request);
  }

  const channels = Object.values(APPLICATION_CONNECTOR_RUNTIME_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.status, handleStatus);
  ipcMain.handle(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.start, handleStart);
  ipcMain.handle(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.stop, handleStop);
  ipcMain.handle(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.reload, handleReload);
  ipcMain.handle(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.update, handleUpdate);

  /** Remove every Connector Runtime handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
