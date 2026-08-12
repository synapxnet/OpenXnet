# -*- coding: utf-8 -*-
"""验证 Connector 设置快照在 Desktop 与 Server 环境中的信任边界。"""

from __future__ import annotations

import os
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

from py.connector_settings import (
    PRIVATE_CONNECTOR_SETTINGS_ENV_NAMES,
    resolve_connector_behavior_snapshot,
    resolve_connector_tool_memorandum_enabled,
    resolve_connector_tts_settings,
    uses_private_connector_settings_snapshot,
)


class ConnectorSettingsTests(unittest.IsolatedAsyncioTestCase):
    """覆盖私有快照 fail-closed 规则和 Browser/Server 兼容读取。"""

    async def test_private_snapshot_never_loads_legacy_settings(self) -> None:
        """验证完整 Desktop 私有环境只使用请求投影，并且三个解析入口都不读取 legacy settings。"""

        private_environment = {
            name: f"private-{index}"
            for index, name in enumerate(PRIVATE_CONNECTOR_SETTINGS_ENV_NAMES)
        }
        load_settings = AsyncMock(side_effect=AssertionError("legacy settings were read"))
        with (
            patch.dict(os.environ, private_environment, clear=True),
            patch("py.connector_settings.load_settings", load_settings),
        ):
            behavior, target_ids = await resolve_connector_behavior_snapshot(
                {"enabled": True},
                ["chat-1"],
                "slackBotConfig",
            )
            memorandum_enabled = await resolve_connector_tool_memorandum_enabled(True)
            tts_settings = await resolve_connector_tts_settings()

        self.assertEqual(behavior, {"enabled": True})
        self.assertEqual(target_ids, ["chat-1"])
        self.assertTrue(memorandum_enabled)
        self.assertEqual(tts_settings, {})
        load_settings.assert_not_awaited()

    async def test_partial_private_snapshot_fails_closed_even_with_empty_value(self) -> None:
        """验证仅出现一个空私有环境变量时仍禁止降级读取，避免错误配置绕回兼容镜像。"""

        load_settings = AsyncMock(side_effect=AssertionError("legacy settings were read"))
        with (
            patch.dict(
                os.environ,
                {"OPENXNET_CONNECTOR_VOICE_TOKEN": ""},
                clear=True,
            ),
            patch("py.connector_settings.load_settings", load_settings),
        ):
            self.assertTrue(uses_private_connector_settings_snapshot())
            self.assertFalse(await resolve_connector_tool_memorandum_enabled(False))
            self.assertEqual(await resolve_connector_tts_settings(), {})

        load_settings.assert_not_awaited()

    async def test_server_snapshot_preserves_legacy_settings_compatibility(self) -> None:
        """验证没有私有环境时继续读取旧行为、目标、工具开关和 TTS 配置。"""

        settings = {
            "behaviorSettings": {"enabled": True},
            "slackBotConfig": {"behaviorTargetChatIds": ["legacy-chat"]},
            "tools": {"toolMemorandum": {"enabled": True}},
            "ttsSettings": {"engine": "edgetts"},
        }
        load_settings = AsyncMock(return_value=settings)
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("py.connector_settings.load_settings", load_settings),
        ):
            behavior, target_ids = await resolve_connector_behavior_snapshot(
                None,
                [],
                "slackBotConfig",
            )
            memorandum_enabled = await resolve_connector_tool_memorandum_enabled(False)
            tts_settings = await resolve_connector_tts_settings()

        self.assertEqual(behavior, {"enabled": True})
        self.assertEqual(target_ids, ["legacy-chat"])
        self.assertTrue(memorandum_enabled)
        self.assertEqual(tts_settings, {"engine": "edgetts"})
        self.assertEqual(load_settings.await_count, 3)

    def test_feature_pack_declares_settings_snapshot_module(self) -> None:
        """验证 Connector Pack 显式包含设置快照模块并使用本阶段版本，防止动态 Manager 导入时漏包。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "connector-worker.spec").read_text(
            encoding="utf-8",
        )
        build_source = (
            project_root / "scripts" / "build_connector_feature_pack.py"
        ).read_text(encoding="utf-8")

        self.assertIn('"py.connector_settings"', spec_source)
        self.assertIn('CONNECTOR_WORKER_VERSION = "1.6.0"', build_source)


if __name__ == "__main__":
    unittest.main()
