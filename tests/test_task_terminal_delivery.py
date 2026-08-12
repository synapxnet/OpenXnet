# -*- coding: utf-8 -*-
"""Regression coverage for terminal delivery contracts and retry policy."""

from __future__ import annotations

from datetime import datetime, timedelta
import json
from pathlib import Path
import tempfile
import unittest

import httpx

from py.task_center import TaskCenter, TaskStatus
from py.task_delivery_policy import (
    collect_terminal_delivery_decisions,
    compute_delivery_retry_at,
)
from py.task_terminal_delivery import (
    TASK_TERMINAL_DELIVERY_RESULT_SCHEMA,
    TaskTerminalDeliveryClient,
    TaskTerminalDeliveryError,
    build_terminal_delivery_result,
)


class TaskTerminalDeliveryTests(unittest.IsolatedAsyncioTestCase):
    """Validate typed broker responses, retry selection, and durable state."""

    async def test_client_sends_exact_secret_free_request_and_parses_result(self) -> None:
        """Authenticate one exact broker request without carrying target configuration."""

        captured: dict[str, object] = {}

        async def handle(request: httpx.Request) -> httpx.Response:
            """Capture one synthetic broker request and return a valid result."""

            captured["authorization"] = request.headers.get("authorization")
            captured["payload"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(200, json={
                "schema": TASK_TERMINAL_DELIVERY_RESULT_SCHEMA,
                "attemptId": "dly_0123456789abcdef0123456789abcdef",
                "taskId": "task-1",
                "target": "webhook",
                "success": False,
                "retryable": True,
                "method": "webhook",
                "message": "Delivery will be eligible for a bounded retry.",
                "error": "Delivery target is temporarily unavailable.",
            })

        client = TaskTerminalDeliveryClient(
            "http://127.0.0.1:3456",
            "task-secret",
            "C:\\workspace",
            "task-1",
        )
        await client._client.aclose()
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            result = await client.dispatch(
                attempt_id="dly_0123456789abcdef0123456789abcdef",
                target="webhook",
                attempt=1,
            )
        finally:
            await client.close()
        self.assertTrue(result.retryable)
        self.assertEqual(captured["authorization"], "Bearer task-secret")
        payload = captured["payload"]
        self.assertIsInstance(payload, dict)
        self.assertEqual(set(payload), {
            "schema", "attemptId", "taskId", "workspacePath", "target", "attempt",
        })
        self.assertNotIn("config", json.dumps(payload))

    async def test_client_rejects_inconsistent_success_response(self) -> None:
        """Reject a broker response that combines success with an error string."""

        async def handle(_request: httpx.Request) -> httpx.Response:
            """Return one deliberately inconsistent broker result."""

            return httpx.Response(200, json={
                "schema": TASK_TERMINAL_DELIVERY_RESULT_SCHEMA,
                "attemptId": "dly_0123456789abcdef0123456789abcdef",
                "taskId": "task-1",
                "target": "webhook",
                "success": True,
                "retryable": False,
                "method": "webhook",
                "message": "Delivered.",
                "error": "reflected-secret",
            })

        client = TaskTerminalDeliveryClient(
            "http://127.0.0.1:3456",
            "task-secret",
            "C:\\workspace",
            "task-1",
        )
        await client._client.aclose()
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            with self.assertRaises(TaskTerminalDeliveryError):
                await client.dispatch(
                    attempt_id="dly_0123456789abcdef0123456789abcdef",
                    target="webhook",
                    attempt=1,
                )
        finally:
            await client.close()

    async def test_policy_waits_for_retry_and_stops_at_attempt_limit(self) -> None:
        """Select queued and due retry records while enforcing the attempt ceiling."""

        reference = datetime(2026, 7, 24, 10, 0, 0)
        tasks = [{
            "task_id": "task-queued",
            "status": "completed",
            "completed_at": "2026-07-24T09:59:00",
            "delivery_targets": ["task_center", "webhook"],
            "delivery_records": [{"target": "webhook", "status": "queued", "attempts": 0}],
        }, {
            "task_id": "task-waiting",
            "status": "failed",
            "completed_at": "2026-07-24T09:58:00",
            "delivery_targets": ["telegram"],
            "delivery_records": [{
                "target": "telegram",
                "status": "retry_scheduled",
                "attempts": 1,
                "next_attempt_at": (reference + timedelta(seconds=1)).isoformat(),
            }],
        }, {
            "task_id": "task-exhausted",
            "status": "cancelled",
            "completed_at": "2026-07-24T09:57:00",
            "delivery_targets": ["discord"],
            "delivery_records": [{"target": "discord", "status": "retry_scheduled", "attempts": 3}],
        }]
        decisions = collect_terminal_delivery_decisions(tasks, reference)
        self.assertEqual([item.task_id for item in decisions], ["task-queued"])
        self.assertRegex(decisions[0].attempt_id, r"^dly_[0-9a-f]{32}$")
        self.assertEqual(
            compute_delivery_retry_at(1, reference),
            (reference + timedelta(seconds=15)).isoformat(),
        )

    async def test_broker_result_redacts_raw_adapter_errors(self) -> None:
        """Keep reflected target credentials out of broker response fields."""

        secret = "https://user:secret@example.invalid/private-hook"
        result = build_terminal_delivery_result(
            attempt_id="dly_0123456789abcdef0123456789abcdef",
            task_id="task-1",
            target="webhook",
            raw_result={
                "success": False,
                "retryable": True,
                "method": secret,
                "error": secret,
            },
        )
        self.assertNotIn(secret, json.dumps(result))
        self.assertEqual(result["method"], "adapter")
        self.assertEqual(result["error"], "Delivery target is temporarily unavailable.")

    async def test_task_center_persists_retry_without_serializing_config(self) -> None:
        """Persist retry metadata while keeping target secrets out of task snapshots."""

        with tempfile.TemporaryDirectory(prefix="openxnet-terminal-delivery-") as directory:
            workspace = Path(directory)
            center = TaskCenter(str(workspace))
            task = await center.create_task(
                title="Delivery retry",
                description="Keep delivery credentials behind the backend broker.",
                context={
                    "delivery_targets": ["webhook"],
                    "delivery_records": {
                        "webhook": {
                            "target": "webhook",
                            "config": {"url": "https://secret.invalid/hook"},
                        },
                    },
                },
            )
            await center.update_task_progress(
                task.task_id,
                100,
                status=TaskStatus.COMPLETED,
                result="done",
            )
            updated = await center.update_delivery_status(
                task.task_id,
                "webhook",
                "retry_scheduled",
                error="Delivery target is temporarily unavailable.",
                attempted_at="2026-07-24T10:00:00",
                next_attempt_at="2026-07-24T10:00:15",
                attempt_id="dly_0123456789abcdef0123456789abcdef",
                method="webhook",
                retryable=True,
            )
            self.assertIsNotNone(updated)
            self.assertEqual(updated.context["delivery_records"]["webhook"]["attempts"], 1)
            duplicate = await center.update_delivery_status(
                task.task_id,
                "webhook",
                "retry_scheduled",
                error="Delivery target is temporarily unavailable.",
                attempted_at="2026-07-24T10:00:00",
                next_attempt_at="2026-07-24T10:00:15",
                attempt_id="dly_0123456789abcdef0123456789abcdef",
                method="webhook",
                retryable=True,
            )
            self.assertEqual(duplicate.context["delivery_records"]["webhook"]["attempts"], 1)
            snapshot = center.serialize_task(updated)
            self.assertNotIn("secret.invalid", json.dumps(snapshot))
            self.assertEqual(snapshot["delivery_status"], "retry_scheduled")

    async def test_recurring_activation_resets_delivery_attempt_state(self) -> None:
        """Give each recurring terminal run an independent delivery attempt budget."""

        with tempfile.TemporaryDirectory(prefix="openxnet-recurring-delivery-") as directory:
            center = TaskCenter(directory)
            task = await center.create_task(
                title="Recurring delivery",
                description="Reset prior delivery attempts before the next run.",
                context={
                    "schedule_type": "recurring",
                    "schedule_expression": "hourly",
                    "next_run_at": "2026-07-24T09:00:00",
                    "delivery_targets": ["webhook"],
                },
            )
            await center.update_task_progress(
                task.task_id,
                100,
                status=TaskStatus.COMPLETED,
                result="first run",
            )
            await center.update_delivery_status(
                task.task_id,
                "webhook",
                "delivered",
                attempted_at="2026-07-24T10:00:00",
                delivered_at="2026-07-24T10:00:00",
                attempt_id="dly_0123456789abcdef0123456789abcdef",
                method="webhook",
                retryable=False,
            )
            activated = await center.activate_task(
                task.task_id,
                trigger_source="worker_scheduler_due",
                scheduler_matched_at="2026-07-24T11:00:00",
                next_run_at="2026-07-24T12:00:00",
            )
            self.assertIsNotNone(activated)
            record = activated.context["delivery_records"]["webhook"]
            self.assertEqual(record["attempts"], 0)
            self.assertEqual(record["status"], "scheduled")
            self.assertIsNone(record["last_attempt_at"])


if __name__ == "__main__":
    unittest.main()
