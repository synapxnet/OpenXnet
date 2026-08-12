# -*- coding: utf-8 -*-
"""Bounded executor checkpoint production and authenticated Worker publication."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import json
import os
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import urlparse


TASK_EXECUTION_CHECKPOINT_SCHEMA = "openxnet.task-execution-checkpoint.v1"
MAX_CHECKPOINT_BYTES = 256 * 1024
MAX_TRACE_ENTRIES = 20


class TaskExecutionEventClient:
    """Publish executor checkpoints through Main's authenticated Worker RPC gateway."""

    def __init__(
        self,
        origin: str,
        token: str,
        *,
        timeout_seconds: float = 5.0,
    ) -> None:
        """Create a best-effort client from process-scoped gateway configuration."""

        self._origin = str(origin or "").strip().rstrip("/")
        self._token = str(token or "").strip()
        self._timeout_seconds = max(1.0, min(float(timeout_seconds), 15.0))

    @classmethod
    def from_environment(cls) -> "TaskExecutionEventClient":
        """Construct a publisher from the environment inherited from Electron Main."""

        return cls(
            os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", ""),
            os.environ.get("OPENXNET_WORKER_RPC_TOKEN", ""),
        )

    @property
    def configured(self) -> bool:
        """Return whether an exact loopback gateway and token are available."""

        parsed = urlparse(self._origin)
        return bool(
            self._token
            and parsed.scheme == "http"
            and parsed.hostname in {"127.0.0.1", "localhost", "::1"}
            and parsed.port is not None
            and parsed.username is None
            and parsed.password is None
            and parsed.path in {"", "/"}
            and not parsed.query
            and not parsed.fragment
        )

    async def publish_checkpoint(self, checkpoint: Mapping[str, Any]) -> bool:
        """Publish one checkpoint without allowing delivery failure to stop execution."""

        if not self.configured:
            return False
        try:
            return await asyncio.to_thread(self._publish_checkpoint_sync, checkpoint)
        except Exception:
            return False

    def _publish_checkpoint_sync(self, checkpoint: Mapping[str, Any]) -> bool:
        """Perform one bounded blocking Worker RPC request in a background thread."""

        body = json.dumps(
            {
                "capability": "tasks",
                "method": "tasks.executor.checkpoint",
                "payload": dict(checkpoint),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(body) > MAX_CHECKPOINT_BYTES:
            return False
        request = urllib_request.Request(
            f"{self._origin}/v1/workers/request",
            data=body,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=self._timeout_seconds) as response:
                payload = response.read(MAX_CHECKPOINT_BYTES + 1)
        except (OSError, urllib_error.URLError, urllib_error.HTTPError):
            return False
        if len(payload) > MAX_CHECKPOINT_BYTES:
            return False
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return False
        return isinstance(value, dict) and value.get("ok") is True


def build_task_execution_checkpoint(
    workspace_path: str,
    task: Any,
) -> dict[str, Any]:
    """Build one bounded language-neutral checkpoint from a compatibility task."""

    context_value = getattr(task, "context", {})
    context = context_value if isinstance(context_value, Mapping) else {}
    status_value = getattr(task, "status", "pending")
    status = str(getattr(status_value, "value", status_value) or "pending").strip().lower()
    trace = _bounded_execution_trace(context.get("execution_trace"))
    last_trace = trace[-1] if trace else {}
    result = _bounded_text(getattr(task, "result", None), 32_768)
    error = _bounded_text(
        getattr(task, "error", None) or context.get("last_error"),
        32_768,
    )
    summary = _bounded_text(context.get("summary") or result, 8_192)
    message = _bounded_text(
        last_trace.get("message") or last_trace.get("title") or f"Execution is {status}.",
        4_096,
    )
    details_context_keys = (
        "current_iteration",
        "runtime_session_id",
        "last_runtime_session_id",
        "last_heartbeat_at",
        "executor_owner_role",
        "executor_session_id",
        "last_executor_session_id",
        "executor_session_started_at",
        "executor_last_heartbeat_at",
        "interrupted_recovery_required",
        "interrupted_at",
        "interrupted_reason",
        "last_active_status",
        "last_active_at",
        "last_active_progress",
        "resume_reason",
        "resume_note",
        "activation_requested_at",
        "activation_source",
        "scheduled_run_count",
        "scheduler_last_matched_at",
        "scheduler_last_triggered_at",
        "scheduler_last_error",
        "scheduler_last_error_at",
        "delivery_status",
        "delivery_last_error",
        "created_from",
        "workflow_kind",
    )
    checkpoint_context = {
        key: context.get(key)
        for key in details_context_keys
        if context.get(key) is not None
    }
    details_patch = {
        "checkpoint_schema": TASK_EXECUTION_CHECKPOINT_SCHEMA,
        "current_iteration": context.get("current_iteration"),
        "last_heartbeat_at": context.get("last_heartbeat_at"),
        "runtime_session_id": _bounded_text(context.get("runtime_session_id"), 128),
        "summary": summary,
        "last_event": message,
        "last_error": error,
        "last_result_preview": _bounded_text(result, 240),
        "is_resumable": status in {"failed", "cancelled"},
        "history_count": len(context.get("history")) if isinstance(context.get("history"), list) else 0,
        "trace_count": len(context.get("execution_trace"))
        if isinstance(context.get("execution_trace"), list) else 0,
        "execution_trace": trace,
        "context": checkpoint_context,
    }
    checkpoint = {
        "schema": TASK_EXECUTION_CHECKPOINT_SCHEMA,
        "workspacePath": _bounded_text(workspace_path, 32_768),
        "legacyTaskId": _bounded_text(getattr(task, "task_id", None), 128),
        "parentTaskId": _bounded_text(getattr(task, "parent_task_id", None), 128) or None,
        "title": _bounded_text(getattr(task, "title", None), 512),
        "description": _bounded_text(getattr(task, "description", None), 32_768),
        "agentType": _bounded_text(getattr(task, "agent_type", None), 128) or "default",
        "status": status,
        "progress": _bounded_progress(getattr(task, "progress", 0)),
        "scheduleType": _bounded_text(context.get("schedule_type"), 32) or "manual",
        "scheduleExpression": _bounded_text(context.get("schedule_expression"), 2_048),
        "nextRunAt": _bounded_text(context.get("next_run_at"), 128) or None,
        "createdAt": _bounded_text(getattr(task, "created_at", None), 128),
        "sourceUpdatedAt": _bounded_text(getattr(task, "updated_at", None), 128),
        "startedAt": _bounded_text(getattr(task, "started_at", None), 128) or None,
        "completedAt": _bounded_text(getattr(task, "completed_at", None), 128) or None,
        "resultSummary": result,
        "errorMessage": error,
        "message": message,
        "detailsPatch": details_patch,
    }
    if len(json.dumps(checkpoint, ensure_ascii=False).encode("utf-8")) > MAX_CHECKPOINT_BYTES:
        checkpoint["detailsPatch"] = {
            "checkpoint_schema": TASK_EXECUTION_CHECKPOINT_SCHEMA,
            "current_iteration": context.get("current_iteration"),
            "last_heartbeat_at": context.get("last_heartbeat_at"),
            "summary": summary,
            "last_event": message,
            "last_error": error,
            "details_truncated": True,
        }
    return checkpoint


def _bounded_execution_trace(value: Any) -> list[dict[str, Any]]:
    """Return a small sanitized suffix of executor trace records."""

    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for item in value[-MAX_TRACE_ENTRIES:]:
        if not isinstance(item, Mapping):
            continue
        result.append({
            "type": _bounded_text(item.get("type"), 64),
            "title": _bounded_text(item.get("title"), 256),
            "message": _bounded_text(item.get("message"), 1_024),
            "timestamp": _bounded_text(item.get("timestamp"), 128),
            "status": _bounded_text(item.get("status"), 32),
            "progress": _bounded_progress(item.get("progress")),
        })
    return result


def _bounded_text(value: Any, limit: int) -> str:
    """Normalize arbitrary text to one bounded single value."""

    text = str(value or "").strip()
    return text if len(text) <= limit else text[:limit]


def _bounded_progress(value: Any) -> int:
    """Normalize one unknown progress value into the inclusive 0-100 range."""

    try:
        return max(0, min(100, int(value or 0)))
    except (TypeError, ValueError):
        return 0
