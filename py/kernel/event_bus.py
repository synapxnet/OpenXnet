#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Lightweight in-process kernel event fan-out for UI and diagnostics."""

from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Any, Deque, Dict, List


def _format_time(epoch: float | None = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


class KernelEventBus:
    """Small SSE-friendly event bus with a bounded in-memory ring buffer."""

    def __init__(self, history_size: int = 200):
        self._history: Deque[Dict[str, Any]] = deque(maxlen=max(10, int(history_size or 200)))
        self._subscribers: List[asyncio.Queue] = []
        self._sequence = 0

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=128)
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(queue)
        except ValueError:
            pass

    def publish(self, event_type: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
        self._sequence += 1
        event = {
            "sequence": self._sequence,
            "event": str(event_type or "kernel.event"),
            "data": data or {},
            "timestamp": _format_time(),
        }
        self._history.append(event)

        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                    queue.put_nowait(event)
                except Exception:
                    pass
            except Exception:
                pass
        return event

    def recent(self, limit: int = 50, event_type: str = "") -> List[Dict[str, Any]]:
        max_items = max(1, min(int(limit or 50), 200))
        wanted = str(event_type or "").strip()
        events = list(self._history)
        if wanted:
            events = [event for event in events if event.get("event") == wanted]
        return events[-max_items:]

    def status(self) -> Dict[str, Any]:
        return {
            "subscribers": len(self._subscribers),
            "historySize": len(self._history),
            "lastSequence": self._sequence,
        }


_kernel_event_bus = KernelEventBus()


def get_kernel_event_bus() -> KernelEventBus:
    return _kernel_event_bus
