# -*- coding: utf-8 -*-
"""Authenticated provider-engine client for supervised Task Worker jobs."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import json
import os
import threading
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import urlparse


MAX_RESPONSE_BYTES = 256 * 1024


class TaskExecutorWorkerClientError(RuntimeError):
    """Represent one bounded Task Worker control failure."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        """Create a structured client error safe for backend tool responses."""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class TaskExecutorWorkerClient:
    """Control executor jobs through Electron Main's authenticated RPC gateway."""

    def __init__(self, origin: str, token: str, *, timeout_seconds: float = 10.0) -> None:
        """Create a client from process-scoped loopback gateway configuration."""

        self._origin = str(origin or "").strip().rstrip("/")
        self._token = str(token or "").strip()
        self._timeout_seconds = max(1.0, min(float(timeout_seconds), 30.0))

    @classmethod
    def from_environment(cls) -> "TaskExecutorWorkerClient":
        """Construct a client from the environment inherited from Electron Main."""

        return cls(
            os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", ""),
            os.environ.get("OPENXNET_WORKER_RPC_TOKEN", ""),
        )

    @property
    def configured(self) -> bool:
        """Return whether an exact loopback gateway and bearer token are available."""

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

    async def start(
        self,
        workspace_path: str,
        task_id: str,
        *,
        max_tokens: int = 4000,
    ) -> Mapping[str, Any]:
        """Start one idempotent job without overriding its Main-owned broker route."""

        return await asyncio.to_thread(
            self._request_sync,
            "tasks.executor.start",
            {
                "workspacePath": str(workspace_path or ""),
                "taskId": str(task_id or ""),
                "maxTokens": self._normalize_max_tokens(max_tokens),
            },
        )

    async def cancel(self, workspace_path: str, task_id: str) -> Mapping[str, Any]:
        """Cancel only the Worker-local job after backend cancellation is persisted."""

        return await asyncio.to_thread(
            self._request_sync,
            "tasks.executor.cancel",
            {
                "workspacePath": str(workspace_path or ""),
                "taskId": str(task_id or ""),
            },
        )

    async def status(self, workspace_path: str, task_id: str) -> Mapping[str, Any]:
        """Return Worker-local lifecycle state for one compatibility task."""

        return await asyncio.to_thread(
            self._request_sync,
            "tasks.executor.status",
            {
                "workspacePath": str(workspace_path or ""),
                "taskId": str(task_id or ""),
            },
        )

    def _normalize_max_tokens(self, value: Any) -> int:
        """Clamp an unknown token option to the Worker contract range."""

        try:
            normalized = int(value)
        except (TypeError, ValueError):
            normalized = 4000
        return max(256, min(normalized, 65_536))

    def _require_configuration(self) -> None:
        """Reject Worker control when Electron did not configure the private gateway."""

        if not self.configured:
            raise TaskExecutorWorkerClientError(
                "TASK_EXECUTOR_WORKER_UNAVAILABLE",
                "Task Worker RPC is not configured for this backend process.",
                True,
            )

    def _request_sync(
        self,
        method: str,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Perform one bounded blocking gateway request inside a background thread."""

        self._require_configuration()
        body = json.dumps(
            {"capability": "tasks", "method": method, "payload": dict(payload)},
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
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
                response_body = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib_error.HTTPError as error:
            self._raise_http_error(error)
        except (OSError, urllib_error.URLError) as error:
            raise TaskExecutorWorkerClientError(
                "TASK_EXECUTOR_WORKER_UNAVAILABLE",
                "Task Worker RPC connection failed.",
                True,
            ) from error
        if len(response_body) > MAX_RESPONSE_BYTES:
            raise TaskExecutorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Task Worker RPC response exceeds the payload budget.",
                False,
            )
        try:
            envelope = json.loads(response_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TaskExecutorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Task Worker RPC returned invalid UTF-8 JSON.",
                False,
            ) from error
        if not isinstance(envelope, dict) or envelope.get("ok") is not True:
            raise TaskExecutorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Task Worker RPC returned an invalid success envelope.",
                False,
            )
        result = envelope.get("payload")
        if not isinstance(result, dict):
            raise TaskExecutorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Task Worker RPC payload must be an object.",
                False,
            )
        return result

    def _raise_http_error(self, error: urllib_error.HTTPError) -> None:
        """Decode one structured gateway error without reflecting request data."""

        try:
            body = error.read(MAX_RESPONSE_BYTES + 1)
            envelope = json.loads(body.decode("utf-8"))
            error_payload = envelope.get("error", {}) if isinstance(envelope, dict) else {}
            code = str(error_payload.get("code") or "TASK_EXECUTOR_WORKER_FAILED")
            message = str(error_payload.get("message") or "Task Worker request failed.")
            retryable = bool(error_payload.get("retryable", error.code >= 500))
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            code = "TASK_EXECUTOR_WORKER_FAILED"
            message = "Task Worker request failed."
            retryable = error.code >= 500
        raise TaskExecutorWorkerClientError(code, message[:1024], retryable) from error


_task_executor_client: TaskExecutorWorkerClient | None = None
_task_executor_client_lock = threading.Lock()


def get_task_executor_worker_client() -> TaskExecutorWorkerClient:
    """Return the process-wide Task Worker executor control client."""

    global _task_executor_client
    with _task_executor_client_lock:
        if _task_executor_client is None:
            _task_executor_client = TaskExecutorWorkerClient.from_environment()
        return _task_executor_client
