# -*- coding: utf-8 -*-
"""验证 Telegram Client 只通过 Connector 私有 Chat/Voice 边界处理模型能力。"""

from __future__ import annotations

from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from py.connector_voice_client import ConnectorVoiceClientError
from py.telegram_client import TelegramClient


class RecordingTelegramSession:
    """记录 Telegram 上传请求且不访问网络。"""

    def __init__(self) -> None:
        """初始化空请求列表；无输入和返回值，不创建网络资源。"""

        self.posts: list[tuple[str, object]] = []

    async def post(self, url: str, *, data: object) -> object:
        """记录上传地址和表单；输入 URL 与数据，返回占位响应，不执行网络请求。"""

        self.posts.append((url, data))
        return object()


class DownloadResponse:
    """提供异步上下文协议的固定 Telegram 下载响应。"""

    status = 200

    async def __aenter__(self) -> DownloadResponse:
        """进入下载上下文；无输入，返回自身且不产生副作用。"""

        return self

    async def __aexit__(self, *_arguments: object) -> None:
        """退出下载上下文；忽略异常参数，无返回值且不屏蔽异常。"""

    async def read(self) -> bytes:
        """返回固定音频字节；无输入和副作用，不抛出网络异常。"""

        return b"telegram-audio"


class DownloadTelegramSession:
    """返回固定下载响应且不访问 Telegram。"""

    def get(self, _url: str) -> DownloadResponse:
        """构建下载上下文；输入 URL，返回固定响应，不执行网络请求。"""

        return DownloadResponse()


class RecordingCompletions:
    """记录主动行为 Chat 请求并返回固定回复。"""

    def __init__(self) -> None:
        """初始化空请求列表；无输入和返回值，不创建上游客户端。"""

        self.requests: list[dict[str, object]] = []

    async def create(self, **request: object) -> object:
        """记录 Chat 请求；输入关键字参数，返回固定响应，不访问供应商。"""

        self.requests.append(dict(request))
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="主动回复"))]
        )


class TelegramConnectorRuntimeTests(unittest.IsolatedAsyncioTestCase):
    """验证 Telegram 的私有 Broker 调用和固定失败语义。"""

    async def test_transcribe_forwards_audio_to_connector_voice_client(self) -> None:
        """确认 ASR 传递音频、文件名和格式，并把安全结果原样返回。"""

        client = object.__new__(TelegramClient)
        transcribe = AsyncMock(return_value="识别结果")
        with patch("py.telegram_client.transcribe_connector_audio", transcribe):
            result = await client._transcribe(b"audio")

        self.assertEqual(result, "识别结果")
        transcribe.assert_awaited_once_with(b"audio", "voice.ogg", "auto")

    async def test_empty_transcript_is_checked_before_wake_word(self) -> None:
        """确认空转写不会参与唤醒词包含判断，并向用户返回固定失败提示。"""

        client = object.__new__(TelegramClient)
        client.bot_token = "test-token"
        client.wakeWord = "小新"
        client.session = DownloadTelegramSession()
        client._get_file = AsyncMock(return_value={"file_path": "voice.ogg"})
        client._transcribe = AsyncMock(return_value=None)
        client._send_text = AsyncMock()
        client._process_llm = AsyncMock()

        await client._handle_voice(
            123,
            {"voice": {"file_id": "file-id"}, "message_id": 456},
        )

        client._send_text.assert_awaited_once_with(123, "语音转文字失败")
        client._process_llm.assert_not_awaited()

    async def test_send_voice_uses_connector_voice_client(self) -> None:
        """确认 TTS 只调用 Connector Voice Client，并把返回音频上传至 Telegram。"""

        client = object.__new__(TelegramClient)
        client.bot_token = "test-token"
        client.session = RecordingTelegramSession()
        synthesize = AsyncMock(return_value=b"opus-audio")
        with patch("py.telegram_client.synthesize_connector_speech", synthesize):
            await client._send_voice(123, "**你好**")

        request = synthesize.await_args.args[0]
        self.assertEqual(request["text"], "你好")
        self.assertEqual(request["format"], "opus")
        self.assertEqual(len(client.session.posts), 1)
        self.assertIn("/sendVoice", client.session.posts[0][0])

    async def test_send_voice_replaces_private_errors_with_fixed_message(self) -> None:
        """确认 Voice Broker 失败不会泄漏内部诊断，并只发送固定用户提示。"""

        client = object.__new__(TelegramClient)
        client._send_text = AsyncMock()
        synthesize = AsyncMock(
            side_effect=ConnectorVoiceClientError(
                "CONNECTOR_VOICE_UNAVAILABLE",
                "private upstream detail",
                True,
            )
        )
        with patch("py.telegram_client.synthesize_connector_speech", synthesize):
            await client._send_voice(123, "你好")

        client._send_text.assert_awaited_once_with(123, "语音生成失败，请稍后重试")

    async def test_behavior_event_uses_connector_chat_client(self) -> None:
        """确认主动行为通过私有 Chat Client 请求模型，并更新会话内存和 Telegram 文本。"""

        client = object.__new__(TelegramClient)
        client.TelegramAgent = "openxnet-model"
        client.memoryList = {}
        client.enableTTS = False
        client._resolve_behavior_prompt = AsyncMock(return_value="主动提示")
        client._send_text = AsyncMock()
        completions = RecordingCompletions()
        chat_client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
        behavior = SimpleNamespace(action=SimpleNamespace(type="prompt"))

        with patch("py.telegram_client.create_connector_chat_client", return_value=chat_client):
            await client.execute_behavior_event("123", behavior)

        self.assertEqual(completions.requests[0]["model"], "openxnet-model")
        self.assertFalse(completions.requests[0]["stream"])
        client._send_text.assert_awaited_once_with(123, "主动回复")
        self.assertEqual(client.memoryList[123][-1]["content"], "主动回复")


if __name__ == "__main__":
    unittest.main()
