import { APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS } from "../contracts/application-toolchain-runtime";
import type { ApplicationToolchainRuntimeService } from "../toolchain/application-toolchain-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 Toolchain Runtime IPC 所需依赖。 */
export interface RegisterApplicationToolchainRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationToolchainRuntimeService,
    "probe" | "listDockerContainers" | "pullDockerImage" | "mutateDockerContainer"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册四条授权 Toolchain 命令；输入 IPC、Runtime 和鉴权器，返回可重复清理函数。 */
export function registerApplicationToolchainRuntimeIpc(
  options: RegisterApplicationToolchainRuntimeIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 探测工具；输入事件和精确请求，返回无路径结果，鉴权失败时不执行命令。 */
  function handleProbe(event: unknown, request: unknown): ReturnType<typeof runtime.probe> {
    authorizeEvent(event);
    return runtime.probe(request);
  }

  /** 列出 Docker 容器；输入事件，返回有界摘要，鉴权失败时不执行命令。 */
  function handleListDockerContainers(event: unknown): ReturnType<typeof runtime.listDockerContainers> {
    authorizeEvent(event);
    return runtime.listDockerContainers();
  }

  /** 拉取 Docker 镜像；输入事件和精确请求，返回固定结果，鉴权失败时不执行命令。 */
  function handlePullDockerImage(event: unknown, request: unknown): ReturnType<typeof runtime.pullDockerImage> {
    authorizeEvent(event);
    return runtime.pullDockerImage(request);
  }

  /** 执行容器动作；输入事件和精确请求，返回固定结果，鉴权失败时不执行命令。 */
  function handleMutateDockerContainer(
    event: unknown,
    request: unknown,
  ): ReturnType<typeof runtime.mutateDockerContainer> {
    authorizeEvent(event);
    return runtime.mutateDockerContainer(request);
  }

  const channels = Object.values(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.probe, handleProbe);
  ipcMain.handle(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.listDockerContainers, handleListDockerContainers);
  ipcMain.handle(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.pullDockerImage, handlePullDockerImage);
  ipcMain.handle(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.mutateDockerContainer, handleMutateDockerContainer);

  /** 清理全部 Toolchain handler；无输入和返回，可重复执行。 */
  return function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
