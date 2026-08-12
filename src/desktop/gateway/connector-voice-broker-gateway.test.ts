import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CONNECTOR_VOICE_REQUEST_SCHEMA,
  ConnectorVoiceBrokerGateway,
} from "./connector-voice-broker-gateway";

test("ConnectorVoiceBrokerGateway 在鉴权和校验完成前不调用语音上游", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "connector-voice-auth-"));
  let calls = 0;
  const gateway = createGateway(root, {
    onCall: () => { calls += 1; },
  });
  try {
    const origin = await gateway.start();
    const unknown = await fetch(`${origin}/v1/connectors/unknown`, {
      method: "POST",
      headers: { Authorization: "Bearer connector-voice-test-token" },
      body: "{}",
    });
    const unauthorized = await fetch(`${origin}/v1/connectors/voice`, {
      method: "POST",
      body: "{}",
    });
    const invalid = await postVoice(origin, {
      schema: CONNECTOR_VOICE_REQUEST_SCHEMA,
      operation: "synthesize",
      text: "你好",
      voice: "default",
      index: 0,
      mobileOptimized: true,
      format: "opus",
      apiKey: "must-not-cross",
    });
    assert.equal(unknown.status, 404);
    assert.equal(unauthorized.status, 401);
    assert.equal(invalid.status, 422);
    assert.equal(calls, 0);
  } finally {
    await gateway.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("ConnectorVoiceBrokerGateway 仅转写交换目录中的普通音频文件", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "connector-voice-asr-"));
  const inputName = "connector-input-valid.audio";
  writeFileSync(path.join(root, inputName), Buffer.from("audio-data"));
  let capturedPath = "";
  const gateway = new ConnectorVoiceBrokerGateway({
    token: "connector-voice-test-token",
    exchangeRoot: root,
    transcribe: async (input) => {
      capturedPath = input.artifactPath;
      return " 识别结果 ";
    },
    synthesize: async () => ({ audio: Buffer.from("voice"), mediaType: "audio/mpeg" }),
  });
  try {
    const origin = await gateway.start();
    const response = await postVoice(origin, {
      schema: CONNECTOR_VOICE_REQUEST_SCHEMA,
      operation: "transcribe",
      artifactName: inputName,
      filename: "voice.ogg",
      format: "auto",
    });
    const payload = await response.json() as { text: string };
    assert.equal(response.status, 200);
    assert.equal(payload.text, "识别结果");
    assert.equal(capturedPath, path.join(root, inputName));
  } finally {
    await gateway.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("ConnectorVoiceBrokerGateway 将合成音频写为有界临时引用", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "connector-voice-tts-"));
  const gateway = new ConnectorVoiceBrokerGateway({
    token: "connector-voice-test-token",
    exchangeRoot: root,
    transcribe: async () => "",
    synthesize: async (input) => {
      assert.equal(input.text, "语音内容");
      assert.equal(input.mobileOptimized, true);
      return { audio: Buffer.from("synthetic-opus"), mediaType: "audio/ogg; charset=binary" };
    },
  });
  try {
    const origin = await gateway.start();
    const response = await postVoice(origin, {
      schema: CONNECTOR_VOICE_REQUEST_SCHEMA,
      operation: "synthesize",
      text: "语音内容",
      voice: "default",
      index: 2,
      mobileOptimized: true,
      format: "opus",
    });
    const payload = await response.json() as {
      artifactName: string;
      mediaType: string;
      byteLength: number;
    };
    assert.equal(response.status, 200);
    assert.match(payload.artifactName, /^connector-output-.*\.opus$/);
    assert.equal(payload.mediaType, "audio/ogg");
    assert.equal(payload.byteLength, Buffer.byteLength("synthetic-opus"));
    assert.equal(readFileSync(path.join(root, payload.artifactName), "utf8"), "synthetic-opus");
  } finally {
    await gateway.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("ConnectorVoiceBrokerGateway 拒绝符号链接、超限音频和原始上游错误", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "connector-voice-invalid-"));
  const outside = path.join(os.tmpdir(), `connector-voice-outside-${Date.now()}.audio`);
  writeFileSync(outside, Buffer.from("outside"));
  const linkName = "connector-input-link.audio";
  let symlinkAvailable = true;
  try {
    symlinkSync(outside, path.join(root, linkName));
  } catch {
    symlinkAvailable = false;
  }
  writeFileSync(path.join(root, "connector-input-large.audio"), Buffer.alloc(32));
  const gateway = new ConnectorVoiceBrokerGateway({
    token: "connector-voice-test-token",
    exchangeRoot: root,
    maxInputAudioBytes: 16,
    transcribe: async () => {
      throw new Error("provider rejected private-secret");
    },
    synthesize: async () => ({ audio: Buffer.from("voice"), mediaType: "audio/mpeg" }),
  });
  try {
    const origin = await gateway.start();
    if (symlinkAvailable) {
      const linked = await postVoice(origin, transcriptionRequest(linkName));
      assert.equal(linked.status, 422);
    }
    const oversized = await postVoice(origin, transcriptionRequest("connector-input-large.audio"));
    assert.equal(oversized.status, 413);
    writeFileSync(path.join(root, "connector-input-error.audio"), Buffer.from("valid"));
    const failed = await postVoice(origin, transcriptionRequest("connector-input-error.audio"));
    const body = await failed.text();
    assert.equal(failed.status, 503);
    assert.match(body, /CONNECTOR_VOICE_UNAVAILABLE/);
    assert.doesNotMatch(body, /private-secret/);
  } finally {
    await gateway.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});

/** 创建带有确定性语音处理器的 Broker 测试实例。 */
function createGateway(root: string, options: { onCall(): void }): ConnectorVoiceBrokerGateway {
  return new ConnectorVoiceBrokerGateway({
    token: "connector-voice-test-token",
    exchangeRoot: root,
    transcribe: async () => {
      options.onCall();
      return "text";
    },
    synthesize: async () => {
      options.onCall();
      return { audio: Buffer.from("voice"), mediaType: "audio/mpeg" };
    },
  });
}

/** 向 Broker 发送一个带正确 Bearer 的 JSON 请求。 */
function postVoice(origin: string, payload: object): Promise<Response> {
  return fetch(`${origin}/v1/connectors/voice`, {
    method: "POST",
    headers: {
      Authorization: "Bearer connector-voice-test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

/** 构造一个引用指定临时文件的转写请求。 */
function transcriptionRequest(artifactName: string): object {
  return {
    schema: CONNECTOR_VOICE_REQUEST_SCHEMA,
    operation: "transcribe",
    artifactName,
    filename: "voice.ogg",
    format: "auto",
  };
}
