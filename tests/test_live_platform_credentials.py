# -*- coding: utf-8 -*-
"""Tests for Main-scoped live-platform credentials and route error safety."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from py import live_platform_credentials
from py import live_router
from py import live_runtime


def _encode_credentials(credentials):
    """Encode one valid live-platform runtime credential envelope."""

    payload = {
        "schema": live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class LivePlatformCredentialTests(unittest.TestCase):
    """Verify strict live-platform hydration and persistence redaction."""

    def setUp(self):
        """Reset cached credential state before each isolated test."""

        live_platform_credentials._reset_live_platform_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment state after each isolated test."""

        os.environ.pop(live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV, None)
        live_platform_credentials._reset_live_platform_credentials_cache_for_tests()

    def test_runtime_hydrates_only_live_secret_fields(self):
        """Inject five secrets while retaining public live-platform metadata."""

        credentials = {
            "bilibili_sessdata": "bilibili-cookie",
            "bilibili_ACCESS_KEY_SECRET": "bilibili-secret",
            "bilibili_ROOM_OWNER_AUTH_CODE": "owner-auth-code",
            "youtube_api_key": "youtube-secret",
            "twitch_access_token": "oauth:twitch-secret",
        }
        encoded = _encode_credentials(credentials)
        with patch.dict(os.environ, {live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV: encoded}):
            settings = live_platform_credentials.apply_live_platform_credentials({
                "liveConfig": {
                    "bilibili_ACCESS_KEY_ID": "public-access-id",
                    "bilibili_APP_ID": "public-app-id",
                    "youtube_vedio_id": "legacy-video-id",
                    "twitch_channel": "openxnet",
                },
            })

        configuration = settings["liveConfig"]
        for field, secret in credentials.items():
            self.assertEqual(configuration[field], secret)
        self.assertEqual(configuration["bilibili_ACCESS_KEY_ID"], "public-access-id")
        self.assertEqual(configuration["youtube_video_id"], "legacy-video-id")
        self.assertNotIn("youtube_vedio_id", configuration)
        self.assertNotIn(live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV, os.environ)

    def test_runtime_redacts_live_platform_persistence_fields(self):
        """Clear hydrated secrets while retaining configured names and metadata."""

        encoded = _encode_credentials({"youtube_api_key": "youtube-secret"})
        with patch.dict(os.environ, {live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV: encoded}):
            runtime = live_platform_credentials.apply_live_platform_credentials({
                "liveConfig": {
                    "youtube_video_id": "video-id",
                    "youtube_api_key": "",
                },
            })
            redacted = live_platform_credentials.redact_live_platform_credentials_for_persistence(
                runtime,
            )

        configuration = redacted["liveConfig"]
        self.assertEqual(configuration["youtube_api_key"], "")
        self.assertEqual(configuration["youtube_video_id"], "video-id")
        self.assertEqual(configuration["liveCredentialFieldsConfigured"], ["youtube_api_key"])
        self.assertNotIn("youtube-secret", json.dumps(redacted))

    def test_process_without_main_envelope_preserves_server_configuration(self):
        """Retain plaintext live settings for non-Desktop Server profiles."""

        settings = live_platform_credentials.apply_live_platform_credentials({
            "liveConfig": {
                "youtube_video_id": "video-id",
                "youtube_api_key": "server-secret",
            },
        })

        self.assertEqual(settings["liveConfig"]["youtube_api_key"], "server-secret")

    def test_runtime_envelope_rejects_unknown_fields_and_short_secrets(self):
        """Fail closed for unrelated fields and undersized live secrets."""

        invalid_cases = [
            {"github_token": "wrong-zone"},
            {"youtube_api_key": "abc"},
        ]
        for credentials in invalid_cases:
            with self.subTest(credentials=credentials):
                self.setUp()
                encoded = _encode_credentials(credentials)
                with patch.dict(
                    os.environ,
                    {live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV: encoded},
                ):
                    with self.assertRaises(RuntimeError):
                        live_platform_credentials.apply_live_platform_credentials({"liveConfig": {}})


class _FakeYouTubeClient:
    """Minimal YouTube client used to inspect hydrated route credentials."""

    captured_api_key = ""

    def __init__(self, api_key, video_id, on_message):
        """Capture route inputs without starting network traffic."""

        type(self).captured_api_key = api_key
        self.video_id = video_id
        self.on_message = on_message

    def start(self):
        """Represent successful non-blocking startup."""

    def stop(self):
        """Represent successful route cleanup."""


class LivePlatformRouteTests(unittest.IsolatedAsyncioTestCase):
    """Verify route hydration and generic credential-safe failures."""

    def setUp(self):
        """重置进程凭据并创建隔离路由控制器；无输入和返回值，不访问网络。"""

        live_platform_credentials._reset_live_platform_credentials_cache_for_tests()
        live_router.runtime = live_runtime.LiveRuntimeController(live_router.manager.broadcast)
        _FakeYouTubeClient.captured_api_key = ""

    def tearDown(self):
        """删除测试环境凭据；无输入和返回值，避免缓存污染后续测试。"""

        os.environ.pop(live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV, None)
        live_platform_credentials._reset_live_platform_credentials_cache_for_tests()

    async def test_start_route_hydrates_youtube_key_without_returning_it(self):
        """Use the Main-owned key while keeping the route result credential-free."""

        secret = "youtube-secret"
        encoded = _encode_credentials({"youtube_api_key": secret})
        request = live_router.LiveConfigRequest(config=live_router.LiveConfig(
            youtube_enabled=True,
            youtube_video_id="video-id",
        ))
        with (
            patch.dict(os.environ, {live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV: encoded}),
            patch("py.live_runtime.YouTubeDMClient", _FakeYouTubeClient),
            patch("py.live_runtime.asyncio.sleep", new=AsyncMock()),
        ):
            result = await live_router.start_live(request)

        self.assertTrue(result.success)
        self.assertEqual(_FakeYouTubeClient.captured_api_key, secret)
        self.assertNotIn(secret, result.message)

    async def test_start_route_replaces_credential_bearing_exceptions(self):
        """Return a stable error when a transport exception reflects its key."""

        secret = "youtube-secret"
        encoded = _encode_credentials({"youtube_api_key": secret})
        request = live_router.LiveConfigRequest(config=live_router.LiveConfig(
            youtube_enabled=True,
            youtube_video_id="video-id",
        ))

        def fail_client(*_args, **_kwargs):
            """Raise one synthetic credential-bearing transport failure."""

            raise RuntimeError(f"request failed with {secret}")

        with (
            patch.dict(os.environ, {live_platform_credentials.LIVE_PLATFORM_CREDENTIAL_ENV: encoded}),
            patch("py.live_runtime.YouTubeDMClient", side_effect=fail_client),
            patch("py.live_runtime.asyncio.sleep", new=AsyncMock()),
        ):
            result = await live_router.start_live(request)

        self.assertFalse(result.success)
        self.assertEqual(result.message, "直播监听启动失败")
        self.assertNotIn(secret, result.message)


if __name__ == "__main__":
    unittest.main()
