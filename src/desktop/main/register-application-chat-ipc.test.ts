import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_CHAT_CHANNELS,
  APPLICATION_CHAT_RESPONSE_SCHEMA,
  APPLICATION_CHAT_STREAM_EVENT_SCHEMA,
  APPLICATION_CHAT_STREAM_SCHEMA,
  type ApplicationChatStreamEvent,
} from "../contracts/application-chat";
import type { IpcMainLike, WebContentsLike } from "./register-core-ipc";
import { registerApplicationChatIpc } from "./register-application-chat-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one synthetic Application Chat handler. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one synthetic Application Chat handler. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered synthetic Application Chat handler. */
  public async invoke(channel: string, event: unknown, request?: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    assert.ok(handler);
    return handler(event, request);
  }
}

test("registerApplicationChatIpc authorizes commands, broadcasts streams, and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  let listener: ((event: ApplicationChatStreamEvent) => void) | null = null;
  const calls: { readonly name: string; readonly value: unknown }[] = [];
  const sent: { readonly channel: string; readonly payload: unknown }[] = [];
  const response = {
    schema: APPLICATION_CHAT_RESPONSE_SCHEMA,
    statusCode: 200,
    contentType: "application/json",
    body: { ok: true },
  } as const;
  const chat = {
    startStream: async (value: unknown) => {
      calls.push({ name: "startStream", value });
      return { schema: APPLICATION_CHAT_STREAM_SCHEMA, streamId: "stream-0001", statusCode: 200, contentType: "text/event-stream" } as const;
    },
    complete: async (value: unknown) => { calls.push({ name: "complete", value }); return response; },
    listModels: async () => { calls.push({ name: "listModels", value: undefined }); return response; },
    abort: async (value: unknown) => { calls.push({ name: "abort", value }); return response; },
    executeTool: async (value: unknown) => { calls.push({ name: "executeTool", value }); return response; },
    resolveApproval: async (value: unknown) => { calls.push({ name: "resolveApproval", value }); return response; },
    subscribe: (nextListener: (event: ApplicationChatStreamEvent) => void) => {
      listener = nextListener;
      return () => { listener = null; };
    },
  };
  const webContents: WebContentsLike = {
    isDestroyed: () => false,
    send: (channel, payload) => sent.push({ channel, payload }),
  };
  const cleanup = registerApplicationChatIpc({
    ipcMain,
    chat: chat as never,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
    getWebContents: () => [webContents, { isDestroyed: () => true, send: () => undefined }],
  });
  try {
    const commandChannels = Object.values(APPLICATION_CHAT_CHANNELS)
      .filter((channel) => channel !== APPLICATION_CHAT_CHANNELS.streamEvent);
    assert.equal(ipcMain.handlers.size, commandChannels.length);
    await ipcMain.invoke(APPLICATION_CHAT_CHANNELS.startStream, authorizedEvent, { streamId: "stream-0001" });
    await ipcMain.invoke(APPLICATION_CHAT_CHANNELS.complete, authorizedEvent, { mode: "chat" });
    await ipcMain.invoke(APPLICATION_CHAT_CHANNELS.listModels, authorizedEvent);
    await ipcMain.invoke(APPLICATION_CHAT_CHANNELS.abort, authorizedEvent, { streamId: "stream-0001" });
    await ipcMain.invoke(APPLICATION_CHAT_CHANNELS.executeTool, authorizedEvent, { toolName: "search" });
    await ipcMain.invoke(APPLICATION_CHAT_CHANNELS.resolveApproval, authorizedEvent, { approvalId: "approval-1" });
    await assert.rejects(
      ipcMain.invoke(APPLICATION_CHAT_CHANNELS.complete, {}, { mode: "chat" }),
      /not authorized/,
    );
    assert.deepEqual(calls.map((call) => call.name), [
      "startStream", "complete", "listModels", "abort", "executeTool", "resolveApproval",
    ]);

    const streamEvent: ApplicationChatStreamEvent = {
      schema: APPLICATION_CHAT_STREAM_EVENT_SCHEMA,
      streamId: "stream-0001",
      sequence: 1,
      type: "complete",
    };
    assert.ok(listener);
    (listener as (event: ApplicationChatStreamEvent) => void)(streamEvent);
    assert.deepEqual(sent, [{ channel: APPLICATION_CHAT_CHANNELS.streamEvent, payload: streamEvent }]);
  } finally {
    cleanup();
  }
  assert.equal(ipcMain.handlers.size, 0);
  assert.equal(listener, null);
});
