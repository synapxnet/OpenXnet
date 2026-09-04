import {
  APPLICATION_SYNAPXNET_MEMORY_CHANNELS,
  type SynapxnetMemoryHistoryResult,
  type SynapxnetMemoryImportResult,
  type SynapxnetMemoryIntegrityResult,
  type SynapxnetMemoryListResult,
  type SynapxnetMemoryRecord,
  type SynapxnetMemoryRecoveryResult,
  type SynapxnetMemoryStatusResult,
  type SynapxnetMemoryTransferDocument,
} from "../contracts/application-synapxnet-memory-runtime";
import type { ApplicationSynapxnetMemoryRuntimeService } from "../memory-management/application-synapxnet-memory-runtime";
import type { IpcMainLike } from "./register-core-ipc";

export interface RegisterApplicationSynapxnetMemoryIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationSynapxnetMemoryRuntimeService,
    "recover" | "status" | "list" | "history" | "create" | "edit" | "rollback" | "retire" | "export" | "import" | "verify"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register sender-authorized IPC handlers for the V3 memory product boundary. */
export function registerApplicationSynapxnetMemoryIpc(
  options: RegisterApplicationSynapxnetMemoryIpcOptions,
): () => void {
  const { ipcMain, runtime, authorizeEvent } = options;

  /** 校验当前 IPC 发送方；输入事件，不返回业务数据。 */
  function authorize(event: unknown): void {
    authorizeEvent(event);
  }

  ipcMain.removeHandler(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.status);
  ipcMain.handle(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.status, (event): Promise<SynapxnetMemoryStatusResult> => {
    authorize(event);
    return runtime.status();
  });

  const requestHandlers: ReadonlyArray<readonly [string, (value: unknown) => Promise<unknown>]> = [
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.recover, (value) => runtime.recover(value) as Promise<SynapxnetMemoryRecoveryResult>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.list, (value) => runtime.list(value) as Promise<SynapxnetMemoryListResult>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.history, (value) => runtime.history(value) as Promise<SynapxnetMemoryHistoryResult>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.create, (value) => runtime.create(value) as Promise<SynapxnetMemoryRecord>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.edit, (value) => runtime.edit(value) as Promise<SynapxnetMemoryRecord>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.rollback, (value) => runtime.rollback(value) as Promise<SynapxnetMemoryRecord>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.retire, (value) => runtime.retire(value) as Promise<SynapxnetMemoryRecord>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.export, (value) => runtime.export(value) as Promise<SynapxnetMemoryTransferDocument>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.import, (value) => runtime.import(value) as Promise<SynapxnetMemoryImportResult>],
    [APPLICATION_SYNAPXNET_MEMORY_CHANNELS.verify, (value) => runtime.verify(value) as Promise<SynapxnetMemoryIntegrityResult>],
  ];

  for (const [channel, handler] of requestHandlers) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event, value: unknown): Promise<unknown> => {
      authorize(event);
      return handler(value);
    });
  }

  return function cleanup(): void {
    for (const channel of Object.values(APPLICATION_SYNAPXNET_MEMORY_CHANNELS)) {
      ipcMain.removeHandler(channel);
    }
  };
}
