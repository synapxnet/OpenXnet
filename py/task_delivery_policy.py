# -*- coding: utf-8 -*-
"""Dependency-light retry policy for Worker-owned terminal task delivery."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import sha256
from typing import Any


DEFAULT_DELIVERY_MAX_ATTEMPTS = 3
DELIVERY_RETRY_DELAYS_SECONDS = (15, 60, 300)
TERMINAL_TASK_STATUSES = frozenset({"completed", "failed", "cancelled"})


@dataclass(frozen=True)
class TerminalDeliveryDecision:
    """One deterministic delivery attempt selected by the Task Worker."""

    task_id: str
    target: str
    attempt: int
    max_attempts: int
    attempt_id: str


def collect_terminal_delivery_decisions(
    tasks: Sequence[Mapping[str, Any]],
    reference: datetime,
    *,
    max_attempts: int = DEFAULT_DELIVERY_MAX_ATTEMPTS,
) -> list[TerminalDeliveryDecision]:
    """Collect due terminal delivery attempts in stable task and target order."""

    bounded_max_attempts = max(1, min(int(max_attempts), 10))
    decisions: list[TerminalDeliveryDecision] = []
    for task in tasks:
        status = str(task.get("status") or "").strip().lower()
        task_id = str(task.get("task_id") or task.get("legacy_task_id") or "").strip()
        if status not in TERMINAL_TASK_STATUSES or not task_id:
            continue
        records = _index_delivery_records(task.get("delivery_records"))
        targets = task.get("delivery_targets")
        if not isinstance(targets, Sequence) or isinstance(targets, (str, bytes, bytearray)):
            continue
        for target_value in targets:
            target = str(target_value or "").strip().lower()
            if target in {"", "none", "task_center"}:
                continue
            record = records.get(target, {})
            record_status = str(record.get("status") or "queued").strip().lower()
            attempts = _bounded_attempts(record.get("attempts"))
            if attempts >= bounded_max_attempts:
                continue
            if record_status == "retry_scheduled":
                next_attempt_at = _parse_datetime(record.get("next_attempt_at"))
                if next_attempt_at is not None and _compare_datetime(next_attempt_at, reference) > 0:
                    continue
            elif record_status != "queued":
                continue
            attempt = attempts + 1
            run_identity = str(
                task.get("completed_at")
                or task.get("updated_at")
                or task.get("created_at")
                or ""
            ).strip()
            attempt_id = _build_attempt_id(task_id, target, attempt, run_identity)
            decisions.append(TerminalDeliveryDecision(
                task_id=task_id,
                target=target,
                attempt=attempt,
                max_attempts=bounded_max_attempts,
                attempt_id=attempt_id,
            ))
    decisions.sort(key=lambda item: (item.task_id, item.target, item.attempt))
    return decisions


def compute_delivery_retry_at(attempt: int, attempted_at: datetime) -> str:
    """Return the bounded exponential retry timestamp after one failed attempt."""

    index = max(0, min(int(attempt) - 1, len(DELIVERY_RETRY_DELAYS_SECONDS) - 1))
    retry_at = attempted_at + timedelta(seconds=DELIVERY_RETRY_DELAYS_SECONDS[index])
    return retry_at.isoformat()


def _index_delivery_records(value: Any) -> dict[str, Mapping[str, Any]]:
    """Normalize list or object delivery records into a target-keyed mapping."""

    if isinstance(value, Mapping):
        return {
            str(key or "").strip().lower(): item
            for key, item in value.items()
            if isinstance(item, Mapping)
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return {
            str(item.get("target") or "").strip().lower(): item
            for item in value
            if isinstance(item, Mapping) and str(item.get("target") or "").strip()
        }
    return {}


def _bounded_attempts(value: Any) -> int:
    """Normalize an unknown persisted attempt count to a safe integer."""

    try:
        return max(0, min(int(value or 0), 10))
    except (TypeError, ValueError):
        return 0


def _parse_datetime(value: Any) -> datetime | None:
    """Parse one ISO timestamp while preserving its timezone semantics."""

    text = str(value or "").strip()
    if not text or len(text) > 128:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _compare_datetime(left: datetime, right: datetime) -> int:
    """Compare aware or naive datetimes after aligning their timezone form."""

    if left.tzinfo is None and right.tzinfo is not None:
        right = right.replace(tzinfo=None)
    elif left.tzinfo is not None and right.tzinfo is None:
        left = left.replace(tzinfo=None)
    return (left > right) - (left < right)


def _build_attempt_id(task_id: str, target: str, attempt: int, run_identity: str) -> str:
    """Build a stable opaque idempotency key for one logical delivery attempt."""

    digest = sha256(
        f"{task_id}\0{target}\0{attempt}\0{run_identity}".encode("utf-8")
    ).hexdigest()[:32]
    return f"dly_{digest}"
