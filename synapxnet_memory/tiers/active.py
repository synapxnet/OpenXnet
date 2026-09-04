from __future__ import annotations

import threading
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from ..contracts import ActiveMemoryLease, NativeMemorySnapshot, utc_now


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


@dataclass(slots=True)
class _ActiveEntry:
    snapshot: NativeMemorySnapshot
    activated_at_utc: str
    expires_at_utc: str
    access_count: int = 0


class ActiveNativeMemoryStore:
    """Bounded session-level cache for Metis native memory snapshots."""

    def __init__(
        self,
        *,
        maximum_sessions: int = 64,
        default_lease_seconds: float = 1800.0,
    ) -> None:
        if maximum_sessions <= 0 or default_lease_seconds <= 0.0:
            raise ValueError("active memory limits must be positive")
        self.maximum_sessions = int(maximum_sessions)
        self.default_lease_seconds = float(default_lease_seconds)
        self._entries: OrderedDict[str, _ActiveEntry] = OrderedDict()
        self._lock = threading.RLock()

    def _lease(self, session_id: str, entry: _ActiveEntry) -> ActiveMemoryLease:
        return ActiveMemoryLease(
            session_id=session_id,
            snapshot_id=entry.snapshot.snapshot_id,
            model_id=entry.snapshot.model_id,
            payload_sha256=entry.snapshot.payload_sha256,
            source_record_sha256=entry.snapshot.source_record_sha256,
            activated_at_utc=entry.activated_at_utc,
            expires_at_utc=entry.expires_at_utc,
            access_count=entry.access_count,
            state_sha256=str(entry.snapshot.metadata.get("state_sha256", "")),
        )

    def activate(
        self,
        snapshot: NativeMemorySnapshot,
        *,
        lease_seconds: float | None = None,
        now_utc: str | None = None,
    ) -> ActiveMemoryLease:
        session_id = snapshot.session_id.strip()
        if not session_id:
            raise ValueError("snapshot session_id is required")
        lease = self.default_lease_seconds if lease_seconds is None else float(lease_seconds)
        if lease <= 0.0:
            raise ValueError("lease_seconds must be positive")
        now = _parse_time(now_utc or utc_now())
        entry = _ActiveEntry(
            snapshot=snapshot,
            activated_at_utc=now.isoformat(),
            expires_at_utc=(now + timedelta(seconds=lease)).isoformat(),
        )
        with self._lock:
            self._prune_locked(now)
            self._entries[session_id] = entry
            self._entries.move_to_end(session_id)
            while len(self._entries) > self.maximum_sessions:
                self._entries.popitem(last=False)
            return self._lease(session_id, entry)

    def _prune_locked(self, now: datetime) -> None:
        for session_id in list(self._entries):
            if _parse_time(self._entries[session_id].expires_at_utc) <= now:
                self._entries.pop(session_id, None)

    def prune(self, *, now_utc: str | None = None) -> None:
        with self._lock:
            self._prune_locked(_parse_time(now_utc or utc_now()))

    def get(
        self,
        session_id: str,
        *,
        now_utc: str | None = None,
    ) -> tuple[NativeMemorySnapshot, ActiveMemoryLease] | None:
        now = _parse_time(now_utc or utc_now())
        with self._lock:
            self._prune_locked(now)
            entry = self._entries.get(session_id)
            if entry is None:
                return None
            entry.access_count += 1
            self._entries.move_to_end(session_id)
            return entry.snapshot, self._lease(session_id, entry)

    def update(
        self,
        snapshot: NativeMemorySnapshot,
        *,
        keep_existing_expiry: bool = True,
        now_utc: str | None = None,
    ) -> ActiveMemoryLease:
        with self._lock:
            existing = self._entries.get(snapshot.session_id)
            if existing is None or not keep_existing_expiry:
                return self.activate(snapshot, now_utc=now_utc)
            existing.snapshot = snapshot
            self._entries.move_to_end(snapshot.session_id)
            return self._lease(snapshot.session_id, existing)

    def evict(self, session_id: str) -> NativeMemorySnapshot | None:
        with self._lock:
            entry = self._entries.pop(session_id, None)
            return None if entry is None else entry.snapshot

    def leases(self, *, now_utc: str | None = None) -> tuple[ActiveMemoryLease, ...]:
        with self._lock:
            self._prune_locked(_parse_time(now_utc or utc_now()))
            return tuple(self._lease(session_id, entry) for session_id, entry in self._entries.items())
