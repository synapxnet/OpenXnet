from __future__ import annotations

import json
import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Sequence

from ..contracts import ShortTermMemoryEvent, immutable_mapping, sha256_bytes, utc_now


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _tokens_sha256(tokens: Sequence[int]) -> str:
    payload = json.dumps([int(token) for token in tokens], separators=(",", ":"))
    return sha256_bytes(payload.encode("ascii"))


@dataclass(slots=True)
class _BufferedEvent:
    contract: ShortTermMemoryEvent
    input_ids: tuple[int, ...]
    output_ids: tuple[int, ...]


class ShortTermMemoryWindow:
    """In-memory, token-bounded request context with hash-only public traces."""

    def __init__(
        self,
        *,
        maximum_events: int = 16,
        maximum_tokens: int = 4096,
        ttl_seconds: float = 3600.0,
    ) -> None:
        if maximum_events <= 0 or maximum_tokens <= 0 or ttl_seconds <= 0.0:
            raise ValueError("short-term memory limits must be positive")
        self.maximum_events = int(maximum_events)
        self.maximum_tokens = int(maximum_tokens)
        self.ttl_seconds = float(ttl_seconds)
        self._events: dict[str, deque[_BufferedEvent]] = {}
        self._lock = threading.RLock()

    def append(
        self,
        *,
        session_id: str,
        request_id: str,
        input_ids: Sequence[int],
        output_ids: Sequence[int] = (),
        metadata: Mapping[str, Any] | None = None,
        created_at_utc: str | None = None,
    ) -> ShortTermMemoryEvent:
        session_id = session_id.strip()
        request_id = request_id.strip()
        if not session_id or not request_id:
            raise ValueError("session_id and request_id are required")
        input_tokens = tuple(int(token) for token in input_ids)
        output_tokens = tuple(int(token) for token in output_ids)
        timestamp = created_at_utc or utc_now()
        material = {
            "session_id": session_id,
            "request_id": request_id,
            "input_sha256": _tokens_sha256(input_tokens),
            "output_sha256": None if not output_tokens else _tokens_sha256(output_tokens),
            "created_at_utc": timestamp,
        }
        event_id = sha256_bytes(
            json.dumps(material, sort_keys=True, separators=(",", ":")).encode("utf-8")
        )
        contract = ShortTermMemoryEvent(
            event_id=event_id,
            session_id=session_id,
            request_id=request_id,
            token_count=len(input_tokens) + len(output_tokens),
            input_sha256=material["input_sha256"],
            output_sha256=material["output_sha256"],
            metadata=immutable_mapping(metadata),
            created_at_utc=timestamp,
        )
        with self._lock:
            queue = self._events.setdefault(session_id, deque())
            queue.append(
                _BufferedEvent(
                    contract=contract,
                    input_ids=input_tokens,
                    output_ids=output_tokens,
                )
            )
            self._prune_locked(session_id, now=_parse_time(timestamp))
        return contract

    def _prune_locked(self, session_id: str, *, now: datetime) -> None:
        queue = self._events.get(session_id)
        if queue is None:
            return
        cutoff = now - timedelta(seconds=self.ttl_seconds)
        while queue and _parse_time(queue[0].contract.created_at_utc) < cutoff:
            queue.popleft()
        while len(queue) > self.maximum_events:
            queue.popleft()
        token_count = sum(item.contract.token_count for item in queue)
        while queue and token_count > self.maximum_tokens:
            token_count -= queue.popleft().contract.token_count
        if not queue:
            self._events.pop(session_id, None)

    def prune(self, *, now_utc: str | None = None) -> None:
        now = _parse_time(now_utc or utc_now())
        with self._lock:
            for session_id in list(self._events):
                self._prune_locked(session_id, now=now)

    def context_tokens(self, session_id: str) -> tuple[int, ...]:
        with self._lock:
            self._prune_locked(session_id, now=datetime.now(timezone.utc))
            queue = self._events.get(session_id, ())
            values: list[int] = []
            for item in queue:
                values.extend(item.input_ids)
                values.extend(item.output_ids)
            return tuple(values[-self.maximum_tokens :])

    def events(self, session_id: str) -> tuple[ShortTermMemoryEvent, ...]:
        with self._lock:
            self._prune_locked(session_id, now=datetime.now(timezone.utc))
            return tuple(item.contract for item in self._events.get(session_id, ()))

    def clear(self, session_id: str) -> None:
        with self._lock:
            self._events.pop(session_id, None)
