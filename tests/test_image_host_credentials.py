# -*- coding: utf-8 -*-
"""Tests for Main-scoped image-host credentials and upload error safety."""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from py import image_host_credentials
from py.image_host import _upload_file, _upload_smms


def _encode_credentials(credentials):
    """Encode one valid image-host runtime credential envelope."""

    payload = {
        "schema": image_host_credentials.IMAGE_HOST_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class _FakeImageHostResponse:
    """Minimal image-host HTTP response used by upload tests."""

    def __init__(self, status_code, payload):
        """Store one synthetic status and JSON response body."""

        self.status_code = status_code
        self._payload = payload

    def json(self):
        """Return the synthetic response body."""

        return self._payload


class ImageHostCredentialTests(unittest.TestCase):
    """Verify strict Connector Worker hydration and persistence redaction."""

    def setUp(self):
        """Reset cached credential state before each isolated test."""

        image_host_credentials._reset_image_host_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment state after each isolated test."""

        os.environ.pop(image_host_credentials.IMAGE_HOST_CREDENTIAL_ENV, None)
        image_host_credentials._reset_image_host_credentials_cache_for_tests()

    def test_runtime_hydrates_only_image_host_fields(self):
        """Inject both image-host fields without changing repository tokens."""

        encoded = _encode_credentials({
            "SMMS_api_key": "smms-secret",
            "EI2_api_key": "easy-image-secret",
        })
        with patch.dict(os.environ, {image_host_credentials.IMAGE_HOST_CREDENTIAL_ENV: encoded}):
            settings = image_host_credentials.apply_image_host_credentials({
                "BotConfig": {
                    "SMMS_api_key": "",
                    "EI2_api_key": "",
                    "gitee_token": "gitee-separate",
                    "github_token": "github-separate",
                },
            })

        configuration = settings["BotConfig"]
        self.assertEqual(configuration["SMMS_api_key"], "smms-secret")
        self.assertEqual(configuration["EI2_api_key"], "easy-image-secret")
        self.assertEqual(configuration["gitee_token"], "gitee-separate")
        self.assertEqual(configuration["github_token"], "github-separate")
        self.assertNotIn(image_host_credentials.IMAGE_HOST_CREDENTIAL_ENV, os.environ)

    def test_runtime_redacts_only_image_host_persistence_fields(self):
        """Clear hydrated image-host values while preserving repository tokens."""

        encoded = _encode_credentials({"SMMS_api_key": "smms-secret"})
        with patch.dict(os.environ, {image_host_credentials.IMAGE_HOST_CREDENTIAL_ENV: encoded}):
            runtime = image_host_credentials.apply_image_host_credentials({
                "BotConfig": {
                    "SMMS_api_key": "",
                    "EI2_api_key": "",
                    "github_token": "github-separate",
                },
            })
            redacted = image_host_credentials.redact_image_host_credentials_for_persistence(runtime)

        configuration = redacted["BotConfig"]
        self.assertEqual(configuration["SMMS_api_key"], "")
        self.assertEqual(configuration["EI2_api_key"], "")
        self.assertEqual(configuration["github_token"], "github-separate")
        self.assertEqual(
            configuration["imageHostCredentialFieldsConfigured"],
            ["SMMS_api_key"],
        )
        self.assertNotIn("smms-secret", json.dumps(redacted))

    def test_process_without_main_envelope_preserves_server_configuration(self):
        """Retain plaintext image-host settings for non-Desktop Server profiles."""

        settings = image_host_credentials.apply_image_host_credentials({
            "BotConfig": {"SMMS_api_key": "server-secret"},
        })

        self.assertEqual(settings["BotConfig"]["SMMS_api_key"], "server-secret")

    def test_runtime_envelope_rejects_unknown_fields_and_short_secrets(self):
        """Fail closed for repository fields and undersized image-host secrets."""

        invalid_cases = [
            {"github_token": "wrong-zone"},
            {"SMMS_api_key": "abc"},
        ]
        for credentials in invalid_cases:
            with self.subTest(credentials=credentials):
                self.setUp()
                encoded = _encode_credentials(credentials)
                with patch.dict(os.environ, {image_host_credentials.IMAGE_HOST_CREDENTIAL_ENV: encoded}):
                    with self.assertRaises(RuntimeError):
                        image_host_credentials.apply_image_host_credentials({})


class ImageHostUploadTests(unittest.IsolatedAsyncioTestCase):
    """Verify provider compatibility and credential-safe upload failures."""

    def setUp(self):
        """Create one temporary image used by upload adapter tests."""

        self.directory = tempfile.TemporaryDirectory(prefix="openxnet-image-host-")
        self.image_path = Path(self.directory.name) / "image.png"
        self.image_path.write_bytes(b"image-bytes")

    def tearDown(self):
        """Remove temporary upload test state."""

        self.directory.cleanup()

    def test_smms_upload_uses_authorization_without_returning_it(self):
        """Send the scoped SM.MS key and return only the uploaded image URL."""

        captured = {}

        def post(url, *, headers, files, timeout):
            """Capture one SM.MS request and return a successful response."""

            captured.update({"url": url, "headers": headers, "timeout": timeout})
            self.assertIn("smfile", files)
            return _FakeImageHostResponse(200, {
                "success": True,
                "data": {"url": "https://cdn.example.test/image.png"},
            })

        with patch("py.image_host.requests.post", side_effect=post):
            result = _upload_smms(
                {"SMMS_api_key": "smms-secret"},
                str(self.image_path),
            )

        self.assertEqual(captured["headers"], {"Authorization": "smms-secret"})
        self.assertEqual(result, "https://cdn.example.test/image.png")
        self.assertNotIn("smms-secret", result)

    async def test_easy_image_accepts_renderer_and_legacy_provider_ids(self):
        """Route both EI2 identifiers to one EasyImage upload implementation."""

        for provider in ("EI2", "easyImage2"):
            with self.subTest(provider=provider):
                settings = {
                    "BotConfig": {
                        "imgHost": provider,
                        "EI2_base_url": "https://images.example.test/api",
                        "EI2_api_key": "easy-image-secret",
                    },
                }
                with patch(
                    "py.image_host._upload_easy_image",
                    return_value="https://cdn.example.test/easy.png",
                ) as upload:
                    result = await _upload_file(
                        settings,
                        str(self.image_path),
                        cleanup_after=False,
                    )
                self.assertEqual(result, "https://cdn.example.test/easy.png")
                upload.assert_called_once()

    async def test_upload_replaces_credential_bearing_transport_errors(self):
        """Prevent request exceptions from reflecting image-host credentials."""

        secret = "smms-secret"
        settings = {
            "BotConfig": {
                "imgHost": "smms",
                "SMMS_api_key": secret,
            },
        }
        with patch(
            "py.image_host.requests.post",
            side_effect=RuntimeError(f"request failed with {secret}"),
        ):
            result = await _upload_file(
                settings,
                str(self.image_path),
                cleanup_after=False,
            )

        self.assertEqual(result, "图床上传失败")
        self.assertNotIn(secret, result)


if __name__ == "__main__":
    unittest.main()
