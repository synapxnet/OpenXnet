# -*- coding: utf-8 -*-
"""Typed task execution broker routes with explicit provider-engine dependencies."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from py.task_execution_preflight import (
    TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA,
    TaskExecutionPreflightError,
    build_task_execution_preflight_result,
    normalize_preflight_identifier,
    normalize_preflight_operation,
)
from py.task_execution_session import (
    TASK_EXECUTION_CANCEL_SCHEMA,
    TASK_EXECUTION_EVALUATION_SCHEMA,
    TASK_EXECUTION_TURN_SCHEMA,
    TaskExecutionSessionError,
    normalize_session_identifier,
    normalize_session_max_tokens,
    normalize_session_messages,
    translate_legacy_execution_stream,
)
from py.task_terminal_delivery import (
    TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA,
    TaskTerminalDeliveryError,
    build_terminal_delivery_result,
    normalize_delivery_attempt,
    normalize_delivery_identifier,
    normalize_delivery_target,
)


SettingsLoader = Callable[[], Awaitable[Dict[str, Any]]]
TaskCenterLoader = Callable[[str], Awaitable[Any]]
ProviderBlockMessageLoader = Callable[[Dict[str, Any]], Awaitable[Optional[str]]]
SessionTurnHandler = Callable[
    [List[Dict[str, str]], int, str, Request],
    Awaitable[Any],
]
SessionEvaluationHandler = Callable[[str, str], Awaitable["ProviderEvaluationResult"]]
SessionAbortHandler = Callable[[str], bool]
TerminalDeliveryHandler = Callable[
    [Any, Dict[str, Any], Dict[str, Any], str],
    Awaitable[Mapping[str, Any]],
]


class TaskExecutionSessionTurnRequest(BaseModel):
    """Exact request accepted by the authenticated task turn broker."""

    model_config = {"extra": "forbid"}
    schema_: str = Field(alias="schema")
    sessionId: str
    taskId: str
    workspacePath: str
    messages: List[Dict[str, Any]]
    maxTokens: int


class TaskExecutionSessionEvaluationRequest(BaseModel):
    """Exact request accepted by the authenticated completion evaluator."""

    model_config = {"extra": "forbid"}
    schema_: str = Field(alias="schema")
    sessionId: str
    taskId: str
    workspacePath: str
    recentProgress: str


class TaskExecutionSessionCancelRequest(BaseModel):
    """Exact request accepted by the authenticated session abort route."""

    model_config = {"extra": "forbid"}
    schema_: str = Field(alias="schema")
    sessionId: str
    taskId: str
    workspacePath: str


class TaskTerminalDeliveryRequest(BaseModel):
    """Exact request accepted by the authenticated terminal-delivery broker."""

    model_config = {"extra": "forbid"}
    schema_: str = Field(alias="schema")
    attemptId: str
    taskId: str
    workspacePath: str
    target: str
    attempt: int
    deliveryCredentialBootstrap: str = Field(default="", max_length=512 * 1024)


class TaskExecutionPreflightRequest(BaseModel):
    """Exact request accepted by the authenticated read-only preflight broker."""

    model_config = {"extra": "forbid"}
    schema_: str = Field(alias="schema")
    taskId: str
    workspacePath: str
    operation: str


@dataclass(frozen=True)
class ProviderEvaluationResult:
    """Bounded result returned by the provider completion adapter."""

    status_code: int
    content: Optional[str]


@dataclass(frozen=True)
class TaskExecutionBrokerDependencies:
    """Explicit runtime adapters required by the task execution broker."""

    load_settings: SettingsLoader
    get_task_center: TaskCenterLoader
    get_provider_block_message: ProviderBlockMessageLoader
    run_session_turn: SessionTurnHandler
    evaluate_completion: SessionEvaluationHandler
    abort_session: SessionAbortHandler
    dispatch_terminal_delivery: TerminalDeliveryHandler


def build_task_executor_options(current_settings: Mapping[str, Any]) -> Dict[str, int]:
    """Return the bounded non-secret options allowed to cross into Task Worker."""

    try:
        max_tokens = int(current_settings.get("max_tokens", 4000))
    except (TypeError, ValueError):
        max_tokens = 4000
    return {"max_tokens": max(256, min(max_tokens, 65_536))}


class TaskExecutionBrokerApi:
    """Own the five typed task broker routes independently from the monolith."""

    def __init__(self, dependencies: TaskExecutionBrokerDependencies) -> None:
        """Create one broker API with process-local delivery idempotency state."""

        self._dependencies = dependencies
        self._delivery_attempt_lock = asyncio.Lock()
        self._delivery_attempt_results: Dict[str, Dict[str, Any]] = {}

    def create_router(self) -> APIRouter:
        """Create the exact broker router without registering compatibility commands."""

        router = APIRouter()
        router.add_api_route(
            "/v1/tasks/executor/preflight",
            self.preflight,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/tasks/executor/session/turn",
            self.session_turn,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/tasks/executor/session/evaluate",
            self.session_evaluate,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/tasks/executor/session/cancel",
            self.session_cancel,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/tasks/executor/delivery/dispatch",
            self.terminal_delivery,
            methods=["POST"],
        )
        return router

    async def preflight(self, req: TaskExecutionPreflightRequest) -> JSONResponse:
        """Return provider readiness without mutating task persistence or exposing settings."""

        current_settings, _, task_id, operation = await self._validate_preflight_context(req)
        try:
            block_message = await self._dependencies.get_provider_block_message(
                current_settings
            )
        except Exception:
            block_message = "Execution provider preflight failed."
        return JSONResponse(
            content=build_task_execution_preflight_result(
                task_id=task_id,
                operation=operation,
                ready=not bool(block_message),
                max_tokens=build_task_executor_options(current_settings)["max_tokens"],
            ),
            headers={"Cache-Control": "no-store"},
        )

    async def session_turn(
        self,
        req: TaskExecutionSessionTurnRequest,
        fastapi_request: Request,
    ) -> Any:
        """Broker one authenticated task turn as typed execution-session events."""

        await self._validate_session_context(
            schema=req.schema_,
            expected_schema=TASK_EXECUTION_TURN_SCHEMA,
            session_id=req.sessionId,
            task_id=req.taskId,
            workspace_path=req.workspacePath,
        )
        try:
            messages = normalize_session_messages(req.messages)
            max_tokens = normalize_session_max_tokens(req.maxTokens)
        except TaskExecutionSessionError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        response = await self._dependencies.run_session_turn(
            messages,
            max_tokens,
            req.sessionId,
            fastapi_request,
        )
        if not isinstance(response, StreamingResponse):
            return self._session_error_response(
                int(getattr(response, "status_code", 502) or 502),
                "EXECUTION_PROVIDER_REJECTED",
            )
        return StreamingResponse(
            translate_legacy_execution_stream(response.body_iterator, req.sessionId),
            media_type="text/event-stream",
            headers={
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-store",
                "Connection": "keep-alive",
            },
            background=response.background,
        )

    async def session_evaluate(
        self,
        req: TaskExecutionSessionEvaluationRequest,
    ) -> JSONResponse:
        """Return one typed provider-backed completion decision for a bound task."""

        _, _, task = await self._validate_session_context(
            schema=req.schema_,
            expected_schema=TASK_EXECUTION_EVALUATION_SCHEMA,
            session_id=req.sessionId,
            task_id=req.taskId,
            workspace_path=req.workspacePath,
        )
        recent_progress = str(req.recentProgress or "").strip()
        if not recent_progress or len(recent_progress) > 16_384:
            raise HTTPException(status_code=400, detail="Execution progress summary is invalid")
        evaluation = await self._dependencies.evaluate_completion(
            str(task.description or "")[:32_768],
            recent_progress,
        )
        if evaluation.status_code != 200:
            return self._session_error_response(
                evaluation.status_code,
                "EXECUTION_EVALUATION_REJECTED",
            )
        if evaluation.content is None:
            return self._session_error_response(502, "INVALID_EVALUATION_RESPONSE")
        return JSONResponse(
            content={
                "schema": TASK_EXECUTION_EVALUATION_SCHEMA,
                "sessionId": req.sessionId,
                "complete": evaluation.content.strip().upper().startswith("YES"),
            },
            headers={"Cache-Control": "no-store"},
        )

    async def session_cancel(
        self,
        req: TaskExecutionSessionCancelRequest,
    ) -> JSONResponse:
        """Abort one bound provider stream after task cancellation is committed."""

        await self._validate_session_context(
            schema=req.schema_,
            expected_schema=TASK_EXECUTION_CANCEL_SCHEMA,
            session_id=req.sessionId,
            task_id=req.taskId,
            workspace_path=req.workspacePath,
            allow_terminal=True,
        )
        cancelled = bool(self._dependencies.abort_session(req.sessionId))
        return JSONResponse(
            content={
                "schema": TASK_EXECUTION_CANCEL_SCHEMA,
                "sessionId": req.sessionId,
                "cancelled": cancelled,
            },
            headers={"Cache-Control": "no-store"},
        )

    async def terminal_delivery(
        self,
        req: TaskTerminalDeliveryRequest,
    ) -> JSONResponse:
        """Execute one authenticated idempotently identified terminal delivery."""

        current_settings, _, task, attempt_id, target, attempt = (
            await self._validate_terminal_delivery_context(req)
        )
        async with self._delivery_attempt_lock:
            cached = self._delivery_attempt_results.get(attempt_id)
            if cached is not None:
                return JSONResponse(content=cached, headers={"Cache-Control": "no-store"})
            delivery_records = (task.context or {}).get("delivery_records") or {}
            record = (
                dict(delivery_records.get(target) or {})
                if isinstance(delivery_records, dict)
                else {}
            )
            try:
                previous_attempts = max(0, int(record.get("attempts", 0) or 0))
            except (TypeError, ValueError):
                previous_attempts = 0
            if attempt != previous_attempts + 1:
                raise HTTPException(
                    status_code=409,
                    detail="Delivery attempt sequence is stale",
                )
            record.update({
                "target": target,
                "delivery_attempt_id": attempt_id,
                "delivery_attempt": attempt,
            })
            raw_result = await self._dependencies.dispatch_terminal_delivery(
                task,
                record,
                current_settings,
                req.deliveryCredentialBootstrap,
            )
            result = build_terminal_delivery_result(
                attempt_id=attempt_id,
                task_id=str(task.task_id),
                target=target,
                raw_result=raw_result,
            )
            self._delivery_attempt_results[attempt_id] = result
            while len(self._delivery_attempt_results) > 1_024:
                oldest_attempt_id = next(iter(self._delivery_attempt_results))
                self._delivery_attempt_results.pop(oldest_attempt_id, None)
        return JSONResponse(content=result, headers={"Cache-Control": "no-store"})

    async def _validate_session_context(
        self,
        *,
        schema: str,
        expected_schema: str,
        session_id: str,
        task_id: str,
        workspace_path: str,
        allow_terminal: bool = False,
    ) -> Tuple[Dict[str, Any], str, Any]:
        """Validate one session request against configured task state."""

        if schema != expected_schema:
            raise HTTPException(status_code=400, detail="Execution session schema is invalid")
        try:
            normalized_session_id = normalize_session_identifier(session_id, "sessionId")
            normalized_task_id = normalize_session_identifier(task_id, "taskId")
        except TaskExecutionSessionError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        current_settings = await self._dependencies.load_settings()
        requested_root = self._validate_workspace(
            current_settings,
            workspace_path,
            "Execution",
        )
        task_center = await self._dependencies.get_task_center(requested_root)
        task = await task_center.get_task(normalized_task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Execution task was not found")
        bound_session_id = str((task.context or {}).get("executor_session_id") or "").strip()
        if bound_session_id and bound_session_id != normalized_session_id:
            raise HTTPException(status_code=409, detail="Execution session does not own this task")
        task_status = str(getattr(task.status, "value", task.status) or "").strip().lower()
        if not allow_terminal and task_status in {"completed", "failed", "cancelled"}:
            raise HTTPException(status_code=409, detail="Execution task is already terminal")
        return current_settings, requested_root, task

    async def _validate_preflight_context(
        self,
        req: TaskExecutionPreflightRequest,
    ) -> Tuple[Dict[str, Any], str, str, str]:
        """Validate one read-only readiness request against configured workspace."""

        if req.schema_ != TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA:
            raise HTTPException(status_code=400, detail="Execution preflight schema is invalid")
        try:
            task_id = normalize_preflight_identifier(req.taskId, "taskId")
            operation = normalize_preflight_operation(req.operation)
        except TaskExecutionPreflightError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        current_settings = await self._dependencies.load_settings()
        requested_root = self._validate_workspace(
            current_settings,
            req.workspacePath,
            "Execution",
        )
        return current_settings, requested_root, task_id, operation

    async def _validate_terminal_delivery_context(
        self,
        req: TaskTerminalDeliveryRequest,
    ) -> Tuple[Dict[str, Any], str, Any, str, str, int]:
        """Validate one broker attempt against the configured terminal task."""

        if req.schema_ != TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA:
            raise HTTPException(status_code=400, detail="Terminal delivery schema is invalid")
        try:
            attempt_id = normalize_delivery_identifier(req.attemptId, "attemptId")
            task_id = normalize_delivery_identifier(req.taskId, "taskId")
            target = normalize_delivery_target(req.target)
            attempt = normalize_delivery_attempt(req.attempt)
        except TaskTerminalDeliveryError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        current_settings = await self._dependencies.load_settings()
        requested_root = self._validate_workspace(
            current_settings,
            req.workspacePath,
            "Delivery",
        )
        task_center = await self._dependencies.get_task_center(requested_root)
        task = await task_center.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Delivery task was not found")
        task_status = str(getattr(task.status, "value", task.status) or "").strip().lower()
        if task_status not in {"completed", "failed", "cancelled"}:
            raise HTTPException(status_code=409, detail="Delivery task is not terminal")
        targets = {
            str(item or "").strip().lower()
            for item in ((task.context or {}).get("delivery_targets") or [])
        }
        if target not in targets:
            raise HTTPException(status_code=409, detail="Delivery target is not configured")
        return current_settings, requested_root, task, attempt_id, target, attempt

    def _validate_workspace(
        self,
        current_settings: Mapping[str, Any],
        workspace_path: str,
        operation_name: str,
    ) -> str:
        """Require the canonical requested workspace to equal current configuration."""

        configured_workspace = str(
            (current_settings.get("CLISettings") or {}).get("cc_path") or ""
        ).strip()
        if not configured_workspace:
            raise HTTPException(
                status_code=400,
                detail=f"{operation_name} workspace is not configured",
            )
        try:
            configured_root = Path(configured_workspace).expanduser().resolve(strict=True)
            requested_root = Path(str(workspace_path or "")).expanduser().resolve(strict=True)
        except (OSError, RuntimeError) as error:
            raise HTTPException(
                status_code=400,
                detail=f"{operation_name} workspace is invalid",
            ) from error
        if (
            not requested_root.is_dir()
            or os.path.normcase(str(requested_root))
            != os.path.normcase(str(configured_root))
        ):
            raise HTTPException(
                status_code=403,
                detail=f"{operation_name} workspace does not match configuration",
            )
        return str(requested_root)

    def _session_error_response(self, status_code: int, code: str) -> JSONResponse:
        """Return one generic broker error without reflecting provider diagnostics."""

        safe_status = status_code if 400 <= int(status_code or 0) <= 599 else 502
        return JSONResponse(
            status_code=safe_status,
            content={
                "schema": "openxnet.task-execution-error.v1",
                "code": str(code or "EXECUTION_SESSION_FAILED")[:128],
                "message": "Execution session broker could not complete the request.",
                "retryable": safe_status >= 500,
            },
            headers={"Cache-Control": "no-store"},
        )


def register_task_execution_broker_api(
    application: FastAPI,
    dependencies: TaskExecutionBrokerDependencies,
) -> TaskExecutionBrokerApi:
    """Register the typed broker routes and return their process-local owner."""

    broker = TaskExecutionBrokerApi(dependencies)
    application.include_router(broker.create_router())
    return broker
