# -*- coding: utf-8 -*-
"""Legacy-backend adapter for authenticated Desktop Core Memory Worker RPC."""

from __future__ import annotations

from collections.abc import Mapping
import json
import os
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request


class MemoryWorkerClientError(RuntimeError):
    """Structured Memory Worker failure returned to legacy callers."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        """Create a client error from a Worker RPC response."""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class MemoryWorkerClient:
    """Expose Mem0-compatible search and add methods through loopback Worker RPC."""

    def __init__(
        self,
        origin: str,
        token: str,
        configuration: Mapping[str, Any],
        *,
        timeout_seconds: float = 125.0,
    ) -> None:
        """Create a configured client without starting the optional Memory Worker."""

        self._origin = origin.rstrip("/")
        self._token = token
        self._configuration = dict(configuration)
        self._timeout_seconds = timeout_seconds

    @classmethod
    def from_config(cls, config: Mapping[str, Any]) -> "MemoryWorkerClient":
        """Construct a Mem0-compatible client from legacy configuration and environment."""

        origin = os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", "").strip()
        token = os.environ.get("OPENXNET_WORKER_RPC_TOKEN", "").strip()
        return cls(origin, token, _normalize_legacy_configuration(config))

    @classmethod
    def from_environment(cls) -> "MemoryWorkerClient":
        """Construct a V3-capable client that does not require legacy Mem0 configuration."""

        origin = os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", "").strip()
        token = os.environ.get("OPENXNET_WORKER_RPC_TOKEN", "").strip()
        return cls(origin, token, {})

    @property
    def configured(self) -> bool:
        """Return whether Electron supplied both a loopback origin and bearer token."""

        return bool(self._origin and self._token)

    def search(
        self,
        query: str,
        *,
        user_id: str,
        limit: int = 5,
        **_options: Any,
    ) -> Any:
        """Search long-term memory while preserving Mem0's synchronous call shape."""

        result = self._request_sync(
            "memory.search",
            {
                "configuration": self._configuration,
                "query": query,
                "userId": user_id,
                "limit": limit,
            },
        )
        return result.get("results", [])

    def add(
        self,
        messages: Any,
        *,
        user_id: str,
        metadata: Mapping[str, Any] | None = None,
        infer: bool = True,
        **_options: Any,
    ) -> Any:
        """Add long-term memory while preserving Mem0's synchronous call shape."""

        result = self._request_sync(
            "memory.add",
            {
                "configuration": self._configuration,
                "messages": messages,
                "userId": user_id,
                "metadata": dict(metadata or {}),
                "infer": infer,
            },
        )
        return result.get("result")

    def recall_v3(
        self,
        query: str,
        *,
        requester_agent: str,
        task_id: str = "",
        required_tags: tuple[str, ...] = (),
        limit: int = 4,
        maximum_characters: int = 4_000,
    ) -> Mapping[str, Any]:
        """Recall permission-filtered SynapXnet V3 memory for a chat request."""

        return self._request_sync(
            "memory.v3.recall",
            {
                "requesterAgent": requester_agent,
                "query": query,
                "taskId": task_id,
                "requiredTags": list(required_tags),
                "limit": limit,
                "maximumCharacters": maximum_characters,
            },
        )

    def append_v3_short_term(
        self,
        *,
        session_id: str,
        requester_agent: str,
        input_text: str,
        output_text: str,
        token_count: int,
        ttl_seconds: int = 86_400,
    ) -> Mapping[str, Any]:
        """Append hash-only short-term exchange evidence with a bounded TTL."""

        return self._request_sync(
            "memory.v3.short-term.append",
            {
                "sessionId": session_id,
                "requesterAgent": requester_agent,
                "input": input_text,
                "output": output_text,
                "tokenCount": token_count,
                "ttlSeconds": ttl_seconds,
            },
        )

    def _require_configuration(self) -> None:
        """Raise a stable retryable failure when Electron RPC is unavailable."""

        if not self.configured:
            raise MemoryWorkerClientError(
                "MEMORY_WORKER_UNAVAILABLE",
                "Memory Worker RPC is not configured for this backend process.",
                True,
            )

    def _request_sync(
        self,
        method: str,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Perform one blocking Memory Worker request for execution in a thread."""

        self._require_configuration()
        body = json.dumps(
            {"capability": "memory", "method": method, "payload": dict(payload)},
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib_request.Request(
            f"{self._origin}/v1/workers/request",
            data=body,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=self._timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib_error.HTTPError as error:
            self._raise_http_error(error)
        except (OSError, urllib_error.URLError) as error:
            raise MemoryWorkerClientError(
                "MEMORY_WORKER_UNAVAILABLE",
                f"Memory Worker RPC connection failed: {error}",
                True,
            ) from error

        if not isinstance(response_payload, dict) or response_payload.get("ok") is not True:
            raise MemoryWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Memory Worker RPC returned an invalid success envelope.",
                False,
            )
        result = response_payload.get("payload")
        if not isinstance(result, dict):
            raise MemoryWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Memory Worker RPC payload must be an object.",
                False,
            )
        return result

    def _raise_http_error(self, error: urllib_error.HTTPError) -> None:
        """Decode a structured Worker RPC HTTP error and raise a client exception."""

        try:
            payload = json.loads(error.read().decode("utf-8"))
            error_payload = payload.get("error", {}) if isinstance(payload, dict) else {}
            code = str(error_payload.get("code", "MEMORY_WORKER_FAILED"))
            message = str(error_payload.get("message", error.reason))
            retryable = bool(error_payload.get("retryable", error.code >= 500))
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            code = "MEMORY_WORKER_FAILED"
            message = str(error.reason)
            retryable = error.code >= 500
        raise MemoryWorkerClientError(code, message, retryable) from error


def _normalize_legacy_configuration(config: Mapping[str, Any]) -> dict[str, Any]:
    """Convert the old Mem0 configuration into the narrow Memory Worker contract."""

    embedder = _require_mapping(config.get("embedder"), "embedder")
    embedder_config = _require_mapping(embedder.get("config"), "embedder.config")
    llm = _require_mapping(config.get("llm"), "llm")
    llm_config = _require_mapping(llm.get("config"), "llm.config")
    vector_store = _require_mapping(config.get("vector_store"), "vector_store")
    vector_config = _require_mapping(vector_store.get("config"), "vector_store.config")
    vector_path = str(vector_config.get("path", "")).strip()
    memory_id = os.path.basename(os.path.normpath(vector_path)) if vector_path else ""
    return {
        "memoryId": memory_id,
        "embedder": {
            "model": embedder_config.get("model"),
            "apiKey": embedder_config.get("api_key", ""),
            "baseUrl": embedder_config.get("openai_base_url"),
            "dimensions": embedder_config.get("embedding_dims", 1024),
        },
        "llm": {
            "model": llm_config.get("model"),
            "apiKey": llm_config.get("api_key", ""),
            "baseUrl": llm_config.get("openai_base_url"),
        },
    }


def _require_mapping(value: Any, field_name: str) -> Mapping[str, Any]:
    """Validate one required configuration object."""

    if not isinstance(value, Mapping):
        raise ValueError(f"Memory configuration field '{field_name}' must be an object.")
    return value
