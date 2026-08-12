# -*- coding: utf-8 -*-
"""通过隔离 Worker 协议提供本地与配置化 ASR/TTS 的 OpenXnet Voice Worker。"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
import json
import os
from pathlib import Path
import tempfile
import time
from typing import Any

from py.workers.runtime import WorkerRuntime
from py.workers.configured_voice_engine import ConfiguredVoiceEngine
from py.workers.voice_engine import DEFAULT_SHERPA_MODEL_NAME, SherpaAsrEngine


DEFAULT_MAX_AUDIO_BYTES = 64 * 1024 * 1024
DEFAULT_MAX_SETTINGS_BYTES = 2 * 1024 * 1024
DEFAULT_MAX_SYNTHESIS_BYTES = 25 * 1024 * 1024
DEFAULT_MAX_CATALOG_BYTES = 1024 * 1024
DEFAULT_MAX_CATALOG_ITEMS = 512
VOICE_OUTPUT_PREFIX = "voice-output-"


class VoiceWorkerHandlers:
    """校验 Voice Worker 请求，并把本地或供应商语音任务委托给延迟引擎。"""

    def __init__(
        self,
        exchange_root: Path,
        model_root: Path,
        *,
        engine: SherpaAsrEngine | None = None,
        configured_engine: ConfiguredVoiceEngine | None = None,
        user_data_root: Path | None = None,
        max_audio_bytes: int = DEFAULT_MAX_AUDIO_BYTES,
        max_settings_bytes: int = DEFAULT_MAX_SETTINGS_BYTES,
        max_synthesis_bytes: int = DEFAULT_MAX_SYNTHESIS_BYTES,
    ) -> None:
        """创建仅能访问应用交换目录的处理器；构造时不会加载模型或连接供应商。"""

        self._exchange_root = exchange_root.resolve()
        self._exchange_root.mkdir(parents=True, exist_ok=True)
        self._engine = engine or SherpaAsrEngine(model_root)
        resolved_user_data = (user_data_root or resolve_default_user_data_root()).resolve()
        self._configured_engine = configured_engine or ConfiguredVoiceEngine(
            model_root,
            resolved_user_data,
            sherpa_engine=self._engine,
            maximum_audio_bytes=max_synthesis_bytes,
        )
        self._max_audio_bytes = max_audio_bytes
        self._max_settings_bytes = max_settings_bytes
        self._max_synthesis_bytes = max_synthesis_bytes
        self._cleanup_stale_outputs()

    async def transcribe(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """使用本地 Sherpa 转写交换目录内的音频引用；输入输出均不携带二进制数据。"""

        artifact_path = self._resolve_audio_artifact(payload.get("artifactPath"))
        model_name = self._read_model_name(payload.get("modelName"))
        text = await asyncio.to_thread(
            self._engine.transcribe_file,
            artifact_path,
            model_name,
        )
        return {
            "text": text,
            "modelName": model_name,
            "artifactBytes": artifact_path.stat().st_size,
        }

    async def transcribe_configured(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """按无密钥 ASR 设置选择引擎并转写音频；凭据只由 Worker 进程环境补齐。"""

        artifact_path = self._resolve_audio_artifact(payload.get("artifactPath"))
        settings = self._read_settings(payload.get("settings"), "ASR")
        format_name = self._read_format(payload.get("format"), allow_auto=True)
        text = await self._configured_engine.transcribe_file(
            artifact_path,
            format_name,
            settings,
        )
        return {
            "text": text,
            "engine": str(settings.get("engine") or "openai").strip().lower(),
            "artifactBytes": artifact_path.stat().st_size,
        }

    async def synthesize(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """按无密钥 TTS 设置合成语音并写入私有输出文件，只返回文件引用和媒体元数据。"""

        text = self._read_text(payload.get("text"), "text", 20_000)
        voice = self._read_text(payload.get("voice", "default"), "voice", 128)
        index = self._read_index(payload.get("index", 0))
        mobile_optimized = payload.get("mobileOptimized", False)
        if not isinstance(mobile_optimized, bool):
            raise ValueError("Voice request mobileOptimized must be boolean.")
        format_name = self._read_format(payload.get("format"), allow_auto=False)
        settings = self._read_settings(payload.get("settings"), "TTS")
        result = await self._configured_engine.synthesize(
            text,
            voice,
            index,
            mobile_optimized,
            format_name,
            settings,
        )
        artifact_path = self._write_output_artifact(
            result.audio,
            result.format_name,
        )
        return {
            "artifactPath": str(artifact_path),
            "byteLength": len(result.audio),
            "mediaType": result.media_type,
            "format": result.format_name,
        }

    async def list_system_voices(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取并规范系统音色目录；显式请求才导入 pyttsx3，返回值不包含设备路径。"""

        voices = await self._configured_engine.list_system_voices()
        return {"voices": self._normalize_voice_catalog(voices)}

    async def list_provider_voices(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """按固定供应商和凭据作用域读取音色目录；设置与密钥不会出现在响应中。"""

        provider = self._read_provider(payload.get("provider"))
        credential_scope = self._read_text(
            payload.get("credentialScope", "default"),
            "credentialScope",
            128,
        )
        settings = self._read_settings(payload.get("settings"), "TTS")
        voices = await self._configured_engine.list_provider_voices(
            provider,
            credential_scope,
            settings,
        )
        return {
            "provider": provider,
            "credentialScope": credential_scope,
            "voices": self._normalize_voice_catalog(voices),
        }

    def status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """返回 Sherpa 模型可用性，不导入推理、网络或 TTS 重依赖。"""

        model_name = self._read_model_name(payload.get("modelName"))
        return {
            **self._engine.get_status(model_name),
            "configured": self._configured_engine.get_status(),
        }

    async def release(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """释放识别器和供应商连接缓存，但保留 Worker 进程以便后续按需重建。"""

        self._engine.release()
        await self._configured_engine.close()
        return {"released": True}

    def _resolve_audio_artifact(self, value: Any) -> Path:
        """校验音频路径属于交换目录中的有界普通文件；越界、链接或空文件均失败。"""

        if not isinstance(value, str) or not value.strip():
            raise ValueError("Voice request requires a non-empty artifactPath.")
        requested_path = Path(value)
        if requested_path.is_symlink():
            raise ValueError("Audio artifact symbolic links are not allowed.")
        artifact_path = requested_path.resolve()
        try:
            artifact_path.relative_to(self._exchange_root)
        except ValueError as error:
            raise ValueError("Audio artifact is outside the Voice Worker exchange root.") from error
        if not artifact_path.is_file() or artifact_path.is_symlink():
            raise FileNotFoundError(f"Audio artifact does not exist: {artifact_path}")
        artifact_size = artifact_path.stat().st_size
        if artifact_size <= 0 or artifact_size > self._max_audio_bytes:
            raise ValueError(
                f"Audio artifact size must be between 1 and {self._max_audio_bytes} bytes."
            )
        return artifact_path

    def _read_model_name(self, value: Any) -> str:
        """把可选模型名规范为安全单段文本；空值使用默认 Sherpa 模型。"""

        if value is None or value == "":
            return DEFAULT_SHERPA_MODEL_NAME
        if not isinstance(value, str):
            raise ValueError("Voice request modelName must be text.")
        model_name = value.strip()
        if not model_name:
            return DEFAULT_SHERPA_MODEL_NAME
        return model_name

    def _read_settings(self, value: Any, label: str) -> dict[str, Any]:
        """复制一个有界 JSON 设置对象；输入无效或序列化超限时拒绝请求。"""

        if not isinstance(value, Mapping):
            raise ValueError(f"Voice request {label} settings must be an object.")
        serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(serialized) > self._max_settings_bytes:
            raise ValueError(f"Voice request {label} settings exceed their size budget.")
        detached = json.loads(serialized.decode("utf-8"))
        if not isinstance(detached, dict):
            raise ValueError(f"Voice request {label} settings must be an object.")
        return detached

    def _read_text(self, value: Any, field_name: str, maximum_length: int) -> str:
        """读取有界非空文本并拒绝控制字符；失败时不回显原始内容。"""

        if not isinstance(value, str):
            raise ValueError(f"Voice request {field_name} must be text.")
        normalized = value.strip()
        if (
            not normalized
            or len(normalized) > maximum_length
            or any(ord(character) < 32 or ord(character) == 127 for character in normalized)
        ):
            raise ValueError(f"Voice request {field_name} is invalid.")
        return normalized

    def _read_index(self, value: Any) -> int:
        """读取 0 到 10000 的整数请求索引；布尔值不作为整数接受。"""

        if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 10_000:
            raise ValueError("Voice request index is invalid.")
        return value

    def _read_format(self, value: Any, *, allow_auto: bool) -> str:
        """校验支持的音频格式，并按调用场景决定是否允许 auto。"""

        normalized = str(value or ("auto" if allow_auto else "mp3")).strip().lower()
        supported = {"wav", "mp3", "flac", "ogg", "m4a", "opus", "aac"}
        if allow_auto:
            supported.add("auto")
        if normalized not in supported:
            raise ValueError("Voice request format is invalid.")
        return normalized

    def _read_provider(self, value: Any) -> str:
        """读取固定 Tetos 供应商标识；未知供应商在导入任何依赖前失败。"""

        provider = str(value or "").strip().lower()
        if provider not in {"azure", "volcengine", "baidu", "minimax", "xunfei", "fish", "google"}:
            raise ValueError("Voice catalog provider is invalid.")
        return provider

    def _normalize_voice_catalog(self, value: Any) -> list[dict[str, Any]]:
        """把供应商异构目录投影为最多 512 项公开字段，并限制 UTF-8 JSON 总大小。"""

        if not isinstance(value, list):
            raise ValueError("Voice catalog must be a list.")
        if len(value) > DEFAULT_MAX_CATALOG_ITEMS:
            raise ValueError("Voice catalog exceeds its item budget.")
        voices: list[dict[str, Any]] = []
        aliases = {
            "id": ("id", "Id", "ShortName"),
            "name": ("name", "Name", "DisplayName", "local_name", "title"),
            "displayName": ("displayName", "DisplayName", "local_name"),
            "shortName": ("shortName", "ShortName"),
            "locale": ("locale", "Locale", "language", "Language"),
            "description": ("description", "Description"),
            "originalName": ("originalName", "original_name"),
            "lang": ("lang",),
            "gender": ("gender", "Gender"),
        }
        for item in value:
            if isinstance(item, str):
                text = self._read_catalog_text(item, "voice")
                voices.append({"id": text, "name": text})
                continue
            if not isinstance(item, Mapping):
                raise ValueError("Voice catalog item is invalid.")
            normalized: dict[str, Any] = {}
            for target, candidates in aliases.items():
                for candidate in candidates:
                    if candidate in item and item[candidate] not in (None, ""):
                        normalized[target] = self._read_catalog_text(item[candidate], target)
                        break
            premium = item.get("premium", item.get("is_siri"))
            if isinstance(premium, bool):
                normalized["premium"] = premium
            if not normalized.get("id") and normalized.get("shortName"):
                normalized["id"] = normalized["shortName"]
            if not normalized.get("name") and normalized.get("displayName"):
                normalized["name"] = normalized["displayName"]
            if not normalized.get("id") or not normalized.get("name"):
                raise ValueError("Voice catalog item requires id and name.")
            voices.append(normalized)
        serialized = json.dumps(voices, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(serialized) > DEFAULT_MAX_CATALOG_BYTES:
            raise ValueError("Voice catalog exceeds its size budget.")
        return voices

    def _read_catalog_text(self, value: Any, field_name: str) -> str:
        """读取单个公开目录字段并限制为 512 字符；失败时不回显供应商原值。"""

        if not isinstance(value, str):
            raise ValueError(f"Voice catalog {field_name} must be text.")
        normalized = value.strip()
        if (
            not normalized
            or len(normalized) > 512
            or any(ord(character) < 32 or ord(character) == 127 for character in normalized)
        ):
            raise ValueError(f"Voice catalog {field_name} is invalid.")
        return normalized

    def _write_output_artifact(self, audio: bytes, format_name: str) -> Path:
        """以独占权限写入有界合成音频；写入失败时清理未完成文件并重新抛出。"""

        if not isinstance(audio, bytes) or not audio or len(audio) > self._max_synthesis_bytes:
            raise ValueError("Voice synthesis result is outside its size budget.")
        extension = {
            "mp3": ".mp3",
            "opus": ".opus",
            "wav": ".wav",
            "aac": ".aac",
            "flac": ".flac",
        }.get(format_name)
        if extension is None:
            raise ValueError("Voice synthesis result format is invalid.")
        descriptor, file_name = tempfile.mkstemp(
            prefix=VOICE_OUTPUT_PREFIX,
            suffix=extension,
            dir=self._exchange_root,
        )
        artifact_path = Path(file_name)
        try:
            with os.fdopen(descriptor, "wb") as output:
                output.write(audio)
                output.flush()
            artifact_path.chmod(0o600)
            return artifact_path
        except Exception:
            try:
                os.close(descriptor)
            except OSError:
                pass
            artifact_path.unlink(missing_ok=True)
            raise

    def _cleanup_stale_outputs(self) -> None:
        """删除超过一天的 Worker 输出临时文件；单个文件清理失败不会阻断 Worker 启动。"""

        cutoff = time.time() - 24 * 60 * 60
        for candidate in self._exchange_root.glob(f"{VOICE_OUTPUT_PREFIX}*"):
            try:
                if candidate.is_file() and not candidate.is_symlink() and candidate.stat().st_mtime < cutoff:
                    candidate.unlink(missing_ok=True)
            except OSError:
                continue


def resolve_default_exchange_root() -> Path:
    """从环境解析 Desktop Core 共享交换目录；未配置时使用系统临时目录。"""

    configured = os.environ.get("OPENXNET_VOICE_EXCHANGE_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path(tempfile.gettempdir()) / "openxnet-voice-exchange"


def resolve_default_model_root() -> Path:
    """从环境解析外置 ASR 模型目录；不会导入或读取 legacy 设置数据库。"""

    configured = os.environ.get("OPENXNET_ASR_MODEL_DIR", "").strip()
    if configured:
        return Path(configured)
    user_data = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
    if user_data:
        return Path(user_data) / "asr"
    return Path.home() / ".openxnet" / "asr"


def resolve_default_user_data_root() -> Path:
    """从环境解析应用用户数据目录；独立运行时使用用户主目录下的专用目录。"""

    configured = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path.home() / ".openxnet"


def parse_arguments() -> argparse.Namespace:
    """解析独立 Worker 的目录与资源上限参数；无效参数由 argparse 终止启动。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exchange-root", type=Path, default=resolve_default_exchange_root())
    parser.add_argument("--model-root", type=Path, default=resolve_default_model_root())
    parser.add_argument("--user-data-root", type=Path, default=resolve_default_user_data_root())
    parser.add_argument("--max-audio-bytes", type=int, default=DEFAULT_MAX_AUDIO_BYTES)
    parser.add_argument("--max-settings-bytes", type=int, default=DEFAULT_MAX_SETTINGS_BYTES)
    parser.add_argument("--max-synthesis-bytes", type=int, default=DEFAULT_MAX_SYNTHESIS_BYTES)
    return parser.parse_args()


async def run() -> None:
    """创建 Voice Worker 处理器并在标准输入输出上服务 NDJSON 协议，直到收到关闭请求。"""

    arguments = parse_arguments()
    handlers = VoiceWorkerHandlers(
        arguments.exchange_root,
        arguments.model_root,
        user_data_root=arguments.user_data_root,
        max_audio_bytes=arguments.max_audio_bytes,
        max_settings_bytes=arguments.max_settings_bytes,
        max_synthesis_bytes=arguments.max_synthesis_bytes,
    )
    runtime = WorkerRuntime("voice")
    runtime.register_handler("voice.transcribe", handlers.transcribe)
    runtime.register_handler("voice.transcribe-configured", handlers.transcribe_configured)
    runtime.register_handler("voice.synthesize", handlers.synthesize)
    runtime.register_handler("voice.list-system-voices", handlers.list_system_voices)
    runtime.register_handler("voice.list-provider-voices", handlers.list_provider_voices)
    runtime.register_handler("voice.status", handlers.status)
    runtime.register_handler("voice.release", handlers.release)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
