#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
TTS utility routes extracted from the monolithic server module.

This module currently exposes the lightweight connection-status endpoint used
by the Vue frontend to decide browser mute behavior.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-16
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-16, v1.0.0, OpenAI Codex: Initial creation.

from fastapi import APIRouter

router = APIRouter(tags=["tts"])

tts_manager_provider = None


def configure_tts_routes(*, tts_manager_ref) -> None:
    """Bind the shared TTS connection manager from server.py."""
    global tts_manager_provider
    tts_manager_provider = tts_manager_ref


def _resolve(provider):
    return provider() if callable(provider) else provider


@router.get("/tts/status")
async def get_tts_status():
    """获取连接状态：Vue 前端会调用这个来决定是否静音"""
    tts_manager = _resolve(tts_manager_provider)
    return {
        "vrm_connections": len(tts_manager.vrm_connections) if tts_manager else 0,
        "overlay_connections": len(tts_manager.overlay_connections) if tts_manager else 0,
        "main_connections": len(tts_manager.main_connections) if tts_manager else 0,
    }
