#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# SPDX-FileCopyrightText: k2-fsa/sherpa-onnx
# SPDX-FileCopyrightText: 2026 Synapxnet
# SPDX-License-Identifier: Apache-2.0
"""Compatibility API forwarding legacy Sherpa requests to Voice Worker."""

from __future__ import annotations

from py.voice_worker_client import transcribe_with_voice_worker


DEFAULT_SHERPA_MODEL_NAME = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue"


async def sherpa_recognize(
    audio_bytes: bytes,
    model_name: str = DEFAULT_SHERPA_MODEL_NAME,
) -> str:
    """Preserve the legacy async API while delegating inference to Voice Worker."""

    return await transcribe_with_voice_worker(audio_bytes, model_name)
