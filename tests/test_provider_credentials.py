# -*- coding: utf-8 -*-
"""Regression tests for process-scoped provider credential hydration."""

from __future__ import annotations

import base64
import importlib
import json
import os
import unittest

import py.provider_credentials as provider_credentials


def _encode_credentials(credentials: dict[str, str]) -> str:
    """Encode one valid Main-to-Python provider credential envelope."""

    payload = {
        "schema": provider_credentials.PROVIDER_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class ProviderCredentialRuntimeTests(unittest.TestCase):
    """Verify that provider keys exist only in hydrated process memory."""

    def tearDown(self) -> None:
        """Remove the process credential environment after each test."""

        os.environ.pop(provider_credentials.PROVIDER_CREDENTIAL_ENV, None)
        importlib.reload(provider_credentials)

    def test_hydrates_selected_providers_and_redacts_persistence(self) -> None:
        """Hydrate repeated provider fields and remove them from the disk copy."""

        os.environ[provider_credentials.PROVIDER_CREDENTIAL_ENV] = _encode_credentials(
            {"provider-a": "provider-secret"}
        )
        runtime = importlib.reload(provider_credentials)
        settings = {
            "selectedProvider": "provider-a",
            "api_key": "",
            "modelProviders": [
                {"id": "provider-a", "apiKey": "", "apiKeyConfigured": True}
            ],
            "reasoner": {"selectedProvider": "provider-a", "api_key": ""},
            "ccSettings": {"selectedProvider": "provider-a", "api_key": ""},
            "qcSettings": {"selectedProvider": "provider-a", "api_key": ""},
            "ocSettings": {"selectedProvider": "provider-a", "api_key": ""},
        }
        hydrated = runtime.apply_provider_credentials(settings)
        self.assertEqual(hydrated["api_key"], "provider-secret")
        self.assertEqual(hydrated["modelProviders"][0]["apiKey"], "provider-secret")
        self.assertEqual(hydrated["reasoner"]["api_key"], "provider-secret")
        self.assertEqual(hydrated["ccSettings"]["api_key"], "provider-secret")
        self.assertEqual(hydrated["qcSettings"]["api_key"], "provider-secret")
        self.assertEqual(hydrated["ocSettings"]["api_key"], "provider-secret")

        persisted = runtime.redact_provider_credentials_for_persistence(hydrated)
        self.assertEqual(persisted["api_key"], "")
        self.assertEqual(persisted["modelProviders"][0]["apiKey"], "")
        self.assertEqual(persisted["reasoner"]["api_key"], "")
        self.assertEqual(persisted["ccSettings"]["api_key"], "")
        self.assertEqual(persisted["qcSettings"]["api_key"], "")
        self.assertEqual(persisted["ocSettings"]["api_key"], "")
        self.assertNotIn("provider-secret", json.dumps(persisted))
        self.assertEqual(hydrated["api_key"], "provider-secret")

    def test_rejects_invalid_runtime_envelopes(self) -> None:
        """Reject malformed process input without exposing its content."""

        os.environ[provider_credentials.PROVIDER_CREDENTIAL_ENV] = "not-base64"
        runtime = importlib.reload(provider_credentials)
        with self.assertRaisesRegex(RuntimeError, "bootstrap is invalid"):
            runtime.apply_provider_credentials({})


if __name__ == "__main__":
    unittest.main()
