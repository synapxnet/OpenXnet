import {
  APPLICATION_MCP_CREDENTIAL_CHANNELS,
  type ApplicationMcpCredentialSnapshot,
} from "../contracts/application-mcp-credentials";
import type { ApplicationMcpCredentialService } from "../storage/application-mcp-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose MCP credential metadata and writes. */
export interface RegisterApplicationMcpCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly mcpCredentials: Pick<ApplicationMcpCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized MCP credential IPC boundary. */
export function registerApplicationMcpCredentialsIpc(
  options: RegisterApplicationMcpCredentialsIpcOptions,
): () => void {
  const { ipcMain, mcpCredentials, authorizeEvent } = options;

  /** Return one authorized redacted MCP credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationMcpCredentialSnapshot {
    authorizeEvent(event);
    return mcpCredentials.getSnapshot();
  }

  /** Apply one authorized MCP credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationMcpCredentialSnapshot {
    authorizeEvent(event);
    return mcpCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_MCP_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_MCP_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_MCP_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every MCP credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
