# -*- coding: utf-8 -*-
"""Regression coverage for idempotent Core-owned task execution mirrors."""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from py.task_center import TaskCenter


class TaskCenterPersistenceTests(unittest.IsolatedAsyncioTestCase):
    """Validate Python task files accept stable Core IDs without duplication."""

    async def test_core_task_id_is_idempotent(self) -> None:
        """Return the existing mirror for an identical repeated Core dispatch."""

        with tempfile.TemporaryDirectory(prefix="openxnet-task-center-") as directory:
            center = TaskCenter(directory)
            task_id = "fd481ec8-49f1-466b-8217-5340170fe634"
            created = await center.create_task(
                title="Durable task",
                description="Created by Desktop Core",
                task_id=task_id,
            )
            repeated = await center.create_task(
                title="Durable task",
                description="Created by Desktop Core",
                task_id=task_id,
            )
            self.assertEqual(created.task_id, task_id)
            self.assertEqual(repeated.task_id, task_id)
            self.assertEqual(
                len(list((Path(directory) / ".agent" / "tasks").glob("*.json"))),
                1,
            )

    async def test_core_task_id_rejects_invalid_or_conflicting_reuse(self) -> None:
        """Reject unsafe filenames and conflicting retries for one Core ID."""

        with tempfile.TemporaryDirectory(prefix="openxnet-task-center-invalid-") as directory:
            center = TaskCenter(directory)
            task_id = "23d57dac-9cf5-4aa6-a9ad-c195c93a8442"
            await center.create_task(
                title="Original",
                description="Original description",
                task_id=task_id,
            )
            with self.assertRaisesRegex(ValueError, "different content"):
                await center.create_task(
                    title="Changed",
                    description="Original description",
                    task_id=task_id,
                )
            with self.assertRaisesRegex(ValueError, "unsupported characters"):
                await center.create_task(
                    title="Unsafe",
                    description="Unsafe",
                    task_id="../outside",
                )

    async def test_worker_scheduler_activation_updates_schedule_metadata(self) -> None:
        """Record Worker-owned scheduler activation using the legacy task mirror."""

        with tempfile.TemporaryDirectory(prefix="openxnet-task-center-scheduler-") as directory:
            center = TaskCenter(directory)
            task = await center.create_task(
                title="Scheduled task",
                description="Activated by the supervised Worker",
                context={
                    "schedule_type": "once",
                    "next_run_at": "2000-01-01T00:00:00",
                },
            )
            activated = await center.activate_task(
                task.task_id,
                trigger_source="worker_scheduler_due",
                scheduler_matched_at="2026-07-23T10:00:00",
            )
            self.assertIsNotNone(activated)
            assert activated is not None
            self.assertEqual(activated.context["activation_source"], "worker_scheduler_due")
            self.assertEqual(activated.context["scheduled_run_count"], 1)
            self.assertEqual(
                activated.context["scheduler_last_matched_at"],
                "2026-07-23T10:00:00",
            )
            self.assertTrue(activated.context["scheduler_last_triggered_at"])
            self.assertNotEqual(activated.updated_at, task.updated_at)

    async def test_task_save_schedules_a_native_checkpoint(self) -> None:
        """Publish one detached Worker checkpoint after the task file is durable."""

        with tempfile.TemporaryDirectory(prefix="openxnet-task-center-events-") as directory:
            publisher = SimpleNamespace(
                configured=True,
                publish_checkpoint=AsyncMock(return_value=True),
            )
            with patch(
                "py.task_center.TaskExecutionEventClient.from_environment",
                return_value=publisher,
            ):
                center = TaskCenter(directory)
                task = await center.create_task(
                    title="Checkpoint task",
                    description="Publish after persistence.",
                )
                await asyncio.sleep(0)
            publisher.publish_checkpoint.assert_awaited_once()
            checkpoint = publisher.publish_checkpoint.await_args.args[0]
            self.assertEqual(checkpoint["legacyTaskId"], task.task_id)
            self.assertEqual(checkpoint["schema"], "openxnet.task-execution-checkpoint.v1")

    async def test_task_worker_claim_does_not_interrupt_fresh_backend_activation(self) -> None:
        """Skip startup recovery until Task Worker explicitly owns the task session."""

        with tempfile.TemporaryDirectory(prefix="openxnet-task-owner-handoff-") as directory:
            backend_center = TaskCenter(directory, runtime_role="desktop")
            task = await backend_center.create_task(
                title="Fresh activation",
                description="Hand execution ownership from backend to Task Worker.",
            )
            activated = await backend_center.start_task(task.task_id, trigger_source="desktop_core")
            self.assertIsNotNone(activated)

            worker_center = TaskCenter(directory, runtime_role="task-worker")
            recovered = await worker_center.reconcile_interrupted_tasks_on_startup()
            before_claim = await worker_center.get_task(task.task_id)
            self.assertEqual(recovered, 0)
            self.assertEqual(before_claim.status.value, "pending")

            claimed = await worker_center.claim_execution_session(
                task.task_id,
                "ses_currentworker123",
            )
            self.assertIsNotNone(claimed)
            self.assertEqual(claimed.status.value, "running")
            self.assertEqual(claimed.context["executor_owner_role"], "task-worker")
            self.assertEqual(claimed.context["executor_session_id"], "ses_currentworker123")

    async def test_task_worker_restart_recovers_only_owned_execution(self) -> None:
        """Convert a prior Task Worker session to a resumable interrupted failure."""

        with tempfile.TemporaryDirectory(prefix="openxnet-task-owner-restart-") as directory:
            backend_center = TaskCenter(directory, runtime_role="desktop")
            task = await backend_center.create_task(
                title="Interrupted session",
                description="Recover only the execution previously claimed by Task Worker.",
            )
            await backend_center.start_task(task.task_id, trigger_source="desktop_core")
            first_worker = TaskCenter(directory, runtime_role="task-worker")
            await first_worker.reconcile_interrupted_tasks_on_startup()
            await first_worker.claim_execution_session(task.task_id, "ses_previousworker1")

            restarted_worker = TaskCenter(directory, runtime_role="task-worker")
            recovered = await restarted_worker.reconcile_interrupted_tasks_on_startup()
            interrupted = await restarted_worker.get_task(task.task_id)
            self.assertEqual(recovered, 1)
            self.assertEqual(interrupted.status.value, "failed")
            self.assertTrue(interrupted.context["interrupted_recovery_required"])
            self.assertEqual(
                interrupted.context["last_executor_session_id"],
                "ses_previousworker1",
            )
            self.assertEqual(interrupted.context["executor_session_id"], "")


if __name__ == "__main__":
    unittest.main()
