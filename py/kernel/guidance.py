#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Live, non-interrupting guidance queue for active conversations."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional


GUIDANCE_MODES = {"soft", "constraint", "safety", "interrupt"}


@dataclass
class GuidanceItem:
    guidance_id: str
    conversation_id: str
    turn_id: str
    trace_id: str
    text: str
    mode: str = "soft"
    priority: int = 0
    consumed: bool = False
    consumed_at: str = ""
    created_at: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


class LiveGuidanceBus:
    """In-memory queue consumed by QueryEngine at safe checkpoints."""

    def __init__(self):
        self._items: List[GuidanceItem] = []
        self._lock = threading.Lock()

    def add(
        self,
        *,
        text: str,
        conversation_id: str = "",
        turn_id: str = "",
        trace_id: str = "",
        mode: str = "soft",
        priority: int = 0,
    ) -> GuidanceItem:
        normalized_mode = mode if mode in GUIDANCE_MODES else "soft"
        item = GuidanceItem(
            guidance_id=f"guidance_{uuid.uuid4().hex}",
            conversation_id=conversation_id or "__default__",
            turn_id=turn_id or "",
            trace_id=trace_id or "",
            text=str(text or "").strip(),
            mode=normalized_mode,
            priority=int(priority or 0),
            created_at=time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        )
        with self._lock:
            self._items.append(item)
            self._items = self._items[-200:]
        return item

    def consume(
        self,
        *,
        conversation_id: str = "",
        turn_id: str = "",
        trace_id: str = "",
        limit: int = 10,
    ) -> List[GuidanceItem]:
        key = conversation_id or "__default__"
        now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        matches: List[GuidanceItem] = []
        with self._lock:
            for item in self._items:
                if item.consumed:
                    continue
                if item.conversation_id not in {key, "__default__"}:
                    continue
                if item.turn_id and turn_id and item.turn_id != turn_id:
                    continue
                if item.trace_id and trace_id and item.trace_id != trace_id:
                    continue
                item.consumed = True
                item.consumed_at = now
                matches.append(item)
                if len(matches) >= limit:
                    break
        return sorted(matches, key=lambda item: item.priority, reverse=True)

    def pending(self, conversation_id: str = "") -> List[Dict]:
        key = conversation_id or ""
        with self._lock:
            items = [
                item.to_dict()
                for item in self._items
                if not item.consumed and (not key or item.conversation_id in {key, "__default__"})
            ]
        return items

    def status(self) -> Dict:
        with self._lock:
            pending = sum(1 for item in self._items if not item.consumed)
            consumed = sum(1 for item in self._items if item.consumed)
        return {"pending": pending, "consumed": consumed, "capacity": 200}


def format_guidance_context(items: List[GuidanceItem]) -> str:
    if not items:
        return ""
    lines = [
        "[OpenXnet Live Guidance]",
        "The user added these non-interrupting corrections while the turn was running.",
        "Apply them to subsequent reasoning, tool selection, and final response.",
    ]
    for item in items:
        lines.append(f"- ({item.mode}, priority={item.priority}) {item.text}")
    return "\n".join(lines)


_bus = LiveGuidanceBus()


def get_guidance_bus() -> LiveGuidanceBus:
    return _bus
