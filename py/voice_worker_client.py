# -*- coding: utf-8 -*-
"""legacy 兼容路由访问 Desktop Core Voice Worker RPC 的鉴权适配器。"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import json
import os
from pathlib import Path
import tempfile
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request


class VoiceWorkerClientError(RuntimeError):
    """返回给 legacy HTTP 路由的结构化 Voice Worker 失败。"""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        """从 Worker RPC 响应创建固定错误；输入为错误码、消息和重试语义，无额外副作用。"""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class VoiceWorkerClient:
    """通过 Desktop Core 写入有界音频引用并请求独立 Voice Worker。"""

    def __init__(
        self,
        origin: str,
        token: str,
        exchange_root: Path,
        *,
        timeout_seconds: float = 125.0,
    ) -> None:
        """使用 Electron 提供的回环配置创建客户端；构造阶段不联网或写文件。"""

        self._origin = origin.rstrip("/")
        self._token = token
        self._exchange_root = exchange_root.resolve()
        self._timeout_seconds = timeout_seconds

    @classmethod
    def from_environment(cls) -> "VoiceWorkerClient":
        """从 legacy 后端继承环境构造客户端；缺少配置时返回未配置实例而不失败。"""

        origin = os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", "").strip()
        token = os.environ.get("OPENXNET_WORKER_RPC_TOKEN", "").strip()
        exchange_value = os.environ.get("OPENXNET_VOICE_EXCHANGE_DIR", "").strip()
        if not exchange_value:
            user_data = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
            exchange_value = str(Path(user_data) / "runtime" / "voice-exchange") if user_data else ""
        return cls(origin, token, Path(exchange_value or tempfile.gettempdir()))

    @property
    def configured(self) -> bool:
        """返回 Electron 是否同时提供回环地址与 Bearer 令牌，无副作用。"""

        return bool(self._origin and self._token)

    async def transcribe(
        self,
        audio_bytes: bytes,
        model_name: str = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue",
    ) -> str:
        """写入私有音频并调用本地 Sherpa；无论成功失败都会删除输入临时文件。"""

        if not self.configured:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                "Voice Worker RPC is not configured for this backend process.",
                True,
            )
        if not audio_bytes:
            raise VoiceWorkerClientError("INVALID_AUDIO", "Audio data is empty.", False)

        artifact_path = await asyncio.to_thread(self._write_audio_artifact, audio_bytes)
        try:
            response = await asyncio.to_thread(
                self._request_sync,
                "voice.transcribe",
                {"artifactPath": str(artifact_path), "modelName": model_name},
            )
            text = response.get("text")
            if not isinstance(text, str):
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker response did not contain transcription text.",
                    False,
                )
            return text.strip()
        finally:
            await asyncio.to_thread(artifact_path.unlink, missing_ok=True)

    async def transcribe_configured(
        self,
        audio_bytes: bytes,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> str:
        """按无密钥 ASR 设置请求配置化转写；输入文件始终清理，凭据不经过此客户端。"""

        if not self.configured:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                "Voice Worker RPC is not configured for this backend process.",
                True,
            )
        if not audio_bytes:
            raise VoiceWorkerClientError("INVALID_AUDIO", "Audio data is empty.", False)
        if not isinstance(settings, Mapping):
            raise VoiceWorkerClientError("INVALID_SETTINGS", "ASR settings are invalid.", False)
        artifact_path = await asyncio.to_thread(self._write_audio_artifact, audio_bytes)
        try:
            response = await asyncio.to_thread(
                self._request_sync,
                "voice.transcribe-configured",
                {
                    "artifactPath": str(artifact_path),
                    "format": str(format_name or "auto").strip().lower(),
                    "settings": dict(settings),
                },
            )
            text = response.get("text")
            if not isinstance(text, str) or len(text) > 100_000 or "\x00" in text:
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker response did not contain valid transcription text.",
                    False,
                )
            return text.strip()
        finally:
            await asyncio.to_thread(artifact_path.unlink, missing_ok=True)

    async def synthesize(self, payload: Mapping[str, Any]) -> tuple[bytes, str]:
        """请求配置化 TTS 并读取一次性输出文件；返回音频与媒体类型后始终删除 Worker 文件。"""

        if not self.configured:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                "Voice Worker RPC is not configured for this backend process.",
                True,
            )
        response = await asyncio.to_thread(
            self._request_sync,
            "voice.synthesize",
            dict(payload),
        )
        return await asyncio.to_thread(self._read_output_artifact, response)

    async def list_system_voices(self) -> list[dict[str, Any]]:
        """请求系统音色目录；无输入，返回有界公开字段，依赖只在 Voice Worker 内加载。"""

        if not self.configured:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                "Voice Worker RPC is not configured for this backend process.",
                True,
            )
        response = await asyncio.to_thread(
            self._request_sync,
            "voice.list-system-voices",
            {},
        )
        return self._read_voice_catalog(response)

    async def list_provider_voices(
        self,
        provider: str,
        credential_scope: str,
        settings: Mapping[str, Any],
    ) -> list[dict[str, Any]]:
        """请求固定供应商音色目录；输入供应商、凭据作用域和无密钥设置，返回有界公开字段。"""

        allowed_providers = {
            "azure",
            "volcengine",
            "baidu",
            "minimax",
            "xunfei",
            "fish",
            "google",
        }
        normalized_provider = str(provider or "").strip().lower()
        normalized_scope = str(credential_scope or "").strip()
        if normalized_provider not in allowed_providers:
            raise VoiceWorkerClientError(
                "INVALID_PROVIDER",
                "Voice catalog provider is invalid.",
                False,
            )
        if (
            not normalized_scope
            or len(normalized_scope) > 128
            or any(ord(character) < 32 or ord(character) == 127 for character in normalized_scope)
        ):
            raise VoiceWorkerClientError(
                "INVALID_CREDENTIAL_SCOPE",
                "Voice catalog credential scope is invalid.",
                False,
            )
        if not isinstance(settings, Mapping):
            raise VoiceWorkerClientError(
                "INVALID_SETTINGS",
                "Voice catalog settings are invalid.",
                False,
            )
        if not self.configured:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                "Voice Worker RPC is not configured for this backend process.",
                True,
            )
        response = await asyncio.to_thread(
            self._request_sync,
            "voice.list-provider-voices",
            {
                "provider": normalized_provider,
                "credentialScope": normalized_scope,
                "settings": dict(settings),
            },
        )
        return self._read_voice_catalog(response)

    async def status(
        self,
        model_name: str = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue",
    ) -> Mapping[str, Any]:
        """请求轻量模型就绪状态；不会在 legacy 后端加载 Sherpa 依赖。"""

        if not self.configured:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                "Voice Worker RPC is not configured for this backend process.",
                True,
            )
        return await asyncio.to_thread(
            self._request_sync,
            "voice.status",
            {"modelName": model_name},
        )

    def _write_audio_artifact(self, audio_bytes: bytes) -> Path:
        """在交换目录创建权限收敛的输入文件；写入失败时删除残留并重新抛出。"""

        self._exchange_root.mkdir(parents=True, exist_ok=True)
        descriptor, file_name = tempfile.mkstemp(
            prefix="voice-",
            suffix=".audio",
            dir=self._exchange_root,
        )
        try:
            with os.fdopen(descriptor, "wb") as artifact_file:
                artifact_file.write(audio_bytes)
                artifact_file.flush()
            artifact_path = Path(file_name)
            artifact_path.chmod(0o600)
            return artifact_path
        except Exception:
            try:
                os.close(descriptor)
            except OSError:
                pass
            Path(file_name).unlink(missing_ok=True)
            raise

    def _read_output_artifact(self, response: Mapping[str, Any]) -> tuple[bytes, str]:
        """校验、读取并删除 Worker 输出普通文件；越界、链接或元数据不一致时失败。"""

        artifact_value = response.get("artifactPath")
        byte_length = response.get("byteLength")
        media_type = str(response.get("mediaType") or "").strip().lower()
        allowed_media_types = {
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
            "audio/aac",
            "audio/flac",
        }
        if not isinstance(artifact_value, str) or not artifact_value.strip():
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker output artifact is invalid.",
                False,
            )
        requested_path = Path(artifact_value)
        if requested_path.is_symlink():
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker output symbolic links are not allowed.",
                False,
            )
        artifact_path = requested_path.resolve()
        if (
            artifact_path.parent != self._exchange_root
            or not artifact_path.name.startswith("voice-output-")
        ):
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker output artifact is outside its owned exchange boundary.",
                False,
            )
        try:
            if (
                isinstance(byte_length, bool)
                or not isinstance(byte_length, int)
                or byte_length < 1
                or byte_length > 25 * 1024 * 1024
                or media_type not in allowed_media_types
                or not artifact_path.is_file()
                or artifact_path.stat().st_size != byte_length
            ):
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker output metadata is invalid.",
                    False,
                )
            audio = artifact_path.read_bytes()
            if len(audio) != byte_length:
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker output changed while being read.",
                    False,
                )
            return audio, media_type
        finally:
            artifact_path.unlink(missing_ok=True)

    def _read_voice_catalog(self, response: Mapping[str, Any]) -> list[dict[str, Any]]:
        """校验 Worker 音色目录；输入响应映射，返回复制记录，数量、字段或 1 MiB 预算超限时失败。"""

        voices = response.get("voices")
        if not isinstance(voices, list) or len(voices) > 512:
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker catalog is invalid.",
                False,
            )
        allowed_fields = {
            "id",
            "name",
            "displayName",
            "shortName",
            "locale",
            "description",
            "originalName",
            "lang",
            "gender",
            "premium",
        }
        normalized: list[dict[str, Any]] = []
        for item in voices:
            if not isinstance(item, Mapping) or any(field not in allowed_fields for field in item):
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker catalog item is invalid.",
                    False,
                )
            detached = dict(item)
            if not str(detached.get("id") or "").strip() or not str(detached.get("name") or "").strip():
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker catalog item is invalid.",
                    False,
                )
            if any(
                not isinstance(value, (str, bool))
                for value in detached.values()
            ):
                raise VoiceWorkerClientError(
                    "INVALID_WORKER_RESPONSE",
                    "Voice Worker catalog item is invalid.",
                    False,
                )
            normalized.append(detached)
        if len(json.dumps(normalized, ensure_ascii=False).encode("utf-8")) > 1024 * 1024:
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker catalog exceeds its size budget.",
                False,
            )
        return normalized

    def _request_sync(
        self,
        method: str,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """在线程中执行一次 Worker RPC；HTTP 或协议失败转换为有重试语义的客户端异常。"""

        body = json.dumps(
            {"capability": "voice", "method": method, "payload": dict(payload)},
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib_request.Request(
            f"{self._origin}/v1/workers/request",
            data=body,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=self._timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib_error.HTTPError as error:
            self._raise_http_error(error)
        except (OSError, urllib_error.URLError) as error:
            raise VoiceWorkerClientError(
                "VOICE_WORKER_UNAVAILABLE",
                f"Voice Worker RPC connection failed: {error}",
                True,
            ) from error

        if not isinstance(response_payload, dict) or response_payload.get("ok") is not True:
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker RPC returned an invalid success envelope.",
                False,
            )
        result = response_payload.get("payload")
        if not isinstance(result, dict):
            raise VoiceWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Voice Worker RPC payload must be an object.",
                False,
            )
        return result

    def _raise_http_error(self, error: urllib_error.HTTPError) -> None:
        """解码 Worker RPC HTTP 错误并抛出固定客户端异常，不返回原始响应体。"""

        try:
            payload = json.loads(error.read().decode("utf-8"))
            error_payload = payload.get("error", {}) if isinstance(payload, dict) else {}
            code = str(error_payload.get("code", "VOICE_WORKER_FAILED"))
            message = str(error_payload.get("message", error.reason))
            retryable = bool(error_payload.get("retryable", error.code >= 500))
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            code = "VOICE_WORKER_FAILED"
            message = str(error.reason)
            retryable = error.code >= 500
        raise VoiceWorkerClientError(code, message, retryable) from error


async def transcribe_with_voice_worker(
    audio_bytes: bytes,
    model_name: str = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue",
) -> str:
    """为一次 legacy Sherpa 请求创建环境客户端；输入音频由客户端写入并清理。"""

    return await VoiceWorkerClient.from_environment().transcribe(audio_bytes, model_name)


async def transcribe_configured_with_voice_worker(
    audio_bytes: bytes,
    format_name: str,
    settings: Mapping[str, Any],
) -> str:
    """为一次兼容 ASR 路由创建环境客户端，并按当前无密钥设置调用 Voice Worker。"""

    return await VoiceWorkerClient.from_environment().transcribe_configured(
        audio_bytes,
        format_name,
        settings,
    )


async def synthesize_with_voice_worker(
    payload: Mapping[str, Any],
) -> tuple[bytes, str]:
    """为一次兼容 TTS 路由创建环境客户端，并返回 Worker 生成的音频与媒体类型。"""

    return await VoiceWorkerClient.from_environment().synthesize(payload)
