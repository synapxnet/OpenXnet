from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path
from typing import Any, Mapping

from ..contracts import MemoryUseTrace, utc_now


class MemoryTracer:
    """Append-only hash-chain trace for memory use events."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        if os.name != "nt":
            os.chmod(self.path.parent, 0o700)

    @staticmethod
    def _hash(value: Mapping[str, Any]) -> str:
        encoded = json.dumps(
            dict(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _tail(self) -> tuple[int, str | None]:
        if not self.path.is_file() or self.path.stat().st_size == 0:
            return 0, None
        last = None
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    last = json.loads(line)
        if last is None:
            return 0, None
        return int(last["sequence"]) + 1, str(last["event_sha256"])

    def append(self, trace: MemoryUseTrace) -> str:
        with self._lock:
            sequence, previous = self._tail()
            trace_payload = {
                "trace_id": trace.trace_id,
                "request_id": trace.request_id,
                "memory_id": trace.memory_id,
                "condition": trace.condition,
                "selected_record_sha256": trace.selected_record_sha256,
                "input_sha256": trace.input_sha256,
                "output_sha256": trace.output_sha256,
                "timings_ms": dict(trace.timings_ms),
                "gates": dict(trace.gates),
                "metadata": dict(trace.metadata),
                "created_at_utc": trace.created_at_utc,
            }
            event = {
                "schema_version": "synapxnet.memory_trace.v1",
                "sequence": sequence,
                "previous_event_sha256": previous,
                "trace": trace_payload,
                "recorded_at_utc": utc_now(),
            }
            event_sha256 = self._hash(event)
            event["event_sha256"] = event_sha256
            with self.path.open("a", encoding="utf-8", newline="\n") as handle:
                handle.write(json.dumps(event, sort_keys=True, ensure_ascii=False, allow_nan=False) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
            if os.name != "nt":
                os.chmod(self.path, 0o600)
            return event_sha256

    def verify(self) -> bool:
        previous = None
        expected_sequence = 0
        if not self.path.is_file():
            return True
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                event = json.loads(line)
                digest = event.pop("event_sha256")
                if event["sequence"] != expected_sequence:
                    return False
                if event["previous_event_sha256"] != previous:
                    return False
                if self._hash(event) != digest:
                    return False
                previous = digest
                expected_sequence += 1
        return True
