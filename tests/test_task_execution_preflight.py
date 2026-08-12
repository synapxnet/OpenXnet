# -*- coding: utf-8 -*-
"""Regression coverage for the read-only task execution preflight broker."""

from __future__ import annotations

import json
import unittest

import httpx

from py.task_execution_preflight import (
    TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA,
    TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
    TaskExecutionPreflightClient,
    TaskExecutionPreflightError,
    build_task_execution_preflight_result,
)


class TaskExecutionPreflightTests(unittest.IsolatedAsyncioTestCase):
    """Validate exact authentication, schemas, and secret-free readiness state."""

    async def test_client_sends_exact_authenticated_request(self) -> None:
        """Send only the task identity, workspace, operation, and bearer token."""

        captured: dict[str, object] = {}

        async def handle(request: httpx.Request) -> httpx.Response:
            """Capture one preflight request and return a ready result."""

            payload = json.loads(request.content.decode("utf-8"))
            captured["url"] = str(request.url)
            captured["authorization"] = request.headers.get("authorization")
            captured["cache_control"] = request.headers.get("cache-control")
            captured["payload"] = payload
            return httpx.Response(200, json={
                "schema": TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
                "taskId": payload["taskId"],
                "operation": payload["operation"],
                "ready": True,
                "code": "READY",
                "message": "Execution provider is ready.",
                "maxTokens": 8192,
            })

        client = TaskExecutionPreflightClient(
            "http://127.0.0.1:3456",
            "task-secret",
            "C:\\workspace",
            "task-1",
        )
        await client._client.aclose()
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            result = await client.check("start")
        finally:
            await client.close()
        self.assertTrue(result.ready)
        self.assertEqual(result.max_tokens, 8192)
        self.assertEqual(captured["authorization"], "Bearer task-secret")
        self.assertEqual(captured["cache_control"], "no-store")
        self.assertEqual(
            captured["url"],
            "http://127.0.0.1:3456/v1/tasks/executor/preflight",
        )
        self.assertEqual(captured["payload"], {
            "schema": TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA,
            "taskId": "task-1",
            "workspacePath": "C:\\workspace",
            "operation": "start",
        })
        self.assertNotIn("provider", json.dumps(captured["payload"]))

    async def test_client_accepts_generic_not_ready_result(self) -> None:
        """Return a bounded readiness rejection without backend configuration detail."""

        async def handle(_request: httpx.Request) -> httpx.Response:
            """Return one valid provider-not-ready result."""

            return httpx.Response(200, json={
                "schema": TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
                "taskId": "task-2",
                "operation": "resume",
                "ready": False,
                "code": "PROVIDER_NOT_READY",
                "message": "Execution provider is not ready.",
                "maxTokens": 4000,
            })

        client = TaskExecutionPreflightClient(
            "http://localhost:3456",
            "task-secret",
            "C:\\workspace",
            "task-2",
        )
        await client._client.aclose()
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            result = await client.check("resume")
        finally:
            await client.close()
        self.assertFalse(result.ready)
        self.assertEqual(result.code, "PROVIDER_NOT_READY")

    async def test_client_rejects_extra_or_inconsistent_response_fields(self) -> None:
        """Reject response smuggling and mismatched readiness state."""

        async def handle(_request: httpx.Request) -> httpx.Response:
            """Return one result containing a forbidden provider field."""

            return httpx.Response(200, json={
                "schema": TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
                "taskId": "task-3",
                "operation": "scheduled",
                "ready": True,
                "code": "READY",
                "message": "Execution provider is ready.",
                "maxTokens": 4000,
                "provider": {"apiKey": "secret"},
            })

        client = TaskExecutionPreflightClient(
            "http://[::1]:3456",
            "task-secret",
            "C:\\workspace",
            "task-3",
        )
        await client._client.aclose()
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            with self.assertRaises(TaskExecutionPreflightError):
                await client.check("scheduled")
        finally:
            await client.close()

    async def test_client_rejects_non_loopback_and_invalid_operations(self) -> None:
        """Keep the preflight client on an exact loopback, allow-listed surface."""

        with self.assertRaises(TaskExecutionPreflightError):
            TaskExecutionPreflightClient(
                "https://example.com",
                "task-secret",
                "C:\\workspace",
                "task-4",
            )
        client = TaskExecutionPreflightClient(
            "http://127.0.0.1:3456",
            "task-secret",
            "C:\\workspace",
            "task-4",
        )
        try:
            with self.assertRaises(TaskExecutionPreflightError):
                await client.check("delete")
        finally:
            await client.close()

    def test_builder_returns_exact_secret_free_fields(self) -> None:
        """Build only the public readiness decision and bounded token budget."""

        result = build_task_execution_preflight_result(
            task_id="task-5",
            operation="create",
            ready=False,
            max_tokens=4096,
        )
        self.assertEqual(set(result), {
            "schema", "taskId", "operation", "ready", "code", "message", "maxTokens",
        })
        self.assertEqual(result["code"], "PROVIDER_NOT_READY")
        encoded = json.dumps(result)
        self.assertNotIn("api_key", encoded)
        self.assertNotIn("base_url", encoded)
        self.assertNotIn("model", encoded)


if __name__ == "__main__":
    unittest.main()
