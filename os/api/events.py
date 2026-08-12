"""
OpenXnet Neuro-Symbolic OS - SSE Event Bus

Server-Sent Events streaming for real-time OS state updates.
"""

import asyncio
import json
import time
from typing import AsyncGenerator, Dict, List, Optional, Any
from dataclasses import dataclass, field


@dataclass
class OSEvent:
    event_type: str
    source: str
    payload: Dict[str, Any] = field(default_factory=dict)
    tick: int = 0
    timestamp: float = field(default_factory=time.time)


class EventBus:
    """Central event bus for the kernel OS. Supports pub/sub with SSE streaming."""

    def __init__(self, max_history: int = 200):
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._global_subscribers: List[asyncio.Queue] = []
        self._history: List[OSEvent] = []
        self._max_history = max_history
        self._tick = 0

    def emit(self, event_type: str, source: str, payload: Optional[Dict[str, Any]] = None):
        event = OSEvent(
            event_type=event_type,
            source=source,
            payload=payload or {},
            tick=self._tick,
        )
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        for queue in self._global_subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

        if event_type in self._subscribers:
            for queue in self._subscribers[event_type]:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    def advance_tick(self):
        self._tick += 1

    @property
    def tick(self) -> int:
        return self._tick

    def subscribe_all(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._global_subscribers.append(queue)
        return queue

    def unsubscribe_all(self, queue: asyncio.Queue):
        if queue in self._global_subscribers:
            self._global_subscribers.remove(queue)

    def subscribe(self, event_type: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(queue)
        return queue

    def unsubscribe(self, event_type: str, queue: asyncio.Queue):
        if event_type in self._subscribers:
            subs = self._subscribers[event_type]
            if queue in subs:
                subs.remove(queue)

    def get_history(self, limit: int = 50, event_type: Optional[str] = None) -> List[OSEvent]:
        events = self._history
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return events[-limit:]

    async def stream(self) -> AsyncGenerator[str, None]:
        queue = self.subscribe_all()
        try:
            while True:
                event = await queue.get()
                data = json.dumps({
                    "event": event.event_type,
                    "source": event.source,
                    "payload": event.payload,
                    "tick": event.tick,
                    "timestamp": event.timestamp,
                })
                yield f"data: {data}\n\n"
        finally:
            self.unsubscribe_all(queue)
