# -*- coding: utf-8 -*-
"""Authenticated task-execution adapter for the Desktop Core worker protocol."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
import json
import os
from pathlib import Path
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

from py.sub_agent import run_subtask_in_background
from py.task_center import get_task_center
from py.task_execution_preflight import (
    TaskExecutionPreflightClient,
    TaskExecutionPreflightError,
    TaskExecutionPreflightResult,
)
from py.task_execution_events import build_task_execution_checkpoint
from py.task_execution_session import TASK_EXECUTION_CANCEL_SCHEMA
from py.task_delivery_policy import (
    collect_terminal_delivery_decisions,
    compute_delivery_retry_at,
)
from py.task_terminal_delivery import (
    TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA,
    TaskTerminalDeliveryClient,
    TaskTerminalDeliveryError,
)
from py.task_worker_store import (
    TaskWorkerTaskStore,
    normalize_worker_task_create_command,
)
from py.workers.runtime import WorkerRuntime
from py.task_schedule_policy import (
    collect_due_task_executions,
    project_missing_recurring_runs,
)


MAX_RESPONSE_BYTES = 8 * 1024 * 1024
MAX_CHECKPOINT_BYTES = 256 * 1024
SNAPSHOT_FALLBACK_INTERVAL_SECONDS = 30.0
SCHEDULER_POLL_INTERVAL_SECONDS = 15.0
TASK_EXECUTION_CHECKPOINT_SCHEMA = "openxnet.task-execution-checkpoint.v1"


@dataclass(frozen=True)
class ExecutorJob:
    """Track one active SubAgent execution without exposing its asyncio task."""

    task: asyncio.Task[None]
    workspace_path: str
    task_id: str
    session_id: str
    started_at: str
    max_tokens: int


class TaskExecutionAdapter:
    """Apply task commands directly and use the Main-owned execution broker."""

    def __init__(self, runtime: WorkerRuntime) -> None:
        """Create an adapter using the process-scoped desktop task token."""

        self._runtime = runtime
        self._token = str(os.environ.get("OPENXNET_TASK_RPC_TOKEN") or "").strip()
        if not self._token:
            raise RuntimeError("Task execution worker requires OPENXNET_TASK_RPC_TOKEN.")
        self._broker_origin = ""
        self._workspace_path = ""
        self._last_fingerprint = ""
        self._watcher: asyncio.Task[None] | None = None
        self._scheduler: asyncio.Task[None] | None = None
        self._scheduler_last_tick_at = ""
        self._scheduler_last_error = ""
        self._executor_jobs: dict[tuple[str, str], ExecutorJob] = {}
        self._recovered_executor_workspaces: set[str] = set()

    async def start_scheduler(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Start the idempotent Worker-owned schedule clock and run one tick."""

        self._adopt_context(payload)
        self._ensure_watcher()
        result = (
            await self._run_scheduler_tick()
            if self._workspace_path
            else self._empty_scheduler_tick(waiting_for_workspace=True)
        )
        self._ensure_scheduler()
        return {
            "status": "running",
            "pollIntervalSeconds": SCHEDULER_POLL_INTERVAL_SECONDS,
            "checkpointTransport": "worker-rpc-event",
            "snapshotFallbackIntervalSeconds": SNAPSHOT_FALLBACK_INTERVAL_SECONDS,
            **result,
        }

    async def get_scheduler_status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return bounded schedule-clock diagnostics without backend details."""

        self._adopt_context(payload)
        return {
            "status": (
                "running"
                if self._scheduler is not None and not self._scheduler.done()
                else "stopped"
            ),
            "lastTickAt": self._scheduler_last_tick_at,
            "lastError": self._scheduler_last_error,
            "pollIntervalSeconds": SCHEDULER_POLL_INTERVAL_SECONDS,
            "checkpointTransport": "worker-rpc-event",
            "snapshotFallbackIntervalSeconds": SNAPSHOT_FALLBACK_INTERVAL_SECONDS,
            "waitingForWorkspace": not bool(self._workspace_path),
        }

    async def run_scheduler_tick(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Run one schedule tick for diagnostics and deterministic tests."""

        self._adopt_context(payload)
        self._ensure_watcher()
        return await self._run_scheduler_tick()

    async def publish_executor_checkpoint(
        self,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Validate one backend-native checkpoint and publish it to Desktop Core."""

        checkpoint = self._validate_executor_checkpoint(payload)
        await self._runtime.emit_event("tasks.checkpoint", checkpoint)
        return {
            "accepted": True,
            "schema": TASK_EXECUTION_CHECKPOINT_SCHEMA,
            "legacyTaskId": checkpoint["legacyTaskId"],
        }

    async def list_tasks(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return direct workspace task mirrors and begin snapshot delivery."""

        self._adopt_context(payload)
        workspace_path = self._require_workspace_path(payload)
        await self._ensure_executor_recovery()
        response = await self._task_store(workspace_path).list_response()
        self._ensure_watcher()
        return response

    async def get_task(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return one detailed executor task record."""

        self._adopt_context(payload)
        task_id = self._require_task_id(payload)
        store = self._task_store(self._require_workspace_path(payload))
        self._ensure_watcher()
        return await store.get_response(task_id)

    async def create_task(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Create an idempotent execution mirror and publish the resulting snapshot."""

        self._adopt_context(payload)
        task = payload.get("task")
        if not isinstance(task, Mapping):
            raise ValueError("Task creation requires a task object.")
        command = normalize_worker_task_create_command(task)
        workspace_path = self._require_workspace_path(payload)
        store = self._task_store(workspace_path)
        self._ensure_watcher()
        preflight = (
            await self._check_execution_preflight(command.task_id, "create")
            if command.start_immediately
            else None
        )
        await self._ensure_executor_recovery()
        created = await store.create_task(command)
        response: dict[str, Any] = {
            "success": True,
            "task": await store.serialize_task(created),
            "scheduled_only": not command.start_immediately,
        }
        if preflight is not None:
            response["execution_options"] = {"max_tokens": preflight.max_tokens}
            response["executor"] = self._start_executor_job(
                {
                    "workspacePath": workspace_path,
                    "taskId": command.task_id,
                    "maxTokens": preflight.max_tokens,
                },
                response=response,
            )
        await self._emit_current_snapshot(force=True)
        return response

    async def start_task(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Start one pending execution mirror."""

        self._adopt_context(payload)
        task_id = self._require_task_id(payload)
        workspace_path = self._require_workspace_path(payload)
        store = self._task_store(workspace_path)
        self._ensure_watcher()
        preflight = await self._check_execution_preflight(task_id, "start")
        await self._ensure_executor_recovery()
        started = await store.start_task(
            task_id,
            str(payload.get("triggerSource") or "desktop_core"),
        )
        response: dict[str, Any] = {
            "success": True,
            "task": await store.serialize_task(started),
            "execution_options": {"max_tokens": preflight.max_tokens},
        }
        executor_payload = dict(payload)
        executor_payload["workspacePath"] = workspace_path
        executor_payload["maxTokens"] = preflight.max_tokens
        response["executor"] = self._start_executor_job(
            executor_payload,
            response=response,
        )
        await self._emit_current_snapshot(force=True)
        return response

    async def resume_task(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Resume one failed or cancelled execution mirror."""

        self._adopt_context(payload)
        task_id = self._require_task_id(payload)
        workspace_path = self._require_workspace_path(payload)
        store = self._task_store(workspace_path)
        self._ensure_watcher()
        preflight = await self._check_execution_preflight(task_id, "resume")
        await self._ensure_executor_recovery()
        resumed = await store.resume_task(
            task_id,
            str(payload.get("resumeNote") or ""),
            str(payload.get("recoveryAction") or ""),
        )
        response: dict[str, Any] = {
            "success": True,
            "task": await store.serialize_task(resumed),
            "execution_options": {"max_tokens": preflight.max_tokens},
        }
        executor_payload = dict(payload)
        executor_payload["workspacePath"] = workspace_path
        executor_payload["maxTokens"] = preflight.max_tokens
        response["executor"] = self._start_executor_job(
            executor_payload,
            response=response,
        )
        await self._emit_current_snapshot(force=True)
        return response

    async def cancel_task(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Cancel one execution mirror and publish the terminal snapshot."""

        self._adopt_context(payload)
        task_id = self._require_task_id(payload)
        workspace_path = self._require_workspace_path(payload)
        store = self._task_store(workspace_path)
        self._ensure_watcher()
        response: dict[str, Any] = {
            "success": await store.cancel_task(task_id),
        }
        response["executor"] = await self._cancel_executor_job(
            workspace_path,
            task_id,
        )
        await self._emit_current_snapshot(force=True)
        return response

    async def delete_task(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Delete one compatibility execution mirror."""

        self._adopt_context(payload)
        task_id = self._require_task_id(payload)
        workspace_path = self._require_workspace_path(payload)
        store = self._task_store(workspace_path)
        self._ensure_watcher()
        await self._cancel_executor_job(workspace_path, task_id)
        response = {"success": await store.delete_task(task_id)}
        await self._emit_current_snapshot(force=True)
        return response

    async def start_executor(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Start one idempotent local executor job requested by the trusted backend."""

        self._adopt_executor_context(payload)
        self._ensure_watcher()
        await self._ensure_executor_recovery()
        return self._start_executor_job(payload)

    async def get_executor_status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return bounded local executor lifecycle state for one task or all jobs."""

        self._adopt_executor_context(payload, require_task_id=False)
        task_id_value = str(payload.get("taskId") or "").strip()
        if task_id_value:
            task_id = self._require_task_id(payload)
            workspace_path = self._require_workspace_path(payload)
            job = self._executor_jobs.get(self._executor_key(workspace_path, task_id))
            return self._serialize_executor_job(job, task_id=task_id)
        jobs = [
            self._serialize_executor_job(job, task_id=job.task_id)
            for job in self._executor_jobs.values()
            if not job.task.done()
        ]
        return {"status": "running" if jobs else "idle", "activeJobs": jobs}

    async def cancel_executor(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Cancel only the local job after another authority committed task cancellation."""

        self._adopt_executor_context(payload)
        task_id = self._require_task_id(payload)
        return await self._cancel_executor_job(
            self._require_workspace_path(payload),
            task_id,
        )

    def _adopt_context(self, payload: Mapping[str, Any]) -> None:
        """Validate and retain the Main-owned broker and workspace context."""

        origin = str(payload.get("brokerOrigin") or "").strip().rstrip("/")
        parsed = urlparse(origin)
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or parsed.port is None
        ):
            raise ValueError("Task broker origin must be an exact loopback HTTP origin.")
        self._broker_origin = origin
        workspace_path = str(payload.get("workspacePath") or "").strip()
        if workspace_path:
            self._workspace_path = workspace_path

    def _adopt_executor_context(
        self,
        payload: Mapping[str, Any],
        *,
        require_task_id: bool = True,
    ) -> None:
        """Adopt a direct executor request without requiring the broker to echo its origin."""

        if str(payload.get("brokerOrigin") or "").strip():
            self._adopt_context(payload)
        else:
            workspace_path = str(payload.get("workspacePath") or "").strip()
            if workspace_path:
                self._workspace_path = workspace_path
            if not self._broker_origin:
                raise RuntimeError("Task broker origin is not configured.")
        if require_task_id:
            self._require_task_id(payload)

    def _require_task_id(self, payload: Mapping[str, Any]) -> str:
        """Return one bounded compatibility task identifier."""

        task_id = str(payload.get("taskId") or "").strip()
        if not task_id or len(task_id) > 128 or not all(
            character.isalnum() or character in {"-", "_"}
            for character in task_id
        ):
            raise ValueError("Task execution ID is invalid.")
        return task_id

    def _require_workspace_path(self, payload: Mapping[str, Any]) -> str:
        """Return one existing canonical workspace path for executor ownership."""

        raw_path = str(payload.get("workspacePath") or self._workspace_path or "").strip()
        if not raw_path or len(raw_path) > 32_768:
            raise ValueError("Task executor workspace path is invalid.")
        workspace = Path(raw_path).expanduser().resolve()
        if not workspace.is_dir():
            raise ValueError("Task executor workspace directory does not exist.")
        return str(workspace)

    def _task_store(self, workspace_path: str | None = None) -> TaskWorkerTaskStore:
        """Return a direct task store bound to the active canonical workspace."""

        canonical_path = self._require_workspace_path({
            "workspacePath": workspace_path or self._workspace_path,
        })
        self._workspace_path = canonical_path
        return TaskWorkerTaskStore(canonical_path)

    async def _check_execution_preflight(
        self,
        task_id: str,
        operation: str,
    ) -> TaskExecutionPreflightResult:
        """Require provider readiness before committing an execution mutation."""

        workspace_path = self._require_workspace_path({
            "workspacePath": self._workspace_path,
        })
        async with TaskExecutionPreflightClient(
            self._broker_origin,
            self._token,
            workspace_path,
            task_id,
        ) as client:
            result = await client.check(operation)
        if not result.ready:
            raise TaskExecutionPreflightError(
                result.code,
                result.message,
                retryable=True,
            )
        return result

    def _executor_key(self, workspace_path: str, task_id: str) -> tuple[str, str]:
        """Build a platform-canonical job key from workspace and compatibility ID."""

        return os.path.normcase(str(Path(workspace_path).resolve())), task_id

    async def _ensure_executor_recovery(self) -> bool:
        """Reconcile prior Worker-owned sessions once for the active workspace."""

        if not self._workspace_path:
            return False
        workspace_path = self._require_workspace_path({
            "workspacePath": self._workspace_path,
        })
        workspace_key = os.path.normcase(workspace_path)
        if workspace_key in self._recovered_executor_workspaces:
            return False
        await get_task_center(workspace_path)
        self._recovered_executor_workspaces.add(workspace_key)
        return True

    def _start_executor_job(
        self,
        payload: Mapping[str, Any],
        *,
        response: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create one detached SubAgent job or return the existing active job."""

        task_id = self._require_task_id(payload)
        workspace_path = self._require_workspace_path(payload)
        key = self._executor_key(workspace_path, task_id)
        existing = self._executor_jobs.get(key)
        if existing is not None and not existing.task.done():
            return self._serialize_executor_job(existing, task_id=task_id, deduplicated=True)
        max_tokens = self._read_executor_max_tokens(payload, response)
        broker_origin = self._broker_origin
        session_id = f"ses_{uuid4().hex}"
        started_at = datetime.now().isoformat()
        task = asyncio.create_task(
            self._run_executor_job(
                key,
                workspace_path,
                task_id,
                session_id,
                broker_origin,
                max_tokens,
            ),
            name=f"openxnet-task-executor-{task_id}",
        )
        job = ExecutorJob(
            task=task,
            workspace_path=workspace_path,
            task_id=task_id,
            session_id=session_id,
            started_at=started_at,
            max_tokens=max_tokens,
        )
        self._executor_jobs[key] = job
        return self._serialize_executor_job(job, task_id=task_id)

    async def _run_executor_job(
        self,
        key: tuple[str, str],
        workspace_path: str,
        task_id: str,
        session_id: str,
        broker_origin: str,
        max_tokens: int,
    ) -> None:
        """Run one SubAgent job, publish final state, and release its registry slot."""

        current_task = asyncio.current_task()
        try:
            consensus_content = await self._load_consensus(workspace_path)
            await run_subtask_in_background(
                task_id,
                workspace_path,
                broker_origin,
                task_rpc_token=self._token,
                session_id=session_id,
                max_tokens=max_tokens,
                consensus_content=consensus_content,
                checkpoint_publisher=lambda task: self._publish_task_checkpoint(
                    workspace_path,
                    task,
                ),
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            await self._mark_executor_failure(workspace_path, task_id)
        finally:
            await self._publish_latest_task_checkpoint(workspace_path, task_id)
            registered = self._executor_jobs.get(key)
            if registered is not None and registered.task is current_task:
                self._executor_jobs.pop(key, None)

    async def _mark_executor_failure(self, workspace_path: str, task_id: str) -> None:
        """Persist a generic failure unless the task already reached a terminal state."""

        try:
            task_center = await get_task_center(workspace_path)
            task = await task_center.get_task(task_id)
            status = str(getattr(getattr(task, "status", None), "value", "") or "")
            if task is None or status in {"completed", "failed", "cancelled"}:
                return
            await task_center.update_task_progress(
                task_id=task_id,
                progress=max(0, int(getattr(task, "progress", 0) or 0)),
                error="Supervised task executor stopped unexpectedly.",
                context={"executor_failure": True},
            )
        except Exception:
            return

    async def _cancel_executor_job(
        self,
        workspace_path: str,
        task_id: str,
    ) -> dict[str, Any]:
        """Cancel and join one active local executor without changing task facts."""

        key = self._executor_key(workspace_path, task_id)
        job = self._executor_jobs.get(key)
        if job is None or job.task.done():
            self._executor_jobs.pop(key, None)
            return {"status": "idle", "taskId": task_id, "cancelled": False}
        await self._cancel_backend_execution_session(job)
        job.task.cancel()
        try:
            await job.task
        except asyncio.CancelledError:
            pass
        return {"status": "idle", "taskId": task_id, "cancelled": True}

    async def _cancel_backend_execution_session(self, job: ExecutorJob) -> None:
        """Best-effort abort the provider stream before cancelling the local job."""

        try:
            await self._request_json(
                "POST",
                "/v1/tasks/executor/session/cancel",
                {
                    "schema": TASK_EXECUTION_CANCEL_SCHEMA,
                    "sessionId": job.session_id,
                    "taskId": job.task_id,
                    "workspacePath": job.workspace_path,
                },
            )
        except Exception:
            return

    def _serialize_executor_job(
        self,
        job: ExecutorJob | None,
        *,
        task_id: str,
        deduplicated: bool = False,
    ) -> dict[str, Any]:
        """Convert one local job to a bounded secret-free protocol object."""

        if job is None or job.task.done():
            return {"status": "idle", "taskId": task_id, "deduplicated": deduplicated}
        return {
            "status": "running",
            "taskId": task_id,
            "workspacePath": job.workspace_path,
            "sessionId": job.session_id,
            "startedAt": job.started_at,
            "maxTokens": job.max_tokens,
            "deduplicated": deduplicated,
        }

    def _read_executor_max_tokens(
        self,
        payload: Mapping[str, Any],
        response: Mapping[str, Any] | None,
    ) -> int:
        """Read and clamp the only provider-adjacent option allowed into the Worker."""

        response_options = response.get("execution_options") if response else None
        response_max_tokens = (
            response_options.get("max_tokens")
            if isinstance(response_options, Mapping)
            else None
        )
        value = payload.get("maxTokens", response_max_tokens)
        try:
            normalized = int(value if value is not None else 4000)
        except (TypeError, ValueError):
            normalized = 4000
        return max(256, min(normalized, 65_536))

    async def _load_consensus(self, workspace_path: str) -> str | None:
        """Read bounded UTF-8 consensus through the direct task-store boundary."""

        return await self._task_store(workspace_path).read_consensus()

    async def _publish_task_checkpoint(self, workspace_path: str, task: Any) -> None:
        """Build and emit one native checkpoint directly from the supervised job."""

        checkpoint = build_task_execution_checkpoint(workspace_path, task)
        await self.publish_executor_checkpoint(checkpoint)

    async def _publish_latest_task_checkpoint(
        self,
        workspace_path: str,
        task_id: str,
    ) -> None:
        """Best-effort publish the latest persisted state when a job terminates."""

        try:
            task_center = await get_task_center(workspace_path)
            task = await task_center.get_task(task_id)
            if task is not None:
                await self._publish_task_checkpoint(workspace_path, task)
        except Exception:
            return

    async def _request_json(
        self,
        method: str,
        path: str,
        body: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute one bounded authenticated loopback request off the event loop."""

        if not self._broker_origin:
            raise RuntimeError("Task broker origin is not configured.")

        def send() -> dict[str, Any]:
            """Perform the blocking urllib request inside a worker thread."""

            encoded_body = None
            headers = {
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/json",
            }
            if body is not None:
                encoded_body = json.dumps(dict(body), ensure_ascii=False).encode("utf-8")
                headers["Content-Type"] = "application/json; charset=utf-8"
            request = Request(
                f"{self._broker_origin}{path}",
                data=encoded_body,
                headers=headers,
                method=method,
            )
            try:
                with urlopen(request, timeout=30) as response:
                    response_payload = response.read(MAX_RESPONSE_BYTES + 1)
            except HTTPError as error:
                response_payload = error.read(MAX_RESPONSE_BYTES + 1)
                detail = self._decode_error(response_payload, error.code)
                raise RuntimeError(detail) from error
            except URLError as error:
                raise RuntimeError("Task executor is unavailable.") from error
            if len(response_payload) > MAX_RESPONSE_BYTES:
                raise RuntimeError("Task executor response exceeds the payload budget.")
            value = json.loads(response_payload.decode("utf-8")) if response_payload else {}
            if not isinstance(value, dict):
                raise RuntimeError("Task executor returned a non-object response.")
            return value

        return await asyncio.to_thread(send)

    def _decode_error(self, payload: bytes, status_code: int) -> str:
        """Return a generic HTTP diagnostic without exposing backend internals."""

        del payload
        return f"Task executor returned HTTP {status_code}."

    def _ensure_watcher(self) -> None:
        """Start one background executor snapshot watcher for this worker."""

        if self._watcher is None or self._watcher.done():
            self._watcher = asyncio.create_task(
                self._watch_snapshots(),
                name="openxnet-task-execution-events",
            )

    def _ensure_scheduler(self) -> None:
        """Start one long-lived schedule loop for this Worker process."""

        if self._scheduler is None or self._scheduler.done():
            self._scheduler = asyncio.create_task(
                self._watch_schedule(),
                name="openxnet-task-scheduler",
            )

    async def _watch_schedule(self) -> None:
        """Run schedule ticks until the Worker process shuts down."""

        while True:
            await asyncio.sleep(SCHEDULER_POLL_INTERVAL_SECONDS)
            if not self._workspace_path:
                continue
            try:
                await self._run_scheduler_tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                self._scheduler_last_error = "Task scheduler tick failed."

    def _empty_scheduler_tick(self, *, waiting_for_workspace: bool) -> dict[str, Any]:
        """Return deterministic zero-count scheduler state before a workspace exists."""

        return {
            "lastTickAt": self._scheduler_last_tick_at,
            "projected": 0,
            "activated": 0,
            "failures": 0,
            "delivered": 0,
            "deliveryRetries": 0,
            "deliveryFailures": 0,
            "waitingForWorkspace": waiting_for_workspace,
        }

    async def _run_scheduler_tick(self) -> dict[str, Any]:
        """Project, activate, and deliver tasks through Worker-owned policy."""

        store = self._task_store()
        await self._ensure_executor_recovery()
        response = await store.list_response()
        raw_tasks = response.get("tasks")
        tasks = [task for task in raw_tasks if isinstance(task, Mapping)] \
            if isinstance(raw_tasks, list) else []
        reference = datetime.now()
        projected = 0
        activated = 0
        failures = 0
        delivered = 0
        delivery_retries = 0
        delivery_failures = 0
        projections = project_missing_recurring_runs(tasks, reference)
        for projection in projections[:100]:
            task_id = self._require_task_id({"taskId": projection.task_id})
            try:
                await store.project_schedule(
                    task_id,
                    projection.next_run_at,
                    projection.error,
                )
                projected += 1
            except Exception:
                failures += 1
        if projected:
            response = await store.list_response()
            raw_tasks = response.get("tasks")
            tasks = [task for task in raw_tasks if isinstance(task, Mapping)] \
                if isinstance(raw_tasks, list) else []
        delivery_result = await self._dispatch_terminal_deliveries(tasks, reference)
        delivered = delivery_result["delivered"]
        delivery_retries = delivery_result["retries"]
        delivery_failures = delivery_result["failed"]
        decisions = collect_due_task_executions(tasks, reference)
        for decision in decisions[:100]:
            task_id = self._require_task_id({"taskId": decision.task_id})
            try:
                preflight = await self._check_execution_preflight(
                    task_id,
                    "scheduled",
                )
            except TaskExecutionPreflightError as error:
                try:
                    await store.mark_scheduler_blocked(
                        task_id,
                        decision.matched_at,
                        str(error),
                    )
                except Exception:
                    pass
                failures += 1
                continue
            try:
                activated_task = await store.activate_scheduled_task(
                    task_id,
                    decision.matched_at,
                    decision.next_run_at,
                )
                self._start_executor_job(
                    {
                        "workspacePath": self._workspace_path,
                        "taskId": task_id,
                        "maxTokens": preflight.max_tokens,
                    },
                    response={
                        "execution_options": {"max_tokens": preflight.max_tokens},
                    },
                )
                await self._publish_task_checkpoint(
                    self._workspace_path,
                    activated_task,
                )
                activated += 1
            except Exception:
                failures += 1
        self._scheduler_last_tick_at = datetime.now().isoformat()
        self._scheduler_last_error = "" if failures == 0 else "Some scheduled tasks could not be updated."
        if projected or activated or failures or delivered or delivery_retries or delivery_failures:
            await self._emit_current_snapshot(force=True)
        return {
            "lastTickAt": self._scheduler_last_tick_at,
            "projected": projected,
            "activated": activated,
            "failures": failures,
            "delivered": delivered,
            "deliveryRetries": delivery_retries,
            "deliveryFailures": delivery_failures,
            "waitingForWorkspace": False,
        }

    async def _dispatch_terminal_deliveries(
        self,
        tasks: list[Mapping[str, Any]],
        reference: datetime,
    ) -> dict[str, int]:
        """Execute due terminal deliveries and persist bounded retry outcomes."""

        counts = {"delivered": 0, "retries": 0, "failed": 0}
        decisions = collect_terminal_delivery_decisions(tasks, reference)
        for decision in decisions[:100]:
            attempted_at = datetime.now()
            try:
                async with TaskTerminalDeliveryClient(
                    self._broker_origin,
                    self._token,
                    self._workspace_path,
                    decision.task_id,
                ) as client:
                    result = await client.dispatch(
                        attempt_id=decision.attempt_id,
                        target=decision.target,
                        attempt=decision.attempt,
                    )
                success = result.success
                retryable = result.retryable
                method = result.method
                message = result.message
                error = result.error
            except TaskTerminalDeliveryError as delivery_error:
                success = False
                retryable = delivery_error.retryable
                method = ""
                message = "Terminal delivery broker could not complete the attempt."
                error = "Terminal delivery broker is unavailable."
            if success:
                outcome_status = "delivered"
                delivered_at = attempted_at.isoformat()
                next_attempt_at = None
                counts["delivered"] += 1
            elif retryable and decision.attempt < decision.max_attempts:
                outcome_status = "retry_scheduled"
                delivered_at = None
                next_attempt_at = compute_delivery_retry_at(decision.attempt, attempted_at)
                counts["retries"] += 1
            else:
                outcome_status = "failed"
                delivered_at = None
                next_attempt_at = None
                counts["failed"] += 1
            outcome = {
                "schema": TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA,
                "workspacePath": self._workspace_path,
                "legacyTaskId": decision.task_id,
                "attemptId": decision.attempt_id,
                "target": decision.target,
                "status": outcome_status,
                "attempt": decision.attempt,
                "maxAttempts": decision.max_attempts,
                "retryable": retryable,
                "attemptedAt": attempted_at.isoformat(),
                "deliveredAt": delivered_at,
                "nextAttemptAt": next_attempt_at,
                "method": method,
                "message": message,
                "error": error,
            }
            await self._runtime.emit_event("tasks.delivery", outcome)
            try:
                task_center = await get_task_center(self._workspace_path)
                updated_task = await task_center.update_delivery_status(
                    decision.task_id,
                    decision.target,
                    outcome_status,
                    message=message,
                    error=error or None,
                    attempted_at=outcome["attemptedAt"],
                    delivered_at=delivered_at,
                    next_attempt_at=next_attempt_at,
                    attempt_id=decision.attempt_id,
                    method=method,
                    retryable=retryable,
                    trace_event={
                        "event_type": "delivery",
                        "title": f"Terminal delivery {outcome_status.replace('_', ' ')}",
                        "message": error or message,
                    },
                )
                if updated_task is not None:
                    await self._publish_task_checkpoint(self._workspace_path, updated_task)
            except Exception:
                continue
        return counts

    async def _watch_snapshots(self) -> None:
        """Publish infrequent recovery snapshots while native checkpoints are primary."""

        while True:
            await asyncio.sleep(SNAPSHOT_FALLBACK_INTERVAL_SECONDS)
            try:
                await self._emit_current_snapshot(force=False)
            except asyncio.CancelledError:
                raise
            except Exception:
                continue

    async def _emit_current_snapshot(self, *, force: bool) -> None:
        """Emit the current task list when its observable fingerprint changes."""

        if not self._workspace_path:
            return
        response = await self._task_store().list_response()
        tasks = response.get("tasks")
        if not isinstance(tasks, list):
            return
        fingerprint = json.dumps(
            [
                [
                    item.get("task_id"),
                    item.get("updated_at"),
                    item.get("status"),
                    item.get("progress"),
                ]
                for item in tasks
                if isinstance(item, dict)
            ],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        if not force and fingerprint == self._last_fingerprint:
            return
        self._last_fingerprint = fingerprint
        await self._runtime.emit_event(
            "tasks.snapshot",
            {
                "workspacePath": self._workspace_path,
                "tasks": tasks,
            },
        )

    def _validate_executor_checkpoint(
        self,
        payload: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Return one exact bounded executor checkpoint for Worker event delivery."""

        allowed_fields = {
            "schema",
            "workspacePath",
            "legacyTaskId",
            "parentTaskId",
            "title",
            "description",
            "agentType",
            "status",
            "progress",
            "scheduleType",
            "scheduleExpression",
            "nextRunAt",
            "createdAt",
            "sourceUpdatedAt",
            "startedAt",
            "completedAt",
            "resultSummary",
            "errorMessage",
            "message",
            "detailsPatch",
        }
        if set(payload) != allowed_fields:
            raise ValueError("Executor checkpoint fields are invalid.")
        checkpoint = dict(payload)
        if checkpoint.get("schema") != TASK_EXECUTION_CHECKPOINT_SCHEMA:
            raise ValueError("Executor checkpoint schema is invalid.")
        workspace_path = str(checkpoint.get("workspacePath") or "").strip()
        if not workspace_path or len(workspace_path) > 32_768:
            raise ValueError("Executor checkpoint workspace is invalid.")
        self._require_task_id({"taskId": checkpoint.get("legacyTaskId")})
        status = str(checkpoint.get("status") or "").strip().lower()
        if status not in {"pending", "running", "completed", "failed", "cancelled"}:
            raise ValueError("Executor checkpoint status is invalid.")
        progress = checkpoint.get("progress")
        if isinstance(progress, bool) or not isinstance(progress, int) or not 0 <= progress <= 100:
            raise ValueError("Executor checkpoint progress is invalid.")
        for field, maximum_length, allow_empty in (
            ("title", 512, False),
            ("description", 32_768, True),
            ("agentType", 128, False),
            ("scheduleExpression", 2_048, True),
            ("resultSummary", 32_768, True),
            ("errorMessage", 32_768, True),
            ("message", 4_096, True),
        ):
            value = checkpoint.get(field)
            if not isinstance(value, str) or len(value) > maximum_length:
                raise ValueError(f"Executor checkpoint {field} is invalid.")
            if not allow_empty and not value.strip():
                raise ValueError(f"Executor checkpoint {field} is required.")
        for field in ("createdAt", "sourceUpdatedAt"):
            if self._parse_checkpoint_datetime(checkpoint.get(field)) is None:
                raise ValueError(f"Executor checkpoint {field} is invalid.")
        for field in ("nextRunAt", "startedAt", "completedAt"):
            value = checkpoint.get(field)
            if value is not None and self._parse_checkpoint_datetime(value) is None:
                raise ValueError(f"Executor checkpoint {field} is invalid.")
        if checkpoint.get("scheduleType") not in {"manual", "once", "recurring"}:
            raise ValueError("Executor checkpoint schedule type is invalid.")
        details_patch = checkpoint.get("detailsPatch")
        if not isinstance(details_patch, Mapping):
            raise ValueError("Executor checkpoint details are invalid.")
        encoded = json.dumps(checkpoint, ensure_ascii=False).encode("utf-8")
        if len(encoded) > MAX_CHECKPOINT_BYTES:
            raise ValueError("Executor checkpoint exceeds the payload budget.")
        return checkpoint

    def _parse_checkpoint_datetime(self, value: Any) -> datetime | None:
        """Parse one checkpoint ISO timestamp without changing timezone semantics."""

        text = str(value or "").strip()
        if not text or len(text) > 128:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None


def _configure_utf8_stdio() -> None:
    """Force protocol stdout and diagnostic stderr to deterministic UTF-8."""

    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict", newline="\n")


async def run() -> None:
    """Register the task adapter methods and serve the Worker protocol."""

    _configure_utf8_stdio()
    runtime = WorkerRuntime("tasks")
    adapter = TaskExecutionAdapter(runtime)
    runtime.register_handler("tasks.list", adapter.list_tasks)
    runtime.register_handler("tasks.get", adapter.get_task)
    runtime.register_handler("tasks.create", adapter.create_task)
    runtime.register_handler("tasks.start", adapter.start_task)
    runtime.register_handler("tasks.resume", adapter.resume_task)
    runtime.register_handler("tasks.cancel", adapter.cancel_task)
    runtime.register_handler("tasks.delete", adapter.delete_task)
    runtime.register_handler("tasks.scheduler.start", adapter.start_scheduler)
    runtime.register_handler("tasks.scheduler.status", adapter.get_scheduler_status)
    runtime.register_handler("tasks.scheduler.tick", adapter.run_scheduler_tick)
    runtime.register_handler("tasks.executor.checkpoint", adapter.publish_executor_checkpoint)
    runtime.register_handler("tasks.executor.start", adapter.start_executor)
    runtime.register_handler("tasks.executor.status", adapter.get_executor_status)
    runtime.register_handler("tasks.executor.cancel", adapter.cancel_executor)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
