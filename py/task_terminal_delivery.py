# -*- coding: utf-8 -*-
"""Typed terminal-delivery broker protocol for supervised task workers."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
import json
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from py.task_planning import VALID_DELIVERY_TARGETS


TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA = "openxnet.task-terminal-delivery-request.v1"
TASK_TERMINAL_DELIVERY_RESULT_SCHEMA = "openxnet.task-terminal-delivery-result.v1"
TASK_TERMINAL_DELIVERY_OUTCOME_SCHEMA = "openxnet.task-terminal-delivery-outcome.v1"
MAX_TERMINAL_DELIVERY_RESPONSE_BYTES = 32 * 1024
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_ATTEMPT_ID_PATTERN = re.compile(r"^dly_[0-9a-f]{32}$")


class TaskTerminalDeliveryError(RuntimeError):
    """Represent one bounded delivery broker or protocol failure."""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        """Create a structured delivery error without target credentials."""

        super().__init__(message)
        self.code = str(code or "TERMINAL_DELIVERY_FAILED")[:128]
        self.retryable = bool(retryable)


@dataclass(frozen=True)
class TaskTerminalDeliveryResult:
    """One validated result returned by the terminal-delivery broker."""

    attempt_id: str
    task_id: str
    target: str
    success: bool
    retryable: bool
    method: str
    message: str
    error: str


def normalize_delivery_identifier(value: Any, field_name: str) -> str:
    """Validate one bounded task or delivery attempt identifier."""

    normalized = str(value or "").strip()
    pattern = _ATTEMPT_ID_PATTERN if field_name == "attemptId" else _IDENTIFIER_PATTERN
    if not pattern.fullmatch(normalized):
        raise TaskTerminalDeliveryError(
            "INVALID_TERMINAL_DELIVERY_REQUEST",
            f"Terminal delivery field '{field_name}' is invalid.",
        )
    return normalized


def normalize_delivery_target(value: Any) -> str:
    """Validate one supported non-local terminal delivery target."""

    normalized = str(value or "").strip().lower()
    if normalized not in VALID_DELIVERY_TARGETS or normalized in {"", "none", "task_center"}:
        raise TaskTerminalDeliveryError(
            "INVALID_TERMINAL_DELIVERY_REQUEST",
            "Terminal delivery target is invalid.",
        )
    return normalized


def normalize_delivery_attempt(value: Any) -> int:
    """Validate one one-based bounded terminal delivery attempt number."""

    if isinstance(value, bool):
        raise TaskTerminalDeliveryError(
            "INVALID_TERMINAL_DELIVERY_REQUEST",
            "Terminal delivery attempt is invalid.",
        )
    try:
        attempt = int(value)
    except (TypeError, ValueError) as error:
        raise TaskTerminalDeliveryError(
            "INVALID_TERMINAL_DELIVERY_REQUEST",
            "Terminal delivery attempt is invalid.",
        ) from error
    if not 1 <= attempt <= 10:
        raise TaskTerminalDeliveryError(
            "INVALID_TERMINAL_DELIVERY_REQUEST",
            "Terminal delivery attempt is outside the allowed range.",
        )
    return attempt


def build_terminal_delivery_result(
    *,
    attempt_id: str,
    task_id: str,
    target: str,
    raw_result: Mapping[str, Any],
) -> dict[str, Any]:
    """Build one exact secret-free broker response from an adapter result."""

    normalized_attempt_id = normalize_delivery_identifier(attempt_id, "attemptId")
    normalized_task_id = normalize_delivery_identifier(task_id, "taskId")
    normalized_target = normalize_delivery_target(target)
    success = raw_result.get("success") is True
    retryable = raw_result.get("retryable") is True if not success else False
    raw_method = str(raw_result.get("method") or "adapter").strip().lower()
    method = raw_method if re.fullmatch(r"[a-z0-9_-]{1,128}", raw_method) else "adapter"
    if success:
        message = f"Delivery completed via {method or 'adapter'}."
        error = ""
    elif retryable:
        message = "Delivery will be eligible for a bounded retry."
        error = "Delivery target is temporarily unavailable."
    else:
        message = "Delivery failed without an automatic retry."
        error = "Delivery target rejected the request or is not configured."
    return {
        "schema": TASK_TERMINAL_DELIVERY_RESULT_SCHEMA,
        "attemptId": normalized_attempt_id,
        "taskId": normalized_task_id,
        "target": normalized_target,
        "success": success,
        "retryable": retryable,
        "method": method,
        "message": message,
        "error": error,
    }


class TaskTerminalDeliveryClient:
    """Dispatch terminal delivery through the authenticated backend broker."""

    def __init__(
        self,
        backend_origin: str,
        task_rpc_token: str,
        workspace_path: str,
        task_id: str,
        *,
        timeout_seconds: float = 45.0,
    ) -> None:
        """Create one task-bound broker client without accepting target secrets."""

        self._origin = self._normalize_backend_origin(backend_origin)
        self._token = str(task_rpc_token or "").strip()
        if not self._token or len(self._token) > 4_096:
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_REQUEST",
                "Terminal delivery broker token is invalid.",
            )
        self._workspace_path = str(workspace_path or "").strip()
        if not self._workspace_path or len(self._workspace_path) > 32_768:
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_REQUEST",
                "Terminal delivery workspacePath is invalid.",
            )
        self._task_id = normalize_delivery_identifier(task_id, "taskId")
        timeout = max(5.0, min(float(timeout_seconds), 120.0))
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout))

    async def __aenter__(self) -> "TaskTerminalDeliveryClient":
        """Enter one broker client lifetime."""

        return self

    async def __aexit__(self, *_arguments: object) -> None:
        """Close pooled loopback connections after an attempt."""

        await self.close()

    async def close(self) -> None:
        """Close the underlying asynchronous HTTP client idempotently."""

        if not self._client.is_closed:
            await self._client.aclose()

    async def dispatch(
        self,
        *,
        attempt_id: str,
        target: str,
        attempt: int,
    ) -> TaskTerminalDeliveryResult:
        """Execute one idempotently identified terminal delivery attempt."""

        normalized_attempt_id = normalize_delivery_identifier(attempt_id, "attemptId")
        normalized_target = normalize_delivery_target(target)
        normalized_attempt = normalize_delivery_attempt(attempt)
        payload = {
            "schema": TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA,
            "attemptId": normalized_attempt_id,
            "taskId": self._task_id,
            "workspacePath": self._workspace_path,
            "target": normalized_target,
            "attempt": normalized_attempt,
        }
        try:
            response = await self._client.post(
                f"{self._origin}/v1/tasks/executor/delivery/dispatch",
                json=payload,
                headers=self._headers(),
            )
        except httpx.HTTPError as error:
            raise TaskTerminalDeliveryError(
                "TERMINAL_DELIVERY_BROKER_UNAVAILABLE",
                "Terminal delivery broker connection failed.",
                retryable=True,
            ) from error
        if len(response.content) > MAX_TERMINAL_DELIVERY_RESPONSE_BYTES:
            raise TaskTerminalDeliveryError(
                "TERMINAL_DELIVERY_RESPONSE_TOO_LARGE",
                "Terminal delivery broker response exceeds the payload budget.",
            )
        if response.status_code != 200:
            raise TaskTerminalDeliveryError(
                "TERMINAL_DELIVERY_BROKER_REJECTED",
                f"Terminal delivery broker returned HTTP {response.status_code}.",
                retryable=response.status_code >= 500,
            )
        try:
            value = response.json()
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_RESPONSE",
                "Terminal delivery broker returned invalid JSON.",
            ) from error
        return self._parse_result(
            value,
            attempt_id=normalized_attempt_id,
            target=normalized_target,
        )

    def _parse_result(
        self,
        value: Any,
        *,
        attempt_id: str,
        target: str,
    ) -> TaskTerminalDeliveryResult:
        """Validate one exact terminal delivery result object."""

        expected_fields = {
            "schema", "attemptId", "taskId", "target", "success", "retryable",
            "method", "message", "error",
        }
        if (
            not isinstance(value, Mapping)
            or set(value) != expected_fields
            or value.get("schema") != TASK_TERMINAL_DELIVERY_RESULT_SCHEMA
            or value.get("attemptId") != attempt_id
            or value.get("taskId") != self._task_id
            or value.get("target") != target
            or not isinstance(value.get("success"), bool)
            or not isinstance(value.get("retryable"), bool)
        ):
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_RESPONSE",
                "Terminal delivery broker response fields are invalid.",
            )
        method = self._bounded_text(value.get("method"), "method", 128)
        message = self._bounded_text(value.get("message"), "message", 512)
        error = self._bounded_text(value.get("error"), "error", 512)
        success = bool(value["success"])
        if success and error:
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_RESPONSE",
                "Successful terminal delivery cannot contain an error.",
            )
        if not success and not error:
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_RESPONSE",
                "Failed terminal delivery requires a generic error.",
            )
        return TaskTerminalDeliveryResult(
            attempt_id=attempt_id,
            task_id=self._task_id,
            target=target,
            success=success,
            retryable=bool(value["retryable"]),
            method=method,
            message=message,
            error=error,
        )

    def _headers(self) -> dict[str, str]:
        """Return the exact non-cacheable authenticated broker headers."""

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
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_REQUEST",
                "Terminal delivery broker origin is invalid.",
            )
        return normalized

    def _bounded_text(self, value: Any, field_name: str, maximum_length: int) -> str:
        """Validate one bounded broker result string."""

        if not isinstance(value, str):
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_RESPONSE",
                f"Terminal delivery result field '{field_name}' is invalid.",
            )
        normalized = value.strip()
        if len(normalized) > maximum_length:
            raise TaskTerminalDeliveryError(
                "INVALID_TERMINAL_DELIVERY_RESPONSE",
                f"Terminal delivery result field '{field_name}' is too large.",
            )
        return normalized
