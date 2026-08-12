import {
  APPLICATION_CHAT_CHANNELS,
  type ApplicationChatResponse,
  type ApplicationChatStreamAcknowledgement,
} from "../contracts/application-chat";
import type { ApplicationChatService } from "../chat/application-chat";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";

/** Dependencies required to expose typed chat transport through Electron IPC. */
export interface RegisterApplicationChatIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly chat: Pick<
    ApplicationChatService,
    "startStream" | "complete" | "listModels" | "abort" | "executeTool" | "resolveApproval" | "subscribe"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWebContents: () => readonly WebContentsLike[];
}

/** Register authorized chat commands and ordered stream event delivery. */
export function registerApplicationChatIpc(options: RegisterApplicationChatIpcOptions): () => void {
  const { ipcMain, chat, authorizeEvent } = options;

  /** Start one authorized Renderer chat stream. */
  function handleStartStream(event: unknown, request: unknown): Promise<ApplicationChatStreamAcknowledgement> {
    authorizeEvent(event);
    return chat.startStream(request);
  }

  /** Execute one authorized non-stream completion. */
  function handleComplete(event: unknown, request: unknown): Promise<ApplicationChatResponse> {
    authorizeEvent(event);
    return chat.complete(request);
  }

  /** Retrieve one authorized bounded model list. */
  function handleListModels(event: unknown): Promise<ApplicationChatResponse> {
    authorizeEvent(event);
    return chat.listModels();
  }

  /** Cancel one authorized local and provider stream. */
  function handleAbort(event: unknown, request: unknown): Promise<ApplicationChatResponse> {
    authorizeEvent(event);
    return chat.abort(request);
  }

  /** Execute one authorized manually approved tool. */
  function handleExecuteTool(event: unknown, request: unknown): Promise<ApplicationChatResponse> {
    authorizeEvent(event);
    return chat.executeTool(request);
  }

  /** Resolve one authorized provider-tool approval. */
  function handleResolveApproval(event: unknown, request: unknown): Promise<ApplicationChatResponse> {
    authorizeEvent(event);
    return chat.resolveApproval(request);
  }

  const requestChannels = [
    APPLICATION_CHAT_CHANNELS.startStream,
    APPLICATION_CHAT_CHANNELS.complete,
    APPLICATION_CHAT_CHANNELS.listModels,
    APPLICATION_CHAT_CHANNELS.abort,
    APPLICATION_CHAT_CHANNELS.executeTool,
    APPLICATION_CHAT_CHANNELS.resolveApproval,
  ];
  for (const channel of requestChannels) ipcMain.removeHandler(channel);
  ipcMain.handle(APPLICATION_CHAT_CHANNELS.startStream, handleStartStream);
  ipcMain.handle(APPLICATION_CHAT_CHANNELS.complete, handleComplete);
  ipcMain.handle(APPLICATION_CHAT_CHANNELS.listModels, handleListModels);
  ipcMain.handle(APPLICATION_CHAT_CHANNELS.abort, handleAbort);
  ipcMain.handle(APPLICATION_CHAT_CHANNELS.executeTool, handleExecuteTool);
  ipcMain.handle(APPLICATION_CHAT_CHANNELS.resolveApproval, handleResolveApproval);

  const unsubscribe = chat.subscribe((streamEvent) => {
    for (const webContents of options.getWebContents()) {
      if (!webContents.isDestroyed()) {
        webContents.send(APPLICATION_CHAT_CHANNELS.streamEvent, streamEvent);
      }
    }
  });

  /** Remove every chat handler and stream subscription. */
  function cleanup(): void {
    unsubscribe();
    for (const channel of requestChannels) ipcMain.removeHandler(channel);
  }
  return cleanup;
}
