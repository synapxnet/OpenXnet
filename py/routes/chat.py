#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Chat control routes extracted from the monolithic server module.

This module currently contains the streaming abort endpoint used by the UI
stop-generation flow and keeps the existing response shape unchanged.

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

from fastapi import APIRouter, Request

router = APIRouter(tags=["chat"])

abort_stream_provider = None


def configure_chat_routes(*, abort_stream_ref) -> None:
    """Bind the shared stream-abort callable from server.py."""
    global abort_stream_provider
    abort_stream_provider = abort_stream_ref


def _resolve(provider):
    return provider() if callable(provider) else provider


@router.post("/v1/chat/abort")
async def abort_chat_stream(request: Request):
    """
    中断正在进行的流式聊天请求。
    前端调用 stopGenerate() 时同时请求此端点，通知后端停止 LLM 流式消费。
    """
    try:
        body = await request.json()
        conversation_id = body.get("conversationId", "")
        if not conversation_id:
            return {"aborted": False, "reason": "missing conversationId"}

        abort_stream = _resolve(abort_stream_provider)
        success = abort_stream(conversation_id) if abort_stream else False
        if success:
            print(f"[AbortController] 成功中断会话: {conversation_id}")
        return {"aborted": success, "conversationId": conversation_id}
    except Exception as exc:
        return {"aborted": False, "error": str(exc)}
