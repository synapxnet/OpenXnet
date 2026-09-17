#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""实时引导路由、隔离与真实消费点回归 / Live-guidance routes, isolation, and actual consumption regression.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
"""
from __future__ import annotations

import ast
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from py.execution_engine_profile import create_execution_engine_application
from py.kernel import guidance as guidance_module
from py.kernel.guidance import GuidanceError, LiveGuidanceBus
from py.kernel_engine_api import KernelEngineApi
from py.routes import kernel as kernel_routes

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"
ROOT = Path(__file__).resolve().parents[1]


def add(bus: LiveGuidanceBus, scope: str = "chat-a", request: str = "request-a", **options):
    """创建隔离测试引导，不调用模型。 / Create isolated fixture guidance without invoking models."""
    return bus.add(conversation_id=scope, request_id=request, runtime_id=bus.runtime_id, text=options.pop("text", "Keep the answer concise"), **options)


def mutation(bus: LiveGuidanceBus, item, action: str = "edit", **options):
    """构造准确作用域与修订的编辑或撤回。 / Construct an edit or cancellation with exact scope and revision."""
    return bus.mutate(conversation_id=options.pop("conversation_id", item.conversation_id), guidance_id=item.guidance_id,
        runtime_id=bus.runtime_id, request_id=options.pop("request_id", "mutation-a"), expected_revision=options.pop("expected_revision", item.revision),
        action=action, **options)


def load_functions(relative: str, names: set[str], namespace: dict, class_name: str = "") -> dict:
    """加载真实消费函数而不启动服务器或模型。 / Load actual consumption functions without starting the server or models."""
    tree = ast.parse((ROOT / relative).read_text(encoding="utf-8-sig"))
    body = next(node.body for node in tree.body if isinstance(node, ast.ClassDef) and node.name == class_name) if class_name else tree.body
    selected = [node for node in body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
    if len(selected) != len(names):
        raise AssertionError("Actual consumption entrypoint was not found")
    module = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *selected], type_ignores=[])
    exec(compile(ast.fix_missing_locations(module), str(ROOT / relative), "exec"), namespace)
    return namespace


class LiveGuidanceBusTests(unittest.TestCase):
    """验证真实队列的作用域、原子操作与保留边界。 / Verify actual queue scoping, atomic operations, and retention boundaries."""

    def test_exact_scope_turn_and_trace_never_consume_global_or_other_conversations(self):
        """默认/其他会话和错误turn/trace不得取走引导。 / Default, other-conversation, and mismatched turn/trace consumers cannot receive guidance."""
        bus = LiveGuidanceBus()
        item = add(bus, turn_id="turn-a", trace_id="tool-a")
        add(bus, "chat-b", "request-a", text="Other conversation")
        self.assertEqual(bus.pending(), [])
        self.assertEqual(bus.consume(), [])
        self.assertEqual(bus.consume(conversation_id="chat-a"), [])
        self.assertEqual(bus.consume(conversation_id="chat-a", turn_id="wrong", trace_id="tool-a"), [])
        taken = bus.consume(conversation_id="chat-a", turn_id="turn-a", trace_id="tool-a", stage="before_tool")
        self.assertEqual([row.guidance_id for row in taken], [item.guidance_id])
        self.assertEqual(taken[0].consumed_stage, "before_tool")
        self.assertEqual(taken[0].state, "consumed")
        self.assertEqual(len(bus.pending("chat-b")), 1)
        for scope in ["", "__default__", " chat-a", "chat-a\x00", "x" * 513]:
            with self.assertRaises(GuidanceError):
                add(bus, scope, "invalid")

    def test_idempotent_add_edit_cancel_and_conflicting_retries(self):
        """同操作重试不重复入队，不同内容同键明确冲突。 / Identical retries never requeue and changed content with the same key conflicts."""
        bus = LiveGuidanceBus()
        item = add(bus)
        self.assertEqual(add(bus).guidance_id, item.guidance_id)
        with self.assertRaises(GuidanceError) as conflict:
            add(bus, text="Different content")
        self.assertEqual(conflict.exception.code, "guidance_idempotency_conflict")
        edited = mutation(bus, item, text="Use Chinese", mode="constraint")
        self.assertEqual(edited.revision, 2)
        self.assertEqual(mutation(bus, item, text="Use Chinese", mode="constraint").revision, 2)
        with self.assertRaises(GuidanceError) as stale:
            mutation(bus, item, request_id="stale-edit", text="Lost update")
        self.assertEqual(stale.exception.code, "guidance_revision_conflict")
        self.assertEqual(stale.exception.guidance["text"], "Use Chinese")
        canceled = mutation(bus, edited, "cancel", request_id="cancel-a")
        self.assertEqual(canceled.state, "canceled")
        self.assertEqual(mutation(bus, edited, "cancel", request_id="cancel-a").revision, canceled.revision)
        self.assertEqual(bus.consume(conversation_id="chat-a"), [])
        self.assertEqual(add(bus).state, "canceled")
        with self.assertRaises(GuidanceError) as other:
            mutation(bus, item, conversation_id="chat-b", request_id="other", text="Do not change A")
        self.assertEqual(other.exception.status_code, 404)
        self.assertIsNone(other.exception.guidance)

    def test_actual_consumer_and_edit_race_preserve_one_revision(self):
        """并发修改/接收只出现合法先后顺序，不假报修改。 / Concurrent edits and consumption admit only valid orderings without false edit success."""
        for iteration in range(20):
            bus = LiveGuidanceBus()
            item = add(bus)
            with ThreadPoolExecutor(max_workers=2) as pool:
                consume = pool.submit(bus.consume, conversation_id="chat-a")
                edit = pool.submit(mutation, bus, item, text="Edited guidance")
                taken = consume.result()
                try:
                    edited = edit.result()
                    self.assertEqual(taken[0].text, edited.text)
                    self.assertEqual(taken[0].revision, edited.revision + 1)
                except GuidanceError as error:
                    self.assertEqual(error.code, "guidance_conflict")
                    self.assertEqual(error.guidance["state"], "consumed")
                    self.assertEqual(taken[0].text, item.text)
            self.assertEqual(len(taken), 1, iteration)
            self.assertEqual(bus.consume(conversation_id="chat-a"), [])
            with self.assertRaises(GuidanceError):
                mutation(bus, item, "cancel", request_id="late-cancel")

    def test_capacity_never_discards_pending_and_restart_is_explicit(self):
        """队列满时保留未接收正文，重启身份不能自动重放。 / Preserve pending text at capacity and reject automatic replay after runtime changes."""
        bus = LiveGuidanceBus(capacity=2)
        first = add(bus)
        add(bus, "chat-b", "b")
        with self.assertRaises(GuidanceError) as full:
            add(bus, request="c")
        self.assertEqual(full.exception.status_code, 429)
        self.assertEqual(bus.pending("chat-a")[0]["guidance_id"], first.guidance_id)
        bus.consume(conversation_id="chat-b")
        add(bus, "chat-c", "c")
        self.assertEqual(len(bus.pending("chat-a")), 1)
        self.assertTrue(bus.snapshot("chat-a")["status"]["history_truncated"])
        restarted = LiveGuidanceBus()
        self.assertTrue(restarted.snapshot("chat-a", bus.runtime_id)["restarted"])
        with self.assertRaises(GuidanceError) as changed:
            restarted.add(conversation_id="chat-a", request_id="a", runtime_id=bus.runtime_id, text="Never replay automatically")
        self.assertEqual(changed.exception.code, "guidance_runtime_changed")
        bus.set_support("chat-a", False, "Dify")
        with self.assertRaises(GuidanceError) as unsupported:
            add(bus, request="unsupported")
        self.assertEqual(unsupported.exception.code, "guidance_unsupported")
        self.assertEqual(bus.snapshot("chat-a")["capability"]["supported"], False)


class LiveGuidanceRouteTests(unittest.IsolatedAsyncioTestCase):
    """验证实际公共路由、认证dispatcher与消费接点。 / Verify actual public routes, authenticated dispatcher, and consumption entrypoints."""

    def setUp(self):
        """隔离进程队列及审计写入，使用真实 ASGI 路由。 / Isolate the queue and audit writes while using actual ASGI routes."""
        self.bus = LiveGuidanceBus()
        self.addCleanup(patch.stopall)
        patch.object(guidance_module, "_bus", self.bus).start()
        patch.object(kernel_routes, "_load_settings", AsyncMock(return_value={})).start()
        patch.object(kernel_routes, "get_kernel_audit", return_value=MagicMock()).start()
        app = FastAPI()
        app.include_router(kernel_routes.router)
        self.client = TestClient(app)

    def payload(self, **values):
        """构造真实公共接口的隔离提交。 / Construct an isolated submission to the actual public API."""
        return {"conversationId": "chat-a", "runtimeId": self.bus.runtime_id, "requestId": "add-a", "text": "Use documented APIs", **values}

    async def test_real_router_edit_cancel_conflicts_and_scoped_history(self):
        """公共路由保留真实HTTP冲突和同会话当前记录。 / Public routes preserve real HTTP conflicts and current same-scope records."""
        response = self.client.post("/v1/kernel/guidance", json=self.payload())
        self.assertEqual(response.status_code, 200)
        item = response.json()["guidance"]
        edit = {"conversationId": "chat-a", "runtimeId": self.bus.runtime_id, "requestId": "edit-a", "guidanceId": item["guidance_id"], "expectedRevision": 1, "text": "Keep tool use read-only"}
        edited = self.client.post("/v1/kernel/guidance/edit", json=edit)
        self.assertEqual(edited.json()["guidance"]["revision"], 2)
        taken = self.bus.consume(conversation_id="chat-a", stage="before_llm")
        self.assertEqual(taken[0].text, edit["text"])
        cancel = {key: value for key, value in edit.items() if key != "text"}
        cancel.update(requestId="cancel-a", expectedRevision=2)
        conflict = self.client.post("/v1/kernel/guidance/cancel", json=cancel)
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["detail"]["guidance"]["state"], "consumed")
        other = self.client.post("/v1/kernel/guidance/cancel", json={**cancel, "conversationId": "chat-b"})
        self.assertEqual(other.status_code, 404)
        self.assertNotIn("guidance", other.json()["detail"])
        snapshot = self.client.get("/v1/kernel/guidance", params={"conversation_id": "chat-a", "runtime_id": "old-runtime"}).json()
        self.assertTrue(snapshot["restarted"])
        self.assertEqual(snapshot["pending"], [])
        self.assertEqual(snapshot["recent"][0]["consumed_stage"], "before_llm")
        for payload in [self.payload(conversationId=""), self.payload(conversation_id="different"), self.payload(text=" "), self.payload(priority=True)]:
            self.assertEqual(self.client.post("/v1/kernel/guidance", json=payload).status_code, 422)
        self.assertEqual(self.client.get("/v1/kernel/guidance").status_code, 422)

    async def test_authenticated_dispatcher_preserves_conflicts_without_unknown_routes(self):
        """认证固定命令在成功传输中保留领域冲突，禁止原始路由越界。 / Authenticated fixed commands retain domain conflicts within successful transport and reject raw route escape."""
        @asynccontextmanager
        async def lifespan(_app):
            """提供无副作用的测试生命周期。 / Provide a side-effect-free test lifespan."""
            yield
        app = create_execution_engine_application(lifespan=lifespan, token="fixture-token")
        app.include_router(KernelEngineApi().create_router())
        client = TestClient(app, base_url="http://127.0.0.1:5111")
        route = "/v1/desktop/kernel/command"
        headers = {"Authorization": "Bearer fixture-token"}
        self.assertEqual(client.post(route, json={"operation": "guidance-list", "payload": {"conversationId": "chat-a"}}).status_code, 401)
        payload = self.payload(turnId="", traceId="", mode="soft", priority=0)
        response = client.post(route, headers=headers, json={"operation": "guidance-add", "payload": payload})
        self.assertEqual(response.status_code, 200)
        item = response.json()["data"]["guidance"]
        self.bus.consume(conversation_id="chat-a")
        cancel = {"conversationId": "chat-a", "runtimeId": self.bus.runtime_id, "requestId": "cancel-one", "guidanceId": item["guidance_id"], "expectedRevision": 1}
        conflict = client.post(route, headers=headers, json={"operation": "guidance-cancel", "payload": cancel}).json()
        self.assertTrue(conflict["success"])
        self.assertFalse(conflict["data"]["ok"])
        self.assertEqual(conflict["data"]["error"]["code"], "guidance_conflict")
        self.assertEqual(conflict["data"]["guidance"]["state"], "consumed")
        self.assertEqual(client.post("/v1/kernel/guidance", headers=headers, json=payload).status_code, 404)

    async def test_actual_server_and_query_engine_checkpoints_only_receive_their_conversation(self):
        """真实消费函数不接收其他会话，不调用abort，也不假称采纳。 / Actual consumers receive only their conversation, never call abort, and never claim adoption."""
        request = SimpleNamespace(conversationId="server-chat", conversation_id="", messages=[])
        add(self.bus, "server-chat", "a", text="Server correction")
        add(self.bus, "engine-chat", "b", text="Engine correction")
        namespace = load_functions("server.py", {"_request_conversation_id", "_consume_kernel_live_guidance", "_set_kernel_live_guidance_support"}, {
            "logger": MagicMock(), "content_append": lambda messages, role, content: messages.append({"role": role, "content": content})})
        namespace["_consume_kernel_live_guidance"](request, "stream_before_llm")
        self.assertIn("Server correction", request.messages[0]["content"])
        self.assertNotIn("Engine correction", request.messages[0]["content"])
        namespace["_set_kernel_live_guidance_support"](request, "Dify")
        self.assertFalse(self.bus.snapshot("server-chat")["capability"]["supported"])
        engine = SimpleNamespace(conversation_id="engine-chat", turn_id="turn-one", _pending_live_guidance=[], messages=[], abort_event=asyncio.Event(), _flush_checkpoint_snapshot=lambda: None)
        engine_functions = load_functions("py/engine/query_engine.py", {"_consume_live_guidance", "_flush_live_guidance_context"}, {"logger": MagicMock()}, "QueryEngine")
        received = await engine_functions["_consume_live_guidance"](engine, "before_llm")
        self.assertEqual(len(received), 1)
        engine_functions["_flush_live_guidance_context"](engine)
        self.assertIn("Engine correction", engine.messages[0]["content"])
        self.assertFalse(engine.abort_event.is_set())
        self.assertEqual(self.bus.snapshot("engine-chat")["recent"][0]["consumed_stage"], "before_llm")
        self.assertEqual(engine._pending_live_guidance, [])


if __name__ == "__main__":
    unittest.main()
