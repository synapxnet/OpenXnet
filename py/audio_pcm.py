# -*- coding: utf-8 -*-
"""Lightweight WAV-to-PCM16 conversion without NumPy or SciPy."""

from __future__ import annotations

from array import array
from io import BytesIO
import sys
import wave


class AudioPcmConversionError(ValueError):
    """Signal invalid or unsupported WAV input for ASR conversion."""


def convert_wav_to_pcm16(audio_bytes: bytes, target_sample_rate: int = 16_000) -> bytes:
    """Decode integer PCM WAV bytes to mono little-endian PCM16 at a target rate."""

    if not isinstance(audio_bytes, bytes) or not audio_bytes:
        raise AudioPcmConversionError("WAV audio data must be non-empty bytes.")
    if not isinstance(target_sample_rate, int) or isinstance(target_sample_rate, bool):
        raise AudioPcmConversionError("Target sample rate must be an integer.")
    if target_sample_rate <= 0:
        raise AudioPcmConversionError("Target sample rate must be positive.")

    try:
        with wave.open(BytesIO(audio_bytes), "rb") as wave_file:
            channel_count = wave_file.getnchannels()
            sample_width = wave_file.getsampwidth()
            source_sample_rate = wave_file.getframerate()
            frame_count = wave_file.getnframes()
            compression_type = wave_file.getcomptype()
            frames = wave_file.readframes(frame_count)
    except (EOFError, wave.Error) as error:
        raise AudioPcmConversionError(f"Invalid WAV audio: {error}") from error

    if compression_type != "NONE":
        raise AudioPcmConversionError(f"Unsupported WAV compression type: {compression_type}")
    if channel_count <= 0 or source_sample_rate <= 0 or frame_count <= 0 or not frames:
        raise AudioPcmConversionError("WAV audio contains no decodable frames.")

    samples = _decode_integer_pcm(frames, sample_width)
    mono_samples = _mix_channels(samples, channel_count)
    converted_samples = _resample_linear(
        mono_samples,
        source_sample_rate,
        target_sample_rate,
    )
    return _encode_little_endian_pcm16(converted_samples)


def _decode_integer_pcm(frames: bytes, sample_width: int) -> array:
    """Decode 8-, 16-, 24-, or 32-bit little-endian integer PCM to signed PCM16."""

    if sample_width not in {1, 2, 3, 4}:
        raise AudioPcmConversionError(f"Unsupported PCM sample width: {sample_width} bytes.")
    if len(frames) % sample_width != 0:
        raise AudioPcmConversionError("PCM frame data is not aligned to its sample width.")

    decoded = array("h")
    if sample_width == 1:
        decoded.extend((sample - 128) << 8 for sample in frames)
        return decoded
    if sample_width == 2:
        decoded.frombytes(frames)
        if sys.byteorder != "little":
            decoded.byteswap()
        return decoded
    if sample_width == 3:
        for offset in range(0, len(frames), 3):
            value = frames[offset] | (frames[offset + 1] << 8) | (frames[offset + 2] << 16)
            if value & 0x800000:
                value -= 1 << 24
            decoded.append(_clip_pcm16(int(value / 256)))
        return decoded

    values = array("i")
    values.frombytes(frames)
    if values.itemsize != 4:
        raise AudioPcmConversionError("This Python runtime does not provide 32-bit integer arrays.")
    if sys.byteorder != "little":
        values.byteswap()
    decoded.extend(_clip_pcm16(int(value / 65_536)) for value in values)
    return decoded


def _mix_channels(samples: array, channel_count: int) -> array:
    """Average interleaved PCM16 channels into one mono sample stream."""

    if channel_count <= 0 or len(samples) % channel_count != 0:
        raise AudioPcmConversionError("PCM samples are not aligned to the channel count.")
    if channel_count == 1:
        return samples

    mono = array("h")
    for offset in range(0, len(samples), channel_count):
        mixed = int(sum(samples[offset : offset + channel_count]) / channel_count)
        mono.append(_clip_pcm16(mixed))
    return mono


def _resample_linear(samples: array, source_rate: int, target_rate: int) -> array:
    """Resample PCM16 with deterministic endpoint-preserving linear interpolation."""

    if source_rate == target_rate:
        return samples
    target_count = max(1, int(len(samples) * target_rate / source_rate))
    if len(samples) == 1 or target_count == 1:
        return array("h", [samples[0]])

    result = array("h")
    position_scale = (len(samples) - 1) / (target_count - 1)
    for target_index in range(target_count):
        source_position = target_index * position_scale
        left_index = int(source_position)
        right_index = min(left_index + 1, len(samples) - 1)
        fraction = source_position - left_index
        interpolated = samples[left_index] + (
            (samples[right_index] - samples[left_index]) * fraction
        )
        result.append(_clip_pcm16(int(interpolated)))
    return result


def _encode_little_endian_pcm16(samples: array) -> bytes:
    """Serialize signed PCM16 samples in the little-endian format FunASR expects."""

    encoded = array("h", samples)
    if sys.byteorder != "little":
        encoded.byteswap()
    return encoded.tobytes()


def _clip_pcm16(value: int) -> int:
    """Clamp one integer to the signed 16-bit PCM range."""

    return max(-32_768, min(32_767, value))
