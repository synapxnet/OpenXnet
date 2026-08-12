# -*- coding: utf-8 -*-
"""Connector Worker 使用的私有语音与临时音频引用客户端。"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass
import io
import json
import os
from pathlib import Path
import stat
import tempfile
from typing import Any
from urllib.parse import urlsplit

import aiohttp

from py.get_setting import get_port


CONNECTOR_VOICE_ORIGIN_ENV = "OPENXNET_CONNECTOR_VOICE_ORIGIN"
CONNECTOR_VOICE_TOKEN_ENV = "OPENXNET_CONNECTOR_VOICE_TOKEN"
CONNECTOR_VOICE_EXCHANGE_ENV = "OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR"
CONNECTOR_VOICE_REQUEST_SCHEMA = "openxnet.connector-voice-request.v1"
CONNECTOR_VOICE_RESULT_SCHEMA = "openxnet.connector-voice-result.v1"
MAX_BROKER_RESPONSE_BYTES = 256 * 1024
MAX_AUDIO_BYTES = 25 * 1024 * 1024


class ConnectorVoiceClientError(RuntimeError):
    """向 Connector Manager 暴露固定错误码且不携带上游诊断。"""

    def __init__(self, code: str, message: str, retryable: bool) -> None:
        """创建一个可安全记录的 Connector Voice 客户端错误。"""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True, slots=True)
class ConnectorVoicePrivateConfiguration:
    """保存经过回环地址和目录校验的私有 Broker 配置。"""

    origin: str
    token: str
    exchange_root: Path


async def transcribe_connector_audio(
    audio_bytes: bytes,
    filename: str,
    format_name: str = "auto",
) -> str | None:
    """通过临时文件引用转写音频，并在 Server 模式保留兼容请求。"""

    if not isinstance(audio_bytes, bytes) or not audio_bytes or len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ConnectorVoiceClientError("INVALID_AUDIO", "语音输入无效。", False)
    configuration = resolve_connector_voice_configuration()
    safe_filename = Path(str(filename or "voice.audio")).name or "voice.audio"
    if configuration is None:
        return await _transcribe_server_compatibility(
            audio_bytes,
            safe_filename,
            format_name,
        )
    artifact_path = await asyncio.to_thread(
        _write_input_artifact,
        configuration.exchange_root,
        audio_bytes,
    )
    try:
        result = await _post_private_request(configuration, {
            "schema": CONNECTOR_VOICE_REQUEST_SCHEMA,
            "operation": "transcribe",
            "artifactName": artifact_path.name,
            "filename": safe_filename,
            "format": str(format_name or "auto").strip().lower(),
        })
        _require_success_result(result, "transcribe")
        text = result.get("text")
        if not isinstance(text, str) or len(text) > 100_000:
            raise ConnectorVoiceClientError(
                "INVALID_VOICE_RESPONSE",
                "语音服务返回无效结果。",
                False,
            )
        return text.strip() or None
    finally:
        await asyncio.to_thread(artifact_path.unlink, missing_ok=True)


async def synthesize_connector_speech(payload: Mapping[str, Any]) -> bytes:
    """合成语音并通过临时文件引用读取有界音频结果。"""

    if not isinstance(payload, Mapping):
        raise ConnectorVoiceClientError("INVALID_REQUEST", "语音请求无效。", False)
    configuration = resolve_connector_voice_configuration()
    if configuration is None:
        return await _synthesize_server_compatibility(payload)
    request_payload = {
        "schema": CONNECTOR_VOICE_REQUEST_SCHEMA,
        "operation": "synthesize",
        "text": str(payload.get("text") or ""),
        "voice": str(payload.get("voice") or "default"),
        "index": payload.get("index", 0),
        "mobileOptimized": payload.get("mobile_optimized", False) is True,
        "format": str(payload.get("format") or "mp3").strip().lower(),
    }
    result = await _post_private_request(configuration, request_payload)
    _require_success_result(result, "synthesize")
    artifact_path = _resolve_output_artifact(configuration.exchange_root, result)
    try:
        return await asyncio.to_thread(artifact_path.read_bytes)
    finally:
        await asyncio.to_thread(artifact_path.unlink, missing_ok=True)


def resolve_connector_voice_configuration() -> ConnectorVoicePrivateConfiguration | None:
    """解析完整私有配置；三项都缺失时返回 Server 兼容模式。"""

    origin = str(os.environ.get(CONNECTOR_VOICE_ORIGIN_ENV, "")).strip()
    token = str(os.environ.get(CONNECTOR_VOICE_TOKEN_ENV, "")).strip()
    exchange_value = str(os.environ.get(CONNECTOR_VOICE_EXCHANGE_ENV, "")).strip()
    if not origin and not token and not exchange_value:
        return None
    if not origin or not token or not exchange_value:
        raise ConnectorVoiceClientError(
            "VOICE_BROKER_CONFIGURATION_INVALID",
            "Connector Voice 私有配置不完整。",
            False,
        )
    normalized_origin = _normalize_private_origin(origin)
    if len(token) < 16 or len(token) > 512:
        raise ConnectorVoiceClientError(
            "VOICE_BROKER_CONFIGURATION_INVALID",
            "Connector Voice 私有令牌无效。",
            False,
        )
    exchange_root = Path(exchange_value).expanduser()
    if not exchange_root.is_absolute() or "\u0000" in exchange_value or len(exchange_value) > 1_024:
        raise ConnectorVoiceClientError(
            "VOICE_BROKER_CONFIGURATION_INVALID",
            "Connector Voice 交换目录无效。",
            False,
        )
    exchange_root.mkdir(parents=True, exist_ok=True)
    return ConnectorVoicePrivateConfiguration(
        origin=normalized_origin,
        token=token,
        exchange_root=exchange_root.resolve(),
    )


def _normalize_private_origin(value: str) -> str:
    """要求私有 Broker 使用带明确端口且不含凭据的 HTTP 回环地址。"""

    if len(value) > 512:
        raise ConnectorVoiceClientError(
            "VOICE_BROKER_CONFIGURATION_INVALID",
            "Connector Voice 私有地址无效。",
            False,
        )
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as error:
        raise ConnectorVoiceClientError(
            "VOICE_BROKER_CONFIGURATION_INVALID",
            "Connector Voice 私有地址无效。",
            False,
        ) from error
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or port is None
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ConnectorVoiceClientError(
            "VOICE_BROKER_CONFIGURATION_INVALID",
            "Connector Voice 私有地址无效。",
            False,
        )
    return value.rstrip("/")


def _write_input_artifact(exchange_root: Path, audio_bytes: bytes) -> Path:
    """在交换目录中创建权限受限的单次输入音频文件。"""

    descriptor, file_name = tempfile.mkstemp(
        prefix="connector-input-",
        suffix=".audio",
        dir=exchange_root,
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


async def _post_private_request(
    configuration: ConnectorVoicePrivateConfiguration,
    payload: Mapping[str, Any],
) -> dict[str, Any]:
    """向私有 Broker 发送一个有界 JSON 请求并解析固定结果。"""

    timeout = aiohttp.ClientTimeout(total=125, connect=5, sock_read=120)
    headers = {
        "Authorization": f"Bearer {configuration.token}",
        "Content-Type": "application/json; charset=utf-8",
    }
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{configuration.origin}/v1/connectors/voice",
                headers=headers,
                json=dict(payload),
            ) as response:
                body = await _read_bounded_response(response, MAX_BROKER_RESPONSE_BYTES)
                if response.status != 200:
                    raise ConnectorVoiceClientError(
                        "CONNECTOR_VOICE_UNAVAILABLE",
                        "Connector Voice 服务暂不可用。",
                        response.status >= 500,
                    )
    except ConnectorVoiceClientError:
        raise
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as error:
        raise ConnectorVoiceClientError(
            "CONNECTOR_VOICE_UNAVAILABLE",
            "Connector Voice 服务连接失败。",
            True,
        ) from error
    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ConnectorVoiceClientError(
            "INVALID_VOICE_RESPONSE",
            "Connector Voice 服务返回无效结果。",
            False,
        ) from error
    if not isinstance(result, dict):
        raise ConnectorVoiceClientError(
            "INVALID_VOICE_RESPONSE",
            "Connector Voice 服务返回无效结果。",
            False,
        )
    return result


def _require_success_result(result: Mapping[str, Any], operation: str) -> None:
    """校验 Broker 成功结果的协议版本、操作名和成功标志。"""

    if (
        result.get("schema") != CONNECTOR_VOICE_RESULT_SCHEMA
        or result.get("operation") != operation
        or result.get("success") is not True
    ):
        raise ConnectorVoiceClientError(
            "INVALID_VOICE_RESPONSE",
            "Connector Voice 服务返回无效结果。",
            False,
        )


def _resolve_output_artifact(
    exchange_root: Path,
    result: Mapping[str, Any],
) -> Path:
    """验证 Broker 输出文件位于交换目录且大小与结果声明一致。"""

    artifact_name = result.get("artifactName")
    byte_length = result.get("byteLength")
    if (
        not isinstance(artifact_name, str)
        or not artifact_name.startswith("connector-output-")
        or Path(artifact_name).name != artifact_name
        or isinstance(byte_length, bool)
        or not isinstance(byte_length, int)
        or byte_length < 1
        or byte_length > MAX_AUDIO_BYTES
    ):
        raise ConnectorVoiceClientError(
            "INVALID_VOICE_RESPONSE",
            "Connector Voice 音频引用无效。",
            False,
        )
    candidate = exchange_root / artifact_name
    try:
        metadata = candidate.lstat()
        resolved = candidate.resolve(strict=True)
    except OSError as error:
        raise ConnectorVoiceClientError(
            "INVALID_VOICE_RESPONSE",
            "Connector Voice 音频引用无效。",
            False,
        ) from error
    if (
        not stat.S_ISREG(metadata.st_mode)
        or candidate.is_symlink()
        or resolved.parent != exchange_root.resolve()
        or metadata.st_size != byte_length
    ):
        raise ConnectorVoiceClientError(
            "INVALID_VOICE_RESPONSE",
            "Connector Voice 音频引用无效。",
            False,
        )
    return resolved


async def _read_bounded_response(
    response: aiohttp.ClientResponse,
    maximum_bytes: int,
) -> bytes:
    """流式读取响应并在超过预算时立即终止。"""

    declared_length = response.content_length
    if declared_length is not None and declared_length > maximum_bytes:
        raise ConnectorVoiceClientError(
            "VOICE_RESPONSE_TOO_LARGE",
            "语音服务响应超过大小限制。",
            False,
        )
    chunks: list[bytes] = []
    total_bytes = 0
    async for chunk in response.content.iter_chunked(64 * 1024):
        total_bytes += len(chunk)
        if total_bytes > maximum_bytes:
            raise ConnectorVoiceClientError(
                "VOICE_RESPONSE_TOO_LARGE",
                "语音服务响应超过大小限制。",
                False,
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def _transcribe_server_compatibility(
    audio_bytes: bytes,
    filename: str,
    format_name: str,
) -> str | None:
    """在 Server 模式调用原有 multipart ASR 兼容端点。"""

    form = aiohttp.FormData()
    form.add_field(
        "audio",
        io.BytesIO(audio_bytes),
        filename=filename,
        content_type="application/octet-stream",
    )
    form.add_field("format", str(format_name or "auto"))
    timeout = aiohttp.ClientTimeout(total=60, connect=5, sock_read=55)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f"http://127.0.0.1:{get_port()}/asr", data=form) as response:
                body = await _read_bounded_response(response, MAX_BROKER_RESPONSE_BYTES)
                if response.status != 200:
                    return None
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
        return None
    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    text = result.get("text") if isinstance(result, dict) and result.get("success") is True else None
    return text.strip() if isinstance(text, str) and text.strip() else None


async def _synthesize_server_compatibility(payload: Mapping[str, Any]) -> bytes:
    """在 Server 模式调用原有 TTS 兼容端点并限制音频大小。"""

    timeout = aiohttp.ClientTimeout(total=90, connect=30, sock_read=60)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"http://127.0.0.1:{get_port()}/tts",
                json=dict(payload),
            ) as response:
                if response.status != 200:
                    raise ConnectorVoiceClientError(
                        "CONNECTOR_VOICE_FAILED",
                        "语音生成失败。",
                        response.status >= 500,
                    )
                return await _read_bounded_response(response, MAX_AUDIO_BYTES)
    except ConnectorVoiceClientError:
        raise
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as error:
        raise ConnectorVoiceClientError(
            "CONNECTOR_VOICE_UNAVAILABLE",
            "语音服务连接失败。",
            True,
        ) from error
