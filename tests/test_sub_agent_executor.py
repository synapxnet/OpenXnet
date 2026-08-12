# -*- coding: utf-8 -*-
"""Integration tests for the explicit supervised SubAgent executor contract."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

from py.sub_agent import run_subtask_in_background
from py.task_center import TaskStatus, get_task_center
from py.task_execution_session import (
    TASK_EXECUTION_EVALUATION_SCHEMA,
    TASK_EXECUTION_EVENT_SCHEMA,
)
from py.task_tools import create_subtask


class _SubAgentBackendHandler(BaseHTTPRequestHandler):
    """Serve deterministic streaming and completion responses for one SubAgent."""

    chat_requests: list[dict[str, object]] = []
    authorization_headers: list[str] = []

    def do_POST(self) -> None:
        """Return one completed stream or one affirmative completion decision."""

        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        if self.path == "/v1/tasks/executor/session/turn":
            self.__class__.chat_requests.append(body)
            self.__class__.authorization_headers.append(
                str(self.headers.get("Authorization") or "")
            )
            session_id = str(body["sessionId"])
            payload = (
                "data: "
                + json.dumps({
                    "schema": TASK_EXECUTION_EVENT_SCHEMA,
                    "sessionId": session_id,
                    "sequence": 1,
                    "type": "text_delta",
                    "text": "Supervised result",
                }, separators=(",", ":"))
                + "\n\n"
                + "data: "
                + json.dumps({
                    "schema": TASK_EXECUTION_EVENT_SCHEMA,
                    "sessionId": session_id,
                    "sequence": 2,
                    "type": "done",
                }, separators=(",", ":"))
                + "\n\n"
            ).encode("utf-8")
            self._write_response(payload, "text/event-stream; charset=utf-8")
            return
        if self.path == "/v1/tasks/executor/session/evaluate":
            payload = json.dumps({
                "schema": TASK_EXECUTION_EVALUATION_SCHEMA,
                "sessionId": body["sessionId"],
                "complete": True,
            }).encode("utf-8")
            self._write_response(payload, "application/json; charset=utf-8")
            return
        self.send_error(404)

    def log_message(self, _format: str, *_arguments: object) -> None:
        """Suppress HTTP diagnostics during deterministic tests."""

    def _write_response(self, payload: bytes, content_type: str) -> None:
        """Write one bounded successful HTTP response."""

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class SubAgentExecutorTests(unittest.IsolatedAsyncioTestCase):
    """Validate real loopback streaming, task persistence, and checkpoint callbacks."""

    def setUp(self) -> None:
        """Create one temporary workspace and loopback backend fixture."""

        _SubAgentBackendHandler.chat_requests = []
        _SubAgentBackendHandler.authorization_headers = []
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.workspace_path = str(Path(self.temporary_directory.name) / "workspace")
        Path(self.workspace_path).mkdir()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _SubAgentBackendHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        """Stop the loopback backend and remove the temporary workspace."""

        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temporary_directory.cleanup()

    async def test_executes_with_explicit_origin_and_publishes_checkpoints(self) -> None:
        """Complete one real stream without loading settings or inferring a port."""

        task_center = await get_task_center(self.workspace_path)
        task = await task_center.create_task(
            title="Supervised SubAgent",
            description="Finish through the explicit loopback backend contract.",
        )
        checkpoint_states: list[tuple[str, int]] = []

        async def publish_checkpoint(updated_task: object) -> None:
            """Record each persisted state delivered by the executor callback."""

            status_value = getattr(updated_task, "status")
            status = str(getattr(status_value, "value", status_value))
            checkpoint_states.append((status, int(getattr(updated_task, "progress"))))

        result = await run_subtask_in_background(
            task_id=task.task_id,
            workspace_dir=self.workspace_path,
            backend_origin=f"http://127.0.0.1:{self.server.server_port}",
            task_rpc_token="task-session-secret",
            max_tokens=7777,
            checkpoint_publisher=publish_checkpoint,
        )

        persisted = await task_center.get_task(task.task_id)
        self.assertTrue(result["success"], result)
        self.assertIsNotNone(persisted)
        self.assertEqual(persisted.status, TaskStatus.COMPLETED)
        self.assertEqual(persisted.result, "Supervised result")
        self.assertIn(("running", 0), checkpoint_states)
        self.assertIn(("completed", 100), checkpoint_states)
        self.assertEqual(_SubAgentBackendHandler.chat_requests[0]["maxTokens"], 7777)
        self.assertEqual(
            _SubAgentBackendHandler.chat_requests[0]["schema"],
            "openxnet.task-execution-turn.v1",
        )
        self.assertNotIn("settings", _SubAgentBackendHandler.chat_requests[0])
        self.assertNotIn("api_key", _SubAgentBackendHandler.chat_requests[0])
        self.assertEqual(
            _SubAgentBackendHandler.authorization_headers[0],
            "Bearer task-session-secret",
        )

    async def test_nested_dispatch_failure_is_persisted_as_terminal(self) -> None:
        """Avoid leaving a nested task running when Worker RPC rejects its job."""

        class RejectingWorkerClient:
            """Expose a configured client that deterministically rejects starts."""

            configured = True

            async def start(self, *_arguments: object, **_keywords: object) -> None:
                """Reject one synthetic nested executor dispatch."""

                raise RuntimeError("Synthetic Task Worker outage.")

        with patch(
            "py.task_tools.get_task_executor_worker_client",
            return_value=RejectingWorkerClient(),
        ):
            result = await create_subtask(
                title="Rejected nested task",
                description="Persist a terminal failure after Worker RPC rejection.",
                workspace_dir=self.workspace_path,
                settings={"max_tokens": 4000},
                start_immediately=True,
            )

        task_center = await get_task_center(self.workspace_path)
        tasks = await task_center.list_tasks()
        self.assertIn("Subtask creation failed", result)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0].status, TaskStatus.FAILED)
        self.assertTrue(tasks[0].context["executor_dispatch_failed"])


if __name__ == "__main__":
    unittest.main()
