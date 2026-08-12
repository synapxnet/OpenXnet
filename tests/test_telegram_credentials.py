# -*- coding: utf-8 -*-
"""Tests for Main-scoped Telegram credentials and safe terminal delivery."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import patch

from py import telegram_credentials
from py.delivery import _deliver_telegram
from py.telegram_bot_manager import TelegramBotManager


def _encode_credentials(credentials):
    """Encode one valid Telegram runtime credential envelope."""

    payload = {
        "schema": telegram_credentials.TELEGRAM_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class _FakeTelegramResponse:
    """Minimal Telegram API response used by delivery tests."""

    status_code = 401

    def __init__(self, payload):
        """Store one synthetic Telegram response body."""

        self._payload = payload

    def json(self):
        """Return the synthetic Telegram response body."""

        return dict(self._payload)


class _FakeTelegramHttpClient:
    """Capture Telegram delivery requests without opening a network socket."""

    def __init__(self, response=None, error=None):
        """Configure one response or transport error."""

        self.response = response
        self.error = error
        self.request_url = ""
        self.request_json = None

    async def __aenter__(self):
        """Enter the synthetic async HTTP context."""

        return self

    async def __aexit__(self, exc_type, exc, traceback):
        """Exit the synthetic async HTTP context without suppression."""

        return False

    async def post(self, url, json):
        """Capture one request and return or raise the configured outcome."""

        self.request_url = url
        self.request_json = dict(json)
        if self.error is not None:
            raise self.error
        return self.response


class TelegramCredentialTests(unittest.TestCase):
    """Verify strict process hydration and persistence redaction."""

    def setUp(self):
        """Reset cached credential state before each isolated test."""

        telegram_credentials._reset_telegram_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment state after each isolated test."""

        os.environ.pop(telegram_credentials.TELEGRAM_CREDENTIAL_ENV, None)
        telegram_credentials._reset_telegram_credentials_cache_for_tests()

    def test_runtime_hydrates_canonical_settings_and_route_configuration(self):
        """Inject one token into both trusted configuration consumers."""

        encoded = _encode_credentials({"botToken": "123456:telegram-secret"})
        with patch.dict(os.environ, {telegram_credentials.TELEGRAM_CREDENTIAL_ENV: encoded}):
            settings = telegram_credentials.apply_telegram_credentials({
                "telegramBotConfig": {
                    "bot_token": "",
                    "credentialFieldsConfigured": ["bot_token"],
                    "behaviorTargetChatIds": ["100"],
                },
            })
            configuration = telegram_credentials.apply_telegram_credential_to_configuration({
                "bot_token": "",
                "credentialFieldsConfigured": ["bot_token"],
                "TelegramAgent": "openxnet-model",
            })

        self.assertEqual(
            settings["telegramBotConfig"]["bot_token"],
            "123456:telegram-secret",
        )
        self.assertEqual(configuration["bot_token"], "123456:telegram-secret")
        self.assertNotIn("credentialFieldsConfigured", configuration)
        self.assertNotIn(telegram_credentials.TELEGRAM_CREDENTIAL_ENV, os.environ)

    def test_runtime_redacts_persistence_and_renderer_payloads(self):
        """Remove the hydrated token while retaining configured-only state."""

        encoded = _encode_credentials({"botToken": "123456:telegram-secret"})
        with patch.dict(os.environ, {telegram_credentials.TELEGRAM_CREDENTIAL_ENV: encoded}):
            runtime = telegram_credentials.apply_telegram_credentials({
                "telegramBotConfig": {"bot_token": ""},
                "telegramBot": {"bot_token": "obsolete-copy"},
            })
            redacted = telegram_credentials.redact_telegram_credentials_for_persistence(runtime)

        self.assertEqual(redacted["telegramBotConfig"]["bot_token"], "")
        self.assertEqual(redacted["telegramBot"]["bot_token"], "")
        self.assertEqual(
            redacted["telegramBotConfig"]["credentialFieldsConfigured"],
            ["bot_token"],
        )
        self.assertNotIn("telegram-secret", json.dumps(redacted))

    def test_process_without_main_envelope_preserves_server_configuration(self):
        """Retain plaintext configuration for non-Desktop Server deployments."""

        settings = telegram_credentials.apply_telegram_credentials({
            "telegramBotConfig": {"bot_token": "server-token"},
        })
        configuration = telegram_credentials.apply_telegram_credential_to_configuration({
            "bot_token": "route-token",
        })

        self.assertEqual(settings["telegramBotConfig"]["bot_token"], "server-token")
        self.assertEqual(configuration["bot_token"], "route-token")

    def test_runtime_envelope_rejects_unknown_fields_and_short_tokens(self):
        """Fail closed for unexpected fields and undersized token values."""

        invalid_cases = [
            {"token": "123456:wrong-field"},
            {"botToken": "abc"},
        ]
        for credentials in invalid_cases:
            with self.subTest(credentials=credentials):
                self.setUp()
                encoded = _encode_credentials(credentials)
                with patch.dict(os.environ, {telegram_credentials.TELEGRAM_CREDENTIAL_ENV: encoded}):
                    with self.assertRaises(RuntimeError):
                        telegram_credentials.apply_telegram_credentials({})

    def test_manager_status_omits_configuration_and_raw_startup_errors(self):
        """Keep token-bearing manager configuration out of status responses."""

        manager = TelegramBotManager()
        manager.config = {"bot_token": "123456:telegram-secret"}
        manager._startup_error = "RuntimeError"
        status = manager.get_status()

        self.assertNotIn("config", status)
        self.assertNotIn("startup_error", status)
        self.assertEqual(status["error_type"], "RuntimeError")
        self.assertNotIn("telegram-secret", json.dumps(status))


class TelegramDeliveryTests(unittest.IsolatedAsyncioTestCase):
    """Verify canonical settings lookup and credential-safe delivery failures."""

    async def test_delivery_uses_canonical_settings_without_reflecting_api_description(self):
        """Use telegramBotConfig and replace a credential-bearing API error."""

        secret = "123456:telegram-secret"
        client = _FakeTelegramHttpClient(
            response=_FakeTelegramResponse({
                "ok": False,
                "description": f"Unauthorized token {secret}",
            }),
        )
        payload = {
            "status": "completed",
            "title": "Task",
            "result": "Done",
            "description": "",
            "_settings": {
                "telegramBotConfig": {
                    "bot_token": secret,
                    "behaviorTargetChatIds": ["100"],
                },
            },
        }
        with patch("httpx.AsyncClient", return_value=client):
            result = await _deliver_telegram(payload, {"config": {}})

        self.assertIn(secret, client.request_url)
        self.assertEqual(client.request_json["chat_id"], "100")
        self.assertEqual(result["error"], "Telegram API rejected delivery")
        self.assertNotIn(secret, json.dumps(result))
        self.assertNotIn("Unauthorized", json.dumps(result))

    async def test_delivery_replaces_transport_exception_text(self):
        """Prevent a transport exception from reflecting its credential-bearing text."""

        secret = "123456:telegram-secret"
        client = _FakeTelegramHttpClient(error=RuntimeError(f"failed URL with {secret}"))
        payload = {
            "status": "failed",
            "title": "Task",
            "error": "Failed",
            "description": "",
            "_settings": {
                "telegramBotConfig": {
                    "bot_token": secret,
                    "behaviorTargetChatIds": ["100"],
                },
            },
        }
        with patch("httpx.AsyncClient", return_value=client):
            result = await _deliver_telegram(payload, {"config": {}})

        self.assertEqual(result["error"], "Telegram delivery request failed")
        self.assertNotIn(secret, json.dumps(result))


if __name__ == "__main__":
    unittest.main()
