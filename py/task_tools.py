#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Task tools for the main agent and Hermes-style task planning.
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from py.get_setting import get_port
from py.sub_agent import run_subtask_in_background
from py.task_center import TaskStatus, get_task_center
from py.task_executor_worker_client import get_task_executor_worker_client
from py.task_planning import is_planned_task_context, normalize_task_plan_context
from py.conversation_automation import build_automation, conversation_identity, project_automation
from py.task_schedule_policy import compute_next_run_from_expression, parse_schedule_datetime

# --- Tool Definitions ---

create_subtask_tool = {
    "type": "function",
    "function": {
        "name": "create_subtask",
        "description": (
            "Create a subtask. It can start immediately or be stored as a planned "
            "pending task for later execution."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short subtask title.",
                },
                "description": {
                    "type": "string",
                    "description": "Detailed subtask goal, context, and done criteria.",
                },
                "agent_type": {
                    "type": "string",
                    "description": "Sub-agent type. Default is 'default'.",
                    "default": "default",
                },
                "schedule_type": {
                    "type": "string",
                    "description": "Optional schedule mode: manual, once, or recurring.",
                    "enum": ["manual", "once", "recurring"],
                },
                "schedule_expression": {
                    "type": "string",
                    "description": "Optional schedule expression or natural-language note.",
                },
                "next_run_at": {
                    "type": "string",
                    "description": "Optional next run time in ISO 8601 format.",
                },
                "delivery_targets": {
                    "type": "array",
                    "description": "Optional delivery targets. Defaults to task_center.",
                    "items": {
                        "type": "string",
                        "enum": [
                            "task_center",
                            "desktop_notification",
                            "im_bot",
                            "dynamic_island",
                            "none",
                        ],
                    },
                },
                "start_immediately": {
                    "type": "boolean",
                    "description": (
                        "Optional. True starts immediately, false only registers a pending planned task."
                    ),
                    "default": True,
                },
                "parent_task_id": {
                    "type": "string",
                    "description": "Optional parent task ID.",
                },
            },
            "required": ["title", "description"],
        },
    },
}

create_subtask_tool["function"]["parameters"]["properties"].update({
    "automation_enabled": {"type": "boolean", "description": "Enable a conversation automation for an explicit user monitoring/scheduling request. Requires once or recurring schedule. Default false."},
    "notification_policy": {"type": "string", "enum": ["changes_only", "all", "silent"], "description": "Default changes_only: retain all runs, notify only meaningful changes/completion/failure/action required."},
    "completion_policy": {"type": "string", "enum": ["until_done", "continuous"], "description": "until_done stops after the defined condition is verified; continuous keeps scheduling."},
    "completion_condition": {"type": "string", "description": "Concrete verifiable condition ending this monitoring task."},
})
create_subtask_tool["function"]["description"] += " For hourly monitoring, follow-up, or scheduled checks requested by the user, set automation_enabled=true and a supported schedule. Never create a schedule without a user request."

query_tasks_tool = {
    "type": "function",
    "function": {
        "name": "query_task_progress",
        "description": "Query task progress by task ID, parent task ID, or status.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Exact task ID to query.",
                },
                "parent_task_id": {
                    "type": "string",
                    "description": "List subtasks under a parent task.",
                },
                "status": {
                    "type": "string",
                    "description": "Optional status filter.",
                    "enum": ["pending", "running", "completed", "failed", "cancelled"],
                },
                "verbose": {
                    "type": "boolean",
                    "description": "Show fuller task output when available.",
                    "default": False,
                },
            },
        },
    },
}
query_tasks_tool["function"]["parameters"]["properties"]["current_conversation_only"] = {"type": "boolean", "description": "Filter to tasks owned by the current conversation (default true)."}

update_automation_task_tool = {
    "type": "function",
    "function": {
        "name": "update_automation_task",
        "description": "Update, pause, resume, or permanently complete a user-requested automation owned by this conversation. Complete prevents all future scheduled runs. Do not modify tasks in other conversations.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "action": {"type": "string", "enum": ["update", "pause", "resume", "complete"]},
                "title": {"type": "string"}, "description": {"type": "string"},
                "schedule_expression": {"type": "string"}, "next_run_at": {"type": "string"},
                "notification_policy": {"type": "string", "enum": ["changes_only", "all", "silent"]},
                "completion_condition": {"type": "string"},
            },
            "required": ["task_id", "action"],
        },
    },
}

cancel_subtask_tool = {
    "type": "function",
    "function": {
        "name": "cancel_subtask",
        "description": "Cancel a pending or running subtask.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Task ID to cancel.",
                }
            },
            "required": ["task_id"],
        },
    },
}

start_subtask_tool = {
    "type": "function",
    "function": {
        "name": "start_subtask",
        "description": "Start a pending planned subtask from Task Center.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Pending task ID to start.",
                }
            },
            "required": ["task_id"],
        },
    },
}

finish_task_tool = {
    "type": "function",
    "function": {
        "name": "finish_task",
        "description": (
            "Mark the current task as completed. Sub-agents should call this once the "
            "final result is ready."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "Current task ID.",
                },
                "result": {
                    "type": "string",
                    "description": "Final result or report for the task.",
                },
            },
            "required": ["task_id", "result"],
        },
    },
}
finish_task_tool["function"]["parameters"]["properties"].update({
    "outcome": {"type": "string", "enum": ["unchanged", "changed", "completed", "failed", "action_required"], "description": "Required for automation runs: unchanged ends this check quietly; completed stops until_done monitoring only with evidence."},
    "evidence": {"type": "array", "items": {"type": "string"}, "description": "Observed results supporting the outcome; required for completed."},
    "observation_key": {"type": "string", "description": "Optional stable fingerprint of observed state, used to suppress repeated unchanged notifications."},
})


def _build_task_context(
    schedule_type: Optional[str] = None,
    schedule_expression: Optional[str] = None,
    next_run_at: Optional[str] = None,
    delivery_targets: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Build normalized planning metadata for one tool-created task."""

    return normalize_task_plan_context(
        {
            "schedule_type": schedule_type,
            "schedule_expression": schedule_expression,
            "next_run_at": next_run_at,
            "delivery_targets": delivery_targets,
        }
    )


def _bounded_executor_max_tokens(settings: Optional[Dict[str, Any]]) -> int:
    """Return the finite token option allowed into a SubAgent executor."""

    try:
        max_tokens = int((settings or {}).get("max_tokens", 4000))
    except (TypeError, ValueError):
        max_tokens = 4000
    return max(256, min(max_tokens, 65_536))


async def _start_task_executor(
    *,
    task_id: str,
    workspace_dir: str,
    settings: Optional[Dict[str, Any]],
    consensus_content: Optional[str],
) -> None:
    """Start through Task Worker when configured, with server-profile fallback."""

    max_tokens = _bounded_executor_max_tokens(settings)
    worker_client = get_task_executor_worker_client()
    if worker_client.configured:
        await worker_client.start(
            workspace_dir,
            task_id,
            max_tokens=max_tokens,
        )
        return
    asyncio.create_task(
        run_subtask_in_background(
            task_id=task_id,
            workspace_dir=workspace_dir,
            backend_origin=f"http://127.0.0.1:{get_port()}",
            max_tokens=max_tokens,
            consensus_content=consensus_content,
        ),
        name=f"openxnet-server-task-executor-{task_id}",
    )


async def _mark_task_executor_dispatch_failure(task_center: Any, task_id: str) -> None:
    """Persist a generic terminal failure when Task Worker rejects a nested job."""

    task = await task_center.get_task(task_id)
    if task is None or task.status in {
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
        TaskStatus.CANCELLED,
    }:
        return
    await task_center.update_task_progress(
        task_id=task_id,
        progress=task.progress,
        error="Supervised Task Worker could not accept this execution.",
        context={"executor_dispatch_failed": True},
    )


# --- Tool Implementations ---

class TaskToolReceipt(str):
    """保留兼容文本与真实任务引用；retain compatible text alongside authoritative task references."""

    def __new__(cls, text: str, task: Any):
        """从已创建任务构造引用；build references only from the task returned by Task Center."""
        from py.conversation_automation import conversation_identity, project_automation
        context = getattr(task, "context", {}) or {}
        result = super().__new__(cls, text)
        result.task_ref = {
            "taskId": str(task.task_id),
            "parentTaskId": str(getattr(task, "parent_task_id", "") or ""),
            "agentType": str(getattr(task, "agent_type", "") or ""),
            "status": str(getattr(task.status, "value", task.status)),
            "title": str(task.title),
            "updatedAt": str(getattr(task, "updated_at", "") or ""),
            "originConversationId": conversation_identity(context.get("origin_conversation_id")),
        }
        if isinstance(context.get("automation"), dict):
            result.task_ref["automation"] = project_automation(context["automation"])
            result.task_ref["scheduleExpression"] = str(context.get("schedule_expression") or "")
            result.task_ref["scheduleType"] = str(context.get("schedule_type") or "")
            result.task_ref["description"] = str(getattr(task, "description", ""))[:16000]
            result.task_ref["nextRunAt"] = context.get("next_run_at")
        return result

async def create_subtask(
    title: str,
    description: str,
    agent_type: str = "default",
    workspace_dir: str = None,
    settings: dict = None,
    parent_task_id: Optional[str] = None,
    consensus_content: Optional[str] = None,
    schedule_type: Optional[str] = None,
    schedule_expression: Optional[str] = None,
    next_run_at: Optional[str] = None,
    delivery_targets: Optional[List[str]] = None,
    start_immediately: Optional[bool] = None,
    origin_conversation_id: str = "",
    automation_enabled: bool = False,
    notification_policy: str = "changes_only",
    completion_policy: str = "until_done",
    completion_condition: str = "",
) -> str:
    """创建子任务并返回真实引用；create a subtask and return its authoritative reference."""
    try:
        task_center = await get_task_center(workspace_dir)
        task_context = _build_task_context(
            schedule_type=schedule_type,
            schedule_expression=schedule_expression,
            next_run_at=next_run_at,
            delivery_targets=delivery_targets,
        )
        owner = conversation_identity(origin_conversation_id)
        if owner:
            task_context["origin_conversation_id"] = owner
        if automation_enabled:
            if not owner:
                raise ValueError("Automation requires a current conversation")
            if task_context.get("schedule_type") not in {"once", "recurring"}:
                raise ValueError("Automation requires a once or recurring schedule")
            if task_context["schedule_type"] == "recurring":
                projected = compute_next_run_from_expression(task_context.get("schedule_expression", ""), datetime.now())
                if projected is None:
                    raise ValueError("Unsupported recurring schedule expression")
            else:
                projected = parse_schedule_datetime(next_run_at)
                if projected is None:
                    raise ValueError("One-time automation requires next_run_at")
            task_context["next_run_at"] = projected.isoformat()
            task_context["automation"] = build_automation(notification_policy, completion_policy, completion_condition)
        should_start_immediately = (
            bool(start_immediately)
            if start_immediately is not None
            else not is_planned_task_context(task_context)
        )

        task = await task_center.create_task(
            title=title,
            description=description,
            parent_task_id=parent_task_id,
            agent_type=agent_type,
            context=task_context,
        )

        if should_start_immediately:
            task = await task_center.start_task(task.task_id, trigger_source="create_subtask_tool") or task
            try:
                await _start_task_executor(
                    task_id=task.task_id,
                    workspace_dir=workspace_dir,
                    settings=settings,
                    consensus_content=consensus_content,
                )
            except Exception:
                await _mark_task_executor_dispatch_failure(task_center, task.task_id)
                raise
    except Exception as e:
        return f"Error calling tool create_subtask: Subtask creation failed: {str(e)}"

    if should_start_immediately:
        return TaskToolReceipt(
            f"Subtask created and started.\n\n"
            f"Task ID: {task.task_id}\n"
            f"Title: {task.title}\n"
            "Do not poll aggressively; the Task Center UI will refresh automatically.", task
        )

    return TaskToolReceipt(
        f"Planned subtask registered.\n\n"
        f"Task ID: {task.task_id}\n"
        f"Title: {task.title}\n"
        f"Plan: {task.context.get('schedule_summary') or 'planned'}\n"
        "Current status: PENDING. Use Task Center or start_subtask to trigger it later.", task
    )


async def query_task_progress(
    workspace_dir: str,
    task_id: Optional[str] = None,
    parent_task_id: Optional[str] = None,
    status: Optional[str] = None,
    verbose: bool = False,
    origin_conversation_id: str = "",
    current_conversation_only: bool = True,
) -> str:
    """查询会话绑定的任务及计划状态。 / Query conversation-bound tasks and their schedule state."""
    try:
        task_center = await get_task_center(workspace_dir)
        status_enum = TaskStatus(status) if status else None

        if task_id:
            single_task = await task_center.get_task(task_id)
            if not single_task:
                return f"Task {task_id} was not found."
            tasks = [single_task]
        else:
            tasks = await task_center.list_tasks(
                parent_task_id=parent_task_id,
                status=status_enum,
            )

        if current_conversation_only and origin_conversation_id:
            tasks = [task for task in tasks if task.context.get("origin_conversation_id") == origin_conversation_id]
        if not tasks:
            return "No matching tasks were found."

        result_lines = [f"Task Center status ({len(tasks)} tasks)", "-" * 30]
        if verbose:
            result_lines.insert(1, "[Verbose mode]")

        for task in tasks:
            payload = task_center.serialize_task(task)
            icon = (
                "SUCCESS"
                if task.status == TaskStatus.COMPLETED
                else "RUNNING"
                if task.status == TaskStatus.RUNNING
                else "PENDING"
            )
            result_lines.append(f"{icon} [{task.task_id}] {task.title}")
            result_lines.append(f"   Status: {task.status.value.upper()} | Progress: {task.progress}%")
            if isinstance(task.context.get("automation"), dict):
                result_lines.append(f"   Automation: {task.context['automation'].get('state')} | Last outcome: {task.context['automation'].get('last_outcome', 'not_run')}")
            if payload.get("is_planned_task"):
                result_lines.append(
                    f"   Plan: {payload.get('schedule_summary') or payload.get('schedule_type')}"
                )
            delivery_targets = payload.get("delivery_target_labels") or []
            if delivery_targets:
                result_lines.append(
                    f"   Delivery: {payload.get('delivery_status_label') or payload.get('delivery_status')}"
                    f" | {', '.join(delivery_targets)}"
                )

            history = task.context.get("history", [])
            if task.status == TaskStatus.RUNNING:
                if history:
                    result_lines.append(f"   Latest activity: {history[-1][:100]}...")
            elif task.status == TaskStatus.COMPLETED:
                if verbose:
                    result_lines.append(f"   Final result:\n{task.result or '(no result)'}\n")
                else:
                    summary = task.context.get("summary") or (task.result[:150] + "..." if task.result else "No result")
                    result_lines.append(f"   Summary: {summary}")
            elif task.status == TaskStatus.FAILED:
                result_lines.append(f"   Error: {task.error}")

            result_lines.append("")
    except Exception as e:
        return f"Task query failed: {str(e)}"

    return "\n".join(result_lines)


async def cancel_subtask(workspace_dir: str, task_id: str) -> str:
    """Cancel a subtask."""
    try:
        task_center = await get_task_center(workspace_dir)
        success = await task_center.cancel_task(task_id)
        worker_client = get_task_executor_worker_client()
        if success and worker_client.configured:
            try:
                await worker_client.cancel(workspace_dir, task_id)
            except Exception:
                pass
    except Exception as e:
        return f"Task cancel failed: {str(e)}"
    return (
        f"Task {task_id} was cancelled."
        if success
        else f"Unable to cancel task {task_id}."
    )


async def start_subtask(
    workspace_dir: str,
    task_id: str,
    settings: dict = None,
    consensus_content: Optional[str] = None,
) -> str:
    """Start a pending planned subtask."""
    try:
        task_center = await get_task_center(workspace_dir)
        task = await task_center.start_task(task_id, trigger_source="start_subtask_tool")
        if not task:
            return f"Unable to start task {task_id}. Only pending tasks can be started."

        try:
            await _start_task_executor(
                task_id=task.task_id,
                workspace_dir=workspace_dir,
                settings=settings,
                consensus_content=consensus_content,
            )
        except Exception:
            await _mark_task_executor_dispatch_failure(task_center, task.task_id)
            raise
        return f"Task {task_id} has been queued and started."
    except Exception as e:
        return f"Task start failed: {str(e)}"


async def finish_task(
    workspace_dir: str,
    task_id: str,
    result: str,
    outcome: Optional[str] = None,
    evidence: Optional[List[str]] = None,
    observation_key: str = "",
    current_task_id: str = "",
    current_session_id: str = "",
) -> str:
    """由当前执行会话提交真实结果和自动任务回执。 / Submit actual results and automation receipts from the owning execution session."""
    try:
        task_center = await get_task_center(workspace_dir)
        task = await task_center.get_task(task_id)
        if current_task_id and current_task_id != task_id:
            raise ValueError("Cannot complete a different execution task")
        automation_receipt = None
        if task and isinstance(task.context.get("automation"), dict):
            if current_task_id != task_id or not current_session_id:
                raise ValueError("Automation result requires its owning execution session")
            automation_receipt = {"outcome": outcome, "evidence": evidence, "observation_key": observation_key, "session_id": current_session_id}
        success = await task_center.update_task_progress(
            task_id=task_id,
            progress=100,
            status=TaskStatus.FAILED if outcome == "failed" else TaskStatus.COMPLETED,
            result=result,
            automation_receipt=automation_receipt,
        )
    except Exception as e:
        return f"Error calling tool finish_task: {str(e)}"

    if success:
        return TaskToolReceipt(f"Task {task_id} run was completed.", await task_center.get_task(task_id))
    return f"Error calling tool finish_task: Unable to update task {task_id}."


async def update_automation_task(workspace_dir: str, task_id: str, action: str, origin_conversation_id: str = "", **updates: Any) -> str:
    """调用任务中心的原子会话生命周期接口。 / Invoke the Task Center atomic conversation lifecycle operation."""
    try:
        task_center = await get_task_center(workspace_dir)
        task = await task_center.manage_automation(task_id, origin_conversation_id, action, updates)
        if action == "complete":
            worker_client = get_task_executor_worker_client()
            if worker_client.configured:
                try:
                    await worker_client.cancel(workspace_dir, task_id)
                except Exception:
                    return TaskToolReceipt(f"Automation {task_id} ended. The running worker will stop when it observes the cancelled task state.", task)
        return TaskToolReceipt(f"Automation {task_id}: {task.context['automation']['state']}.", task)
    except Exception as error:
        return f"Error calling tool update_automation_task: {error}"


TASK_TOOL_NAMES = frozenset({"create_subtask", "query_task_progress", "cancel_subtask", "start_subtask", "finish_task", "update_automation_task"})


async def dispatch_bound_task_tool(name: str, params: dict, settings: dict, scope: dict) -> str:
    """将运行时身份绑定到任务调用，不接受模型传入所有者。 / Bind runtime identities to task calls without accepting model-supplied ownership."""
    workspace = (settings.get("CLISettings") or {}).get("cc_path")
    if not workspace:
        return "Error calling task tool: No workspace is configured"
    owner = conversation_identity(scope.get("origin_conversation_id"))
    consensus = None
    if name in {"create_subtask", "start_subtask"}:
        from pathlib import Path
        import aiofiles
        consensus_path = Path(workspace) / ".agent" / "consensus.md"
        if consensus_path.is_file():
            async with aiofiles.open(consensus_path, "r", encoding="utf-8") as stream:
                consensus = await stream.read(200000)
    if name == "create_subtask":
        allowed = {"title", "description", "agent_type", "schedule_type", "schedule_expression", "next_run_at", "delivery_targets", "start_immediately", "automation_enabled", "notification_policy", "completion_policy", "completion_condition"}
        fields = {key: value for key, value in params.items() if key in allowed}
        if scope.get("task_id"):
            fields["parent_task_id"] = scope["task_id"]
        return await create_subtask(**fields, workspace_dir=workspace, settings=settings, origin_conversation_id=owner, consensus_content=consensus)
    if name == "query_task_progress":
        fields = {key: value for key, value in params.items() if key in {"task_id", "parent_task_id", "status", "verbose"}}
        return await query_task_progress(workspace, **fields, origin_conversation_id=owner, current_conversation_only=bool(owner))
    task_id = str(params.get("task_id") or "")
    if name == "finish_task":
        if not scope.get("task_id") or scope["task_id"] != task_id:
            return "Error calling tool finish_task: Current execution does not own this task"
        fields = {key: value for key, value in params.items() if key in {"result", "outcome", "evidence", "observation_key"}}
        return await finish_task(workspace, task_id, **fields, current_task_id=scope["task_id"], current_session_id=scope.get("session_id", ""))
    center = await get_task_center(workspace)
    task = await center.get_task(task_id)
    if task is None or not owner or task.context.get("origin_conversation_id") != owner:
        return f"Error calling tool {name}: Current conversation does not own this task"
    if name == "update_automation_task":
        fields = {key: value for key, value in params.items() if key in {"title", "description", "schedule_expression", "next_run_at", "notification_policy", "completion_condition"}}
        return await update_automation_task(workspace, task_id, str(params.get("action") or ""), owner, **fields)
    if name == "cancel_subtask":
        if isinstance(task.context.get("automation"), dict):
            return await update_automation_task(workspace, task_id, "complete", owner)
        return await cancel_subtask(workspace, task_id)
    if name == "start_subtask":
        return await start_subtask(workspace, task_id, settings, consensus)
    return "Error calling task tool: Unsupported task tool"
