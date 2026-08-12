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
from typing import Any, Dict, List, Optional

from py.get_setting import get_port
from py.sub_agent import run_subtask_in_background
from py.task_center import TaskStatus, get_task_center
from py.task_executor_worker_client import get_task_executor_worker_client
from py.task_planning import is_planned_task_context, normalize_task_plan_context

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
) -> str:
    """Create a subtask and optionally start it right away."""
    try:
        task_center = await get_task_center(workspace_dir)
        task_context = _build_task_context(
            schedule_type=schedule_type,
            schedule_expression=schedule_expression,
            next_run_at=next_run_at,
            delivery_targets=delivery_targets,
        )
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
        return f"Subtask creation failed: {str(e)}"

    if should_start_immediately:
        return (
            f"Subtask created and started.\n\n"
            f"Task ID: {task.task_id}\n"
            f"Title: {task.title}\n"
            "Do not poll aggressively; the Task Center UI will refresh automatically."
        )

    return (
        f"Planned subtask registered.\n\n"
        f"Task ID: {task.task_id}\n"
        f"Title: {task.title}\n"
        f"Plan: {task.context.get('schedule_summary') or 'planned'}\n"
        "Current status: PENDING. Use Task Center or start_subtask to trigger it later."
    )


async def query_task_progress(
    workspace_dir: str,
    task_id: Optional[str] = None,
    parent_task_id: Optional[str] = None,
    status: Optional[str] = None,
    verbose: bool = False,
) -> str:
    """Query task progress with optional planning metadata."""
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
) -> str:
    """Mark a task as completed from a sub-agent."""
    try:
        task_center = await get_task_center(workspace_dir)
        success = await task_center.update_task_progress(
            task_id=task_id,
            progress=100,
            status=TaskStatus.COMPLETED,
            result=result,
        )
    except Exception as e:
        return f"Task completion failed: {str(e)}"

    if success:
        return f"Task {task_id} was marked as completed."
    return f"Unable to update task {task_id}."
