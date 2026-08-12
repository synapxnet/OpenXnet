import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_VRM_PRESENTATION_CHANNELS,
  type ApplicationVrmPresentationEvent,
} from "../contracts/application-vrm-presentation-runtime";
import { ApplicationVrmPresentationRuntimeService } from "./application-vrm-presentation-runtime";

test("VRM Presentation Runtime reports targets and broadcasts bounded events", () => {
  const deliveries: Array<{ channel: string; event: ApplicationVrmPresentationEvent }> = [];
  const runtime = new ApplicationVrmPresentationRuntimeService({
    getTargets: () => [
      {
        send: (channel, event) => deliveries.push({ channel, event }),
      },
      {
        send: () => {
          throw new Error("closed window");
        },
      },
    ],
    now: () => 1234,
  });

  assert.deepEqual(runtime.getStatus(), { connections: 2 });
  assert.deepEqual(runtime.publish({
    type: "startSpeaking",
    data: {
      audioDataUrl: "data:audio/mpeg;base64,AQID",
      chunkIndex: 0,
      totalChunks: 1,
      text: "测试",
      expressions: ["happy"],
      voice: "default",
    },
  }), { delivered: 1 });
  assert.equal(deliveries[0]?.channel, APPLICATION_VRM_PRESENTATION_CHANNELS.event);
  assert.deepEqual(deliveries[0]?.event, {
    type: "startSpeaking",
    data: {
      audioDataUrl: "data:audio/mpeg;base64,AQID",
      chunkIndex: 0,
      totalChunks: 1,
      text: "测试",
      expressions: ["happy"],
      voice: "default",
    },
    timestamp: 1234,
  });
});

test("VRM Presentation Runtime accepts fixed empty and streaming event shapes", () => {
  const events: ApplicationVrmPresentationEvent[] = [];
  const runtime = new ApplicationVrmPresentationRuntimeService({
    getTargets: () => [{ send: (_channel, event) => events.push(event) }],
    now: () => 2,
  });

  assert.deepEqual(runtime.publish({ type: "stopSpeaking", data: {} }), { delivered: 1 });
  assert.deepEqual(runtime.publish({
    type: "omniStreaming",
    data: { audioData: "AQID", text: "", sampleRate: 24_000, timestamp: 1 },
  }), { delivered: 1 });
  assert.equal(events.length, 2);
});

test("VRM Presentation Runtime rejects unknown fields and oversized audio", () => {
  const runtime = new ApplicationVrmPresentationRuntimeService({ getTargets: () => [] });
  assert.throws(() => runtime.publish({ type: "unknown", data: {} }), /type is invalid/);
  assert.throws(
    () => runtime.publish({ type: "stopSpeaking", data: { secret: "value" } }),
    /data is invalid/,
  );
  assert.throws(
    () => runtime.publish({
      type: "omniStreaming",
      data: { audioData: "a".repeat(8 * 1024 * 1024 + 1), text: "", sampleRate: 24_000, timestamp: 1 },
    }),
    /audioData is invalid/,
  );
});

test("VRM Presentation Runtime returns a detached bounded configuration", async () => {
  const source = { selectedModelId: "model-one", defaultModels: [] };
  const runtime = new ApplicationVrmPresentationRuntimeService({
    getTargets: () => [],
    readConfiguration: () => ({ language: "zh-CN", vrmConfig: source }),
  });

  const result = await runtime.getConfiguration();
  source.selectedModelId = "changed";
  assert.deepEqual(result, {
    language: "zh-CN",
    vrmConfig: { selectedModelId: "model-one", defaultModels: [] },
  });
});
