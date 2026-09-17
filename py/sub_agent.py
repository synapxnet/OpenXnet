#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Sub-Agent 子代理 — 多 Agent 委托与结果汇总的核心执行器。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

from collections.abc import Awaitable, Callable
import sys
from typing import Dict, List, Optional, Any

from py.task_center import get_task_center, TaskStatus
from py.conversation_agent_transcript import AgentTranscript
from py.task_execution_session import (
    TaskExecutionSessionClient,
    TaskExecutionSessionError,
)


TaskCheckpointPublisher = Callable[[Any], Awaitable[None]]

class SubAgentExecutor:
    """Execute one task through the backend chat surface from a supervised process."""
    
    def __init__(
        self,
        workspace_dir: str,
        session_client: TaskExecutionSessionClient,
        *,
        checkpoint_publisher: Optional[TaskCheckpointPublisher] = None,
    ) -> None:
        """创建绑定单任务的类型化执行器。 / Create an executor over one task-bound typed session client."""

        self.workspace_dir = workspace_dir
        self._session_client = session_client
        self._checkpoint_publisher = checkpoint_publisher
        self._transcript: Optional[AgentTranscript] = None

    def _is_task_cancelled(self, task: Any) -> bool:
        """Return whether the latest task state carries authoritative cancellation."""

        if not task:
            return False
        context = getattr(task, "context", {}) or {}
        return getattr(task, "status", None) == TaskStatus.CANCELLED or bool(context.get("cancel_requested"))

    def _build_cancelled_response(self, task_id: str, task: Any, iteration: int = 0) -> Dict[str, Any]:
        """Build the stable executor response for an already-cancelled task."""

        context = getattr(task, "context", {}) or {}
        return {
            "success": False,
            "task_id": task_id,
            "cancelled": True,
            "status": TaskStatus.CANCELLED.value,
            "summary": (
                context.get("cancel_reason")
                or context.get("resume_reason")
                or "Task was cancelled before completion."
            ),
            "iterations": iteration,
        }

    async def _check_task_terminal_state(
        self,
        task_center: Any,
        task_id: str,
        iteration: int = 0,
    ) -> tuple[Any, Optional[Dict[str, Any]]]:
        """重载任务并停止已结束的执行，包括结构化失败。 / Reload a task and stop terminal execution, including structured failures."""

        latest_task = await task_center.get_task(task_id)
        if not latest_task:
            return None, {"success": False, "task_id": task_id, "error": f"Task {task_id} not found"}
        if self._is_task_cancelled(latest_task):
            return latest_task, self._build_cancelled_response(task_id, latest_task, iteration)
        if latest_task.status == TaskStatus.FAILED:
            return latest_task, {"success": False, "task_id": task_id, "status": TaskStatus.FAILED.value,
                                 "error": latest_task.error or "Task execution failed.", "iterations": iteration}
        if latest_task.status == TaskStatus.COMPLETED:
            return latest_task, {
                "success": True,
                "task_id": task_id,
                "result": latest_task.result,
                "summary": latest_task.context.get("summary") or "任务已完成。",
                "iterations": iteration,
            }
        return latest_task, None
    
    async def execute_subtask(
        self,
        task_id: str,
        consensus_content: Optional[str] = None,
        max_iterations: int = 30
    ) -> Dict[str, Any]:
        """运行有界子任务并记录真实公开委派。 / Run the bounded SubAgent loop and record actual public delegation."""

        task_center = await get_task_center(self.workspace_dir)
        task = await task_center.get_task(task_id)
        
        if not task:
            return {"success": False, "error": f"Task {task_id} not found"}
        if self._is_task_cancelled(task):
            return self._build_cancelled_response(task_id, task)

        self._transcript = AgentTranscript(task, self._session_client.session_id)
        self._transcript.append("delegation", task.description, record_id=f"{self._session_client.session_id}:delegation")
        
        await self._update_task_progress(
            task_center,
            task_id=task_id,
            progress=0,
            status=TaskStatus.RUNNING,
            context={"resume_requested": False, "agent_transcript": self._transcript.snapshot()}
        )

        task, terminal_result = await self._check_task_terminal_state(task_center, task_id)
        if terminal_result:
            return terminal_result
        
        iteration = 0
        conversation_history = []
        assistant_only_history = list(task.context.get("history", []))
        
        system_prompt = self._build_system_prompt(task, consensus_content)
        conversation_history.append({"role": "system", "content": system_prompt})
        
        initial_user_msg = self._build_initial_user_message(task, assistant_only_history)
        conversation_history.append({"role": "user", "content": initial_user_msg})
        
        try:
            async with self._session_client:
                while iteration < max_iterations:
                    task, terminal_result = await self._check_task_terminal_state(task_center, task_id, iteration)
                    if terminal_result:
                        return terminal_result

                    iteration += 1
                    current_progress = 10 + int((iteration / max_iterations) * 80)
                    print(
                        f"[SubAgent] Task {task_id} - Iteration {iteration}",
                        file=sys.stderr,
                        flush=True,
                    )
                    
                    assistant_response = await self._call_llm_stream_only(
                        messages=conversation_history,
                        task_id=task_id,
                        task_center=task_center,
                        base_progress=current_progress,
                        display_history=assistant_only_history
                    )
                    
                    conversation_history.append({
                        "role": "assistant",
                        "content": assistant_response
                    })

                    task, terminal_result = await self._check_task_terminal_state(task_center, task_id, iteration)
                    if terminal_result:
                        return terminal_result

                    await self._update_task_progress(
                        task_center,
                        task_id=task_id,
                        progress=current_progress,
                        status=TaskStatus.RUNNING,
                        context={"history": assistant_only_history, "current_iteration": iteration}
                    )

                    task, terminal_result = await self._check_task_terminal_state(task_center, task_id, iteration)
                    if terminal_result:
                        return terminal_result

                    # 自动检查只能由结构化finish_task回执结束，不能靠普通文字判断。 / Automated checks require structured finish_task receipts, never prose-based completion.
                    is_complete = False if task.context.get("automation") else await self._check_task_completion_smart(
                        conversation_history=conversation_history,
                    )
                    
                    if is_complete:
                        print(
                            "[SubAgent] Implicit completion detected.",
                            file=sys.stderr,
                            flush=True,
                        )
                        last_response = assistant_response or "任务已完成"
                        task, terminal_result = await self._check_task_terminal_state(task_center, task_id, iteration)
                        if terminal_result:
                            return terminal_result

                        await self._update_task_progress(
                            task_center,
                            task_id=task_id,
                            progress=100,
                            status=TaskStatus.COMPLETED,
                            result=last_response,
                            context={"summary": last_response[:200] + "...", "history": assistant_only_history}
                        )
                        return {
                            "success": True,
                            "task_id": task_id,
                            "result": last_response,
                            "summary": last_response[:200] + "...",
                            "iterations": iteration
                        }
                    
                    continuation = "请继续执行任务。如果已完成所有步骤，请总结并给出最终结果。"
                    if task.context.get("automation"):
                        continuation = "请完成本轮检查并调用 finish_task，明确 outcome、evidence 与 observation_key；没有变化也需要结束本轮。"
                    conversation_history.append({
                        "role": "user",
                        "content": continuation
                    })
                    self._transcript.append("continuation", continuation)
                
                timeout_error = f"Max iterations reached ({max_iterations})"
                task, terminal_result = await self._check_task_terminal_state(task_center, task_id, iteration)
                if terminal_result:
                    return terminal_result
                await self._update_task_progress(
                    task_center,
                    task_id=task_id,
                    progress=99,
                    status=TaskStatus.FAILED,
                    error=timeout_error,
                    context={"history": assistant_only_history}
                )
                return {"success": False, "error": timeout_error}

        except Exception as error:
            error_text = str(error)
            task, terminal_result = await self._check_task_terminal_state(task_center, task_id, iteration)
            if terminal_result:
                return terminal_result
            await self._update_task_progress(
                task_center,
                task_id=task_id,
                progress=99,
                status=TaskStatus.FAILED,
                error=error_text,
                context={"history": assistant_only_history}
            )
            return {"success": False, "error": error_text}

    async def _call_llm_stream_only(
        self, 
        messages: List[Dict], 
        task_id: str = None,
        task_center: Any = None,
        base_progress: int = 0,
        display_history: List[str] = None
    ) -> str:
        """消费类型化执行流，只记录公开正文与真实工具回执。 / Consume typed execution events and record visible text and actual tool receipts only."""

        full_content = ""
        current_text_buffer = ""
        tool_step_counter = 0
        stream_error_message = ""
        turn_finished = False
        display_history = display_history if display_history is not None else []

        try:
            async for event in self._session_client.stream_turn(messages):
                if task_center and task_id:
                    _, terminal_result = await self._check_task_terminal_state(task_center, task_id)
                    if terminal_result and event.event_type != "tool_event":
                        break
                if event.event_type == "text_delta":
                    full_content += event.text
                    current_text_buffer += event.text
                    continue
                if event.event_type == "error":
                    stream_error_message = event.message or event.code
                    continue
                if event.event_type != "tool_event" or not task_center or not task_id:
                    continue
                if current_text_buffer.strip():
                    display_history.append(current_text_buffer.strip())
                    current_text_buffer = ""
                tool_type = event.tool_type
                tool_title = event.title.strip() or "Unknown"
                if tool_type not in {"tool_result", "error"}:
                    continue
                if self._transcript is not None:
                    self._transcript.append("tool_receipt", event.content, tool_name=tool_title,
                                            status="error" if tool_type == "error" else "done")
                tool_step_counter += 1
                if tool_type == "error":
                    stream_error_message = event.content or tool_title or "Unknown tool error"
                short_result = (
                    event.content[:300] + "..."
                    if len(event.content) > 300
                    else event.content
                )
                marker = "SUCCESS" if tool_type == "tool_result" else "ERROR"
                display_history.append(f"[{marker}] [{tool_title}]\nResult: {short_result}")
                micro_progress = min(base_progress + (tool_step_counter * 2), 99)
                _, terminal_result = await self._check_task_terminal_state(task_center, task_id)
                if terminal_result:
                    break
                await self._update_task_progress(
                    task_center,
                    task_id=task_id,
                    progress=micro_progress,
                    status=TaskStatus.RUNNING,
                    context={"history": display_history, **({"agent_transcript": self._transcript.snapshot()} if self._transcript else {})},
                )
            turn_finished = True
        except TaskExecutionSessionError as error:
            raise RuntimeError(f"Execution session failed: {error.code}") from error
        finally:
            # 即使finish_task已经提交终态，也仅追加元数据，不反转任务状态。 / Append metadata even after finish_task commits a terminal state without reversing it.
            if self._transcript is not None and task_center and task_id:
                self._transcript.append("assistant", full_content, status="error" if stream_error_message else "done" if turn_finished else "interrupted")
                latest = await task_center.get_task(task_id)
                if latest is not None:
                    await self._update_task_progress(task_center, task_id=task_id, progress=latest.progress,
                                                     context={"agent_transcript": self._transcript.snapshot()})

        if current_text_buffer.strip() and display_history is not None:
            display_history.append(current_text_buffer.strip())

        if stream_error_message:
            raise RuntimeError(f"Stream Tool Error: {stream_error_message}")

        return full_content if full_content else "(任务执行中...)"
    
    def _build_system_prompt(self, task, consensus_content: Optional[str]) -> str:
        """构造任务系统指令与自动检查完成契约，不加入公开记录。 / Build task system instructions and the automated-check contract outside public records."""

        prompt = f"你是一个专业的任务执行助手。\n【任务信息】ID: {task.task_id} | 标题: {task.title}\n【执行要求】专注完成任务，使用可用工具，完成后明确表示结束。"
        if consensus_content: prompt += f"\n\n【共识规范】\n{consensus_content}\n"
        if task.context.get("automation"):
            prompt += (
                "\n【会话自动任务】每轮检查必须调用 finish_task 结束本轮，outcome 只能为 "
                "unchanged、changed、completed、failed、action_required；evidence 为真实证据字符串数组，"
                "observation_key 为可稳定对比的观察摘要。无变化也必须结束本轮。"
                "until_done 只有明确完成证据才可报告 completed；一次检查完成不等于整个持续监控完成。"
                "不得仅用最终文字结束整个监控。 / Every automated check must call finish_task with a structured "
                "outcome, actual evidence, and a stable observation_key. Unchanged checks still finish the current run. "
                "Report completed for until_done only with explicit completion evidence; completing a check does not end ongoing monitoring."
            )
        return prompt

    def _build_initial_user_message(self, task, assistant_only_history: List[str]) -> str:
        """Build an initial or recovery-aware user instruction for one task."""

        resume_mode = bool(task.context.get("resume_requested")) or bool(assistant_only_history)
        if not resume_mode:
            return f"请执行以下任务：\n\n{task.description}\n\n要求：完成后请整理出最终结果。"

        previous_status = task.context.get("previous_status") or task.status
        last_progress = task.context.get("last_progress", task.progress)
        last_error = task.context.get("last_error") or task.error or "无"
        resume_context = task.context.get("resume_context") or {}
        resume_reason = resume_context.get("reason") or task.context.get("resume_reason") or "继续未完成部分"
        previous_summary = (
            resume_context.get("previous_summary")
            or task.context.get("previous_summary")
            or task.context.get("summary")
            or "无"
        )
        last_result_preview = resume_context.get("last_result_preview") or task.context.get("last_result") or "无"
        recent_trace = resume_context.get("recent_trace_excerpt") or []
        history_excerpt = self._format_resume_history(assistant_only_history)
        trace_excerpt = "\n".join(f"- {item}" for item in recent_trace[:5]) if recent_trace else "暂无结构化轨迹。"

        return (
            "请继续执行以下未完成任务，不要从零开始重复已经完成的步骤。\n\n"
            f"【任务标题】{task.title}\n"
            f"【任务描述】\n{task.description}\n\n"
            f"【上次状态】{previous_status}\n"
            f"【上次进度】{last_progress}%\n"
            f"【恢复原因】{resume_reason}\n"
            f"【上次摘要】{previous_summary}\n"
            f"【上次错误】{last_error}\n\n"
            f"【上次结果预览】{last_result_preview}\n\n"
            f"【结构化轨迹】\n{trace_excerpt}\n\n"
            f"【最近执行轨迹】\n{history_excerpt}\n\n"
            "要求：\n"
            "1. 先判断哪些步骤已经完成。\n"
            "2. 优先修复上次中断或失败点。\n"
            "3. 继续执行剩余部分。\n"
            "4. 完成后输出最终结果。"
        )

    def _format_resume_history(self, assistant_only_history: List[str], limit: int = 8) -> str:
        """Format a bounded suffix of prior assistant execution messages."""

        if not assistant_only_history:
            return "暂无历史执行轨迹。"
        excerpt = assistant_only_history[-limit:]
        return "\n".join(f"- {item[:300]}" for item in excerpt)
    
    async def _check_task_completion_smart(self, conversation_history) -> bool:
        """Ask the typed broker whether recent execution satisfies the task."""

        recent = self._get_recent_conversation(conversation_history)
        try:
            return await self._session_client.evaluate_completion(recent)
        except TaskExecutionSessionError as error:
            raise RuntimeError(f"Execution evaluation failed: {error.code}") from error

    def _get_recent_conversation(self, conversation_history: List[Dict]) -> str:
        """Return a compact suffix of recent chat messages for completion checks."""

        texts = []
        for msg in reversed(conversation_history[-5:]):
            texts.append(f"{msg['role']}: {str(msg.get('content'))[:200]}")
        return "\n".join(texts)

    async def _update_task_progress(
        self,
        task_center: Any,
        **update: Any,
    ) -> bool:
        """Persist one task update and publish its resulting native checkpoint."""

        updated = await task_center.update_task_progress(**update)
        if updated:
            await self._publish_task_checkpoint(task_center, str(update.get("task_id") or ""))
        return bool(updated)

    async def _publish_task_checkpoint(self, task_center: Any, task_id: str) -> None:
        """Publish the latest task object without allowing delivery failure to stop work."""

        if self._checkpoint_publisher is None or not task_id:
            return
        try:
            task = await task_center.get_task(task_id)
            if task is not None:
                await self._checkpoint_publisher(task)
        except Exception:
            return


async def run_subtask_in_background(
    task_id: str,
    workspace_dir: str,
    backend_origin: str,
    *,
    task_rpc_token: str = "",
    session_id: Optional[str] = None,
    max_tokens: int = 4000,
    consensus_content: Optional[str] = None,
    checkpoint_publisher: Optional[TaskCheckpointPublisher] = None,
) -> Dict[str, Any]:
    """Execute one task through a task-bound authenticated session broker."""

    session_client = TaskExecutionSessionClient(
        backend_origin,
        task_rpc_token,
        workspace_dir,
        task_id,
        session_id=session_id,
        max_tokens=max_tokens,
    )
    task_center = await get_task_center(workspace_dir)
    claimed_task = await task_center.claim_execution_session(
        task_id,
        session_client.session_id,
    )
    if claimed_task is None:
        await session_client.close()
        return {
            "success": False,
            "task_id": task_id,
            "error": "Task execution session could not claim the task.",
        }
    if checkpoint_publisher is not None:
        await checkpoint_publisher(claimed_task)
    executor = SubAgentExecutor(
        workspace_dir,
        session_client,
        checkpoint_publisher=checkpoint_publisher,
    )
    return await executor.execute_subtask(task_id, consensus_content)
