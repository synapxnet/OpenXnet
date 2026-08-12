# -*- coding: utf-8 -*-
"""Regression coverage for native task checkpoint production and publication."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from types import SimpleNamespace
import threading
import unittest

from py.task_execution_events import (
    MAX_TRACE_ENTRIES,
    TASK_EXECUTION_CHECKPOINT_SCHEMA,
    TaskExecutionEventClient,
    build_task_execution_checkpoint,
)


class _CheckpointHandler(BaseHTTPRequestHandler):
    """Capture one authenticated Worker RPC checkpoint request."""

    requests: list[dict[str, object]] = []

    def do_POST(self) -> None:
        """Record the request and return one Worker RPC success envelope."""

        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        self.__class__.requests.append({
            "authorization": self.headers.get("Authorization"),
            "body": body,
        })
        payload = json.dumps({"ok": True, "payload": {"accepted": True}}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format: str, *_arguments: object) -> None:
        """Suppress fixture access logs."""


class TaskExecutionEventTests(unittest.IsolatedAsyncioTestCase):
    """Validate bounded checkpoints and authenticated best-effort delivery."""

    def setUp(self) -> None:
        """Start one loopback Worker RPC fixture."""

        _CheckpointHandler.requests = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _CheckpointHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        """Stop the loopback Worker RPC fixture."""

        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    async def test_builds_a_bounded_native_checkpoint(self) -> None:
        """Retain recent progress metadata without forwarding unbounded history."""

        task = SimpleNamespace(
            task_id="12345678-1234-4123-8123-123456789abc",
            parent_task_id=None,
            title="Native checkpoint",
            description="Publish executor progress without a snapshot poll.",
            agent_type="default",
            status=SimpleNamespace(value="running"),
            progress=42,
            result=None,
            error=None,
            created_at="2026-07-23T10:00:00",
            updated_at="2026-07-23T10:01:00",
            started_at="2026-07-23T10:00:30",
            completed_at=None,
            context={
                "current_iteration": 3,
                "last_heartbeat_at": "2026-07-23T10:01:00",
                "history": ["x"] * 1000,
                "execution_trace": [
                    {"type": "progress", "title": f"Step {index}", "message": "done"}
                    for index in range(100)
                ],
            },
        )
        checkpoint = build_task_execution_checkpoint("C:\\workspace", task)
        self.assertEqual(checkpoint["schema"], TASK_EXECUTION_CHECKPOINT_SCHEMA)
        self.assertEqual(checkpoint["progress"], 42)
        self.assertEqual(checkpoint["detailsPatch"]["current_iteration"], 3)
        self.assertEqual(
            len(checkpoint["detailsPatch"]["execution_trace"]),
            MAX_TRACE_ENTRIES,
        )
        self.assertNotIn("history", checkpoint["detailsPatch"])

    async def test_publishes_through_authenticated_worker_rpc(self) -> None:
        """Send the exact tasks capability and checkpoint method with a bearer token."""

        client = TaskExecutionEventClient(
            f"http://127.0.0.1:{self.server.server_port}",
            "worker-secret",
        )
        checkpoint = {
            "schema": TASK_EXECUTION_CHECKPOINT_SCHEMA,
            "workspacePath": "C:\\workspace",
            "legacyTaskId": "12345678-1234-4123-8123-123456789abc",
        }
        self.assertTrue(await client.publish_checkpoint(checkpoint))
        self.assertEqual(len(_CheckpointHandler.requests), 1)
        request = _CheckpointHandler.requests[0]
        self.assertEqual(request["authorization"], "Bearer worker-secret")
        body = request["body"]
        self.assertEqual(body["capability"], "tasks")
        self.assertEqual(body["method"], "tasks.executor.checkpoint")

    async def test_rejects_non_loopback_publication_origin(self) -> None:
        """Keep executor checkpoint delivery on an exact loopback HTTP origin."""

        client = TaskExecutionEventClient("https://example.com", "worker-secret")
        self.assertFalse(client.configured)
        self.assertFalse(await client.publish_checkpoint({"schema": "invalid"}))


if __name__ == "__main__":
    unittest.main()
