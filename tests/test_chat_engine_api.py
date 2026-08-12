# -*- coding: utf-8 -*-
"""Regression coverage for the typed private Chat Engine API."""

from __future__ import annotations

import json
import unittest
from typing import Any, Dict

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

from py.chat_engine_api import ChatEngineDependencies, register_chat_engine_api


class ChatEngineApiTests(unittest.IsolatedAsyncioTestCase):
    """Validate exact payloads, adapter routing, and streaming passthrough."""

    def setUp(self) -> None:
        """Create one isolated Chat API with deterministic dependency adapters."""

        self.calls: list[tuple[str, Any]] = []
        application = FastAPI()

        async def run_chat(payload: Dict[str, Any], _request: Request) -> StreamingResponse:
            """Record and stream one synthetic full chat response."""

            self.calls.append(("chat", payload))

            async def body():
                """Yield one deterministic UTF-8 stream frame."""

                yield "data: 你好\n\n".encode("utf-8")

            return StreamingResponse(body(), media_type="text/event-stream")

        async def run_simple_chat(payload: Dict[str, Any]) -> Dict[str, Any]:
            """Record and return one synthetic simple completion."""

            self.calls.append(("simple", payload))
            return {"kind": "simple"}

        async def list_models() -> Dict[str, Any]:
            """Return one synthetic model catalog."""

            self.calls.append(("models", None))
            return {"data": [{"id": "model-1"}]}

        def abort_chat(conversation_id: str) -> bool:
            """Record and accept one synthetic conversation abort."""

            self.calls.append(("abort", conversation_id))
            return True

        async def execute_tool(payload: Dict[str, Any]) -> Dict[str, Any]:
            """Record one synthetic manual tool execution."""

            self.calls.append(("tool", payload))
            return {"result": "executed"}

        async def resolve_approval(payload: Dict[str, Any]) -> Dict[str, Any]:
            """Record one synthetic approval resolution."""

            self.calls.append(("approval", payload))
            return {"ok": True}

        register_chat_engine_api(
            application,
            ChatEngineDependencies(
                run_chat=run_chat,
                run_simple_chat=run_simple_chat,
                list_models=list_models,
                abort_chat=abort_chat,
                execute_tool=execute_tool,
                resolve_approval=resolve_approval,
            ),
        )
        self.transport = httpx.ASGITransport(app=application)

    async def _post(self, path: str, payload: Dict[str, Any]) -> httpx.Response:
        """Issue one isolated JSON command to the typed Chat API."""

        async with httpx.AsyncClient(transport=self.transport, base_url="http://test") as client:
            return await client.post(path, json=payload)

    async def test_routes_all_six_typed_commands(self) -> None:
        """Route each exact command to its narrow dependency adapter."""

        chat = await self._post("/v1/chat/completions", {
            "messages": [{"role": "user", "content": "hello"}],
            "stream": True,
            "behavior_trigger": True,
        })
        simple = await self._post("/simple_chat", {
            "messages": [{"role": "user", "content": "hello"}],
            "stream": False,
        })
        models = await self._post("/v1/models", {})
        abort = await self._post("/v1/chat/abort", {"conversationId": "conversation-1"})
        tool = await self._post("/execute_tool_manually", {
            "tool_name": "search_tool",
            "tool_params": {"query": "desktop"},
        })
        approval = await self._post("/v1/chat/tools/approval", {
            "approval_id": "approval-1",
            "resolution": "approved",
            "consume": True,
        })

        self.assertEqual(chat.status_code, 200)
        self.assertEqual(chat.content, "data: 你好\n\n".encode("utf-8"))
        self.assertEqual(simple.json(), {"kind": "simple"})
        self.assertEqual(models.json()["data"][0]["id"], "model-1")
        self.assertTrue(abort.json()["aborted"])
        self.assertEqual(tool.json(), {"result": "executed"})
        self.assertEqual(approval.json(), {"ok": True})
        self.assertEqual([name for name, _payload in self.calls], [
            "chat", "simple", "models", "abort", "tool", "approval",
        ])
        self.assertTrue(self.calls[0][1]["stream"])
        self.assertTrue(self.calls[0][1]["behavior_trigger"])
        self.assertEqual(self.calls[4][1]["approval_id"], "")

    async def test_rejects_unknown_fields_and_invalid_approval_resolution(self) -> None:
        """Reject Renderer payload drift before invoking credential-bearing adapters."""

        unknown = await self._post("/simple_chat", {
            "messages": [{"role": "user", "content": "hello"}],
            "provider_secret": "must-not-cross",
        })
        invalid = await self._post("/v1/chat/tools/approval", {
            "approval_id": "approval-1",
            "resolution": "later",
        })
        self.assertEqual(unknown.status_code, 422)
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
