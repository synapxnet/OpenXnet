# -*- coding: utf-8 -*-
"""Tests for Main-scoped search credential hydration and redaction."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import patch

from py import search_credentials
from py.get_setting import redact_managed_credentials_for_renderer


def _encode_credentials(credentials):
    """Encode one valid runtime search credential envelope."""

    payload = {
        "schema": search_credentials.SEARCH_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class SearchCredentialTests(unittest.TestCase):
    """Verify exact runtime hydration and persistence redaction behavior."""

    def setUp(self):
        """Reset cached credential state before each test."""

        search_credentials._reset_search_credentials_cache_for_tests()

    def tearDown(self):
        """Remove any unconsumed search credential environment value."""

        os.environ.pop(search_credentials.SEARCH_CREDENTIAL_ENV, None)
        search_credentials._reset_search_credentials_cache_for_tests()

    def test_runtime_credentials_hydrate_and_redact_web_search(self):
        """Main credentials should exist only in the in-memory settings view."""

        encoded = _encode_credentials({"tavily": "tavily-secret", "jina": "jina-secret"})
        with patch.dict(os.environ, {search_credentials.SEARCH_CREDENTIAL_ENV: encoded}):
            hydrated = search_credentials.apply_search_credentials({
                "webSearch": {
                    "engine": "tavily",
                    "tavily_api_key": "legacy-secret",
                    "bing_api_key": "legacy-bing-secret",
                }
            })
            self.assertEqual(hydrated["webSearch"]["tavily_api_key"], "tavily-secret")
            self.assertEqual(hydrated["webSearch"]["jina_api_key"], "jina-secret")
            self.assertEqual(hydrated["webSearch"]["bing_api_key"], "")
            self.assertTrue(hydrated["webSearch"]["tavily_api_key_configured"])
            persisted = search_credentials.redact_search_credentials_for_persistence(hydrated)
            self.assertEqual(persisted["webSearch"]["tavily_api_key"], "")
            self.assertNotIn("tavily-secret", json.dumps(persisted))
            renderer_settings = redact_managed_credentials_for_renderer(hydrated)
            self.assertEqual(renderer_settings["webSearch"]["jina_api_key"], "")
            self.assertNotIn("jina-secret", json.dumps(renderer_settings))

    def test_runtime_credentials_reject_unknown_ids_and_oversized_values(self):
        """Unknown credential classes and oversized secrets must fail closed."""

        invalid_values = [
            {"unknown": "secret"},
            {"tavily": "x" * (search_credentials.MAX_SEARCH_SECRET_LENGTH + 1)},
        ]
        for credentials in invalid_values:
            with self.subTest(credentials=list(credentials)):
                search_credentials._reset_search_credentials_cache_for_tests()
                encoded = _encode_credentials(credentials)
                with patch.dict(os.environ, {search_credentials.SEARCH_CREDENTIAL_ENV: encoded}):
                    with self.assertRaises(RuntimeError):
                        search_credentials.apply_search_credentials({"webSearch": {}})


if __name__ == "__main__":
    unittest.main()
