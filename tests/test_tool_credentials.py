# -*- coding: utf-8 -*-
"""Tests for Main-scoped MCP and custom HTTP credential boundaries."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import patch

from py import http_tool_credentials, mcp_credentials
from py.get_setting import redact_managed_credentials_for_renderer


def _encode_credentials(schema, credentials):
    """Encode one valid scoped credential runtime envelope."""

    payload = {"schema": schema, "credentials": credentials}
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class ToolCredentialTests(unittest.TestCase):
    """Verify independent MCP and custom HTTP runtime credential behavior."""

    def setUp(self):
        """Reset both credential caches before each test."""

        mcp_credentials._reset_mcp_credentials_cache_for_tests()
        http_tool_credentials._reset_http_tool_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment values and cached credentials."""

        os.environ.pop(mcp_credentials.MCP_CREDENTIAL_ENV, None)
        os.environ.pop(http_tool_credentials.HTTP_TOOL_CREDENTIAL_ENV, None)
        mcp_credentials._reset_mcp_credentials_cache_for_tests()
        http_tool_credentials._reset_http_tool_credentials_cache_for_tests()

    def test_mcp_runtime_hydrates_env_and_headers_then_redacts_persistence(self):
        """MCP credentials should exist only in the trusted in-memory server config."""

        encoded = _encode_credentials(
            mcp_credentials.MCP_CREDENTIAL_SCHEMA,
            {
                "alpha": {
                    "env": {"API_TOKEN": "stdio-secret"},
                    "headers": {"Authorization": "Bearer mcp-secret"},
                }
            },
        )
        with patch.dict(os.environ, {mcp_credentials.MCP_CREDENTIAL_ENV: encoded}):
            hydrated = mcp_credentials.apply_mcp_credentials({
                "mcpServers": {
                    "alpha": {
                        "command": "node",
                        "env": {"API_TOKEN": ""},
                        "headers": {
                            "Authorization": "",
                            "Content-Type": "application/json",
                        },
                    }
                }
            })
            server = hydrated["mcpServers"]["alpha"]
            self.assertEqual(server["env"]["API_TOKEN"], "stdio-secret")
            self.assertEqual(server["headers"]["Authorization"], "Bearer mcp-secret")
            self.assertNotIn(mcp_credentials.MCP_CREDENTIAL_ENV, os.environ)
            persisted = mcp_credentials.redact_mcp_credentials_for_persistence(hydrated)
            persisted_server = persisted["mcpServers"]["alpha"]
            self.assertEqual(persisted_server["env"]["API_TOKEN"], "")
            self.assertEqual(persisted_server["headers"]["Authorization"], "")
            self.assertEqual(persisted_server["headers"]["Content-Type"], "application/json")
            self.assertNotIn("mcp-secret", json.dumps(persisted))

    def test_mcp_worker_hydrates_only_requested_generic_server_headers(self):
        """验证 MCP Worker 只补齐指定 scope 的 header，不注入 stdio 环境且不修改公开配置。"""

        encoded = _encode_credentials(
            mcp_credentials.MCP_CREDENTIAL_SCHEMA,
            {
                "docs": {
                    "env": {"UNUSED_TOKEN": "stdio-only-secret"},
                    "headers": {"Authorization": "Bearer docs-secret"},
                },
                "issues": {
                    "headers": {"Authorization": "Bearer issues-secret"},
                },
            },
        )
        public_configuration = {
            "transport": "sse",
            "url": "https://mcp.example.test/sse",
            "headers": {"Accept": "text/event-stream"},
        }
        with patch.dict(os.environ, {mcp_credentials.MCP_CREDENTIAL_ENV: encoded}):
            hydrated = mcp_credentials.hydrate_mcp_runtime_server_config(
                "docs",
                public_configuration,
            )

        self.assertIsNot(hydrated, public_configuration)
        self.assertEqual(public_configuration["headers"], {"Accept": "text/event-stream"})
        self.assertEqual(hydrated["headers"]["Authorization"], "Bearer docs-secret")
        self.assertNotIn("issues-secret", json.dumps(hydrated))
        self.assertNotIn("UNUSED_TOKEN", hydrated)
        self.assertNotIn(mcp_credentials.MCP_CREDENTIAL_ENV, os.environ)

    def test_http_runtime_hydrates_headers_then_redacts_renderer_output(self):
        """Custom HTTP credentials should be restored by stable tool ID only."""

        encoded = _encode_credentials(
            http_tool_credentials.HTTP_TOOL_CREDENTIAL_SCHEMA,
            {"weather": {"Authorization": "Bearer weather-secret"}},
        )
        with patch.dict(os.environ, {http_tool_credentials.HTTP_TOOL_CREDENTIAL_ENV: encoded}):
            hydrated = http_tool_credentials.apply_http_tool_credentials({
                "custom_http": [{
                    "id": "weather",
                    "headers": '{"Authorization":"","Content-Type":"application/json"}',
                }]
            })
            headers = json.loads(hydrated["custom_http"][0]["headers"])
            self.assertEqual(headers["Authorization"], "Bearer weather-secret")
            renderer = redact_managed_credentials_for_renderer(hydrated)
            renderer_headers = json.loads(renderer["custom_http"][0]["headers"])
            self.assertEqual(renderer_headers["Authorization"], "")
            self.assertNotIn("weather-secret", json.dumps(renderer))

    def test_server_profile_preserves_existing_tool_credentials(self):
        """Processes without Main envelopes must retain Browser and Server settings."""

        settings = {
            "mcpServers": {"alpha": {"env": {"TOKEN": "browser-mcp"}}},
            "custom_http": [{
                "id": "weather",
                "headers": '{"Authorization":"browser-http"}',
            }],
        }
        mcp_credentials.apply_mcp_credentials(settings)
        http_tool_credentials.apply_http_tool_credentials(settings)
        self.assertEqual(settings["mcpServers"]["alpha"]["env"]["TOKEN"], "browser-mcp")
        self.assertIn("browser-http", settings["custom_http"][0]["headers"])

    def test_runtime_envelopes_reject_unknown_lanes_and_control_characters(self):
        """Unknown credential structures and header injection must fail closed."""

        invalid_cases = [
            (
                mcp_credentials.MCP_CREDENTIAL_ENV,
                mcp_credentials.MCP_CREDENTIAL_SCHEMA,
                {"alpha": {"unknown": {"TOKEN": "secret"}}},
                mcp_credentials.apply_mcp_credentials,
                {"mcpServers": {}},
            ),
            (
                http_tool_credentials.HTTP_TOOL_CREDENTIAL_ENV,
                http_tool_credentials.HTTP_TOOL_CREDENTIAL_SCHEMA,
                {"weather": {"Authorization": "Bearer secret\r\ninjected: true"}},
                http_tool_credentials.apply_http_tool_credentials,
                {"custom_http": []},
            ),
        ]
        for env_name, schema, credentials, apply, settings in invalid_cases:
            with self.subTest(env_name=env_name):
                self.setUp()
                encoded = _encode_credentials(schema, credentials)
                with patch.dict(os.environ, {env_name: encoded}):
                    with self.assertRaises(RuntimeError):
                        apply(settings)


if __name__ == "__main__":
    unittest.main()
