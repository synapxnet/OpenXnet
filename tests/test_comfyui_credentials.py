# -*- coding: utf-8 -*-
"""Tests for Main-scoped ComfyUI credentials and request hardening."""

from __future__ import annotations

import base64
import json
import os
from unittest import IsolatedAsyncioTestCase, TestCase, mock

from py import comfyui_credentials
from py.comfyui_tool import (
    ComfyUiRequestError,
    _normalize_server_candidates,
    _safe_output_filename,
    normalize_comfyui_image_url,
    normalize_comfyui_server_url,
    queue_prompt,
)


def _encode_credentials(credentials: dict[str, str]) -> str:
    """Encode one valid ComfyUI runtime credential envelope."""

    payload = {
        "schema": comfyui_credentials.COMFYUI_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class ComfyUiCredentialTests(TestCase):
    """Validate process-scoped ComfyUI hydration and redaction."""

    def setUp(self) -> None:
        """Reset cached process credentials before each test."""

        comfyui_credentials._reset_comfyui_credentials_cache_for_tests()
        os.environ.pop(comfyui_credentials.COMFYUI_CREDENTIAL_ENV, None)

    def tearDown(self) -> None:
        """Remove process credential state after each test."""

        os.environ.pop(comfyui_credentials.COMFYUI_CREDENTIAL_ENV, None)
        comfyui_credentials._reset_comfyui_credentials_cache_for_tests()

    def test_hydrates_and_consumes_main_envelope(self) -> None:
        """Hydrate the global key and remove its bootstrap environment variable."""

        os.environ[comfyui_credentials.COMFYUI_CREDENTIAL_ENV] = _encode_credentials(
            {"api_key": "comfyui-secret"}
        )
        settings = comfyui_credentials.hydrate_comfyui_settings({
            "comfyuiServers": ["http://127.0.0.1:8188"],
            "comfyuiAPIkey": "",
        })
        self.assertEqual(settings["comfyuiAPIkey"], "comfyui-secret")
        self.assertEqual(settings["comfyuiCredentialFieldsConfigured"], ["api_key"])
        self.assertNotIn(comfyui_credentials.COMFYUI_CREDENTIAL_ENV, os.environ)

    def test_redacts_only_when_main_boundary_is_enabled(self) -> None:
        """Remove hydrated ComfyUI plaintext while retaining endpoint metadata."""

        os.environ[comfyui_credentials.COMFYUI_CREDENTIAL_ENV] = _encode_credentials(
            {"api_key": "comfyui-secret"}
        )
        hydrated = comfyui_credentials.hydrate_comfyui_settings({
            "comfyuiServers": ["https://comfy.example.test"],
        })
        redacted = comfyui_credentials.redact_comfyui_credentials_for_persistence(hydrated)
        self.assertEqual(redacted["comfyuiAPIkey"], "")
        self.assertEqual(redacted["comfyuiCredentialFieldsConfigured"], ["api_key"])
        self.assertEqual(redacted["comfyuiServers"], ["https://comfy.example.test"])
        self.assertNotIn("comfyui-secret", json.dumps(redacted))

    def test_rejects_invalid_schema_and_fields(self) -> None:
        """Reject malformed or cross-zone runtime credential envelopes."""

        invalid = base64.b64encode(json.dumps({
            "schema": "wrong-schema",
            "credentials": {"api_key": "comfyui-secret"},
        }).encode("utf-8")).decode("ascii")
        os.environ[comfyui_credentials.COMFYUI_CREDENTIAL_ENV] = invalid
        with self.assertRaisesRegex(RuntimeError, "schema is invalid"):
            comfyui_credentials.hydrate_comfyui_settings({})

        comfyui_credentials._reset_comfyui_credentials_cache_for_tests()
        os.environ[comfyui_credentials.COMFYUI_CREDENTIAL_ENV] = _encode_credentials(
            {"e2b_api_key": "wrong-zone"}
        )
        with self.assertRaisesRegex(RuntimeError, "fields are invalid"):
            comfyui_credentials.hydrate_comfyui_settings({})


class ComfyUiUrlPolicyTests(TestCase):
    """Validate ComfyUI server, source image, and path restrictions."""

    def test_allows_loopback_http_and_external_https(self) -> None:
        """Accept explicit local HTTP and protected external endpoints."""

        self.assertEqual(
            normalize_comfyui_server_url("http://127.0.0.1:8188/"),
            "http://127.0.0.1:8188",
        )
        self.assertEqual(
            normalize_comfyui_server_url("https://comfy.example.test/base/"),
            "https://comfy.example.test/base",
        )
        self.assertEqual(
            normalize_comfyui_image_url("https://images.example.test/a.png?sig=1"),
            "https://images.example.test/a.png?sig=1",
        )

    def test_rejects_external_http_userinfo_and_server_query(self) -> None:
        """Reject downgrade, authority confusion, and ambiguous base URLs."""

        for value in (
            "http://comfy.example.test",
            "https://user:pass@comfy.example.test",
            "https://comfy.example.test?target=other",
            "file:///tmp/comfy",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ComfyUiRequestError):
                    normalize_comfyui_server_url(value)

    def test_rejects_traversal_and_filters_invalid_servers(self) -> None:
        """Reject output traversal and retain only validated unique endpoints."""

        with self.assertRaises(ComfyUiRequestError):
            _safe_output_filename("../secret.txt")
        self.assertEqual(_safe_output_filename("image.png"), "image.png")
        self.assertEqual(
            _normalize_server_candidates({
                "comfyuiServers": [
                    "http://comfy.example.test",
                    "http://127.0.0.1:8188",
                    "http://127.0.0.1:8188/",
                ],
            }),
            ["http://127.0.0.1:8188"],
        )


class ComfyUiPromptTests(IsolatedAsyncioTestCase):
    """Validate bounded prompt submission without real network traffic."""

    async def test_queue_prompt_injects_only_hydrated_global_key(self) -> None:
        """Place the Comfy.org key only in the documented prompt extra data."""

        with mock.patch("py.comfyui_tool._request_json", new=mock.AsyncMock(return_value={
            "prompt_id": "prompt-1",
        })) as request:
            result = await queue_prompt(
                mock.MagicMock(),
                {"1": {"inputs": {}}},
                "http://127.0.0.1:8188",
                {"comfyuiAPIkey": "comfyui-secret"},
            )
        self.assertEqual(result["prompt_id"], "prompt-1")
        payload = request.await_args.kwargs["json_body"]
        self.assertEqual(payload["extra_data"], {"api_key_comfy_org": "comfyui-secret"})
        self.assertNotIn("Authorization", json.dumps(payload))
