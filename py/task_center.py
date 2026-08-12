#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
任务中心 — 多任务排队、状态追踪和优先级调度。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import asyncio
import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum
import aiofiles
import aiofiles.os
from pydantic import BaseModel, Field

from py.memory.provider import get_workspace_memory_provider
from py.task_planning import (
    DELIVERY_TARGET_NONE,
    DELIVERY_TARGET_TASK_CENTER,
    SCHEDULE_TYPE_MANUAL,
    SCHEDULE_TYPE_ONCE,
    SCHEDULE_TYPE_RECURRING,
    get_delivery_status_label,
    get_delivery_target_label,
    normalize_iso_datetime,
    normalize_task_plan_context,
)
from py.task_execution_events import (
    TaskExecutionEventClient,
    build_task_execution_checkpoint,
)

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class SubTask(BaseModel):
    task_id: str
    parent_task_id: Optional[str] = None
    title: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0  # 0-100
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    agent_type: str = "default"
    # 使用 Field(default_factory=dict) 确保每个实例有独立的字典，防止引用污染
    context: Dict[str, Any] = Field(default_factory=dict)

class TaskCenter:
    """任务中心 - 管理所有主任务和子任务"""
    
    _ACTIVATION_DEDUP_WINDOW_SECONDS = 90

    def __init__(self, workspace_dir: str, *, runtime_role: Optional[str] = None):
        """Create one workspace task store with explicit process ownership."""

        self.workspace_dir = Path(workspace_dir)
        self.task_dir = self.workspace_dir / ".agent" / "tasks"
        self.memory_provider = get_workspace_memory_provider(str(self.workspace_dir))
        self.session_store = self.memory_provider
        self._lock = asyncio.Lock()
        self._runtime_session_id = uuid.uuid4().hex[:12]
        self._runtime_role = self._normalize_runtime_role(
            runtime_role or os.environ.get("OPENXNET_RUNTIME_ROLE", "server")
        )
        self._startup_at = datetime.now().isoformat()
        self._startup_reconciled = False
        self._ensure_task_dir()
    
    def _ensure_task_dir(self):
        """确保任务目录存在"""
        self.task_dir.mkdir(parents=True, exist_ok=True)

    def _normalize_runtime_role(self, value: Any) -> str:
        """Normalize process roles used by executor restart reconciliation."""

        normalized = str(value or "server").strip().lower()
        if normalized in {"task-worker", "desktop", "server", "backend"}:
            return normalized
        return "server"
    
    def _get_task_file(self, task_id: str) -> Path:
        """获取任务文件路径"""
        return self.task_dir / f"{task_id}.json"

    def _parse_iso_datetime(self, value: Optional[Any]) -> Optional[datetime]:
        normalized = normalize_iso_datetime(value)
        if not normalized:
            return None
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None

    def _normalize_delivery_records(self, task: SubTask) -> Dict[str, Dict[str, Any]]:
        raw_records = task.context.get("delivery_records")
        if not isinstance(raw_records, dict):
            raw_records = {}

        normalized_records: Dict[str, Dict[str, Any]] = {}
        for target in list(task.context.get("delivery_targets") or []):
            if target == DELIVERY_TARGET_NONE:
                continue

            raw_record = raw_records.get(target)
            if not isinstance(raw_record, dict):
                raw_record = {}

            try:
                attempts = int(raw_record.get("attempts", 0) or 0)
            except (TypeError, ValueError):
                attempts = 0

            normalized_records[target] = {
                "target": target,
                "label": str(raw_record.get("label") or get_delivery_target_label(target)).strip(),
                "status": str(raw_record.get("status") or "").strip().lower(),
                "last_attempt_at": normalize_iso_datetime(raw_record.get("last_attempt_at")),
                "last_delivered_at": normalize_iso_datetime(raw_record.get("last_delivered_at")),
                "next_attempt_at": normalize_iso_datetime(raw_record.get("next_attempt_at")),
                "last_error": self._build_preview(raw_record.get("last_error"), 260),
                "last_message": self._build_preview(raw_record.get("last_message"), 260),
                "last_attempt_id": self._build_preview(raw_record.get("last_attempt_id"), 128),
                "last_method": self._build_preview(raw_record.get("last_method"), 128),
                "retryable": bool(raw_record.get("retryable")),
                "attempts": max(0, attempts),
                "config": (
                    dict(raw_record.get("config") or {})
                    if isinstance(raw_record.get("config"), dict)
                    else {}
                ),
            }

        task.context["delivery_records"] = normalized_records
        return normalized_records

    def _queue_task_for_execution_locked(
        self,
        task: SubTask,
        *,
        trigger_source: str,
        requested_at: str,
    ) -> None:
        self._reset_executor_session(task)
        task.updated_at = requested_at
        task.context["activation_requested_at"] = requested_at
        task.context["activation_source"] = str(trigger_source or "manual_run_now").strip() or "manual_run_now"
        self._sync_task_plan_runtime(task, now=requested_at)
        self._append_trace_event(
            task,
            event_type="activation",
            title=(
                "Planned task queued for execution"
                if task.context.get("is_planned_task")
                else "Task queued for execution"
            ),
            message="\n".join(
                line
                for line in [
                    task.context.get("schedule_summary") if task.context.get("is_planned_task") else "",
                    f"Trigger source: {task.context['activation_source']}",
                ]
                if line
            ) or "Task queued for execution.",
        )

    def _was_recently_queued(self, task: SubTask, now: str) -> bool:
        activation_requested_at = self._parse_iso_datetime(task.context.get("activation_requested_at"))
        current_time = self._parse_iso_datetime(now)
        if not activation_requested_at or not current_time or task.started_at:
            return False
        return (
            (current_time - activation_requested_at).total_seconds()
            < self._ACTIVATION_DEDUP_WINDOW_SECONDS
        )

    def _reset_task_for_scheduled_run_locked(
        self,
        task: SubTask,
        *,
        requested_at: str,
        trigger_source: str,
    ) -> None:
        previous_status = self._normalize_status(task.status)
        previous_progress = max(0, min(100, int(task.progress or 0)))
        previous_summary = task.context.get("summary") or self._build_preview(
            task.result or task.context.get("last_result"),
            220,
        )

        if task.error:
            task.context["last_error"] = task.error
        if task.result:
            task.context["last_result"] = task.result

        self._reset_terminal_state(task)
        self._reset_interruption_state(task)

        task.status = TaskStatus.PENDING
        task.progress = 0
        task.result = None
        task.error = None
        task.started_at = None
        task.completed_at = None
        task.updated_at = requested_at
        task.context["previous_status"] = (
            previous_status.value
            if isinstance(previous_status, TaskStatus)
            else str(previous_status or "")
        )
        task.context["previous_summary"] = previous_summary
        task.context["last_progress"] = previous_progress
        task.context["resume_requested"] = False
        task.context["resume_reason"] = ""
        task.context["scheduler_last_error"] = ""
        task.context["scheduler_last_error_at"] = None
        delivery_records = self._normalize_delivery_records(task)
        for target, record_value in delivery_records.items():
            record = dict(record_value)
            record.update({
                "status": "scheduled",
                "last_attempt_at": None,
                "last_delivered_at": None,
                "next_attempt_at": None,
                "last_error": "",
                "last_message": "",
                "last_attempt_id": "",
                "last_method": "",
                "retryable": False,
                "attempts": 0,
            })
            delivery_records[target] = record
        task.context["delivery_records"] = delivery_records
        task.context["delivery_last_error"] = ""
        task.context["delivery_last_error_at"] = None
        self._touch_task_activity(
            task,
            status=TaskStatus.PENDING,
            progress=task.progress,
            now=requested_at,
        )
        self._append_trace_event(
            task,
            event_type="schedule",
            title="Recurring task prepared for next run",
            message="\n".join(
                line
                for line in [
                    (
                        f"Previous run: {previous_status.value}"
                        if isinstance(previous_status, TaskStatus)
                        else ""
                    ),
                    f"Trigger source: {trigger_source}",
                    previous_summary,
                ]
                if line
            ) or "Recurring task reset for a new scheduled run.",
            previous_status=(
                previous_status.value
                if isinstance(previous_status, TaskStatus)
                else str(previous_status or "")
            ),
            previous_progress=previous_progress,
        )

    def _ensure_task_context(self, task: SubTask) -> None:
        """确保任务上下文包含轨迹所需字段。"""
        if not isinstance(task.context, dict):
            task.context = {}
        normalized_status = self._normalize_status(task.status)
        active_default_status = (
            normalized_status.value
            if normalized_status in (TaskStatus.PENDING, TaskStatus.RUNNING)
            else None
        )

        history = task.context.get("history")
        if not isinstance(history, list):
            task.context["history"] = []

        execution_trace = task.context.get("execution_trace")
        if not isinstance(execution_trace, list):
            task.context["execution_trace"] = []

        resume_history = task.context.get("resume_history")
        if not isinstance(resume_history, list):
            task.context["resume_history"] = []

        try:
            offset = int(task.context.get("history_trace_offset", 0) or 0)
        except (TypeError, ValueError):
            offset = 0

        task.context["history_trace_offset"] = max(0, min(offset, len(task.context["history"])))
        task.context["cancel_requested"] = bool(task.context.get("cancel_requested"))
        task.context["cancel_requested_at"] = task.context.get("cancel_requested_at")
        task.context["cancel_reason"] = task.context.get("cancel_reason")
        task.context["terminal_reason"] = task.context.get("terminal_reason")
        task.context["final_state"] = task.context.get("final_state")
        task.context["final_state_at"] = task.context.get("final_state_at")
        task.context["final_state_source"] = task.context.get("final_state_source")
        task.context["post_cancel_error"] = task.context.get("post_cancel_error")

        try:
            ignored_count = int(task.context.get("ignored_terminal_update_count", 0) or 0)
        except (TypeError, ValueError):
            ignored_count = 0

        task.context["ignored_terminal_update_count"] = max(0, ignored_count)
        if not isinstance(task.context.get("last_ignored_terminal_update"), dict):
            task.context["last_ignored_terminal_update"] = {}
        task.context["runtime_session_id"] = str(task.context.get("runtime_session_id") or "").strip()
        task.context["last_runtime_session_id"] = str(
            task.context.get("last_runtime_session_id")
            or task.context.get("runtime_session_id")
            or ""
        ).strip()
        task.context["last_heartbeat_at"] = (
            task.context.get("last_heartbeat_at")
            or task.updated_at
            or task.started_at
            or task.created_at
        )
        task.context["executor_owner_role"] = str(
            task.context.get("executor_owner_role") or ""
        ).strip().lower()
        task.context["executor_session_id"] = str(
            task.context.get("executor_session_id") or ""
        ).strip()
        task.context["last_executor_session_id"] = str(
            task.context.get("last_executor_session_id")
            or task.context.get("executor_session_id")
            or ""
        ).strip()
        task.context["executor_session_started_at"] = task.context.get(
            "executor_session_started_at"
        )
        task.context["executor_last_heartbeat_at"] = task.context.get(
            "executor_last_heartbeat_at"
        )
        task.context["interrupted_recovery_required"] = bool(
            task.context.get("interrupted_recovery_required")
        )
        task.context["interrupted_at"] = task.context.get("interrupted_at")
        task.context["interrupted_reason"] = task.context.get("interrupted_reason")
        task.context["interrupted_origin"] = task.context.get("interrupted_origin")
        try:
            interrupt_count = int(task.context.get("interrupt_count", 0) or 0)
        except (TypeError, ValueError):
            interrupt_count = 0
        task.context["interrupt_count"] = max(0, interrupt_count)
        default_last_active_at = None
        if active_default_status:
            default_last_active_at = task.updated_at or task.started_at or task.created_at
        task.context["last_active_status"] = (
            task.context.get("last_active_status")
            or active_default_status
        )
        task.context["last_active_at"] = (
            task.context.get("last_active_at")
            or default_last_active_at
        )
        last_active_progress = task.context.get("last_active_progress")
        if last_active_progress is None and active_default_status:
            last_active_progress = task.progress
        try:
            last_active_progress = int(last_active_progress) if last_active_progress is not None else None
        except (TypeError, ValueError):
            last_active_progress = None
        task.context["last_active_progress"] = (
            max(0, min(100, last_active_progress))
            if last_active_progress is not None
            else None
        )
        task.context = normalize_task_plan_context(
            task.context,
            default_delivery_targets=[DELIVERY_TARGET_TASK_CENTER],
        )
        try:
            scheduled_run_count = int(task.context.get("scheduled_run_count", 0) or 0)
        except (TypeError, ValueError):
            scheduled_run_count = 0
        task.context["scheduled_run_count"] = max(0, scheduled_run_count)
        task.context["scheduler_last_matched_at"] = normalize_iso_datetime(
            task.context.get("scheduler_last_matched_at")
        )
        task.context["scheduler_last_triggered_at"] = normalize_iso_datetime(
            task.context.get("scheduler_last_triggered_at")
        )
        task.context["scheduler_last_error"] = self._build_preview(
            task.context.get("scheduler_last_error"),
            260,
        )
        task.context["scheduler_last_error_at"] = normalize_iso_datetime(
            task.context.get("scheduler_last_error_at")
        )
        task.context["delivery_last_error"] = self._build_preview(
            task.context.get("delivery_last_error"),
            260,
        )
        task.context["delivery_last_error_at"] = normalize_iso_datetime(
            task.context.get("delivery_last_error_at")
        )
        self._normalize_delivery_records(task)

    def _sync_task_plan_runtime(self, task: SubTask, now: Optional[str] = None) -> None:
        self._ensure_task_context(task)
        current_time = now or task.updated_at or datetime.now().isoformat()
        schedule_type = str(task.context.get("schedule_type") or SCHEDULE_TYPE_MANUAL)
        delivery_targets = list(task.context.get("delivery_targets") or [DELIVERY_TARGET_TASK_CENTER])
        status = self._normalize_status(task.status)
        is_terminal = status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED)

        if status == TaskStatus.RUNNING:
            task.context["last_run_at"] = task.context.get("last_run_at") or task.started_at or current_time
        elif is_terminal:
            task.context["last_run_at"] = task.context.get("last_run_at") or task.completed_at or current_time
            if schedule_type == SCHEDULE_TYPE_ONCE:
                task.context["next_run_at"] = None

        if delivery_targets == [DELIVERY_TARGET_NONE]:
            task.context["delivery_records"] = {}
            task.context["delivery_status"] = "disabled"
            task.context["delivery_status_label"] = get_delivery_status_label("disabled")
            task.context["last_delivery_at"] = None
            task.context["delivery_last_error"] = ""
            task.context["delivery_last_error_at"] = None
            return

        delivery_records = self._normalize_delivery_records(task)
        target_statuses: List[str] = []
        delivered_times: List[str] = []
        last_delivery_error = ""
        last_delivery_error_at = None

        for target in delivery_targets:
            if target == DELIVERY_TARGET_NONE:
                continue

            record = dict(delivery_records.get(target) or {})
            record_status = str(record.get("status") or "").strip().lower()

            if target == DELIVERY_TARGET_TASK_CENTER:
                if is_terminal:
                    record_status = "delivered"
                    record["last_delivered_at"] = (
                        record.get("last_delivered_at")
                        or task.completed_at
                        or current_time
                    )
                elif status == TaskStatus.RUNNING:
                    record_status = "in_progress"
                elif task.context.get("activation_requested_at"):
                    record_status = "queued"
                elif task.context.get("is_planned_task"):
                    record_status = "scheduled"
                else:
                    record_status = "configured"
                record["last_error"] = ""
            else:
                if is_terminal and record_status not in {
                    "delivered", "failed", "disabled", "retry_scheduled",
                }:
                    record_status = "queued"
                elif (
                    task.context.get("is_planned_task")
                    and record_status not in {
                        "delivered", "failed", "disabled", "queued", "retry_scheduled",
                    }
                ):
                    record_status = "scheduled"
                elif (
                    not task.context.get("is_planned_task")
                    and record_status not in {
                        "delivered", "failed", "disabled", "queued", "retry_scheduled",
                    }
                ):
                    record_status = "configured"

            record["target"] = target
            record["label"] = str(record.get("label") or get_delivery_target_label(target)).strip()
            record["status"] = record_status
            delivery_records[target] = record
            target_statuses.append(record_status)

            delivered_at = normalize_iso_datetime(record.get("last_delivered_at"))
            if delivered_at:
                delivered_times.append(delivered_at)

            if record_status == "failed":
                error_text = self._build_preview(record.get("last_error"), 260)
                attempted_at = normalize_iso_datetime(record.get("last_attempt_at"))
                if error_text and (
                    last_delivery_error_at is None
                    or (attempted_at and attempted_at >= last_delivery_error_at)
                ):
                    last_delivery_error = error_text
                    last_delivery_error_at = attempted_at

        if any(item == "retry_scheduled" for item in target_statuses):
            delivery_status = "retry_scheduled"
        elif any(item == "queued" for item in target_statuses):
            delivery_status = "queued"
        elif any(item == "in_progress" for item in target_statuses):
            delivery_status = "in_progress"
        elif any(item == "failed" for item in target_statuses):
            delivery_status = "failed"
        elif target_statuses and all(item == "delivered" for item in target_statuses):
            delivery_status = "delivered"
        elif any(item == "scheduled" for item in target_statuses):
            delivery_status = "scheduled"
        else:
            delivery_status = "configured"

        task.context["delivery_records"] = delivery_records
        task.context["delivery_status"] = delivery_status
        task.context["delivery_status_label"] = get_delivery_status_label(delivery_status)
        task.context["last_delivery_at"] = max(delivered_times) if delivered_times else None
        task.context["delivery_last_error"] = last_delivery_error
        task.context["delivery_last_error_at"] = last_delivery_error_at

    def _build_preview(self, text: Optional[str], limit: int = 180) -> str:
        if not text:
            return ""
        compact = " ".join(str(text).split())
        if len(compact) <= limit:
            return compact
        return compact[: limit - 1] + "…"

    def _recent_trace_excerpt(self, task: SubTask, limit: int = 5) -> List[str]:
        self._ensure_task_context(task)
        self._sync_history_trace(task)
        self._sync_task_plan_runtime(task)
        trace = list(task.context.get("execution_trace") or [])
        excerpt = trace[-limit:]
        lines = []
        for item in excerpt:
            title = str(item.get("title") or "执行日志").strip()
            message = self._build_preview(item.get("message"), 180)
            progress = item.get("progress")
            suffix = f" ({progress}%)" if progress is not None else ""
            lines.append(f"{title}{suffix}: {message or '-'}")
        return lines

    def _contains_any(self, text: str, keywords: List[str]) -> bool:
        haystack = str(text or "").lower()
        return any(keyword in haystack for keyword in keywords if keyword)

    def _normalize_status(self, status: Optional[Any]) -> Optional[TaskStatus]:
        if status is None:
            return None
        if isinstance(status, TaskStatus):
            return status
        try:
            return TaskStatus(str(status))
        except ValueError:
            return None

    def _capture_terminal_state(self, task: SubTask) -> None:
        self._ensure_task_context(task)
        status = self._normalize_status(task.status)
        if status not in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            return

        completed_at = task.completed_at or datetime.now().isoformat()
        task.context["final_state"] = status.value
        task.context["final_state_at"] = task.context.get("final_state_at") or completed_at
        task.context["final_state_source"] = (
            task.context.get("final_state_source")
            or "task_center.update_task_progress"
        )

        if status == TaskStatus.CANCELLED:
            cancel_reason = (
                task.context.get("cancel_reason")
                or task.context.get("resume_reason")
                or "Task was cancelled before completion."
            )
            task.context["cancel_requested"] = True
            task.context["cancel_requested_at"] = (
                task.context.get("cancel_requested_at")
                or task.context["final_state_at"]
            )
            task.context["cancel_reason"] = cancel_reason
            task.context["terminal_reason"] = (
                task.context.get("terminal_reason")
                or "cancelled_by_user"
            )
        elif status == TaskStatus.COMPLETED:
            task.context["terminal_reason"] = task.context.get("terminal_reason") or "completed"
        elif status == TaskStatus.FAILED:
            task.context["terminal_reason"] = task.context.get("terminal_reason") or "failed"

    def _reset_terminal_state(self, task: SubTask) -> None:
        self._ensure_task_context(task)
        task.context.update(
            {
                "cancel_requested": False,
                "cancel_requested_at": None,
                "cancel_reason": None,
                "terminal_reason": None,
                "final_state": None,
                "final_state_at": None,
                "final_state_source": None,
                "post_cancel_error": None,
                "ignored_terminal_update_count": 0,
                "last_ignored_terminal_update": {},
            }
        )

    def _reset_interruption_state(self, task: SubTask) -> None:
        self._ensure_task_context(task)
        task.context.update(
            {
                "interrupted_recovery_required": False,
                "interrupted_at": None,
                "interrupted_reason": None,
                "interrupted_origin": None,
            }
        )

    def _reset_executor_session(self, task: SubTask) -> None:
        """Release prior executor ownership before a new activation or resume."""

        self._ensure_task_context(task)
        previous_session_id = str(task.context.get("executor_session_id") or "").strip()
        if previous_session_id:
            task.context["last_executor_session_id"] = previous_session_id
        task.context.update({
            "executor_owner_role": "",
            "executor_session_id": "",
            "executor_session_started_at": None,
            "executor_last_heartbeat_at": None,
        })

    def _touch_task_activity(
        self,
        task: SubTask,
        status: Optional[Any] = None,
        progress: Optional[int] = None,
        *,
        now: Optional[str] = None,
    ) -> None:
        self._ensure_task_context(task)
        active_status = self._normalize_status(status) or self._normalize_status(task.status)
        timestamp = now or datetime.now().isoformat()
        task.context["runtime_session_id"] = self._runtime_session_id
        task.context["last_runtime_session_id"] = self._runtime_session_id
        task.context["last_heartbeat_at"] = timestamp
        if (
            str(task.context.get("executor_owner_role") or "").strip().lower()
            == self._runtime_role
            and str(task.context.get("executor_session_id") or "").strip()
        ):
            task.context["executor_last_heartbeat_at"] = timestamp

        if active_status in (TaskStatus.PENDING, TaskStatus.RUNNING):
            safe_progress = progress if progress is not None else task.progress
            try:
                safe_progress = int(safe_progress)
            except (TypeError, ValueError):
                safe_progress = task.progress
            task.context["last_active_status"] = active_status.value
            task.context["last_active_at"] = timestamp
            task.context["last_active_progress"] = max(0, min(100, safe_progress))

    def _should_ignore_terminal_update(
        self,
        task: SubTask,
        incoming_status: Optional[TaskStatus],
        *,
        result: Optional[str] = None,
        error: Optional[str] = None,
    ) -> bool:
        current_status = self._normalize_status(task.status)
        incoming_status = self._normalize_status(incoming_status)

        if current_status == TaskStatus.CANCELLED:
            if incoming_status not in (None, TaskStatus.CANCELLED):
                return True
            return error is not None or result is not None

        if current_status == TaskStatus.COMPLETED:
            if incoming_status not in (None, TaskStatus.COMPLETED):
                return True
            return error is not None

        return False

    def _record_ignored_terminal_update(
        self,
        task: SubTask,
        incoming_status: Optional[TaskStatus],
        progress: int,
        *,
        result: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        self._ensure_task_context(task)
        current_status = self._normalize_status(task.status)
        ignored_status = self._normalize_status(incoming_status)
        current_status_value = (
            current_status.value
            if isinstance(current_status, TaskStatus)
            else str(task.status)
        )
        ignored_status_value = (
            ignored_status.value
            if isinstance(ignored_status, TaskStatus)
            else (str(incoming_status) if incoming_status else None)
        )

        task.context["ignored_terminal_update_count"] = (
            int(task.context.get("ignored_terminal_update_count", 0) or 0) + 1
        )
        ignored_count = int(task.context.get("ignored_terminal_update_count", 0) or 0)
        ignored_at = datetime.now().isoformat()
        error_preview = self._build_preview(error, 240) if error else None
        result_preview = self._build_preview(result, 240) if result else None
        terminal_reason = self._build_preview(task.context.get("terminal_reason"), 120)
        task.context["last_ignored_terminal_update"] = {
            "attempted_status": ignored_status_value,
            "current_status": current_status_value,
            "progress": progress,
            "error": error_preview,
            "result_preview": result_preview,
            "ignored_at": ignored_at,
            "ignored_count": ignored_count,
            "terminal_reason": terminal_reason or None,
        }

        if current_status == TaskStatus.CANCELLED and error:
            task.context["post_cancel_error"] = error_preview

        should_trace = bool(
            error
            or result
            or (
                ignored_status_value
                and ignored_status_value != current_status_value
            )
        )
        if not should_trace:
            return

        details: List[str] = []
        if ignored_status_value:
            details.append(f"Attempted status: {ignored_status_value}")
        if error:
            details.append(f"Ignored error: {self._build_preview(error, 220)}")
        if result:
            details.append("Ignored late result update after terminal state was reached.")

        self._append_trace_event(
            task,
            event_type="guard",
            title="Ignored stale task update",
            message=" | ".join(details) or "Ignored stale task update.",
            attempted_status=ignored_status_value,
        )
        trace_excerpt = self._recent_trace_excerpt(task, limit=5)
        summary = (
            f"Ignored stale {ignored_status_value or 'late'} update after task already {current_status_value}."
        )
        memory_details: List[str] = [
            f"Current status: {current_status_value}",
            f"Ignored update count: {ignored_count}",
            f"Progress at ignore: {progress}%",
        ]
        if ignored_status_value:
            memory_details.append(f"Attempted status: {ignored_status_value}")
        if terminal_reason:
            memory_details.append(f"Terminal reason: {terminal_reason}")
        if error_preview:
            memory_details.append(f"Ignored error: {error_preview}")
        if result_preview:
            memory_details.append(f"Ignored result: {result_preview}")
        if task.context.get("post_cancel_error"):
            memory_details.append(
                f"Post-cancel error: {self._build_preview(task.context.get('post_cancel_error'), 240)}"
            )
        if trace_excerpt:
            memory_details.append(f"Trace: {' | '.join(trace_excerpt)}")

        try:
            self.memory_provider.record_task_event(
                task_id=task.task_id,
                task_title=task.title,
                status=current_status_value,
                event_type="ignored_stale_update",
                summary=summary,
                details="\n".join(memory_details),
                metadata={
                    "source": "task_center",
                    "attempted_status": ignored_status_value,
                    "current_status": current_status_value,
                    "ignored_count": ignored_count,
                    "ignored_at": ignored_at,
                    "terminal_reason": terminal_reason,
                    "post_cancel_error": self._build_preview(
                        task.context.get("post_cancel_error"),
                        240,
                    ),
                    "last_error": error_preview,
                    "result_preview": result_preview,
                    "trace_excerpt": trace_excerpt,
                },
            )
        except Exception:
            return

    def _build_failure_analysis(self, task: SubTask, resume_note: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_task_context(task)
        self._sync_history_trace(task)

        trace = list(task.context.get("execution_trace") or [])
        last_trace = trace[-1] if trace else {}
        raw_error = str(task.error or task.context.get("last_error") or "").strip()
        last_event_message = str(last_trace.get("message") or last_trace.get("title") or "").strip()
        resume_reason = str(task.context.get("resume_reason") or "").strip()
        note_text = str(resume_note or task.context.get("resume_note") or "").strip()
        interrupted_reason = str(task.context.get("interrupted_reason") or "").strip()
        interrupted_origin = str(task.context.get("interrupted_origin") or "").strip()

        signal_parts = [raw_error, last_event_message, resume_reason, note_text, interrupted_reason, interrupted_origin]
        normalized_signal = " \n".join(part for part in signal_parts if part).lower()

        category = "unknown"
        label = "Unknown Failure"
        severity = "danger"
        retry_recommended = True
        summary = self._build_preview(raw_error or last_event_message or resume_reason, 220)
        suggestions: List[str] = [
            "Check the latest trace and last error to locate the failing step.",
            "Verify model configuration, network access, and tool availability before retrying.",
            "Add a clearer resume note if the task needs a narrower next step.",
        ]

        if task.status == TaskStatus.CANCELLED or self._contains_any(normalized_signal, ["cancelled", "canceled", "user cancelled"]):
            category = "cancelled"
            label = "Cancelled"
            severity = "warning"
            retry_recommended = False
            summary = self._build_preview(
                task.context.get("cancel_reason")
                or task.context.get("resume_reason")
                or "Task was cancelled before completion.",
                220,
            )
            suggestions = [
                "Confirm whether the task still needs to continue.",
                "Use Resume Task when you are ready to continue from the saved context.",
            ]
        elif bool(task.context.get("interrupted_recovery_required")) or self._contains_any(
            normalized_signal,
            [
                "interrupted",
                "restart",
                "restarted",
                "startup recovery",
                "cold-start",
                "cold start",
                "unexpected shutdown",
                "service restarted",
                "process exited",
                "crash recovery",
            ],
        ):
            category = "interrupted"
            label = "Interrupted / Restart Recovery"
            severity = "warning"
            retry_recommended = True
            summary = (
                self._build_preview(interrupted_reason, 220)
                or self._build_preview(resume_reason or last_event_message, 220)
                or "Task was interrupted because OpenXnet restarted before it finished."
            )
            suggestions = [
                "Review the saved last-active snapshot to confirm the next unfinished step.",
                "Resume from the recovery checkpoint instead of recreating the task from scratch.",
                "If the task touched external systems, verify whether any side effects already happened before continuing.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["401", "403", "unauthorized", "forbidden", "authentication", "invalid api key", "invalid_api_key", "api key"],
        ):
            category = "authentication"
            label = "Authentication"
            retry_recommended = False
            summary = summary or "Authentication or API credential validation failed."
            suggestions = [
                "Check whether the selected provider API key is valid and not expired.",
                "Verify that base_url, vendor protocol, and model name match the provider requirements.",
                "Retry only after credentials and endpoint settings are corrected.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["429", "rate limit", "too many requests", "quota", "insufficient_quota"],
        ):
            category = "rate_limit"
            label = "Rate Limit"
            severity = "warning"
            retry_recommended = True
            summary = summary or "The upstream service rejected the request because of quota or rate limits."
            suggestions = [
                "Wait and retry later, or switch to a provider with available quota.",
                "Reduce concurrency or shrink the task scope to lower request cost.",
                "Confirm whether the shared key or account has already hit its quota cap.",
            ]
        elif self._contains_any(normalized_signal, ["max iterations reached", "iteration limit", "max iteration"]):
            category = "iteration_limit"
            label = "Iteration Limit"
            severity = "warning"
            retry_recommended = True
            summary = summary or "The task stopped because it reached the current iteration limit."
            suggestions = [
                "Split the task into smaller goals so each run can finish within fewer turns.",
                "Provide a more specific task description to reduce trial-and-error loops.",
                "Resume the task if the remaining work is small and the context is still valid.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["timeout", "timed out", "readtimeout", "connecttimeout", "deadline exceeded"],
        ):
            category = "timeout"
            label = "Timeout"
            severity = "warning"
            retry_recommended = True
            summary = summary or "The task timed out while waiting for the upstream service or tool response."
            suggestions = [
                "Check whether the model service or network connection is currently slow or unstable.",
                "Shorten the prompt or split the task to reduce single-run latency.",
                "Resume or retry after confirming the upstream service is healthy.",
            ]
        elif self._contains_any(
            normalized_signal,
            [
                "connection refused",
                "connection reset",
                "network",
                "dns",
                "ssl",
                "temporarily unavailable",
                "service unavailable",
                "bad gateway",
                "502",
                "503",
                "504",
            ],
        ):
            category = "network"
            label = "Network / Upstream"
            severity = "warning"
            retry_recommended = True
            summary = summary or "The task failed because the upstream service or network connection was unavailable."
            suggestions = [
                "Verify network connectivity, proxy settings, and base_url reachability.",
                "Check whether the upstream service is returning temporary 5xx errors.",
                "Retry after the network or upstream service becomes stable again.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["permission denied", "access is denied", "eacces", "operation not permitted"],
        ):
            category = "permission"
            label = "Permission"
            retry_recommended = False
            summary = summary or "The task failed because the current environment does not have enough permissions."
            suggestions = [
                "Check file, directory, or command permissions for the current workspace.",
                "Make sure the task can read and write the required paths.",
                "Retry only after permission issues are corrected.",
            ]
        elif self._contains_any(
            normalized_signal,
            [
                "no module named",
                "modulenotfounderror",
                "importerror",
                "command not found",
                "is not recognized as an internal or external command",
                "executable file not found",
            ],
        ):
            category = "environment"
            label = "Environment / Dependency"
            retry_recommended = False
            summary = summary or "The task failed because the local runtime or dependency setup is incomplete."
            suggestions = [
                "Install the missing package, runtime, or CLI dependency required by the task.",
                "Confirm that needed commands are available from the current environment and PATH.",
                "Retry only after the environment is fixed.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["out of memory", "no space left", "context length", "token limit", "max token", "insufficient memory"],
        ):
            category = "resource_limit"
            label = "Resource Limit"
            severity = "warning"
            retry_recommended = True
            summary = summary or "The task exceeded the current memory, token, or storage limits."
            suggestions = [
                "Reduce input size or split the task into smaller steps.",
                "Check token window, memory, or disk space limits for the current environment.",
                "Switch to a larger-context or higher-capacity configuration if needed.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["validation", "pydantic", "schema", "json decode", "parse error", "bad request", "400"],
        ):
            category = "input_validation"
            label = "Input / Schema"
            retry_recommended = False
            summary = summary or "The task input or tool payload did not match the expected request format."
            suggestions = [
                "Review task parameters, JSON structure, and tool argument formats.",
                "Check whether the current provider or route expects a different schema.",
                "Retry only after the invalid input is corrected.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["404", "api error 404", "model not found", "unknown model", "unsupported model", "endpoint", "route not found"],
        ):
            category = "endpoint_or_model"
            label = "Endpoint / Model"
            retry_recommended = False
            summary = summary or "The configured API route or model identifier could not be found."
            suggestions = [
                "Check whether base_url, route path, and model ID are correct.",
                "Confirm that the selected provider supports the current protocol and model name.",
                "Retry only after the endpoint or model configuration is fixed.",
            ]
        elif self._contains_any(
            normalized_signal,
            ["tool error", "mcp", "stderr", "exit code", "subprocess", "shell", "tool call", "tool_result"],
        ):
            category = "tool_execution"
            label = "Tool Execution"
            retry_recommended = True
            summary = summary or "A tool step failed while the task was running."
            suggestions = [
                "Inspect the latest tool trace and stderr output to find the exact failing step.",
                "Verify command arguments, working directory, and referenced file paths.",
                "Resume after the tool-side issue has been corrected.",
            ]

        return {
            "category": category,
            "label": label,
            "severity": severity,
            "summary": summary or "Task failed before a more specific reason could be identified.",
            "retry_recommended": retry_recommended,
            "recovery_suggestions": suggestions,
            "recovery_hint": suggestions[0] if suggestions else "",
            "raw_error": self._build_preview(raw_error, 240),
            "signal_preview": self._build_preview(" | ".join(part for part in signal_parts if part), 240),
        }

    def _build_recovery_actions(self, task: SubTask, failure_analysis: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        failure = dict(failure_analysis or {})
        category = str(failure.get("category") or "unknown").strip().lower()
        summary = self._build_preview(failure.get("summary"), 220)
        hint = self._build_preview(failure.get("recovery_hint"), 220)

        actions: List[Dict[str, Any]] = []

        def compose_resume_note(base_instruction: str) -> str:
            parts = [base_instruction.strip()]
            if summary:
                parts.append(f"Previous failure summary: {summary}")
            if hint and hint not in base_instruction:
                parts.append(f"Recovery hint: {hint}")
            return "\n".join(part for part in parts if part)

        def add_action(
            action_id: str,
            label: str,
            description: str,
            base_instruction: str,
            button_type: str = "primary",
            recommended: bool = False,
        ) -> None:
            actions.append(
                {
                    "action_id": action_id,
                    "label": label,
                    "description": description,
                    "button_type": button_type,
                    "recommended": recommended,
                    "resume_note": compose_resume_note(base_instruction),
                }
            )

        if category == "cancelled":
            add_action(
                "continue_from_last_step",
                "Continue From Last Step",
                "Resume from the saved context without repeating finished work.",
                "Continue the task from the saved context, first confirm which steps were already completed, and then execute only the remaining work.",
                recommended=True,
            )
            add_action(
                "review_remaining_work",
                "Review Remaining Work",
                "Rebuild the next-step checklist before continuing.",
                "Before continuing the task, review the saved trace, summarize the unfinished steps, and then continue with the highest-priority remaining step.",
                button_type="info",
            )
        elif category == "interrupted":
            add_action(
                "resume_after_restart",
                "Resume After Restart",
                "Continue from the saved checkpoint that was recovered during startup.",
                "Continue from the interrupted recovery checkpoint, first confirm the saved last-active step, and then execute only the remaining work that still needs to be done.",
                button_type="warning",
                recommended=True,
            )
            add_action(
                "verify_external_side_effects",
                "Verify Side Effects",
                "Double-check any external writes, commands, or network actions before continuing.",
                "Before continuing the interrupted task, verify whether the previous run already changed files, executed commands, or triggered external side effects. Then continue from the safest unfinished checkpoint.",
                button_type="info",
            )
        elif category in ("authentication", "endpoint_or_model", "input_validation"):
            add_action(
                "verify_configuration_first",
                "Verify Configuration First",
                "Check provider, endpoint, model, and request payload before resuming.",
                "Before continuing the task, inspect the current provider, endpoint, model identifier, and request payload that caused the previous failure. Correct the wrong setting if you can do so safely, then continue from the last unfinished step.",
                button_type="warning",
                recommended=True,
            )
            add_action(
                "summarize_configuration_blocker",
                "Summarize Config Blocker",
                "Produce a precise blocker summary if the misconfiguration cannot be fixed automatically.",
                "Investigate the configuration mismatch behind the previous failure. If you cannot safely correct it, stop and produce a concise blocker summary with the exact setting that must be changed.",
                button_type="info",
            )
        elif category in ("environment", "permission"):
            add_action(
                "check_environment_first",
                "Check Environment First",
                "Verify local dependencies, permissions, and required paths before resuming.",
                "Before continuing the task, verify the local environment, installed dependencies, required commands, permissions, and file paths. Fix the missing dependency or permission issue if possible, then continue the remaining work.",
                button_type="warning",
                recommended=True,
            )
            add_action(
                "summarize_environment_blocker",
                "Summarize Environment Blocker",
                "Stop after producing the exact dependency or permission blocker if it cannot be fixed automatically.",
                "Investigate the environment or permission issue that caused the failure. If it cannot be corrected safely, stop and summarize the exact missing dependency, permission, or path problem.",
                button_type="info",
            )
        elif category in ("network", "rate_limit", "timeout"):
            add_action(
                "retry_after_health_check",
                "Retry After Health Check",
                "Confirm upstream health, then continue from the saved checkpoint.",
                "Before continuing the task, verify network connectivity and upstream service health. If the upstream service is healthy again, continue from the last unfinished step without repeating completed work.",
                recommended=True,
            )
            add_action(
                "split_scope_then_continue",
                "Split Scope Then Continue",
                "Reduce pressure on the provider by breaking the remaining work into smaller steps.",
                "Break the remaining work into smaller steps to reduce timeout, quota, or network pressure, then continue with the next smallest unfinished step.",
                button_type="info",
            )
        elif category == "tool_execution":
            add_action(
                "inspect_tool_failure",
                "Inspect Tool Failure",
                "Check the failing tool step, command, or file path before resuming.",
                "Review the latest tool trace and stderr output, repair the failing command or file path if possible, and then continue the remaining work from the saved context.",
                button_type="warning",
                recommended=True,
            )
            add_action(
                "work_around_broken_step",
                "Work Around Broken Step",
                "Use a safe workaround when the failed tool step is optional.",
                "If the failed tool step is optional, find a safe workaround and continue the task. If it is not optional, stop and summarize the exact blocking tool failure.",
                button_type="info",
            )
        elif category in ("iteration_limit", "resource_limit"):
            add_action(
                "split_remaining_work",
                "Split Remaining Work",
                "Re-plan the unfinished work into smaller steps before resuming.",
                "Re-plan the remaining work into smaller steps that can finish within the current iteration, token, or resource limits, then continue with the highest-priority unfinished step.",
                recommended=True,
            )
            add_action(
                "checkpoint_then_continue",
                "Checkpoint Then Continue",
                "Summarize completed work first, then continue from a smaller checkpoint.",
                "Summarize what has already been completed, create a clear checkpoint for the remaining work, and then continue with the next smallest unfinished step.",
                button_type="info",
            )
        else:
            add_action(
                "review_then_continue",
                "Review Then Continue",
                "Review the latest trace and continue from the best next step.",
                "Review the latest failure trace, confirm the unfinished steps, and continue from the best next step without repeating work that is already done.",
                recommended=True,
            )
            add_action(
                "summarize_blocker",
                "Summarize Blocker",
                "Stop after producing a concise blocker summary when the failure is not automatically recoverable.",
                "Investigate the previous failure, and if the blocker cannot be fixed safely, stop and summarize the exact reason why the task still cannot continue.",
                button_type="info",
            )

        if actions and not any(action.get("recommended") for action in actions):
            actions[0]["recommended"] = True

        return actions

    def _infer_resume_reason(self, task: SubTask, resume_note: Optional[str] = None) -> str:
        explicit_note = self._build_preview(resume_note, 220)
        if explicit_note:
            return explicit_note

        interrupted_reason = self._build_preview(task.context.get("interrupted_reason"), 220)
        if interrupted_reason:
            return interrupted_reason

        if task.error:
            return self._build_preview(task.error, 220)

        if task.status == TaskStatus.CANCELLED:
            return "Task was cancelled before completion."

        trace = list(task.context.get("execution_trace") or [])
        if trace:
            last_message = trace[-1].get("message") or trace[-1].get("title")
            preview = self._build_preview(last_message, 220)
            if preview:
                return preview

        if task.context.get("summary"):
            return self._build_preview(task.context.get("summary"), 220)

        return "Task needs to continue from the last unfinished step."

    def _build_resume_context(self, task: SubTask, resume_note: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_task_context(task)
        self._sync_history_trace(task)
        previous_status = task.status.value if isinstance(task.status, TaskStatus) else str(task.status)
        previous_summary = task.context.get("summary") or self._build_preview(
            task.result or task.context.get("last_result"), 220
        )
        interrupted_recovery_required = bool(task.context.get("interrupted_recovery_required"))
        interrupted_at = task.context.get("interrupted_at")
        interrupted_reason = task.context.get("interrupted_reason")
        interrupted_origin = task.context.get("interrupted_origin")
        last_active_status = task.context.get("last_active_status")
        last_active_at = task.context.get("last_active_at")
        last_active_progress = task.context.get("last_active_progress")
        failure_analysis = dict(self._build_failure_analysis(task, resume_note))
        recovery_actions = self._build_recovery_actions(task, failure_analysis)
        failure_analysis["recovery_actions"] = recovery_actions
        return {
            "reason": self._infer_resume_reason(task, resume_note),
            "note": (resume_note or "").strip(),
            "previous_status": previous_status,
            "previous_progress": task.progress,
            "previous_summary": previous_summary,
            "last_error_preview": self._build_preview(task.error or task.context.get("last_error"), 240),
            "last_result_preview": self._build_preview(task.result or task.context.get("last_result"), 260),
            "last_event_preview": self._build_preview(
                (task.context.get("execution_trace") or [{}])[-1].get("message")
                if task.context.get("execution_trace")
                else "",
                200,
            ),
            "failure_analysis": failure_analysis,
            "failure_category": failure_analysis.get("category"),
            "failure_label": failure_analysis.get("label"),
            "failure_summary": failure_analysis.get("summary"),
            "failure_severity": failure_analysis.get("severity"),
            "retry_recommended": failure_analysis.get("retry_recommended"),
            "recovery_suggestions": failure_analysis.get("recovery_suggestions", []),
            "recovery_hint": failure_analysis.get("recovery_hint"),
            "recovery_actions": recovery_actions,
            "last_recovery_action": task.context.get("last_recovery_action") or {},
            "interrupted_recovery_required": interrupted_recovery_required,
            "interrupted_at": interrupted_at,
            "interrupted_reason": interrupted_reason,
            "interrupted_origin": interrupted_origin,
            "interrupt_count": int(task.context.get("interrupt_count", 0) or 0),
            "last_active_status": last_active_status,
            "last_active_at": last_active_at,
            "last_active_progress": last_active_progress,
            "recent_trace_excerpt": self._recent_trace_excerpt(task, limit=5),
            "captured_at": datetime.now().isoformat(),
        }

    def _append_trace_event(
        self,
        task: SubTask,
        event_type: str,
        title: str,
        message: Optional[str] = None,
        **extra: Any,
    ) -> None:
        self._ensure_task_context(task)

        trace = task.context["execution_trace"]
        status_value = task.status.value if isinstance(task.status, TaskStatus) else str(task.status)
        event = {
            "type": event_type,
            "title": title,
            "message": (message or "").strip(),
            "timestamp": datetime.now().isoformat(),
            "status": status_value,
            "progress": task.progress,
        }
        if extra:
            event.update(extra)

        if trace:
            last_event = trace[-1]
            comparable_keys = ("type", "title", "message", "status", "progress")
            if all(last_event.get(key) == event.get(key) for key in comparable_keys):
                return

        trace.append(event)
        if len(trace) > 200:
            task.context["execution_trace"] = trace[-200:]

    def _history_event_title(self, entry: str) -> str:
        entry = str(entry or "")
        if "✅" in entry:
            return "工具执行成功"
        if "❌" in entry:
            return "工具执行失败"
        if "🔄" in entry:
            return "任务恢复记录"
        return "执行日志"

    def _sync_history_trace(self, task: SubTask) -> None:
        self._ensure_task_context(task)
        history = task.context["history"]
        offset = task.context.get("history_trace_offset", 0)

        for entry in history[offset:]:
            self._append_trace_event(
                task,
                event_type="history",
                title=self._history_event_title(entry),
                message=str(entry),
                source="history",
            )

        task.context["history_trace_offset"] = len(history)

    def _record_task_memory_event(
        self,
        task: SubTask,
        event_type: str,
        *,
        previous_status: Optional[str] = None,
        previous_progress: Optional[int] = None,
    ) -> None:
        """Persist task lifecycle milestones into workspace session memory."""
        try:
            self._ensure_task_context(task)
            self._sync_history_trace(task)

            failure_analysis = dict(task.context.get("failure_analysis") or {})
            resume_context = dict(task.context.get("resume_context") or {})
            last_recovery_action = dict(task.context.get("last_recovery_action") or {})
            status_value = task.status.value if isinstance(task.status, TaskStatus) else str(task.status)
            error_preview = self._build_preview(task.error or task.context.get("last_error"), 240)
            result_preview = self._build_preview(task.result or task.context.get("last_result"), 240)
            resume_note = self._build_preview(
                task.context.get("resume_note")
                or resume_context.get("reason"),
                240,
            )
            interrupted_reason = self._build_preview(task.context.get("interrupted_reason"), 240)
            interrupted_origin = self._build_preview(task.context.get("interrupted_origin"), 120)
            interrupted_at = str(task.context.get("interrupted_at") or "").strip()
            last_active_status = str(task.context.get("last_active_status") or "").strip()
            last_active_at = str(task.context.get("last_active_at") or "").strip()
            try:
                last_active_progress = int(task.context.get("last_active_progress")) if task.context.get("last_active_progress") is not None else None
            except (TypeError, ValueError):
                last_active_progress = None
            interrupt_count = int(task.context.get("interrupt_count", 0) or 0)
            trace_excerpt = self._recent_trace_excerpt(task, limit=5)

            if event_type == "resume":
                summary = resume_note or "Task resumed from saved context."
            elif event_type == "interrupted":
                summary = interrupted_reason or "Task was recovered as interrupted after OpenXnet restarted."
            elif event_type == "completed":
                summary = (
                    self._build_preview(task.context.get("summary"), 260)
                    or result_preview
                    or "Task completed successfully."
                )
            elif event_type == "cancelled":
                summary = (
                    self._build_preview(task.context.get("resume_reason"), 260)
                    or "Task was cancelled before completion."
                )
            else:
                summary = (
                    self._build_preview(failure_analysis.get("summary"), 260)
                    or error_preview
                    or "Task execution failed."
                )

            details: List[str] = []
            if previous_status:
                details.append(f"Previous status: {previous_status}")
            if previous_progress is not None:
                details.append(f"Previous progress: {previous_progress}%")
            if task.description:
                details.append(f"Description: {self._build_preview(task.description, 260)}")
            if failure_analysis.get("label"):
                details.append(f"Failure label: {failure_analysis.get('label')}")
            if failure_analysis.get("category"):
                details.append(f"Failure category: {failure_analysis.get('category')}")
            if last_recovery_action.get("label"):
                details.append(f"Recovery action: {last_recovery_action.get('label')}")
            if resume_note and event_type != "resume":
                details.append(f"Resume note: {resume_note}")
            if interrupted_reason:
                details.append(f"Interrupted reason: {interrupted_reason}")
            if interrupted_origin:
                details.append(f"Interrupted origin: {interrupted_origin}")
            if interrupted_at:
                details.append(f"Interrupted at: {interrupted_at}")
            if last_active_status or last_active_at or last_active_progress is not None:
                snapshot_parts: List[str] = []
                if last_active_status:
                    snapshot_parts.append(f"status={last_active_status}")
                if last_active_progress is not None:
                    snapshot_parts.append(f"progress={last_active_progress}%")
                if last_active_at:
                    snapshot_parts.append(f"updated_at={last_active_at}")
                if snapshot_parts:
                    details.append(f"Last active snapshot: {', '.join(snapshot_parts)}")
            if interrupt_count:
                details.append(f"Interrupt count: {interrupt_count}")
            if error_preview:
                details.append(f"Last error: {error_preview}")
            if result_preview:
                details.append(f"Result preview: {result_preview}")
            if trace_excerpt:
                details.append(f"Trace: {' | '.join(trace_excerpt)}")

            self.memory_provider.record_task_event(
                task_id=task.task_id,
                task_title=task.title,
                status=status_value,
                event_type=event_type,
                summary=summary,
                details="\n".join(details),
                metadata={
                    "source": "task_center",
                    "resume_note": resume_note,
                    "recovery_action": last_recovery_action.get("label"),
                    "failure_category": failure_analysis.get("category"),
                    "failure_label": failure_analysis.get("label"),
                    "last_error": error_preview,
                    "result_preview": result_preview,
                    "trace_excerpt": trace_excerpt,
                    "interrupted_reason": interrupted_reason,
                    "interrupted_origin": interrupted_origin,
                    "interrupted_at": interrupted_at,
                    "interrupt_count": interrupt_count,
                    "last_active_status": last_active_status,
                    "last_active_at": last_active_at,
                    "last_active_progress": last_active_progress,
                },
            )
        except Exception:
            # Task memory is best-effort and must never break task execution.
            return

    def _duration_seconds(self, task: SubTask) -> Optional[int]:
        start_at = task.started_at or task.created_at
        end_at = task.completed_at or task.updated_at
        if not start_at or not end_at:
            return None

        try:
            start = datetime.fromisoformat(start_at)
            end = datetime.fromisoformat(end_at)
        except ValueError:
            return None

        delta_seconds = int((end - start).total_seconds())
        return max(delta_seconds, 0)

    def serialize_task(self, task: SubTask, child_task_count: int = 0) -> Dict[str, Any]:
        """序列化任务，并补充任务中心 UI 需要的摘要字段。"""
        self._ensure_task_context(task)
        self._sync_history_trace(task)

        payload = task.model_dump(mode="json")
        serialized_context = dict(payload.get("context") or {})
        serialized_delivery_records = serialized_context.get("delivery_records") or {}
        if isinstance(serialized_delivery_records, dict):
            serialized_context["delivery_records"] = {
                str(target): {
                    key: value
                    for key, value in record.items()
                    if key != "config"
                }
                for target, record in serialized_delivery_records.items()
                if isinstance(record, dict)
            }
        payload["context"] = serialized_context
        history = task.context.get("history", [])
        trace = task.context.get("execution_trace", [])
        payload["execution_trace"] = trace
        payload["history_count"] = len(history)
        payload["trace_count"] = len(trace)
        payload["resume_count"] = int(task.context.get("resume_count", 0) or 0)
        payload["last_error"] = task.error or task.context.get("last_error")
        payload["summary"] = task.context.get("summary") or self._build_preview(task.result or task.context.get("last_result"), 220)
        payload["last_event"] = self._build_preview(
            (trace[-1].get("message") or trace[-1].get("title")) if trace else (history[-1] if history else ""),
            140,
        )
        payload["cancel_requested"] = bool(task.context.get("cancel_requested"))
        payload["cancel_requested_at"] = task.context.get("cancel_requested_at")
        payload["cancel_reason"] = task.context.get("cancel_reason")
        payload["terminal_reason"] = task.context.get("terminal_reason")
        payload["final_state"] = task.context.get("final_state")
        payload["final_state_at"] = task.context.get("final_state_at")
        payload["final_state_source"] = task.context.get("final_state_source")
        payload["ignored_terminal_update_count"] = int(task.context.get("ignored_terminal_update_count", 0) or 0)
        payload["last_ignored_terminal_update"] = task.context.get("last_ignored_terminal_update") or {}
        payload["post_cancel_error"] = task.context.get("post_cancel_error")
        payload["last_heartbeat_at"] = task.context.get("last_heartbeat_at")
        payload["interrupted_recovery_required"] = bool(task.context.get("interrupted_recovery_required"))
        payload["interrupted_at"] = task.context.get("interrupted_at")
        payload["interrupted_reason"] = task.context.get("interrupted_reason")
        payload["interrupted_origin"] = task.context.get("interrupted_origin")
        payload["interrupt_count"] = int(task.context.get("interrupt_count", 0) or 0)
        payload["last_active_status"] = task.context.get("last_active_status")
        payload["last_active_at"] = task.context.get("last_active_at")
        payload["last_active_progress"] = task.context.get("last_active_progress")
        payload["is_resumable"] = task.status in (TaskStatus.FAILED, TaskStatus.CANCELLED)
        payload["duration_seconds"] = self._duration_seconds(task)
        payload["current_iteration"] = task.context.get("current_iteration")
        payload["previous_status"] = task.context.get("previous_status")
        payload["last_resume_at"] = task.context.get("last_resume_at")
        payload["resume_reason"] = task.context.get("resume_reason") or (
            task.context.get("resume_context", {}) or {}
        ).get("reason")
        payload["resume_note"] = task.context.get("resume_note")
        payload["resume_context"] = task.context.get("resume_context") or {}
        payload["resume_history"] = task.context.get("resume_history", [])
        payload["last_result_preview"] = self._build_preview(
            task.result or task.context.get("last_result"),
            240,
        )
        payload["recent_trace_excerpt"] = self._recent_trace_excerpt(task, limit=5)
        failure_analysis = task.context.get("failure_analysis") or payload["resume_context"].get("failure_analysis") or {}
        if not failure_analysis and (
            task.status in (TaskStatus.FAILED, TaskStatus.CANCELLED)
            or task.error
            or task.context.get("last_error")
            or task.context.get("interrupted_recovery_required")
        ):
            failure_analysis = self._build_failure_analysis(task, task.context.get("resume_note"))
        recovery_actions = (
            task.context.get("recovery_actions")
            or payload["resume_context"].get("recovery_actions")
            or failure_analysis.get("recovery_actions")
            or []
        )
        if not recovery_actions and failure_analysis:
            recovery_actions = self._build_recovery_actions(task, failure_analysis)
        if failure_analysis and recovery_actions and not failure_analysis.get("recovery_actions"):
            failure_analysis = dict(failure_analysis)
            failure_analysis["recovery_actions"] = recovery_actions
        if payload["resume_context"] and recovery_actions and not payload["resume_context"].get("recovery_actions"):
            payload["resume_context"] = {**payload["resume_context"], "recovery_actions": recovery_actions}
        payload["failure_analysis"] = failure_analysis
        payload["failure_category"] = failure_analysis.get("category")
        payload["failure_label"] = failure_analysis.get("label")
        payload["failure_summary"] = failure_analysis.get("summary")
        payload["failure_severity"] = failure_analysis.get("severity")
        payload["retry_recommended"] = failure_analysis.get("retry_recommended")
        payload["recovery_suggestions"] = failure_analysis.get("recovery_suggestions", [])
        payload["recovery_hint"] = failure_analysis.get("recovery_hint")
        payload["recovery_actions"] = recovery_actions
        payload["last_recovery_action"] = task.context.get("last_recovery_action") or {}
        payload["workflow_kind"] = str(task.context.get("workflow_kind") or "").strip()
        payload["created_from"] = str(task.context.get("created_from") or "").strip()
        payload["target_paths"] = list(task.context.get("target_paths") or [])
        payload["acceptance_criteria"] = list(task.context.get("acceptance_criteria") or [])
        payload["constraints"] = list(task.context.get("constraints") or [])
        payload["additional_context"] = str(task.context.get("additional_context") or "").strip()
        payload["workspace_dir"] = str(task.context.get("workspace_dir") or self.workspace_dir)
        payload["engine_name"] = str(task.context.get("engine_name") or "").strip()
        payload["permission_mode"] = str(task.context.get("permission_mode") or "").strip()
        payload["schedule_type"] = str(task.context.get("schedule_type") or SCHEDULE_TYPE_MANUAL).strip()
        payload["schedule_expression"] = str(task.context.get("schedule_expression") or "").strip()
        payload["schedule_summary"] = str(task.context.get("schedule_summary") or "").strip()
        payload["schedule_timezone"] = str(task.context.get("schedule_timezone") or "").strip()
        payload["next_run_at"] = task.context.get("next_run_at")
        payload["last_run_at"] = task.context.get("last_run_at")
        payload["delivery_targets"] = list(task.context.get("delivery_targets") or [])
        payload["delivery_target_labels"] = list(task.context.get("delivery_target_labels") or [])
        payload["delivery_status"] = str(task.context.get("delivery_status") or "").strip()
        payload["delivery_status_label"] = str(task.context.get("delivery_status_label") or "").strip()
        payload["last_delivery_at"] = task.context.get("last_delivery_at")
        payload["delivery_records"] = [
            {
                key: value
                for key, value in record.items()
                if key != "config"
            }
            for record in (task.context.get("delivery_records") or {}).values()
            if isinstance(record, dict)
        ]
        payload["delivery_last_error"] = str(task.context.get("delivery_last_error") or "").strip()
        payload["delivery_last_error_at"] = task.context.get("delivery_last_error_at")
        payload["is_planned_task"] = bool(task.context.get("is_planned_task"))
        payload["activation_requested_at"] = task.context.get("activation_requested_at")
        payload["activation_source"] = str(task.context.get("activation_source") or "").strip()
        payload["scheduled_run_count"] = int(task.context.get("scheduled_run_count", 0) or 0)
        payload["scheduler_last_matched_at"] = task.context.get("scheduler_last_matched_at")
        payload["scheduler_last_triggered_at"] = task.context.get("scheduler_last_triggered_at")
        payload["scheduler_last_error"] = str(task.context.get("scheduler_last_error") or "").strip()
        payload["scheduler_last_error_at"] = task.context.get("scheduler_last_error_at")
        payload["child_task_count"] = child_task_count
        return payload
    
    async def create_task(
        self,
        title: str,
        description: str,
        parent_task_id: Optional[str] = None,
        agent_type: str = "default",
        context: Optional[Dict[str, Any]] = None,
        task_id: Optional[str] = None,
    ) -> SubTask:
        """Create one task, preserving a validated Core ID for idempotent dispatch."""
        async with self._lock:
            normalized_task_id = str(task_id or "").strip()
            if normalized_task_id:
                if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", normalized_task_id):
                    raise ValueError("Task ID contains unsupported characters")
                existing_task = await self.get_task(normalized_task_id)
                if existing_task:
                    if existing_task.title == title and existing_task.description == description:
                        return existing_task
                    raise ValueError("Task ID already exists with different content")
            else:
                normalized_task_id = str(uuid.uuid4())[:8]
            now = datetime.now().isoformat()
            
            task = SubTask(
                task_id=normalized_task_id,
                parent_task_id=parent_task_id,
                title=title,
                description=description,
                created_at=now,
                updated_at=now,
                agent_type=agent_type,
                context=dict(context or {})
            )

            self._ensure_task_context(task)
            self._reset_interruption_state(task)
            self._touch_task_activity(
                task,
                status=TaskStatus.PENDING,
                progress=task.progress,
                now=now,
            )
            self._append_trace_event(
                task,
                event_type="created",
                title="任务已创建",
                message=f"{task.title}\n{self._build_preview(task.description, 240)}",
                parent_task_id=parent_task_id,
                agent_type=agent_type,
            )
            self._sync_task_plan_runtime(task, now=now)
            if task.context.get("is_planned_task"):
                self._append_trace_event(
                    task,
                    event_type="schedule",
                    title="Planned task registered",
                    message="\n".join(
                        item
                        for item in [
                            task.context.get("schedule_summary"),
                            (
                                f"Delivery targets: {', '.join(task.context.get('delivery_target_labels') or [])}"
                                if task.context.get("delivery_target_labels")
                                else ""
                            ),
                        ]
                        if item
                    ),
                )
            await self._save_task(task)
            return task
    
    async def _save_task(self, task: SubTask):
        """保存任务到文件"""
        task_file = self._get_task_file(task.task_id)
        async with aiofiles.open(task_file, 'w', encoding='utf-8') as f:
            await f.write(task.model_dump_json(indent=2))
        self._schedule_execution_checkpoint(task)

    def _schedule_execution_checkpoint(self, task: SubTask) -> None:
        """Publish a detached checkpoint without blocking the active executor write."""

        client = TaskExecutionEventClient.from_environment()
        if not client.configured:
            return
        try:
            checkpoint = build_task_execution_checkpoint(str(self.workspace_dir), task)
            asyncio.create_task(
                client.publish_checkpoint(checkpoint),
                name=f"openxnet-task-checkpoint-{task.task_id}",
            )
        except Exception:
            # Checkpoint delivery is best-effort until the compatibility watcher is retired.
            return
    
    async def get_task(self, task_id: str) -> Optional[SubTask]:
        """获取任务详情"""
        task_file = self._get_task_file(task_id)
        if not task_file.exists():
            return None
        
        try:
            async with aiofiles.open(task_file, 'r', encoding='utf-8') as f:
                data = await f.read()
                task = SubTask.model_validate_json(data)
                self._ensure_task_context(task)
                self._sync_history_trace(task)
                self._sync_task_plan_runtime(task)
                return task
        except Exception as e:
            print(f"Error loading task {task_id}: {e}", file=sys.stderr, flush=True)
            return None
    
    async def update_task_progress(
        self,
        task_id: str,
        progress: int,
        status: Optional[TaskStatus] = None,
        result: Optional[str] = None,
        error: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """更新任务进度和上下文"""
        async with self._lock:
            task = await self.get_task(task_id)
            if not task:
                return False

            self._ensure_task_context(task)
            previous_status = task.status
            previous_progress = task.progress
            previous_result = task.result
            previous_error = task.error
            safe_progress = max(0, min(100, progress))
            target_status = self._normalize_status(status) or task.status

            if self._should_ignore_terminal_update(
                task,
                target_status,
                result=result,
                error=error,
            ):
                self._record_ignored_terminal_update(
                    task,
                    target_status,
                    safe_progress,
                    result=result,
                    error=error,
                )
                await self._save_task(task)
                return True

            if target_status == TaskStatus.COMPLETED:
                final_progress = 100
            elif target_status == TaskStatus.FAILED:
                final_progress = max(task.progress, safe_progress)
            elif target_status == TaskStatus.CANCELLED:
                final_progress = task.progress
            else:
                final_progress = max(task.progress, safe_progress)
                final_progress = min(99, final_progress)

            task.progress = final_progress
            task.updated_at = datetime.now().isoformat()

            if context is not None:
                task.context.update(context)

            if status is not None:
                task.status = target_status
                if target_status == TaskStatus.RUNNING and not task.started_at:
                    task.started_at = datetime.now().isoformat()
                elif target_status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                    task.completed_at = datetime.now().isoformat()

            if result is not None:
                task.result = result
                task.context["last_result"] = result
                task.context["summary"] = self._build_preview(result, 220)

            if error is not None:
                task.error = error
                task.status = TaskStatus.FAILED
                task.completed_at = task.completed_at or datetime.now().isoformat()
                task.context["last_error"] = error
                task.context["resume_reason"] = self._build_preview(error, 220)

            self._ensure_task_context(task)
            if task.status in (TaskStatus.PENDING, TaskStatus.RUNNING):
                self._reset_interruption_state(task)
            self._touch_task_activity(
                task,
                status=task.status,
                progress=task.progress,
                now=task.updated_at,
            )
            self._sync_task_plan_runtime(task, now=task.updated_at)

            if task.status == TaskStatus.COMPLETED:
                task.context["summary"] = self._build_preview(
                    task.result or task.context.get("last_result"),
                    220,
                )
                task.context.pop("resume_requested", None)
            elif task.status == TaskStatus.CANCELLED:
                task.context["resume_reason"] = (
                    task.context.get("resume_reason")
                    or task.context.get("cancel_reason")
                    or "Task was cancelled before completion."
                )

            if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
                self._capture_terminal_state(task)

            if task.status in (TaskStatus.FAILED, TaskStatus.CANCELLED) or task.error or task.context.get("last_error"):
                failure_analysis = self._build_failure_analysis(task, task.context.get("resume_note"))
                task.context["failure_analysis"] = failure_analysis
                task.context["recovery_actions"] = self._build_recovery_actions(task, failure_analysis)
                task.context["resume_reason"] = task.context.get("resume_reason") or failure_analysis.get("summary")

            if task.status != previous_status:
                title_map = {
                    TaskStatus.PENDING: "任务进入队列",
                    TaskStatus.RUNNING: "任务开始执行",
                    TaskStatus.COMPLETED: "任务执行完成",
                    TaskStatus.FAILED: "任务执行失败",
                    TaskStatus.CANCELLED: "任务已取消",
                }
                self._append_trace_event(
                    task,
                    event_type="status",
                    title=title_map.get(self._normalize_status(task.status), "任务状态更新"),
                    message=f"状态：{task.status.value} | 进度：{task.progress}%",
                )

            previous_bucket = previous_progress // 25
            current_bucket = task.progress // 25
            if task.status == TaskStatus.RUNNING and current_bucket > previous_bucket:
                self._append_trace_event(
                    task,
                    event_type="progress",
                    title="任务进度更新",
                    message=f"当前进度 {task.progress}%",
                )

            if error is not None and error != previous_error:
                self._append_trace_event(
                    task,
                    event_type="error",
                    title="任务错误",
                    message=str(error),
                )

            if result is not None and result != previous_result:
                self._append_trace_event(
                    task,
                    event_type="result",
                    title="已生成最终结果",
                    message=self._build_preview(result, 400),
                )

            self._sync_history_trace(task)

            if task.status in (TaskStatus.FAILED, TaskStatus.CANCELLED):
                task.context["resume_context"] = self._build_resume_context(
                    task,
                    task.context.get("resume_note"),
                )
                task.context["recovery_actions"] = task.context["resume_context"].get("recovery_actions", [])

            if task.status != previous_status and task.status in (
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ):
                recorded_previous_status = (
                    previous_status.value
                    if isinstance(previous_status, TaskStatus)
                    else str(previous_status)
                )
                self._record_task_memory_event(
                    task,
                    task.status.value,
                    previous_status=recorded_previous_status,
                    previous_progress=previous_progress,
                )
            
            await self._save_task(task)
            return True

    async def list_tasks(
        self,
        parent_task_id: Optional[str] = None,
        status: Optional[TaskStatus] = None
    ) -> List[SubTask]:
        """列出任务"""
        tasks = []
        
        if not self.task_dir.exists():
            return tasks
        
        # 获取所有json文件
        files = list(self.task_dir.glob("*.json"))
        
        for task_file in files:
            try:
                async with aiofiles.open(task_file, 'r', encoding='utf-8') as f:
                    data = await f.read()
                    task = SubTask.model_validate_json(data)
                    self._ensure_task_context(task)
                    self._sync_history_trace(task)
                    self._sync_task_plan_runtime(task)
                    
                    if parent_task_id is not None and task.parent_task_id != parent_task_id:
                        continue
                    if status is not None and task.status != status:
                        continue
                    
                    tasks.append(task)
            except Exception as e:
                print(f"Error loading task file {task_file}: {e}", file=sys.stderr, flush=True)
                continue
        
        # 按更新时间倒序排序，便于恢复后的任务回到顶部
        tasks.sort(key=lambda x: x.updated_at or x.created_at, reverse=True)
        return tasks

    async def reconcile_interrupted_tasks_on_startup(self) -> int:
        """Recover only active executions owned by this process role."""

        if self._startup_reconciled:
            return 0

        async with self._lock:
            if self._startup_reconciled:
                return 0
            self._startup_reconciled = True

            recovered_count = 0
            if not self.task_dir.exists():
                return recovered_count

            for task_file in list(self.task_dir.glob("*.json")):
                try:
                    async with aiofiles.open(task_file, 'r', encoding='utf-8') as f:
                        data = await f.read()
                    task = SubTask.model_validate_json(data)
                except Exception as e:
                    print(f"Error loading task file {task_file}: {e}", file=sys.stderr, flush=True)
                    continue

                self._ensure_task_context(task)
                active_status = self._normalize_status(task.status)
                if active_status not in (TaskStatus.PENDING, TaskStatus.RUNNING):
                    continue
                executor_owner_role = str(
                    task.context.get("executor_owner_role") or ""
                ).strip().lower()
                if self._runtime_role == "desktop":
                    continue
                if self._runtime_role == "task-worker" and executor_owner_role != "task-worker":
                    continue
                if (
                    self._runtime_role in {"server", "backend"}
                    and executor_owner_role not in {"", "server", "backend"}
                ):
                    continue
                if (
                    active_status == TaskStatus.PENDING
                    and not task.started_at
                    and not task.context.get("activation_requested_at")
                ):
                    # Keep dormant planned/manual pending tasks intact after restart.
                    continue

                previous_status = active_status
                previous_progress = max(0, min(99, int(task.progress or 0)))
                interrupted_at = self._startup_at
                previous_runtime_session_id = str(
                    task.context.get("runtime_session_id")
                    or task.context.get("last_runtime_session_id")
                    or ""
                ).strip()
                task.context["last_active_status"] = (
                    task.context.get("last_active_status")
                    or previous_status.value
                )
                task.context["last_active_at"] = (
                    task.context.get("last_active_at")
                    or task.updated_at
                    or task.started_at
                    or task.created_at
                )
                if task.context.get("last_active_progress") is None:
                    task.context["last_active_progress"] = previous_progress

                interruption_parts = [
                    f"Task was left in {previous_status.value} state when OpenXnet restarted.",
                    "The saved context was converted into a resumable recovery checkpoint.",
                ]
                if previous_runtime_session_id:
                    interruption_parts.insert(
                        1,
                        f"Previous runtime session: {previous_runtime_session_id}.",
                    )
                interrupted_reason = " ".join(part for part in interruption_parts if part).strip()

                task.status = TaskStatus.FAILED
                task.completed_at = interrupted_at
                task.updated_at = interrupted_at
                task.context["resume_reason"] = interrupted_reason
                task.context["previous_status"] = previous_status.value
                task.context["last_progress"] = previous_progress
                task.context["terminal_reason"] = "interrupted_by_restart"
                task.context["final_state"] = TaskStatus.FAILED.value
                task.context["final_state_at"] = interrupted_at
                task.context["final_state_source"] = "task_center.reconcile_interrupted_tasks_on_startup"
                task.context["interrupted_recovery_required"] = True
                task.context["interrupted_at"] = interrupted_at
                task.context["interrupted_reason"] = interrupted_reason
                task.context["interrupted_origin"] = "startup_reconcile"
                task.context["last_executor_session_id"] = str(
                    task.context.get("executor_session_id")
                    or task.context.get("last_executor_session_id")
                    or ""
                ).strip()
                task.context["executor_owner_role"] = ""
                task.context["executor_session_id"] = ""
                task.context["executor_session_started_at"] = None
                task.context["executor_last_heartbeat_at"] = interrupted_at
                task.context["interrupt_count"] = int(task.context.get("interrupt_count", 0) or 0) + 1
                task.context["runtime_session_id"] = self._runtime_session_id
                task.context["last_heartbeat_at"] = interrupted_at

                self._append_trace_event(
                    task,
                    event_type="interrupted",
                    title="Task recovered after restart",
                    message="\n".join(
                        line
                        for line in [
                            interrupted_reason,
                            (
                                f"Last active snapshot: {task.context.get('last_active_status')} | "
                                f"{task.context.get('last_active_progress')}% | "
                                f"{task.context.get('last_active_at')}"
                            ),
                        ]
                        if line
                    ),
                    previous_status=previous_status.value,
                    previous_progress=previous_progress,
                )

                failure_analysis = self._build_failure_analysis(task)
                task.context["failure_analysis"] = failure_analysis
                recovery_actions = self._build_recovery_actions(task, failure_analysis)
                task.context["recovery_actions"] = recovery_actions
                task.context["resume_context"] = self._build_resume_context(task, interrupted_reason)
                task.context["recovery_actions"] = task.context["resume_context"].get(
                    "recovery_actions",
                    recovery_actions,
                )
                self._record_task_memory_event(
                    task,
                    "interrupted",
                    previous_status=previous_status.value,
                    previous_progress=previous_progress,
                )
                await self._save_task(task)
                recovered_count += 1

            return recovered_count

    async def mutate_task_context(
        self,
        task_id: str,
        context_updates: Optional[Dict[str, Any]] = None,
        *,
        trace_event: Optional[Dict[str, Any]] = None,
        touch_updated_at: bool = True,
    ) -> Optional[SubTask]:
        async with self._lock:
            task = await self.get_task(task_id)
            if not task:
                return None

            self._ensure_task_context(task)
            if context_updates:
                task.context.update(context_updates)
            if touch_updated_at:
                task.updated_at = datetime.now().isoformat()
            self._sync_task_plan_runtime(task, now=task.updated_at)
            if trace_event:
                self._append_trace_event(task, **trace_event)
            await self._save_task(task)
            return task

    async def update_delivery_status(
        self,
        task_id: str,
        target: str,
        status: str,
        *,
        message: Optional[str] = None,
        error: Optional[str] = None,
        attempted_at: Optional[str] = None,
        delivered_at: Optional[str] = None,
        next_attempt_at: Optional[str] = None,
        attempt_id: Optional[str] = None,
        method: Optional[str] = None,
        retryable: Optional[bool] = None,
        trace_event: Optional[Dict[str, Any]] = None,
    ) -> Optional[SubTask]:
        async with self._lock:
            task = await self.get_task(task_id)
            if not task:
                return None

            self._ensure_task_context(task)
            delivery_records = self._normalize_delivery_records(task)
            normalized_target = str(target or "").strip().lower()
            current_time = attempted_at or datetime.now().isoformat()
            record = dict(delivery_records.get(normalized_target) or {})
            normalized_attempt_id = self._build_preview(attempt_id, 128) if attempt_id else ""
            if normalized_attempt_id and record.get("last_attempt_id") == normalized_attempt_id:
                return task

            try:
                attempts = int(record.get("attempts", 0) or 0)
            except (TypeError, ValueError):
                attempts = 0

            record["target"] = normalized_target
            record["label"] = str(record.get("label") or get_delivery_target_label(normalized_target)).strip()
            record["status"] = str(status or "").strip().lower()
            record["last_attempt_at"] = normalize_iso_datetime(current_time)
            record["attempts"] = attempts + 1
            record["next_attempt_at"] = normalize_iso_datetime(next_attempt_at)
            if attempt_id is not None:
                record["last_attempt_id"] = normalized_attempt_id
            if method is not None:
                record["last_method"] = self._build_preview(method, 128)
            if retryable is not None:
                record["retryable"] = bool(retryable)
            if message is not None:
                record["last_message"] = self._build_preview(message, 260)
            if error:
                record["last_error"] = self._build_preview(error, 260)
                task.context["delivery_last_error"] = record["last_error"]
                task.context["delivery_last_error_at"] = record["last_attempt_at"]
            elif record["status"] == "delivered":
                record["last_error"] = ""
            if record["status"] == "delivered":
                record["last_delivered_at"] = normalize_iso_datetime(delivered_at or current_time)
                record["next_attempt_at"] = None
            elif record["status"] == "failed":
                record["next_attempt_at"] = None

            delivery_records[normalized_target] = record
            task.context["delivery_records"] = delivery_records
            task.updated_at = datetime.now().isoformat()
            self._sync_task_plan_runtime(task, now=task.updated_at)

            if trace_event:
                self._append_trace_event(task, **trace_event)

            await self._save_task(task)
            return task

    async def activate_task(
        self,
        task_id: str,
        trigger_source: str = "manual_run_now",
        *,
        scheduler_matched_at: Optional[str] = None,
        next_run_at: Optional[str] = None,
    ) -> Optional[SubTask]:
        async with self._lock:
            task = await self.get_task(task_id)
            if not task:
                return None

            self._ensure_task_context(task)
            requested_at = datetime.now().isoformat()
            current_status = self._normalize_status(task.status)
            schedule_type = str(task.context.get("schedule_type") or SCHEDULE_TYPE_MANUAL).strip()
            normalized_trigger_source = str(trigger_source or "manual_run_now").strip() or "manual_run_now"

            if current_status == TaskStatus.RUNNING:
                return None
            if current_status == TaskStatus.PENDING and self._was_recently_queued(task, requested_at):
                return None

            if current_status != TaskStatus.PENDING:
                if schedule_type != SCHEDULE_TYPE_RECURRING:
                    return None
                if current_status not in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
                    return None
                self._reset_task_for_scheduled_run_locked(
                    task,
                    requested_at=requested_at,
                    trigger_source=normalized_trigger_source,
                )

            if scheduler_matched_at:
                task.context["scheduler_last_matched_at"] = scheduler_matched_at
            if next_run_at is not None:
                task.context["next_run_at"] = next_run_at
            if normalized_trigger_source in {"scheduler_due", "worker_scheduler_due"}:
                task.context["scheduler_last_triggered_at"] = requested_at
                task.context["scheduler_last_error"] = ""
                task.context["scheduler_last_error_at"] = None
                task.context["scheduled_run_count"] = int(task.context.get("scheduled_run_count", 0) or 0) + 1

            self._queue_task_for_execution_locked(
                task,
                trigger_source=normalized_trigger_source,
                requested_at=requested_at,
            )
            await self._save_task(task)
            return task

    async def start_task(self, task_id: str, trigger_source: str = "manual_run_now") -> Optional[SubTask]:
        """Queue a pending task for execution without resetting prior state."""
        return await self.activate_task(task_id, trigger_source=trigger_source)

    async def claim_execution_session(
        self,
        task_id: str,
        session_id: str,
        *,
        owner_role: Optional[str] = None,
    ) -> Optional[SubTask]:
        """Atomically bind one active task to the process executing its model session."""

        normalized_session_id = str(session_id or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", normalized_session_id):
            raise ValueError("Execution session ID is invalid")
        normalized_owner_role = self._normalize_runtime_role(owner_role or self._runtime_role)
        async with self._lock:
            task = await self.get_task(task_id)
            if task is None:
                return None
            self._ensure_task_context(task)
            status = self._normalize_status(task.status)
            if status not in {TaskStatus.PENDING, TaskStatus.RUNNING}:
                return None
            existing_session_id = str(task.context.get("executor_session_id") or "").strip()
            existing_owner_role = str(task.context.get("executor_owner_role") or "").strip()
            if existing_session_id and (
                existing_session_id != normalized_session_id
                or existing_owner_role != normalized_owner_role
            ):
                return None
            now = datetime.now().isoformat()
            task.status = TaskStatus.RUNNING
            task.started_at = task.started_at or now
            task.completed_at = None
            task.updated_at = now
            task.context.update({
                "executor_owner_role": normalized_owner_role,
                "executor_session_id": normalized_session_id,
                "last_executor_session_id": normalized_session_id,
                "executor_session_started_at": (
                    task.context.get("executor_session_started_at") or now
                ),
                "executor_last_heartbeat_at": now,
            })
            self._reset_interruption_state(task)
            self._touch_task_activity(
                task,
                status=TaskStatus.RUNNING,
                progress=task.progress,
                now=now,
            )
            self._append_trace_event(
                task,
                event_type="execution-session",
                title="Supervised execution session started",
                message=f"Executor owner: {normalized_owner_role}",
                session_id=normalized_session_id,
            )
            await self._save_task(task)
            return task

    async def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        cancel_requested_at = datetime.now().isoformat()
        return await self.update_task_progress(
            task_id=task_id,
            progress=0,
            status=TaskStatus.CANCELLED,
            context={
                "cancel_requested": True,
                "cancel_requested_at": cancel_requested_at,
                "cancel_reason": "Task was cancelled by the user.",
                "resume_reason": "Task was cancelled by the user.",
                "terminal_reason": "cancelled_by_user",
                "final_state": TaskStatus.CANCELLED.value,
                "final_state_at": cancel_requested_at,
                "final_state_source": "task_center.cancel_task",
            },
        )

    async def resume_task(
        self,
        task_id: str,
        resume_note: Optional[str] = None,
        recovery_action: Optional[Dict[str, Any]] = None,
    ) -> Optional[SubTask]:
        """重置任务状态并重新加入执行队列。"""
        async with self._lock:
            task = await self.get_task(task_id)
            if not task:
                return None

            self._ensure_task_context(task)
            previous_status = task.status
            previous_progress = task.progress
            initial_failure_analysis = self._build_failure_analysis(task, resume_note)
            available_recovery_actions = self._build_recovery_actions(task, initial_failure_analysis)
            selected_recovery_action = dict(recovery_action or {})
            if not selected_recovery_action and available_recovery_actions:
                selected_recovery_action = next(
                    (action for action in available_recovery_actions if action.get("recommended")),
                    available_recovery_actions[0],
                )

            effective_resume_note = (
                str(resume_note or "").strip()
                or str(selected_recovery_action.get("resume_note") or "").strip()
                or self._infer_resume_reason(task)
            )
            resume_context = self._build_resume_context(task, effective_resume_note)
            failure_analysis = resume_context.get("failure_analysis") or initial_failure_analysis
            available_recovery_actions = (
                resume_context.get("recovery_actions")
                or available_recovery_actions
                or self._build_recovery_actions(task, failure_analysis)
            )
            if selected_recovery_action:
                selected_recovery_action = {
                    "action_id": str(selected_recovery_action.get("action_id") or "").strip(),
                    "label": str(selected_recovery_action.get("label") or "").strip(),
                    "description": str(selected_recovery_action.get("description") or "").strip(),
                    "button_type": str(selected_recovery_action.get("button_type") or "primary").strip(),
                    "recommended": bool(selected_recovery_action.get("recommended")),
                    "resume_note": str(selected_recovery_action.get("resume_note") or effective_resume_note).strip(),
                }
                resume_context["selected_recovery_action"] = selected_recovery_action
            resume_context["recovery_actions"] = available_recovery_actions
            history = list(task.context.get("history") or [])
            if effective_resume_note:
                history.append(f"🔄 [resume_task]\n{effective_resume_note}")

            resume_history = list(task.context.get("resume_history") or [])
            resume_history.insert(0, resume_context)
            resume_history = resume_history[:10]

            self._reset_terminal_state(task)
            self._reset_interruption_state(task)
            self._reset_executor_session(task)
            task.context.update({
                "history": history,
                "resume_requested": True,
                "resume_count": int(task.context.get("resume_count", 0)) + 1,
                "last_resume_at": datetime.now().isoformat(),
                "previous_status": previous_status.value if isinstance(previous_status, TaskStatus) else str(previous_status),
                "last_progress": task.progress,
                "resume_note": effective_resume_note,
                "resume_reason": resume_context.get("reason"),
                "resume_context": resume_context,
                "resume_history": resume_history,
                "previous_summary": resume_context.get("previous_summary"),
                "failure_analysis": failure_analysis,
                "recovery_actions": available_recovery_actions,
                "last_recovery_action": selected_recovery_action or {},
            })
            if task.error:
                task.context["last_error"] = task.error
            if task.result:
                task.context["last_result"] = task.result

            task.status = TaskStatus.PENDING
            task.progress = 0
            task.result = None
            task.error = None
            task.started_at = None
            task.completed_at = None
            task.updated_at = datetime.now().isoformat()
            self._touch_task_activity(
                task,
                status=TaskStatus.PENDING,
                progress=task.progress,
                now=task.updated_at,
            )

            self._sync_history_trace(task)
            self._append_trace_event(
                task,
                event_type="resume",
                title="任务已请求恢复执行",
                message="\n".join(
                    line
                    for line in [
                        (
                            f"Recovery action: {selected_recovery_action.get('label')}"
                            if selected_recovery_action.get("label")
                            else ""
                        ),
                        effective_resume_note,
                        (
                            resume_context.get("reason")
                            if resume_context.get("reason") != effective_resume_note
                            else ""
                        ),
                        resume_context.get("last_error_preview"),
                    ]
                    if line
                ) or "Task resumed from Task Center.",
                previous_status=previous_status.value if isinstance(previous_status, TaskStatus) else str(previous_status),
                previous_progress=previous_progress,
            )
            self._sync_task_plan_runtime(task, now=task.updated_at)
            self._record_task_memory_event(
                task,
                "resume",
                previous_status=(
                    previous_status.value
                    if isinstance(previous_status, TaskStatus)
                    else str(previous_status)
                ),
                previous_progress=previous_progress,
            )

            await self._save_task(task)
            return task

    async def delete_task(self, task_id: str) -> bool:
        """删除任务文件"""
        async with self._lock:
            task_file = self._get_task_file(task_id)
            if task_file.exists():
                try:
                    await aiofiles.os.remove(task_file)
                    return True
                except Exception as e:
                    print(f"Error deleting task {task_id}: {e}", file=sys.stderr, flush=True)
                    return False
            return False

    async def cleanup_old_tasks(self, days: int = 7):
        """清理旧任务（待实现）"""
        pass

# --- 全局任务中心实例管理 ---

# 全局任务中心实例字典 {workspace_path: TaskCenter}
_task_centers: Dict[str, TaskCenter] = {}

async def get_task_center(workspace_dir: str) -> TaskCenter:
    """获取或创建任务中心实例"""
    if workspace_dir not in _task_centers:
        _task_centers[workspace_dir] = TaskCenter(workspace_dir)
    await _task_centers[workspace_dir].reconcile_interrupted_tasks_on_startup()
    return _task_centers[workspace_dir]
