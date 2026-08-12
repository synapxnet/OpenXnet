# -*- coding: utf-8 -*-
"""Voice Worker 专用的有界音频格式转换工具。"""

from __future__ import annotations

from io import BytesIO
import importlib


class VoiceAudioConversionError(RuntimeError):
    """表示音频无法安全转换为请求格式，异常不包含原始音频内容。"""


def convert_audio_to_opus(audio_data: bytes) -> bytes:
    """将输入容器音频或 24kHz PCM16 转为 16kHz 单声道 Opus；转换失败时抛出固定异常。"""

    if not isinstance(audio_data, bytes) or not audio_data:
        raise VoiceAudioConversionError("待转换音频不能为空。")
    try:
        pydub = importlib.import_module("pydub")
        imageio_ffmpeg = importlib.import_module("imageio_ffmpeg")
        audio_segment = pydub.AudioSegment
        if not getattr(audio_segment, "converter_configured", False):
            audio_segment.converter = imageio_ffmpeg.get_ffmpeg_exe()
            audio_segment.converter_configured = True
        try:
            audio = audio_segment.from_file(BytesIO(audio_data))
        except Exception:
            audio = audio_segment(
                data=audio_data,
                sample_width=2,
                frame_rate=24_000,
                channels=1,
            )
        output = BytesIO()
        audio.set_frame_rate(16_000).set_channels(1).export(
            output,
            format="opus",
            codec="libopus",
            parameters=["-b:a", "16k", "-application", "voip"],
        )
        converted = output.getvalue()
    except Exception as error:
        raise VoiceAudioConversionError("音频转换为 Opus 失败。") from error
    if not converted:
        raise VoiceAudioConversionError("音频转换为 Opus 后为空。")
    return converted
