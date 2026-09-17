#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""会话自动任务回归 / Conversation automation regression.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
"""
from __future__ import annotations

from datetime import datetime, timedelta
import ast
from pathlib import Path
import types
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, PrivateAttr
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import StreamingResponse

from py.conversation_automation import append_automation_run, build_automation
from py.task_center import TaskCenter, TaskStatus
from py.task_delivery_policy import collect_terminal_delivery_decisions
from py.task_schedule_policy import collect_due_task_executions, project_missing_recurring_runs
from py.task_scheduler import TaskSchedulerRuntime
from py.task_tools import dispatch_bound_task_tool, TaskToolReceipt
from py.conversation_file_receipts import file_changes_of
from py.task_execution_events import build_task_execution_checkpoint
from py.task_execution_broker_api import TaskExecutionBrokerApi, TaskExecutionBrokerDependencies, TaskExecutionSessionTurnRequest
from py.task_execution_session import TASK_EXECUTION_TURN_SCHEMA

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"


class ConversationAutomationTests(unittest.IsolatedAsyncioTestCase):
    """以真实临时任务中心验证会话隔离和运行策略。 / Verify ownership and runtime policy through an actual temporary Task Center."""

    async def asyncSetUp(self):
        """隔离持久化目录，不启动真实模型。 / Isolate persisted files without starting a real model."""
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.center = TaskCenter(self.directory.name)
        self.settings = {"CLISettings": {"cc_path": self.directory.name}}
        self.scope = {"origin_conversation_id": "conversation-a"}
        center_patch = patch("py.task_tools.get_task_center", AsyncMock(return_value=self.center))
        worker_patch = patch("py.task_tools.get_task_executor_worker_client", return_value=SimpleNamespace(configured=False))
        center_patch.start()
        worker_patch.start()
        self.addCleanup(center_patch.stop)
        self.addCleanup(worker_patch.stop)

    async def create_monitor(self):
        """通过真实工具创建未来检查。 / Create a future check through the actual tool."""
        receipt = await dispatch_bound_task_tool("create_subtask", {
            "title": "下载检查", "description": "检查下载是否结束并验证文件",
            "automation_enabled": True, "schedule_type": "recurring", "schedule_expression": "every 1 hour",
            "start_immediately": False, "completion_condition": "文件下载完整且校验通过",
            "delivery_targets": ["task_center", "desktop_notification"],
            "origin_conversation_id": "forged-other-owner",
        }, self.settings, self.scope)
        self.assertIsInstance(receipt, TaskToolReceipt)
        return await self.center.get_task(receipt.task_ref["taskId"])

    async def run_receipt(self, task, session, outcome, evidence=None, key="state-one"):
        """真实激活和声明执行身份后提交结构化回执。 / Activate and claim a real execution identity before recording its structured outcome."""
        await self.center.activate_task(task.task_id, trigger_source="worker_scheduler_due")
        await self.center.claim_execution_session(task.task_id, session, owner_role="task-worker")
        return await dispatch_bound_task_tool("finish_task", {"task_id": task.task_id, "result": outcome, "outcome": outcome, "evidence": evidence or [], "observation_key": key}, self.settings, {**self.scope, "task_id": task.task_id, "session_id": session})

    async def test_creation_binding_and_invalid_schedule(self):
        """模型不能注入所有者，非法计划不能持久化。 / Model parameters cannot inject ownership and invalid schedules are not persisted."""
        task = await self.create_monitor()
        self.assertEqual(task.context["origin_conversation_id"], "conversation-a")
        self.assertEqual(task.status, TaskStatus.PENDING)
        self.assertEqual(task.context["automation"]["state"], "active")
        invalid = await dispatch_bound_task_tool("create_subtask", {"title": "invalid", "description": "invalid", "automation_enabled": True, "schedule_type": "recurring", "schedule_expression": "unsupported"}, self.settings, self.scope)
        self.assertIn("Error calling tool", invalid)
        self.assertEqual(len(await self.center.list_tasks()), 1)
        plain = await dispatch_bound_task_tool("create_subtask", {"title": "plain", "description": "plain", "start_immediately": False}, self.settings, self.scope)
        self.assertEqual(plain.task_ref["originConversationId"], "conversation-a")
        self.assertNotIn("automation", plain.task_ref)

    async def test_pause_resume_complete_prevent_reactivation(self):
        """所有调度路径拒绝暂停和已结束的任务。 / All scheduling paths reject paused and completed automations."""
        task = await self.create_monitor()
        denied = await dispatch_bound_task_tool("update_automation_task", {"task_id": task.task_id, "action": "complete", "origin_conversation_id": "conversation-a"}, self.settings, {"origin_conversation_id": "conversation-b"})
        self.assertIn("does not own", denied)
        for action in ["pause", "resume", "complete"]:
            receipt = await dispatch_bound_task_tool("update_automation_task", {"task_id": task.task_id, "action": action}, self.settings, self.scope)
            self.assertIsInstance(receipt, TaskToolReceipt)
            stored = await self.center.get_task(task.task_id)
            if action == "resume":
                self.assertEqual(stored.context["automation"]["state"], "active")
                self.assertIsNotNone(stored.context["next_run_at"])
                continue
            self.assertIsNone(await self.center.activate_task(task.task_id))
            self.assertIsNone(stored.context["next_run_at"])
            stored.context["next_run_at"] = (datetime.now() - timedelta(hours=1)).isoformat()
            payload = self.center.serialize_task(stored)
            self.assertEqual(collect_due_task_executions([payload], datetime.now()), [])
            self.assertEqual(TaskSchedulerRuntime(AsyncMock())._collect_due_tasks([stored], datetime.now()), [])
            stored.context["next_run_at"] = None
            self.assertEqual(project_missing_recurring_runs([self.center.serialize_task(stored)], datetime.now()), [])
        resurrection = await dispatch_bound_task_tool("update_automation_task", {"task_id": task.task_id, "action": "resume"}, self.settings, self.scope)
        self.assertIn("cannot be reactivated", resurrection)

    async def test_unchanged_quiet_and_verified_completion_stops(self):
        """未变化检查保存记录但不投递，已验证完成永久结束。 / Unchanged checks persist without delivery and verified completion ends scheduling."""
        task = await self.create_monitor()
        first = await self.run_receipt(task, "run_one", "unchanged")
        self.assertIsInstance(first, TaskToolReceipt)
        stored = await self.center.get_task(task.task_id)
        self.assertEqual(stored.context["automation"]["state"], "active")
        self.assertFalse(stored.context["automation"]["runs"][-1]["notify"])
        self.assertEqual(collect_terminal_delivery_decisions([self.center.serialize_task(stored)], datetime.now()), [])
        await self.run_receipt(task, "run_two", "completed", ["download completed; checksum matches"])
        stored = await self.center.get_task(task.task_id)
        self.assertEqual(stored.context["automation"]["state"], "completed")
        self.assertEqual(len(stored.context["automation"]["runs"]), 2)
        self.assertIsNone(await self.center.activate_task(task.task_id))
        self.assertEqual(len(collect_terminal_delivery_decisions([self.center.serialize_task(stored)], datetime.now())), 1)

    async def test_finish_requires_owning_session_and_evidence(self):
        """身份不匹配或缺少证据不能结束自动任务。 / Mismatched identities or missing evidence cannot complete an automation."""
        task = await self.create_monitor()
        await self.center.activate_task(task.task_id)
        await self.center.claim_execution_session(task.task_id, "owning_run", owner_role="task-worker")
        wrong = await dispatch_bound_task_tool("finish_task", {"task_id": task.task_id, "result": "done", "outcome": "completed", "evidence": ["proof"]}, self.settings, {**self.scope, "task_id": "different-task", "session_id": "owning_run"})
        self.assertIn("does not own", wrong)
        missing = await dispatch_bound_task_tool("finish_task", {"task_id": task.task_id, "result": "done", "outcome": "completed"}, self.settings, {**self.scope, "task_id": task.task_id, "session_id": "owning_run"})
        self.assertIn("requires explicit evidence", missing)
        stored = await self.center.get_task(task.task_id)
        self.assertEqual(stored.status, TaskStatus.RUNNING)
        self.assertEqual(stored.context["automation"]["runs"], [])

    def test_history_deduplication_and_bounded_runs(self):
        """真实运行身份去重，重复观察静默，历史有界。 / Deduplicate real run identities, silence repeated observations, and bound history."""
        automation = build_automation("changes_only", "continuous", "")
        for number in range(60):
            automation = append_automation_run(automation, run_id=f"run-{number}", outcome="changed", result="observed", evidence=[], observation_key="same-state", finished_at="2026-09-14T12:00:00")
        self.assertEqual(len(automation["runs"]), 50)
        self.assertEqual(automation["runs"][-1]["outcome"], "unchanged")
        self.assertFalse(automation["runs"][-1]["notify"])
        again = append_automation_run(automation, run_id="run-59", outcome="changed", result="repeat", evidence=[], observation_key="different-state", finished_at="2026-09-14T12:00:00")
        self.assertEqual(again, automation)

    async def test_actual_manual_route_preserves_receipt_and_rejects_foreign_owner(self):
        """真实人工接口保留回执且验证外层会话身份。 / The actual manual route preserves receipts and validates envelope conversation identity."""
        task = await self.create_monitor()
        source = Path(__file__).resolve().parents[1] / "server.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        wanted = {"_execute_tool_manually_payload", "_chat_tool_outcome_result"}
        namespace = {"Any": Any, "Dict": Dict, "load_settings": AsyncMock(return_value=self.settings), "file_changes_of": file_changes_of}
        exec(compile(ast.Module(body=[node for node in tree.body if getattr(node, "name", "") in wanted], type_ignores=[]), str(source), "exec"), namespace)
        calls = []

        async def governed_call(**kwargs):
            """仅隔离授权执行器，仍调用真实任务处理函数。 / Isolate the governance executor while invoking the actual task handler."""
            calls.append(kwargs)
            result = await kwargs["legacy_call"]()
            success = not str(result).startswith("Error calling tool")
            return {"ok": success, "status": "completed" if success else "error", "result": result}

        registry = types.ModuleType("py.execution_tool_registry")
        registry.build_execution_tool_registry = lambda _hooks: SimpleNamespace(hooks={})
        executor = types.ModuleType("py.kernel.executor")
        executor.get_kernel_executor = lambda: SimpleNamespace(execute_tool=governed_call)
        namespace.update({"openxnet_parse_config_intent": None, "openxnet_apply_config_intent": None, "get_image_content": None})
        with patch.dict("sys.modules", {"py.execution_tool_registry": registry, "py.kernel.executor": executor}):
            actual = namespace["_execute_tool_manually_payload"]
            body = {"tool_name": "update_automation_task", "tool_params": {"task_id": task.task_id, "action": "pause"}, "approval_type": "once", "conversationId": "conversation-a"}
            result = await actual(body)
            self.assertTrue(result["success"])
            self.assertEqual(result["taskRef"]["automation"]["state"], "paused")
            self.assertEqual(calls[-1]["actor"], "user")
            foreign = await actual({**body, "conversationId": "conversation-b", "tool_params": {**body["tool_params"], "action": "complete", "origin_conversation_id": "conversation-a"}})
            self.assertFalse(foreign["success"])
            self.assertEqual((await self.center.get_task(task.task_id)).context["automation"]["state"], "paused")

    async def test_worker_checkpoints_retain_bounded_identity_and_automation(self):
        """Worker回传不能丢失会话归属与完成状态。 / Worker checkpoints must retain conversation ownership and completion state."""
        task = await self.create_monitor()
        await self.run_receipt(task, "checkpoint_run", "completed", ["verified file checksum"])
        task = await self.center.get_task(task.task_id)
        checkpoint = build_task_execution_checkpoint(self.directory.name, task)
        context = checkpoint["detailsPatch"]["context"]
        self.assertEqual(context["origin_conversation_id"], "conversation-a")
        self.assertEqual(context["automation"]["state"], "completed")
        self.assertEqual(context["automation"]["runs"][-1]["outcome"], "completed")

    async def test_broker_binds_only_validated_task_scope(self):
        """Broker身份来自已验证任务，普通请求不能注入私有字段。 / Broker identity comes from the validated task and normal requests cannot inject private fields."""
        task = await self.create_monitor()
        await self.center.activate_task(task.task_id)
        await self.center.claim_execution_session(task.task_id, "bound_session", owner_role="task-worker")
        dependencies = TaskExecutionBrokerDependencies(load_settings=AsyncMock(return_value=self.settings), get_task_center=AsyncMock(return_value=self.center), get_provider_block_message=AsyncMock(return_value=None), run_session_turn=AsyncMock(return_value=StreamingResponse(iter([]))), evaluate_completion=AsyncMock(), abort_session=lambda _: False, dispatch_terminal_delivery=AsyncMock())
        broker = TaskExecutionBrokerApi(dependencies)
        request = Request({"type": "http", "method": "POST", "path": "/", "headers": []})
        payload = {"schema": TASK_EXECUTION_TURN_SCHEMA, "sessionId": "bound_session", "taskId": task.task_id, "workspacePath": self.directory.name, "messages": [{"role": "user", "content": "check"}], "maxTokens": 1000}
        await broker.session_turn(TaskExecutionSessionTurnRequest(**payload), request)
        self.assertEqual(request.state.openxnet_task_scope, {"task_id": task.task_id, "session_id": "bound_session", "origin_conversation_id": "conversation-a"})
        foreign = Request({"type": "http", "method": "POST", "path": "/", "headers": []})
        with self.assertRaises(HTTPException):
            await broker.session_turn(TaskExecutionSessionTurnRequest(**{**payload, "sessionId": "foreign_session"}), foreign)
        self.assertFalse(hasattr(foreign.state, "openxnet_task_scope"))
        source = Path(__file__).resolve().parents[1] / "server.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        namespace = dict(BaseModel=BaseModel, PrivateAttr=PrivateAttr, Any=Any, Dict=Dict, List=List, Optional=Optional, Union=Union)
        exec(compile(ast.Module(body=[node for node in tree.body if getattr(node, "name", "") == "ChatRequest"], type_ignores=[]), str(source), "exec"), namespace)
        namespace["ChatRequest"].model_rebuild(_types_namespace=namespace)
        chat = namespace["ChatRequest"](messages=[], _task_runtime_scope={"task_id": "forged"})
        self.assertEqual(chat._task_runtime_scope, {})

    async def test_runtime_failure_records_run_without_stopping_monitor(self):
        """真实执行失败保存失败回执，不能宣称监控已完成。 / Actual execution failure records a failed run without declaring monitoring complete."""
        task = await self.create_monitor()
        await self.center.activate_task(task.task_id)
        await self.center.claim_execution_session(task.task_id, "failed_session", owner_role="task-worker")
        await self.center.update_task_progress(task.task_id, 0, status=TaskStatus.FAILED, error="download endpoint unavailable")
        stored = await self.center.get_task(task.task_id)
        self.assertEqual(stored.context["automation"]["state"], "active")
        self.assertEqual(stored.context["automation"]["runs"][-1]["outcome"], "failed")
        self.assertTrue(stored.context["automation"]["runs"][-1]["notify"])


if __name__ == "__main__":
    unittest.main()
