#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""
记忆注入和任务引用回执回归 / Memory injection and task reference regressions.
Author: maoyo
Department: 研发部
Date: 2026-09-14
Version: 1.0.0
Security Level: INTERNAL
"""
__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import ast
import asyncio
import hashlib
import logging
from pathlib import Path
import types
from typing import Any, Dict, List, Mapping, Optional
import unittest
from unittest.mock import AsyncMock, Mock, patch
import uuid

ROOT = Path(__file__).resolve().parents[1]


def load_functions(relative_path, names):
    """隔离真实函数，避免启动服务；isolate real functions without importing or starting the server."""
    tree = ast.parse((ROOT / relative_path).read_text(encoding="utf-8"))
    selected = [node for node in tree.body if getattr(node, "name", None) in names]
    namespace = dict(Any=Any, Dict=Dict, List=List, Mapping=Mapping, Optional=Optional,
                     asyncio=asyncio, hashlib=hashlib, uuid=uuid, RUNTIME_PROFILE="desktop",
                     logger=logging.getLogger("isolated-memory-receipt-tests"))
    exec(compile(ast.Module(body=selected, type_ignores=[]), relative_path, "exec"), namespace)
    return namespace


class ChatMemoryReceiptTests(unittest.IsolatedAsyncioTestCase):
    """验证真实注入和失败边界；verify actual injection and failure boundaries."""

    def setUp(self):
        """加载注入逻辑并创建隔离客户端；load injection logic with an isolated client."""
        self.functions = load_functions("server.py", {
            "_synapxnet_v3_chat_options", "_synapxnet_v3_session_id", "_inject_synapxnet_v3_chat_memory",
        })
        self.client = types.SimpleNamespace(configured=True, recall_v3=Mock(return_value={"items": []}))
        self.worker_module = types.ModuleType("py.memory_worker_client")
        self.worker_module.MemoryWorkerClient = types.SimpleNamespace(from_environment=lambda: self.client)
        self.request = types.SimpleNamespace(messages=[{"role": "user", "content": "question"}],
                                             conversationId="conversation-a", is_sub_agent=False)
        self.settings = {"mainAgent": "owner-agent", "memorySettings": {"synapxnetV3Enabled": True}}

    async def inject(self, receipts):
        """仅调用假客户端，不访问模型；use only a fake client without accessing a model."""
        with patch.dict("sys.modules", {"py.memory_worker_client": self.worker_module}):
            return await self.functions["_inject_synapxnet_v3_chat_memory"](self.request, self.settings, "question", receipts)

    async def test_injected_receipt_matches_context_and_does_not_expose_text(self):
        """回执摘要对应实际上下文且不泄漏正文；receipt hashes match actual context without exposing its text."""
        content = "Private authorized deployment fact."
        self.client.recall_v3.return_value = {"items": [{"memoryId": "memory-a", "version": 2, "title": "Release", "ownerAgent": "owner-agent", "taskId": "conversation-a", "recordSha256": "a" * 64, "content": content}]}
        receipts = []
        self.assertEqual(await self.inject(receipts), 1)
        receipt = receipts[0]
        context = self.request.messages[0]["content"]
        self.assertIn(content, context)
        self.assertEqual(receipt["characters"], len(context))
        self.assertEqual(receipt["status"], "injected")
        self.assertEqual(receipt["conversationId"], "conversation-a")
        self.assertEqual(receipt["items"][0]["injectedContentSha256"], hashlib.sha256(content.encode()).hexdigest())
        self.assertNotIn(content, str(receipt))
        self.assertEqual(self.client.recall_v3.call_args.kwargs["requester_agent"], "owner-agent")
        self.assertEqual(self.client.recall_v3.call_args.kwargs["task_id"], "conversation-a")

    async def test_disabled_subagent_and_empty_recall_never_claim_injection(self):
        """未调用和无命中均不宣称已使用；skipped and empty recalls never claim injection."""
        self.settings["memorySettings"]["synapxnetV3Enabled"] = False
        receipts = []
        self.assertEqual(await self.inject(receipts), 0)
        self.assertEqual(receipts[0]["reason"], "disabled")
        self.client.recall_v3.assert_not_called()
        self.settings["memorySettings"]["synapxnetV3Enabled"] = True
        self.request.is_sub_agent = True
        receipts = []
        self.assertEqual(await self.inject(receipts), 0)
        self.assertEqual(receipts[0]["reason"], "sub_agent")
        self.client.recall_v3.assert_not_called()
        self.request.is_sub_agent = False
        receipts = []
        self.assertEqual(await self.inject(receipts), 0)
        self.assertEqual(receipts[0]["status"], "not_used")
        self.assertEqual(receipts[0]["reason"], "no_match")
        self.assertEqual(len(self.request.messages), 1)

    async def test_worker_failure_keeps_private_exception_out_of_receipt(self):
        """失败和未配置有真实状态且不转发私密异常；report failures without forwarding private exception details."""
        self.client.configured = False
        receipts = []
        self.assertEqual(await self.inject(receipts), 0)
        self.assertEqual(receipts[0]["status"], "unavailable")
        self.client.configured = True
        self.client.recall_v3.side_effect = RuntimeError("private secret diagnostic")
        receipts = []
        self.assertEqual(await self.inject(receipts), 0)
        self.assertEqual(receipts[0]["status"], "error")
        self.assertNotIn("private secret", str(receipts))
        self.assertEqual(len(self.request.messages), 1)


class TaskReferenceTests(unittest.TestCase):
    """任务引用来自任务对象；task references originate from task records."""

    def test_compatible_text_carries_actual_task_status_without_guessing_agent_identity(self):
        """兼容文本附带任务ID且不伪造Agent身份；compatible text carries task IDs without inventing agent identity."""
        receipt_class = load_functions("py/task_tools.py", {"TaskToolReceipt"})["TaskToolReceipt"]
        task = types.SimpleNamespace(task_id="real-task", parent_task_id="parent-task", agent_type="research", status=types.SimpleNamespace(value="pending"), title="Research")
        result = receipt_class("Planned task", task)
        self.assertIsInstance(result, str)
        self.assertEqual(str(result), "Planned task")
        self.assertEqual(result.task_ref["taskId"], "real-task")
        self.assertEqual(result.task_ref["status"], "pending")
        self.assertNotIn("agentId", result.task_ref)

    def test_failed_task_creation_keeps_the_kernel_error_contract(self):
        """创建失败使用既有执行器错误契约；failed creation preserves the existing executor error contract."""
        namespace = load_functions("py/task_tools.py", {"create_subtask"})
        namespace["get_task_center"] = AsyncMock(side_effect=RuntimeError("unavailable"))
        result = asyncio.run(namespace["create_subtask"]("title", "description"))
        self.assertTrue(result.startswith("Error calling tool"))
        self.assertFalse(hasattr(result, "task_ref"))


class ManualToolOutcomeTests(unittest.IsolatedAsyncioTestCase):
    """手动执行状态来自执行器；manual execution status comes from the executor."""

    async def test_manual_result_preserves_executor_failure_and_success(self):
        """保留真实成功/失败而不触发工具；preserve actual success/failure without running a tool."""
        namespace = load_functions("server.py", {"_execute_tool_manually_payload", "_chat_tool_outcome_result"})
        namespace["load_settings"] = AsyncMock(return_value={"CLISettings": {}})
        hook = AsyncMock()
        registry = types.ModuleType("py.execution_tool_registry")
        registry.build_execution_tool_registry = lambda _hooks: types.SimpleNamespace(hooks={"fixture_tool": hook})
        for name in ("openxnet_parse_config_intent", "openxnet_apply_config_intent", "get_image_content"):
            namespace[name] = hook
        executor = types.SimpleNamespace(execute_tool=AsyncMock())
        executor_module = types.ModuleType("py.kernel.executor")
        executor_module.get_kernel_executor = lambda: executor
        with patch.dict("sys.modules", {"py.execution_tool_registry": registry, "py.kernel.executor": executor_module}):
            for ok, status, expected in [(True, "completed", True), (False, "error", False), (True, "approval_required", False)]:
                executor.execute_tool.return_value = {"ok": ok, "status": status, "result": "actual receipt"}
                result = await namespace["_execute_tool_manually_payload"]({"tool_name": "fixture_tool", "tool_params": {}, "approval_type": "once"})
                self.assertEqual(result["success"], expected)
                self.assertEqual(result["status"], status)
                self.assertEqual(result["result"], "actual receipt")
                self.assertTrue(executor.execute_tool.call_args.kwargs["return_trace"])
        hook.assert_not_called()

    def test_chat_outcome_keeps_error_detail_without_exposing_trace(self):
        """异常详情不会丢失或带出内部轨迹；preserve exception details without exposing internal traces."""
        normalize = load_functions("server.py", {"_chat_tool_outcome_result"})["_chat_tool_outcome_result"]
        trace = {"private_memory": "hidden memory body", "parameters": "private tool input"}
        for empty_result in ("", None):
            outcome = {"ok": False, "status": "error", "result": empty_result,
                       "error": "Device bridge disconnected", "trace": trace}
            self.assertEqual(normalize(outcome), "Device bridge disconnected")
            self.assertEqual(outcome["result"], empty_result)
        self.assertEqual(normalize({"status": "error", "result": "Existing diagnostic", "error": "Fallback"}), "Existing diagnostic")
        for status in ("completed", "pending", "approval_required"):
            self.assertEqual(normalize({"status": status, "result": "", "error": "Unrelated diagnostic", "trace": trace}), "")
        structured = {"rows": [1, 2]}
        self.assertIs(normalize({"status": "completed", "result": structured}), structured)

    async def test_manual_exception_returns_diagnostic_but_not_internal_trace(self):
        """手动工具异常向界面返回详情且不返回内部轨迹；manual tool errors expose their diagnostic without internal traces."""
        namespace = load_functions("server.py", {"_execute_tool_manually_payload", "_chat_tool_outcome_result"})
        namespace["load_settings"] = AsyncMock(return_value={"CLISettings": {}})
        hook = AsyncMock()
        registry = types.ModuleType("py.execution_tool_registry")
        registry.build_execution_tool_registry = lambda _hooks: types.SimpleNamespace(hooks={"fixture_tool": hook})
        for name in ("openxnet_parse_config_intent", "openxnet_apply_config_intent", "get_image_content"):
            namespace[name] = hook
        executor = types.SimpleNamespace(execute_tool=AsyncMock(return_value={
            "ok": False, "status": "error", "result": "", "error": "Device bridge disconnected",
            "trace": {"private_memory": "hidden memory body", "parameters": "private tool input"},
        }))
        executor_module = types.ModuleType("py.kernel.executor")
        executor_module.get_kernel_executor = lambda: executor
        with patch.dict("sys.modules", {"py.execution_tool_registry": registry, "py.kernel.executor": executor_module}):
            result = await namespace["_execute_tool_manually_payload"]({"tool_name": "fixture_tool", "tool_params": {}, "approval_type": "once"})
        self.assertEqual(result, {"success": False, "status": "error", "result": "Device bridge disconnected"})
        hook.assert_not_called()

    async def test_chat_dispatch_requests_outcome_only_when_requested(self):
        """聊天按需读取执行器状态且保持旧调用兼容；chat requests outcomes explicitly while legacy callers stay compatible."""
        namespace = load_functions("server.py", {"dispatch_tool"})
        namespace["_dispatch_tool_legacy"] = AsyncMock()
        executor = types.SimpleNamespace(execute_tool=AsyncMock(return_value={"status": "error", "result": "failed"}))
        executor_module = types.ModuleType("py.kernel.executor")
        executor_module.get_kernel_executor = lambda: executor
        with patch.dict("sys.modules", {"py.kernel.executor": executor_module}):
            result = await namespace["dispatch_tool"]("fixture_tool", {}, {}, include_outcome=True)
            self.assertEqual(result["status"], "error")
            self.assertTrue(executor.execute_tool.call_args.kwargs["return_trace"])
            await namespace["dispatch_tool"]("fixture_tool", {}, {})
            self.assertFalse(executor.execute_tool.call_args.kwargs["return_trace"])
        namespace["_dispatch_tool_legacy"].assert_not_called()


if __name__ == "__main__":
    unittest.main()
