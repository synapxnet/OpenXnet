#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""会话恢复防重复执行测试 / Conversation recovery duplicate-execution regression.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
"""
from __future__ import annotations

import ast
import asyncio
from contextlib import asynccontextmanager
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict
import unittest
from unittest.mock import AsyncMock

import httpx
from fastapi import Request
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse, StreamingResponse
from py.chat_engine_api import ChatEngineDependencies, register_chat_engine_api
from py.conversation_recovery import ConversationExecutionRegistry, request_conversation_id, run_registered_chat
from py.execution_engine_profile import create_execution_engine_application

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"


@asynccontextmanager
async def empty_lifespan(_application):
    """测试不初始化服务或模型。 / Tests do not initialize services or models."""
    yield


class ConversationRecoveryTests(unittest.IsolatedAsyncioTestCase):
    """通过实际生命周期包装器验证互斥和认证。 / Verify exclusion and authentication through actual lifecycle wrappers."""

    def setUp(self):
        """每次测试创建隔离的登记和请求。 / Create isolated registrations and requests for each test."""
        self.registry = ConversationExecutionRegistry()
        self.request = SimpleNamespace(conversationId="conversation-a", conversation_id=None)

    async def test_duplicate_is_rejected_during_preparation_and_streaming(self):
        """模型准备和正文流整个生命周期只允许一次调用。 / Permit one invocation across model preparation and the complete response stream."""
        prepared, proceed = asyncio.Event(), asyncio.Event()
        calls = []

        async def handler():
            """模拟模型准备并返回惰性响应。 / Simulate model preparation and return a lazy response."""
            calls.append("model")
            prepared.set()
            await proceed.wait()

            async def body():
                """模拟公开增量，不调用工具。 / Simulate public deltas without invoking tools."""
                yield "data: first\n\n"
                yield "data: second\n\n"

            return StreamingResponse(body())

        first = asyncio.create_task(run_registered_chat(self.registry, self.request, handler))
        await prepared.wait()
        duplicate = await run_registered_chat(self.registry, SimpleNamespace(conversationId="conversation-a"), handler)
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(json.loads(duplicate.body)["error"]["code"], "conversation_already_running")
        proceed.set()
        response = await first
        self.assertEqual(self.registry.status("conversation-a")["state"], "running")
        self.assertEqual(await response.body_iterator.__anext__(), "data: first\n\n")
        self.assertEqual((await run_registered_chat(self.registry, self.request, handler)).status_code, 409)
        self.assertEqual([chunk async for chunk in response.body_iterator], ["data: second\n\n"])
        self.assertEqual(self.registry.status("conversation-a")["state"], "idle")
        self.assertEqual(calls, ["model"])

    async def test_abort_stays_running_until_original_generator_closes(self):
        """终止申请不能冒充结束，关闭原生成器后才释放。 / Abort requests cannot masquerade as termination and release follows generator closure."""
        closed = []

        async def body():
            """保留可观察的生成器清理。 / Retain observable generator cleanup."""
            try:
                yield "first"
                yield "second"
            finally:
                closed.append(True)

        response = await run_registered_chat(self.registry, self.request, AsyncMock(return_value=StreamingResponse(body())))
        self.assertEqual(await response.body_iterator.__anext__(), "first")
        self.assertTrue(self.registry.abort("conversation-a"))
        self.assertEqual(self.registry.status("conversation-a")["state"], "running")
        self.assertTrue(self.registry.status("conversation-a")["abortRequested"])
        self.assertEqual([chunk async for chunk in response.body_iterator], [])
        self.assertEqual(closed, [True])
        self.assertEqual(self.registry.status("conversation-a")["state"], "idle")

    async def test_error_and_cancellation_cleanup_without_replay(self):
        """启动异常、流异常和取消均释放且不重试模型。 / Startup errors, stream errors, and cancellation release without retrying the model."""
        broken = AsyncMock(side_effect=RuntimeError("model failed"))
        with self.assertRaises(RuntimeError):
            await run_registered_chat(self.registry, self.request, broken)
        self.assertEqual(broken.await_count, 1)
        self.assertEqual(self.registry.status("conversation-a")["state"], "idle")

        async def error_body():
            """模拟已开始响应后的失败。 / Simulate failure after response streaming starts."""
            yield "partial"
            raise RuntimeError("stream failed")

        response = await run_registered_chat(self.registry, self.request, AsyncMock(return_value=StreamingResponse(error_body())))
        with self.assertRaises(RuntimeError):
            _ = [chunk async for chunk in response.body_iterator]
        self.assertEqual(self.registry.status("conversation-a")["state"], "idle")
        waiting = asyncio.Event()

        async def wait_body():
            """模拟可取消的等待，不连接真实模型。 / Simulate cancellable waiting without a real model connection."""
            yield "partial"
            waiting.set()
            await asyncio.Event().wait()

        response = await run_registered_chat(self.registry, self.request, AsyncMock(return_value=StreamingResponse(wait_body())))
        await response.body_iterator.__anext__()
        pending = asyncio.create_task(response.body_iterator.__anext__())
        await waiting.wait()
        pending.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await pending
        self.assertEqual(self.registry.status("conversation-a")["state"], "idle")

    async def test_stale_cleanup_cannot_remove_new_owner(self):
        """旧响应finally和后台清理不能删除新登记。 / Old response finalizers and background cleanup cannot remove a new registration."""
        background_called = []

        async def body():
            """返回一个有限响应。 / Return one finite response."""
            yield "done"

        async def background():
            """记录既有后台清理已保留。 / Record preservation of existing background cleanup."""
            background_called.append(True)

        response = await run_registered_chat(self.registry, self.request, AsyncMock(return_value=StreamingResponse(body(), background=BackgroundTask(background))))
        old = self.request._stream_registration
        _ = [chunk async for chunk in response.body_iterator]
        new = self.registry.reserve("conversation-a")
        self.assertIsNotNone(new)
        self.assertFalse(self.registry.release(old))
        await response.background()
        self.assertEqual(background_called, [True])
        self.assertEqual(self.registry.status("conversation-a")["state"], "running")
        self.assertTrue(self.registry.release(new))

    async def test_identity_validation_and_parallel_conversations(self):
        """无效或冲突身份被拒绝，不同会话互不阻塞。 / Reject invalid or conflicting identities and keep different conversations independent."""
        handler = AsyncMock(return_value=JSONResponse({"done": True}))
        for identity in [" x ", "a\n", "x" * 513]:
            response = await run_registered_chat(self.registry, SimpleNamespace(conversationId=identity), handler)
            self.assertEqual(response.status_code, 422)
        conflict = await run_registered_chat(self.registry, SimpleNamespace(conversationId="a", conversation_id="b"), handler)
        self.assertEqual(conflict.status_code, 422)
        handler.assert_not_awaited()
        active = self.registry.reserve("conversation-a")
        response = await run_registered_chat(self.registry, SimpleNamespace(conversationId="conversation-b"), handler)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.registry.status("conversation-a")["state"], "running")
        self.registry.release(active)

    async def test_authenticated_status_exact_query_and_manual_identity(self):
        """真实私有路由要求Bearer、精确GET和有限身份。 / Actual private routes require bearer authentication, exact GET queries, and bounded identities."""
        application = create_execution_engine_application(lifespan=empty_lifespan, token="test-only-token")

        async def status(identity):
            """调用真实只读登记。 / Read the actual registry."""
            return self.registry.status(identity)

        manual = AsyncMock(return_value={"success": True})
        register_chat_engine_api(application, ChatEngineDependencies(run_chat=AsyncMock(), run_simple_chat=AsyncMock(), list_models=AsyncMock(), abort_chat=self.registry.abort, execute_tool=manual, resolve_approval=AsyncMock(), recovery_status=status))
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:45678") as client:
            path = "/v1/chat/recovery-status?conversation_id=conversation-a"
            self.assertEqual((await client.get(path)).status_code, 401)
            headers = {"Authorization": "Bearer test-only-token"}
            active = self.registry.reserve("conversation-a")
            response = await client.get(path, headers=headers)
            self.assertEqual(response.json()["state"], "running")
            self.assertEqual(set(response.json()), {"conversationId", "state", "registeredAt", "abortRequested"})
            self.assertEqual((await client.post(path, headers=headers)).status_code, 405)
            self.assertEqual((await client.get(path + "&conversation_id=other", headers=headers)).status_code, 404)
            self.assertEqual((await client.get(path + "&extra=1", headers=headers)).status_code, 404)
            self.registry.release(active)
            self.assertEqual((await client.get(path, headers=headers)).json()["state"], "idle")
            long_identity = "c" * 512
            long_registration = self.registry.reserve(long_identity)
            cancelled = await client.post("/v1/chat/abort", headers=headers, json={"conversationId": long_identity})
            self.assertEqual(cancelled.status_code, 200)
            self.assertTrue(cancelled.json()["aborted"])
            self.assertEqual(self.registry.status(long_identity)["state"], "running")
            self.registry.release(long_registration)
            response = await client.post("/execute_tool_manually", headers=headers, json={"tool_name": "update_automation_task", "conversationId": "conversation-a", "tool_params": {"task_id": "existing", "action": "pause"}})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(manual.call_args.args[0]["conversationId"], "conversation-a")

    async def test_server_entrypoints_use_actual_registration_wrapper(self):
        """实际服务器入口共享保护，不能仅测试孤立模型。 / Actual server entrypoints share the guard rather than only testing an isolated model."""
        source = Path(__file__).resolve().parents[1] / "server.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        nodes = [node for node in tree.body if getattr(node, "name", "") in {"chat_endpoint", "simple_chat_endpoint", "chat_recovery_status"}]
        for node in nodes:
            node.decorator_list = []
        namespace = {"ChatRequest": Any, "Request": Request, "JSONResponse": JSONResponse, "run_registered_chat": run_registered_chat, "_conversation_executions": self.registry, "_chat_endpoint_impl": AsyncMock(return_value=JSONResponse({"done": True})), "_simple_chat_endpoint_impl": AsyncMock(return_value=JSONResponse({"done": True}))}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), namespace)
        registration = self.registry.reserve("conversation-a")
        response = await namespace["chat_endpoint"](self.request, None)
        self.assertEqual(response.status_code, 409)
        namespace["_chat_endpoint_impl"].assert_not_awaited()
        response = await namespace["simple_chat_endpoint"](self.request)
        self.assertEqual(response.status_code, 409)
        response = await namespace["chat_recovery_status"]("conversation-a")
        self.assertEqual(json.loads(response.body)["state"], "running")
        self.registry.release(registration)


if __name__ == "__main__":
    unittest.main()
