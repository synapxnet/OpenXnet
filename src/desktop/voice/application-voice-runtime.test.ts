import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ApplicationVoiceRuntimeService } from "./application-voice-runtime";

/** 创建可观察 Worker 请求的测试服务，并返回调用记录。 */
async function createTestRuntime(maxAudioBytes = 1024): Promise<{
  runtime: ApplicationVoiceRuntimeService;
  exchangeRoot: string;
  referenceRoot: string;
  calls: Array<{capability: string; method: string; payload: Readonly<Record<string, unknown>>}>;
}> {
  const exchangeRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-app-voice-"));
  const referenceRoot = path.join(exchangeRoot, "references");
  const calls: Array<{
    capability: string;
    method: string;
    payload: Readonly<Record<string, unknown>>;
  }> = [];
  const runtime = new ApplicationVoiceRuntimeService({
    core: {
      ensureCapability: async (capability) => {
        assert.equal(capability, "voice");
        return {} as never;
      },
    },
    supervisor: {
      request: async (capability, method, payload) => {
        assert.ok(payload !== undefined);
        calls.push({ capability, method, payload });
        if (method === "voice.synthesize") {
          const artifactPath = path.join(exchangeRoot, "voice-output-test.mp3");
          await writeFile(artifactPath, Buffer.from("speech"));
          return {
            artifactPath,
            byteLength: 6,
            mediaType: "audio/mpeg",
            format: "mp3",
          };
        }
        if (method === "voice.list-system-voices") {
          return { voices: [{ id: "system-one", name: "System One", lang: "zh-CN" }] };
        }
        if (method === "voice.list-provider-voices") {
          return {
            provider: "azure",
            credentialScope: "default",
            voices: [{ id: "azure-one", name: "Azure One", locale: "zh-CN" }],
          };
        }
        const artifactPath = String(payload.artifactPath);
        assert.deepEqual(await readFile(artifactPath), Buffer.from("voice"));
        return { text: "转写结果", engine: "openai" };
      },
    },
    exchangeRoot,
    referenceRoot,
    readAsrSettings: () => ({ engine: "openai", selectedProvider: "provider-1" }),
    readTtsSettings: () => ({ engine: "edgetts", newtts: {} }),
    maxAudioBytes,
  });
  return { runtime, exchangeRoot, referenceRoot, calls };
}

test("ApplicationVoiceRuntimeService writes one artifact and removes it after transcription", async (context) => {
  const { runtime, exchangeRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  const result = await runtime.transcribe({
    audio: Uint8Array.from(Buffer.from("voice")),
    format: "wav",
  });

  assert.deepEqual(result, { text: "转写结果", engine: "openai" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.capability, "voice");
  assert.equal(calls[0]?.method, "voice.transcribe-configured");
  assert.deepEqual(calls[0]?.payload.settings, {
    engine: "openai",
    selectedProvider: "provider-1",
  });
  await assert.rejects(readFile(String(calls[0]?.payload.artifactPath)), /ENOENT/);
  assert.equal(path.dirname(String(calls[0]?.payload.artifactPath)), exchangeRoot);
});

test("ApplicationVoiceRuntimeService returns bounded audio and removes the Worker artifact", async (context) => {
  const { runtime, exchangeRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  const result = await runtime.synthesize({
    text: "测试语音",
    voice: "default",
    index: 2,
    mobileOptimized: false,
  });

  assert.equal(Buffer.from(result.audio).toString("utf8"), "speech");
  assert.equal(result.mediaType, "audio/mpeg");
  assert.equal(result.format, "mp3");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "voice.synthesize");
  assert.deepEqual(calls[0]?.payload, {
    text: "测试语音",
    voice: "default",
    index: 2,
    mobileOptimized: false,
    format: "mp3",
    settings: { engine: "edgetts", newtts: {} },
  });
  await assert.rejects(readFile(path.join(exchangeRoot, "voice-output-test.mp3")), /ENOENT/);
});

test("ApplicationVoiceRuntimeService rejects malformed and oversized Renderer audio", async (context) => {
  const { runtime, exchangeRoot, calls } = await createTestRuntime(4);
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  await assert.rejects(runtime.transcribe({ audio: new ArrayBuffer(0), format: "wav" }), /size budget/);
  await assert.rejects(runtime.transcribe({ audio: new ArrayBuffer(5), format: "wav" }), /size budget/);
  await assert.rejects(runtime.transcribe({ audio: new ArrayBuffer(1), format: "pcm" }), /format/);
  await assert.rejects(
    runtime.transcribe({ audio: new ArrayBuffer(1), format: "wav", settings: {} }),
    /invalid/,
  );
  assert.equal(calls.length, 0);
});

test("ApplicationVoiceRuntimeService rejects malformed synthesis before Worker activation", async (context) => {
  const { runtime, exchangeRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  await assert.rejects(
    runtime.synthesize({ text: "", voice: "default", index: 0, mobileOptimized: false }),
    /text is invalid/,
  );
  await assert.rejects(
    runtime.synthesize({ text: "ok", voice: "default", index: -1, mobileOptimized: false }),
    /index is invalid/,
  );
  await assert.rejects(
    runtime.synthesize({
      text: "ok",
      voice: "default",
      index: 0,
      mobileOptimized: false,
      settings: {},
    }),
    /request is invalid/,
  );
  assert.equal(calls.length, 0);
});

test("ApplicationVoiceRuntimeService returns bounded system and Provider voice catalogs", async (context) => {
  const { runtime, exchangeRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  const system = await runtime.listSystemVoices();
  const provider = await runtime.listProviderVoices({
    provider: "azure",
    credentialScope: "default",
  });

  assert.deepEqual(system, { voices: [{ id: "system-one", name: "System One", lang: "zh-CN" }] });
  assert.deepEqual(provider, { voices: [{ id: "azure-one", name: "Azure One", locale: "zh-CN" }] });
  assert.equal(calls[0]?.method, "voice.list-system-voices");
  assert.deepEqual(calls[0]?.payload, {});
  assert.equal(calls[1]?.method, "voice.list-provider-voices");
  assert.deepEqual(calls[1]?.payload, {
    provider: "azure",
    credentialScope: "default",
    settings: { engine: "edgetts", newtts: {} },
  });
});

test("ApplicationVoiceRuntimeService rejects unknown voice catalogs before activation", async (context) => {
  const { runtime, exchangeRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  await assert.rejects(
    runtime.listProviderVoices({ provider: "unknown", credentialScope: "default" }),
    /provider is invalid/,
  );
  await assert.rejects(
    runtime.listProviderVoices({ provider: "azure", credentialScope: " invalid " }),
    /scope is invalid/,
  );
  assert.equal(calls.length, 0);
});

test("ApplicationVoiceRuntimeService imports and removes Main-owned reference audio", async (context) => {
  const { runtime, exchangeRoot, referenceRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  const sourcePath = path.join(exchangeRoot, "source.wav");
  await writeFile(sourcePath, Buffer.from("reference"));
  const imported = await runtime.importReference({
    entry: { source: "path", path: sourcePath, originalName: "sample.wav" },
  });

  assert.match(imported.storageName, /^[0-9a-f-]{36}\.wav$/i);
  assert.equal(imported.originalName, "sample.wav");
  assert.equal(imported.sizeBytes, 9);
  assert.deepEqual(await readFile(path.join(referenceRoot, imported.storageName)), Buffer.from("reference"));
  assert.deepEqual(await runtime.removeReference({ storageName: imported.storageName }), {
    storageName: imported.storageName,
    removed: true,
  });
  assert.deepEqual(await runtime.removeReference({ storageName: imported.storageName }), {
    storageName: imported.storageName,
    removed: false,
  });
  assert.equal(calls.length, 0);
});

test("ApplicationVoiceRuntimeService bounds inline references and rejects arbitrary deletion names", async (context) => {
  const { runtime, exchangeRoot, referenceRoot, calls } = await createTestRuntime();
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  const imported = await runtime.importReference({
    entry: {
      source: "bytes",
      originalName: "generated.mp3",
      bytes: Uint8Array.from([1, 2, 3]),
    },
  });

  assert.deepEqual(await readFile(path.join(referenceRoot, imported.storageName)), Buffer.from([1, 2, 3]));
  await assert.rejects(
    runtime.importReference({
      entry: { source: "bytes", originalName: "bad.exe", bytes: Uint8Array.from([1]) },
    }),
    /format is invalid/,
  );
  await assert.rejects(runtime.removeReference({ storageName: "../sample.wav" }), /storage name is invalid/);
  assert.equal(calls.length, 0);
});

test("ApplicationVoiceRuntimeService removes input after a fixed Worker failure", async (context) => {
  const exchangeRoot = await mkdtemp(path.join(os.tmpdir(), "openxnet-app-voice-failure-"));
  context.after(async () => rm(exchangeRoot, { recursive: true, force: true }));
  let artifactPath = "";
  const runtime = new ApplicationVoiceRuntimeService({
    core: { ensureCapability: async () => ({} as never) },
    supervisor: {
      request: async (_capability, _method, payload) => {
        assert.ok(payload !== undefined);
        artifactPath = String(payload.artifactPath);
        throw new Error("secret vendor failure");
      },
    },
    exchangeRoot,
    referenceRoot: path.join(exchangeRoot, "references"),
    readAsrSettings: () => ({ engine: "openai" }),
    readTtsSettings: () => ({ engine: "edgetts" }),
  });

  await assert.rejects(
    runtime.transcribe({ audio: Uint8Array.from([1, 2]), format: "wav" }),
    /^Error: Desktop voice transcription is unavailable\.$/,
  );
  await assert.rejects(readFile(artifactPath), /ENOENT/);
});
