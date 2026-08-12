# -*- coding: utf-8 -*-
"""Tests for the Main-scoped optional Connector Worker credential boundary."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import patch

from py import connector_credentials


def _encode_credentials(credentials):
    """Encode one valid Connector Worker runtime credential envelope."""

    payload = {
        "schema": connector_credentials.CONNECTOR_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class ConnectorCredentialTests(unittest.TestCase):
    """Verify process-only Connector Worker hydration and strict validation."""

    def setUp(self):
        """Reset cached credential state before each isolated test."""

        connector_credentials._reset_connector_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment state after each isolated test."""

        os.environ.pop(connector_credentials.CONNECTOR_CREDENTIAL_ENV, None)
        connector_credentials._reset_connector_credentials_cache_for_tests()

    def test_worker_hydrates_only_the_selected_platform(self):
        """Inject exact Slack fields without exposing another platform secret."""

        encoded = _encode_credentials({
            "qq": {"secret": "qq-secret"},
            "slack": {"bot_token": "xoxb-secret", "app_token": "xapp-secret"},
        })
        with patch.dict(os.environ, {connector_credentials.CONNECTOR_CREDENTIAL_ENV: encoded}):
            configuration = connector_credentials.apply_connector_credentials(
                "slack",
                {
                    "bot_token": "",
                    "app_token": "",
                    "credentialFieldsConfigured": ["bot_token", "app_token"],
                    "mode": "socket",
                },
            )

        self.assertEqual(configuration["bot_token"], "xoxb-secret")
        self.assertEqual(configuration["app_token"], "xapp-secret")
        self.assertEqual(configuration["mode"], "socket")
        self.assertNotIn("credentialFieldsConfigured", configuration)
        self.assertNotIn("qq-secret", json.dumps(configuration))
        self.assertNotIn(connector_credentials.CONNECTOR_CREDENTIAL_ENV, os.environ)

    def test_process_without_main_envelope_preserves_existing_configuration(self):
        """Retain Browser and Server connector secrets when Main is absent."""

        configuration = connector_credentials.apply_connector_credentials(
            "discord",
            {"token": "browser-token", "mode": "browser"},
        )

        self.assertEqual(configuration["token"], "browser-token")
        self.assertEqual(configuration["mode"], "browser")

    def test_runtime_envelope_rejects_unknown_fields_and_short_secrets(self):
        """Fail closed for cross-platform fields and undersized secret values."""

        invalid_cases = [
            {"qq": {"token": "wrong-field"}},
            {"discord": {"token": "abc"}},
        ]
        for credentials in invalid_cases:
            with self.subTest(credentials=credentials):
                self.setUp()
                encoded = _encode_credentials(credentials)
                with patch.dict(os.environ, {connector_credentials.CONNECTOR_CREDENTIAL_ENV: encoded}):
                    with self.assertRaises(RuntimeError):
                        connector_credentials.apply_connector_credentials("discord", {})


if __name__ == "__main__":
    unittest.main()
