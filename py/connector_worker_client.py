# -*- coding: utf-8 -*-
"""Legacy-backend adapter for authenticated Connector Worker RPC."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import json
import os
import threading
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from py.get_setting import get_port


SUPPORTED_CONNECTOR_PLATFORMS = ("qq", "feishu", "dingtalk", "discord", "slack")
CONNECTOR_SETTINGS_KEYS = {
    "qq": "qqBotConfig",
    "feishu": "feishuBotConfig",
    "dingtalk": "dingtalkBotConfig",
    "discord": "discordBotConfig",
    "slack": "slackBotConfig",
}


class ConnectorWorkerClientError(RuntimeError):
    """Structured Connector Worker failure safe for compatibility routes."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        """Create a client error from a Worker RPC response."""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class ConnectorWorkerClient:
    """Forward connector lifecycle controls through the authenticated Core gateway."""

    def __init__(self, origin: str, token: str, *, timeout_seconds: float = 125.0) -> None:
        """Create a client from Electron-provided loopback configuration."""

        self._origin = origin.rstrip("/")
        self._token = token
        self._timeout_seconds = timeout_seconds
        self._active_platforms: set[str] = set()

    @classmethod
    def from_environment(cls) -> "ConnectorWorkerClient":
        """Construct a client from the legacy backend launch environment."""

        origin = os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", "").strip()
        token = os.environ.get("OPENXNET_WORKER_RPC_TOKEN", "").strip()
        return cls(origin, token)

    @property
    def configured(self) -> bool:
        """Return whether Electron supplied the private RPC origin and token."""

        return bool(self._origin and self._token)

    @property
    def active_platforms(self) -> frozenset[str]:
        """Return connectors successfully started during this backend session."""

        return frozenset(self._active_platforms)

    async def start(
        self,
        platform_name: str,
        configuration: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Start one connector and remember it for status and hot updates."""

        normalized = self._normalize_platform(platform_name)
        response = await asyncio.to_thread(
            self._request_sync,
            "connectors.start",
            {
                "platform": normalized,
                "configuration": dict(configuration),
                "backendPort": get_port(),
            },
        )
        self._active_platforms.add(normalized)
        return response

    async def stop(self, platform_name: str) -> Mapping[str, Any]:
        """Stop one active connector without activating an unused Worker."""

        normalized = self._normalize_platform(platform_name)
        if normalized not in self._active_platforms:
            return self._stopped_status(normalized)
        response = await asyncio.to_thread(
            self._request_sync,
            "connectors.stop",
            {"platform": normalized},
        )
        self._active_platforms.discard(normalized)
        return response

    async def status(self, platform_name: str) -> Mapping[str, Any]:
        """Return local stopped state or query a connector known to be active."""

        normalized = self._normalize_platform(platform_name)
        if normalized not in self._active_platforms:
            return self._stopped_status(normalized)
        response = await asyncio.to_thread(
            self._request_sync,
            "connectors.status",
            {"platform": normalized},
        )
        if response.get("is_running") is not True:
            self._active_platforms.discard(normalized)
        return response

    async def reload(
        self,
        platform_name: str,
        configuration: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Restart one connector with new configuration in the same Worker."""

        normalized = self._normalize_platform(platform_name)
        response = await asyncio.to_thread(
            self._request_sync,
            "connectors.reload",
            {
                "platform": normalized,
                "configuration": dict(configuration),
                "backendPort": get_port(),
            },
        )
        self._active_platforms.add(normalized)
        return response

    async def update_running(
        self,
        settings: Mapping[str, Any],
    ) -> Mapping[str, Mapping[str, Any]]:
        """热更新本会话活动平台；输入完整兼容设置，返回逐平台结果，未活动平台不发起 RPC。"""

        behavior_settings = settings.get("behaviorSettings", {})
        tools_settings = settings.get("tools", {})
        tool_memorandum_enabled = False
        if isinstance(tools_settings, Mapping):
            memorandum_settings = tools_settings.get("toolMemorandum", {})
            if isinstance(memorandum_settings, Mapping):
                tool_memorandum_enabled = memorandum_settings.get("enabled") is True
        results: dict[str, Mapping[str, Any]] = {}
        for platform_name, settings_key in CONNECTOR_SETTINGS_KEYS.items():
            if platform_name not in self._active_platforms:
                continue
            raw_configuration = settings.get(settings_key, {})
            if not isinstance(raw_configuration, Mapping):
                results[platform_name] = {"updated": False, "code": "INVALID_CONFIGURATION"}
                continue
            configuration = dict(raw_configuration)
            if platform_name != "qq":
                configuration["behaviorSettings"] = behavior_settings
            configuration["toolMemorandumEnabled"] = tool_memorandum_enabled
            try:
                results[platform_name] = await asyncio.to_thread(
                    self._request_sync,
                    "connectors.update",
                    {"platform": platform_name, "configuration": configuration},
                )
            except ConnectorWorkerClientError as error:
                results[platform_name] = {"updated": False, "code": error.code}
        return results

    def _normalize_platform(self, value: str) -> str:
        """Normalize and validate one connector platform name."""

        if not isinstance(value, str) or not value.strip():
            raise ConnectorWorkerClientError(
                "INVALID_CONNECTOR_PLATFORM",
                "Connector platform must be non-empty text.",
                False,
            )
        normalized = value.strip().lower()
        if normalized not in SUPPORTED_CONNECTOR_PLATFORMS:
            raise ConnectorWorkerClientError(
                "INVALID_CONNECTOR_PLATFORM",
                f"Unsupported connector platform '{normalized}'.",
                False,
            )
        return normalized

    def _stopped_status(self, platform_name: str) -> Mapping[str, Any]:
        """Return the compatibility status for a connector never activated."""

        return {"platform": platform_name, "is_running": False, "status": "stopped"}

    def _require_configuration(self) -> None:
        """Reject connector activation when Electron RPC is unavailable."""

        if not self.configured:
            raise ConnectorWorkerClientError(
                "CONNECTOR_WORKER_UNAVAILABLE",
                "Connector Worker RPC is not configured for this backend process.",
                True,
            )

    def _request_sync(
        self,
        method: str,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Perform one blocking Connector Worker request for a background thread."""

        self._require_configuration()
        body = json.dumps(
            {"capability": "connectors", "method": method, "payload": dict(payload)},
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
            self._raise_http_error(error, payload)
        except (OSError, urllib_error.URLError) as error:
            raise ConnectorWorkerClientError(
                "CONNECTOR_WORKER_UNAVAILABLE",
                "Connector Worker RPC connection failed.",
                True,
            ) from error
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ConnectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Connector Worker RPC returned invalid UTF-8 JSON.",
                False,
            ) from error

        if not isinstance(response_payload, dict) or response_payload.get("ok") is not True:
            raise ConnectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Connector Worker RPC returned an invalid success envelope.",
                False,
            )
        result = response_payload.get("payload")
        if not isinstance(result, dict):
            raise ConnectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Connector Worker RPC payload must be an object.",
                False,
            )
        return result

    def _raise_http_error(
        self,
        error: urllib_error.HTTPError,
        request_payload: Mapping[str, Any],
    ) -> None:
        """Decode one structured HTTP error and redact submitted credentials."""

        try:
            payload = json.loads(error.read().decode("utf-8"))
            error_payload = payload.get("error", {}) if isinstance(payload, dict) else {}
            code = str(error_payload.get("code", "CONNECTOR_WORKER_FAILED"))
            message = str(error_payload.get("message", error.reason))
            retryable = bool(error_payload.get("retryable", error.code >= 500))
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            code = "CONNECTOR_WORKER_FAILED"
            message = str(error.reason)
            retryable = error.code >= 500
        safe_message = self._redact_payload_secrets(message, request_payload)
        raise ConnectorWorkerClientError(code, safe_message, retryable) from error

    def _redact_payload_secrets(
        self,
        message: str,
        payload: Mapping[str, Any],
    ) -> str:
        """Replace sensitive submitted values if a downstream error repeats them."""

        secret_values: set[str] = set()
        pending: list[tuple[str, Any]] = [("", payload)]
        while pending:
            field_name, candidate = pending.pop()
            if isinstance(candidate, Mapping):
                pending.extend((str(key), item) for key, item in candidate.items())
            elif isinstance(candidate, list):
                pending.extend((field_name, item) for item in candidate)
            elif self._is_sensitive_field(field_name) and isinstance(candidate, str):
                if len(candidate) >= 4:
                    secret_values.add(candidate)
        sanitized = message
        for secret in sorted(secret_values, key=len, reverse=True):
            sanitized = sanitized.replace(secret, "[redacted]")
        return sanitized

    def _is_sensitive_field(self, field_name: str) -> bool:
        """Return whether one payload field conventionally stores a credential."""

        normalized = "".join(character for character in field_name.lower() if character.isalnum())
        return any(marker in normalized for marker in ("secret", "token", "password"))


_connector_client: ConnectorWorkerClient | None = None
_connector_client_lock = threading.Lock()


def get_connector_worker_client() -> ConnectorWorkerClient:
    """Return the process-wide Connector Worker client for route state tracking."""

    global _connector_client
    with _connector_client_lock:
        if _connector_client is None:
            _connector_client = ConnectorWorkerClient.from_environment()
        return _connector_client
