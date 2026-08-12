# -*- coding: utf-8 -*-
"""Tests for authenticated backend control of Task Worker executor jobs."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import unittest

from py.task_executor_worker_client import (
    TaskExecutorWorkerClient,
    TaskExecutorWorkerClientError,
)


class _WorkerGatewayHandler(BaseHTTPRequestHandler):
    """Record one Worker RPC request and return a deterministic success envelope."""

    requests: list[dict[str, object]] = []

    def do_POST(self) -> None:
        """Decode and acknowledge one synthetic Worker gateway request."""

        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        self.__class__.requests.append({
            "authorization": self.headers.get("Authorization"),
            "body": body,
        })
        payload = json.dumps({
            "ok": True,
            "payload": {
                "status": "running",
                "taskId": body["payload"]["taskId"],
            },
        }).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format: str, *_arguments: object) -> None:
        """Suppress HTTP diagnostics during deterministic tests."""


class TaskExecutorWorkerClientTests(unittest.IsolatedAsyncioTestCase):
    """Validate executor RPC authentication and least-privilege payloads."""

    def setUp(self) -> None:
        """Start one loopback Worker gateway fixture."""

        _WorkerGatewayHandler.requests = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _WorkerGatewayHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        """Stop the loopback Worker gateway fixture."""

        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    async def test_start_uses_bearer_token_and_bounded_payload(self) -> None:
        """Send only routing fields and a clamped token option to Task Worker."""

        client = TaskExecutorWorkerClient(
            f"http://127.0.0.1:{self.server.server_port}",
            "worker-secret",
        )
        result = await client.start(
            "C:\\workspace",
            "task-123",
            max_tokens=999_999,
        )
        self.assertEqual(result["status"], "running")
        request = _WorkerGatewayHandler.requests[0]
        self.assertEqual(request["authorization"], "Bearer worker-secret")
        body = request["body"]
        self.assertEqual(body["capability"], "tasks")
        self.assertEqual(body["method"], "tasks.executor.start")
        self.assertEqual(
            body["payload"],
            {
                "workspacePath": "C:\\workspace",
                "taskId": "task-123",
                "maxTokens": 65_536,
            },
        )

    async def test_rejects_non_loopback_gateway_configuration(self) -> None:
        """Reject Worker control when the configured origin is not exact loopback HTTP."""

        client = TaskExecutorWorkerClient("https://example.com", "worker-secret")
        self.assertFalse(client.configured)
        with self.assertRaisesRegex(TaskExecutorWorkerClientError, "not configured"):
            await client.status("C:\\workspace", "task-123")


if __name__ == "__main__":
    unittest.main()
