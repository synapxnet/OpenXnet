# -*- coding: utf-8 -*-
"""Tests for Connector Worker lifecycle, lazy loading, and secret boundaries."""

from __future__ import annotations

import base64
from collections.abc import Mapping
import importlib
import json
import os
import sys
import unittest
from unittest.mock import patch
from typing import Any

from py.connector_worker_client import ConnectorWorkerClient
from py.telegram_credentials import (
    TELEGRAM_CREDENTIAL_ENV,
    _reset_telegram_credentials_cache_for_tests,
)
from py.workers.connector_worker import ConnectorBinding, ConnectorWorkerHandlers


class FakeConnectorConfig:
    """Small configuration double preserving submitted fields as attributes."""

    def __init__(self, **values: Any) -> None:
        """Store submitted configuration fields for manager assertions."""

        self.__dict__.update(values)


class FakeConnectorManager:
    """Deterministic connector manager double with lifecycle counters."""

    def __init__(self) -> None:
        """Create one stopped manager with empty lifecycle history."""

        self.is_running = False
        self.config: FakeConnectorConfig | None = None
        self.start_count = 0
        self.stop_count = 0
        self.update_count = 0

    def start_bot(self, config: FakeConnectorConfig) -> None:
        """Record configuration and transition to running."""

        self.config = config
        self.start_count += 1
        self.is_running = True

    def stop_bot(self) -> None:
        """Record shutdown and transition to stopped."""

        self.stop_count += 1
        self.is_running = False

    def get_status(self) -> Mapping[str, Any]:
        """Return status containing data the Worker must remove or redact."""

        token = (
            getattr(self.config, "token", "")
            or getattr(self.config, "bot_token", "")
            if self.config
            else ""
        )
        return {
            "is_running": self.is_running,
            "config": {"token": token},
            "diagnostic": f"connected with {token}" if token else "stopped",
        }

    def update_behavior_config(self, config: FakeConnectorConfig) -> None:
        """Record one hot configuration update."""

        self.config = config
        self.update_count += 1


class FailingConnectorManager(FakeConnectorManager):
    """Manager double raising one credential-containing startup failure."""

    def start_bot(self, config: FakeConnectorConfig) -> None:
        """Raise an unsafe provider-style error containing the submitted token."""

        raise RuntimeError(f"provider rejected token {config.token}")


def create_bindings() -> Mapping[str, ConnectorBinding]:
    """Create one narrow binding map for dependency-free handler tests."""

    return {"slack": ConnectorBinding("fake.module", "FakeManager", "FakeConfig")}


def create_telegram_bindings() -> Mapping[str, ConnectorBinding]:
    """创建仅含 Telegram 的绑定映射；无输入，返回测试绑定且不导入真实 Manager。"""

    return {"telegram": ConnectorBinding("fake.module", "FakeManager", "FakeConfig")}


def encode_telegram_credentials(bot_token: str) -> str:
    """编码测试用 Telegram 凭据包；输入 Bot Token，返回 Base64 UTF-8 文本且不写入环境变量。"""

    payload = {
        "schema": "openxnet.telegram-credentials.runtime.v1",
        "credentials": {"botToken": bot_token},
    }
    return base64.b64encode(
        json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ).decode("ascii")


def load_fake_types(_binding: ConnectorBinding) -> tuple[type[Any], type[Any]]:
    """Return fake manager and configuration classes without importing an SDK."""

    return FakeConnectorManager, FakeConnectorConfig


class ConnectorWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """Validate lazy imports, lifecycle controls, and secret-safe statuses."""

    def test_status_does_not_load_unused_connector_sdk(self) -> None:
        """Keep a stopped status request from loading a platform SDK."""

        def reject_loader(_binding: ConnectorBinding) -> tuple[type[Any], type[Any]]:
            """Fail if a stopped status unexpectedly tries to import a manager."""

            raise AssertionError("status imported an unused connector")

        handlers = ConnectorWorkerHandlers(bindings=create_bindings(), type_loader=reject_loader)

        status = handlers.status({"platform": "slack"})

        self.assertFalse(status["is_running"])
        self.assertEqual(status["status"], "stopped")

    async def test_start_update_reload_and_stop_preserve_lifecycle(self) -> None:
        """Drive one connector lifecycle while injecting the active backend port."""

        handlers = ConnectorWorkerHandlers(
            bindings=create_bindings(),
            type_loader=load_fake_types,
        )
        with patch("py.workers.connector_worker.configure_host_port") as configure_port:
            started = await handlers.start(
                {
                    "platform": "slack",
                    "configuration": {"token": "secret-token", "mode": "one"},
                    "backendPort": 4567,
                }
            )
        updated = await handlers.update(
            {
                "platform": "slack",
                "configuration": {"token": "secret-token", "mode": "two"},
            }
        )
        reloaded = await handlers.reload(
            {
                "platform": "slack",
                "configuration": {"token": "new-secret", "mode": "three"},
                "backendPort": 4567,
            }
        )
        stopped = await handlers.stop({"platform": "slack"})

        configure_port.assert_called_once_with("127.0.0.1", 4567)
        self.assertTrue(started["is_running"])
        self.assertNotIn("config", started)
        self.assertNotIn("secret-token", str(started))
        self.assertTrue(updated["updated"])
        self.assertTrue(reloaded["is_running"])
        self.assertFalse(stopped["is_running"])

    async def test_startup_errors_redact_submitted_credentials(self) -> None:
        """Prevent manager exceptions from returning a submitted connector token."""

        def load_failing_types(_binding: ConnectorBinding) -> tuple[type[Any], type[Any]]:
            """Return the failing manager and fake configuration classes."""

            return FailingConnectorManager, FakeConnectorConfig

        handlers = ConnectorWorkerHandlers(
            bindings=create_bindings(),
            type_loader=load_failing_types,
        )
        with self.assertRaises(RuntimeError) as captured:
            await handlers.start(
                {
                    "platform": "slack",
                    "configuration": {"token": "secret-token"},
                    "backendPort": 4567,
                }
            )

        self.assertNotIn("secret-token", str(captured.exception))
        self.assertIn("[redacted]", str(captured.exception))

    async def test_telegram_uses_its_independent_credential_envelope(self) -> None:
        """验证 Telegram Token 只由独立环境凭据包注入，并从状态结果和原始配置中隔离。"""

        token = "123456:telegram-secret-token"
        configuration = {
            "TelegramAgent": "openxnet-model",
            "memoryLimit": 20,
            "separators": ["。"],
            "reasoningVisible": False,
            "quickRestart": True,
            "enableTTS": False,
            "wakeWord": "",
            "behaviorTargetChatIds": [],
        }
        handlers = ConnectorWorkerHandlers(
            bindings=create_telegram_bindings(),
            type_loader=load_fake_types,
        )
        _reset_telegram_credentials_cache_for_tests()
        try:
            with (
                patch.dict(
                    os.environ,
                    {TELEGRAM_CREDENTIAL_ENV: encode_telegram_credentials(token)},
                    clear=False,
                ),
                patch("py.workers.connector_worker.configure_host_port"),
            ):
                status = await handlers.start(
                    {
                        "platform": "telegram",
                        "configuration": configuration,
                        "backendPort": 4567,
                    }
                )
            manager = handlers._managers["telegram"]
            self.assertEqual(manager.config.bot_token, token)
            self.assertNotIn("bot_token", configuration)
            self.assertNotIn(token, str(status))
        finally:
            _reset_telegram_credentials_cache_for_tests()

    async def test_rejects_unknown_platform_and_oversized_configuration(self) -> None:
        """Enforce the platform allow-list and configuration size budget."""

        handlers = ConnectorWorkerHandlers(
            bindings=create_bindings(),
            type_loader=load_fake_types,
            max_config_bytes=32,
        )
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            handlers.status({"platform": "unknown"})
        with self.assertRaisesRegex(ValueError, "size limit"):
            await handlers.start(
                {
                    "platform": "slack",
                    "configuration": {"token": "x" * 64},
                    "backendPort": 4567,
                }
            )


class RecordingConnectorWorkerClient(ConnectorWorkerClient):
    """Client double recording RPC calls without opening a socket."""

    def __init__(self) -> None:
        """Create one configured client and empty request history."""

        super().__init__("http://127.0.0.1:1", "worker-token")
        self.requests: list[tuple[str, Mapping[str, Any]]] = []

    def _request_sync(self, method: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Record one request and return deterministic status."""

        self.requests.append((method, payload))
        return {
            "platform": str(payload["platform"]),
            "is_running": method not in {"connectors.stop"},
        }


class ConnectorWorkerClientTests(unittest.IsolatedAsyncioTestCase):
    """Validate activation avoidance and client-side secret redaction."""

    async def test_status_avoids_worker_activation_until_start(self) -> None:
        """Return local stopped state before the first successful start request."""

        client = RecordingConnectorWorkerClient()

        initial = await client.status("slack")
        await client.start("slack", {"bot_token": "secret-token"})
        running = await client.status("slack")
        stopped = await client.stop("slack")

        self.assertFalse(initial["is_running"])
        self.assertEqual(client.requests[0][0], "connectors.start")
        self.assertEqual(client.requests[1][0], "connectors.status")
        self.assertEqual(client.requests[2][0], "connectors.stop")
        self.assertTrue(running["is_running"])
        self.assertFalse(stopped["is_running"])

    def test_client_error_redaction_uses_sensitive_field_names(self) -> None:
        """Redact nested token and secret values from downstream messages."""

        client = RecordingConnectorWorkerClient()
        message = client._redact_payload_secrets(
            "failed secret-token and app-secret",
            {
                "configuration": {
                    "bot_token": "secret-token",
                    "appSecret": "app-secret",
                }
            },
        )

        self.assertEqual(message, "failed [redacted] and [redacted]")

    async def test_compatibility_update_projects_behavior_and_tool_switch(self) -> None:
        """验证兼容热更新同时投影行为设置与工具链接开关，且 QQ 不接收无关行为字段。"""

        client = RecordingConnectorWorkerClient()
        client._active_platforms.update({"qq", "slack"})
        results = await client.update_running(
            {
                "behaviorSettings": {"enabled": True},
                "tools": {"toolMemorandum": {"enabled": True}},
                "qqBotConfig": {"QQAgent": "model"},
                "slackBotConfig": {"llm_model": "model"},
            }
        )

        self.assertEqual(set(results), {"qq", "slack"})
        qq_payload = client.requests[0][1]["configuration"]
        slack_payload = client.requests[1][1]["configuration"]
        self.assertTrue(qq_payload["toolMemorandumEnabled"])
        self.assertNotIn("behaviorSettings", qq_payload)
        self.assertTrue(slack_payload["toolMemorandumEnabled"])
        self.assertEqual(slack_payload["behaviorSettings"], {"enabled": True})


class RecordingRouteConnectorClient:
    """Async route client double recording platform configuration."""

    def __init__(self) -> None:
        """Create empty route request history."""

        self.starts: list[tuple[str, Mapping[str, Any]]] = []

    async def start(
        self,
        platform_name: str,
        configuration: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Record one connector start request."""

        self.starts.append((platform_name, configuration))
        return {"platform": platform_name, "is_running": True}

    async def status(self, platform_name: str) -> Mapping[str, Any]:
        """Return one deterministic route status."""

        return {"platform": platform_name, "is_running": False, "status": "stopped"}


class ConnectorCompatibilityRouteTests(unittest.IsolatedAsyncioTestCase):
    """Validate legacy bot routes without importing optional SDK modules."""

    def test_route_module_import_does_not_load_connector_sdks(self) -> None:
        """Keep all optional SDK roots unloaded while registering FastAPI routes."""

        module_names = ("botpy", "lark_oapi", "dingtalk_stream", "discord", "slack_sdk")
        before = {name for name in module_names if name in sys.modules}
        importlib.import_module("py.routes.bots")
        after = {name for name in module_names if name in sys.modules}

        self.assertEqual(after, before)

    async def test_slack_start_and_status_delegate_to_connector_client(self) -> None:
        """Preserve Slack route envelopes while forwarding raw configuration."""

        from py.routes.bots import slack_bot_status, start_slack_bot

        client = RecordingRouteConnectorClient()
        configuration = {"bot_token": "secret-token", "app_token": "app-secret"}
        with patch("py.routes.bots.get_connector_worker_client", return_value=client):
            started = await start_slack_bot(configuration)
            status = await slack_bot_status()

        self.assertTrue(started["success"])
        self.assertEqual(client.starts, [("slack", configuration)])
        self.assertEqual(status["status"], "stopped")


if __name__ == "__main__":
    unittest.main()
