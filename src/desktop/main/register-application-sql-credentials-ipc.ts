import {
  APPLICATION_SQL_CREDENTIAL_CHANNELS,
  type ApplicationSqlCredentialSnapshot,
} from "../contracts/application-sql-credentials";
import type { ApplicationSqlCredentialService } from "../storage/application-sql-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** 注册 SQL 凭据 IPC 所需依赖。 */
export interface RegisterApplicationSqlCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly sqlCredentials: Pick<
    ApplicationSqlCredentialService,
    "getSnapshot" | "save" | "selectDatabase"
  >;
  readonly authorizeEvent: (event: unknown) => void;
}

/** 注册授权 SQL 凭据和文件选择 IPC；输入依赖，返回清理函数，不启动 MCP Worker。 */
export function registerApplicationSqlCredentialsIpc(
  options: RegisterApplicationSqlCredentialsIpcOptions,
): () => void {
  const { ipcMain, sqlCredentials, authorizeEvent } = options;

  /** 读取脱敏 SQL 状态；输入 IPC 事件，返回快照，未授权发送者会抛出异常。 */
  function handleGetSnapshot(event: unknown): ApplicationSqlCredentialSnapshot {
    authorizeEvent(event);
    return sqlCredentials.getSnapshot();
  }

  /** 保存 SQL 口令；输入 IPC 事件和未知请求，返回快照，校验失败时抛出异常。 */
  function handleSave(event: unknown, request: unknown): ApplicationSqlCredentialSnapshot {
    authorizeEvent(event);
    return sqlCredentials.save(request);
  }

  /** 通过系统选择器授予 SQLite 文件；输入 IPC 事件，返回快照，取消时保留现状。 */
  async function handleSelectDatabase(event: unknown): Promise<ApplicationSqlCredentialSnapshot> {
    authorizeEvent(event);
    return await sqlCredentials.selectDatabase();
  }

  const channels = Object.values(APPLICATION_SQL_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_SQL_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_SQL_CREDENTIAL_CHANNELS.save, handleSave);
  ipcMain.handle(APPLICATION_SQL_CREDENTIAL_CHANNELS.selectDatabase, handleSelectDatabase);

  /** 移除本适配器注册的全部 SQL IPC；无输入和返回，可重复调用。 */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
