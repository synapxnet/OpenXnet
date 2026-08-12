# -*- coding: utf-8 -*-
"""Regression coverage for direct Task Worker workspace persistence."""

from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from py.task_center import TaskStatus, get_task_center
from py.task_worker_store import (
    MAX_CONSENSUS_BYTES,
    TaskWorkerTaskStore,
    normalize_worker_task_create_command,
)


class TaskWorkerTaskStoreTests(unittest.IsolatedAsyncioTestCase):
    """Validate direct CRUD, recovery, scheduling, and bounded workspace reads."""

    def setUp(self) -> None:
        """Create one isolated canonical workspace for each direct-store test."""

        self.temporary_directory = tempfile.TemporaryDirectory(
            prefix="openxnet-task-worker-store-",
        )
        self.workspace = Path(self.temporary_directory.name) / "workspace"
        self.workspace.mkdir()
        self.store = TaskWorkerTaskStore(str(self.workspace))

    def tearDown(self) -> None:
        """Release the isolated workspace after each test."""

        self.temporary_directory.cleanup()

    async def test_crud_is_direct_and_creation_is_idempotent(self) -> None:
        """Persist one Core ID once, then start, cancel, and delete its mirror."""

        command = normalize_worker_task_create_command({
            "task_id": "12345678-1234-4123-8123-123456789abc",
            "title": "Direct task mirror",
            "description": "Persist without a FastAPI task command.",
            "agent_type": "default",
            "context": {"core_task_id": "core-1"},
            "start_immediately": False,
        })
        first = await self.store.create_task(command)
        duplicate = await self.store.create_task(command)
        self.assertEqual(first.task_id, duplicate.task_id)
        listed = await self.store.list_response()
        self.assertEqual(len(listed["tasks"]), 1)
        self.assertEqual(listed["workspace_path"], str(self.workspace.resolve()))
        detail = await self.store.get_response(command.task_id)
        self.assertEqual(detail["task"]["task_id"], command.task_id)
        started = await self.store.start_task(command.task_id, "desktop_core")
        self.assertEqual(started.context["activation_source"], "desktop_core")
        self.assertTrue(await self.store.cancel_task(command.task_id))
        cancelled = await self.store.get_task(command.task_id)
        self.assertEqual(cancelled.status, TaskStatus.CANCELLED)
        self.assertTrue(await self.store.delete_task(command.task_id))
        self.assertIsNone(await self.store.get_task(command.task_id))

    async def test_resume_resolves_a_stored_recovery_action(self) -> None:
        """Resume one failed mirror using an action derived from durable task state."""

        task_id = "12345678-1234-4123-8123-123456789abd"
        command = normalize_worker_task_create_command({
            "task_id": task_id,
            "title": "Recover failed task",
            "description": "Select a bounded stored recovery action.",
            "start_immediately": False,
        })
        await self.store.create_task(command)
        center = await get_task_center(str(self.workspace.resolve()))
        await center.update_task_progress(
            task_id,
            45,
            status=TaskStatus.FAILED,
            error="Synthetic execution failure.",
        )
        failed = await self.store.get_response(task_id)
        actions = failed["task"]["recovery_actions"]
        self.assertTrue(actions)
        selected = actions[0]
        resumed = await self.store.resume_task(
            task_id,
            "",
            selected["action_id"],
        )
        self.assertEqual(resumed.status, TaskStatus.PENDING)
        self.assertEqual(resumed.context["resume_count"], 1)
        self.assertEqual(
            resumed.context["last_recovery_action"]["action_id"],
            selected["action_id"],
        )

    async def test_projection_block_deduplication_and_activation(self) -> None:
        """Project a run, deduplicate readiness errors, and activate atomically."""

        task_id = "12345678-1234-4123-8123-123456789abe"
        command = normalize_worker_task_create_command({
            "task_id": task_id,
            "title": "Recurring direct task",
            "description": "Exercise Worker-owned scheduling state.",
            "schedule_type": "recurring",
            "schedule_expression": "hourly",
            "next_run_at": "",
            "start_immediately": False,
        })
        await self.store.create_task(command)
        projected = await self.store.project_schedule(
            task_id,
            "2026-07-24T10:00:00",
            "",
        )
        self.assertEqual(projected.context["next_run_at"], "2026-07-24T10:00:00")
        blocked = await self.store.mark_scheduler_blocked(
            task_id,
            "2026-07-24T10:00:00",
            "Execution provider is not ready.",
        )
        duplicate = await self.store.mark_scheduler_blocked(
            task_id,
            "2026-07-24T10:01:00",
            "Execution provider is not ready.",
        )
        self.assertEqual(blocked.updated_at, duplicate.updated_at)
        self.assertEqual(
            len(blocked.context["execution_trace"]),
            len(duplicate.context["execution_trace"]),
        )
        activated = await self.store.activate_scheduled_task(
            task_id,
            "2026-07-24T10:02:00",
            "2026-07-24T11:00:00",
        )
        self.assertEqual(activated.context["scheduled_run_count"], 1)
        self.assertEqual(activated.context["scheduler_last_error"], "")

    async def test_consensus_read_enforces_utf8_and_byte_budget(self) -> None:
        """Read valid UTF-8 consensus and reject content over the exact budget."""

        consensus_directory = self.workspace / ".agent"
        consensus_directory.mkdir()
        consensus_path = consensus_directory / "consensus.md"
        consensus_path.write_text("# Consensus\nDirect store ownership.\n", encoding="utf-8")
        self.assertIn("Direct store", await self.store.read_consensus())
        consensus_path.write_bytes(b"x" * (MAX_CONSENSUS_BYTES + 1))
        self.assertIsNone(await self.store.read_consensus())

    def test_creation_rejects_non_boolean_execution_flag(self) -> None:
        """Reject truthy strings that could accidentally start execution."""

        with self.assertRaisesRegex(ValueError, "start_immediately"):
            normalize_worker_task_create_command({
                "task_id": "12345678-1234-4123-8123-123456789abf",
                "title": "Invalid execution flag",
                "description": "Do not coerce strings into execution commands.",
                "start_immediately": "false",
            })


if __name__ == "__main__":
    unittest.main()
