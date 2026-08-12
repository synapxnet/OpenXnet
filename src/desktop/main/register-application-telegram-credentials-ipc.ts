import {
  APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS,
  type ApplicationTelegramCredentialSnapshot,
} from "../contracts/application-telegram-credentials";
import type { ApplicationTelegramCredentialService } from "../storage/application-telegram-credentials";
import type { IpcMainLike } from "./register-core-ipc";

/** Dependencies required to expose Telegram credential metadata and writes. */
export interface RegisterApplicationTelegramCredentialsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly telegramCredentials: Pick<ApplicationTelegramCredentialService, "getSnapshot" | "save">;
  readonly authorizeEvent: (event: unknown) => void;
}

/** Register the authorized Telegram credential IPC boundary. */
export function registerApplicationTelegramCredentialsIpc(
  options: RegisterApplicationTelegramCredentialsIpcOptions,
): () => void {
  const { ipcMain, telegramCredentials, authorizeEvent } = options;

  /** Return one authorized redacted Telegram credential snapshot. */
  function handleGetSnapshot(event: unknown): ApplicationTelegramCredentialSnapshot {
    authorizeEvent(event);
    return telegramCredentials.getSnapshot();
  }

  /** Apply one authorized Telegram credential update. */
  function handleSave(event: unknown, request: unknown): ApplicationTelegramCredentialSnapshot {
    authorizeEvent(event);
    return telegramCredentials.save(request);
  }

  const channels = Object.values(APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS);
  for (const channel of channels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS.getSnapshot, handleGetSnapshot);
  ipcMain.handle(APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS.save, handleSave);

  /** Remove every Telegram credential IPC handler registered by this adapter. */
  function cleanup(): void {
    for (const channel of channels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
