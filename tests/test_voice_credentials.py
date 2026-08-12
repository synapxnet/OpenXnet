# -*- coding: utf-8 -*-
"""Tests for Main-scoped voice credential hydration and redaction."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import patch

from py import voice_credentials
from py.get_setting import redact_managed_credentials_for_renderer


def _encode_credentials(credentials):
    """Encode one valid runtime voice credential envelope."""

    payload = {
        "schema": voice_credentials.VOICE_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class VoiceCredentialTests(unittest.TestCase):
    """Verify scoped runtime hydration and persistence redaction behavior."""

    def setUp(self):
        """Reset cached credential state before each test."""

        voice_credentials._reset_voice_credentials_cache_for_tests()

    def tearDown(self):
        """Remove any unconsumed voice credential environment value."""

        os.environ.pop(voice_credentials.VOICE_CREDENTIAL_ENV, None)
        voice_credentials._reset_voice_credentials_cache_for_tests()

    def test_runtime_credentials_hydrate_and_redact_default_and_named_voices(self):
        """Main credentials should exist only in the in-memory TTS settings view."""

        encoded = _encode_credentials({
            "default": {
                "azureSpeechKey": "azure-secret",
                "googleServiceAccount": '{"private_key":"google-secret"}',
            },
            "Narrator": {"fishApiKey": "fish-secret"},
        })
        with patch.dict(os.environ, {voice_credentials.VOICE_CREDENTIAL_ENV: encoded}):
            hydrated = voice_credentials.apply_voice_credentials({
                "ttsSettings": {
                    "azureSpeechKey": "legacy-secret",
                    "newtts": {
                        "Narrator": {"fishApiKey": "legacy-fish-secret"},
                    },
                }
            })
            tts_settings = hydrated["ttsSettings"]
            narrator = tts_settings["newtts"]["Narrator"]
            self.assertEqual(tts_settings["azureSpeechKey"], "azure-secret")
            self.assertEqual(narrator["fishApiKey"], "fish-secret")
            self.assertNotIn(voice_credentials.VOICE_CREDENTIAL_ENV, os.environ)

            persisted = voice_credentials.redact_voice_credentials_for_persistence(hydrated)
            self.assertEqual(persisted["ttsSettings"]["azureSpeechKey"], "")
            self.assertEqual(
                persisted["ttsSettings"]["newtts"]["Narrator"]["fishApiKey"],
                "",
            )
            self.assertNotIn("azure-secret", json.dumps(persisted))
            renderer_settings = redact_managed_credentials_for_renderer(hydrated)
            self.assertNotIn("fish-secret", json.dumps(renderer_settings))

    def test_tetos_config_uses_named_scope_without_overwriting_transient_values(self):
        """Voice-list requests should resolve the requested scope and honor new drafts."""

        encoded = _encode_credentials({
            "Narrator": {
                "xunfeiAppId": "stored-app",
                "xunfeiApiKey": "stored-key",
                "xunfeiApiSecret": "stored-secret",
            },
        })
        with patch.dict(os.environ, {voice_credentials.VOICE_CREDENTIAL_ENV: encoded}):
            config = voice_credentials.build_tetos_voice_config(
                "xunfei",
                {"api_key": "transient-key"},
                "Narrator",
            )
            self.assertEqual(config["app_id"], "stored-app")
            self.assertEqual(config["api_key"], "transient-key")
            self.assertEqual(config["api_secret"], "stored-secret")

    def test_browser_profile_keeps_existing_voice_values(self):
        """Processes without Main hydration must preserve Server-profile settings."""

        config = {"azureSpeechKey": "browser-secret"}
        hydrated = voice_credentials.apply_voice_credentials_to_scope(
            config,
            " browser-compatible-scope ",
        )
        self.assertEqual(hydrated["azureSpeechKey"], "browser-secret")
        tetos_config = voice_credentials.build_tetos_voice_config(
            "azure",
            {"speech_key": "browser-secret"},
            " browser-compatible-scope ",
        )
        self.assertEqual(tetos_config["speech_key"], "browser-secret")
        persisted = voice_credentials.redact_voice_credentials_for_persistence({
            "ttsSettings": config,
        })
        self.assertEqual(persisted["ttsSettings"]["azureSpeechKey"], "browser-secret")

    def test_runtime_credentials_reject_unknown_fields_and_invalid_google_json(self):
        """Unknown vendor fields and malformed service accounts must fail closed."""

        invalid_values = [
            {"default": {"unknown": "secret"}},
            {"default": {"googleServiceAccount": "not-json"}},
        ]
        for credentials in invalid_values:
            with self.subTest(credentials=credentials):
                voice_credentials._reset_voice_credentials_cache_for_tests()
                encoded = _encode_credentials(credentials)
                with patch.dict(os.environ, {voice_credentials.VOICE_CREDENTIAL_ENV: encoded}):
                    with self.assertRaises(RuntimeError):
                        voice_credentials.apply_voice_credentials({"ttsSettings": {}})


if __name__ == "__main__":
    unittest.main()
