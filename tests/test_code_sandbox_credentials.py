# -*- coding: utf-8 -*-
"""Tests for Main-scoped code-sandbox credentials and execution hardening."""

from __future__ import annotations

import base64
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from py import code_interpreter
from py import code_sandbox_credentials


def _encode_credentials(credentials):
    """Encode one valid code-sandbox runtime credential envelope."""

    payload = {
        "schema": code_sandbox_credentials.CODE_SANDBOX_CREDENTIAL_SCHEMA,
        "credentials": credentials,
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class CodeSandboxCredentialTests(unittest.TestCase):
    """Verify strict E2B hydration and persistence redaction."""

    def setUp(self):
        """Reset cached credential state before each isolated test."""

        code_sandbox_credentials._reset_code_sandbox_credentials_cache_for_tests()

    def tearDown(self):
        """Remove unconsumed environment state after each isolated test."""

        os.environ.pop(code_sandbox_credentials.CODE_SANDBOX_CREDENTIAL_ENV, None)
        code_sandbox_credentials._reset_code_sandbox_credentials_cache_for_tests()

    def test_runtime_hydrates_only_e2b_key(self):
        """Inject the E2B key while retaining all public sandbox metadata."""

        encoded = _encode_credentials({"e2b_api_key": "e2b-secret"})
        with patch.dict(
            os.environ,
            {code_sandbox_credentials.CODE_SANDBOX_CREDENTIAL_ENV: encoded},
        ):
            settings = code_sandbox_credentials.apply_code_sandbox_credentials({
                "codeSettings": {
                    "enabled": True,
                    "engine": "e2b",
                    "e2b_api_key": "",
                    "sandbox_url": "http://127.0.0.1:8080",
                },
                "HASettings": {"api_key": "separate-zone"},
            })

        configuration = settings["codeSettings"]
        self.assertEqual(configuration["e2b_api_key"], "e2b-secret")
        self.assertEqual(configuration["sandbox_url"], "http://127.0.0.1:8080")
        self.assertEqual(settings["HASettings"]["api_key"], "separate-zone")
        self.assertNotIn(code_sandbox_credentials.CODE_SANDBOX_CREDENTIAL_ENV, os.environ)

    def test_runtime_redacts_e2b_key_for_persistence(self):
        """Clear the hydrated E2B key while retaining configured metadata."""

        encoded = _encode_credentials({"e2b_api_key": "e2b-secret"})
        with patch.dict(
            os.environ,
            {code_sandbox_credentials.CODE_SANDBOX_CREDENTIAL_ENV: encoded},
        ):
            runtime = code_sandbox_credentials.apply_code_sandbox_credentials({
                "codeSettings": {"e2b_api_key": ""},
            })
            redacted = code_sandbox_credentials.redact_code_sandbox_credentials_for_persistence(
                runtime,
            )

        self.assertEqual(redacted["codeSettings"]["e2b_api_key"], "")
        self.assertEqual(
            redacted["codeSettings"]["codeSandboxCredentialFieldsConfigured"],
            ["e2b_api_key"],
        )
        self.assertNotIn("e2b-secret", json.dumps(redacted))

    def test_process_without_main_envelope_preserves_server_configuration(self):
        """Retain plaintext E2B settings for non-Desktop Server profiles."""

        settings = code_sandbox_credentials.apply_code_sandbox_credentials({
            "codeSettings": {"e2b_api_key": "server-secret"},
        })
        self.assertEqual(settings["codeSettings"]["e2b_api_key"], "server-secret")

    def test_runtime_envelope_rejects_unknown_fields_and_short_secrets(self):
        """Fail closed for unrelated trust zones and undersized E2B secrets."""

        invalid_cases = [
            {"comfyuiAPIkey": "wrong-zone"},
            {"e2b_api_key": "abc"},
        ]
        for credentials in invalid_cases:
            with self.subTest(credentials=credentials):
                self.setUp()
                encoded = _encode_credentials(credentials)
                with patch.dict(
                    os.environ,
                    {code_sandbox_credentials.CODE_SANDBOX_CREDENTIAL_ENV: encoded},
                ):
                    with self.assertRaises(RuntimeError):
                        code_sandbox_credentials.apply_code_sandbox_credentials({
                            "codeSettings": {},
                        })


class _FailingSandbox:
    """Synthetic E2B client that raises a credential-bearing transport error."""

    def __init__(self, api_key):
        """Retain the secret only to model a reflected provider exception."""

        self.api_key = api_key

    def __enter__(self):
        """Enter the synthetic E2B context."""

        return self

    def __exit__(self, _error_type, _error, _traceback):
        """Exit the synthetic E2B context without suppressing failures."""

        return False

    def run_code(self, _code, language):
        """Raise one provider error containing the configured API key."""

        raise RuntimeError(f"{language} request failed with {self.api_key}")


class _RedirectResponse:
    """Synthetic HTTP redirect returned by the local sandbox."""

    status = 302
    charset = "utf-8"

    async def __aenter__(self):
        """Enter the synthetic response context."""

        return self

    async def __aexit__(self, _error_type, _error, _traceback):
        """Exit the synthetic response context."""

        return False


class _RedirectSession:
    """Synthetic aiohttp session used to inspect redirect behavior."""

    request_options = None

    def __init__(self, **_options):
        """Create a session while ignoring the configured timeout object."""

    async def __aenter__(self):
        """Enter the synthetic session context."""

        return self

    async def __aexit__(self, _error_type, _error, _traceback):
        """Exit the synthetic session context."""

        return False

    def post(self, _url, **options):
        """Capture request options and return one redirect response."""

        type(self).request_options = options
        return _RedirectResponse()


class _OversizedContent:
    """Synthetic response stream that exceeds the sandbox response budget."""

    async def iter_chunked(self, _chunk_size):
        """Yield one payload larger than the permitted response size."""

        yield b"x" * (code_interpreter.MAX_SANDBOX_RESPONSE_BYTES + 1)


class _OversizedResponse:
    """Synthetic successful response containing an oversized body."""

    charset = "utf-8"
    content = _OversizedContent()


class CodeInterpreterSecurityTests(unittest.IsolatedAsyncioTestCase):
    """Verify sandbox URL and error boundaries around code execution."""

    async def test_e2b_replaces_credential_bearing_exceptions(self):
        """Return a stable failure when the E2B client reflects its API key."""

        secret = "e2b-secret"
        with (
            patch.object(code_interpreter, "Sandbox", _FailingSandbox),
            patch.object(
                code_interpreter,
                "load_settings",
                new=AsyncMock(return_value={"codeSettings": {"e2b_api_key": secret}}),
            ),
        ):
            result = await code_interpreter.e2b_code("print('ok')", "python")

        self.assertEqual(result, "E2B 代码执行失败。")
        self.assertNotIn(secret, result)

    def test_sandbox_url_policy_allows_loopback_http_and_external_https(self):
        """Reject public cleartext, userinfo, query, and fragment sandbox URLs."""

        self.assertEqual(
            code_interpreter._build_sandbox_endpoint({
                "codeSettings": {"sandbox_url": "http://127.0.0.1:8080/api"},
            }),
            "http://127.0.0.1:8080/api/run_code",
        )
        self.assertEqual(
            code_interpreter._build_sandbox_endpoint({
                "codeSettings": {"sandbox_url": "https://sandbox.example.test"},
            }),
            "https://sandbox.example.test/run_code",
        )
        for url in [
            "http://sandbox.example.test",
            "https://user:password@sandbox.example.test",
            "https://sandbox.example.test?token=secret",
            "https://sandbox.example.test#secret",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                code_interpreter._build_sandbox_endpoint({
                    "codeSettings": {"sandbox_url": url},
                })

    async def test_local_sandbox_disables_redirects(self):
        """Do not follow a local sandbox response into a different trust boundary."""

        _RedirectSession.request_options = None
        with (
            patch.object(code_interpreter, "ClientSession", _RedirectSession),
            patch.object(
                code_interpreter,
                "load_settings",
                new=AsyncMock(return_value={
                    "codeSettings": {"sandbox_url": "http://localhost:8080"},
                }),
            ),
        ):
            result = await code_interpreter.local_run_code("print('ok')")

        self.assertEqual(result, "本地代码沙箱拒绝重定向。")
        self.assertEqual(_RedirectSession.request_options["allow_redirects"], False)

    async def test_sandbox_bounds_code_language_and_response_sizes(self):
        """Reject oversized request fields and stop reading oversized responses."""

        with self.assertRaises(ValueError):
            code_interpreter._validate_code("x" * (code_interpreter.MAX_CODE_BYTES + 1))
        with self.assertRaises(ValueError):
            code_interpreter._validate_language("x" * (code_interpreter.MAX_LANGUAGE_BYTES + 1))
        result = await code_interpreter._read_bounded_response(_OversizedResponse())
        self.assertEqual(result, "代码沙箱响应超过 2 MiB 限制。")


if __name__ == "__main__":
    unittest.main()
