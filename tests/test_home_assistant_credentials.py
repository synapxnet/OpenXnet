# -*- coding: utf-8 -*-
"""Tests for Home Assistant credential isolation and MCP transport hardening."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import patch

from py import home_assistant_credentials
from py import mcp_clients
from py.routes import mcp_control


def _encode_credentials(credentials):
    """Encode one valid Home Assistant runtime credential envelope."""

    payload = {
        "schema": home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class HomeAssistantCredentialTests(unittest.TestCase):
    """Verify strict Home Assistant hydration and persistence redaction."""

    def setUp(self):
        """Reset cached credential state before each isolated test."""

        home_assistant_credentials._reset_home_assistant_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment state after each isolated test."""

        os.environ.pop(home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV, None)
        home_assistant_credentials._reset_home_assistant_credentials_cache_for_tests()

    def test_runtime_hydrates_only_home_assistant_token(self):
        """Inject the Home Assistant token while retaining public endpoint metadata."""

        encoded = _encode_credentials({"api_key": "home-assistant-secret"})
        with patch.dict(
            os.environ,
            {home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV: encoded},
        ):
            settings = home_assistant_credentials.apply_home_assistant_credentials({
                "HASettings": {
                    "enabled": True,
                    "api_key": "",
                    "url": "http://127.0.0.1:8123",
                },
                "comfyuiAPIkey": "separate-zone",
            })

        configuration = settings["HASettings"]
        self.assertEqual(configuration["api_key"], "home-assistant-secret")
        self.assertEqual(configuration["url"], "http://127.0.0.1:8123")
        self.assertEqual(settings["comfyuiAPIkey"], "separate-zone")
        self.assertNotIn(home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV, os.environ)

    def test_runtime_redacts_home_assistant_token_for_persistence(self):
        """Clear the hydrated token while retaining configured metadata."""

        encoded = _encode_credentials({"api_key": "home-assistant-secret"})
        with patch.dict(
            os.environ,
            {home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV: encoded},
        ):
            runtime = home_assistant_credentials.apply_home_assistant_credentials({
                "HASettings": {"api_key": "", "url": "http://localhost:8123"},
            })
            redacted = home_assistant_credentials.redact_home_assistant_credentials_for_persistence(
                runtime,
            )

        self.assertEqual(redacted["HASettings"]["api_key"], "")
        self.assertEqual(
            redacted["HASettings"]["homeAssistantCredentialFieldsConfigured"],
            ["api_key"],
        )
        self.assertNotIn("home-assistant-secret", json.dumps(redacted))

    def test_process_without_main_envelope_preserves_server_configuration(self):
        """Retain plaintext Home Assistant settings for non-Desktop Server profiles."""

        settings = home_assistant_credentials.apply_home_assistant_credentials({
            "HASettings": {"api_key": "server-secret"},
        })
        self.assertEqual(settings["HASettings"]["api_key"], "server-secret")

    def test_runtime_envelope_rejects_unknown_fields_and_short_secrets(self):
        """Fail closed for unrelated trust zones and undersized tokens."""

        invalid_cases = [
            {"comfyuiAPIkey": "wrong-zone"},
            {"api_key": "abc"},
        ]
        for credentials in invalid_cases:
            with self.subTest(credentials=credentials):
                self.setUp()
                encoded = _encode_credentials(credentials)
                with patch.dict(
                    os.environ,
                    {home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV: encoded},
                ):
                    with self.assertRaises(RuntimeError):
                        home_assistant_credentials.apply_home_assistant_credentials({
                            "HASettings": {},
                        })


class _FakeRequest:
    """Minimal request object that returns one synthetic JSON body."""

    def __init__(self, payload):
        """Store the synthetic route payload."""

        self.payload = payload

    async def json(self):
        """Return the synthetic route payload."""

        return self.payload


class _FakeMcpClient:
    """Synthetic MCP client used to inspect Home Assistant configuration."""

    latest = None

    def __init__(self):
        """Create one disconnected synthetic client."""

        self.config = None
        self.closed = False
        type(self).latest = self

    async def initialize(self, _name, configuration, on_failure_callback=None):
        """Capture one Home Assistant MCP initialization request."""

        self.config = configuration
        self.on_failure_callback = on_failure_callback

    async def close(self):
        """Record synthetic client cleanup."""

        self.closed = True


class _FailingMcpClient(_FakeMcpClient):
    """Synthetic MCP client that reflects its token in an exception."""

    async def initialize(self, _name, configuration, on_failure_callback=None):
        """Raise one credential-bearing transport failure."""

        self.config = configuration
        secret = configuration["headers"]["Authorization"]
        raise RuntimeError(f"connection failed with {secret}")


async def _timeout_immediately(awaitable, timeout):
    """Close one unused coroutine and model a successful quiet connection window."""

    del timeout
    close = getattr(awaitable, "close", None)
    if callable(close):
        close()
    raise TimeoutError


class HomeAssistantRouteSecurityTests(unittest.IsolatedAsyncioTestCase):
    """Verify strict Home Assistant URLs, redirection, and error boundaries."""

    def setUp(self):
        """Reset process credentials and route singletons before each test."""

        home_assistant_credentials._reset_home_assistant_credentials_cache_for_tests()
        _FakeMcpClient.latest = None
        mcp_control.configure_mcp_control_routes(
            ha_client_ref=lambda: None,
            ha_client_setter_ref=lambda _client: None,
            chrome_mcp_client_ref=lambda: None,
            chrome_mcp_client_setter_ref=lambda _client: None,
            sql_client_ref=lambda: None,
            sql_client_setter_ref=lambda _client: None,
        )

    def tearDown(self):
        """Remove environment and cached credential state after each test."""

        os.environ.pop(home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV, None)
        home_assistant_credentials._reset_home_assistant_credentials_cache_for_tests()

    def test_url_policy_allows_loopback_http_and_external_https(self):
        """Reject public cleartext, userinfo, query, and fragment Home Assistant URLs."""

        self.assertEqual(
            mcp_control.build_home_assistant_sse_url("http://127.0.0.1:8123/api"),
            "http://127.0.0.1:8123/api/mcp_server/sse",
        )
        self.assertEqual(
            mcp_control.build_home_assistant_sse_url("https://ha.example.test"),
            "https://ha.example.test/mcp_server/sse",
        )
        for url in [
            "http://ha.example.test",
            "https://user:password@ha.example.test",
            "https://ha.example.test?token=secret",
            "https://ha.example.test#secret",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                mcp_control.build_home_assistant_sse_url(url)

    async def test_start_route_hydrates_token_and_disables_redirects(self):
        """Use the Main-owned token without accepting it from the Desktop request body."""

        secret = "home-assistant-secret"
        encoded = _encode_credentials({"api_key": secret})
        with (
            patch.dict(
                os.environ,
                {home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV: encoded},
            ),
            patch.object(mcp_control, "McpClient", _FakeMcpClient),
            patch.object(mcp_control.asyncio, "wait_for", _timeout_immediately),
        ):
            response = await mcp_control.start_HA(_FakeRequest({
                "data": {
                    "enabled": True,
                    "api_key": "",
                    "url": "http://localhost:8123",
                },
            }))

        body = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body, {"status": "ready", "enabled": True})
        self.assertEqual(
            _FakeMcpClient.latest.config["headers"]["Authorization"],
            f"Bearer {secret}",
        )
        self.assertEqual(_FakeMcpClient.latest.config["follow_redirects"], False)
        self.assertNotIn(secret, response.body.decode("utf-8"))

    async def test_start_route_replaces_errors_and_closes_failed_client(self):
        """Close a failed client and replace credential-bearing transport errors."""

        secret = "home-assistant-secret"
        encoded = _encode_credentials({"api_key": secret})
        with (
            patch.dict(
                os.environ,
                {home_assistant_credentials.HOME_ASSISTANT_CREDENTIAL_ENV: encoded},
            ),
            patch.object(mcp_control, "McpClient", _FailingMcpClient),
        ):
            response = await mcp_control.start_HA(_FakeRequest({
                "data": {"api_key": "", "url": "https://ha.example.test"},
            }))

        body = json.loads(response.body)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(body, {"error": "Home Assistant connection failed."})
        self.assertTrue(_FailingMcpClient.latest.closed)
        self.assertNotIn(secret, response.body.decode("utf-8"))

    async def test_no_redirect_mcp_client_factory_disables_redirects(self):
        """Construct the shared HTTP transport with redirects disabled."""

        client = mcp_clients.create_no_redirect_http_client()
        try:
            self.assertFalse(client.follow_redirects)
        finally:
            await client.aclose()


if __name__ == "__main__":
    unittest.main()
