#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Background planned-task scheduler and delivery dispatcher.

This module adds a lightweight runtime loop on top of Task Center so the
existing planned-task metadata can trigger real executions and delivery
fallbacks without introducing an external scheduler dependency.

Author: maoyo
Department: R&D
Date: 2026-04-17
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-17, v1.0.0, maoyo: Initial creation.

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional

from py.overlay_router import overlay_manager
from py.get_setting import get_port
from py.sub_agent import run_subtask_in_background
from py.task_center import TaskStatus, get_task_center
from py.task_planning import (
    DELIVERY_TARGET_DESKTOP_NOTIFICATION,
    DELIVERY_TARGET_DYNAMIC_ISLAND,
    DELIVERY_TARGET_IM_BOT,
    DELIVERY_TARGET_TASK_CENTER,
    SCHEDULE_TYPE_ONCE,
    SCHEDULE_TYPE_RECURRING,
    get_delivery_target_label,
)
from py.task_schedule_policy import (
    compute_next_run_from_expression,
    parse_schedule_datetime,
)


class TaskSchedulerRuntime:
    def __init__(
        self,
        settings_loader: Callable[[], Awaitable[Dict[str, Any]]],
        launch_guard: Optional[Callable[[Dict[str, Any]], Awaitable[Optional[str]]]] = None,
        *,
        poll_interval_seconds: int = 15,
        enable_schedule_activation: bool = True,
        enable_terminal_delivery: bool = True,
    ):
        """Create the compatibility scheduler and optional activation loop."""

        self._settings_loader = settings_loader
        self._launch_guard = launch_guard
        self._poll_interval_seconds = max(5, int(poll_interval_seconds or 15))
        self._enable_schedule_activation = bool(enable_schedule_activation)
        self._enable_terminal_delivery = bool(enable_terminal_delivery)
        self._stop_event = asyncio.Event()
        self._tick_lock = asyncio.Lock()
        self._runner_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the compatibility loop only when it still owns one concern."""

        if not self._enable_schedule_activation and not self._enable_terminal_delivery:
            return
        if self._runner_task and not self._runner_task.done():
            return
        self._stop_event.clear()
        self._runner_task = asyncio.create_task(
            self._run_loop(),
            name="openxnet-task-scheduler",
        )

    async def stop(self) -> None:
        """Stop and join the compatibility scheduler loop idempotently."""

        self._stop_event.set()
        if not self._runner_task:
            return
        self._runner_task.cancel()
        try:
            await self._runner_task
        except asyncio.CancelledError:
            pass
        self._runner_task = None

    async def _run_loop(self) -> None:
        """Run compatibility ticks until shutdown is requested."""

        while not self._stop_event.is_set():
            try:
                await self._run_tick()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print(f"[TaskScheduler] Tick failed: {exc}")

            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=self._poll_interval_seconds,
                )
            except asyncio.TimeoutError:
                continue

    async def _run_tick(self) -> None:
        """Run one activation/delivery cycle for the configured workspace."""

        if not self._enable_schedule_activation and not self._enable_terminal_delivery:
            return
        async with self._tick_lock:
            settings = await self._settings_loader()
            workspace_dir = str(
                ((settings or {}).get("CLISettings") or {}).get("cc_path") or ""
            ).strip()
            if not workspace_dir:
                return

            workspace_path = Path(workspace_dir)
            if not workspace_path.exists() or not workspace_path.is_dir():
                return

            task_center = await get_task_center(str(workspace_path))
            now = datetime.now()

            tasks = await task_center.list_tasks()
            if self._enable_schedule_activation:
                await self._project_missing_recurring_runs(task_center, tasks, now)
                tasks = await task_center.list_tasks()
                due_candidates = self._collect_due_tasks(tasks, now)
                block_message = None
                if due_candidates and self._launch_guard:
                    block_message = await self._launch_guard(settings)

                for candidate in due_candidates:
                    task = candidate["task"]
                    matched_at = candidate["matched_at"]
                    if block_message:
                        await self._mark_scheduler_blocked(
                            task_center,
                            task,
                            block_message,
                            matched_at,
                        )
                        continue
                    activated_task = await task_center.activate_task(
                        task.task_id,
                        trigger_source="scheduler_due",
                        scheduler_matched_at=matched_at,
                        next_run_at=candidate["next_run_at"],
                    )
                    if not activated_task:
                        continue
                    consensus_content = await self._load_task_consensus(str(workspace_path))
                    asyncio.create_task(
                        run_subtask_in_background(
                            task_id=activated_task.task_id,
                            workspace_dir=str(workspace_path),
                            backend_origin=f"http://127.0.0.1:{get_port()}",
                            max_tokens=settings.get("max_tokens", 4000),
                            consensus_content=consensus_content,
                        ),
                        name=f"openxnet-server-task-executor-{activated_task.task_id}",
                    )
                tasks = await task_center.list_tasks()
            if self._enable_terminal_delivery:
                await self._dispatch_pending_deliveries(task_center, tasks)

    async def _project_missing_recurring_runs(
        self,
        task_center: Any,
        tasks: List[Any],
        now: datetime,
    ) -> None:
        for task in tasks:
            schedule_type = str((task.context or {}).get("schedule_type") or "").strip()
            if schedule_type != SCHEDULE_TYPE_RECURRING:
                continue
            if (task.context or {}).get("next_run_at"):
                continue

            schedule_expression = str((task.context or {}).get("schedule_expression") or "").strip()
            next_run_at = self._compute_next_run_from_expression(schedule_expression, now)
            if next_run_at:
                await task_center.mutate_task_context(
                    task.task_id,
                    {
                        "next_run_at": next_run_at.isoformat(),
                        "scheduler_last_error": "",
                        "scheduler_last_error_at": None,
                    },
                    touch_updated_at=False,
                )
                continue

            error_text = "Recurring task needs a supported schedule expression before it can auto-run."
            trace_event = None
            if str((task.context or {}).get("scheduler_last_error") or "").strip() != error_text:
                trace_event = {
                    "event_type": "schedule",
                    "title": "Recurring schedule needs attention",
                    "message": error_text,
                }
            await task_center.mutate_task_context(
                task.task_id,
                {
                    "scheduler_last_error": error_text,
                    "scheduler_last_error_at": now.isoformat(),
                },
                trace_event=trace_event,
                touch_updated_at=False,
            )

    def _collect_due_tasks(self, tasks: List[Any], now: datetime) -> List[Dict[str, Any]]:
        due_tasks: List[Dict[str, Any]] = []
        for task in tasks:
            task_context = getattr(task, "context", {}) or {}
            schedule_type = str(task_context.get("schedule_type") or "").strip()
            if schedule_type not in {SCHEDULE_TYPE_ONCE, SCHEDULE_TYPE_RECURRING}:
                continue

            next_run_at = self._parse_iso_datetime(task_context.get("next_run_at"))
            if not next_run_at or next_run_at > now:
                continue

            status = getattr(task, "status", None)
            if status == TaskStatus.RUNNING:
                continue
            if (
                status == TaskStatus.PENDING
                and self._parse_iso_datetime(task_context.get("activation_requested_at"))
            ):
                activation_requested_at = self._parse_iso_datetime(
                    task_context.get("activation_requested_at")
                )
                if activation_requested_at and (now - activation_requested_at).total_seconds() < 90:
                    continue

            if schedule_type == SCHEDULE_TYPE_ONCE and status != TaskStatus.PENDING:
                continue

            schedule_expression = str(task_context.get("schedule_expression") or "").strip()
            next_after = None
            if schedule_type == SCHEDULE_TYPE_RECURRING:
                next_after_dt = self._compute_next_run_from_expression(schedule_expression, now)
                if not next_after_dt:
                    continue
                next_after = next_after_dt.isoformat()

            due_tasks.append(
                {
                    "task": task,
                    "matched_at": now.isoformat(),
                    "next_run_at": next_after,
                    "due_at": next_run_at,
                }
            )

        due_tasks.sort(key=lambda item: item["due_at"])
        return due_tasks

    async def _mark_scheduler_blocked(
        self,
        task_center: Any,
        task: Any,
        block_message: str,
        matched_at: str,
    ) -> None:
        error_text = self._preview(block_message, 260)
        trace_event = None
        if str((task.context or {}).get("scheduler_last_error") or "").strip() != error_text:
            trace_event = {
                "event_type": "schedule",
                "title": "Scheduled run is waiting for provider readiness",
                "message": error_text,
            }
        await task_center.mutate_task_context(
            task.task_id,
            {
                "scheduler_last_matched_at": matched_at,
                "scheduler_last_error": error_text,
                "scheduler_last_error_at": matched_at,
            },
            trace_event=trace_event,
            touch_updated_at=False,
        )

    async def _dispatch_pending_deliveries(self, task_center: Any, tasks: List[Any]) -> None:
        for task in tasks:
            if getattr(task, "status", None) not in (
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ):
                continue

            task_context = getattr(task, "context", {}) or {}
            delivery_records = {
                str(item.get("target") or "").strip().lower(): item
                for item in (task_context.get("delivery_records") or {}).values()
                if isinstance(item, dict)
            }
            for target in list(task_context.get("delivery_targets") or []):
                if target in {DELIVERY_TARGET_TASK_CENTER, ""}:
                    continue
                record = delivery_records.get(str(target).strip().lower()) or {}
                record_status = str(record.get("status") or "").strip().lower()
                if record_status != "queued":
                    continue
                await self._deliver_to_target(task_center, task, target)

    async def _deliver_to_target(self, task_center: Any, task: Any, target: str) -> None:
        target_label = get_delivery_target_label(target)
        attempted_at = datetime.now().isoformat()

        try:
            from py.delivery import dispatch_delivery
            delivery_record = {"target": target, "config": {}}
            ctx = task.context if hasattr(task, "context") else {}
            for rec in ctx.get("delivery_records", []):
                if isinstance(rec, dict) and rec.get("target") == target:
                    delivery_record = rec
                    break
            settings = None
            if self._settings_loader:
                try:
                    settings = await self._settings_loader()
                except Exception:
                    pass
            result = await dispatch_delivery(task, delivery_record, settings=settings)
            if result.get("success"):
                await task_center.update_delivery_status(
                    task.task_id,
                    target,
                    "delivered",
                    message=f"{target_label} delivery sent via {result.get('method', 'adapter')}.",
                    attempted_at=attempted_at,
                    delivered_at=attempted_at,
                    trace_event={
                        "event_type": "delivery",
                        "title": f"Delivery sent: {target_label}",
                        "message": f"{target_label} delivery sent via {result.get('method', 'adapter')}.",
                    },
                )
            else:
                error_text = self._preview(result.get("error", "Unknown delivery error"), 260)
                await task_center.update_delivery_status(
                    task.task_id,
                    target,
                    "failed",
                    error=error_text,
                    attempted_at=attempted_at,
                    trace_event={
                        "event_type": "delivery",
                        "title": f"Delivery failed: {target_label}",
                        "message": error_text,
                    },
                )
        except Exception as exc:
            error_text = self._preview(str(exc), 260)
            await task_center.update_delivery_status(
                task.task_id,
                target,
                "failed",
                error=error_text,
                attempted_at=attempted_at,
                trace_event={
                    "event_type": "delivery",
                    "title": f"Delivery failed: {target_label}",
                    "message": error_text,
                },
            )

    def _build_delivery_payload(self, task: Any, target: str, timestamp: str) -> Dict[str, Any]:
        summary = self._preview(
            getattr(task, "result", None)
            or (getattr(task, "context", {}) or {}).get("summary")
            or getattr(task, "error", None),
            220,
        )
        return {
            "kind": "task_delivery",
            "target": target,
            "task_id": getattr(task, "task_id", ""),
            "title": getattr(task, "title", ""),
            "status": getattr(getattr(task, "status", None), "value", getattr(task, "status", "")),
            "summary": summary,
            "schedule_type": str((getattr(task, "context", {}) or {}).get("schedule_type") or "").strip(),
            "timestamp": timestamp,
            "presentation": (
                "dynamic_island"
                if target == DELIVERY_TARGET_DYNAMIC_ISLAND
                else "desktop_notification"
            ),
        }

    async def _load_task_consensus(self, workspace_dir: str) -> Optional[str]:
        consensus_file = Path(workspace_dir) / ".agent" / "consensus.md"
        if not consensus_file.exists():
            return None
        return await asyncio.to_thread(consensus_file.read_text, encoding="utf-8")

    def _compute_next_run_from_expression(
        self,
        expression: str,
        reference: datetime,
    ) -> Optional[datetime]:
        """Delegate schedule calculation to the shared lightweight policy."""

        return compute_next_run_from_expression(expression, reference)

    def _parse_iso_datetime(self, value: Optional[Any]) -> Optional[datetime]:
        """Delegate ISO timestamp parsing to the shared lightweight policy."""

        return parse_schedule_datetime(value)

    def _preview(self, text: Optional[Any], limit: int = 220) -> str:
        if text is None:
            return ""
        compact = " ".join(str(text).split())
        if len(compact) <= limit:
            return compact
        return compact[: limit - 3] + "..."
