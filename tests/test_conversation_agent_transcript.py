#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""真实子任务公开记录回归 / Actual subtask public-record regressions.

Author: maoyo
Department: 研发部
Date: 2026-09-14
Version: 1.0.0
Security Level: INTERNAL
"""
from __future__ import annotations

import json
import tempfile
from types import SimpleNamespace
import unittest

from py.conversation_agent_transcript import AgentTranscript, MAX_TRANSCRIPT_BYTES, visible_transcript_text
from py.sub_agent import SubAgentExecutor
from py.task_center import TaskStatus, get_task_center
from py.task_execution_session import TaskExecutionSessionEvent
from py.task_execution_events import build_task_execution_checkpoint

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"


class TranscriptProjectionTests(unittest.TestCase):
    """验证持久化公开文本边界。 / Verify persisted public-text boundaries."""

    def test_hidden_blocks_and_credentials_are_excluded(self) -> None:
        """排除嵌套与未闭合隐藏块及明确凭据。 / Exclude nested and unfinished hidden blocks and explicit credentials."""
        text = '<think>private<analysis>nested</analysis>still private</think>Visible\npassword="private-value" api_key=private-key\nBearer abc.def.ghi\n<reasoning>unfinished'
        result = visible_transcript_text(text)
        self.assertIn("Visible", result)
        for absent in ["private", "nested", "unfinished", "abc.def.ghi"]:
            self.assertNotIn(absent, result)
        self.assertIn("[redacted]", result)
        self.assertEqual(visible_transcript_text({"secret": "value"}), "")
        self.assertEqual(visible_transcript_text('```html\n<think>literal code</think>\n``` and `<analysis>literal</analysis>`'), '```html\n<think>literal code</think>\n``` and `<analysis>literal</analysis>`')

    def test_only_matching_task_allowlisted_messages_restore(self) -> None:
        """旧记录不能导入其他任务或系统字段。 / Existing records cannot import another task or system fields."""
        source = SimpleNamespace(task_id="task-one", parent_task_id="parent", context={})
        writer = AgentTranscript(source, "session-one")
        writer.append("delegation", "Actual goal", record_id="input-one")
        writer.append("system", "Never retained")
        raw = writer.snapshot()
        raw["messages"].append({"kind": "system", "content": "Never restored"})
        raw["messages"][0]["settings"] = {"password": "raw-secret"}
        source.context = {"agent_transcript": raw}
        resumed = AgentTranscript(source, "session-two")
        self.assertEqual(len(resumed.rows), 1)
        self.assertEqual(resumed.rows[0]["id"], "input-one")
        self.assertNotIn("raw-secret", json.dumps(resumed.snapshot()))
        source.task_id = "different-task"
        self.assertEqual(AgentTranscript(source, "session-three").rows, [])

    def test_unicode_records_remain_bounded_and_explicitly_truncated(self) -> None:
        """限制UTF-8总量并保留末尾完整Unicode字符。 / Bound total UTF-8 bytes and retain complete Unicode characters."""
        writer = AgentTranscript(SimpleNamespace(task_id="task", parent_task_id=None, context={}), "session")
        for index in range(160):
            writer.append("assistant", "🙂汉字" * 7000, record_id=f"message-{index}")
        snapshot = writer.snapshot()
        self.assertLessEqual(len(json.dumps(snapshot, ensure_ascii=False).encode("utf-8")), MAX_TRANSCRIPT_BYTES)
        self.assertTrue(snapshot["truncated"])
        self.assertEqual(snapshot["messages"][-1]["id"], "message-159")
        self.assertTrue(snapshot["messages"][-1]["truncated"])


class _SessionFixture:
    """仅发出确定事件，不运行模型、工具或硬件。 / Emit deterministic events without running models, tools, or hardware."""

    session_id = "actual-session"

    def __init__(self, task_center, task_id, *, finish_status=None, completion=True):
        """绑定临时任务及预定终态。 / Bind a temporary task and its predetermined terminal state."""
        self.task_center = task_center
        self.task_id = task_id
        self.finish_status = finish_status
        self.completion = completion
        self.evaluations = 0
        self.requests = []

    async def __aenter__(self):
        """进入无网络会话。 / Enter a session without network access."""
        return self

    async def __aexit__(self, *_arguments):
        """结束无网络会话。 / Exit a session without network access."""
        return None

    async def stream_turn(self, messages):
        """模拟分块隐藏推理与可见正文及真实任务落盘终态。 / Simulate chunked hidden text, visible output, and an actual persisted task terminal state."""
        self.requests.append([dict(message) for message in messages])
        yield TaskExecutionSessionEvent(1, "text_delta", text="<think>never ")
        yield TaskExecutionSessionEvent(2, "text_delta", text="display</think>Visible reply")
        if self.finish_status:
            await self.task_center.update_task_progress(task_id=self.task_id, progress=100, status=self.finish_status,
                                                        result="Structured run result")
            yield TaskExecutionSessionEvent(3, "tool_event", tool_type="tool_result", title="finish_task",
                                            content="The actual run receipt")
        yield TaskExecutionSessionEvent(4, "done")

    async def evaluate_completion(self, _recent):
        """记录普通完成判断调用次数。 / Record calls to ordinary completion evaluation."""
        self.evaluations += 1
        return self.completion


class TranscriptExecutorTests(unittest.IsolatedAsyncioTestCase):
    """在真实临时TaskCenter中验证执行与记录。 / Verify execution and transcripts in a real temporary TaskCenter."""

    async def test_persists_actual_delegation_visible_reply_and_terminal_tool_receipt(self) -> None:
        """工具先完成任务仍保留最后回执，不泄漏系统共识。 / Preserve a final tool receipt after terminal persistence without leaking system consensus."""
        with tempfile.TemporaryDirectory() as directory:
            center = await get_task_center(directory)
            task = await center.create_task(title="Actual child", description="Delegated input", context={"origin_conversation_id": "conversation-one"})
            session = _SessionFixture(center, task.task_id, finish_status=TaskStatus.COMPLETED)
            result = await SubAgentExecutor(directory, session).execute_subtask(task.task_id, consensus_content="PRIVATE SYSTEM CONSENSUS")
            persisted = await center.get_task(task.task_id)
            transcript = persisted.context["agent_transcript"]
            self.assertTrue(result["success"])
            self.assertEqual(persisted.status, TaskStatus.COMPLETED)
            self.assertEqual([row["kind"] for row in transcript["messages"]], ["delegation", "tool_receipt", "assistant"])
            self.assertEqual(transcript["messages"][0]["content"], "Delegated input")
            self.assertEqual(transcript["messages"][-1]["content"], "Visible reply")
            encoded = json.dumps(transcript)
            self.assertNotIn("PRIVATE SYSTEM", encoded)
            self.assertNotIn("never display", encoded)
            self.assertEqual(session.evaluations, 0)
            checkpoint = build_task_execution_checkpoint(directory, persisted)
            self.assertEqual(checkpoint["detailsPatch"]["context"]["origin_conversation_id"], "conversation-one")
            self.assertEqual(checkpoint["detailsPatch"]["context"]["agent_transcript"]["messages"], transcript["messages"])

    async def test_ordinary_completion_keeps_existing_behavior(self) -> None:
        """普通子任务仍使用已有完成判断并保存记录。 / Ordinary subtasks retain completion evaluation and persist their transcript."""
        with tempfile.TemporaryDirectory() as directory:
            center = await get_task_center(directory)
            task = await center.create_task(title="Ordinary", description="Actual instruction")
            session = _SessionFixture(center, task.task_id)
            result = await SubAgentExecutor(directory, session).execute_subtask(task.task_id, max_iterations=1)
            self.assertTrue(result["success"])
            self.assertEqual(session.evaluations, 1)
            self.assertEqual((await center.get_task(task.task_id)).context["agent_transcript"]["messages"][-1]["content"], "Visible reply")

    async def test_automation_never_completes_from_prose_alone(self) -> None:
        """自动检查不能由普通正文判定整个监控完成。 / Automated checks cannot complete monitoring from ordinary prose alone."""
        with tempfile.TemporaryDirectory() as directory:
            center = await get_task_center(directory)
            task = await center.create_task(title="Automation", description="Check", context={"automation": {"state": "active"}})
            session = _SessionFixture(center, task.task_id)
            result = await SubAgentExecutor(directory, session).execute_subtask(task.task_id, max_iterations=2)
            self.assertFalse(result["success"])
            self.assertEqual(session.evaluations, 0)
            self.assertIn("finish_task", session.requests[0][0]["content"])
            self.assertEqual(len(session.requests), 2)

    async def test_structured_failure_stops_without_another_turn(self) -> None:
        """结构化失败结束本轮，不再次调用模型。 / A structured failure ends the run without another model turn."""
        with tempfile.TemporaryDirectory() as directory:
            center = await get_task_center(directory)
            task = await center.create_task(title="Failed run", description="Check", context={"automation": {"state": "active"}})
            session = _SessionFixture(center, task.task_id, finish_status=TaskStatus.FAILED)
            result = await SubAgentExecutor(directory, session).execute_subtask(task.task_id)
            self.assertFalse(result["success"])
            self.assertEqual(result["status"], "failed")
            self.assertEqual(len(session.requests), 1)
            self.assertEqual(session.evaluations, 0)


if __name__ == "__main__":
    unittest.main()
