# -*- coding: utf-8 -*-
"""Server-profile compatibility API for browser-oriented task clients."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from py.sub_agent import run_subtask_in_background
from py.task_center import TaskStatus
from py.task_planning import (
    DELIVERY_TARGET_TASK_CENTER,
    is_planned_task_context,
    normalize_iso_datetime,
    normalize_task_plan_context,
)


SERVER_TASK_API_SCHEMA = "openxnet.server-task-api.v1"


class TaskCreateRequest(BaseModel):
    """Legacy-compatible task creation request accepted in Server profile."""

    task_id: str | None = None
    title: str
    description: str
    agent_type: str = "default"
    context: dict[str, Any] | None = None
    schedule_type: str | None = None
    schedule_expression: str | None = None
    next_run_at: str | None = None
    delivery_targets: list[str] | str | None = None
    start_immediately: bool | None = None


class DevWorkbenchTaskCreateRequest(BaseModel):
    """Legacy-compatible developer-workbench task request for browser clients."""

    workflow_kind: str = "plan"
    goal: str
    title: str | None = None
    target_paths: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    additional_context: str | None = None
    agent_type: str = "default"
    schedule_type: str | None = None
    schedule_expression: str | None = None
    next_run_at: str | None = None
    delivery_targets: list[str] | str | None = None
    start_immediately: bool | None = None


class TaskResumeRequest(BaseModel):
    """Legacy-compatible terminal task recovery request."""

    resume_note: str | None = None
    recovery_action: str | None = None


class TaskStartRequest(BaseModel):
    """Legacy-compatible pending task activation request."""

    trigger_source: str | None = None


class TaskSchedulerProjectionRequest(BaseModel):
    """Server scheduler projection request retained for compatibility."""

    next_run_at: str | None = None
    error: str | None = None


class TaskSchedulerActivationRequest(BaseModel):
    """Server scheduler activation request retained for compatibility."""

    scheduler_matched_at: str
    next_run_at: str | None = None


@dataclass(frozen=True)
class ServerTaskApiDependencies:
    """Inject server-owned settings, Task Center, and execution dependencies."""

    load_settings: Callable[[], Awaitable[dict[str, Any]]]
    get_task_center: Callable[[str], Awaitable[Any]]
    get_block_message: Callable[[dict[str, Any]], Awaitable[str | None]]
    get_cli_runtime_context: Callable[[dict[str, Any]], dict[str, Any]]
    build_developer_workbench_payload: Callable[[Any, dict[str, Any]], dict[str, Any]]
    build_executor_options: Callable[[dict[str, Any]], dict[str, int]]
    backend_origin: Callable[[], str]
    schedule_execution: Callable[..., bool] | None = None


def _build_task_execution_context(
    *,
    base_context: Mapping[str, Any] | None,
    schedule_type: str | None,
    schedule_expression: str | None,
    next_run_at: str | None,
    delivery_targets: Sequence[str] | str | None,
    start_immediately: bool | None,
) -> tuple[dict[str, Any], bool]:
    """Normalize legacy task planning fields and execution intent."""

    context = dict(base_context or {})
    for field_name, field_value in (
        ("schedule_type", schedule_type),
        ("schedule_expression", schedule_expression),
        ("next_run_at", next_run_at),
        ("delivery_targets", delivery_targets),
    ):
        if field_value is not None:
            context[field_name] = field_value
    normalized_context = normalize_task_plan_context(
        context,
        default_delivery_targets=[DELIVERY_TARGET_TASK_CENTER],
    )
    should_start = (
        start_immediately
        if start_immediately is not None
        else not is_planned_task_context(normalized_context)
    )
    return normalized_context, bool(should_start)


async def _load_task_consensus(workspace_dir: str) -> str | None:
    """Read optional bounded UTF-8 consensus for a Server task execution."""

    workspace = Path(workspace_dir).expanduser().resolve()
    consensus_path = (workspace / ".agent" / "consensus.md").resolve()
    try:
        if (
            not consensus_path.is_relative_to(workspace)
            or not consensus_path.is_file()
            or consensus_path.stat().st_size > 1024 * 1024
        ):
            return None
        return await asyncio.to_thread(consensus_path.read_text, encoding="utf-8")
    except (OSError, RuntimeError, UnicodeDecodeError):
        return None


def _serialize_task_items(task_center: Any, tasks: Sequence[Any]) -> list[dict[str, Any]]:
    """Serialize Server task summaries with deterministic child counts."""

    child_counts: dict[str, int] = {}
    for task in tasks:
        if task.parent_task_id and task.parent_task_id != "MANUAL_USER":
            child_counts[task.parent_task_id] = child_counts.get(task.parent_task_id, 0) + 1
    return [
        task_center.serialize_task(
            task,
            child_task_count=child_counts.get(task.task_id, 0),
        )
        for task in tasks
    ]


def _resolve_task_recovery_action(
    task_payload: Mapping[str, Any],
    action_id: str | None,
) -> dict[str, Any] | None:
    """Resolve one stored recovery action using legacy fallback semantics."""

    actions = [
        dict(action)
        for action in task_payload.get("recovery_actions") or []
        if isinstance(action, Mapping)
    ]
    normalized_action_id = str(action_id or "").strip()
    if normalized_action_id:
        selected = next(
            (
                action
                for action in actions
                if str(action.get("action_id") or "").strip() == normalized_action_id
            ),
            None,
        )
        if selected is not None:
            return selected
    return next(
        (action for action in actions if action.get("recommended") is True),
        actions[0] if actions else None,
    )


def _schedule_server_task_execution(
    dependencies: ServerTaskApiDependencies,
    *,
    task_id: str,
    workspace_dir: str,
    current_settings: dict[str, Any],
    consensus_content: str | None,
) -> bool:
    """Launch one server-owned task executor without Desktop Worker routing."""

    if dependencies.schedule_execution is not None:
        return bool(dependencies.schedule_execution(
            task_id=task_id,
            workspace_dir=workspace_dir,
            current_settings=current_settings,
            consensus_content=consensus_content,
        ))
    execution_options = dependencies.build_executor_options(current_settings)
    asyncio.create_task(
        run_subtask_in_background(
            task_id=task_id,
            workspace_dir=workspace_dir,
            backend_origin=dependencies.backend_origin(),
            max_tokens=execution_options["max_tokens"],
            consensus_content=consensus_content,
        ),
        name=f"openxnet-server-task-executor-{task_id}",
    )
    return True


def build_server_task_api_descriptor() -> dict[str, Any]:
    """Return a versioned secret-free descriptor for Server task clients."""

    return {
        "schema": SERVER_TASK_API_SCHEMA,
        "profile": "server",
        "persistence": "workspace-task-center",
        "commands": [
            "list", "get", "create", "start", "resume", "cancel", "delete",
        ],
        "schedulerAdapters": ["project", "activate"],
        "desktopAvailable": False,
    }


def create_server_task_router(
    dependencies: ServerTaskApiDependencies,
) -> APIRouter:
    """Create the complete browser/server compatibility task router."""

    router = APIRouter()

    @router.get("/v1/tasks/capabilities")
    async def get_server_task_capabilities() -> dict[str, Any]:
        """Return the versioned Server task API descriptor."""

        return build_server_task_api_descriptor()

    @router.get("/v1/tasks/list")
    async def list_server_tasks() -> dict[str, Any]:
        """Return all compatibility tasks for the configured Server workspace."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            return {"tasks": [], "error": "No workspace configured"}
        try:
            task_center = await dependencies.get_task_center(workspace_dir)
            tasks = await task_center.list_tasks()
            return {
                "tasks": _serialize_task_items(task_center, tasks),
                "workspace_path": workspace_dir,
            }
        except Exception as error:
            return {"tasks": [], "error": str(error)}

    @router.post("/v1/tasks/create")
    async def create_server_task(req: TaskCreateRequest) -> Any:
        """Create and optionally execute one Server-profile task."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="Workspace is not configured")
        try:
            context, should_start = _build_task_execution_context(
                base_context=req.context,
                schedule_type=req.schedule_type,
                schedule_expression=req.schedule_expression,
                next_run_at=req.next_run_at,
                delivery_targets=req.delivery_targets,
                start_immediately=req.start_immediately,
            )
            if should_start:
                block_message = await dependencies.get_block_message(current_settings)
                if block_message:
                    raise HTTPException(status_code=503, detail=block_message)
            task_center = await dependencies.get_task_center(workspace_dir)
            task = await task_center.create_task(
                title=req.title,
                description=req.description,
                agent_type=req.agent_type,
                parent_task_id="MANUAL_USER",
                context=context,
                task_id=req.task_id,
            )
            consensus = await _load_task_consensus(workspace_dir)
            if should_start:
                task = await task_center.start_task(
                    task.task_id,
                    trigger_source="api_create_task",
                ) or task
                _schedule_server_task_execution(
                    dependencies,
                    task_id=task.task_id,
                    workspace_dir=workspace_dir,
                    current_settings=current_settings,
                    consensus_content=consensus,
                )
            return {
                "success": True,
                "task": task_center.serialize_task(task),
                "scheduled_only": not should_start,
                "execution_options": dependencies.build_executor_options(current_settings),
            }
        except HTTPException:
            raise
        except Exception as error:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": str(error)},
            )

    @router.post("/v1/dev/workbench/tasks/create")
    async def create_server_workbench_task(req: DevWorkbenchTaskCreateRequest) -> Any:
        """Create a standardized developer-workbench task for browser clients."""

        current_settings = await dependencies.load_settings()
        runtime_context = dependencies.get_cli_runtime_context(current_settings)
        workspace_dir = str(runtime_context.get("workspace_dir") or "").strip()
        if not workspace_dir or not Path(workspace_dir).is_dir():
            raise HTTPException(status_code=400, detail="Workspace is not configured")
        task_payload = dependencies.build_developer_workbench_payload(
            req,
            runtime_context,
        )
        try:
            context, should_start = _build_task_execution_context(
                base_context=task_payload["context"],
                schedule_type=req.schedule_type,
                schedule_expression=req.schedule_expression,
                next_run_at=req.next_run_at,
                delivery_targets=req.delivery_targets,
                start_immediately=req.start_immediately,
            )
            if should_start:
                block_message = await dependencies.get_block_message(current_settings)
                if block_message:
                    raise HTTPException(status_code=503, detail=block_message)
            task_center = await dependencies.get_task_center(workspace_dir)
            task = await task_center.create_task(
                title=task_payload["title"],
                description=task_payload["description"],
                agent_type=req.agent_type,
                parent_task_id="MANUAL_USER",
                context=context,
            )
            consensus = await _load_task_consensus(workspace_dir)
            if should_start:
                task = await task_center.start_task(
                    task.task_id,
                    trigger_source="developer_workbench",
                ) or task
                _schedule_server_task_execution(
                    dependencies,
                    task_id=task.task_id,
                    workspace_dir=workspace_dir,
                    current_settings=current_settings,
                    consensus_content=consensus,
                )
            return {
                "success": True,
                "task": task_center.serialize_task(task),
                "scheduled_only": not should_start,
                "execution_options": dependencies.build_executor_options(current_settings),
            }
        except HTTPException:
            raise
        except Exception as error:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": str(error)},
            )

    @router.post("/v1/tasks/scheduler/project/{task_id}")
    async def project_server_scheduled_task(
        task_id: str,
        req: TaskSchedulerProjectionRequest,
    ) -> dict[str, Any]:
        """Persist a Server scheduler recurrence projection."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        task_center = await dependencies.get_task_center(workspace_dir)
        task = await task_center.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        next_run_at = normalize_iso_datetime(req.next_run_at)
        error_text = " ".join(str(req.error or "").split())[:260]
        if req.next_run_at and next_run_at is None:
            raise HTTPException(status_code=400, detail="Invalid next run timestamp")
        if next_run_at is None and not error_text:
            raise HTTPException(status_code=400, detail="Projection result is required")
        current_context = task.context or {}
        if (
            normalize_iso_datetime(current_context.get("next_run_at")) == next_run_at
            and str(current_context.get("scheduler_last_error") or "") == error_text
        ):
            return {
                "success": True,
                "changed": False,
                "task": task_center.serialize_task(task),
            }
        trace_event = None
        if error_text and str(current_context.get("scheduler_last_error") or "") != error_text:
            trace_event = {
                "event_type": "schedule",
                "title": "Recurring schedule needs attention",
                "message": error_text,
            }
        updated = await task_center.mutate_task_context(
            task_id,
            {
                "next_run_at": next_run_at,
                "scheduler_last_error": error_text,
                "scheduler_last_error_at": datetime.now().isoformat() if error_text else None,
            },
            trace_event=trace_event,
            touch_updated_at=True,
        )
        if updated is None:
            raise HTTPException(status_code=409, detail="Task projection was not applied")
        return {
            "success": True,
            "changed": True,
            "task": task_center.serialize_task(updated),
        }

    @router.post("/v1/tasks/scheduler/activate/{task_id}")
    async def activate_server_scheduled_task(
        task_id: str,
        req: TaskSchedulerActivationRequest,
    ) -> dict[str, Any]:
        """Activate one eligible task through the Server executor."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        matched_at = normalize_iso_datetime(req.scheduler_matched_at)
        next_run_at = normalize_iso_datetime(req.next_run_at)
        if matched_at is None:
            raise HTTPException(status_code=400, detail="Invalid scheduler match timestamp")
        if req.next_run_at and next_run_at is None:
            raise HTTPException(status_code=400, detail="Invalid next run timestamp")
        task_center = await dependencies.get_task_center(workspace_dir)
        task = await task_center.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        block_message = await dependencies.get_block_message(current_settings)
        if block_message:
            error_text = " ".join(str(block_message).split())[:260]
            if str((task.context or {}).get("scheduler_last_error") or "") != error_text:
                await task_center.mutate_task_context(
                    task_id,
                    {
                        "scheduler_last_matched_at": matched_at,
                        "scheduler_last_error": error_text,
                        "scheduler_last_error_at": matched_at,
                    },
                    trace_event={
                        "event_type": "schedule",
                        "title": "Scheduled run is waiting for provider readiness",
                        "message": error_text,
                    },
                    touch_updated_at=True,
                )
            raise HTTPException(status_code=503, detail=error_text)
        activated = await task_center.activate_task(
            task_id,
            trigger_source="scheduler_due",
            scheduler_matched_at=matched_at,
            next_run_at=next_run_at,
        )
        if activated is None:
            raise HTTPException(
                status_code=409,
                detail="Task is not eligible for scheduled activation",
            )
        consensus = await _load_task_consensus(workspace_dir)
        _schedule_server_task_execution(
            dependencies,
            task_id=activated.task_id,
            workspace_dir=workspace_dir,
            current_settings=current_settings,
            consensus_content=consensus,
        )
        return {
            "success": True,
            "task": task_center.serialize_task(activated),
            "execution_options": dependencies.build_executor_options(current_settings),
        }

    @router.post("/v1/tasks/start/{task_id}")
    async def start_server_task(
        task_id: str,
        req: TaskStartRequest | None = None,
    ) -> dict[str, Any]:
        """Start one pending Server-profile task."""

        current_settings = await dependencies.load_settings()
        block_message = await dependencies.get_block_message(current_settings)
        if block_message:
            raise HTTPException(status_code=503, detail=block_message)
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        task_center = await dependencies.get_task_center(workspace_dir)
        task = await task_center.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status != TaskStatus.PENDING:
            raise HTTPException(status_code=400, detail="Only pending tasks can be started")
        started = await task_center.start_task(
            task_id,
            trigger_source=(req.trigger_source if req and req.trigger_source else "manual_run_now"),
        )
        if started is None:
            raise HTTPException(status_code=400, detail="Task could not be queued")
        consensus = await _load_task_consensus(workspace_dir)
        _schedule_server_task_execution(
            dependencies,
            task_id=started.task_id,
            workspace_dir=workspace_dir,
            current_settings=current_settings,
            consensus_content=consensus,
        )
        return {
            "success": True,
            "task": task_center.serialize_task(started),
            "execution_options": dependencies.build_executor_options(current_settings),
        }

    @router.post("/v1/tasks/cancel/{task_id}")
    async def cancel_server_task(task_id: str) -> dict[str, bool]:
        """Cancel one Server-profile task mirror."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        task_center = await dependencies.get_task_center(workspace_dir)
        return {"success": await task_center.cancel_task(task_id)}

    @router.post("/v1/tasks/resume/{task_id}")
    async def resume_server_task(
        task_id: str,
        req: TaskResumeRequest | None = None,
    ) -> Any:
        """Resume one terminal Server-profile task."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        task_center = await dependencies.get_task_center(workspace_dir)
        task = await task_center.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status in {TaskStatus.PENDING, TaskStatus.RUNNING}:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Task is already active"},
            )
        task_payload = task_center.serialize_task(task)
        selected_action = _resolve_task_recovery_action(
            task_payload,
            req.recovery_action if req else None,
        )
        resume_note = str(req.resume_note if req and req.resume_note else "").strip()
        if not resume_note and selected_action:
            resume_note = str(selected_action.get("resume_note") or "").strip()
        if not resume_note:
            resume_note = "Resume the unfinished work from the saved task context."
        resumed = await task_center.resume_task(
            task_id,
            resume_note=resume_note,
            recovery_action=selected_action,
        )
        if resumed is None:
            raise HTTPException(status_code=404, detail="Task not found")
        consensus = await _load_task_consensus(workspace_dir)
        _schedule_server_task_execution(
            dependencies,
            task_id=resumed.task_id,
            workspace_dir=workspace_dir,
            current_settings=current_settings,
            consensus_content=consensus,
        )
        return {
            "success": True,
            "task": task_center.serialize_task(resumed),
            "execution_options": dependencies.build_executor_options(current_settings),
        }

    @router.get("/v1/tasks/{task_id}")
    async def get_server_task_detail(task_id: str) -> dict[str, Any]:
        """Return one Server task, children, and bounded consensus."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        task_center = await dependencies.get_task_center(workspace_dir)
        task = await task_center.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        child_tasks = await task_center.list_tasks(parent_task_id=task_id)
        return {
            "task": task_center.serialize_task(
                task,
                child_task_count=len(child_tasks),
            ),
            "child_tasks": [task_center.serialize_task(child) for child in child_tasks],
            "consensus_content": await _load_task_consensus(workspace_dir),
            "workspace_dir": workspace_dir,
        }

    @router.delete("/v1/tasks/{task_id}")
    async def delete_server_task(task_id: str) -> dict[str, bool]:
        """Delete one Server-profile task mirror."""

        current_settings = await dependencies.load_settings()
        workspace_dir = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not workspace_dir:
            raise HTTPException(status_code=400, detail="No workspace")
        task_center = await dependencies.get_task_center(workspace_dir)
        return {"success": await task_center.delete_task(task_id)}

    return router


def register_server_task_api(
    application: FastAPI,
    dependencies: ServerTaskApiDependencies,
) -> None:
    """Register compatibility task routes on a Server-profile application."""

    application.include_router(create_server_task_router(dependencies))
