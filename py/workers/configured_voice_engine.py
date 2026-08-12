# -*- coding: utf-8 -*-
"""Voice Worker 内按设置选择 ASR/TTS 供应商的隔离执行引擎。"""

from __future__ import annotations

import asyncio
import base64
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import importlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import runpy
import subprocess
import sys
import tempfile
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from py.audio_pcm import AudioPcmConversionError, convert_wav_to_pcm16
from py.provider_credentials import apply_provider_credentials
from py.voice_credentials import apply_voice_credentials_to_scope
from py.workers.voice_audio import convert_audio_to_opus
from py.workers.voice_engine import DEFAULT_SHERPA_MODEL_NAME, SherpaAsrEngine


MAX_SYNTHESIZED_AUDIO_BYTES = 25 * 1024 * 1024
MAX_TRANSCRIPTION_LENGTH = 100_000
SUPPORTED_OUTPUT_FORMATS = {"mp3", "opus", "aac", "flac", "wav"}


class ConfiguredVoiceError(RuntimeError):
    """表示配置化语音请求失败，消息固定且不会泄漏供应商异常。"""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        """记录稳定错误码、用户安全消息和重试语义，不保留请求或凭据。"""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True, slots=True)
class VoiceSynthesisResult:
    """保存一次合成后的有界音频、媒体类型和实际格式。"""

    audio: bytes
    media_type: str
    format_name: str


class ConfiguredVoiceEngine:
    """延迟加载语音供应商依赖，并在 Voice Worker 内持有短生命周期客户端缓存。"""

    def __init__(
        self,
        model_root: Path,
        user_data_root: Path,
        *,
        sherpa_engine: SherpaAsrEngine | None = None,
        maximum_audio_bytes: int = MAX_SYNTHESIZED_AUDIO_BYTES,
    ) -> None:
        """创建未激活的引擎；输入为模型和用户目录，构造阶段不会联网或加载重依赖。"""

        self._user_data_root = user_data_root.resolve()
        self._upload_root = (self._user_data_root / "uploaded_files").resolve()
        self._temporary_root = (self._user_data_root / "runtime" / "voice-temp").resolve()
        self._temporary_root.mkdir(parents=True, exist_ok=True)
        self._sherpa_engine = sherpa_engine or SherpaAsrEngine(model_root)
        self._maximum_audio_bytes = maximum_audio_bytes
        self._http_client: Any | None = None
        self._openai_asr_clients: dict[tuple[str, str], Any] = {}
        self._openai_tts_clients: dict[tuple[str, str], Any] = {}
        self._tetos_speakers: dict[tuple[Any, ...], Any] = {}

    async def transcribe_file(
        self,
        audio_path: Path,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> str:
        """按无密钥设置选择 ASR，并从进程凭据补齐密钥；输出有界文本，供应商失败统一收敛。"""

        configured = self._hydrate_provider_settings(settings, "asrSettings")
        engine_name = str(configured.get("engine") or "openai").strip().lower()
        try:
            if engine_name == "sherpa":
                model_name = str(configured.get("model") or DEFAULT_SHERPA_MODEL_NAME).strip()
                text = await asyncio.to_thread(
                    self._sherpa_engine.transcribe_file,
                    audio_path,
                    model_name,
                )
            elif engine_name == "openai":
                text = await self._transcribe_openai(audio_path, format_name, configured)
            elif engine_name == "funasr":
                text = await self._transcribe_funasr(audio_path, format_name, configured)
            else:
                raise ConfiguredVoiceError("UNSUPPORTED_ASR_ENGINE", "不支持当前 ASR 引擎。")
        except ConfiguredVoiceError:
            raise
        except Exception as error:
            raise ConfiguredVoiceError(
                "ASR_UPSTREAM_FAILED",
                "语音识别服务请求失败。",
                retryable=True,
            ) from error
        normalized = str(text or "").strip()
        if len(normalized) > MAX_TRANSCRIPTION_LENGTH or "\x00" in normalized:
            raise ConfiguredVoiceError("INVALID_ASR_RESPONSE", "语音识别结果无效。")
        return normalized

    async def synthesize(
        self,
        text: str,
        voice: str,
        index: int,
        mobile_optimized: bool,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> VoiceSynthesisResult:
        """按设置选择 TTS 并返回有界音频；输入文本不写日志，供应商异常不会跨 Worker。"""

        configured = self._select_tts_profile(settings, voice)
        engine_name = str(configured.get("engine") or "edgetts").strip()
        target_format = "opus" if mobile_optimized else str(format_name or "mp3").lower()
        if target_format not in SUPPORTED_OUTPUT_FORMATS:
            raise ConfiguredVoiceError("UNSUPPORTED_AUDIO_FORMAT", "不支持当前语音输出格式。")
        try:
            if engine_name == "edgetts":
                result = await self._synthesize_edge(text, configured, mobile_optimized, target_format)
            elif engine_name == "customTTS":
                result = await self._synthesize_custom(
                    text,
                    configured,
                    index,
                    mobile_optimized,
                    target_format,
                )
            elif engine_name == "GSV":
                result = await self._synthesize_gsv(
                    text,
                    configured,
                    index,
                    mobile_optimized,
                )
            elif engine_name == "volcengine":
                result = await self._synthesize_volcengine(
                    text,
                    configured,
                    mobile_optimized,
                    target_format,
                )
            elif engine_name == "openai":
                result = await self._synthesize_openai(
                    text,
                    configured,
                    mobile_optimized,
                    target_format,
                )
            elif engine_name == "systemtts":
                result = await self._synthesize_system(
                    text,
                    configured,
                    mobile_optimized,
                    target_format,
                )
            elif engine_name in {"azure", "baidu", "minimax", "xunfei", "fish", "google"}:
                result = await self._synthesize_tetos(
                    text,
                    configured,
                    engine_name,
                    mobile_optimized,
                    target_format,
                )
            elif engine_name == "elevenlabs":
                result = await self._synthesize_elevenlabs(text, configured, target_format)
            else:
                raise ConfiguredVoiceError("UNSUPPORTED_TTS_ENGINE", "不支持当前 TTS 引擎。")
        except ConfiguredVoiceError:
            raise
        except Exception as error:
            raise ConfiguredVoiceError(
                "TTS_UPSTREAM_FAILED",
                "语音合成服务请求失败。",
                retryable=True,
            ) from error
        return self._validate_synthesis_result(result)

    async def list_system_voices(self) -> list[dict[str, Any]]:
        """在线程池读取操作系统语音目录；返回公开元数据且始终释放临时 TTS 引擎。"""

        try:
            return await asyncio.to_thread(self._list_system_voices_sync)
        except Exception as error:
            raise ConfiguredVoiceError(
                "SYSTEM_VOICE_CATALOG_FAILED",
                "系统语音目录读取失败。",
                retryable=True,
            ) from error

    async def list_provider_voices(
        self,
        provider: str,
        credential_scope: str,
        settings: Mapping[str, Any],
    ) -> list[Any]:
        """读取固定 TTS 供应商的有界音色目录；Fish 凭据仅在 Worker 内补齐。"""

        constant_names = {
            "azure": "AZURE_SUPPORTED_VOICES",
            "volcengine": "VOLC_SUPPORTED_VOICES",
            "baidu": "BAIDU_SUPPORTED_VOICES",
            "minimax": "MINIMAX_SUPPORTED_VOICES",
            "google": "GOOGLE_SUPPORTED_VOICES",
        }
        try:
            if provider == "fish":
                configured = self._select_tts_profile(settings, credential_scope)
                api_key = self._require_secret(
                    configured.get("fishApiKey"),
                    "Fish Audio 密钥未配置。",
                )
                return await self._list_fish_voices(api_key)
            if provider == "xunfei":
                return ["xiaoyan", "aisjiuxu", "aisxping", "aisxyan", "aisjinger", "aisbabyxu"]
            constants = self._read_tetos_catalog_constants()
            raw_voices = constants.get(constant_names[provider])
            voices = list(raw_voices) if isinstance(raw_voices, (list, tuple, dict)) else None
            if voices is None:
                raise ConfiguredVoiceError("INVALID_VOICE_CATALOG", "语音目录响应无效。")
            return voices
        except ConfiguredVoiceError:
            raise
        except Exception as error:
            raise ConfiguredVoiceError(
                "PROVIDER_VOICE_CATALOG_FAILED",
                "供应商语音目录读取失败。",
                retryable=True,
            ) from error

    def _read_tetos_catalog_constants(self) -> dict[str, Any]:
        """从 Pack 纯数据文件读取 Tetos 固定目录，避免执行会导入全部供应商 SDK 的包初始化。"""

        frozen_root = getattr(sys, "_MEIPASS", "")
        if frozen_root:
            constants_path = Path(frozen_root) / "tetos" / "consts.py"
        else:
            package_spec = importlib.util.find_spec("tetos")
            package_locations = tuple(package_spec.submodule_search_locations or ()) if package_spec else ()
            if len(package_locations) != 1:
                raise ConfiguredVoiceError("VOICE_CATALOG_DATA_MISSING", "语音目录数据不可用。")
            constants_path = Path(package_locations[0]) / "consts.py"
        if (
            not constants_path.is_file()
            or constants_path.is_symlink()
            or constants_path.stat().st_size > 1024 * 1024
        ):
            raise ConfiguredVoiceError("VOICE_CATALOG_DATA_MISSING", "语音目录数据不可用。")
        namespace = runpy.run_path(str(constants_path))
        return {str(key): value for key, value in namespace.items() if key.endswith("_SUPPORTED_VOICES")}

    async def close(self) -> None:
        """关闭共享 HTTP 连接并清空客户端缓存；调用后引擎仍可按需重新建立连接。"""

        client = self._http_client
        self._http_client = None
        if client is not None:
            await client.aclose()
        self._openai_asr_clients.clear()
        self._openai_tts_clients.clear()
        self._tetos_speakers.clear()

    def _list_system_voices_sync(self) -> list[dict[str, Any]]:
        """同步读取 pyttsx3 系统音色并规范公开字段；调用方必须在线程池执行。"""

        pyttsx3 = importlib.import_module("pyttsx3")
        engine = pyttsx3.init()
        voices: list[dict[str, Any]] = []
        novelty_names = {
            "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos",
            "Deranged", "Good News", "Hysterical", "Pipe Organ", "Trinoids",
            "Whisper", "Zarvox", "Organ",
        }
        try:
            for voice in engine.getProperty("voices") or []:
                name = str(getattr(voice, "name", "") or "").strip()
                voice_id = str(getattr(voice, "id", "") or "").strip()
                if not name or not voice_id or name in novelty_names:
                    continue
                raw_languages = getattr(voice, "languages", None) or []
                raw_language = raw_languages[0] if isinstance(raw_languages, list) and raw_languages else ""
                if isinstance(raw_language, bytes):
                    language = raw_language.decode("utf-8", errors="ignore").replace("\x05", "")
                else:
                    language = str(raw_language or "")
                if not language:
                    lowered_id = voice_id.lower()
                    for marker in ("zh-cn", "zh-tw", "en-us", "en-gb", "ja-jp", "ko-kr"):
                        if marker in lowered_id:
                            language = marker
                            break
                premium = any(
                    marker in voice_id.lower()
                    for marker in ("siri", "premium", "compact")
                ) or "siri" in name.lower()
                prefix = "[Siri/Premium] " if premium else ""
                voices.append({
                    "id": voice_id,
                    "name": f"{prefix}{name}",
                    "originalName": name,
                    "lang": language or "Unknown",
                    "gender": str(getattr(voice, "gender", "Unknown") or "Unknown"),
                    "premium": premium,
                })
        finally:
            stop = getattr(engine, "stop", None)
            if callable(stop):
                stop()
        voices.sort(key=lambda item: (not bool(item["premium"]), str(item["lang"]), str(item["name"])))
        return voices

    async def _list_fish_voices(self, api_key: str) -> list[dict[str, Any]]:
        """从固定 Fish HTTPS 端点流式读取最多 1 MiB JSON，并投影公开音色字段。"""

        payload = bytearray()
        try:
            async with self._get_http_client().stream(
                "GET",
                "https://api.fish.audio/model",
                params={"page_size": 30, "page_number": 1, "sort_by": "score"},
                headers={"Authorization": f"Bearer {api_key}"},
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    payload.extend(chunk)
                    if len(payload) > 1024 * 1024:
                        raise ConfiguredVoiceError(
                            "VOICE_CATALOG_TOO_LARGE",
                            "供应商语音目录超过大小限制。",
                        )
        except ConfiguredVoiceError:
            raise
        except Exception as error:
            raise ConfiguredVoiceError(
                "VOICE_CATALOG_HTTP_FAILED",
                "供应商语音目录请求失败。",
                retryable=True,
            ) from error
        document = json.loads(payload.decode("utf-8"))
        items = document.get("items") if isinstance(document, dict) else None
        if not isinstance(items, list):
            raise ConfiguredVoiceError("INVALID_VOICE_CATALOG", "供应商语音目录响应无效。")
        voices: list[dict[str, Any]] = []
        for item in items[:512]:
            if not isinstance(item, Mapping):
                continue
            languages = item.get("languages")
            locale = languages[0] if isinstance(languages, list) and languages else ""
            voices.append({
                "id": item.get("_id"),
                "name": item.get("title"),
                "displayName": item.get("title"),
                "locale": locale,
            })
        return voices

    def get_status(self) -> dict[str, Any]:
        """返回配置化引擎和打包依赖可用性；只检查模块规格，不导入网络或音频依赖。"""

        dependencies = {
            name: importlib.util.find_spec(module_name) is not None
            for name, module_name in {
                "httpx": "httpx",
                "openai": "openai",
                "websockets": "websockets",
                "edgeTts": "edge_tts",
                "pydub": "pydub",
                "imageioFfmpeg": "imageio_ffmpeg",
                "tetos": "tetos",
                "elevenlabs": "elevenlabs",
                "pyttsx3": "pyttsx3",
            }.items()
        }
        return {
            "supportedAsrEngines": ["openai", "funasr", "sherpa"],
            "supportedTtsEngines": [
                "edgetts",
                "customTTS",
                "GSV",
                "volcengine",
                "openai",
                "systemtts",
                "azure",
                "baidu",
                "minimax",
                "xunfei",
                "fish",
                "google",
                "elevenlabs",
            ],
            "dependencies": dependencies,
            "missingDependencies": [
                name for name, available in dependencies.items() if not available
            ],
        }

    def _hydrate_provider_settings(
        self,
        settings: Mapping[str, Any],
        field_name: str,
    ) -> dict[str, Any]:
        """复制一个设置作用域并从 Voice Worker 环境补齐 Provider 密钥，绝不修改调用方对象。"""

        detached = deepcopy(dict(settings))
        document = apply_provider_credentials({field_name: detached})
        result = document.get(field_name)
        if not isinstance(result, dict):
            raise ConfiguredVoiceError("INVALID_VOICE_SETTINGS", "语音设置格式无效。")
        return result

    def _select_tts_profile(self, settings: Mapping[str, Any], voice: str) -> dict[str, Any]:
        """复制并选择默认或命名 TTS 配置，同时按作用域补齐 Voice 与 Provider 凭据。"""

        parent = deepcopy(dict(settings))
        apply_voice_credentials_to_scope(parent, "default", preserve_existing=True)
        provider_document = apply_provider_credentials({"ttsSettings": parent})
        hydrated_parent = provider_document["ttsSettings"]
        named = hydrated_parent.get("newtts")
        if voice == "default" or not isinstance(named, Mapping) or voice not in named:
            return hydrated_parent
        raw_child = named.get(voice)
        if not isinstance(raw_child, Mapping):
            raise ConfiguredVoiceError("INVALID_VOICE_SETTINGS", "命名语音设置格式无效。")
        child = deepcopy(dict(raw_child))
        apply_voice_credentials_to_scope(child, voice, preserve_existing=True)
        child = apply_provider_credentials({"ttsSettings": child})["ttsSettings"]
        for field in ("api_key", "base_url", "model", "selectedProvider", "vendor"):
            if not child.get(field) and hydrated_parent.get(field):
                child[field] = hydrated_parent[field]
        return child

    async def _transcribe_openai(
        self,
        audio_path: Path,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> str:
        """调用 OpenAI 兼容转写接口；输入为本地临时文件，输出仅保留响应文本。"""

        api_key = self._require_secret(settings.get("api_key"), "OpenAI ASR 密钥未配置。")
        base_url = self._normalize_http_url(
            settings.get("base_url") or "https://api.openai.com/v1",
            allow_path=True,
        )
        cache_key = (api_key, base_url)
        client = self._openai_asr_clients.get(cache_key)
        if client is None:
            openai = importlib.import_module("openai")
            client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
            self._openai_asr_clients[cache_key] = client
        audio = BytesIO(audio_path.read_bytes())
        suffix = self._normalize_input_format(format_name)
        audio.name = f"audio.{suffix}"
        response = await client.audio.transcriptions.create(
            file=audio,
            model=str(settings.get("model") or "whisper-1"),
        )
        return str(getattr(response, "text", "") or "")

    async def _transcribe_funasr(
        self,
        audio_path: Path,
        format_name: str,
        settings: Mapping[str, Any],
    ) -> str:
        """通过有界 WebSocket 会话调用 FunASR offline 模式，并在三十秒内收集最终文本。"""

        websockets = importlib.import_module("websockets")
        url = self._normalize_websocket_url(settings.get("funasr_ws_url") or "ws://localhost:10095")
        audio_data = audio_path.read_bytes()
        if self._normalize_input_format(format_name) == "wav":
            try:
                audio_data = convert_wav_to_pcm16(audio_data)
            except AudioPcmConversionError:
                pass
        initialization = {
            "chunk_size": [5, 10, 5],
            "wav_name": "desktop_voice_worker",
            "is_speaking": True,
            "chunk_interval": 10,
            "mode": "offline",
            "hotwords": self._parse_hotwords(settings.get("hotwords")),
            "use_itn": True,
        }
        result_parts: list[str] = []
        async with websockets.connect(
            url,
            open_timeout=10,
            close_timeout=5,
            max_size=512 * 1024,
        ) as websocket:
            await websocket.send(json.dumps(initialization, ensure_ascii=False))
            for offset in range(0, len(audio_data), 960):
                await websocket.send(audio_data[offset : offset + 960])
            await websocket.send(json.dumps({"is_speaking": False}))
            deadline = asyncio.get_running_loop().time() + 30
            while asyncio.get_running_loop().time() < deadline:
                try:
                    raw_response = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue
                if not isinstance(raw_response, str):
                    continue
                response = json.loads(raw_response)
                if not isinstance(response, Mapping):
                    continue
                text = response.get("text")
                if isinstance(text, str) and text.strip():
                    result_parts.append(text.strip())
                if response.get("is_final") is True:
                    break
        return "".join(result_parts)

    async def _synthesize_edge(
        self,
        text: str,
        settings: Mapping[str, Any],
        mobile_optimized: bool,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """调用 Edge TTS 并收集 MP3；需要 Opus 时在 Worker 内完成格式转换。"""

        edge_tts = importlib.import_module("edge_tts")
        language = str(settings.get("edgettsLanguage") or "zh-CN")
        voice = str(settings.get("edgettsVoice") or "XiaoyiNeural")
        rate = self._read_float(settings.get("edgettsRate"), 1.0, 0.25, 4.0)
        if mobile_optimized:
            rate = min(rate * 0.95, 1.1)
        rate_text = f"{int((rate - 1.0) * 100):+d}%"
        audio = bytearray()
        communicate = edge_tts.Communicate(text, f"{language}-{voice}", rate=rate_text)
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                self._extend_bounded(audio, chunk.get("data"))
        return await self._format_result(bytes(audio), "mp3", target_format)

    async def _synthesize_custom(
        self,
        text: str,
        settings: Mapping[str, Any],
        index: int,
        mobile_optimized: bool,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """调用用户配置的 HTTP CustomTTS 地址，限制协议、重定向、超时和响应体大小。"""

        speed = self._read_float(settings.get("customTTSspeed"), 1.0, 0.1, 4.0)
        if mobile_optimized:
            speed = min(speed * 0.95, 1.2)
        params = {
            self._require_parameter_name(settings.get("customTTSKeyText") or "text"): text,
            self._require_parameter_name(settings.get("customTTSKeySpeaker") or "speaker"): str(
                settings.get("customTTSspeaker") or ""
            ),
            self._require_parameter_name(settings.get("customTTSKeySpeed") or "speed"): speed,
        }
        server = self._select_server(
            settings.get("customTTSserver"),
            "http://127.0.0.1:9880",
            index,
        )
        audio = await self._request_http_bytes("GET", server, params=params)
        if target_format == "opus":
            return await self._format_result(audio, "wav", target_format)
        return VoiceSynthesisResult(audio, "audio/wav", "wav")

    async def _synthesize_gsv(
        self,
        text: str,
        settings: Mapping[str, Any],
        index: int,
        mobile_optimized: bool,
    ) -> VoiceSynthesisResult:
        """调用本地或用户配置的 GSV `/tts`，返回其 Ogg/Opus 音频且不传递本机任意路径。"""

        reference_path = self._resolve_upload_reference(settings.get("gsvRefAudioPath"))
        speed = self._read_float(settings.get("gsvRate"), 1.0, 0.1, 4.0)
        if mobile_optimized:
            speed = min(speed * 0.95, 1.1)
        payload = {
            "text": text,
            "text_lang": str(settings.get("gsvTextLang") or "zh"),
            "ref_audio_path": str(reference_path) if reference_path else "",
            "prompt_lang": str(settings.get("gsvPromptLang") or "zh"),
            "prompt_text": str(settings.get("gsvPromptText") or ""),
            "speed_factor": speed,
            "sample_steps": int(settings.get("gsvSample_steps") or 4),
            "streaming_mode": True,
            "media_type": "ogg",
            "batch_size": 1,
            "seed": 42,
        }
        server = self._select_server(
            settings.get("gsvServer"),
            "http://127.0.0.1:9880",
            index,
            endpoint="/tts",
        )
        audio = await self._request_http_bytes("POST", server, json_body=payload)
        return VoiceSynthesisResult(audio, "audio/ogg", "opus")

    async def _synthesize_volcengine(
        self,
        text: str,
        settings: Mapping[str, Any],
        mobile_optimized: bool,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """调用火山单向流式 TTS 接口，只解码成功帧并对总音频大小实施上限。"""

        app_id = self._require_secret(settings.get("volcAppId"), "火山语音 App ID 未配置。")
        access_key = self._require_secret(settings.get("volcAccessKey"), "火山语音密钥未配置。")
        rate = self._read_float(settings.get("volcRate"), 1.0, 0.2, 3.0)
        if mobile_optimized:
            rate = min(rate * 0.95, 1.2)
        headers = {
            "X-Api-App-Id": app_id,
            "X-Api-Access-Key": access_key,
            "X-Api-Resource-Id": str(settings.get("volcResourceId") or "volc_tts_release"),
            "Content-Type": "application/json",
        }
        payload = {
            "user": {"uid": "desktop_voice_worker"},
            "req_params": {
                "text": text,
                "speaker": str(settings.get("volcVoice") or "zh_female_cancan_mars_bigtts"),
                "speed_ratio": rate,
                "audio_params": {"format": "mp3", "sample_rate": 24_000},
                "additions": "{\"disable_markdown_filter\":true}",
            },
        }
        client = self._get_http_client()
        audio = bytearray()
        try:
            async with client.stream(
                "POST",
                "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    frame = json.loads(line)
                    if not isinstance(frame, Mapping) or frame.get("code", 0) not in {0, 20_000_000}:
                        continue
                    encoded = frame.get("data")
                    if isinstance(encoded, str) and encoded:
                        self._extend_bounded(audio, base64.b64decode(encoded, validate=True))
        except Exception as error:
            raise ConfiguredVoiceError(
                "VOLCENGINE_TTS_FAILED",
                "火山语音服务请求失败。",
                retryable=True,
            ) from error
        return await self._format_result(bytes(audio), "mp3", target_format)

    async def _synthesize_openai(
        self,
        text: str,
        settings: Mapping[str, Any],
        mobile_optimized: bool,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """调用 OpenAI 兼容 TTS 接口，客户端只在 Voice Worker 内按密钥与地址缓存。"""

        api_key = self._require_secret(settings.get("api_key"), "OpenAI TTS 密钥未配置。")
        base_url = self._normalize_http_url(
            settings.get("base_url") or "https://api.openai.com/v1",
            allow_path=True,
        )
        cache_key = (api_key, base_url)
        client = self._openai_tts_clients.get(cache_key)
        if client is None:
            openai = importlib.import_module("openai")
            client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
            self._openai_tts_clients[cache_key] = client
        speed = self._read_float(settings.get("openaiSpeed"), 1.0, 0.25, 4.0)
        if mobile_optimized:
            speed = min(speed * 0.95, 1.2)
        parameters: dict[str, Any] = {
            "model": str(settings.get("model") or "tts-1"),
            "input": text,
            "speed": speed,
            "response_format": target_format,
        }
        reference_path = self._resolve_upload_reference(settings.get("gsvRefAudioPath"))
        if reference_path is None:
            parameters["voice"] = str(settings.get("openaiVoice") or "alloy")
        else:
            encoded = base64.b64encode(reference_path.read_bytes()).decode("ascii")
            parameters["extra_body"] = {
                "references": [{
                    "text": str(settings.get("gsvPromptText") or ""),
                    "audio": f"data:audio/{reference_path.suffix.lstrip('.')};base64,{encoded}",
                }]
            }
        response = await client.audio.speech.create(**parameters)
        audio = await response.aread()
        return VoiceSynthesisResult(
            bytes(audio),
            self._media_type_for_format(target_format),
            target_format,
        )

    async def _synthesize_system(
        self,
        text: str,
        settings: Mapping[str, Any],
        mobile_optimized: bool,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """在线程中调用操作系统 TTS 并使用私有临时 WAV；失败时确保文件被删除。"""

        voice_name = str(settings.get("systemVoiceName") or "").strip() or None
        rate = int(self._read_float(settings.get("systemRate"), 200, 50, 500))
        if mobile_optimized:
            rate = int(rate * 0.95)
        audio = await asyncio.to_thread(self._render_system_wav, text, voice_name, rate)
        if target_format == "opus":
            return await self._format_result(audio, "wav", target_format)
        return VoiceSynthesisResult(audio, "audio/wav", "wav")

    def _render_system_wav(self, text: str, voice_name: str | None, rate: int) -> bytes:
        """同步生成系统 WAV 并返回字节；函数只在线程池执行且始终清理临时文件。"""

        descriptor, file_name = tempfile.mkstemp(
            prefix="system-tts-",
            suffix=".wav",
            dir=self._temporary_root,
        )
        os.close(descriptor)
        temporary_path = Path(file_name)
        try:
            if platform.system() == "Darwin":
                command = ["say", "-o", str(temporary_path), "--data-format=LEI16@22050", text]
                if voice_name:
                    command.extend(["-v", voice_name])
                command.extend(["-r", str(rate)])
                subprocess.run(command, check=True, capture_output=True)
            else:
                pyttsx3 = importlib.import_module("pyttsx3")
                engine = pyttsx3.init()
                engine.setProperty("rate", rate)
                if voice_name:
                    for candidate in engine.getProperty("voices"):
                        if voice_name == candidate.id or voice_name.lower() in candidate.name.lower():
                            engine.setProperty("voice", candidate.id)
                            break
                engine.save_to_file(text, str(temporary_path))
                engine.runAndWait()
            return temporary_path.read_bytes()
        finally:
            temporary_path.unlink(missing_ok=True)

    async def _synthesize_tetos(
        self,
        text: str,
        settings: Mapping[str, Any],
        engine_name: str,
        mobile_optimized: bool,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """在线程池调用 Tetos 供应商并读取私有 MP3；凭据仅用于进程内实例构造。"""

        selected_voice = str(settings.get(f"{engine_name}Voice") or "").strip() or None
        speaker = await asyncio.to_thread(
            self._get_tetos_speaker,
            engine_name,
            settings,
            selected_voice,
        )
        descriptor, file_name = tempfile.mkstemp(
            prefix="tetos-tts-",
            suffix=".mp3",
            dir=self._temporary_root,
        )
        os.close(descriptor)
        temporary_path = Path(file_name)
        try:
            await asyncio.to_thread(speaker.say, text, str(temporary_path))
            audio = temporary_path.read_bytes()
        finally:
            temporary_path.unlink(missing_ok=True)
        if mobile_optimized:
            target_format = "opus"
        return await self._format_result(audio, "mp3", target_format)

    def _get_tetos_speaker(
        self,
        engine_name: str,
        settings: Mapping[str, Any],
        selected_voice: str | None,
    ) -> Any:
        """按供应商配置获取或构造 Tetos Speaker；缓存键中的 Google 凭据只保存摘要。"""

        field_sets = {
            "azure": ("azureSpeechKey", "azureRegion"),
            "baidu": ("baiduApiKey", "baiduSecretKey"),
            "minimax": ("minimaxApiKey", "minimaxGroupId"),
            "xunfei": ("xunfeiAppId", "xunfeiApiKey", "xunfeiApiSecret"),
            "fish": ("fishApiKey",),
        }
        if engine_name == "google":
            service_account = self._require_secret(
                settings.get("googleServiceAccount"),
                "Google TTS 服务账号未配置。",
            )
            credential_key: tuple[Any, ...] = (sha256(service_account.encode("utf-8")).hexdigest(),)
        else:
            credential_key = tuple(
                self._require_secret(settings.get(field), f"{engine_name} TTS 凭据未配置。")
                for field in field_sets[engine_name]
            )
        cache_key = (engine_name, *credential_key, selected_voice)
        cached = self._tetos_speakers.get(cache_key)
        if cached is not None:
            return cached
        if engine_name == "azure":
            module = importlib.import_module("tetos.azure")
            speaker = module.AzureSpeaker(
                speech_key=credential_key[0],
                speech_region=credential_key[1],
                voice=selected_voice,
            )
        elif engine_name == "baidu":
            module = importlib.import_module("tetos.baidu")
            speaker = module.BaiduSpeaker(
                api_key=credential_key[0],
                secret_key=credential_key[1],
                voice=selected_voice,
            )
        elif engine_name == "minimax":
            module = importlib.import_module("tetos.minimax")
            speaker = module.MinimaxSpeaker(
                api_key=credential_key[0],
                group_id=credential_key[1],
                voice=selected_voice,
            )
        elif engine_name == "xunfei":
            module = importlib.import_module("tetos.xunfei")
            speaker = module.XunfeiSpeaker(
                app_id=credential_key[0],
                api_key=credential_key[1],
                api_secret=credential_key[2],
                voice=selected_voice,
            )
        elif engine_name == "fish":
            module = importlib.import_module("tetos.fish")
            speaker = module.FishSpeaker(api_key=credential_key[0], voice=selected_voice)
        else:
            module = importlib.import_module("tetos.google")
            descriptor, file_name = tempfile.mkstemp(
                prefix="google-voice-",
                suffix=".json",
                dir=self._temporary_root,
            )
            try:
                with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as credential_file:
                    credential_file.write(service_account)
                previous = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = file_name
                try:
                    speaker = module.GoogleSpeaker(voice=selected_voice)
                finally:
                    if previous is None:
                        os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
                    else:
                        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = previous
            finally:
                Path(file_name).unlink(missing_ok=True)
        self._tetos_speakers[cache_key] = speaker
        return speaker

    async def _synthesize_elevenlabs(
        self,
        text: str,
        settings: Mapping[str, Any],
        target_format: str,
    ) -> VoiceSynthesisResult:
        """在线程池调用 ElevenLabs 同步生成器并限制累计 MP3 大小。"""

        api_key = self._require_secret(settings.get("elevenLabsApiKey"), "ElevenLabs 密钥未配置。")
        voice_id = self._require_secret(settings.get("elevenLabsVoice"), "ElevenLabs Voice ID 未配置。")
        model_id = str(settings.get("elevenLabsModel") or "eleven_multilingual_v2")
        module = importlib.import_module("elevenlabs.client")

        def collect_audio() -> bytes:
            """在线程内拉取同步音频迭代器，并在超过上限时立即失败。"""

            client = module.ElevenLabs(api_key=api_key)
            stream = client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id=model_id,
                output_format="mp3_44100_128",
            )
            audio = bytearray()
            for chunk in stream:
                self._extend_bounded(audio, chunk)
            return bytes(audio)

        audio = await asyncio.to_thread(collect_audio)
        return await self._format_result(audio, "mp3", target_format)

    async def _format_result(
        self,
        audio: bytes,
        source_format: str,
        target_format: str,
    ) -> VoiceSynthesisResult:
        """在需要时把来源音频转为 Opus；其他格式只允许来源与目标一致或 MP3 默认透传。"""

        if target_format == "opus" and source_format != "opus":
            converted = await asyncio.to_thread(convert_audio_to_opus, audio)
            return VoiceSynthesisResult(converted, "audio/ogg", "opus")
        if target_format != source_format:
            raise ConfiguredVoiceError(
                "UNSUPPORTED_AUDIO_CONVERSION",
                "当前 TTS 引擎不支持请求的输出格式。",
            )
        return VoiceSynthesisResult(
            audio,
            self._media_type_for_format(source_format),
            source_format,
        )

    def _validate_synthesis_result(self, result: VoiceSynthesisResult) -> VoiceSynthesisResult:
        """验证合成字节数、媒体类型和格式，失败时不把第三方响应带出 Worker。"""

        if not isinstance(result.audio, bytes) or not result.audio:
            raise ConfiguredVoiceError("EMPTY_TTS_RESPONSE", "语音合成结果为空。")
        if len(result.audio) > self._maximum_audio_bytes:
            raise ConfiguredVoiceError("TTS_RESPONSE_TOO_LARGE", "语音合成结果超过大小限制。")
        if result.format_name not in SUPPORTED_OUTPUT_FORMATS:
            raise ConfiguredVoiceError("INVALID_TTS_RESPONSE", "语音合成结果格式无效。")
        if result.media_type != self._media_type_for_format(result.format_name):
            raise ConfiguredVoiceError("INVALID_TTS_RESPONSE", "语音合成结果媒体类型无效。")
        return result

    async def _request_http_bytes(
        self,
        method: str,
        url: str,
        *,
        params: Mapping[str, Any] | None = None,
        json_body: Mapping[str, Any] | None = None,
    ) -> bytes:
        """执行一次禁止重定向的 HTTP 请求，并以流方式读取不超过上限的响应。"""

        client = self._get_http_client()
        audio = bytearray()
        try:
            async with client.stream(method, url, params=params, json=json_body) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    self._extend_bounded(audio, chunk)
        except ConfiguredVoiceError:
            raise
        except Exception as error:
            raise ConfiguredVoiceError(
                "VOICE_HTTP_UPSTREAM_FAILED",
                "语音 HTTP 上游请求失败。",
                retryable=True,
            ) from error
        return bytes(audio)

    def _get_http_client(self) -> Any:
        """延迟创建有连接数、超时和重定向限制的共享 httpx 客户端。"""

        if self._http_client is None:
            httpx = importlib.import_module("httpx")
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(60.0, connect=10.0),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
                follow_redirects=False,
                trust_env=False,
            )
        return self._http_client

    def _normalize_http_url(self, value: Any, *, allow_path: bool = True) -> str:
        """把未知值规范为无用户信息的 HTTP(S) URL；失败时拒绝请求而不自动修复。"""

        raw_value = str(value or "").strip()
        parsed = urlsplit(raw_value)
        if (
            parsed.scheme.lower() not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
            or any(ord(character) < 32 or ord(character) == 127 for character in raw_value)
        ):
            raise ConfiguredVoiceError("INVALID_VOICE_URL", "语音服务地址无效。")
        path_value = parsed.path if allow_path else ""
        return urlunsplit((parsed.scheme.lower(), parsed.netloc, path_value, parsed.query, ""))

    def _normalize_websocket_url(self, value: Any) -> str:
        """把 FunASR 地址规范为无用户信息和片段的 WS(S) URL。"""

        raw_value = str(value or "").strip()
        if "://" not in raw_value:
            raw_value = f"ws://{raw_value}"
        parsed = urlsplit(raw_value)
        if (
            parsed.scheme.lower() not in {"ws", "wss"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
        ):
            raise ConfiguredVoiceError("INVALID_FUNASR_URL", "FunASR 服务地址无效。")
        return urlunsplit((parsed.scheme.lower(), parsed.netloc, parsed.path, parsed.query, ""))

    def _select_server(
        self,
        value: Any,
        default_value: str,
        index: int,
        *,
        endpoint: str = "",
    ) -> str:
        """从换行分隔的服务地址按请求索引选择一个，并可追加固定端点。"""

        servers = [entry.strip() for entry in str(value or default_value).splitlines() if entry.strip()]
        if not servers:
            servers = [default_value]
        selected = self._normalize_http_url(servers[index % len(servers)])
        if not endpoint:
            return selected
        parsed = urlsplit(selected)
        path_value = f"{parsed.path.rstrip('/')}/{endpoint.lstrip('/')}"
        return urlunsplit((parsed.scheme, parsed.netloc, path_value, parsed.query, ""))

    def _resolve_upload_reference(self, value: Any) -> Path | None:
        """只允许读取用户 uploaded_files 目录内的普通引用文件；空值返回 None。"""

        raw_value = str(value or "").strip()
        if not raw_value:
            return None
        candidate = Path(raw_value)
        if not candidate.is_absolute():
            candidate = self._upload_root / candidate
        resolved = candidate.resolve()
        try:
            resolved.relative_to(self._upload_root)
        except ValueError as error:
            raise ConfiguredVoiceError("INVALID_REFERENCE_AUDIO", "参考音频路径无效。") from error
        if not resolved.is_file() or resolved.is_symlink():
            raise ConfiguredVoiceError("INVALID_REFERENCE_AUDIO", "参考音频文件不存在。")
        if resolved.stat().st_size > self._maximum_audio_bytes:
            raise ConfiguredVoiceError("REFERENCE_AUDIO_TOO_LARGE", "参考音频超过大小限制。")
        return resolved

    def _parse_hotwords(self, value: Any) -> dict[str, int]:
        """把换行热词文本解析为最多 256 个“词 权重”条目，忽略格式错误的行。"""

        result: dict[str, int] = {}
        for line in str(value or "").splitlines():
            parts = line.strip().rsplit(" ", 1)
            if len(parts) != 2 or not parts[0].strip():
                continue
            try:
                weight = int(parts[1])
            except ValueError:
                continue
            result[parts[0].strip()[:128]] = max(-100, min(100, weight))
            if len(result) >= 256:
                break
        return result

    def _normalize_input_format(self, value: Any) -> str:
        """把 ASR 输入格式收敛到允许扩展名，auto 或未知值使用 wav。"""

        normalized = str(value or "auto").strip().lower()
        return normalized if normalized in {"wav", "mp3", "flac", "ogg", "m4a", "opus", "aac"} else "wav"

    def _require_secret(self, value: Any, message: str) -> str:
        """读取非空凭据文本；失败消息由调用方提供且不包含凭据内容。"""

        secret = str(value or "").strip()
        if not secret:
            raise ConfiguredVoiceError("VOICE_CREDENTIAL_MISSING", message)
        return secret

    def _require_parameter_name(self, value: Any) -> str:
        """校验 CustomTTS 查询参数名，防止控制字符和超长键进入网络请求。"""

        name = str(value or "").strip()
        if not name or len(name) > 64 or not all(character.isalnum() or character in "_-" for character in name):
            raise ConfiguredVoiceError("INVALID_CUSTOM_TTS_PARAMETER", "CustomTTS 参数名无效。")
        return name

    def _read_float(self, value: Any, default: float, minimum: float, maximum: float) -> float:
        """读取有限浮点配置并限制范围，布尔值和不可解析值使用默认值。"""

        if isinstance(value, bool):
            return float(default)
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            parsed = float(default)
        if parsed != parsed or parsed in {float("inf"), float("-inf")}:
            parsed = float(default)
        return max(minimum, min(maximum, parsed))

    def _extend_bounded(self, target: bytearray, chunk: Any) -> None:
        """向音频缓冲追加字节，并在累计大小超过上限时立即失败。"""

        if not isinstance(chunk, (bytes, bytearray, memoryview)):
            raise ConfiguredVoiceError("INVALID_TTS_RESPONSE", "语音合成结果包含无效数据。")
        target.extend(chunk)
        if len(target) > self._maximum_audio_bytes:
            raise ConfiguredVoiceError("TTS_RESPONSE_TOO_LARGE", "语音合成结果超过大小限制。")

    def _media_type_for_format(self, format_name: str) -> str:
        """把已验证的输出格式映射为 Connector Voice Broker 接受的媒体类型。"""

        media_types = {
            "mp3": "audio/mpeg",
            "opus": "audio/ogg",
            "wav": "audio/wav",
            "aac": "audio/aac",
            "flac": "audio/flac",
        }
        media_type = media_types.get(format_name)
        if media_type is None:
            raise ConfiguredVoiceError("INVALID_AUDIO_FORMAT", "语音输出格式无效。")
        return media_type
