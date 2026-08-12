import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_VOICE_RUNTIME_CHANNELS } from "../contracts/application-voice-runtime";
import { registerApplicationVoiceRuntimeIpc } from "./register-application-voice-runtime-ipc";
import type { IpcMainLike } from "./register-core-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

/** 为 Voice Runtime IPC 测试保存和调用 handler 的最小实现。 */
class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** 保存一个合成 IPC handler，重复通道由调用方先清理。 */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** 删除给定通道的 handler，无返回值。 */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 使用测试事件和参数调用已注册 handler；缺失时断言失败。 */
  public invoke(channel: string, event: unknown, ...arguments_: readonly unknown[]): unknown {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined);
    return handler(event, ...arguments_);
  }
}

test("Application Voice Runtime IPC authorizes, dispatches, and cleans up", async () => {
  const ipcMain = new TestIpcMain();
  const authorizedEvent = { sender: "main" };
  const request = { audio: new ArrayBuffer(1), format: "wav" };
  const synthesisRequest = {
    text: "测试语音",
    voice: "default",
    index: 0,
    mobileOptimized: false,
  };
  const cleanup = registerApplicationVoiceRuntimeIpc({
    ipcMain,
    runtime: {
      transcribe: async (value) => {
        assert.equal(value, request);
        return { text: "结果", engine: "sherpa" };
      },
      synthesize: async (value) => {
        assert.equal(value, synthesisRequest);
        return {
          audio: Uint8Array.from([1, 2]).buffer,
          mediaType: "audio/mpeg",
          format: "mp3",
        };
      },
      listSystemVoices: async () => ({ voices: [{ id: "system", name: "System" }] }),
      listProviderVoices: async (value) => {
        assert.deepEqual(value, { provider: "azure", credentialScope: "default" });
        return { voices: [{ id: "azure", name: "Azure" }] };
      },
      importReference: async (value) => {
        assert.deepEqual(value, {
          entry: { source: "bytes", originalName: "sample.wav", bytes: Uint8Array.from([1]) },
        });
        return { storageName: "00000000-0000-4000-8000-000000000000.wav", originalName: "sample.wav", sizeBytes: 1 };
      },
      removeReference: async (value) => {
        assert.deepEqual(value, { storageName: "00000000-0000-4000-8000-000000000000.wav" });
        return { storageName: "00000000-0000-4000-8000-000000000000.wav", removed: true };
      },
    },
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) throw new Error("IPC sender is not authorized.");
    },
  });

  assert.deepEqual(
    await ipcMain.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe, authorizedEvent, request),
    { text: "结果", engine: "sherpa" },
  );
  const synthesisResult = await ipcMain.invoke(
    APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize,
    authorizedEvent,
    synthesisRequest,
  ) as { audio: ArrayBuffer; mediaType: string; format: string };
  assert.deepEqual([...new Uint8Array(synthesisResult.audio)], [1, 2]);
  assert.equal(synthesisResult.mediaType, "audio/mpeg");
  assert.equal(synthesisResult.format, "mp3");
  assert.deepEqual(
    await ipcMain.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices, authorizedEvent),
    { voices: [{ id: "system", name: "System" }] },
  );
  assert.deepEqual(
    await ipcMain.invoke(
      APPLICATION_VOICE_RUNTIME_CHANNELS.listProviderVoices,
      authorizedEvent,
      { provider: "azure", credentialScope: "default" },
    ),
    { voices: [{ id: "azure", name: "Azure" }] },
  );
  const referenceRequest = {
    entry: { source: "bytes", originalName: "sample.wav", bytes: Uint8Array.from([1]) },
  };
  assert.deepEqual(
    await ipcMain.invoke(
      APPLICATION_VOICE_RUNTIME_CHANNELS.importReference,
      authorizedEvent,
      referenceRequest,
    ),
    { storageName: "00000000-0000-4000-8000-000000000000.wav", originalName: "sample.wav", sizeBytes: 1 },
  );
  assert.deepEqual(
    await ipcMain.invoke(
      APPLICATION_VOICE_RUNTIME_CHANNELS.removeReference,
      authorizedEvent,
      { storageName: "00000000-0000-4000-8000-000000000000.wav" },
    ),
    { storageName: "00000000-0000-4000-8000-000000000000.wav", removed: true },
  );
  await assert.rejects(
    async () => ipcMain.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe, {}, request),
    /not authorized/,
  );
  await assert.rejects(
    async () => ipcMain.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices, {}),
    /not authorized/,
  );
  await assert.rejects(
    async () => ipcMain.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize, {}, synthesisRequest),
    /not authorized/,
  );
  cleanup();
  assert.equal(ipcMain.handlers.size, 0);
});
