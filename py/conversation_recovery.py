#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""会话恢复执行登记 / Conversation recovery execution registry.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Awaitable, Callable

from starlette.background import BackgroundTask
from starlette.responses import JSONResponse, StreamingResponse

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"


def validate_conversation_id(value: Any) -> str:
    """精确校验会话身份，禁止截断或控制字符。 / Validate exact conversation identities without truncation or control characters."""
    if not isinstance(value, str) or not value or len(value) > 512 or value != value.strip() or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError("A valid conversation identity is required")
    return value


def request_conversation_id(request: Any) -> str:
    """请求的两种身份字段必须一致；匿名兼容请求返回空。 / Require both identity aliases to agree and return empty for anonymous legacy requests."""
    values = [value for value in [getattr(request, "conversationId", None), getattr(request, "conversation_id", None)] if value is not None and value != ""]
    if not values:
        return ""
    identities = [validate_conversation_id(value) for value in values]
    if len(set(identities)) != 1:
        raise ValueError("Conversation identity aliases do not match")
    return identities[0]


@dataclass(eq=False)
class StreamRegistration:
    """一次执行的实际登记与取消信号。 / Hold the actual registration and cancellation signal for one execution."""
    conversation_id: str
    abort_event: asyncio.Event
    registered_at: str


class ConversationExecutionRegistry:
    """对每个会话保留单一执行者。 / Retain exactly one execution owner per conversation."""

    def __init__(self):
        """建立进程内有锁登记表，不持久化对话正文。 / Create a locked process registry without persisting conversation content."""
        self._lock = RLock()
        self._active: dict[str, StreamRegistration] = {}

    def reserve(self, conversation_id: str) -> StreamRegistration | None:
        """原子占用会话，已有执行时不替换登记。 / Atomically reserve a conversation without replacing an existing execution."""
        identity = validate_conversation_id(conversation_id)
        with self._lock:
            if identity in self._active:
                return None
            registration = StreamRegistration(identity, asyncio.Event(), datetime.now(timezone.utc).isoformat())
            self._active[identity] = registration
            return registration

    def release(self, registration: StreamRegistration) -> bool:
        """只有同一登记的拥有者才能清理。 / Allow cleanup only by the exact registration owner."""
        with self._lock:
            if self._active.get(registration.conversation_id) is not registration:
                return False
            del self._active[registration.conversation_id]
            return True

    def abort(self, conversation_id: str) -> bool:
        """仅发送终止信号，保持运行登记直到执行退出。 / Signal cancellation while retaining the registration until execution exits."""
        with self._lock:
            registration = self._active.get(conversation_id)
            if registration is None:
                return False
            registration.abort_event.set()
            return True

    def status(self, conversation_id: str) -> dict[str, Any]:
        """读取最少运行状态，不披露提示词和工具记录。 / Read minimal execution state without exposing prompts or tool records."""
        identity = validate_conversation_id(conversation_id)
        with self._lock:
            registration = self._active.get(identity)
            if registration is None:
                return {"conversationId": identity, "state": "idle", "abortRequested": False}
            return {"conversationId": identity, "state": "running", "registeredAt": registration.registered_at, "abortRequested": registration.abort_event.is_set()}


async def run_registered_chat(registry: ConversationExecutionRegistry, request: Any, handler: Callable[[], Awaitable[Any]]) -> Any:
    """从请求准备到真实流结束持有登记，异常不重放。 / Hold registration from request preparation through actual stream termination without replaying failures."""
    try:
        identity = request_conversation_id(request)
    except ValueError as error:
        return JSONResponse({"error": {"code": "invalid_conversation_id", "message": str(error)}}, status_code=422)
    if not identity:
        return await handler()
    registration = registry.reserve(identity)
    if registration is None:
        return JSONResponse({"error": {"code": "conversation_already_running", "message": "This conversation already has an active request."}}, status_code=409, headers={"Cache-Control": "no-store"})
    request._stream_registration = registration
    transferred = False
    try:
        response = await handler()
        if not isinstance(response, StreamingResponse):
            return response
        original_iterator = response.body_iterator
        original_background = response.background

        async def body():
            """真正消费响应时才清理登记和原始生成器。 / Clean up registration and the original generator only when the real response stream ends."""
            try:
                async for chunk in original_iterator:
                    if registration.abort_event.is_set():
                        break
                    yield chunk
            finally:
                try:
                    close = getattr(original_iterator, "aclose", None)
                    if close is not None:
                        await close()
                finally:
                    registry.release(registration)

        async def background():
            """保留已有后台清理，并提供未开始消费的释放兜底。 / Preserve existing background cleanup and release unconsumed responses."""
            try:
                if original_background is not None:
                    await original_background()
            finally:
                registry.release(registration)

        response.body_iterator = body()
        response.background = BackgroundTask(background)
        transferred = True
        return response
    finally:
        if not transferred:
            registry.release(registration)
