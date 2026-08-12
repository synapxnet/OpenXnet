# -*- coding: utf-8 -*-
"""Dependency-light schedule projection and due-task selection policy."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from typing import Any, Iterable, Mapping

from py.task_planning import SCHEDULE_TYPE_ONCE, SCHEDULE_TYPE_RECURRING


WEEKDAY_INDEX = {
    "MO": 0,
    "TU": 1,
    "WE": 2,
    "TH": 3,
    "FR": 4,
    "SA": 5,
    "SU": 6,
}


@dataclass(frozen=True, slots=True)
class ScheduleProjection:
    """Next-run projection or bounded error for one recurring task."""

    task_id: str
    next_run_at: str | None
    error: str


@dataclass(frozen=True, slots=True)
class DueTaskExecution:
    """One task activation selected by the schedule policy."""

    task_id: str
    matched_at: str
    next_run_at: str | None
    due_at: datetime


def parse_schedule_datetime(value: Any) -> datetime | None:
    """Parse one ISO timestamp without changing its timezone semantics."""

    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def compute_next_run_from_expression(
    expression: str,
    reference: datetime,
) -> datetime | None:
    """Compute the next run for one supported RRULE or natural interval."""

    normalized = str(expression or "").strip()
    if not normalized:
        return None
    if normalized.upper().startswith("RRULE:"):
        normalized = normalized[len("RRULE:"):].strip()
    rrule = _parse_rrule_expression(normalized)
    try:
        if rrule:
            return _compute_rrule_next_run(rrule, reference)
        return _compute_natural_next_run(normalized, reference)
    except (OverflowError, ValueError):
        return None


def project_missing_recurring_runs(
    tasks: Iterable[Mapping[str, Any]],
    reference: datetime,
) -> list[ScheduleProjection]:
    """Project next-run timestamps for recurring tasks that do not have one."""

    projections: list[ScheduleProjection] = []
    for task in tasks:
        context = _task_context(task)
        if str(context.get("schedule_type") or "").strip() != SCHEDULE_TYPE_RECURRING:
            continue
        if str(context.get("next_run_at") or "").strip():
            continue
        task_id = _task_id(task)
        if not task_id:
            continue
        expression = str(context.get("schedule_expression") or "").strip()
        next_run = compute_next_run_from_expression(expression, reference)
        projections.append(ScheduleProjection(
            task_id=task_id,
            next_run_at=next_run.isoformat() if next_run else None,
            error=(
                ""
                if next_run
                else "Recurring task needs a supported schedule expression before it can auto-run."
            ),
        ))
    return projections


def collect_due_task_executions(
    tasks: Iterable[Mapping[str, Any]],
    reference: datetime,
) -> list[DueTaskExecution]:
    """Select due once and recurring tasks in deterministic due-time order."""

    decisions: list[DueTaskExecution] = []
    for task in tasks:
        context = _task_context(task)
        schedule_type = str(context.get("schedule_type") or "").strip()
        if schedule_type not in {SCHEDULE_TYPE_ONCE, SCHEDULE_TYPE_RECURRING}:
            continue
        due_at = parse_schedule_datetime(context.get("next_run_at"))
        if due_at is None or not _is_due(due_at, reference):
            continue
        status = _task_status(task)
        if status == "running":
            continue
        activation_requested_at = parse_schedule_datetime(context.get("activation_requested_at"))
        if status == "pending" and activation_requested_at is not None:
            if _seconds_between(reference, activation_requested_at) < 90:
                continue
        if schedule_type == SCHEDULE_TYPE_ONCE and status != "pending":
            continue
        next_run_at = None
        if schedule_type == SCHEDULE_TYPE_RECURRING:
            next_run = compute_next_run_from_expression(
                str(context.get("schedule_expression") or ""),
                reference,
            )
            if next_run is None:
                continue
            next_run_at = next_run.isoformat()
        task_id = _task_id(task)
        if not task_id:
            continue
        decisions.append(DueTaskExecution(
            task_id=task_id,
            matched_at=reference.isoformat(),
            next_run_at=next_run_at,
            due_at=due_at,
        ))
    decisions.sort(key=lambda item: item.due_at.timestamp())
    return decisions


def _task_context(task: Mapping[str, Any]) -> Mapping[str, Any]:
    """Return a task context mapping or an empty mapping."""

    context = task.get("context")
    return context if isinstance(context, Mapping) else {}


def _task_id(task: Mapping[str, Any]) -> str:
    """Return one bounded-looking task identifier from a serialized task."""

    return str(task.get("task_id") or task.get("legacy_task_id") or "").strip()[:128]


def _task_status(task: Mapping[str, Any]) -> str:
    """Normalize a serialized task status to lowercase text."""

    value = task.get("status")
    raw = getattr(value, "value", value)
    return str(raw or "").strip().lower()


def _is_due(due_at: datetime, reference: datetime) -> bool:
    """Compare timestamps safely across naive and timezone-aware values."""

    return due_at.timestamp() <= reference.timestamp()


def _seconds_between(later: datetime, earlier: datetime) -> float:
    """Return a non-negative timestamp difference across timezone styles."""

    return max(0.0, later.timestamp() - earlier.timestamp())


def _parse_rrule_expression(expression: str) -> dict[str, str]:
    """Parse semicolon-delimited RRULE fields into uppercase pairs."""

    if "=" not in expression:
        return {}
    pairs: dict[str, str] = {}
    for raw_item in expression.split(";"):
        item = raw_item.strip()
        if not item or "=" not in item:
            continue
        key, value = item.split("=", 1)
        pairs[key.strip().upper()] = value.strip().upper()
    return pairs


def _compute_rrule_next_run(
    rrule: Mapping[str, str],
    reference: datetime,
) -> datetime | None:
    """Compute the next run for the supported RRULE subset."""

    frequency = str(rrule.get("FREQ") or "").strip().upper()
    if not frequency:
        return None
    interval = _safe_positive_int(rrule.get("INTERVAL"), default=1)
    hour_valid, byhour = _parse_bounded_optional_int(rrule.get("BYHOUR"), 0, 23)
    minute_valid, byminute = _parse_bounded_optional_int(rrule.get("BYMINUTE"), 0, 59)
    second_valid, bysecond = _parse_bounded_optional_int(rrule.get("BYSECOND"), 0, 59)
    if not all((hour_valid, minute_valid, second_valid)):
        return None
    if frequency == "SECONDLY":
        return (reference + timedelta(seconds=interval)).replace(microsecond=0)
    if frequency == "MINUTELY":
        candidate = reference + timedelta(minutes=interval)
        return candidate.replace(
            second=bysecond if bysecond is not None else candidate.second,
            microsecond=0,
        )
    if frequency == "HOURLY":
        candidate = reference + timedelta(hours=interval)
        return candidate.replace(
            minute=byminute if byminute is not None else candidate.minute,
            second=bysecond if bysecond is not None else candidate.second,
            microsecond=0,
        )
    if frequency == "DAILY":
        candidate = reference.replace(
            hour=byhour if byhour is not None else reference.hour,
            minute=byminute if byminute is not None else reference.minute,
            second=bysecond if bysecond is not None else 0,
            microsecond=0,
        )
        return candidate if candidate > reference else candidate + timedelta(days=interval)
    if frequency == "WEEKLY":
        return _compute_weekly_next_run(rrule, reference, interval, byhour, byminute, bysecond)
    return None


def _compute_weekly_next_run(
    rrule: Mapping[str, str],
    reference: datetime,
    interval: int,
    byhour: int | None,
    byminute: int | None,
    bysecond: int | None,
) -> datetime | None:
    """Compute the next weekly RRULE occurrence within one year."""

    weekdays = _parse_weekdays(rrule.get("BYDAY")) or [reference.weekday()]
    week_start = reference.date() - timedelta(days=reference.weekday())
    for day_offset in range(0, 366):
        candidate_date = reference.date() + timedelta(days=day_offset)
        if candidate_date.weekday() not in weekdays:
            continue
        week_index = ((candidate_date - week_start).days) // 7
        if week_index % interval != 0:
            continue
        candidate = datetime.combine(candidate_date, datetime.min.time()).replace(
            hour=byhour if byhour is not None else reference.hour,
            minute=byminute if byminute is not None else reference.minute,
            second=bysecond if bysecond is not None else 0,
            microsecond=0,
            tzinfo=reference.tzinfo,
        )
        if candidate > reference:
            return candidate
    return None


def _compute_natural_next_run(expression: str, reference: datetime) -> datetime | None:
    """Compute the next run for supported human-readable intervals."""

    normalized = expression.strip().lower()
    interval_match = re.fullmatch(
        r"every\s+(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|week|weeks)",
        normalized,
    )
    if interval_match:
        amount = max(1, int(interval_match.group(1)))
        unit = interval_match.group(2)
        deltas = {
            "second": timedelta(seconds=amount),
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
        }
        unit_key = next(key for key in deltas if unit.startswith(key))
        return (reference + deltas[unit_key]).replace(microsecond=0)
    aliases = {
        "hourly": timedelta(hours=1),
        "every hour": timedelta(hours=1),
        "daily": timedelta(days=1),
        "every day": timedelta(days=1),
        "weekly": timedelta(weeks=1),
        "every week": timedelta(weeks=1),
    }
    delta = aliases.get(normalized)
    return (reference + delta).replace(microsecond=0) if delta else None


def _parse_weekdays(value: Any) -> list[int]:
    """Parse unique RRULE weekday tokens into Python weekday indexes."""

    weekdays: list[int] = []
    for token in str(value or "").split(","):
        weekday = WEEKDAY_INDEX.get(token.strip().upper())
        if weekday is not None and weekday not in weekdays:
            weekdays.append(weekday)
    return weekdays


def _safe_positive_int(value: Any, default: int = 1) -> int:
    """Parse a positive integer with one deterministic fallback."""

    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return max(1, default)


def _parse_bounded_optional_int(
    value: Any,
    minimum: int,
    maximum: int,
) -> tuple[bool, int | None]:
    """Parse an optional bounded integer and report whether it is valid."""

    if value in (None, ""):
        return True, None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return False, None
    if parsed < minimum or parsed > maximum:
        return False, None
    return True, parsed
