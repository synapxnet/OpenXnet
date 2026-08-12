# -*- coding: utf-8 -*-
"""Typed read-only provider preflight protocol for supervised task commands."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
import json
import re
from typing import Any
from urllib.parse import urlparse

import httpx


TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA = "openxnet.task-execution-preflight-request.v1"
TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA = "openxnet.task-execution-preflight-result.v1"
TASK_EXECUTION_PREFLIGHT_OPERATIONS = frozenset({"create", "start", "resume", "scheduled"})
MAX_PREFLIGHT_RESPONSE_BYTES = 16 * 1024
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


class TaskExecutionPreflightError(RuntimeError):
    """Represent one bounded provider-preflight or protocol failure."""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        """Create a structured error without provider configuration details."""

        super().__init__(message)
        self.code = str(code or "EXECUTION_PREFLIGHT_FAILED")[:128]
        self.retryable = bool(retryable)


@dataclass(frozen=True)
class TaskExecutionPreflightResult:
    """One validated provider readiness result returned to Task Worker."""

    task_id: str
    operation: str
    ready: bool
    code: str
    message: str
    max_tokens: int


def normalize_preflight_identifier(value: Any, field_name: str) -> str:
    """Validate one bounded task identifier used by preflight."""

    normalized = str(value or "").strip()
    if not _IDENTIFIER_PATTERN.fullmatch(normalized):
        raise TaskExecutionPreflightError(
            "INVALID_EXECUTION_PREFLIGHT_REQUEST",
            f"Execution preflight field '{field_name}' is invalid.",
        )
    return normalized


def normalize_preflight_operation(value: Any) -> str:
    """Validate one allow-listed execution operation."""

    normalized = str(value or "").strip().lower()
    if normalized not in TASK_EXECUTION_PREFLIGHT_OPERATIONS:
        raise TaskExecutionPreflightError(
            "INVALID_EXECUTION_PREFLIGHT_REQUEST",
            "Execution preflight operation is invalid.",
        )
    return normalized


def normalize_preflight_max_tokens(value: Any) -> int:
    """Validate the only provider-adjacent option returned to Task Worker."""

    if isinstance(value, bool):
        raise TaskExecutionPreflightError(
            "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
            "Execution preflight maxTokens is invalid.",
        )
    try:
        normalized = int(value)
    except (TypeError, ValueError) as error:
        raise TaskExecutionPreflightError(
            "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
            "Execution preflight maxTokens is invalid.",
        ) from error
    if not 256 <= normalized <= 65_536:
        raise TaskExecutionPreflightError(
            "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
            "Execution preflight maxTokens is outside the allowed range.",
        )
    return normalized


def build_task_execution_preflight_result(
    *,
    task_id: str,
    operation: str,
    ready: bool,
    max_tokens: int,
) -> dict[str, Any]:
    """Build one exact secret-free readiness result for the backend route."""

    normalized_task_id = normalize_preflight_identifier(task_id, "taskId")
    normalized_operation = normalize_preflight_operation(operation)
    normalized_max_tokens = normalize_preflight_max_tokens(max_tokens)
    is_ready = bool(ready)
    return {
        "schema": TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
        "taskId": normalized_task_id,
        "operation": normalized_operation,
        "ready": is_ready,
        "code": "READY" if is_ready else "PROVIDER_NOT_READY",
        "message": (
            "Execution provider is ready."
            if is_ready
            else "Execution provider is not ready."
        ),
        "maxTokens": normalized_max_tokens,
    }


class TaskExecutionPreflightClient:
    """Query the authenticated read-only provider preflight broker."""

    def __init__(
        self,
        backend_origin: str,
        task_rpc_token: str,
        workspace_path: str,
        task_id: str,
        *,
        timeout_seconds: float = 30.0,
    ) -> None:
        """Create one task-bound client without accepting provider settings."""

        self._origin = self._normalize_backend_origin(backend_origin)
        self._token = str(task_rpc_token or "").strip()
        if not self._token or len(self._token) > 4_096:
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_REQUEST",
                "Execution preflight token is invalid.",
            )
        self._workspace_path = str(workspace_path or "").strip()
        if not self._workspace_path or len(self._workspace_path) > 32_768:
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_REQUEST",
                "Execution preflight workspacePath is invalid.",
            )
        self._task_id = normalize_preflight_identifier(task_id, "taskId")
        timeout = max(5.0, min(float(timeout_seconds), 60.0))
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            trust_env=False,
        )

    async def __aenter__(self) -> "TaskExecutionPreflightClient":
        """Enter one preflight client lifetime."""

        return self

    async def __aexit__(self, *_arguments: object) -> None:
        """Close pooled loopback connections after the readiness check."""

        await self.close()

    async def close(self) -> None:
        """Close the underlying asynchronous HTTP client idempotently."""

        if not self._client.is_closed:
            await self._client.aclose()

    async def check(self, operation: str) -> TaskExecutionPreflightResult:
        """Return one validated readiness decision for an execution mutation."""

        normalized_operation = normalize_preflight_operation(operation)
        payload = {
            "schema": TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA,
            "taskId": self._task_id,
            "workspacePath": self._workspace_path,
            "operation": normalized_operation,
        }
        try:
            response = await self._client.post(
                f"{self._origin}/v1/tasks/executor/preflight",
                json=payload,
                headers=self._headers(),
            )
        except httpx.HTTPError as error:
            raise TaskExecutionPreflightError(
                "EXECUTION_PREFLIGHT_UNAVAILABLE",
                "Execution preflight broker connection failed.",
                retryable=True,
            ) from error
        if len(response.content) > MAX_PREFLIGHT_RESPONSE_BYTES:
            raise TaskExecutionPreflightError(
                "EXECUTION_PREFLIGHT_RESPONSE_TOO_LARGE",
                "Execution preflight response exceeds the payload budget.",
            )
        if response.status_code != 200:
            raise TaskExecutionPreflightError(
                "EXECUTION_PREFLIGHT_REJECTED",
                f"Execution preflight returned HTTP {response.status_code}.",
                retryable=response.status_code >= 500,
            )
        try:
            value = response.json()
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
                "Execution preflight returned invalid JSON.",
            ) from error
        return self._parse_result(value, normalized_operation)

    def _parse_result(
        self,
        value: Any,
        operation: str,
    ) -> TaskExecutionPreflightResult:
        """Validate one exact preflight response object."""

        expected_fields = {
            "schema", "taskId", "operation", "ready", "code", "message", "maxTokens",
        }
        if (
            not isinstance(value, Mapping)
            or set(value) != expected_fields
            or value.get("schema") != TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA
            or value.get("taskId") != self._task_id
            or value.get("operation") != operation
            or not isinstance(value.get("ready"), bool)
        ):
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
                "Execution preflight response fields are invalid.",
            )
        ready = bool(value["ready"])
        code = self._bounded_identifier(value.get("code"), "code")
        message = self._bounded_text(value.get("message"), "message", 512)
        if code != ("READY" if ready else "PROVIDER_NOT_READY"):
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
                "Execution preflight response state is inconsistent.",
            )
        return TaskExecutionPreflightResult(
            task_id=self._task_id,
            operation=operation,
            ready=ready,
            code=code,
            message=message,
            max_tokens=normalize_preflight_max_tokens(value.get("maxTokens")),
        )

    def _headers(self) -> dict[str, str]:
        """Return exact non-cacheable authenticated broker headers."""

        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        }

    def _normalize_backend_origin(self, value: Any) -> str:
        """Require an exact loopback HTTP origin without URL credentials."""

        normalized = str(value or "").strip().rstrip("/")
        parsed = urlparse(normalized)
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.port is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_REQUEST",
                "Execution preflight broker origin is invalid.",
            )
        return normalized

    def _bounded_identifier(self, value: Any, field_name: str) -> str:
        """Validate one response identifier with uppercase protocol semantics."""

        normalized = str(value or "").strip()
        if not re.fullmatch(r"[A-Z0-9_]{1,128}", normalized):
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
                f"Execution preflight field '{field_name}' is invalid.",
            )
        return normalized

    def _bounded_text(self, value: Any, field_name: str, maximum_length: int) -> str:
        """Validate one bounded response text field."""

        if not isinstance(value, str):
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
                f"Execution preflight field '{field_name}' is invalid.",
            )
        normalized = value.strip()
        if not normalized or len(normalized) > maximum_length:
            raise TaskExecutionPreflightError(
                "INVALID_EXECUTION_PREFLIGHT_RESPONSE",
                f"Execution preflight field '{field_name}' is invalid.",
            )
        return normalized
