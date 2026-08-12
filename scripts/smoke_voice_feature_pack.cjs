"use strict";

const fs = require("node:fs/promises");
const { createServer } = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  DesktopCore,
  FeaturePackManager,
  registerFeaturePackWorker,
  WorkerRpcGateway,
  WorkerSupervisor,
} = require("../build-ts/desktop");

/**
 * 解析 smoke 命令提供的 Feature Pack 目录；缺少参数时抛出用法错误。
 *
 * @returns {string} Absolute feature-pack source directory.
 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) {
    throw new Error("Usage: node scripts/smoke_voice_feature_pack.cjs <pack-directory>");
  }
  return path.resolve(argument);
}

/**
 * 向 Mock TTS 请求返回固定 WAV 字节；输入内容被丢弃且不会写入日志。
 *
 * @param {import("node:http").IncomingMessage} request 回环测试请求。
 * @param {import("node:http").ServerResponse} response 回环测试响应。
 * @returns {void} 响应在函数内同步结束。
 */
function handleMockTtsRequest(request, response) {
  request.resume();
  response.writeHead(200, {
    "Content-Type": "audio/wav",
    "Content-Length": 13,
    "Cache-Control": "no-store",
  });
  response.end(Buffer.from("mock-wav-data"));
}

/**
 * 启动只返回固定 WAV 字节的回环 Mock TTS，验证 Pack 内 HTTP 合成链路且不访问外网。
 *
 * @returns {Promise<{origin: string, stop: () => Promise<void>}>} Mock 地址和幂等关闭函数。
 */
async function startMockTtsServer() {
  const server = createServer(handleMockTtsRequest);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Mock TTS did not bind a TCP port.");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    stop: async () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/**
 * 安装并调用真实 Voice Pack，验证状态、配置化合成、输出文件和完整 RPC 边界。
 *
 * @returns {Promise<void>} Completion after the isolated smoke workspace is removed.
 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-voice-pack-smoke-"));
  const exchangeRoot = path.join(temporaryRoot, "exchange");
  const modelRoot = path.join(temporaryRoot, "models");
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const mockTts = await startMockTtsServer();
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "voice-pack-smoke-token",
    allowedMethods: {
      voice: ["voice.status", "voice.synthesize", "voice.list-provider-voices"],
    },
  });
  let unsubscribe = null;

  try {
    await core.start();
    const installed = await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "voice",
      createDefinition: (pack) => ({
        capability: "voice",
        command: pack.entrypointPath,
        arguments: [
          "--exchange-root", exchangeRoot,
          "--model-root", modelRoot,
          "--user-data-root", path.join(temporaryRoot, "user-data"),
        ],
        workingDirectory: pack.rootDirectory,
        requestTimeoutMs: 30_000,
        shutdownTimeoutMs: 3_000,
        idleTimeoutMs: 30_000,
      }),
    });
    if (unsubscribe === null) {
      throw new Error("Installed Voice pack was not discovered.");
    }
    const origin = await gateway.start();
    const response = await fetch(`${origin}/v1/workers/request`, {
      method: "POST",
      headers: {
        Authorization: "Bearer voice-pack-smoke-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ capability: "voice", method: "voice.status", payload: {} }),
    });
    const body = await response.json();
    if (
      !response.ok
      || body?.ok !== true
      || body?.payload?.dependencyAvailable !== true
      || !Array.isArray(body?.payload?.configured?.missingDependencies)
      || body.payload.configured.missingDependencies.length !== 0
      || !body.payload.configured.supportedAsrEngines.includes("openai")
      || !body.payload.configured.supportedTtsEngines.includes("elevenlabs")
    ) {
      throw new Error(`Packaged Voice Worker status failed: ${JSON.stringify(body)}`);
    }
    const catalogResponse = await fetch(`${origin}/v1/workers/request`, {
      method: "POST",
      headers: {
        Authorization: "Bearer voice-pack-smoke-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capability: "voice",
        method: "voice.list-provider-voices",
        payload: {
          provider: "azure",
          credentialScope: "default",
          settings: {},
        },
      }),
    });
    const catalogBody = await catalogResponse.json();
    if (
      !catalogResponse.ok
      || catalogBody?.ok !== true
      || catalogBody?.payload?.provider !== "azure"
      || !Array.isArray(catalogBody?.payload?.voices)
      || catalogBody.payload.voices.length < 1
    ) {
      throw new Error(`Packaged Voice Worker catalog failed: ${JSON.stringify(catalogBody)}`);
    }
    const synthesisResponse = await fetch(`${origin}/v1/workers/request`, {
      method: "POST",
      headers: {
        Authorization: "Bearer voice-pack-smoke-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capability: "voice",
        method: "voice.synthesize",
        payload: {
          text: "Pack smoke",
          voice: "default",
          index: 0,
          mobileOptimized: false,
          format: "wav",
          settings: {
            engine: "customTTS",
            customTTSserver: mockTts.origin,
            customTTSKeyText: "text",
            customTTSKeySpeaker: "speaker",
            customTTSKeySpeed: "speed",
          },
        },
      }),
    });
    const synthesisBody = await synthesisResponse.json();
    if (
      !synthesisResponse.ok
      || synthesisBody?.ok !== true
      || synthesisBody?.payload?.mediaType !== "audio/wav"
      || synthesisBody?.payload?.byteLength !== 13
    ) {
      throw new Error(`Packaged Voice Worker synthesis failed: ${JSON.stringify(synthesisBody)}`);
    }
    const outputPath = path.resolve(synthesisBody.payload.artifactPath);
    const outputAudio = await fs.readFile(outputPath);
    await fs.unlink(outputPath);
    if (!outputAudio.equals(Buffer.from("mock-wav-data"))) {
      throw new Error("Packaged Voice Worker synthesis artifact was invalid.");
    }
    process.stdout.write(`${JSON.stringify({
      packVersion: installed.manifest.version,
      capabilityState: core.getCapability("voice").state,
      worker: body.payload,
      synthesis: {
        mediaType: synthesisBody.payload.mediaType,
        byteLength: synthesisBody.payload.byteLength,
      },
      catalogVoices: catalogBody.payload.voices.length,
    }, null, 2)}\n`);
  } finally {
    await gateway.stop();
    await supervisor.stopAll();
    await mockTts.stop();
    unsubscribe?.();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
