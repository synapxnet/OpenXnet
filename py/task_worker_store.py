# -*- coding: utf-8 -*-
"""Direct workspace task-mirror persistence owned by supervised Task Worker."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any

from py.task_center import SubTask, TaskCenter, TaskStatus, get_task_center
from py.task_planning import (
    DELIVERY_TARGET_TASK_CENTER,
    is_planned_task_context,
    normalize_iso_datetime,
    normalize_task_plan_context,
)


MAX_WORKER_TASK_COMMAND_BYTES = 256 * 1024
MAX_CONSENSUS_BYTES = 1024 * 1024
_TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


@dataclass(frozen=True)
class WorkerTaskCreateCommand:
    """One validated task-mirror creation command from Desktop Core."""

    task_id: str
    title: str
    description: str
    agent_type: str
    context: dict[str, Any]
    start_immediately: bool


def normalize_worker_task_create_command(value: Any) -> WorkerTaskCreateCommand:
    """Validate and normalize one exact bounded Core task mirror payload."""

    allowed_fields = {
        "task_id", "title", "description", "agent_type", "context",
        "schedule_type", "schedule_expression", "next_run_at",
        "delivery_targets", "start_immediately",
    }
    if not isinstance(value, Mapping) or set(value) - allowed_fields:
        raise ValueError("Task Worker creation fields are invalid.")
    task_id = _bounded_identifier(value.get("task_id"), "task_id")
    title = _bounded_text(value.get("title"), "title", 512, allow_empty=False)
    description = _bounded_text(
        value.get("description"),
        "description",
        32_768,
        allow_empty=True,
    )
    agent_type = _bounded_text(
        value.get("agent_type", "default"),
        "agent_type",
        128,
        allow_empty=False,
    )
    context_value = value.get("context")
    if context_value is None:
        context_value = {}
    if not isinstance(context_value, Mapping):
        raise ValueError("Task Worker creation context is invalid.")
    try:
        encoded_context = json.dumps(
            dict(context_value),
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        context = json.loads(encoded_context.decode("utf-8"))
    except (TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Task Worker creation context is invalid.") from error
    if len(encoded_context) > MAX_WORKER_TASK_COMMAND_BYTES or not isinstance(context, dict):
        raise ValueError("Task Worker creation context exceeds the payload budget.")
    for source_field, context_field in (
        ("schedule_type", "schedule_type"),
        ("schedule_expression", "schedule_expression"),
        ("next_run_at", "next_run_at"),
        ("delivery_targets", "delivery_targets"),
    ):
        if source_field in value:
            context[context_field] = value.get(source_field)
    normalized_context = normalize_task_plan_context(
        context,
        default_delivery_targets=[DELIVERY_TARGET_TASK_CENTER],
    )
    if "start_immediately" in value and not isinstance(
        value.get("start_immediately"),
        bool,
    ):
        raise ValueError("Task Worker creation start_immediately is invalid.")
    start_immediately = (
        value["start_immediately"]
        if "start_immediately" in value
        else not is_planned_task_context(normalized_context)
    )
    return WorkerTaskCreateCommand(
        task_id=task_id,
        title=title,
        description=description,
        agent_type=agent_type,
        context=normalized_context,
        start_immediately=start_immediately,
    )


class TaskWorkerTaskStore:
    """Apply desktop task commands directly to one canonical workspace mirror."""

    def __init__(self, workspace_path: str) -> None:
        """Bind the store to one existing canonical workspace directory."""

        workspace = Path(str(workspace_path or "")).expanduser().resolve(strict=True)
        if not workspace.is_dir():
            raise ValueError("Task Worker workspace directory does not exist.")
        self.workspace_path = str(workspace)

    async def list_response(self) -> dict[str, Any]:
        """Return all sanitized task mirrors with stable child counts."""

        center = await self._center()
        tasks = await center.list_tasks()
        return {
            "tasks": self._serialize_task_items(center, tasks),
            "workspace_path": self.workspace_path,
        }

    async def get_response(self, task_id: str) -> dict[str, Any]:
        """Return one detailed task mirror, children, and bounded consensus."""

        normalized_task_id = _bounded_identifier(task_id, "taskId")
        center = await self._center()
        task = await center.get_task(normalized_task_id)
        if task is None:
            raise ValueError("Task Worker task was not found.")
        child_tasks = await center.list_tasks(parent_task_id=normalized_task_id)
        return {
            "task": center.serialize_task(task, child_task_count=len(child_tasks)),
            "child_tasks": [center.serialize_task(child) for child in child_tasks],
            "consensus_content": await self.read_consensus(),
            "workspace_dir": self.workspace_path,
        }

    async def get_task(self, task_id: str) -> SubTask | None:
        """Return one raw compatibility task for Worker-internal decisions."""

        return await (await self._center()).get_task(_bounded_identifier(task_id, "taskId"))

    async def create_task(self, command: WorkerTaskCreateCommand) -> SubTask:
        """Create one idempotent mirror and optionally queue it for execution."""

        center = await self._center()
        task = await center.create_task(
            title=command.title,
            description=command.description,
            agent_type=command.agent_type,
            parent_task_id="MANUAL_USER",
            context=command.context,
            task_id=command.task_id,
        )
        if command.start_immediately:
            task = await center.start_task(
                command.task_id,
                trigger_source="worker_create_task",
            ) or task
        return task

    async def start_task(self, task_id: str, trigger_source: str) -> SubTask:
        """Queue one pending task without permitting terminal-state shortcuts."""

        normalized_task_id = _bounded_identifier(task_id, "taskId")
        center = await self._center()
        task = await center.get_task(normalized_task_id)
        if task is None:
            raise ValueError("Task Worker task was not found.")
        if task.status != TaskStatus.PENDING:
            raise ValueError("Only pending Task Worker tasks can be started.")
        started = await center.start_task(
            normalized_task_id,
            trigger_source=_bounded_text(
                trigger_source or "desktop_core",
                "triggerSource",
                128,
                allow_empty=False,
            ),
        )
        if started is None:
            raise ValueError("Task Worker task could not be queued.")
        return started

    async def resume_task(
        self,
        task_id: str,
        resume_note: str,
        recovery_action_id: str,
    ) -> SubTask:
        """Reset one terminal task using a validated stored recovery action."""

        normalized_task_id = _bounded_identifier(task_id, "taskId")
        center = await self._center()
        task = await center.get_task(normalized_task_id)
        if task is None:
            raise ValueError("Task Worker task was not found.")
        if task.status in {TaskStatus.PENDING, TaskStatus.RUNNING}:
            raise ValueError("Task Worker task is already active.")
        task_payload = center.serialize_task(task)
        selected_action = self._resolve_recovery_action(
            task_payload,
            recovery_action_id,
        )
        normalized_note = _bounded_text(
            resume_note,
            "resumeNote",
            32_768,
            allow_empty=True,
        )
        if not normalized_note and selected_action:
            normalized_note = _bounded_text(
                selected_action.get("resume_note"),
                "recoveryAction.resume_note",
                32_768,
                allow_empty=True,
            )
        if not normalized_note:
            normalized_note = "Resume the unfinished work from the saved task context."
        resumed = await center.resume_task(
            normalized_task_id,
            resume_note=normalized_note,
            recovery_action=selected_action,
        )
        if resumed is None:
            raise ValueError("Task Worker task could not be resumed.")
        return resumed

    async def cancel_task(self, task_id: str) -> bool:
        """Commit cancellation to the compatibility mirror idempotently."""

        return await (await self._center()).cancel_task(
            _bounded_identifier(task_id, "taskId")
        )

    async def delete_task(self, task_id: str) -> bool:
        """Delete one compatibility mirror after Core has tombstoned its task."""

        return await (await self._center()).delete_task(
            _bounded_identifier(task_id, "taskId")
        )

    async def project_schedule(
        self,
        task_id: str,
        next_run_at: str | None,
        error: str,
    ) -> SubTask:
        """Persist one Worker-computed recurring projection or bounded error."""

        normalized_task_id = _bounded_identifier(task_id, "taskId")
        normalized_next_run = normalize_iso_datetime(next_run_at)
        normalized_error = " ".join(str(error or "").split())[:260]
        if next_run_at and normalized_next_run is None:
            raise ValueError("Task Worker projection timestamp is invalid.")
        if normalized_next_run is None and not normalized_error:
            raise ValueError("Task Worker projection result is required.")
        center = await self._center()
        task = await center.get_task(normalized_task_id)
        if task is None:
            raise ValueError("Task Worker task was not found.")
        current_context = task.context or {}
        if (
            normalize_iso_datetime(current_context.get("next_run_at")) == normalized_next_run
            and str(current_context.get("scheduler_last_error") or "") == normalized_error
        ):
            return task
        trace_event = None
        if normalized_error and str(current_context.get("scheduler_last_error") or "") != normalized_error:
            trace_event = {
                "event_type": "schedule",
                "title": "Recurring schedule needs attention",
                "message": normalized_error,
            }
        updated = await center.mutate_task_context(
            normalized_task_id,
            {
                "next_run_at": normalized_next_run,
                "scheduler_last_error": normalized_error,
                "scheduler_last_error_at": datetime.now().isoformat() if normalized_error else None,
            },
            trace_event=trace_event,
            touch_updated_at=True,
        )
        if updated is None:
            raise ValueError("Task Worker projection was not persisted.")
        return updated

    async def mark_scheduler_blocked(
        self,
        task_id: str,
        matched_at: str,
        message: str,
    ) -> SubTask | None:
        """Persist one generic read-only preflight rejection for diagnostics."""

        normalized_task_id = _bounded_identifier(task_id, "taskId")
        normalized_matched_at = normalize_iso_datetime(matched_at)
        if normalized_matched_at is None:
            raise ValueError("Task Worker scheduler match timestamp is invalid.")
        normalized_message = _bounded_text(
            message,
            "message",
            260,
            allow_empty=False,
        )
        center = await self._center()
        task = await center.get_task(normalized_task_id)
        if task is None:
            return None
        current_error = str((task.context or {}).get("scheduler_last_error") or "")
        if current_error == normalized_message:
            return task
        return await center.mutate_task_context(
            normalized_task_id,
            {
                "scheduler_last_matched_at": normalized_matched_at,
                "scheduler_last_error": normalized_message,
                "scheduler_last_error_at": normalized_matched_at,
            },
            trace_event={
                "event_type": "schedule",
                "title": "Scheduled run is waiting for provider readiness",
                "message": normalized_message,
            },
            touch_updated_at=True,
        )

    async def activate_scheduled_task(
        self,
        task_id: str,
        matched_at: str,
        next_run_at: str | None,
    ) -> SubTask:
        """Atomically activate one due task after a successful preflight."""

        normalized_task_id = _bounded_identifier(task_id, "taskId")
        normalized_matched_at = normalize_iso_datetime(matched_at)
        normalized_next_run = normalize_iso_datetime(next_run_at)
        if normalized_matched_at is None:
            raise ValueError("Task Worker scheduler match timestamp is invalid.")
        if next_run_at and normalized_next_run is None:
            raise ValueError("Task Worker next run timestamp is invalid.")
        activated = await (await self._center()).activate_task(
            normalized_task_id,
            trigger_source="worker_scheduler_due",
            scheduler_matched_at=normalized_matched_at,
            next_run_at=normalized_next_run,
        )
        if activated is None:
            raise ValueError("Task Worker task is not eligible for scheduled activation.")
        return activated

    async def read_consensus(self) -> str | None:
        """Read one bounded UTF-8 workspace consensus without path traversal."""

        try:
            workspace_root = Path(self.workspace_path).resolve(strict=True)
            consensus_path = (workspace_root / ".agent" / "consensus.md").resolve()
            if (
                not consensus_path.is_relative_to(workspace_root)
                or not consensus_path.is_file()
                or consensus_path.stat().st_size > MAX_CONSENSUS_BYTES
            ):
                return None
            return await asyncio.to_thread(consensus_path.read_text, encoding="utf-8")
        except (OSError, RuntimeError, UnicodeDecodeError):
            return None

    async def serialize_task(self, task: SubTask) -> dict[str, Any]:
        """Serialize one task through the store's sanitized Task Center boundary."""

        return (await self._center()).serialize_task(task)

    async def _center(self) -> TaskCenter:
        """Return the role-aware Task Center for this canonical workspace."""

        return await get_task_center(self.workspace_path)

    def _serialize_task_items(
        self,
        center: TaskCenter,
        tasks: Sequence[SubTask],
    ) -> list[dict[str, Any]]:
        """Serialize task mirrors while computing bounded child counts."""

        child_counts: dict[str, int] = {}
        for task in tasks:
            if task.parent_task_id and task.parent_task_id != "MANUAL_USER":
                child_counts[task.parent_task_id] = child_counts.get(task.parent_task_id, 0) + 1
        return [
            center.serialize_task(task, child_task_count=child_counts.get(task.task_id, 0))
            for task in tasks
        ]

    def _resolve_recovery_action(
        self,
        task_payload: Mapping[str, Any],
        action_id: str,
    ) -> dict[str, Any] | None:
        """Resolve one stored action identifier or the recommended fallback."""

        raw_actions = task_payload.get("recovery_actions")
        actions = [dict(item) for item in raw_actions if isinstance(item, Mapping)] \
            if isinstance(raw_actions, list) else []
        normalized_action_id = str(action_id or "").strip()
        if normalized_action_id:
            if not _TASK_ID_PATTERN.fullmatch(normalized_action_id):
                raise ValueError("Task Worker recovery action is invalid.")
            selected = next(
                (
                    action
                    for action in actions
                    if str(action.get("action_id") or "").strip() == normalized_action_id
                ),
                None,
            )
            if selected is None:
                raise ValueError("Task Worker recovery action was not found.")
            return selected
        return next(
            (action for action in actions if action.get("recommended") is True),
            actions[0] if actions else None,
        )


def _bounded_identifier(value: Any, field_name: str) -> str:
    """Validate one bounded task command identifier."""

    normalized = str(value or "").strip()
    if not _TASK_ID_PATTERN.fullmatch(normalized):
        raise ValueError(f"Task Worker field '{field_name}' is invalid.")
    return normalized


def _bounded_text(
    value: Any,
    field_name: str,
    maximum_length: int,
    *,
    allow_empty: bool,
) -> str:
    """Validate one bounded control-character-free task command string."""

    if not isinstance(value, str):
        raise ValueError(f"Task Worker field '{field_name}' must be text.")
    normalized = value.strip()
    if (
        (not allow_empty and not normalized)
        or len(normalized) > maximum_length
        or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", normalized)
    ):
        raise ValueError(f"Task Worker field '{field_name}' is invalid.")
    return normalized
