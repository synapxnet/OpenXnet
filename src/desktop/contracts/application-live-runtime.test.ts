import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationLiveRuntimeEvent,
  parseApplicationLiveRuntimeMutationRequest,
} from "./application-live-runtime";

test("Live Runtime contract accepts exact non-secret metadata", () => {
  const request = parseApplicationLiveRuntimeMutationRequest({
    configuration: {
      bilibili_enabled: true,
      bilibili_type: "web",
      bilibili_room_id: "123456",
      bilibili_ACCESS_KEY_ID: "public-access-id",
      bilibili_APP_ID: "789",
      youtube_enabled: true,
      youtube_video_id: "video-id",
      twitch_enabled: true,
      twitch_channel: "channel",
    },
  });
  assert.equal(request.configuration.bilibili_room_id, "123456");
  assert.equal(request.configuration.youtube_enabled, true);
});

test("Live Runtime contract rejects credentials and unknown metadata", () => {
  for (const configuration of [
    { youtube_api_key: "secret" },
    { twitch_access_token: "secret" },
    { bilibili_enabled: "yes" },
    { bilibili_type: "invalid" },
    { unknown: "value" },
  ]) {
    assert.throws(
      () => parseApplicationLiveRuntimeMutationRequest({ configuration }),
      /Live Runtime/,
    );
  }
});

test("Live Runtime event contract bounds and maps Worker fields", () => {
  const event = parseApplicationLiveRuntimeEvent({
    id: "event-id",
    type: "message",
    content: "用户说：你好",
    danmu_type: "danmaku",
    platform: "bilibili",
  });
  assert.equal(event.danmuType, "danmaku");
  assert.equal(event.platform, "bilibili");
  assert.throws(
    () => parseApplicationLiveRuntimeEvent({
      id: "event-id",
      type: "message",
      content: "x".repeat(16 * 1024 + 1),
      danmu_type: "danmaku",
      platform: "bilibili",
    }),
    /field 'content' is invalid/,
  );
});
