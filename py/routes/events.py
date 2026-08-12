#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
SSE event bus and endpoint for real-time memory/observation event streaming.

Provides /v1/memory/events as a Server-Sent Events stream that the main
browser window (Recall Center, Task Center) can subscribe to for live
observation updates without polling.

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "Claude Code"
__email__ = "synapxnet@gmail.com"

import asyncio
import json
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["events"])


class MemoryEventBus:
    """Fan-out event bus for SSE subscribers."""

    def __init__(self):
        self._subscribers: List[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=64)
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(queue)
        except ValueError:
            pass

    async def publish(self, event_type: str, data: Dict[str, Any]) -> None:
        payload = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                    queue.put_nowait(payload)
                except Exception:
                    pass

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


memory_event_bus = MemoryEventBus()


@router.get("/v1/memory/events")
async def memory_event_stream(request: Request):
    """SSE stream for real-time observation and memory events."""

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = memory_event_bus.subscribe()
        try:
            yield f"event: connected\ndata: {json.dumps({'status': 'ok'}, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    event_type = event.get("event", "message")
                    data = json.dumps(event.get("data", {}), ensure_ascii=False)
                    yield f"event: {event_type}\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    yield f": keepalive {datetime.now().isoformat()}\n\n"
        finally:
            memory_event_bus.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/v1/memory/events/status")
async def memory_event_status():
    """Return SSE bus subscriber count for diagnostics."""
    return {
        "subscribers": memory_event_bus.subscriber_count,
        "timestamp": datetime.now().isoformat(),
    }
