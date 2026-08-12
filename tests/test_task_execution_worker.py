# -*- coding: utf-8 -*-
"""Tests for the authenticated task execution Worker adapter."""

from __future__ import annotations

import asyncio
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
import threading
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from py.task_center import TaskStatus, get_task_center
from py.task_execution_preflight import TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA
from py.workers.protocol import WorkerEnvelope, WorkerMessageKind
from py.workers.runtime import WorkerRuntime
from py.workers.task_execution_worker import TaskExecutionAdapter


class _TaskHandler(BaseHTTPRequestHandler):
    """Serve deterministic task responses while recording authentication."""

    requests: list[dict[str, object]] = []
    preflight_ready = True
    preflight_max_tokens = 4096
    delivery_success = True
    delivery_retryable = False
    workspace_path = ""

    def do_GET(self) -> None:
        """Reject legacy task persistence reads from the direct-store Worker."""

        self._record_and_respond({"detail": "not found"}, status=404)

    def do_POST(self) -> None:
        """Return the posted task as an idempotent executor mirror."""

        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        if self.path == "/v1/tasks/executor/preflight":
            ready = self.__class__.preflight_ready
            self._record_and_respond({
                "schema": TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
                "taskId": body.get("taskId"),
                "operation": body.get("operation"),
                "ready": ready,
                "code": "READY" if ready else "PROVIDER_NOT_READY",
                "message": (
                    "Execution provider is ready."
                    if ready
                    else "Execution provider is not ready."
                ),
                "maxTokens": self.__class__.preflight_max_tokens,
            }, body)
            return
        if self.path == "/v1/tasks/executor/delivery/dispatch":
            self._record_and_respond({
                "schema": "openxnet.task-terminal-delivery-result.v1",
                "attemptId": body.get("attemptId"),
                "taskId": body.get("taskId"),
                "target": body.get("target"),
                "success": self.__class__.delivery_success,
                "retryable": self.__class__.delivery_retryable,
                "method": "webhook",
                "message": (
                    "Delivery completed via webhook."
                    if self.__class__.delivery_success
                    else "Delivery will be eligible for a bounded retry."
                ),
                "error": (
                    ""
                    if self.__class__.delivery_success
                    else "Delivery target is temporarily unavailable."
                ),
            }, body)
            return
        if self.path == "/v1/tasks/executor/session/cancel":
            self._record_and_respond({
                "schema": "openxnet.task-execution-cancel.v1",
                "sessionId": body.get("sessionId"),
                "cancelled": True,
            }, body)
            return
        self._record_and_respond({"detail": "not found"}, body, status=404)

    def log_message(self, _format: str, *_arguments: object) -> None:
        """Suppress HTTP server diagnostics during tests."""

    def _record_and_respond(
        self,
        response: dict[str, object],
        body: dict[str, object] | None = None,
        *,
        status: int = 200,
    ) -> None:
        """Record one request and write a bounded JSON response."""

        self.__class__.requests.append({
            "method": self.command,
            "path": self.path,
            "authorization": self.headers.get("Authorization"),
            "body": body or {},
        })
        payload = json.dumps(response).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class TaskExecutionWorkerTests(unittest.IsolatedAsyncioTestCase):
    """Validate task adapter authentication, origin policy, and event output."""

    def setUp(self) -> None:
        """Start one loopback executor fixture."""

        _TaskHandler.requests = []
        _TaskHandler.preflight_ready = True
        _TaskHandler.preflight_max_tokens = 4096
        _TaskHandler.delivery_success = True
        _TaskHandler.delivery_retryable = False
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.workspace_path = str(Path(self.temporary_directory.name) / "workspace")
        Path(self.workspace_path).mkdir()
        _TaskHandler.workspace_path = self.workspace_path
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _TaskHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        """Stop the loopback executor fixture."""

        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temporary_directory.cleanup()

    async def test_create_uses_bearer_token_and_emits_snapshot(self) -> None:
        """Preflight execution, persist directly, and emit the resulting snapshot."""

        output = io.StringIO()
        runtime = WorkerRuntime("tasks", output=output)
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        origin = f"http://127.0.0.1:{self.server.server_port}"
        task_id = "12345678-1234-4123-8123-123456789abc"
        with patch.object(
            adapter,
            "_start_executor_job",
            return_value={"status": "running"},
        ):
            result = await adapter.create_task({
                "brokerOrigin": origin,
                "workspacePath": self.workspace_path,
                "task": {
                    "task_id": task_id,
                    "title": "Worker task",
                    "description": "Authenticated adapter test",
                    "start_immediately": True,
                },
            })
        self.assertTrue(result["success"])
        self.assertEqual(result["execution_options"], {"max_tokens": 4096})
        self.assertEqual(len(_TaskHandler.requests), 1)
        request = _TaskHandler.requests[0]
        self.assertEqual(request["path"], "/v1/tasks/executor/preflight")
        self.assertEqual(request["authorization"], "Bearer task-secret")
        self.assertEqual(request["body"]["operation"], "create")
        self.assertIsNotNone(await (await get_task_center(self.workspace_path)).get_task(task_id))
        event = WorkerEnvelope.from_json_line(output.getvalue().strip())
        self.assertEqual(event.kind, WorkerMessageKind.EVENT)
        self.assertEqual(event.method, "tasks.snapshot")

    async def test_rejects_non_loopback_broker_origin(self) -> None:
        """Reject a broker origin that is not an exact loopback HTTP origin."""

        runtime = WorkerRuntime("tasks", output=io.StringIO())
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        with self.assertRaisesRegex(ValueError, "loopback"):
            await adapter.list_tasks({"brokerOrigin": "https://example.com"})

    async def test_backend_error_detail_is_not_exposed(self) -> None:
        """Keep backend exception text outside the Worker protocol error envelope."""

        runtime = WorkerRuntime("tasks", output=io.StringIO())
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        message = adapter._decode_error(
            b'{"error":"C:\\\\private\\\\workspace\\\\secret.txt"}',
            500,
        )
        self.assertEqual(message, "Task executor returned HTTP 500.")
        self.assertNotIn("private", message)

    async def test_scheduler_tick_activates_one_due_task(self) -> None:
        """Preflight and activate one due task through the direct task store."""

        task_id = "12345678-1234-4123-8123-123456789abc"
        center = await get_task_center(self.workspace_path)
        await center.create_task(
            task_id=task_id,
            title="Due scheduled task",
            description="Activate directly from the Worker store.",
            context={
                "schedule_type": "once",
                "next_run_at": "2000-01-01T00:00:00",
            },
        )
        runtime = WorkerRuntime("tasks", output=io.StringIO())
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        with patch.object(
            adapter,
            "_start_executor_job",
            return_value={"status": "running"},
        ) as start_executor:
            result = await adapter.run_scheduler_tick({
                "brokerOrigin": f"http://127.0.0.1:{self.server.server_port}",
                "workspacePath": self.workspace_path,
            })
        self.assertEqual(result["activated"], 1)
        start_executor.assert_called_once()
        self.assertEqual(
            [request["path"] for request in _TaskHandler.requests],
            ["/v1/tasks/executor/preflight"],
        )
        self.assertEqual(_TaskHandler.requests[0]["body"]["operation"], "scheduled")
        persisted = await center.get_task(task_id)
        self.assertEqual(persisted.context["activation_source"], "worker_scheduler_due")

    async def test_scheduler_failure_still_publishes_latest_snapshot(self) -> None:
        """Persist a generic readiness block and publish the latest snapshot."""

        _TaskHandler.preflight_ready = False
        task_id = "12345678-1234-4123-8123-123456789abc"
        center = await get_task_center(self.workspace_path)
        await center.create_task(
            task_id=task_id,
            title="Blocked scheduled task",
            description="Wait until the provider is ready.",
            context={
                "schedule_type": "once",
                "next_run_at": "2000-01-01T00:00:00",
            },
        )
        output = io.StringIO()
        runtime = WorkerRuntime("tasks", output=output)
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        result = await adapter.run_scheduler_tick({
            "brokerOrigin": f"http://127.0.0.1:{self.server.server_port}",
            "workspacePath": self.workspace_path,
        })
        self.assertEqual(result["activated"], 0)
        self.assertEqual(result["failures"], 1)
        event = WorkerEnvelope.from_json_line(output.getvalue().strip())
        self.assertEqual(event.method, "tasks.snapshot")
        persisted = await center.get_task(task_id)
        self.assertEqual(
            persisted.context["scheduler_last_error"],
            "Execution provider is not ready.",
        )

    async def test_scheduler_delivers_terminal_recurring_run_before_reactivation(self) -> None:
        """Deliver the prior recurring result before resetting it for the next run."""

        task_id = "12345678-1234-4123-8123-123456789abc"
        task_center = await get_task_center(self.workspace_path)
        await task_center.create_task(
            task_id=task_id,
            title="Recurring delivery",
            description="Deliver one run before activating the next.",
            context={
                "schedule_type": "recurring",
                "schedule_expression": "hourly",
                "next_run_at": "2000-01-01T00:00:00",
                "delivery_targets": ["webhook"],
                "delivery_records": {
                    "webhook": {
                        "target": "webhook",
                        "status": "queued",
                        "attempts": 0,
                        "config": {"url": "https://secret.invalid/hook"},
                    },
                },
            },
        )
        await task_center.update_task_progress(
            task_id,
            100,
            status=TaskStatus.COMPLETED,
            result="Recurring run completed.",
        )
        runtime = WorkerRuntime("tasks", output=io.StringIO())
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        with patch.object(
            adapter,
            "_start_executor_job",
            return_value={"status": "running"},
        ):
            result = await adapter.run_scheduler_tick({
                "brokerOrigin": f"http://127.0.0.1:{self.server.server_port}",
                "workspacePath": self.workspace_path,
            })
        self.assertEqual(result["delivered"], 1)
        self.assertEqual(result["activated"], 1)
        ordered_paths = [
            str(request["path"])
            for request in _TaskHandler.requests
            if request["method"] == "POST"
        ]
        self.assertLess(
            ordered_paths.index("/v1/tasks/executor/delivery/dispatch"),
            ordered_paths.index("/v1/tasks/executor/preflight"),
        )
        self.assertFalse(any("/scheduler/activate/" in path for path in ordered_paths))

    async def test_executor_checkpoint_is_validated_and_forwarded(self) -> None:
        """Forward one bounded backend-native checkpoint as a Worker event."""

        output = io.StringIO()
        runtime = WorkerRuntime("tasks", output=output)
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        checkpoint = {
            "schema": "openxnet.task-execution-checkpoint.v1",
            "workspacePath": "C:\\workspace",
            "legacyTaskId": "12345678-1234-4123-8123-123456789abc",
            "parentTaskId": None,
            "title": "Native checkpoint",
            "description": "Forward progress without polling.",
            "agentType": "default",
            "status": "running",
            "progress": 42,
            "scheduleType": "manual",
            "scheduleExpression": "",
            "nextRunAt": None,
            "createdAt": "2026-07-23T10:00:00",
            "sourceUpdatedAt": "2026-07-23T10:01:00",
            "startedAt": "2026-07-23T10:00:30",
            "completedAt": None,
            "resultSummary": "",
            "errorMessage": "",
            "message": "Iteration 3 completed.",
            "detailsPatch": {"current_iteration": 3},
        }
        result = await adapter.publish_executor_checkpoint(checkpoint)
        self.assertTrue(result["accepted"])
        event = WorkerEnvelope.from_json_line(output.getvalue().strip())
        self.assertEqual(event.kind, WorkerMessageKind.EVENT)
        self.assertEqual(event.method, "tasks.checkpoint")
        self.assertEqual(event.payload["progress"], 42)

    async def test_executor_checkpoint_rejects_extra_fields(self) -> None:
        """Reject checkpoint payload smuggling before publishing a Core event."""

        runtime = WorkerRuntime("tasks", output=io.StringIO())
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        with self.assertRaisesRegex(ValueError, "fields"):
            await adapter.publish_executor_checkpoint({"schema": "invalid", "secret": "x"})

    async def test_executor_start_is_deduplicated_and_locally_cancellable(self) -> None:
        """Keep one active job per workspace/task key and cancel it cooperatively."""

        runtime = WorkerRuntime("tasks", output=io.StringIO())
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        started = asyncio.Event()

        async def run_until_cancelled(*_arguments: object, **_keywords: object) -> dict[str, object]:
            """Block a synthetic executor until the adapter cancels its asyncio task."""

            started.set()
            await asyncio.Event().wait()
            return {"success": True}

        payload = {
            "brokerOrigin": f"http://127.0.0.1:{self.server.server_port}",
            "workspacePath": self.workspace_path,
            "taskId": "12345678-1234-4123-8123-123456789abc",
            "maxTokens": 6000,
        }
        with patch(
            "py.workers.task_execution_worker.run_subtask_in_background",
            side_effect=run_until_cancelled,
        ):
            first = await adapter.start_executor(payload)
            await asyncio.wait_for(started.wait(), timeout=1)
            second = await adapter.start_executor(payload)
            status = await adapter.get_executor_status(payload)
            cancelled = await adapter.cancel_executor(payload)

        self.assertEqual(first["status"], "running")
        self.assertFalse(first["deduplicated"])
        self.assertRegex(first["sessionId"], r"^ses_[0-9a-f]{32}$")
        self.assertTrue(second["deduplicated"])
        self.assertEqual(second["sessionId"], first["sessionId"])
        self.assertEqual(status["maxTokens"], 6000)
        self.assertTrue(cancelled["cancelled"])
        session_cancel = next(
            request
            for request in _TaskHandler.requests
            if request["path"] == "/v1/tasks/executor/session/cancel"
        )
        self.assertEqual(session_cancel["body"]["sessionId"], first["sessionId"])
        self.assertEqual((await adapter.get_executor_status(payload))["status"], "idle")

    async def test_executor_progress_publishes_native_checkpoint(self) -> None:
        """Emit SubAgent progress directly instead of waiting for snapshot fallback."""

        output = io.StringIO()
        runtime = WorkerRuntime("tasks", output=output)
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        checkpoint_published = asyncio.Event()

        async def publish_progress(*_arguments: object, **keywords: object) -> dict[str, object]:
            """Invoke the injected publisher with one synthetic running task."""

            publisher = keywords["checkpoint_publisher"]
            task = SimpleNamespace(
                task_id="12345678-1234-4123-8123-123456789abc",
                parent_task_id=None,
                title="Supervised execution",
                description="Publish progress from the Task Worker job.",
                agent_type="default",
                status="running",
                progress=47,
                result=None,
                error=None,
                created_at="2026-07-23T10:00:00",
                updated_at="2026-07-23T10:01:00",
                started_at="2026-07-23T10:00:30",
                completed_at=None,
                context={"schedule_type": "manual", "current_iteration": 2},
            )
            await publisher(task)
            checkpoint_published.set()
            return {"success": True}

        payload = {
            "brokerOrigin": f"http://127.0.0.1:{self.server.server_port}",
            "workspacePath": self.workspace_path,
            "taskId": "12345678-1234-4123-8123-123456789abc",
        }
        with patch(
            "py.workers.task_execution_worker.run_subtask_in_background",
            side_effect=publish_progress,
        ):
            await adapter.start_executor(payload)
            await asyncio.wait_for(checkpoint_published.wait(), timeout=1)
            await asyncio.sleep(0)

        events = [
            WorkerEnvelope.from_json_line(line)
            for line in output.getvalue().splitlines()
            if line.strip()
        ]
        checkpoint = next(event for event in events if event.method == "tasks.checkpoint")
        self.assertEqual(checkpoint.payload["progress"], 47)

    async def test_terminal_delivery_schedules_retry_and_emits_typed_outcome(self) -> None:
        """Persist a retryable broker failure and emit one exact delivery event."""

        _TaskHandler.delivery_success = False
        _TaskHandler.delivery_retryable = True
        output = io.StringIO()
        runtime = WorkerRuntime("tasks", output=output)
        with patch.dict(os.environ, {"OPENXNET_TASK_RPC_TOKEN": "task-secret"}):
            adapter = TaskExecutionAdapter(runtime)
        adapter._adopt_context({
            "brokerOrigin": f"http://127.0.0.1:{self.server.server_port}",
            "workspacePath": self.workspace_path,
        })
        task_center = SimpleNamespace(update_delivery_status=AsyncMock(return_value=None))
        tasks = [{
            "task_id": "12345678-1234-4123-8123-123456789abc",
            "status": "completed",
            "completed_at": "2026-07-24T10:00:00",
            "delivery_targets": ["task_center", "webhook"],
            "delivery_records": [{
                "target": "webhook",
                "status": "queued",
                "attempts": 0,
            }],
        }]
        with patch(
            "py.workers.task_execution_worker.get_task_center",
            AsyncMock(return_value=task_center),
        ):
            counts = await adapter._dispatch_terminal_deliveries(
                tasks,
                datetime(2026, 7, 24, 10, 1, 0),
            )
        self.assertEqual(counts, {"delivered": 0, "retries": 1, "failed": 0})
        task_center.update_delivery_status.assert_awaited_once()
        update = task_center.update_delivery_status.await_args
        self.assertEqual(update.args[2], "retry_scheduled")
        self.assertTrue(update.kwargs["retryable"])
        event = WorkerEnvelope.from_json_line(output.getvalue().strip())
        self.assertEqual(event.method, "tasks.delivery")
        self.assertEqual(event.payload["status"], "retry_scheduled")
        self.assertRegex(event.payload["attemptId"], r"^dly_[0-9a-f]{32}$")
        delivery_request = next(
            request
            for request in _TaskHandler.requests
            if request["path"] == "/v1/tasks/executor/delivery/dispatch"
        )
        self.assertEqual(delivery_request["authorization"], "Bearer task-secret")
        self.assertNotIn("config", delivery_request["body"])


if __name__ == "__main__":
    unittest.main()
