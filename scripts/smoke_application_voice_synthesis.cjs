"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationVoiceRuntimeService,
  LocalUiGateway,
  registerApplicationVoiceRuntimeIpc,
} = require("../build-ts/desktop");

/** 在真实 preload 中请求一次语音合成；输入窗口，返回公开音频摘要，IPC 失败时拒绝。 */
async function exerciseRenderer(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const result = await window.openxnetDesktop.synthesizeApplicationVoice({
        text: 'Electron 语音',
        voice: 'default',
        index: 3,
        mobileOptimized: false,
      });
      const system = await window.openxnetDesktop.listApplicationSystemVoices();
      const provider = await window.openxnetDesktop.listApplicationProviderVoices({
        provider: 'azure',
        credentialScope: 'default',
      });
      const reference = await window.openxnetDesktop.importApplicationVoiceReference(
        new File([Uint8Array.from([9, 8, 7])], 'reference.wav', { type: 'audio/wav' }),
      );
      const removedReference = await window.openxnetDesktop.removeApplicationVoiceReference({
        storageName: reference.storageName,
      });
      return {
        bytes: Array.from(new Uint8Array(result.audio)),
        mediaType: result.mediaType,
        format: result.format,
        keys: Object.keys(result).sort(),
        system,
        provider,
        reference,
        removedReference,
      };
    })()
  `, true);
}

/** 运行真实 Electron 合成 smoke；无输入，输出 JSON；边界或资源清理断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-voice-synthesis-smoke-"));
  const staticRoot = path.join(root, "ui");
  const exchangeRoot = path.join(root, "voice-exchange");
  const calls = [];
  let voiceActivations = 0;
  let backendActivations = 0;
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  try {
    mkdirSync(staticRoot, { recursive: true });
    mkdirSync(exchangeRoot, { recursive: true });
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><html><body>Voice synthesis smoke</body></html>", "utf8");
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      /** 拒绝 legacy backend 激活；无输入和返回；被调用时累计并抛错。 */
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Voice synthesis smoke must not activate the legacy backend.");
      },
    });
    const origin = await gateway.start();
    const runtime = new ApplicationVoiceRuntimeService({
      /** 记录 Voice capability 激活；输入能力名，返回固定状态，不启动进程。 */
      core: {
        ensureCapability: async (capability) => {
          assert.equal(capability, "voice");
          voiceActivations += 1;
          return {};
        },
      },
      supervisor: {
        /** 写入一次受控 Worker 音频；输入能力、方法和 payload，返回私有文件元数据。 */
        request: async (capability, method, payload) => {
          assert.equal(capability, "voice");
          calls.push({ method, payload });
          if (method === "voice.list-system-voices") {
            return { voices: [{ id: "system-one", name: "System One", lang: "zh-CN" }] };
          }
          if (method === "voice.list-provider-voices") {
            return { voices: [{ id: "azure-one", name: "Azure One", locale: "zh-CN" }] };
          }
          assert.equal(method, "voice.synthesize");
          const artifactPath = path.join(exchangeRoot, "voice-output-electron.mp3");
          writeFileSync(artifactPath, Buffer.from([1, 2, 3, 4]));
          return {
            artifactPath,
            byteLength: 4,
            mediaType: "audio/mpeg",
            format: "mp3",
          };
        },
      },
      exchangeRoot,
      referenceRoot: path.join(root, "uploaded_files"),
      readAsrSettings: () => ({ engine: "sherpa" }),
      readTtsSettings: () => ({ engine: "edgetts", edgettsVoice: "XiaoyiNeural" }),
    });
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    cleanupIpc = registerApplicationVoiceRuntimeIpc({
      ipcMain,
      runtime,
      /** 授权 smoke 页面；输入 IPC 事件，无返回；发送者不是当前窗口时抛错。 */
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) {
          throw new Error("Voice synthesis smoke IPC sender is not authorized.");
        }
      },
    });
    await window.loadURL(origin);
    const result = await exerciseRenderer(window);
    assert.deepEqual(result.bytes, [1, 2, 3, 4]);
    assert.equal(result.mediaType, "audio/mpeg");
    assert.equal(result.format, "mp3");
    assert.deepEqual(result.keys, ["audio", "format", "mediaType"]);
    assert.deepEqual(result.system, {
      voices: [{ id: "system-one", name: "System One", lang: "zh-CN" }],
    });
    assert.deepEqual(result.provider, {
      voices: [{ id: "azure-one", name: "Azure One", locale: "zh-CN" }],
    });
    assert.equal(result.reference.originalName, "reference.wav");
    assert.equal(result.reference.sizeBytes, 3);
    assert.match(result.reference.storageName, /^[0-9a-f-]{36}\.wav$/i);
    assert.deepEqual(result.removedReference, {
      storageName: result.reference.storageName,
      removed: true,
    });
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], { method: "voice.synthesize", payload: {
      text: "Electron 语音",
      voice: "default",
      index: 3,
      mobileOptimized: false,
      format: "mp3",
      settings: { engine: "edgetts", edgettsVoice: "XiaoyiNeural" },
    } });
    assert.deepEqual(calls[1], { method: "voice.list-system-voices", payload: {} });
    assert.deepEqual(calls[2], { method: "voice.list-provider-voices", payload: {
      provider: "azure",
      credentialScope: "default",
      settings: { engine: "edgetts", edgettsVoice: "XiaoyiNeural" },
    } });
    assert.equal(voiceActivations, 3);
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      requests: calls.length,
      audioBytes: result.bytes.length,
      privateFields: result.keys.filter((key) => key.toLowerCase().includes("path")).length,
      voiceActivations,
      backendActivations,
    })}\n`);
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    rmSync(root, { recursive: true, force: true });
  }
}

/** 等待 Electron 就绪并运行 smoke；无输入和返回；失败时打印堆栈并以非零状态退出。 */
async function main() {
  try {
    await app.whenReady();
    await runSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
