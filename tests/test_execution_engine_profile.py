# -*- coding: utf-8 -*-
"""Regression coverage for the authenticated Execution Engine route boundary."""

from __future__ import annotations

from contextlib import asynccontextmanager
import unittest

import httpx

from py.execution_engine_profile import create_execution_engine_application


TEST_TOKEN = "execution-engine-profile-test-token"
TEST_ORIGIN = "http://127.0.0.1:45678"


@asynccontextmanager
async def _empty_lifespan(_application):
    """Provide a no-op ASGI lifespan for isolated boundary tests."""

    yield


def _create_test_application():
    """Create one profile app with a representative broker route."""

    application = create_execution_engine_application(
        lifespan=_empty_lifespan,
        token=TEST_TOKEN,
    )

    @application.post("/v1/tasks/executor/preflight")
    async def test_preflight() -> dict[str, bool]:
        """Return one deterministic broker response after boundary validation."""

        return {"ready": True}

    @application.post("/v1/chat/completions")
    async def test_chat() -> dict[str, bool]:
        """Return one deterministic Chat response after boundary validation."""

        return {"chat": True}

    @application.post("/v1/desktop/knowledge-base/status")
    async def test_knowledge_base_status() -> dict[str, bool]:
        """返回确定性知识库状态；无输入，输出固定对象，仅用于边界测试。"""

        return {"knowledgeBase": True}

    return application


async def _request(
    method: str,
    path: str,
    *,
    token: str | None = TEST_TOKEN,
    host: str | None = None,
) -> httpx.Response:
    """Issue one isolated ASGI request with optional authentication and Host override."""

    headers = {}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    if host is not None:
        headers["Host"] = host
    transport = httpx.ASGITransport(app=_create_test_application())
    async with httpx.AsyncClient(transport=transport, base_url=TEST_ORIGIN) as client:
        return await client.request(method, path, headers=headers)


class ExecutionEngineProfileTests(unittest.IsolatedAsyncioTestCase):
    """Validate exact routes, bearer authentication, and loopback Host policy."""

    async def test_authorizes_health_and_broker_routes(self) -> None:
        """Allow exact authenticated methods on the private loopback origin."""

        health = await _request("GET", "/health")
        preflight = await _request("POST", "/v1/tasks/executor/preflight")
        chat = await _request("POST", "/v1/chat/completions")
        knowledge_base = await _request("POST", "/v1/desktop/knowledge-base/status")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["profile"], "execution-engine")
        self.assertEqual(preflight.status_code, 200)
        self.assertEqual(preflight.json(), {"ready": True})
        self.assertEqual(chat.status_code, 200)
        self.assertEqual(chat.json(), {"chat": True})
        self.assertEqual(knowledge_base.status_code, 200)
        self.assertEqual(knowledge_base.json(), {"knowledgeBase": True})

    async def test_rejects_missing_or_invalid_bearer_tokens(self) -> None:
        """Require the process-scoped token without reflecting credential values."""

        missing = await _request("GET", "/health", token=None)
        invalid = await _request("GET", "/health", token="invalid-token")
        self.assertEqual(missing.status_code, 401)
        self.assertEqual(invalid.status_code, 401)
        self.assertNotIn("invalid-token", invalid.text)

    async def test_rejects_unknown_queries_methods_and_hosts(self) -> None:
        """Keep the engine invisible outside its exact authenticated route table."""

        unknown = await _request("POST", "/v1/tasks/executor/unknown")
        query = await _request("GET", "/health?verbose=1")
        method = await _request("POST", "/health")
        host = await _request("GET", "/health", host="example.com:45678")
        self.assertEqual(unknown.status_code, 404)
        self.assertEqual(query.status_code, 404)
        self.assertEqual(method.status_code, 405)
        self.assertEqual(host.status_code, 403)

    def test_requires_a_non_empty_process_token(self) -> None:
        """Fail closed before binding when the Main-owned token is missing."""

        with self.assertRaisesRegex(RuntimeError, "OPENXNET_TASK_RPC_TOKEN"):
            create_execution_engine_application(lifespan=_empty_lifespan, token="")


if __name__ == "__main__":
    unittest.main()
