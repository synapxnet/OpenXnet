# -*- coding: utf-8 -*-
"""验证 Connector Worker 私有语音客户端和临时文件边界。"""

from __future__ import annotations

import os
from pathlib import Path
import tempfile
from unittest.mock import patch
import unittest

from py.connector_voice_client import (
    CONNECTOR_VOICE_RESULT_SCHEMA,
    ConnectorVoiceClientError,
    resolve_connector_voice_configuration,
    synthesize_connector_speech,
    transcribe_connector_audio,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
VOICE_MANAGER_FILES = (
    "feishu_bot_manager.py",
    "discord_bot_manager.py",
    "slack_bot_manager.py",
)


class ConnectorVoiceClientTests(unittest.IsolatedAsyncioTestCase):
    """覆盖私有配置、音频清理和 Manager 迁移约束。"""

    def test_private_configuration_is_exact_and_fails_closed(self) -> None:
        """只接受完整的回环地址、随机令牌和绝对交换目录。"""

        with tempfile.TemporaryDirectory() as directory:
            valid = {
                "OPENXNET_CONNECTOR_VOICE_ORIGIN": "http://127.0.0.1:4567/",
                "OPENXNET_CONNECTOR_VOICE_TOKEN": "connector-private-token",
                "OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR": directory,
            }
            with patch.dict(os.environ, valid, clear=False):
                configuration = resolve_connector_voice_configuration()
            self.assertIsNotNone(configuration)
            assert configuration is not None
            self.assertEqual(configuration.origin, "http://127.0.0.1:4567")
            self.assertEqual(configuration.exchange_root, Path(directory).resolve())

            invalid = dict(valid)
            invalid["OPENXNET_CONNECTOR_VOICE_TOKEN"] = ""
            with patch.dict(os.environ, invalid, clear=False):
                with self.assertRaises(ConnectorVoiceClientError):
                    resolve_connector_voice_configuration()

    def test_server_mode_requires_all_private_values_to_be_absent(self) -> None:
        """三项私有配置都缺失时才允许 Server 兼容模式。"""

        with patch.dict(
            os.environ,
            {
                "OPENXNET_CONNECTOR_VOICE_ORIGIN": "",
                "OPENXNET_CONNECTOR_VOICE_TOKEN": "",
                "OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR": "",
            },
            clear=False,
        ):
            self.assertIsNone(resolve_connector_voice_configuration())

    async def test_private_transcription_uses_and_removes_one_input_artifact(self) -> None:
        """转写请求只发送临时文件名，并在请求结束后删除输入文件。"""

        with tempfile.TemporaryDirectory() as directory:
            environment = self._private_environment(directory)

            async def respond(_configuration, payload):
                """验证输入文件存在并返回确定性转写结果。"""

                artifact = Path(directory) / payload["artifactName"]
                self.assertTrue(artifact.is_file())
                self.assertEqual(artifact.read_bytes(), b"audio-data")
                return {
                    "schema": CONNECTOR_VOICE_RESULT_SCHEMA,
                    "operation": "transcribe",
                    "success": True,
                    "text": "识别文本",
                }

            with patch.dict(os.environ, environment, clear=False):
                with patch("py.connector_voice_client._post_private_request", side_effect=respond):
                    text = await transcribe_connector_audio(b"audio-data", "voice.ogg")

            self.assertEqual(text, "识别文本")
            self.assertEqual(list(Path(directory).glob("connector-input-*")), [])

    async def test_private_synthesis_excludes_settings_and_removes_output(self) -> None:
        """私有合成请求不携带设置对象，并在读取后删除输出文件。"""

        with tempfile.TemporaryDirectory() as directory:
            environment = self._private_environment(directory)

            async def respond(_configuration, payload):
                """写入模拟输出文件并返回匹配的文件引用。"""

                self.assertNotIn("ttsSettings", payload)
                artifact_name = "connector-output-test.opus"
                artifact = Path(directory) / artifact_name
                artifact.write_bytes(b"voice-data")
                return {
                    "schema": CONNECTOR_VOICE_RESULT_SCHEMA,
                    "operation": "synthesize",
                    "success": True,
                    "artifactName": artifact_name,
                    "mediaType": "audio/ogg",
                    "byteLength": len(b"voice-data"),
                }

            with patch.dict(os.environ, environment, clear=False):
                with patch("py.connector_voice_client._post_private_request", side_effect=respond):
                    audio = await synthesize_connector_speech({
                        "text": "语音内容",
                        "voice": "default",
                        "ttsSettings": {"api_key": "must-not-cross"},
                        "index": 0,
                        "mobile_optimized": True,
                        "format": "opus",
                    })

            self.assertEqual(audio, b"voice-data")
            self.assertFalse((Path(directory) / "connector-output-test.opus").exists())

    def test_voice_managers_do_not_construct_direct_tts_or_asr_urls(self) -> None:
        """防止三个语音调用方重新绕过私有客户端访问后端。"""

        for file_name in VOICE_MANAGER_FILES:
            source = (PROJECT_ROOT / "py" / file_name).read_text(encoding="utf-8")
            with self.subTest(file_name=file_name):
                self.assertIn("py.connector_voice_client", source)
                self.assertNotRegex(source, r"127\.0\.0\.1:.*?/(?:tts|asr)")

    def _private_environment(self, directory: str) -> dict[str, str]:
        """构造一个完整且不会污染真实用户目录的私有配置。"""

        return {
            "OPENXNET_CONNECTOR_VOICE_ORIGIN": "http://127.0.0.1:4567",
            "OPENXNET_CONNECTOR_VOICE_TOKEN": "connector-private-token",
            "OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR": directory,
        }


if __name__ == "__main__":
    unittest.main()
