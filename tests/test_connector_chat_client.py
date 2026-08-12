# -*- coding: utf-8 -*-
"""Tests for the Connector Worker private Chat client boundary."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch, sentinel
import unittest

from py.connector_chat_client import (
    ConnectorChatConfigurationError,
    create_connector_chat_client,
    resolve_connector_chat_endpoint,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONNECTOR_MANAGER_FILES = (
    "qq_bot_manager.py",
    "feishu_bot_manager.py",
    "dingtalk_bot_manager.py",
    "discord_bot_manager.py",
    "slack_bot_manager.py",
)


class ConnectorChatClientTests(unittest.TestCase):
    """Validate private endpoint handling and five-platform client adoption."""

    def test_private_client_uses_exact_environment_configuration(self) -> None:
        """Pass the random Connector token only as the OpenAI bearer credential."""

        environment = {
            "OPENXNET_CONNECTOR_CHAT_ORIGIN": "http://127.0.0.1:4567/",
            "OPENXNET_CONNECTOR_CHAT_TOKEN": "connector-private-token",
        }
        with patch.dict(os.environ, environment, clear=False):
            with patch("py.connector_chat_client.AsyncOpenAI", return_value=sentinel.client) as factory:
                client = create_connector_chat_client()

        self.assertIs(client, sentinel.client)
        factory.assert_called_once_with(
            api_key="connector-private-token",
            base_url="http://127.0.0.1:4567/v1",
        )

    def test_server_profile_retains_local_compatibility_endpoint(self) -> None:
        """Fall back to the active Server port only when both private values are absent."""

        with patch.dict(
            os.environ,
            {
                "OPENXNET_CONNECTOR_CHAT_ORIGIN": "",
                "OPENXNET_CONNECTOR_CHAT_TOKEN": "",
            },
            clear=False,
        ):
            with patch("py.connector_chat_client.get_port", return_value=6789):
                endpoint = resolve_connector_chat_endpoint()

        self.assertEqual(endpoint, ("http://127.0.0.1:6789", "openxnet-local"))

    def test_private_configuration_fails_closed(self) -> None:
        """Reject incomplete, remote, credential-bearing, and short-token endpoints."""

        invalid_configurations = (
            ("http://127.0.0.1:4567", ""),
            ("https://127.0.0.1:4567", "connector-private-token"),
            ("http://example.com:4567", "connector-private-token"),
            ("http://user:pass@127.0.0.1:4567", "connector-private-token"),
            ("http://127.0.0.1:4567/path", "connector-private-token"),
            ("http://127.0.0.1:4567", "short"),
        )
        for origin, token in invalid_configurations:
            with self.subTest(origin=origin, token_length=len(token)):
                with patch.dict(
                    os.environ,
                    {
                        "OPENXNET_CONNECTOR_CHAT_ORIGIN": origin,
                        "OPENXNET_CONNECTOR_CHAT_TOKEN": token,
                    },
                    clear=False,
                ):
                    with self.assertRaises(ConnectorChatConfigurationError):
                        resolve_connector_chat_endpoint()

    def test_all_connector_managers_use_the_private_client_factory(self) -> None:
        """Prevent any platform manager from rebuilding an unauthenticated Chat URL."""

        for file_name in CONNECTOR_MANAGER_FILES:
            source = (PROJECT_ROOT / "py" / file_name).read_text(encoding="utf-8")
            with self.subTest(file_name=file_name):
                self.assertIn("create_connector_chat_client", source)
                self.assertNotIn("from openai import AsyncOpenAI", source)
                self.assertNotIn("AsyncOpenAI(", source)


if __name__ == "__main__":
    unittest.main()
