import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationConnectorRuntimeMutationRequest,
  parseApplicationConnectorRuntimePlatformRequest,
} from "./application-connector-runtime";
import { isApplicationConnectorCredentialPlatform } from "./application-connector-credentials";

test("Connector Runtime contract accepts exact non-secret platform metadata", () => {
  const request = parseApplicationConnectorRuntimeMutationRequest({
    platform: "qq",
    configuration: {
      QQAgent: "openxnet-model",
      memoryLimit: 30,
      appid: "public-app-id",
      separators: [".", "!"],
      reasoningVisible: true,
      quickRestart: true,
      is_sandbox: false,
      toolMemorandumEnabled: true,
    },
  });
  assert.equal(request.platform, "qq");
  assert.equal(request.configuration.appid, "public-app-id");
  assert.equal(request.configuration.toolMemorandumEnabled, true);
  assert.deepEqual(
    parseApplicationConnectorRuntimePlatformRequest({ platform: "telegram" }),
    { platform: "telegram" },
  );
  assert.equal(isApplicationConnectorCredentialPlatform("telegram"), false);

  const telegramRequest = parseApplicationConnectorRuntimeMutationRequest({
    platform: "telegram",
    configuration: {
      TelegramAgent: "openxnet-model",
      memoryLimit: 20,
      separators: ["。", "\n"],
      reasoningVisible: false,
      quickRestart: true,
      enableTTS: true,
      wakeWord: "小新",
      behaviorSettings: { enabled: false, behaviorList: [] },
      behaviorTargetChatIds: ["123456"],
      toolMemorandumEnabled: false,
    },
  });
  assert.equal(telegramRequest.platform, "telegram");
  assert.equal(telegramRequest.configuration.enableTTS, true);
});

test("Connector Runtime contract rejects credentials and unsupported fields", () => {
  for (const configuration of [
    { llm_model: "openxnet-model", bot_token: "secret-token" },
    { llm_model: "openxnet-model", credentialFieldsConfigured: ["bot_token"] },
    { llm_model: "openxnet-model", behaviorSettings: { access_token: "secret-token" } },
    { llm_model: "openxnet-model", memory_settings: {} },
  ]) {
    assert.throws(
      () => parseApplicationConnectorRuntimeMutationRequest({ platform: "slack", configuration }),
      /configuration fields are invalid/,
    );
  }
  assert.throws(
    () => parseApplicationConnectorRuntimeMutationRequest({
      platform: "telegram",
      configuration: { TelegramAgent: "openxnet-model", bot_token: "secret-token" },
    }),
    /configuration fields are invalid/,
  );
});
