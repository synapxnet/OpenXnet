# -*- coding: utf-8 -*-
"""Tests for dependency-free WAV-to-PCM16 conversion."""

from __future__ import annotations

from array import array
from io import BytesIO
import sys
import unittest
import wave

from py.audio_pcm import AudioPcmConversionError, convert_wav_to_pcm16


def create_pcm16_wav(samples: list[int], sample_rate: int, channels: int = 1) -> bytes:
    """Create one little-endian PCM16 WAV fixture from interleaved samples."""

    encoded = array("h", samples)
    if sys.byteorder != "little":
        encoded.byteswap()
    output = BytesIO()
    with wave.open(output, "wb") as wave_file:
        wave_file.setnchannels(channels)
        wave_file.setsampwidth(2)
        wave_file.setframerate(sample_rate)
        wave_file.writeframes(encoded.tobytes())
    return output.getvalue()


def decode_pcm16(samples: bytes) -> list[int]:
    """Decode little-endian PCM16 bytes for assertions."""

    decoded = array("h")
    decoded.frombytes(samples)
    if sys.byteorder != "little":
        decoded.byteswap()
    return decoded.tolist()


def create_pcm8_wav(samples: bytes, sample_rate: int) -> bytes:
    """Create one unsigned 8-bit mono WAV fixture."""

    output = BytesIO()
    with wave.open(output, "wb") as wave_file:
        wave_file.setnchannels(1)
        wave_file.setsampwidth(1)
        wave_file.setframerate(sample_rate)
        wave_file.writeframes(samples)
    return output.getvalue()


class AudioPcmConversionTests(unittest.TestCase):
    """Validate channel mixing, resampling, and malformed-input handling."""

    def test_stereo_pcm16_is_mixed_to_mono(self) -> None:
        """Average each interleaved stereo frame without a numeric dependency."""

        audio = create_pcm16_wav([1_000, -1_000, 3_000, 1_000], 16_000, channels=2)

        converted = convert_wav_to_pcm16(audio)

        self.assertEqual(decode_pcm16(converted), [0, 2_000])

    def test_pcm16_is_resampled_to_target_rate(self) -> None:
        """Produce the duration-preserving target sample count with stable endpoints."""

        audio = create_pcm16_wav([-2_000, -1_000, 1_000, 2_000], 8_000)

        converted = decode_pcm16(convert_wav_to_pcm16(audio, 16_000))

        self.assertEqual(len(converted), 8)
        self.assertEqual(converted[0], -2_000)
        self.assertEqual(converted[-1], 2_000)

    def test_unsigned_pcm8_is_scaled_to_signed_pcm16(self) -> None:
        """Map the full unsigned 8-bit range to signed PCM16 samples."""

        audio = create_pcm8_wav(bytes([0, 128, 255]), 16_000)

        converted = convert_wav_to_pcm16(audio)

        self.assertEqual(decode_pcm16(converted), [-32_768, 0, 32_512])

    def test_invalid_wav_is_rejected(self) -> None:
        """Raise a stable conversion error instead of importing a fallback decoder."""

        with self.assertRaises(AudioPcmConversionError):
            convert_wav_to_pcm16(b"not-a-wave")


if __name__ == "__main__":
    unittest.main()
