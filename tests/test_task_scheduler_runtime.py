# -*- coding: utf-8 -*-
"""Regression coverage for the staged legacy scheduler ownership switch."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from py.task_scheduler import TaskSchedulerRuntime


class TaskSchedulerRuntimeTests(unittest.IsolatedAsyncioTestCase):
    """Validate that disabled desktop compatibility ownership performs no writes."""

    async def test_disabled_desktop_runtime_does_not_load_task_persistence(self) -> None:
        """Leave schedule and terminal delivery ownership entirely to Task Worker."""

        with tempfile.TemporaryDirectory(prefix="openxnet-scheduler-runtime-") as directory:
            task = SimpleNamespace(
                task_id="scheduled-task",
                status="pending",
                context={
                    "schedule_type": "recurring",
                    "schedule_expression": "hourly",
                    "next_run_at": None,
                },
            )
            task_center = SimpleNamespace(
                list_tasks=AsyncMock(return_value=[task]),
                mutate_task_context=AsyncMock(),
                activate_task=AsyncMock(),
            )
            runtime = TaskSchedulerRuntime(
                settings_loader=AsyncMock(return_value={
                    "CLISettings": {"cc_path": str(Path(directory))},
                }),
                enable_schedule_activation=False,
                enable_terminal_delivery=False,
            )
            with patch("py.task_scheduler.get_task_center", AsyncMock(return_value=task_center)):
                await runtime._run_tick()
            task_center.mutate_task_context.assert_not_awaited()
            task_center.activate_task.assert_not_awaited()
            task_center.list_tasks.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
