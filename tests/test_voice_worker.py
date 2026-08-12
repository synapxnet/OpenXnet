# -*- coding: utf-8 -*-
"""验证依赖隔离的 Voice Worker 请求、临时文件和兼容客户端边界。"""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
from typing import Any

from py.workers.voice_worker import VoiceWorkerHandlers
from py.workers.configured_voice_engine import VoiceSynthesisResult
from py.voice_worker_client import VoiceWorkerClient


class FakeVoiceEngine:
    """用于验证 Sherpa handler 契约的轻量测试替身。"""

    def __init__(self) -> None:
        """创建带可观察释放状态的假引擎，无外部副作用。"""

        self.released = False

    def transcribe_file(self, audio_path: Path, model_name: str) -> str:
        """读取测试文件并返回确定性文本，用于断言引用传递。"""

        return f"{model_name}:{audio_path.read_bytes().decode('utf-8')}"

    def get_status(self, model_name: str) -> dict[str, object]:
        """返回轻量模型状态，不加载任何推理依赖。"""

        return {"modelName": model_name, "loaded": False}

    def release(self) -> None:
        """记录 handler 已请求释放缓存，不操作真实模型。"""

        self.released = True


class FakeConfiguredVoiceEngine:
    """用于验证配置化 ASR/TTS 协议和输出文件生命周期的异步替身。"""

    def __init__(self) -> None:
        """创建可记录设置与关闭状态的替身，不访问网络或文件系统。"""

        self.transcription_settings: Mapping[str, Any] | None = None
        self.catalog_request: tuple[str, str, Mapping[str, Any]] | None = None
        self.closed = False

    async def transcribe_file(
        self,
        audio_path: Path,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> str:
        """记录无密钥设置并按输入文件返回确定性文本。"""

        self.transcription_settings = settings
        return f"{format_name}:{audio_path.read_text(encoding='utf-8')}"

    async def synthesize(
        self,
        text: str,
        voice: str,
        index: int,
        mobile_optimized: bool,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> VoiceSynthesisResult:
        """返回固定 MP3 字节，用于验证 Worker 只返回临时文件引用。"""

        del voice, index, mobile_optimized, format_name, settings
        return VoiceSynthesisResult(f"audio:{text}".encode("utf-8"), "audio/mpeg", "mp3")

    async def list_system_voices(self) -> list[dict[str, Any]]:
        """返回固定系统目录，用于验证公开字段投影。"""

        return [{"id": "system-one", "name": "System One", "lang": "zh-CN"}]

    async def list_provider_voices(
        self,
        provider: str,
        credential_scope: str,
        settings: Mapping[str, Any],
    ) -> list[Any]:
        """记录供应商目录参数并返回字符串与异构对象，供规范化断言使用。"""

        self.catalog_request = (provider, credential_scope, settings)
        return [
            "voice-one",
            {"Id": "voice-two", "DisplayName": "Voice Two", "Locale": "zh-CN"},
        ]

    async def close(self) -> None:
        """记录配置化引擎已关闭，模拟释放连接缓存。"""

        self.closed = True


class VoiceWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """验证 Worker 的文件边界、配置协议和延迟依赖行为。"""

    async def test_transcribe_uses_artifact_reference(self) -> None:
        """读取有界音频引用并返回标准化转写元数据。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            exchange_root = Path(directory) / "exchange"
            artifact_path = exchange_root / "audio.test"
            exchange_root.mkdir()
            artifact_path.write_text("speech", encoding="utf-8")
            handlers = VoiceWorkerHandlers(
                exchange_root,
                Path(directory) / "models",
                engine=FakeVoiceEngine(),  # type: ignore[arg-type]
            )

            result = await handlers.transcribe(
                {"artifactPath": str(artifact_path), "modelName": "test-model"}
            )

        self.assertEqual(result["text"], "test-model:speech")
        self.assertEqual(result["artifactBytes"], 6)

    async def test_rejects_artifact_outside_exchange_root(self) -> None:
        """拒绝交换目录外的路径，防止 Worker 读取任意本地文件。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            outside_path = root / "outside.wav"
            exchange_root.mkdir()
            outside_path.write_bytes(b"audio")
            handlers = VoiceWorkerHandlers(
                exchange_root,
                root / "models",
                engine=FakeVoiceEngine(),  # type: ignore[arg-type]
            )

            with self.assertRaisesRegex(ValueError, "outside"):
                await handlers.transcribe({"artifactPath": str(outside_path)})

    async def test_status_does_not_import_inference_dependencies(self) -> None:
        """轻量状态检查期间保持 Sherpa、SoundFile 和 NumPy 未加载。"""

        lazy_dependencies = (
            "sherpa_onnx",
            "soundfile",
            "numpy",
            "httpx",
            "openai",
            "websockets",
            "edge_tts",
            "pydub",
            "tetos",
            "elevenlabs",
            "pyttsx3",
        )
        before = {name for name in lazy_dependencies if name in sys.modules}
        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            handlers = VoiceWorkerHandlers(root / "exchange", root / "models")
            result = handlers.status({})
        after = {name for name in lazy_dependencies if name in sys.modules}

        self.assertEqual(after, before)
        self.assertIn("dependencyAvailable", result)

    async def test_configured_transcription_receives_detached_settings(self) -> None:
        """配置化 ASR 只接收复制后的设置，并继续通过文件引用读取音频。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            exchange_root.mkdir()
            artifact_path = exchange_root / "configured.wav"
            artifact_path.write_text("speech", encoding="utf-8")
            configured_engine = FakeConfiguredVoiceEngine()
            settings = {"engine": "openai", "selectedProvider": "provider-1"}
            handlers = VoiceWorkerHandlers(
                exchange_root,
                root / "models",
                engine=FakeVoiceEngine(),  # type: ignore[arg-type]
                configured_engine=configured_engine,  # type: ignore[arg-type]
                user_data_root=root / "user-data",
            )

            result = await handlers.transcribe_configured({
                "artifactPath": str(artifact_path),
                "format": "wav",
                "settings": settings,
            })
            settings["engine"] = "changed"

        self.assertEqual(result["text"], "wav:speech")
        self.assertEqual(configured_engine.transcription_settings["engine"], "openai")

    async def test_synthesis_returns_private_artifact_reference(self) -> None:
        """TTS 响应只返回交换目录中的一次性文件引用和可验证元数据。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            configured_engine = FakeConfiguredVoiceEngine()
            handlers = VoiceWorkerHandlers(
                root / "exchange",
                root / "models",
                engine=FakeVoiceEngine(),  # type: ignore[arg-type]
                configured_engine=configured_engine,  # type: ignore[arg-type]
                user_data_root=root / "user-data",
            )

            result = await handlers.synthesize({
                "text": "你好",
                "voice": "default",
                "index": 1,
                "mobileOptimized": False,
                "format": "mp3",
                "settings": {"engine": "edgetts"},
            })
            artifact_path = Path(str(result["artifactPath"]))
            artifact_bytes = artifact_path.read_bytes()

        self.assertTrue(artifact_path.name.startswith("voice-output-"))
        self.assertEqual(artifact_bytes, "audio:你好".encode("utf-8"))
        self.assertEqual(result["byteLength"], len(artifact_bytes))
        self.assertEqual(result["mediaType"], "audio/mpeg")

    async def test_voice_catalogs_are_bounded_and_normalized(self) -> None:
        """系统与供应商目录只返回规范字段，并把设置保留在 Worker 请求内。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            configured_engine = FakeConfiguredVoiceEngine()
            handlers = VoiceWorkerHandlers(
                root / "exchange",
                root / "models",
                engine=FakeVoiceEngine(),  # type: ignore[arg-type]
                configured_engine=configured_engine,  # type: ignore[arg-type]
                user_data_root=root / "user-data",
            )
            system = await handlers.list_system_voices({})
            provider = await handlers.list_provider_voices({
                "provider": "azure",
                "credentialScope": "default",
                "settings": {"engine": "azure"},
            })

        self.assertEqual(system["voices"], [
            {"id": "system-one", "name": "System One", "lang": "zh-CN"},
        ])
        self.assertEqual(provider["voices"], [
            {"id": "voice-one", "name": "voice-one"},
            {
                "id": "voice-two",
                "name": "Voice Two",
                "displayName": "Voice Two",
                "locale": "zh-CN",
            },
        ])
        self.assertEqual(configured_engine.catalog_request, (
            "azure",
            "default",
            {"engine": "azure"},
        ))

    async def test_voice_catalog_rejects_unknown_provider_before_engine_call(self) -> None:
        """未知目录供应商在导入依赖或调用配置化引擎前失败。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            configured_engine = FakeConfiguredVoiceEngine()
            handlers = VoiceWorkerHandlers(
                root / "exchange",
                root / "models",
                engine=FakeVoiceEngine(),  # type: ignore[arg-type]
                configured_engine=configured_engine,  # type: ignore[arg-type]
                user_data_root=root / "user-data",
            )
            with self.assertRaisesRegex(ValueError, "provider"):
                await handlers.list_provider_voices({
                    "provider": "unknown",
                    "credentialScope": "default",
                    "settings": {},
                })

        self.assertIsNone(configured_engine.catalog_request)

    async def test_release_closes_both_voice_engines(self) -> None:
        """release 同时释放 Sherpa 缓存和供应商连接缓存。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-worker-") as directory:
            root = Path(directory)
            sherpa_engine = FakeVoiceEngine()
            configured_engine = FakeConfiguredVoiceEngine()
            handlers = VoiceWorkerHandlers(
                root / "exchange",
                root / "models",
                engine=sherpa_engine,  # type: ignore[arg-type]
                configured_engine=configured_engine,  # type: ignore[arg-type]
                user_data_root=root / "user-data",
            )

            result = await handlers.release({})

        self.assertEqual(result, {"released": True})
        self.assertTrue(sherpa_engine.released)
        self.assertTrue(configured_engine.closed)


class RecordingVoiceWorkerClient(VoiceWorkerClient):
    """记录输入文件引用而不打开 HTTP 的客户端测试替身。"""

    def __init__(self, exchange_root: Path) -> None:
        """创建绑定临时交换目录的已配置客户端。"""

        super().__init__("http://127.0.0.1:1", "token", exchange_root)
        self.artifact_path: Path | None = None

    def _request_sync(self, method: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """记录请求期间仍存在的音频文件，并返回固定转写文本。"""

        self.assert_request(method, payload)
        return {"text": "worker text"}

    def assert_request(self, method: str, payload: Mapping[str, Any]) -> None:
        """校验方法和音频引用，并保存路径供清理断言使用。"""

        if method != "voice.transcribe":
            raise AssertionError(f"Unexpected method: {method}")
        artifact_value = payload.get("artifactPath")
        if not isinstance(artifact_value, str):
            raise AssertionError("artifactPath was not text")
        self.artifact_path = Path(artifact_value)
        if not self.artifact_path.is_file():
            raise AssertionError("artifact was not present during RPC")


class SynthesisVoiceWorkerClient(VoiceWorkerClient):
    """在交换目录生成模拟 Worker 输出，用于验证兼容客户端读取与清理。"""

    def __init__(self, exchange_root: Path) -> None:
        """创建已配置客户端并预留输出路径记录，无网络副作用。"""

        super().__init__("http://127.0.0.1:1", "token", exchange_root)
        self.output_path: Path | None = None

    def _request_sync(self, method: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """模拟 `voice.synthesize`，写入固定 MP3 文件并返回匹配元数据。"""

        if method != "voice.synthesize" or payload.get("text") != "你好":
            raise AssertionError("Unexpected synthesis request")
        self._exchange_root.mkdir(parents=True, exist_ok=True)
        self.output_path = self._exchange_root / "voice-output-test.mp3"
        self.output_path.write_bytes(b"mp3-audio")
        return {
            "artifactPath": str(self.output_path),
            "byteLength": 9,
            "mediaType": "audio/mpeg",
        }


class VoiceWorkerClientTests(unittest.IsolatedAsyncioTestCase):
    """验证 legacy 适配器的文件生命周期和配置行为。"""

    async def test_transcribe_removes_exchange_artifact(self) -> None:
        """Worker RPC 成功后删除私有输入音频文件。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-client-") as directory:
            client = RecordingVoiceWorkerClient(Path(directory))
            text = await client.transcribe(b"audio-bytes", "test-model")
            artifact_path = client.artifact_path

        self.assertEqual(text, "worker text")
        self.assertIsNotNone(artifact_path)
        self.assertFalse(artifact_path.exists())

    async def test_legacy_sherpa_api_delegates_to_voice_worker(self) -> None:
        """旧模块 API 委托 Worker，且不在 legacy 进程加载推理依赖。"""

        with patch(
            "py.sherpa_asr.transcribe_with_voice_worker",
            new_callable=AsyncMock,
            return_value="delegated text",
        ) as transcribe:
            from py.sherpa_asr import sherpa_recognize

            result = await sherpa_recognize(b"audio", "test-model")

        self.assertEqual(result, "delegated text")
        transcribe.assert_awaited_once_with(b"audio", "test-model")

    async def test_synthesis_reads_and_removes_worker_output(self) -> None:
        """兼容 TTS 客户端读取 Worker 输出后立即删除一次性文件。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-client-") as directory:
            client = SynthesisVoiceWorkerClient(Path(directory))
            audio, media_type = await client.synthesize({"text": "你好"})
            output_path = client.output_path

            self.assertEqual(audio, b"mp3-audio")
            self.assertEqual(media_type, "audio/mpeg")
            self.assertIsNotNone(output_path)
            self.assertFalse(output_path.exists())

    async def test_invalid_output_path_is_not_deleted(self) -> None:
        """恶意 Worker 响应指向交换目录外文件时拒绝读取且不得删除该文件。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-client-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            outside_path = root / "voice-output-outside.mp3"
            outside_path.write_bytes(b"keep")
            client = VoiceWorkerClient("http://127.0.0.1:1", "token", exchange_root)

            with self.assertRaisesRegex(Exception, "outside"):
                client._read_output_artifact({
                    "artifactPath": str(outside_path),
                    "byteLength": 4,
                    "mediaType": "audio/mpeg",
                })

            self.assertTrue(outside_path.exists())

    async def test_compatibility_catalogs_delegate_to_bounded_worker_methods(self) -> None:
        """兼容客户端使用固定目录方法，并只返回 Worker 的有界公开音色字段。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-catalog-client-") as directory:
            client = VoiceWorkerClient(
                "http://127.0.0.1:1",
                "token",
                Path(directory),
            )
            with patch.object(
                client,
                "_request_sync",
                return_value={
                    "voices": [
                        {
                            "id": "voice-one",
                            "name": "Voice One",
                            "locale": "zh-CN",
                        }
                    ]
                },
            ) as request:
                system = await client.list_system_voices()
                provider = await client.list_provider_voices(
                    "azure",
                    "default",
                    {"engine": "azure"},
                )

        self.assertEqual(system, provider)
        self.assertEqual(request.call_args_list[0].args, ("voice.list-system-voices", {}))
        self.assertEqual(
            request.call_args_list[1].args,
            (
                "voice.list-provider-voices",
                {
                    "provider": "azure",
                    "credentialScope": "default",
                    "settings": {"engine": "azure"},
                },
            ),
        )

    async def test_compatibility_catalog_rejects_invalid_worker_fields(self) -> None:
        """Worker 目录包含路径或超出公开字段时，兼容客户端拒绝把响应交给 Browser。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-voice-catalog-client-") as directory:
            client = VoiceWorkerClient(
                "http://127.0.0.1:1",
                "token",
                Path(directory),
            )
            with patch.object(
                client,
                "_request_sync",
                return_value={
                    "voices": [
                        {
                            "id": "voice-one",
                            "name": "Voice One",
                            "path": "C:\\private\\voice.bin",
                        }
                    ]
                },
            ):
                with self.assertRaisesRegex(Exception, "catalog item"):
                    await client.list_system_voices()

    async def test_desktop_server_delegates_catalogs_before_local_sdk_imports(self) -> None:
        """Desktop compatibility 音色目录先调用 Worker，本地 SDK 仅保留给独立 Server。"""

        server_source = (Path(__file__).resolve().parents[1] / "server.py").read_text(
            encoding="utf-8"
        )
        provider_section = server_source[
            server_source.index('@app.post("/tts/tetos/list_voices")'):
            server_source.index('@app.get("/system/voices")')
        ]
        system_section = server_source[
            server_source.index('@app.get("/system/voices")'):
            server_source.index("# 添加状态存储")
        ]
        self.assertLess(
            provider_section.index("list_provider_voices"),
            provider_section.index("from tetos.azure import AzureSpeaker"),
        )
        self.assertLess(
            system_section.index("list_system_voices"),
            system_section.index("import pyttsx3"),
        )

    async def test_desktop_server_spec_excludes_voice_sdk_payloads(self) -> None:
        """基础 Desktop 冻结配置排除 Voice Pack 已拥有的 SDK 与 FFmpeg 数据。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "server.spec").read_text(encoding="utf-8")
        requirements = (project_root / "requirements-voice.txt").read_text(encoding="utf-8")
        engine_source = (
            project_root / "py" / "workers" / "configured_voice_engine.py"
        ).read_text(encoding="utf-8")
        excluded_packages = (
            "edge_tts",
            "elevenlabs",
            "imageio_ffmpeg",
            "pydub",
            "pyttsx3",
            "tetos",
        )
        for package_name in excluded_packages:
            self.assertIn(f"'{package_name}'", spec_source)
        self.assertNotIn("ffmpeg_data", spec_source)
        self.assertNotIn("collect_data_files", spec_source)
        self.assertNotIn("importlib.metadata", engine_source)
        self.assertNotIn('distribution("tetos")', engine_source)
        self.assertIn('find_spec("tetos")', engine_source)
        for distribution_name in (
            "edge-tts",
            "elevenlabs",
            "imageio-ffmpeg",
            "pydub",
            "pyttsx3",
            "tetos",
        ):
            self.assertIn(distribution_name, requirements.lower())


if __name__ == "__main__":
    unittest.main()
